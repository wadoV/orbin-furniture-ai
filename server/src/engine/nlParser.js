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

// 3-digit bare number near keyword = cm (marcenaria convention: "180 de largura" = 180cm = 1800mm)
// 4-digit number or number followed by "mm" = use as-is
function toDimMM(raw, hasMMSuffix) {
  if (hasMMSuffix) return raw
  return raw < 1000 ? raw * 10 : raw
}

// ─── Dimension Extractors ─────────────────────────────────────────────────────

function extractDimensionTriple(text) {
  const m = text.match(/(\d{3,4})\s*(?:mm)?\s*[x*x]\s*(\d{3,4})\s*(?:mm)?\s*[x*x]\s*(\d{3,4})/i)
  if (m) return { width: parseInt(m[1]), height: parseInt(m[2]), depth: parseInt(m[3]) }
  // Also try with the Unicode times sign
  const m2 = text.match(/(\d{3,4})\s*(?:mm)?\s*[×]\s*(\d{3,4})\s*(?:mm)?\s*[×]\s*(\d{3,4})/i)
  if (m2) return { width: parseInt(m2[1]), height: parseInt(m2[2]), depth: parseInt(m2[3]) }
  return null
}

function extractDimensionByKeyword(text, keywords) {
  for (const kw of keywords) {
    // Priority: number BEFORE keyword ("2000mm de largura" / "180 de largura")
    const before = new RegExp('(\\d{3,4})\\s*(mm)?[^\\d]{0,15}' + kw, 'i')
    const mb = text.match(before)
    if (mb) return toDimMM(parseInt(mb[1]), !!mb[2])

    // Fallback: keyword BEFORE number, tight window ("largura: 2400")
    const after = new RegExp(kw + '\\s*[:\\s]{1,3}(\\d{3,4})\\s*(mm)?', 'i')
    const ma = text.match(after)
    if (ma) return toDimMM(parseInt(ma[1]), !!ma[2])
  }
  return null
}

// ─── Count Extractor ──────────────────────────────────────────────────────────

function extractCount(text, keywords) {
  for (const kw of keywords) {
    const patterns = [
      new RegExp('(\\d+)\\s+' + kw, 'i'),
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
    return { params: { ...DEFAULTS }, confidence: 0, interpreted: 'Entrada vazia — usando padroes.' }
  }

  let text = input.trim()
  text = normalizeMeasurements(text)

  const result = { ...DEFAULTS }
  const notes  = []
  let confidence = 0

  const triple = extractDimensionTriple(text)
  if (triple) {
    result.width  = triple.width
    result.height = triple.height
    result.depth  = triple.depth
    notes.push('Dimensoes: ' + triple.width + 'mm L x ' + triple.height + 'mm A x ' + triple.depth + 'mm P')
    confidence += 40
  } else {
    const w = extractDimensionByKeyword(text, ['larg', 'anch', 'width', 'largura', 'ancho'])
    const h = extractDimensionByKeyword(text, ['alt',  'height', 'altura', 'alto'])
    const d = extractDimensionByKeyword(text, ['prof', 'depth', 'fundo', 'profundidade', 'fondo'])

    if (w) { result.width  = w; confidence += 15 }
    if (h) { result.height = h; confidence += 15 }
    if (d) { result.depth  = d; confidence += 15 }

    if (!w) {
      const first = text.match(/\b(\d{3,4})\s*mm/)
      if (first) {
        result.width = parseInt(first[1])
        notes.push('Largura assumida: ' + result.width + 'mm')
        confidence += 5
      }
    }

    if (w || h || d) notes.push('L=' + result.width + ' A=' + result.height + ' P=' + result.depth)
  }

  // --- Type Detection ---
  if (detectFeature(text, ['cocina baja', 'cozinha baixa', 'modulo bajo', 'mueble bajo'])) {
    result.type = 'kitchen_low'; result.height = 900; result.depth = 600;
    notes.push('Tipo: Módulo Bajo');
  } else if (detectFeature(text, ['cocina alta', 'cozinha alta', 'aereo', 'suspendido'])) {
    result.type = 'kitchen_high'; result.height = 700; result.depth = 350;
    notes.push('Tipo: Módulo Alto');
  } else if (detectFeature(text, ['isla', 'ilha', 'island'])) {
    result.type = 'kitchen_island';
    notes.push('Tipo: Isla');
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

  const drawers = extractCount(text, ['gaveta', 'cajon', 'cajón', 'drawer', 'gavetao'])
  if (drawers > 0) { result.numDrawers = drawers; notes.push(drawers + ' gaveta(s)'); confidence += 10 }

  const shelves = extractCount(text, ['prateleira', 'estante', 'shelf', 'shelve', 'repisa'])
  if (shelves > 0) { result.numShelves = shelves; notes.push(shelves + ' prateleira(s)'); confidence += 5 }

  if (detectFeature(text, ['maletero', 'cabideiro', 'cabide', 'hang', 'pendurar'])) {
    result.hasHangingArea = true; notes.push('Cabideiro'); confidence += 5
  }
  if (detectFeature(text, ['porta', 'puerta', 'door'])) {
    result.hasDoors = true
    result.doorType = detectFeature(text, ['correr', 'corrediz', 'sliding', 'desliz']) ? 'sliding' : 'hinged'
    notes.push('Portas: ' + result.doorType)
    confidence += 5
  }
  if (detectFeature(text, ['espelho', 'espejo', 'mirror'])) { result.hasMirror = true; notes.push('Espelho') }
  if (detectFeature(text, ['15mm', 'espessura 15'])) { result.thickness = 15; confidence += 5 }
  if (detectFeature(text, ['borda grossa', 'bordo 2mm', 'pvc 2'])) { result.edgeBandingType = 'thick'; confidence += 3 }

  confidence = Math.min(100, Math.max(20, confidence))

  const interpreted = notes.length > 0
    ? 'Interpretado: ' + notes.join(' | ')
    : 'Nenhum dado especifico — usando padroes (' + result.width + 'x' + result.height + 'x' + result.depth + 'mm)'

  return { params: result, confidence, interpreted }
}

module.exports = { parseNaturalLanguage }
