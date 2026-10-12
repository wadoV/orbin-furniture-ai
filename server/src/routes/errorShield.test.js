/**
 * Orbin AI — Blindaje anti-500 del chat (ADITIVO 2026-10-12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto: con Gemini bloqueado por cuota (429) y Ollama sin responder (fetch failed),
 * el panel del chat mostraba "El servidor tuvo un problema inesperado" (el cliente lo
 * muestra para CUALQUIER status ≥ 500).
 *
 * Causa REPRODUCIDA: un body JSON truncado hace que body-parser lance un SyntaxError con
 * `err.status = 400`; el handler global ignoraba el status y respondía 500.
 *
 * Contrato que fija este archivo:
 *   · Request malformado → 4xx estructurado (jamás 500).
 *   · /api/chat/*: un fallo inesperado NUNCA es 500 → 200 degradado y VÁLIDO.
 *   · Proveedores de IA caídos → 200 por el piso regex, con diseño generado.
 *
 * HERMÉTICO: sin claves de IA y con Ollama apuntando a un puerto muerto, para que el
 * test jamás salga a la red ni dependa de que el taller tenga Ollama corriendo.
 */
process.env.NODE_ENV = 'test'
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_ANON_KEY
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) process.env[k] = ''
process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:1'     // puerto muerto → "fetch failed" inmediato
process.env.AI_PROVIDER_TIMEOUT_MS = '1500'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

// Se parchea ANTES de cargar la ruta: chat.js desestructura chatDesign/parseDesignIntent al require.
const orchestrator = require('../ai/aiOrchestrator')
const realChatDesign = orchestrator.chatDesign
const realParseDesignIntent = orchestrator.parseDesignIntent
let forceThrow = false
orchestrator.chatDesign = (...a) => { if (forceThrow) throw new Error('boom: detalle interno que NO debe filtrarse'); return realChatDesign(...a) }
orchestrator.parseDesignIntent = (...a) => { if (forceThrow) throw new Error('boom parse'); return realParseDesignIntent(...a) }

const chatRouter = require('./chat')
const { apiErrorHandler } = require('../middleware/errorHandler')

const silence = () => { const o = console.error; console.error = () => {}; return () => { console.error = o } }

let server, base
before(async () => {
  const app = express()
  app.use(express.json({ limit: '50mb' }))
  app.use('/api/chat', chatRouter)
  app.get('/api/other/boom', () => { throw new Error('boom') })
  app.get('/api/chat/boom', () => { throw new Error('boom') })
  app.get('/api/other/teapot', (_req, _res, next) => { const e = new Error('x'); e.status = 418; next(e) })
  app.use(apiErrorHandler)
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server && server.close())

const call = async (path, init = {}) => {
  const r = await fetch(base + path, { ...init, headers: { Authorization: 'Bearer dev-token', ...(init.headers || {}) } })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* no-JSON */ }
  return { status: r.status, json, text }
}
const post = (path, body, raw = false) => call(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? body : JSON.stringify(body),
})

describe('Request malformado → 4xx estructurado, jamás 500', () => {
  let restore
  before(() => { restore = silence() })
  after(() => restore())

  it('JSON truncado (caso real de producción)', async () => {
    const { status, json } = await post('/api/chat/design', '{"message":"nicho 700x400x', true)
    assert.equal(status, 400)
    assert.equal(json.success, false)
    assert.equal(json.code, 'BAD_JSON')
    assert.match(json.error, /incompleto|JSON/i)
  })
  it('body literal "null"', async () => {
    const { status, json } = await post('/api/chat/design', 'null', true)
    assert.equal(status, 400)
    assert.equal(json.code, 'BAD_JSON')
  })
  it('body vacío / sin content-type / array / message no-string → 400 con mensaje, no 500', async () => {
    for (const init of [
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' },
      { method: 'POST', body: 'hola' },
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[1,2]' },
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"message":123}' },
    ]) {
      const { status, json } = await call('/api/chat/design', init)
      assert.equal(status, 400)
      assert.equal(json.success, false)
      assert.ok(json.error)
    }
  })
  it('/parse con body vacío → 400 (no TypeError → 500)', async () => {
    const { status } = await call('/api/chat/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' })
    assert.equal(status, 400)
  })
  it('un error con status 4xx de cualquier ruta conserva su status', async () => {
    assert.equal((await call('/api/other/teapot')).status, 418)
  })
})

describe('Fallo inesperado en rutas de chat → 200 degradado y VÁLIDO', () => {
  let restore
  before(() => { restore = silence(); forceThrow = true })
  after(() => { restore(); forceThrow = false })

  it('/api/chat/design: el catch ya no devuelve 500', async () => {
    const { status, json, text } = await post('/api/chat/design', { message: 'modulo 800x900x520', lang: 'PT' })
    assert.equal(status, 200)
    assert.equal(json.success, false)
    assert.equal(json.degraded, true)
    assert.equal(json.params, null)
    assert.equal(json.design, null)
    assert.match(json.reply, /mensagem|Tente/i, 'respeta lang:PT')
    assert.ok(!/boom/.test(text), 'el detalle interno del error NO se filtra al cliente')
  })
  it('/api/chat/parse: el catch ya no devuelve 500', async () => {
    const { status, json } = await post('/api/chat/parse', { text: 'modulo 800x900x520' })
    assert.equal(status, 200)
    assert.equal(json.degraded, true)
    assert.equal(json.params, null)
  })
  it('handler global: cualquier ruta /api/chat/* inesperada → 200 degradado, no 500', async () => {
    const { status, json } = await call('/api/chat/boom')
    assert.equal(status, 200)
    assert.equal(json.code, 'SERVER_FALLBACK')
    assert.deepEqual(json.pieces, [])
  })
})

describe('Handler global fuera del chat — comportamiento histórico intacto', () => {
  let restore, prevEnv, prevDemo
  before(() => { restore = silence(); prevEnv = process.env.NODE_ENV; prevDemo = process.env.DEMO_MODE })
  after(() => {
    restore()
    process.env.NODE_ENV = prevEnv
    if (prevDemo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = prevDemo
  })

  it('producción sin DEMO_MODE: ruta no-chat inesperada sigue siendo 500 sin stack ni detalle', async () => {
    process.env.NODE_ENV = 'production'; delete process.env.DEMO_MODE
    const { status, json, text } = await call('/api/other/boom')
    assert.equal(status, 500)
    assert.equal(json.success, false)
    assert.ok(!/boom|at /.test(text))
  })
  it('DEMO_MODE=true: ruta no-chat inesperada → 200 degradado (bypass de piloto)', async () => {
    process.env.NODE_ENV = 'production'; process.env.DEMO_MODE = 'true'
    const { status, json } = await call('/api/other/boom')
    assert.equal(status, 200)
    assert.equal(json.degraded, true)
  })
})

describe('Proveedores de IA caídos (429 + fetch failed) → 200 por el piso regex, con diseño', () => {
  // Texto EXACTO de las pruebas de producción del 12/10/2026.
  const PROMPTS = {
    horno: 'crea un modulo para horno, debe ser un modulo de 800x900x520mm, debe tener una puerta falsa y una repisa interna',
    pia: 'crea un modulo pia de cocina, debe ser un modulo de 1200x900x520mm, debe tener 2 puertas con cava 45º deja un espacio de 3cm entre el tampo y el tirador cava, agrega una repisa interna, el rodapie debe ser de 12cm.',
    gavetas: 'crea un modulo base de gavetas , debe ser un modulo de 700x900x520mm, debe tener 3 gavetas con cava 45º deja un espacio de 3cm entre cada fremte y el tirador cava, agrega 3 tranvesaños de 5cm los frentes de las gavetas deben ser 2 de 15 cm y el otro con el resto de la medida, respetando los 3cm necesario para con la mano puchar la gaveta,el rodapie debe ser de 12cm.',
    aereo: 'crea un mueble aereo de 800x1000x350 con dos puertas cavas45º; 1 prateleira, y tamponado abajo, las puertas deben respetar los 1.5cmde largura mayor que la altura total del mueble. No lleva rodapie',
    nicho: 'nicho 700x400x350 sin puertas, fundo 15cm, sin rodapie',
  }
  let restore
  before(() => { restore = silence() })
  after(() => restore())

  for (const [name, message] of Object.entries(PROMPTS)) {
    it(`${name}: HTTP 200, success, diseño VALIDADO generado por el fallback`, async () => {
      const { status, json } = await post('/api/chat/design', { message, sessionId: 's-shield-' + name, lang: 'ES' })
      assert.equal(status, 200)
      assert.equal(json.success, true)
      assert.equal(json.source, 'regex-fallback')
      assert.ok(json.params, 'debe haber params')
      assert.equal(json.design && json.design.success, true)
      assert.equal(json.validation && json.validation.status, 'VALIDADO')
    })
  }
})
