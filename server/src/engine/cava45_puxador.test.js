// ★ ADITIVO 2026-10-19 — Tests de puxador cava 45° (puertas base y aéreo).
// Verifica: bisel explícito en hoja, línea CNC en BOM, holgura puerta→tampo ≥ 25 mm,
// ranura de agarre libre de travesaños y validación VALIDADO.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')

const H_BASE = 890, D = 560, MIN_GAP = 25, SLOT_DEPTH = 100
const BASE_VARIANTS = [
  { name: 'base 800 · 2 puertas', width: 800, numDoors: 2 },
  { name: 'base 600 · 2 puertas', width: 600, numDoors: 2 },
  { name: 'base 400 · 1 puerta',  width: 400, numDoors: 1 },
  { name: 'base 800 · 3 puertas', width: 800, numDoors: 3 },
]
const AEREO_VARIANTS = [
  { name: 'aéreo 600 · 2 puertas', width: 600, numDoors: 2 },
  { name: 'aéreo 400 · 2 puertas', width: 400, numDoors: 2 },
  { name: 'aéreo 300 · 1 puerta',  width: 300, numDoors: 1 },
]

const baseCfg = v => ({
  moduleType: 'base', width: v.width, height: H_BASE, depth: D,
  hasCountertop: true, countertopThickness: 30, baseboard: true, baseboardHeight: 100,
  hasDoors: true, doorType: 'hinged', numDoors: v.numDoors, numDrawers: 0, numShelves: 1,
  puxadorCava45: true, topTieRails: false,
})
const aereoCfg = v => ({
  moduleType: 'aereo', width: v.width, height: 800, depth: 350, mountHeight: 1500,
  numShelves: 2, hasDoors: true, doorType: 'hinged', numDoors: v.numDoors,
  puxadorCavaAereo: true, backThickness: 15,
})

for (const v of BASE_VARIANTS) {
  test(`puxador cava 45° · ${v.name}`, () => {
    const g = generateProject(baseCfg(v))
    assert.equal(validateDesign(g).status, 'VALIDADO')
    const doors = g.pieces.filter(p => p.type === 'standard_door')
    assert.equal(doors.length, v.numDoors)
    for (const d of doors) assert.match(d.notes, /Cava 45°.*bisel.*labio plano 3mm/)
    // Holgura puerta → tampo (tampo apoya en H_BASE)
    const doorTop = Math.max(...doors.map(d => d.y + d.height / 2))
    assert.ok(H_BASE - doorTop >= MIN_GAP, `holgura ${H_BASE - doorTop} < ${MIN_GAP}`)
    // Ranura de agarre libre: ningún travesaño/panel en la franja frontal
    const blockers = g.pieces.filter(p => p.type !== 'standard_door' &&
      p.y - p.height / 2 < H_BASE - 0.5 && p.y + p.height / 2 > doorTop + 0.5 && p.z > D - SLOT_DEPTH - 0.5)
    assert.deepEqual(blockers.map(b => b.name), [])
    // BOM con usinaje CNC
    const cnc = g.hardware.find(b => /Cava 45°/.test(b.description))
    assert.ok(cnc, 'falta línea CNC en BOM')
    assert.equal(cnc.quantity, v.numDoors)
  })
}

for (const v of AEREO_VARIANTS) {
  test(`puxador cava 45° · ${v.name}`, () => {
    const g = generateProject(aereoCfg(v))
    assert.equal(validateDesign(g).status, 'VALIDADO')
    const doors = g.pieces.filter(p => p.type === 'standard_door')
    assert.equal(doors.length, v.numDoors)
    for (const d of doors) assert.match(d.notes, /Cava 45°.*bisel.*labio plano 3mm/)
    const cnc = g.hardware.find(b => /Cava 45°/.test(b.description))
    assert.ok(cnc, 'falta línea CNC en BOM')
    assert.equal(cnc.quantity, v.numDoors)
  })
}
