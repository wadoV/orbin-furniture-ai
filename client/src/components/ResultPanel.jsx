import { useState } from 'react'
import { FileText, Download, Save, Trash2, Box, Wrench, DollarSign, Layers, Package, X } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'
import CutListTable from './CutListTable.jsx'
import { calculateCostEstimation } from '../data/materials.js'

// ─── Cost Card ──────────────────────────────────────────────────────────────
function CostCard({ label, value, accent = false, sub }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${accent ? 'bg-primary/10 border-primary/30' : 'bg-surface-3/40 border-white/5'}`}>
      <p className="text-[9px] text-muted font-black uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`text-sm font-black tracking-tight ${accent ? 'text-primary' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted mt-1">{sub}</p>}
    </div>
  )
}

// ─── Hardware BOM Section ───────────────────────────────────────────────────
function HardwareBOM({ hardware, t }) {
  if (!hardware?.length) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Wrench size={14} className="text-primary" />
        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{t('hardware_bom') || 'Hardware (BOM)'}</h4>
      </div>
      <div className="space-y-2">
        {hardware.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 px-4 bg-surface-3/30 rounded-xl border border-white/5">
            <div>
              <p className="text-[11px] font-bold text-white">{item.type}</p>
              <p className="text-[9px] text-muted">{item.description}</p>
            </div>
            <span className="text-[11px] font-black text-primary font-mono">
              {item.quantity} {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Cost Estimation Panel ──────────────────────────────────────────────────
function CostEstimationPanel({ design, t }) {
  const materialId = design?.configuration?.materialId || 'mdf_18'
  const cost = calculateCostEstimation(design, materialId)
  if (!cost) return <p className="text-muted text-sm text-center py-8">{t('no_cost_data') || 'No cost data available'}</p>

  const fmt = (v) => `$${v.toFixed(2)}`

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Total */}
      <div className="p-5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl border border-primary/30">
        <p className="text-[9px] text-primary font-black uppercase tracking-widest mb-1">{t('estimated_total') || 'Estimated Manufacturing Cost'}</p>
        <p className="text-3xl font-black text-white tracking-tight">{fmt(cost.total)}</p>
        <p className="text-[10px] text-muted mt-1">{t('cost_disclaimer') || 'Estimate based on material area, hardware, and labor'}</p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <CostCard
          label={t('material_cost') || 'Material'}
          value={fmt(cost.material.cost)}
          sub={`${cost.material.totalAreaM2} m² × $${cost.material.costPerM2}/m²`}
        />
        <CostCard
          label={t('waste_cost') || 'Waste'}
          value={fmt(cost.waste.cost)}
          sub={`${cost.waste.percent}% waste`}
        />
        <CostCard
          label={t('hardware_cost') || 'Hardware'}
          value={fmt(cost.hardware.cost)}
          sub={`${cost.hardware.items.length} items`}
        />
        <CostCard
          label={t('edge_cost') || 'Edge Banding'}
          value={fmt(cost.edgeBanding.cost)}
          sub={`${cost.edgeBanding.totalMeters} m`}
        />
        <CostCard
          label={t('labor_cost') || 'Labor'}
          value={fmt(cost.labor.cost)}
          sub="~30% of material"
        />
        <CostCard
          label={t('weight_estimate') || 'Weight'}
          value={`${cost.weight.kg} kg`}
          sub={`${cost.plates.count} plates`}
        />
      </div>

      {/* Material info */}
      <div className="p-3 bg-surface-3/40 rounded-xl border border-white/5 flex items-center gap-3">
        <Package size={14} className="text-primary shrink-0" />
        <p className="text-[10px] text-muted">
          <span className="text-white font-bold">{cost.material.name}</span> — {cost.material.totalAreaM2} m² net · {cost.plates.count} {t('plates') || 'plates'} · {cost.waste.percent}% {t('waste') || 'waste'}
        </p>
      </div>
    </div>
  )
}

// ─── Nesting Summary ────────────────────────────────────────────────────────
function NestingSummary({ nesting }) {
  if (!nesting?.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {nesting.map((group, i) => (
        <div key={i} className="p-3 bg-surface-3/40 rounded-xl border border-white/5">
          <p className="text-[9px] text-muted font-black uppercase tracking-widest mb-1">{group.thickness}mm Panels</p>
          <p className="text-sm font-black text-white">{group.plateCount} {group.plateCount === 1 ? 'plate' : 'plates'}</p>
          <div className="mt-2 h-1.5 bg-surface-4 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.round(group.overallEfficiency * 100)}%` }}
            />
          </div>
          <p className="text-[9px] text-muted mt-1">{Math.round(group.overallEfficiency * 100)}% efficiency</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Button ─────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { id: 'summary', icon: Layers,     labelKey: 'tab_summary' },
  { id: 'cutlist', icon: FileText,   labelKey: 'tab_cutlist' },
  { id: 'cost',    icon: DollarSign, labelKey: 'tab_cost' },
]

// ─── Main ResultPanel ───────────────────────────────────────────────────────
export default function ResultPanel({ design, onSave, loadingSave, onDeleteModule, onDeletePiece, selectedPieceIds, onSelectPieces }) {
  const { t, format, convert, unit } = usePreferences()
  const [activeTab, setActiveTab] = useState('summary')

  if (!design) return null

  const { pieces = [], configuration: cfg = {}, dimensions: dims = {}, hardware = [], nesting = [], cutList = [] } = design

  const totalArea = pieces.reduce((acc, p) => acc + (p.width * p.height * (p.quantity || 1)), 0) / 1000000

  return (
    <div className="card space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ──────────────────────────────────────────────────────── */}
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

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-3/50 p-1 rounded-xl border border-white/5" role="tablist">
        {TAB_ITEMS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
              ${activeTab === id ? 'bg-primary text-black shadow-sm' : 'text-muted hover:text-white hover:bg-surface-2'}`}
          >
            <Icon size={12} /> {t(labelKey) || id}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Key Metrics */}
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

          {/* Validation */}
          <div className="p-4 bg-success/5 rounded-2xl border border-success/20 flex items-center gap-4">
            <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(34,197,94,0.15)]">
              <Box size={14} className="text-success" />
            </div>
            <div>
              <p className="text-[10px] font-black text-success uppercase tracking-widest leading-none mb-1">{t('validation_passed')}</p>
              <p className="text-[10px] text-success/60 font-medium">{t('all_checks_passed')}</p>
            </div>
          </div>

          {/* Pieces summary table */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{t('cut_list')}</h4>
              <span className="text-[9px] font-black text-muted uppercase tracking-widest bg-surface-3/50 px-2 py-0.5 rounded-full border border-white/5">
                {pieces.length} {t('pieces')}
              </span>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                    <th className="pb-2 pl-4">{t('piece_name')}</th>
                    <th className="pb-2 text-center">{t('qty')}</th>
                    <th className="pb-2 text-right">{t('w')} ({unit.toUpperCase()})</th>
                    <th className="pb-2 text-right">{t('h')} ({unit.toUpperCase()})</th>
                    <th className="pb-2 text-right pr-2">{t('thickness')}</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {pieces.map((p, idx) => {
                    const pKey = `${design.id}::${p.type}::${(p.name || '').replace(/\s+/g, '_')}`
                    const isSelected = selectedPieceIds instanceof Set
                      ? selectedPieceIds.has(pKey)
                      : Array.isArray(selectedPieceIds) && selectedPieceIds.includes(pKey)
                    return (
                    <tr
                      key={idx}
                      onClick={() => onSelectPieces && onSelectPieces(new Set([pKey]))}
                      className={`group transition-all cursor-pointer border border-white/5 ${
                        isSelected
                          ? 'bg-primary/20 border-primary/40 shadow-[0_0_12px_rgba(245,166,35,0.15)]'
                          : 'bg-surface-3/30 hover:bg-surface-3'
                      }`}
                      title={t('cl_row_title')}
                    >
                      <td className="py-3.5 pl-4 rounded-l-2xl">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-6 rounded-full transition-all ${
                            isSelected       ? 'bg-primary shadow-[0_0_8px_rgba(245,166,35,0.6)]' :
                            p.type === 'lateral' ? 'bg-primary' :
                            p.type === 'drawer_front' ? 'bg-[#00BFFF]' :
                            p.type === 'standard_door' ? 'bg-[#FFA500]' :
                            'bg-muted/30'
                          }`} />
                          <span className={`text-[11px] font-black tracking-tight uppercase transition-colors ${isSelected ? 'text-primary' : 'text-white group-hover:text-primary'}`}>{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center text-[11px] font-black text-white/60">{p.quantity}</td>
                      <td className="py-3.5 text-right text-[11px] font-mono font-bold text-white tracking-tighter">{convert(p.width)}</td>
                      <td className="py-3.5 text-right text-[11px] font-mono font-bold text-white tracking-tighter">{convert(p.height)}</td>
                      <td className="py-3.5 text-right pr-2 text-[10px] font-black text-muted">{p.thickness}mm</td>
                      <td className="py-3.5 pr-3 rounded-r-2xl">
                        <button
                          onClick={e => { e.stopPropagation(); onDeletePiece && onDeletePiece(design.id, p.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-all"
                          title={t('cl_delete_piece')}
                        >
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hardware BOM */}
          <HardwareBOM hardware={hardware} t={t} />

          {/* Nesting */}
          <NestingSummary nesting={nesting} />
        </div>
      )}

      {activeTab === 'cutlist' && (
        <div className="animate-in fade-in duration-300">
          <CutListTable
            cutList={cutList.length ? cutList : pieces}
            selectedPieceIds={selectedPieceIds}
            onSelectPiece={onSelectPieces}
            onDeletePiece={onDeletePiece ? (pieceId) => onDeletePiece(design.id, pieceId) : null}
            moduleId={design.id}
          />
          {(!cutList?.length && !pieces.length) && (
            <p className="text-muted text-sm text-center py-8">{t('cutlist_from_pieces') || 'Cut list data not available.'}</p>
          )}
        </div>
      )}

      {activeTab === 'cost' && (
        <CostEstimationPanel design={design} t={t} />
      )}

      {/* ── Save Button ─────────────────────────────────────────────────── */}
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
