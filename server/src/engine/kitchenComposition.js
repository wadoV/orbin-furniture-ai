/**
 * Orbin AI — Kitchen Composition Engine  (ADITIVO 2026-10-11)
 * ─────────────────────────────────────────────────────────────────────────────
 * Compone un layout lineal de módulos de cocina a partir de un array de
 * parámetros individuales. Responsabilidades:
 *
 *   1. Acumular offsets X para posicionar cada módulo.
 *   2. Validar que el ancho total no exceda la pared disponible.
 *   3. Validar que cada aéreo sea ≤ ancho del módulo base debajo de él.
 *   4. Asignar compositionId + positionIndex a cada módulo.
 *   5. Agrupar por línea (base / wall) para el motor de despiece.
 *
 * CONTRATO:
 *   - Entrada: { wallWidth, modules: [{ params, line }] }
 *   - Salida:  { ok, modules: [{ ...params, xOffset, compositionId, positionIndex }],
 *                errors: [string], totalWidth: { base, wall } }
 *
 * NO toca Supabase ni Zod. NO genera piezas: eso es responsabilidad de
 * closetEngine.js, que recibe cada módulo individualmente con su xOffset.
 */

const crypto = require('crypto')

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera un compositionId corto y determinista.
 * No necesita ser globalmente único (UUID lo hace Supabase al persistir);
 * solo identifica la composición dentro de la sesión de diseño.
 */
function generateCompositionId() {
  return 'comp_' + crypto.randomBytes(6).toString('hex')
}

/**
 * Determina la línea (base | wall) de un módulo según su moduleType / type.
 * Regla: aereo y kitchen_niche son wall; todo lo demás es base.
 */
function resolveLine(mod) {
  if (mod.line === 'base' || mod.line === 'wall') return mod.line
  if (mod.moduleType === 'aereo') return 'wall'
  if (mod.type === 'kitchen_niche' || mod.type === 'kitchen_high') return 'wall'
  return 'base'
}

// ── Validaciones ─────────────────────────────────────────────────────────────

/**
 * MDF/MDP constraint: una pieza no puede exceder 2750 × 1840 mm.
 * El módulo individual no debe ser más ancho que 2750 (el largo de la placa)
 * ni más alto que 1840 (el ancho de la placa), o viceversa.
 */
const MAX_PLATE_LENGTH = 2750
const MAX_PLATE_WIDTH  = 1840

function validateModulePlateConstraint(params, index) {
  const w = params.width  || 0
  const h = params.height || 0
  const errs = []
  // El costado (height × depth) es la pieza más grande; un ancho > 2750 rompe
  // la disposición de corte (el ancho va en el largo de la placa).
  if (w > MAX_PLATE_LENGTH) {
    errs.push(`Módulo ${index}: ancho ${w}mm excede el largo máximo de placa (${MAX_PLATE_LENGTH}mm).`)
  }
  if (h > MAX_PLATE_WIDTH) {
    errs.push(`Módulo ${index}: altura ${h}mm excede el ancho máximo de placa (${MAX_PLATE_WIDTH}mm).`)
  }
  return errs
}

// ── Composición principal ────────────────────────────────────────────────────

/**
 * @param {object} layout
 * @param {number} layout.wallWidth   — ancho disponible de pared (mm)
 * @param {Array}  layout.modules     — [{ params: {...}, line?: 'base'|'wall' }]
 * @param {object} [options]
 * @param {number} [options.gap=0]    — holgura entre módulos (mm), típicamente 0
 * @returns {{ ok, compositionId, modules, errors, totalWidth }}
 */
function composeKitchenLayout(layout, options = {}) {
  const { wallWidth, modules } = layout
  const gap = Number(options.gap) || 0
  const errors = []
  const compositionId = generateCompositionId()

  if (!Array.isArray(modules) || modules.length === 0) {
    return { ok: false, compositionId, modules: [], errors: ['No se recibieron módulos.'], totalWidth: { base: 0, wall: 0 } }
  }

  if (!Number.isFinite(wallWidth) || wallWidth <= 0) {
    errors.push('wallWidth no es un número válido o es ≤ 0.')
  }

  // Separar por línea
  const baseMods = []
  const wallMods = []

  modules.forEach((mod, i) => {
    const p = mod.params || mod
    const line = resolveLine({ ...p, line: mod.line })
    const entry = { params: { ...p }, line, originalIndex: i }
    if (line === 'wall') wallMods.push(entry)
    else baseMods.push(entry)
  })

  // ── Acumular X offsets ──────────────────────────────────────────────────
  function accumulateOffsets(arr, lineLabel) {
    let x = 0
    arr.forEach((entry, posIdx) => {
      const w = entry.params.width || 0

      // Validar restricción de placa individual
      errors.push(...validateModulePlateConstraint(entry.params, entry.originalIndex))

      entry.params.xOffset        = x
      entry.params.compositionId  = compositionId
      entry.params.positionIndex  = posIdx
      entry.params.line           = entry.line

      x += w + gap
    })
    return x > 0 ? x - gap : 0  // descontar el último gap
  }

  const totalBase = accumulateOffsets(baseMods, 'base')
  const totalWall = accumulateOffsets(wallMods, 'wall')

  // ── Validación de ancho total vs pared ──────────────────────────────────
  if (Number.isFinite(wallWidth) && wallWidth > 0) {
    if (totalBase > wallWidth) {
      errors.push(`Línea base: ancho total ${totalBase}mm excede la pared de ${wallWidth}mm (sobra ${totalBase - wallWidth}mm).`)
    }
    if (totalWall > wallWidth) {
      errors.push(`Línea aéreos: ancho total ${totalWall}mm excede la pared de ${wallWidth}mm (sobra ${totalWall - wallWidth}mm).`)
    }
  }

  // ── Validación aéreo ≤ base debajo ──────────────────────────────────────
  // Regla conservadora: cada aéreo debe caer dentro de la proyección X de
  // algún módulo base. Si hay más aéreos que bases, los sobrantes se advierten.
  wallMods.forEach((wm) => {
    const wx0 = wm.params.xOffset
    const wx1 = wx0 + (wm.params.width || 0)

    // Buscar si algún base contiene al aéreo
    const hasSupport = baseMods.some((bm) => {
      const bx0 = bm.params.xOffset
      const bx1 = bx0 + (bm.params.width || 0)
      return bx0 <= wx0 && bx1 >= wx1
    })

    if (!hasSupport && baseMods.length > 0) {
      errors.push(
        `Aéreo en posición ${wm.params.positionIndex} (${wm.params.width}mm @ x=${wx0}) ` +
        `excede el ancho del módulo base que tiene debajo.`
      )
    }
  })

  // ── Resultado ───────────────────────────────────────────────────────────
  const allModules = [...baseMods, ...wallMods]
    .sort((a, b) => a.originalIndex - b.originalIndex)
    .map(e => e.params)

  return {
    ok: errors.length === 0,
    compositionId,
    modules: allModules,
    errors,
    totalWidth: { base: totalBase, wall: totalWall },
  }
}

module.exports = { composeKitchenLayout, resolveLine, generateCompositionId }
