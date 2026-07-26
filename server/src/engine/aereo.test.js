/**
 * Orbin AI — Invariante de mueble AÉREO (ADITIVO 2026-07-23).
 * Regla de dominio: un aéreo (colgado) = carcasa cerrada (laterales+techo+piso+fondo)
 * + puertas + tamponado opcional, SIN patas ni zócalo.
 * CANDADO: la BOM emitía 4 patas si baseType='legs' aunque la geometría no las tenía.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')

const typeCount = (d) => d.pieces.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {})
const legsInBOM = (d) => (d.hardware || []).filter(h => /pata|nivelador|pe /i.test((h.type || '') + (h.description || ''))).length

describe('Invariante aéreo', () => {
  it('carcasa cerrada: laterales + techo + piso + fondo (trasera)', () => {
    const t = typeCount(generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 350, hasDoors: true, numDoors: 2 }))
    assert.equal(t.lateral, 2)
    assert.equal(t.techo, 1)
    assert.equal(t.piso, 1)
    assert.equal(t.fondo, 1)         // trasera
    assert.equal(t.standard_door, 2) // puertas
  })

  it('NUNCA lleva zócalo ni patas (baseType forzado a none)', () => {
    const d = generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 350, hasDoors: true, numDoors: 2 })
    assert.equal(typeCount(d).baseboard, undefined)
    assert.equal(legsInBOM(d), 0)
    assert.equal(d.configuration.baseType, 'none')
    assert.equal(d.configuration.baseboard, false)
  })

  it('aunque le fuercen baseType="legs", el aéreo NO produce patas', () => {
    const d = generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 350, baseType: 'legs', hasDoors: true, numDoors: 2 })
    assert.equal(legsInBOM(d), 0)
    assert.equal(d.configuration.baseType, 'none')
    assert.equal(typeCount(d).baseboard, undefined)
  })

  it('tamponado opcional se genera cuando se pide', () => {
    const t = typeCount(generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 350, tamponado: 'both' }))
    assert.equal(t.tamponado, 2)
  })

  it('CONTROL: un módulo base con legs SÍ produce patas (no romper el caso legítimo)', () => {
    const d = generateProject({ moduleType: 'base', width: 800, height: 900, depth: 580, baseType: 'legs' })
    assert.equal(legsInBOM(d), 1)
    assert.equal(d.configuration.baseType, 'legs')
  })
})
