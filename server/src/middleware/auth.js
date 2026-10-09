/**
 * Orbin AI — Auth Middleware
 * Verifies Supabase JWT tokens sent as `Authorization: Bearer <token>`.
 *
 * Behavior:
 *   - Supabase configured  → verifies token via auth.getUser(), attaches req.user
 *   - Supabase NOT configured (local dev / in-memory mode) → injects a mock user
 *     so all routes remain functional without a real Supabase project.
 */

const { createClient } = require('@supabase/supabase-js')

// ─── Supabase auth client (lazy-initialized, uses anon key for auth.getUser) ──

let _authClient = null

function getAuthClient() {
  if (_authClient) return _authClient
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    _authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return _authClient
  } catch {
    return null
  }
}

// ─── Dev-mode mock user (only active when Supabase is not configured) ─────────

const DEV_USER = {
  id:    'dev-local-user',
  name:  'Demo Taller Pro',
  email: 'dev@localhost',
  plan:  'pro',
  role:  'admin',
}

// ─── Demo / piloto (bypass condicional, nunca destructivo) ────────────────────
// DEMO_MODE=true en server/.env → auth no consulta Supabase para tokens demo y
// cualquier caída/timeout de Supabase degrada a DEV_USER en lugar de 401/503.
function demoBypassAllowed() {
  return process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'
}

// Supabase colgado = request colgado. Se corta a los N ms.
const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS) || 3000
function withTimeout(promise, ms, label) {
  let t
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timeout ' + ms + 'ms')), ms) }),
  ]).finally(() => clearTimeout(t))
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  // ── Short-circuit Demo Mode ──────────────────────────────────────────────────
  const authHeader = req.headers ? (req.headers.authorization || '') : ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  // ★ SECURITY 2026-10-09: el bypass por token demo estaba ABIERTO también en
  //   producción (cualquiera con `Bearer demo-token` obtenía Pro/admin). Ahora solo
  //   aplica con DEMO_MODE=true o fuera de producción — reactivable sin tocar código.
  if (demoBypassAllowed() && (req.isDemoMode || token === 'demo-local-token' || token === 'demo-token')) {
    req.user = DEV_USER
    return next()
  }

  const sb = getAuthClient()

  // ── Local-dev & Demo fallback ───────────────────
  if (!sb) {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      console.error('[requireAuth] Supabase no configurado en producción — acceso denegado.')
      return res.status(503).json({ error: 'Servicio de autenticación no disponible. Intentá de nuevo en unos minutos.' })
    }
    req.user = DEV_USER
    return next()
  }

  if (!token) {
    if (process.env.DEMO_MODE === 'true') {
      req.user = DEV_USER
      return next()
    }
    if (process.env.NODE_ENV !== 'production') {
      req.user = DEV_USER
      return next()
    }
    return res.status(401).json({ error: 'Tu sesión expiró o no es válida. Volvé a iniciar sesión.' })
  }

  // Dev token bypass (QA testing & local dev) — HARD-GATED to non-production (unless DEMO_MODE)
  if ((process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') && (token === 'dev-local-token' || token === 'dev-token')) {
    req.user = DEV_USER
    return next()
  }

  // ── Verify token with Supabase ───────────────────────────────────────────────
  try {
    const { data, error } = await withTimeout(sb.auth.getUser(token), AUTH_TIMEOUT_MS, 'supabase.auth.getUser')

    if (error || !data?.user) {
      if (process.env.DEMO_MODE === 'true') { req.user = DEV_USER; return next() }
      return res.status(401).json({ error: 'Tu sesión expiró o no es válida. Volvé a iniciar sesión.' })
    }


    // SECURITY [2026-06-27]: el plan se lee de app_metadata, NUNCA de
    // user_metadata. user_metadata es escribible por el propio usuario vía
    // supabase.auth.updateUser() desde el cliente (incluyendo devtools) — leer
    // el plan de ahí permitía a cualquier usuario autenticado autoasignarse
    // Enterprise gratis. app_metadata solo es escribible por el service_role
    // (ver server/src/routes/billing.js: webhook real + /redeem-promo +
    // /downgrade-free), nunca por el SDK público.
    const { id, email, role, app_metadata } = data.user
    const plan = app_metadata?.plan || 'free'

    // Attach identity and plan to request
    req.user = { id, email, role, plan }

    next()
  } catch (err) {
    console.error('[requireAuth] Unexpected error:', err.message)
    // DEMO_MODE: Supabase caído/lento no debe expulsar al taller de la demo.
    if (process.env.DEMO_MODE === 'true') { req.user = DEV_USER; return next() }
    return res.status(401).json({ error: 'Tu sesión expiró o no es válida. Volvé a iniciar sesión.' })
  }
}

// ─── optionalAuth ─────────────────────────────────────────────────────────────

async function optionalAuth(req, res, next) {
  const sb = getAuthClient()

  if (!sb) {
    // En producción, sin Supabase = anónimo (nunca DEV_USER autenticado).
    req.user = (process.env.NODE_ENV === 'production') ? { id: null, plan: 'free' } : DEV_USER
    return next()
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (demoBypassAllowed() && (token === 'demo-local-token' || token === 'demo-token')) {
    req.user = DEV_USER
    return next()
  }

  if (!token) {
    req.user = { id: null, plan: 'free' }
    return next()
  }

  try {
    const { data, error } = await withTimeout(sb.auth.getUser(token), AUTH_TIMEOUT_MS, 'supabase.auth.getUser')
    if (error || !data?.user) {
      req.user = { id: null, plan: 'free' }
      return next()
    }
    const { id, email, role, app_metadata } = data.user
    const plan = app_metadata?.plan || 'free'
    req.user = { id, email, role, plan }
    next()
  } catch (err) {
    req.user = { id: null, plan: 'free' }
    next()
  }
}

module.exports = { requireAuth, optionalAuth, DEV_USER }
