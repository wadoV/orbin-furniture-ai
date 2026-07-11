/**
 * Orbin AI - ExportPanel v2.1
 * STRICT PLAN ENFORCEMENT:
 *   free       → ALL exports blocked
 *   pro        → CSV lista de corte + Plano Ejecutivo 2D
 *   enterprise → ALL: Plano + Etiquetas Térmicas 60x40mm + CNC + BOM + CSV
 *
 * SECURITY: captureWireframe() READ-ONLY. No mutation of modules or renderer state.
 * PROTECTED: Does not touch Viewer3D.jsx or closetEngine.js.
 */

import { useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  Download, FileType, Box, Cpu, Scissors, Loader2, Check,
  AlertCircle, FileSpreadsheet, Lock, Crown, Ruler, Tag as TagIcon
} from 'lucide-react'
import { exportDesign, nestPieces, downloadBlob } from '../engine/exportAdapters.js'
import { drawElevation } from '../engine/planRenderer.js'
import { generateFactoryCutlist } from '../engine/CutlistGenerator.js'
import { generateModulePlanSVG, generateConjuntoPlanSVG } from '../engine/planGenerator.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { trackEvent, EVENTS } from '../lib/analytics.js'

// ── A4 landscape constants ────────────────────────────────────────────────────
const A4_W = 297, A4_H = 210, MARGIN = 8
const TITLE_W = 110, BORDER_W = 0.3, THICK_W = 0.6

// ── Thermal label constants (60x40mm) ─────────────────────────────────────────
const LBL_W = 60, LBL_H = 40

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate() {
  return new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function getModuleDims(mod) {
  const c = mod?.configuration || mod || {}
  return { W: c.width||0, H: c.height||0, D: c.depth||0 }
}

// Piece-type → abbreviation (using i18n key lookup fallback to EN)
function pieceAbbr(name, t) {
  const n = name.toLowerCase()
  if (n.includes('lateral') || n.includes('side') || n.includes('left') || n.includes('right'))
    return t('piece_abbr_lateral') || 'LAT'
  if (n.includes('shelf') || n.includes('prateleira') || n.includes('estante'))
    return t('piece_abbr_shelf') || 'EST'
  if (n.includes('bottom') || n.includes('base') || n.includes('fundo da caixa') || n.includes('base inferior'))
    return t('piece_abbr_base') || 'BASE'
  if (n.includes('top') || n.includes('tamp') || n.includes('tampa'))
    return t('piece_abbr_top') || 'TOP'
  if (n.includes('back') || n.includes('fundo') || n.includes('traseiro'))
    return t('piece_abbr_back') || 'FND'
  if (n.includes('drawer front') || n.includes('frente') || n.includes('front'))
    return t('piece_abbr_drawer_front') || 'FFR'
  if (n.includes('drawer box') || n.includes('caixa de gaveta') || n.includes('caja'))
    return t('piece_abbr_drawer_box') || 'CGV'
  if (n.includes('door') || n.includes('porta') || n.includes('puerta'))
    return t('piece_abbr_door') || 'PTA'
  if (n.includes('countertop') || n.includes('tampo') || n.includes('encimera'))
    return t('piece_abbr_countertop') || 'TMP'
  return name.slice(0, 3).toUpperCase()
}

// Extract pieces from modules for label generation
function extractPieces(modules) {
  const pieces = []
  modules.forEach((mod, modIdx) => {
    const cfg = mod.configuration || mod
    if (!cfg) return
    const W = cfg.width||600, H = cfg.height||720, D = cfg.depth||580
    const T = cfg.thickness||18, BT = cfg.backThickness||6
    const modId = mod.id || `MOD${String(modIdx+1).padStart(2,'0')}`
    const mat = cfg.materialId || 'MDF'
    const push = (name, w, h, type) =>
      pieces.push({ modId, name, w, h, t: T, material: mat, type, L1:'', L2:'', A1:'', A2:'' })

    push('Lateral Esq', D, H, 'structural')
    push('Lateral Dir', D, H, 'structural')
    push('Base Interna', W-2*T, D, 'structural')
    push('Tampo Interno', W-2*T, D, 'structural')
    push('Fundo', W, H, 'back'); pieces[pieces.length-1].t = BT

    const shelves = cfg.shelfCount || cfg.numShelves || 0
    for (let s=0; s<shelves; s++) push(`Prateleira ${s+1}`, W-2*T, D-20, 'shelf')

    const drawers = cfg.drawerCount || cfg.numDrawers || 0
    const dh = cfg.drawerHeight || 150
    for (let d=0; d<drawers; d++) {
      push(`Frente Gaveta ${d+1}`, W-2*T-6, dh, 'drawer_front')
      push(`Caixa Gaveta ${d+1}`, W-2*T-26, D-50, 'drawer_box')
    }

    if (cfg.hasDoors) {
      const nd = cfg.numDoors || 2
      for (let d=0; d<nd; d++) push(`Porta ${d+1}`, (W/nd)-2, H-4, 'door')
    }
    if (cfg.baseboard) push('Rodape', W, cfg.baseboardHeight||100, 'baseboard')
    if (cfg.hasCountertop) push('Tampo', W+40, D+40, 'countertop')
  })

  // Apply edgebanding rules
  return pieces.map(p => {
    let L1='', L2='', A1='', A2=''
    if (p.type==='door'||p.type==='drawer_front') { L1='1mm'; L2='1mm'; A1='1mm'; A2='1mm' }
    else if (p.type==='structural'||p.type==='shelf') { L1='1mm' }
    else if (p.type==='drawer_box') { L1='1mm' }
    else if (p.type==='baseboard') { L1='1mm'; L2='1mm' }
    return { ...p, L1, L2, A1, A2 }
  })
}

// ── PLANO EJECUTIVO 2D ─────────────────────────────────────────────────────────
async function generatePlanoPDF({ modules, captureWireframe, user, lang, t, companySettings }) {
  const titles = {
    PT: 'PLANO EXECUTIVO', ES: 'PLANO EJECUTIVO', EN: 'EXECUTIVE PLAN'
  }
  const L = ['PT','ES','EN'].includes(lang) ? lang : 'ES'
  
  // Clean design margins: 10mm
  const MARGIN = 10
  const A4_W = 297
  const A4_H = 210
  const ROT_W = 50 // Cuadro de rotulación (50mm width)
  const ROT_X = A4_W - MARGIN - ROT_W // 237mm
  
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const mod = modules[0] || {}
  const dims = getModuleDims(mod)
  const company = companySettings?.name || user?.company_name || user?.name || 'Orbin AI'
  const modId = mod.id || mod.name || 'MOD-001'
  const dimStr = dims.W ? `${dims.W} × ${dims.H} × ${dims.D} mm` : 'N/D'

  // Outer border - clean architectural frame
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.35)
  doc.rect(MARGIN, MARGIN, A4_W - 2 * MARGIN, A4_H - 2 * MARGIN)

  // Separator vertical line for Cuadro de Rotulación (Carátula)
  doc.line(ROT_X, MARGIN, ROT_X, A4_H - MARGIN)

  // Rotulación subdivision lines
  doc.setLineWidth(0.176)
  
  // heights of each section in the carátula (total 190mm)
  const heights = [20, 25, 25, 25, 25, 25, 45]
  let currentY = MARGIN
  
  // Draw inner divisions
  for (let i = 0; i < heights.length - 1; i++) {
    currentY += heights[i]
    doc.line(ROT_X, currentY, ROT_X + ROT_W, currentY)
  }

  // Draw text inside each block
  doc.setFont('helvetica', 'normal')
  
  // Block 1: Header/Title (20mm height)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(titles[L], ROT_X + ROT_W / 2, MARGIN + 12, { align: 'center' })

  // Block 2: PROYECTO (25mm height)
  let y = MARGIN + 20
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('PROYECTO', ROT_X + 4, y + 6)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Orbin AI Modular System', ROT_X + 4, y + 14)

  // Block 3: EMPRESA (25mm height)
  y += 25
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('EMPRESA', ROT_X + 4, y + 5)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(doc.splitTextToSize(company.toUpperCase(), ROT_W - 8), ROT_X + 4, y + 11)

  // Show Phone and Address if present
  doc.setFontSize(5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  let extraY = y + 16
  if (companySettings?.phone) {
    doc.text(`TEL: ${companySettings.phone}`, ROT_X + 4, extraY)
    extraY += 3.5
  }
  if (companySettings?.address) {
    doc.text(`DIR: ${doc.splitTextToSize(companySettings.address.toUpperCase(), ROT_W - 8)[0] || companySettings.address}`, ROT_X + 4, extraY)
  }

  // Block 4: COMPONENTE (25mm height)
  y += 25
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('COMPONENTE', ROT_X + 4, y + 6)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  const compText = `${modId} — ${String(mod.type || 'standard').toUpperCase()}`
  doc.text(doc.splitTextToSize(compText, ROT_W - 8), ROT_X + 4, y + 14)

  // Block 5: DIMENSIONES (25mm height)
  y += 25
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('DIMENSIONES', ROT_X + 4, y + 6)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(dimStr, ROT_X + 4, y + 14)

  // Calculate paper scales
  const imgW = 180
  const imgH = 135
  const aspect = imgW / imgH
  const modAspect = dims.W / dims.H
  let modulePaperW, modulePaperH
  if (modAspect > aspect) {
    modulePaperW = imgW * 0.85
    modulePaperH = modulePaperW / modAspect
  } else {
    modulePaperH = imgH * 0.85
    modulePaperW = modulePaperH * modAspect
  }
  const scaleFactor = dims.W / modulePaperW
  const scaleText = `E 1:${Math.round(scaleFactor)}`

  // Block 6: FECHA & ESCALA (25mm height)
  y += 25
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text('FECHA', ROT_X + 4, y + 6)
  doc.text('ESCALA', ROT_X + ROT_W / 2 + 4, y + 6)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(fmtDate(), ROT_X + 4, y + 14)
  doc.text(scaleText, ROT_X + ROT_W / 2 + 4, y + 14)
  // vertical separator line for date/scale inside rotulación
  doc.setLineWidth(0.176)
  doc.line(ROT_X + ROT_W / 2, y, ROT_X + ROT_W / 2, y + 25)

  // Block 7: Logo Footer (45mm height)
  y += 25
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(245, 166, 35)
  doc.text('ORBIN AI', ROT_X + ROT_W / 2, y + 20, { align: 'center' })
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('orbin.ai', ROT_X + ROT_W / 2, y + 26, { align: 'center' })

  // ── DRAWING AREA ────────────────────────────────────────────────────────────
  // Image layout bounding box
  const imgX = MARGIN + (ROT_X - MARGIN - imgW) / 2
  const imgY = MARGIN + (A4_H - 2 * MARGIN - imgH) / 2

  // Alzado técnico 2D (reemplaza el screenshot del wireframe)
  drawElevation(doc, mod, imgX, imgY, imgW, imgH)

  // MULTI-MÓDULO: tras dibujar el módulo 0, si modules.length > 1, añade una página por cada módulo extra con su propio alzado
  if (modules.length > 1) {
    for (let i = 1; i < modules.length; i++) {
      doc.addPage()
      drawElevation(doc, modules[i], imgX, imgY, imgW, imgH)
    }
  }

  // ── LINES OF COTA (DIMENSIONING SYSTEM) ──────────────────────────────────────
  const centerX = imgX + imgW / 2
  const centerY = imgY + imgH / 2
  const xMin = centerX - modulePaperW / 2
  const xMax = centerX + modulePaperW / 2
  const yMin = centerY - modulePaperH / 2
  const yMax = centerY + modulePaperH / 2

  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.2) // Thin cota lines

  // 1. Horizontal Superior: Width (W)
  const cotaY = yMin - 10
  doc.line(xMin, cotaY, xMax, cotaY)
  // Left extension line
  doc.line(xMin, yMin - 3, xMin, cotaY - 2)
  // Right extension line
  doc.line(xMax, yMin - 3, xMax, cotaY - 2)
  // 45 degrees oblique ticks
  doc.line(xMin - 1.5, cotaY - 1.5, xMin + 1.5, cotaY + 1.5)
  doc.line(xMax - 1.5, cotaY - 1.5, xMax + 1.5, cotaY + 1.5)
  // Text (W mm)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(30, 30, 30)
  doc.text(`${dims.W} mm`, centerX, cotaY - 2.5, { align: 'center' })

  // 2. Vertical Izquierda: Height (H)
  const cotaX = xMin - 10
  doc.line(cotaX, yMin, cotaX, yMax)
  // Top extension line
  doc.line(xMin - 3, yMin, cotaX - 2, yMin)
  // Bottom extension line
  doc.line(xMin - 3, yMax, cotaX - 2, yMax)
  // 45 degrees oblique ticks
  doc.line(cotaX - 1.5, yMin - 1.5, cotaX + 1.5, yMin + 1.5)
  doc.line(cotaX - 1.5, yMax - 1.5, cotaX + 1.5, yMax + 1.5)
  // Text (H mm)
  doc.text(`${dims.H} mm`, cotaX - 3, centerY + 1.5, { align: 'right' })

  // 3. Vertical Derecha: Baseboard / Zócalo height (BH)
  const cfg = mod.configuration || {}
  const BH = cfg.baseboardHeight || 100
  const bhPaper = BH * (modulePaperH / (cfg.height || 720))
  const cotaRightX = xMax + 10
  doc.line(cotaRightX, yMax - bhPaper, cotaRightX, yMax)
  // Top extension
  doc.line(xMax + 3, yMax - bhPaper, cotaRightX + 2, yMax - bhPaper)
  // Bottom extension
  doc.line(xMax + 3, yMax, cotaRightX + 2, yMax)
  // 45 degrees ticks
  doc.line(cotaRightX - 1.5, yMax - bhPaper - 1.5, cotaRightX + 1.5, yMax - bhPaper + 1.5)
  doc.line(cotaRightX - 1.5, yMax - 1.5, cotaRightX + 1.5, yMax + 1.5)
  // Text
  doc.text(`${BH} mm`, cotaRightX + 3, yMax - bhPaper / 2 + 1.5, { align: 'left' })

  // Save/Download Blob URL
  const blob = doc.output('blob')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `plano-ejecutivo-${modId}-${Date.now()}.pdf`
  a.click()
}

// ── ETIQUETAS TÉRMICAS 60×40mm ─────────────────────────────────────────────────
function generateEtiquetasPDF({ modules, user, lang, t }) {
  if (!modules || modules.length === 0) return
  const pieces = extractPieces(modules)
  if (pieces.length === 0) return

  const company = user?.company_name || user?.name || 'Orbin AI'
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:[LBL_W,LBL_H] })

  const QR_X=1.5, QR_Y=5, QR_W=18, QR_H=18
  const INFO_X=21, INFO_W=LBL_W-INFO_X-1.5
  const instanceCount = {}

  pieces.forEach((p, idx) => {
    if (idx > 0) doc.addPage([LBL_W, LBL_H], 'landscape')

    // Track instance per piece name per module
    const key = `${p.modId}-${p.name}`
    instanceCount[key] = (instanceCount[key] || 0) + 1
    const abbr = pieceAbbr(p.name, t)
    const modNum = p.modId.replace(/\D/g,'').padStart(2,'0') || '01'
    const labelCode = `${p.modId.toUpperCase()}-${abbr}-${String(instanceCount[key]).padStart(2,'0')}`

    // ── Outer border ──────────────────────────────────────────────────────
    doc.setDrawColor(60,60,60); doc.setLineWidth(0.3)
    doc.rect(0.5, 0.5, LBL_W-1, LBL_H-1)

    // ── Company header bar ─────────────────────────────────────────────────
    doc.setFillColor(20,20,20); doc.rect(0.5, 0.5, LBL_W-1, 4, 'F')
    doc.setFontSize(5); doc.setFont('helvetica','bold'); doc.setTextColor(245,166,35)
    doc.text(company.toUpperCase().slice(0,28), 2, 3.2)
    doc.setTextColor(100,100,100); doc.setFontSize(4)
    doc.text('ORBIN AI', LBL_W-2, 3.2, {align:'right'})

    // ── Divider after header ───────────────────────────────────────────────
    doc.setDrawColor(80,80,80); doc.setLineWidth(0.2)
    doc.line(0.5, 4.5, LBL_W-0.5, 4.5)

    // ── QR CODE placeholder box ────────────────────────────────────────────
    doc.setDrawColor(40,40,40); doc.setFillColor(245,245,245)
    doc.setLineWidth(0.3)
    doc.rect(QR_X, QR_Y, QR_W, QR_H, 'FD')
    // Crosshatch pattern to suggest QR
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.1)
    for (let i=0; i<QR_W; i+=2.5) {
      doc.line(QR_X+i, QR_Y, QR_X+i, QR_Y+QR_H)
    }
    for (let i=0; i<QR_H; i+=2.5) {
      doc.line(QR_X, QR_Y+i, QR_X+QR_W, QR_Y+i)
    }
    // Corner squares (QR style)
    doc.setFillColor(40,40,40); doc.setDrawColor(40,40,40);
    [[QR_X+0.5,QR_Y+0.5],[QR_X+QR_W-4.5,QR_Y+0.5],[QR_X+0.5,QR_Y+QR_H-4.5]].forEach(([x,y])=>{
      doc.rect(x, y, 4, 4, 'F')
      doc.setFillColor(245,245,245); doc.rect(x+0.8, y+0.8, 2.4, 2.4, 'F')
      doc.setFillColor(40,40,40); doc.rect(x+1.4, y+1.4, 1.2, 1.2, 'F')
    })
    doc.setFillColor(245,245,245);
    // QR label below box
    doc.setFontSize(3.5); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80)
    doc.text(t('etiquetas_qr_placeholder')||'QR CODE', QR_X+QR_W/2, QR_Y+QR_H+2.5, {align:'center'})

    // ── Vertical divider ───────────────────────────────────────────────────
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.2)
    doc.line(20, 4.5, 20, LBL_H-0.5)

    // ── Right column — piece info ──────────────────────────────────────────
    let ty = 7

    // Label code (bold, primary color)
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(245,166,35)
    doc.text(labelCode, INFO_X, ty)
    ty += 4.5

    // Piece name
    doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30)
    const nameLines = doc.splitTextToSize(p.name, INFO_W)
    doc.text(nameLines[0], INFO_X, ty); ty += 3.5

    // Dimensions
    const dimStr = `${p.w} × ${p.h} × ${p.t} mm`
    doc.setFontSize(4.5); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
    doc.text((t('etiquetas_dimensions')||'Dim') + ': ' + dimStr, INFO_X, ty); ty += 3

    // Material
    const matStr = String(p.material||'MDF').toUpperCase().slice(0,12)
    doc.text((t('etiquetas_material')||'Mat') + ': ' + matStr, INFO_X, ty); ty += 3

    // Edge map
    const eMap = [
      p.L1 ? `L1:${p.L1}` : '', p.L2 ? `L2:${p.L2}` : '',
      p.A1 ? `A1:${p.A1}` : '', p.A2 ? `A2:${p.A2}` : '',
    ].filter(Boolean)
    const eStr = eMap.length ? eMap.join(' ') : '—'
    doc.setFontSize(4); doc.setTextColor(80,80,80)
    doc.text((t('etiquetas_edge_map')||'Bordas') + ': ' + eStr, INFO_X, ty); ty += 3

    // Module ID footer
    doc.setFontSize(3.8); doc.setTextColor(120,120,120)
    doc.text(`${t('etiquetas_module_id')||'Módulo'}: ${p.modId}`, INFO_X, LBL_H-2)

    // Bottom label code (small, for scanning fallback)
    doc.setFontSize(3.5); doc.setFont('helvetica','normal'); doc.setTextColor(140,140,140)
    doc.text(labelCode, LBL_W/2, LBL_H-2, {align:'center'})
  })

  const modId = modules[0]?.id || 'ORB'
  const blob = doc.output('blob')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `etiquetas-termicas-${modId}-${Date.now()}.pdf`
  a.click()
}

// ── Locked button ─────────────────────────────────────────────────────────────
function LockedBtn({ label, tier = 'Pro', reason }) {
  const COLOR = tier==='Enterprise'
    ? 'text-blue-400/60 bg-blue-500/10 border-blue-500/20'
    : 'text-yellow-400/60 bg-yellow-500/10 border-yellow-500/20'
  return (
    <button type="button" onClick={() => trackEvent(EVENTS.PLAN_GATE_HIT, { featureBlocked: label, tier })} aria-label={`${label} — disponível no plano ${tier}`} className="relative w-full text-left p-3.5 rounded-xl border border-white/5 bg-surface-3/30 opacity-60 cursor-pointer hover:opacity-80 transition-opacity select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-white/5 text-muted"><Lock size={18} /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-muted">{label}</span>
            <span className={"text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5 border " + COLOR}>
              <Crown size={8} /> {tier}
            </span>
          </div>
          {reason && <p className="text-[10px] text-muted/50 mt-1">{reason}</p>}
        </div>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExportPanel({ modules = [], captureWireframe = null, captureIsometric = null }) {
  const { t, lang } = usePreferences()
  const { canExportPDF, canExportCSV, canExportCNC, canExportBOM, isEnterprise, isPro, isFree, user, companySettings, updateCompanySettings } = useUser()
  const [exporting,      setExporting]      = useState(null)
  const [success,        setSuccess]        = useState(null)
  const [error,          setError]          = useState(null)
  const [nestingResult,  setNestingResult]  = useState(null)
  const [genPlan,        setGenPlan]        = useState(false)
  const [genEtiquetas,   setGenEtiquetas]   = useState(false)

  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [saveAsDefault, setSaveAsDefault] = useState(() => {
    try { return !!localStorage.getItem('orbin-company-settings') }
    catch { return false }
  })

  const handleCompanyFieldChange = (field, val) => {
    const updated = { ...companySettings, [field]: val }
    updateCompanySettings(updated, saveAsDefault)
    if (saveAsDefault) {
      localStorage.setItem('orbin-company-settings', JSON.stringify(updated))
    }
  }

  const handleCheckboxChange = (e) => {
    const checked = e.target.checked
    setSaveAsDefault(checked)
    if (checked) {
      localStorage.setItem('orbin-company-settings', JSON.stringify(companySettings))
    }
  }

  const isES = lang==='ES', isPT = lang==='PT'

  const handleExport = async (fmtId) => {
    setExporting(fmtId); setError(null); setSuccess(null)
    try {
      const r = await exportDesign(fmtId, modules)
      downloadBlob(r.blob, r.filename)
      trackEvent(EVENTS.FILE_EXPORTED, { format: fmtId })
      setSuccess(fmtId); setTimeout(()=>setSuccess(null), 2500)
    } catch(e) { setError(e.message) }
    finally { setExporting(null) }
  }

  const handleNesting = () => {
    try {
      const pieces = []
      modules.forEach(mod=>{
        const c=mod.configuration; if(!c) return
        const W=c.width||600,H=c.height||720,D=c.depth||580,T=c.thickness||18,BT=c.backThickness||6
        pieces.push({name:'Lateral Esq',w:D,h:H,t:T},{name:'Lateral Dir',w:D,h:H,t:T})
        pieces.push({name:'Base',w:W-2*T,h:D,t:T},{name:'Tampo',w:W-2*T,h:D,t:T})
        pieces.push({name:'Fundo',w:W,h:H,t:BT})
        for(let s=0;s<(c.shelfCount||0);s++) pieces.push({name:`Prat ${s+1}`,w:W-2*T,h:D-20,t:T})
        for(let d=0;d<(c.drawerCount||0);d++) pieces.push({name:`Gaveta ${d+1}`,w:W-2*T-6,h:c.drawerHeight||150,t:T})
      })
      if(!pieces.length){setError('No pieces'); return}
      setNestingResult(nestPieces(pieces).stats)
    }catch(e){setError(e.message)}
  }

  const handlePlanoPDF = async () => {
    if(genPlan) return
    setGenPlan(true); setError(null)
    try { await generatePlanoPDF({ modules, captureWireframe, user, lang, t, companySettings }) }
    catch(e) { console.error("PLANO ERROR:", e); setError('PLANO ERROR: ' + e.message) }
    finally { setGenPlan(false) }
  }

  // ── PLANO DE MONTAGEM (novo) — SVG paramétrico (planGenerator) -> PNG -> PDF ──
  const companyForPlan = () => ({
    empresa: companySettings?.name, setor: companySettings?.setor,
    material: companySettings?.material, desenhista: companySettings?.desenhista || user?.name,
    data: companySettings?.data,
  })
  const svgToPngDataURL = (svgString, scale = 2.5) => new Promise((resolve, reject) => {
    try {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const W = Math.round(1000 * scale), H = Math.round(740 * scale)
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H
        const ctx = cv.getContext('2d')
        ctx.drawImage(img, 0, 0, W, H)
        URL.revokeObjectURL(url)
        resolve(cv.toDataURL('image/png'))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG->PNG failed')) }
      img.src = url
    } catch (err) { reject(err) }
  })
  const handlePlanoPro = async (mode) => {
    if (genPlan) return
    setGenPlan(true); setError(null)
    try {
      const iso = (typeof captureIsometric === 'function') ? captureIsometric() : null
      const company = companyForPlan()
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight()
      const addSVG = async (svg, first) => {
        const png = await svgToPngDataURL(svg, 2.5)
        if (!first) pdf.addPage('a4', 'landscape')
        pdf.addImage(png, 'PNG', 0, 0, PW, PH)
      }
      if (mode === 'conjunto') {
        await addSVG(generateConjuntoPlanSVG(modules, { theme: 'print', company, isoDataURL: iso }), true)
      } else {
        for (let i = 0; i < modules.length; i++) {
          await addSVG(generateModulePlanSVG(modules[i], { theme: 'print', company, isoDataURL: iso }), i === 0)
        }
      }
      pdf.save(`orbin-plano-${mode}-${Date.now()}.pdf`)
      trackEvent(EVENTS.FILE_EXPORTED, { format: 'plano-pro-' + mode })
    } catch (err) { console.error('PLANO PRO ERROR:', err); setError('PLANO ERROR: ' + err.message) }
    finally { setGenPlan(false) }
  }

  const handleEtiquetas = () => {
    if(genEtiquetas) return
    setGenEtiquetas(true); setError(null)
    try { generateEtiquetasPDF({ modules, user, lang, t }) }
    catch(e) { console.error("ETIQUETAS ERROR:", e); setError('ETIQUETAS ERROR: ' + e.message) }
    finally { setGenEtiquetas(false) }
  }

  const handleCSVCutlist = () => {
    try {
      const pieces = extractPieces(modules).map(p=>({
        name:p.name, w:p.w, h:p.h, t:p.t, material:p.material||'MDF',
        type:p.type, L1:p.L1, L2:p.L2, A1:p.A1, A2:p.A2
      }))
      const r = generateFactoryCutlist(pieces, { edgeThickness:1 })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(r.blob); a.download = r.filename; a.click()
      setSuccess('csv'); setTimeout(()=>setSuccess(null), 2500)
    } catch(e) { setError(e.message) }
  }

  if (!modules || modules.length === 0) return null

  const planoLabel = isES?'Plano Ejecutivo 2D':isPT?'Plano Executivo 2D':'2D Executive Plan'
  const etqLabel   = isES?'Etiquetas de Corte Térmicas':isPT?'Etiquetas de Corte Térmicas':'Thermal Cut Labels'
  const csvLabel   = isES?'Lista de Cortes (CSV)':isPT?'Lista de Cortes (CSV)':'Cut List (CSV)'
  const dxfDesc    = isES?'Planos 2D vectoriales para AutoCAD':isPT?'Desenhos vetoriais 2D para AutoCAD':'2D vector drawings for AutoCAD'
  const gltfDesc   = isES?'Modelo 3D para SketchUp':isPT?'Modelo 3D para SketchUp':'3D model for SketchUp'

  return (
    <div className="bg-zinc-900/60 backdrop-blur-lg border-r border-zinc-800/50 rounded-2xl p-4 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-zinc-500 flex items-center gap-2">
          <Download size={16} className="text-zinc-500 animate-pulse" />
          {t('export_panel_title') || 'Exportação Industrial'}
        </h3>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">PRO CAD</span>
      </div>

      {/* ── FREE PLAN BANNER ──────────────────────────────────────────────── */}
      {isFree && (
        <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl space-y-2">
          <p className="text-[11px] text-yellow-300 font-bold flex items-center gap-1.5">
            <Lock size={10} />{t('plan_free_export_banner')||'Exportações bloqueadas no plano gratuito.'}
          </p>
          <a href="/register?plan=pro"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary border border-primary/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/25 transition-all">
            <Crown size={10} />{t('plan_upgrade_btn')||'Fazer Upgrade'}
          </a>
        </div>
      )}

      {/* ── PRO ENTERPRISE NOTICE ─────────────────────────────────────────── */}
      {isPro && !isEnterprise && (
        <div className="p-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl">
          <p className="text-[10px] text-blue-400/80">{t('plan_pro_export_locked_ent')||'Etiquetas, CNC e BOM são do plano Industrial.'}</p>
        </div>
      )}

      {/* ── DATOS DE EMISIÓN (MARCA BLANCA) ─────────────────────────── */}
      <div className="border-t border-zinc-800/30 pt-3">
        <button
          onClick={() => setShowCompanyForm(v => !v)}
          className="w-full flex items-center justify-between text-left text-[10px] tracking-widest uppercase font-semibold text-zinc-500 hover:text-white transition-colors"
        >
          <span>📋 Datos de Emisión (Marca Blanca)</span>
          <span className="text-zinc-600">{showCompanyForm ? '▲' : '▼'}</span>
        </button>
        {showCompanyForm && (
          <div className="mt-3 space-y-3 p-4 border border-zinc-800/40 rounded-lg bg-zinc-950/20">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">Nombre de Empresa</label>
              <input
                type="text"
                value={companySettings?.name || ''}
                onChange={e => handleCompanyFieldChange('name', e.target.value)}
                className="input-field w-full text-xs"
                placeholder="Ej. Mi Marcenaria Pro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">Teléfono</label>
                <input
                  type="text"
                  value={companySettings?.phone || ''}
                  onChange={e => handleCompanyFieldChange('phone', e.target.value)}
                  className="input-field w-full text-xs"
                  placeholder="Ej. +55 (11) 99999-9999"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">Dirección</label>
                <input
                  type="text"
                  value={companySettings?.address || ''}
                  onChange={e => handleCompanyFieldChange('address', e.target.value)}
                  className="input-field w-full text-xs"
                  placeholder="Ej. Av. Principal 123"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={handleCheckboxChange}
                className="rounded border-zinc-800 bg-zinc-950/40 text-[#F5A623] focus:ring-0"
              />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Establecer como predeterminado</span>
            </label>
          </div>
        )}
      </div>

      {/* ── 1. PLANO EJECUTIVO 2D — Pro+ ─────────────────────────────────── */}
      <div>
        {canExportPDF ? (
          <button onClick={handlePlanoPDF} disabled={genPlan}
            className="relative overflow-hidden group w-full text-left p-4 rounded-xl border border-primary/35 bg-gradient-to-br from-primary/8 via-surface-3 to-surface-2 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(245,166,35,0.1)] transition-all active:scale-[0.99] disabled:opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/12 text-primary group-hover:scale-110 transition-all shrink-0">
                {genPlan ? <Loader2 size={20} className="animate-spin"/> : <Ruler size={20} className="stroke-[2px]"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-white group-hover:text-primary transition-colors">{planoLabel}</span>
                  {!genPlan && <span className="text-[9px] font-bold text-primary/80 uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded shrink-0">.PDF</span>}
                  {genPlan && <span className="text-[9px] text-primary/70 uppercase animate-pulse shrink-0">{isES?'Generando...':isPT?'Gerando...':'Generating...'}</span>}
                </div>
                <p className="text-[11px] text-white/50 mt-1">{isES?'Hoja A4 horizontal con carátula técnica y vista wireframe':isPT?'Folha A4 paisagem com cabeçalho técnico e vista wireframe':'A4 landscape with title block and wireframe view'}</p>
                <div className="flex gap-2 mt-1.5">
                  {['A4 Horizontal','Wireframe','Carátula'].map(tag=>(
                    <span key={tag} className="text-[8px] font-bold text-primary/60 uppercase tracking-widest bg-primary/6 border border-primary/15 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ) : <LockedBtn label={planoLabel} tier="Pro" reason={t('plan_free_export_banner')} />}
      </div>

      {/* ── 1b. PLANO DE MONTAGEM (novo · 3 vistas + cortes) — Pro+ ──────── */}
      {canExportPDF && (
        <div className="space-y-2">
          <button onClick={() => handlePlanoPro('module')} disabled={genPlan}
            className="relative overflow-hidden group w-full text-left p-4 rounded-xl border border-primary/35 bg-gradient-to-br from-primary/8 via-surface-3 to-surface-2 hover:border-primary/60 transition-all active:scale-[0.99] disabled:opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/12 text-primary shrink-0">
                {genPlan ? <Loader2 size={20} className="animate-spin"/> : <Ruler size={20} className="stroke-[2px]"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-white group-hover:text-primary transition-colors">{isPT?'Plano de Montagem':'Plano de Montaje'}</span>
                  <span className="text-[9px] font-bold text-primary/80 uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded shrink-0">.PDF</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">{isPT?'3 vistas (alçado, planta, isométrico) + lista de cortes':'3 vistas (alzado, planta, isométrico) + lista de cortes'}{modules.length>1?(isPT?' · 1 folha por módulo':' · 1 hoja por módulo'):''}</p>
              </div>
            </div>
          </button>
          {modules.length > 1 && (
            <button onClick={() => handlePlanoPro('conjunto')} disabled={genPlan}
              className="w-full text-left p-3 rounded-xl border border-white/10 bg-surface-3/40 hover:border-primary/40 transition-all disabled:opacity-60 flex items-center gap-3">
              <Box size={16} className="text-primary shrink-0"/>
              <span className="text-[12px] font-bold text-white">{isPT?'Vista de Conjunto (todos os móveis)':'Vista de Conjunto (todos los muebles)'}</span>
              <span className="ml-auto text-[9px] font-bold text-primary/80 uppercase bg-primary/10 px-1.5 py-0.5 rounded">.PDF</span>
            </button>
          )}
        </div>
      )}

      {/* ── 2. CSV LISTA DE CORTE — Pro+ ──────────────────────────────────── */}
      <div>
        {canExportCSV ? (
          <button onClick={handleCSVCutlist} disabled={exporting==='csv'}
            className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-surface-3 to-surface-2 hover:border-emerald-400 transition-all active:scale-[0.99] disabled:opacity-50">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-all">
                <FileSpreadsheet size={20} className="stroke-[2px]"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors">{csvLabel}</span>
                  {success==='csv' ? <Check size={14} className="text-green-400"/> : <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">.CSV</span>}
                </div>
                <p className="text-[11px] text-white/50 mt-1">{isES?'Con descuentos de tapacanto y medidas netas de fabricación':isPT?'Com descontos de borda e medidas líquidas de fabricação':'Net dimensions with edgebanding deductions'}</p>
              </div>
            </div>
          </button>
        ) : <LockedBtn label={csvLabel} tier="Pro" />}
      </div>

      <div className="h-px bg-white/5" />

      {/* ── 3. ETIQUETAS TÉRMICAS — Enterprise only ───────────────────────── */}
      <div>
        {canExportBOM ? (
          <button onClick={handleEtiquetas} disabled={genEtiquetas}
            className="relative overflow-hidden group w-full text-left p-4 rounded-xl border border-blue-500/35 bg-gradient-to-br from-blue-950/30 via-surface-3 to-surface-2 hover:border-blue-400/60 hover:shadow-[0_0_16px_rgba(59,130,246,0.1)] transition-all active:scale-[0.99] disabled:opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/12 text-blue-400 group-hover:scale-110 transition-all shrink-0">
                {genEtiquetas ? <Loader2 size={20} className="animate-spin"/> : <TagIcon size={20} className="stroke-[2px]"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-white group-hover:text-blue-300 transition-colors">{etqLabel}</span>
                  <span className="text-[9px] font-bold text-blue-400/80 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5"><Crown size={7}/>Ent</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">{isES?'PDF para impresora térmica 60×40mm — 1 etiqueta por pieza con QR':isPT?'PDF para impressora térmica 60×40mm — 1 etiqueta por peça com QR':'PDF for 60×40mm thermal printer — 1 label per piece with QR'}</p>
                <div className="flex gap-2 mt-1.5">
                  {['60×40mm','White-Label','QR Ready'].map(tag=>(
                    <span key={tag} className="text-[8px] font-bold text-blue-400/60 uppercase tracking-widest bg-blue-500/6 border border-blue-500/15 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ) : <LockedBtn label={etqLabel} tier="Enterprise" reason={t('plan_pro_export_locked_ent')} />}
      </div>

      <div className="h-px bg-white/5" />

      {/* ── 4. DXF + GLTF ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3">
        <button onClick={()=>handleExport('dxf')} disabled={!!exporting}
          className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-surface-3 to-surface-2 hover:border-blue-400 transition-all active:scale-[0.99] disabled:opacity-50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-all">
              <FileType size={20} className="stroke-[2px]"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white group-hover:text-blue-300 transition-colors">{t('export_dxf')}</span>
                {exporting==='dxf'?<Loader2 size={14} className="animate-spin text-blue-400"/>:success==='dxf'?<Check size={14} className="text-green-400"/>:<span className="text-[9px] font-bold text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded">.DXF</span>}
              </div>
              <p className="text-[11px] text-white/50 mt-1">{dxfDesc}</p>
            </div>
          </div>
        </button>
        <button onClick={()=>handleExport('gltf')} disabled={!!exporting}
          className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-surface-3 to-surface-2 hover:border-emerald-400 transition-all active:scale-[0.99] disabled:opacity-50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-all">
              <Box size={20} className="stroke-[2px]"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors">{t('export_gltf')}</span>
                {exporting==='gltf'?<Loader2 size={14} className="animate-spin text-emerald-400"/>:success==='gltf'?<Check size={14} className="text-green-400"/>:<span className="text-[9px] font-bold text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">.GLTF</span>}
              </div>
              <p className="text-[11px] text-white/50 mt-1">{gltfDesc}</p>
            </div>
          </div>
        </button>
      </div>

      {/* ── 5. CNC + NESTING — Enterprise ─────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] tracking-widest uppercase font-semibold text-zinc-500 px-1">
          {isES?'Fabricación Avanzada':isPT?'Fabricação Avançada':'Advanced Manufacturing'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {canExportCNC ? (
            <button onClick={()=>handleExport('cnc')} disabled={!!exporting}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-3 hover:bg-surface-1 border border-white/5 transition-all text-xs group disabled:opacity-50">
              <Cpu size={14} className="text-amber-400 group-hover:scale-110 transition-transform"/>
              <span className="flex-1 text-left text-white/70 group-hover:text-white truncate">{t('export_cnc')||'G-code CNC'}</span>
              {exporting==='cnc'&&<Loader2 size={10} className="animate-spin text-amber-400"/>}
              {success==='cnc'&&<Check size={10} className="text-green-400"/>}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-3/30 border border-white/5 text-xs opacity-50 cursor-not-allowed">
              <Lock size={12} className="text-blue-400/60 shrink-0"/>
              <span className="text-muted truncate text-[10px]">CNC <Crown size={8} className="inline"/> Ent.</span>
            </div>
          )}
          <button onClick={handleNesting}
            className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-purple-950/30 to-indigo-950/20 hover:from-purple-950/50 hover:to-indigo-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-all text-xs font-medium text-purple-200 group active:scale-[0.98]">
            <Scissors size={14} className="text-purple-400 group-hover:scale-110 transition-transform"/>
            <span className="truncate">{t('export_nesting')||'Nesting'}</span>
          </button>
        </div>
      </div>

      {nestingResult && (
        <div className="bg-surface-3/50 border border-white/5 rounded-xl p-3 space-y-2">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-zinc-500">{t('nesting_result')}</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
              <p className="text-xl font-extrabold text-white tabular-nums">{nestingResult.sheetCount}</p>
              <p className="text-[9px] text-white/40 uppercase font-semibold mt-0.5">{t('sheets_used')}</p>
            </div>
            <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
              <p className={"text-xl font-extrabold tabular-nums "+(parseFloat(nestingResult.utilization)>=70?'text-emerald-400':'text-amber-400')}>
                {nestingResult.utilization}%
              </p>
              <p className="text-[9px] text-white/40 uppercase font-semibold mt-0.5">{t('utilization')}</p>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-white/40 px-1">
            <span>{nestingResult.totalPieces} pcs</span>
            <span>{nestingResult.wastePercent}% {isES?'desperdício':isPT?'desperdício':'waste'}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0"/><span>{error}</span>
        </div>
      )}
    </div>
  )
}
