/**
 * Orbin AI — Natural Language Parser v2
 * Rule-based parser for ES/PT/EN furniture descriptions.
 * No API calls required. Works 100% locally.
 *
 * Examples:
 *   "Guarda-roupa 2m de largura, 2.20m de altura, 60cm de profundidade com 3 prateleiras"
 *   "Closet 2.40m x 2.20m x 0.60m com 2 gavetas e 3 prateleiras"
 *   "Armario 180 de largura 240 de altura com portas de correr"
 */

const { DEFAULTS } = require('./constants')

// ─── Unit Normalizer ──────────────────────────────────────────────────────────

function normalizeMeasurements(text) {
  // Map Spanish / Portuguese / English words to digits before keywords
  const wordToDigitMap = {
    'uma?': '1', 'un[ao]?': '1', 'one': '1',
    'duas?': '2', 'dos': '2', 'two': '2',
    'três': '3', 'tres': '3', 'three': '3',
    'quatro': '4', 'cuatro': '4', 'four': '4',
    'cinco': '5', 'five': '5',
    'seis': '6', 'six': '6',
    'sete': '7', 'siete': '7', 'seven': '7',
    'oito': '8', 'ocho': '8', 'eight': '8',
    'nove': '9', 'nueve': '9', 'nine': '9',
    'dez': '10', 'diez': '10', 'ten': '10'
  }
  
  Object.entries(wordToDigitMap).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\s+(?=porta|puerta|door|repisa|shelf|prateleira|estante|gaveta|cajon|cajón|drawer|lateral|divisor|divisoria)`, 'ig')
    text = text.replace(regex, digit + ' ')
  })

  // "2m40" -> 2m + 40cm = 2400mm (before single-m rule)
  text = text.replace(/(\d+)\s*m\s*(\d{2})\b/g, (_, a, b) => (parseInt(a) * 1000 + parseInt(b) * 10) + 'mm')
  // "2.40m" or "2,40m" -> mm
  text = text.replace(/(\d+[.,]\d+)\s*m\b/g, (_, n) => Math.round(parseFloat(n.replace(',', '.')) * 1000) + 'mm')
  // bare "2m" -> 2000mm (after decimal-m rule)
  text = text.replace(/\b(\d+)\s*m\b/g, (_, n) => parseInt(n) * 1000 + 'mm')
  // "240cm" -> mm
  text = text.replace(/(\d+[.,]?\d*)\s*cm\b/g, (_, n) => Math.round(parseFloat(n.replace(',', '.')) * 10) + 'mm')
  return text
}

// ★ 2026-07-26 (dedup) — estas dos tablas estaban COPIADAS acá. `paramContract.js` ya
//   las define y es quien valida lo que sale del LLM: con dos copias, agregar un rango
//   en una y no en la otra hace que el contrato acepte un valor que el parser resuelve
//   distinto, y ningún test se queja. Una sola fuente.
//   `PC_RANGES` trae más campos que los tres dimensionales (numDrawers, thickness…);
//   resolveDimension sólo consulta width/height/depth, así que el resto es inofensivo.
const { RANGES, COMMERCIAL_DEFAULTS } = require('../ai/paramContract')

// ── Tabla ÚNICA de detección de tipo de módulo ───────────────────────────────
// ★ 2026-07-26. Antes esta lógica vivía DUPLICADA en parseNaturalLanguage (una copia
//   para la heurística de unidades y otra para asignar el tipo). Primera coincidencia
//   gana, así que el ORDEN importa.
//
// ★ HALLAZGO que motivó el cambio: 'desk' NO estaba. La topología del escritorio
//   (faldón, pedestal, travesaño de privacidad) sólo era alcanzable por el LLM; con
//   Gemini caído o en modo offline, el producto no sabía hacer escritorios.
//
// ⚠ TRAMPA PT-BR: "escritório" en portugués es la OFICINA (el ambiente), no el mueble
//   — el mueble es "escrivaninha". Incluir "escritório" haría que "armário para
//   escritório" se clasifique como escritorio. Por eso no está, y por eso `not`
//   descarta la frase si además nombra un ropero.
const WARDROBE_WORDS = ['armario', 'armário', 'ropero', 'guarda-roupa', 'guarda roupa', 'closet', 'placard', 'wardrobe']
const MODULE_TYPE_RULES = [
  // ── Kitchen sub-types (ADITIVO 2026-10-11) ──────────────────────────────────
  // Sub-tipos funcionales: deben ir ANTES de las reglas genéricas base/aereo
  // para que "módulo bajo de horno" no caiga en el bucket genérico.
  { moduleType: 'base',  type: 'kitchen_oven',
    kw: ['horno', 'forno', 'oven', 'módulo horno', 'modulo horno', 'base horno',
         'módulo forno', 'modulo forno', 'oven module', 'oven cabinet'],
    defaults: { width: 640, height: 850, depth: 580 },
    extra: { hasDoors: false, numDoors: 0, doorType: 'none', subType: 'oven_cavity' },
    note: 'Tipo: Módulo Horno' },
  { moduleType: 'base',  type: 'kitchen_sink',
    kw: ['fregadero', 'pia', 'sink', 'lavaplatos', 'lava-louça', 'lava louça',
         'módulo fregadero', 'modulo fregadero', 'sink module', 'sink cabinet',
         'módulo pia', 'modulo pia'],
    defaults: { width: 800, height: 850, depth: 580 },
    extra: { subType: 'sink' },
    note: 'Tipo: Módulo Fregadero' },
  { moduleType: 'base',  type: 'kitchen_drawers',
    kw: ['cajonera', 'gaveteiro', 'drawer bank', 'banco de cajones',
         'módulo cajonera', 'modulo cajonera', 'módulo gaveteiro', 'modulo gaveteiro',
         'drawer module', 'drawer unit', 'torre de cajones', 'torre de gavetas'],
    defaults: { width: 500, height: 850, depth: 580 },
    extra: { subType: 'drawer_bank', numDrawers: 3 },
    note: 'Tipo: Módulo Cajonera' },
  { moduleType: 'aereo', type: 'kitchen_niche',
    kw: ['nicho', 'nicho abierto', 'nicho aberto', 'open niche', 'módulo nicho',
         'modulo nicho', 'estante abierto', 'estante aberto', 'cubículo',
         'microondas', 'micro-ondas'],
    defaults: { width: 600, height: 400, depth: 350 },
    extra: { hasDoors: false, numDoors: 0, doorType: 'none', subType: 'open_niche' },
    note: 'Tipo: Nicho Abierto' },
  // ── Generic kitchen base / aereo ────────────────────────────────────────────
  { moduleType: 'base',  type: 'kitchen_low',
    kw: ['cocina baja', 'cozinha baixa', 'modulo bajo', 'módulo bajo', 'mueble bajo', 'bajo de cocina', 'mueble base', 'módulo base', 'modulo base', 'base de cocina', 'gabinete base', 'balcão', 'balcao'],
    defaults: { height: 900, depth: 600 }, extra: { hasCountertop: true }, note: 'Tipo: Módulo Bajo' },
  { moduleType: 'aereo', type: 'kitchen_high',
    kw: ['cocina alta', 'cozinha alta', 'aereo', 'aéreo', 'módulo aéreo', 'modulo aereo', 'módulo alto', 'modulo alto', 'suspendido'],
    defaults: { height: 700, depth: 350 }, note: 'Tipo: Módulo Alto' },
  { moduleType: 'desk',  type: 'desk',
    kw: ['escritorio', 'escrivaninha', 'mesa de trabajo', 'mesa de trabalho', 'mesa de estudio', 'mesa de estudo', 'writing desk', 'work desk', 'desk'],
    not: WARDROBE_WORDS,
    defaults: { width: 1400, height: 750, depth: 600 },
    // Un escritorio no lleva puertas ni zócalo: el vano de piernas debe quedar abierto.
    extra: { hasDoors: false, numDoors: 0, doorType: 'none', baseboard: false, hasCountertop: false },
    note: 'Tipo: Escritorio' },
  { moduleType: 'base',  type: 'kitchen_island',
    kw: ['isla', 'ilha', 'island'], note: 'Tipo: Isla' },
]
function detectModuleRule(text) {
  for (const r of MODULE_TYPE_RULES) {
    if (!detectFeature(text, r.kw)) continue
    if (r.not && detectFeature(text, r.not)) continue   // p.ej. "armario de escritorio"
    return r
  }
  return null
}

function resolveDimension(rawStr, hasMMSuffix, field, moduleType, specAdjustments) {
  const cleanStr = String(rawStr).replace(',', '.').trim()
  const n = parseFloat(cleanStr)
  if (!Number.isFinite(n)) return null

  if (hasMMSuffix) return Math.round(n)

  const mm = n
  const cm = n * 10
  const m  = n * 1000

  const candidates = [
    { value: mm, unit: 'mm' },
    { value: cm, unit: 'cm' },
    { value: m,  unit: 'm'  }
  ]

  const range = RANGES[field]
  if (!range) {
    return Math.round(n < 1000 ? n * 10 : n)
  }

  const [lo, hi] = range
  const survivors = candidates.filter(c => c.value >= lo && c.value <= hi)

  if (survivors.length === 1) {
    return Math.round(survivors[0].value)
  }

  if (survivors.length === 0) {
    const fallbackVal = Math.round(n < 1000 ? n * 10 : n)
    if (specAdjustments) {
      specAdjustments.push({
        code: 'NLP_VALUE_IMPLAUSIBLE',
        severity: 'warning',
        field,
        message: `El valor "${rawStr}" para "${field}" no es plausible en ningún sistema de unidades (rango: ${lo}-${hi}mm).`
      })
    }
    return fallbackVal
  }

  const defaults = COMMERCIAL_DEFAULTS[moduleType] || COMMERCIAL_DEFAULTS.standard
  const targetDefault = defaults[field] || 1000

  survivors.sort((a, b) => Math.abs(a.value - targetDefault) - Math.abs(b.value - targetDefault))
  const chosen = survivors[0]

  if (specAdjustments) {
    const listStr = survivors.map(s => `${Math.round(s.value)}mm (${s.unit})`).join(' o ')
    specAdjustments.push({
      code: 'NLP_UNIT_AMBIGUOUS',
      severity: 'warning',
      field,
      message: `"${rawStr}" para ${field} puede ser ${listStr}; se interpretó ${Math.round(chosen.value)}mm (típico para ${moduleType}). Confirmá si no es lo que querías.`
    })
  }

  return Math.round(chosen.value)
}

// 3-digit bare number near keyword = cm (marcenaria convention: "180 de largura" = 180cm = 1800mm)
// 4-digit number or number followed by "mm" = use as-is
function toDimMM(raw, hasMMSuffix) {
  if (hasMMSuffix) return raw
  return raw < 1000 ? raw * 10 : raw
}

// ─── Dimension Extractors ─────────────────────────────────────────────────────

function extractDimensionTriple(text, moduleType, specAdjustments) {
  const regex = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
  const m = text.match(regex)
  if (m) {
    const parsePart = (valStr, partUnit, field) => {
      const val = parseFloat(valStr.replace(',', '.'))
      const unit = partUnit || m[6] || m[4] || m[2]
      if (unit) {
        if (unit === 'm') return Math.round(val * 1000)
        if (unit === 'cm') return Math.round(val * 10)
        return Math.round(val)
      }
      return resolveDimension(valStr, false, field, moduleType, specAdjustments)
    }
    return {
      width:  parsePart(m[1], m[2], 'width'),
      height: parsePart(m[3], m[4], 'height'),
      depth:  parsePart(m[5], m[6], 'depth')
    }
  }
  return null
}

function extractDimensionByKeyword(text, keywords, field, moduleType, specAdjustments) {
  for (const kw of keywords) {
    // Priority: number BEFORE keyword ("2000mm de largura" / "180 de largura")
    const before = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(mm)?[^\\d.,]{0,15}' + kw, 'i')
    const mb = text.match(before)
    if (mb) return resolveDimension(mb[1], !!mb[2], field, moduleType, specAdjustments)

    // Fallback: keyword BEFORE number, tight window ("largura: 2400")
    const after = new RegExp(kw + '\\s*[:\\s]{1,3}(\\d+(?:[.,]\\d+)?)\\s*(mm)?', 'i')
    const ma = text.match(after)
    if (ma) return resolveDimension(ma[1], !!ma[2], field, moduleType, specAdjustments)
  }
  return null
}

// ─── Altura de INSTALACIÓN (piso → borde inferior del mueble) ────────────────
// ★ 2026-07-26 — espejo EXACTO de client/src/engine/offlineParser.js. Si tocás uno,
//   tocá el otro o el modo online y el offline entienden frases distintas.
//
//   NO se desambigua por el sustantivo "altura": en carpintería "altura" = alto DEL
//   MUEBLE y extractDimensionByKeyword ya la reclama para `height` (línea de abajo).
//   Se desambigua por PREPOSICIÓN + sustantivo de referencia (piso/suelo/chão), que es
//   lo único que hace única a esta medida.
//
//   ORDEN OBLIGATORIO: correr ANTES de extraer dimensiones y BORRAR el fragmento del
//   texto, o `extractDimensionByKeyword` recaptura el número y lo asigna a `height`
//   ("colgado a 1400 del piso" → mueble de 1400 de alto).
const NUM = '(\\d+(?:[.,]\\d+)?)'   // admite decimal: "1.20 del piso" (con \\d{2,4} el
                                   // regex capturaba el "20" y salía 200mm)
const MOUNT_PATTERNS = [
  new RegExp('(?:colgad[oa]|pendurad[oa]|suspendid[oa]|fijad[oa]|fixad[oa]|instalad[oa]|montad[oa]|mounted|hung)\\s+(?:a|à|at|en|em|to)?\\s*' + NUM + '\\s*(mm)?', 'i'),
  new RegExp('altura\\s+d[eo]\\s+(?:instalaci[oó]n|instala[çc][ãa]o|fijaci[oó]n|fixa[çc][ãa]o|montaje|montagem|installation|mounting)\\s*[:\\s]{0,3}' + NUM + '\\s*(mm)?', 'i'),
  new RegExp(NUM + '\\s*(mm)?\\s*(?:d[eoa]l?|from|above)\\s+(?:piso|suelo|ch[ãa]o|solo|floor|ground|nivel)', 'i'),
]
// Escala propia (NO toDimMM): esta medida admite metros con decimal, que es como la
// dice la gente ("a 1.20 del piso"). toDimMM sólo distingue <1000 → cm.
function mountToMM(raw, hasMM) {
  const v = parseFloat(String(raw).replace(',', '.'))
  if (!Number.isFinite(v)) return null
  if (hasMM) return Math.round(v)          // "1450mm"
  if (v < 10) return Math.round(v * 1000)  // "1.45"  → metros
  if (v < 1000) return Math.round(v * 10)  // "145"   → cm  (misma regla que toDimMM)
  return Math.round(v)                     // "1450"  → mm
}
function extractMountHeight(text) {
  for (const re of MOUNT_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const value = mountToMM(m[1], !!m[2])
      if (value != null) return { value, match: m[0] }
    }
  }
  return null
}

// ─── Count Extractor ──────────────────────────────────────────────────────────

function extractCount(text, keywords) {
  // BUG FIX #10: deduplicate keywords before iterating
  const seen = new Set()
  const uniqueKws = keywords.filter(kw => { if (seen.has(kw)) return false; seen.add(kw); return true })

  for (const kw of uniqueKws) {
    const patterns = [
      // BUG FIX #10: \s* (0 or more spaces) — matches "2gavetas" and "2 gavetas"
      new RegExp('(\\d+)\\s*' + kw, 'i'),
      new RegExp(kw + 's?\\s*[:\\-]?\\s*(\\d+)', 'i'),
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m) return parseInt(m[1])
    }
  }
  return 0
}

function detectFeature(text, keywords) {
  return keywords.some(kw => new RegExp(kw, 'i').test(text))
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

function parseNaturalLanguage(input) {
  if (!input || typeof input !== 'string') {
    return { params: { ...DEFAULTS }, confidence: 0, interpreted: 'Entrada vazia — usando padroes.', specAdjustments: [] }
  }

  const rawInput = input.trim()
  const specAdjustments = []

  let text = rawInput
  text = normalizeMeasurements(text)

  // ★ 2026-07-26 (dedup): la detección de tipo estaba ESCRITA DOS VECES en este archivo
  //   (acá para la heurística de unidades, y más abajo para asignar el tipo). Dos listas
  //   de sinónimos que hay que recordar actualizar juntas. Ahora una sola tabla.
  const rule = detectModuleRule(text)
  const detectedModuleType = rule ? rule.moduleType : 'standard'

  const result = { ...DEFAULTS }
  const notes  = []
  let confidence = 0

  // ★ FIX 2026-07-23 (bug demo aéreo): flags de "el usuario ESPECIFICÓ esta
  //   dimensión". La detección de tipo (abajo) forzaba height/depth de forma
  //   incondicional y PISABA las medidas explícitas del usuario (ej. aéreo
  //   "20 de alto, 30 de fondo" salía 700×350). Ahora los defaults de tipo solo
  //   rellenan lo que el usuario NO dio. Mismo patrón que el offlineParser cliente.
  const userSet = { width: false, height: false, depth: false }

  // ★ 2026-07-26: altura de instalación PRIMERO y se borra del texto (ver nota en
  //   MOUNT_PATTERNS). A diferencia del parser offline, acá NO se pone default para el
  //   aéreo: este resultado sí pasa por closetEngine, que aplica AEREO.KITCHEN_MOUNT_HEIGHT
  //   cuando el valor viene null. Dueño único del default = el motor.
  const mh = extractMountHeight(text)
  if (mh) {
    text = text.replace(mh.match, ' ')
    result.mountHeight = mh.value
    confidence += 10
    notes.push(`Instalación: ${mh.value}mm del piso`)
  }

  const triple = extractDimensionTriple(rawInput, detectedModuleType, specAdjustments)

  if (triple) {
    result.width  = triple.width
    result.height = triple.height
    result.depth  = triple.depth
    userSet.width = userSet.height = userSet.depth = true
    confidence += 40
  } else {
    const w = extractDimensionByKeyword(text, ['larg', 'anch', 'width', 'largura', 'ancho'], 'width', detectedModuleType, specAdjustments)
    const h = extractDimensionByKeyword(text, ['alt',  'height', 'altura', 'alto'], 'height', detectedModuleType, specAdjustments)
    const d = extractDimensionByKeyword(text, ['prof', 'depth', 'fundo', 'profundidade', 'fondo'], 'depth', detectedModuleType, specAdjustments)

    if (w) { result.width  = w; userSet.width  = true; confidence += 15 }
    if (h) { result.height = h; userSet.height = true; confidence += 15 }
    if (d) { result.depth  = d; userSet.depth  = true; confidence += 15 }

    if (!w) {
      const first = text.match(/\b(\d{3,4})\s*mm/)
      if (first) {
        result.width = parseInt(first[1])
        confidence += 5
      }
    }
  }

  // --- Type Detection ---
  // NOTE: runs BEFORE the dimension note so interpreted reflects FINAL dimensions.
  // ★ 2026-07-26: una sola tabla (MODULE_TYPE_RULES) alimenta esto Y la detección
  //   temprana de arriba. Antes eran dos listas de sinónimos paralelas.
  //   Se conserva intacta la regla del FIX 2026-07-23: los defaults de tipo SOLO
  //   rellenan lo que el usuario NO dio (userSet), nunca pisan una medida explícita.
  if (rule) {
    result.type = rule.type
    result.moduleType = rule.moduleType
    for (const [field, val] of Object.entries(rule.defaults || {})) {
      if (!userSet[field]) result[field] = val
    }
    Object.assign(result, rule.extra || {})
    notes.push(rule.note)
  } else {
    result.moduleType = result.moduleType || 'standard';
  }

  // Dimension note built AFTER type overrides — shows final values
  if (triple) {
    notes.push('L=' + result.width + 'mm A=' + result.height + 'mm P=' + result.depth + 'mm')
  } else {
    notes.push('L=' + result.width + ' A=' + result.height + ' P=' + result.depth)
  }

  // --- Material/Color Detection ---
  if (detectFeature(text, ['verde mate', 'green matte'])) {
    result.materialFront = 'green_matte'; notes.push('Verde Mate');
  } else if (detectFeature(text, ['roble', 'oak', 'carvalho'])) {
    result.materialFront = 'oak_light'; notes.push('Roble');
  } else if (detectFeature(text, ['marmol', 'granito', 'piedra'])) {
    result.countertopMaterial = 'marble_white'; notes.push('Mármol');
  }

  // --- Kitchen Features ---
  if (detectFeature(text, ['encimera', 'bancada', 'countertop'])) {
    result.hasCountertop = true; notes.push('Encimera');
  }
  if (detectFeature(text, ['tirador gola', 'perfil gola', 'handle gola'])) {
    result.handleType = 'gola'; notes.push('Gola');
  }
  // ★ ADITIVO 2026-10-11 — Tirador cava (routed / CNC groove handle)
  if (detectFeature(text, ['cava', 'puxador cava', 'tirador cava', 'jaladera cava',
                           'cava 45', 'cava_45', 'puerta extendida', 'porta estendida'])) {
    result.handleType = detectFeature(text, ['cava 45', 'cava_45', '45 grados', '45 graus']) ? 'cava_45' : 'cava';
    if (result.moduleType === 'aereo' || result.type === 'kitchen_high' || result.type === 'kitchen_niche') {
      result.puxadorCavaAereo = true;
      result.cavaOverhang = 30;
      notes.push('Cava aéreo (overhang 30mm)');
    } else {
      notes.push('Cava');
    }
  }

  const drawers = extractCount(text, ['gaveta', 'cajon', 'cajón', 'drawer', 'gavetao'])

  // ★ 2026-07-26 — ESCRITORIO SIN GAVETAS = PEDESTAL VACÍO. Un "quiero un escritorio"
  //   a secas daba numDrawers 0, pero el motor igual construye el pedestal → salían
  //   Costado + Base + Fondo Pedestal formando una CAJA ABIERTA sin nada adentro:
  //   3 piezas de MDF cortadas para cero función. El cliente no pide eso nunca.
  //   Regla: si el usuario no dijo cuántas gavetas, el escritorio sale con 3 (pedestal
  //   estándar). Si dijo explícitamente que NO quiere, se saca el pedestal entero y
  //   queda un escritorio de patas + faldón, que sí es un mueble coherente.
  if (result.moduleType === 'desk' && drawers === 0) {
    if (detectFeature(text, ['sin gaveta', 'sin cajon', 'sin cajón', 'sem gaveta', 'no drawer', 'without drawer', 'sin pedestal', 'sem pedestal'])) {
      result.hasPedestal = false
      result.numDrawers = 0
      notes.push('Escritorio sin pedestal')
    } else {
      result.numDrawers = 3
      notes.push('3 gaveta(s) (pedestal estándar)')
    }
  }

  if (drawers > 0) {
    result.numDrawers = drawers
    notes.push(drawers + ' gaveta(s)')
    confidence += 10

    // --- Drawer layout position (ES/PT/EN) ---
    if (detectFeature(text, ['izquierda', 'esquerda', 'left side', 'on the left', 'à esquerda'])) {
      result.drawerLayout = 'left'; notes.push('Layout: Esquerda')
    } else if (detectFeature(text, ['direita', 'derecha', 'right side', 'on the right', 'à direita'])) {
      result.drawerLayout = 'right'; notes.push('Layout: Direita')
    } else if (detectFeature(text, ['centro', 'center', 'centre', 'central', 'meio'])) {
      result.drawerLayout = 'vertical'; notes.push('Layout: Centro')
    }
  }

  const shelves = extractCount(text, ['prateleira', 'estante', 'shelf', 'shelves', 'repisa', 'prateleiras'])
  if (shelves > 0) { result.numShelves = shelves; notes.push(shelves + ' prateleira(s)'); confidence += 5 }

  const dividers = extractCount(text, ['divisor', 'divisória', 'divisoria', 'divider', 'lateral interno', 'separador'])
  if (dividers > 0) { result.numDividers = dividers; notes.push(dividers + ' divisor(es)'); confidence += 5 }

  if (detectFeature(text, ['maletero', 'cabideiro', 'cabide', 'hang', 'pendurar', 'hanging rod', 'barra de ropa'])) {
    result.hasHangingArea = true; notes.push('Cabideiro'); confidence += 5
  }
  if (detectFeature(text, ['porta', 'puerta', 'door', 'doors', 'portas', 'puertas'])) {
    result.hasDoors = true
    result.doorType = detectFeature(text, ['correr', 'corrediz', 'sliding', 'desliz', 'correderas']) ? 'sliding' : 'hinged'
    // Number of doors
    const numDoors = extractCount(text, ['porta', 'puerta', 'door'])
    if (numDoors > 0) result.numDoors = numDoors
    notes.push('Portas: ' + result.doorType)
    confidence += 5
  }
  if (detectFeature(text, ['sem porta', 'sin puerta', 'no door', 'open', 'aberto', 'abierto'])) {
    result.hasDoors = false; result.numDoors = 0; notes.push('Sem portas')
  }
  if (detectFeature(text, ['espelho', 'espejo', 'mirror'])) { result.hasMirror = true; notes.push('Espelho') }
  if (detectFeature(text, ['15mm', 'espessura 15', 'grosor 15', 'thickness 15'])) { result.thickness = 15; confidence += 5 }
  if (detectFeature(text, ['25mm', 'espessura 25', 'grosor 25', 'thickness 25'])) { result.thickness = 25; confidence += 5 }
  if (detectFeature(text, ['borda grossa', 'bordo 2mm', 'pvc 2', 'thick edge'])) { result.edgeBandingType = 'thick'; confidence += 3 }
  if (detectFeature(text, ['led', 'iluminação', 'iluminacion', 'lighting', 'luz'])) { result.hasLED = true; notes.push('LED'); confidence += 3 }
  if (detectFeature(text, ['push', 'push-to-open', 'toque', 'sem tirador', 'sin tirador', 'no handle'])) { result.handleType = 'push'; notes.push('Push') }
  if (detectFeature(text, ['gola', 'perfil gola', 'gola profile'])) { result.handleType = 'gola'; notes.push('Gola') }
  if (detectFeature(text, ['sin tirador', 'sem puxador', 'no handle', 'sin manija'])) { result.handleType = 'none'; notes.push('Sin tirador') }

  const interpreted = notes.length > 0
    ? 'Interpretado: ' + notes.join(' | ')
    : 'Nenhum dado especifico — usando padroes (' + result.width + 'x' + result.height + 'x' + result.depth + 'mm)'

  return { params: result, confidence, interpreted, specAdjustments }
}

module.exports = { parseNaturalLanguage }
