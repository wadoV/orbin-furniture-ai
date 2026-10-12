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
  edgeThicknessOptions: [0.4, 1, 2],

  // ── REGLAS CONSTRUCTIVAS DE COCINA VALIDADA EN TALLER (2026-10) ──────────
  kitchen: {
    // 1. Muebles Base con Encimera/Piedra:
    // Suprimir techo macizo; incorporar travesaños de amarre en L
    countertopTieStrips: {
      frontVerticalRipa: 50,    // mm (anti-visión de luz de cava)
      frontHorizontalRipa: 100, // mm (asiento plano de piedra)
      rearHorizontalRipa: 100,  // mm (travesaño trasero horizontal)
    },
    // Puxador Cava 45°:
    cava45: {
      lightGapUnderCountertop: 30, // mm (luz superior libre bajo encimera)
      backSupportRipa: 50,         // mm (travesa vertical de respaldo detrás de cada cava)
    },
    // Gavetero:
    drawerUnit: {
      frontTieStripsCount: 3,     // 3 travesas verticales frontales de 50mm entre frentes
      frontTieStripWidth: 50,      // mm
      slideClearanceTotal: 26,     // mm netos (13mm por lado)
      slideClearancePerSide: 13,   // mm
      drawerBackThickness: 6,      // mm
    },
    // Fondos:
    backPanels: {
      sinkRearTieStrips: 100,      // mm (travesaños posteriores de 100mm en fregadero)
      drawerBackThickness: 6,      // mm (fondo de 6mm en gavetero)
      aereoBackThickness: 15,      // mm (fondo estructural de 15mm en aéreos)
    },
    // Holguras perimetrales:
    clearances: {
      perimeterGapPerSide: 1.5,    // mm por lado
      contiguousModuleJoint: 3.0,  // mm de junta neta entre módulos contiguos
    },
    // 2. Muebles Aéreos y Nicho:
    aereo: {
      baseboardPieces: 0,          // Invariante obligatoria: baseboard_pieces = 0
      structuralBackThickness: 15, // Fondo estructural de 15 mm atornillado a los 4 cantos
      doorOverhangDown: 15,        // mm sobrepasando el tamponado inferior para apertura limpia
      tamponadoTopClearance: 3,    // mm de holgura superior
      defaultMountHeight: 1450,    // mm altura de montaje en Y
    },
    // Nicho de microondas:
    microwaveNiche: {
      width: 600, height: 400, depth: 350,
      piecesCount: 4,              // caja abierta de 4 piezas
      finish: 'oak_light',
      backThickness: 15,           // fondo de 15 mm
    }
  },

  // ── CARPINTERÍA DETERMINISTA (2026-10-12) ─────────────────────────────────
  // Funciones PURAS: sin I/O, sin estado, NUNCA lanzan. Entrada inválida (NaN,
  // negativos, undefined) se sanea a un valor seguro y se informa en `adjustments`.
  // Fuente de las reglas: definiciones constructivas confirmadas por el taller
  // (briefing 2026-10-12). Todo lo que consuma closetEngine pasa por acá, para
  // que la matemática viva en UN solo lugar y tenga test unitario.
  carpentry: (() => {
    const CONST = {
      CAVA_TOP_CLEARANCE: 30,        // mm: luz de agarre bajo el tampo / entre frentes
      CAVA_RAIL_MIN_HEIGHT: 50,      // mm: altura mínima de la traviesa de respaldo
      AEREO_OVERHANG_WITH_TAMPON: 15,// mm: la puerta rebasa el tamponado inferior
      AEREO_OVERHANG_NO_TAMPON: 30,  // mm: la puerta rebasa la base (sin tamponado)
      AEREO_TOP_CLEARANCE: 3,        // mm: holgura perimetral superior contra techo
      SLIDING_KIT_DEDUCTION: 35,     // mm: descuento vertical del kit comercial
      SLIDING_ENGINE_OVERLAP: 100,   // mm: traslape VIGENTE en el motor (commit ea01aaf)
      SLIDING_WORKSHOP_OVERLAP: 30,  // mm: traslape central indicado por el taller
      SLIDING_RAIL_SETBACK: 80,      // mm: retranqueo interno de divisiones
      TIE_RAIL_HEIGHT: 50,           // mm: amarre superior de módulos bajos
      OVEN_NICHE_HEIGHT: 600,        // mm: luz libre sobre la repisa para el horno
      FALSE_DOOR_GAP: 4,             // mm: holgura vertical de la puerta falsa
    }
    const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d
    const pos = (v, d) => { const n = fin(v, d); return n > 0 ? n : d }

    return {
      ...CONST,

      /**
       * Cava 45° en módulo bajo (puerta batiente).
       *   altoHoja = altoNominal − 30 mm  (luz libre bajo el tampo)
       *   traviesa de respaldo: alto ≥ 50 mm, largo = vano interior.
       */
      cavaOffsets(args) {
        const { nominalH, internalWidth, clearance, railHeight } = args || {}
        const adjustments = []
        const nom = Math.max(0, fin(nominalH, 0))
        const clr = Math.max(0, fin(clearance, CONST.CAVA_TOP_CLEARANCE))
        let rail = fin(railHeight, CONST.CAVA_RAIL_MIN_HEIGHT)
        if (rail < CONST.CAVA_RAIL_MIN_HEIGHT) {
          adjustments.push({ code: 'CAVA_RAIL_RAISED', severity: 'info', field: 'alturaTraviesaCava',
            requested: rail, applied: CONST.CAVA_RAIL_MIN_HEIGHT,
            message: `La traviesa de respaldo de la cava no puede ser menor a ${CONST.CAVA_RAIL_MIN_HEIGHT}mm. Se ajustó de ${rail}mm a ${CONST.CAVA_RAIL_MIN_HEIGHT}mm.` })
          rail = CONST.CAVA_RAIL_MIN_HEIGHT
        }
        const leafH = Math.max(0, nom - clr)
        return { leafH, clearance: clr, rail: { width: Math.max(0, fin(internalWidth, 0)), height: rail }, adjustments }
      },

      /**
       * Centro Y de una traviesa horizontal cuyo borde SUPERIOR apoya en `topY`
       * (cara inferior del techo / del travesaño superior).
       */
      railCenterY: (topY, railHeight) => fin(topY, 0) - fin(railHeight, CONST.CAVA_RAIL_MIN_HEIGHT) / 2,

      /**
       * Puerta de aéreo con cava inferior (sin tirador).
       *   con tamponado inferior → voladizo 15 mm · sin tamponado → 30 mm
       *   altoHoja  = H_carcasa + voladizo − 3 mm (luz superior)
       *   H_tampon  = H_carcasa + voladizo (tamponados laterales acompañan la puerta)
       * `overhangOverride` (>0) manda sobre la regla.
       */
      aereoCavaDoor(args) {
        const { carcassH, bottomTamponado, topClearance, overhangOverride } = args || {}
        const H = Math.max(0, fin(carcassH, 0))
        const overhang = pos(overhangOverride, bottomTamponado === false
          ? CONST.AEREO_OVERHANG_NO_TAMPON : CONST.AEREO_OVERHANG_WITH_TAMPON)
        const top = Math.max(0, fin(topClearance, CONST.AEREO_TOP_CLEARANCE))
        return { overhang, leafH: Math.max(0, H + overhang - top), tamponLateralH: H + overhang }
      },

      /** Puerta corredera: alto de hoja = vano libre vertical − 35 mm (kit comercial). */
      slidingLeafHeight: (freeVerticalSpan, kit) =>
        Math.max(0, fin(freeVerticalSpan, 0) - fin(kit, CONST.SLIDING_KIT_DEDUCTION)),

      /** Ancho de cada hoja corredera: (vano + (n−1)·traslape) / n. */
      slidingSheetWidth(span, sheets, overlap) {
        const n = Math.max(1, Math.min(4, Math.floor(fin(sheets, 2))))
        const ov = Math.max(0, fin(overlap, CONST.SLIDING_ENGINE_OVERLAP))
        return Math.round((Math.max(0, fin(span, 0)) + (n - 1) * ov) / n)
      },

      /**
       * Tamponado exterior de una batería de módulos contiguos: SOLO esquinas
       * exteriores. 1er cuerpo → 'left' · último → 'right' · uniones → 'none'.
       * Un módulo aislado (count < 2) no tiene unión que decidir → 'none'.
       */
      batteryTamponado(index, count) {
        const n = Math.floor(fin(count, 1)), i = Math.floor(fin(index, 0))
        if (n < 2 || i < 0 || i >= n) return 'none'
        return i === 0 ? 'left' : (i === n - 1 ? 'right' : 'none')
      },

      /**
       * Módulo de horno: repisa estructural + puerta falsa (panel fijo sobrepuesto)
       * que cubre la zona BAJO la repisa. La repisa deja `ovenNiche` mm libres
       * hasta el techo (o hasta el travesaño superior).
       *
       * ★ REGLA TALLER 2026-10-12: La puerta falsa es un panel sobrepuesto con
       *   descuento ESTRICTO de 3mm en los 4 costados respecto al vano libre:
       *   Ancho_falsa = Vano_W - 6mm  (3 izq + 3 der)
       *   Alto_falsa  = Vano_H - 6mm  (3 sup + 3 inf)
       * @param ceilingY  Y de la cara inferior del techo / travesaño (mm)
       * @param floorY    Y de la cara superior del piso interior (mm)
       * @returns {{ ok, shelf?, falseDoor?, adjustments }} ok=false si no hay espacio
       */
      ovenLayout(args) {
        const { ceilingY, floorY, baseY, thickness, width, ovenNiche } = args || {}
        const T = pos(thickness, 18)
        const niche = pos(ovenNiche, CONST.OVEN_NICHE_HEIGHT)
        const ceil = fin(ceilingY, 0), floor = fin(floorY, 0), base = fin(baseY, floor)
        const shelfTopY = ceil - niche
        const adjustments = []
        // Mínimo 100 mm bajo la repisa para que la puerta falsa tenga sentido.
        if (shelfTopY - T - floor < 100) {
          adjustments.push({ code: 'OVEN_NO_ROOM', severity: 'warning', field: 'ovenPanel', niche,
            message: `No hay altura para un nicho de horno de ${niche}mm más repisa y puerta falsa. Aumentá la altura del módulo o reducí el rodapié. Se omitió la puerta falsa.` })
          return { ok: false, adjustments }
        }
        const doorBottom = base + CONST.FALSE_DOOR_GAP / 2
        const doorTop = shelfTopY - T
        adjustments.push({ code: 'OVEN_NICHE_ASSUMED', severity: 'info', field: 'ovenNicheHeight',
          assumed: niche,
          message: `Se asumió un nicho de horno de ${niche}mm libres sobre la repisa estructural. La puerta falsa cubre la zona bajo la repisa. Podés cambiarlo con ovenNicheHeight.` })
        return {
          ok: true,
          shelf: { centerY: shelfTopY - T / 2, thickness: T, topY: shelfTopY },
          falseDoor: { width: Math.max(0, fin(width, 0) - 6), height: Math.max(0, doorTop - doorBottom),
                       centerY: (doorTop + doorBottom) / 2 },
          adjustments,
        }
      },
    }
  })()
};