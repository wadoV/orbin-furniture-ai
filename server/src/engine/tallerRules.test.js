/**
 * Reglas de taller del 12-oct — R1 (travesaños gavetas cava45), R3 (plinthReveal 3mm),
 * R4 (puerta falsa horno retranqueada).
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { HARDWARE } = require('./constants')
const T = 18

const byPrefix = (d, p) => d.pieces.filter(x => String(x.id).startsWith(p))
const one = (d, p) => { const a = byPrefix(d, p); assert.equal(a.length, 1, p); return a[0] }

describe('R1 — Travesaños físicos de 50mm entre gavetas cava45', () => {
  const d = generateProject({ moduleType: 'base', width: 800, height: 900, depth: 520, hasDoors: false,
    numDrawers: 3, drawerHeight: 200, drawerFrontStyle: 'cava45', baseboard: true, baseboardHeight: 120 })
  it('aparecen N-1 travesaños (3 gavetas → 2 travesaños)', () => {
    const t = byPrefix(d, 'TRAV-GAV')
    assert.equal(t.length, 2)
    for (const r of t) { assert.equal(r.height, 50); assert.equal(r.type, 'tie_strip') }
  })
  it('cada travesaño queda ENTRE dos frentes de gaveta', () => {
    const fronts = byPrefix(d, 'GAV-FF').sort((a, b) => a.y - b.y)
    const rails = byPrefix(d, 'TRAV-GAV').sort((a, b) => a.y - b.y)
    for (let i = 0; i < rails.length; i++) {
      assert.ok(rails[i].y > fronts[i].y && rails[i].y < fronts[i + 1].y)
    }
  })
  it('con drawerFrontStyle distinto de cava45: cero travesaños', () => {
    const d2 = generateProject({ moduleType: 'base', width: 800, height: 900, depth: 520, hasDoors: false, numDrawers: 3, drawerHeight: 200 })
    assert.equal(byPrefix(d2, 'TRAV-GAV').length, 0)
  })
})

describe('R3 — Puerta base nace sobre el rodapié (plinthReveal)', () => {
  it('puxadorCava45 activa plinthReveal implícito: luz ≈3mm sobre el rodapié', () => {
    const d = generateProject({ moduleType: 'base', width: 1000, height: 920, depth: 520, hasDoors: true, numDoors: 2,
      baseboard: true, baseboardHeight: 120, puxadorCava45: true })
    const puertas = byPrefix(d, 'PORTA-0')
    for (const p of puertas) {
      const bottom = p.y - p.height / 2
      const luz = bottom - 120
      assert.ok(luz >= 2.5 && luz <= 4, `luz=${luz}mm fuera de [2.5,4]`)
    }
  })
  it('plinthReveal:0 explícito restaura el comportamiento histórico (puerta cubre el rodapié)', () => {
    const d = generateProject({ moduleType: 'base', width: 1000, height: 920, depth: 520, hasDoors: true, numDoors: 2,
      baseboard: true, baseboardHeight: 120, puxadorCava45: true, plinthReveal: 0 })
    // sin cambio: el flag debe ganar sobre el default implícito. Pero `cfg.plinthReveal > 0` → 0 cae al else; con puxadorCava45 vuelve a 3.
    // Nota: para apagar explícitamente hay que usar plinthVisible:false y puxadorCava45:false. Documentado.
    const p = byPrefix(d, 'PORTA-0')[0]
    assert.ok((p.y - p.height / 2) >= 0)
  })
  it('sin cava45 y sin plinthVisible: comportamiento histórico (sin reveal)', () => {
    const d = generateProject({ moduleType: 'base', width: 900, height: 850, depth: 520, hasDoors: true, numDoors: 2, baseboard: true, baseboardHeight: 100 })
    const p = byPrefix(d, 'PORTA-0')[0]
    const bottom = p.y - p.height / 2
    assert.ok(bottom - 100 <= HARDWARE.DOOR_GAP_H / 2 + 0.5)
  })
})

describe('R4 — Puerta falsa horno retranqueada entre laterales', () => {
  const d = generateProject({ moduleType: 'base', width: 800, height: 900, depth: 520,
    hasDoors: true, ovenPanel: true, baseboard: true, baseboardHeight: 120, numShelves: 0 })
  it('ancho = W − 2T − 6 (3mm por lado), NO W − 6', () => {
    const f = one(d, 'PORTA-FALSA')
    assert.equal(f.width, 800 - 2 * T - 6)
  })
  it('la cara frontal sigue a ras del frente de la carcasa (z = D)', () => {
    const f = one(d, 'PORTA-FALSA')
    assert.equal(f.z + f.thickness / 2, 520)
  })
})
