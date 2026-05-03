/**
 * Orbin AI — Chat Routes
 * POST /api/chat/design   — Conversational design (AI-powered or regex fallback)
 * POST /api/chat/parse    — Single parse with Claude (AI-enhanced NL → params)
 */

const express = require('express')
const router  = express.Router()
const { parseDesignIntent, chatDesign } = require('../ai/aiOrchestrator')
const { generateProject } = require('../engine/closetEngine')

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
        response.design = generateProject(result.params)
        response.params = result.params
      } catch (engineErr) {
        response.engineError = engineErr.message
      }
    } else if (result.params) {
      response.params = result.params
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

// ─── DELETE /api/chat/session/:id ────────────────────────────────────────────

router.delete('/session/:id', (req, res) => {
  sessions.delete(req.params.id)
  res.json({ success: true })
})

module.exports = router
