import { useState } from 'react'
import { FileText, Table, Wrench, Cpu, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react'
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
