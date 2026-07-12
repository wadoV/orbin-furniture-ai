/**
 * Orbin AI — Tests del builder de prompt personalizado (BLOQUE 1).
 * Runner: node:test (cero dependencias).
 * Verifica que buildOrbinChatPrompt liga idioma/nombre/empresa y la cláusula
 * de clarificación, sin romper las constantes existentes.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, buildOrbinChatPrompt } = require('./systemPrompts')

describe('buildOrbinChatPrompt', () => {
  it('las constantes originales siguen exportadas e intactas', () => {
    assert.ok(typeof FURNITURE_SYSTEM_PROMPT === 'string' && FURNITURE_SYSTEM_PROMPT.length > 100)
    assert.ok(typeof CHAT_SYSTEM_PROMPT === 'string' && CHAT_SYSTEM_PROMPT.length > 100)
    assert.strictEqual(typeof buildOrbinChatPrompt, 'function')
  })

  it('inyecta nombre y empresa del usuario', () => {
    const p = buildOrbinChatPrompt({ userName: 'Eduardo', company: 'Marcenaria Orbin', lang: 'ES' })
    assert.match(p, /Eduardo/)
    assert.match(p, /Marcenaria Orbin/)
  })

  it('liga el idioma nativamente (ES/PT/EN)', () => {
    assert.match(buildOrbinChatPrompt({ lang: 'ES' }), /español \(ES\)/)
    assert.match(buildOrbinChatPrompt({ lang: 'PT' }), /português \(PT\)/)
    assert.match(buildOrbinChatPrompt({ lang: 'EN' }), /English \(EN\)/)
  })

  it('incluye el GUARDRAIL de clarificación (preguntar antes de inventar)', () => {
    const p = buildOrbinChatPrompt({ userName: 'Ana', lang: 'ES' })
    assert.match(p, /GUARDRAIL/)
    assert.match(p, /PREGUNTA de forma amable ANTES de generar o inventar/)
  })

  it('reusa el CHAT_SYSTEM_PROMPT estable (esquema JSON) al final', () => {
    const p = buildOrbinChatPrompt({ userName: 'Ana' })
    assert.ok(p.endsWith(CHAT_SYSTEM_PROMPT))
  })

  it('con contexto vacío no filtra "undefined" y cae a defaults seguros', () => {
    const p = buildOrbinChatPrompt()
    assert.doesNotMatch(p, /undefined/)
    assert.match(p, /cliente/)          // default de userName
    assert.match(p, /español \(ES\)/)   // default de lang
  })
})
