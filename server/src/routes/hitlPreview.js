/**
 * Orbin AI — HITL Preview Helper  (ADITIVO, 2026-07-23)
 * ─────────────────────────────────────────────────────────────────────────────
 * Modo "Validación y Propuesta Previa": el motor calcula el despiece SÓLO para
 * validar estructuralmente (furnitureMathSpecs / validator), pero en la Fase 1 NO
 * se renderiza ni se persiste. Se devuelve una previsualización TEXTUAL pidiendo
 * confirmación. La generación definitiva ocurre en el turno 2 (Fase 2).
 *
 * DECISIÓN ARQUITECTÓNICA (stateless confirm):
 *   El servidor NO retiene la propuesta en memoria entre turnos (sessions es un
 *   Map de proceso → muere en redeploy / multi-instancia de Railway). En su lugar
 *   devuelve `proposedParams` al cliente, que los reenvía con action:'confirm'.
 *   El servidor sólo cachea como RESILIENCIA secundaria; la fuente autoritativa
 *   es el echo del cliente.
 */

// Señales de confirmación explícita por NLP (fallback; el flag action:'confirm'
// del cliente es la fuente primaria y determinista).
const CONFIRM_WORDS = [
  'confirmo', 'confirmar', 'confirmado', 'confirma',
  'si', 'sí', 'sim', 'yes', 'ok', 'okay', 'dale', 'genera', 'generar', 'generá',
  'apruebo', 'aprobar', 'aprobado', 'aprovo', 'aprovar', 'aprovado', 'approve', 'approved',
  'adelante', 'procede', 'proceder', 'hazlo', 'fazer', 'go ahead',
]
const CANCEL_WORDS = ['no', 'nao', 'não', 'cancela', 'cancelar', 'cancel', 'espera', 'aguarda', 'cambia', 'cambiar', 'mudar', 'change']

/**
 * ¿El turno actual es una confirmación explícita?
 * Prioridad: flag determinista del cliente > NLP.
 * @returns {'confirm'|'cancel'|null}
 */
function detectConfirmation({ action, message } = {}) {
  if (action === 'confirm') return 'confirm'
  if (action === 'cancel' || action === 'discard') return 'cancel'
  if (typeof message !== 'string') return null
  const norm = message.trim().toLowerCase().replace(/[.!¡¿?,]/g, '')
  if (!norm) return null
  const tokens = norm.split(/\s+/)
  // Frase corta y afirmativa: evita falsos positivos en descripciones largas
  // ("no quiero cajones" NO debe confirmar; "un sí a las puertas" tampoco genera).
  if (tokens.length <= 4) {
    if (tokens.some(t => CANCEL_WORDS.includes(t))) return 'cancel'
    if (tokens.some(t => CONFIRM_WORDS.includes(t))) return 'confirm'
  }
  return null
}

const L = (lang) => (['ES', 'PT', 'EN'].includes(lang) ? lang : 'ES')

const T = {
  ES: {
    moduleName: { standard: 'Closet/Armario', base: 'Módulo bajo', aereo: 'Aéreo', desk: 'Escritorio',
      kitchen_oven: 'Módulo Horno', kitchen_sink: 'Módulo Fregadero',
      kitchen_drawers: 'Cajonera', kitchen_niche: 'Nicho Abierto' },
    propose: 'Propongo generar el siguiente diseño',
    dims: 'Medidas', comps: 'Componentes', none: 'estructura simple',
    doors: 'puertas', drawers: 'cajones', shelves: 'estantes', dividers: 'divisores',
    hanging: 'colgador', counter: 'encimera', led: 'iluminación LED',
    assumptions: 'Supuestos aplicados',
    warnings: 'Avisos estructurales',
    ask: '¿Apruebas la generación? Respondé "sí" o tocá Confirmar para producir el despiece completo.',
    rejected: 'No puedo generar este diseño tal como está: hay errores estructurales que impiden la fabricación.',
    fixFirst: 'Ajustá los datos y volvé a proponerlo.',
  },
  PT: {
    moduleName: { standard: 'Guarda-roupa', base: 'Módulo baixo', aereo: 'Aéreo', desk: 'Escrivaninha',
      kitchen_oven: 'Módulo Forno', kitchen_sink: 'Módulo Pia',
      kitchen_drawers: 'Gaveteiro', kitchen_niche: 'Nicho Aberto' },
    propose: 'Proponho gerar o seguinte projeto',
    dims: 'Medidas', comps: 'Componentes', none: 'estrutura simples',
    doors: 'portas', drawers: 'gavetas', shelves: 'prateleiras', dividers: 'divisórias',
    hanging: 'cabideiro', counter: 'tampo', led: 'iluminação LED',
    assumptions: 'Suposições aplicadas',
    warnings: 'Avisos estruturais',
    ask: 'Aprova a geração? Responda "sim" ou toque em Confirmar para produzir o plano de corte completo.',
    rejected: 'Não posso gerar este projeto como está: há erros estruturais que impedem a fabricação.',
    fixFirst: 'Ajuste os dados e proponha novamente.',
  },
  EN: {
    moduleName: { standard: 'Closet/Wardrobe', base: 'Base cabinet', aereo: 'Wall cabinet', desk: 'Desk',
      kitchen_oven: 'Oven Cabinet', kitchen_sink: 'Sink Cabinet',
      kitchen_drawers: 'Drawer Bank', kitchen_niche: 'Open Niche' },
    propose: 'I propose generating the following design',
    dims: 'Dimensions', comps: 'Components', none: 'simple structure',
    doors: 'doors', drawers: 'drawers', shelves: 'shelves', dividers: 'dividers',
    hanging: 'hanging rail', counter: 'countertop', led: 'LED lighting',
    assumptions: 'Assumptions applied',
    warnings: 'Structural notes',
    ask: 'Approve generation? Reply "yes" or tap Confirm to produce the full cut list.',
    rejected: 'I cannot generate this design as-is: there are structural errors that block manufacturing.',
    fixFirst: 'Adjust the values and propose again.',
  },
}

function componentList(p, t) {
  const parts = []
  if (p.numDoors > 0 || p.hasDoors) parts.push(`${p.numDoors || 2} ${t.doors}`)
  if (p.numDrawers > 0) parts.push(`${p.numDrawers} ${t.drawers}`)
  if (p.numShelves > 0) parts.push(`${p.numShelves} ${t.shelves}`)
  if (p.numDividers > 0) parts.push(`${p.numDividers} ${t.dividers}`)
  if (p.hasHangingRod) parts.push(t.hanging)
  if (p.hasCountertop) parts.push(t.counter)
  if (p.hasLed) parts.push(t.led)
  return parts.length ? parts.join(', ') : t.none
}

/**
 * Construye el mensaje de previsualización textual de la Fase 1.
 * @param {object} args
 * @param {object} args.params        params normalizados que se van a fabricar
 * @param {object} args.validation    salida de validateDesign(design)
 * @param {Array}  args.specAdjustments  supuestos de la capa NLP + motor
 * @param {string} args.lang
 * @returns {{ text: string, viable: boolean }}
 */
function buildPreviewMessage({ params, validation, specAdjustments = [], lang }) {
  const t = T[L(lang)]
  const name = t.moduleName[params.moduleType] || t.moduleName.standard
  const viable = !validation || validation.status !== 'RECHAZADO'

  if (!viable) {
    const errs = (validation.errors || []).map(e => `• ${e}`).join('\n')
    return { viable: false, text: `${t.rejected}\n\n${errs}\n\n${t.fixFirst}` }
  }

  const lines = []
  lines.push(`${t.propose} — **${name}**:`)
  lines.push(`• ${t.dims}: ${params.width} × ${params.height} × ${params.depth} mm`)
  lines.push(`• ${t.comps}: ${componentList(params, t)}`)

  const assumed = specAdjustments.filter(a => a && (a.code === 'ASSUMED_DEFAULT' || a.code === 'NLP_VALUE_CLAMPED'))
  if (assumed.length) {
    lines.push('')
    lines.push(`${t.assumptions}:`)
    for (const a of assumed) lines.push(`• ${a.message}`)
  }

  const warns = (validation && validation.warnings) || []
  if (warns.length) {
    lines.push('')
    lines.push(`${t.warnings}:`)
    for (const w of warns) lines.push(`• ${w}`)
  }

  lines.push('')
  lines.push(t.ask)
  return { viable: true, text: lines.join('\n') }
}

module.exports = { detectConfirmation, buildPreviewMessage }
