import React, { useState } from 'react';
import { Share2, Camera, Check } from 'lucide-react';
import { trackEvent, EVENTS } from '../lib/analytics.js';
import { usePreferences } from '../context/PreferencesContext.jsx';

export default function ViralShare({ renderer, scene, camera }) {
  const { t } = usePreferences();
  const [isCopied, setIsCopied] = useState(false);

  const takeSnapshot = () => {
    if (!renderer || !scene || !camera) return;
    
    // Perform a render specifically for the snapshot
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png', 1.0);
    
    // Create download link
    const link = document.createElement('a');
    link.download = `Orbin_Design_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const copyDeepLink = () => {
    // Simulate deep link generation
    const deepLink = `${window.location.origin}/shared/${Date.now()}`;
    navigator.clipboard.writeText(deepLink);
    setIsCopied(true);
    trackEvent(EVENTS.ROOM_SHARED, { deepLink });
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="absolute top-4 right-4 z-40 flex gap-2">
      <button 
        onClick={takeSnapshot}
        className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/80 transition-all shadow-xl"
        title={t('vs_snapshot')}
      >
        <Camera size={20} />
      </button>
      <button 
        onClick={copyDeepLink}
        className="flex items-center gap-2 px-3 py-2 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
      >
        {isCopied ? <Check size={16} /> : <Share2 size={16} />}
        <span className="text-sm">{isCopied ? t('vs_copied') : t('vs_share')}</span>
      </button>
    </div>
  );
}
