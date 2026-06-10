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

// 3-digit bare number near keyword = cm (marcenaria convention: "180 de largura" = 180cm = 1800mm)
// 4-digit number or number followed by "mm" = use as-is
function toDimMM(raw, hasMMSuffix) {
  if (hasMMSuffix) return raw
  return raw < 1000 ? raw * 10 : raw
}

// ─── Dimension Extractors ─────────────────────────────────────────────────────

function extractDimensionTriple(text) {
  const regex = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x*x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?/i
  const m = text.match(regex)
  if (m) {
    const parsePart = (valStr, partUnit) => {
      const val = parseFloat(valStr.replace(',', '.'))
      const unit = partUnit || m[6] || m[4] || m[2] || (val < 10 ? 'm' : (val < 300 ? 'cm' : 'mm'))
      if (unit === 'm') return Math.round(val * 1000)
      if (unit === 'cm') return Math.round(val * 10)
      return Math.round(val)
    }
    return {
      width:  parsePart(m[1], m[2]),
      height: parsePart(m[3], m[4]),
      depth:  parsePart(m[5], m[6])
    }
  }
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
    return { params: { ...DEFAULTS }, confidence: 0, interpreted: 'Entrada vazia — usando padroes.' }
  }

  const rawInput = input.trim()
  const triple = extractDimensionTriple(rawInput)

  let text = rawInput
  text = normalizeMeasurements(text)

  const result = { ...DEFAULTS }
  const notes  = []
  let confidence = 0

  let hadW = false, hadH = false, hadD = false
  if (triple) {
    result.width  = triple.width
    result.height = triple.height
    result.depth  = triple.depth
    hadW = hadH = hadD = true
    confidence += 40
  } else {
    const w = extractDimensionByKeyword(text, ['larg', 'anch', 'width', 'largura', 'ancho'])
    const h = extractDimensionByKeyword(text, ['alt',  'height', 'altura', 'alto'])
    const d = extractDimensionByKeyword(text, ['prof', 'depth', 'fundo', 'profundidade', 'fondo'])

    if (w) { result.width  = w; hadW = true; confidence += 15 }
    if (h) { result.height = h; hadH = true; confidence += 15 }
    if (d) { result.depth  = d; hadD = true; confidence += 15 }

    if (!w) {
      const first = text.match(/\b(\d{3,4})\s*mm/)
      if (first) {
        result.width = parseInt(first[1]); hadW = true
        confidence += 5
      } else {
        // ★ Fallback: número "pelado" de 3–4 dígitos = ancho en mm (ej. "aéreo 600")
        const bare = text.match(/(?:^|\s)(\d{3,4})(?=\s|$)/)
        if (bare) { result.width = parseInt(bare[1]); hadW = true; confidence += 5 }
      }
    }
  }

  // --- Type Detection (ES / PT / EN, acento-insensible) ---
  // moduleType controla a geometria do Viewer3D: 'base' (piso + bancada),
  // 'aereo' (suspenso na parede) e 'standard' (clóset/armário). As dimensões
  // padrão do tipo só se aplicam quando o usuário NÃO as especificou.
  const deburr = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const typeText = deburr(text)
  const hasAny = (kws) => kws.some(kw => typeText.includes(kw))

  const AEREO_KW = ['cocina alta', 'cozinha alta', 'modulo alto', 'mueble alto', 'armario alto',
                    'aereo', 'suspendido', 'suspenso', 'armario superior', 'mueble superior',
                    'upper cabinet', 'wall cabinet', 'wall unit', 'overhead cabinet']
  const BASE_KW  = ['cocina baja', 'cozinha baixa', 'modulo bajo', 'mueble bajo', 'bajo de cocina',
                    'armario base', 'mueble base', 'modulo base', 'gabinete base',
                    'base cabinet', 'lower cabinet', 'bancada']
  const ISLAND_KW = ['isla', 'ilha', 'island']

  if (hasAny(AEREO_KW)) {
    result.type = 'kitchen_high'; result.moduleType = 'aereo';
    if (!hadH) result.height = 700;
    if (!hadD) result.depth = 350;
    notes.push('Tipo: Módulo Alto / Aéreo');
  } else if (hasAny(BASE_KW)) {
    result.type = 'kitchen_low'; result.moduleType = 'base';
    if (!hadH) result.height = 900;
    if (!hadD) result.depth = 600;
    result.hasCountertop = true;
    notes.push('Tipo: Módulo Bajo');
  } else if (hasAny(ISLAND_KW)) {
    result.type = 'kitchen_island'; result.moduleType = 'base';
    notes.push('Tipo: Isla');
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

  const drawers = extractCount(text, ['gaveta', 'cajon', 'cajón', 'drawer', 'gavetao'])
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

  confidence = Math.min(100, Math.max(20, confidence))

  const interpreted = notes.length > 0
    ? 'Interpretado: ' + notes.join(' | ')
    : 'Nenhum dado especifico — usando padroes (' + result.width + 'x' + result.height + 'x' + result.depth + 'mm)'

  return { params: result, confidence, interpreted }
}

module.exports = { parseNaturalLanguage }
