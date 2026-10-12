/**
 * Orbin AI — CANDADO: saludos / mensajes sin intención de diseño (2026-10-12)
 * Bug: "hola" caía a DEFAULTS (2400×2400×600) → "¡Listo! Diseñé tu clóset…" + generateProject().
 * INVARIANTE: sin intención de carpintería → params:null, design:null, source:'greeting', motor NO corre.
 */
process.env.NODE_ENV = 'test'
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_ANON_KEY
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) process.env[k] = ''
process.env.AI_PROVIDER_TIMEOUT_MS = '1500'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

// Proveedores caídos de inmediato → fuerza el piso regex local.
const geminiClient = require('../ai/geminiClient')
const ollamaClient = require('../ai/ollamaClient')
const DOWN = async () => { throw new Error('down (test)') }
geminiClient.chatDesign = DOWN; ollamaClient.chatDesign = DOWN

const { parseNaturalLanguage } = require('../engine/nlParser')
const { chatDesign } = require('../ai/aiOrchestrator')
const chatRouter = require('./chat')

describe('nlParser — interceptor', () => {
  for (const t of ['hola', 'Hola!', 'buenas tardes', 'bom dia', 'hello', 'hey?']) {
    it(`saludo "${t}" → params:null + isGreeting`, () => {
      const r = parseNaturalLanguage(t)
      assert.equal(r.params, null); assert.equal(r.isGreeting, true)
      assert.match(r.reply, /Orbin/)
    })
  }
  it('texto sin vocabulario ni dígitos → params:null (no saludo)', () => {
    const r = parseNaturalLanguage('gracias'); assert.equal(r.params, null); assert.equal(r.isGreeting, false)
  })
  for (const t of ['placard de 1800 de ancho', 'agrega espejo', 'con 3 puertas', 'una cocina', 'puertas de correr']) {
    it(`pedido/refinamiento "${t}" NO se intercepta`, () => assert.ok(parseNaturalLanguage(t).params))
  }
})

describe('chatDesign — fallback regex', () => {
  it('"hola" → source greeting, params null, sin "Diseñé"', async () => {
    const r = await chatDesign([], 'hola')
    assert.equal(r.source, 'greeting'); assert.equal(r.params, null)
    assert.ok(!/dise[ñn]é/i.test(r.message) && !/2400/.test(r.message))
  })
  it('pedido real sigue en regex-fallback con params', async () => {
    const r = await chatDesign([], 'placard de 1800 de ancho y 2100 de alto')
    assert.equal(r.source, 'regex-fallback'); assert.equal(r.params.width, 1800)
  })
})

describe('/api/chat/design — saludo', () => {
  let server, base
  before(async () => {
    const app = express(); app.use(express.json()); app.use('/api/chat', chatRouter)
    await new Promise(r => { server = app.listen(0, r) })
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server && server.close())
  const post = (body) => fetch(base + '/api/chat/design', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev-token' },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, json: await r.json() }))

  it('"hola" → 200, reply conversacional, params/design null, sin status pending', async () => {
    const { status, json } = await post({ message: 'hola', sessionId: 's-greet-1', lang: 'ES' })
    assert.equal(status, 200); assert.equal(json.success, true)
    assert.equal(json.source, 'greeting'); assert.match(json.reply, /Orbin/)
    assert.equal(json.params, null); assert.equal(json.design, null)
    assert.equal(json.status, undefined)
  })
  it('"hola" con confirmFlow tampoco propone nada', async () => {
    const { json } = await post({ message: 'hola', sessionId: 's-greet-2', confirmFlow: true })
    assert.notEqual(json.phase, 'proposal'); assert.equal(json.proposedParams, undefined)
  })
})
