import * as THREE from 'three';

// PBR Materials library — Orbin
// Fase 1.5 [2026-07]: madera/melamina con veta procedural en DOS mapas —
//   • map (albedo): variación tonal fina de la veta sobre el color del catálogo.
//   • bumpMap: relieve sutil del poro.
// Sin assets externos ni red: se generan una vez con canvas y se cachean.
// Capture-safe: Viewer3D._stashPBRMaps anula map/bumpMap/roughnessMap durante
// la captura del plano (gris CAD), así el plano queda liso sin veta.

let _bumpTex = null;
function getBumpTexture() {
  if (_bumpTex) return _bumpTex;
  if (typeof document === 'undefined') return null;
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
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 4;
  _bumpTex = t; return t;
}

// Albedo: casi blanco (0.82–1.0) para MODULAR el color del catálogo sin cambiar
// el tono. Vetas verticales tenues + poros → grano tonal realista.
let _albedoTex = null;
function getAlbedoTexture() {
  if (_albedoTex) return _albedoTex;
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x++) {
    const n = 0.5 + 0.5 * Math.sin(x * 0.13 + 0.6) * Math.sin(x * 0.041);
    // rango ~210–255 → modula el color ±8% aprox.
    const v = Math.max(240, Math.min(255, 250 + (n - 0.5) * 16 + (Math.random() - 0.5) * 5)); // ~2-6% modulación: grano sin cambiar el tono
    ctx.strokeStyle = 'rgb(' + (v | 0) + ',' + (v | 0) + ',' + (v | 0) + ')';
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, S); ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S, y = Math.random() * S, g = 236 + Math.random() * 16;
    ctx.fillStyle = 'rgba(' + (g | 0) + ',' + (g | 0) + ',' + (g | 0) + ',0.12)';
    ctx.fillRect(x, y, 1, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace; // albedo → sRGB
  _albedoTex = t; return t;
}

function applyGrain(mat) {
  const bump = getBumpTexture();
  const albedo = getAlbedoTexture();
  if (albedo) mat.map = albedo;          // grano tonal sobre el color del catálogo
  if (bump) { mat.bumpMap = bump; mat.bumpScale = 0.012; } // relieve del poro
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
      // Melamina mate + veta (albedo + bump). Clearcoat sutil = reflejo de laca.
      return applyGrain(new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.62,
        metalness: 0.04,
        clearcoat: 0.14,
        clearcoatRoughness: 0.45,
        transparent: true,
        opacity: 1,
        envMapIntensity: 0.9,
      }));

    case 'countertop':
      // Piedra / mármol pulido (sin veta de madera).
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
      // Metal anodizado / negro mate.
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
