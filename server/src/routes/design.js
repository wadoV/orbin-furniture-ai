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

router.post('/generate', async (req, res) => {
  try {
    const { params, naturalLanguage } = req.body

    let finalParams = {}
    let nlResult    = null
    if (naturalLanguage && typeof naturalLanguage === 'string' && naturalLanguage.trim()) {
      // Parse natural language → params (using Vertex AI/Ollama)
      try {
        const result = await parseDesignIntent(naturalLanguage)
        // BUG FIX CRITICAL: Vertex AI returns { params: {...}, confidence, interpreted }
        // — the actual design params are nested under result.params, NOT at root level.
        // Without this fix, finalParams spreads the wrapper object (params: {…}, confidence: X)
        // and finalParams.width / height / etc. are all undefined → always falls back to defaults.
        const aiParams = result.params || result
        nlResult = {
          params: aiParams,
          interpreted: result.interpreted || aiParams.interpreted || naturalLanguage,
          confidence: result.confidence ?? aiParams.confidence ?? 0.9,
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
        // BUG FIX T30: NaN check MUST come before range comparisons — NaN < 100 is false in JS
        if (isNaN(finalParams[field]) || !isFinite(finalParams[field])) {
          return res.status(400).json({ success: false, error: `Campo "${field}" deve ser numérico e finito.` })
        }
      }
    }

    // Clamp values to safe ranges (never reject — clamp silently so engine never crashes)
    if (finalParams.width)  finalParams.width  = Math.max(100,  Math.min(6000, finalParams.width))
    if (finalParams.height) finalParams.height = Math.max(200,  Math.min(3500, finalParams.height))
    if (finalParams.depth)  finalParams.depth  = Math.max(100,  Math.min(1000, finalParams.depth))

    // Apply defaults for any missing structural fields so cross-field checks are always valid
    finalParams.width         = Number(finalParams.width)         || 600
    finalParams.height        = Number(finalParams.height)        || 2200
    finalParams.depth         = Number(finalParams.depth)         || 580
    finalParams.thickness     = Number(finalParams.thickness)     || 18
    finalParams.backThickness = Number(finalParams.backThickness) || 6
    finalParams.numShelves    = finalParams.numShelves    != null ? Number(finalParams.numShelves)    : 1
    finalParams.numDrawers    = finalParams.numDrawers    != null ? Number(finalParams.numDrawers)    : 0
    finalParams.drawerHeight  = Number(finalParams.drawerHeight)  || 180
    finalParams.baseboard     = finalParams.baseboard     ?? true
    finalParams.baseboardHeight = Number(finalParams.baseboardHeight) || 100

    // BUG FIX: Normalize type → moduleType so Viewer3D renders the correct geometry.
    // nlParser returns type:'kitchen_low' but Viewer3D expects moduleType:'base'.
    if (!finalParams.moduleType) {
      const typeMap = { kitchen_low: 'base', kitchen_high: 'aereo', kitchen_island: 'base', closet: 'standard' }
      finalParams.moduleType = typeMap[finalParams.type] || 'standard'
    }

    // BUG FIX T12/T15/T23: Cross-field constraints that cause ENGINE_CRASH if unchecked
    // FIXED: was using (width || 0)/2 which caused 18 >= 0 = always true → always rejected
    const t = finalParams.thickness
    if (t <= 0 || t >= finalParams.width / 2) {
      return res.status(400).json({ success: false, error: `Espessura (${t}mm) inválida para largura (${finalParams.width}mm). Deve ser < metade da largura.` })
    }
    if (finalParams.baseboard && finalParams.baseboardHeight >= finalParams.height) {
      return res.status(400).json({ success: false, error: `Altura do rodapé (${finalParams.baseboardHeight}mm) deve ser menor que a altura total (${finalParams.height}mm).` })
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
