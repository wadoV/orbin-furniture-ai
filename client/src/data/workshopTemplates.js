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


// ─────────────────────────────────────────────────────────────────────────────
// ★ 2026-10-10 — ILHA COMERCIAL "MOVEIS SOLO GOSA 02"
//   Fuente: lista de corte manuscrita + plano de ensamble del taller (transcritos en el
//   briefing de Eduardo). El `cutList` reproduce LITERALMENTE las cotas del taller —
//   no se corrige ningún número aquí. Las contradicciones internas que hay en esos
//   números las calcula `checkGosa02Consistency()` y se muestran como avisos: confirmar
//   con el jefe de taller antes de cortar.
//   Convención de cotas: `a × b` en el mismo orden en que las escribió el taller.
// ─────────────────────────────────────────────────────────────────────────────
const GOSA02_MATERIALS = Object.freeze({
  MDF15_RIVIERA: { label: 'MDF 15 Riviera', thickness: 15, edge: 'Riviera' },
  MDF18_GRAFITE: { label: 'MDF 18 Grafite / Cru (Ultra)', thickness: 18 },
  MDF_RIVIERA_PUERTA: { label: 'MDF Riviera (puerta, espesor no indicado)', thickness: null },
  MDF6_FONDO: { label: 'MDF 6 ranurado', thickness: 6 },
})

const sideModuleCut = (mod) => ([
  { ref: `${mod}-LAT`,   module: mod, name: 'Lateral',                      a: 404, b: 880, qty: 2, material: 'MDF15_RIVIERA', type: 'lateral' },
  { ref: `${mod}-BASE`,  module: mod, name: 'Base (entre tamponados)',      a: 404, b: 942, qty: 1, material: 'MDF15_RIVIERA', type: 'piso' },
  { ref: `${mod}-REP`,   module: mod, name: 'Repisa (retranqueo 4 mm)',     a: 400, b: 942, qty: 1, material: 'MDF15_RIVIERA', type: 'repisa' },
  { ref: `${mod}-RIPA`,  module: mod, name: 'Ripa de amarre (techo aligerado)', a: 100, b: 942, qty: 2, material: 'MDF15_RIVIERA', type: 'travesano' },
  { ref: `${mod}-FONDO`, module: mod, name: 'Fondo',                        a: 880, b: 972, qty: 1, material: 'MDF6_FONDO',    type: 'fondo' },
  { ref: `${mod}-PTA`,   module: mod, name: 'Puerta Grafite',               a: 500, b: 835, qty: 2, material: 'MDF18_GRAFITE', type: 'standard_door' },
])

const GOSA02_CUTLIST = Object.freeze([
  ...sideModuleCut('M1'),
  { ref: 'M2-LAT',   module: 'M2', name: 'Lateral',                          a: 464, b: 880, qty: 2, material: 'MDF15_RIVIERA', type: 'lateral' },
  { ref: 'M2-BASE',  module: 'M2', name: 'Base',                             a: 464, b: 960, qty: 1, material: 'MDF15_RIVIERA', type: 'piso' },
  { ref: 'M2-REP',   module: 'M2', name: 'Repisa',                           a: 450, b: 960, qty: 1, material: 'MDF15_RIVIERA', type: 'repisa' },
  { ref: 'M2-RIPA',  module: 'M2', name: 'Ripa de amarre (techo aligerado)', a: 100, b: 960, qty: 2, material: 'MDF15_RIVIERA', type: 'travesano' },
  { ref: 'M2-FONDO', module: 'M2', name: 'Fondo',                            a: 880, b: 990, qty: 1, material: 'MDF6_FONDO',    type: 'fondo' },
  { ref: 'M2-PTA',   module: 'M2', name: 'Puerta Riviera',                   a: 490, b: 827, qty: 2, material: 'MDF_RIVIERA_PUERTA', type: 'standard_door' },
  ...sideModuleCut('M3'),
  // ── Conjunto (piezas compartidas por los 3 módulos) ──
  { ref: 'ZOC-FR',   module: 'CONJ', name: 'Zócalo · frente corrido',        a: 120, b: 2700, qty: 2, material: 'MDF18_GRAFITE', type: 'baseboard' },
  { ref: 'ZOC-COST', module: 'CONJ', name: 'Zócalo · costilla transversal',  a: 120, b: 389,  qty: 6, material: 'MDF18_GRAFITE', type: 'baseboard' },
  { ref: 'ZOC-CAB',  module: 'CONJ', name: 'Zócalo · cabecera lateral',      a: 120, b: 270,  qty: 2, material: 'MDF18_GRAFITE', type: 'baseboard' },
  { ref: 'TAMPO',    module: 'CONJ', name: 'Tampo · tramo (2 por límite de placa)', a: 1518, b: 500, qty: 2, material: 'MDF15_RIVIERA', type: 'countertop' },
  { ref: 'FAJA-L',   module: 'CONJ', name: 'Tampo · faja de engrosado larga', a: 2035, b: 100, qty: 2, material: 'MDF15_RIVIERA', type: 'countertop' },
  { ref: 'FAJA-C',   module: 'CONJ', name: 'Tampo · faja de engrosado corta', a: 300,  b: 100, qty: 4, material: 'MDF15_RIVIERA', type: 'countertop' },
  { ref: 'TAMP-EXT', module: 'CONJ', name: 'Tamponado exterior vertical',    a: 490, b: 1000, qty: 2, material: 'MDF18_GRAFITE', type: 'tamponado' },
])

/**
 * Chequeos de consistencia del despiece Gosa 02 (aritmética sobre los propios números
 * del taller). Ninguno bloquea la carga en el visor: son preguntas para el taller.
 * @returns {Array<{level:'error'|'warn'|'info', code:string, text:string}>}
 */
export function checkGosa02Consistency(tpl) {
  const C = (ref) => tpl.cutList.find(p => p.ref === ref)
  const T = 15, F = 18
  const out = []
  const sideW = C('M1-BASE').b + 2 * T, midW = C('M2-BASE').b + 2 * T
  if (sideW !== tpl.declared.sideCarcass.width || midW !== tpl.declared.centralCarcass.width) {
    out.push({ level: 'warn', code: 'CARCASS_WIDTH', text: `Ancho de carcasa declarado ${tpl.declared.sideCarcass.width} mm, pero base ${C('M1-BASE').b} + 2×${T} = ${sideW} mm (laterales) y ${C('M2-BASE').b} + 2×${T} = ${midW} mm (central). Los fondos (${C('M1-FONDO').b} / ${C('M2-FONDO').b}) confirman ${sideW}/${midW}. El visor usa ${sideW}/${midW}.` })
  }
  const carcassRun = 2 * sideW + midW
  const withTamp = carcassRun + 2 * F
  if (withTamp !== tpl.declared.overall.width) {
    out.push({ level: 'warn', code: 'OVERALL_WIDTH', text: `${sideW} + ${midW} + ${sideW} + 2×${F} (tamponados) = ${withTamp} mm ≠ ${tpl.declared.overall.width} mm declarados (Δ ${tpl.declared.overall.width - withTamp} mm).` })
  }
  const tampoLen = C('TAMPO').a * C('TAMPO').qty
  if (tampoLen !== tpl.declared.overall.width) {
    out.push({ level: 'warn', code: 'TAMPO_LENGTH', text: `Tampo 2 × ${C('TAMPO').a} = ${tampoLen} mm vs ${tpl.declared.overall.width} mm de conjunto (Δ ${tampoLen - tpl.declared.overall.width} mm): ¿sobra para refilar en obra o hay vuelo lateral?` })
  }
  const stackH = tpl.declared.plinthHeight + C('M1-LAT').b + tpl.declared.topThickness
  if (stackH !== tpl.declared.overall.height) {
    out.push({ level: 'error', code: 'OVERALL_HEIGHT', text: `Zócalo ${tpl.declared.plinthHeight} + lateral ${C('M1-LAT').b} + tampo ${tpl.declared.topThickness} = ${stackH} mm ≠ ${tpl.declared.overall.height} mm (y el tamponado vertical mide ${C('TAMP-EXT').b}). Falta definir cuál manda: ¿lateral ${tpl.declared.overall.height - tpl.declared.plinthHeight - tpl.declared.topThickness} o alto total ${stackH}?` })
  }
  const plinthDepth = C('ZOC-COST').b + 2 * F
  if (plinthDepth > C('M1-LAT').a) {
    out.push({ level: 'warn', code: 'PLINTH_DEPTH', text: `Zócalo: costilla ${C('ZOC-COST').b} + 2×${F} = ${plinthDepth} mm de fondo > ${C('M1-LAT').a} mm de los módulos laterales (+${plinthDepth - C('M1-LAT').a} mm): ¿el zócalo asoma o va retranqueado respecto al central?${tpl.declared.doorSystem === 'sliding' ? ` Con corredera, el apoyo del riel lo dan las tiras de ${tpl.declared.railStripMm} mm, no el zócalo.` : ''}` })
  }
  if (C('ZOC-CAB').b !== C('ZOC-COST').b) {
    out.push({ level: 'info', code: 'PLINTH_HEAD', text: `Cabecera lateral de zócalo ${C('ZOC-CAB').b} mm ≠ costilla ${C('ZOC-COST').b} mm: confirmar posición de las cabeceras.` })
  }
  const fajaLong = C('FAJA-L').a * C('FAJA-L').qty
  if (fajaLong < 2 * tampoLen * 0.9) {
    out.push({ level: 'warn', code: 'FAJA_PERIMETER', text: `Engrosado perimetral: los 2 cantos largos suman ~${2 * tampoLen} mm y hay ${C('FAJA-L').qty} × ${C('FAJA-L').a} = ${fajaLong} mm de faja larga. ¿Faltan fajas o el engrosado solo va bajo la junta de los tramos?` })
  }
  const sideDoors = C('M1-PTA').a * 2, midDoors = C('M2-PTA').a * 2
  if (tpl.declared.doorSystem === 'sliding') {
    // Correderas: las 2 hojas de un módulo deben SOLAPARSE al cerrar (≈ 20–40 mm),
    // midiendo contra el ancho exterior de la carcasa (la hoja corre por delante).
    const ovSide = sideDoors - sideW, ovMid = midDoors - midW
    const lvl = ovMid < 0 || ovSide < 0 ? 'error' : 'info'
    out.push({ level: lvl, code: 'SLIDING_OVERLAP', text: `Correderas — laterales: 2 × ${C('M1-PTA').a} = ${sideDoors} sobre ${sideW} → solape ${ovSide} mm${ovSide >= 15 && ovSide <= 60 ? ' (coherente)' : ''}. Central: 2 × ${C('M2-PTA').a} = ${midDoors} sobre ${midW} → ${ovMid < 0 ? `FALTAN ${-ovMid} mm: las hojas no se cruzan y queda una ranura a la vista` : `solape ${ovMid} mm`}${ovMid < 0 ? ` (solo cerraría si corren por dentro, entre laterales de ${C('M2-BASE').b}: solape ${midDoors - C('M2-BASE').b} mm). Confirmar.` : '.'}` })
    // Fondo del conjunto: espalda 6 + carcasa + zona de riel = tamponado
    const B = GOSA02_MATERIALS.MDF6_FONDO.thickness, rail = tpl.declared.railStripMm
    const dSide = B + C('M1-LAT').a + rail, dMid = B + C('M2-LAT').a + rail
    out.push({ level: dMid > C('TAMP-EXT').a ? 'warn' : 'info', code: 'RAIL_DEPTH', text: `Fondo con riel: ${B} (espalda) + ${C('M1-LAT').a} + ${rail} (tira de riel) = ${dSide} mm = tamponado ${C('TAMP-EXT').a} ✔ en laterales. Central: ${B} + ${C('M2-LAT').a} + ${rail} = ${dMid} mm > ${C('TAMP-EXT').a}: el resalte de 60 mm invade la zona de riel. ¿El central lleva riel en otro plano, tira más angosta (${C('TAMP-EXT').a - B - C('M2-LAT').a} mm) o no es corredera?` })
    out.push({ level: 'warn', code: 'RAIL_STRIPS_NOT_IN_CUTLIST', text: `Las tiras de ${rail} mm para el riel inferior NO están en la lista de corte (ni largo, ni espesor, ni cantidad). Si no se listan, el operario no las corta. Faltan también los rieles en la lista de herrajes.` })
    if (C('M2-PTA').b !== C('M1-PTA').b) {
      out.push({ level: 'warn', code: 'DOOR_HEIGHT', text: `Alto de hoja: ${C('M1-PTA').b} (laterales, descuento ${C('M1-LAT').b - C('M1-PTA').b} mm) vs ${C('M2-PTA').b} (central, descuento ${C('M2-LAT').b - C('M2-PTA').b} mm) con la misma carcasa de ${C('M1-LAT').b}. En corredera el descuento lo fija el perfil de riel: ¿dos perfiles distintos?` })
    }
  } else {
    out.push({ level: sideDoors > sideW ? 'warn' : 'info', code: 'DOOR_OVERLAY', text: `Puertas laterales 2 × ${C('M1-PTA').a} = ${sideDoors} mm sobre carcasa de ${sideW} (${sideDoors > sideW ? 'sobrepuestas +' + (sideDoors - sideW) : 'holgura ' + (sideW - sideDoors)} mm); central 2 × ${C('M2-PTA').a} = ${midDoors} sobre ${midW} (holgura ${midW - midDoors} mm). Criterios distintos: confirmar.` })
    if (C('M2-PTA').b !== C('M1-PTA').b) {
      out.push({ level: 'info', code: 'DOOR_HEIGHT', text: `Alto de puertas distinto: ${C('M1-PTA').b} (laterales) vs ${C('M2-PTA').b} (central).` })
    }
  }
  const recSide = C('M1-BASE').a - C('M1-REP').a, recMid = C('M2-BASE').a - C('M2-REP').a
  if (recSide !== recMid) {
    out.push({ level: 'info', code: 'SHELF_SETBACK', text: `Retranqueo de repisa: ${recSide} mm en laterales vs ${recMid} mm en el central.` })
  }
  if (C('M1-FONDO').b === sideW) {
    out.push({ level: 'warn', code: 'BACK_GROOVED', text: `Fondo de ${C('M1-FONDO').b} mm = ancho EXTERIOR de carcasa → es un fondo sobrepuesto (clavado), no ranurado. Si va ranurado, mediría ~${C('M1-BASE').b} + ranuras.` })
  }
  if (tpl.cutList.some(p => GOSA02_MATERIALS[p.material]?.thickness == null)) {
    out.push({ level: 'warn', code: 'THICKNESS_MISSING', text: 'Puertas Riviera del módulo central: espesor no indicado.' })
  }
  return out
}

const GOSA02 = {
  id: 'wt-ilha-solo-gosa-02',
  name: 'Ilha Comercial — Moveis Solo Gosa 02',
  category: 'isla',
  source: 'Lista de corte manuscrita + plano de ensamble del taller (2026-10-10)',
  engineReady: false,
  engineReadyReason: 'Zócalo reticular, tampo engrosado en 2 tramos y techo aligerado no existen en closetEngine: el despiece se carga literal desde el taller.',
  viewerReady: true,
  declared: {
    overall: { width: 3010, height: 1000, depth: 490, depthAlt: 500 },
    sideCarcass: { width: 880, height: 880, depth: 404 },      // tal cual el briefing
    centralCarcass: { width: 880, height: 880, depth: 464 },
    plinthHeight: 120,
    topThickness: 30,
    // ★ 2026-10-10 — dato del taller (Eduardo): puertas de CORRER sobre rieles; en el
    //   zócalo se colocaron tiras de 80 mm abajo para instalar el riel inferior.
    //   De ahí la diferencia entre el fondo del tamponado (490) y el de la carcasa (404).
    doorSystem: 'sliding',
    railStripMm: 80,
  },
  materials: GOSA02_MATERIALS,
  cutList: GOSA02_CUTLIST,
  constructionNotes: [
    'Zócalo reticular continuo de 120 mm en MDF 18: 2 frentes corridos de 2700 mm unidos por 6 costillas transversales de 389 mm y 2 cabeceras de 270 mm. Los 3 módulos apoyan sobre el mismo zócalo (nivelar una sola vez).',
    'Tampo engrosado a 30 mm en 2 tramos de 1518 × 500 (MDF 15) por límite de placa: la junta se refuerza por debajo con las fajas de amarre (2 × 2035 × 100 y 4 × 300 × 100, MDF 15) encoladas y atornilladas.',
    'Techo aligerado: cada módulo cierra arriba con 2 ripas de amarre de 100 mm (no lleva techo de placa entera); el tampo apoya sobre las ripas.',
    'Módulo central con resalte frontal: 60 mm más profundo (464 vs 404), alineado por la espalda.',
    'Tamponados exteriores verticales de 490 × 1000 en MDF 18 cierran los extremos de la isla.',
    'Bordes de la estructura en canto Riviera.',
    'Puertas de CORRER sobre rieles (no batientes). En el zócalo se colocan tiras de 80 mm abajo para instalar el riel inferior: por eso el tamponado (490) es más profundo que la carcasa (404). Las hojas de un mismo módulo se solapan al cerrar.',
  ],
  // Composición para el visor (mm). Anchos tomados del despiece (ver CARCASS_WIDTH).
  layout: [
    { key: 'M1', width: 972, depth: 404, x: 0 },
    { key: 'M2', width: 990, depth: 464, x: 972 },
    { key: 'M3', width: 972, depth: 404, x: 1962 },
  ],
  pieces: [],
  rules: [],
  // ★ No se inventan: el taller debe dictarlos para que el despiece sea cortable completo.
  missing: ['tirasRiel80 (largo, espesor, cantidad)', 'perfilRiel (marca/modelo, descuento de alto de hoja)', 'largoRiel por módulo', 'espesorPuertaRiviera'],
}

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
    // ★ 2026-10-10: el despiece real de esta familia llegó como "Moveis Solo Gosa 02".
    //   Se conserva el boceto (950 mm) como histórico; la plantilla vigente es la de abajo.
    supersededBy: 'wt-ilha-solo-gosa-02',
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
  GOSA02,
  {
    id: 'balcao-tamponado-correr-2000',
    name: 'Balcão Tamponado Puertas de Correr 2000',
    category: 'balcao',
    source: 'Template aditivo Orbin AI (puertas de correr)',
    engineReady: true,
    description: 'Balcón base con tamponado y puertas de correr (riel doble). Ideal para área de serviço, cozinha.',
    declared: {
      plinthHeight: 100,
      doorSystem: 'sliding',
    },
    viewerReady: false,
    materials: {
      MDF15: { label: 'MDF 15 Duratex Carvalho', thickness: 15 },
      MDF18: { label: 'MDF 18 Grafite', thickness: 18 },
      MDF6: { label: 'MDF 6 Fundo', thickness: 6 },
    },
    cutList: [
      { ref: 'LAT-1',   module: 'GERAL', name: 'Lateral esquerdo (retranqueo 80mm)',   a: 2000, b: 1120, qty: 2, material: 'MDF15', type: 'lateral' },
      { ref: 'INT-LAT', module: 'GERAL', name: 'Lateral interno (profundidad 420mm)', a: 1970, b: 1120, qty: 2, material: 'MDF15', type: 'lateral' },
      { ref: 'BASE-1',  module: 'GERAL', name: 'Base tamponada',                      a: 2000, b: 520,  qty: 1, material: 'MDF15', type: 'base' },
      { ref: 'TAMPO-1', module: 'GERAL', name: 'Tampo (20mm voladizo)',              a: 2020, b: 540,  qty: 1, material: 'MDF15', type: 'tampo' },
      { ref: 'PORTA-1', module: 'GERAL', name: 'Porta Correr 1 de 2 (traslape 100)', a: 1035, b: 985,  qty: 2, material: 'MDF18', type: 'sliding_door' },
      { ref: 'TRAV-1',  module: 'GERAL', name: 'Traviesa Respaldo Cava 45°',         a: 1970, b: 50,   qty: 1, material: 'MDF15', type: 'travesano' },
      { ref: 'RIPA-1',  module: 'GERAL', name: 'Ripa amarre techo (100mm)',          a: 1970, b: 100,  qty: 2, material: 'MDF15', type: 'travesano' },
    ],
    layout: [
      { key: 'MOD-1', width: 2000, depth: 500, x: 0, y: 0 },
    ],
  },
  // ★ ADITIVO 2026-10-11: Plantilla industrial premium — cocina modular 2800mm lineales
  //   Composición: 2 módulos base gemelos (1400mm c/u) + 2 módulos aéreos acoplados (1400mm c/u)
  //   Acabado: cava CNC 45° en frentes de base, puxador passante (cava inferior) en aéreos,
  //   tamponado lateral integral (envolvente), fondo estructural atornillado en aéreos.
  {
    id: 'wt-cozinha-master-2800',
    name: 'Cozinha Master Grande Cava 2800',
    category: 'cocina',
    source: 'Plantilla industrial premium (2026-10-11)',
    engineReady: false,
    engineReadyReason: 'Requiere composición mixta (base + aéreo) y alineación de tamponado lateral con cava inferior; cliente debe confirmar detalles de instalación eléctrica/plomería.',
    known: {
      totalLengthMm: 2800,
      moduleBase: [
        { type: 'base', width: 1400, height: 850, depth: 550, modules: 2 },
      ],
      moduleAereo: [
        { type: 'aereo', width: 1400, height: 750, depth: 320, modules: 2, mountHeight: 1450 },
      ],
      baseCava: { style: 'cava45', degreesAngle: 45, depthMm: 35 },
      aereoCava: { style: 'puxadorPassante', overhangMm: 30, tamponadoRetranqueoMm: 25 },
      materials: {
        structure: 'MDF 18mm',
        backs: 'MDF 15mm (aéreos), 6mm (base)',
        tamponado: 'MDF 15mm',
      },
      edgeBanding: { type: 'riviera', application: 'frentes + costados' },
      notes: [
        'Base: 2 módulos gemelos de 1400 × 850 × 550 mm en MDF 18 con zócalo 100mm retrasado.',
        'Puertas batientes + gavetas internas con cava CNC 45°.',
        'Aéreo: 2 módulos gemelos de 1400 × 750 × 320 mm en MDF 15.',
        'Puertas con extensión passante 30mm hacia abajo (puxador) + tamponado inferior retranqueado 25mm.',
        'Tamponados laterales exteriores (L + R) en ambos lados, alineados al ras de las fachadas con profundidad D + espesor puerta (15-18mm).',
        'Fondo estructural 15mm atornillado en 4 cantos de aéreos (invariante).',
        'Separación vertical: vano libre 600mm entre bancada + base (850mm) e inicio aéreo (1450mm instalación).',
        'Acabado: pintura/enchapado Riviera en MDF 18 de estructura; frentes en acabado custom (cliente).',
      ],
    },
    // ★ ADITIVO 2026-10-12 — parámetros de closetEngine por cuerpo (fuente única para motor y test).
    //   No altera engineReady (la composición mixta base+aéreo sigue siendo manual).
    //   Base: tamponados exteriores a ras de los frentes (el motor suma el espesor de puerta en Z).
    //   Aéreo: cava inferior → puertas +30mm, tamponado lateral 780, tamponado inferior retranqueado 25.
    engineParams: [
      { ref: 'BASE-L', moduleType: 'base',  width: 1400, height: 850, depth: 550, thickness: 18, hasDoors: true, numDoors: 2, baseboard: true, baseboardHeight: 100, numDrawers: 0, tamponado: 'left',  puxadorCava45: true },
      { ref: 'BASE-R', moduleType: 'base',  width: 1400, height: 850, depth: 550, thickness: 18, hasDoors: true, numDoors: 2, baseboard: true, baseboardHeight: 100, numDrawers: 0, tamponado: 'right', puxadorCava45: true },
      { ref: 'AERO-L', moduleType: 'aereo', width: 1400, height: 750, depth: 320, thickness: 15, hasDoors: true, numDoors: 2, baseboard: false, backStyle: 'screwed', backThickness: 15, mountHeight: 1450, puxadorCavaAereo: true, cavaOverhang: 30, tamponadoInferior: true, tamponado: 'left' },
      { ref: 'AERO-R', moduleType: 'aereo', width: 1400, height: 750, depth: 320, thickness: 15, hasDoors: true, numDoors: 2, baseboard: false, backStyle: 'screwed', backThickness: 15, mountHeight: 1450, puxadorCavaAereo: true, cavaOverhang: 30, tamponadoInferior: true, tamponado: 'right' },
    ],
    viewerReady: false,
    materials: {
      MDF18: { label: 'MDF 18 (estructura base)', thickness: 18 },
      MDF15: { label: 'MDF 15 (aéreo + tamponado)', thickness: 15 },
      MDF6: { label: 'MDF 6 (fondo aéreo)', thickness: 6 },
    },
    cutList: [
      // BASE: Módulo izquierdo (1400 × 850 × 550)
      { ref: 'BASE-L-LAT', module: 'BASE-L', name: 'Lateral base izquierdo (L1400)', a: 1400, b: 850, qty: 2, material: 'MDF18', type: 'lateral' },
      { ref: 'BASE-L-BASE', module: 'BASE-L', name: 'Base/piso interior', a: 1350, b: 550, qty: 1, material: 'MDF18', type: 'base' },
      { ref: 'BASE-L-FONDO', module: 'BASE-L', name: 'Fondo 6mm ranurado', a: 1400, b: 850, qty: 1, material: 'MDF6', type: 'fondo' },
      { ref: 'BASE-L-TAM-L', module: 'BASE-L', name: 'Tamponado lateral izquierdo (envolvente)', a: 1400, b: 880, qty: 1, material: 'MDF15', type: 'tampon_left' },
      { ref: 'BASE-L-PUERTA', module: 'BASE-L', name: 'Puerta batiente (frente + cava 45°)', a: 680, b: 820, qty: 2, material: 'MDF18', type: 'door_with_cava' },
      // BASE: Módulo derecho (1400 × 850 × 550)
      { ref: 'BASE-R-LAT', module: 'BASE-R', name: 'Lateral base derecho (R1400)', a: 1400, b: 850, qty: 2, material: 'MDF18', type: 'lateral' },
      { ref: 'BASE-R-BASE', module: 'BASE-R', name: 'Base/piso interior', a: 1350, b: 550, qty: 1, material: 'MDF18', type: 'base' },
      { ref: 'BASE-R-FONDO', module: 'BASE-R', name: 'Fondo 6mm ranurado', a: 1400, b: 850, qty: 1, material: 'MDF6', type: 'fondo' },
      { ref: 'BASE-R-TAM-R', module: 'BASE-R', name: 'Tamponado lateral derecho (envolvente)', a: 1400, b: 880, qty: 1, material: 'MDF15', type: 'tampon_right' },
      { ref: 'BASE-R-PUERTA', module: 'BASE-R', name: 'Puerta batiente (frente + cava 45°)', a: 680, b: 820, qty: 2, material: 'MDF18', type: 'door_with_cava' },
      // AÉREO: Módulo izquierdo (1400 × 750 × 320)
      { ref: 'AERO-L-LAT', module: 'AERO-L', name: 'Lateral aéreo izquierdo (L1400)', a: 1400, b: 750, qty: 2, material: 'MDF15', type: 'lateral' },
      { ref: 'AERO-L-FONDO', module: 'AERO-L', name: 'Fondo atornillado 15mm', a: 1400, b: 750, qty: 1, material: 'MDF15', type: 'back_screwed' },
      { ref: 'AERO-L-TAM-L', module: 'AERO-L', name: 'Tamponado lateral izquierdo (envolvente + 30mm puxador)', a: 1400, b: 780, qty: 1, material: 'MDF15', type: 'tampon_left' },
      { ref: 'AERO-L-TAM-INF', module: 'AERO-L', name: 'Tamponado inferior (cierre visual, retranq 25mm Z)', a: 1350, b: 305, qty: 1, material: 'MDF15', type: 'tampon_bottom' },
      { ref: 'AERO-L-PUERTA', module: 'AERO-L', name: 'Puerta puxador passante (ext -30mm Y)', a: 680, b: 780, qty: 2, material: 'MDF15', type: 'door_puxador' },
      // AÉREO: Módulo derecho (1400 × 750 × 320)
      { ref: 'AERO-R-LAT', module: 'AERO-R', name: 'Lateral aéreo derecho (R1400)', a: 1400, b: 750, qty: 2, material: 'MDF15', type: 'lateral' },
      { ref: 'AERO-R-FONDO', module: 'AERO-R', name: 'Fondo atornillado 15mm', a: 1400, b: 750, qty: 1, material: 'MDF15', type: 'back_screwed' },
      { ref: 'AERO-R-TAM-R', module: 'AERO-R', name: 'Tamponado lateral derecho (envolvente + 30mm puxador)', a: 1400, b: 780, qty: 1, material: 'MDF15', type: 'tampon_right' },
      { ref: 'AERO-R-TAM-INF', module: 'AERO-R', name: 'Tamponado inferior (cierre visual, retranq 25mm Z)', a: 1350, b: 305, qty: 1, material: 'MDF15', type: 'tampon_bottom' },
      { ref: 'AERO-R-PUERTA', module: 'AERO-R', name: 'Puerta puxador passante (ext -30mm Y)', a: 680, b: 780, qty: 2, material: 'MDF15', type: 'door_puxador' },
    ],
    layout: [
      { key: 'BASE-L', width: 1400, depth: 550, x: 0, y: 0 },
      { key: 'BASE-R', width: 1400, depth: 550, x: 1400, y: 0 },
      { key: 'AERO-L', width: 1400, depth: 320, x: 0, y: 1450 },
      { key: 'AERO-R', width: 1400, depth: 320, x: 1400, y: 1450 },
    ],
    missing: ['confirmacionCliente-distancia-enchufes', 'tipoPintura-frentes', 'pruebaHidraulica-plomeria', 'secuenciaInstalacion'],
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
  // Despiece literal del taller (p. ej. Gosa 02): ley de chapa por pieza + aritmética interna
  for (const p of tpl.cutList || []) {
    const reason = plateOverflow(p.a, p.b)
    if (reason) findings.push({ level: 'error', code: 'PIECE_EXCEEDS_PLATE', text: `${p.ref} ${p.name}: ${p.a} × ${p.b} no entra en placa ${PLATE_LONG_MM} × ${PLATE_SHORT_MM}.` })
  }
  if (tpl.id === 'wt-ilha-solo-gosa-02') findings.push(...checkGosa02Consistency(tpl))
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
/**
 * Módulos listos para el estado de App.jsx / Viewer3D a partir de una plantilla de taller.
 *   · `configuration` alimenta el armado 3D (aproximación visual: el visor dibuja carcasa,
 *     puertas, repisa, zócalo y tampo unificado; NO dibuja ripas, costillas ni fajas).
 *   · `pieces` = despiece LITERAL del taller (no el del motor). `_cutListStale:false` y
 *     `workshopTemplateId` evitan el recálculo automático. Si el usuario edita una medida,
 *     el módulo pasa a ser paramétrico y el motor lo recalcula (deja de ser la plantilla).
 *   · Las piezas de conjunto (zócalo, tampo, fajas, tamponados) cuelgan del módulo central.
 * @returns {Array<object>|null}
 */
export function buildWorkshopModules(templateId) {
  const tpl = getWorkshopTemplate(templateId)
  if (!tpl?.viewerReady || !tpl.layout) return null
  const stamp = Date.now().toString(36)
  const centralKey = tpl.layout[Math.floor(tpl.layout.length / 2)].key
  return tpl.layout.map(L => {
    const own = tpl.cutList.filter(p => p.module === L.key || (L.key === centralKey && p.module === 'CONJ'))
    const pieces = own.map(p => ({
      id: p.ref,
      name: p.module === 'CONJ' ? `Conjunto · ${p.name}` : p.name,
      type: p.type,
      width: p.a,
      height: p.b,
      thickness: tpl.materials[p.material]?.thickness ?? null,
      quantity: p.qty,
      material: tpl.materials[p.material]?.label || p.material,
      source: 'taller',
    }))
    return {
      id: `${tpl.id}-${L.key}-${stamp}`,
      type: 'base',
      name: `${tpl.name} · ${L.key}`,
      workshopTemplateId: tpl.id,
      configuration: {
        moduleType: 'base',
        width: L.width,
        height: tpl.declared.plinthHeight + tpl.cutList.find(p => p.ref === `${L.key}-LAT`).b,
        depth: L.depth,
        thickness: 15,
        backThickness: 6,
        numShelves: 1,
        numDrawers: 0,
        hasDoors: true,
        numDoors: 2,
        doorType: tpl.declared.doorSystem === 'sliding' ? 'sliding' : 'hinged',
        baseboard: true,
        baseboardHeight: tpl.declared.plinthHeight,
        hasCountertop: true,
        materialBody: 'duratex_carvalho_hanover',   // aproximación visual de Riviera
        materialFront: L.key === centralKey ? 'duratex_carvalho_hanover' : 'graphite',
      },
      pieces,
      cutList: pieces,
      position: { x: L.x, y: 0, z: 0 },
      rotation: 0,
      _cutListStale: false,
    }
  })
}
