/**
 * Orbin AI — Chat Routes
 * POST /api/chat/design   — Conversational design (AI-powered or regex fallback)
 * POST /api/chat/parse    — Single parse with Claude (AI-enhanced NL → params)
 */

const express = require('express')
const router  = express.Router()
const { parseDesignIntent, chatDesign, chatAudit } = require('../ai/aiOrchestrator')
const { generateProject } = require('../engine/closetEngine')
const { optionalAuth } = require('../middleware/auth')
const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase admin client
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

// ─── Param Normalizer (mirrors design.js logic so chat can safely call engine) ─

function normalizeDesignParams(raw) {
  const p = { ...raw }

  // Numeric coercion
  const numFields = ['width', 'height', 'depth', 'thickness', 'numShelves', 'numDrawers', 'numDividers', 'drawerHeight', 'baseboardHeight', 'backThickness']
  for (const f of numFields) {
    if (p[f] !== undefined) {
      p[f] = Number(p[f])
      if (isNaN(p[f]) || !isFinite(p[f])) delete p[f]
    }
  }

  // Apply defaults for missing structural fields
  p.width         = p.width         > 0  ? p.width         : 600
  p.height        = p.height        > 0  ? p.height        : 2200
  p.depth         = p.depth         > 0  ? p.depth         : 580
  p.thickness     = p.thickness     > 0  ? p.thickness     : 18
  p.backThickness = p.backThickness > 0  ? p.backThickness : 6
  p.numShelves    = p.numShelves    != null ? Number(p.numShelves)    : 1
  p.numDrawers    = p.numDrawers    != null ? Number(p.numDrawers)    : 0
  p.drawerHeight  = p.drawerHeight  > 0  ? p.drawerHeight  : 180
  p.baseboard     = p.baseboard     ?? true
  p.baseboardHeight = p.baseboardHeight > 0 ? p.baseboardHeight : 100

  // Clamp to safe ranges (don't reject — clamp silently so chat never crashes engine)
  if (p.width  < 100)  p.width  = 100
  if (p.width  > 6000) p.width  = 6000
  if (p.height < 200)  p.height = 200
  if (p.height > 3500) p.height = 3500
  if (p.depth  < 100)  p.depth  = 100
  if (p.depth  > 1000) p.depth  = 1000

  // type → moduleType mapping
  if (!p.moduleType) {
    const typeMap = { kitchen_low: 'base', kitchen_high: 'aereo', kitchen_island: 'base', closet: 'standard' }
    p.moduleType = typeMap[p.type] || 'standard'
  }

  // Cross-field: thickness must be less than half the width
  if (p.thickness <= 0 || p.thickness >= p.width / 2) {
    p.thickness = Math.min(18, Math.floor(p.width / 4))
  }
  // Cross-field: baseboard height must be less than total height
  if (p.baseboard && p.baseboardHeight >= p.height) {
    p.baseboardHeight = Math.min(100, Math.floor(p.height / 4))
  }

  return p
}

// In-memory session store (replace with Redis/Supabase for production)
const sessions = new Map()

// ─── POST /api/chat/design ────────────────────────────────────────────────────

router.post('/design', async (req, res) => {
  try {
    const { message, sessionId, autoGenerate = true } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Campo "message" obrigatório.' })
    }

    // Retrieve or create session history
    const history = sessions.get(sessionId) || []

    const result = await chatDesign(history, message)

    // Update history
    const newHistory = [
      ...history,
      { role: 'user',      content: message },
      { role: 'assistant', content: result.message },
    ]
    // Keep last 20 turns to stay within context limits
    const trimmed = newHistory.slice(-20)
    if (sessionId) sessions.set(sessionId, trimmed)

    const response = {
      success: true,
      reply:   result.message,
      source:  result.source,
    }

    // If params were extracted and autoGenerate is on, run the engine
    if (result.params && autoGenerate) {
      try {
        const safeParams = normalizeDesignParams(result.params)
        response.design  = generateProject(safeParams)
        response.params  = safeParams
      } catch (engineErr) {
        console.error('[chat/design] Engine error:', engineErr.message)
        response.engineError = engineErr.message
      }
    } else if (result.params) {
      response.params = normalizeDesignParams(result.params)
    }

    res.json(response)
  } catch (err) {
    console.error('[chat/design] Error:', err)
    res.status(500).json({ success: false, error: err.message || 'Erro no chat.' })
  }
})

// ─── POST /api/chat/parse ─────────────────────────────────────────────────────

router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ success: false, error: 'Campo "text" obrigatório.' })

    const result = await parseDesignIntent(text)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[chat/parse] Error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── POST /api/chat/audit ─────────────────────────────────────────────────────

router.post('/audit', optionalAuth, async (req, res) => {
  try {
    const { message, sessionId, telemetry } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Campo "message" obligatorio.' })
    }

    const userId = req.user?.id || 'dev-local-user'
    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)

    // Save telemetry to database if present and we have a valid uuid user_id
    if (telemetry && typeof telemetry === 'object') {
      const { source, metric_name, metric_value } = telemetry
      if (source && metric_name && metric_value) {
        if (supabase && isUuid(userId)) {
          const { error: dbErr } = await supabase
            .from('telemetry_logs')
            .insert({
              user_id: userId,
              source,
              metric_name,
              metric_value
            })
          if (dbErr) {
            console.error('[chat/audit] Failed to save telemetry to DB:', dbErr.message)
          } else {
            console.log('[chat/audit] Successfully saved telemetry log to DB')
          }
        } else {
          console.log('[chat/audit] Telemetry received but DB insert bypassed (local dev or invalid UUID)')
        }
      }
    }

    // Format user message to inject telemetry context
    let finalMessage = message
    if (telemetry && typeof telemetry === 'object') {
      const formattedTelemetry = `[TELEMETRÍA EN VIVO - Fuente: ${telemetry.source}, Métrica: ${telemetry.metric_name}] Datos: ${JSON.stringify(telemetry.metric_value)}`
      finalMessage = `${formattedTelemetry}\n\nUsuario: ${message}`
    }

    // Retrieve or create session history
    const history = sessions.get(sessionId) || []

    const result = await chatAudit(history, finalMessage)

    // Update history
    const newHistory = [
      ...history,
      { role: 'user',      content: message },
      { role: 'assistant', content: result.message },
    ]
    // Keep last 20 turns
    const trimmed = newHistory.slice(-20)
    if (sessionId) sessions.set(sessionId, trimmed)

    res.json({
      success: true,
      reply:   result.message,
      source:  result.source,
    })
  } catch (err) {
    console.error('[chat/audit] Error:', err)
    res.status(500).json({ success: false, error: err.message || 'Error en auditoría.' })
  }
})

// ─── DELETE /api/chat/session/:id ────────────────────────────────────────────

router.delete('/session/:id', (req, res) => {
  sessions.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
