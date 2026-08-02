/**
 * Orbin AI — Tests de i18n para OBSERVACIONES Y AJUSTES (specAdjustments)
 * (★ ADITIVO 2026-07-26)
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { bundleClientEngine } = require('./clientBundle.helper')

let localizeAdjustment = null
let normLang = null

before(() => {
  const mod = bundleClientEngine('adjustmentMessages.js')
  localizeAdjustment = mod.localizeAdjustment
  normLang = mod.normLang
})

describe('adjustmentMessages — normalización e interpolación i18n', () => {
  it('normaliza códigos de idioma (es, pt-BR, en_US, etc.)', () => {
    assert.equal(normLang('es'), 'ES')
    assert.equal(normLang('pt-BR'), 'PT')
    assert.equal(normLang('en_US'), 'EN')
    assert.equal(normLang('unknown'), 'PT')
  })

  it('localiza mensajes correctamente en ES, PT y EN', () => {
    const adj = {
      code: 'AEREO_BACK_FORCED_STRUCTURAL',
      severity: 'warning',
      field: 'backThickness',
      requested: 6,
      applied: 15,
      message: 'Fondo de aéreo elevado de 6mm a 15mm (estructural atornillado): el fondo transmite la carga al riel de pared.'
    }

    const es = localizeAdjustment(adj, 'ES')
    const pt = localizeAdjustment(adj, 'PT')
    const en = localizeAdjustment(adj, 'EN')

    assert.equal(es, 'Fondo de aéreo elevado de 6mm a 15mm (estructural atornillado): el fondo transmite la carga al riel de pared.')
    assert.equal(pt, 'Fundo do aéreo elevado de 6mm para 15mm (estrutural aparafusado): o fundo transmite a carga ao trilho de parede.')
    assert.equal(en, 'Wall cabinet back panel upgraded from 6mm to 15mm (screwed structural): back panel transfers weight to wall rail.')
  })

  it('localiza NICHE_HEIGHT_ADJUSTED correctamente', () => {
    const adj = {
      code: 'NICHE_HEIGHT_ADJUSTED',
      severity: 'warning',
      field: 'nicheHeight',
      requested: 300,
      applied: 200,
      message: 'Nicho de 300mm no deja altura mínima de puerta (150mm): ajustado a 200mm.'
    }

    assert.equal(localizeAdjustment(adj, 'ES'), 'Nicho de 300mm no deja altura mínima de puerta (150mm): ajustado a 200mm.')
    assert.equal(localizeAdjustment(adj, 'PT'), 'Nicho de 300mm não deixa altura mínima de porta (150mm): ajustado para 200mm.')
    assert.equal(localizeAdjustment(adj, 'EN'), 'Niche height of 300mm leaves insufficient door clearance (min 150mm): adjusted to 200mm.')
  })

  it('FALLBACK: si el código es desconocido o falta un parámetro, devuelve adj.message verbatim', () => {
    const unknownCode = {
      code: 'CUSTOM_FUTURE_CODE',
      message: 'Mensaje futuro que el cliente no conoce.'
    }
    assert.equal(localizeAdjustment(unknownCode, 'EN'), 'Mensaje futuro que el cliente no conoce.')

    const missingParam = {
      code: 'NICHE_HEIGHT_ADJUSTED',
      requested: 300,
      // falta applied
      message: 'Nicho de 300mm no deja altura mínima de puerta (150mm): ajustado a 200mm.'
    }
    assert.equal(localizeAdjustment(missingParam, 'EN'), 'Nicho de 300mm no deja altura mínima de puerta (150mm): ajustado a 200mm.')
  })
})
