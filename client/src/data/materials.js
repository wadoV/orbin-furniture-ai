/**
 * Orbin AI — Material Database v1.0
 * Industrial-grade material presets for parametric furniture manufacturing.
 *
 * Each material includes:
 * - id: unique identifier
 * - name: display name (i18n key or fallback)
 * - thickness: panel thickness in mm
 * - density: kg/m³ (for weight calculation)
 * - costPerM2: estimated cost per m² in USD
 * - color: hex color for 3D preview
 * - textureLabel: display label for UI
 * - category: grouping for selector
 */

export const MATERIALS_DB = [
  {
    id: 'mdf_15',
    nameKey: 'mat_mdf_15',
    fallback: 'MDF 15mm',
    thickness: 15,
    density: 720,
    costPerM2: 12.50,
    color: '#C4A882',
    textureLabel: 'MDF Crudo',
    category: 'mdf',
  },
  {
    id: 'mdf_18',
    nameKey: 'mat_mdf_18',
    fallback: 'MDF 18mm',
    thickness: 18,
    density: 720,
    costPerM2: 15.00,
    color: '#B89B72',
    textureLabel: 'MDF Crudo',
    category: 'mdf',
  },
  {
    id: 'mdf_25',
    nameKey: 'mat_mdf_25',
    fallback: 'MDF 25mm',
    thickness: 25,
    density: 720,
    costPerM2: 22.00,
    color: '#A88E65',
    textureLabel: 'MDF Crudo',
    category: 'mdf',
  },
  {
    id: 'plywood_18',
    nameKey: 'mat_plywood_18',
    fallback: 'Plywood 18mm',
    thickness: 18,
    density: 680,
    costPerM2: 28.00,
    color: '#D4B896',
    textureLabel: 'Compensado',
    category: 'plywood',
  },
  {
    id: 'melamine_white_18',
    nameKey: 'mat_melamine_white',
    fallback: 'Melamina Blanca 18mm',
    thickness: 18,
    density: 650,
    costPerM2: 18.50,
    color: '#F0EDE8',
    textureLabel: 'Melamina Branca',
    category: 'melamine',
  },
  {
    id: 'melamine_wood_18',
    nameKey: 'mat_melamine_wood',
    fallback: 'Melamina Madera 18mm',
    thickness: 18,
    density: 650,
    costPerM2: 20.00,
    color: '#C9A96E',
    textureLabel: 'Melamina Madeira',
    category: 'melamine',
  },
  {
    id: 'melamine_wood_15',
    nameKey: 'mat_melamine_wood_15',
    fallback: 'Melamina Madera 15mm',
    thickness: 15,
    density: 650,
    costPerM2: 17.00,
    color: '#C9A96E',
    textureLabel: 'Melamina Madeira',
    category: 'melamine',
  },
  {
    id: 'osb_18',
    nameKey: 'mat_osb_18',
    fallback: 'OSB 18mm',
    thickness: 18,
    density: 600,
    costPerM2: 10.00,
    color: '#D4C4A0',
    textureLabel: 'OSB',
    category: 'osb',
  },
]

/**
 * Hardware cost database for BOM cost estimation
 */
export const HARDWARE_COSTS = {
  'Corredica Telescopica': { unitCost: 8.50, unit: 'par' },
  'Pino para Prateleira':  { unitCost: 0.30, unit: 'un' },
  'Dobradica':             { unitCost: 3.50, unit: 'un' },
  'Parafuso Confirmat':    { unitCost: 0.08, unit: 'un' },
}

/**
 * Edge banding cost per linear meter
 */
export const EDGE_BANDING_COSTS = {
  thin: 0.80,   // PVC 0.45mm per linear meter
  thick: 1.50,  // PVC 2mm per linear meter
  abs: 2.00,    // ABS 2mm per linear meter
}

/**
 * Get material by ID
 */
export function getMaterialById(id) {
  return MATERIALS_DB.find(m => m.id === id) || MATERIALS_DB[1] // default MDF 18mm
}

/**
 * Calculate manufacturing cost estimation
 */
export function calculateCostEstimation(design, materialId = 'mdf_18') {
  if (!design || !design.pieces) return null

  const material = getMaterialById(materialId)
  const pieces = design.pieces || []
  const hardware = design.hardware || []
  const nesting = design.nesting || []

  // 1. Material cost — total area of all pieces
  const totalAreaMM2 = pieces.reduce((sum, p) => {
    const qty = p.quantity || 1
    return sum + (p.width * p.height * qty)
  }, 0)
  const totalAreaM2 = totalAreaMM2 / 1_000_000
  const materialCost = totalAreaM2 * material.costPerM2

  // 2. Waste calculation from nesting efficiency
  const avgEfficiency = nesting.length > 0
    ? nesting.reduce((s, n) => s + (n.overallEfficiency || 0), 0) / nesting.length
    : 0.65 // default 65% if no nesting data
  const wastePercent = Math.round((1 - avgEfficiency) * 100)
  const totalPlatesArea = nesting.reduce((s, n) => s + (n.totalPlateArea || 0), 0) / 1_000_000
  const wasteCost = (totalPlatesArea - totalAreaM2) * material.costPerM2

  // 3. Hardware cost
  const hardwareCost = hardware.reduce((sum, item) => {
    const costInfo = HARDWARE_COSTS[item.type]
    if (!costInfo) return sum
    return sum + (item.quantity * costInfo.unitCost)
  }, 0)

  // 4. Edge banding cost (estimate: 2 edges per piece avg, piece perimeter)
  const totalEdgeMeters = pieces.reduce((sum, p) => {
    const qty = p.quantity || 1
    const eb = p.edgeBanding || {}
    let edges = 0
    if (eb.all) edges = 4
    else {
      if (eb.front) edges++
      if (eb.back) edges++
      if (eb.top) edges++
      if (eb.bottom) edges++
      if (eb.left) edges++
      if (eb.right) edges++
    }
    // Approximate: avg edge = (width + height) / 2 per edge
    const avgEdgeLength = ((p.width || 0) + (p.height || 0)) / 2
    return sum + (edges * avgEdgeLength * qty / 1000) // convert mm to meters
  }, 0)
  const edgeBandingCost = totalEdgeMeters * EDGE_BANDING_COSTS[design.configuration?.edgeBandingType || 'thin']

  // 5. Total plates needed
  const totalPlates = nesting.reduce((s, n) => s + (n.plateCount || 0), 0)

  // 6. Weight estimate
  const weightKg = (totalAreaM2 * material.thickness / 1000) * material.density

  const subtotal = materialCost + wasteCost + hardwareCost + edgeBandingCost
  // Labor estimate: ~30% of material cost (industry standard)
  const laborEstimate = materialCost * 0.30

  return {
    material: {
      name: material.fallback,
      id: material.id,
      costPerM2: material.costPerM2,
      totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
      cost: Math.round(materialCost * 100) / 100,
    },
    waste: {
      percent: wastePercent,
      cost: Math.round(wasteCost * 100) / 100,
    },
    hardware: {
      items: hardware,
      cost: Math.round(hardwareCost * 100) / 100,
    },
    edgeBanding: {
      totalMeters: Math.round(totalEdgeMeters * 10) / 10,
      cost: Math.round(edgeBandingCost * 100) / 100,
    },
    plates: {
      count: totalPlates,
    },
    weight: {
      kg: Math.round(weightKg * 10) / 10,
    },
    labor: {
      cost: Math.round(laborEstimate * 100) / 100,
    },
    total: Math.round((subtotal + laborEstimate) * 100) / 100,
  }
}
