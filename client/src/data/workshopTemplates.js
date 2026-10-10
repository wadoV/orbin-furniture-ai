/**
 * Orbin AI — Workshop Blueprints (bocetos del jefe de taller) — ADITIVO 2026-10-10
 *
 * Fuente: briefing de Eduardo del 2026-10-10. Las fotos de los bocetos NO están en el
 * repo ni se procesaron en esta sesión: aquí solo hay las cotas que el briefing escribe
 * de forma explícita. Toda cota no confirmada va en `missing` (valor null), NUNCA
 * inventada. Para una herramienta de corte, un número supuesto es peor que un hueco
 * declarado: llega a la escuadradora como si fuera real.
 *
 * Estado: `engineReady: false` en las 4 plantillas. Ninguna es todavía un input válido
 * para closetEngine (faltan profundidades/espesores y, en el pórtico, la topología
 * misma no es un "closet"). Sirven como:
 *   1. referencia de taller con sus reglas duras (empalme, nicho, zócalo reticular…)
 *   2. checklist de lo que falta medir (`missing`)
 *   3. casos de auditoría para el futuro árbitro de planta (Hermes): `auditWorkshopTemplate`
 *
 * Unidades: mm. Placa estándar: 2750 × 1840 (engine/plateFit.js).
 */
import { plateOverflow, PLATE_LONG_MM, PLATE_SHORT_MM } from '../engine/plateFit.js'

export const WORKSHOP_TEMPLATES_VERSION = '2026-10-10'

export const WORKSHOP_TEMPLATES = Object.freeze([
  {
    id: 'wt-portico-router',
    name: 'Pórtico Router',
    category: 'stand',
    source: 'Boceto jefe de taller (briefing 2026-10-10)',
    engineReady: false,
    engineReadyReason: 'Topología de pórtico/estructura, no de módulo-carcasa: closetEngine no la modela.',
    known: {
      spanLengthsMm: [2855, 3005],      // dos largos del pórtico según boceto
      splice: 'escalonado',            // empalme escalonado por exceder la placa
    },
    // Piezas cuya cota larga está confirmada; el ancho de la pieza NO está en el briefing.
    pieces: [
      { key: 'largo-2855', name: 'Travesaño / larguero 2855', length: 2855, width: null },
      { key: 'largo-3005', name: 'Travesaño / larguero 3005', length: 3005, width: null },
    ],
    rules: [
      { code: 'PLATE_SPLICE_STEPPED', text: `Piezas > ${PLATE_LONG_MM} mm se fabrican en 2 tramos con empalme escalonado (juntas desfasadas entre capas).` },
    ],
    missing: ['anchoPieza', 'espesor', 'profundidadPortico', 'alturaPortico', 'solapeEmpalmeMm', 'desfaseEntreJuntasMm', 'numeroCapas'],
  },
  {
    id: 'wt-balcao-frigobar-s25',
    name: 'Balcão Frigobar S-25',
    category: 'balcao',
    source: 'Boceto jefe de taller (briefing 2026-10-10)',
    engineReady: false,
    engineReadyReason: 'Faltan profundidad y altura; el zócalo reticular no existe aún como tipo de base en el motor.',
    known: {
      lengthMm: 2700,
      nicheWidthMm: 561,               // nicho para el frigobar
      plinth: { type: 'reticular', ribs: 15, ribLengthMm: 500, ribHeightMm: 160 },
    },
    pieces: [
      { key: 'tampo', name: 'Tampo / tapa 2700', length: 2700, width: null },
      { key: 'costilla-zocalo', name: 'Costilla zócalo reticular', length: 500, width: 160, quantity: 15 },
    ],
    rules: [
      { code: 'NICHE_CLEAR_WIDTH', text: 'Nicho libre de 561 mm para frigobar (verificar ventilación trasera del equipo).' },
      { code: 'PLINTH_RETICULAR', text: 'Zócalo reticular: 15 costillas 500 × 160 mm.' },
    ],
    missing: ['profundidad', 'altura', 'espesor', 'alturaNicho', 'posicionNicho', 'espesorCostillas', 'separacionCostillas'],
  },
  {
    id: 'wt-isla-tampo-duplo',
    name: 'Módulos Isla Tampo Duplo',
    category: 'isla',
    source: 'Boceto jefe de taller (briefing 2026-10-10)',
    engineReady: false,
    engineReadyReason: 'Faltan ancho/profundidad de módulos, número de módulos y largo total del tampo.',
    known: {
      moduleHeightMm: 950,
      topThicknessMm: 30,              // tampo continuo
      topContinuous: true,
      plinthHeightMm: 120,
    },
    pieces: [
      // El largo del tampo continuo depende del nº de módulos (no confirmado).
      { key: 'tampo-continuo', name: 'Tampo continuo 30 mm', length: null, width: null, thickness: 30 },
    ],
    rules: [
      { code: 'TOP_CONTINUOUS', text: 'Tampo de 30 mm continuo sobre todos los módulos; si su largo supera 2750 mm requiere empalme.' },
      { code: 'PLINTH_120', text: 'Zócalo de 120 mm.' },
    ],
    missing: ['numeroModulos', 'anchoModulo', 'profundidad', 'vueloTampo', 'largoTotalTampo', 'espesorCarcasa'],
  },
  {
    id: 'wt-balcao-gavetero-tamponado',
    name: 'Balcão Gavetero Tamponado',
    category: 'balcao',
    source: 'Boceto jefe de taller (briefing 2026-10-10)',
    engineReady: false,
    engineReadyReason: 'Estructura aligerada con ripas: el motor genera carcasas de panel completo; faltan medidas generales.',
    known: {
      structure: 'aligerada',
      ripaWidthsMm: [50, 70],          // ripas de 50 y 70 mm
      tamponado: true,
    },
    pieces: [],
    rules: [
      { code: 'LIGHT_FRAME_RIPAS', text: 'Estructura con ripas de 50 mm y 70 mm en lugar de paneles completos; tamponado exterior.' },
    ],
    missing: ['ancho', 'altura', 'profundidad', 'numeroGavetas', 'alturaGavetas', 'espesorTamponado', 'ubicacionRipas50vs70'],
  },
])

/** Nº mínimo de tramos para que una pieza de `length` mm entre en la placa. */
export function minSegmentsForLength(length) {
  const L = Number(length)
  if (!Number.isFinite(L) || L <= 0) return null
  return Math.ceil(L / PLATE_LONG_MM)
}

/**
 * Auditoría determinista de una plantilla (precursor del árbitro de planta).
 * Nunca rellena huecos: lo que falta queda reportado como bloqueante de producción.
 * @returns {{ id, releasable: boolean, findings: Array<{level:'error'|'warn'|'info', code, text}> }}
 */
export function auditWorkshopTemplate(tpl) {
  const findings = []
  for (const p of tpl.pieces || []) {
    if (p.length == null) {
      findings.push({ level: 'warn', code: 'PIECE_LENGTH_UNKNOWN', text: `${p.name}: largo no confirmado.` })
      continue
    }
    if (p.length > PLATE_LONG_MM) {
      findings.push({
        level: 'error',
        code: 'PIECE_EXCEEDS_PLATE',
        text: `${p.name}: ${p.length} mm > ${PLATE_LONG_MM} mm → mínimo ${minSegmentsForLength(p.length)} tramos con empalme.`,
      })
    } else if (p.width != null && plateOverflow(p.length, p.width)) {
      findings.push({ level: 'error', code: 'PIECE_EXCEEDS_PLATE', text: `${p.name}: no entra en placa ${PLATE_LONG_MM} × ${PLATE_SHORT_MM}.` })
    }
  }
  if (tpl.missing?.length) {
    findings.push({ level: 'error', code: 'MISSING_DIMENSIONS', text: `Faltan cotas: ${tpl.missing.join(', ')}.` })
  }
  if (!tpl.engineReady) {
    findings.push({ level: 'info', code: 'NOT_ENGINE_READY', text: tpl.engineReadyReason })
  }
  return { id: tpl.id, releasable: !findings.some(f => f.level === 'error'), findings }
}

export function getWorkshopTemplate(id) {
  return WORKSHOP_TEMPLATES.find(t => t.id === id) || null
}
