/**
 * Orbin AI — Carpintería avanzada determinista (ADITIVO 2026-10-12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Origen: pruebas de producción del 12/10/2026 (cocina grande). Cinco pedidos del
 * carpintero —horno con puerta falsa, módulo pia con cava 45°, gavetero con cava,
 * aéreo con cava y nicho abierto— o devolvían un mueble genérico o terminaban en 500.
 *
 * Tres capas:
 *   1. Funciones PURAS (furnitureMathSpecs.carpentry): la matemática, sin motor.
 *   2. Motor + parser OFFLINE: cada caso del PDF, tal cual lo escribió el carpintero,
 *      pasado por parseNaturalLanguage → generateProject → validateDesign. Es el camino
 *      real cuando Gemini (429) y Ollama (fetch failed) están caídos.
 *   3. Cero regresión: con los flags apagados no aparece ninguna pieza nueva.
 *
 * Las expectativas numéricas se DERIVAN de las constantes/fórmulas, no son números
 * mágicos: si cambia la regla del taller, el test dice cuál.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const Math_ = require('../ai/furnitureMathSpecs')
const C = Math_.carpentry
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')
const { parseNaturalLanguage } = require('./nlParser')
const { coerceEngineParams } = require('../ai/paramContract')
const { HARDWARE } = require('./constants')

const T = 18
const byPrefix = (d, prefix) => d.pieces.filter(p => String(p.id).startsWith(prefix))
const one = (d, prefix) => {
  const found = byPrefix(d, prefix)
  assert.equal(found.length, 1, `esperaba 1 pieza ${prefix}*, hay ${found.length}`)
  return found[0]
}
const run = (text) => {
  const parsed = parseNaturalLanguage(text)
  const design = generateProject({ ...parsed.params })
  assert.equal(design.success, true, `el motor falló: ${design.details || design.error}`)
  return { parsed, params: parsed.params, design, validation: validateDesign(design) }
}

// ═════════════════════════════════════════════════════════════════════════════
describe('Funciones puras — cava 45° en módulo bajo', () => {
  it('altoHoja = altoNominal − 30mm', () => {
    assert.equal(C.cavaOffsets({ nominalH: 762, internalWidth: 1164 }).leafH, 732)
    assert.equal(C.cavaOffsets({ nominalH: 762, internalWidth: 1164 }).clearance, 30)
  })
  it('traviesa de respaldo: alto ≥ 50mm y largo = vano interior', () => {
    const r = C.cavaOffsets({ nominalH: 700, internalWidth: 1164 })
    assert.equal(r.rail.width, 1164)
    assert.equal(r.rail.height, 50)
    assert.deepEqual(r.adjustments, [])
  })
  it('una traviesa menor a 50mm se SUBE a 50 y queda declarado', () => {
    const r = C.cavaOffsets({ nominalH: 700, internalWidth: 600, railHeight: 20 })
    assert.equal(r.rail.height, 50)
    assert.equal(r.adjustments[0].code, 'CAVA_RAIL_RAISED')
    assert.equal(C.cavaOffsets({ nominalH: 700, internalWidth: 600, railHeight: 80 }).rail.height, 80)
  })
  it('nunca lanza ni devuelve NaN/negativos con entrada basura', () => {
    for (const bad of [undefined, null, {}, { nominalH: NaN }, { nominalH: -5 }, { nominalH: 'x', internalWidth: Infinity }, { nominalH: 10 }]) {
      const r = C.cavaOffsets(bad)
      assert.ok(Number.isFinite(r.leafH) && r.leafH >= 0, JSON.stringify(bad))
      assert.ok(Number.isFinite(r.rail.width) && r.rail.width >= 0)
    }
  })
  it('railCenterY apoya el borde superior de la traviesa en topY', () => {
    assert.equal(C.railCenterY(882, 50), 857)
  })
})

describe('Funciones puras — aéreo con cava (sin tirador)', () => {
  it('con tamponado inferior: voladizo 15mm, hoja = H + 15 − 3', () => {
    const r = C.aereoCavaDoor({ carcassH: 1000, bottomTamponado: true })
    assert.deepEqual(r, { overhang: 15, leafH: 1012, tamponLateralH: 1015 })
  })
  it('sin tamponado inferior: voladizo 30mm, hoja = H + 30 − 3', () => {
    const r = C.aereoCavaDoor({ carcassH: 1000, bottomTamponado: false })
    assert.deepEqual(r, { overhang: 30, leafH: 1027, tamponLateralH: 1030 })
  })
  it('el tamponado lateral SIEMPRE acompaña a la puerta (H + voladizo)', () => {
    for (const tamp of [true, false]) {
      const r = C.aereoCavaDoor({ carcassH: 700, bottomTamponado: tamp })
      assert.equal(r.tamponLateralH, 700 + r.overhang)
    }
  })
  it('overhangOverride manda sobre la regla; inválido se ignora', () => {
    assert.equal(C.aereoCavaDoor({ carcassH: 700, bottomTamponado: true, overhangOverride: 22 }).overhang, 22)
    assert.equal(C.aereoCavaDoor({ carcassH: 700, bottomTamponado: true, overhangOverride: -4 }).overhang, 15)
    assert.equal(C.aereoCavaDoor({}).leafH >= 0, true)
  })
})

describe('Funciones puras — corredizas y baterías', () => {
  it('altoHoja = vano libre vertical − 35mm (kit comercial)', () => {
    assert.equal(C.slidingLeafHeight(2000), 1965)
    assert.equal(C.slidingLeafHeight(20), 0)
  })
  it('ancho de hoja: con el traslape vigente (100) reproduce la fórmula histórica del motor', () => {
    const span = 1164 - 40
    assert.equal(C.slidingSheetWidth(span, 2, 100), Math.round((span + 100) / 2))
    assert.equal(C.slidingSheetWidth(span, 3), Math.round((span + 2 * 100) / 3))   // default = 100
  })
  it('con el traslape del taller (30mm) las hojas quedan más angostas', () => {
    assert.ok(C.slidingSheetWidth(1124, 2, 30) < C.slidingSheetWidth(1124, 2, 100))
    assert.equal(C.slidingSheetWidth(1124, 2, 30), Math.round((1124 + 30) / 2))
  })
  it('tamponado de batería: sólo esquinas exteriores', () => {
    assert.deepEqual([0, 1, 2].map(i => C.batteryTamponado(i, 3)), ['left', 'none', 'right'])
    assert.deepEqual([0, 1].map(i => C.batteryTamponado(i, 2)), ['left', 'right'])
    assert.equal(C.batteryTamponado(0, 1), 'none')     // módulo aislado: no hay unión que decidir
    assert.equal(C.batteryTamponado(9, 3), 'none')     // índice fuera de rango: no lanza
  })
  it('el retranqueo de divisiones es 80mm', () => assert.equal(C.SLIDING_RAIL_SETBACK, 80))
})

describe('Funciones puras — módulo de horno', () => {
  it('la repisa deja el nicho libre hasta el techo y la puerta falsa cubre lo de abajo', () => {
    const r = C.ovenLayout({ ceilingY: 882, floorY: 118, baseY: 100, thickness: T, width: 800 })
    assert.equal(r.ok, true)
    assert.equal(r.shelf.topY, 882 - C.OVEN_NICHE_HEIGHT)
    assert.equal(r.shelf.centerY, r.shelf.topY - T / 2)
    assert.equal(r.falseDoor.width, 794)
    // la puerta falsa llega justo hasta la cara inferior de la repisa
    const top = r.falseDoor.centerY + r.falseDoor.height / 2
    assert.equal(top, r.shelf.topY - T)
  })
  it('sin altura suficiente NO inventa piezas: ok:false + aviso (no lanza)', () => {
    const r = C.ovenLayout({ ceilingY: 500, floorY: 118, baseY: 100, thickness: T, width: 800 })
    assert.equal(r.ok, false)
    assert.equal(r.adjustments[0].code, 'OVEN_NO_ROOM')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Los 5 casos del PDF "Testes_Orbin_12_10_2026", con el texto EXACTO del carpintero.
describe('PDF 12/10 — caso 1: módulo de horno 800×900×520', () => {
  const PROMPT = 'crea un modulo para horno, debe ser un modulo de 800x900x520mm, debe tener una puerta falsa y una repisa interna'
  const r = run(PROMPT)

  it('el parser lo entiende como módulo base de horno (no como clóset)', () => {
    assert.equal(r.params.moduleType, 'base')
    assert.equal(r.params.ovenPanel, true)
    assert.deepEqual([r.params.width, r.params.height, r.params.depth], [800, 900, 520])
  })
  it('genera repisa estructural + puerta falsa sobrepuesta, y NINGUNA puerta operable', () => {
    const shelf = one(r.design, 'REPISA-HORNO')
    const fake = one(r.design, 'PORTA-FALSA')
    assert.equal(byPrefix(r.design, 'PORTA-0').length, 0, 'no debe haber puertas con bisagra')
    assert.equal(fake.width, 800 - 6)
    assert.match(fake.notes, /PANEL FIJO/)
    // la puerta falsa queda sobrepuesta: cara frontal en D exacto (overlay), igual que una puerta real
    assert.equal(fake.z, 520 - T + T / 2 + 0)   // CD + T/2, con CD = D − T
    // la repisa sostiene el horno: nicho libre = ovenNicheHeight sobre su cara superior
    assert.equal(shelf.y + T / 2, (r.params.hasCountertop ? 900 : 900 - T) - C.OVEN_NICHE_HEIGHT)
  })
  it('sin bisagras en el BOM (puerta fija) y con escuadras de fijación', () => {
    const types = (r.design.bom || r.design.hardware || []).map(b => b.type)
    assert.ok(!types.includes('Dobradica'), 'un panel fijo no lleva dobradiças')
    assert.ok(types.includes('Escuadra'))
  })
  it('declara el supuesto del nicho (nunca en silencio) y el diseño es VALIDADO', () => {
    assert.ok(r.design.specAdjustments.some(a => a.code === 'OVEN_NICHE_ASSUMED'))
    assert.equal(r.validation.status, 'VALIDADO')
  })
})

describe('PDF 12/10 — caso 2: módulo pia 1200×900×520 con cava 45° y rodapié 12cm', () => {
  const PROMPT = 'crea un modulo pia de cocina, debe ser un modulo de 1200x900x520mm, debe tener 2 puertas con cava 45º deja un espacio de 3cm entre el tampo y el tirador cava, agrega una repisa interna, el rodapie debe ser de 12cm.'
  const r = run(PROMPT)

  it('el parser reconoce módulo bajo, cava, 2 puertas y rodapié de 120mm', () => {
    assert.equal(r.params.moduleType, 'base')
    assert.equal(r.params.puxadorCava45, true)
    assert.equal(r.params.numDoors, 2)
    assert.equal(r.params.baseboardHeight, 120)
  })
  it('las puertas descuentan exactamente 30mm de luz bajo el tampo', () => {
    const nominal = 900 - 120 - T                           // H − rodapié − techo
    const expected = nominal - C.CAVA_TOP_CLEARANCE - HARDWARE.DOOR_GAP_H
    const doors = byPrefix(r.design, 'PORTA-0')
    assert.equal(doors.length, 2)
    for (const d of doors) assert.equal(d.height, expected)
  })
  it('aparece la traviesa de respaldo de la cava: alto ≥ 50 y largo = vano interior', () => {
    const rail = r.design.pieces.find(p => p.role === 'TRAVIESA_RESPALDO_CAVA')
    assert.ok(rail, 'falta la TRAVIESA_RESPALDO_CAVA')
    assert.ok(rail.height >= 50)
    assert.equal(rail.width, 1200 - 2 * T)
  })
  it('el rodapié pedido (12cm) llega al despiece', () => {
    assert.equal(one(r.design, 'RODAPIE-FRONTAL').height, 120)
  })
  it('VALIDADO', () => assert.equal(r.validation.status, 'VALIDADO'))
})

describe('PDF 12/10 — caso 3: gavetero 700×900×520, 3 gavetas con cava 45°', () => {
  const PROMPT = 'crea un modulo base de gavetas , debe ser un modulo de 700x900x520mm, debe tener 3 gavetas con cava 45º deja un espacio de 3cm entre cada fremte y el tirador cava, agrega 3 tranvesaños de 5cm los frentes de las gavetas deben ser 2 de 15 cm y el otro con el resto de la medida, respetando los 3cm necesario para con la mano puchar la gaveta,el rodapie debe ser de 12cm.'
  const r = run(PROMPT)

  it('el parser entiende 3 gavetas, estilo cava45, travesaños de 50mm y rodapié 120', () => {
    assert.equal(r.params.numDrawers, 3)
    assert.equal(r.params.drawerFrontStyle, 'cava45')
    assert.equal(r.params.topTieRails, true)
    assert.equal(r.params.tieRailHeight, 50)
    assert.equal(r.params.baseboardHeight, 120)
  })
  it('cada frente cede 30mm de luz de agarre', () => {
    const fronts = byPrefix(r.design, 'GAV-FF')
    assert.equal(fronts.length, 3)
    const expected = (r.params.drawerHeight || 180) - 2 * HARDWARE.DRAWER_FRONT_GAP - C.CAVA_TOP_CLEARANCE
    for (const f of fronts) assert.equal(f.height, expected)
  })
  it('techo macizo reemplazado por travesaños de amarre de 50mm (frontal + trasero)', () => {
    assert.equal(byPrefix(r.design, 'TAMPO').length, 0, 'no debe haber techo macizo')
    assert.equal(one(r.design, 'TRAV-F').height, 50)
    assert.equal(one(r.design, 'TRAV-B').height, 50)
  })
  it('lo NO soportado (3 travesaños ENTRE frentes) se declara en el parser, no se calla', () => {
    assert.ok(r.parsed.specAdjustments.some(a => a.code === 'TIE_RAILS_BETWEEN_FRONTS_UNSUPPORTED'))
  })
  it('VALIDADO', () => assert.equal(r.validation.status, 'VALIDADO'))
})

describe('PDF 12/10 — caso 4: aéreo 800×1000×350 con cava, tamponado abajo, sin rodapié', () => {
  const PROMPT = 'crea un mueble aereo de 800x1000x350 con dos puertas cavas45º; 1 prateleira, y tamponado abajo, las puertas deben respetar los 1.5cmde largura mayor que la altura total del mueble. No lleva rodapie'
  const r = run(PROMPT)

  it('el parser entiende aéreo + cava + tamponado inferior + sin rodapié', () => {
    assert.equal(r.params.moduleType, 'aereo')
    assert.equal(r.params.puxadorCavaAereo, true)
    assert.equal(r.params.tamponadoInferior, true)
    assert.equal(r.params.baseboard, false)
  })
  it('puertas: H + 15 − 3 = 1012 y nacen 15mm BAJO la base', () => {
    const doors = byPrefix(r.design, 'PORTA-0')
    assert.equal(doors.length, 2)
    for (const d of doors) {
      assert.equal(d.height, 1000 + 15 - 3)
      assert.equal(d.y - d.height / 2, -15, 'borde inferior de la hoja = −voladizo')
      assert.equal(d.y + d.height / 2, 1000 - 3, 'borde superior = H − 3mm de luz')
    }
  })
  it('lleva tamponado inferior y NINGUNA pieza de rodapié', () => {
    assert.equal(byPrefix(r.design, 'TAMPON-INF').length, 1)
    assert.equal(r.design.pieces.filter(p => p.type === 'baseboard').length, 0)
    assert.ok(one(r.design, 'TAMPON-INF').y >= T / 2, 'el tamponado no puede quedar bajo el piso')
  })
  it('VALIDADO', () => assert.equal(r.validation.status, 'VALIDADO'))

  it('SIN tamponado inferior el voladizo es 30mm y no hay pieza de tamponado', () => {
    const d = generateProject({ moduleType: 'aereo', width: 800, height: 1000, depth: 350, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: false, puxadorCavaAereo: true, tamponadoInferior: false })
    assert.equal(d.success, true)
    assert.equal(byPrefix(d, 'TAMPON-INF').length, 0)
    for (const door of byPrefix(d, 'PORTA-0')) assert.equal(door.height, 1000 + 30 - 3)
  })
  it('los tamponados LATERALES extienden su altura para acompañar la puerta', () => {
    const d = generateProject({ moduleType: 'aereo', width: 800, height: 1000, depth: 350, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: false, puxadorCavaAereo: true, tamponado: 'both' })
    for (const prefix of ['TAMP-L', 'TAMP-R']) assert.equal(one(d, prefix).height, 1000 + 15)
  })
})

describe('PDF 12/10 — caso 5: nicho abierto 700×400×350', () => {
  const PROMPT = 'nicho 700x400x350 sin puertas, fundo 15cm, sin rodapie'
  const r = run(PROMPT)

  it('el parser lo entiende como caja abierta colgada, fondo 15mm (y declara el supuesto cm→mm)', () => {
    assert.equal(r.params.moduleType, 'aereo')
    assert.equal(r.params.hasDoors, false)
    assert.equal(r.params.baseboard, false)
    assert.equal(r.params.backThickness, 15)
    assert.equal(r.params.depth, 350, '"fundo 15cm" NO debe pisar la profundidad')
    assert.ok(r.parsed.specAdjustments.some(a => a.code === 'NLP_BACK_THICKNESS_ASSUMED'))
  })
  it('sin puertas, sin rodapié, sin repisas; fondo de 15mm', () => {
    assert.equal(r.design.pieces.filter(p => /standard_door|sliding_door/.test(p.type)).length, 0)
    assert.equal(r.design.pieces.filter(p => p.type === 'baseboard').length, 0)
    assert.equal(r.design.pieces.filter(p => /repisa|shelf/.test(p.type)).length, 0)
    assert.equal(one(r.design, 'FUNDO').thickness, 15)
  })
  it('VALIDADO', () => assert.equal(r.validation.status, 'VALIDADO'))
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Contrato de params — las llaves nuevas SOBREVIVEN (antes se descartaban en silencio)', () => {
  it('puxadorCavaAereo / drawerFrontStyle / cavaOverhang / ovenPanel / topTieRails pasan el whitelist', () => {
    const { params, dropped } = coerceEngineParams({
      moduleType: 'aereo', width: 800, height: 700, depth: 350,
      puxadorCavaAereo: true, tamponadoInferior: false, cavaOverhang: 15,
      drawerFrontStyle: 'cava45', ovenPanel: true, ovenNicheHeight: 600, topTieRails: true, tieRailHeight: 50,
    })
    assert.deepEqual(dropped, [])
    assert.equal(params.puxadorCavaAereo, true)
    assert.equal(params.tamponadoInferior, false)
    assert.equal(params.cavaOverhang, 15, '15 es 15mm, no 15 metros')
    assert.equal(params.drawerFrontStyle, 'cava45')
    assert.equal(params.ovenPanel, true)
    assert.equal(params.topTieRails, true)
  })
  it('los alias del briefing (hasCava45, doorOverlapBottom, ovenFalseDoor) se traducen a la llave real', () => {
    const { params, dropped } = coerceEngineParams({ moduleType: 'base', width: 900, height: 900, depth: 580, hasCava45: true, doorOverlapBottom: true, ovenFalseDoor: true })
    assert.deepEqual(dropped, [])
    assert.equal(params.puxadorCava45, true)
    assert.equal(params.puxadorCavaAereo, true)
    assert.equal(params.ovenPanel, true)
  })
})

describe('Parser — no secuestra frases que NO son carpintería avanzada', () => {
  it('"fondo 60cm" sigue siendo profundidad, no espesor de fondo', () => {
    const p = parseNaturalLanguage('armario de 2000 de ancho, 2200 de alto, fondo 60cm').params
    assert.equal(p.backThickness, 6)
    assert.equal(p.depth, 600)
  })
  it('"armario con nicho" sigue siendo clóset (nicho es un detalle, no el tipo)', () => {
    assert.equal(parseNaturalLanguage('armario con nicho 2000x2200x600').params.moduleType, 'standard')
  })
  it('un saludo sigue sin inventar params', () => {
    assert.equal(parseNaturalLanguage('hola').params, null)
  })
  it('sin la palabra cava no se activa ningún flag de cava', () => {
    const p = parseNaturalLanguage('mueble bajo de cocina 1200x900x580 con 2 puertas').params
    assert.ok(!p.puxadorCava45 && !p.puxadorCavaAereo && !p.ovenPanel && !p.topTieRails)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Cero regresión — con los flags apagados no aparece ninguna pieza nueva', () => {
  const NEW = /^(TRAV-CAVA|REPISA-HORNO|PORTA-FALSA|TAMPON-INF)/
  const CFGS = [
    { moduleType: 'base',     width: 1200, height: 900,  depth: 580, hasDoors: true, numDoors: 2, doorType: 'hinged', hasCountertop: false },
    { moduleType: 'base',     width: 900,  height: 900,  depth: 580, hasDoors: true, numDoors: 2, doorType: 'hinged', hasCountertop: true },
    { moduleType: 'aereo',    width: 800,  height: 700,  depth: 350, hasDoors: true, numDoors: 2, doorType: 'hinged' },
    { moduleType: 'standard', width: 1200, height: 2200, depth: 580, hasDoors: true, numDoors: 2, doorType: 'sliding', numDrawers: 2 },
    { moduleType: 'standard', width: 1200, height: 2200, depth: 580, numDrawers: 3 },
  ]
  for (const [i, cfg] of CFGS.entries()) {
    it(`config #${i + 1} (${cfg.moduleType}): sin piezas nuevas ni role de cava`, () => {
      const d = generateProject(cfg)
      assert.equal(d.success, true)
      assert.deepEqual(d.pieces.filter(p => NEW.test(String(p.id)) || p.role).map(p => p.id), [])
    })
  }
  it('puertas de un base normal: alto histórico (sin los 30mm de cava)', () => {
    const d = generateProject(CFGS[0])
    const expected = 900 - 100 - T - HARDWARE.DOOR_GAP_H     // rodapié default 100
    for (const p of byPrefix(d, 'PORTA-0')) assert.equal(p.height, expected)
  })
  it('gavetas sin cava: frente histórico (casillero − 2·holgura)', () => {
    const d = generateProject(CFGS[4])
    for (const f of byPrefix(d, 'GAV-FF')) assert.equal(f.height, 180 - 2 * HARDWARE.DRAWER_FRONT_GAP)
  })
  it('traslape de corredizas por defecto = 100 (el vigente), parametrizable a 30', () => {
    const base = generateProject(CFGS[3])
    const w100 = byPrefix(base, 'PORTA-CORRER')[0].width
    const w30 = byPrefix(generateProject({ ...CFGS[3], slidingSheetOverlap: 30 }), 'PORTA-CORRER')[0].width
    assert.equal(w100, C.slidingSheetWidth(1200 - 2 * T - 40, 2, 100))
    assert.equal(w30, C.slidingSheetWidth(1200 - 2 * T - 40, 2, 30))
    assert.ok(w30 < w100)
  })
})

describe('Robustez — combinaciones raras NUNCA lanzan (el chat no puede dar 500 por esto)', () => {
  const WEIRD = [
    { moduleType: 'aereo', width: 800, height: 700, depth: 350, ovenPanel: true },                       // horno en aéreo: se ignora
    { moduleType: 'base', width: 600, height: 400, depth: 520, ovenPanel: true, hasDoors: true },        // sin altura para el horno
    { moduleType: 'base', width: 900, height: 900, depth: 580, puxadorCavaAereo: true, hasDoors: true }, // flag de aéreo en base: se ignora
    { moduleType: 'aereo', width: 800, height: 700, depth: 350, topTieRails: true, hasDoors: true },     // travesaños en aéreo: se ignora
    { moduleType: 'aereo', width: 800, height: 700, depth: 350, hasDoors: true, puxadorCavaAereo: true, cavaOverhang: 9999 },
    { moduleType: 'base', width: 900, height: 900, depth: 580, puxadorCava45: true, hasDoors: true, doorType: 'sliding' },
    { moduleType: 'desk', width: 1400, height: 750, depth: 600, puxadorCava45: true, ovenPanel: true, topTieRails: true },
  ]
  for (const [i, cfg] of WEIRD.entries()) {
    it(`caso raro #${i + 1} no lanza`, () => {
      assert.doesNotThrow(() => {
        const d = generateProject(cfg)
        assert.ok(d && typeof d.success === 'boolean')
      })
    })
  }
  it('horno sin altura: el módulo se genera igual, sin puerta falsa, con aviso OVEN_NO_ROOM', () => {
    const d = generateProject(WEIRD[1])
    assert.equal(d.success, true)
    assert.equal(byPrefix(d, 'PORTA-FALSA').length, 0)
    assert.ok(d.specAdjustments.some(a => a.code === 'OVEN_NO_ROOM'))
  })
})
