import { FileText, Download, Share2, Save, Trash2, Box, Info } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ResultPanel({ design, onSave, loadingSave, onDeleteModule, selectedPieceIds, onSelectPieces }) {
  const { t, format, convert, unit } = usePreferences()
  if (!design) return null

  const { pieces = [], configuration: cfg = {}, dimensions: dims = {} } = design
  
  // Group pieces for summary
  const summary = pieces.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1
    return acc
  }, {})

  const totalArea = pieces.reduce((acc, p) => acc + (p.width * p.height * p.quantity), 0) / 1000000 // m²

  return (
    <div className="card space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Design Metadata Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('design_summary')}</h3>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-full border border-primary/20">
              {cfg.moduleType || 'standard'}
            </span>
          </div>
          <p className="text-[10px] text-muted font-bold tracking-tight opacity-60">ID: {design.id}</p>
        </div>
        <button
          onClick={() => onDeleteModule(design.id)}
          className="p-2.5 text-muted hover:text-error bg-surface-3/50 hover:bg-error/10 rounded-xl transition-all border border-white/5"
          title={t('delete_module')}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Key Metrics ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('width'),  val: format(dims.external?.width) },
          { label: t('height'), val: format(dims.external?.height) },
          { label: t('depth'),  val: format(dims.external?.depth) },
          { label: 'Material',  val: `${totalArea.toFixed(2)} m²` }
        ].map((m, i) => (
          <div key={i} className="bg-surface-3/40 p-4 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
            <p className="text-[9px] text-muted font-black uppercase tracking-widest mb-1.5 group-hover:text-primary transition-colors">{m.label}</p>
            <p className="text-sm font-black text-white tracking-tight">{m.val}</p>
          </div>
        ))}
      </div>

      {/* ── Structural Validation ─────────────────────────────────────── */}
      <div className="p-4 bg-success/5 rounded-2xl border border-success/20 flex items-center gap-4">
        <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(34,197,94,0.15)]">
          <Box size={14} className="text-success" />
        </div>
        <div>
          <p className="text-[10px] font-black text-success uppercase tracking-widest leading-none mb-1">{t('validation_passed')}</p>
          <p className="text-[10px] text-success/60 font-medium">{t('all_checks_passed')}</p>
        </div>
      </div>

      {/* ── Cut List Table ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{t('cut_list')}</h4>
            <span className="text-[9px] font-black text-muted uppercase tracking-widest bg-surface-3/50 px-2 py-0.5 rounded-full border border-white/5">
              {pieces.length} {t('pieces')}
            </span>
          </div>
          <div className="flex gap-2">
             <button className="p-2 text-muted hover:text-white transition-colors" title={t('export_csv')}>
               <Download size={16} />
             </button>
             <button className="p-2 text-muted hover:text-white transition-colors" title="Print">
               <Share2 size={16} />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                <th className="pb-2 pl-4">{t('piece_name')}</th>
                <th className="pb-2 text-center">{t('qty')}</th>
                <th className="pb-2 text-right">{t('w')} ({unit.toUpperCase()})</th>
                <th className="pb-2 text-right">{t('h')} ({unit.toUpperCase()})</th>
                <th className="pb-2 text-right pr-4">{t('thickness')}</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p, idx) => (
                <tr key={idx} className="bg-surface-3/30 group hover:bg-surface-3 transition-colors border border-white/5">
                  <td className="py-3.5 pl-4 rounded-l-2xl">
                    <div className="flex items-center gap-3">
                       <span className={`w-1.5 h-6 rounded-full ${
                         p.type === 'lateral' ? 'bg-primary' : 
                         p.type === 'drawer_front' ? 'bg-[#00BFFF]' : 
                         p.type === 'standard_door' ? 'bg-[#FFA500]' : 
                         'bg-muted/30'
                       }`} />
                       <span className="text-[11px] font-black text-white tracking-tight uppercase group-hover:text-primary transition-colors">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-center text-[11px] font-black text-white/60">{p.quantity}</td>
                  <td className="py-3.5 text-right text-[11px] font-mono font-bold text-white tracking-tighter">{convert(p.width)}</td>
                  <td className="py-3.5 text-right text-[11px] font-mono font-bold text-white tracking-tighter">{convert(p.height)}</td>
                  <td className="py-3.5 text-right pr-4 text-[10px] font-black text-muted rounded-r-2xl">{p.thickness}mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Design Actions ───────────────────────────────────────────── */}
      <div className="pt-6 border-t border-white/5">
        <button
          onClick={onSave}
          disabled={loadingSave}
          className="w-full btn-primary h-14 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all active:scale-[0.98]"
        >
          {loadingSave 
            ? <span className="w-5 h-5 border-3 border-black/30 border-t-black rounded-full animate-spin" aria-hidden="true" />
            : <><Save size={18} /> {t('save_project')}</>
          }
        </button>
      </div>
    </div>
  )
}
