/**
 * Cierre estructural del bloque de gavetas (2026-10-15):
 *  - SEP inmediatamente sobre el último frente (+DRAWER_TOP_CLEARANCE)
 *  - puertas nacen sobre la SEP (sin solape con gavetas)
 *  - con divisores, las gavetas miden el VANO, no el ancho interno total
 *  - el validador alerta cajas de gaveta imposibles
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')
const { STRUCTURAL_LIMITS } = require('./constants')
const T = 18

const byPrefix = (d, p) => d.pieces.filter(x => String(x.id).startsWith(p))
const top = (p) => p.y + p.height / 2
const bottom = (p) => p.y - p.height / 2

const CLOSET = { moduleType: 'standard', width: 900, height: 2400, depth: 600, numShelves: 0,
  numDrawers: 4, hasDoors: true, numDoors: 2, drawerLayout: 'vertical', drawerHeight: 180 }

describe('Clóset 900×2400×600 — 2 puertas arriba + 4 gavetas abajo', () => {
  const d = generateProject(CLOSET)
  const fronts = byPrefix(d, 'GAV-FF')
  const sep = byPrefix(d, 'SEP')[0]
  const doors = byPrefix(d, 'PORTA')

  it('4 frentes de la altura pedida, sin estirarse por el mueble', () => {
    assert.equal(fronts.length, 4)
    for (const f of fronts) assert.equal(f.height, 180 - 3 - 4)
  })
  it('SEP existe y queda a DRAWER_TOP_CLEARANCE sobre el último frente', () => {
    assert.ok(sep, 'falta la SEP')
    const lastTop = Math.max(...fronts.map(top))
    // ±1mm: makePiece redondea las coordenadas a 0.5
    assert.ok(Math.abs(sep.y - T / 2 - lastTop - STRUCTURAL_LIMITS.DRAWER_TOP_CLEARANCE) <= 1)
  })
  it('ningún frente de gaveta queda por encima de la SEP', () => {
    for (const f of fronts) assert.ok(top(f) <= sep.y - T / 2)
  })
  it('las puertas nacen sobre la SEP y no pisan las gavetas', () => {
    assert.equal(doors.length, 2)
    for (const p of doors) {
      assert.ok(bottom(p) >= sep.y + T / 2, `puerta (${bottom(p)}) pisa la SEP (${sep.y + T / 2})`)
      assert.ok(top(p) <= 2400 - T)
      assert.ok(p.height > 1000, 'la puerta debe cubrir el vano superior')
    }
  })
})

describe('Gavetas por vano con divisores', () => {
  const cfg = { moduleType: 'standard', width: 2400, height: 2000, depth: 580, numShelves: 0,
    numDrawers: 4, numDividers: 1, hasDoors: true, numDoors: 4, drawerHeight: 180 }
  const d = generateProject(cfg)

  it('el frente mide el vano (≈1182), no el ancho interno total (2364)', () => {
    const fronts = byPrefix(d, 'GAV-FF')
    assert.ok(fronts.length > 0)
    for (const f of fronts) assert.ok(f.width < 1200, `frente de ${f.width}mm`)
  })
  it('registra el ajuste de columnas (transparencia)', () => {
    assert.ok((d.specAdjustments || []).some(a => a.code === 'DRAWER_COLUMNS_FROM_DIVIDERS'))
  })
  it('sin divisores no se altera el layout', () => {
    const r = generateProject({ ...cfg, numDividers: 0, width: 900 })
    assert.ok(!(r.specAdjustments || []).some(a => a.code === 'DRAWER_COLUMNS_FROM_DIVIDERS'))
    assert.ok(!r.configuration.drawerColumns)
  })
})

describe('Validador — ancho de caja de gaveta', () => {
  const base = { moduleType: 'standard', height: 2000, depth: 580, thickness: 18, backThickness: 6,
    numShelves: 0, numDrawers: 2, drawerHeight: 180, hasDoors: true, numDoors: 2, baseboard: true, baseboardHeight: 100 }
  const run = (c) => validateDesign({ configuration: { ...base, ...c }, pieces: [] })
  const text = (r) => [...(r.errors || []), ...(r.warnings || [])].join(' | ')

  it('>1200mm → error', () => assert.match(text(run({ width: 1600 })), /supera el máximo de 1200/))
  it('1000-1200mm → advertencia', () => assert.match(text(run({ width: 1250 })), /supera 1000mm/))
  it('con divisores se valida el vano, no el total', () => {
    assert.doesNotMatch(text(run({ width: 1800, numDividers: 1 })), /Caja de gaveta/)
  })
})

describe('Base + tampo + gavetas sin puertas — gavetas al tampo, un solo travesaño interno', () => {
  const d = generateProject({ moduleType: 'base', width: 600, height: 900, depth: 520, numDrawers: 4,
    hasDoors: false, numShelves: 0, hasCountertop: true })
  const fronts = byPrefix(d, 'GAV-FF')
  it('sin travesaño frontal; sólo el trasero', () => {
    assert.equal(byPrefix(d, 'TRAV-F').length, 0)
    assert.equal(byPrefix(d, 'TRAV-B').length, 1)
  })
  it('el último frente queda a ≤6mm del tampo (sin hueco que deje ver el travesaño)', () => {
    const gap = 900 - Math.max(...fronts.map(top))
    assert.ok(gap > 0 && gap <= 6, `hueco ${gap}mm`)
  })
  it('el primer frente no pisa la base (piso termina en 118)', () => {
    assert.ok(Math.min(...fronts.map(bottom)) >= 118)
  })
})

describe('Base + tampo + gavetas al tope con numShelves por defecto (2)', () => {
  const d = generateProject({ moduleType: 'base', width: 600, height: 900, depth: 520, numDrawers: 4,
    hasDoors: false, numShelves: 2, hasCountertop: true })
  it('no emite estantes ni separador (las gavetas llenan el frente)', () => {
    assert.equal(byPrefix(d, 'PRAT').length, 0)
    assert.equal(byPrefix(d, 'PRIV_SEP').length + byPrefix(d, 'SEP').length, 0)
    assert.equal(d.configuration.numShelves, 0)
  })
  it('lo registra como ajuste (transparencia)', () => {
    assert.ok(d.specAdjustments.some(a => a.code === 'SHELVES_OMITTED_DRAWERS_FILL'))
  })
})

// ─── Base MIXTO (gavetas + puertas), 2026-10-15 ─────────────────────────────────
// Antes: frentes = zona/n (gigantes) y totalDrawerH era el CONTEO de gavetas → las puertas
// medían casi la altura total y pisaban los frentes. Ahora: frente = drawerHeight, gavetas
// arriba bajo el tampo, SEP 16mm bajo el último frente, puertas = vano restante.
const { HARDWARE } = require('./constants')
const spanY = (p) => [bottom(p), top(p)]
const shelfSpan = (p) => [p.y - T / 2, p.y + T / 2]
const overlap = ([a0, a1], [b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > 0.01

function checkMixed(d, H, nDrawers, drawerH) {
  const fronts = byPrefix(d, 'GAV-FF')
  const doors = byPrefix(d, 'PORTA')
  const sep = [...byPrefix(d, 'PRIV_SEP'), ...byPrefix(d, 'SEP')][0]
  assert.equal(fronts.length, nDrawers)
  assert.ok(doors.length >= 1, 'faltan puertas')
  assert.ok(sep, 'falta la SEP')
  // 1) altura nominal, no zona/n
  for (const f of fronts) assert.equal(f.height, drawerH - 3 - 2 * HARDWARE.DRAWER_FRONT_GAP)
  // 2) todo dentro del vano vertical
  for (const p of [...fronts, ...doors]) { assert.ok(bottom(p) >= 100 - 0.01, `${p.id} bajo el piso`); assert.ok(top(p) <= H + 0.01, `${p.id} sobre el tope`) }
  // 3) ninguna puerta pisa un frente en Y
  for (const dr of doors) for (const f of fronts) assert.ok(!overlap(spanY(dr), spanY(f)), `${dr.id} pisa ${f.id}`)
  // 4) frentes entre sí sin solape
  for (let i = 0; i < fronts.length; i++) for (let j = i + 1; j < fronts.length; j++) assert.ok(!overlap(spanY(fronts[i]), spanY(fronts[j])))
  // 5) SEP: cara superior a 16mm del borde inferior del frente más bajo; no corta ningún frente
  const lowestFrontBottom = Math.min(...fronts.map(bottom))
  assert.ok(Math.abs(lowestFrontBottom - shelfSpan(sep)[1] - STRUCTURAL_LIMITS.DRAWER_TOP_CLEARANCE) <= 1.5,
    `SEP a ${lowestFrontBottom - shelfSpan(sep)[1]}mm del frente`)
  for (const f of fronts) assert.ok(!overlap(spanY(f), shelfSpan(sep)))
  // 6) las puertas llegan por encima de la SEP hasta el primer frente (cubren el vano completo)
  for (const dr of doors) assert.ok(top(dr) >= shelfSpan(sep)[1] && top(dr) <= lowestFrontBottom)
  return { fronts, doors, sep }
}

describe('Base MIXTO — bajo de cocina 800×900×600, 1 gaveta + 2 puertas', () => {
  const d = generateProject({ moduleType: 'base', width: 800, height: 900, depth: 600, numDrawers: 1,
    drawerHeight: 150, hasDoors: true, numDoors: 2, numShelves: 0, hasCountertop: true })
  it('frentes/SEP/puertas coherentes, sin solapes en Y', () => { checkMixed(d, 900, 1, 150) })
  it('las puertas miden el vano restante (≫ el conteo de gavetas)', () => {
    const { doors } = checkMixed(d, 900, 1, 150)
    for (const p of doors) assert.ok(p.height > 500, `puerta de ${p.height}mm`)
  })
})

describe('Base MIXTO — isla 1500×900×900, 2 gavetas + 2 puertas', () => {
  const d = generateProject({ moduleType: 'base', width: 1500, height: 900, depth: 900, numDrawers: 2,
    drawerHeight: 180, hasDoors: true, numDoors: 2, numShelves: 1, hasCountertop: true })
  it('frentes/SEP/puertas coherentes, sin solapes en Y', () => { checkMixed(d, 900, 2, 180) })
  it('el estante interior queda en el vano de puertas (bajo la SEP, sobre la base)', () => {
    const { sep } = checkMixed(d, 900, 2, 180)
    const sh = byPrefix(d, 'PRAT')[0]
    assert.ok(sh, 'falta el estante')
    assert.ok(shelfSpan(sh)[1] <= shelfSpan(sep)[0] && shelfSpan(sh)[0] >= 118)
  })
})

describe('Base de UNA familia — intactos', () => {
  it('sólo puertas: altura de hoja histórica (H − rodapié − T − holgura)', () => {
    const d = generateProject({ moduleType: 'base', width: 1200, height: 900, depth: 580, hasDoors: true,
      numDoors: 2, doorType: 'hinged', hasCountertop: false, numDrawers: 0 })
    for (const p of byPrefix(d, 'PORTA-0')) assert.equal(p.height, 900 - 100 - T - HARDWARE.DOOR_GAP_H)
  })
  it('sólo gavetas (gavetero): frentes llenan el vano hasta el tampo, sin puertas ni SEP', () => {
    const d = generateProject({ moduleType: 'base', width: 600, height: 900, depth: 520, numDrawers: 4,
      hasDoors: false, numShelves: 0, hasCountertop: true })
    const fronts = byPrefix(d, 'GAV-FF')
    assert.equal(byPrefix(d, 'PORTA').length, 0)
    assert.equal(byPrefix(d, 'PRIV_SEP').length + byPrefix(d, 'SEP').length, 0)
    assert.ok(900 - Math.max(...fronts.map(top)) <= 6)
    for (const f of fronts) assert.ok(f.height > 150, 'el gavetero llena el vano (no usa drawerHeight)')
  })
})
