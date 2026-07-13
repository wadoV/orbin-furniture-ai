import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';
import './PresentationMode.css';

// Modo Presentación (cinematic turntable).
// [2026-07] FIX: la cámara ahora orbita alrededor del CENTRO REAL del modelo
// (controls.target = bounding-box center que fija Viewer3D), no del origen del
// mundo. El radio se deriva de la distancia actual cámara↔centro, así el mueble
// queda centrado y bien enmarcado sin importar su tamaño ni su offset.
export default function PresentationMode({ camera, controls, isEnabled, onToggle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);
  const radiusRef = useRef(600);
  const baseYRef = useRef(250);
  const angleRef = useRef(0);

  useEffect(() => {
    if (isEnabled) {
      document.body.classList.add('presentation-active');
    } else {
      document.body.classList.remove('presentation-active');
      setIsPlaying(false);
    }
    return () => document.body.classList.remove('presentation-active');
  }, [isEnabled]);

  useEffect(() => {
    if (!(isPlaying && isEnabled && camera && controls)) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    const target = controls.target;
    // Enmarcado dinámico: radio = distancia actual al centro; base vertical relativa.
    radiusRef.current = Math.max(300, camera.position.distanceTo(target));
    baseYRef.current = Math.max(80, camera.position.y - target.y);
    // Arrancar el ángulo desde la posición actual para no "saltar".
    angleRef.current = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
    const prevAutoRotate = controls.autoRotate;
    controls.autoRotate = false;

    const animate = () => {
      const c = controls.target;                 // centro del mueble (se re-lee por si cambia)
      const r = radiusRef.current;
      angleRef.current += 0.004;                  // velocidad de giro
      const a = angleRef.current;
      const bob = Math.sin(Date.now() * 0.0005) * (r * 0.05); // leve vaivén vertical
      camera.position.x = c.x + Math.sin(a) * r;
      camera.position.z = c.z + Math.cos(a) * r;
      camera.position.y = c.y + baseYRef.current + bob;
      camera.lookAt(c);
      controls.update();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      controls.autoRotate = prevAutoRotate;
    };
  }, [isPlaying, isEnabled, camera, controls]);

  // CORRECCIÓN 1: al dar Play, sube al tope y fuerza resize para que el visor
  // ocupe el marco de Chrome sin dejar hueco arriba ni romper la página abajo.
  const togglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      } catch {}
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="presentation-overlay z-50 absolute inset-0 pointer-events-none overflow-hidden rounded-xl transition-all duration-500 ease-in-out">
      <div className="presentation-header absolute top-8 left-8 pointer-events-auto">
        <h2 className="premium-title text-3xl font-bold tracking-[0.2em] text-white/90 drop-shadow-md">ORBIN SHOWROOM</h2>
        <span className="premium-subtitle text-xs tracking-widest text-white/60 uppercase mt-2 block">Architectural Proportions &amp; PBR Visualization</span>
      </div>
      <div className="presentation-controls absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 backdrop-blur-xl bg-black/40 p-2 rounded-2xl pointer-events-auto border border-white/10 shadow-2xl">
        <button className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all font-medium text-sm tracking-wide" onClick={togglePlay}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span>{isPlaying ? 'PAUSE CINEMATIC' : 'PLAY CINEMATIC'}</span>
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-transparent text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-all font-medium text-sm tracking-wide" onClick={onToggle}>
          <Maximize2 size={18} />
          <span>EXIT SHOWROOM</span>
        </button>
      </div>
      <div className="architectural-dimensions absolute top-8 right-8 text-right text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase">Orbin · Motor Paramétrico</div>
      <div className="architectural-dimensions absolute bottom-8 left-8 text-[10px] font-mono text-white/50 tracking-[0.2em] uppercase">Precisión ±0.5mm · PBR</div>
    </div>
  );
}
