/**
 * Orbin AI — Viability Gate (SSOT cliente).
 * ─────────────────────────────────────────────────────────────────────────────
 * Espejo EXACTO del guard del backend (server/src/routes/design.js → /save-viable).
 * Fail-closed: sin reporte de validación del servidor NO se considera viable.
 * El backend regenera y revalida igual — esto es solo UX, nunca la autoridad.
 *
 * ★ 2026-10-10: extraído de ResultPanel.jsx para que el botón "Guardar en Galería"
 *   del visor 3D (Viewer3D.jsx) use el MISMO guard, sin duplicar la regla. Un segundo
 *   if divergente era exactamente el anti-patrón que este código combate.
 */

/**
 * @param {object} design  módulo/diseño con { validation, specAdjustments, configuration }
 * @returns {{ viable: boolean, reason: null|'validation_missing'|'errors'|'critical_adjustments' }}
 */
export function evaluateViability(design) {
  const v = design?.validation
  if (!v || v.status !== 'VALIDADO') {
    return { viable: false, reason: 'validation_missing' }
  }
  if (Array.isArray(v.errors) && v.errors.length > 0) {
    return { viable: false, reason: 'errors' }
  }
  const critical = (design?.specAdjustments || []).filter(a => a?.severity === 'critical')
  if (critical.length > 0) {
    return { viable: false, reason: 'critical_adjustments' }
  }
  return { viable: true, reason: null }
}

export default evaluateViability
