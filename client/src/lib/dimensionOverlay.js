/**
 * Orbin AI — Cotas CAD y ejes de referencia en Three.js (ADITIVO 2026-10-10)
 *
 * Dibuja en la ESCENA (no en un overlay HTML) para que el PNG exportado del visor
 * incluya las cotas tal cual se ven. Todo con depthTest:false + renderOrder alto:
 * las cotas nunca quedan tapadas por el mueble. Nada de esto entra en meshesRef ni en
 * groupRef → no se selecciona, no se exporta a GLB/AR y el plano no lo hereda.
 *
 * Entradas en MILÍMETROS (cajas de `moduleWorldBox`), salida en unidades de escena
 * (`scale` = 0.1 → 1 unidad = 10 mm, la convención de Viewer3D).
 */
import * as THREE from 'three'
import { buildDimensionPlan, chainLabel } from './dimensionLayout.js'

const ORDER = 999
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export function disposeOverlay(group) {
  if (!group) return
  group.traverse(obj => {
    obj.geometry?.dispose?.()
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : [])
    mats.forEach(m => { m.map?.dispose?.(); m.dispose?.() })
  })
  group.clear()
}

function lineMaterial(color, opacity) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false })
}

function segment(group, a, b, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b])
  const l = new THREE.Line(geo, mat)
  l.renderOrder = ORDER
  group.add(l)
}

function arrowHead(group, tip, dir, len, mat) {
  const geo = new THREE.ConeGeometry(len * 0.32, len, 12)
  const cone = new THREE.Mesh(geo, mat)
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  cone.position.copy(tip).addScaledVector(dir.clone().normalize(), -len / 2)
  cone.renderOrder = ORDER
  group.add(cone)
}

/** Etiqueta tipo "pill" (fondo carbón, borde ámbar) como Sprite: siempre mira a cámara. */
export function makeLabel(text, heightUnits, { fg = '#FFFFFF', border = '#F5A623', bg = 'rgba(13,13,13,0.9)' } = {}) {
  const fontPx = 64
  const font = `700 ${fontPx}px Inter, system-ui, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const padX = 28, padY = 18
  const w = Math.ceil(probe.measureText(text).width + padX * 2)
  const h = fontPx + padY * 2
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const r = h / 2
  ctx.fillStyle = bg
  ctx.strokeStyle = border
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(r, 3); ctx.lineTo(w - r, 3); ctx.arc(w - r, r, r - 3, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(r, h - 3); ctx.arc(r, r, r - 3, Math.PI / 2, -Math.PI / 2); ctx.closePath()
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, w / 2, h / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(heightUnits * (w / h), heightUnits, 1)
  sprite.renderOrder = ORDER + 1
  return sprite
}

/**
 * Cota: línea p1–p2 con flechas, líneas de referencia desde el objeto (o1→p1, o2→p2)
 * y etiqueta desplazada en `labelDir`.
 */
function dimension(group, { p1, p2, o1, o2, text, labelDir, S }) {
  const dir = p2.clone().sub(p1)
  if (dir.length() < 1e-6) return
  const u = dir.clone().normalize()
  segment(group, p1, p2, S.mainMat)
  arrowHead(group, p1, u.clone().negate(), S.arrow, S.headMat)
  arrowHead(group, p2, u, S.arrow, S.headMat)
  for (const [o, p] of [[o1, p1], [o2, p2]]) {
    if (!o) continue
    const e = p.clone().sub(o)
    if (e.length() < 1e-6) continue
    const ed = e.clone().normalize()
    segment(group, o.clone().addScaledVector(ed, S.gap), p.clone().addScaledVector(ed, S.overshoot), S.extMat)
  }
  const label = makeLabel(text, S.labelH)
  label.position.copy(p1.clone().add(p2).multiplyScalar(0.5)).addScaledVector(labelDir, S.labelH * 0.9)
  group.add(label)
}

/**
 * @param {{ items: Array<{id:string, box:object}>, scale:number, tolMm?:number, color?:number,
 *           mode?: 'iso'|'front'|'side', sideIds?: string[] }} opts
 *   mode 'front' (alzado): anchos + corrida + alturas, sin profundidad (en ortogonal frontal
 *                          la profundidad colapsa en un punto).
 *   mode 'side'  (perfil): profundidad + altura de los módulos `sideIds` (por defecto el
 *                          extremo derecho), colocadas para leerse mirando desde +X.
 * @returns {THREE.Group}
 */
export function buildDimensionOverlay({ items, scale, tolMm = 5, color = 0xF5A623, mode = 'iso', sideIds = null }) {
  const group = new THREE.Group()
  group.name = '__orbin_dimensions__'
  group.userData._isOverlay = true
  if (!items?.length) return group

  const V = (x, y, z) => new THREE.Vector3(x * scale, y * scale, z * scale)
  const all = items.map(i => i.box)
  const maxDim = Math.max(
    Math.max(...all.map(b => b.xMax)) - Math.min(...all.map(b => b.xMin)),
    Math.max(...all.map(b => b.yMax)) - Math.min(...all.map(b => b.yMin)),
    Math.max(...all.map(b => b.zMax)) - Math.min(...all.map(b => b.zMin)),
  )
  const off = clamp(maxDim * 0.09, 180, 420)           // mm: separación cota–mueble
  const S = {
    arrow: clamp(maxDim * 0.024, 40, 100) * scale,
    labelH: clamp(maxDim * 0.06, 110, 260) * scale,   // legible a distancia de cámara normal
    gap: 20 * scale,
    overshoot: clamp(maxDim * 0.012, 20, 50) * scale,
    mainMat: lineMaterial(color, 0.95),
    extMat: lineMaterial(color, 0.4),
    headMat: new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }),
  }
  const UP = new THREE.Vector3(0, 1, 0), LEFT = new THREE.Vector3(-1, 0, 0), RIGHT = new THREE.Vector3(1, 0, 0)

  const widthDim = (xMin, xMax, y, z, yObj, text) => dimension(group, {
    p1: V(xMin, y, z), p2: V(xMax, y, z), o1: V(xMin, yObj, z), o2: V(xMax, yObj, z), text, labelDir: UP, S,
  })
  const heightDim = (x, xObj, yMin, yMax, z, side) => dimension(group, {
    p1: V(x, yMin, z), p2: V(x, yMax, z), o1: V(xObj, yMin, z), o2: V(xObj, yMax, z),
    text: `${Math.round(yMax - yMin)} mm`, labelDir: side, S,
  })
  const depthDim = (x, xObj, y, zMin, zMax) => dimension(group, {
    p1: V(x, y, zMin), p2: V(x, y, zMax), o1: V(xObj, y, zMin), o2: V(xObj, y, zMax),
    text: `${Math.round(zMax - zMin)} mm`, labelDir: RIGHT, S,
  })

  // ── Perfil: solo profundidad (arriba) y altura (por delante) del/los extremo(s) ──
  if (mode === 'side') {
    const FRONT = new THREE.Vector3(0, 0, 1)
    const ids = sideIds?.length ? new Set(sideIds) : new Set([items.reduce((a, b) => (b.box.xMax > a.box.xMax ? b : a)).id])
    let level = 0
    for (const it of items) {
      if (!ids.has(it.id)) continue
      const b = it.box
      dimension(group, {
        p1: V(b.xMax, b.yMax + off, b.zMin), p2: V(b.xMax, b.yMax + off, b.zMax),
        o1: V(b.xMax, b.yMax, b.zMin), o2: V(b.xMax, b.yMax, b.zMax),
        text: `${Math.round(b.zMax - b.zMin)} mm`, labelDir: UP, S,
      })
      const zH = b.zMax + off * (1 + level)
      dimension(group, {
        p1: V(b.xMax, b.yMin, zH), p2: V(b.xMax, b.yMax, zH),
        o1: V(b.xMax, b.yMin, b.zMax), o2: V(b.xMax, b.yMax, b.zMax),
        text: `${Math.round(b.yMax - b.yMin)} mm`, labelDir: FRONT, S,
      })
      level++
    }
    return group
  }
  const withDepth = mode !== 'front'

  const plan = buildDimensionPlan(items, { tolMm })
  const byId = new Map(items.map(i => [i.id, i.box]))

  // ── Corridas: parciales (nivel 1) + total (nivel 2) ───────────────────────────
  for (const chain of plan.chains) {
    const boxes = chain.ids.map(id => byId.get(id))
    const top = Math.max(...boxes.map(b => b.yMax))
    const front = Math.max(...boxes.map(b => b.zMax))
    chain.parts.forEach((p, i) => widthDim(p.xMin, p.xMax, top + off, front, boxes[i].yMax, `${p.length} mm`))
    widthDim(chain.xMin, chain.xMax, top + off * 2.2, front, top + off, chainLabel(chain))
    // Altura: la del primero a la izquierda; las distintas, a la derecha en niveles
    const first = boxes[0]
    heightDim(chain.xMin - off, first.xMin, first.yMin, first.yMax, front, LEFT)
    let level = 1
    const seen = new Set([`${first.yMin}|${first.yMax}`])
    for (const b of boxes.slice(1)) {
      const k = `${b.yMin}|${b.yMax}`
      if (seen.has(k)) continue
      seen.add(k)
      heightDim(chain.xMax + off * level, b.xMax, b.yMin, b.yMax, front, RIGHT)
      level++
    }
    const last = boxes[boxes.length - 1]
    if (withDepth) depthDim(chain.xMax + off * level, last.xMax, last.yMin, last.zMin, last.zMax)
  }

  // ── Módulos sueltos (o girados): sus tres cotas ───────────────────────────────
  for (const it of items) {
    if (plan.chainedIds.has(it.id)) continue
    const b = it.box
    widthDim(b.xMin, b.xMax, b.yMax + off, b.zMax, b.yMax, `${Math.round(b.xMax - b.xMin)} mm`)
    heightDim(b.xMin - off, b.xMin, b.yMin, b.yMax, b.zMax, LEFT)
    if (withDepth) depthDim(b.xMax + off, b.xMax, b.yMin, b.zMin, b.zMax)
  }
  return group
}

/** Ejes X (rojo) / Y (verde) / Z (azul) con etiquetas, anclados en `origin` (mm). */
export function buildAxesOverlay({ origin, sizeMm, scale }) {
  const group = new THREE.Group()
  group.name = '__orbin_axes__'
  group.userData._isOverlay = true
  const size = sizeMm * scale
  const axes = new THREE.AxesHelper(size)
  axes.material.depthTest = false
  axes.material.depthWrite = false
  axes.material.transparent = true
  axes.renderOrder = ORDER
  group.add(axes)
  const lh = Math.max(size * 0.16, 8)
  const tips = [
    ['X', new THREE.Vector3(size + lh, 0, 0), '#FF5A5A'],
    ['Y', new THREE.Vector3(0, size + lh, 0), '#5AFF7A'],
    ['Z', new THREE.Vector3(0, 0, size + lh), '#5A9BFF'],
  ]
  for (const [t, pos, c] of tips) {
    const s = makeLabel(t, lh, { fg: c, border: c })
    s.position.copy(pos)
    group.add(s)
  }
  group.position.set(origin.x * scale, origin.y * scale, origin.z * scale)
  return group
}
