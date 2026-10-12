/**
 * Orbin AI — Diccionario i18n de OBSERVACIONES Y AJUSTES (specAdjustments)
 * (★ ADITIVO 2026-07-26)
 *
 * Arquitectura idéntica a client/src/engine/pieceNames.js:
 *  - Normalización de idioma (pt-BR → PT, en_US → EN, fallback PT).
 *  - Plantillas por adj.code con interpolación de {placeholders}.
 *  - FALLBACK RUIDOSO/SEGURO: si el código no se reconoce o falta un parámetro,
 *    se devuelve adj.message TAL CUAL para que una observación NUNCA desaparezca del plano.
 *  - La plantilla en ES replica exactamente el texto original en español.
 */

const LANG_IDX = { ES: 0, PT: 1, EN: 2 }

export function normLang(lang) {
  const k = String(lang || '').trim().toUpperCase().split(/[-_]/)[0]
  return ['ES', 'PT', 'EN'].includes(k) ? k : 'PT'
}

const ADJUSTMENT_TEMPLATES = {
  NLP_UNIT_INFERRED: [
    '"{field}" recibido como {value} (metros). Se interpretó como {asMM}mm.',
    '"{field}" recebido como {value} (metros). Foi interpretado como {asMM}mm.',
    '"{field}" received as {value} (meters). Interpreted as {asMM}mm.'
  ],
  NLP_VALUE_UNPARSEABLE: [
    'No se pudo interpretar "{raw}" para "{field}". Se ignoró el valor.',
    'Não foi possível interpretar "{raw}" para "{field}". O valor foi ignorado.',
    'Could not interpret "{raw}" for "{field}". Value was ignored.'
  ],
  NLP_VALUE_CLAMPED: [
    '"{field}" solicitado en {requested}mm está fuera del rango fabricable ({lo}–{hi}mm). Se ajustó a {clamped}mm.',
    '"{field}" solicitado em {requested}mm está fora do alcance fabricável ({lo}–{hi}mm). Foi ajustado para {clamped}mm.',
    '"{field}" requested at {requested}mm is outside the manufacturable range ({lo}–{hi}mm). Adjusted to {clamped}mm.'
  ],
  ASSUMED_DEFAULT: [
    'No especificaste {fieldLabel}. Se aplicó el estándar comercial de marcenaria: {assumed}mm. Podés cambiarlo cuando quieras.',
    'Não especificou {fieldLabel}. Aplicou-se o padrão comercial de marcenaria: {assumed}mm. Pode alterar a qualquer momento.',
    'You didn\'t specify {fieldLabel}. Commercial woodwork default was applied: {assumed}mm. You can change it anytime.'
  ],
  ASSUMED_DEFAULT_DOORS: [
    'Pediste puertas sin indicar cuántas. Con {width}mm de ancho se asignaron {numDoors} hoja(s).',
    'Solicitou portas sem indicar quantas. Com {width}mm de largura foram atribuídas {numDoors} folha(s).',
    'Requested doors without specifying how many. With {width}mm width, {numDoors} door leaf/leaves were assigned.'
  ],
  NLP_ENUM_INVALID: [
    'Valor "{value}" no válido para "{field}". Valores admitidos: {allowed}. Se usó el default del motor.',
    'Valor "{value}" inválido para "{field}". Valores permitidos: {allowed}. Foi usado o padrão do motor.',
    'Invalid value "{value}" for "{field}". Allowed values: {allowed}. Engine default was used.'
  ],
  DRAWERS_REQUIRE_PEDESTAL: [
    'Se solicitaron {requested} gavetas pero el escritorio es SIMPLE (hasPedestal:false). Las gavetas requieren cajonera/pedestal para fijar las correderas.',
    'Foram solicitadas {requested} gavetas mas a escrivaninha é SIMPLES (hasPedestal:false). As gavetas requerem gaveteiro/pedestal para fixar as corrediças.',
    'Requested {requested} drawers but the desk is SIMPLE (hasPedestal:false). Drawers require a pedestal cabinet to mount slides.'
  ],
  DRAWER_COUNT_REDUCED: [
    'Se solicitaron {requested} gavetas pero solo caben {applied} en la altura interna útil (mínimo 80mm por gaveta + 16mm de corredera). Aumente la altura del módulo o reduzca el pedido.',
    'Foram solicitadas {requested} gavetas mas só cabem {applied} na altura interna útil (mínimo 80mm por gaveta + 16mm de corrediça). Aumente a altura do módulo ou reduza o pedido.',
    'Requested {requested} drawers but only {applied} fit in usable internal height (min 80mm per drawer + 16mm clearance). Increase module height or reduce request.'
  ],
  DRAWER_COUNT_REDUCED_DESK: [
    'Se solicitaron {requested} gavetas pero solo caben {applied} en el pedestal ({drawerZone}mm útiles bajo el travesaño).',
    'Foram solicitadas {requested} gavetas mas só cabem {applied} no gaveteiro ({drawerZone}mm úteis sob a travessa).',
    'Requested {requested} drawers but only {applied} fit in the pedestal ({drawerZone}mm usable space under top rail).'
  ],
  DRAWER_PRIVACY_PANEL: [
    'Travesaño de cierre de {railH}mm pegado al tampo (privacidad); las gavetas se ajustaron a {dh}mm de alto para llenar el pedestal.',
    'Travessa de fecho de {railH}mm junta ao tampo (privacidade); as gavetas foram ajustadas para {dh}mm de altura para preencher o gaveteiro.',
    'Top privacy rail of {railH}mm attached under top panel; drawers were adjusted to {dh}mm height to fill the pedestal.'
  ],
  DRAWER_HEIGHT_ADJUSTED: [
    'Altura de gaveta ajustada de {requested}mm a {applied}mm para que la pila entre en la altura interna útil.',
    'Altura da gaveta ajustada de {requested}mm para {applied}mm para que a pilha caiba na altura interna útil.',
    'Drawer height adjusted from {requested}mm to {applied}mm so the stack fits inside usable internal height.'
  ],
  CAVA_RAIL_RAISED: [
    'La traviesa de respaldo de la cava no puede ser menor a 50mm. Se ajustó de {requested}mm a {applied}mm.',
    'A travessa de respaldo da cava não pode ser menor que 50mm. Foi ajustada de {requested}mm para {applied}mm.',
    'The cava back-support rail cannot be smaller than 50mm. Adjusted from {requested}mm to {applied}mm.'
  ],
  OVEN_NO_ROOM: [
    'No hay altura para un nicho de horno de {niche}mm más repisa y puerta falsa. Aumentá la altura del módulo o reducí el rodapié. Se omitió la puerta falsa.',
    'Não há altura para um nicho de forno de {niche}mm mais prateleira e porta falsa. Aumente a altura do módulo ou reduza o rodapé. A porta falsa foi omitida.',
    'Not enough height for a {niche}mm oven niche plus shelf and false door. Increase the module height or reduce the baseboard. The false door was omitted.'
  ],
  OVEN_NICHE_ASSUMED: [
    'Se asumió un nicho de horno de {assumed}mm libres sobre la repisa estructural. La puerta falsa cubre la zona bajo la repisa. Podés cambiarlo con ovenNicheHeight.',
    'Assumiu-se um nicho de forno de {assumed}mm livres sobre a prateleira estrutural. A porta falsa cobre a zona abaixo da prateleira. Você pode alterar com ovenNicheHeight.',
    'An oven niche of {assumed}mm clear above the structural shelf was assumed. The false door covers the area below the shelf. You can change it with ovenNicheHeight.'
  ],
  TIE_RAILS_BETWEEN_FRONTS_UNSUPPORTED: [
    'Pediste {count} travesaños entre frentes de gaveta: esa disposición todavía no está soportada. Se generaron los travesaños de amarre superiores (frontal y trasero).',
    'Você pediu {count} travessas entre frentes de gaveta: essa disposição ainda não é suportada. Foram geradas as travessas de amarração superiores (frontal e traseira).',
    'You asked for {count} rails between drawer fronts: that layout is not supported yet. The upper tie rails (front and rear) were generated instead.'
  ],
  NLP_BACK_THICKNESS_ASSUMED: [
    '"{raw}" se interpretó como {value}mm de espesor de fondo (un fondo de {asDepth}mm no es un espesor de panel). Si querías {value} cm de profundidad, indicalo como "profundidad".',
    '"{raw}" foi interpretado como {value}mm de espessura do fundo (um fundo de {asDepth}mm não é espessura de painel). Se queria {value} cm de profundidade, indique como "profundidade".',
    '"{raw}" was interpreted as {value}mm back-panel thickness (a {asDepth}mm back is not a panel thickness). If you meant {value} cm of depth, say "depth".'
  ],
  AEREO_BACK_FORCED_STRUCTURAL: [
    'Fondo de aéreo elevado de {requested}mm a {applied}mm (estructural atornillado): el fondo transmite la carga al riel de pared.',
    'Fundo do aéreo elevado de {requested}mm para {applied}mm (estrutural aparafusado): o fundo transmite a carga ao trilho de parede.',
    'Wall cabinet back panel upgraded from {requested}mm to {applied}mm (screwed structural): back panel transfers weight to wall rail.'
  ],
  NICHE_HEIGHT_ADJUSTED: [
    'Nicho de {requested}mm no deja altura mínima de puerta (150mm): ajustado a {applied}mm.',
    'Nicho de {requested}mm não deixa altura mínima de porta (150mm): ajustado para {applied}mm.',
    'Niche height of {requested}mm leaves insufficient door clearance (min 150mm): adjusted to {applied}mm.'
  ],
  PIECE_EXCEEDS_PLATE: [
    '{count} pieza(s) de {thickness}mm no caben en la chapa {plateW}×{plateH}mm y quedaron FUERA del plan de corte: {pieceList}. Divida el módulo.',
    '{count} peça(s) de {thickness}mm não cabem na chapa {plateW}×{plateH}mm e ficaram FORA do plano de corte: {pieceList}. Divida o módulo.',
    '{count} piece(s) of {thickness}mm do not fit on {plateW}×{plateH}mm plate and were EXCLUDED from cut list: {pieceList}. Split the module.'
  ],
  BACK_PANEL_SPLIT: [
    'El fondo ({pieceList}) no cabe entero en la chapa {plateW}×{plateH}mm: se cortará en 2 partes para unir con regla de MDF. El material ya está contabilizado.',
    'O fundo ({pieceList}) não cabe inteiro na chapa {plateW}×{plateH}mm: será cortado em 2 partes para unir com régua de MDF. O material já está contabilizado.',
    'Back panel ({pieceList}) does not fit whole on {plateW}×{plateH}mm plate: it will be split in 2 parts to join with MDF batten. Material is accounted for.'
  ],
  NLP_VALUE_IMPLAUSIBLE: [
    'El valor "{rawStr}" para "{field}" no es plausible en ningún sistema de unidades (rango: {lo}-{hi}mm).',
    'O valor "{rawStr}" para "{field}" não é plausível em nenhum sistema de unidades (alcance: {lo}-{hi}mm).',
    'Value "{rawStr}" for "{field}" is not plausible in any unit system (range: {lo}-{hi}mm).'
  ],
  NLP_UNIT_AMBIGUOUS: [
    '"{rawStr}" para {field} puede ser {listStr}; se interpretó {chosen}mm (típico para {moduleType}). Confirmá si no es lo que querías.',
    '"{rawStr}" para {field} pode ser {listStr}; interpretou-se {chosen}mm (típico para {moduleType}). Confirme se não é o que pretendia.',
    '"{rawStr}" for {field} could be {listStr}; interpreted as {chosen}mm (typical for {moduleType}). Confirm if this was intended.'
  ]
}

/**
 * Localiza un mensaje de ajuste/observación (specAdjustments) según el idioma.
 * Si el código no existe o falta algún parámetro, devuelve adj.message intacto.
 */
export function localizeAdjustment(adj, lang) {
  if (!adj || typeof adj !== 'object') return ''
  const fallback = typeof adj.message === 'string' ? adj.message : ''
  const code = adj.code
  if (!code) return fallback

  const L = normLang(lang)
  const idx = LANG_IDX[L]

  // Consolidar parámetros directos y nested
  const p = { ...adj, ...(adj.params || {}) }

  // Extraer pieceList si piezas es un array de objetos/strings
  if (!p.pieceList && Array.isArray(p.pieces)) {
    p.pieceList = p.pieces.map(pc => typeof pc === 'object' ? (pc.id || pc.name) : String(pc)).join(', ')
  }
  if (!p.count && Array.isArray(p.pieces)) {
    p.count = p.pieces.length
  }
  if (!p.plateW) p.plateW = 2750
  if (!p.plateH) p.plateH = 1840

  let templateKey = code
  if (code === 'ASSUMED_DEFAULT' && p.field === 'numDoors') {
    templateKey = 'ASSUMED_DEFAULT_DOORS'
  } else if (code === 'DRAWER_COUNT_REDUCED' && p.drawerZone !== undefined) {
    templateKey = 'DRAWER_COUNT_REDUCED_DESK'
  }

  const templates = ADJUSTMENT_TEMPLATES[templateKey]
  if (!templates) return fallback

  const template = templates[idx]
  if (!template) return fallback

  if (code === 'ASSUMED_DEFAULT' && !p.fieldLabel && p.field) {
    const labels = {
      width:  { ES: 'el ancho',        PT: 'a largura',       EN: 'width' },
      height: { ES: 'la altura',       PT: 'a altura',        EN: 'height' },
      depth:  { ES: 'la profundidad',  PT: 'a profundidade',  EN: 'depth' }
    }
    p.fieldLabel = labels[p.field]?.[L] || p.field
  }

  let missingParam = false
  const result = template.replace(/\{(\w+)\}/g, (match, keyName) => {
    if (p[keyName] !== undefined && p[keyName] !== null) {
      return String(p[keyName])
    }
    missingParam = true
    return match
  })

  if (missingParam) {
    return fallback
  }

  return result
}

export default localizeAdjustment
