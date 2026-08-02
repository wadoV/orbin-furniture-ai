/**
 * Orbin AI — CANDADO DE AUTENTICACIÓN Y ENTITLEMENTS (ADITIVO 2026-08-02)
 * ═════════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * El backend ya tenía DOS arreglos de seguridad reales, correctamente aplicados
 * y prolijamente comentados:
 *
 *   · [2026-06-27] el plan se lee de `app_metadata`, nunca de `user_metadata`
 *                  (user_metadata lo escribe el propio usuario desde el cliente:
 *                   leer el plan de ahí = Enterprise gratis para cualquiera)
 *   · [2026-07-21] `Bearer dev-token` quedó gateado a NODE_ENV !== 'production'
 *                  (antes autenticaba como usuario 'pro' EN PRODUCCIÓN)
 *
 * Ninguno de los dos tenía test. Estaban sostenidos por un comentario.
 * Un comentario no impide que un refactor los deshaga: impide que se deshagan
 * *a propósito*. Las 234 pruebas anteriores seguían en verde si alguien quitaba
 * `requireAuth` de una ruta o volvía a leer `user_metadata`.
 *
 * Este archivo convierte esos dos comentarios en aserciones ejecutables, y
 * agrega un barrido ESTÁTICO que exige que toda ruta mutante esté guardada.
 *
 * DISCIPLINA (igual que i18nContract.test.js): si una ruta queda fuera, se
 * declara en OUT_OF_SCOPE **con el motivo escrito**. El test valida que el
 * motivo exista. No hay opción de "después lo reviso".
 */

process.env.NODE_ENV = 'production'          // el modo donde importa
process.env.SUPABASE_URL = 'https://stub.invalid'
process.env.SUPABASE_ANON_KEY = 'stub-anon-key'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// ── Stub de Supabase ────────────────────────────────────────────────────────
// Se sustituye `createClient` ANTES de require(auth.js), que lo desestructura
// al cargarse. Sin stub, el test saldría a la red y sería no determinista.
const supabaseSdk = require('@supabase/supabase-js')
assert.equal(typeof supabaseSdk.createClient, 'function',
  'El SDK de Supabase cambió su API: este candado quedó ciego. Revisar antes de tocar nada.')

let STUB_USER = null
supabaseSdk.createClient = () => ({
  auth: {
    getUser: async (token) => (token === 'valid-token' && STUB_USER)
      ? { data: { user: STUB_USER }, error: null }
      : { data: { user: null }, error: { message: 'invalid token' } },
  },
})

const { requireAuth, optionalAuth } = require('../middleware/auth')

// ── Arnés mínimo de Express ─────────────────────────────────────────────────
function runMiddleware(mw, { token } = {}) {
  return new Promise((resolve) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }
    const res = {
      statusCode: null,
      body: null,
      status(c) { this.statusCode = c; return this },
      json(b) { this.body = b; resolve({ passed: false, req, res: this }); return this },
    }
    mw(req, res, () => resolve({ passed: true, req, res }))
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · EL PLAN SALE DE app_metadata — NUNCA DE user_metadata
// ═════════════════════════════════════════════════════════════════════════════
describe('Entitlements — el plan se lee de app_metadata (SECURITY 2026-06-27)', () => {
  it('toma el plan de app_metadata', async () => {
    STUB_USER = {
      id: 'u1', email: 'a@b.c', role: 'authenticated',
      app_metadata: { plan: 'enterprise' },
      user_metadata: {},
    }
    const { passed, req } = await runMiddleware(requireAuth, { token: 'valid-token' })
    assert.ok(passed, 'un token válido debe pasar')
    assert.equal(req.user.plan, 'enterprise')
  })

  it('IGNORA user_metadata.plan aunque el usuario se autoasigne enterprise', async () => {
    // Escenario de ataque real: el usuario llama a supabase.auth.updateUser()
    // desde la consola del navegador y se escribe user_metadata.plan.
    STUB_USER = {
      id: 'u2', email: 'atacante@b.c', role: 'authenticated',
      app_metadata: {},                          // el servidor no le dio nada
      user_metadata: { plan: 'enterprise' },     // se lo puso él mismo
    }
    const { passed, req } = await runMiddleware(requireAuth, { token: 'valid-token' })
    assert.ok(passed)
    assert.equal(req.user.plan, 'free',
      'REGRESIÓN CRÍTICA: el plan se está leyendo de user_metadata → Enterprise gratis para cualquier usuario autenticado')
  })

  it('sin plan en app_metadata el default es free (fail-closed, no fail-open)', async () => {
    STUB_USER = { id: 'u3', email: 'c@b.c', role: 'authenticated', app_metadata: {}, user_metadata: {} }
    const { req } = await runMiddleware(requireAuth, { token: 'valid-token' })
    assert.equal(req.user.plan, 'free')
  })

  it('optionalAuth respeta la MISMA regla (es la otra puerta de entrada)', async () => {
    STUB_USER = {
      id: 'u4', email: 'd@b.c', role: 'authenticated',
      app_metadata: {}, user_metadata: { plan: 'pro' },
    }
    const { req } = await runMiddleware(optionalAuth, { token: 'valid-token' })
    assert.equal(req.user.plan, 'free',
      'optionalAuth también debe ignorar user_metadata: si no, el bypass se muda de puerta')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · EN PRODUCCIÓN NO HAY PUERTA TRASERA
// ═════════════════════════════════════════════════════════════════════════════
describe('requireAuth en producción — sin bypass (SECURITY 2026-07-21)', () => {
  it('sin token → 401', async () => {
    const { passed, res } = await runMiddleware(requireAuth)
    assert.equal(passed, false, 'una petición sin token JAMÁS debe llegar al handler en producción')
    assert.equal(res.statusCode, 401)
  })

  for (const devToken of ['dev-token', 'dev-local-token']) {
    it(`"${devToken}" NO autentica en producción`, async () => {
      STUB_USER = { id: 'x', app_metadata: { plan: 'enterprise' }, user_metadata: {} }
      const { passed, res } = await runMiddleware(requireAuth, { token: devToken })
      assert.equal(passed, false,
        `REGRESIÓN CRÍTICA: "${devToken}" volvió a ser una llave maestra en producción (bypass de auth + escalada a plan pro)`)
      assert.equal(res.statusCode, 401)
    })
  }

  it('un token inválido cualquiera → 401 y NO adjunta req.user', async () => {
    STUB_USER = null
    const { passed, req, res } = await runMiddleware(requireAuth, { token: 'basura' })
    assert.equal(passed, false)
    assert.equal(res.statusCode, 401)
    assert.equal(req.user, undefined, 'no debe quedar identidad adjunta tras un rechazo')
  })

  it('el mensaje de error no filtra detalle interno', async () => {
    const { res } = await runMiddleware(requireAuth, { token: 'basura' })
    const msg = JSON.stringify(res.body).toLowerCase()
    for (const leak of ['supabase', 'jwt', 'stub', 'token=', 'sql', 'stack']) {
      assert.ok(!msg.includes(leak), `el error al cliente filtra "${leak}": ${JSON.stringify(res.body)}`)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · BARRIDO ESTÁTICO: TODA RUTA MUTANTE ESTÁ GUARDADA
// ═════════════════════════════════════════════════════════════════════════════
//
// Mira el CÓDIGO FUENTE, no el runtime: detecta que alguien borró `requireAuth`
// de una ruta aunque ningún test de esa ruta falle.
//
// Para quedar fuera hay que declararlo acá CON MOTIVO. El test valida que el
// motivo exista y no esté vacío.
const OUT_OF_SCOPE = {
  'billing.js POST /webhook':
    'Lo llama el proveedor de pagos, no un usuario: no hay sesión que exigir. ' +
    'Se autentica por firma HMAC (stripe.webhooks.constructEvent) y, en Mercado Pago, ' +
    're-consultando el pago contra la API de MP en vez de confiar en el cuerpo recibido.',
  'stressTest.js POST /':
    'Router de QA. index.js sólo lo requiere y monta si NODE_ENV !== "production" ' +
    '(require condicional + guard `if (stressTestRouter)`): en producción no existe.',
}

const ROUTES_DIR = __dirname
const MUTATING = /router\.(post|put|patch|delete)\(\s*'([^']+)'/g

function collectRoutes(file) {
  const src = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8')
  const blanket = src.search(/router\.use\(\s*requireAuth\s*\)/)
  const found = []
  for (const m of src.matchAll(MUTATING)) {
    const idx = m.index
    const lineEnd = src.indexOf('\n', idx)
    const decl = src.slice(idx, lineEnd === -1 ? undefined : lineEnd)
    found.push({
      key: `${file} ${m[1].toUpperCase()} ${m[2]}`,
      guarded: (blanket !== -1 && blanket < idx) || /requireAuth/.test(decl),
    })
  }
  return found
}

describe('Contrato de auth — barrido estático de server/src/routes', () => {
  const files = fs.readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))

  it('encuentra rutas que auditar (si no, el candado está ciego)', () => {
    assert.ok(files.length >= 5, `sólo se hallaron ${files.length} archivos de ruta`)
    const total = files.flatMap(collectRoutes).length
    assert.ok(total >= 10, `sólo se hallaron ${total} rutas mutantes: ¿cambió la forma de declararlas?`)
  })

  it('TODA ruta mutante está guardada por requireAuth (o declarada fuera de alcance con motivo)', () => {
    const naked = []
    for (const file of files) {
      for (const { key, guarded } of collectRoutes(file)) {
        if (guarded) continue
        const reason = OUT_OF_SCOPE[key]
        if (!reason || !reason.trim()) {
          naked.push(key)
        } else {
          assert.ok(reason.trim().length > 40,
            `El motivo de OUT_OF_SCOPE["${key}"] es demasiado breve para ser una justificación real.`)
        }
      }
    }
    assert.deepEqual(naked, [],
      'Rutas mutantes SIN requireAuth y sin declarar:\n  - ' + naked.join('\n  - ') +
      '\nAgregá requireAuth, o declarala en OUT_OF_SCOPE con el motivo escrito.')
  })

  it('los endpoints señalados por el CEO están explícitamente guardados', () => {
    const all = new Map(files.flatMap(collectRoutes).map(r => [r.key, r.guarded]))
    for (const key of [
      'chat.js POST /design',    // conversacional → LLM
      'chat.js POST /parse',     // NL → params
      'design.js POST /generate',// motor paramétrico
      'design.js POST /parse',
      'vision.js POST /analyze-space', // el más caro: Gemini Vision
    ]) {
      assert.equal(all.get(key), true, `${key} NO está guardada por requireAuth`)
    }
  })

  it('OUT_OF_SCOPE no acumula entradas muertas', () => {
    const all = new Set(files.flatMap(collectRoutes).map(r => r.key))
    for (const key of Object.keys(OUT_OF_SCOPE)) {
      assert.ok(all.has(key),
        `OUT_OF_SCOPE["${key}"] ya no corresponde a ninguna ruta real: borrala para que la lista siga significando algo.`)
    }
  })
})
