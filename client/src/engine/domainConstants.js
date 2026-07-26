/**
 * Orbin AI — Constantes de dominio del CLIENTE.
 *
 * ★ 2026-07-26: espejo explícito de `server/src/engine/constants.js`.
 *   FUENTE DE VERDAD = el servidor. Este archivo existe porque el cliente no puede
 *   importar el módulo CommonJS del backend, y sin él los valores terminaban
 *   hardcodeados y DESINCRONIZADOS en cada consumidor.
 *
 *   Caso concreto que motivó el archivo: la altura de instalación del aéreo estaba
 *   escrita como 1400 en Viewer3D (×2) y en InputPanel, y como 1450 en offlineParser
 *   y en el motor. La UI mostraba 1400 y el mueble se generaba a 1450.
 *
 *   Si cambiás un valor acá, cambialo también en server/src/engine/constants.js.
 */

// Espejo de constants.js → AEREO
export const AEREO_MOUNT = {
  // KITCHEN_MOUNT_HEIGHT: bancada 900 + vano de trabajo 550.
  // Altura de instalación = piso → borde INFERIOR del mueble.
  DEFAULT: 1450,
  MIN: 400,
  MAX: 2400,
}
