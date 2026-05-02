/**
 * Orbin AI — Projects Routes (Supabase persistence)
 * POST   /api/projects/save     — Save design to Supabase
 * GET    /api/projects/:id      — Load design by ID
 * GET    /api/projects          — List recent projects (last 20)
 * DELETE /api/projects/:id      — Delete project
 *
 * Falls back gracefully to in-memory store when Supabase is not configured.
 */

const express = require('express')
const router  = express.Router()

// ─── Storage layer (Supabase or in-memory fallback) ──────────────────────────

let supabase = null
const memStore = new Map() // fallback in-memory store

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

// ─── POST /api/projects/save ─────────────────────────────────────────────────

router.post('/save', async (req, res) => {
  try {
    const { design, label } = req.body
    if (!design || !design.id) {
      return res.status(400).json({ success: false, error: 'Campo "design" com "id" obrigatório.' })
    }

    const record = {
      id:         design.id || `PRJ-${Date.now()}`,
      label:      label || `Proyecto Modular ${new Date().toLocaleDateString()}`,
      modules:    design.modules || [design], // Support both single design and module array
      created_at: new Date().toISOString(),
    }

    const sb = getSupabase()
    if (sb) {
      const { error } = await sb.from('projects').upsert(record)
      if (error) throw new Error(error.message)
    } else {
      memStore.set(design.id, record)
    }

    res.json({ success: true, id: design.id, label: record.label, storage: sb ? 'supabase' : 'memory' })
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
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw new Error(error.message)
      return res.json({ success: true, projects: data, storage: 'supabase' })
    }

    // In-memory
    const projects = [...memStore.values()]
      .map(r => ({ id: r.id, label: r.label, created_at: r.created_at }))
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
      const { data, error } = await sb.from('projects').select('*').eq('id', id).single()
      if (error) return res.status(404).json({ success: false, error: 'Projeto não encontrado.' })
      return res.json({ success: true, ...data, storage: 'supabase' })
    }

    const record = memStore.get(id)
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
      const { error } = await sb.from('projects').delete().eq('id', id)
      if (error) throw new Error(error.message)
    } else {
      memStore.delete(id)
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
