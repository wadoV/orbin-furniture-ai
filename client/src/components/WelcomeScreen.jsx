import { useState, useEffect } from 'react'
import { Zap, Layers, Ruler } from 'lucide-react'
import OrbinLogo from './OrbinLogo.jsx'

export default function WelcomeScreen({ onStart }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-6 overflow-hidden relative">
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
          <OrbinLogo variant="isotipo" theme="dark" className="w-20 h-20 mx-auto mb-4" />
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-black text-white tracking-tight">Orbin</span>
            <span className="text-3xl font-black text-primary tracking-tight">AI</span>
          </div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">Parametric Furniture Engine</p>
        </div>

        {/* Mensaje */}
        <div className={`space-y-3 transition-all duration-700 delay-150 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <div className="glow-line opacity-50 mb-6" />
          <p className="text-2xl md:text-3xl font-black text-white leading-snug">
            ¿Qué vamos a{' '}
            <span className="text-gradient">fabricar</span> hoy?
          </p>
          <p className="text-sm text-white/45 font-medium">
            Motor paramétrico brasileiro · Precisão 1mm · CNC-ready
          </p>
        </div>

        {/* Feature chips */}
        <div className={`flex flex-wrap justify-center gap-2 transition-all duration-700 delay-300 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          {[
            { icon: Ruler,  text: 'Lista de Corte' },
            { icon: Layers, text: 'Visor 3D' },
            { icon: Zap,    text: 'IA Paramétrica' },
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
            Comenzar Diseño
          </button>
        </div>

        <p className={`text-[9px] text-muted uppercase tracking-[0.25em] font-bold transition-all duration-700 delay-[600ms] ${animate ? 'opacity-100' : 'opacity-0'}`}>
          Orbin AI v2.2 · © 2026 Orbin Technologies
        </p>
      </div>
    </div>
  )
}
