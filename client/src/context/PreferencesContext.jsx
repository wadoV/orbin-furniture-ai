import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { translations } from '../i18n';

const PreferencesContext = createContext();

export function PreferencesProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('orbin_lang') || 'PT');
  const [unit, setUnit] = useState(localStorage.getItem('orbin_unit') || 'mm');

  useEffect(() => { localStorage.setItem('orbin_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('orbin_unit', unit); }, [unit]);

  const t = useMemo(() => (key) => translations[lang]?.[key] || key, [lang]);

  return (
    <PreferencesContext.Provider value={{ lang, setLang, unit, setUnit, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);
