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

  const [clipboardModule, setClipboardModule] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orbin_clipboard')); } catch { return null; }
  });

  useEffect(() => { localStorage.setItem('orbin_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('orbin_unit', unit); }, [unit]);
  useEffect(() => {
    if (clipboardModule) localStorage.setItem('orbin_clipboard', JSON.stringify(clipboardModule));
    else localStorage.removeItem('orbin_clipboard');
  }, [clipboardModule]);

  const t = useMemo(() => {
    return (key, fallback) => {
      try {
        const hit = translations[lang]?.[key];
        if (hit) return hit;
        if (fallback) return fallback;
        if (import.meta.env.DEV) console.warn('[i18n] missing key:', key, lang);
        return key;
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

  const value = useMemo(() => ({
    lang, setLang,
    unit, setUnit,
    clipboardModule, setClipboardModule,
    t, convert, format
  }), [lang, unit, clipboardModule, t, convert, format]);

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
      clipboardModule: null,
      setClipboardModule: () => {},
      t: (k) => k,
      convert: (v) => v,
      format: (v) => v
    };
  }
  return context;
};
