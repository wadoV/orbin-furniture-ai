/**
 * Orbin AI — Design Analyzer v1.0
 * PROTECTED: Smart analysis engine for furniture designs
 *
 * Evaluates: waste efficiency, structural stability, manufacturing complexity,
 * cost optimization, and generates actionable suggestions.
 */

// ── Score Weights ──────────────────────────────────────────────────────────
const WEIGHTS = {
  waste: 0.30,
  stability: 0.25,
  complexity: 0.20,
  cost: 0.15,
  manufacturing: 0.10,
}

// ── Sheet Constants ────────────────────────────────────────────────────────
const SHEET_W = 2440 // mm
const SHEET_H = 1830 // mm
const SHEET_AREA = SHEET_W * SHEET_H // mm2

// ── Main Analyzer ──────────────────────────────────────────────────────────
export function analyzeDesign(modules) {
  if (!modules || modules.length === 0) return null

  const pieces = modules.flatMap(m => m.pieces || [])
  if (pieces.length === 0) return null

  const wasteScore = calcWasteScore(pieces)
  const stabilityScore = calcStabilityScore(modules, pieces)
  const complexityScore = calcComplexityScore(modules, pieces)
  const costScore = calcCostScore(pieces)
  const manufacturingScore = calcManufacturingScore(pieces)

  const overall = Math.round(
    wasteScore.score * WEIGHTS.waste +
    stabilityScore.score * WEIGHTS.stability +
    complexityScore.score * WEIGHTS.complexity +
    costScore.score * WEIGHTS.cost +
    manufacturingScore.score * WEIGHTS.manufacturing
  )

  const suggestions = [
    ...wasteScore.suggestions,
    ...stabilityScore.suggestions,
    ...complexityScore.suggestions,
    ...costScore.suggestions,
    ...manufacturingScore.suggestions,
  ]

  // Sort by priority (high first)
  suggestions.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority))

  return {
    overall,
    grade: scoreToGrade(overall),
    color: scoreToColor(overall),
    categories: {
      waste: wasteScore,
      stability: stabilityScore,
      complexity: complexityScore,
      cost: costScore,
      manufacturing: manufacturingScore,
    },
    suggestions: suggestions.slice(0, 5), // Top 5 most important
    stats: computeStats(modules, pieces),
  }
}

// ── Waste Score ─────────────────────────────────────────────────────────────
function calcWasteScore(pieces) {
  const totalArea = pieces.reduce((s, p) => {
    const qty = p.quantity || 1
    return s + (p.width * p.height * qty)
  }, 0)

  const sheetsNeeded = Math.ceil(totalArea / SHEET_AREA)
  const usedArea = totalArea / (sheetsNeeded * SHEET_AREA)
  const wastePercent = Math.round((1 - usedArea) * 100)

  // Score: 0% waste = 100, 50%+ waste = 0
  const score = Math.max(0, Math.min(100, Math.round(usedArea * 100)))

  const suggestions = []
  if (wastePercent > 30) {
    suggestions.push({
      type: 'waste',
      priority: 'high',
      icon: 'alert-triangle',
      message: 'High waste (' + wastePercent + '%). Consider adjusting piece dimensions to fit sheets better.',
    })
  } else if (wastePercent > 15) {
    suggestions.push({
      type: 'waste',
      priority: 'medium',
      icon: 'info',
      message: 'Moderate waste (' + wastePercent + '%). Minor dimension tweaks could improve yield.',
    })
  }

  return { score, wastePercent, sheetsNeeded, suggestions, label: 'Waste Efficiency' }
}

// ── Stability Score ────────────────────────────────────────────────────────
function calcStabilityScore(modules, pieces) {
  const suggestions = []
  let totalScore = 100

  for (const mod of modules) {
    const cfg = mod.configuration || {}
    const W = cfg.width || 600
    const H = cfg.height || 720
    const D = cfg.depth || 500

    // Tall narrow modules are less stable
    const aspectRatio = H / W
    if (aspectRatio > 4) {
      totalScore -= 25
      suggestions.push({
        type: 'stability',
        priority: 'high',
        icon: 'alert-triangle',
        message: 'Module ' + W + 'x' + H + 'mm is very tall and narrow (ratio ' + aspectRatio.toFixed(1) + ':1). Risk of tipping.',
      })
    } else if (aspectRatio > 3) {
      totalScore -= 10
      suggestions.push({
        type: 'stability',
        priority: 'medium',
        icon: 'info',
        message: 'Module ' + W + 'x' + H + 'mm has high aspect ratio. Consider wall anchoring.',
      })
    }

    // Shelves without dividers in wide modules
    const shelves = cfg.shelves || 0
    const dividers = cfg.numDividers || 0
    if (W > 900 && shelves > 0 && dividers === 0) {
      totalScore -= 15
      suggestions.push({
        type: 'stability',
        priority: 'medium',
        icon: 'info',
        message: 'Wide module (' + W + 'mm) with shelves but no central divider. Shelves may sag over time.',
      })
    }

    // Thin material with heavy loads
    const thickness = cfg.thickness || 18
    if (thickness < 18 && H > 1500) {
      totalScore -= 15
      suggestions.push({
        type: 'stability',
        priority: 'high',
        icon: 'alert-triangle',
        message: 'Thin material (' + thickness + 'mm) on tall module (' + H + 'mm). Use 18mm+ for structural integrity.',
      })
    }
  }

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    suggestions,
    label: 'Structural Stability',
  }
}

// ── Complexity Score ───────────────────────────────────────────────────────
function calcComplexityScore(modules, pieces) {
  const suggestions = []
  const uniqueThicknesses = new Set(pieces.map(p => p.thickness))
  const uniqueSizes = new Set(pieces.map(p => p.width + 'x' + p.height))
  const totalPieces = pieces.reduce((s, p) => s + (p.quantity || 1), 0)

  let score = 100

  // Many unique sizes = complex cutting
  if (uniqueSizes.size > 15) {
    score -= 20
    suggestions.push({
      type: 'complexity',
      priority: 'medium',
      icon: 'info',
      message: uniqueSizes.size + ' unique piece sizes. Standardizing dimensions would speed up cutting.',
    })
  }

  // Multiple thicknesses = multiple material runs
  if (uniqueThicknesses.size > 2) {
    score -= 15
    suggestions.push({
      type: 'complexity',
      priority: 'low',
      icon: 'info',
      message: uniqueThicknesses.size + ' different thicknesses. Consolidating reduces material handling.',
    })
  }

  // Very high piece count
  if (totalPieces > 50) {
    score -= 10
    suggestions.push({
      type: 'complexity',
      priority: 'low',
      icon: 'info',
      message: totalPieces + ' total pieces. Consider modular assembly to reduce complexity.',
    })
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    uniqueSizes: uniqueSizes.size,
    uniqueThicknesses: uniqueThicknesses.size,
    totalPieces,
    suggestions,
    label: 'Manufacturing Complexity',
  }
}

// ── Cost Score ──────────────────────────────────────────────────────────────
function calcCostScore(pieces) {
  const suggestions = []
  const totalArea = pieces.reduce((s, p) => s + (p.width * p.height * (p.quantity || 1)), 0)
  const sheetsNeeded = Math.ceil(totalArea / SHEET_AREA)
  const utilization = totalArea / (sheetsNeeded * SHEET_AREA)

  let score = Math.round(utilization * 100)

  // Check for oversized pieces that waste a full sheet
  const oversized = pieces.filter(p => p.width > SHEET_W || p.height > SHEET_H)
  if (oversized.length > 0) {
    score -= 20
    suggestions.push({
      type: 'cost',
      priority: 'high',
      icon: 'alert-triangle',
      message: oversized.length + ' piece(s) exceed standard sheet size. Custom sheets cost 2-3x more.',
    })
  }

  // Very small leftover pieces (could indicate poor nesting)
  const smallPieces = pieces.filter(p => p.width < 100 && p.height < 100)
  if (smallPieces.length > 3) {
    score -= 5
    suggestions.push({
      type: 'cost',
      priority: 'low',
      icon: 'info',
      message: 'Several very small pieces detected. Consider combining or eliminating.',
    })
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    sheetsNeeded,
    utilization: Math.round(utilization * 100),
    suggestions,
    label: 'Cost Optimization',
  }
}

// ── Manufacturing Score ────────────────────────────────────────────────────
function calcManufacturingScore(pieces) {
  const suggestions = []
  let score = 100

  // Check edge banding complexity
  const edgedPieces = pieces.filter(p => {
    const eb = p.edgeBanding || {}
    return eb.front || eb.back || eb.left || eb.right
  })
  const edgeRatio = edgedPieces.length / Math.max(pieces.length, 1)
  if (edgeRatio > 0.8) {
    score -= 10
    suggestions.push({
      type: 'manufacturing',
      priority: 'low',
      icon: 'info',
      message: 'High edge banding ratio (' + Math.round(edgeRatio * 100) + '%). Review which edges are truly visible.',
    })
  }

  // Check for very thin pieces that are hard to handle
  const thinPieces = pieces.filter(p => Math.min(p.width, p.height) < 50)
  if (thinPieces.length > 0) {
    score -= 15
    suggestions.push({
      type: 'manufacturing',
      priority: 'medium',
      icon: 'alert-triangle',
      message: thinPieces.length + ' piece(s) narrower than 50mm. Difficult to cut and handle.',
    })
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    suggestions,
    label: 'Manufacturability',
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────
function computeStats(modules, pieces) {
  const totalPieces = pieces.reduce((s, p) => s + (p.quantity || 1), 0)
  const totalArea = pieces.reduce((s, p) => s + (p.width * p.height * (p.quantity || 1)), 0)
  const sheetsNeeded = Math.ceil(totalArea / SHEET_AREA)
  const wastePercent = sheetsNeeded > 0
    ? Math.round((1 - totalArea / (sheetsNeeded * SHEET_AREA)) * 100)
    : 0

  // Edge banding linear meters
  const edgeMeters = pieces.reduce((s, p) => {
    const eb = p.edgeBanding || {}
    let linear = 0
    if (eb.front) linear += p.width
    if (eb.back) linear += p.width
    if (eb.left) linear += p.height
    if (eb.right) linear += p.height
    return s + linear * (p.quantity || 1)
  }, 0) / 1000

  return {
    moduleCount: modules.length,
    totalPieces,
    totalAreaM2: Math.round(totalArea / 1e6 * 100) / 100,
    sheetsNeeded,
    wastePercent,
    edgeBandingMeters: Math.round(edgeMeters * 10) / 10,
    uniqueSizes: new Set(pieces.map(p => p.width + 'x' + p.height)).size,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function scoreToGrade(score) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

function scoreToColor(score) {
  if (score >= 80) return '#10B981' // green
  if (score >= 60) return '#F59E0B' // amber
  return '#EF4444'                  // red
}

function priorityValue(p) {
  if (p === 'high') return 3
  if (p === 'medium') return 2
  return 1
}
