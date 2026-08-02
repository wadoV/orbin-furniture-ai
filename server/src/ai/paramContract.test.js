/**
 * Orbin AI — Tests del contrato NLP → Paramétrico (ADITIVO 2026-07-20).
 * Runner: node:test (cero dependencias).
 */
// ── HERMETICIDAD (aditivo 2026-08-02) ───────────────────────────────────────
// El test "chatDesign nunca lanza (sin API keys)" AFIRMABA no tener claves,
// pero no las quitaba: vertexClient hace require('dotenv').config() al cargarse
// y repuebla server/.env. En toda máquina de dev el test salía a la red REAL
// contra Google en cada corrida (llamadas facturables + resultado dependiente
// de la conectividad). Tardaba 9,2 s; ahora corre offline en milisegundos.
// Asignar '' (no `delete`): dotenv sólo respeta las claves que ya existen.
for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) {
  process.env[k] = ''
}

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  ENGINE_PARAM_KEYS, coerceEngineParams, validateOrchestratorResponse, PARAM_CONTRACT_PROMPT,
} = require('./paramContract')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, buildOrbinChatPrompt } = require('./systemPrompts')
const orchestrator = require('./aiOrchestrator')

describe('coerceEngineParams — alias y tipos', () => {
  it('mapea W/H/D a width/height/depth', () => {
    const { params } = coerceEngineParams({ W: 2000, H: 2400, D: 600 })
    assert.equal(params.width, 2000)
    assert.equal(params.height, 2400)
    assert.equal(params.depth, 600)
  })

  it('mapea las divergencias históricas del prompt al motor', () => {
    const { params } = coerceEngineParams({ width: 1800, height: 2200, depth: 580, hasHangingArea: true, hasLED: true })
    assert.equal(params.hasHangingRod, true)
    assert.equal(params.hasLed, true)
    assert.equal(params.hasHangingArea, undefined)
  })

  it('convierte strings con unidad a mm enteros', () => {
    const { params } = coerceEngineParams({ width: '2.4m', height: '220cm', depth: '580mm' })
    assert.equal(params.width, 2400)
    assert.equal(params.height, 2200)
    assert.equal(params.depth, 580)
  })

  it('los contadores en string NO se escalan a mm (regresión: "4" ≠ 4000)', () => {
    const { params, specAdjustments } = coerceEngineParams({ width: 2400, height: 2200, depth: 580, numDrawers: '4', numShelves: '3' })
    assert.equal(params.numDrawers, 4)
    assert.equal(params.numShelves, 3)
    assert.equal(specAdjustments.filter(a => a.code === 'NLP_VALUE_CLAMPED').length, 0)
  })

  it('descarta llaves fuera de la whitelist', () => {
    const { params, dropped } = coerceEngineParams({ width: 1200, height: 900, depth: 580, colorFavorito: 'azul' })
    assert.equal(params.colorFavorito, undefined)
    assert.ok(dropped.includes('colorFavorito'))
  })

  it('solo emite llaves del contrato del motor', () => {
    const { params } = coerceEngineParams({ W: 1500, H: 2100, D: 500, numDrawers: 3, hasDoors: true })
    for (const k of Object.keys(params)) assert.ok(ENGINE_PARAM_KEYS.includes(k), `llave fuera de contrato: ${k}`)
  })
})

describe('coerceEngineParams — no alucinar dimensiones', () => {
  it('aplica defaults comerciales y los DECLARA en specAdjustments', () => {
    const { params, specAdjustments } = coerceEngineParams({ width: 2000 })
    assert.equal(params.height, 2200)
    assert.equal(params.depth, 580)
    const fields = specAdjustments.filter(a => a.code === 'ASSUMED_DEFAULT').map(a => a.field)
    assert.ok(fields.includes('height'))
    assert.ok(fields.includes('depth'))
  })

  it('defaults por moduleType: aereo → 700x350', () => {
    const { params } = coerceEngineParams({ moduleType: 'aereo', width: 1200 })
    assert.equal(params.height, 700)
    assert.equal(params.depth, 350)
  })

  it('cliente que especifica todo NO genera supuestos', () => {
    const { specAdjustments } = coerceEngineParams({ width: 2000, height: 2400, depth: 600 })
    assert.equal(specAdjustments.filter(a => a.code === 'ASSUMED_DEFAULT').length, 0)
  })

  it('clampa fuera de rango y lo registra', () => {
    const { params, specAdjustments } = coerceEngineParams({ width: 99000, height: 2200, depth: 580 })
    assert.equal(params.width, 6000)
    assert.ok(specAdjustments.some(a => a.code === 'NLP_VALUE_CLAMPED' && a.field === 'width'))
  })

  it('enum inválido no llega al motor', () => {
    const { params, specAdjustments } = coerceEngineParams({ width: 1200, height: 2200, depth: 580, doorType: 'magica' })
    assert.equal(params.doorType, undefined)
    assert.ok(specAdjustments.some(a => a.code === 'NLP_ENUM_INVALID'))
  })

  it('coherencia: hasDoors sin numDoors → asigna hojas por ancho y lo declara', () => {
    const { params, specAdjustments } = coerceEngineParams({ width: 1800, height: 2200, depth: 580, hasDoors: true })
    assert.equal(params.numDoors, 2)
    assert.ok(specAdjustments.some(a => a.field === 'numDoors'))
  })

  it('acepta payload anidado { params: {...} }', () => {
    const { params } = coerceEngineParams({ params: { W: 1000, H: 800, D: 350 }, confidence: 1 })
    assert.equal(params.width, 1000)
    assert.equal(params.confidence, undefined)
  })
})

describe('validateOrchestratorResponse', () => {
  it('acepta respuesta bien formada', () => {
    assert.equal(validateOrchestratorResponse({ message: 'ok', params: { width: 1200 } }).ok, true)
  })
  it('rechaza params con dimensión no numérica', () => {
    assert.equal(validateOrchestratorResponse({ message: 'ok', params: { width: '1200mm' } }).ok, false)
  })
  it('rechaza respuesta sin message', () => {
    assert.equal(validateOrchestratorResponse({ params: null }).ok, false)
  })
})

describe('Integración de prompts y orquestador', () => {
  it('el contrato está inyectado en ambos system prompts', () => {
    assert.match(FURNITURE_SYSTEM_PROMPT, /CONTRATO DE EXTRACCIÓN DE DATOS/)
    assert.match(CHAT_SYSTEM_PROMPT, /CONTRATO DE EXTRACCIÓN DE DATOS/)
    assert.match(PARAM_CONTRACT_PROMPT, /PROHIBIDO ALUCINAR DIMENSIONES/)
  })
  it('el prompt personalizado hereda el contrato', () => {
    assert.match(buildOrbinChatPrompt({ userName: 'Eduardo', lang: 'ES' }), /hasHangingRod/)
  })
  it('aiOrchestrator exporta las funciones que las rutas importan (regresión P0)', () => {
    assert.equal(typeof orchestrator.parseDesignIntent, 'function')
    assert.equal(typeof orchestrator.chatDesign, 'function')
    assert.equal(typeof orchestrator.aiOrchestrator, 'function')
  })
  it('chatDesign nunca lanza aunque no haya proveedores (sin API keys)', async () => {
    const r = await orchestrator.chatDesign([], 'un closet de 2 metros')
    assert.equal(typeof r.message, 'string')
    assert.ok(r.message.length > 0)
    assert.ok(r.params === null || typeof r.params === 'object')
  })
})
