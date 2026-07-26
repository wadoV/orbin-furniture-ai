/**
 * Orbin AI — Regresión del parser NL (ADITIVO 2026-07-23).
 * CANDADO del bug demo: la detección de tipo (aéreo/base) PISABA las medidas
 * explícitas del usuario con los defaults de tipo. Ahora los defaults solo
 * rellenan lo ausente.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseNaturalLanguage } = require('./nlParser')

describe('nlParser — defaults de tipo no pisan medidas explícitas', () => {
  it('aéreo con alto y fondo explícitos los respeta (bug: salía 700×350)', () => {
    const r = parseNaturalLanguage('Gabinete aéreo de cocina de 100 cm de ancho, 20 cm de alto y 30 cm de fondo').params
    assert.equal(r.moduleType, 'aereo')
    assert.equal(r.width, 1000)
    assert.equal(r.height, 200)   // antes 700
    assert.equal(r.depth, 300)    // antes 350
  })

  it('aéreo SIN medidas usa defaults de tipo (sin regresión)', () => {
    const r = parseNaturalLanguage('Un armario aéreo para la cocina').params
    assert.equal(r.moduleType, 'aereo')
    assert.equal(r.height, 700)
    assert.equal(r.depth, 350)
  })

  it('base con alto/fondo explícitos los respeta', () => {
    const r = parseNaturalLanguage('Mueble base de cocina de 100 cm de ancho, 90 cm de alto y 60 cm de fondo').params
    assert.equal(r.moduleType, 'base')
    assert.equal(r.width, 1000)
    assert.equal(r.height, 900)
    assert.equal(r.depth, 600)
  })

  it('base SIN alto/fondo usa defaults de tipo (900×600)', () => {
    const r = parseNaturalLanguage('mueble base de cocina de 120 cm de ancho').params
    assert.equal(r.moduleType, 'base')
    assert.equal(r.width, 1200)
    assert.equal(r.height, 900)
    assert.equal(r.depth, 600)
  })

  it('"mueble base" ahora se detecta como base (antes caía a standard)', () => {
    assert.equal(parseNaturalLanguage('mueble base de cocina').params.moduleType, 'base')
    assert.equal(parseNaturalLanguage('módulo base con 2 puertas').params.moduleType, 'base')
  })

  it('closet estándar no se ve afectado', () => {
    const r = parseNaturalLanguage('closet 2000mm de ancho 2200mm de alto').params
    assert.equal(r.moduleType, 'standard')
    assert.equal(r.width, 2000)
    assert.equal(r.height, 2200)
  })
})
