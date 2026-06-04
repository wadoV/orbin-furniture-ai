/**
 * Orbin AI — Dynamic Quoting Engine v1.0
 * ────────────────────────────────────────────────────────────────
 * Motor de cotización en tiempo real. Se suscribe al estado de
 * módulos y recalcula precio total en cada actualización geométrica.
 *
 * ARQUITECTURA:
 *   modules[] → calculateQuote() → QuoteResult
 *
 * LÓGICA:
 *   1. m² totales consumidos por material (paneles estructurales)
 *   2. Bisagras inferidas por puertas  (tipo de módulo)
 *   3. Correderas inferidas por cajones (tipo de módulo)
 *   4. Matriz de Costos × cantidad + margen comercial
 */

import { MATERIALS_DB, HARDWARE_COSTS, getMaterialById } from '../data/materials.js'

// ─── LIVE PRICES STATE & FETCHING ────────────────────────────────
let LIVE_PRICES = null
let LAST_UPDATED = null

const fetchLivePrices = async () => {
  try {
    const apiBase = import.meta.env?.VITE_API_URL || ''
    const response = await fetch(`${apiBase}/api/prices`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    if (data && data.success && Array.isArray(data.prices) && data.prices.length > 0) {
      const tempPrices = {}
      data.prices.forEach(p => {
        if (p.material_code && p.price_per_m2 != null) {
          tempPrices[p.material_code] = {
            price_per_m2: Number(p.price_per_m2),
            display_name: p.display_name,
            updated_at: p.updated_at
          }
        }
      })
      LIVE_PRICES = tempPrices

      const dates = data.prices
        .map(p => p.updated_at ? new Date(p.updated_at) : null)
        .filter(d => d && !isNaN(d.getTime()))

      if (dates.length > 0) {
        const latestDate = new Date(Math.max(...dates))
        const dd = String(latestDate.getDate()).padStart(2, '0')
        const mm = String(latestDate.getMonth() + 1).padStart(2, '0')
        const yyyy = latestDate.getFullYear()
        LAST_UPDATED = `${dd}/${mm}/${yyyy}`
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('live-prices-loaded'))
      }
    }
  } catch (err) {
    console.warn('[PricingEngine] Dynamic prices failed to load, falling back silently:', err.message)
  }
}

// Start price loading immediately on module import
fetchLivePrices()

export function getLatestPriceUpdateDate() {
  return LAST_UPDATED
}

function getMaterialCostPerM2(material) {
  if (LIVE_PRICES && LIVE_PRICES[material.id] !== undefined) {
    return LIVE_PRICES[material.id].price_per_m2
  }
  return material.costPerM2
}

// ─── MATRIZ DE COSTOS DE HERRAJES ────────────────────────────────
const HARDWARE_MATRIX = {
  hinge:        { unitCost: 3.50,  unit: 'un',  label: 'Bisagras'    },
  drawer_slide: { unitCost: 8.50,  unit: 'par', label: 'Correderas'  },
  handle:       { unitCost: 2.80,  unit: 'un',  label: 'Manijas'     },
  shelf_pin:    { unitCost: 0.30,  unit: 'un',  label: 'Pinos'       },
  back_panel:   { unitCost: 6.00,  unit: 'm²',  label: 'Fondo HDF'   },
  countertop:   { unitCost: 45.00, unit: 'm²',  label: 'Encimera'    },
}

// ─── OVERHEAD Y MARGEN ────────────────────────────────────────────
const OVERHEAD_RATE  = 0.12   // 12% costos operativos
const MARGIN_RATE    = 0.35   // 35% margen comercial
const LABOR_PER_M2   = 18.00  // USD mano de obra por m² de panel

// ─── INFERENCIA DE HERRAJES POR TIPO DE MÓDULO ───────────────────
// Cada entrada define cuántas puertas/cajones/estantes tiene por defecto
const MODULE_HARDWARE_PROFILE = {
  // ─ COCINA — BASES ────────────────────────────────────
  'COCINA_BASE_PUERTA':        { doors: 2, drawers: 0, shelves: 1, handles: 2 },
  'COCINA_BASE_CAJONES':       { doors: 0, drawers: 3, shelves: 0, handles: 3 },
  'COCINA_FREGADERO':          { doors: 2, drawers: 0, shelves: 0, handles: 2 },
  'COCINA_TORRE':              { doors: 2, drawers: 2, shelves: 3, handles: 4 },

  // ─ COCINA — AÉREOS (wall-mounted) ────────────────────
  'COCINA_AEREO':              { doors: 2, drawers: 0, shelves: 2, handles: 2 },
  'AEREO_COCINA_PUERTAS':      { doors: 2, drawers: 0, shelves: 1, handles: 2, wallPlugs: 4 },
  'AEREO_COCINA_ABERTO':       { doors: 0, drawers: 0, shelves: 2, handles: 0, wallPlugs: 4 },
  'AEREO_COCINA_ESQUINERO':    { doors: 1, drawers: 0, shelves: 2, handles: 1, wallPlugs: 4 },

  // ─ BAÑO — BASES ──────────────────────────────────────
  'BAÑO_VANITORY':             { doors: 2, drawers: 1, shelves: 1, handles: 3 },

  // ─ BAÑO — AÉREOS ─────────────────────────────────────
  'BAÑO_AEREO':                { doors: 2, drawers: 0, shelves: 1, handles: 2, wallPlugs: 4 },
  'AEREO_BANHEIRO_ESPELHO':    { doors: 1, drawers: 0, shelves: 2, handles: 1, wallPlugs: 4 },
  'AEREO_BANHEIRO_ABERTO':     { doors: 0, drawers: 0, shelves: 3, handles: 0, wallPlugs: 4 },

  // ─ SALA — AÉREOS ─────────────────────────────────────
  'SALA_TV':                   { doors: 2, drawers: 2, shelves: 3, handles: 4 },
  'SALA_APARADOR':             { doors: 2, drawers: 0, shelves: 3, handles: 2 },
  'AEREO_SALA_TV':             { doors: 0, drawers: 0, shelves: 2, handles: 0, wallPlugs: 6 },
  'AEREO_SALA_PRATELEIRA':     { doors: 0, drawers: 0, shelves: 1, handles: 0, wallPlugs: 4 },
  'AEREO_SALA_APARADOR_ALTO':  { doors: 2, drawers: 0, shelves: 2, handles: 2, wallPlugs: 4 },

  // ─ CUARTO / DORMITÓRIO ───────────────────────────────
  'CUARTO_ROPERO':             { doors: 2, drawers: 0, shelves: 4, handles: 2 },
  'CUARTO_CAJONERA':           { doors: 0, drawers: 4, shelves: 0, handles: 4 },
  'CUARTO_ESTANTE':            { doors: 0, drawers: 0, shelves: 5, handles: 0 },
  'AEREO_DORMITORIO_CABECERA': { doors: 0, drawers: 0, shelves: 2, handles: 0, wallPlugs: 4 },

  // ─ DEFAULT (módulo desconocido) ───────────────────────
  'DEFAULT':                   { doors: 1, drawers: 0, shelves: 2, handles: 1 },
}

/**
 * Obtiene el perfil de herrajes para un módulo dado.
 * Intenta hacer match exacto → match parcial → DEFAULT.
 */
function getHardwareProfile(moduleType = '') {
  const key = moduleType.toUpperCase().replace(/\s+/g, '_')
  if (MODULE_HARDWARE_PROFILE[key]) return MODULE_HARDWARE_PROFILE[key]

  // Match parcial: busca la primera key que contenga el tipo
  const partial = Object.keys(MODULE_HARDWARE_PROFILE).find(k =>
    key.includes(k.split('_')[0]) || k.includes(key.split('_')[0])
  )
  return MODULE_HARDWARE_PROFILE[partial] || MODULE_HARDWARE_PROFILE['DEFAULT']
}

// ─── CÁLCULO DE m² DE UN MÓDULO ──────────────────────────────────
/**
 * Calcula el área total de paneles estructurales de un módulo (m²).
 * Incluye: 2 laterales + techo + base + fondo (sin puertas, que son herraje).
 *
 * @param {Object} cfg  - configuration del módulo
 * @returns {number}    - m² totales
 */
function calcPanelAreaM2(cfg) {
  const W = (cfg.width  || 600) / 1000   // mm → m
  const H = (cfg.height || 720) / 1000
  const D = (cfg.depth  || 580) / 1000

  const sides    = 2 * (H * D)           // 2 laterales
  const topBase  = 2 * (W * D)           // techo + base
  const back     = W * H                 // fondo
  const dividers = (cfg.dividers || 0) * (H * D)

  return sides + topBase + back + dividers
}

/**
 * Calcula el área de encimera si el módulo la tiene (m²).
 */
function calcCountertopAreaM2(cfg) {
  if (!cfg.hasCountertop) return 0
  const W = (cfg.width || 600) / 1000
  const D = (cfg.depth || 580) / 1000
  return W * D
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────────
/**
 * Calcula la cotización completa a partir del array de módulos.
 *
 * @param {Array}  modules   - Estado actual de módulos en App.jsx
 * @param {number} [margin]  - Margen comercial override (0–1)
 * @returns {QuoteResult}
 */
export function calculateQuote(modules = [], margin = MARGIN_RATE) {
  if (!modules || modules.length === 0) {
    return createEmptyQuote()
  }

  // Acumuladores por material
  const materialMap = {}   // { materialId: { name, m2, cost } }
  let totalHinges       = 0
  let totalDrawerSlides = 0
  let totalHandles      = 0
  let totalShelves      = 0
  let totalCountertopM2 = 0
  let totalLaborCost    = 0

  modules.forEach(mod => {
    if (!mod || !mod.configuration) return

    const cfg        = mod.configuration
    const materialId = cfg.material || cfg.materialId || 'mdf_18'
    const material   = getMaterialById(materialId)
    const costPerM2  = getMaterialCostPerM2(material)

    // 1. m² de paneles estructurales
    const panelM2      = calcPanelAreaM2(cfg)
    const panelCost    = panelM2 * costPerM2

    // Acumula por material
    if (!materialMap[materialId]) {
      materialMap[materialId] = {
        name:     material.fallback,
        costPerM2: costPerM2,
        m2:       0,
        cost:     0,
      }
    }
    materialMap[materialId].m2   += panelM2
    materialMap[materialId].cost += panelCost

    // 2. Herrajes — infiere por tipo de módulo
    const moduleType = (
      cfg.moduleType ||
      cfg.type       ||
      mod.type       ||
      'DEFAULT'
    )
    const profile = getHardwareProfile(moduleType)

    totalHinges       += profile.doors * 2        // 2 bisagras por puerta
    totalDrawerSlides += profile.drawers           // 1 par de correderas por cajón
    totalHandles      += profile.handles
    totalShelves      += profile.shelves

    // 3. Encimera
    totalCountertopM2 += calcCountertopAreaM2(cfg)

    // 4. Mano de obra por m² de panel
    totalLaborCost += panelM2 * LABOR_PER_M2
  })

  // ─── COSTOS DE MATERIALES ─────────────────────────────────────
  const materialCost = Object.values(materialMap)
    .reduce((sum, m) => sum + m.cost, 0)

  // ─── COSTOS DE HERRAJES ───────────────────────────────────────
  const hingesCost       = totalHinges       * HARDWARE_MATRIX.hinge.unitCost
  const slidesCost       = totalDrawerSlides * HARDWARE_MATRIX.drawer_slide.unitCost
  const handlesCost      = totalHandles      * HARDWARE_MATRIX.handle.unitCost
  const shelfPinsCost    = totalShelves * 4  * HARDWARE_MATRIX.shelf_pin.unitCost  // 4 pinos/estante
  const countertopCost   = totalCountertopM2 * HARDWARE_MATRIX.countertop.unitCost
  const hardwareCost     = hingesCost + slidesCost + handlesCost + shelfPinsCost + countertopCost

  // ─── SUBTOTAL + OVERHEAD ─────────────────────────────────────
  const subtotal        = materialCost + hardwareCost + totalLaborCost
  const overheadCost    = subtotal * OVERHEAD_RATE
  const costBase        = subtotal + overheadCost

  // ─── PRECIO FINAL CON MARGEN ─────────────────────────────────
  const finalPrice      = costBase / (1 - margin)
  const marginAmount    = finalPrice - costBase

  return {
    // ── Detalle de materiales ──────────────────────────────────
    materials: Object.entries(materialMap).map(([id, m]) => ({
      id,
      name:      m.name,
      m2:        round2(m.m2),
      costPerM2: m.costPerM2,
      cost:      round2(m.cost),
    })),
    totalMaterialM2:   round2(Object.values(materialMap).reduce((s, m) => s + m.m2, 0)),

    // ── Herrajes ──────────────────────────────────────────────
    hardware: {
      hinges:       { qty: totalHinges,                 unit: 'un',  cost: round2(hingesCost)    },
      drawerSlides: { qty: totalDrawerSlides,            unit: 'par', cost: round2(slidesCost)   },
      handles:      { qty: totalHandles,                 unit: 'un',  cost: round2(handlesCost)  },
      shelfPins:    { qty: totalShelves * 4,             unit: 'un',  cost: round2(shelfPinsCost)},
      countertop:   { m2:  round2(totalCountertopM2),   unit: 'm²',  cost: round2(countertopCost)},
      total:        round2(hardwareCost),
    },

    // ── Costos finales ────────────────────────────────────────
    labor:        round2(totalLaborCost),
    overhead:     round2(overheadCost),
    subtotal:     round2(subtotal),
    marginRate:   margin,
    marginAmount: round2(marginAmount),
    finalPrice:   round2(finalPrice),

    // ── Meta ──────────────────────────────────────────────────
    moduleCount: modules.filter(m => m && m.configuration).length,
    currency:    'USD',
    timestamp:   Date.now(),
  }
}

/** Cotización vacía para estado inicial */
function createEmptyQuote() {
  return {
    materials:       [],
    totalMaterialM2: 0,
    hardware:        { hinges: { qty:0, cost:0 }, drawerSlides: { qty:0, cost:0 }, handles: { qty:0, cost:0 }, shelfPins: { qty:0, cost:0 }, countertop: { m2:0, cost:0 }, total: 0 },
    labor:           0,
    overhead:        0,
    subtotal:        0,
    marginRate:      MARGIN_RATE,
    marginAmount:    0,
    finalPrice:      0,
    moduleCount:     0,
    currency:        'USD',
    timestamp:       Date.now(),
  }
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100
}

// ─── EXPORTS ─────────────────────────────────────────────────────
export { MARGIN_RATE, OVERHEAD_RATE, MODULE_HARDWARE_PROFILE, HARDWARE_MATRIX }
