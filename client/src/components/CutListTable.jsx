import { useState, useId } from 'react'
import { Download, Filter, ArrowUpDown, FileText, X, Eye, EyeOff } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { usePreferences } from '../context/PreferencesContext.jsx'

const EDGE_LABEL = (eb) => {
  if (!eb) return '—'
  const sides = []
  if (eb.front)  sides.push('F')
  if (eb.back)   sides.push('V')
  if (eb.top)    sides.push('T')
  if (eb.bottom) sides.push('B')
  if (eb.left)   sides.push('E')
  if (eb.right)  sides.push('D')
  if (eb.all)    return 'All'
  return sides.join('+') || '—'
}

const TYPE_COLOR = {
  structural:    'text-blue-400',
  shelf:         'text-green-400',
  baseboard:     'text-yellow-500',
  drawer_front:  'text-purple-400',
  standard_door: 'text-rose-400',
  drawer_box:    'text-purple-300',
  drawer_bottom: 'text-purple-200',
}

function exportCSV(cutList, getTypeLabel, t, lang, unit) {
  const headers = [
    'ID',
    t('piece_name') || (lang === 'EN' ? 'Name' : 'Nombre / Nome'),
    t('cl_type') || (lang === 'EN' ? 'Type' : 'Tipo'),
    unit === 'm' ? t('w_m') : t('w_mm'),
    unit === 'm' ? t('h_m') : t('h_mm'),
    t('cl_thickness') || (lang === 'EN' ? 'Thick.(mm)' : 'Esp.(mm)'),
    t('cl_grain') || (lang === 'EN' ? 'Grain' : 'Veta/Veio'),
    t('cl_edges') || (lang === 'EN' ? 'Edges' : 'Cantos/Bordos')
  ]
  const rows = cutList.map(p => [
    p.id,
    p.name,
    getTypeLabel(p.type),
    p.cutWidth,
    p.cutHeight,
    p.thickness,
    p.grainDirection,
    EDGE_LABEL(p.edgeBanding)
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lista-de-corte-orbin-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportPDF(cutList, getTypeLabel, t, lang, unit) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(18)
  doc.setTextColor(245, 166, 35)
  doc.text(`Orbin AI — ${t('cut_list')}`, 14, 18)

  doc.setFontSize(9)
  doc.setTextColor(160, 160, 160)
  const genLbl = lang === 'PT' ? 'Gerado' : lang === 'ES' ? 'Generado' : 'Generated'
  const totPieces = lang === 'PT' ? 'Total de peças' : lang === 'ES' ? 'Total piezas' : 'Total pieces'
  doc.text(`${genLbl}: ${new Date().toLocaleString()}  |  ${totPieces}: ${cutList.length}`, 14, 26)

  const headers = [[
    'ID',
    t('piece_name') || (lang === 'EN' ? 'Name' : 'Nombre / Nome'),
    t('cl_type') || (lang === 'EN' ? 'Type' : 'Tipo'),
    unit === 'm' ? t('w_m') : t('w_mm'),
    unit === 'm' ? t('h_m') : t('h_mm'),
    t('cl_thickness') || (lang === 'EN' ? 'Thick.(mm)' : 'Esp.(mm)'),
    t('cl_grain') || (lang === 'EN' ? 'Grain' : 'Veta/Veio'),
    t('cl_edges') || (lang === 'EN' ? 'Edges' : 'Cantos/Bordos')
  ]]
  const rows = cutList.map(p => [
    p.id,
    p.name,
    getTypeLabel(p.type),
    p.cutWidth,
    p.cutHeight,
    p.thickness,
    p.grainDirection,
    EDGE_LABEL(p.edgeBanding)
  ])

  autoTable(doc, {
    startY: 32,
    head: headers,
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: [245, 166, 35],
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: { fillColor: [25, 25, 25] },
    bodyStyles: { textColor: [220, 220, 220], fontSize: 7.5, fillColor: [15, 15, 15] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 }
    },
    margin: { top: 32, left: 14, right: 14 }
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    const pagLbl = lang === 'PT' ? 'Pág.' : lang === 'ES' ? 'Pág.' : 'Page'
    doc.text(`Orbin AI v2.2 — ${pagLbl} ${i}/${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
  }

  doc.save(`lista-de-corte-orbin-${Date.now()}.pdf`)
}

// ─── Genera el ID determinístico que usa Viewer3D ─────────────────────────────
const makePieceKey = (moduleId, type, name) =>
  moduleId ? `${moduleId}::${type}::${name.replace(/\s+/g, '_')}` : null

export default function CutListTable({ cutList, selectedPieceIds, onSelectPiece, onDeletePiece, moduleId }) {
  const { t, unit, lang } = usePreferences()
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('type')
  const [sortDir, setSortDir] = useState(1)
  const [hiddenPieceIds, setHiddenPieceIds] = useState(new Set())
  const searchId = useId()

  // Genera la key usada tanto aquí como en Viewer3D
  const pieceKey = (p) => makePieceKey(moduleId, p.type, p.name) || p.id

  const isPieceSelected = (p) => {
    const key = pieceKey(p)
    if (!selectedPieceIds) return false
    if (selectedPieceIds instanceof Set) return selectedPieceIds.has(key)
    if (Array.isArray(selectedPieceIds)) return selectedPieceIds.includes(key)
    return false
  }

  const toggleHidden = (p) => {
    setHiddenPieceIds(prev => {
      const next = new Set(prev)
      const key = pieceKey(p)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const isHidden = (p) => hiddenPieceIds.has(pieceKey(p))

  const typeLabel = (type) => {
    if (type === 'drawer_front')  return t('drawer_front_label')
    if (type === 'standard_door') return t('standard_door_label')
    return type
  }

  if (!cutList?.length) return null

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  const filtered = cutList
    .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.type.includes(filter.toLowerCase()))
    .filter(p => !hiddenPieceIds.has(pieceKey(p)))
    .sort((a, b) => {
      const va = a[sortKey] ?? '', vb = b[sortKey] ?? ''
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir
    })

  const Th = ({ k, children }) => (
    <th
      scope="col"
      onClick={() => toggleSort(k)}
      className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider cursor-pointer hover:text-white select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(k) } }}
      aria-sort={sortKey === k ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <span className="flex items-center gap-1">{children} <ArrowUpDown size={10} aria-hidden="true" /></span>
    </th>
  )

  const f = n => unit === 'm' ? (n / 1000).toFixed(3) : n

  return (
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-semibold text-white flex items-center gap-2 flex-wrap">
          {t('cut_list')}
          <span className="bg-surface-3 text-primary text-xs px-2 py-0.5 rounded-full font-mono">
            {filtered.length} {t('pieces')}
          </span>
          {hiddenPieceIds.size > 0 && (
            <button
              onClick={() => setHiddenPieceIds(new Set())}
              className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-mono hover:bg-yellow-500/20 transition-all"
              title={t('cl_show_hidden')}
            >
              <EyeOff size={10} /> {hiddenPieceIds.size} {t('cl_hidden_suffix')}
            </button>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <label htmlFor={searchId} className="sr-only">{t('cl_filter_table')}</label>
            <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id={searchId}
              className="input-field pl-7 py-1.5 text-xs w-full sm:w-40 focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
              placeholder={t('cl_filter_ph')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <button
            onClick={() => exportPDF(cutList, typeLabel, t, lang, unit)}
            className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-1.5 flex-1 sm:flex-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <FileText size={12} aria-hidden="true" /> {t('export_pdf')}
          </button>
          <button
            onClick={() => exportCSV(cutList, typeLabel, t, lang, unit)}
            className="btn-secondary flex items-center justify-center gap-1.5 text-xs py-1.5 flex-1 sm:flex-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Download size={12} aria-hidden="true" /> {t('export_csv')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label="Tabla de lista de corte">
        <table className="w-full text-sm">
          <caption className="sr-only">{t('cl_caption')}</caption>
          <thead className="bg-surface-3 border-b border-border">
            <tr>
              <Th k="id">ID</Th>
              <Th k="name">{t('piece_name')}</Th>
              <Th k="type">{t('cl_type')}</Th>
              <Th k="cutWidth">{unit === 'm' ? t('w_m') : t('w_mm')}</Th>
              <Th k="cutHeight">{unit === 'm' ? t('h_m') : t('h_mm')}</Th>
              <Th k="thickness">{t('cl_thickness')}</Th>
              <Th k="grainDirection">{t('cl_grain')}</Th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('cl_edges')}</th>
              <th scope="col" className="px-3 py-2.5 w-8" aria-label="Visibilidad" />
              <th scope="col" className="px-3 py-2.5 w-10" aria-label="Eliminar" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted">{t('cl_empty')}</td></tr>
            ) : filtered.map((p, i) => {
              const selected = isPieceSelected(p)
              const key = pieceKey(p)
              return (
              <tr
                key={key + i}
                onClick={() => onSelectPiece && onSelectPiece(new Set([key]))}
                className={`group transition-all cursor-pointer ${
                  selected
                    ? 'bg-primary/15 border-l-2 border-primary shadow-[inset_0_0_8px_rgba(245,166,35,0.08)]'
                    : 'hover:bg-surface-2 border-l-2 border-transparent'
                }`}
                title={t('cl_row_title')}
              >
                <td className={`px-3 py-2.5 font-mono text-xs ${selected ? 'text-primary font-bold' : 'text-muted'}`}>{p.id}</td>
                <td className={`px-3 py-2.5 font-medium ${selected ? 'text-primary' : 'text-white'}`}>{p.name}</td>
                <td className={`px-3 py-2.5 text-xs font-mono ${TYPE_COLOR[p.type] || 'text-muted'}`}>{typeLabel(p.type)}</td>
                <td className="px-3 py-2.5 font-mono text-right">{f(p.cutWidth ?? p.width)}</td>
                <td className="px-3 py-2.5 font-mono text-right">{f(p.cutHeight ?? p.height)}</td>
                <td className="px-3 py-2.5 font-mono text-right text-muted">{p.thickness}</td>
                <td className="px-3 py-2.5 text-xs text-muted capitalize">{p.grainDirection}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-primary">{EDGE_LABEL(p.edgeBanding)}</td>
                {/* ── Botón Ojo ───────────────────────────────────── */}
                <td className="px-1 py-2.5 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); toggleHidden(p) }}
                    className="p-1 rounded text-muted hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    title={isHidden(p) ? t('cl_show_piece') : t('cl_hide_piece')}
                  >
                    <Eye size={12} />
                  </button>
                </td>
                {/* ── Botón Eliminar ──────────────────────────────── */}
                <td className="px-3 py-2.5 text-right">
                  {onDeletePiece && (
                    <button
                      onClick={e => { e.stopPropagation(); onDeletePiece(p.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title={t('cl_delete_piece')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted" aria-hidden="true">
        <span><span className="text-primary font-mono">F</span>=Frente</span>
        <span><span className="text-primary font-mono">V</span>=Verso</span>
        <span><span className="text-primary font-mono">T</span>=Topo</span>
        <span><span className="text-primary font-mono">B</span>=Base</span>
        <span><span className="text-primary font-mono">E/D</span>=Esq/Dir</span>
        <span>{t('cl_measures_in')} <span className="text-white font-mono">{unit.toUpperCase()}</span></span>
      </div>
    </div>
  )
}
