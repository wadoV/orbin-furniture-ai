/**
 * Orbin AI — furnitureMathSpecs.drawerSystem (ADITIVO 2026-10-13)
 * Tests para el sistema maestro de gavetas (Padrão Brasil).
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const FurnitureMath = require('./furnitureMathSpecs')

describe('furnitureMathSpecs — drawerSystem (Padrão Brasil)', () => {
  it('boxNetWidth descuenta 26mm de holgura de corredera telescópica', () => {
    assert.equal(FurnitureMath.drawerSystem.boxNetWidth(500), 474)
    assert.equal(FurnitureMath.drawerSystem.boxNetWidth(600), 574)
    assert.equal(FurnitureMath.drawerSystem.boxNetWidth(26), 0)
  })

  it('boxDepth snap al paso comercial [250,300,350,400,450,500,550] inferior más cercano', () => {
    assert.equal(FurnitureMath.drawerSystem.boxDepth(600), 550) // 600-50=550 → en tabla
    assert.equal(FurnitureMath.drawerSystem.boxDepth(480), 400) // 480-50=430 → snap a 400
    assert.equal(FurnitureMath.drawerSystem.boxDepth(350), 300) // 350-50=300 → en tabla
    assert.equal(FurnitureMath.drawerSystem.boxDepth(290), 0)   // 290-50=240 < 250 → 0
  })

  it('distributeDrawerFronts modo equal: alturas iguales y >= 80mm', () => {
    const result = FurnitureMath.drawerSystem.distributeDrawerFronts({
      availableHeight: 600, numDrawers: 3, mode: 'equal'
    })
    assert.ok(result.ok)
    assert.equal(result.heights.length, 3)
    assert.ok(result.heights.every(h => h === result.heights[0]))
    assert.ok(result.heights[0] >= 80)
  })

  it('distributeDrawerFronts modo custom con rest calcula residual correcto', () => {
    const result = FurnitureMath.drawerSystem.distributeDrawerFronts({
      availableHeight: 600, numDrawers: 3, mode: 'custom',
      frontHeights: [150, 150, 'rest']
    })
    assert.ok(result.ok)
    assert.equal(result.heights[0], 150)
    assert.equal(result.heights[1], 150)
    assert.ok(result.heights[2] > 150)
    assert.equal(result.restIndex, 2)
    assert.equal(result.boxHeights[0], 110)  // frontHeight - 40
    assert.equal(result.boxHeights[1], 110)
  })

  it('distributeDrawerFronts rechaza si rest < 80mm', () => {
    const result = FurnitureMath.drawerSystem.distributeDrawerFronts({
      availableHeight: 300, numDrawers: 3, mode: 'custom',
      frontHeights: [150, 150, 'rest']
    })
    assert.ok(!result.ok)
    assert.ok(
      result.adjustments.some(a =>
        a.code === 'DRAWER_REST_TOO_SHORT' || a.code === 'DRAWER_HEIGHTS_EXCEED'
      )
    )
  })

  it('distributeDrawerFronts rechaza alturas fijas que exceden el espacio', () => {
    const result = FurnitureMath.drawerSystem.distributeDrawerFronts({
      availableHeight: 200, numDrawers: 2, mode: 'custom',
      frontHeights: [150, 150]
    })
    assert.ok(!result.ok)
    assert.ok(result.adjustments.some(a => a.code === 'DRAWER_HEIGHTS_EXCEED'))
  })

  it('stackAlignment devuelve top para base y bottom para standard', () => {
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('base'), 'top')
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('standard'), 'bottom')
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('aereo'), 'bottom')
  })

  it('stackAlignment respeta alineación explícita sobre la tipología', () => {
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('base', 'bottom'), 'bottom')
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('standard', 'top'), 'top')
    assert.equal(FurnitureMath.drawerSystem.stackAlignment('base', 'auto'), 'top')
  })

  it('internalSetback devuelve retranqueos correctos por tipo de puerta', () => {
    assert.equal(FurnitureMath.drawerSystem.internalSetback('sliding'), 80)
    assert.equal(FurnitureMath.drawerSystem.internalSetback('hinged'), 20)
    assert.equal(FurnitureMath.drawerSystem.internalSetback('none'), 0)
    assert.equal(FurnitureMath.drawerSystem.internalSetback(undefined), 0)
  })

  it('validateDrawerConfinement rechaza frente > 1000mm y acepta <= 1000mm', () => {
    const bad = FurnitureMath.drawerSystem.validateDrawerConfinement(1200)
    assert.ok(!bad.ok)
    assert.equal(bad.code, 'DRAWER_TOO_WIDE')
    const ok = FurnitureMath.drawerSystem.validateDrawerConfinement(800)
    assert.ok(ok.ok)
  })
})