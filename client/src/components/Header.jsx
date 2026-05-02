import { usePreferences } from '../context/PreferencesContext.jsx'

export default function Header() {
  const { lang, setLang, unit, setUnit } = usePreferences()
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 min-h-[3.5rem] py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🪵</span>
          <div>
            <span className="font-bold text-white text-lg tracking-tight">Orbin</span>
            <span className="text-primary font-bold text-lg tracking-tight"> AI</span>
          </div>
          <span className="hidden sm:block text-muted text-xs border border-border rounded px-2 py-0.5">MVP · Closets</span>
        </div>
        <div className="flex items-center flex-wrap gap-4 text-xs text-muted">
          
          <div className="flex items-center gap-2">
            <label htmlFor="unit-select" className="sr-only">Unidad de medida</label>
            <select 
              id="unit-select"
              value={unit} onChange={e => setUnit(e.target.value)}
              className="bg-surface-3 border border-border text-white text-xs rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="mm">MM</option>
              <option value="m">Metros</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="lang-select" className="sr-only">Idioma</label>
            <select 
              id="lang-select"
              value={lang} onChange={e => setLang(e.target.value)}
              className="bg-surface-3 border border-border text-white text-xs rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="PT">PT</option>
              <option value="ES">ES</option>
              <option value="EN">EN</option>
            </select>
          </div>

          <span className="hidden sm:flex items-center gap-1.5" title="Motor activo y funcional">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true"></span>
            Motor v1.0
          </span>
        </div>
      </div>
    </header>
  )
}
