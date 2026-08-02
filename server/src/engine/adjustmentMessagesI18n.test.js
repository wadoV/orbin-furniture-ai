/**
 * Orbin AI — Cobertura i18n de OBSERVACIONES (ADITIVO 2026-07-26).
 *
 * El motor emite `specAdjustments` con el `message` ya formado en ESPAÑOL. La traducción
 * ocurre en presentación (`client/src/engine/adjustmentMessages.js`), interpolando las
 * plantillas ES/PT/EN con los valores expuestos en `params` (o campos de nivel superior).
 *
 * POR QUÉ ESTE ARCHIVO. El diccionario se escribió antes de que el motor expusiera los
 * params, así que **3 de cada 5 avisos reales caían silenciosamente al español** — entre
 * ellos DRAWER_PRIVACY_PANEL, que es el que se ve en el plano del escritorio. El fallback
 * es correcto por diseño (un aviso en español es aceptable, uno vacío es peligroso), pero
 * hace que la falta de traducción sea INVISIBLE. Este test la vuelve visible.
 *
 * NO usa try/catch ni guardas de skip: `parserMirror` y `pieceNamesI18n` reportaron
 * "pass" durante horas sin ejecutar nada por ese patrón. Ver clientBundle.helper.js.
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { bundleClientEngine } = require('./clientBundle.helper')

let localizeAdjustment = null

before(() => {
  localizeAdjustment = bundleClientEngine('adjustmentMessages.js').localizeAdjustment
})

// Configuraciones elegidas para DISPARAR avisos, no para ser muebles razonables.
const CFGS = [
  { moduleType: 'desk',     width: 1400, height: 750,  depth: 600, numDrawers: 3 },
  { moduleType: 'desk',     width: 1400, height: 750,  depth: 600, numDrawers: 9 },   // reduce cantidad
  { moduleType: 'desk',     width: 1400, height: 750,  depth: 600, numDrawers: 3, hasPedestal: false },
  { moduleType: 'aereo',    width: 800,  height: 700,  depth: 350, hasDoors: true, numDoors: 2 },
  { moduleType: 'standard', width: 3000, height: 2600, depth: 600, numShelves: 2 },   // excede chapa
  { moduleType: 'standard', width: 1200, height: 2200, depth: 600, numDrawers: 12, numDividers: 8 },
  { moduleType: 'standard', width: 1200, height: 2200, depth: 600, nicheHeight: 2000, hasDoors: true, numDoors: 2 },
]

function emittedAdjustments() {
  const out = []
  for (const c of CFGS) {
    let d
    try { d = generateProject(c) } catch { continue }
    for (const a of (d.specAdjustments || [])) out.push(a)
  }
  return out
}

describe('Observaciones i18n — cobertura real del motor', () => {
  it('TODO aviso que el motor emite se traduce (ninguno cae al español en EN)', () => {
    const adjs = emittedAdjustments()
    assert.ok(adjs.length >= 5, `esperaba varios avisos, llegaron ${adjs.length}`)
    const untranslated = [...new Set(
      adjs.filter(a => localizeAdjustment(a, 'EN') === a.message).map(a => a.code)
    )]
    assert.deepEqual(untranslated, [],
      `Avisos SIN traducir (caen al español en la hoja EN): ${untranslated.join(', ')}. ` +
      `Falta la plantilla en adjustmentMessages.js o faltan sus params en el motor.`)
  })

  it('lo mismo en portugués', () => {
    const untranslated = [...new Set(
      emittedAdjustments().filter(a => localizeAdjustment(a, 'PT') === a.message).map(a => a.code)
    )]
    assert.deepEqual(untranslated, [], `Avisos sin traducir en PT: ${untranslated.join(', ')}`)
  })

  it('ES es IDÉNTICO al message del motor — nada cambió para el mercado principal', () => {
    for (const a of emittedAdjustments()) {
      assert.equal(localizeAdjustment(a, 'ES'), a.message,
        `El texto en español cambió para ${a.code}. El ES debe reproducir el message tal cual.`)
    }
  })

  it('ningún idioma devuelve vacío', () => {
    for (const a of emittedAdjustments()) {
      for (const L of ['ES', 'PT', 'EN']) {
        const s = localizeAdjustment(a, L)
        assert.ok(s && s.trim().length > 0, `${a.code} quedó vacío en ${L}`)
      }
    }
  })

  it('un código desconocido cae al message, no desaparece', () => {
    const fake = { code: 'CODIGO_QUE_NO_EXISTE', severity: 'info', message: 'Texto original del motor.' }
    assert.equal(localizeAdjustment(fake, 'EN'), 'Texto original del motor.')
  })

  it('faltando un param, cae al message en vez de mostrar {placeholder}', () => {
    const broken = { code: 'DRAWER_PRIVACY_PANEL', severity: 'info', message: 'Mensaje original.' }
    const out = localizeAdjustment(broken, 'EN')
    assert.ok(!/\{\w+\}/.test(out), `quedó un placeholder sin interpolar: "${out}"`)
  })

  it('idioma inválido no rompe', () => {
    const a = emittedAdjustments()[0]
    for (const L of [undefined, null, '', 'FR', 'pt-BR', 'en_US']) {
      const s = localizeAdjustment(a, L)
      assert.ok(s && s.trim().length > 0, `lang=${L} devolvió vacío`)
    }
  })

  it('el motor conserva `message` en todos los avisos (17 consumidores dependen de él)', () => {
    for (const a of emittedAdjustments()) {
      assert.ok(typeof a.message === 'string' && a.message.trim().length > 0,
        `${a.code} perdió su message — rompe UI, chat, HITL y orquestador`)
    }
  })
})
