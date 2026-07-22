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
const { validateDesign } = require('../engine/validator')
const { requireAuth } = require('../middleware/auth')
const z = require('zod')

const contextSchema = z.object({
  userName: z.string().min(1).max(50).trim().optional(),
  company: z.string().min(1).max(50).trim().optional(),
  lang: z.enum(['ES', 'EN', 'PT']).optional()
}).passthrough();

// ─── POST /api/design/generate ────────────────────────────────────────────────

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { params, naturalLanguage } = req.body

    // Validar contexto con Zod (para prevenir inyecciones si se pasan estos campos)
    const contextValidation = contextSchema.safeParse(req.body)
    if (!contextValidation.success) {
      return res.status(400).json({ success: false, error: 'Parámetros de contexto inválidos.' })
    }

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
        error: 'Enviá "params" (objeto) o "naturalLanguage" (texto).',
      })
    }

    // Validate numeric ranges
    const numFields = ['width', 'height', 'depth', 'thickness', 'numShelves', 'numDrawers', 'numDividers', 'drawerHeight']
    for (const field of numFields) {
      if (finalParams[field] !== undefined) {
        finalParams[field] = Number(finalParams[field])
        // BUG FIX T30: NaN check MUST come before range comparisons — NaN < 100 is false in JS
        if (isNaN(finalParams[field]) || !isFinite(finalParams[field])) {
          return res.status(400).json({ success: false, error: `El campo "${field}" debe ser numérico y finito.` })
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
      return res.status(400).json({ success: false, error: `Espesor (${t}mm) inválido para el ancho (${finalParams.width}mm). Debe ser menor a la mitad del ancho.` })
    }
    if (finalParams.baseboard && finalParams.baseboardHeight >= finalParams.height) {
      return res.status(400).json({ success: false, error: `Altura del zócalo (${finalParams.baseboardHeight}mm) debe ser menor que la altura total (${finalParams.height}mm).` })
    }

    // Generate design
    const result = generateProject(finalParams)

    if (!result.success) {
      const status = result.statusCode || (result.code === 'STRUCTURAL_FAIL_BAD_INPUT' ? 400 : 500)
      return res.status(status).json(result)
    }

    // BUG FIX (Recovery item a): run the real structural validator instead of
    // letting the client render a hardcoded "all checks passed" message.
    const validation = validateDesign(result)

    const response = {
      success: true,
      design:  result,
      validation,
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
    // FIX #8 (QA 2026-06-26): el campo `detail: err.message` exponía el error
    // interno crudo (stack/mensaje de librería) directo en la respuesta JSON,
    // y la UI lo concatenaba y mostraba tal cual. El detalle ya queda logueado
    // server-side arriba; al cliente solo le llega un mensaje seguro.
    console.error('[design/generate] Error:', err)
    res.status(500).json({ success: false, error: 'No pudimos generar el proyecto. Intentá de nuevo.' })
  }
})

// ─── POST /api/design/parse ───────────────────────────────────────────────────
// Quick endpoint to preview NL parsing without generating full design

router.post('/parse', requireAuth, (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ success: false, error: 'El campo "text" es obligatorio.' })
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
    return res.json({ success: true, prices: [], source: 'fallback_error' })
  }
}

// Register route on router (accessible via /api/design/prices or /design/prices)
router.get('/prices', getPrices)

// Expose the handler function so it can be mounted directly at the root (/api/prices) in index.js
router.getPrices = getPrices

// ─── Biblioteca Verificada (viable_designs) ──────────────────────────────────
// POST /api/designs/save-viable  — persiste SOLO diseños estructuralmente
//                                  viables (validator.js → VALIDADO).
// GET  /api/designs/viable       — lista la biblioteca del usuario.
//
// Montado también en /api/designs y /designs (ver server/src/index.js).
// Migración requerida: server/supabase/migrations/005_create_viable_designs.sql
// ─────────────────────────────────────────────────────────────────────────────

// Claves que closetEngine.generateProject() consume. Cualquier otra cosa que
// venga del cliente (piezas, cutList, nesting, ids, timestamps, campos
// inventados) se DESCARTA: `parametric_json` es un payload de ENTRADA
// replayable, no un volcado de la salida.
const ENGINE_INPUT_KEYS = [
  'moduleType', 'type',
  'width', 'height', 'depth', 'thickness', 'backThickness',
  'numShelves', 'numDrawers', 'numDividers', 'numDoors', 'drawerHeight',
  'hasDoors', 'doorType', 'baseboard', 'baseboardHeight',
  'hasCountertop', 'countertopThickness', 'countertopOverhang',
  'materialId', 'materialBody', 'materialFront',
  'hangingRod', 'slideType', 'edgeBanding', 'grainDirection',
]

function pickEngineParams(source = {}) {
  const out = {}
  for (const k of ENGINE_INPUT_KEYS) {
    const v = source[k]
    if (v === undefined || v === null || typeof v === 'function') continue
    out[k] = v
  }
  return out
}

// Categorías de negocio de la Galería. `category` NO se deriva de moduleType
// (un `standard` puede ser closet o baño); se captura explícita al guardar.
// null = sin clasificar. Cualquier valor fuera de la lista se normaliza a null.
const GALLERY_CATEGORIES = ['cocina', 'aereo', 'bano', 'closet', 'escritorio']

const viableSchema = z.object({
  design_name: z.string().min(3).max(120).trim(),
  params:      z.record(z.any()).optional(),
  design:      z.record(z.any()).optional(),
  category:    z.string().optional(),
})

router.post('/save-viable', requireAuth, async (req, res) => {
  try {
    // 1) Validación de entrada
    const parsed = viableSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de diseño inválido (3–120 caracteres) o payload mal formado.',
        code: 'BAD_INPUT',
      })
    }
    const { design_name } = parsed.data
    const rawParams = parsed.data.params || parsed.data.design?.configuration || parsed.data.design

    if (!rawParams || typeof rawParams !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Enviá "params" (configuración paramétrica) o "design" con su "configuration".',
        code: 'BAD_INPUT',
      })
    }

    const engineParams = pickEngineParams(rawParams)
    if (!engineParams.width || !engineParams.height || !engineParams.depth) {
      return res.status(400).json({
        success: false,
        error: 'La configuración no tiene dimensiones (width/height/depth).',
        code: 'BAD_INPUT',
      })
    }

    // 2) GUARD CRÍTICO — nunca confiar en la geometría que manda el cliente.
    //    Se REGENERA el diseño server-side con el mismo motor y se valida esa
    //    salida. Si aceptáramos `pieces` del body, cualquiera podría forjar un
    //    payload "válido" con devtools y contaminar la biblioteca verificada.
    const generated = generateProject(engineParams)
    if (!generated || !generated.success) {
      return res.status(400).json({
        success: false,
        error: 'El motor no pudo generar este diseño. No se guardó.',
        code: 'ENGINE_FAIL',
      })
    }

    const validation = validateDesign(generated)

    // Colisiones / desviaciones estructurales críticas emitidas por el motor
    // (p. ej. PIECE_EXCEEDS_PLATE). VALIDADO no las cubre todas: el motor las
    // reporta por separado en specAdjustments.
    const criticalAdjustments = (generated.specAdjustments || [])
      .filter(a => a && a.severity === 'critical')

    const isViable =
      validation.status === 'VALIDADO' &&
      validation.errors.length === 0 &&
      criticalAdjustments.length === 0

    if (!isViable) {
      return res.status(400).json({
        success: false,
        error: 'Diseño no viable: no se guarda en la Biblioteca Verificada.',
        code: 'NOT_VIABLE',
        validation,
        criticalAdjustments,
      })
    }

    // 3) Persistencia — sin fallback en memoria a propósito. Una "biblioteca
    //    verificada" que se evapora al reiniciar el proceso es peor que un
    //    error explícito: el usuario creería que guardó y no guardó nada.
    const sb = getSupabase()
    if (!sb) {
      return res.status(503).json({
        success: false,
        error: 'El almacenamiento no está disponible en este momento. Intentá de nuevo en unos minutos.',
        code: 'STORAGE_UNAVAILABLE',
      })
    }

    // Normalizar categoría contra la allow-list (fuera de lista → null).
    const rawCategory = typeof parsed.data.category === 'string' ? parsed.data.category.trim().toLowerCase() : null
    const category = GALLERY_CATEGORIES.includes(rawCategory) ? rawCategory : null

    const record = {
      user_id:         req.user?.id && req.user.id !== 'dev-local-user' ? req.user.id : null,
      design_name,
      module_type:     generated.configuration?.moduleType || generated.type || 'standard',
      category,
      parametric_json: engineParams,          // ← replayable: generateProject(parametric_json)
      snapshot_json:   { design: generated, validation },
      engine_version:  generated.version || null,
    }

    const { data, error } = await sb
      .from('viable_designs')
      .insert(record)
      .select('id, design_name, module_type, category, created_at')
      .single()

    if (error) throw new Error(error.message)

    return res.status(201).json({
      success: true,
      saved:   data,
      validation,
    })
  } catch (err) {
    console.error('[design/save-viable] Error:', err)
    return res.status(500).json({
      success: false,
      error: 'No pudimos guardar el diseño verificado. Intentá de nuevo.',
    })
  }
})

// ─── GET /api/designs/viable ─────────────────────────────────────────────────

router.get('/viable', requireAuth, async (req, res) => {
  try {
    const sb = getSupabase()
    if (!sb) {
      return res.status(503).json({
        success: false,
        error: 'El almacenamiento no está disponible en este momento.',
        code: 'STORAGE_UNAVAILABLE',
      })
    }

    let query = sb
      .from('viable_designs')
      .select('id, design_name, module_type, category, parametric_json, engine_version, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    // Scoped al usuario autenticado (las filas legacy con user_id NULL no se listan)
    if (req.user?.id && req.user.id !== 'dev-local-user') {
      query = query.eq('user_id', req.user.id)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return res.json({ success: true, designs: data || [] })
  } catch (err) {
    console.error('[design/viable-list] Error:', err)
    return res.status(500).json({ success: false, error: 'No pudimos cargar la biblioteca verificada.' })
  }
})

module.exports = router

