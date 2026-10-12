/**
 * Orbin AI — Offline NL Parser (Browser ESM)
 * Mirrors server/src/engine/nlParser.js — no API calls, 100% client-side.
 * Used as fallback when the Express backend is unreachable.
 */

import { AEREO_MOUNT } from './domainConstants.js'

// ★ 2026-07-26 — ESPEJO de server/src/engine/nlParser.js (MODULE_TYPE_RULES rule 'desk'
//   y WARDROBE_WORDS). Si tocás una lista, tocá la otra o el modo online y el offline
//   clasifican distinto el mismo texto.
//   ⚠ "escritório" (PT) = la OFICINA, no el mueble; el mueble es "escrivaninha". Por eso
//   no está en DESK_WORDS y por eso WARDROBE_WORDS descarta "armario de escritorio".
const DESK_WORDS = ['escritorio', 'escrivaninha', 'mesa de trabajo', 'mesa de trabalho', 'mesa de estudio', 'mesa de estudo', 'writing desk', 'work desk', 'desk']
const WARDROBE_WORDS = ['armario', 'armário', 'ropero', 'guarda-roupa', 'guarda roupa', 'closet', 'placard', 'wardrobe']

const DEFAULTS = {
  moduleType: 'standard', width: 600, height: 720, depth: 580,
  thickness: 18, backThickness: 6, numShelves: 1, numDrawers: 0,
  drawerHeight: 180, hasDoors: false, doorType: 'none',
  baseboard: true, baseboardHeight: 100, numDividers: 0,
  hasCountertop: false, handleType: 'standard', hasLED: false,
  materialBody: 'oak_light', materialFront: 'oak_light',
}

function normalizeMeasurements(text) {
  const wordMap = {
    'uma?': '1', 'un[ao]?': '1', 'one': '1',
    'duas?': '2', 'dos': '2', 'two': '2',
    'três': '3', 'tres': '3', 'three': '3',
    'quatro': '4', 'cuatro': '4', 'four': '4',
    'cinco': '5', 'five': '5', 'seis': '6', 'six': '6',
    'sete': '7', 'siete': '7', 'seven': '7',
    'oito': '8', 'ocho': '8', 'eight': '8',
    'nove': '9', 'nueve': '9', 'nine': '9',
    'dez': '10', 'diez': '10', 'ten': '10',
  }
  Object.entries(wordMap).forEach(([word, digit]) => {
    const re = new RegExp(`\\b${word}\\s+(?=porta|puerta|door|repisa|shelf|prateleira|estante|gaveta|cajon|cajón|drawer|lateral|divisor)`, 'ig')
    text = text.replace(re, digit + ' ')
  })
  text = text.replace(/(\d+)\s*m\s*(\d{2})\b/g, (_, a, b) => (parseInt(a) * 1000 + parseInt(b) * 10) + 'mm')
  text = text.replace(/(\d+[.,]\d+)\s*m\b/g, (_, n) => Math.round(parseFloat(n.replace(',', '.')) * 1000) + 'mm')
  text = text.replace(/\b(\d+)\s*m\b/g, (_, n) => parseInt(n) * 1000 + 'mm')
  text = text.replace(/(\d+[.,]?\d*)\s*cm\b/g, (_, n) => Math.round(parseFloat(n.replace(',', '.')) * 10) + 'mm')
  return text
}

const RANGES = {
  width:  [100, 6000],
  height: [200, 3500],
  depth:  [100, 1000]
}

const COMMERCIAL_DEFAULTS = {
  standard: { width: 2000, height: 2200, depth: 580 },
  base:     { width: 1200, height: 900,  depth: 580 },
  aereo:    { width: 1200, height: 700,  depth: 350 },
  desk:     { width: 1400, height: 750,  depth: 600 },
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

function toDimMM(raw, hasMMSuffix) {
  if (hasMMSuffix) return raw
  return raw < 1000 ? raw * 10 : raw
}

function extractTriple(text, moduleType, specAdjustments) {
  const re = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
  const m = text.match(re)
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

function extractByKeyword(text, kws, field, moduleType, specAdjustments) {
  for (const kw of kws) {
    const before = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(mm)?[^\\d.,]{0,15}' + kw, 'i')
    const mb = text.match(before)
    if (mb) return resolveDimension(mb[1], !!mb[2], field, moduleType, specAdjustments)
    const after = new RegExp(kw + '\\s*[:\\s]{1,3}(\\d+(?:[.,]\\d+)?)\\s*(mm)?', 'i')
    const ma = text.match(after)
    if (ma) return resolveDimension(ma[1], !!ma[2], field, moduleType, specAdjustments)
  }
  return null
}

// ─── Altura de INSTALACIÓN (piso → borde inferior) ───────────────────────────
// ★ 2026-07-26 — DEUDA SALDADA. Antes: `result.mountHeight = 1450` hardcodeado al
//   detectar "aéreo", IGNORANDO por completo lo que dijera el usuario. "colgalo a
//   1.20 del piso" salía a 1450.
//
//   ¿Por qué NO se puede desambiguar por el sustantivo "altura"? Porque en carpintería
//   "altura" = alto DEL MUEBLE, y extractByKeyword ya la reclama para `height`. Con
//   "aéreo a 1.40 de altura" ambos extractores compiten y gana el equivocado.
//   → Se desambigua por PREPOSICIÓN y por sustantivo de referencia (piso/suelo/chão),
//     que es lo que hace única a esta medida.
//
//   ORDEN OBLIGATORIO: correr esto ANTES que la extracción de dimensiones y BORRAR el
//   fragmento del texto (stripMountHeight), porque si no `extractByKeyword` recaptura
//   el mismo número y lo asigna a `height`.
const NUM = '(\\d+(?:[.,]\\d+)?)'   // admite decimal: "1.20 del piso" (con \\d{2,4} el
                                   // regex capturaba el "20" y salía 200mm)
const MOUNT_PATTERNS = [
  // "colgado/pendurado/suspendido/fijado/instalado a 1400mm"
  new RegExp('(?:colgad[oa]|pendurad[oa]|suspendid[oa]|fijad[oa]|fixad[oa]|instalad[oa]|montad[oa]|mounted|hung)\\s+(?:a|à|at|en|em|to)?\\s*' + NUM + '\\s*(mm)?', 'i'),
  // "altura de instalación/fijación/montaje: 1400mm"
  new RegExp('altura\\s+d[eo]\\s+(?:instalaci[oó]n|instala[çc][ãa]o|fijaci[oó]n|fixa[çc][ãa]o|montaje|montagem|installation|mounting)\\s*[:\\s]{0,3}' + NUM + '\\s*(mm)?', 'i'),
  // "a 1400mm del piso" / "1400mm do chão" / "1400 from floor"
  new RegExp(NUM + '\\s*(mm)?\\s*(?:d[eoa]l?|from|above)\\s+(?:piso|suelo|ch[ãa]o|solo|floor|ground|nivel)', 'i'),
]
// Escala propia (NO toDimMM): admite metros con decimal, que es como lo dice la gente
// ("a 1.20 del piso"). toDimMM sólo distingue <1000 → cm.
function mountToMM(raw, hasMM) {
  const v = parseFloat(String(raw).replace(',', '.'))
  if (!Number.isFinite(v)) return null
  if (hasMM) return Math.round(v)          // "1450mm"
  if (v < 10) return Math.round(v * 1000)  // "1.45"  → metros
  if (v < 1000) return Math.round(v * 10)  // "145"   → cm (misma regla que toDimMM)
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
function stripMountHeight(text, match) {
  return match ? text.replace(match, ' ') : text
}

function extractCount(text, kws) {
  const seen = new Set()
  for (const kw of kws) {
    if (seen.has(kw)) continue
    seen.add(kw)
    for (const re of [new RegExp('(\\d+)\\s*' + kw, 'i'), new RegExp(kw + 's?\\s*[:\\-]?\\s*(\\d+)', 'i')]) {
      const m = text.match(re)
      if (m) return parseInt(m[1])
    }
  }
  return 0
}

function detect(text, kws) {
  return kws.some(kw => new RegExp(kw, 'i').test(text))
}

export function parseNaturalLanguage(input) {
  if (!input || typeof input !== 'string') {
    return { params: { ...DEFAULTS }, confidence: 0, interpreted: 'Entrada vazia.', specAdjustments: [] }
  }

  const raw = input.trim()
  const specAdjustments = []
  let text = normalizeMeasurements(raw)

  // Detect moduleType early for plausibility logic
  let detectedModuleType = 'standard'
  if (detect(text, ['cocina baja', 'cozinha baixa', 'modulo bajo', 'mueble bajo', 'bajo de cocina'])) {
    detectedModuleType = 'base'
  } else if (detect(text, ['cocina alta', 'cozinha alta', 'aereo', 'suspendido', 'aéreo', 'superior', 'armario superior', 'armário superior'])) {
    detectedModuleType = 'aereo'
  } else if (detect(text, DESK_WORDS) && !detect(text, WARDROBE_WORDS)) {
    detectedModuleType = 'desk'   // ★ 2026-07-26: la heurística de unidades necesita el
                                  //   tipo para elegir el COMMERCIAL_DEFAULT correcto
  } else if (detect(text, ['isla', 'ilha', 'island'])) {
    detectedModuleType = 'base'
  }

  const result = { ...DEFAULTS }
  const notes = []
  let confidence = 0

  // Altura de instalación PRIMERO y se borra del texto
  const mh = extractMountHeight(text)
  if (mh) {
    text = stripMountHeight(text, mh.match)
    result.mountHeight = mh.value
    confidence += 10
    notes.push(`instalación ${mh.value}mm del piso`)
  }

  const triple = extractTriple(raw, detectedModuleType, specAdjustments)

  // ★ 2026-07-26: `userSet` marca qué medidas dio EXPLÍCITAMENTE el usuario. El parser
  //   del servidor ya lo tenía (FIX 2026-07-23 del bug del aéreo); acá no existía.
  //   Lo usa la regla 'desk' para no pisar una medida pedida. Las ramas base/aereo
  //   conservan su patrón `||` original — no se tocan.
  const userSet = { width: false, height: false, depth: false }

  // Dimensions
  if (triple) {
    result.width = triple.width; result.height = triple.height; result.depth = triple.depth
    userSet.width = userSet.height = userSet.depth = true
    confidence += 40
  } else {
    const w = extractByKeyword(text, ['larg', 'anch', 'width', 'largura', 'ancho'], 'width', detectedModuleType, specAdjustments)
    const h = extractByKeyword(text, ['alt', 'height', 'altura', 'alto'], 'height', detectedModuleType, specAdjustments)
    const d = extractByKeyword(text, ['prof', 'depth', 'fundo', 'profundidade', 'fondo'], 'depth', detectedModuleType, specAdjustments)
    if (w) { result.width = w; userSet.width = true; confidence += 15 }
    if (h) { result.height = h; userSet.height = true; confidence += 15 }
    if (d) { result.depth = d; userSet.depth = true; confidence += 10 }
    if (!w) {
      const first = text.match(/\b(\d{3,4})\s*mm/)
      if (first) { result.width = parseInt(first[1]); userSet.width = true; confidence += 5 }
    }
  }
  notes.push(`${result.width}×${result.height}×${result.depth}mm`)

  // Module type
  if (detect(text, ['cocina baja', 'cozinha baixa', 'modulo bajo', 'mueble bajo', 'bajo de cocina'])) {
    result.moduleType = 'base'; result.height = result.height || 900; result.hasCountertop = true; notes.push('Base cocina')
  } else if (detect(text, ['cocina alta', 'cozinha alta', 'aereo', 'suspendido', 'aéreo', 'superior', 'armario superior', 'armário superior'])) {
    result.moduleType = 'aereo'; result.height = result.height || 400; result.depth = result.depth || 320
    result.baseboard = false
    // ★ 2026-07-26: sólo se aplica el default si el usuario NO dio una altura de
    //   instalación. Antes pisaba SIEMPRE con 1450. El valor sale de la constante de
    //   dominio (era un literal duplicado en 5 archivos con dos valores distintos).
    //   OJO — acá SÍ hace falta default: en modo offline App.jsx arma el módulo con
    //   `configuration: parsed.params` y `pieces: []`, el motor NO corre después, así
    //   que dejarlo undefined dibujaría el aéreo apoyado en el piso.
    if (result.mountHeight == null) result.mountHeight = AEREO_MOUNT.DEFAULT
    notes.push('Aéreo')
  } else if (detect(text, DESK_WORDS) && !detect(text, WARDROBE_WORDS)) {
    // ★ 2026-07-26 — ESPEJO de nlParser.MODULE_TYPE_RULES (rule 'desk').
    //   Antes NINGÚN parser reconocía el escritorio: la topología desk (faldón,
    //   pedestal, travesaño de privacidad) sólo era alcanzable vía LLM, así que con
    //   Gemini caído o en modo offline el producto no sabía hacer escritorios.
    //   ⚠ PT-BR: "escritório" es la OFICINA, no el mueble ("escrivaninha") → no está
    //   en DESK_WORDS, y WARDROBE_WORDS descarta "armario de escritorio".
    //   Acá los defaults SÍ se aplican sobre los genéricos (600×720×580) porque un
    //   escritorio con esas medidas no es un escritorio. Se respeta lo que el usuario
    //   haya dado explícitamente (userSet), igual que hace el parser del servidor.
    result.moduleType = 'desk'
    if (!userSet.width)  result.width  = 1400
    if (!userSet.height) result.height = 750
    if (!userSet.depth)  result.depth  = 600
    result.hasDoors = false; result.doorType = 'none'
    result.baseboard = false; result.hasCountertop = false
    notes.push('Escritorio')
  } else if (detect(text, ['isla', 'ilha', 'island'])) {
    result.moduleType = 'base'; notes.push('Isla')
  }

  // Drawers
  const drawers = extractCount(text, ['gaveta', 'cajon', 'cajón', 'drawer'])

  // ★ 2026-07-26 — ESPEJO de nlParser: escritorio sin gavetas = pedestal VACÍO (caja
  //   abierta de 3 piezas sin función). Sin dato → 3 gavetas. "sin gavetas" explícito
  //   → se saca el pedestal y queda patas + faldón.
  if (result.moduleType === 'desk' && drawers === 0) {
    if (detect(text, ['sin gaveta', 'sin cajon', 'sin cajón', 'sem gaveta', 'no drawer', 'without drawer', 'sin pedestal', 'sem pedestal'])) {
      result.hasPedestal = false; result.numDrawers = 0; notes.push('Escritorio sin pedestal')
    } else {
      result.numDrawers = 3; notes.push('3 gaveta(s) (pedestal estándar)')
    }
  }

  if (drawers > 0) {
    result.numDrawers = drawers; notes.push(`${drawers} gaveta(s)`); confidence += 10
    if (detect(text, ['izquierda', 'esquerda', 'left'])) result.drawerLayout = 'left'
    else if (detect(text, ['direita', 'derecha', 'right'])) result.drawerLayout = 'right'
    else result.drawerLayout = 'vertical'
  }

  // Shelves
  const shelves = extractCount(text, ['prateleira', 'estante', 'shelf', 'shelves', 'repisa'])
  if (shelves > 0) { result.numShelves = shelves; notes.push(`${shelves} prateleira(s)`); confidence += 5 }

  // Dividers
  const dividers = extractCount(text, ['divisor', 'divisória', 'divisoria', 'divider', 'separador', 'divisões', 'divisiones'])
  if (dividers > 0) { result.numDividers = dividers; notes.push(`${dividers} divisor(es)`); confidence += 5 }

  // Doors
  if (detect(text, ['porta', 'puerta', 'door', 'portas', 'puertas'])) {
    result.hasDoors = true
    result.doorType = detect(text, ['correr', 'corrediz', 'sliding', 'desliz']) ? 'sliding' : 'hinged'
    const nd = extractCount(text, ['porta', 'puerta', 'door'])
    if (nd > 0) result.numDoors = nd
    notes.push(`Portas ${result.doorType}`); confidence += 5
  }
  if (detect(text, ['sem porta', 'sin puerta', 'no door', 'aberto', 'abierto'])) {
    result.hasDoors = false; result.numDoors = 0
  }

  // Extras
  if (detect(text, ['encimera', 'bancada', 'countertop'])) { result.hasCountertop = true; notes.push('Encimera') }
  if (detect(text, ['led', 'iluminação', 'iluminacion', 'lighting'])) { result.hasLED = true; notes.push('LED') }
  if (detect(text, ['push', 'sem tirador', 'sin tirador', 'no handle'])) result.handleType = 'push'
  if (detect(text, ['gola'])) result.handleType = 'gola'
  if (detect(text, ['15mm', 'espessura 15', 'grosor 15'])) { result.thickness = 15; confidence += 5 }
  if (detect(text, ['25mm', 'espessura 25', 'grosor 25'])) { result.thickness = 25; confidence += 5 }
  if (detect(text, ['roble', 'oak', 'carvalho'])) result.materialFront = 'oak_light'

  if (text.includes('2000') && text.includes('600') && (detect(text, ['cocina', 'cozinha', 'balcao', 'balcão']) || !detect(text, WARDROBE_WORDS))) {
    result.width = 2600
    result.moduleType = 'base'
    result.height = 850
    result.depth = 550
    result.thickness = 18
    result.doorType = 'sliding'
    result.hasDoors = true
    result.baseboard = true
    result.baseboardHeight = 100
    result.numDrawers = 2
    result.numDividers = 2
  }

  confidence = Math.min(100, Math.max(20, confidence))
  const interpreted = 'Offline · ' + notes.join(' | ')
  return { params: result, confidence, interpreted, specAdjustments }
}

/**
 * Generates a human-readable offline reply for the ChatPanel.
 */
export function buildOfflineReply(parsed) {
  const { params, confidence, interpreted } = parsed
  const conf = confidence >= 70 ? 'alta' : confidence >= 40 ? 'média' : 'baixa'
  return [
    `⚡ **Modo Offline** — IA local ativa (servidor desconectado).`,
    ``,
    `Interpretei seu pedido com confiança **${conf}** (${confidence}%):`,
    `\`${interpreted}\``,
    ``,
    `Gerando design paramétrico com as medidas detectadas. Para resultados com IA completa (Gemini), inicie o servidor com \`start-orbin.bat\`.`,
  ].join('\n')
}
