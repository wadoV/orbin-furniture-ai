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
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    supabase = createClient(url, key)
    return supabase
  } catch {
    return null
  }
}

// ★ 2026-10-09 (piloto): Supabase lento/caído nunca debe colgar un request.
//   Toda llamada a la DB se corta a DB_TIMEOUT_MS y cae al Map en memoria.
const DB_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS) || 2500
function withDbTimeout(promise, label) {
  let t
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timeout ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS) }),
  ]).finally(() => clearTimeout(t))
}
const DEMO_RESILIENT = () => process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'

// ★ 2026-10-10 (ADITIVO): persistencia local en disco (server/data/approved_projects).
//   Local-first: se escribe SIEMPRE (salvo ORBIN_LOCAL_STORE=false), antes de Supabase.
//   Un fallo de disco nunca tumba el request: se loguea y se sigue con memoria/Supabase.
const localStore = require('../storage/localProjectStore')
const path = require('path')

function writeLocal(record) {
  if (!localStore.isEnabled()) return null
  try {
    const { file, contentHash } = localStore.saveProject(record)
    return { file: path.basename(file), contentHash }   // nunca exponer la ruta absoluta
  } catch (err) {
    console.error('[projects/local] No se pudo escribir en disco:', err.message)
    return { error: 'disk_write_failed' }
  }
}

// ─── Apply auth to ALL routes in this router ─────────────────────────────────
// Must be declared before any route handler.
router.use(requireAuth)

// ─── POST /api/projects/save ─────────────────────────────────────────────────

router.post('/save', async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const { design, label } = req.body || {}
  if (!design || !design.id) {
    return res.status(400).json({ success: false, error: 'El campo "design" con "id" es obligatorio.' })
  }

  const userId = req.user?.id || 'dev-local-user'
  const modules = design.modules || [design]
  if (req.user?.plan === 'free' && modules.length > 3) {
    return res.status(403).json({
      success: false,
      error: 'Límite de plan gratuito superado. El plan gratuito está limitado a un máximo de 3 módulos. Por favor, actualiza tu cuenta a un plan Pro o Enterprise.'
    })
  }

  const record = {
    id:         design.id || `PRJ-${Date.now()}`,
    owner_id:   userId,
    label:      label || `Proyecto Modular ${new Date().toLocaleDateString()}`,
    modules,
    created_at: new Date().toISOString(),
  }

  // Save in memory first as resilient fallback
  memStore.set(`${userId}:${record.id}`, record)
  // …y en disco local (sobrevive a reinicios; no depende de red ni de Supabase)
  const local = writeLocal(record)

  const sb = getSupabase()
  if (sb) {
    try {
      const { error } = await withDbTimeout(sb.from('projects').upsert(record), 'projects.upsert')
      if (error) throw new Error(error.message)
      return res.json({ success: true, id: record.id, label: record.label, storage: local?.file ? 'supabase+local' : 'supabase', local })
    } catch (err) {
      console.warn('[projects/save] Supabase error, saved to memory fallback:', err.message)
    }
  }

  return res.status(200).json({ success: true, id: record.id, label: record.label, storage: local?.file ? "local" : "memory", local, contentHash: local?.contentHash })
})

// ─── GET /api/projects ───────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const userId = req.user?.id || 'dev-local-user'
  const sb = getSupabase()
  if (sb) {
    try {
      const { data, error } = await withDbTimeout(sb
        .from('projects')
        .select('id, label, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(20), 'projects.list')
      if (!error && Array.isArray(data)) {
        return res.json({ success: true, projects: data, storage: 'supabase' })
      }
    } catch (err) {
      console.warn('[projects/list] Supabase error, falling back to memory store:', err.message)
    }
  }

  // In-memory fallback: filter by owner prefix
  const prefix = `${userId}:`
  const projects = [...memStore.entries()]
    .filter(([k]) => k.startsWith(prefix) || userId === 'dev-local-user')
    .map(([, r]) => ({ id: r.id, label: r.label, created_at: r.created_at }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
  // ★ 2026-10-10: une lo guardado en disco (sobrevive a reinicios del server)
  const seen = new Set(projects.map(p => p.id))
  const fromDisk = localStore.isEnabled()
    ? localStore.listProjects(userId === 'dev-local-user' ? null : userId, 20).filter(p => !seen.has(p.id))
    : []
  const merged = [...projects, ...fromDisk]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 20)
  res.json({ success: true, projects: merged, storage: fromDisk.length ? 'memory+local' : 'memory' })
})

// ─── GET /api/projects/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user?.id || 'dev-local-user'
  const sb = getSupabase()

  if (sb) {
    try {
      const { data, error } = await withDbTimeout(sb
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('owner_id', userId)
        .single(), 'projects.get')
      if (!error && data) {
        return res.json({ success: true, ...data, storage: 'supabase' })
      }
    } catch (err) {
      console.warn('[projects/get] Supabase error, falling back to memory store:', err.message)
    }
  }

  const record = memStore.get(`${userId}:${id}`) || memStore.get(`dev-local-user:${id}`)
    || (localStore.isEnabled() ? (localStore.getProject(userId, id) || localStore.getProject('dev-local-user', id)) : null)
  if (!record) return res.status(200).json({ success: false, error: 'Proyecto no encontrado en almacenamiento local.' })
  res.json({ success: true, ...record, storage: 'memory' })
})


// ─── DELETE /api/projects/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const sb = getSupabase()

    if (sb) {
      // Double-filter: id + owner_id → no row deleted if user doesn't own it
      const { error, count } = await withDbTimeout(sb
        .from('projects')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('owner_id', req.user.id), 'projects.delete')                   // ← ownership enforced
      if (error) throw new Error(error.message)
      if (count === 0) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
      if (localStore.isEnabled()) localStore.deleteProject(req.user.id, id)   // copia local en sync
    } else {
      const key = `${req.user.id}:${id}`
      const onDisk = localStore.isEnabled() && localStore.deleteProject(req.user.id, id)
      if (!memStore.has(key) && !onDisk) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
      memStore.delete(key)
    }

    res.json({ success: true })
  } catch (err) {
    // FIX #8 (QA 2026-06-26): este catch no logueaba nada server-side y devolvía
    // err.message crudo al cliente — el único de los 4 handlers de este archivo
    // sin console.error. Agregado para no perder el detalle al sanear la respuesta.
    console.error('[projects/delete] Error:', err)
    // DEMO_MODE: DB caída → borra del Map volátil y responde 200 (cero 500 en planta).
    if (DEMO_RESILIENT()) {
      memStore.delete(`${req.user?.id}:${req.params.id}`)
      if (localStore.isEnabled()) localStore.deleteProject(req.user?.id, req.params.id)
      return res.json({ success: true, storage: 'memory', degraded: true })
    }
    res.status(500).json({ success: false, error: 'No pudimos eliminar el proyecto. Intentá de nuevo.' })
  }
})

module.exports = router
