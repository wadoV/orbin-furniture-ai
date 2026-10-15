/**
 * Caracterización — MÓDULO DE HORNO 800×900×520, zócalo 12cm, puerta falsa (2026-10-12).
 * Cubre: (1) NL → params, (2) alias/tipologías del LLM en el contrato, (3) geometría:
 * puerta falsa EXTERIOR (overlay) y nicho comercial de 600mm exactos.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseNaturalLanguage } = require('./nlParser')
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')
const { coerceEngineParams } = require('../ai/paramContract')
const { HARDWARE } = require('./constants')

const T = 18
const PROMPT = 'crea un modulo para horno, de 800x900x520mm, puerta falsa, repisa interna y rodapie de 12cm'
const byPrefix = (d, p) => d.pieces.filter(x => String(x.id).startsWith(p))
const one = (d, p) => { const a = byPrefix(d, p); assert.equal(a.length, 1, p); return a[0] }

describe('Módulo de horno 800×900×520 — NL → motor', () => {
  const parsed = parseNaturalLanguage(PROMPT)
  const design = generateProject({ ...parsed.params })

  it('el parser lo mapea a base + ovenPanel con 800×900×520 y zócalo de 120', () => {
    const p = parsed.params
    assert.equal(p.moduleType, 'base'); assert.equal(p.ovenPanel, true)
    assert.deepEqual([p.width, p.height, p.depth, p.baseboardHeight], [800, 900, 520, 120])
    assert.equal(p.baseboard, true)
  })
  it('el motor genera el diseño y el validador lo aprueba', () => {
    assert.equal(design.success, true)
    assert.equal(validateDesign(design).status, 'VALIDADO')
  })
  it('PUERTA FALSA exterior: cara frontal en z = D, nada dentro del vano interior', () => {
    const f = one(design, 'PORTA-FALSA')
    assert.equal(f.z + f.thickness / 2, 520, 'cara exterior a ras del frente (D)')
    assert.equal(f.z - f.thickness / 2, 520 - T, 'su cara trasera apoya sobre el frente de la carcasa, no entra')
    assert.equal(f.width, 800 - 2 * T - 6, '★ 2026-10-12: retranqueada entre laterales (W−2T−6)')
    assert.ok(f.width <= 800 - 2 * T, 'retranqueada: NO cubre los cantos de los laterales')
  })
  it('holgura vertical: arranca 2mm sobre el zócalo (DOOR_GAP_H/2) y termina en la cara inferior de la repisa', () => {
    const f = one(design, 'PORTA-FALSA'), s = one(design, 'REPISA-HORNO')
    assert.equal(HARDWARE.DOOR_GAP_H, 4)
    assert.equal(f.y - f.height / 2, 120 + HARDWARE.DOOR_GAP_H / 2)
    assert.equal(f.y + f.height / 2, s.y - T / 2)
  })
  it('zócalo de 120 sincronizado: el piso apoya sobre él y el zócalo va retranqueado', () => {
    for (const r of [...byPrefix(design, 'RODAPIE-')]) assert.equal(r.height, 120)
    assert.equal(one(design, 'BASE-').y - T / 2, 120)
    assert.ok(one(design, 'RODAPIE-FRONTAL').z + T / 2 < 520 - 50, 'zócalo retrasado respecto del frente')
  })
  it('NICHO COMERCIAL 600mm exactos entre la cara superior de la repisa y la cara inferior del travesaño', () => {
    const s = one(design, 'REPISA-HORNO'), tie = one(design, 'TRAV-F')
    const nicheTop = tie.y - tie.height / 2, nicheBottom = s.y + T / 2
    assert.equal(nicheTop - nicheBottom, 600)
  })
  it('suma vertical exacta de la altura estructural neta (900 − 120 = 780)', () => {
    const f = one(design, 'PORTA-FALSA'), s = one(design, 'REPISA-HORNO'), tie = one(design, 'TRAV-F')
    const stack = T /*piso*/ + (s.y - T / 2 - (120 + T)) /*franja bajo repisa*/ + T /*repisa*/ + 600 + tie.height
    assert.equal(stack, 900 - 120)
    assert.ok(f.height > 0)
  })
  it('una sola repisa (la estructural del horno), una puerta fija y declara ancho libre del nicho', () => {
    assert.equal(byPrefix(design, 'REPISA').length, 1)
    assert.equal(byPrefix(design, 'PORTA-0').length, 0)
    const w = design.specAdjustments.find(a => a.code === 'OVEN_NICHE_WIDTH')
    assert.ok(w && w.clearWidth >= 560)
  })
  it('módulo demasiado angosto avisa OVEN_NARROW (el horno no entra)', () => {
    const d = generateProject({ moduleType: 'base', width: 560, height: 900, depth: 520, hasDoors: true, ovenPanel: true })
    assert.ok(d.specAdjustments.some(a => a.code === 'OVEN_NARROW'))
  })
})

describe('Contrato — tipologías y alias de horno que emite el LLM', () => {
  const base = { width: 800, height: 900, depth: 520 }
  for (const extra of [
    { moduleType: 'base', subType: 'oven_cavity' },
    { moduleType: 'oven' }, { moduleType: 'oven_cavity' }, { moduleType: 'horno' },
    { type: 'oven_cavity' }, { moduleType: 'base', hasFalseDoor: true }, { moduleType: 'base', frenteCiego: true },
  ]) {
    it(`${JSON.stringify(extra)} → base + ovenPanel (antes: clóset sin horno)`, () => {
      const { params } = coerceEngineParams({ ...base, ...extra })
      assert.equal(params.moduleType, 'base'); assert.equal(params.ovenPanel, true)
      assert.equal(generateProject(params).success, true)
    })
  }
  it('un ovenPanel:false explícito manda sobre la tipología', () => {
    assert.equal(coerceEngineParams({ ...base, moduleType: 'oven', ovenPanel: false }).params.ovenPanel, false)
  })
  it('zócalo en cm crudos (12 → 120mm, con aviso) y alias plinthHeight; 120 queda intacto', () => {
    const a = coerceEngineParams({ ...base, moduleType: 'base', baseboardHeight: 12 })
    assert.equal(a.params.baseboardHeight, 120)
    assert.ok(a.specAdjustments.some(x => x.code === 'NLP_UNIT_INFERRED' && x.field === 'baseboardHeight'))
    assert.equal(coerceEngineParams({ ...base, moduleType: 'base', plinthHeight: 12 }).params.baseboardHeight, 120)
    assert.equal(coerceEngineParams({ ...base, moduleType: 'base', baseboardHeight: 120 }).params.baseboardHeight, 120)
  })
  it('un módulo normal sin horno no se ve afectado', () => {
    const { params } = coerceEngineParams({ ...base, moduleType: 'base' })
    assert.equal(params.ovenPanel, undefined)
  })
})
