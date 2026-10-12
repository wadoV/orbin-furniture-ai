/**
 * Reglas de taller 2026-10-12: tamponado a ras de la puerta (Z) + COZINHA MASTER 2800.
 * Aditivo: los casos SIN tamponado o SIN puertas deben mantener la geometría histórica.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { generateProject } = require('./closetEngine')
const { coerceEngineParams } = require('../ai/paramContract')

const byPrefix = (d, p) => d.pieces.filter(x => String(x.id).startsWith(p))
const one = (d, p) => { const a = byPrefix(d, p); assert.equal(a.length, 1, p); return a[0] }
const doorFace = d => { const g = byPrefix(d, 'PORTA-')[0]; return g.z + g.thickness / 2 }
const tampFace = (d, p) => { const t = one(d, p); return t.z + t.width / 2 }  // width = profundidad en Z

describe('Tamponado lateral a ras de la cara exterior de la puerta (eje Z)', () => {
  it('base (overlay): tamponado y puerta terminan en la misma cara (= D)', () => {
    const d = generateProject({ moduleType: 'base', width: 900, height: 850, depth: 550, hasDoors: true, numDoors: 2, tamponado: 'both' })
    assert.equal(d.success, true)
    assert.equal(tampFace(d, 'TAMP-L'), doorFace(d))
    assert.equal(tampFace(d, 'TAMP-R'), doorFace(d))
    assert.equal(doorFace(d), 550)
  })
  it('aéreo (legacy): tamponado = D + espesor de puerta, a ras de la puerta', () => {
    const d = generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 320, thickness: 15, hasDoors: true, numDoors: 2, tamponado: 'both' })
    assert.equal(tampFace(d, 'TAMP-L'), doorFace(d))
    assert.equal(one(d, 'TAMP-L').width, 320 + 15)
  })
  it('sin puertas o sin tamponado: geometría histórica (profundidad = carcasa)', () => {
    const a = generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 320, hasDoors: false, tamponado: 'both' })
    assert.equal(one(a, 'TAMP-L').width, 320)
    const b = generateProject({ moduleType: 'aereo', width: 800, height: 700, depth: 320, hasDoors: true, numDoors: 2 })
    assert.equal(byPrefix(b, 'TAMP-').length, 0)
  })
})

describe('Aéreo con cava inferior (puxadorCavaAereo) — invariantes', () => {
  const d = generateProject({ moduleType: 'aereo', width: 1400, height: 750, depth: 320, thickness: 15, hasDoors: true, numDoors: 2,
    baseboard: false, backStyle: 'screwed', backThickness: 15, puxadorCavaAereo: true, cavaOverhang: 30, tamponadoInferior: true, tamponado: 'both' })
  it('puerta = H + 30 − 3 y nace 30mm bajo la base', () => {
    for (const p of byPrefix(d, 'PORTA-0')) { assert.equal(p.height, 750 + 30 - 3); assert.ok(Math.abs((p.y - p.height / 2) - -30) <= 1, 'borde inferior ≈ −30mm (redondeo de mm)') }
  })
  it('tamponados laterales de 780mm', () => { assert.equal(one(d, 'TAMP-L').height, 780); assert.equal(one(d, 'TAMP-R').height, 780) })
  it('tamponado inferior retranqueado 25mm en profundidad', () => {
    const t = one(d, 'TAMPON-INF')
    assert.ok(t.height <= 320 - 25 && t.height > 200, `profundidad retranqueada (${t.height}) ≤ 295`)
    assert.equal(t.thickness, 15)
  })
  it('cero zócalo y fondo atornillado de 15mm', () => {
    assert.equal(d.pieces.filter(p => p.type === 'baseboard').length, 0)
    assert.equal(d.configuration.backStyle, 'screwed')
    assert.equal(d.configuration.backThickness, 15)
  })
  it('el contrato conserva puxadorCavaAereo y cavaOverhang (no los descarta)', () => {
    const c = coerceEngineParams({ moduleType: 'aereo', puxadorCavaAereo: true, cavaOverhang: 30 })
    const out = c.params || c
    assert.equal(out.puxadorCavaAereo, true); assert.equal(out.cavaOverhang, 30)
  })
})

describe('Plantilla COZINHA MASTER GRANDE CAVA 2800 — engineParams generan módulos válidos', async () => {
  const url = pathToFileURL(path.join(__dirname, '../../../client/src/data/workshopTemplates.js')).href
  const { WORKSHOP_TEMPLATES } = await import(url)
  const tpl = WORKSHOP_TEMPLATES.find(t => t.id === 'wt-cozinha-master-2800')
  it('suma lineal 2800 en base y en aéreo', () => {
    const sum = t => tpl.engineParams.filter(p => p.moduleType === t).reduce((a, p) => a + p.width, 0)
    assert.equal(sum('base'), 2800); assert.equal(sum('aereo'), 2800)
  })
  for (const p of tpl.engineParams) {
    it(`${p.ref}: genera despiece sin error`, () => {
      const { ref, ...params } = p
      const d = generateProject(params)
      assert.equal(d.success, true, JSON.stringify(d.error || d.errors || ''))
      if (p.moduleType === 'aereo') {
        assert.equal(d.pieces.filter(x => x.type === 'baseboard').length, 0)
        assert.equal(byPrefix(d, 'PORTA-0')[0].height, 750 + 30 - 3)
        assert.equal(one(d, 'TAMP-' + (p.tamponado === 'left' ? 'L' : 'R')).height, 780)
      } else {
        assert.equal(d.configuration.thickness, 18)
      }
    })
  }
})
