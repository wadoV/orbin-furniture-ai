/**
 * Orbin AI — Helper de tests: compila módulos del CLIENTE para probarlos desde el server.
 *
 * ★ 2026-07-26 — NACIÓ DE UN FALLO SILENCIOSO PROPIO.
 * `parserMirror.test.js` y `pieceNamesI18n.test.js` hacían `require('esbuild')` dentro de
 * un try/catch y, si fallaba, cada test hacía `return` → la suite reportaba **verde sin
 * haber ejecutado nada**. Y fallaba SIEMPRE: `esbuild` vive en `client/node_modules` y no
 * se resuelve desde `server/`. Durante horas esos candados dijeron "pass" sin correr.
 *
 * Un test que pasa cuando no puede ejecutarse es peor que no tener test: da confianza
 * sin dar cobertura. Por eso acá el fallo es RUIDOSO y con instrucción de arreglo.
 *
 * No es un archivo `.test.js` a propósito: `npm test` hace glob de `src/engine/*.test.js`
 * y no debe intentar ejecutarlo como suite.
 */
const path = require('node:path')
const { createRequire } = require('node:module')

const CLIENT_ROOT = path.resolve(__dirname, '../../../client')
const CLIENT_ENGINE = path.join(CLIENT_ROOT, 'src', 'engine')

let _esbuild = null

/** Resuelve esbuild desde client/node_modules (no está en server/). */
function getEsbuild() {
  if (_esbuild) return _esbuild
  const tried = []
  // 1) desde el package.json del cliente — el caso normal
  try {
    const req = createRequire(path.join(CLIENT_ROOT, 'package.json'))
    _esbuild = req('esbuild')
    return _esbuild
  } catch (e) { tried.push(`client/node_modules: ${e.code || e.message}`) }
  // 2) por si algún día se instala en el server o en la raíz
  try {
    _esbuild = require('esbuild')
    return _esbuild
  } catch (e) { tried.push(`server/node_modules: ${e.code || e.message}`) }

  throw new Error(
    'No se pudo cargar esbuild para compilar el código del cliente.\n' +
    '  Intentos: ' + tried.join(' · ') + '\n' +
    '  Estos tests verifican invariantes que CRUZAN la frontera cliente/servidor\n' +
    '  (paridad de parsers, diccionario de nombres de pieza). Sin esbuild no se pueden\n' +
    '  ejecutar, y saltarlos en silencio ya nos costó horas de falso verde.\n' +
    '  Arreglo:  cd client && npm install'
  )
}

/**
 * Compila un módulo ESM del cliente a CJS y devuelve sus exports.
 * @param {string} fileName  nombre dentro de client/src/engine (ej. 'pieceNames.js')
 */
function bundleClientEngine(fileName) {
  const esbuild = getEsbuild()
  const entry = path.join(CLIENT_ENGINE, fileName)
  const out = esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, format: 'cjs' })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, require)
  return mod.exports
}

module.exports = { getEsbuild, bundleClientEngine, CLIENT_ROOT, CLIENT_ENGINE }
