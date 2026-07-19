/**
 * Orbin AI — Tests de integridad de fabricación
 * Runner: node:test   ·   Run: node --test src/engine/manufacturing.test.js
 *
 * Cubre las dos zonas críticas que no tenían cobertura y que rompen la confianza
 * del marcenario en el primer proyecto real:
 *   A) TRANSPARENCIA — el motor nunca altera el pedido del cliente en silencio.
 *   B) NESTING       — ninguna pieza se coloca fuera de la chapa; el conteo de
 *                      chapas no puede quedar por debajo del mínimo geométrico.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject, estimateNesting } = require('./closetEngine')
const { MATERIAL } = require('./constants')

const PW = MATERIAL.PLATE_WIDTH - MATERIAL.NESTING_MARGIN * 2   // 2650 aprovechable
const PH = MATERIAL.PLATE_HEIGHT - MATERIAL.NESTING_MARGIN * 2  // 1740 aprovechable
const PLATE_AREA = PW * PH

const cut = (id, w, h, thickness = 18) => ({ id, cutWidth: w, cutHeight: h, thickness })

// ── A. Transparencia del spec ────────────────────────────────────────────────
describe('Transparencia: el motor no altera el pedido en silencio', () => {
  it('diseño que cabe → sin ajustes de spec', () => {
    const d = generateProject({ width: 800, height: 2000, depth: 600, numShelves: 2, numDrawers: 0, hasDoors: false })
    assert.ok(d.success)
    assert.deepStrictEqual(d.specAdjustments, [], 'no debe reportar ajustes: ' + JSON.stringify(d.specAdjustments))
    assert.strictEqual(d.hasSpecAdjustments, false)
  })

  it('gavetas que NO caben → reporta DRAWER_COUNT_REDUCED como crítico', () => {
    // 700mm de alto: interna útil = 700 − 100 (rodapié) − 36 (2×18) = 564mm.
    // Máx filas al mínimo (80+16=96mm) = 5 → pedir 10 debe reducirse a 5.
    const d = generateProject({ width: 600, height: 700, depth: 600, numDrawers: 10, numShelves: 0, hasDoors: false })
    assert.ok(d.success)
    assert.strictEqual(d.hasSpecAdjustments, true, 'debe avisar que redujo el pedido')

    const adj = d.specAdjustments.find(a => a.code === 'DRAWER_COUNT_REDUCED')
    assert.ok(adj, 'falta DRAWER_COUNT_REDUCED. Ajustes: ' + JSON.stringify(d.specAdjustments))
    assert.strictEqual(adj.severity, 'critical')
    assert.strictEqual(adj.requested, 10)
    assert.ok(adj.applied < 10, `applied (${adj.applied}) debe ser menor que lo pedido`)
    assert.strictEqual(adj.applied, d.configuration.numDrawers, 'el ajuste debe reflejar el config real')
    assert.match(adj.message, /10/, 'el mensaje debe nombrar la cantidad pedida')
  })

  it('el nº de gavetas del cut list coincide con lo REPORTADO, no con lo pedido', () => {
    const d = generateProject({ width: 600, height: 700, depth: 600, numDrawers: 10, numShelves: 0, hasDoors: false })
    const fronts = d.pieces.filter(p => p.type === 'drawer_front')
    const total = fronts.reduce((s, p) => s + p.quantity, 0)
    assert.strictEqual(total, d.configuration.numDrawers,
      'las piezas generadas deben corresponder a la cantidad aplicada')
  })

  it('altura de gaveta ajustada → reporta DRAWER_HEIGHT_ADJUSTED (informativo)', () => {
    const d = generateProject({ width: 600, height: 700, depth: 600, numDrawers: 10, numShelves: 0, hasDoors: false })
    const adj = d.specAdjustments.find(a => a.code === 'DRAWER_HEIGHT_ADJUSTED')
    assert.ok(adj, 'falta DRAWER_HEIGHT_ADJUSTED')
    assert.strictEqual(adj.severity, 'info')
    assert.strictEqual(adj.applied, d.configuration.drawerHeight)
  })
})

// ── A2. Método de armado de la tapa (topStyle) ───────────────────────────────
describe('Armado de tapa: overlay (sobrepuesta) vs inset (DNA V1)', () => {
  const build = (over, T) => generateProject({
    moduleType: 'standard', topStyle: over ? 'overlay' : 'inset',
    width: 600, height: 700, depth: 580, thickness: T, numShelves: 1, hasDoors: false
  })
  const lateral = d => d.pieces.find(p => p.type === 'lateral')
  const techo   = d => d.pieces.find(p => p.type === 'techo')

  // Regla de taller: el cliente pide la ALTURA ACABADA. La tapa se apoya encima,
  // así que el lateral mide H − T. 700 con 15mm → 685. 700 con 18mm → 682.
  for (const [T, esperado] of [[15, 685], [18, 682]]) {
    it(`overlay ${T}mm: lateral = 700 − ${T} = ${esperado}mm`, () => {
      assert.strictEqual(lateral(build(true, T)).height, esperado)
    })
  }

  it('overlay: la tapa cubre el ancho COMPLETO (si no, quedaría flotando)', () => {
    const d = build(true, 18)
    assert.strictEqual(techo(d).width, 600, 'la tapa apoyada encima debe medir W, no W−2T')
  })

  it('overlay: lateral + espesor de tapa = altura pedida (sin hueco ni solape)', () => {
    for (const T of [15, 18]) {
      const d = build(true, T)
      assert.strictEqual(lateral(d).height + techo(d).thickness, 700,
        `${T}mm: la suma debe dar exactamente la altura acabada`)
    }
  })

  it('inset (DNA V1): lateral = H completo y tapa = W − 2T', () => {
    for (const T of [15, 18]) {
      const d = build(false, T)
      assert.strictEqual(lateral(d).height, 700, 'DNA V1: laterales de piso a techo')
      assert.strictEqual(techo(d).width, 600 - 2 * T, 'DNA V1: tapa encajada entre laterales')
    }
  })

  it('default por moduleType: base → overlay, standard/aereo → inset', () => {
    const mk = mt => generateProject({ moduleType: mt, width: 600, height: 700, depth: 580,
      thickness: 18, numShelves: 1, hasCountertop: false })
    assert.strictEqual(lateral(mk('base')).height, 682, 'base debe usar tapa sobrepuesta')
    assert.strictEqual(lateral(mk('standard')).height, 700, 'standard conserva DNA V1')
  })

  it('base con encimera comprada aparte: no hay tapa de MDF que apoyar', () => {
    // Con travesaños la encimera va sobre el lateral: no se descuenta espesor.
    const d = generateProject({ moduleType: 'base', hasCountertop: true, width: 600,
      height: 700, depth: 580, thickness: 18, numDrawers: 0 })
    assert.strictEqual(lateral(d).height, 700, 'sin tapa de MDF el lateral llega arriba')
    assert.ok(d.pieces.some(p => p.type === 'tie_strip'), 'debe llevar travesaños')
  })
})

// ── A3. Montaje de puerta (doorStyle) — simétrico a topStyle en profundidad ──
describe('Puertas: overlay (sobrepuesta) vs legacy', () => {
  const build = (style) => generateProject({
    moduleType: 'standard', doorStyle: style, width: 600, height: 700, depth: 580,
    thickness: 18, hasDoors: true, numDoors: 2, numShelves: 1
  })
  const lat = d => d.pieces.find(p => p.type === 'lateral')
  const dr  = d => d.pieces.find(p => /door/.test(p.type))
  const acabada = d => dr(d).z + dr(d).thickness / 2

  it('overlay: la profundidad PEDIDA es la ACABADA (lateral = D − T)', () => {
    const d = build('overlay')
    assert.strictEqual(lat(d).width, 562, '580 − 18 = 562')
    assert.strictEqual(acabada(d), 580, 'la cara de la puerta debe caer justo en 580')
  })

  it('legacy: comportamiento histórico intacto (acabada = D + T)', () => {
    const d = build('legacy')
    assert.strictEqual(lat(d).width, 580)
    assert.strictEqual(acabada(d), 598)
  })

  it('sin puertas no se descuenta nada', () => {
    const d = generateProject({ moduleType: 'base', width: 600, height: 700, depth: 580,
      thickness: 18, hasDoors: false, hasCountertop: false })
    assert.strictEqual(lat(d).width, 580)
  })

  it('default: base → overlay, standard → legacy (sin regresión)', () => {
    const mk = mt => generateProject({ moduleType: mt, width: 600, height: 700, depth: 580,
      thickness: 18, hasDoors: true, numDoors: 2, hasCountertop: false })
    assert.strictEqual(lat(mk('base')).width, 562)
    assert.strictEqual(lat(mk('standard')).width, 580)
  })
})

describe('Validador: profundidad mínima no aplica a aéreos', () => {
  const { validateDesign } = require('./validator')
  it('aéreo de baño de 150mm NO genera aviso de profundidad', () => {
    const d = generateProject({ moduleType: 'aereo', width: 600, height: 700, depth: 150,
      thickness: 15, numShelves: 2, baseboard: false })
    const v = validateDesign(d)
    assert.ok(!v.warnings.some(w => /rasa/i.test(w)),
      'falso positivo: 150mm es correcto en un aéreo. Avisos: ' + JSON.stringify(v.warnings))
  })
  it('mueble base de 150mm SÍ genera el aviso', () => {
    const d = generateProject({ moduleType: 'standard', width: 600, height: 700, depth: 150,
      thickness: 15, numShelves: 1, hasDoors: false })
    assert.ok(validateDesign(d).warnings.some(w => /rasa/i.test(w)))
  })
})

// ── B. Integridad geométrica del nesting ─────────────────────────────────────
describe('Nesting: ninguna pieza se coloca fuera de la chapa', () => {
  const assertInsidePlate = (nesting, label) => {
    for (const g of nesting) {
      for (const plate of g.plates) {
        for (const p of plate.pieces) {
          const long = Math.max(p.w, p.h), short = Math.min(p.w, p.h)
          assert.ok(p.posX + long <= PW + 0.01 || plate.dedicated,
            `${label}: pieza ${p.id} sale por el ancho (posX ${p.posX} + ${long} > ${PW})`)
          assert.ok(p.posY + short <= PH + 0.01 || plate.dedicated,
            `${label}: pieza ${p.id} sale por el alto (posY ${p.posY} + ${short} > ${PH})`)
        }
      }
    }
  }

  const matrix = [
    { label: 'ropero 1800',        p: { width: 1800, height: 2100, depth: 600, numShelves: 3 } },
    { label: 'ropero 2400 alto',   p: { width: 2400, height: 2400, depth: 600, numShelves: 2, hasDoors: true, numDoors: 4 } },
    { label: 'cocina base 900',    p: { moduleType: 'base', width: 900, height: 720, depth: 580, numDrawers: 3 } },
    { label: 'cómoda 600',         p: { width: 600, height: 1800, depth: 600, numDrawers: 4, numShelves: 0, hasDoors: false } },
  ]

  for (const { label, p } of matrix) {
    it(`${label}: todas las piezas colocadas caben dentro de la chapa`, () => {
      const d = generateProject(p)
      assert.ok(d.success)
      assertInsidePlate(d.nesting, label)
    })
  }

  it('no se pierde ninguna pieza: colocadas − extras por partición + descartadas = total del grupo', () => {
    const d = generateProject({ width: 1800, height: 2100, depth: 600, numShelves: 2, numDrawers: 2, hasDoors: true, numDoors: 2 })
    for (const g of d.nesting) {
      const enGrupo = d.cutList.filter(r => r.thickness === g.thickness).length
      // cada pieza partida aporta 2 partes desde 1 renglón del cutlist → +1 extra
      const extras = g.splitPieces.length
      assert.strictEqual(g.placedPieces - extras + g.oversizedPieces.length, enGrupo,
        `grupo ${g.thickness}mm: ${g.placedPieces} colocadas − ${extras} extras + ${g.oversizedPieces.length} descartadas ≠ ${enGrupo}`)
    }
  })

  it('el conteo de chapas nunca queda por debajo del mínimo geométrico', () => {
    const d = generateProject({ width: 2400, height: 2400, depth: 600, numShelves: 3, hasDoors: true, numDoors: 4 })
    for (const g of d.nesting) {
      const minimo = Math.ceil(g.totalPieceArea / PLATE_AREA)
      assert.ok(g.plateCount >= minimo,
        `grupo ${g.thickness}mm: ${g.plateCount} chapas < mínimo geométrico ${minimo}`)
    }
  })
})

describe('Nesting: casos deterministas de conteo', () => {
  it('4 piezas pequeñas idénticas → 1 sola chapa', () => {
    const list = [cut('A', 600, 400), cut('B', 600, 400), cut('C', 600, 400), cut('D', 600, 400)]
    const [g] = estimateNesting(list)
    assert.strictEqual(g.plateCount, 1, 'cuatro piezas de 600×400 caben de sobra en 2650×1740')
    assert.strictEqual(g.placedPieces, 4)
    assert.strictEqual(g.oversizedPieces.length, 0)
  })

  it('pieza más larga que la chapa → descartada, NO colocada', () => {
    const list = [cut('X', 3000, 400), cut('OK', 600, 400)]
    const [g] = estimateNesting(list)
    assert.strictEqual(g.oversizedPieces.length, 1, 'la pieza de 3000mm no cabe en 2750mm')
    assert.strictEqual(g.oversizedPieces[0].id, 'X')
    assert.strictEqual(g.oversizedPieces[0].reason, 'EXCEEDS_PLATE')
    assert.strictEqual(g.placedPieces, 1, 'solo la pieza válida se coloca')
    const ids = g.plates.flatMap(p => p.pieces.map(x => x.id))
    assert.ok(!ids.includes('X'), 'la pieza imposible NO puede aparecer en ninguna chapa')
  })

  it('pieza alta se acuesta sobre el largo de la chapa (orientación normalizada)', () => {
    // 600×2400: no cabe vertical (2400 > 1740 útil) pero sí acostada (2400 < 2650).
    const [g] = estimateNesting([cut('LAT', 600, 2400)])
    assert.strictEqual(g.oversizedPieces.length, 0, 'un lateral de 600×2400 SÍ cabe acostado')
    assert.strictEqual(g.plateCount, 1)
  })

  it('fondo que no cabe se PARTE en 2 y el material se contabiliza (no se descarta)', () => {
    // Ropero 2400×2400: el fondo es ~2364×2263 → el lado corto excede los 1840 de chapa.
    const d = generateProject({ width: 2400, height: 2400, depth: 600, numShelves: 3 })
    assert.ok(d.success)
    const g6 = d.nesting.find(g => g.thickness === 6)
    assert.ok(g6, 'debe existir grupo de 6mm (fondo)')
    assert.strictEqual(g6.oversizedPieces.length, 0, 'el fondo NO debe descartarse, debe partirse')
    assert.ok(g6.splitPieces.length > 0, 'debe registrar el fondo como partido')
    assert.ok(g6.plateCount >= 1,
      'DEFECTO DE MATERIAL: un ropero con fondo no puede requerir 0 chapas de 6mm')
    assert.ok(g6.totalPieceArea > 0)

    const aviso = d.specAdjustments.find(a => a.code === 'BACK_PANEL_SPLIT')
    assert.ok(aviso, 'debe avisar al marcenario que unirá el fondo')
    assert.strictEqual(aviso.severity, 'warning', 'partir el fondo es práctica normal, no un error')
  })

  it('pieza fuera de chapa se reporta como ajuste crítico en el proyecto', () => {
    // Un fondo de 6mm muy ancho fuerza el caso a través del flujo completo.
    const d = generateProject({ width: 2600, height: 2400, depth: 600, numShelves: 2 })
    assert.ok(d.success)
    const criticos = d.specAdjustments.filter(a => a.code === 'PIECE_EXCEEDS_PLATE')
    for (const c of criticos) {
      assert.strictEqual(c.severity, 'critical')
      assert.ok(Array.isArray(c.pieces) && c.pieces.length > 0)
    }
    // Invariante fuerte: si el motor descartó piezas, DEBE haberlo reportado.
    const descartadas = d.nesting.reduce((s, g) => s + g.oversizedPieces.length, 0)
    assert.strictEqual(descartadas > 0, criticos.length > 0,
      'toda pieza descartada debe generar una alerta crítica visible')
  })
})
