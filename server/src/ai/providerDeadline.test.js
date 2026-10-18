/**
 * Orbin AI — CANDADO: deadline por proveedor en la cascada de IA
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PROTEGE (y por qué costó caro):
 *
 *   El fallback de aiOrchestrator sólo se disparaba ante un ERROR explícito.
 *   Un proveedor que CUELGA (socket sin respuesta, DNS blackhole, corte de red,
 *   proveedor caído que acepta la conexión y no contesta) no es un error: es
 *   una promesa que nunca resuelve. Sin deadline, la cascada quedaba detenida
 *   en el primer proveedor, el piso regex local NUNCA se alcanzaba, y la
 *   petición Express quedaba tomada indefinidamente.
 *
 *   Se reprodujo el 2026-08-02: `node --test chatDesign.e2e.test.js` colgaba
 *   para siempre porque geminiClient usa fetch() SIN AbortSignal.
 *
 * INVARIANTE: chatDesign() y parseDesignIntent() SIEMPRE devuelven, aunque
 * todos los proveedores cuelguen. El peor caso es el fallback regex local.
 *
 * NOTA DE DISEÑO: se muta el export del cliente ANTES de require(aiOrchestrator)
 * porque PROVIDER_CHAIN guarda la referencia al objeto del módulo. No hay
 * try/catch de conveniencia: si este test no puede montarse, DEBE fallar.
 */
process.env.NODE_ENV = 'test'

// Cascada vacía por construcción: '' (no delete) para que dotenv no la repueble.
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) {
  process.env[k] = ''
}
// Deadline corto: el test mide comportamiento, no paciencia.
process.env.AI_PROVIDER_TIMEOUT_MS = '300'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

// Proveedor que cuelga para siempre — el escenario exacto que rompía la cadena.
const NEVER = () => new Promise(() => {})

const geminiClient = require('./geminiClient')
assert.equal(typeof geminiClient.chatDesign, 'function',
  'geminiClient.chatDesign debe existir: si cambió el nombre, este candado quedó ciego')

geminiClient.chatDesign = NEVER
geminiClient.parseDesignIntent = NEVER

const { chatDesign, parseDesignIntent } = require('./aiOrchestrator')

const DEADLINE_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS)
const PROVIDERS = 2                      // gemini · openrouter (ollama retirado 2026-10-18)
const CEILING_MS = DEADLINE_MS * PROVIDERS + 2000   // margen de CI lento

describe('Cascada de IA — deadline por proveedor', () => {
  it('chatDesign DEVUELVE aunque los proveedores cuelguen (no espera para siempre)', async () => {
    const t0 = Date.now()
    const res = await chatDesign([], 'quiero un placard de 2000 x 2200')
    const elapsed = Date.now() - t0

    assert.ok(res, 'debe devolver una respuesta, no colgarse')
    assert.equal(typeof res.message, 'string')
    assert.ok(res.message.length > 0, 'el usuario nunca debe recibir un mensaje vacío')
    assert.ok(elapsed < CEILING_MS,
      `tardó ${elapsed}ms (techo ${CEILING_MS}ms): el deadline por proveedor no se está aplicando`)
  })

  it('el piso regex local ES alcanzable cuando la cadena cuelga entera', async () => {
    const res = await chatDesign([], 'placard de 1800 de ancho y 2100 de alto')
    assert.equal(res.source, 'regex-fallback',
      'con todos los proveedores colgados la fuente DEBE ser el parser local')
    assert.ok(res.params, 'el fallback local debe entregar params usables')
  })

  it('parseDesignIntent tampoco se cuelga y respeta el contrato de params', async () => {
    // Frase con marcadores explícitos ("de ancho"/"de alto"): es lo que el
    // parser OFFLINE sabe resolver. Ver nota al pie sobre el formato "2000 x 2200".
    const t0 = Date.now()
    const res = await parseDesignIntent('placard de 2000mm de ancho y 2200mm de alto')
    const elapsed = Date.now() - t0

    assert.ok(res && res.params, 'debe devolver params del piso local')
    assert.equal(res.params.width, 2000)
    assert.equal(res.params.height, 2200)
    assert.ok(elapsed < CEILING_MS,
      `tardó ${elapsed}ms (techo ${CEILING_MS}ms): falta deadline en parseDesignIntent`)
  })
})

// ── DEUDA DETECTADA 2026-08-02 (no se arregla acá: decisión de producto) ─────
// El parser offline NO entiende el formato dimensional desnudo "2000 x 2200":
// cae a los defaults (2400x2400) EN SILENCIO, sin specAdjustment que avise.
// Con la IA caída, un pedido de 2000x2200 devuelve un mueble de 2400x2400 y el
// usuario no se entera. Dos salidas posibles, ambas necesitan decisión:
//   (a) enseñarle al parser el patrón "<n> x <n>" (ancho x alto), o
//   (b) emitir un specAdjustment de baja confianza cuando se usan defaults
//       habiendo números sin interpretar en el texto.
// (b) es más barato y más honesto; (a) sin (b) sólo mueve el silencio de lugar.
describe('Formato dimensional desnudo — deuda conocida del parser offline', () => {
  it('documenta que "2000 x 2200" NO se interpreta offline (cae a defaults)', async () => {
    const res = await parseDesignIntent('placard 2000 x 2200')
    assert.equal(res.params.width, 2400,
      'Si esto falla, ALGUIEN ARREGLÓ EL PARSER: borrá este test y la nota de deuda de arriba.')
    assert.equal(res.params.height, 2400)
  })
})
