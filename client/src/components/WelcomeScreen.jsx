import { useState, useEffect } from 'react'
import { Zap, Layers, Ruler } from 'lucide-react'
import { usePreferences } from '../context/PreferencesContext'
import LanguageSwitcher from './LanguageSwitcher.jsx'

export default function WelcomeScreen({ onStart }) {
  const { t } = usePreferences()
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-4 right-4 z-20"><LanguageSwitcher /></div>
      {/* Grid animado — usa clase CSS, no hardcode de color */}
      <div className="absolute inset-0 bg-grid pointer-events-none"
           style={{ animation: animate ? 'slideGrid 28s linear infinite' : 'none', opacity: 0.5 }} />
      {/* Glow radial */}
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      {/* Líneas decorativas */}
      <div className="absolute top-1/3 left-0 right-0 glow-line opacity-25" />
      <div className="absolute bottom-1/3 left-0 right-0 glow-line opacity-15" />

      <div className="relative z-10 max-w-lg w-full text-center space-y-10">
        {/* Logo mark */}
        <div className={`transition-all duration-700 ${animate ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
          <div className="w-20 h-20 mx-auto rounded-3xl shadow-glow-lg flex items-center justify-center mb-4"
               style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)' }}>
            <svg viewBox="0 0 300 360" className="w-12 h-12" fill="none" aria-hidden="true">
              <g transform="rotate(35 150 180)">
                <path fill="none" stroke="#0E0E0E" strokeWidth="6" d="M64,120 C40,180 44,250 92,294 C140,334 206,322 232,268"/>
                <path fillRule="evenodd" fill="#0E0E0E" d="M150,20 C200,20 240,60 240,112 C240,176 214,242 182,292 C170,316 124,316 112,292 C82,242 58,176 58,112 C58,60 100,20 150,20 Z M145,118 A46,46 0 0 1 191,164 L191,214 A46,46 0 0 1 99,214 L99,164 A46,46 0 0 1 145,118 Z"/>
              </g>
            </svg>
          </div>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-black text-white tracking-tight">Orbin</span>
            <span className="text-3xl font-black text-primary tracking-tight">AI</span>
          </div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">{t('app_subtitle')}</p>
        </div>

        {/* Mensaje */}
        <div className={`space-y-3 transition-all duration-700 delay-150 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <div className="glow-line opacity-50 mb-6" />
          <p className="text-2xl md:text-3xl font-black text-white leading-snug">
            {t('welcome_q_pre')}{' '}
            <span className="text-gradient">{t('welcome_q_em')}</span> {t('welcome_q_post')}
          </p>
          <p className="text-sm text-white/45 font-medium">
            {t('welcome_sub')}
          </p>
        </div>

        {/* Feature chips */}
        <div className={`flex flex-wrap justify-center gap-2 transition-all duration-700 delay-300 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          {[
            { icon: Ruler,  text: t('chip_cutlist') },
            { icon: Layers, text: t('chip_viewer3d') },
            { icon: Zap,    text: t('chip_ai') },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="chip">
              <Icon size={9} />
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={`transition-all duration-700 delay-[450ms] ${animate ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <button
            onClick={onStart}
            className="btn-primary px-10 py-4 text-sm font-black uppercase tracking-widest rounded-2xl inline-flex items-center gap-3 group"
          >
            <Zap size={18} className="group-hover:scale-110 transition-transform" />
            {t('welcome_cta')}
          </button>
        </div>

        <p className={`text-[9px] text-muted uppercase tracking-[0.25em] font-bold transition-all duration-700 delay-[600ms] ${animate ? 'opacity-100' : 'opacity-0'}`}>
          Orbin AI v2.2 · © 2026 Orbin Technologies
        </p>
      </div>
    </div>
  )
}
