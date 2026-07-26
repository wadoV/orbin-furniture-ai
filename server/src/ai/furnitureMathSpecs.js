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

  // ── TAMPONADO / TAPATORNILLOS (2026-07-20) ────────────────────────────────
  // SEMÁNTICA: el ancho pedido W es el ancho ACABADO — incluye los paneles
  // tapatornillos. La carcasa se descuenta para que el mueble instalado mida
  // exactamente W (crítico en vanos de obra):
  //   carcassWidth = W − (ladosConTampón × espesorTampón)
  // Manual del taller: 900mm acabado con tampón de 9mm/lado → carcasa 882mm.
  // Con tampón de MDF 15 (default = espesor de carcasa) → 870mm.
  // Sin tamponado (sides=0) devuelve W intacto — cero regresión.
  tamponado: {
    carcassWidth: (finishedWidth, sides, tampThickness) =>
      finishedWidth - (sides * tampThickness),
    sidesFor: (tamponado) =>
      tamponado === 'both' ? 2 : ((tamponado === 'left' || tamponado === 'right') ? 1 : 0)
  },

  // ── MOLDURA FRONTAL (2026-07-20, opt-in vía cfg.frontMolding) ─────────────
  // Con moldura/taponamiento frontal que define la profundidad acabada D:
  //   laterales = D − molding (ej. 600 → 580)
  //   base/techo/repisas = D − 2×molding (ej. 600 → 560)
  frontMolding: {
    DEFAULT_DEPTH: 20,
    lateralDepth:    (carcassDepth, molding = 20) => carcassDepth - molding,
    horizontalDepth: (carcassDepth, molding = 20) => carcassDepth - (2 * molding)
  },

  // ── ESCRITORIOS (2026-07-22) ──────────────────────────────────────────────
  // Reglas de la topología desk. El faldón (modesty panel) rigidiza el vano
  // pegado BAJO el tampo: alto = 35% del lateral, acotado a [150, 300]mm.
  desk: {
    DEFAULT_HEIGHT: 750,
    DEFAULT_DEPTH: 600,
    // ★ 2026-07-23: faldón/modesty panel DISCRETO (antes 35% del lateral = ~256mm,
    //   dominaba el vano como una pared). Estándar de escritorio: tira de ~100-120mm
    //   bajo el tampo, suficiente para rigidez/privacidad sin tapar las piernas.
    apronHeight: (latH) => Math.min(140, Math.max(90, Math.round(latH * 0.15))),
    // Vano de piernas: con pedestal se descuenta su ancho + 1 costado;
    // escritorio simple = vano completo entre laterales.
    kneeSpan: (W, T, pedestalWidth = 0) =>
      pedestalWidth > 0 ? W - pedestalWidth - T : W - (2 * T)
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