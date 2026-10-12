/**
 * Orbin AI — CANDADO: cliente Ollama con modelos razonadores (DeepSeek-R1)
 * Protege: <think> nunca llega al JSON.parse ni al usuario; respuesta vacía → falla (la cascada sigue).
 */
process.env.NODE_ENV = 'test'
const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { stripThinkTags, extractJsonObject, chatDesign, parseDesignIntent } = require('./ollamaClient')

const realFetch = global.fetch
const mockContent = (content) => { global.fetch = async () => ({ ok: true, json: async () => ({ message: { content } }) }) }
afterEach(() => { global.fetch = realFetch })

describe('stripThinkTags', () => {
  it('quita bloque cerrado', () => assert.equal(stripThinkTags('<think>x {"a":1}</think>hola'), 'hola'))
  it('quita bloque sin cerrar (truncado)', () => assert.equal(stripThinkTags('ok <think>razono sin fin'), 'ok'))
  it('quita cierre huérfano', () => assert.equal(stripThinkTags('razono</think>listo'), 'listo'))
  it('tolera no-string', () => assert.equal(stripThinkTags(undefined), ''))
})

describe('extractJsonObject', () => {
  it('respeta llaves dentro de strings', () =>
    assert.deepEqual(extractJsonObject('x {"params":{"s":"}"}} y'), { params: { s: '}' } }))
  it('prefiere bloque ```json', () =>
    assert.deepEqual(extractJsonObject('{no} ```json\n{"a":1}\n```'), { a: 1 }))
  it('null si no hay JSON', () => assert.equal(extractJsonObject('sin json'), null))
})

describe('flujo con <think> de R1', () => {
  it('parseDesignIntent ignora JSON dentro de <think>', async () => {
    mockContent('<think>probando {"width":1}</think>```json\n{"moduleType":"standard","width":1800}\n```')
    const r = await parseDesignIntent('placard 1800')
    assert.equal(r.width, 1800); assert.equal(r.source, 'ollama')
  })
  it('chatDesign devuelve prosa limpia + params', async () => {
    mockContent('<think>razono</think>Listo.\n```json\n{"params":{"width":1800}}\n```')
    const r = await chatDesign([], 'placard 1800')
    assert.ok(!r.message.includes('think')); assert.equal(r.params.width, 1800)
  })
  it('chatDesign falla si todo fue <think> truncado (para que la cascada siga)', async () => {
    mockContent('<think>nunca termino')
    await assert.rejects(() => chatDesign([], 'hola'), /vac[ií]a/)
  })
})
