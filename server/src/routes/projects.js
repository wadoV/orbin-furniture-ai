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
// ★ ADITIVO 2026-10-11 — gate: solo se persisten diseños estructuralmente sanos
const { validateDesign } = require('../engine/validator')

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
    // ★ FIX 2026-10-11: el guard previo exigía design.id siempre, pero NINGÚN
    // call site del cliente lo envía (ProjectsPanel.jsx manda {modules} sin id;
    // el flujo HITL manda el módulo suelto, que sí trae id propio). El id real
    // se genera más abajo con fallback (`design.id || 'PRJ-'+Date.now()`) —
    // exigirlo acá rechazaba TODO guardado desde la UI con 400. Se afloja el
    // guard a solo "es un objeto", que es lo único que el resto del handler
    // necesita.
    if (!design || typeof design !== 'object') {
      return res.status(400).json({ success: false, error: 'El campo "design" es obligatorio.' })
    }

    const modules = design.modules || [design]

    // ★ ADITIVO 2026-10-11 — Solo se guardan diseños sanos (VALIDADO).
    // Reusa el mismo validador estructural que ya corre en /design/generate
    // y en el flujo HITL de chat (server/src/engine/validator.js), para que
    // la galería nunca termine con un diseño que no se puede cortar.
    const rejections = []
    modules.forEach((mod, idx) => {
      try {
        const v = validateDesign(mod)
        if (v.status === 'RECHAZADO') {
          const moduleLabel = mod.type || mod.moduleType || `Módulo ${idx + 1}`
          rejections.push(`${moduleLabel}: ${v.errors.join(' | ')}`)
        }
      } catch (e) {
        rejections.push(`Módulo ${idx + 1}: no se pudo validar estructuralmente (${e.message}).`)
      }
    })
    if (rejections.length > 0) {
      return res.status(400).json({
        success: false,
        error: `No se guardó: ${rejections.length} ${rejections.length === 1 ? 'módulo tiene' : 'módulos tienen'} errores estructurales.\n${rejections.join('\n')}`,
      })
    }

    if (req.user.plan === 'free' && modules.length > 3) {
      return res.status(403).json({
        success: false,
        error: 'Límite de plan gratuito superado. El plan gratuito está limitado a un máximo de 3 módulos. Por favor, actualiza tu cuenta a un plan Pro o Enterprise.'
      })
    }

    const record = {
      id:         design.id || `PRJ-${Date.now()}`,
      owner_id:   req.user.id,                                             // ← bind to authenticated user
      label:      label || `Proyecto Modular ${new Date().toLocaleDateString()}`,
      modules,
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
    // FIX #8 (QA 2026-06-26): err.message podía exponer detalle interno de
    // Supabase. Ya queda logueado server-side; al cliente solo el mensaje seguro.
    console.error('[projects/save] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos guardar el proyecto. Intentá de nuevo.' })
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
    res.status(500).json({ success: false, error: 'No pudimos cargar tus proyectos. Intentá de nuevo.' })
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
      if (error || !data) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
      return res.json({ success: true, ...data, storage: 'supabase' })
    }

    const record = memStore.get(`${req.user.id}:${id}`)
    if (!record) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
    res.json({ success: true, ...record, storage: 'memory' })
  } catch (err) {
    console.error('[projects/get] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos cargar el proyecto. Intentá de nuevo.' })
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
      if (count === 0) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
    } else {
      const key = `${req.user.id}:${id}`
      if (!memStore.has(key)) return res.status(404).json({ success: false, error: 'Proyecto no encontrado.' })
      memStore.delete(key)
    }

    res.json({ success: true })
  } catch (err) {
    // FIX #8 (QA 2026-06-26): este catch no logueaba nada server-side y devolvía
    // err.message crudo al cliente — el único de los 4 handlers de este archivo
    // sin console.error. Agregado para no perder el detalle al sanear la respuesta.
    console.error('[projects/delete] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos eliminar el proyecto. Intentá de nuevo.' })
  }
})

module.exports = router
