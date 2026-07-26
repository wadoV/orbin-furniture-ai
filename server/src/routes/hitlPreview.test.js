/**
 * Orbin AI — Tests del HITL Preview (ADITIVO 2026-07-23).
 * Runner: node:test.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { detectConfirmation, buildPreviewMessage } = require('./hitlPreview')

describe('detectConfirmation', () => {
  it('flag determinista tiene prioridad', () => {
    assert.equal(detectConfirmation({ action: 'confirm' }), 'confirm')
    assert.equal(detectConfirmation({ action: 'cancel' }), 'cancel')
  })
  it('NLP: frase corta afirmativa', () => {
    assert.equal(detectConfirmation({ message: 'sí, dale' }), 'confirm')
    assert.equal(detectConfirmation({ message: 'confirmo' }), 'confirm')
    assert.equal(detectConfirmation({ message: 'yes' }), 'confirm')
  })
  it('NLP: cancelación corta', () => {
    assert.equal(detectConfirmation({ message: 'no' }), 'cancel')
  })
  it('NO confirma en descripciones largas (evita falso positivo)', () => {
    assert.equal(detectConfirmation({ message: 'quiero un closet de 2 metros con 4 cajones al centro y colgador' }), null)
    assert.equal(detectConfirmation({ message: 'no quiero cajones, solo estantes por favor gracias' }), null)
  })
  it('mensaje vacío o no-string → null', () => {
    assert.equal(detectConfirmation({ message: '' }), null)
    assert.equal(detectConfirmation({}), null)
  })
})

describe('buildPreviewMessage', () => {
  const params = { moduleType: 'standard', width: 2000, height: 2200, depth: 580, numDrawers: 4, numShelves: 2, hasHangingRod: true }

  it('viable: propone y pide confirmación', () => {
    const v = { status: 'VALIDADO', errors: [], warnings: [] }
    const out = buildPreviewMessage({ params, validation: v, specAdjustments: [], lang: 'ES' })
    assert.equal(out.viable, true)
    assert.match(out.text, /2000 × 2200 × 580/)
    assert.match(out.text, /cajones/)
    assert.match(out.text, /Aprueba|Apruebas/)
  })

  it('incluye supuestos y avisos', () => {
    const v = { status: 'VALIDADO', errors: [], warnings: ['Vano interno próximo al límite.'] }
    const adj = [{ code: 'ASSUMED_DEFAULT', field: 'depth', message: 'Usé 580mm por defecto.' }]
    const out = buildPreviewMessage({ params, validation: v, specAdjustments: adj, lang: 'ES' })
    assert.match(out.text, /580mm por defecto/)
    assert.match(out.text, /límite/)
  })

  it('RECHAZADO: no ofrece confirmación, lista errores', () => {
    const v = { status: 'RECHAZADO', errors: ['Cajón muy estrecho (80mm).'], warnings: [] }
    const out = buildPreviewMessage({ params, validation: v, specAdjustments: [], lang: 'ES' })
    assert.equal(out.viable, false)
    assert.match(out.text, /muy estrecho/)
  })

  it('respeta idioma EN/PT', () => {
    const v = { status: 'VALIDADO', errors: [], warnings: [] }
    assert.match(buildPreviewMessage({ params, validation: v, lang: 'EN' }).text, /Approve generation/)
    assert.match(buildPreviewMessage({ params, validation: v, lang: 'PT' }).text, /Aprova a geração/)
  })
})
