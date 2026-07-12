import * as THREE from 'three';

// Physically Based Rendering (PBR) Materials library — Orbin
// Fase 1 [2026-07]: veta procedural (bumpMap) para que las superficies de
// madera/melamina dejen de verse como plastico plano. Sin assets externos ni
// red: se genera una sola vez con canvas y se reutiliza (cache de modulo).
// La captura tecnica (plano gris CAD) esconde estos mapas -> Viewer3D
// _stashPBRMaps/_restorePBRMaps, asi el plano queda gris plano, sin veta.

let _grainTex = null;
function getGrainTexture() {
  if (_grainTex) return _grainTex;
  if (typeof document === 'undefined') return null; // SSR / tests: sin canvas
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, S, S); // gris neutro = relieve 0
  for (let x = 0; x < S; x++) {
    const n = 0.5 + 0.5 * Math.sin(x * 0.18) * Math.sin(x * 0.037 + 1.7);
    const v = Math.max(0, Math.min(255, 128 + (n - 0.5) * 46 + (Math.random() - 0.5) * 10));
    ctx.strokeStyle = 'rgb(' + (v | 0) + ',' + (v | 0) + ',' + (v | 0) + ')';
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, S); ctx.stroke();
  }
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * S, y = Math.random() * S, g = 110 + Math.random() * 40;
    ctx.fillStyle = 'rgba(' + (g | 0) + ',' + (g | 0) + ',' + (g | 0) + ',0.22)';
    ctx.fillRect(x, y, 1, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  _grainTex = tex;
  return tex;
}

function applyGrain(mat) {
  const g = getGrainTexture();
  if (!g) return mat;
  mat.bumpMap = g;      // relieve sutil de veta; no altera el color del catalogo
  mat.bumpScale = 0.01;
  return mat;
}

export const getPBRMaterial = (type, colorHex) => {
  const baseColor = new THREE.Color(colorHex);

  switch (type) {
    case 'drawer_front':
    case 'standard_door':
    case 'structural':
    case 'shelf':
    case 'drawer_box':
    case 'drawer_bottom':
    case 'baseboard':
      return applyGrain(new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.65,
        metalness: 0.05,
        clearcoat: 0.1,
        clearcoatRoughness: 0.5,
        transparent: true,
        opacity: 1,
        envMapIntensity: 0.8,
      }));

    case 'countertop':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 1,
        envMapIntensity: 1.2,
      });

    case 'feet':
    case 'hardware':
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.4,
        metalness: 0.8,
        clearcoat: 0.2,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.0,
      });

    default:
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.5,
        metalness: 0.1,
        envMapIntensity: 0.6,
      });
  }
};
