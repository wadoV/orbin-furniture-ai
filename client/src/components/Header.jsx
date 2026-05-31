import { usePreferences } from '../context/PreferencesContext.jsx'
import { Globe, Ruler } from 'lucide-react'

export default function Header() {
  const { lang, setLang, unit, setUnit, t } = usePreferences()

  return (
    <header className="border-b border-white/5 glass sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 min-h-[3.75rem] flex items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex items-center gap-3 group cursor-default select-none">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300"
               style={{ background: 'linear-gradient(135deg, #F5A623 0%, #C47A0F 100%)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="20" height="18" rx="2.5" stroke="black" strokeWidth="1.8"/>
              <line x1="2" y1="11" x2="22" y2="11" stroke="black" strokeWidth="1.4"/>
              <rect x="5" y="14" width="5.5" height="5" rx="1" fill="black" opacity="0.55"/>
              <rect x="13.5" y="14" width="5.5" height="5" rx="1" fill="black" opacity="0.55"/>
            </svg>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-white text-[17px] tracking-tight leading-none">Orbin</span>
              <span className="text-primary font-black text-[17px] tracking-tight leading-none">AI</span>
            </div>
            <span className="hidden sm:block text-[8px] text-muted font-bold tracking-[0.28em] uppercase opacity-50 leading-none">Furniture Engine</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-2 bg-surface-3/60 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/5 group hover:border-primary/25 transition-all cursor-pointer">
            <Ruler size={13} className="text-muted group-hover:text-primary transition-colors shrink-0" />
            <select id="unit-select" value={unit} onChange={e => setUnit(e.target.value)}
              className="bg-transparent text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
              aria-label="Unidad de medida">
              <option value="mm">MM</option>
              <option value="cm">CM</option>
            </select>
          </label>

          <label className="flex items-center gap-2 bg-surface-3/60 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/5 group hover:border-primary/25 transition-all cursor-pointer">
            <Globe size={13} className="text-muted group-hover:text-primary transition-colors shrink-0" />
            <select id="lang-select" value={lang} onChange={e => setLang(e.target.value)}
              className="bg-transparent text-white text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
              aria-label="Idioma">
              <option value="PT">PT</option>
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </label>

          <div className="hidden lg:flex items-center gap-2 bg-primary/6 px-3 py-1.5 rounded-full border border-primary/18 transition-all">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">{t('cloud_model_active')}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
