/**
 * Orbin AI — Design Routes
 * POST /api/design/generate  — Generate from params or natural language
 * GET  /api/design/:id       — Retrieve saved design (requires Supabase)
 */

const express = require('express')
const router  = express.Router()
const { generateProject } = require('../engine/closetEngine')
const { parseDesignIntent, chatDesign } = require('../ai/aiOrchestrator')
const { parseNaturalLanguage } = require('../engine/nlParser')

// ─── POST /api/design/generate ────────────────────────────────────────────────

router.post('/generate', (req, res) => {
  try {
    const { params, naturalLanguage } = req.body

    let finalParams = {}
    let nlResult    = null
    if (naturalLanguage && typeof naturalLanguage === 'string' && naturalLanguage.trim()) {
      // Parse natural language → params (using Vertex AI/Ollama)
      try {
        const result = await parseDesignIntent(naturalLanguage)
        nlResult = {
          params: result,
          interpreted: result.interpreted || naturalLanguage,
          confidence: result.confidence || 0.9,
          source: result.source
        }
        finalParams = { ...nlResult.params, ...(params || {}) }
      } catch (err) {
        console.warn('[design/generate] AI parsing failed, using regex:', err.message)
        nlResult = parseNaturalLanguage(naturalLanguage)
        finalParams = { ...nlResult.params, ...(params || {}) }
      }
    } else if (params && typeof params === 'object') {
      finalParams = params
    } else {
      return res.status(400).json({
        success: false,
        error: 'Forneça "params" (objeto) o "naturalLanguage" (string).',
      })
    }

    // Validate numeric ranges
    const numFields = ['width', 'height', 'depth', 'thickness', 'numShelves', 'numDrawers', 'numDividers', 'drawerHeight']
    for (const field of numFields) {
      if (finalParams[field] !== undefined) {
        finalParams[field] = Number(finalParams[field])
        if (isNaN(finalParams[field])) {
          return res.status(400).json({ success: false, error: `Campo "${field}" deve ser numérico.` })
        }
      }
    }

    // Clamp values to safe ranges
    if (finalParams.width  && (finalParams.width  < 100 || finalParams.width  > 6000)) {
      return res.status(400).json({ success: false, error: 'Largura deve estar entre 100mm e 6000mm.' })
    }
    if (finalParams.height && (finalParams.height < 200 || finalParams.height > 3500)) {
      return res.status(400).json({ success: false, error: 'Altura deve estar entre 200mm e 3500mm.' })
    }
    if (finalParams.depth  && (finalParams.depth  < 100 || finalParams.depth  > 1000)) {
      return res.status(400).json({ success: false, error: 'Profundidade deve estar entre 100mm e 1000mm.' })
    }

    // Generate design
    const result = generateProject(finalParams)

    if (!result.success) {
      return res.status(500).json(result)
    }

    const response = {
      success: true,
      design:  result,
    }

    if (nlResult) {
      response.nlParsing = {
        original:    naturalLanguage,
        interpreted: nlResult.interpreted,
        confidence:  nlResult.confidence,
      }
    }

    res.json(response)
  } catch (err) {
    console.error('[design/generate] Error:', err)
    res.status(500).json({ success: false, error: 'Erro interno ao gerar projeto.', detail: err.message })
  }
})

// ─── POST /api/design/parse ───────────────────────────────────────────────────
// Quick endpoint to preview NL parsing without generating full design

router.post('/parse', (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ success: false, error: 'Campo "text" obrigatório.' })
  const result = parseNaturalLanguage(text)
  res.json({ success: true, ...result })
})

// ─── GET /api/design/defaults ────────────────────────────────────────────────

router.get('/defaults', (req, res) => {
  const { DEFAULTS } = require('../engine/constants')
  res.json({ success: true, defaults: DEFAULTS })
})

module.exports = router
