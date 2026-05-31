import { usePreferences } from '../context/PreferencesContext.jsx'
import { Globe, Ruler } from 'lucide-react'

export default function Header() {
  const { lang, setLang, unit, setUnit, t } = usePreferences()
  
  return (
    <header className="border-b border-white/5 bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 min-h-[4rem] flex items-center justify-between gap-6">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-black font-black text-xl italic" aria-hidden="true">O</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-white text-xl tracking-tight uppercase">Orbin</span>
              <span className="text-primary font-black text-xl tracking-tight uppercase">AI</span>
            </div>
            <span className="text-[10px] text-muted font-bold tracking-[0.3em] uppercase opacity-60">Modular System v2.1</span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-6">
          
          {/* Unit Selector */}
          <div className="flex items-center gap-3 bg-surface-3/50 px-3 py-1.5 rounded-xl border border-white/5 group hover:border-primary/30 transition-all">
            <Ruler size={14} className="text-muted group-hover:text-primary transition-colors" />
            <select 
              id="unit-select"
              value={unit} 
              onChange={e => setUnit(e.target.value)}
              className="bg-transparent text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="mm">MM</option>
              <option value="cm">CM</option>
            </select>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-3 bg-surface-3/50 px-3 py-1.5 rounded-xl border border-white/5 group hover:border-primary/30 transition-all">
            <Globe size={14} className="text-muted group-hover:text-primary transition-colors" />
            <select 
              id="lang-select"
              value={lang} 
              onChange={e => setLang(e.target.value)}
              className="bg-transparent text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="PT">PT</option>
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </div>

          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-2.5 bg-primary/5 px-4 py-1.5 rounded-full border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]" aria-hidden="true"></span>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{t('cloud_model_active')}</span>
          </div>

        </div>
      </div>
    </header>
  )
}
