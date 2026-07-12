/**
 * Orbin AI — Chat Routes
 * POST /api/chat/design   — Conversational design (AI-powered or regex fallback)
 * POST /api/chat/parse    — Single parse with Claude (AI-enhanced NL → params)
 */

const express = require('express')
const router  = express.Router()
const { parseDesignIntent, chatDesign } = require('../ai/aiOrchestrator')
const { buildOrbinChatPrompt } = require('../ai/systemPrompts')
const { generateProject } = require('../engine/closetEngine')

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
    const { message, sessionId, autoGenerate = true, lang, userName, company } = req.body
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'El campo "message" es obligatorio.' })
    }

    // Retrieve or create session history
    const history = sessions.get(sessionId) || []

    const options = (lang || userName || company)
      ? { systemPrompt: buildOrbinChatPrompt({ userName, company, lang }) }
      : {}
    const result = await chatDesign(history, message, options)

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
    // FIX #8 (QA 2026-06-26): exponía err.message crudo (puede incluir detalle
    // interno de la llamada a Gemini/Ollama). El detalle real ya queda logueado
    // arriba; al usuario le mostramos un mensaje seguro y genérico.
    console.error('[chat/design] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos procesar tu mensaje. Intentá de nuevo en unos segundos.' })
  }
})

// ─── POST /api/chat/parse ─────────────────────────────────────────────────────

router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ success: false, error: 'El campo "text" es obligatorio.' })

    const result = await parseDesignIntent(text)
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[chat/parse] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos interpretar el texto. Intentá de nuevo.' })
  }
})

// ─── DELETE /api/chat/session/:id ────────────────────────────────────────────

router.delete('/session/:id', (req, res) => {
  sessions.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
