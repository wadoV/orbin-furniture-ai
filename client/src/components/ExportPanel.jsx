import { useState } from 'react'
import { FileText, Table, Wrench, Cpu, ChevronDown, ChevronUp, Download, Loader2, FileJson, Box, FileImage } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ── CSV helpers ───────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  const header = ['Pieza', 'Tipo', 'Ancho(mm)', 'Alto(mm)', 'Esp(mm)', 'Cant', 'Canto', 'Notas']
  const lines  = [header.join(','), ...rows.map(r =>
    [r.name, r.type, r.width, r.height, r.thickness, r.quantity || 1, r.edgeBanding?.front ? 'Si' : 'No', r.notes || ''].join(',')
  )]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportCNC(rows, filename) {
  // Simplified G-code scaffold per piece
  let gcode = '; Orbin CNC Export — G-code scaffold\n; Generated: ' + new Date().toISOString() + '\nG21 ; mm\nG90 ; absolute\n'
  rows.forEach((p, i) => {
    gcode += `\n; --- Pieza ${i + 1}: ${p.name} ---\n`
    gcode += `; ${p.width}mm x ${p.height}mm x ${p.thickness}mm\n`
    gcode += `G0 X0 Y0 Z5\nG0 X0 Y0\nG1 Z-${p.thickness} F200\n`
    gcode += `G1 X${p.width} F800\nG1 Y${p.height}\nG1 X0\nG1 Y0\nG0 Z5\n`
  })
  const blob = new Blob([gcode], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function buildBOM(pieces) {
  // Count hardware items per piece type
  let hinges = 0, slides = 0, screws = 0, dowels = 0, handles = 0
  pieces.forEach(p => {
    if (p.type === 'standard_door') { hinges += 2; screws += 8; handles += 1 }
    if (p.type === 'drawer_front')  { slides += 2; screws += 12; handles += 1 }
    if (p.type === 'drawer_box')    { screws += 8; dowels += 4 }
    if (p.type === 'repisa')        { dowels += 4 }
    if (p.type === 'lateral')       { screws += 6; dowels += 6 }
  })
  return [
    { item: 'Bisagras', qty: hinges, unit: 'pcs', ref: 'Blum 71T' },
    { item: 'Correderas telescópicas', qty: slides, unit: 'prs', ref: 'Grass Nova Pro' },
    { item: 'Tiradores', qty: handles, unit: 'pcs', ref: 'Estándar' },
    { item: 'Tornillos Confirmat 7×50', qty: screws, unit: 'pcs', ref: 'Hafele' },
    { item: 'Espigas madera ⌀8mm', qty: dowels, unit: 'pcs', ref: 'Genérico' },
  ].filter(r => r.qty > 0)
}

function exportBOM(bom, filename) {
  const header = ['Herraje', 'Cantidad', 'Unidad', 'Referencia']
  const lines  = [header.join(','), ...bom.map(r => [r.item, r.qty, r.unit, r.ref].join(','))]
  const blob   = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── JSON Export ──────────────────────────────────────────────────────────────
function exportJSON(design, filename) {
  const exportData = {
    orbin_version: '2.6',
    exported_at: new Date().toISOString(),
    module: {
      id: design.id,
      type: design.configuration?.moduleType || 'standard',
      dimensions: {
        width: design.configuration?.width,
        height: design.configuration?.height,
        depth: design.configuration?.depth,
        unit: 'mm'
      },
      material: design.configuration?.materialId || 'mdf_18',
      thickness: design.configuration?.thickness || 18,
    },
    pieces: (design.pieces || design.piezas || []).map(p => ({
      name: p.name,
      type: p.type,
      width: p.width,
      height: p.height,
      thickness: p.thickness,
      quantity: p.quantity || 1,
      edgeBanding: p.edgeBanding || null,
      notes: p.notes || ''
    })),
    hardware: buildBOM(design.pieces || design.piezas || []),
    metadata: {
      piece_count: (design.pieces || design.piezas || []).length,
      total_area_m2: parseFloat(((design.pieces || design.piezas || []).reduce((s, p) => s + (p.width * p.height) / 1e6, 0)).toFixed(3))
    }
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── OBJ Export (simplified 3D geometry) ──────────────────────────────────────
function exportOBJ(pieces, filename) {
  let obj = '# Orbin AI — OBJ Export\n# Generated: ' + new Date().toISOString() + '\n\n'
  let vertexOffset = 0

  pieces.forEach((p, idx) => {
    const w = p.width, h = p.height, d = p.thickness
    // Position pieces stacked along X axis with 5mm gap
    const xOff = idx * (Math.max(w, 100) + 5)
    obj += `o ${p.name || 'Piece_' + (idx + 1)}\n`

    // 8 vertices of a box
    const verts = [
      [xOff, 0, 0], [xOff + w, 0, 0], [xOff + w, h, 0], [xOff, h, 0],
      [xOff, 0, d], [xOff + w, 0, d], [xOff + w, h, d], [xOff, h, d]
    ]
    verts.forEach(v => { obj += `v ${v[0]} ${v[1]} ${v[2]}\n` })

    // 6 faces (quads, 1-indexed)
    const o = vertexOffset
    const faces = [
      [1,2,3,4], [5,6,7,8], [1,2,6,5], [3,4,8,7], [1,4,8,5], [2,3,7,6]
    ]
    faces.forEach(f => { obj += `f ${f.map(i => i + o).join(' ')}\n` })
    vertexOffset += 8
    obj += '\n'
  })

  const blob = new Blob([obj], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Technical PDF Generation ─────────────────────────────────────────────────
async function exportTechnicalPDF(design, filename) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pieces = design.pieces || design.piezas || []
  const config = design.configuration || {}
  const W = 210, margin = 15
  let y = margin

  // ── Title block ──
  doc.setFillColor(20, 20, 20)
  doc.rect(0, 0, W, 40, 'F')
  doc.setTextColor(245, 166, 35)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ORBIN AI — Technical Sheet', margin, 18)
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 180)
  doc.text(`Module: ${design.id || 'N/A'}  |  Date: ${new Date().toLocaleDateString()}`, margin, 28)
  doc.text(`Type: ${config.moduleType || 'standard'}  |  Material: ${config.materialId || 'mdf_18'}  |  Thickness: ${config.thickness || 18}mm`, margin, 34)
  y = 50

  // ── Dimensions overview ──
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('GENERAL DIMENSIONS', margin, y)
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const dims = `Width: ${config.width || '—'}mm  |  Height: ${config.height || '—'}mm  |  Depth: ${config.depth || '—'}mm`
  doc.text(dims, margin, y)
  y += 5
  const totalArea = pieces.reduce((s, p) => s + (p.width * p.height) / 1e6, 0)
  doc.text(`Total pieces: ${pieces.length}  |  Total material area: ${totalArea.toFixed(3)}m²`, margin, y)
  y += 12

  // ── Piece list table ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('CUT LIST', margin, y)
  y += 7

  // Table header
  doc.setFillColor(245, 166, 35)
  doc.rect(margin, y - 4, W - margin * 2, 7, 'F')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  const cols = [margin, margin + 8, margin + 50, margin + 75, margin + 95, margin + 115, margin + 130, margin + 148]
  const headers = ['#', 'Piece', 'Type', 'W(mm)', 'H(mm)', 'T(mm)', 'Qty', 'Edge']
  headers.forEach((h, i) => doc.text(h, cols[i], y))
  y += 6

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  pieces.forEach((p, idx) => {
    if (y > 270) { doc.addPage(); y = margin }
    const bg = idx % 2 === 0 ? 245 : 235
    doc.setFillColor(bg, bg, bg)
    doc.rect(margin, y - 3.5, W - margin * 2, 6, 'F')
    const row = [
      String(idx + 1), p.name || '—', p.type || '—',
      String(p.width), String(p.height), String(p.thickness),
      String(p.quantity || 1), p.edgeBanding?.front ? 'Yes' : 'No'
    ]
    row.forEach((val, i) => doc.text(val, cols[i], y))
    y += 6
  })
  y += 8

  // ── Hardware BOM ──
  const bom = buildBOM(pieces)
  if (bom.length > 0) {
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text('HARDWARE (BOM)', margin, y)
    y += 7
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    bom.forEach(r => {
      doc.text(`• ${r.item}: ${r.qty} ${r.unit}  (${r.ref})`, margin + 3, y)
      y += 5
    })
  }

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(`Orbin AI v2.6 — Page ${i}/${pageCount}`, margin, 290)
    doc.text('Generated for manufacturing. Verify all dimensions before cutting.', W - margin, 290, { align: 'right' })
  }

  doc.save(filename)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportPanel({ design }) {
  const { t } = usePreferences()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(null)

  if (!design) return null

  const pieces  = design.pieces || design.piezas || []
  const modName = `orbin_${design.id?.slice(-6) || 'module'}`
  const bom     = buildBOM(pieces)

  const run = async (key, fn) => {
    setLoading(key)
    await new Promise(r => setTimeout(r, 350)) // brief visual feedback
    fn()
    setLoading(null)
  }

  const btnCls = "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/6 bg-white/3 hover:bg-white/6 text-xs font-semibold text-neutral-300 hover:text-white transition-all group disabled:opacity-40"
  const iconCls = "text-[#f5a623] shrink-0 group-hover:scale-110 transition-transform"

  return (
    <div className="rounded-xl border border-white/8 bg-[#141414] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
        aria-expanded={open}
        aria-controls="export-panel-body"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f5a623]">
            {t('export_panel_title') || 'Exportación Industrial'}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
      </button>

      {/* Body */}
      {open && (
        <div id="export-panel-body" className="px-3 pb-3 space-y-2">

          {/* Cut list CSV */}
          <button
            className={btnCls}
            onClick={() => run('csv', () => exportCSV(pieces, `${modName}_corte.csv`))}
            disabled={loading === 'csv'}
            aria-label={t('export_csv') || 'Exportar Lista de Corte CSV'}
          >
            {loading === 'csv' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <Table size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_csv') || 'Lista de Corte (CSV)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* BOM (hardware) */}
          <button
            className={btnCls}
            onClick={() => run('bom', () => exportBOM(bom, `${modName}_herrajes.csv`))}
            disabled={loading === 'bom'}
            aria-label={t('export_bom') || 'Exportar Lista de Herrajes'}
          >
            {loading === 'bom' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <Wrench size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_bom') || 'Lista de Herrajes (BOM)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* CNC G-code */}
          <button
            className={btnCls}
            onClick={() => run('cnc', () => exportCNC(pieces, `${modName}_cnc.gcode`))}
            disabled={loading === 'cnc'}
            aria-label={t('export_cnc') || 'Exportar CNC G-code'}
          >
            {loading === 'cnc' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <Cpu size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_cnc') || 'Cortes CNC (G-code)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* ★ v2.6: JSON Project Export */}
          <button
            className={btnCls}
            onClick={() => run('json', () => exportJSON(design, `${modName}_project.json`))}
            disabled={loading === 'json'}
            aria-label={t('export_json') || 'Exportar Proyecto JSON'}
          >
            {loading === 'json' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <FileJson size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_json') || 'Proyecto (JSON)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* ★ v2.6: OBJ 3D Export */}
          <button
            className={btnCls}
            onClick={() => run('obj', () => exportOBJ(pieces, `${modName}_3d.obj`))}
            disabled={loading === 'obj'}
            aria-label={t('export_obj') || 'Exportar 3D OBJ'}
          >
            {loading === 'obj' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <Box size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_obj') || '3D Model (OBJ)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* ★ v2.6: Technical PDF */}
          <button
            className={btnCls}
            onClick={() => run('pdf', () => exportTechnicalPDF(design, `${modName}_ficha_tecnica.pdf`))}
            disabled={loading === 'pdf'}
            aria-label={t('export_technical_pdf') || 'Ficha Técnica PDF'}
          >
            {loading === 'pdf' ? <Loader2 size={15} className="animate-spin text-[#f5a623]" /> : <FileImage size={15} className={iconCls} />}
            <span className="flex-1 text-left">{t('export_technical_pdf') || 'Ficha Técnica (PDF)'}</span>
            <Download size={12} className="text-neutral-600" />
          </button>

          {/* BOM preview */}
          {bom.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/6">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-2">
                {t('hardware_preview') || 'Vista previa de herrajes'}
              </p>
              <div className="space-y-1">
                {bom.map(r => (
                  <div key={r.item} className="flex justify-between items-center text-[10px]">
                    <span className="text-neutral-400">{r.item}</span>
                    <span className="text-[#f5a623] font-bold tabular-nums">{r.qty} {r.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
