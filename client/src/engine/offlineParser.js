/**
 * Orbin AI — Offline NL Parser (Browser ESM)
 * Mirrors server/src/engine/nlParser.js — no API calls, 100% client-side.
 * Used as fallback when the Express backend is unreachable.
 */

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

function toDimMM(raw, hasMMSuffix) {
  if (hasMMSuffix) return raw
  return raw < 1000 ? raw * 10 : raw
}

function extractTriple(text) {
  const re = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
  const m = text.match(re)
  if (!m) return null
  const parse = (v, u) => {
    const val = parseFloat(v.replace(',', '.'))
    const unit = u || m[6] || m[4] || m[2] || (val < 10 ? 'm' : val < 300 ? 'cm' : 'mm')
    if (unit === 'm') return Math.round(val * 1000)
    if (unit === 'cm') return Math.round(val * 10)
    return Math.round(val)
  }
  return { width: parse(m[1], m[2]), height: parse(m[3], m[4]), depth: parse(m[5], m[6]) }
}

function extractByKeyword(text, kws) {
  for (const kw of kws) {
    const before = new RegExp('(\\d{3,4})\\s*(mm)?[^\\d]{0,15}' + kw, 'i')
    const mb = text.match(before)
    if (mb) return toDimMM(parseInt(mb[1]), !!mb[2])
    const after = new RegExp(kw + '\\s*[:\\s]{1,3}(\\d{3,4})\\s*(mm)?', 'i')
    const ma = text.match(after)
    if (ma) return toDimMM(parseInt(ma[1]), !!ma[2])
  }
  return null
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
    return { params: { ...DEFAULTS }, confidence: 0, interpreted: 'Entrada vazia.' }
  }

  const raw = input.trim()
  const triple = extractTriple(raw)
  let text = normalizeMeasurements(raw)
  const result = { ...DEFAULTS }
  const notes = []
  let confidence = 0

  // Dimensions
  if (triple) {
    result.width = triple.width; result.height = triple.height; result.depth = triple.depth
    confidence += 40
  } else {
    const w = extractByKeyword(text, ['larg', 'anch', 'width', 'largura', 'ancho'])
    const h = extractByKeyword(text, ['alt', 'height', 'altura', 'alto'])
    const d = extractByKeyword(text, ['prof', 'depth', 'fundo', 'profundidade', 'fondo'])
    if (w) { result.width = w; confidence += 15 }
    if (h) { result.height = h; confidence += 15 }
    if (d) { result.depth = d; confidence += 10 }
    if (!w) {
      const first = text.match(/\b(\d{3,4})\s*mm/)
      if (first) { result.width = parseInt(first[1]); confidence += 5 }
    }
  }
  notes.push(`${result.width}×${result.height}×${result.depth}mm`)

  // Module type
  if (detect(text, ['cocina baja', 'cozinha baixa', 'modulo bajo', 'mueble bajo', 'bajo de cocina'])) {
    result.moduleType = 'base'; result.height = result.height || 900; result.hasCountertop = true; notes.push('Base cocina')
  } else if (detect(text, ['cocina alta', 'cozinha alta', 'aereo', 'suspendido', 'aéreo', 'superior', 'armario superior', 'armário superior'])) {
    result.moduleType = 'aereo'; result.height = result.height || 400; result.depth = result.depth || 320
    result.baseboard = false; result.mountHeight = 1450; notes.push('Aéreo')
  } else if (detect(text, ['isla', 'ilha', 'island'])) {
    result.moduleType = 'base'; notes.push('Isla')
  }

  // Drawers
  const drawers = extractCount(text, ['gaveta', 'cajon', 'cajón', 'drawer'])
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

  confidence = Math.min(100, Math.max(20, confidence))
  const interpreted = 'Offline · ' + notes.join(' | ')
  return { params: result, confidence, interpreted }
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
