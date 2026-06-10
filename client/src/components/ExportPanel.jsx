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
import { generateFactoryCutlist } from '../engine/CutlistGenerator.js'
import { calculateQuote } from '../engine/PricingEngine.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { trackEvent, EVENTS } from '../lib/analytics.js'
import { UpgradePrompt } from './UpgradePrompt.jsx'

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

// ── PLANO EJECUTIVO 2D — Alzado frontal vectorial MULTI-MÓDULO ───────────────────
// v3.0: Dibuja TODOS los módulos del proyecto en alzado a escala, lado a lado,
//       con cota individual por módulo (ej. 1500, 500), cota TOTAL y cota de altura.
//       Determinístico (vector puro, sin depender del screenshot 3D).
async function generatePlanoPDF({ modules, captureWireframe, user, lang, t, companySettings }) {
  const titles = { PT: 'PLANO EXECUTIVO', ES: 'PLANO EJECUTIVO', EN: 'EXECUTIVE PLAN' }
  const L = ['PT','ES','EN'].includes(lang) ? lang : 'ES'

  const MARGIN = 10
  const A4_W = 297
  const A4_H = 210
  const ROT_W = 50                     // Cuadro de rotulación (carátula)
  const ROT_X = A4_W - MARGIN - ROT_W  // 237mm

  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const list = (modules && modules.length) ? modules : [{}]
  const company = companySettings?.name || user?.company_name || user?.name || 'Orbin AI'

  // ── 1. Layout real (mm) de todos los módulos lado a lado ────────────────────
  const items = list.map((m, idx) => {
    const c = m.configuration || m || {}
    return {
      c,
      w: c.width  || 600,
      h: c.height || 720,
      d: c.depth  || 580,
      baseY: (c.moduleType === 'aereo') ? (c.mountHeight || 1400) : 0,
      id: m.id || m.name || `MOD-${String(idx+1).padStart(2,'0')}`,
    }
  })
  const totalW = items.reduce((s, i) => s + i.w, 0)
  const maxTop = Math.max(...items.map(i => i.baseY + i.h))
  const maxD   = Math.max(...items.map(i => i.d))
  const dimStr = `${totalW} × ${maxTop} × ${maxD} mm`
  const compText = items.length === 1
    ? `${items[0].id} — ${String(list[0].type || items[0].c.moduleType || 'standard').toUpperCase()}`
    : `${items.length} MÓDULOS`

  // ── 2. Área de dibujo (a la izquierda de la carátula) y escala ──────────────
  const leftPad = 22, rightPad = 8, topPad = 16, botPad = 30
  const usableX0 = MARGIN + leftPad
  const usableX1 = (ROT_X - 6) - rightPad
  const usableW  = usableX1 - usableX0
  const usableY0 = MARGIN + topPad
  const usableY1 = A4_H - MARGIN - botPad
  const usableH  = usableY1 - usableY0

  const scale = Math.min(usableW / totalW, usableH / maxTop)
  const drawingW = totalW * scale
  const drawingH = maxTop * scale
  const startX = usableX0 + (usableW - drawingW) / 2
  const floorY = usableY1 - (usableH - drawingH) / 2
  const PX = x => startX + x * scale
  const PY = y => floorY - y * scale
  const scaleDenom = Math.max(1, Math.round(1 / scale))
  const scaleText = `E 1:${scaleDenom}`

  // ── 3. Marco + carátula ─────────────────────────────────────────────────────
  doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.35)
  doc.rect(MARGIN, MARGIN, A4_W - 2 * MARGIN, A4_H - 2 * MARGIN)
  doc.line(ROT_X, MARGIN, ROT_X, A4_H - MARGIN)

  doc.setLineWidth(0.176)
  const heights = [20, 25, 25, 25, 25, 25, 45]
  let currentY = MARGIN
  for (let i = 0; i < heights.length - 1; i++) {
    currentY += heights[i]
    doc.line(ROT_X, currentY, ROT_X + ROT_W, currentY)
  }

  // Block 1: Título
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text(titles[L], ROT_X + ROT_W / 2, MARGIN + 12, { align: 'center' })

  // Block 2: PROYECTO
  let y = MARGIN + 20
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('PROYECTO', ROT_X + 4, y + 6)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text('Orbin AI Modular System', ROT_X + 4, y + 14)

  // Block 3: EMPRESA
  y += 25
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('EMPRESA', ROT_X + 4, y + 5)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text(doc.splitTextToSize(company.toUpperCase(), ROT_W - 8), ROT_X + 4, y + 11)
  doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  let extraY = y + 16
  if (companySettings?.phone) { doc.text(`TEL: ${companySettings.phone}`, ROT_X + 4, extraY); extraY += 3.5 }
  if (companySettings?.address) {
    doc.text(`DIR: ${doc.splitTextToSize(companySettings.address.toUpperCase(), ROT_W - 8)[0] || companySettings.address}`, ROT_X + 4, extraY)
  }

  // Block 4: COMPONENTE
  y += 25
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('COMPONENTE', ROT_X + 4, y + 6)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text(doc.splitTextToSize(compText, ROT_W - 8), ROT_X + 4, y + 14)

  // Block 5: DIMENSIONES (totales del conjunto)
  y += 25
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('DIMENSIONES (L×A×P)', ROT_X + 4, y + 6)
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text(dimStr, ROT_X + 4, y + 14)

  // Block 6: FECHA & ESCALA
  y += 25
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
  doc.text('FECHA', ROT_X + 4, y + 6)
  doc.text('ESCALA', ROT_X + ROT_W / 2 + 4, y + 6)
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  doc.text(fmtDate(), ROT_X + 4, y + 14)
  doc.text(scaleText, ROT_X + ROT_W / 2 + 4, y + 14)
  doc.setLineWidth(0.176)
  doc.line(ROT_X + ROT_W / 2, y, ROT_X + ROT_W / 2, y + 25)

  // Block 7: Logo Footer
  y += 25
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(245, 166, 35)
  doc.text('ORBIN AI', ROT_X + ROT_W / 2, y + 20, { align: 'center' })
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
  doc.text('orbin.ai', ROT_X + ROT_W / 2, y + 26, { align: 'center' })

  // ── 4. ALZADO FRONTAL VECTORIAL — todos los módulos ─────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30)
  doc.text(`ALZADO FRONTAL — ${items.length} ${items.length === 1 ? 'MÓDULO' : 'MÓDULOS'}`, MARGIN + 4, MARGIN + 8)

  // Línea de piso
  doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.25)
  doc.line(startX - 4, floorY, startX + drawingW + 4, floorY)

  let xCur = 0
  items.forEach((it) => {
    const { c, w, h, baseY } = it
    const rx = PX(xCur), ry = PY(baseY + h), rw = w * scale, rh = h * scale

    // Cuerpo (contorno fuerte)
    doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.45)
    doc.rect(rx, ry, rw, rh)

    // Detalles internos (líneas finas)
    doc.setDrawColor(110, 110, 110); doc.setLineWidth(0.15)
    const T  = c.thickness || 18
    const BH = (c.baseboard !== false) ? (c.baseboardHeight || 100) : 0
    let yc = baseY + BH                       // cursor vertical real
    if (BH > 0) { const by = PY(baseY + BH); doc.line(rx, by, rx + rw, by) }

    // Cajones (desde abajo)
    const nD = c.numDrawers || 0
    const dh = nD > 0 ? Math.min(c.drawerHeight || 180, (h - BH) / nD) : 0
    for (let i = 0; i < nD; i++) {
      yc += dh
      if (yc < baseY + h) { doc.line(rx, PY(yc), rx + rw, PY(yc)) }
      doc.setFillColor(90, 90, 90); doc.circle(rx + rw / 2, PY(yc - dh / 2), 0.5, 'F')
      if (rw > 16 && dh * scale > 5) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(4); doc.setTextColor(120, 120, 120)
        doc.text(`GAVETA ${i + 1}`, rx + rw / 2, PY(yc - dh / 2) - 1.4, { align: 'center' })
      }
    }

    // Puertas (divisiones verticales en la zona restante) + tiradores
    if (c.hasDoors) {
      const nDoors = c.numDoors || 2
      for (let i = 1; i < nDoors; i++) { const dx = rx + (rw / nDoors) * i; doc.line(dx, ry, dx, PY(yc)) }
      const zoneMidY = PY(yc + (baseY + h - yc) / 2)
      for (let i = 0; i < nDoors; i++) {
        const hx = rx + (rw / nDoors) * i + (rw / nDoors) * 0.85
        doc.setFillColor(90, 90, 90); doc.circle(hx, zoneMidY, 0.6, 'F')
        if (rw / nDoors > 14) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(4); doc.setTextColor(120, 120, 120)
          doc.text('PUERTA', rx + (rw / nDoors) * (i + 0.5), zoneMidY, { align: 'center' })
        }
      }
    }

    // Estantes (zona superior, solo si no hay puertas que los oculten)
    const nS = c.numShelves || 0
    if (nS > 0 && !c.hasDoors) {
      const zoneB = yc, zoneT = baseY + h - T
      const sp = (zoneT - zoneB) / (nS + 1)
      for (let i = 1; i <= nS; i++) { doc.line(rx, PY(zoneB + sp * i), rx + rw, PY(zoneB + sp * i)) }
    }

    // Divisores verticales
    const nDiv = c.numDividers || 0
    if (nDiv > 0) {
      const sp = rw / (nDiv + 1)
      for (let i = 1; i <= nDiv; i++) { const dx = rx + sp * i; doc.line(dx, ry, dx, PY(baseY + BH)) }
    }

    // ── Etiquetas de piezas: cómo va y dónde monta cada corte ──
    if (rw > 16) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(4.2); doc.setTextColor(60, 60, 60)
      doc.text('CUBIERTA', rx + rw / 2, ry + 2.6, { align: 'center' })   // tampo: apoya SOBRE los laterales
    }
    if (rh > 14) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4); doc.setTextColor(120, 120, 120)
      doc.text('LATERAL', rx + 2.2, ry + rh / 2, { align: 'center', angle: 90 })   // de piso a cubierta
    }
    if (BH > 0 && rw > 16) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(3.8); doc.setTextColor(120, 120, 120)
      doc.text('ZÓCALO', rx + rw / 2, PY(baseY + BH / 2) + 0.6, { align: 'center' })
    }
    if (rw > 18) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(3.8); doc.setTextColor(140, 140, 140)
      doc.text('BASE', rx + 3.5, PY(baseY + BH) - 1.2, { align: 'left' })   // entre laterales
    }
    if (nS > 0 && !c.hasDoors && rw > 18) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(3.8); doc.setTextColor(140, 140, 140)
      doc.text('ESTANTE', rx + rw - 3.5, PY(baseY + h - T) - 1.2, { align: 'right' })
    }

    // ── COTA individual de ancho (debajo del piso) ──
    const cy = floorY + 8
    doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.2)
    doc.line(rx, cy, rx + rw, cy)
    doc.line(rx, floorY + 1.5, rx, cy + 2)
    doc.line(rx + rw, floorY + 1.5, rx + rw, cy + 2)
    doc.line(rx - 1.2, cy + 1.2, rx + 1.2, cy - 1.2)
    doc.line(rx + rw - 1.2, cy + 1.2, rx + rw + 1.2, cy - 1.2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(20, 20, 20)
    doc.text(`${w}`, rx + rw / 2, cy - 1.5, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(110, 110, 110)
    doc.text(`${it.id}`, rx + rw / 2, cy + 4, { align: 'center' })

    xCur += w
  })

  // ── COTA TOTAL (solo si hay más de un módulo) ──
  if (items.length > 1) {
    const ty = floorY + 18
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.25)
    doc.line(startX, ty, startX + drawingW, ty)
    doc.line(startX, floorY + 9, startX, ty + 2)
    doc.line(startX + drawingW, floorY + 9, startX + drawingW, ty + 2)
    doc.line(startX - 1.4, ty + 1.4, startX + 1.4, ty - 1.4)
    doc.line(startX + drawingW - 1.4, ty + 1.4, startX + drawingW + 1.4, ty - 1.4)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0)
    doc.text(`TOTAL ${totalW} mm`, startX + drawingW / 2, ty - 1.8, { align: 'center' })
  }

  // ── COTA de altura (izquierda) ──
  const hcx = startX - 10
  doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.2)
  doc.line(hcx, floorY, hcx, floorY - drawingH)
  doc.line(startX - 1.5, floorY, hcx - 2, floorY)
  doc.line(startX - 1.5, floorY - drawingH, hcx - 2, floorY - drawingH)
  doc.line(hcx - 1.2, floorY - 1.2, hcx + 1.2, floorY + 1.2)
  doc.line(hcx - 1.2, floorY - drawingH - 1.2, hcx + 1.2, floorY - drawingH + 1.2)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(20, 20, 20)
  doc.text(`${maxTop} mm`, hcx - 2.5, floorY - drawingH / 2, { align: 'center', angle: 90 })

  // ── Leyenda de montaje (cómo va cada corte) + nota de escala ──
  const mont = {
    ES: 'MONTAJE: Cubierta apoya SOBRE los laterales · Laterales de piso a cubierta · Base, estantes y divisores ENTRE laterales · Fondo (6mm) ranurado atrás · Zócalo retranqueado · Frentes de gaveta/puerta sobrepuestos',
    PT: 'MONTAGEM: Tampo apoia SOBRE as laterais · Laterais do piso ao tampo · Base, prateleiras e divisórias ENTRE as laterais · Fundo (6mm) encaixado atrás · Rodapé recuado · Frentes de gaveta/porta sobrepostas',
    EN: 'ASSEMBLY: Top sits ON the sides · Sides run floor-to-top · Base, shelves and dividers BETWEEN sides · Back (6mm) grooved at rear · Toe-kick recessed · Drawer/door fronts overlaid'
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.setTextColor(90, 90, 90)
  doc.text(doc.splitTextToSize(mont[L] || mont.ES, ROT_X - MARGIN - 8), MARGIN + 4, A4_H - MARGIN - 7)
  // Nota de escala / profundidad
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(90, 90, 90)
  doc.text(`Escala 1:${scaleDenom}  ·  Prof. máx: ${maxD} mm  ·  Medidas en mm`, MARGIN + 4, A4_H - MARGIN - 3)

  // ── Descarga ────────────────────────────────────────────────────────────────
  const fileId = items.length === 1 ? items[0].id : `proyecto-${items.length}mod`
  const blob = doc.output('blob')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `plano-ejecutivo-${fileId}-${Date.now()}.pdf`
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

// ── PRESUPUESTO FORMAL PARA CLIENTE FINAL ──────────────────────────────────────
async function generatePresupuestoPDF({ modules, user, lang, t, companySettings }) {
  const customerPromptStr = t('pdf_customer_prompt') || 'Nombre del Cliente:'
  const customerName = prompt(customerPromptStr, 'Cliente Final')
  if (customerName === null) return // Canceled

  const quote = calculateQuote(modules)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const COLOR_PRIMARY = [245, 166, 35] // Amber #F5A623
  const COLOR_DARK = [30, 30, 30]
  const COLOR_LIGHT = [245, 245, 245]

  const A4_W = 210
  const A4_H = 297
  const MARGIN = 15
  const CONTENT_W = A4_W - (MARGIN * 2)

  let currentY = MARGIN
  const company = companySettings?.name || user?.company_name || user?.name || 'Orbin AI'

  // Header Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.text(company.toUpperCase(), MARGIN, currentY + 6)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(t('pdf_generated_by') || 'Generado por Orbin AI', A4_W - MARGIN, currentY + 3, { align: 'right' })
  doc.text(fmtDate(), A4_W - MARGIN, currentY + 8, { align: 'right' })

  currentY += 15

  // Line separator
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.25)
  doc.line(MARGIN, currentY, A4_W - MARGIN, currentY)
  currentY += 5

  // Emisor & Cliente Columns
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  doc.text(lang === 'PT' ? 'EMISSOR / VENDEDOR' : lang === 'EN' ? 'ISSUER / SELLER' : 'EMISOR / VENDEDOR', MARGIN, currentY)
  doc.text(lang === 'PT' ? 'CLIENTE / COMPRADOR' : lang === 'EN' ? 'CUSTOMER / BUYER' : 'CLIENTE / RECEPTOR', A4_W / 2 + 5, currentY)
  currentY += 4

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.text(company, MARGIN, currentY)
  doc.text(customerName.toUpperCase(), A4_W / 2 + 5, currentY)
  currentY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  
  let emitY = currentY
  if (companySettings?.phone) { doc.text(`Tel: ${companySettings.phone}`, MARGIN, emitY); emitY += 3.5 }
  if (companySettings?.address) { doc.text(`Dir: ${companySettings.address}`, MARGIN, emitY); emitY += 3.5 }
  doc.text(`Email: ${user?.email || ''}`, MARGIN, emitY)

  let clientY = currentY
  doc.text(`${t('pdf_client_label') || 'Cliente'}: ${customerName}`, A4_W / 2 + 5, clientY); clientY += 3.5
  doc.text(`Ref: ORB-QT-${Date.now().toString().slice(-6)}`, A4_W / 2 + 5, clientY)

  currentY = Math.max(emitY, clientY) + 8

  // Document Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.text(t('pdf_client_quote_title') || 'PRESUPUESTO DE MUEBLES MODULARES', MARGIN, currentY)
  currentY += 6

  // Table header
  doc.setFillColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text('#', MARGIN + 2, currentY + 4.2)
  doc.text(t('pdf_desc') || 'Descripción', MARGIN + 10, currentY + 4.2)
  doc.text(t('pdf_dims') || 'Dimensiones (A×Al×P)', MARGIN + 80, currentY + 4.2)
  doc.text(t('pdf_material') || 'Material', MARGIN + 130, currentY + 4.2)
  doc.text(t('pdf_qty') || 'Cant', MARGIN + 175, currentY + 4.2, { align: 'right' })

  currentY += 6

  // Modules list rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(30, 30, 30)

  modules.forEach((mod, idx) => {
    const c = mod.configuration || mod || {}
    const w = c.width || 600
    const h = c.height || 2200
    const d = c.depth || 580
    const matId = c.materialBody || 'mdf_18'
    const desc = `${mod.type ? mod.type.toUpperCase() : 'MÓDULO'} (${c.numDrawers || 0} cajones, ${c.numShelves || 0} estantes)`

    if (idx % 2 === 1) {
      doc.setFillColor(COLOR_LIGHT[0], COLOR_LIGHT[1], COLOR_LIGHT[2])
      doc.rect(MARGIN, currentY, CONTENT_W, 7, 'F')
    }

    doc.text(`${idx + 1}`, MARGIN + 2, currentY + 4.8)
    doc.text(desc.slice(0, 42), MARGIN + 10, currentY + 4.8)
    doc.text(`${w} × ${h} × ${d} mm`, MARGIN + 80, currentY + 4.8)
    doc.text(matId.toUpperCase(), MARGIN + 130, currentY + 4.8)
    doc.text('1', MARGIN + 175, currentY + 4.8, { align: 'right' })

    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.1)
    doc.line(MARGIN, currentY + 7, A4_W - MARGIN, currentY + 7)

    currentY += 7
  })

  currentY += 6

  // Specifications overview
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.text(lang === 'PT' ? 'ESPECIFICAÇÕES INCLUÍDAS:' : lang === 'EN' ? 'INCLUDED SPECIFICATIONS:' : 'ESPECIFICACIONES INCLUIDAS:', MARGIN, currentY)
  currentY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)

  const specLines = []
  if (lang === 'PT') {
    specLines.push(`• Estrutura principal construída com chapas de alta resistência.`)
    if (quote.hardware.hinges.qty > 0) specLines.push(`• Inclui ${quote.hardware.hinges.qty} dobradiças metálicas de montagem rápida.`)
    if (quote.hardware.drawerSlides.qty > 0) specLines.push(`• Inclui ${quote.hardware.drawerSlides.qty} pares de corrediças telescópicas (folga de 13mm aplicada).`)
    if (quote.hardware.handles.qty > 0) specLines.push(`• Inclui ${quote.hardware.handles.qty} puxadores inclusos no projeto.`)
    if (quote.hardware.countertop.m2 > 0) specLines.push(`• Inclui tampo superior (área de ${quote.hardware.countertop.m2} m²).`)
  } else if (lang === 'EN') {
    specLines.push(`• Main structural body constructed using high-durability panels.`)
    if (quote.hardware.hinges.qty > 0) specLines.push(`• Includes ${quote.hardware.hinges.qty} quick-mount metal hinges.`)
    if (quote.hardware.drawerSlides.qty > 0) specLines.push(`• Includes ${quote.hardware.drawerSlides.qty} pairs of telescopic drawer slides (13mm technical clearance applied).`)
    if (quote.hardware.handles.qty > 0) specLines.push(`• Includes ${quote.hardware.handles.qty} hardware handles.`)
    if (quote.hardware.countertop.m2 > 0) specLines.push(`• Includes top countertop panel (${quote.hardware.countertop.m2} sq.m).`)
  } else {
    specLines.push(`• Estructura principal construida con tableros de alta durabilidad.`)
    if (quote.hardware.hinges.qty > 0) specLines.push(`• Incluye ${quote.hardware.hinges.qty} bisagras metálicas de montaje rápido.`)
    if (quote.hardware.drawerSlides.qty > 0) specLines.push(`• Incluye ${quote.hardware.drawerSlides.qty} pares de correderas telescópicas (holgura de 13mm aplicada).`)
    if (quote.hardware.handles.qty > 0) specLines.push(`• Incluye ${quote.hardware.handles.qty} tiradores metálicos.`)
    if (quote.hardware.countertop.m2 > 0) specLines.push(`• Incluye encimera/cubierta superior (${quote.hardware.countertop.m2} m²).`)
  }

  specLines.forEach(line => {
    doc.text(line, MARGIN, currentY)
    currentY += 3.8
  })

  currentY += 6

  // Total price box
  doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.setLineWidth(0.35)
  doc.setFillColor(254, 252, 243)
  doc.rect(MARGIN, currentY, CONTENT_W, 11, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.text(t('pdf_total_estimate') || 'TOTAL PRESUPUESTO', MARGIN + 4, currentY + 7)

  const formattedTotal = new Intl.NumberFormat(lang === 'PT' ? 'pt-BR' : lang === 'EN' ? 'en-US' : 'es-CL', {
    style: 'currency',
    currency: lang === 'PT' ? 'BRL' : 'USD',
    minimumFractionDigits: 0
  }).format(quote.finalPrice)

  doc.setFontSize(13)
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2])
  doc.text(formattedTotal, A4_W - MARGIN - 4, currentY + 7.5, { align: 'right' })

  currentY += 18

  // Notes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(COLOR_DARK[0], COLOR_DARK[1], COLOR_DARK[2])
  doc.text(t('pdf_notes_title') || 'Notas y Condiciones', MARGIN, currentY)
  currentY += 4.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(110, 110, 110)
  doc.text(t('pdf_note_validity') || 'Validez del presupuesto: 15 días.', MARGIN, currentY); currentY += 3.5
  doc.text(t('pdf_note_payment') || 'Condiciones de pago: 50% de anticipo y 50% a la entrega.', MARGIN, currentY); currentY += 3.5
  doc.text(t('pdf_note_assembly') || 'Plazo de entrega e instalación: a convenir.', MARGIN, currentY); currentY += 12

  // Signature Block
  const sigW = 55
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, currentY, MARGIN + sigW, currentY)
  doc.line(A4_W - MARGIN - sigW, currentY, A4_W - MARGIN, currentY)

  currentY += 3.5
  doc.setFontSize(6)
  doc.setTextColor(120, 120, 120)
  doc.text(t('pdf_signature') || 'Firma del Cliente', MARGIN + sigW / 2, currentY, { align: 'center' })
  doc.text(lang === 'PT' ? 'Assinatura do Emissor' : lang === 'EN' ? 'Issuer Signature' : 'Firma Emisor', A4_W - MARGIN - sigW / 2, currentY, { align: 'center' })

  currentY += 3.5
  doc.text(t('pdf_date') || 'Fecha', MARGIN + sigW / 2, currentY, { align: 'center' })
  doc.text(t('pdf_date') || 'Fecha', A4_W - MARGIN - sigW / 2, currentY, { align: 'center' })

  // Trigger download
  const fileId = modules.length === 1 ? modules[0].id : `proyecto-${modules.length}mod`
  const blob = doc.output('blob')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `presupuesto-${fileId}-${Date.now()}.pdf`
  a.click()
}

// ── Locked button ─────────────────────────────────────────────────────────────
function LockedBtn({ label, tier = 'Pro', reason, onClick }) {
  const COLOR = tier==='Enterprise'
    ? 'text-blue-400/60 bg-blue-500/10 border-blue-500/20'
    : 'text-yellow-400/60 bg-yellow-500/10 border-yellow-500/20'
  return (
    <div onClick={() => {
      trackEvent(EVENTS.PLAN_GATE_HIT, { featureBlocked: label, tier });
      if (onClick) onClick();
    }} className="relative w-full text-left p-3.5 rounded-xl border border-white/5 bg-surface-3/30 opacity-60 cursor-pointer hover:opacity-80 transition-opacity select-none">
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
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExportPanel({ modules = [], captureWireframe = null }) {
  const { t, lang } = usePreferences()
  const { canExportPDF, canExportCSV, canExportCNC, canExportBOM, isEnterprise, isPro, isFree, user, companySettings, updateCompanySettings } = useUser()
  const [exporting,      setExporting]      = useState(null)
  const [success,        setSuccess]        = useState(null)
  const [error,          setError]          = useState(null)
  const [nestingResult,  setNestingResult]  = useState(null)
  const [genPlan,        setGenPlan]        = useState(false)
  const [genEtiquetas,   setGenEtiquetas]   = useState(false)
  const [genPresupuesto, setGenPresupuesto] = useState(false)
  const [upgradePrompt,  setUpgradePrompt]  = useState(null)

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

  const handlePresupuesto = async () => {
    if (genPresupuesto) return
    setGenPresupuesto(true); setError(null)
    try { await generatePresupuestoPDF({ modules, user, lang, t, companySettings }) }
    catch(e) { console.error("PRESUPUESTO ERROR:", e); setError('PRESUPUESTO ERROR: ' + e.message) }
    finally { setGenPresupuesto(false) }
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
          <span>{t('exp_company_section')}</span>
          <span className="text-zinc-600">{showCompanyForm ? '▲' : '▼'}</span>
        </button>
        {showCompanyForm && (
          <div className="mt-3 space-y-3 p-4 border border-zinc-800/40 rounded-lg bg-zinc-950/20">
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">{t('hdr_company_name')}</label>
              <input
                type="text"
                value={companySettings?.name || ''}
                onChange={e => handleCompanyFieldChange('name', e.target.value)}
                className="input-field w-full text-xs"
                placeholder={t('hdr_company_name_ph')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">{t('hdr_phone')}</label>
                <input
                  type="text"
                  value={companySettings?.phone || ''}
                  onChange={e => handleCompanyFieldChange('phone', e.target.value)}
                  className="input-field w-full text-xs"
                  placeholder={t('hdr_phone_ph')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">{t('hdr_address')}</label>
                <input
                  type="text"
                  value={companySettings?.address || ''}
                  onChange={e => handleCompanyFieldChange('address', e.target.value)}
                  className="input-field w-full text-xs"
                  placeholder={t('hdr_address_ph')}
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
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('hdr_save_default')}</span>
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
        ) : <LockedBtn label={planoLabel} tier="Pro" reason={t('plan_free_export_banner')} onClick={() => setUpgradePrompt({ featureName: planoLabel, requiredPlan: 'Pro' })} />}
      </div>

      {/* ── PDF PRESUPUESTO CLIENTE — Pro+ ─────────────────────────────────── */}
      <div>
        {canExportPDF ? (
          <button onClick={handlePresupuesto} disabled={genPresupuesto}
            className="relative overflow-hidden group w-full text-left p-4 rounded-xl border border-primary/35 bg-gradient-to-br from-primary/8 via-surface-3 to-surface-2 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(245,166,35,0.1)] transition-all active:scale-[0.99] disabled:opacity-60">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/12 text-primary group-hover:scale-110 transition-all shrink-0">
                {genPresupuesto ? <Loader2 size={20} className="animate-spin"/> : <FileSpreadsheet size={20} className="stroke-[2px]"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm text-white group-hover:text-primary transition-colors">{t('export_presupuesto')}</span>
                  {!genPresupuesto && <span className="text-[9px] font-bold text-primary/80 uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded shrink-0">.PDF</span>}
                  {genPresupuesto && <span className="text-[9px] text-primary/70 uppercase animate-pulse shrink-0">{isES?'Generando...':isPT?'Gerando...':'Generating...'}</span>}
                </div>
                <p className="text-[11px] text-white/50 mt-1">{t('export_presupuesto_desc')}</p>
                <div className="flex gap-2 mt-1.5">
                  {[(isES?'A4 Retrato':isPT?'A4 Retrato':'A4 Portrait'),(isES?'Valores Finales':isPT?'Valores Finais':'Final Prices'),'Whitelabel'].map(tag=>(
                    <span key={tag} className="text-[8px] font-bold text-primary/60 uppercase tracking-widest bg-primary/6 border border-primary/15 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ) : <LockedBtn label={t('export_presupuesto')} tier="Pro" reason={t('plan_free_export_banner')} onClick={() => setUpgradePrompt({ featureName: t('export_presupuesto'), requiredPlan: 'Pro' })} />}
      </div>

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
        ) : <LockedBtn label={csvLabel} tier="Pro" onClick={() => setUpgradePrompt({ featureName: csvLabel, requiredPlan: 'Pro' })} />}
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
        ) : <LockedBtn label={etqLabel} tier="Enterprise" reason={t('plan_pro_export_locked_ent')} onClick={() => setUpgradePrompt({ featureName: etqLabel, requiredPlan: 'Enterprise' })} />}
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
            <button onClick={() => {
              trackEvent(EVENTS.PLAN_GATE_HIT, { featureBlocked: 'CNC', tier: 'Enterprise' });
              setUpgradePrompt({ featureName: t('export_cnc') || 'CNC', requiredPlan: 'Enterprise' });
            }} className="flex items-center gap-2 p-2 rounded-lg bg-surface-3/30 hover:bg-surface-3/50 border border-white/5 text-xs opacity-60 hover:opacity-90 transition-all cursor-pointer select-none">
              <Lock size={12} className="text-blue-400/60 shrink-0"/>
              <span className="text-muted truncate text-[10px]">{t('export_cnc') || 'CNC'} <Crown size={8} className="inline"/> Ent.</span>
            </button>
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
