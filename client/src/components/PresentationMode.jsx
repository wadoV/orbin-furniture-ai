import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Play, Pause, Maximize2 } from 'lucide-react';
import './PresentationMode.css';

export default function PresentationMode({ camera, controls, isEnabled, onToggle }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);
  const curveRef = useRef(null);
  const progressRef = useRef(0);

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
    if (!camera || !controls) return;
    const p0 = new THREE.Vector3(400, 300, 500);
    const p1 = new THREE.Vector3(-300, 150, 400);
    const p2 = new THREE.Vector3(-400, 100, -200);
    const p3 = new THREE.Vector3(200, 200, -400);
    curveRef.current = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
  }, [camera, controls]);

  useEffect(() => {
    if (isPlaying && isEnabled) {
      const animateCamera = () => {
        if (!curveRef.current || !camera || !controls) return;
        progressRef.current += 0.001;
        if (progressRef.current > 1) progressRef.current = 0;
        const point = curveRef.current.getPointAt(progressRef.current);
        camera.position.lerp(point, 0.05);
        
        const time = Date.now() * 0.0005;
        const radius = 600;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.position.y = 250 + Math.sin(time * 0.5) * 50;

        controls.update();
        animationRef.current = requestAnimationFrame(animateCamera);
      };
      animationRef.current = requestAnimationFrame(animateCamera);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isEnabled, camera, controls]);

  if (!isEnabled) return null;

  return (
    <div className="presentation-overlay z-50 absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <div className="presentation-header absolute top-8 left-8 pointer-events-auto">
        <h2 className="premium-title text-3xl font-bold tracking-[0.2em] text-white/90 drop-shadow-md">ORBIN SHOWROOM</h2>
        <span className="premium-subtitle text-xs tracking-widest text-white/60 uppercase mt-2 block">Architectural Proportions & PBR Visualization</span>
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
