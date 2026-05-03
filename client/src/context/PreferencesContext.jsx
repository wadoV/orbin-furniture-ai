import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { translations } from '../i18n';

const PreferencesContext = createContext({
  lang: 'PT',
  setLang: () => {},
  unit: 'mm',
  setUnit: () => {},
  t: (k) => k,
  convert: (v) => v,
  format: (v) => v
});

export function PreferencesProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('orbin_lang') || 'PT');
  const [unit, setUnit] = useState(() => localStorage.getItem('orbin_unit') || 'mm');

  useEffect(() => { localStorage.setItem('orbin_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('orbin_unit', unit); }, [unit]);

  const t = useMemo(() => {
    return (key) => {
      try {
        return translations[lang]?.[key] || key;
      } catch (e) {
        console.warn('Translation error:', e);
        return key;
      }
    };
  }, [lang]);

  // Convert internal mm value to display value (mm or cm)
  const convert = useMemo(() => {
    return (value) => {
      if (typeof value !== 'number') return value;
      return unit === 'cm' ? value / 10 : value;
    };
  }, [unit]);

  // Format with unit suffix
  const format = useMemo(() => {
    return (value) => {
      const converted = convert(value);
      if (typeof converted !== 'number') return converted;
      return `${converted.toLocaleString()}${unit.toUpperCase()}`;
    };
  }, [unit, convert]);

  const value = useMemo(() => ({ lang, setLang, unit, setUnit, t, convert, format }), [lang, unit, t, convert, format]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    return {
      lang: 'PT',
      setLang: () => {},
      unit: 'mm',
      setUnit: () => {},
      t: (k) => k,
      convert: (v) => v,
      format: (v) => v
    };
  }
  return context;
};
