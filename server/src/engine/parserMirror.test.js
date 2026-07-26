/**
 * Orbin AI — Paridad ONLINE ↔ OFFLINE del parser NL (ADITIVO 2026-07-26).
 *
 * `server/src/engine/nlParser.js` y `client/src/engine/offlineParser.js` son ESPEJOS,
 * pero nada en el código lo obliga: son dos archivos, en dos runtimes distintos
 * (CommonJS / ESM), que hay que acordarse de tocar juntos. Ya divergieron una vez.
 *
 * Este archivo es el candado. Compila el parser del CLIENTE con esbuild y compara su
 * clasificación contra la del SERVIDOR sobre el mismo texto.
 *
 * CANDADO PRINCIPAL: hasta el 2026-07-26 NINGÚN parser reconocía el escritorio. Toda la
 * topología desk (faldón, pedestal, travesaño de privacidad) sólo era alcanzable vía
 * LLM → con Gemini caído o en modo offline, el producto no sabía hacer escritorios.
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { parseNaturalLanguage: parseServer } = require('./nlParser')
const { bundleClientEngine } = require('./clientBundle.helper')

let parseClient = null

// ★ 2026-07-26 (corregido) — la versión anterior atrapaba el error de esbuild y cada
//   test de paridad hacía `return`: el archivo reportaba "27 pass" mientras la
//   comparación online↔offline —su motivo entero de existir— NUNCA se ejecutaba.
//   esbuild vive en client/node_modules y no resolvía desde server/. Ahora el fallo es
//   ruidoso: un candado que pasa sin correr da confianza sin dar cobertura.
before(() => {
  parseClient = bundleClientEngine('offlineParser.js').parseNaturalLanguage
})

// Frases donde AMBOS parsers deben coincidir en la clasificación de tipo.
const TYPE_CASES = [
  ['escritorio 1400x750x600 con 3 gavetas', 'desk'],
  ['quiero un escritorio', 'desk'],
  ['escrivaninha 1200 de largura', 'desk'],
  ['mesa de trabajo con 2 gavetas', 'desk'],
  // ⚠ PT-BR: "escritório" es la OFICINA, no el mueble → NO debe dar desk.
  ['armario para escritorio 2000 de alto', 'standard'],
  ['guarda-roupa de escritorio', 'standard'],
  ['ropero 1200x2000x600', 'standard'],
  ['mueble bajo de cocina', 'base'],
  ['isla 2000 de ancho', 'base'],
]

describe('Parser NL — el escritorio es alcanzable sin LLM', () => {
  for (const [text, expected] of TYPE_CASES) {
    it(`servidor: "${text}" → ${expected}`, () => {
      assert.equal(parseServer(text).params.moduleType, expected)
    })
  }

  it('servidor: el escritorio no lleva puertas ni zócalo (vano de piernas abierto)', () => {
    const p = parseServer('escritorio 1400x750x600').params
    assert.equal(p.moduleType, 'desk')
    assert.equal(p.hasDoors, false)
    assert.equal(p.baseboard, false)
  })

  it('servidor: una medida explícita gana sobre el default del tipo', () => {
    // Misma regla que protege al aéreo desde el FIX 2026-07-23.
    assert.equal(parseServer('escritorio 1800mm de ancho').params.width, 1800)
  })

  // ★ CANDADO: un escritorio sin gavetas construía el pedestal IGUAL → Costado + Base +
  //   Fondo Pedestal formando una caja abierta vacía. 3 piezas de MDF para cero función.
  it('sin dato de gavetas → 3 (pedestal estándar), no un pedestal vacío', () => {
    const p = parseServer('quiero un escritorio').params
    assert.equal(p.moduleType, 'desk')
    assert.equal(p.numDrawers, 3)
  })

  it('"sin gavetas" explícito → se saca el pedestal entero (patas + faldón)', () => {
    for (const t of ['escritorio sin gavetas', 'escrivaninha sem gavetas', 'desk without drawers']) {
      const p = parseServer(t).params
      assert.equal(p.moduleType, 'desk', `"${t}" no se clasificó como desk`)
      assert.equal(p.numDrawers, 0, `"${t}" debería quedar sin gavetas`)
      assert.equal(p.hasPedestal, false, `"${t}" no debe construir un pedestal vacío`)
    }
  })

  it('un conteo explícito NO lo pisa el default', () => {
    assert.equal(parseServer('escritorio con 2 gavetas').params.numDrawers, 2)
  })
})

describe('Parser NL — paridad online ↔ offline', () => {
  it('el parser del cliente compila', () => {

    assert.ok(typeof parseClient === 'function', 'el parser del cliente no se pudo compilar')
  })

  for (const [text, expected] of TYPE_CASES) {
    it(`mismo tipo en ambos: "${text}" → ${expected}`, () => {
      const s = parseServer(text).params.moduleType
      const c = parseClient(text).params.moduleType
      assert.equal(s, expected, `servidor clasificó ${s}`)
      assert.equal(c, expected, `cliente clasificó ${c} (DIVERGENCIA con el servidor)`)
    })
  }

  it('mismo mountHeight en ambos', () => {

    for (const t of ['aereo suspendido a 1400mm', 'aereo colgado a 1.20 del piso', 'aereo a 145 del piso']) {
      assert.equal(parseServer(t).params.mountHeight, parseClient(t).params.mountHeight, `divergen en "${t}"`)
    }
  })

  it('misma resolución de unidades ambiguas en ambos', () => {

    for (const t of ['mueble de 900 de alto', 'mueble de 90 de alto', 'ropero 2.4 de alto']) {
      assert.equal(parseServer(t).params.height, parseClient(t).params.height, `divergen en "${t}"`)
    }
  })

  it('mismos defaults de gavetas del escritorio en ambos', () => {

    for (const t of ['quiero un escritorio', 'escritorio sin gavetas', 'escritorio con 2 gavetas']) {
      const s = parseServer(t).params, c = parseClient(t).params
      assert.equal(s.numDrawers, c.numDrawers, `numDrawers divergen en "${t}"`)
      assert.equal(!!s.hasPedestal, !!c.hasPedestal, `hasPedestal divergen en "${t}"`)
    }
  })
})
