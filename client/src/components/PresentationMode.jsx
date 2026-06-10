import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import './PresentationMode.css';

export default function PresentationMode({ camera, controls, isEnabled, onToggle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const restoreRef = useRef(null);

  // Fullscreen styling toggle
  useEffect(() => {
    if (isEnabled) {
      document.body.classList.add('presentation-active');
    } else {
      document.body.classList.remove('presentation-active');
      setIsPlaying(false);
    }
    return () => document.body.classList.remove('presentation-active');
  }, [isEnabled]);

  // Cinematic turntable driven by OrbitControls.autoRotate so it never fights
  // the main render loop (which already calls controls.update() every frame).
  useEffect(() => {
    if (!camera || !controls) return;

    if (isPlaying && isEnabled) {
      restoreRef.current = {
        target: controls.target.clone(),
        autoRotate: controls.autoRotate,
        autoRotateSpeed: controls.autoRotateSpeed,
        enablePan: controls.enablePan,
      };
      controls.target.set(0, 320, 0);
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.6;
      controls.enablePan = false;
      controls.update();
    } else if (restoreRef.current) {
      const r = restoreRef.current;
      controls.target.copy(r.target);
      controls.autoRotate = r.autoRotate;
      controls.autoRotateSpeed = r.autoRotateSpeed;
      controls.enablePan = r.enablePan;
      controls.update();
      restoreRef.current = null;
    }

    return () => {
      if (restoreRef.current && controls) {
        const r = restoreRef.current;
        controls.target.copy(r.target);
        controls.autoRotate = r.autoRotate;
        controls.autoRotateSpeed = r.autoRotateSpeed;
        controls.enablePan = r.enablePan;
        controls.update();
        restoreRef.current = null;
      }
    };
  }, [isPlaying, isEnabled, camera, controls]);

  if (!isEnabled) return null;

  return (
    <div className="presentation-overlay z-50 absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <div className="presentation-header absolute top-8 left-8 pointer-events-auto">
        <h2 className="premium-title text-3xl font-bold tracking-[0.2em] text-white/90 drop-shadow-md">ORBIN SHOWROOM</h2>
        <span className="premium-subtitle text-xs tracking-widest text-white/60 uppercase mt-2 block">Architectural Proportions &amp; PBR Visualization</span>
      </div>
      <div className="presentation-controls absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 backdrop-blur-xl bg-black/40 p-2 rounded-2xl pointer-events-auto border border-white/10 shadow-2xl">
        <button className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-medium text-sm tracking-wide" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span>{isPlaying ? 'PAUSE CINEMATIC' : 'PLAY CINEMATIC'}</span>
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-transparent text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-all font-medium text-sm tracking-wide" onClick={onToggle}>
          <Maximize2 size={18} />
          <span>EXIT SHOWROOM</span>
        </button>
      </div>
      <div className="architectural-dimensions absolute top-8 right-8 text-right text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase">H: 720mm / W: 600mm</div>
      <div className="architectural-dimensions absolute bottom-8 left-8 text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase">Tolerance: ±0.5mm</div>
    </div>
  );
}
