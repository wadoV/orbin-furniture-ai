'use strict'

/**
 * cutlist.test.js — edge-banding deduction tests for generateCutList()
 *
 * All expected values are hand-computed from the contract documented
 * in the source (closetEngine.js lines 58-99), NOT copied from live output.
 *
 * Contract recap:
 *   tEdge = piece.edgeBanding.thickness if numeric, else defaultEdgeThickness (1.0)
 *   countW: eb.all→2, else eb.left+eb.right (0/1/2)
 *   countH: eb.all→2, else (eb.top||eb.front)+(eb.bottom||eb.back) (0/1/2)
 *   cutWidth  = max(2, round10(nominalWidth  - countW * tEdge))
 *   cutHeight = max(2, round10(nominalHeight - countH * tEdge))
 *   quantity > 1 → N rows, each with the same net dimensions
 */

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { generateCutList } = require('./closetEngine')

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal valid piece for generateCutList().
 * width/height are nominalWidth/nominalHeight (raw MDF dimensions before kerf).
 */
function piece(overrides = {}) {
  return {
    id: 'P1',
    name: 'Test piece',
    type: 'panel',
    width: 600,
    height: 400,
    thickness: 18,
    quantity: 1,
    grainDirection: 'horizontal',
    edgeBanding: {},
    ...overrides
  }
}

// round to 1 decimal, same as engine
const r1 = v => Math.round(v * 10) / 10

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('generateCutList — edge-banding deduction', () => {

  // 1. No edge banding → cut == nominal on both axes
  test('piece with NO edge banding: cut equals nominal on both axes', () => {
    const p = piece({ edgeBanding: {} })
    // countW=0, countH=0  → no deduction
    // expected: cutWidth=600, cutHeight=400
    const [row] = generateCutList([p])
    assert.equal(row.nominalWidth,  600)
    assert.equal(row.nominalHeight, 400)
    assert.equal(row.cutWidth,      600)
    assert.equal(row.cutHeight,     400)
  })

  // 2. left:true only → width reduced by exactly 1 × tEdge (default 1.0), height unchanged
  test('edgeBanding { left:true }: width −1×tEdge, height unchanged', () => {
    const p = piece({ edgeBanding: { left: true } })
    // countW=1, countH=0, tEdge=1.0
    // cutWidth  = max(2, round10(600 - 1*1.0)) = 599.0
    // cutHeight = max(2, round10(400 - 0*1.0)) = 400.0
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  r1(600 - 1 * 1.0))   // 599
    assert.equal(row.cutHeight, 400)
  })

  // 3. left+right → width reduced by exactly 2 × tEdge, height unchanged
  test('edgeBanding { left:true, right:true }: width −2×tEdge, height unchanged', () => {
    const p = piece({ edgeBanding: { left: true, right: true } })
    // countW=2, countH=0, tEdge=1.0
    // cutWidth  = max(2, round10(600 - 2*1.0)) = 598.0
    // cutHeight = 400
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  r1(600 - 2 * 1.0))   // 598
    assert.equal(row.cutHeight, 400)
  })

  // 4. top:true only → height reduced by 1×tEdge, width unchanged
  test('edgeBanding { top:true }: height −1×tEdge, width unchanged', () => {
    const p = piece({ edgeBanding: { top: true } })
    // countW=0, countH=1, tEdge=1.0
    // cutWidth  = 600
    // cutHeight = max(2, round10(400 - 1*1.0)) = 399.0
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  600)
    assert.equal(row.cutHeight, r1(400 - 1 * 1.0))   // 399
  })

  // 5. all:true → width AND height each reduced by 2×tEdge
  test('edgeBanding { all:true }: both axes reduced by 2×tEdge', () => {
    const p = piece({ edgeBanding: { all: true } })
    // countW=2, countH=2, tEdge=1.0
    // cutWidth  = max(2, round10(600 - 2*1.0)) = 598.0
    // cutHeight = max(2, round10(400 - 2*1.0)) = 398.0
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  r1(600 - 2 * 1.0))   // 598
    assert.equal(row.cutHeight, r1(400 - 2 * 1.0))   // 398
  })

  // 6. explicit thickness overrides default 1.0
  test('explicit thickness (2.0mm ABS) overrides default 1.0mm', () => {
    const p = piece({ edgeBanding: { left: true, right: true, top: true, thickness: 2.0 } })
    // countW=2, countH=1, tEdge=2.0
    // cutWidth  = max(2, round10(600 - 2*2.0)) = 596.0
    // cutHeight = max(2, round10(400 - 1*2.0)) = 398.0
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  r1(600 - 2 * 2.0))   // 596
    assert.equal(row.cutHeight, r1(400 - 1 * 2.0))   // 398
  })

  // 7. floor guard: deduction cannot yield a non-positive (< 2mm) dimension
  test('floor guard: deduction never yields a non-positive cut dimension', () => {
    // piece so small that over-deduction would go below 0
    const p = piece({
      width: 3,
      height: 3,
      edgeBanding: { all: true, thickness: 5.0 }
      // countW=2, tEdge=5 → 3 - 10 = -7 → clamped to 2
      // countH=2, tEdge=5 → 3 - 10 = -7 → clamped to 2
    })
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  2)
    assert.equal(row.cutHeight, 2)
  })

  // 8a. quantity > 1 expands into N rows
  test('quantity=3 produces exactly 3 rows', () => {
    const p = piece({ quantity: 3, edgeBanding: { left: true } })
    const rows = generateCutList([p])
    assert.equal(rows.length, 3)
  })

  // 8b. every expanded row carries the same net cut dimensions
  test('quantity=3: every row carries identical cutWidth and cutHeight', () => {
    const p = piece({ quantity: 3, edgeBanding: { left: true } })
    // cutWidth = 599, cutHeight = 400 for each row
    const rows = generateCutList([p])
    const expectedCW = r1(600 - 1 * 1.0)  // 599
    for (const row of rows) {
      assert.equal(row.cutWidth,  expectedCW)
      assert.equal(row.cutHeight, 400)
    }
  })

  // 8c. expanded row ids and names are suffixed correctly
  test('quantity=3: rows are numbered 1/3, 2/3, 3/3', () => {
    const p = piece({ id: 'T1', name: 'Side', quantity: 3 })
    const rows = generateCutList([p])
    assert.equal(rows[0].id,   'T1-1')
    assert.equal(rows[1].id,   'T1-2')
    assert.equal(rows[2].id,   'T1-3')
    assert.ok(rows[0].name.includes('1/3'))
    assert.ok(rows[1].name.includes('2/3'))
    assert.ok(rows[2].name.includes('3/3'))
  })

  // Bonus: 'front' flag aliases 'top' on the HEIGHT axis
  test('edgeBanding { front:true } aliases top: height −1×tEdge, width unchanged', () => {
    const p = piece({ edgeBanding: { front: true } })
    // same math as top:true
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  600)
    assert.equal(row.cutHeight, r1(400 - 1 * 1.0))   // 399
  })

  // Bonus: 'back' flag aliases 'bottom' on the HEIGHT axis
  test('edgeBanding { back:true } aliases bottom: height −1×tEdge, width unchanged', () => {
    const p = piece({ edgeBanding: { back: true } })
    // countH=1, tEdge=1.0 → 400-1=399
    const [row] = generateCutList([p])
    assert.equal(row.cutWidth,  600)
    assert.equal(row.cutHeight, r1(400 - 1 * 1.0))   // 399
  })

  // nominalWidth/nominalHeight always mirror the input piece dimensions
  test('nominalWidth and nominalHeight are always the raw input dimensions', () => {
    const p = piece({ width: 800, height: 350, edgeBanding: { all: true } })
    const [row] = generateCutList([p])
    assert.equal(row.nominalWidth,  800)
    assert.equal(row.nominalHeight, 350)
  })

  // passing a custom defaultEdgeThickness to generateCutList
  test('generateCutList defaultEdgeThickness param is used when piece thickness absent', () => {
    const p = piece({ edgeBanding: { left: true, right: true } })
    // no piece.edgeBanding.thickness → use defaultEdgeThickness=0.6
    // cutWidth = max(2, round10(600 - 2*0.6)) = 598.8
    const [row] = generateCutList([p], 0.6)
    assert.equal(row.cutWidth,  r1(600 - 2 * 0.6))   // 598.8
    assert.equal(row.cutHeight, 400)
  })
})
