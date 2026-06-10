import React, { useState, useEffect } from 'react';
import { Sparkles, Palette } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext.jsx';

const STYLES = [
  { id: 'nordic',     colors: { main: '#ffffff', secondary: '#C8A96E' } },
  { id: 'industrial', colors: { main: '#333333', secondary: '#111111' } },
  { id: 'minimalist', colors: { main: '#e5e5e5', secondary: '#5D4037' } }
];

export default function AIVisualStylist({ currentDesign, onApplyStyle }) {
  const { t } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    // Simulated AI analysis of the current design to propose styles
    if (currentDesign) {
      setSuggestions(STYLES);
    }
  }, [currentDesign]);

  if (!currentDesign) return null;

  return (
    <div className="absolute top-4 left-4 z-40">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/80 transition-all shadow-xl"
      >
        <Sparkles size={16} className="text-primary" />
        <span className="text-sm font-medium tracking-wide">{t('avs_title')}</span>
      </button>

      {isOpen && (
        <div className="mt-2 w-72 bg-surface-1/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-4 text-white">
            <Palette size={16} />
            <h3 className="text-sm font-bold">{t('avs_suggestions')}</h3>
          </div>
          <div className="space-y-3">
            {suggestions.map((style) => (
              <button 
                key={style.id}
                onClick={() => {
                  onApplyStyle({ ...style, name: t('avs_style_' + style.id + '_name'), desc: t('avs_style_' + style.id + '_desc') });
                  setIsOpen(false);
                }}
                className="w-full text-left p-3 rounded-lg bg-surface-2/50 hover:bg-surface-3 transition-colors border border-transparent hover:border-primary/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full shadow-inner flex overflow-hidden border border-white/20">
                    <div className="w-1/2 h-full" style={{ backgroundColor: style.colors.main }}></div>
                    <div className="w-1/2 h-full" style={{ backgroundColor: style.colors.secondary }}></div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t('avs_style_' + style.id + '_name')}</div>
                    <div className="text-xs text-muted mt-0.5">{t('avs_style_' + style.id + '_desc')}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
