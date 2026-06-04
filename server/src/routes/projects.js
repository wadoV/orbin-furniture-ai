/**
 * Orbin AI — Projects Routes (Supabase persistence)
 * POST   /api/projects/save     — Save design to Supabase (auth required)
 * GET    /api/projects/:id      — Load design by ID       (auth required, owner only)
 * GET    /api/projects          — List user's projects    (auth required, owner only)
 * DELETE /api/projects/:id      — Delete project          (auth required, owner only)
 *
 * Falls back gracefully to in-memory store when Supabase is not configured.
 * In fallback mode, auth is mocked (see middleware/auth.js DEV_USER).
 */

const express     = require('express')
const router      = express.Router()
const { requireAuth } = require('../middleware/auth')

// ─── Storage layer (Supabase service client or in-memory fallback) ────────────

let supabase = null
const memStore = new Map() // fallback in-memory store (keyed by `${userId}:${id}`)

function getSupabase() {
  if (supabase) return supabase
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    return supabase
  } catch {
    return null
  }
}

// ─── Apply auth to ALL routes in this router ─────────────────────────────────
// Must be declared before any route handler.
router.use(requireAuth)

// ─── POST /api/projects/save ─────────────────────────────────────────────────

router.post('/save', async (req, res) => {
  try {
    const { design, label } = req.body
    if (!design || !design.id) {
      return res.status(400).json({ success: false, error: 'Campo "design" com "id" obrigatório.' })
    }

    const record = {
      id:         design.id || `PRJ-${Date.now()}`,
      owner_id:   req.user.id,                                             // ← bind to authenticated user
      label:      label || `Proyecto Modular ${new Date().toLocaleDateString()}`,
      modules:    design.modules || [design],
      created_at: new Date().toISOString(),
    }

    const sb = getSupabase()
    if (sb) {
      const { error } = await sb.from('projects').upsert(record)
      if (error) throw new Error(error.message)
    } else {
      memStore.set(`${req.user.id}:${record.id}`, record)
    }

    res.json({ success: true, id: record.id, label: record.label, storage: sb ? 'supabase' : 'memory' })
  } catch (err) {
    console.error('[projects/save] Error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── GET /api/projects ───────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const sb = getSupabase()
    if (sb) {
      const { data, error } = await sb
        .from('projects')
        .select('id, label, created_at')
        .eq('owner_id', req.user.id)                                       // ← scoped to user
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw new Error(error.message)
      return res.json({ success: true, projects: data, storage: 'supabase' })
    }

    // In-memory: filter by owner prefix
    const prefix = `${req.user.id}:`
    const projects = [...memStore.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, r]) => ({ id: r.id, label: r.label, created_at: r.created_at }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20)
    res.json({ success: true, projects, storage: 'memory' })
  } catch (err) {
    console.error('[projects/list] Error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── GET /api/projects/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sb = getSupabase()

    if (sb) {
      const { data, error } = await sb
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', req.user.id)                                       // ← ownership check at query level
        .single()
      if (error || !data) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' })
      return res.json({ success: true, ...data, storage: 'supabase' })
    }

    const record = memStore.get(`${req.user.id}:${id}`)
    if (!record) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' })
    res.json({ success: true, ...record, storage: 'memory' })
  } catch (err) {
    console.error('[projects/get] Error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── DELETE /api/projects/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sb = getSupabase()

    if (sb) {
      // Double-filter: id + owner_id → no row deleted if user doesn't own it
      const { error, count } = await sb
        .from('projects')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('owner_id', req.user.id)                                       // ← ownership enforced
      if (error) throw new Error(error.message)
      if (count === 0) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' })
    } else {
      const key = `${req.user.id}:${id}`
      if (!memStore.has(key)) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' })
      memStore.delete(key)
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
