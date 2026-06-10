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
  email: 'dev@localhost',
  plan:  'free',
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  const sb = getAuthClient()

  // ── Local-dev fallback — NUNCA en producción (fail-closed) ───────────────────
  if (!sb) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[requireAuth] Supabase no configurado en producción — acceso denegado.')
      return res.status(503).json({ error: 'Auth service unavailable' })
    }
    req.user = DEV_USER
    return next()
  }

  // ── Extract Bearer token ─────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Verify token with Supabase ───────────────────────────────────────────────
  try {
    const { data, error } = await sb.auth.getUser(token)

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id, email, role, user_metadata } = data.user
    const plan = user_metadata?.plan || 'free'

    // Attach identity and plan to request
    req.user = { id, email, role, plan }

    next()
  } catch (err) {
    console.error('[requireAuth] Unexpected error:', err.message)
    return res.status(401).json({ error: 'Unauthorized' })
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

  if (!token) {
    req.user = { id: null, plan: 'free' }
    return next()
  }

  try {
    const { data, error } = await sb.auth.getUser(token)
    if (error || !data?.user) {
      req.user = { id: null, plan: 'free' }
      return next()
    }
    const { id, email, role, user_metadata } = data.user
    const plan = user_metadata?.plan || 'free'
    req.user = { id, email, role, plan }
    next()
  } catch (err) {
    req.user = { id: null, plan: 'free' }
    next()
  }
}

module.exports = { requireAuth, optionalAuth, DEV_USER }

