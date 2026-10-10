/**
 * Orbin AI — Geometría pura de transformaciones y cotas (ADITIVO 2026-10-10)
 *
 * Sin Three.js ni React: funciones puras en MILÍMETROS para que se puedan testear
 * con `node --test` y reutilizar en planos/exportaciones.
 *
 * Convención de módulo (la misma que ya usaba Viewer3D):
 *   · local X ∈ [-W/2, W/2] (centrado), local Y ∈ [0, H], local Z ∈ [0, D] (fondo en 0, frente en D)
 *   · "ancla" = (centro X, fondo Z) del módulo SIN rotar → es lo que guarda la caché de posiciones
 *   · position (modelo de datos, mm): x = borde izquierdo, y = elevación, z = borde trasero
 *   · rotation: giro en Y, en grados ∈ {0, 90, 180, 270}; pivota sobre el CENTRO de la huella
 *     (el mueble gira en su sitio, no alrededor de su esquina trasera).
 */

export const ROTATION_STEPS = [0, 90, 180, 270]

/** Normaliza cualquier ángulo a 0/90/180/270 (múltiplo de 90 más cercano). */
export function normalizeRotation(deg) {
  const n = Number(deg)
  if (!Number.isFinite(n)) return 0
  const snapped = Math.round(n / 90) * 90
  return ((snapped % 360) + 360) % 360
}

export function nextRotation(deg) {
  return normalizeRotation(normalizeRotation(deg) + 90)
}

/**
 * Desplazamiento (grupo − ancla) que mantiene fijo el centro de la huella al rotar.
 * Rotación R_y(θ) del punto local (0, 0, D/2): (D/2·sinθ, 0, D/2·cosθ).
 * @returns {{dx:number, dz:number}} en las mismas unidades que `depth`
 */
export function rotationOffset(depth, deg) {
  const th = (normalizeRotation(deg) * Math.PI) / 180
  const h = depth / 2
  // redondeo para que 90° dé 0 exacto y no 6e-17
  const r = v => (Math.round(v * 1e6) / 1e6) || 0   // || 0 elimina el -0
  return { dx: r(-h * Math.sin(th)), dz: r(h - h * Math.cos(th)) }
}

/**
 * Caja alineada a ejes (mm) de un módulo en el mundo.
 * @param {{width:number,height:number,depth:number,anchorX:number,anchorZ:number,y?:number,rotation?:number}} m
 */
export function moduleWorldBox({ width, height, depth, anchorX, anchorZ, y = 0, rotation = 0 }) {
  const rot = normalizeRotation(rotation)
  const swap = rot === 90 || rot === 270
  const fx = swap ? depth : width     // extensión en X del mundo
  const fz = swap ? width : depth     // extensión en Z del mundo
  const cx = anchorX
  const cz = anchorZ + depth / 2      // el centro de la huella no se mueve al rotar
  return {
    xMin: cx - fx / 2, xMax: cx + fx / 2,
    yMin: y, yMax: y + height,
    zMin: cz - fz / 2, zMax: cz + fz / 2,
    rotation: rot,
  }
}

/**
 * Plan de cotas. Regla de taller:
 *   · cada módulo lleva sus cotas propias (ancho/alto/profundidad)
 *   · módulos SIN rotar, contiguos en X (separación entre bordes ≤ tolMm) y que se
 *     solapan en profundidad forman una "corrida": cotas parciales + cota total
 *   · un módulo rotado o separado queda fuera de la corrida (cotas individuales)
 * @param {Array<{id:string, box:ReturnType<typeof moduleWorldBox>}>} items  (mm)
 * @returns {{ chains: Array<{ids:string[], xMin:number, xMax:number, total:number, parts:Array<{id:string,xMin:number,xMax:number,length:number}>}>, chainedIds:Set<string> }}
 */
export function buildDimensionPlan(items, { tolMm = 5 } = {}) {
  const eligible = items
    .filter(it => it && it.box && it.box.rotation === 0)
    .sort((a, b) => a.box.xMin - b.box.xMin)

  const groups = []
  for (const it of eligible) {
    const cur = groups[groups.length - 1]
    const prev = cur?.[cur.length - 1]
    const touches = prev
      && Math.abs(it.box.xMin - prev.box.xMax) <= tolMm
      && it.box.zMin < prev.box.zMax && prev.box.zMin < it.box.zMax   // misma fila (solape en Z)
    if (touches) cur.push(it)
    else groups.push([it])
  }

  const chains = groups
    .filter(g => g.length >= 2)
    .map(g => {
      const parts = g.map(it => ({ id: it.id, xMin: it.box.xMin, xMax: it.box.xMax, length: Math.round(it.box.xMax - it.box.xMin) }))
      return {
        ids: g.map(it => it.id),
        xMin: g[0].box.xMin,
        xMax: g[g.length - 1].box.xMax,
        total: Math.round(g[g.length - 1].box.xMax - g[0].box.xMin),
        parts,
      }
    })

  return { chains, chainedIds: new Set(chains.flatMap(c => c.ids)) }
}

/** Texto de la cota corrida: "800 + 1000 = 1800 mm" (hasta 4 partes) o "Total 3600 mm". */
export function chainLabel(chain) {
  if (chain.parts.length <= 4) return `${chain.parts.map(p => p.length).join(' + ')} = ${chain.total} mm`
  return `Total ${chain.total} mm`
}
