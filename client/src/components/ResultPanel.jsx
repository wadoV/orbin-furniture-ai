import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight, Layers, Package, Cpu } from 'lucide-react'
import ValidationReport from './ValidationReport.jsx'
import CutListTable from './CutListTable.jsx'

function SummaryCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-surface-3 rounded-xl p-4 border border-border">
      <p className="label">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function NestingSection({ nesting }) {
  if (!nesting?.length) return null
  return (
    <div className="card space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Layers size={15} className="text-primary" /> Estimativa de Chapas
      </h3>
      <div className="space-y-3">
        {nesting.map((n, i) => (
          <div key={i} className="bg-surface-3 rounded-lg p-4 border border-border">
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-sm font-semibold">{n.thickness}mm</span>
              <span className="text-xs text-muted">{n.plateCount} chapa{n.plateCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round(n.overallEfficiency * 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-semibold text-primary w-10 text-right">
                {Math.round(n.overallEfficiency * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted mt-1">Eficiência de material</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function HardwareSection({ hardware }) {
  if (!hardware?.length) return null
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Package size={15} className="text-primary" /> Ferragens (BOM)
      </h3>
      <div className="space-y-2">
        {hardware.map((h, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-white">{h.type}</p>
              <p className="text-xs text-muted">{h.description}</p>
            </div>
            <span className="font-mono font-bold text-primary text-sm whitespace-nowrap ml-4">
              {h.quantity} {h.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function JSONViewer({ design }) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)

  const jsonStr = JSON.stringify(design, null, 2)

  const copy = async () => {
    await navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white"
      >
        <span className="flex items-center gap-2"><Cpu size={14} className="text-primary" /> JSON Master (export)</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="mt-4">
          <div className="flex justify-end mb-2">
            <button onClick={copy} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
              {copied ? <><Check size={12} className="text-success" /> Copiado!</> : <><Copy size={12} /> Copiar JSON</>}
            </button>
          </div>
          <pre className="bg-[#0A0A0A] border border-border rounded-lg p-4 text-xs text-green-400 font-mono overflow-auto max-h-80 leading-relaxed">
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  )
}

import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ResultPanel({ result, selectedPieceIds }) {
  const { t, unit } = usePreferences()
  if (!result?.design) return null
  const { design, nlParsing } = result

  // Selection Info logic
  const selectedPieces = selectedPieceIds?.size > 0 
    ? design.cutList.filter(p => selectedPieceIds.has(p.id))
    : []

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Selection Summary */}
      {selectedPieces.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <Check size={18} /> {t('selection_summary') || 'Resumen de Selección'}
            </h3>
            <span className="bg-primary text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              {selectedPieces.length} {t('pieces') || 'Piezas'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted uppercase font-bold tracking-wider">Detalles del conjunto</p>
              <div className="bg-black/20 rounded-lg p-3 text-sm">
                {selectedPieces.length === 1 ? (
                  <div className="flex flex-col gap-1">
                    <p className="font-bold text-white">{selectedPieces[0].name}</p>
                    <p className="font-mono text-primary">{selectedPieces[0].cutWidth} x {selectedPieces[0].cutHeight} x {selectedPieces[0].thickness}mm</p>
                  </div>
                ) : (
                  <ul className="space-y-1 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20">
                    {selectedPieces.map(p => (
                      <li key={p.id} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
                        <span className="text-white truncate max-w-[150px]">{p.name}</span>
                        <span className="font-mono text-muted">{p.cutWidth}x{p.cutHeight}mm</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="bg-black/10 rounded-lg p-4 flex flex-col justify-center items-center text-center border border-white/5">
              <p className="text-[10px] text-muted uppercase font-bold mb-2">Acción Rápida</p>
              <div className="flex gap-2">
                 <button className="bg-primary hover:bg-white text-black px-4 py-2 rounded-lg text-xs font-bold transition-all">
                   Eliminar Selección
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* NL parsing feedback */}
      {nlParsing && (
        <div className="bg-surface border border-primary/30 rounded-xl px-4 py-3 text-xs text-muted">
          <span className="text-primary font-semibold">Parser NL</span> · {nlParsing.interpreted}
          <span className="ml-2 text-muted">· Confiança: <span className="text-white font-mono">{nlParsing.confidence}%</span></span>
        </div>
      )}

      {/* Validation */}
      <ValidationReport validation={design.validation} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label={t('pieces')} value={design.summary.totalPieces} sub="unidades" color="text-primary" />
        <SummaryCard label="Chapas MDF"     value={design.summary.totalPlates} sub="18mm + 6mm" />
        <SummaryCard
          label="Eficiência"
          value={`${Math.round(design.summary.avgMaterialEfficiency * 100)}%`}
          sub="material aproveitado"
          color={design.summary.avgMaterialEfficiency > 0.7 ? 'text-success' : 'text-warning'}
        />
        <SummaryCard
          label="Dimensões"
          value={unit === 'm' 
            ? `${(design.dimensions.external.width / 1000).toFixed(2)}×${(design.dimensions.external.height / 1000).toFixed(2)} m`
            : `${design.dimensions.external.width / 10}×${design.dimensions.external.height / 10} cm`}
          sub="L×A (externo)"
        />
      </div>

      {/* Cut list */}
      <CutListTable cutList={design.cutList} />

      {/* Nesting */}
      <NestingSection nesting={design.nesting} />

      {/* Hardware BOM */}
      <HardwareSection hardware={design.hardware} />

      {/* Design ID + JSON */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Módulo Ativo:</span>
        <code className="font-mono text-primary">{design.id}</code>
        <span>·</span>
        <span>{new Date(design.generatedAt).toLocaleString()}</span>
      </div>

      <JSONViewer design={design} />
    </div>
  )
}
