/**
 * Orbin AI — Advanced Export Panel v1.2
 * ★ PROTECTED: UI for DXF, GLTF, CNC export + nesting optimizer
 * Redesigned for graphic designers and professional carpenters with high-visual-impact CAD actions.
 */

import { useState } from 'react'
import { Download, FileType, Box, Cpu, Scissors, Loader2, Check, AlertCircle, FileSpreadsheet, Lock, Crown } from 'lucide-react'
import { exportDesign, nestPieces, downloadBlob, getExportFormats } from '../engine/exportAdapters.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useUser } from '../context/UserContext.jsx'

// ── Locked export button overlay ──────────────────────────────────────────────
function LockedExportBtn({ label, ext, reason }) {
  return (
    <div className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-white/5 bg-surface-3/30 opacity-50 cursor-not-allowed select-none">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-white/5 text-muted">
          <Lock size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-muted">{label}</span>
            <span className="text-[9px] font-bold text-yellow-400/60 uppercase tracking-widest bg-yellow-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Crown size={8} /> Pro
            </span>
          </div>
          <p className="text-[10px] text-muted/50 mt-1">{reason}</p>
        </div>
      </div>
    </div>
  )
}

export default function ExportPanel({ modules = [] }) {
  const { t, lang } = usePreferences()
  const { canExportPDF, canExportCSV, canExportCNC, canExportBOM, isFree } = useUser()
  const [exporting, setExporting] = useState(null)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [nestingResult, setNestingResult] = useState(null)

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

  // Localization strings helper
  const isES = lang === 'ES'
  const isPT = lang === 'PT'
  const dxfDesc = isES 
    ? 'Planos vectoriales 2D listos para AutoCAD' 
    : isPT 
    ? 'Desenhos vetoriais 2D prontos para AutoCAD' 
    : '2D vector drawings ready for AutoCAD'
  
  const gltfDesc = isES
    ? 'Modelo 3D texturizado para importar en SketchUp'
    : isPT
    ? 'Modelo 3D texturizado para importar no SketchUp'
    : 'Textured 3D model ready for SketchUp'

  return (
    <div className="card space-y-4 p-4 border border-white/5 bg-surface-2 rounded-xl shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2 text-sm text-white/90">
          <Download size={16} className="text-primary animate-pulse" /> 
          {t('export_panel_title') || 'Exportación Industrial'}
        </h3>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
          PRO CAD
        </span>
      </div>

      {/* ─── PRIMARY PROFESSIONAL CAD BUTTONS ─── */}
      <div className="grid grid-cols-1 gap-3">
        {/* AutoCAD Export Button */}
        <button
          onClick={() => handleExport('dxf')}
          disabled={!!exporting}
          className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-surface-3 to-surface-2 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
              <FileType size={20} className="stroke-[2px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white group-hover:text-blue-300 transition-colors">
                  {t('export_dxf')}
                </span>
                {exporting === 'dxf' ? (
                  <Loader2 size={14} className="animate-spin text-blue-400" />
                ) : success === 'dxf' ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <span className="text-[9px] font-bold text-blue-400/80 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded">.DXF</span>
                )}
              </div>
              <p className="text-[11px] text-white/50 mt-1 leading-normal group-hover:text-white/70 transition-colors">
                {dxfDesc}
              </p>
            </div>
          </div>
        </button>

        {/* SketchUp Export Button */}
        <button
          onClick={() => handleExport('gltf')}
          disabled={!!exporting}
          className="relative overflow-hidden group w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-surface-3 to-surface-2 hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
              <Box size={20} className="stroke-[2px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white group-hover:text-emerald-300 transition-colors">
                  {t('export_gltf')}
                </span>
                {exporting === 'gltf' ? (
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                ) : success === 'gltf' ? (
                  <Check size={14} className="text-green-400" />
                ) : (
                  <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">.GLTF</span>
                )}
              </div>
              <p className="text-[11px] text-white/50 mt-1 leading-normal group-hover:text-white/70 transition-colors">
                {gltfDesc}
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="w-full h-px bg-white/5 my-2" />

      {/* ─── SECONDARY PRODUCTION / HARDWARE EXPORTS ─── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-1">
          {isES ? 'Fabricación y Reportes' : isPT ? 'Fabricação e Relatórios' : 'Manufacturing & Reports'}
        </p>
        
        <div className="grid grid-cols-2 gap-2">
          {/* CNC Export — Enterprise only */}
          {canExportCNC ? (
            <button
              onClick={() => handleExport('cnc')}
              disabled={!!exporting}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-3 hover:bg-surface-1 border border-white/5 transition-all text-xs group disabled:opacity-50"
            >
              <Cpu size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="flex-1 text-left text-white/70 group-hover:text-white truncate">
                {t('export_cnc') || 'Cortes CNC'}
              </span>
              {exporting === 'cnc' && <Loader2 size={10} className="animate-spin text-amber-400" />}
              {success === 'cnc' && <Check size={10} className="text-green-400" />}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-3/30 border border-white/5 text-xs opacity-50 cursor-not-allowed">
              <Lock size={12} className="text-yellow-400/60 shrink-0" />
              <span className="text-muted truncate text-[10px]">CNC <Crown size={8} className="inline" /> Ent.</span>
            </div>
          )}

          {/* CSV Factory Export — Pro+ only */}
          {canExportCSV ? (
            <button
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-3 hover:bg-surface-1 border border-white/5 transition-all text-xs group disabled:opacity-50"
            >
              <FileSpreadsheet size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="flex-1 text-left text-white/70 group-hover:text-white truncate">
                CSV Fábrica
              </span>
              {exporting === 'csv' && <Loader2 size={10} className="animate-spin text-emerald-400" />}
              {success === 'csv' && <Check size={10} className="text-green-400" />}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-3/30 border border-white/5 text-xs opacity-50 cursor-not-allowed">
              <Lock size={12} className="text-yellow-400/60 shrink-0" />
              <span className="text-muted truncate text-[10px]">CSV <Crown size={8} className="inline" /> Pro</span>
            </div>
          )}
        </div>

        {/* Free plan export upgrade prompt */}
        {isFree && (
          <a href="/register?plan=pro"
             className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
          >
            <Crown size={11} /> {t('plan_upgrade_btn') || 'Upgrade para exportar PDF/CSV'}
          </a>
        )}

        {/* Nesting Optimizer */}
        <button
          onClick={handleNesting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-950/30 to-indigo-950/20 hover:from-purple-950/50 hover:to-indigo-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-all text-xs font-medium text-purple-200 shadow-sm group active:scale-[0.98]"
        >
          <Scissors size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
          <span>{t('export_nesting') || 'Optimizar Nesting'}</span>
        </button>
      </div>

      {/* Nesting Result */}
      {nestingResult && (
        <div className="bg-surface-3/50 border border-white/5 rounded-xl p-3 space-y-2 animate-fadeIn">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{t('nesting_result')}</p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
              <p className="text-xl font-extrabold text-white tabular-nums">{nestingResult.sheetCount}</p>
              <p className="text-[9px] text-white/40 uppercase font-semibold mt-0.5">{t('sheets_used')}</p>
            </div>
            <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
              <p className={`text-xl font-extrabold tabular-nums ${parseFloat(nestingResult.utilization) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {nestingResult.utilization}%
              </p>
              <p className="text-[9px] text-white/40 uppercase font-semibold mt-0.5">{t('utilization')}</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-white/40 px-1">
            <span>{nestingResult.totalPieces} pcs</span>
            <span>{nestingResult.wastePercent}% {isES ? 'desperdicio' : isPT ? 'desperdício' : 'waste'}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-shake">
          <AlertCircle size={14} className="shrink-0" /> 
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
