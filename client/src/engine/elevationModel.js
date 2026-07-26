/**
 * Orbin AI — Modelo de ALZADO unificado (SSOT de la vista frontal).
 * ─────────────────────────────────────────────────────────────────────────────
 * Fuente ÚNICA de la geometría del alzado, compartida por AMBOS planos:
 *   · Plano Ejecutivo (planRenderer.js → jsPDF)
 *   · Plano de Montaje (planGenerator.js → SVG)
 *
 * Proyecta las PIEZAS REALES del motor (pieces[] con x,y,z) al plano frontal, en
 * milímetros y con y-up (0 = piso). Cada plano solo aplica su escala/encuadre y
 * traduce las primitivas a su backend de dibujo. Al proyectar las piezas reales,
 * CUALQUIER topología (closet, base, aéreo, escritorio, futuros) queda cubierta sin
 * plantillas por tipo — se acabó mantener dos dibujos que divergen.
 */

const VERTICAL = new Set(['lateral', 'divider', 'divisor', 'drawer_box', 'tamponado'])
// ★ 2026-07-23: cubiertas (tampo/bancada/encimera) son HORIZONTALES → de frente se
//   ven como una franja de su ESPESOR, no de su profundidad. Sin esto el tampo del
//   escritorio se dibujaba como un panel de 600mm cubriendo medio mueble.
const HORIZONTAL = new Set(['techo', 'piso', 'base', 'shelf', 'repisa', 'estante', 'drawer_bottom',
  'bancada', 'tampo', 'countertop', 'cubierta'])
// Piezas ocultas en el alzado (interiores no visibles de frente).
const HIDDEN = new Set(['drawer_box', 'drawer_bottom', 'fondo'])
// Orden de profundidad (atrás → adelante): una pieza delantera tapa las aristas
// de lo que hay detrás. Sin esto, cubierta y zócalo cruzaban la carcasa.
const Z_ORDER = {
  fondo: 0, lateral: 1, tamponado: 1, divider: 1, divisor: 1, piso: 2, base: 2, techo: 2,
  shelf: 3, repisa: 3, estante: 3, tie_strip: 3, baseboard: 4, countertop: 5, tampo: 5,
  bancada: 5, cubierta: 5, drawer_front: 6, door: 6, standard_door: 6,
}
const zOf = t => (Z_ORDER[t] !== undefined ? Z_ORDER[t] : 3)
// Piezas macizas: se rellenan (tapan lo de atrás). Puertas/frentes van opacos por
// delante; el resto en trazo abierto.
const SOLID = new Set(['lateral', 'tamponado', 'divider', 'divisor', 'piso', 'base', 'techo',
  'shelf', 'repisa', 'estante', 'tie_strip', 'baseboard', 'countertop', 'tampo', 'bancada', 'cubierta'])

function pieceBox(p) {
  const w = p.width, h = p.height, th = p.thickness, t = p.type, nm = (p.name || '').toLowerCase()
  const side = t === 'drawer_box' && nm.includes('lateral')
  let dx, dy
  if (VERTICAL.has(t) && (t !== 'drawer_box' || side)) { dx = th; dy = h }
  else if (HORIZONTAL.has(t)) { dx = w; dy = th }
  else { dx = w; dy = h }
  return { type: t, name: nm, cx: p.x, cy: p.y, dx, dy }
}

// ¿Es el faldón/modesty panel del vano de piernas? (debe quedar ENTRE las verticales)
function isApron(b) {
  return b.type === 'tie_strip' && /faldon|faldão|faldao|trasero|modesty|apron/.test(b.name || '')
}

function boxesOf(mod) {
  const ps = (mod && mod.pieces && mod.pieces.length) ? mod.pieces : []
  return ps.filter(p => typeof p.x === 'number').map(pieceBox)
}

/** ¿El módulo trae piezas con coordenadas proyectables? (si no, cae al paramétrico) */
export function hasProjectablePieces(mod) {
  return !!(mod && mod.pieces && mod.pieces.some(p => typeof p.x === 'number'))
}

/**
 * Geometría del alzado SIN dibujar. Escala/encuadre único: los planos la usan para
 * el rótulo "E 1:N" y su marco de cotas. `pad` en mm de dibujo (0 para el montaje).
 */
export function elevationBox(mod, ox, oy, areaW, areaH, pad = 20) {
  const cfg = (mod && mod.configuration) || {}
  const W = cfg.width || 600, H = cfg.height || 720
  const sc = Math.min((areaW - 2 * pad) / W, (areaH - 2 * pad) / H)
  const struct = boxesOf(mod).filter(b => ['lateral', 'tamponado', 'techo', 'tie_strip'].includes(b.type))
  const carcassH = struct.length ? Math.max(...struct.map(b => b.cy + b.dy / 2)) : H
  return { x: ox + (areaW - W * sc) / 2, y: oy + (areaH - H * sc) / 2, w: W * sc, h: H * sc, scale: sc, W, H, carcassH }
}

/**
 * Lista ordenada de rectángulos del alzado, en MM (y-up, 0=piso). Cada rect trae su
 * `style` para que el adaptador (jsPDF/SVG) lo pinte igual en ambos planos.
 * @returns {Array<{x0,y0,dx,dy,cx,cy,type,style}>}
 */
export function pieceRectsMM(mod) {
  const boxes = boxesOf(mod).filter(b => !HIDDEN.has(b.type))
  // Verticales que delimitan compartimentos (laterales, divisores, costado de pedestal).
  // Sirven para clampear el faldón del escritorio a su vano REAL: sin esto, una pieza
  // ligeramente corrida (o de un módulo guardado con la posición vieja) pisaba el lateral.
  const verticals = boxes.filter(b => ['lateral', 'divider', 'divisor'].includes(b.type))
  const ordered = [...boxes].sort((a, b) => zOf(a.type) - zOf(b.type))
  return ordered.map(b => {
    let x0 = b.cx - b.dx / 2, x1 = b.cx + b.dx / 2
    let cy = b.cy, dy = b.dy
    const apron = isApron(b)
    if (apron) {
      // Clamp horizontal (SOLO): el faldón nunca pisa los laterales/costados que lo
      // flanquean. NO se toca su ALTURA — el dibujo debe ser FIEL a la pieza real del
      // motor (furnitureMathSpecs.desk.apronHeight). Un clamp de altura haría que el
      // plano MINTIERA respecto a la lista de cortes (defecto grave). Si el faldón debe
      // ser más chico, se corrige en el motor, no aquí.
      let leftBound = -Infinity, rightBound = Infinity
      for (const v of verticals) {
        if (v.cx < b.cx) leftBound = Math.max(leftBound, v.cx + v.dx / 2)
        if (v.cx > b.cx) rightBound = Math.min(rightBound, v.cx - v.dx / 2)
      }
      if (leftBound > -Infinity) x0 = Math.max(x0, leftBound)
      if (rightBound < Infinity) x1 = Math.min(x1, rightBound)
    }
    // El faldón es una pieza TRASERA (z al fondo) vista a través del vano de piernas:
    // estilo propio 'apron' → se dibuja como panel receso (línea oculta/discreta) para
    // que el vano se lea ABIERTO, sin la jerarquía de una pieza frontal maciza.
    const style = apron ? 'apron'
      : b.type === 'drawer_front' ? 'drawer_front'
      : (b.type === 'door' || b.type === 'standard_door') ? 'door'
      : b.type === 'baseboard' ? 'baseboard'
      : SOLID.has(b.type) ? 'solid' : 'open'
    return { x0, y0: cy - dy / 2, dx: x1 - x0, dy, cx: (x0 + x1) / 2, cy, type: b.type, style }
  })
}

export default { pieceRectsMM, elevationBox, hasProjectablePieces }
