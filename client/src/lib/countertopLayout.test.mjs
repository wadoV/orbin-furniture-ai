// Candado de tampo continuo — `node --test client/src/lib/countertopLayout.test.mjs`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countertopEligibility, buildCountertopClusters } from './countertopLayout.js'
import { moduleWorldBox } from './dimensionLayout.js'

const mod = (cfg, extra = {}) => ({ id: extra.id || 'm', configuration: { moduleType: 'base', width: 800, height: 720, depth: 550, ...cfg }, ...extra })
const item = (id, x0, w, h, { y = 0, z0 = 0, d = 550 } = {}) =>
  ({ id, box: moduleWorldBox({ width: w, height: h, depth: d, anchorX: x0 + w / 2, anchorZ: z0, y }) })

test('el ropero 2100 nunca lleva tampo del sistema; el balcão 720 sí', () => {
  assert.equal(countertopEligibility(mod({ moduleType: 'standard', height: 2100, hasCountertop: true })).ok, false)
  assert.equal(countertopEligibility(mod({ height: 720 })).ok, true)
})

test('hasCountertop:false explícito manda aunque sea base', () => {
  assert.equal(countertopEligibility(mod({ hasCountertop: false })).ok, false)
})

test('aéreo, escritorio y girado quedan fuera', () => {
  assert.equal(countertopEligibility(mod({ moduleType: 'aereo', hasCountertop: true })).ok, false)
  assert.equal(countertopEligibility(mod({ moduleType: 'desk', hasCountertop: true })).ok, false)
  assert.equal(countertopEligibility(mod({}), 90).ok, false)
})

test('caso del bug: 2100 + 720 contiguos → el tampo NO se extiende sobre el balcão', () => {
  // el ropero ni siquiera es elegible; aun si lo fuera, el nivel rompe el clúster
  const clusters = buildCountertopClusters([item('ropero', 0, 800, 2100), item('balcao', 800, 1000, 720)])
  assert.equal(clusters.length, 2)
  const balcao = clusters.find(c => c.ids.includes('balcao'))
  assert.equal(balcao.topY, 720)
  assert.equal(balcao.width, 1000)
})

test('dos balcões a 720 contiguos → un tampo de 1800 exactos', () => {
  const [c] = buildCountertopClusters([item('a', 0, 800, 720), item('b', 800, 1000, 720)])
  assert.deepEqual(c.ids, ['a', 'b'])
  assert.equal(c.width, 1800)
  assert.equal(c.topY, 720)
})

test('tolerancias: 2 mm de nivel junta, 3 mm separa; 5 mm de junta une, 6 mm no', () => {
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 800, 600, 722)]).length, 1)
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 800, 600, 723)]).length, 2)
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 805, 600, 720)]).length, 1)
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 806, 600, 720)]).length, 2)
})

test('la elevación real cuenta: mismo alto pero elevado 100 mm → no comparten tampo', () => {
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 800, 600, 720, { y: 100 })]).length, 2)
})

test('otra fila (sin solape en Z) no se encadena', () => {
  assert.equal(buildCountertopClusters([item('a', 0, 800, 720), item('b', 800, 600, 720, { z0: 1500 })]).length, 2)
})
