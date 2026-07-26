/**
 * Orbin AI — Unit Heuristic Unit Tests (2026-07-26)
 *
 * Covers resolving unit-less dimensions by range plausibility.
 * Run: node --test server/src/engine/unitHeuristic.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseNaturalLanguage } = require('./nlParser')

describe('Unit Heuristic Parser', () => {
  const p = text => parseNaturalLanguage(text).params

  it('"900" height -> 900mm (mm plausible, cm=9000 out of range)', () => {
    const res = p('aereo de 900 de altura')
    assert.equal(res.height, 900)
  })

  it('"90" height -> 900mm (mm=90 out of range, cm plausible)', () => {
    const res = p('módulo bajo de 90 de alto')
    assert.equal(res.height, 900)
  })

  it('"2.4" height -> 2400mm (m interpretation)', () => {
    const res = p('aereo de 2.4 de alto')
    assert.equal(res.height, 2400)
  })

  it('"180" width -> 1800mm + NLP_UNIT_AMBIGUOUS (both 180 and 1800 plausible; 1800 closer to commercial default)', () => {
    const parsed = parseNaturalLanguage('mueble de 180 de ancho')
    assert.equal(parsed.params.width, 1800)
    assert.ok(parsed.specAdjustments.some(adj => adj.code === 'NLP_UNIT_AMBIGUOUS'), 'Expected NLP_UNIT_AMBIGUOUS warning')
  })

  it('"1400" width -> 1400mm (unchanged)', () => {
    const res = p('escritorio de 1400 de ancho')
    assert.equal(res.width, 1400)
  })

  it('"600mm" depth -> 600mm (explicit unit always wins, never re-interpreted)', () => {
    const res = p('armario de 600mm de profundidad')
    assert.equal(res.depth, 600)
  })

  it('explicit units untouched (e.g. 1.2m, 90cm)', () => {
    assert.equal(p('mueble de 1.2m de ancho').width, 1200)
    assert.equal(p('mueble de 90cm de alto').height, 900)
  })

  it('counters untouched (numDrawers, numDoors, numShelves...)', () => {
    const res = p('armario de 1800 con 3 prateleiras y 2 gavetas y 2 puertas')
    assert.equal(res.numShelves, 3)
    assert.equal(res.numDrawers, 2)
    assert.equal(res.numDoors, 2)
  })

  it('regression case: mountHeight parsing still works', () => {
    const res = parseNaturalLanguage('aereo de 700mm de alto colgado a 1400 del piso')
    assert.equal(res.params.height, 700)
    assert.equal(res.params.mountHeight, 1400)
  })
})
