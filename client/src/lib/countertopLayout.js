/**
 * Orbin AI — Clústeres coplanares de tampo continuo (ADITIVO 2026-10-10)
 *
 * BUG que corrige: la encimera unificada del visor encadenaba módulos solo por cercanía
 * en X (tolerancia 150 mm) y tomaba la ALTURA MÁXIMA de la cadena. Un ropero de 2100 junto
 * a un balcão de 720 generaba un tampo a 2100 mm volando sobre el balcão. Además ignoraba
 * la elevación real del módulo (position.y) y su posición en Z.
 *
 * Regla de taller (función pura, mm, testeable con `node --test`):
 *   Un módulo es ELEGIBLE para tampo si:
 *     · no tiene hasCountertop === false (explícito manda), y
 *     · tiene hasCountertop === true o es tipología base/cocina, y
 *     · no es torre/ropero (altura ≥ 1800 mm), aéreo (colgado) ni escritorio (tampo propio), y
 *     · no está girado (su frente ya no mira a +Z).
 *   Dos elegibles comparten tampo si:
 *     1. son contiguos en X: |xMin_B − xMax_A| ≤ 5 mm
 *     2. su cara superior coincide: |yMax_A − yMax_B| ≤ 2 mm
 *     3. están en la misma fila (sus huellas se solapan en Z)
 *   Ancho del tampo = de xMin del primero a xMax del último del clúster: exactamente la
 *   suma de anchos (más, como mucho, las juntas ≤ 5 mm). Nunca cubre vacío.
 */

export const COUNTERTOP_RULES = Object.freeze({
  TOUCH_TOL_MM: 5,
  LEVEL_TOL_MM: 2,
  TOWER_MIN_HEIGHT_MM: 1800,
  OVERHANG_MM: 10,         // vuelo frontal y trasero (el visor ya usaba 10 + 10)
  THICKNESS_MM: 30,
})

const BASE_TYPES = new Set(['base', 'kitchen_base', 'base_cocina', 'cocina_base', 'base_kitchen'])
const NEVER_TOP = new Set(['aereo', 'desk'])

/** ¿Este módulo puede llevar tampo del sistema unificado? → { ok, reason } */
export function countertopEligibility(module, rotation = 0) {
  const cfg = module?.configuration || {}
  const type = cfg.moduleType || module?.type
  if (cfg.hasCountertop === false) return { ok: false, reason: 'hasCountertop:false' }
  if (!(cfg.hasCountertop === true || BASE_TYPES.has(type) || BASE_TYPES.has(module?.type))) return { ok: false, reason: 'sin tampo' }
  if (NEVER_TOP.has(type)) return { ok: false, reason: type === 'aereo' ? 'aéreo (colgado)' : 'escritorio (tampo propio)' }
  if ((Number(cfg.height) || 0) >= COUNTERTOP_RULES.TOWER_MIN_HEIGHT_MM) return { ok: false, reason: 'torre/ropero ≥ 1800 mm' }
  if (rotation % 360 !== 0) return { ok: false, reason: 'girado' }
  return { ok: true, reason: null }
}

/**
 * @param {Array<{id:string, box:{xMin,xMax,yMin,yMax,zMin,zMax}}>} items  solo elegibles (mm)
 * @returns {Array<{ids:string[], xMin:number, xMax:number, topY:number, zMin:number, zMax:number, width:number}>}
 */
export function buildCountertopClusters(items, { touchTolMm = COUNTERTOP_RULES.TOUCH_TOL_MM, levelTolMm = COUNTERTOP_RULES.LEVEL_TOL_MM } = {}) {
  const sorted = [...(items || [])].filter(i => i && i.box).sort((a, b) => a.box.xMin - b.box.xMin)
  const groups = []
  for (const it of sorted) {
    const g = groups[groups.length - 1]
    const prev = g?.[g.length - 1]
    const joins = prev
      && Math.abs(it.box.xMin - prev.box.xMax) <= touchTolMm
      && Math.abs(it.box.yMax - prev.box.yMax) <= levelTolMm
      && it.box.zMin < prev.box.zMax && prev.box.zMin < it.box.zMax
    if (joins) g.push(it)
    else groups.push([it])
  }
  return groups.map(g => ({
    ids: g.map(i => i.id),
    xMin: g[0].box.xMin,
    xMax: g[g.length - 1].box.xMax,
    // dentro de un clúster las caras difieren ≤ 2 mm: el tampo apoya en la más alta
    topY: Math.max(...g.map(i => i.box.yMax)),
    zMin: Math.min(...g.map(i => i.box.zMin)),
    zMax: Math.max(...g.map(i => i.box.zMax)),
    width: Math.round(g[g.length - 1].box.xMax - g[0].box.xMin),
  }))
}
