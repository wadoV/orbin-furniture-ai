/**
 * Orbin AI — Material & Hardware Constants
 * Source: rules/parametric_constraints.md
 * ★ SINGLE SOURCE OF TRUTH — generador (closetEngine.js) y validador (validator.js)
 *   leen ESTE archivo. No debe existir una segunda definición de MATERIAL en el motor.
 */

const MATERIAL = {
  THICKNESS_STANDARD: 18,
  THICKNESS_THIN: 15,
  THICKNESS_BACK: 6,
  // ★ RULES 2026-07-22 (diccionario paramétrico industrial):
  //   Espesores de carcasa admitidos. Decisión explícita: se incluye 25 porque es
  //   feature Pro del cliente (mdf_25) y la topología desk usa tampo de 25mm —
  //   el {15,18} literal del diccionario habría matado ambos. Fuera de esta
  //   lista el motor LANZA (basura tipo 12/30/NaN nunca llega al despiece).
  THICKNESS_ALLOWED: [15, 18, 25],
  // Fondo por tipología: aéreo = fondo ESTRUCTURAL atornillado (transmite la
  //   carga al riel de pared) — mínimo 15mm. Muebles de piso = fondo ranurado 3–6mm.
  BACK_AEREO_STRUCTURAL: 15,
  BACK_GROOVED_MIN: 3,
  BACK_GROOVED_MAX: 6,
  PLATE_WIDTH: 2750,   // regla dura CLAUDE.md (chapa MDF/MDP)
  PLATE_HEIGHT: 1840,  // regla dura CLAUDE.md
  SAW_KERF: 3.2,       // kerf de sierra fina (unificado con el motor de nesting)
  NESTING_MARGIN: 50,  // margen de aprovechamiento por lado (preserva umbral de split del motor)
}

const EDGE_BANDING = {
  THIN_PVC: 0.45,
  THICK_PVC: 2.0,
  ABS: 2.0,
}

const HARDWARE = {
  // ── Corrediças telescópicas ──────────────────────────────────────────────
  DRAWER_SLIDE_PER_SIDE: 13,   // usado por validator.js (folga por lado)
  DRAWER_SLIDE_TOTAL: 26,      // usado por validator.js (13mm × 2 lados)
  SLIDE_CLEARANCE: 13,         // alias usado por closetEngine.js (= DRAWER_SLIDE_PER_SIDE)
  // ★ 2026-07-20 (auditoría estructural): longitudes comerciales de corredera
  //   telescópica (mm). NO existe herraje por debajo de 250mm: si el fondo útil
  //   no alcanza 250, la gaveta NO es fabricable (no se debe emitir caja).
  // ★ RULES 2026-07-22: catálogo comercial real de correderas telescópicas (+270,
  //   medida estándar de catálogo que faltaba).
  SLIDE_LENGTHS: [250, 270, 300, 350, 400, 450, 500, 550, 600],
  SLIDE_LENGTH_MIN: 250,
  DRAWER_BOX_REAR_GAP: 20,     // holgura histórica (legacy, ver DRAWER_REAR_CLEARANCE)
  // ★ RULES 2026-07-22 — despeje de profundidad PRECISO (sustituye al 20 mágico):
  //   despeje = T(frente) + fondoEfectivo(Tb + ranura si grooved) + holgura trasera 10.
  //   El modelo viejo (D − Tb − 20) IGNORABA el frente: caja 550 + fondo 6 + holgura +
  //   frente 18 = 584 > 580 → la caja pisaba 4mm el frente. Interferencia real.
  DRAWER_REAR_CLEARANCE: 10,
  // ── Fondos ranurados ─────────────────────────────────────────────────────
  BACK_GROOVE_DEPTH: 6,
  BACK_GROOVE_FROM_EDGE: 20,
  // ── Estantes ─────────────────────────────────────────────────────────────
  SHELF_CLEARANCE_PER_SIDE: 1,
  SHELF_FRONT_SETBACK: 5,
  // ── Gavetas (frente) ─────────────────────────────────────────────────────
  DRAWER_FRONT_GAP_PERIMETER: 2, // folga perimetral total (validator / referencia)
  DRAWER_FRONT_GAP: 2,           // folga por lado del frente de gaveta (usado por closetEngine.js)
  // ── Puertas ──────────────────────────────────────────────────────────────
  DOOR_GAP_W_TOTAL: 5,         // folga horizontal TOTAL del vano de puerta (referencia)
  DOOR_GAP_W: 2.5,             // folga por HOJA de puerta (usado por closetEngine.js) — NO es el total
  DOOR_GAP_H: 4,               // folga vertical de puerta (compartida engine/validator)
  // ── Otros ────────────────────────────────────────────────────────────────
  RECESO_TECNICO: 50,          // receso técnico del motor (actualmente sin uso, conservado)
}

const STRUCTURAL_LIMITS = {
  MAX_SHELF_SPAN: 900,
  MAX_MODULE_HEIGHT: 2600,
  BASEBOARD_MIN_HEIGHT: 60,
  BASEBOARD_MAX_HEIGHT: 150,
  // ★ 2026-07-20: `BASEBOARD_SETBACK_MIN/MAX` eliminados — declarados y NUNCA
  //   consumidos (mismo patrón que SLIDE_GAP). El recuo vive ahora en BASEBOARD.INSET,
  //   que sí es la fuente única que lee el motor.
  DRAWER_TOP_CLEARANCE: 16,
  DRAWER_BACK_CLEARANCE: 50,
  // ★ 2026-10-15: ancho máximo de UNA caja de gaveta sobre corredera telescópica comercial.
  //   >1000 se desaconseja (flecha/alabeo del frente); >1200 no existe herraje que lo soporte.
  DRAWER_BOX_WIDTH_WARN: 1000,
  DRAWER_BOX_WIDTH_MAX: 1200,
}

// ── RODAPIÉ / ZÓCALO (sóculo) — SSOT universal de mueble de piso ─────────────
// ★ 2026-07-20. Referencias de marcenaria confirmadas:
//   · Altura del sóculo: 100–150mm (estándar BR). Toe kick US: 3.5–4" ≈ 89–100mm.
//     → DEFAULT_HEIGHT 100mm cae en el consenso de ambos mercados.
//   · Recuo (inset): estándar BR 10–15 CM = 100–150mm. Mínimo ergonómico US 3" = 76mm;
//     por debajo de eso el toe kick deja de cumplir su función (el pie no entra).
//     → INSET 100mm. El motor usaba 50mm, por DEBAJO del piso ergonómico.
//   · Espesor: el del propio carcasa (T) — no se define aquí a propósito.
// SEMÁNTICA DE ALTURA (decisión 2026-07-20): H es la altura TOTAL e INCLUYE el
//   rodapié → structuralHeight = H − BH. Pedir 870mm devuelve un mueble de 870mm.
//   El rodapié consume espacio interior, NO se suma a H. Cero regresión.
// ── PANEL VISTA / FIJACIÓN (2026-07-22, diccionario paramétrico) ─────────────
// SEPARACIÓN ORTOGONAL: `panelVista` es GEOMETRÍA (tapatornillos interiores de
// 15mm que reducen el ancho neto Nw de las piezas horizontales); `fijacion` es
// HERRAJE (minifix/espiga/tornillo visto) y NUNCA altera Nw. El vano interior
// Vw = W − 2T es geometría pura y no depende de ninguno de los dos.
const PANEL_VISTA = {
  THICKNESS: 15,               // espesor del panel vista (diccionario: 30mm ambos / 15mm uno)
  MODES: ['ninguno', 'uno', 'ambos'],
  FIJACIONES: ['minifix', 'espiga', 'tornillo_visto'],
}

const BASEBOARD = {
  DEFAULT_HEIGHT: 100,      // altura por defecto del zócalo (mm)
  INSET: 100,               // recuo frontal/trasero desde la cara del mueble (mm)
  INSET_ERGONOMIC_MIN: 76,  // 3" — por debajo el toe kick no funciona (referencia)
  MIN_HEIGHT: 60,
  MAX_HEIGHT: 150,
  // Holgura mínima entre zócalo frontal y trasero. Si el fondo no da para
  // 2×INSET + esto, el recuo se reduce (ver clampInset en closetEngine.js):
  // sin este guard, en muebles poco profundos el zócalo frontal quedaba DETRÁS
  // del trasero (geometría invertida).
  MIN_INNER_GAP: 50,
}

// AEREO: Wall-mounted cabinet constraints (ABNT ergonomic guidelines). All values in mm.
// NEW in Orbin v4.7
const AEREO = {
  KITCHEN_MOUNT_HEIGHT: 1450,
  KITCHEN_MIN_CLEARANCE_ABOVE_COUNTER: 450,
  BATHROOM_MOUNT_HEIGHT: 1000,
  LIVING_MOUNT_HEIGHT: 1200,
  BEDROOM_HEADBOARD_HEIGHT: 800,
  MIN_MOUNT_HEIGHT: 400,
  MAX_MOUNT_HEIGHT: 2400,
  KITCHEN_HEIGHT_MIN: 300,
  KITCHEN_HEIGHT_MAX: 800,
  KITCHEN_DEPTH_STANDARD: 320,
  KITCHEN_DEPTH_MIN: 250,
  KITCHEN_DEPTH_MAX: 400,
  BATHROOM_DEPTH_MAX: 180,
  LIVING_DEPTH_STANDARD: 300,
  LIVING_DEPTH_MAX: 450,
  WALL_PLUG_MIN: 2,
  WALL_PLUG_SPACING_MIN: 400,
  WALL_PLUG_RATED_LOAD_KG: 40,
  WALL_PLUG_DRYWALL_LOAD_KG: 15,
  HIDDEN_RAIL_WEIGHT_THRESHOLD_KG: 15,
  BACK_PANEL_REQUIRED: true,
  PLUG_SPACING_PER_MM: 600,
}

// ── GAVETAS: SISTEMA MAESTRO (PADRÃO BRASIL 2026-10-13) ────────────────────────
// Constantes industriales para el sistema blindado de gavetas.
const DRAWER_SYSTEM = {
  // Holgura de correderas telescópicas (ya existe en HARDWARE, pero centralizado aquí también)
  HARDWARE_CLEARANCE_PER_SIDE: 13,  // mm (13mm × 2 = 26mm total)
  HARDWARE_CLEARANCE_TOTAL: 26,     // mm netos

  // Profundidades comerciales de caja (snap al paso inferior más cercano)
  BOX_DEPTH_STEPS: [250, 300, 350, 400, 450, 500, 550],

  // Holgura mínima entre caja y fondo del mueble
  BOX_REAR_CLEARANCE_MIN: 50,       // mm

  // Holgura perimetral en frentes (junta/luz limpia entre frentes)
  FRONT_GAP_PER_SIDE: 1.5,          // mm (3mm de junta neta entre frentes)

  // Construcción de fondos de gaveta
  BOTTOM_GROOVE_THICKNESS: 6,       // mm (fondo ranurado default)
  BOTTOM_GROOVE_INSET: 10,          // mm (ranura a 10-12mm del borde inferior)
  BOTTOM_GROOVE_DEPTH: 8,           // mm (entrada de ranura en laterales/testeras)
  BOTTOM_SCREWED_THICKNESS: 15,     // mm (fondo estructural atornillado)

  // Cava 45° en gavetas
  CAVA_GRIP_CLEARANCE: 30,          // mm (luz libre de agarre)
  CAVA_BACK_RAIL_MIN_HEIGHT: 50,    // mm (travesaño vertical de respaldo mínimo)

  // Cava CNC (gavetas internas embutidas)
  CNC_POCKET_WIDTH: 140,            // mm (rebajo central en U)
  CNC_POCKET_DEPTH: 35,             // mm
  CNC_POCKET_RADIUS: 20,            // mm (R de las esquinas)

  // Retranqueos para gavetas internas tras puertas
  SETBACK_HINGED_DOORS: 20,         // mm (puertas batientes)
  SETBACK_SLIDING_DOORS: 80,        // mm (puertas de correr riel doble)

  // Altura mínima de frente viable
  MIN_FRONT_HEIGHT: 80,             // mm

  // Altura de caja = frente - 40mm (snap a herraje comercial)
  BOX_HEIGHT_DEDUCTION: 40,         // mm
}

// ── ALINEACIÓN DE GAVETAS POR TIPOLOGÍA ────────────────────────────────────────
const DRAWER_STACK_ALIGNMENT = {
  // Cocinas/Base: gavetas arriba, pegadas a la encimera
  base: 'top',
  // Clósets/Roperos: gavetas abajo
  standard: 'bottom',
  // Escritorios: confinadas al pedestal
  desk: 'pedestal',
  // Aéreos: no aplica (sin gavetas típicamente)
  aereo: 'bottom',
}

const DEFAULTS = {
  type: 'closet',
  width: 2400,
  height: 2400,
  depth: 600,
  thickness: 18,
  backThickness: 6,
  numShelves: 2,
  numDrawers: 0,
  drawerHeight: 180,
  hasDoors: false,
  doorType: 'none',
  edgeBandingType: 'thin',
  baseboard: true,
  baseboardHeight: 100,
  numDividers: 0,
  materialBody: 'oak_light',
  materialFront: 'oak_light',
  handleType: 'standard',
  hasCountertop: false,
  countertopMaterial: 'none',
  hasLED: false,
  // ★ 2026-07-26: era el literal 1400 (y AEREO.KITCHEN_MOUNT_HEIGHT decía 1450 → GET
  //   /defaults servía un número y el motor generaba con otro). Ahora `null` = NO
  //   ESPECIFICADO, igual que closetEngine.DEFAULTS.
  //   NO poner acá el 1450: este objeto siembra el resultado de nlParser y de
  //   GET /defaults para TODOS los tipos → un ropero heredaría altura de instalación
  //   1450 y el plano de conjunto lo dibujaría FLOTANDO. El 1450 es exclusivo del
  //   auto-default del aéreo (closetEngine, bloque INVARIANTE).
  mountHeight: null,
  drawerPrivacyPanel: true,
  drawerRailHeight: 50,
  // ★ ADITIVO 2026-10-13 — Sistema maestro de gavetas
  drawerFrontStyle: 'flat',
  drawerDistributionMode: 'equal',
  drawerFrontHeights: null,         // Array mixto de enteros y 'rest', null = equal
  drawerStackAlignment: 'auto',     // 'auto' | 'top' | 'bottom'
  drawerBottomStyle: 'grooved_6mm', // 'grooved_6mm' | 'screwed_15mm'
}

module.exports = { MATERIAL, EDGE_BANDING, HARDWARE, STRUCTURAL_LIMITS, BASEBOARD, PANEL_VISTA, DEFAULTS, AEREO, DRAWER_SYSTEM, DRAWER_STACK_ALIGNMENT }
