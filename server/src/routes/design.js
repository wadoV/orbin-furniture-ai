/**
 * Orbin AI — Design Routes
 * POST /api/design/generate  — Generate from params or natural language
 * GET  /api/design/:id       — Retrieve saved design (requires Supabase)
 */

const express = require('express')
const router  = express.Router()
const { generateProject, generateProjectAutoSplit } = require('../engine/closetEngine')
const { parseDesignIntent, chatDesign } = require('../ai/aiOrchestrator')
const { parseNaturalLanguage } = require('../engine/nlParser')
const { optionalAuth } = require('../middleware/auth')

// ─── POST /api/design/generate ────────────────────────────────────────────────

router.post('/generate', optionalAuth, async (req, res) => {
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

    // Generate design (auto-split si el ancho supera el aprovechable de la chapa)
    const splitResult = generateProjectAutoSplit(finalParams)

    if (!splitResult.success) {
      return res.status(500).json(splitResult.modules[0] || { success: false, error: 'Falha na geração.' })
    }

    if (req.user && req.user.plan === 'free' && splitResult.modules.length > 3) {
      return res.status(403).json({
        success: false,
        error: 'Límite de plan gratuito superado. El plan gratuito está limitado a un máximo de 3 módulos. Por favor, actualiza tu cuenta a un plan Pro o Enterprise.'
      })
    }

    const response = {
      success: true,
      design:  splitResult.modules[0],   // compat: primeiro módulo
      modules: splitResult.modules,      // todos os módulos (1 ou N)
      split:   splitResult.split,
      splitInfo: splitResult.split
        ? { count: splitResult.count, totalWidth: splitResult.totalWidth, maxModuleWidth: splitResult.maxModuleWidth }
        : null,
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

// ─── GET /api/prices (Supabase integration with 1h caching) ──────────────────

let supabaseClient = null

function getSupabase() {
  if (supabaseClient) return supabaseClient
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return supabaseClient
  } catch (err) {
    console.warn('[design/getPrices] Failed to initialize Supabase client:', err.message)
    return null
  }
}

let priceCache = null
let cacheExpiresAt = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in ms

async function getPrices(req, res) {
  const now = Date.now()
  if (priceCache && now < cacheExpiresAt) {
    return res.json({ success: true, prices: priceCache, source: 'cache' })
  }

  const sb = getSupabase()
  if (!sb) {
    console.warn('[design/getPrices] Supabase is not configured. Returning empty prices fallback.')
    return res.json({ success: true, prices: [], source: 'fallback_empty' })
  }

  try {
    const { data, error } = await sb
      .from('material_prices')
      .select('*')
      .order('material_code', { ascending: true })

    if (error) {
      throw error
    }

    priceCache = data || []
    cacheExpiresAt = now + CACHE_DURATION
    return res.json({ success: true, prices: priceCache, source: 'supabase' })
  } catch (err) {
    console.error('[design/getPrices] Error fetching material prices:', err.message)
    // Return empty array to trigger client-side fallback silently
    return res.json({ success: true, prices: [], source: 'fallback_error', error: err.message })
  }
}

// Register route on router (accessible via /api/design/prices or /design/prices)
router.get('/prices', getPrices)

// Expose the handler function so it can be mounted directly at the root (/api/prices) in index.js
router.getPrices = getPrices

module.exports = router
