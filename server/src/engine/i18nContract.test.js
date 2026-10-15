/**
 * Orbin AI — CONTRATO DE i18n (★ ADITIVO 2026-07-26)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  LA REGLA: todo texto que ve el usuario se emite con un CÓDIGO estable y se
 *  traduce en el cliente. Si agregás un código nuevo, agregás su traducción — o
 *  lo declarás fuera de alcance EXPLÍCITAMENTE acá abajo, con motivo.
 *  No hay tercera opción: este test falla.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * POR QUÉ ESTE ARCHIVO EXISTE — tres veces en una misma sesión se descubrió texto en
 * español dentro de una hoja en inglés, y ninguna la detectó un test:
 *   1. Nombres de pieza ("Tampo Escritorio" en un plano EN).
 *   2. Observaciones del plano: el fallback devolvía el español, así que la falta de
 *      traducción era INVISIBLE — 3 de cada 5 avisos caían al español en silencio.
 *   3. Errores de API: `ResultPanel` mostraba el string del backend tal cual.
 *
 * POR QUÉ ES ESTÁTICO Y NO DE RUNTIME. Los tests de cobertura previos generan muebles
 * y miran qué avisos salen — sólo ven códigos que se DISPARAN. Un código nuevo que
 * requiere una condición rara (o una ruta de error) nunca aparecería. Este test lee el
 * CÓDIGO FUENTE: detecta el código el día que alguien lo escribe, sin necesidad de
 * provocarlo. Es la diferencia entre "cubrimos lo que probamos" y "cubrimos lo que hay".
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { bundleClientEngine } = require('./clientBundle.helper')

const SERVER_SRC = path.resolve(__dirname, '..')

let knownAdjustmentCodes = null
let knownApiCodes = null

before(() => {
  const am = bundleClientEngine('adjustmentMessages.js')
  // El diccionario no exporta sus claves: se leen del fuente, que es la fuente de verdad.
  const amSrc = fs.readFileSync(
    path.resolve(__dirname, '../../../client/src/engine/adjustmentMessages.js'), 'utf8')
  knownAdjustmentCodes = new Set([...amSrc.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*\[/gm)].map(m => m[1]))
  assert.ok(knownAdjustmentCodes.size > 5, 'no se pudieron leer las claves del diccionario de avisos')
  assert.ok(typeof am.localizeAdjustment === 'function')

  knownApiCodes = new Set(bundleClientEngine('apiErrors.js').knownApiErrorCodes())
})

/** Archivos que alimentan `specAdjustments` — lo que termina en OBSERVACIONES del plano. */
const ADJUSTMENT_SOURCES = [
  'engine/closetEngine.js',
  'engine/nlParser.js',
  'ai/paramContract.js',
]

/** Rutas HTTP cuyo `code` viaja al cliente dentro de una respuesta de error. */
// [2026-08-02] Se suma middleware/planLimits.js: emite PLAN_LIMIT_REACHED en un
// 403 que el usuario VE. El escaneo miraba sólo routes/, así que un código nuevo
// nacido en un middleware entraba en producción sin traducción y sin que nada
// fallara. Los middlewares que responden al cliente son superficie user-facing.
const API_ERROR_SOURCES = ['routes/design.js', 'middleware/planLimits.js']

/**
 * Códigos DELIBERADAMENTE fuera de alcance. Agregar acá exige escribir el motivo:
 * es una decisión consciente y auditable, no un olvido silencioso.
 */
const OUT_OF_SCOPE = {
  // routes/stressTest.js — ruta interna de QA/stress. Sus `preflightWarnings` no se
  // muestran a clientes ni viajan a un plano; son diagnóstico para el equipo.
  NEGATIVE_DIMENSION:  'stressTest: diagnóstico interno de QA, no user-facing',
  ZERO_DIVISION_RISK:  'stressTest: diagnóstico interno de QA, no user-facing',
  NANO_DIMENSIONS:     'stressTest: diagnóstico interno de QA, no user-facing',
  GIGANTIC_DIMENSIONS: 'stressTest: diagnóstico interno de QA, no user-facing',
  BASEBOARD_OVERFLOW:  'stressTest: diagnóstico interno de QA, no user-facing',
  DIVIDERS_OVERFLOW:   'stressTest: diagnóstico interno de QA, no user-facing',
  EXTREME_SPAN:        'stressTest: diagnóstico interno de QA, no user-facing',
  
  // furnitureMathSpecs.js — funciones puras del drawerSystem: errores en cálculos internos
  DRAWER_NO_HEIGHT:     'drawerSystem: función pura de validación matemática, error interno sin i18n',
  DRAWER_REST_TOO_SHORT:'drawerSystem: función pura de validación matemática, error interno sin i18n',
  DRAWER_HEIGHTS_EXCEED:'drawerSystem: función pura de validación matemática, error interno sin i18n',
  DRAWER_TOO_WIDE:      'drawerSystem: función pura de validación matemática, error interno sin i18n',
  

}

function codesIn(relPaths) {
  const found = new Map()   // code → archivo donde aparece
  for (const rel of relPaths) {
    const file = path.join(SERVER_SRC, rel)
    if (!fs.existsSync(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    for (const m of src.matchAll(/code:\s*'([A-Z][A-Z0-9_]+)'/g)) {
      if (!found.has(m[1])) found.set(m[1], rel)
    }
  }
  return found
}

describe('Contrato de i18n — OBSERVACIONES del plano', () => {
  it('todo código de specAdjustments en el fuente tiene traducción', () => {
    const found = codesIn(ADJUSTMENT_SOURCES)
    assert.ok(found.size > 5, `esperaba varios códigos, encontré ${found.size}`)
    const missing = [...found.entries()]
      .filter(([code]) => !knownAdjustmentCodes.has(code) && !OUT_OF_SCOPE[code])
      .map(([code, file]) => `${code} (${file})`)
    assert.deepEqual(missing, [],
      'Códigos SIN traducción en client/src/engine/adjustmentMessages.js:\n  ' +
      missing.join('\n  ') +
      '\n\nAgregá su plantilla ES/PT/EN, o declaralo en OUT_OF_SCOPE con el motivo.')
  })
})

describe('Contrato de i18n — ERRORES DE API', () => {
  it('todo código de error de ruta tiene traducción', () => {
    const found = codesIn(API_ERROR_SOURCES)
    const missing = [...found.entries()]
      .filter(([code]) => !knownApiCodes.has(code) && !OUT_OF_SCOPE[code])
      .map(([code, file]) => `${code} (${file})`)
    assert.deepEqual(missing, [],
      'Códigos de error SIN traducción en client/src/engine/apiErrors.js:\n  ' +
      missing.join('\n  ') +
      '\n\nAgregá su entrada ES/PT/EN, o declaralo en OUT_OF_SCOPE con el motivo.')
  })

  it('el cliente NO descarta el código del backend', () => {
    // Regresión: api/client.js pisaba `code` con 'SERVER' y perdía el código de dominio,
    // dejando al cliente sin forma de traducir el error.
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/api/client.js'), 'utf8')
    assert.ok(/serverCode:\s*data\?\.code/.test(src),
      'api/client.js debe preservar el código del backend en ApiError.serverCode')
  })
})

describe('Contrato de i18n — disciplina de la regla', () => {
  it('cada excepción de OUT_OF_SCOPE tiene un motivo escrito', () => {
    for (const [code, reason] of Object.entries(OUT_OF_SCOPE)) {
      assert.ok(typeof reason === 'string' && reason.trim().length > 12,
        `${code} está fuera de alcance sin un motivo entendible`)
    }
  })

  it('OUT_OF_SCOPE no oculta códigos que SÍ llegan al usuario', () => {
    // Si un código declarado fuera de alcance aparece en un archivo de specAdjustments
    // o en una ruta de error, la excusa ya no aplica: sí es user-facing.
    const userFacing = new Map([...codesIn(ADJUSTMENT_SOURCES), ...codesIn(API_ERROR_SOURCES)])
    const wrong = Object.keys(OUT_OF_SCOPE).filter(c => userFacing.has(c))
    assert.deepEqual(wrong, [],
      `Estos códigos están en OUT_OF_SCOPE pero SÍ son user-facing: ${wrong.join(', ')}`)
  })

  it('los tres diccionarios de i18n existen y exportan su API', () => {
    // Candado estructural: si alguien borra o renombra un diccionario, esto avisa.
    const pn = bundleClientEngine('pieceNames.js')
    assert.equal(typeof pn.localizePieceName, 'function')
    assert.equal(typeof bundleClientEngine('adjustmentMessages.js').localizeAdjustment, 'function')
    assert.equal(typeof bundleClientEngine('apiErrors.js').localizeApiError, 'function')
  })
})
