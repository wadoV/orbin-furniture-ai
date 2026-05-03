import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Wand2, Hammer, Ruler } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext.jsx'

export default function ChatPanel({ messages, onSendMessage, loading }) {
  const { t } = usePreferences()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    onSendMessage(input)
    setInput('')
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
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] font-black text-success uppercase tracking-widest opacity-80">Online & Thinking</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
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
                "Puedo diseñar módulos base de cocina, aéreos y roperos. Solo dime qué necesitas y yo haré los cálculos."
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
            <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] leading-relaxed font-medium ${m.role === 'user' ? 'bg-surface-3 text-white rounded-tr-none' : 'bg-white/5 text-white/90 border border-white/5 rounded-tl-none'}`}>
              {m.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-start gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5">
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
        <form onSubmit={handleSend} className="relative group">
          <input
            type="text"
            className="w-full bg-surface-3 text-white text-xs p-5 pr-14 rounded-2xl border border-white/5 focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted/40 placeholder:font-bold"
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
