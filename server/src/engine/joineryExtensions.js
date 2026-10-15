/**
 * Orbin AI — Advanced Joinery Extensions (ADITIVO V4.7, 2026-10-12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo para cálculo y validación de ensambles de madera y tolerancias CNC
 * basados en especificaciones de JointSCAD, compas_wood, Tsugite, woodworking y O-LAP.
 *
 * Funciones PURAS:
 *   - calculateMortiseAndTenon
 *   - calculateDovetailSpecs
 *   - calculateFingerJoint
 *   - validateJointFit
 */

const { joinery, cncTolerances } = require('../ai/furnitureMathSpecs')

/**
 * Calcula dimensiones de caja y espiga (Mortise and Tenon)
 * @param {number} boardThickness  Espesor de la pieza/placa (mm)
 * @param {number} [tenonProportion=0.33]  Proporción de espiga respecto al espesor
 * @returns {object}  Especificaciones de la espiga y la caja
 */
function calculateMortiseAndTenon(boardThickness, tenonProportion = 0.33) {
  const T = typeof boardThickness === 'number' && boardThickness > 0 ? boardThickness : 18
  const prop = typeof tenonProportion === 'number' && tenonProportion > 0 ? tenonProportion : 0.33

  const tenonThickness = joinery.mortiseAndTenon.tenonThickness(T, prop)
  const mortiseDepth = joinery.mortiseAndTenon.mortiseDepth(T)
  const pinRadius = joinery.mortiseAndTenon.pinRadius

  return {
    boardThickness: T,
    tenonThickness,
    mortiseDepth,
    mortiseWidth: tenonThickness,
    pinRadius,
    fitTolerance: cncTolerances.interlockingTolerance
  }
}

/**
 * Calcula especificaciones para uniones de cola de milano (Dovetail)
 * @param {number} width      Ancho de la pieza a unir (mm)
 * @param {number} thickness  Espesor de la placa (mm)
 * @param {number} [count=4]  Cantidad de pines/colas
 * @returns {object}  Especificaciones de cola de milano
 */
function calculateDovetailSpecs(width, thickness, count = 4) {
  const W = typeof width === 'number' && width > 0 ? width : 600
  const T = typeof thickness === 'number' && thickness > 0 ? thickness : 18
  const pinCount = Math.max(1, Math.floor(count || 4))

  const pinWidth = joinery.dovetail.pinWidth(W, pinCount)
  const pocketDepth = joinery.dovetail.pocketDepth(T)
  const jointTolerance = joinery.dovetail.jointTolerance

  return {
    width: W,
    thickness: T,
    count: pinCount,
    pinWidth,
    pocketDepth,
    jointTolerance,
    angleDegrees: 14 // ángulo estándar 1:4 / 14° para maderas y compuestos
  }
}

/**
 * Calcula ensamble entallado / peines (Finger Joint)
 * @param {number} width        Ancho de la unión (mm)
 * @param {number} thickness    Espesor de la pieza (mm)
 * @param {number} fingerCount  Cantidad de dientes/dedos
 * @returns {object}  Especificaciones de los dedos del ensamble
 */
function calculateFingerJoint(width, thickness, fingerCount = 5) {
  const W = typeof width === 'number' && width > 0 ? width : 600
  const T = typeof thickness === 'number' && thickness > 0 ? thickness : 18
  const count = Math.max(2, Math.floor(fingerCount || 5))

  const fingerWidth = joinery.fingerJoint.fingerWidth(W, count)
  const fingerDepth = joinery.fingerJoint.fingerDepth(T)
  const jointTolerance = joinery.fingerJoint.jointTolerance

  return {
    width: W,
    thickness: T,
    fingerCount: count,
    fingerWidth,
    fingerDepth,
    jointTolerance
  }
}

/**
 * Valida si las dimensiones y parámetros de una unión cumplen tolerancias mecánicas y de fabricación
 * @param {string} jointType     Tipo de unión ('mortise_tenon', 'dovetail', 'finger_joint', etc.)
 * @param {object} dimensions    Dimensiones ({ thickness, width, length, ... })
 * @returns {{ isValid: boolean, status: string, errors: string[], warnings: string[] }}
 */
function validateJointFit(jointType, dimensions = {}) {
  const errors = []
  const warnings = []
  const { thickness, width } = dimensions

  if (!thickness || thickness < 6) {
    errors.push(`Espesor de placa insuficiente para uniones mecánicas (${thickness || 0}mm < 6mm).`)
  }

  if (jointType === 'mortise_tenon') {
    if (thickness && thickness < 12) {
      warnings.push(`Espesor fino (${thickness}mm) para caja y espiga tradicional; considere tarugos directos.`)
    }
  } else if (jointType === 'dovetail') {
    if (width && width < 50) {
      errors.push(`Ancho insuficiente (${width}mm) para labrar colas de milano.`)
    }
  } else if (jointType === 'finger_joint') {
    if (width && width < 40) {
      errors.push(`Ancho insuficiente (${width}mm) para unión tipo peine.`)
    }
  }

  const isValid = errors.length === 0
  return {
    isValid,
    status: isValid ? 'VALIDADO' : 'RECHAZADO',
    errors,
    warnings
  }
}

module.exports = {
  calculateMortiseAndTenon,
  calculateDovetailSpecs,
  calculateFingerJoint,
  validateJointFit
}
