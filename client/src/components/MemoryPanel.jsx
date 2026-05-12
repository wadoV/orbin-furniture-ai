/**
 * Orbin AI — Project Memory Panel v1.0
 * ★ PROTECTED: Shows version history, recent actions, project summary, revert
 *
 * Displays persistent project memory data:
 * - Version history with revert capability
 * - Recent actions log
 * - Auto-generated project summary stats
 */

import { useState } from 'react'
import { History, RotateCcw, Activity, BarChart3, Trash2, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function MemoryPanel({
  versions = [],
  recentActions = [],
  summary = null,
  onRevert,
  onClearMemory,
}) {
  const { t } = usePreferences()
  const [expandedSection, setExpandedSection] = useState('versions')
  const [confirmClear, setConfirmClear] = useState(false)

  const toggle = (section) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const SectionHeader = ({ id, icon: Icon, label, count }) => (
    <button
      onClick={() => toggle(id)}
      className="w-full flex items-center justify-between py-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted hover:text-white transition-colors"
    >
      <span className="flex items-center gap-2">
        <Icon size={12} className="text-primary" /> {label}
        {count > 0 && (
          <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded-full font-mono text-primary">
            {count}
          </span>
        )}
      </span>
      {expandedSection === id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  )

  return (
    <div className="card space-y-2">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <History size={14} className="text-primary" /> {t('memory_title')}
      </h3>

      {/* ── Version History ──────────────────────────────────────────────── */}
      <SectionHeader id="versions" icon={Clock} label={t('version_history')} count={versions.length} />
      {expandedSection === 'versions' && (
        <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
          {versions.length === 0 ? (
            <p className="text-xs text-muted text-center py-3">{t('no_versions')}</p>
          ) : (
            versions.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-3 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{v.label}</p>
                  <p className="text-[10px] text-muted font-mono">
                    {v.age} — {v.moduleCount} {t('modules_label')}
                  </p>
                </div>
                {i > 0 && onRevert && (
                  <button
                    onClick={() => onRevert(v.id)}
                    className="p-1 rounded hover:bg-primary/20 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    title={t('revert_version')}
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
                {i === 0 && (
                  <span className="text-[9px] uppercase tracking-widest text-primary font-bold px-1.5 py-0.5 bg-primary/10 rounded">
                    current
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Recent Actions ───────────────────────────────────────────────── */}
      <SectionHeader id="actions" icon={Activity} label={t('recent_actions')} count={recentActions.length} />
      {expandedSection === 'actions' && (
        <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
          {recentActions.length === 0 ? (
            <p className="text-xs text-muted text-center py-3">{t('no_actions')}</p>
          ) : (
            recentActions.map(a => (
              <div key={a.id} className="flex items-start gap-2 py-1 px-2 text-[11px]">
                <span className="text-muted whitespace-nowrap font-mono">{a.age}</span>
                <span className="text-white/80">{a.description}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Project Summary ──────────────────────────────────────────────── */}
      {summary && (
        <>
          <SectionHeader id="summary" icon={BarChart3} label={t('project_summary')} count={0} />
          {expandedSection === 'summary' && (
            <div className="grid grid-cols-2 gap-2 px-1">
              <StatCard label={t('modules_label')} value={summary.moduleCount} />
              <StatCard label={t('pieces_label')} value={summary.totalPieces} />
              <StatCard label={t('sheets_label')} value={summary.sheetsNeeded} />
              <StatCard label={t('waste_label')} value={`${summary.wastePercent}%`} warn={summary.wastePercent > 30} />
              <StatCard label={t('versions_label')} value={summary.versionsCount} />
              <StatCard label="m²" value={summary.totalAreaM2} />
            </div>
          )}
        </>
      )}

      {/* ── Clear Memory ─────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-white/5">
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-danger flex-1">{t('confirm_clear')}</span>
            <button
              onClick={() => { onClearMemory?.(); setConfirmClear(false) }}
              className="text-[10px] text-danger font-bold px-2 py-1 rounded hover:bg-danger/10"
            >
              OK
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="text-[10px] text-muted px-2 py-1 rounded hover:bg-surface-3"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 text-[10px] text-muted hover:text-danger transition-colors uppercase tracking-widest"
          >
            <Trash2 size={10} /> {t('clear_memory')}
          </button>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, warn = false }) {
  return (
    <div className="bg-surface-3 rounded-lg px-2.5 py-2 text-center">
      <p className={`text-sm font-bold tabular-nums ${warn ? 'text-danger' : 'text-white'}`}>{value}</p>
      <p className="text-[9px] text-muted uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  )
}
