/**
 * Mathematical specifications for furniture calculations
 * Single Source of Truth for Orbin AI
 *
 * ★ SSOT FIX 2026-07-20: este archivo HARDCODEABA `internalSpan - 26` (holgura de
 *   corredera). Era una SEGUNDA fuente de verdad: cambiar HARDWARE.DRAWER_SLIDE_TOTAL
 *   en constants.js NO propagaba al motor, que consume estas fórmulas. Es el mismo
 *   patrón que causó el P0 de "ley de chapa" (2026-07-19) y el P0 de profundidad de
 *   caja (2026-07-20). Ahora los valores se LEEN de constants.js.
 *   Las fórmulas son idénticas — refactor puramente estructural, sin cambio numérico.
 */
const { HARDWARE, MATERIAL, EDGE_BANDING } = require('../engine/constants')

module.exports = {
  // Calculates internal usable space
  internalSpan: (totalWidth, thickness) => totalWidth - (2 * thickness),

  // Drawer box calculations
  drawerBox: {
    // Net width of drawer box — descuenta la holgura TOTAL de corredera telescópica
    // (13mm por lado × 2 = 26mm). Valor desde SSOT: HARDWARE.DRAWER_SLIDE_TOTAL.
    netWidth: (internalSpan) => internalSpan - HARDWARE.DRAWER_SLIDE_TOTAL,

    // Drawer side length based on rail length
    sideLength: (railLength) => railLength,

    // Drawer front/back headers
    headerWidth: (netWidth, drawerThickness) => netWidth - (2 * drawerThickness)
  },

  // Back panel calculations
  backPanels: {
    // Grooved back width
    // ⚠ NO usar HARDWARE.BACK_GROOVE_DEPTH (=6) como default aquí: son magnitudes
    //   distintas. Ese 6 es la profundidad de la ranura en el canto; el 8 es el
    //   default histórico del motor (`cfg.grooveDepth || 8`). Cambiarlo alteraría
    //   el ancho del fondo ranurado en silencio.
    groovedWidth: (internalSpan, grooveDepth = 8) => internalSpan + (2 * grooveDepth),

    // Groove position from back
    groovePosition: (thickness) => thickness + 5,

    // Nailed back width
    nailedWidth: (totalWidth) => totalWidth - 2
  },

  // Edge banding compensation
  edgeBanding: (baseSize, edgeThickness) => baseSize - edgeThickness,

  // Side panel height calculation (deducts base thickness, top thickness if overlay, and baseboard height)
  calculatePanelHeight: (totalHeight, baseThickness = 0, topThickness = 0, baseboardHeight = 0) =>
    totalHeight - baseThickness - topThickness - baseboardHeight,

  // Standard thickness values
  thicknessOptions: [15, 18],

  // Standard edge thickness values
  edgeThicknessOptions: [0.4, 1, 2]
};