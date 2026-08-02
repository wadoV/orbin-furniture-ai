/**
 * Orbin AI — CANDADO: gate de plan en los endpoints de IA  (ADITIVO 2026-08-02)
 * ═════════════════════════════════════════════════════════════════════════════
 * Cierra P5. Monta los routers REALES sobre un servidor efímero y golpea los
 * endpoints con `fetch`: no testea el middleware aislado, testea lo que le pasa
 * a una petición HTTP de verdad, que es lo único que le importa a un cliente.
 *
 * La identidad NO se simula con un middleware previo: se stubea `createClient` de
 * Supabase y se deja correr el `requireAuth` REAL, que resuelve el plan desde
 * `app_metadata` igual que en producción. (El primer intento inyectaba `req.user`
 * antes del router; `router.use(requireAuth)` lo pisaba con DEV_USER —plan 'pro'—
 * y los 8 tests de bloqueo daban 200. El arnés estaba midiendo otra cosa.)
 * El contador se inyecta con `setUsageStore()`. Cero red, determinista.
 *
 * QUÉ SE PROTEGE, ADEMÁS DEL LÍMITE:
 *   · Que NO se cobre por caminos que no consumen IA. Es la parte fácil de
 *     romper en un refactor y la que convierte "5 generaciones con IA" en
 *     "5 diseños en total" sin que nadie se entere hasta que un free se queja.
 *   · Que una caída del contador NO bloquee a quien paga (fail-open deliberado).
 *   · Que el 403 respete el contrato de i18n (code traducible, no un token crudo
 *     en `error`).
 */

process.env.NODE_ENV = 'test'
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) {
  process.env[k] = ''
}
process.env.AI_PROVIDER_TIMEOUT_MS = '300'   // sin proveedores: que caiga rápido al piso local

// Supabase "configurado" para que requireAuth NO tome el atajo a DEV_USER.
process.env.SUPABASE_URL = 'https://stub.invalid'
process.env.SUPABASE_ANON_KEY = 'stub-anon-key'
// SIN SUPABASE_SERVICE_KEY a propósito: el store de cuota se inyecta a mano.

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')

// ─── Stub de Supabase: el token codifica identidad y plan ────────────────────
// Formato: "t|<userId>|<plan>". El plan viaja en app_metadata, que es de donde
// requireAuth debe leerlo — así el test también ejercita esa regla.
const supabaseSdk = require('@supabase/supabase-js')
supabaseSdk.createClient = () => ({
  auth: {
    getUser: async (token) => {
      const [, id, plan] = String(token).split('|')
      if (!id) return { data: { user: null }, error: { message: 'invalid' } }
      return {
        data: { user: { id, email: `${id}@test.local`, role: 'authenticated', app_metadata: { plan }, user_metadata: {} } },
        error: null,
      }
    },
  },
})

const { setUsageStore, limitFor, dayKey, nextResetISO } = require('../middleware/planLimits')

// ─── Contador en memoria inyectado (reemplaza el RPC de Supabase) ────────────
let counts, failNext
const memStore = {
  async increment(userId, day, feature) {
    if (failNext) { failNext = false; throw new Error('store caído (simulado)') }
    const key = `${userId}|${day}`
    const n = (counts.get(key) || 0) + 1
    counts.set(key, n)
    memStore.lastFeature = feature
    return n
  },
}

let server, base
before(async () => {
  setUsageStore(memStore)
  const app = express()
  app.use(express.json())
  app.use('/api/chat', require('./chat'))
  app.use('/api/design', require('./design'))
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => { setUsageStore(null); server && server.close() })
beforeEach(() => { counts = new Map(); failNext = false })

const post = (path, body, { user = 'u-free', plan = 'free' } = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer t|${user}|${plan}`,
    },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, json: await r.json(), headers: r.headers }))

const LIMIT = limitFor('free')

// GUARDA DEL PROPIO CANDADO. `LIMIT` se lee de la implementación para que el test
// no se desincronice al ajustar la cuota. El precio: si alguien pone `Infinity`
// (o 0), los bucles `for (i <= LIMIT)` de abajo no fallan — se CUELGAN, y un test
// colgado no reporta nada. Se detectó mutando el límite a Infinity: la corrida
// terminó en timeout en vez de en un fallo legible.
// Regla del backend_loop_agent: un cuelgue es un fallo, no una demora.
assert.ok(Number.isFinite(LIMIT) && LIMIT >= 1 && LIMIT <= 100,
  `El límite del plan free debe ser un entero finito y razonable; llegó: ${LIMIT}. ` +
  'Si de verdad querés free ilimitado, este archivo entero deja de tener sentido: borralo con su motivo.')

// ═════════════════════════════════════════════════════════════════════════════
describe('Gate de plan — usuario free alcanza la cuota diaria', () => {
  it(`las primeras ${LIMIT} llamadas pasan; la ${LIMIT + 1} devuelve 403`, async () => {
    for (let i = 1; i <= LIMIT; i++) {
      const { status } = await post('/api/chat/design', { message: 'placard de 2000mm de ancho', sessionId: `s${i}` })
      assert.notEqual(status, 403, `la llamada ${i} de ${LIMIT} NO debería bloquearse`)
    }
    const { status, json } = await post('/api/chat/design', { message: 'otro placard', sessionId: 's-extra' })
    assert.equal(status, 403, `la llamada ${LIMIT + 1} debe bloquearse`)
    assert.equal(json.code, 'PLAN_LIMIT_REACHED')
  })

  it('el 403 trae el superset completo que el front necesita', async () => {
    for (let i = 0; i <= LIMIT; i++) await post('/api/chat/design', { message: 'placard', sessionId: `x${i}` })
    const { status, json } = await post('/api/chat/design', { message: 'placard', sessionId: 'x-final' })

    assert.equal(status, 403)
    assert.equal(json.success, false)
    assert.equal(json.code, 'PLAN_LIMIT_REACHED')
    assert.equal(json.action, 'UPGRADE_REQUIRED')
    assert.equal(json.plan, 'free')
    assert.equal(json.limit, LIMIT)
    assert.ok(json.used > LIMIT)
    assert.ok(!Number.isNaN(Date.parse(json.resetAt)), 'resetAt debe ser una fecha ISO válida')
  })

  it('CONTRATO i18n: `error` es texto en español, NO el token de máquina', async () => {
    for (let i = 0; i <= LIMIT; i++) await post('/api/chat/design', { message: 'placard', sessionId: `y${i}` })
    const { json } = await post('/api/chat/design', { message: 'placard', sessionId: 'y-final' })

    assert.notEqual(json.error, 'PLAN_LIMIT_REACHED',
      'REGRESIÓN: el token de máquina quedó en `error` → un usuario PT/EN leería "PLAN_LIMIT_REACHED" en pantalla')
    assert.ok(/l[ií]mite/i.test(json.error), `\`error\` debe ser legible en español, llegó: ${json.error}`)
    assert.ok(json.error.length > 20)
  })

  it('la cuota es POR USUARIO (el bloqueo de uno no salpica a otro)', async () => {
    for (let i = 0; i <= LIMIT; i++) await post('/api/chat/design', { message: 'placard', sessionId: `a${i}` }, { user: 'u-A' })
    const bloqueado = await post('/api/chat/design', { message: 'placard', sessionId: 'a-x' }, { user: 'u-A' })
    assert.equal(bloqueado.status, 403)

    const otro = await post('/api/chat/design', { message: 'placard', sessionId: 'b-1' }, { user: 'u-B' })
    assert.notEqual(otro.status, 403, 'u-B no consumió nada: no puede estar bloqueado')
  })

  it('chat/parse también consume cuota (llama al modelo)', async () => {
    for (let i = 0; i <= LIMIT; i++) await post('/api/chat/parse', { text: 'placard de 2000mm de ancho' })
    const { status, json } = await post('/api/chat/parse', { text: 'placard' })
    assert.equal(status, 403)
    assert.equal(json.code, 'PLAN_LIMIT_REACHED')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Gate de plan — pro y enterprise sin límite', () => {
  for (const plan of ['pro', 'enterprise']) {
    it(`${plan} pasa muy por encima de la cuota free y NUNCA recibe 403`, async () => {
      for (let i = 0; i < LIMIT * 3; i++) {
        const { status } = await post('/api/chat/design', { message: 'placard', sessionId: `p${i}` },
          { user: `u-${plan}`, plan })
        assert.notEqual(status, 403, `${plan} bloqueado en la llamada ${i + 1}`)
      }
    })
  }

  it('a un plan pago ni se le toca el contador', async () => {
    await post('/api/chat/design', { message: 'placard', sessionId: 'z1' }, { user: 'u-pro', plan: 'pro' })
    assert.equal(counts.size, 0, 'un plan ilimitado no debe generar escrituras en el store de cuota')
  })

  it('un plan DESCONOCIDO se trata como free (fail-closed en entitlements)', async () => {
    for (let i = 0; i <= LIMIT; i++) {
      await post('/api/chat/design', { message: 'placard', sessionId: `w${i}` }, { user: 'u-raro', plan: 'plan-inventado' })
    }
    const { status } = await post('/api/chat/design', { message: 'placard', sessionId: 'w-x' },
      { user: 'u-raro', plan: 'plan-inventado' })
    assert.equal(status, 403, 'un plan no reconocido NO puede ser una vía de acceso ilimitado')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Lo que NO se cobra. Esta suite es el corazón del diseño: si cae, el producto
// pasó de "5 generaciones con IA por día" a "5 diseños por día en total".
describe('Gate de plan — sólo se cobra lo que realmente consume IA', () => {
  it('design/generate con `params` (motor puro) NO consume cuota', async () => {
    const params = { moduleType: 'standard', width: 2000, height: 2200, depth: 580, numDrawers: 2, numShelves: 3 }
    for (let i = 0; i < LIMIT * 2; i++) {
      const { status } = await post('/api/design/generate', { params })
      assert.notEqual(status, 403, `motor paramétrico bloqueado en la llamada ${i + 1}`)
    }
    assert.equal(counts.size, 0,
      'REGRESIÓN: se está cobrando cuota por el motor determinista → el free no puede usar el formulario manual')
  })

  it('design/generate con `naturalLanguage` SÍ consume cuota', async () => {
    for (let i = 0; i <= LIMIT; i++) {
      await post('/api/design/generate', { naturalLanguage: 'placard de 2000mm de ancho y 2200mm de alto' })
    }
    const { status, json } = await post('/api/design/generate', { naturalLanguage: 'otro placard' })
    assert.equal(status, 403)
    assert.equal(json.code, 'PLAN_LIMIT_REACHED')
  })

  it('design/parse (regex LOCAL, sin IA) NO consume cuota', async () => {
    for (let i = 0; i < LIMIT * 2; i++) {
      const { status } = await post('/api/design/parse', { text: 'placard de 1800mm de ancho' })
      assert.notEqual(status, 403)
    }
    assert.equal(counts.size, 0, 'design/parse no llama a ningún proveedor: cobrarlo sería vender humo')
  })

  it('Fase 2 del HITL (confirmFlow + confirm) NO consume cuota: es determinista', async () => {
    const params = { moduleType: 'standard', width: 2000, height: 2200, depth: 580, numDrawers: 4, numShelves: 2 }
    for (let i = 0; i < LIMIT * 2; i++) {
      const { status } = await post('/api/chat/design', {
        message: 'sí, generá', sessionId: `c${i}`, lang: 'ES',
        confirmFlow: true, action: 'confirm', proposedParams: params,
      })
      assert.notEqual(status, 403, `la confirmación fue bloqueada en la llamada ${i + 1}`)
    }
    assert.equal(counts.size, 0,
      'REGRESIÓN: cobrar la Fase 2 hace que un free que gastó su última llamada proponiendo reciba 403 al confirmar')
  })

  it('un free bloqueado TODAVÍA puede confirmar una propuesta ya hecha', async () => {
    // Escenario real: gasta las 5 llamadas, la última deja una propuesta en pantalla.
    for (let i = 0; i <= LIMIT; i++) await post('/api/chat/design', { message: 'placard', sessionId: `d${i}` })
    const bloqueado = await post('/api/chat/design', { message: 'otro', sessionId: 'd-x' })
    assert.equal(bloqueado.status, 403, 'precondición: debe estar bloqueado')

    const { status, json } = await post('/api/chat/design', {
      message: 'sí, generá', sessionId: 'd-confirm', lang: 'ES',
      confirmFlow: true, action: 'confirm',
      proposedParams: { moduleType: 'standard', width: 2000, height: 2200, depth: 580, numDrawers: 4, numShelves: 2 },
    })
    assert.equal(status, 200, 'confirmar lo ya propuesto no gasta IA: bloquearlo sería cobrarle dos veces')
    assert.ok(json.design && json.design.success)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Gate de plan — degradación cuando el contador falla', () => {
  it('si el store revienta, la petición PASA (fail-open) — no se bloquea a quien paga', async () => {
    failNext = true
    const { status } = await post('/api/chat/design', { message: 'placard', sessionId: 'e1' })
    assert.notEqual(status, 403,
      'fail-closed convertiría una caída del contador en un apagón del producto para TODOS los planes')
  })

  it('sin store configurado, tampoco bloquea', async () => {
    setUsageStore({ /* sin increment → activeStore lo usa igual y falla */
      async increment() { throw new Error('no configurado') },
    })
    const { status } = await post('/api/chat/design', { message: 'placard', sessionId: 'e2' })
    setUsageStore(memStore)
    assert.notEqual(status, 403)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Gate de plan — utilidades de tiempo', () => {
  it('dayKey es YYYY-MM-DD en UTC', () => {
    assert.equal(dayKey(new Date('2026-08-02T23:59:59Z')), '2026-08-02')
    assert.equal(dayKey(new Date('2026-08-03T00:00:01Z')), '2026-08-03')
  })

  it('nextResetISO cae en la próxima medianoche UTC, siempre en el futuro', () => {
    const now = new Date('2026-08-02T13:00:00Z')
    assert.equal(nextResetISO(now), '2026-08-03T00:00:00.000Z')
    assert.ok(new Date(nextResetISO()) > new Date())
  })
})
