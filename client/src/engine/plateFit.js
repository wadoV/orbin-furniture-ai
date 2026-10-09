/**
 * Orbin AI — Ley de chapa (placa estándar MDF/MDP 2750 × 1840 mm).
 *
 * ★ 2026-10-09: CutListTable/ResultPanel solo comparaban cada lado contra 2750.
 *   Una pieza 2000 × 1900 pasaba "OK" aunque NO entra en la placa en ninguna
 *   orientación (lado corto 1900 > 1840). La regla correcta, con rotación libre:
 *     lado largo ≤ 2750  Y  lado corto ≤ 1840.
 *   Nunca bloquea el render 3D: solo clasifica para el aviso en tabla.
 */
export const PLATE_LONG_MM = 2750
export const PLATE_SHORT_MM = 1840

/** @returns {null | 'LONG' | 'SHORT'} motivo por el que la pieza no entra en la placa */
export function plateOverflow(w, h) {
  const a = Number(w), b = Number(h)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const long = Math.max(a, b), short = Math.min(a, b)
  if (long > PLATE_LONG_MM) return 'LONG'
  if (short > PLATE_SHORT_MM) return 'SHORT'
  return null
}

export function plateOverflowLabel(reason) {
  if (reason === 'LONG') return `⚠️ > ${PLATE_LONG_MM}mm (Excede placa MDF)`
  if (reason === 'SHORT') return `⚠️ > ${PLATE_SHORT_MM}mm de ancho (Excede placa MDF)`
  return ''
}

export function plateOverflowTitle(reason) {
  if (!reason) return ''
  return `⚠️ No entra en placa MDF estándar ${PLATE_LONG_MM} × ${PLATE_SHORT_MM} mm — requiere empalme o placa especial`
}
