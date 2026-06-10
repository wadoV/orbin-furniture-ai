/**
 * Orbin AI — LanguageSwitcher
 * Segmented control ES | PT | EN, synced to the global PreferencesContext.
 * Drop it into any page; it persists the choice (localStorage 'orbin_lang').
 */
import { usePreferences } from '../context/PreferencesContext.jsx'

const LANGS = ['ES', 'PT', 'EN']

export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = usePreferences()
  return (
    <div
      role="group"
      aria-label="Language selector"
      className={`inline-flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5 ${className}`}
    >
      {LANGS.map(l => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-colors ${
            lang === l ? 'bg-primary text-black' : 'text-muted hover:text-white'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
