/**
 * Orbin AI — Beta Feedback Widget
 * Botón flotante (solo beta) que permite a los testers enviar feedback.
 * Inserta en la tabla Supabase `beta_feedback` (RLS: insert para usuarios).
 * Trilingüe ES/PT/EN vía PreferencesContext.
 */
import { useState } from 'react'
import { MessageCircle, Send, X, Check, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useUser } from '../context/UserContext.jsx'

const T = {
  title:       { ES: 'Enviar feedback', PT: 'Enviar feedback', EN: 'Send feedback' },
  subtitle:    { ES: '¿Algo no funciona o tienes una idea? Cuéntanos.', PT: 'Algo não funciona ou tem uma ideia? Conte para nós.', EN: 'Something broke or have an idea? Tell us.' },
  placeholder: { ES: 'Describe el problema o sugerencia…', PT: 'Descreva o problema ou sugestão…', EN: 'Describe the issue or suggestion…' },
  email:       { ES: 'Email (opcional, para respuesta)', PT: 'Email (opcional, para resposta)', EN: 'Email (optional, for a reply)' },
  send:        { ES: 'Enviar', PT: 'Enviar', EN: 'Send' },
  sending:     { ES: 'Enviando…', PT: 'Enviando…', EN: 'Sending…' },
  thanks:      { ES: '¡Gracias! Recibimos tu feedback.', PT: 'Obrigado! Recebemos seu feedback.', EN: 'Thanks! We got your feedback.' },
  error:       { ES: 'No se pudo enviar. Intenta de nuevo.', PT: 'Não foi possível enviar. Tente de novo.', EN: 'Could not send. Please try again.' },
  beta:        { ES: 'BETA', PT: 'BETA', EN: 'BETA' },
}

export default function FeedbackWidget() {
  const { lang } = usePreferences()
  const L = lang || 'PT'
  const t = (k) => T[k]?.[L] || T[k]?.PT || k

  let userEmail = ''
  try { userEmail = useUser()?.user?.email || '' } catch { /* fuera de provider */ }

  const [open, setOpen]       = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail]     = useState(userEmail)
  const [status, setStatus]   = useState('idle') // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    try {
      const { error } = await supabase.from('beta_feedback').insert({
        message: message.trim(),
        email: email.trim() || null,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
        lang: L,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
      })
      if (error) throw error
      setStatus('done')
      setMessage('')
      setTimeout(() => { setOpen(false); setStatus('idle') }, 1800)
    } catch (err) {
      console.error('[FeedbackWidget]', err?.message)
      setStatus('error')
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] print:hidden">
      {open ? (
        <div className="w-80 max-w-[calc(100vw-2.5rem)] bg-surface-2 border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{t('title')}</span>
              <span className="text-[8px] font-black tracking-widest bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.5 rounded">{t('beta')}</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="text-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {status === 'done' ? (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check size={20} className="text-emerald-400" />
              </div>
              <p className="text-sm text-white">{t('thanks')}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="p-4 space-y-3">
              <p className="text-[11px] text-muted leading-relaxed">{t('subtitle')}</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('placeholder')}
                rows={4}
                required
                disabled={status === 'sending'}
                className="w-full bg-surface-1 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary resize-none transition-colors"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('email')}
                disabled={status === 'sending'}
                className="w-full bg-surface-1 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-primary transition-colors"
              />
              {status === 'error' && (
                <p className="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">{t('error')}</p>
              )}
              <button
                type="submit"
                disabled={!message.trim() || status === 'sending'}
                className="btn-primary w-full h-10 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {status === 'sending'
                  ? <><Loader2 size={14} className="animate-spin" /> {t('sending')}</>
                  : <><Send size={14} /> {t('send')}</>}
              </button>
            </form>
          )}
        </div>
      ) : (
        <button
          onClick={() => { setEmail(userEmail); setOpen(true) }}
          aria-label={t('title')}
          className="group flex items-center gap-2 bg-primary text-black font-black pl-3 pr-4 py-3 rounded-full shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
        >
          <MessageCircle size={18} />
          <span className="text-[11px] uppercase tracking-widest">{t('title')}</span>
        </button>
      )}
    </div>
  )
}
