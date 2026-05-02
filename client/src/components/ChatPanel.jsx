/**
 * Orbin AI — Chat Panel
 * Conversational design interface. Sends messages to /api/chat/design
 * and auto-applies the generated design to the parent state.
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader, Cpu } from 'lucide-react'
import { api } from '../api/client.js'
import { usePreferences } from '../context/PreferencesContext.jsx'

function Message({ role, content, hasDesign, t }) {
  const isBot = role === 'assistant'
  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm
        ${isBot ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-surface-3 text-muted border border-white/5'}`}>
        {isBot ? <Cpu size={16} /> : <User size={16} />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg
        ${isBot ? 'bg-surface-3 text-white ring-1 ring-white/5' : 'bg-primary/10 border border-primary/20 text-white'}`}>
        <p className="whitespace-pre-wrap">{content}</p>
        {hasDesign && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary font-bold uppercase tracking-wider">
            <Cpu size={12} /> {t('auto_generated_project')}
          </div>
        )}
      </div>
    </div>
  )
}

const SESSION_ID = 'orbin-' + Math.random().toString(36).slice(2, 8)

export default function ChatPanel({ onDesignGenerated }) {
  const { t } = usePreferences()
  const [messages,  setMessages]  = useState([
    { role: 'assistant', content: t('bot_welcome') }
  ])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await api.chatDesign(text, SESSION_ID)
      const botMsg = { role: 'assistant', content: res.reply, hasDesign: !!res.design }
      setMessages(m => [...m, botMsg])

      if (res.design) {
        onDesignGenerated({ 
          design: res.design, 
          nlParsing: res.params ? {
            original: text, 
            interpreted: `Interpretado via Orbin AI Engine`, 
            confidence: 94
          } : null 
        })
      }
    } catch (err) {
      setMessages(m => [...m, {
        role:    'assistant',
        content: `⚠ Error: ${err.message}. Por favor, intenta de nuevo.`
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      send(); 
    }
  }

  return (
    <div className="card flex flex-col h-[550px] overflow-hidden border-primary/10 shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-0 sticky top-0 bg-surface/80 backdrop-blur-md z-10 p-4 -m-4 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Cpu size={18} className="text-primary" />
        </div>
        <div>
          <span className="font-bold text-sm block text-white">{t('design_assistant')}</span>
          <span className="text-[10px] text-muted flex items-center gap-1 uppercase tracking-widest font-medium">
            <span className="w-1.5 h-1.5 bg-success rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> {t('online') || 'En línea'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-5 px-1 py-2 scroll-smooth scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent"
      >
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} hasDesign={m.hasDesign} t={t} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/10">
              <Cpu size={16} className="text-primary animate-pulse" />
            </div>
            <div className="bg-surface-3 rounded-2xl px-4 py-3 flex items-center gap-3 text-muted text-sm border border-white/5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-medium tracking-wide">{t('calculating')}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-border mt-4">
        <div className="relative group bg-black/30 rounded-2xl border border-white/5 focus-within:border-primary/50 transition-all p-1.5 flex gap-2">
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 min-h-[44px] max-h-32 text-white placeholder:text-muted/50 scrollbar-none"
            placeholder={t('chat_placeholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            style={{ height: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className={`self-end p-2.5 rounded-xl transition-all shadow-lg
              ${input.trim() && !loading 
                ? 'bg-primary text-black hover:scale-105 active:scale-95' 
                : 'bg-surface-3 text-muted opacity-50 cursor-not-allowed'}`}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[9px] text-muted text-center mt-3 opacity-50 tracking-wider uppercase">
          Orbin AI puede cometer errores. Verifica las medidas técnicas.
        </p>
      </div>
    </div>
  )
}
