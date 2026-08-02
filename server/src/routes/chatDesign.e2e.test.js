/**
 * Orbin AI — Regresión e2e de /api/chat/design  (ADITIVO 2026-07-23)
 * ─────────────────────────────────────────────────────────────────────────────
 * CANDADO DE NO-RETROCESO (decisión CEO):
 *   1. El modo HITL nuevo (confirmFlow) NUNCA se activa sin el flag explícito.
 *      SIN confirmFlow, la ruta se comporta como el legacy (contrato congelado).
 *   2. La Fase 2 (action:'confirm' + proposedParams) genera el despiece de forma
 *      DETERMINISTA, sin depender de proveedores de IA — es stateless.
 *
 * Monta el router real con DEV_USER (sin Supabase, NODE_ENV=test). No usa supertest:
 * levanta un http server efímero y usa fetch nativo (Node 20+).
 */
process.env.NODE_ENV = 'test'
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_ANON_KEY

// ── HERMETICIDAD (aditivo 2026-08-02) ───────────────────────────────────────
// Este test AFIRMA "sin proveedores de IA". Era falso: vertexClient.js hace
// require('dotenv').config() al cargarse, y aiOrchestrator lo importa. Con
// server/.env presente (toda máquina de dev), el test salía a la red real
// contra Google y COLGABA — sin timeout, indefinidamente.
// OJO: `delete process.env.X` NO alcanza. dotenv sólo respeta las claves que
// YA EXISTEN en process.env; si la borrás, la repuebla desde server/.env al
// cargarse vertexClient — o sea, después de este bloque. Hay que asignar ''
// (existe → dotenv no la pisa; falsy → los clientes la ven como ausente).
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) {
  process.env[k] = ''
}
process.env.AI_PROVIDER_TIMEOUT_MS = '1500'  // si algo igual sale a la red, corta rápido

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const express = require('express')
const chatRouter = require('./chat')

let server, base
before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/chat', chatRouter)
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server && server.close())

const post = (body) => fetch(base + '/api/chat/design', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev-token' },
  body: JSON.stringify(body),
}).then(async r => ({ status: r.status, json: await r.json() }))

describe('/api/chat/design — candado de no-retroceso', () => {
  const params = { moduleType: 'standard', width: 2000, height: 2200, depth: 580, numDrawers: 4, numShelves: 2 }

  it('FASE 2: confirmFlow + action:confirm genera el despiece (stateless, sin IA)', async () => {
    const { status, json } = await post({
      message: 'sí, generá', sessionId: 's-e2e-1', lang: 'ES',
      confirmFlow: true, action: 'confirm', proposedParams: params,
    })
    assert.equal(status, 200)
    assert.equal(json.phase, 'generated')
    assert.equal(json.status, 'confirmed')
    assert.ok(json.design && json.design.success, 'debe devolver design.success')
    assert.ok(json.design.pieces.length > 0, 'debe traer piezas')
    assert.ok(Array.isArray(json.design.cutList) && json.design.cutList.length > 0, 'debe traer cutList')
  })

  it('AISLAMIENTO: el MISMO body de confirmación SIN confirmFlow NO dispara Fase 2', async () => {
    // Sin proveedores de IA, el path legacy responde con reply de fallback y
    // NO genera design a partir de proposedParams (que legacy ni mira).
    const { status, json } = await post({
      message: 'sí, generá', sessionId: 's-e2e-2', lang: 'ES',
      action: 'confirm', proposedParams: params,   // <-- sin confirmFlow
    })
    assert.equal(status, 200)
    assert.notEqual(json.phase, 'generated')       // nunca entra al modo nuevo
    assert.equal(json.success, true)
  })

  it('CONTRATO LEGACY: sin confirmFlow la respuesta conserva su shape (success+reply)', async () => {
    const { status, json } = await post({ message: 'hola', sessionId: 's-e2e-3', lang: 'ES' })
    assert.equal(status, 200)
    assert.equal(json.success, true)
    assert.equal(typeof json.reply, 'string')
    assert.equal(json.phase, undefined)            // el legacy no emite 'phase'
  })

  it('FASE 2 defensiva: confirm sin proposedParams no rompe (cae a Fase 1/propuesta)', async () => {
    const { status, json } = await post({
      message: 'confirmo', sessionId: 's-e2e-4', lang: 'ES',
      confirmFlow: true, action: 'confirm',        // sin proposedParams ni caché
    })
    assert.equal(status, 200)
    assert.notEqual(json.status, 'confirmed')       // no genera sin params
    assert.equal(json.success, true)
  })
})
