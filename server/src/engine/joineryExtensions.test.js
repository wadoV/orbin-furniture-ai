/**
 * Orbin AI — Tests Unitarios para joineryExtensions y Fórmulas V4.7 (ADITIVO)
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica:
 *   - calculateMortiseAndTenon: espiga de 5.94mm y mortaja de 13.5mm para T=18mm.
 *   - calculateDovetailSpecs: tolerancias de 0.20mm para W=600, T=18, count=4.
 *   - calculateFingerJoint: tolerancias y anchos calculados.
 *   - validateJointFit: aprobación de dimensiones saludables y advertencias/rechazos.
 *   - furnitureMathSpecs: presencia de joinery, cncTolerances, hardwareTolerances.
 *   - paramContract: integración de joineryType, dovetailCount, tenonProportion.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  calculateMortiseAndTenon,
  calculateDovetailSpecs,
  calculateFingerJoint,
  validateJointFit
} = require('./joineryExtensions')
const MathSpecs = require('../ai/furnitureMathSpecs')
const { coerceEngineParams } = require('../ai/paramContract')

describe('joineryExtensions — Fórmulas y tolerancias V4.7', () => {
  it('calculateMortiseAndTenon(18) retorna espiga de 5.94mm y caja de 13.5mm', () => {
    const res = calculateMortiseAndTenon(18)
    assert.equal(res.boardThickness, 18)
    assert.equal(res.tenonThickness, 5.94) // 18 * 0.33
    assert.equal(res.mortiseDepth, 13.5)   // 18 * 0.75
    assert.equal(res.pinRadius, 3.5)
    assert.equal(res.fitTolerance, 0.25)
  })

  it('calculateMortiseAndTenon permite sobreescribir la proporción de espiga', () => {
    const res = calculateMortiseAndTenon(24, 0.5)
    assert.equal(res.tenonThickness, 12.0)
    assert.equal(res.mortiseDepth, 18.0)
  })

  it('calculateDovetailSpecs(600, 18, 4) retorna tolerancias de 0.20mm', () => {
    const res = calculateDovetailSpecs(600, 18, 4)
    assert.equal(res.width, 600)
    assert.equal(res.thickness, 18)
    assert.equal(res.count, 4)
    assert.equal(res.pinWidth, 75) // 600 / (2 * 4) = 75
    assert.equal(res.pocketDepth, 18)
    assert.equal(res.jointTolerance, 0.20)
    assert.equal(res.angleDegrees, 14)
  })

  it('calculateFingerJoint(500, 18, 5) calcula anchos y profundidades', () => {
    const res = calculateFingerJoint(500, 18, 5)
    assert.equal(res.fingerWidth, 100) // 500 / 5
    assert.equal(res.fingerDepth, 18)
    assert.equal(res.jointTolerance, 0.15)
  })

  it('validateJointFit aprueba dimensiones saludables', () => {
    const res = validateJointFit('dovetail', { thickness: 18, width: 400 })
    assert.equal(res.isValid, true)
    assert.equal(res.status, 'VALIDADO')
    assert.equal(res.errors.length, 0)
  })

  it('validateJointFit rechaza espesores insuficientes (<6mm)', () => {
    const res = validateJointFit('mortise_tenon', { thickness: 4, width: 200 })
    assert.equal(res.isValid, false)
    assert.equal(res.status, 'RECHAZADO')
    assert.ok(res.errors.some(e => e.includes('Espesor de placa insuficiente')))
  })

  it('validateJointFit advierte sobre espesores finos para caja y espiga', () => {
    const res = validateJointFit('mortise_tenon', { thickness: 10, width: 200 })
    assert.equal(res.isValid, true)
    assert.equal(res.status, 'VALIDADO')
    assert.ok(res.warnings.some(w => w.includes('Espesor fino')))
  })
})

describe('furnitureMathSpecs — SSOT y Tolerancias V4.7', () => {
  it('contiene especificaciones de joinery, cncTolerances y hardwareTolerances', () => {
    assert.ok(MathSpecs.joinery)
    assert.ok(MathSpecs.cncTolerances)
    assert.ok(MathSpecs.hardwareTolerances)

    assert.equal(MathSpecs.cncTolerances.millingBitDiameter, 3.175)
    assert.equal(MathSpecs.cncTolerances.cornerReliefRadius, 1.6)
    assert.equal(MathSpecs.cncTolerances.interlockingTolerance, 0.25)
    assert.deepEqual(MathSpecs.cncTolerances.assemblyVector, [1])

    assert.equal(MathSpecs.hardwareTolerances.telescopicSlideClearance, 13)
    assert.equal(MathSpecs.hardwareTolerances.slidingDoorTrackDepth, 80)
    assert.equal(MathSpecs.hardwareTolerances.slidingDoorOverlap, 100)
    assert.equal(MathSpecs.hardwareTolerances.cava45LightClearance, 30)
  })
})

describe('paramContract — Inclusión de nuevos parámetros en Whitelist', () => {
  it('retiene joineryType, dovetailCount y tenonProportion sin descartarlos', () => {
    const raw = {
      width: 1000,
      height: 900,
      depth: 520,
      joineryType: 'dovetail',
      dovetailCount: 6,
      tenonProportion: 0.35
    }
    const { params, dropped } = coerceEngineParams(raw)
    assert.equal(params.joineryType, 'dovetail')
    assert.equal(params.dovetailCount, 6)
    assert.equal(params.tenonProportion, 0.35)
    assert.ok(!dropped.includes('joineryType'))
    assert.ok(!dropped.includes('dovetailCount'))
    assert.ok(!dropped.includes('tenonProportion'))
  })
})
