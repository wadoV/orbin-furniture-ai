/**
 * Orbin AI — QA Stress Test Endpoint
 * POST /api/v1/stress-test
 *
 * Dedicated endpoint for automated QA agents (Google Cloud Vertex AI, n8n, etc.)
 * Bypasses production guards to exercise the parametric engine directly.
 * CORS is open on this route — restrict to internal IPs in production.
 */

const express      = require('express')
const cors         = require('cors')
const { generateProject } = require('../engine/closetEngine')
const { validateDesign }  = require('../engine/validator')
const { STRUCTURAL_LIMITS, MATERIAL, HARDWARE, DEFAULTS } = require('../engine/constants')

const router = express.Router()

// ─── Open CORS for this route only ───────────────────────────────────────────
// Allows Google Cloud agents, ngrok tunnels, and CI pipelines to reach this endpoint.
router.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
router.options('*', cors())

// ─── Known carpentry anti-patterns for the QA agent ─────────────────────────
const ANTI_PATTERNS = {
  ZERO_DIVISION_RISK:    'Possible division by zero — thickness equals width or height.',
  NEGATIVE_DIMENSION:    'Negative or zero dimension — physically impossible.',
  EXTREME_SPAN:          'Internal span far exceeds safe MDF/MDP limits (>900mm unsupported).',
  IMPOSSIBLE_DRAWER:     'Drawer stack height exceeds available internal height.',
  NANO_DIMENSIONS:       'Dimensions so small the engine may produce <=0 pieces.',
  GIGANTIC_DIMENSIONS:   'Dimensions exceed raw plate size — nesting impossible.',
  DRAWER_WIDER_THAN_CAB: 'Drawer box wider than internal cabinet width after slide discount.',
  SHELF_THICKER_THAN_CAB:'Shelf thickness equals or exceeds cabinet internal depth.',
  BASEBOARD_OVERFLOW:    'Baseboard height is larger than total cabinet height.',
  DIVIDERS_OVERFLOW:     'Number of dividers leaves zero usable column width.',
}

// ─── POST /api/v1/stress-test ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const startTime = Date.now()
  const testId    = req.body.testId || `st_${Date.now()}`

  // ── 1. Extract & sanitize input ──────────────────────────────────────────
  const {
    params         = {},
    bypassRangeGuards = false,
    description    = '',
  } = req.body

  // BUG FIX: Number(undefined) = NaN, and NaN ?? X = NaN (NaN is not null/undefined).
  // Use explicit undefined check so unspecified params fall back to defaults,
  // while explicitly-sent values (0, -18, etc.) propagate for hostile QA testing.
  const num = (val, def) => (val !== undefined && val !== null) ? Number(val) : def

  const p = {
    width:         num(params.width,         DEFAULTS.width),
    height:        num(params.height,        DEFAULTS.height),
    depth:         num(params.depth,         DEFAULTS.depth),
    thickness:     num(params.thickness,     DEFAULTS.thickness),
    numShelves:    num(params.numShelves,    DEFAULTS.numShelves),
    numDrawers:    num(params.numDrawers,    DEFAULTS.numDrawers),
    drawerHeight:  num(params.drawerHeight,  DEFAULTS.drawerHeight),
    numDividers:   num(params.numDividers,   0),
    drawerLayout:  params.drawerLayout       || 'vertical',
    hasDoors:      params.hasDoors           ?? false,
    doorType:      params.doorType           || 'none',
    baseboard:     params.baseboard          ?? true,
    baseboardHeight: num(params.baseboardHeight, 100),
    edgeBandingType: params.edgeBandingType  || 'thin',
    backThickness: num(params.backThickness,  6),
    type:          params.type               || 'closet',
  }

  // ── 2. Pre-flight anti-pattern detection ────────────────────────────────
  const preflightWarnings = []

  if (p.width <= 0 || p.height <= 0 || p.depth <= 0) {
    preflightWarnings.push({ code: 'NEGATIVE_DIMENSION', message: ANTI_PATTERNS.NEGATIVE_DIMENSION })
  }
  if (p.thickness >= p.width || p.thickness >= p.height) {
    preflightWarnings.push({ code: 'ZERO_DIVISION_RISK', message: ANTI_PATTERNS.ZERO_DIVISION_RISK })
  }
  if (p.width < 5 || p.height < 5 || p.depth < 5) {
    preflightWarnings.push({ code: 'NANO_DIMENSIONS', message: ANTI_PATTERNS.NANO_DIMENSIONS })
  }
  if (p.width > 10000 || p.height > 10000 || p.depth > 10000) {
    preflightWarnings.push({ code: 'GIGANTIC_DIMENSIONS', message: ANTI_PATTERNS.GIGANTIC_DIMENSIONS })
  }
  if (p.baseboardHeight >= p.height) {
    preflightWarnings.push({ code: 'BASEBOARD_OVERFLOW', message: ANTI_PATTERNS.BASEBOARD_OVERFLOW })
  }
  const internalW = p.width - 2 * p.thickness
  if (p.numDividers > 0 && (internalW / (p.numDividers + 1)) < p.thickness * 2) {
    preflightWarnings.push({ code: 'DIVIDERS_OVERFLOW', message: ANTI_PATTERNS.DIVIDERS_OVERFLOW })
  }
  if (internalW > STRUCTURAL_LIMITS.MAX_SHELF_SPAN) {
    preflightWarnings.push({ code: 'EXTREME_SPAN', message: ANTI_PATTERNS.EXTREME_SPAN })
  }

  // ── 3. Production range guards (optional bypass for hostile testing) ─────
  const rangeErrors = []
  if (!bypassRangeGuards) {
    if (p.width  < 100 || p.width  > 6000)  rangeErrors.push(`width ${p.width}mm fuera de rango [100–6000]`)
    if (p.height < 200 || p.height > 3500)  rangeErrors.push(`height ${p.height}mm fuera de rango [200–3500]`)
    if (p.depth  < 100 || p.depth  > 1000)  rangeErrors.push(`depth ${p.depth}mm fuera de rango [100–1000]`)
  }

  if (rangeErrors.length > 0) {
    const elapsed = Date.now() - startTime
    console.log(`[QA][${testId}] RANGE_GUARD blocked — ${rangeErrors.join(' | ')} (${elapsed}ms)`)
    return res.status(400).json({
      testId,
      description,
      params: p,
      result: 'RANGE_GUARD',
      rangeErrors,
      preflightWarnings,
      validation: null,
      engineResult: null,
      durationMs: elapsed,
    })
  }

  // ── 4. Run the parametric engine (catch crashes) ─────────────────────────
  let engineResult = null
  let engineError  = null
  let engineStatus = 'OK'

  try {
    engineResult = generateProject(p)
    if (!engineResult.success) {
      engineStatus = 'ENGINE_FAIL'
    }
  } catch (err) {
    engineError  = { message: err.message, stack: err.stack }
    engineStatus = 'ENGINE_CRASH'
    console.error(`[QA][${testId}] ENGINE_CRASH:`, err.message)
  }

  // ── 5. Run structural validator (only if engine produced output) ──────────
  let validation = null
  if (engineResult && engineResult.success) {
    try {
      validation = validateDesign(engineResult)
    } catch (err) {
      validation = { status: 'VALIDATOR_CRASH', errors: [err.message], warnings: [], summary: 'Validator threw an exception.' }
      console.error(`[QA][${testId}] VALIDATOR_CRASH:`, err.message)
    }
  }

  // ── 6. Determine overall QA result ───────────────────────────────────────
  let qaResult
  if (engineStatus === 'ENGINE_CRASH') {
    qaResult = 'CRITICAL_CRASH'
  } else if (engineStatus === 'ENGINE_FAIL') {
    qaResult = 'ENGINE_FAIL'
  } else if (validation?.status === 'RECHAZADO') {
    qaResult = 'STRUCTURAL_FAIL'
  } else if (validation?.warnings?.length > 0 || preflightWarnings.length > 0) {
    qaResult = 'WARNINGS'
  } else {
    qaResult = 'PASS'
  }

  const elapsed = Date.now() - startTime
  const httpCode = ['CRITICAL_CRASH', 'ENGINE_FAIL'].includes(qaResult) ? 500 : 200

  console.log(`[QA][${testId}] ${qaResult} | w:${p.width} h:${p.height} d:${p.depth} t:${p.thickness} | ${elapsed}ms`)

  return res.status(httpCode).json({
    testId,
    description,
    params: p,
    result: qaResult,
    rangeErrors: [],
    preflightWarnings,
    validation,
    engineResult: engineResult
      ? {
          success:     engineResult.success,
          piecesCount: engineResult.pieces?.length ?? 0,
          nestingPlatesCount: engineResult.nesting?.length ?? 0,
          nestingEfficiency: engineResult.nesting?.[0]?.overallEfficiency ?? null,
          error:       engineResult.error ?? null,
        }
      : null,
    engineError,
    durationMs: elapsed,
  })
})

// ─── GET /api/v1/stress-test/schema ──────────────────────────────────────────
// Returns the OpenAPI-compatible JSON schema for the Google Cloud Vertex AI agent.
router.get('/schema', (_req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Orbin IA Stress Test API', version: '1.0.0', description: 'QA endpoint for parametric furniture engine validation.' },
    paths: {
      '/api/v1/stress-test': {
        post: {
          operationId: 'runStressTest',
          summary: 'Submit a furniture design for structural validation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    testId:            { type: 'string', description: 'Unique ID for this test run, e.g. "test_001"' },
                    description:       { type: 'string', description: 'Human-readable test description' },
                    bypassRangeGuards: { type: 'boolean', default: false, description: 'Set true to send extreme values directly to the engine, bypassing production range guards' },
                    params: {
                      type: 'object',
                      description: 'Parametric dimensions of the furniture module (all in mm)',
                      properties: {
                        width:           { type: 'number', description: 'Total external width in mm (e.g. 2400)' },
                        height:          { type: 'number', description: 'Total external height in mm (e.g. 2400)' },
                        depth:           { type: 'number', description: 'Total external depth in mm (e.g. 600)' },
                        thickness:       { type: 'number', description: 'Panel thickness in mm (standard: 18)' },
                        numShelves:      { type: 'number', description: 'Number of horizontal shelves' },
                        numDrawers:      { type: 'number', description: 'Number of drawers' },
                        drawerHeight:    { type: 'number', description: 'Height of each drawer box in mm' },
                        numDividers:     { type: 'number', description: 'Number of internal vertical dividers' },
                        hasDoors:        { type: 'boolean', description: 'Whether the module has doors' },
                        baseboard:       { type: 'boolean', description: 'Whether the module has a baseboard (rodapé)' },
                        baseboardHeight: { type: 'number', description: 'Baseboard height in mm (standard: 100)' },
                        drawerLayout:    { type: 'string', enum: ['vertical', 'horizontal'], description: 'Drawer arrangement' },
                        type:            { type: 'string', enum: ['closet', 'kitchen_low', 'kitchen_high'], description: 'Module type' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Test completed — PASS or WARNINGS. Check result field.' },
            '400': { description: 'Parameters blocked by range guards (bypassRangeGuards was false).' },
            '500': { description: 'Engine crash or structural fail (CRITICAL_CRASH or ENGINE_FAIL).' },
          },
        },
      },
    },
  })
})

module.exports = router
