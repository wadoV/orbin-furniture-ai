/**
 * Orbin AI — NLP → Parametric Param Contract  (ADITIVO, 2026-07-20)
 * ─────────────────────────────────────────────────────────────────────────────
 * SSOT del "handshake" entre el LLM y closetEngine.js.
 *
 * Problema que resuelve:
 *   El LLM devolvía llaves libres (hasHangingArea, hasLED, W/H/D, "2.4m", strings
 *   en campos numéricos). El motor sólo lee un set FIJO de llaves → los extras se
 *   ignoraban en silencio y los faltantes caían a DEFAULTS sin avisar al cliente.
 *
 * Este módulo NO reescribe el orquestador: es una capa de saneamiento que se
 * aplica DESPUÉS del LLM y ANTES del motor.
 *   1. ENGINE_PARAM_KEYS  → whitelist exacta (derivada de closetEngine.js).
 *   2. KEY_ALIASES        → mapea lo que el LLM tiende a inventar a la llave real.
 *   3. coerceEngineParams → coacciona tipos, aplica defaults comerciales de
 *      marcenaria y REGISTRA cada supuesto en specAdjustments (nunca en silencio).
 *   4. PARAM_CONTRACT_PROMPT → el mismo contrato en texto, inyectado al system prompt.
 */

// ─── 1. Whitelist: llaves REALMENTE leídas por closetEngine.js ────────────────
const ENGINE_PARAM_KEYS = [
  'moduleType', 'width', 'height', 'depth', 'thickness', 'backThickness',
  'numShelves', 'numDrawers', 'numDividers', 'numDoors',
  'hasDoors', 'doorType', 'doorStyle', 'doorFinish',
  'drawerHeight', 'drawerLayout', 'drawerColumns',
  'baseboard', 'baseboardHeight', 'baseType', 'legHeight',
  'hasCountertop', 'countertopMaterial', 'topStyle', 'backStyle', 'alturaTraviesaCava', 'slidingDoorSheets', 'puxadorCava45',
  'hasHangingRod', 'hasLed', 'nicheHeight', 'tamponado', 'tamponadoThickness', 'frontMolding', 'panelVista', 'fijacion', 'grooveDepth',  'pedestalWidth', 'hasPedestal', 'puxadorCava45', 'pedestalSide', 'drawerPrivacyPanel', 'drawerRailHeight',
  'handleType', 'edgeBandingType', 'materialBody', 'materialFront',
  'mountHeight', 'type',
  // ★ ADITIVO 2026-10-11: llaves para cocinas modulares
  'subType',           // 'oven_cavity' | 'sink' | 'drawer_bank' | 'open_niche'
  'compositionId',     // UUID de la composición padre (kitchenComposition)
  'positionIndex',     // orden dentro de la composición (0 = más a la izquierda)
  'line',              // 'base' | 'wall'  — línea de instalación
  'cavaOverhang',      // mm de extensión inferior del frente para tirador cava (30mm típico)
  'puxadorCavaAereo',  // boolean: aéreo con puxador cava inferior
  'crossbeamHeight',   // altura del travesaño de amarre (módulo bacha) en mm
  // ★ ADITIVO 2026-10-12: params para auditoría CEO
  'topTieRails',       // boolean: travesaños entre gavetas
  'tieRailHeight',     // mm de altura de cada travesaño inter-gaveta (default 50)
  'tamponadoInferior', // boolean: cierre inferior aéreo (tapa abajo)
  'ovenPanel',         // boolean: puerta falsa (panel sobrepuesto) en módulo horno
]

// ─── 2. Alias → llave canónica del motor ─────────────────────────────────────
const KEY_ALIASES = {
  // dimensiones abreviadas
  W: 'width', w: 'width', largura: 'width', ancho: 'width',
  H: 'height', h: 'height', altura: 'height', alto: 'height',
  D: 'depth', d: 'depth', profundidade: 'depth', fondo: 'depth', profundidad: 'depth',
  // divergencias históricas prompt ↔ motor
  hasHangingArea: 'hasHangingRod',
  hangingRod: 'hasHangingRod',
  hasLED: 'hasLed',
  led: 'hasLed',
  hasMirror: '__mirror__',        // se traduce a doorFinish:'mirror' abajo
  topShelf: '__topShelf__',       // el motor lo deriva; se conserva sólo como señal
  shelves: 'numShelves',
  drawers: 'numDrawers',
  doors: 'numDoors',
  dividers: 'numDividers',
  material: 'materialFront',
  // ★ ADITIVO 2026-10-11: aliases de cocina
  horno: 'subType',           // mapped to 'oven_cavity' in detection
  fregadero: 'subType',       // mapped to 'sink' in detection
  pia: 'subType',             // PT: mapped to 'sink'
  cajonera: 'subType',        // mapped to 'drawer_bank'
  gaveteiro: 'subType',       // PT: mapped to 'drawer_bank'
  nicho: 'subType',           // mapped to 'open_niche'
  microondas: 'subType',      // context for niche
}

// ─── Enums cerrados ──────────────────────────────────────────────────────────
const ENUMS = {
  moduleType: ['standard', 'base', 'aereo', 'desk'],
  doorType: ['hinged', 'sliding', 'none', 'false', 'swing'],
  drawerLayout: ['vertical', 'horizontal', 'left', 'right'],
  drawerFrontStyle: ['flat', 'cava_cnc', 'cava45', 'internal'],
  handleType: ['standard', 'gola', 'push', 'cava', 'cava_45', 'none'],  // ★ 2026-10-11: cava, cava_45, none for kitchens
  edgeBandingType: ['thin', 'thick'],
  baseType: ['recessed', 'legs', 'none'],
  // ★ ADITIVO 2026-10-11: sub-tipos funcionales de cocina
  subType: ['standard', 'oven_cavity', 'sink', 'drawer_bank', 'open_niche'],
  line: ['base', 'wall'],
}

// ─── Defaults comerciales de marcenaria (usados SOLO ante ausencia) ──────────
// Fuente: rules/parametric_constraints.md + práctica comercial BR/LatAm.
const COMMERCIAL_DEFAULTS = {
  standard: { width: 2000, height: 2200, depth: 580 },
  base:     { width: 1200, height: 900,  depth: 580 },
  aereo:    { width: 1200, height: 700,  depth: 350 },
  desk:     { width: 1400, height: 750,  depth: 600 },
  // ★ ADITIVO 2026-10-11: defaults de cocina por sub-tipo funcional.
  //   Estos se usan cuando subType está presente Y moduleType es base/aereo.
  //   closetEngine selecciona el default basándose en subType si existe.
  kitchen_oven:    { width: 640,  height: 850, depth: 580 },
  kitchen_sink:    { width: 800,  height: 850, depth: 580 },
  kitchen_drawers: { width: 500,  height: 850, depth: 580 },
  kitchen_niche:   { width: 600,  height: 400, depth: 350 },
}

const RANGES = {
  width:  [100, 6000],
  height: [200, 3500],
  depth:  [100, 1000],
  thickness: [6, 30],
  backThickness: [3, 18],
  numShelves: [0, 20],
  numDrawers: [0, 12],
  numDividers: [0, 8],
  numDoors: [0, 8],
  drawerHeight: [80, 400],
  baseboardHeight: [0, 300],
  nicheHeight: [0, 1500],
  drawerRailHeight: [50, 300],
  // ★ ADITIVO 2026-07-26: mountHeight estaba en ENGINE_PARAM_KEYS (pasaba el whitelist)
  //   pero NO acá → era el ÚNICO numérico del contrato sin clamp ni warning. Combinado
  //   con su ausencia en DIMENSION_KEYS, "colgalo a 1.5" llegaba al motor como 1.5 mm
  //   (aéreo a ras de piso) sin emitir un solo NLP_VALUE_CLAMPED. Fallo silencioso.
  //   Piso 0 (no AEREO.MIN_MOUNT_HEIGHT=400) a propósito: 0 es el valor semántico de
  //   "apoyado en el piso" y es lo que devuelve el motor para base/desk/standard.
  //   Este contrato valida FORMA; el SENTIDO (un aéreo colgado a 300mm es absurdo) lo
  //   valida structural_validator. Mezclar ambos hace ilegibles los mensajes de error.
  mountHeight: [0, 2400],
  slidingDoorSheets: [1, 4],
  alturaTraviesaCava: [0, 200],
  // ★ ADITIVO 2026-10-11: kitchen-specific numeric params
  cavaOverhang: [0, 50],            // mm de extensión inferior del frente para cava
  crossbeamHeight: [50, 150],       // travesaño de amarre módulo bacha
  positionIndex: [0, 20],           // índice de posición en composición
  tieRailHeight: [20, 150],         // ★ 2026-10-12: altura travesaño inter-gaveta
}

const BOOL_KEYS = ['hasDoors', 'hasCountertop', 'hasHangingRod', 'hasLed', 'baseboard', 'drawerPrivacyPanel', 'hasPedestal', 'puxadorCava45', 'puxadorCavaAereo', 'topTieRails', 'tamponadoInferior', 'ovenPanel']
const NUM_KEYS = Object.keys(RANGES)

// Sólo estas llaves son MEDIDAS: admiten unidad y la inferencia "2.4" → 2400mm.
// Los contadores (numDrawers, numDoors…) NUNCA se escalan: "4" es 4, no 4000.
// ★ 2026-07-26: mountHeight ES una medida (altura de instalación piso → borde inferior),
//   no un contador → habilita "1.5" → 1500 mm. Sin esto el LLM que responde "1.5" para
//   "colgalo a metro y medio" producía un aéreo a 1.5 mm del piso.
const DIMENSION_KEYS = ['width', 'height', 'depth', 'thickness', 'backThickness',
                        'drawerHeight', 'baseboardHeight', 'nicheHeight', 'drawerRailHeight',
                        'mountHeight', 'cavaOverhang', 'crossbeamHeight', 'tieRailHeight']

function toNumberMM(v, isDimension = false) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase().replace(',', '.')
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return null
  if (!isDimension) return Math.round(n)                       // contador puro
  if (m[2] === 'm') return Math.round(n * 1000)
  if (m[2] === 'cm') return Math.round(n * 10)
  if (!m[2] && n > 0 && n < 100) return Math.round(n * 1000)   // "2.4" → 2400mm
  return Math.round(n)
}

function toBool(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return /^(true|si|sí|sim|yes|1)$/i.test(v.trim())
  return null
}

/**
 * Sanea la salida cruda del LLM → params estrictos para closetEngine.generateProject.
 * @param {object} raw            objeto de params emitido por el modelo
 * @param {object} [opts]
 * @param {Array}  [opts.specAdjustments]  array preexistente al que anexar supuestos
 * @returns {{ params: object, specAdjustments: Array, dropped: string[] }}
 */
function coerceEngineParams(raw, opts = {}) {
  const specAdjustments = Array.isArray(opts.specAdjustments) ? [...opts.specAdjustments] : []
  const dropped = []
  const out = {}
  const src = (raw && typeof raw === 'object') ? (raw.params && typeof raw.params === 'object' ? raw.params : raw) : {}

  // 2.a — normalizar llaves vía alias
  const norm = {}
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null || v === '') continue
    const key = KEY_ALIASES[k] || k
    if (key === '__mirror__') { if (toBool(v)) norm.doorFinish = 'mirror'; continue }
    if (key === '__topShelf__') continue                       // derivado por el motor
    if (!ENGINE_PARAM_KEYS.includes(key)) { dropped.push(k); continue }
    norm[key] = v
  }

  // 2.b — moduleType primero (define los defaults comerciales del resto)
  let moduleType = typeof norm.moduleType === 'string' ? norm.moduleType.toLowerCase().trim() : null
  const typeMap = { kitchen_low: 'base', kitchen_high: 'aereo', kitchen_island: 'base', closet: 'standard' }
  if (!moduleType && typeof norm.type === 'string') moduleType = typeMap[norm.type.toLowerCase()] || null
  if (!ENUMS.moduleType.includes(moduleType)) moduleType = 'standard'
  out.moduleType = moduleType

  // ★ 2026-10-11: kitchen sub-type specific defaults take priority over base moduleType.
  //   'kitchen_oven' → width:640, height:850, depth:580 (instead of base's 1200×900×580)
  const subType = typeof norm.subType === 'string' ? norm.subType.toLowerCase().trim() : null
  const subTypeDefaultMap = {
    oven_cavity: 'kitchen_oven', sink: 'kitchen_sink',
    drawer_bank: 'kitchen_drawers', open_niche: 'kitchen_niche',
  }
  const cdKey = (subType && subTypeDefaultMap[subType]) || moduleType
  const cd = COMMERCIAL_DEFAULTS[cdKey] || COMMERCIAL_DEFAULTS[moduleType] || COMMERCIAL_DEFAULTS.standard

  // 2.c — numéricos
  for (const k of NUM_KEYS) {
    if (norm[k] === undefined) continue
    let n = toNumberMM(norm[k], DIMENSION_KEYS.includes(k))
    // ★ 2026-07-26 — mountHeight en METROS crudos. toNumberMM sólo aplica la inferencia
    //   "1.5" → 1500 a STRINGS sin unidad; un número JS crudo pasa tal cual (y está bien
    //   así: `thickness: 18` no puede volverse 18000). Para el resto de medidas el clamp
    //   inferior atrapa la basura (width 1.5 → 100 con warning), pero mountHeight admite
    //   0 legítimo, así que 1.5 pasaría silencioso → aéreo a 1.5 mm del piso.
    //   Dominio DISJUNTO: ninguna altura de instalación real cae entre 0 y 10 mm, así que
    //   interpretar ese tramo como metros es seguro y no colisiona con el 0 = "apoyado".
    if (k === 'mountHeight' && n !== null && n > 0 && n < 10) {
      const asMM = Math.round(n * 1000)
      specAdjustments.push({
        code: 'NLP_UNIT_INFERRED', severity: 'warning', field: k,
        message: `"mountHeight" recibido como ${n} (metros). Se interpretó como ${asMM}mm.`,
      })
      n = asMM
    }
    if (n === null) {
      specAdjustments.push({
        code: 'NLP_VALUE_UNPARSEABLE', severity: 'warning', field: k,
        message: `No se pudo interpretar "${norm[k]}" para "${k}". Se ignoró el valor.`,
      })
      continue
    }
    const [lo, hi] = RANGES[k]
    const clamped = Math.max(lo, Math.min(hi, n))
    if (clamped !== n) {
      specAdjustments.push({
        code: 'NLP_VALUE_CLAMPED', severity: 'warning', field: k,
        message: `"${k}" solicitado en ${n}mm está fuera del rango fabricable (${lo}–${hi}mm). Se ajustó a ${clamped}mm.`,
      })
    }
    out[k] = clamped
  }

  // 2.d — REGLA DURA: NO alucinar dimensiones. Ausencia → default comercial + log.
  for (const dim of ['width', 'height', 'depth']) {
    if (out[dim] === undefined) {
      out[dim] = cd[dim]
      specAdjustments.push({
        code: 'ASSUMED_DEFAULT', severity: 'info', field: dim,
        message: `No especificaste ${({ width: 'el ancho', height: 'la altura', depth: 'la profundidad' })[dim]}. ` +
                 `Se aplicó el estándar comercial de marcenaria: ${cd[dim]}mm. Podés cambiarlo cuando quieras.`,
        assumed: cd[dim],
      })
    }
  }
  if (out.thickness === undefined) out.thickness = 18
  if (out.backThickness === undefined) out.backThickness = 6

  // 2.e — booleanos
  for (const k of BOOL_KEYS) {
    if (norm[k] === undefined) continue
    const b = toBool(norm[k])
    if (b !== null) out[k] = b
  }

  // 2.f — enums
  for (const [k, allowed] of Object.entries(ENUMS)) {
    if (k === 'moduleType' || norm[k] === undefined) continue
    const v = String(norm[k]).toLowerCase().trim()
    if (allowed.includes(v)) out[k] = v
    else {
      dropped.push(k)
      specAdjustments.push({
        code: 'NLP_ENUM_INVALID', severity: 'warning', field: k,
        message: `Valor "${norm[k]}" no válido para "${k}". Valores admitidos: ${allowed.join(', ')}. Se usó el default del motor.`,
      })
    }
  }

  // 2.g — strings libres que el motor sí lee
  for (const k of ['doorStyle', 'doorFinish', 'topStyle', 'backStyle', 'alturaTraviesaCava', 'slidingDoorSheets', 'puxadorCava45', 'tamponado',
                   'materialBody', 'materialFront', 'countertopMaterial']) {
    if (typeof norm[k] === 'string' && norm[k].trim()) out[k] = norm[k].trim()
  }
  if (norm.drawerColumns !== undefined) {
    const c = Math.floor(Number(norm.drawerColumns))
    if (c >= 2 && c <= 4) out.drawerColumns = c
  }

  // 2.h — coherencia estructural mínima (evita JSON válido pero absurdo)
  if (out.numDoors > 0 && out.hasDoors === undefined) out.hasDoors = true
  if (out.hasDoors === true && !out.numDoors) {
    out.numDoors = out.width > 600 ? 2 : 1
    specAdjustments.push({
      code: 'ASSUMED_DEFAULT', severity: 'info', field: 'numDoors',
      message: `Pediste puertas sin indicar cuántas. Con ${out.width}mm de ancho se asignaron ${out.numDoors} hoja(s).`,
      assumed: out.numDoors,
    })
  }
  // ★ ADITIVO 2026-10-12: doorType='false' (puerta falsa) prevalece sobre hasDoors=false
  if (out.hasDoors === false && out.doorType !== 'false') { out.numDoors = 0; out.doorType = 'none' }
  if (out.numDrawers > 0 && !out.drawerLayout) out.drawerLayout = 'vertical'

  return { params: out, specAdjustments, dropped }
}

/**
 * Valida la forma de la respuesta del orquestador antes de enviarla al cliente.
 * No lanza: devuelve el veredicto para que la ruta decida.
 */
function validateOrchestratorResponse(res) {
  const errors = []
  if (!res || typeof res !== 'object') return { ok: false, errors: ['Respuesta vacía o no-objeto.'] }
  if (typeof res.message !== 'string' || !res.message.trim()) errors.push('Falta "message" de texto.')
  if (res.params !== null && res.params !== undefined && typeof res.params !== 'object') errors.push('"params" debe ser objeto o null.')
  if (res.params && typeof res.params === 'object') {
    for (const dim of ['width', 'height', 'depth']) {
      const v = res.params[dim]
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) {
        errors.push(`"params.${dim}" debe ser un número positivo en mm.`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

// ─── 4. El contrato, en texto, para inyectar en el system prompt ─────────────
const PARAM_CONTRACT_PROMPT = `
════════════════════════════════════════════════════════════════════════
CONTRATO DE EXTRACCIÓN DE DATOS (PRIORIDAD MÁXIMA — ANULA CUALQUIER OTRA REGLA)
════════════════════════════════════════════════════════════════════════
Actuás como EXTRACTOR DE DATOS A JSON. No sos un diseñador creativo.

R1. LLAVES EXACTAS. Usá EXCLUSIVAMENTE estas llaves dentro de "params". Cualquier
    llave fuera de esta lista SE DESCARTA y el dato se pierde:
    ${ENGINE_PARAM_KEYS.join(', ')}
    Prohibido: W, H, D, largura, hasHangingArea, hasLED, topShelf, o llaves inventadas.
    Colgador de ropa = "hasHangingRod" (NO "hasHangingArea"). LED = "hasLed" (NO "hasLED").

R2. TIPOS ESTRICTOS. Todas las medidas son NÚMEROS enteros en MILÍMETROS, sin unidad
    y sin comillas. "2.4m" → 2400. "60cm" → 600. Nunca "2400mm" ni "2.4".
    Los booleanos son true/false literales, nunca "si"/"sim"/"yes".

R3. ENUMS CERRADOS:
    moduleType: standard | base | aereo | desk
    subType: standard | oven_cavity | sink | drawer_bank | open_niche
    line: base | wall
    doorType: hinged | sliding | none
    drawerLayout: vertical | horizontal | left | right
    handleType: standard | gola | push | cava | cava_45 | none

R4. PROHIBIDO ALUCINAR DIMENSIONES. Si el cliente no dio una medida, NO la inventes
    "para que quede lindo". Aplicá el estándar comercial de marcenaria y DECLARÁ el
    supuesto en "specAdjustments":
      standard/closet → H:2200, D:580   ·   base → H:900, D:580
      aereo           → H:700,  D:350   ·   desk → H:750, D:600
      kitchen_oven    → W:640, H:850, D:580  (horno empotrado estándar europeo, internalW≥595)
      kitchen_sink    → W:800, H:850, D:580  (módulo bacha/fregadero)
      kitchen_drawers → W:500, H:850, D:580  (cajonera/gaveteiro)
      kitchen_niche   → W:600, H:400, D:350  (nicho abierto microondas)
    El ancho (width) es el dato MENOS asumible: si falta y el pedido es vago
    ("un closet grande"), NO devuelvas "params" — preguntá el ancho y el alto.

R5. TRANSPARENCIA. Todo valor no dicho por el cliente viaja en "specAdjustments":
    "specAdjustments": [
      { "code": "ASSUMED_DEFAULT", "severity": "info", "field": "depth",
        "message": "No indicaste profundidad; usé 580mm, el estándar de closet." }
    ]
    Si el cliente especificó TODO, devolvé "specAdjustments": [].

R6. CERO INVENCIÓN DE INTENCIÓN. Si el cliente no mencionó puertas, no agregues
    puertas. Si no mencionó cajones, numDrawers es 0. Extraés lo dicho, no lo imaginado.
════════════════════════════════════════════════════════════════════════
`

module.exports = {
  ENGINE_PARAM_KEYS,
  KEY_ALIASES,
  COMMERCIAL_DEFAULTS,
  // ★ 2026-07-26: expuesto para que nlParser.resolveDimension consulte ESTOS rangos y
  //   no una copia propia. Este archivo es la fuente de verdad de qué es fabricable.
  RANGES,
  coerceEngineParams,
  validateOrchestratorResponse,
  PARAM_CONTRACT_PROMPT,
}
