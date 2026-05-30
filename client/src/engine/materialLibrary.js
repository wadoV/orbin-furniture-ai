import * as THREE from 'three';

// Physically Based Rendering (PBR) Materials library
// Provides highly realistic materials for Orbin
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
      // Melamine Matte (Simulación de melamina mate y tapacantos)
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.65, // Melamine is quite rough but has some reflection
        metalness: 0.05,
        clearcoat: 0.1,  // Subtle reflection on top
        clearcoatRoughness: 0.5,
        transparent: true,
        opacity: 1,
        envMapIntensity: 0.8,
        // Fake edge banding (tapacantos) effect using a slightly different color or sheen isn't fully possible with basic settings, but we can make it look good
      });
    
    case 'countertop':
      // Premium Stone/Marble Simulation
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.1, // Shiny
        metalness: 0.1,
        clearcoat: 1.0, // High gloss clearcoat
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 1,
        envMapIntensity: 1.2,
      });

    case 'feet':
    case 'hardware':
      // Metallic Matte Black / Anodized Aluminum
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
