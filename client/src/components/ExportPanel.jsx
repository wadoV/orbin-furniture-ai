/**
 * Orbin AI — Advanced Export Panel v1.0
 * ★ PROTECTED: UI for DXF, GLTF, CNC export + nesting optimizer
 */

import { useState } from 'react'
import { Download, FileType, Box, Cpu, Scissors, Loader2, Check, AlertCircle } from 'lucide-react'
import { exportDesign, nestPieces, downloadBlob, getExportFormats } from '../engine/exportAdapters.js'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ExportPanel({ modules = [] }) {
  const { t } = usePreferences()
  const [exporting, setExporting] = useState(null)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [nestingResult, setNestingResult] = useState(null)

  const formats = [
    { id: 'dxf',  icon: FileType, label: t('export_dxf'),  color: 'text-blue-400' },
    { id: 'gltf', icon: Box,      label: t('export_gltf'), color: 'text-green-400' },
    { id: 'cnc',  icon: Cpu,      label: t('export_cnc'),  color: 'text-amber-400' },
  ]

  const handleExport = async (formatId) => {
    setExporting(formatId)
    setError(null)
    setSuccess(null)
    try {
      const result = await exportDesign(formatId, modules)
      downloadBlob(result.blob, result.filename)
      setSuccess(formatId)
      setTimeout(() => setSuccess(null), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(null)
    }
  }

  const handleNesting = () => {
    try {
      // Extract pieces from modules using the adapter's extractPieces
      const adapter = { extractPieces: getExportFormats }
      // Use nestPieces directly with a simple piece extraction
      const pieces = []
      modules.forEach((mod) => {
        const cfg = mod.configuration
        if (!cfg) return
        const W = cfg.width || 600, H = cfg.height || 720, D = cfg.depth || 580
        const T = cfg.thickness || 18, BT = cfg.backThickness || 6
        pieces.push({ name: 'Left',   w: D, h: H, t: T })
        pieces.push({ name: 'Right',  w: D, h: H, t: T })
        pieces.push({ name: 'Top',    w: W-2*T, h: D, t: T })
        pieces.push({ name: 'Bottom', w: W-2*T, h: D, t: T })
        pieces.push({ name: 'Back',   w: W, h: H, t: BT })
        const shelves = cfg.shelfCount || cfg.divisions || 0
        for (let s = 0; s < shelves; s++) pieces.push({ name: `Shelf ${s+1}`, w: W-2*T, h: D-20, t: T })
        const drawers = cfg.drawerCount || 0
        for (let d = 0; d < drawers; d++) {
          pieces.push({ name: `Drawer F${d+1}`, w: W-2*T-6, h: cfg.drawerHeight||150, t: T })
        }
      })
      if (pieces.length === 0) { setError('No pieces to nest'); return }
      const result = nestPieces(pieces)
      setNestingResult(result.stats)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!modules || modules.length === 0) return null

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <Download size={14} className="text-primary" /> Advanced Export
      </h3>

      <div className="space-y-1.5">
        {formats.map(f => (
          <button
            key={f.id}
            onClick={() => handleExport(f.id)}
            disabled={!!exporting}
            className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-surface-3 hover:bg-surface-2 transition-colors text-sm group"
          >
            <f.icon size={14} className={f.color} />
            <span className="flex-1 text-left text-white/80 group-hover:text-white">{f.label}</span>
            {exporting === f.id && <Loader2 size={12} className="animate-spin text-primary" />}
            {success === f.id && <Check size={12} className="text-green-400" />}
          </button>
        ))}

        {/* Nesting Optimizer */}
        <button
          onClick={handleNesting}
          className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-surface-3 hover:bg-surface-2 transition-colors text-sm group"
        >
          <Scissors size={14} className="text-purple-400" />
          <span className="flex-1 text-left text-white/80 group-hover:text-white">{t('export_nesting')}</span>
        </button>
      </div>

      {/* Nesting Result */}
      {nestingResult && (
        <div className="bg-surface-3 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">{t('nesting_result')}</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-white tabular-nums">{nestingResult.sheetCount}</p>
              <p className="text-[9px] text-muted uppercase">{t('sheets_used')}</p>
            </div>
            <div>
              <p className={`text-lg font-bold tabular-nums ${parseFloat(nestingResult.utilization) >= 70 ? 'text-green-400' : 'text-amber-400'}`}>
                {nestingResult.utilization}%
              </p>
              <p className="text-[9px] text-muted uppercase">{t('utilization')}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted text-center">
            {nestingResult.totalPieces} pcs — {nestingResult.wastePercent}% waste
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}
    </div>
  )
}
