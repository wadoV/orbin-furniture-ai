// Orbin — Motor de Alineación Geométrica (Stacking Matrix). BLOQUE 3.
// Puro, sin efectos ni dependencias. Unidades en mm (el visor aplica SCALE).

export const AERIAL_GAP_MM = 600  // salpicadero estándar cocina (base -> aéreo)

export function isAerialModule(mod) {
  const cfg = mod?.configuration || mod || {}
  const t = String(cfg.moduleType || mod?.type || '').toLowerCase()
  return t === 'aereo' || t === 'aerial' || t === 'suspended' || t === 'wall'
}

export function isBaseModule(mod) {
  const cfg = mod?.configuration || mod || {}
  const t = String(cfg.moduleType || mod?.type || '').toLowerCase()
  return t === 'base' || t === 'standard' || t === 'kitchen_low'
}

// Centros X acumulados (mm) replicando el layout left-to-right del visor
// (los módulos firmes se tocan sin gap). No muta la entrada.
export function computeGridCentersMM(modules = []) {
  let acc = 0
  return modules.map(m => {
    const w = Number(m?.configuration?.width) || 600
    const cx = acc + w / 2
    acc += w
    return { id: m.id, module: m, centerXMM: cx, width: w }
  })
}

// Base firme sobre la que se apoya el aéreo: prioriza coincidencia de ancho,
// si no, la última base confirmada. Devuelve { module, centerXMM, width } | null.
export function findBaseForAerial(modules = [], aerialConfig = {}) {
  const bases = computeGridCentersMM(modules).filter(e => isBaseModule(e.module))
  if (!bases.length) return null
  const aw = Number(aerialConfig.width) || 600
  const byWidth = bases.filter(e => Math.abs(e.width - aw) <= Math.max(50, aw * 0.15))
  return byWidth.length ? byWidth[byWidth.length - 1] : bases[bases.length - 1]
}

// Núcleo: el aéreo hereda x/ancho de la base y se calcula su elevación vertical.
// baseModule puede traer _centerXMM inyectado por el llamador (App).
export function calculateAerialAlignment(baseModule, aerialConfig = {}) {
  const baseCfg = baseModule?.configuration || baseModule || {}
  const baseW = Number(baseCfg.width)  || 600
  const baseH = Number(baseCfg.height) || 900
  const baseCenterXMM = Number(baseModule?._centerXMM ?? baseCfg._centerXMM ?? 0)
  return {
    ...aerialConfig,
    width:       baseW,                       // ancho nominal idéntico
    _centerXMM:  baseCenterXMM,               // hereda X horizontal (centro, mm)
    mountHeight: baseH + AERIAL_GAP_MM,       // elevación = altura base + gap 600mm
    _stackedOnId: baseModule?.id || null,     // trazabilidad
  }
}
