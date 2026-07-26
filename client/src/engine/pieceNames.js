/**
 * Orbin AI — Diccionario i18n de NOMBRES DE PIEZA (★ ADITIVO 2026-07-26)
 *
 * DECISIÓN DE ARQUITECTURA: el MOTOR sigue emitiendo nombres CANÓNICOS y no se toca.
 * Esos nombres son identificadores: los usan el nesting, la BOM, el hash de piezas y
 * los tests golden. Traducir en el motor rompería la correspondencia y los candados.
 * La traducción ocurre SOLO en la capa de presentación, igual que el resto del i18n.
 *
 * ⚠ REGLA DE COHERENCIA — la razón por la que este archivo existe y no un `if` suelto:
 * si se traduce el PLANO pero no la ETIQUETA TÉRMICA ni el CSV, el operario recibe una
 * pieza rotulada "Lateral Izquierdo", un plano que dice "Left Side Panel" y un CSV que
 * dice otra cosa — y no puede emparejarlos. Cualquier superficie que muestre un nombre
 * de pieza al taller DEBE pasar por `localizePieceName`. Hay un test que lo verifica.
 *
 * Nombres canónicos observados: mezcla ES/PT ("Tampão Lateral Der" convive con
 * "Lateral Izquierdo") y duplicados por acento ("Cajon"/"Cajón"). Por eso la clave se
 * normaliza (minúsculas, sin acentos) en vez de compararse literal.
 */

// Normaliza para usar como clave: minúsculas, sin acentos, espacios colapsados.
const key = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim()

// [ES, PT, EN] — el ES replica el canónico para que traducir NO cambie nada en español.
const PIECE_NAMES = {
  // ── Carcasa ──
  'lateral izquierdo':   ['Lateral Izquierdo', 'Lateral Esquerda', 'Left Side Panel'],
  'lateral derecho':     ['Lateral Derecho', 'Lateral Direita', 'Right Side Panel'],
  'lateral central':     ['Lateral Central', 'Lateral Central', 'Center Divider'],
  'techo':               ['Techo', 'Tampo Superior', 'Top Panel'],
  'base inferior':       ['Base Inferior', 'Base Inferior', 'Bottom Panel'],
  'fondo':               ['Fondo', 'Fundo', 'Back Panel'],
  'estante':             ['Estante', 'Prateleira', 'Shelf'],
  'puerta':              ['Puerta', 'Porta', 'Door'],

  // ── Travesaños y zócalo ──
  'travesano frontal':   ['Travesaño Frontal', 'Travessa Frontal', 'Front Rail'],
  'travesano trasero':   ['Travesaño Trasero', 'Travessa Traseira', 'Back Rail'],
  'travesano superior':  ['Travesaño Superior', 'Travessa Superior', 'Top Rail'],
  'zocalo frontal':      ['Zócalo Frontal', 'Rodapé Frontal', 'Front Plinth'],
  'zocalo trasero':      ['Zócalo Trasero', 'Rodapé Traseiro', 'Back Plinth'],

  // ── Gavetas / cajones (el motor emite variantes con y sin acento) ──
  'frente gaveta':          ['Frente Gaveta', 'Frente Gaveta', 'Drawer Front'],
  'lateral cajon':          ['Lateral Cajón', 'Lateral Gaveta', 'Drawer Side'],
  'frente/trasera cajon':   ['Frente/Trasera Cajón', 'Frente/Traseira Gaveta', 'Drawer Front/Back'],
  'fondo cajon':            ['Fondo Cajón', 'Fundo Gaveta', 'Drawer Bottom'],

  // ── Escritorio ──
  'tampo escritorio':    ['Tampo Escritorio', 'Tampo Escrivaninha', 'Desk Top'],
  'faldon trasero':      ['Faldón Trasero', 'Saia Traseira', 'Modesty Panel'],
  'costado pedestal':    ['Costado Pedestal', 'Lateral Gaveteiro', 'Pedestal Side'],
  'base pedestal':       ['Base Pedestal', 'Base Gaveteiro', 'Pedestal Bottom'],
  'fondo pedestal':      ['Fondo Pedestal', 'Fundo Gaveteiro', 'Pedestal Back'],

  // ── Cubiertas, nichos y tamponado ──
  'bancada mdf 25mm':                    ['Bancada MDF 25mm', 'Bancada MDF 25mm', 'Countertop MDF 25mm'],
  'repisa cierre nicho':                 ['Repisa Cierre Nicho', 'Prateleira Fecho Nicho', 'Niche Closing Shelf'],
  // groupPieces recorta el paréntesis, así que la clave REAL que llega es la corta.
  // Se mantienen ambas: la larga por si algún consumidor pasa el nombre completo.
  'repisa separadora':                   ['Repisa Separadora', 'Prateleira Separadora', 'Divider Shelf'],
  'repisa separadora (encima gavetas)':  ['Repisa Separadora (encima gavetas)', 'Prateleira Separadora (sobre gavetas)', 'Divider Shelf (above drawers)'],
  'tampao lateral izq':                  ['Tamponado Lateral Izq', 'Tampão Lateral Esq', 'Left Filler Panel'],
  'tampao lateral der':                  ['Tamponado Lateral Der', 'Tampão Lateral Dir', 'Right Filler Panel'],
}

// Palabra del paréntesis "(vano N)" — el motor la emite en ES.
const BAY_WORD = { ES: 'vano', PT: 'vão', EN: 'bay' }

const LANG_IDX = { ES: 0, PT: 1, EN: 2 }
const normLang = (lang) => {
  const k = String(lang || '').trim().toUpperCase().split(/[-_]/)[0]
  return ['ES', 'PT', 'EN'].includes(k) ? k : 'PT'
}

/**
 * Traduce un nombre de pieza conservando su sufijo numérico y su paréntesis.
 *   "Estante 2 (vano 1)" + EN → "Shelf 2 (bay 1)"
 *   "Lateral Izquierdo"  + PT → "Lateral Esquerda"
 * Un nombre DESCONOCIDO se devuelve tal cual: una pieza nueva del motor nunca debe
 * hacer desaparecer su nombre del plano. El test de cobertura avisa si eso pasa.
 */
export function localizePieceName(name, lang) {
  const raw = String(name == null ? '' : name).trim()
  if (!raw) return raw
  const L = normLang(lang)
  const idx = LANG_IDX[L]

  // Separa "Base  3  (vano 2)" → base="Base", num="3", paren="vano 2"
  const m = raw.match(/^(.*?)\s*(\d+)?\s*(?:\(([^)]*)\))?\s*$/)
  const base = (m && m[1] ? m[1] : raw).trim()
  const num = m && m[2] ? m[2] : ''
  const paren = m && m[3] ? m[3].trim() : ''

  const entry = PIECE_NAMES[key(base)]
  const translatedBase = entry ? entry[idx] : base

  let out = translatedBase
  if (num) out += ' ' + num
  if (paren) {
    // "vano 1" → "bay 1" / "vão 1"; si no reconoce la palabra, se deja igual.
    const pm = paren.match(/^(\S+)\s*(.*)$/)
    const head = pm ? pm[1] : paren
    const rest = pm && pm[2] ? ' ' + pm[2] : ''
    const isBay = Object.values(BAY_WORD).some(w => key(w) === key(head))
    out += ` (${isBay ? BAY_WORD[L] + rest : paren})`
  }
  return out
}

/** Los nombres canónicos cubiertos — lo usa el test de cobertura. */
export function knownPieceKeys() {
  return Object.keys(PIECE_NAMES)
}

/** Normalizador expuesto para que el test use la MISMA clave que el diccionario. */
export function pieceNameKey(s) {
  return key(s)
}

/**
 * Quita sufijo numérico y paréntesis, igual que hace `localizePieceName` internamente.
 * ★ Existe porque el test de cobertura comparaba el nombre COMPLETO contra el
 *   diccionario y marcaba "Estante 1" como no traducido cuando sí lo estaba. La
 *   cobertura tiene que medirse sobre la MISMA base que usa la traducción.
 */
export function pieceBaseName(s) {
  const raw = String(s == null ? '' : s).trim()
  const m = raw.match(/^(.*?)\s*(\d+)?\s*(?:\(([^)]*)\))?\s*$/)
  return (m && m[1] ? m[1] : raw).trim()
}

export default localizePieceName
