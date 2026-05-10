import { useState, useEffect } from 'react'
import { Box } from 'lucide-react'

export default function WelcomeScreen({ onStart }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    setAnimate(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D0D0D] via-[#1A1A1A] to-[#0D0D0D] flex flex-col items-center justify-center p-6">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(to right, #FFD700 1px, transparent 1px), linear-gradient(to bottom, #FFD700 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            animation: animate ? 'slideGrid 20s linear infinite' : 'none'
          }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl text-center space-y-8">
        {/* Logo */}
        <div className={`transform transition-all duration-700 ${animate ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 mx-auto">
            <span className="text-white font-black text-5xl italic">O</span>
          </div>
        </div>

        {/* Greeting Message */}
        <div className={`space-y-4 transform transition-all duration-900 delay-200 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Hola, soy <span className="text-primary">Orbin</span>
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary/40 mx-auto rounded-full" />
          <p className="text-xl md:text-2xl text-white/80 font-bold tracking-wide">
            Control total asumido.
          </p>
          <p className="text-lg text-primary font-black uppercase tracking-widest">
            Sistema operativo
          </p>
        </div>

        {/* Question */}
        <div className={`transform transition-all duration-900 delay-500 ${animate ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <p className="text-2xl md:text-3xl font-bold text-white/90 mb-8">
            ¿Qué vamos a <span className="text-primary">fabricar</span> hoy?
          </p>

          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-black font-black uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 group"
          >
            <Box size={20} className="group-hover:rotate-12 transition-transform" />
            <span>Comenzar Diseño</span>
          </button>
        </div>

        {/* Version Info */}
        <div className="pt-8 border-t border-white/5">
          <p className="text-xs text-muted uppercase tracking-[0.2em] font-bold">
            Orbin Furniture AI v2.2.0
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideGrid {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 50px 50px;
          }
        }
      `}</style>
    </div>
  )
}
