/**
 * Orbin AI — CANDADO: copia del MURO DE UPGRADE traducida ES/PT/EN (★ bucle 006)
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ──────────────────────────
 * El commit `a152af8` cableó el 403 `PLAN_LIMIT_REACHED` al modal `UpgradePrompt` y
 * escribió la copia como PROSA EN ESPAÑOL dentro del JSX, en tres archivos distintos.
 * Todo pasó: 265/265 tests en verde y build limpio. Nada podía detectarlo, porque
 * `i18nContract.test.js` escanea `routes/` y `middleware/` buscando `code:` sin
 * traducción — prosa hardcodeada en componentes del cliente cae fuera de su radar.
 *
 * El defecto no era cosmético. El idioma por defecto de la app es **PT**
 * (`client/src/context/PreferencesContext.jsx:5`, mercado primario Brasil), así que un
 * usuario brasileño que agotaba su cuota veía un modal con el título y el cuerpo en
 * español y el párrafo de fallback en portugués. Ocurría, además, en la ÚNICA pantalla
 * del producto cuyo propósito es cobrar.
 *
 * Este test cubre la superficie que el otro no ve: las plantillas del muro.
 *
 * QUÉ VERIFICA
 *   1. Toda clave de `PLAN_LIMIT_COPY` tiene las 3 traducciones, no vacías y DISTINTAS
 *      entre sí (una copia pegada de ES a PT pasa un test de "existe" pero deja al
 *      usuario en el idioma equivocado igual).
 *   2. Los placeholders `{x}` son idénticos en los 3 idiomas: si el PT olvida `{limit}`,
 *      el brasileño lee "Você usou 5/ solicitações".
 *   3. La interpolación reemplaza de verdad y un parámetro faltante queda VISIBLE
 *      (`{limit}` literal) en vez de imprimir "undefined" o desaparecer.
 *   4. `planAlertFrom()` sólo dispara con 403 + código correcto, y NO fabrica texto.
 *   5. `formatResetAt()` no vuelve a mentir sobre la zona horaria.
 *   6. Barrido estático: ningún componente del muro vuelve a hardcodear la copia.
 */

const { test, describe } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { bundleClientEngine } = require('./clientBundle.helper')

const CLIENT_SRC = path.resolve(__dirname, '../../../client/src')
const LANGS = ['ES', 'PT', 'EN']

// Falla ruidoso si no se puede compilar: un candado que no corre es peor que no tenerlo.
const api = bundleClientEngine('apiErrors.js')
const { localizePlanLimit, knownPlanLimitKeys, planAlertFrom, formatResetAt } = api

describe('Muro de upgrade · cobertura i18n de la copia', () => {
  test('el módulo expone la API esperada (si no, el resto del archivo miente)', () => {
    for (const fn of ['localizePlanLimit', 'knownPlanLimitKeys', 'planAlertFrom', 'formatResetAt']) {
      assert.equal(typeof api[fn], 'function', `apiErrors.js debe exportar ${fn}()`)
    }
    assert.ok(knownPlanLimitKeys().length >= 6, 'se esperaban al menos 6 claves de copy')
  })

  test('toda clave tiene ES/PT/EN, no vacías y distintas entre sí', () => {
    const problemas = []
    for (const key of knownPlanLimitKeys()) {
      const textos = LANGS.map(l => localizePlanLimit(key, l))
      LANGS.forEach((l, i) => {
        if (!textos[i] || !textos[i].trim() || textos[i] === key) {
          problemas.push(`${key} [${l}]: vacío o sin traducir`)
        }
      })
      // Una traducción idéntica al ES casi siempre es un copy/paste olvidado.
      if (textos[0] === textos[1]) problemas.push(`${key}: PT es idéntico al ES`)
      if (textos[0] === textos[2]) problemas.push(`${key}: EN es idéntico al ES`)
    }
    assert.deepEqual(problemas, [], 'Copia del muro sin traducir:\n  ' + problemas.join('\n  '))
  })

  test('los placeholders son los mismos en los 3 idiomas', () => {
    const ph = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',')
    for (const key of knownPlanLimitKeys()) {
      const [es, pt, en] = LANGS.map(l => localizePlanLimit(key, l))
      assert.equal(ph(pt), ph(es), `${key}: PT no tiene los mismos {placeholders} que ES`)
      assert.equal(ph(en), ph(es), `${key}: EN no tiene los mismos {placeholders} que ES`)
    }
  })

  test('interpola los valores del 403 en los 3 idiomas', () => {
    for (const lang of LANGS) {
      const out = localizePlanLimit('PLAN_LIMIT_BODY', lang, { used: 5, limit: 5 })
      assert.match(out, /5\/5/, `[${lang}] no interpoló used/limit: ${out}`)
      assert.doesNotMatch(out, /\{|\}/, `[${lang}] quedaron placeholders sin resolver: ${out}`)
    }
  })

  test('un parámetro faltante queda VISIBLE, no imprime "undefined"', () => {
    const out = localizePlanLimit('PLAN_LIMIT_BODY', 'PT', { used: 3 })
    assert.match(out, /\{limit\}/, 'el placeholder faltante debe quedar literal y visible')
    assert.doesNotMatch(out, /undefined/, 'nunca imprimir "undefined" en pantalla')
  })

  test('idioma desconocido cae a PT (default de la app), no a vacío', () => {
    const out = localizePlanLimit('PLAN_LIMIT_TITLE', 'fr-CA')
    assert.equal(out, localizePlanLimit('PLAN_LIMIT_TITLE', 'PT'))
  })

  test('normaliza variantes de locale (pt-BR, en_US)', () => {
    assert.equal(localizePlanLimit('PLAN_LIMIT_TITLE', 'pt-BR'), localizePlanLimit('PLAN_LIMIT_TITLE', 'PT'))
    assert.equal(localizePlanLimit('PLAN_LIMIT_TITLE', 'en_US'), localizePlanLimit('PLAN_LIMIT_TITLE', 'EN'))
  })
})

describe('planAlertFrom() · detección del 403 de cuota', () => {
  const err403 = {
    status: 403,
    serverCode: 'PLAN_LIMIT_REACHED',
    message: 'Alcanzaste el límite…',
    details: { plan: 'free', used: 5, limit: 5, resetAt: '2026-08-03T00:00:00.000Z' },
  }

  test('dispara con 403 + código correcto y transporta los datos del backend', () => {
    const alert = planAlertFrom(err403, 'FEATURE_AI_GENERATION')
    assert.ok(alert, 'debía disparar')
    assert.equal(alert.code, 'PLAN_LIMIT_REACHED')
    assert.equal(alert.featureCode, 'FEATURE_AI_GENERATION')
    assert.equal(alert.used, 5)
    assert.equal(alert.limit, 5)
    assert.equal(alert.resetAt, '2026-08-03T00:00:00.000Z')
  })

  test('acepta el código por details.code (respuesta cruda, sin ApiError)', () => {
    const alert = planAlertFrom(
      { status: 403, details: { code: 'PLAN_LIMIT_REACHED', used: 5, limit: 5 } },
      'FEATURE_AI_CHAT'
    )
    assert.ok(alert, 'debía disparar con details.code')
    assert.equal(alert.featureCode, 'FEATURE_AI_CHAT')
  })

  test('NO dispara con otros errores (403 ajeno, 500, red caída, null)', () => {
    assert.equal(planAlertFrom({ status: 403, serverCode: 'NOT_VIABLE' }, 'X'), null)
    assert.equal(planAlertFrom({ status: 500, serverCode: 'PLAN_LIMIT_REACHED' }, 'X'), null)
    assert.equal(planAlertFrom({ code: 'NETWORK', message: 'sin red' }, 'X'), null)
    assert.equal(planAlertFrom(null, 'X'), null)
    assert.equal(planAlertFrom(undefined, 'X'), null)
  })

  test('NO fabrica texto: sólo transporta código y datos', () => {
    const alert = planAlertFrom(err403, 'FEATURE_AI_GENERATION')
    // `message` es el fallback del backend, intacto. Cualquier OTRA prosa acá
    // significaría que la capa de transporte volvió a decidir qué lee el usuario.
    assert.equal(alert.message, err403.message)
    assert.equal(alert.description, undefined, 'planAlertFrom no debe componer descripciones')
  })
})

describe('formatResetAt() · la etiqueta de zona no debe mentir', () => {
  test('devuelve null ante entradas inválidas (el modal omite la línea)', () => {
    assert.equal(formatResetAt(null, 'PT'), null)
    assert.equal(formatResetAt('no-es-una-fecha', 'PT'), null)
  })

  test('formatea una fecha válida y NO rotula "UTC" sobre una hora local', () => {
    const out = formatResetAt('2026-08-03T00:00:00.000Z', 'PT')
    assert.ok(out && out.length > 0, 'debía formatear la fecha')
    // El bug original: toLocaleTimeString() (hora LOCAL) + la cadena fija "UTC".
    // Sólo puede decir UTC si el entorno realmente está en UTC.
    const enUTC = new Date().getTimezoneOffset() === 0
    if (!enUTC) {
      assert.doesNotMatch(out, /\bUTC\b/,
        'no se puede rotular "UTC" una hora renderizada en la zona local del navegador')
    }
  })
})

describe('Barrido estático · la copia del muro no vuelve al JSX', () => {
  // Archivos que participan del muro. Si aparece uno nuevo, agregalo acá.
  const SUPERFICIE = [
    'App.jsx',
    'components/UpgradePrompt.jsx',
    'components/ImageToParametricPanel.jsx',
  ]

  // Frases exactas que el bucle 006 sacó del JSX. Que vuelva cualquiera de ellas
  // significa que alguien volvió a escribir copia a mano en vez de usar el diccionario.
  const PROHIBIDAS = [
    'Límite de Cuota Alcanzado',
    'solicitudes diarias de IA',
    'solicitudes de IA por día',
    'Tu cuota se reinicia a las',
    'Cuota diaria de IA alcanzada',
    'Generación con IA',
    'Chat de IA',
    'IA Visión',
  ]

  test('ningún componente del muro contiene la copia hardcodeada', () => {
    const hallazgos = []
    for (const rel of SUPERFICIE) {
      const file = path.join(CLIENT_SRC, rel)
      assert.ok(fs.existsSync(file), `No existe ${rel}. ¿Se renombró? Actualizá SUPERFICIE.`)
      const src = fs.readFileSync(file, 'utf8')
      for (const frase of PROHIBIDAS) {
        if (src.includes(frase)) hallazgos.push(`${rel}: "${frase}"`)
      }
    }
    assert.deepEqual(
      hallazgos, [],
      'Copia del muro hardcodeada en JSX (usá localizePlanLimit + un code):\n  ' + hallazgos.join('\n  ')
    )
  })

  test('los call sites usan planAlertFrom() y no reimplementan la detección', () => {
    const faltan = []
    for (const rel of ['App.jsx', 'components/ImageToParametricPanel.jsx']) {
      const src = fs.readFileSync(path.join(CLIENT_SRC, rel), 'utf8')
      if (!src.includes('planAlertFrom')) faltan.push(rel)
      // La condición cruda repetida a mano es justo lo que se centralizó.
      if (/err\.status\s*===\s*403\s*&&/.test(src)) {
        faltan.push(`${rel}: detección del 403 reimplementada a mano`)
      }
    }
    assert.deepEqual(faltan, [], 'Call sites fuera del helper central:\n  ' + faltan.join('\n  '))
  })

  test('UpgradePrompt traduce por código (importa el diccionario y lee el idioma)', () => {
    const src = fs.readFileSync(path.join(CLIENT_SRC, 'components/UpgradePrompt.jsx'), 'utf8')
    assert.match(src, /localizePlanLimit/, 'debe traducir por código')
    assert.match(src, /usePreferences/, 'debe leer el idioma vigente del contexto')
    assert.match(src, /formatResetAt/, 'debe formatear resetAt con el helper, no a mano')
  })
})
