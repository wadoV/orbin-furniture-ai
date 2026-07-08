/**
 * Orbin AI - Parametric Engine Unit Tests
 * Runner: Node.js built-in test runner (node:test) - zero extra deps
 * Run:    node --test server/src/engine/engine.test.js
 * CI:     wired in .github/workflows/ci.yml
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject, generateProjectAutoSplit } = require('./closetEngine')
const { validateDesign } = require('./validator')

// Helpers
function assertValidated(design, label) {
  assert.ok(design.success, label + ': generateProject failed - ' + (design.error || design.details))
  const v = validateDesign(design)
  assert.strictEqual(v.status, 'VALIDADO', label + ': expected VALIDADO, got ' + v.status + '. Errors: ' + JSON.stringify(v.errors))
}

function assertRechazado(design, label) {
  const v = validateDesign(design)
  assert.strictEqual(v.status, 'RECHAZADO', label + ': expected RECHAZADO but got ' + v.status)
}

// Suite 1: closetEngine.generateProject
describe('closetEngine.generateProject', () => {

  it('generates a standard wardrobe within plate limits', () => {
    const d = generateProject({ width: 2400, height: 2400, depth: 600, numShelves: 3, hasDoors: true, numDoors: 4 })
    assert.ok(d.success, 'generateProject failed: ' + d.error)
    assert.ok(Array.isArray(d.pieces) && d.pieces.length > 0, 'pieces must be non-empty')
    assert.ok(Array.isArray(d.cutList) && d.cutList.length > 0, 'cutList must be non-empty')
    assert.strictEqual(d.dimensions.external.width, 2400, 'external width mismatch')
    assert.ok(Array.isArray(d.nesting) && d.nesting.length > 0, 'nesting must be a non-empty array of sheet groups')
  })

  it('generates a kitchen base cabinet with drawers', () => {
    const d = generateProject({ moduleType: 'base', width: 900, height: 720, depth: 580, numDrawers: 3, numShelves: 0, hasDoors: false })
    assert.ok(d.success, 'generateProject kitchen failed: ' + d.error)
    const anyDrawer = d.pieces.some(p => p.name && (p.name.toLowerCase().includes('gav') || p.name.toLowerCase().includes('caj') || p.name.toLowerCase().includes('drawer')))
    assert.ok(anyDrawer, 'Expected drawer pieces. Got: ' + d.pieces.map(p => p.name).join(', '))
  })

  it('returns a project id with prefix ORB-', () => {
    const d = generateProject({ width: 1200, height: 2000, depth: 600 })
    assert.ok(d.id && d.id.startsWith('ORB-'), 'Expected id to start with ORB-, got: ' + d.id)
  })

  it('includes hardware BOM', () => {
    const d = generateProject({ width: 800, height: 2000, depth: 600, numDrawers: 2 })
    assert.ok(d.hardware, 'hardware BOM should be present')
  })

  it('all pieces have positive dimensions', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, numShelves: 2, numDrawers: 1, hasDoors: true })
    assert.ok(d.success, 'generateProject failed: ' + d.error)
    for (const p of d.pieces) {
      assert.ok(p.width > 0, 'Piece "' + p.name + '" has non-positive width: ' + p.width)
      assert.ok(p.height > 0, 'Piece "' + p.name + '" has non-positive height: ' + p.height)
      assert.ok(p.thickness > 0, 'Piece "' + p.name + '" has non-positive thickness: ' + p.thickness)
    }
  })

  it('drawer-only cabinet (comoda pura) produces drawer pieces', () => {
    const d = generateProject({ width: 600, height: 1800, depth: 600, numDrawers: 3, numShelves: 0, hasDoors: false })
    assert.ok(d.success, 'generateProject drawer-only failed: ' + d.error)
    const hasDrawers = d.pieces.some(p => p.name && (p.name.toLowerCase().includes('gav') || p.name.toLowerCase().includes('caj')))
    assert.ok(hasDrawers, 'Drawer-only cabinet should have drawer pieces')
  })

})

// Suite 2: closetEngine.generateProjectAutoSplit
describe('closetEngine.generateProjectAutoSplit', () => {

  it('no split when width <= 2700mm', () => {
    const r = generateProjectAutoSplit({ width: 2400, height: 2400, depth: 600 })
    assert.ok(r.success, 'autoSplit failed: ' + r.error)
    assert.strictEqual(r.split, false, 'Should not split 2400mm wardrobe')
    assert.strictEqual(r.count, 1, 'count should be 1')
    assert.strictEqual(r.modules.length, 1, 'should have exactly 1 module')
  })

  it('splits 3200mm wardrobe into 2 modules', () => {
    const r = generateProjectAutoSplit({ width: 3200, height: 2400, depth: 600, numShelves: 2 })
    assert.ok(r.success, 'autoSplit 3200mm failed')
    assert.strictEqual(r.split, true, 'Should split 3200mm wardrobe')
    assert.strictEqual(r.count, 2, 'Expected 2 modules, got ' + r.count)
    const sumW = r.modules.reduce((acc, m) => acc + m.dimensions.external.width, 0)
    assert.strictEqual(sumW, 3200, 'Width sum should be 3200, got ' + sumW)
  })

  it('all split modules succeed individually', () => {
    const r = generateProjectAutoSplit({ width: 4000, height: 2200, depth: 600, numDrawers: 4, numShelves: 1 })
    assert.ok(r.success, 'autoSplit 4000mm should succeed')
    for (const mod of r.modules) {
      assert.ok(mod.success, 'Module ' + mod.splitIndex + '/' + mod.splitTotal + ' failed: ' + mod.error)
    }
  })

  it('distributes drawers across split modules', () => {
    const r = generateProjectAutoSplit({ width: 5400, height: 2400, depth: 600, numDrawers: 6 })
    assert.ok(r.success, 'autoSplit 5400mm with drawers')
    const totalDrawerPieces = r.modules.reduce((sum, m) => {
      return sum + m.pieces.filter(p => p.name && (p.name.toLowerCase().includes('gav') || p.name.toLowerCase().includes('caj'))).length
    }, 0)
    assert.ok(totalDrawerPieces > 0, 'Should have drawer pieces distributed across modules')
  })

})

// Suite 3: validator VALIDADO / RECHAZADO
describe('validator', () => {

  it('VALIDADO: standard wardrobe within limits', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, numShelves: 2 })
    assertValidated(d, 'standard wardrobe 1800mm')
  })

  it('VALIDADO: kitchen base cabinet 900mm 3 drawers', () => {
    const d = generateProject({ moduleType: 'base', width: 900, height: 720, depth: 580, numDrawers: 3 })
    assertValidated(d, 'kitchen base 900mm 3 drawers')
  })

  it('VALIDADO: auto-split 3200mm - both modules pass', () => {
    const r = generateProjectAutoSplit({ width: 3200, height: 2400, depth: 600 })
    assert.ok(r.success)
    for (const mod of r.modules) {
      assertValidated(mod, 'auto-split module ' + mod.splitIndex)
    }
  })

  it('RECHAZADO: zero thickness triggers validation error', () => {
    const d = { success: true, configuration: { thickness: 0, width: 800, height: 2000, depth: 600 }, pieces: [] }
    assertRechazado(d, 'zero thickness')
  })

  it('RECHAZADO: piece larger than plate triggers error', () => {
    const d = {
      success: true,
      configuration: { thickness: 18, width: 3000, height: 2000, depth: 600 },
      pieces: [{ name: 'TestPiece', width: 3000, height: 500, thickness: 18 }]
    }
    assertRechazado(d, 'oversized piece')
  })

  it('validator returns populated errors array on RECHAZADO', () => {
    const d = { success: true, configuration: { thickness: 0, width: 800, height: 2000, depth: 600 }, pieces: [] }
    const v = validateDesign(d)
    assert.ok(Array.isArray(v.errors) && v.errors.length > 0, 'errors array should be non-empty')
    assert.ok(typeof v.summary === 'string', 'summary should be a string')
  })

})

// Suite: Mejoras — tamponado + baseType
describe('Mejoras: tamponado + baseType', () => {
  it('tamponado both → 2 paneles, VALIDADO', () => {
    const d = generateProject({ width: 2400, height: 2450, depth: 600, numShelves: 3, hasDoors: true, numDoors: 3, tamponado: 'both' })
    assert.strictEqual(d.pieces.filter(p => p.type === 'tamponado').length, 2, 'esperaba 2 tamponados')
    assertValidated(d, 'tamponado both')
  })
  it('tamponado left → 1 panel fuera del costado izq', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, tamponado: 'left' })
    const tp = d.pieces.filter(p => p.type === 'tamponado')
    assert.strictEqual(tp.length, 1)
    assert.ok(tp[0].x < 0, 'tamponado izq debe estar en x<0')
  })
  it('baseType none → sin zócalo, VALIDADO', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, baseType: 'none' })
    assert.ok(!d.pieces.some(p => p.type === 'baseboard'), 'no debe haber zócalo')
    assertValidated(d, 'baseType none')
  })
  it('baseType legs → 4 patas en hardware + laterales elevados, VALIDADO', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, baseType: 'legs', legHeight: 120 })
    assert.ok(d.hardware.some(h => /pata|nivelador/i.test(h.type + h.description) && h.quantity === 4), 'esperaba 4 patas')
    const lat = d.pieces.find(p => p.type === 'lateral')
    assert.ok(lat.height < 2100 && lat.y > 120, 'laterales deben arrancar sobre las patas')
    assertValidated(d, 'baseType legs')
  })
})
