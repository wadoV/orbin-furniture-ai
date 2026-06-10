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
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  const sb = getAuthClient()

  // ── In-memory / local-dev fallback ──────────────────────────────────────────
  if (!sb) {
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

    const { id, email, role } = data.user

    // Attach minimal identity to request — routes read req.user.id / req.user.email
    req.user = { id, email, role }

    // Optionally: gate on email_confirmed_at, banned_until, etc. here if needed

    next()
  } catch (err) {
    console.error('[requireAuth] Unexpected error:', err.message)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { requireAuth, DEV_USER }
