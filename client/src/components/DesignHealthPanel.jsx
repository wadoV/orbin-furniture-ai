/**
 * Orbin AI — Design Health Panel v1.0
 * PROTECTED: Visual score indicator with AI recommendations
 *
 * Shows overall design score, category breakdowns, and actionable suggestions.
 * Integrates with designAnalyzer engine.
 */

import { useState } from 'react'
import { Activity, AlertTriangle, Info, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { analyzeDesign } from '../engine/designAnalyzer.js'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function DesignHealthPanel({ modules }) {
  const { t } = usePreferences()
  const [expanded, setExpanded] = useState(false)

  const analysis = analyzeDesign(modules)
  if (!analysis) return null

  const { overall, grade, color, categories, suggestions } = analysis

  return (
    <div className="card space-y-3">
      {/* Header with score circle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {/* Score circle */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-surface-3"
              />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeDasharray={overall + ' ' + (100 - overall)}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-black" style={{ color }}>{overall}</span>
              <span className="text-[8px] text-muted uppercase tracking-widest">{grade}</span>
            </div>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={12} className="text-primary" />
              {t('design_health') || 'Design Health'}
            </h3>
            <p className="text-[10px] text-muted">
              {suggestions.length > 0
                ? suggestions.length + ' ' + (t('suggestions') || 'suggestions')
                : t('no_issues') || 'No issues found'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {expanded && (
        <>
          {/* Category bars */}
          <div className="space-y-2 pt-1">
            {Object.entries(categories).map(([key, cat]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted uppercase tracking-widest">{cat.label}</span>
                  <span className="font-mono font-bold" style={{ color: scoreToColor(cat.score) }}>{cat.score}</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: cat.score + '%',
                      backgroundColor: scoreToColor(cat.score),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <p className="text-[10px] text-muted uppercase tracking-widest font-semibold">
                {t('ai_suggestions') || 'AI Suggestions'}
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className={'flex items-start gap-2 px-2 py-1.5 rounded-lg text-[11px] ' +
                    (s.priority === 'high'
                      ? 'bg-danger/10 text-danger/90'
                      : s.priority === 'medium'
                        ? 'bg-amber-500/10 text-amber-400/90'
                        : 'bg-surface-3 text-muted')}
                >
                  {s.priority === 'high'
                    ? <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    : <Info size={12} className="flex-shrink-0 mt-0.5" />}
                  <span>{s.message}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function scoreToColor(score) {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  return '#EF4444'
}
