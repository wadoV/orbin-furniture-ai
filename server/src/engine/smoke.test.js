/**
 * Orbin AI — Smoke / Invariant Tests (flujo crítico: generar → validar → exportar)
 * Runner: node:test (cero dependencias)   ·   Run: node --test src/engine/
 *
 * Complementa engine.test.js. Blinda las reglas duras de fabricación (CLAUDE.md):
 * una pieza mal calculada NO se puede "deshacer" en la chapa.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject, generateProjectAutoSplit, generateCutList } = require('./closetEngine')
const { validateDesign } = require('./validator')
const Spec = require('../ai/furnitureMathSpecs')

// Regla dura CLAUDE.md: chapa MDF/MDP máx 2750 × 1840 mm.
const PLATE_LONG = 2750, PLATE_SHORT = 1840, EPS = 0.5

function assertFitsPlate(pieces, label) {
  for (const p of pieces) {
    assert.ok(p.width > 0 && p.height > 0, `${label}: "${p.name}" con dimensión no positiva (${p.width}×${p.height})`)
    assert.ok(p.thickness > 0, `${label}: "${p.name}" con espesor no positivo (${p.thickness})`)
    // La regla de chapa 2750×1840 aplica a piezas ESTRUCTURALES (MDF ≥15mm).
    // Los fondos de 6mm usan stock distinto / se dividen en nesting → exentos.
    if (p.thickness >= 15) {
      const long = Math.max(p.width, p.height), short = Math.min(p.width, p.height)
      assert.ok(long <= PLATE_LONG + EPS, `${label}: "${p.name}" excede el largo de chapa (${long} > ${PLATE_LONG})`)
      assert.ok(short <= PLATE_SHORT + EPS, `${label}: "${p.name}" excede el ancho de chapa (${short} > ${PLATE_SHORT})`)
    }
  }
}

// ── Suite A: furnitureMathSpecs (Single Source of Truth) ─────────────────────
describe('furnitureMathSpecs — reglas de cálculo', () => {
  it('internalSpan = ancho − 2·espesor', () => {
    assert.strictEqual(Spec.internalSpan(600, 18), 564)
    assert.strictEqual(Spec.internalSpan(900, 15), 870)
  })
  it('drawerBox.netWidth descuenta 26mm (13mm por lado, corrediza telescópica)', () => {
    assert.strictEqual(Spec.drawerBox.netWidth(564), 538)
  })
  it('drawerBox.headerWidth = netWidth − 2·espesor', () => {
    assert.strictEqual(Spec.drawerBox.headerWidth(538, 15), 508)
  })
  it('backPanels.groovedWidth = internalSpan + 2·profundidad de ranura', () => {
    assert.strictEqual(Spec.backPanels.groovedWidth(564, 8), 580)
  })
  it('backPanels.nailedWidth = ancho total − 2mm', () => {
    assert.strictEqual(Spec.backPanels.nailedWidth(600), 598)
  })
  it('edgeBanding descuenta el espesor del tapacanto', () => {
    assert.strictEqual(Spec.edgeBanding(500, 1), 499)
  })
  it('18mm está entre los espesores estándar soportados', () => {
    assert.ok(Spec.thicknessOptions.includes(18))
  })
})

// ── Suite B: invariante de chapa (regla dura) sobre matriz de configs ─────────
describe('Invariante: ninguna pieza excede la chapa 2750×1840', () => {
  const matrix = [
    { label: 'ropero 1800 3 estantes',        p: { width: 1800, height: 2100, depth: 600, numShelves: 3 } },
    { label: 'ropero 2400 4 puertas',          p: { width: 2400, height: 2400, depth: 600, hasDoors: true, numDoors: 4, numShelves: 2 } },
    { label: 'cocina base 900 3 gavetas',      p: { moduleType: 'base', width: 900, height: 720, depth: 580, numDrawers: 3 } },
    { label: 'aéreo 800×700',                  p: { moduleType: 'aereo', width: 800, height: 700, depth: 350, numShelves: 2 } },
    { label: 'columna 600 2 gavetas',          p: { width: 600, height: 2000, depth: 600, numDrawers: 2, numShelves: 2 } },
    { label: 'closet 1200 puertas',            p: { width: 1200, height: 2000, depth: 600, numShelves: 2, hasDoors: true, numDoors: 2 } },
  ]
  for (const { label, p } of matrix) {
    it(`${label}: todas las piezas caben en chapa`, () => {
      const d = generateProject(p)
      assert.ok(d.success, `${label}: generateProject falló — ${d.error}`)
      assertFitsPlate(d.pieces, label)
    })
  }

  it('auto-split 3600mm: cada módulo genera piezas que caben en chapa', () => {
    const r = generateProjectAutoSplit({ width: 3600, height: 2400, depth: 600, numShelves: 2 })
    assert.ok(r.success, `autoSplit falló: ${r.error}`)
    assert.ok(r.modules.length >= 2, 'un ropero de 3600mm debe dividirse')
    r.modules.forEach((m, i) => assertFitsPlate(m.pieces, `módulo ${i + 1}`))
  })
})

// ── Suite C: export (cutlist + nesting) — smoke del entregable de fábrica ─────
describe('Export: cutlist y nesting íntegros', () => {
  const d = generateProject({ width: 1800, height: 2100, depth: 600, numShelves: 2, numDrawers: 1, hasDoors: true, numDoors: 2 })

  it('generateProject expone cutList y nesting no vacíos', () => {
    assert.ok(d.success)
    assert.ok(Array.isArray(d.cutList) && d.cutList.length > 0, 'cutList vacío')
    assert.ok(Array.isArray(d.nesting) && d.nesting.length > 0, 'nesting vacío')
  })
  it('cada renglón del cutlist tiene medidas de corte positivas', () => {
    for (const row of d.cutList) {
      assert.ok(row.cutWidth > 0 && row.cutHeight > 0, `renglón "${row.name}" con corte no positivo (${row.cutWidth}×${row.cutHeight})`)
      assert.ok(row.thickness > 0, `renglón "${row.name}" sin espesor`)
    }
  })
  it('el cutlist es no vacío y no introduce espesores fantasma', () => {
    assert.ok(d.cutList.length > 0, 'cutList vacío')
    const espesoresPiezas = new Set(d.pieces.map(p => p.thickness))
    for (const row of d.cutList) {
      assert.ok(espesoresPiezas.has(row.thickness),
        `cutList introduce un espesor (${row.thickness}mm) que no existe en las piezas`)
    }
  })
  it('generateCutList(pieces) es determinista', () => {
    const a = generateCutList(d.pieces, d.configuration || {})
    const b = generateCutList(d.pieces, d.configuration || {})
    assert.ok(Array.isArray(a) && a.length > 0, 'generateCutList debe devolver renglones')
    assert.strictEqual(a.length, b.length, 'generateCutList debe ser determinista')
  })
  it('cada grupo de nesting usa al menos 1 chapa y tiene área positiva', () => {
    for (const g of d.nesting) {
      assert.ok(g.plateCount >= 1, `grupo ${g.thickness}mm sin chapas`)
      assert.ok(g.totalPieceArea > 0, `grupo ${g.thickness}mm con área nula`)
    }
  })
})

// ── Suite D: cómoda pura (regresión documentada — decisión de producto) ───────
describe('Regresión: cómoda pura (chest of drawers)', () => {
  const cp = generateProject({ width: 600, height: 1800, depth: 600, numDrawers: 4, numShelves: 0, hasDoors: false })

  it('genera piezas de gaveta y todas caben en chapa', () => {
    assert.ok(cp.success)
    const hasDrawers = cp.pieces.some(p => p.name && /gav|caj|drawer/i.test(p.name))
    assert.ok(hasDrawers, 'la cómoda debe tener piezas de gaveta')
    assertFitsPlate(cp.pieces, 'cómoda pura')
  })

  // [2026-07] RESUELTO: el validador ahora es consciente de intención — una
  // cómoda pura (numShelves === 0) que llena la altura con gavetas es VÁLIDA;
  // el error de "sem espaco para estantes" solo aplica si se pidieron estantes.
  it('VALIDA una cómoda de gavetas a plena altura (sin estantes)', () => {
    const v = validateDesign(cp)
    assert.strictEqual(v.status, 'VALIDADO', 'una cómoda pura de gavetas debe ser válida. Errores: ' + JSON.stringify(v.errors))
  })

  // Prueba directa de las DOS ramas de la lógica consciente de intención,
  // sin depender del auto-dimensionado del motor: misma pila de gavetas (>85%),
  // solo cambia numShelves. La pila cabe físicamente (< altura interna útil).
  const stackDesign = (numShelves) => ({
    success: true, pieces: [],
    configuration: { thickness: 18, width: 600, height: 1800, depth: 600,
      numDrawers: 7, drawerHeight: 200, numShelves, numDividers: 0,
      baseboard: true, baseboardHeight: 100 }
  })
  it('validador: pila al 85%+ SIN estantes → VALIDADO (cômoda)', () => {
    assert.strictEqual(validateDesign(stackDesign(0)).status, 'VALIDADO')
  })
  it('validador: la MISMA pila CON estantes pedidos → RECHAZADO', () => {
    const v = validateDesign(stackDesign(2))
    assert.strictEqual(v.status, 'RECHAZADO', 'errs: ' + JSON.stringify(v.errors))
  })
})

// ── Suite E: anatomía de gaveta (caja real, no un bloque) ────────────────────
describe('Anatomía de gaveta', () => {
  const d = generateProject({ width: 800, height: 1200, depth: 580, numDrawers: 2, numShelves: 0, hasDoors: false })
  it('cada gaveta = frente + 2 laterales + frente/trasera internos + fundo', () => {
    const fronts  = d.pieces.filter(p => p.type === 'drawer_front')
    const bottoms = d.pieces.filter(p => p.type === 'drawer_bottom')
    const box     = d.pieces.filter(p => p.type === 'drawer_box')
    assert.strictEqual(fronts.length, 2, 'un frente (facade) por gaveta')
    assert.strictEqual(bottoms.length, 2, 'un fundo por gaveta')
    assert.strictEqual(box.length, 4, '2 renglones de caja por gaveta (laterales + frente/trasera)')
    const totalBox = box.reduce((a, p) => a + p.quantity, 0)
    assert.strictEqual(totalBox, 8, 'laterales(2) + frente/trasera(2) por gaveta × 2 = 8 paneles')
    assert.ok(d.pieces.some(p => /lateral/i.test(p.name)), 'debe haber laterales')
    assert.ok(d.pieces.some(p => /trasera/i.test(p.name)), 'debe haber frente/trasera')
    assert.ok(d.pieces.some(p => /fondo/i.test(p.name)), 'debe haber fundo')
  })
  it('el fundo es de 6mm (chapa fina), no 18mm', () => {
    const bottom = d.pieces.find(p => p.type === 'drawer_bottom')
    assert.strictEqual(bottom.thickness, 6, 'el fundo del cajón debe ser 6mm')
  })
})
