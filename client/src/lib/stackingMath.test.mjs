import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateStackingMountHeight,
  calculateAerialAlignment,
  findBaseForAerial,
  isAerialModule,
  isBaseModule,
  AERIAL_GAP_MM
} from './stackingMath.js'

test('stackingMath — calculateStackingMountHeight', async (t) => {
  await t.test('modo suspended (gap por defecto = 600mm sobre base de 900mm)', () => {
    const base = { configuration: { height: 900 } }
    const mount = calculateStackingMountHeight(base)
    assert.equal(mount, 1500) // 900 + 600
  })

  await t.test('modo direct (gap = 0mm sobre base de 900mm sin encimera)', () => {
    const base = { configuration: { height: 900, hasCountertop: false } }
    const mount = calculateStackingMountHeight(base, { mode: 'direct' })
    assert.equal(mount, 900) // 900 + 0
  })

  await t.test('modo direct con encimera (hasCountertop=true suma 25mm por defecto)', () => {
    const base = { configuration: { height: 900, hasCountertop: true } }
    const mount = calculateStackingMountHeight(base, { mode: 'direct' })
    assert.equal(mount, 925) // 900 + 25
  })

  await t.test('modo direct con encimera de espesor custom (ej: granito 30mm)', () => {
    const base = { configuration: { height: 900, hasCountertop: true, countertopThickness: 30 } }
    const mount = calculateStackingMountHeight(base, { mode: 'direct' })
    assert.equal(mount, 930) // 900 + 30
  })

  await t.test('modo suspended con gap custom (ej: 450mm mínimo sobre encimera)', () => {
    const base = { configuration: { height: 900, hasCountertop: true, countertopThickness: 20 } }
    const mount = calculateStackingMountHeight(base, { mode: 'suspended', gap: 450 })
    assert.equal(mount, 1370) // 900 + 20 + 450
  })
})

test('stackingMath — calculateAerialAlignment con stackingMode y gapAboveBase', async (t) => {
  await t.test('hereda ancho, X y calcula mountHeight direct', () => {
    const base = { id: 'BASE-01', configuration: { width: 800, height: 900, hasCountertop: false }, _centerXMM: 400 }
    const aerialCfg = { width: 600, height: 700, stackingMode: 'direct' }
    const aligned = calculateAerialAlignment(base, aerialCfg)

    assert.equal(aligned.width, 800)
    assert.equal(aligned._centerXMM, 400)
    assert.equal(aligned.mountHeight, 900) // directo sin gap
    assert.equal(aligned._stackedOnId, 'BASE-01')
  })

  await t.test('compatibilidad hacia atrás: sin stackingMode usa suspended con 600mm', () => {
    const base = { id: 'BASE-01', configuration: { width: 1000, height: 900 }, _centerXMM: 500 }
    const aerialCfg = { width: 600, height: 700 }
    const aligned = calculateAerialAlignment(base, aerialCfg)

    assert.equal(aligned.width, 1000)
    assert.equal(aligned._centerXMM, 500)
    assert.equal(aligned.mountHeight, 1500) // 900 + 600
  })

  await t.test('gapAboveBase explícito en aerialConfig', () => {
    const base = { id: 'BASE-01', configuration: { width: 1000, height: 900 }, _centerXMM: 500 }
    const aerialCfg = { width: 600, height: 700, gapAboveBase: 500 }
    const aligned = calculateAerialAlignment(base, aerialCfg)

    assert.equal(aligned.mountHeight, 1400) // 900 + 500
  })
})
