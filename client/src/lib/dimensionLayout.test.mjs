// Candado de geometría de transformaciones y cotas — `node --test client/src/lib/dimensionLayout.test.mjs`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRotation, nextRotation, rotationOffset, moduleWorldBox, buildDimensionPlan, chainLabel } from './dimensionLayout.js'

test('normalizeRotation ajusta a pasos de 90°', () => {
  assert.equal(normalizeRotation(0), 0)
  assert.equal(normalizeRotation(450), 90)
  assert.equal(normalizeRotation(-90), 270)
  assert.equal(normalizeRotation(89), 90)
  assert.equal(normalizeRotation('x'), 0)
  assert.equal(nextRotation(270), 0)
})

test('rotationOffset mantiene fijo el centro de la huella', () => {
  assert.deepEqual(rotationOffset(550, 0), { dx: 0, dz: 0 })
  assert.deepEqual(rotationOffset(550, 180), { dx: 0, dz: 550 })
  assert.deepEqual(rotationOffset(550, 90), { dx: -275, dz: 275 })
})

test('moduleWorldBox intercambia ancho/profundidad a 90° y conserva el centro', () => {
  const a = moduleWorldBox({ width: 800, height: 2100, depth: 550, anchorX: 400, anchorZ: 0 })
  assert.deepEqual([a.xMin, a.xMax, a.zMin, a.zMax], [0, 800, 0, 550])
  const r = moduleWorldBox({ width: 800, height: 2100, depth: 550, anchorX: 400, anchorZ: 0, rotation: 90 })
  assert.deepEqual([r.xMin, r.xMax, r.zMin, r.zMax], [125, 675, -125, 675])
  assert.equal((r.xMin + r.xMax) / 2, (a.xMin + a.xMax) / 2)
  assert.equal((r.zMin + r.zMax) / 2, (a.zMin + a.zMax) / 2)
})

const box = (id, x0, w, rot = 0, z0 = 0) => ({ id, box: moduleWorldBox({ width: w, height: 2100, depth: 550, anchorX: x0 + w / 2, anchorZ: z0, rotation: rot }) })

test('dos módulos contiguos → cota corrida 800 + 1000 = 1800', () => {
  const plan = buildDimensionPlan([box('a', 0, 800), box('b', 800, 1000)])
  assert.equal(plan.chains.length, 1)
  assert.equal(plan.chains[0].total, 1800)
  assert.equal(chainLabel(plan.chains[0]), '800 + 1000 = 1800 mm')
})

test('tolerancia de 5 mm: 4 mm junta, 6 mm separa', () => {
  assert.equal(buildDimensionPlan([box('a', 0, 800), box('b', 804, 600)]).chains.length, 1)
  assert.equal(buildDimensionPlan([box('a', 0, 800), box('b', 806, 600)]).chains.length, 0)
})

test('un módulo rotado o en otra fila se desacopla', () => {
  assert.equal(buildDimensionPlan([box('a', 0, 800), box('b', 800, 1000, 90)]).chains.length, 0)
  assert.equal(buildDimensionPlan([box('a', 0, 800), box('b', 800, 1000, 0, 2000)]).chains.length, 0)
})

test('tres módulos con uno separado → una corrida de 2 + uno suelto', () => {
  const plan = buildDimensionPlan([box('a', 0, 600), box('b', 600, 600), box('c', 2000, 900)])
  assert.equal(plan.chains.length, 1)
  assert.deepEqual(plan.chains[0].ids, ['a', 'b'])
  assert.equal(plan.chainedIds.has('c'), false)
})
