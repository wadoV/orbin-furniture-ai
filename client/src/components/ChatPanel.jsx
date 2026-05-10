import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Wand2, Hammer, Ruler, History, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

// ★ PROTECTED: AI Model badge config — color-coded per provider
const MODEL_BADGES = {
  'vertex-ai-high-tier':      { label: 'Gemini Pro',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'vertex-ai-high-tier-chat': { label: 'Gemini Pro',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'ollama':                   { label: 'Ollama Local',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  'ollama-chat':              { label: 'Ollama Local',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  'claude':                   { label: 'Claude Premium', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  'regex-fallback':           { label: 'Offline Mode',  color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'error':                    { label: 'Error',         color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  'unknown':                  { label: 'AI',            color: 'bg-white/10 text-white/60 border-white/10' },
}

// ★ PROTECTED: Prompt History persistence
const HISTORY_KEY = 'orbin-prompt-history'
const MAX_HISTORY = 10

function loadPromptHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]').slice(0, MAX_HISTORY) }
  catch { return [] }
}
function savePromptHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))) }
  catch { /* quota exceeded */ }
}

export default function ChatPanel({ messages, onSendMessage, loading, aiStatus, lastPrompt, currentDesign }) {
  const { t } = usePreferences()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const [promptHistory, setPromptHistory] = useState(() => loadPromptHistory())
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, aiStatus])

  // ★ PROTECTED: Save prompt to history on send
  const handleSend = (e) => {
    if (e) e.preventDefault()
    if (!input.trim() || loading) return
    const trimmed = input.trim()

    // Add to prompt history (dedup, newest first)
    const updated = [trimmed, ...promptHistory.filter(p => p !== trimmed)].slice(0, MAX_HISTORY)
    setPromptHistory(updated)
    savePromptHistory(updated)

    onSendMessage(trimmed)
    setInput('')
    setShowHistory(false)
  }

  // ★ PROTECTED: Reuse prompt from history
  const reusePrompt = (prompt) => {
    setInput(prompt)
    setShowHistory(false)
  }

  // ★ PROTECTED: Optimization Engine v1 — analyzes current design and generates smart suggestions
  const handleOptimize = () => {
    if (loading) return
    const pieces = currentDesign?.pieces || currentDesign?.piezas || []
    const config = currentDesign?.configuration || {}

    // Analyze current design metrics
    const totalPieces = pieces.length
    const totalArea = pieces.reduce((sum, p) => sum + (p.width * p.height) / 1e6, 0) // m²
    const thicknesses = [...new Set(pieces.map(p => p.thickness))]
    const types = [...new Set(pieces.map(p => p.type))]
    const sheetArea = 2.44 * 1.83 // standard MDP sheet m²
    const sheetsNeeded = Math.ceil(totalArea / sheetArea)
    const wastePercent = sheetsNeeded > 0 ? Math.round((1 - totalArea / (sheetsNeeded * sheetArea)) * 100) : 0

    // Build context-aware optimization prompt
    let prompt = lastPrompt
      ? `Based on my previous request: "${lastPrompt}". `
      : `Optimize the current furniture module. `

    prompt += `CURRENT DESIGN ANALYSIS:\n`
    prompt += `- ${totalPieces} pieces, ${types.length} types (${types.join(', ')})\n`
    prompt += `- Total material area: ${totalArea.toFixed(2)}m² → ${sheetsNeeded} standard sheets (2440×1830mm)\n`
    prompt += `- Estimated waste: ${wastePercent}%\n`
    prompt += `- Dimensions: ${config.width || '?'}×${config.height || '?'}×${config.depth || '?'}mm\n`
    prompt += `- Thicknesses: ${thicknesses.join('mm, ')}mm\n\n`

    prompt += `OPTIMIZE FOR:\n`
    prompt += `1. REDUCE WASTE: ${wastePercent > 25 ? 'HIGH PRIORITY — ' + wastePercent + '% waste detected. ' : ''}Adjust piece dimensions to maximize nesting on standard 2440×1830mm sheets.\n`
    prompt += `2. STRUCTURAL INTEGRITY: Evaluate if any piece is undersized or oversized for its role.\n`
    prompt += `3. SIMPLIFY CUTS: ${totalPieces > 12 ? 'Merge similar-sized pieces where structurally possible. ' : ''}Reduce the number of unique dimensions.\n`
    prompt += `4. COST REDUCTION: Suggest material substitutions or thickness changes that maintain quality.\n`
    prompt += `5. MANUFACTURING: Flag any dimension that creates CNC tooling issues or non-standard hardware fitment.\n`
    prompt += `\nProvide specific numeric recommendations, not general advice. Show before→after for each change.`

    onSendMessage(prompt)
  }

  // ★ PROTECTED: AI Model Badge component
  const ModelBadge = ({ source }) => {
    const badge = MODEL_BADGES[source] || MODEL_BADGES['unknown']
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${badge.color}`}>
        <span className="w-1 h-1 rounded-full bg-current" />
        {badge.label}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] bg-surface/40 rounded-3xl border border-white/5 overflow-hidden">

      {/* ── Chat Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-surface-3/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
            <Bot size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">{t('design_assistant')}</h3>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-primary animate-pulse' : 'bg-success animate-pulse'}`} />
              <span className={`text-[9px] font-black uppercase tracking-widest opacity-80 ${loading ? 'text-primary' : 'text-success'}`}>
                {loading ? (aiStatus || 'Processing...') : 'Online & Ready'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {/* ★ PROTECTED: Optimize Design button — works with design data or last prompt */}
          {(lastPrompt || currentDesign) && !loading && (
            <button
              onClick={handleOptimize}
              className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary hover:bg-primary/20 transition-all group"
              title={t('optimize_design') || 'Optimize Design'}
            >
              <Zap size={14} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
          <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-muted hover:text-primary transition-colors cursor-help" title="Kitchen Expert">
            <Hammer size={14} />
          </div>
        </div>
      </div>

      {/* ── Message Area ─────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-700">
            <div className="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center border border-primary/10">
              <Sparkles size={32} className="text-primary/40" />
            </div>
            <div className="max-w-xs space-y-2">
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{t('bot_welcome')}</h4>
              <p className="text-[11px] text-muted leading-relaxed font-medium">
                {t('bot_greeting')}
              </p>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${m.role === 'user' ? 'bg-surface-3 border-white/10' : 'bg-primary/10 border-primary/20'}`}>
              {m.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-primary" />}
            </div>
            <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'space-y-2'}`}>
              <div className={`p-4 rounded-2xl text-[12px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-surface-3 text-white rounded-tr-none' : 'bg-white/5 text-white/90 border border-white/5 rounded-tl-none'}`}>
                {m.content}
              </div>
              {/* ★ PROTECTED: AI Model Badge — shows which model generated the response */}
              {m.role === 'assistant' && m.source && (
                <div className="pl-1">
                  <ModelBadge source={m.source} />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ★ PROTECTED: AI Status Indicator — animated processing phases */}
        {loading && (
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Bot size={14} className="text-primary animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 space-y-2">
              {aiStatus && (
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">
                  {aiStatus}
                </p>
              )}
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input Area ──────────────────────────────────────────────── */}
      <div className="p-6 bg-surface-3/30 border-t border-white/5">
        {/* ★ PROTECTED: Prompt History dropdown */}
        {showHistory && promptHistory.length > 0 && (
          <div className="mb-3 bg-surface-3 border border-white/10 rounded-2xl overflow-hidden max-h-40 overflow-y-auto">
            {promptHistory.map((p, i) => (
              <button
                key={i}
                onClick={() => reusePrompt(p)}
                className="w-full text-left px-4 py-2.5 text-[11px] text-white/80 hover:bg-primary/10 hover:text-white transition-colors border-b border-white/5 last:border-0 truncate"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="relative group">
          {/* ★ PROTECTED: History toggle button */}
          {promptHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(s => !s)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-primary transition-colors rounded-lg hover:bg-white/5"
              title={t('prompt_history') || 'Prompt History'}
            >
              <History size={14} />
            </button>
          )}
          <input
            type="text"
            className={`w-full bg-surface-3 text-white text-xs p-5 pr-14 rounded-2xl border border-white/5 focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/40 placeholder:font-bold ${promptHistory.length > 0 ? 'pl-12' : ''}`}
            placeholder={t('chat_placeholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-black rounded-xl flex items-center justify-center hover:shadow-[0_0_15px_rgba(245,166,35,0.4)] disabled:opacity-40 disabled:hover:shadow-none transition-all active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="mt-4 flex items-center justify-center gap-4 opacity-30">
           <div className="flex items-center gap-1.5">
             <Wand2 size={10} className="text-white" />
             <span className="text-[9px] font-black text-white uppercase tracking-widest">Parametric Logic</span>
           </div>
           <div className="w-1 h-1 bg-white/20 rounded-full" />
           <div className="flex items-center gap-1.5">
             <Ruler size={10} className="text-white" />
             <span className="text-[9px] font-black text-white uppercase tracking-widest">Millimeter Precision</span>
           </div>
        </div>
      </div>
    </div>
  )
}
