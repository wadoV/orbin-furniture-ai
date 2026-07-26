/**
 * Orbin AI — i18n de NOMBRES DE PIEZA (ADITIVO 2026-07-26).
 *
 * El motor emite nombres CANÓNICOS (identificadores: nesting, BOM, hash, tests golden).
 * La traducción vive en la capa de presentación: client/src/engine/pieceNames.js.
 *
 * CANDADO 1 — COBERTURA: genera muebles de TODOS los tipos, extrae los nombres que el
 * motor realmente produce y falla si alguno no está en el diccionario. Sin esto, una
 * pieza nueva del motor aparecería sin traducir en un plano en inglés y nadie se
 * enteraría hasta que llegue al taller.
 *
 * CANDADO 2 — COHERENCIA: el plano, el CSV y la etiqueta térmica se pegan a la misma
 * pieza física. Si nombran distinto, el operario no puede emparejarlos. Todos pasan por
 * la MISMA función, así que el test verifica que esa función sea determinista y que el
 * agrupado de la lista de cortes NO cambie según el idioma.
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { bundleClientEngine } = require('./clientBundle.helper')

let localizePieceName = null
let pieceNameKey = null
let pieceBaseName = null
let knownPieceKeys = null
let planGen = null

// ★ 2026-07-26: SIN try/catch a propósito. La versión anterior atrapaba el error y cada
//   test hacía `return` → la suite decía "9 pass" sin ejecutar NADA (esbuild vive en
//   client/node_modules y no resolvía desde server/). Si esto no puede cargar, el fallo
//   tiene que ser ruidoso: son candados de una invariante que cruza cliente/servidor.
before(() => {
  const pn = bundleClientEngine('pieceNames.js')
  localizePieceName = pn.localizePieceName
  pieceNameKey = pn.pieceNameKey
  pieceBaseName = pn.pieceBaseName
  knownPieceKeys = pn.knownPieceKeys
  planGen = bundleClientEngine('planGenerator.js')
})

// Configuraciones que cubren todas las topologías y sus piezas opcionales.
const CFGS = [
  { moduleType: 'standard', width: 1400, height: 2000, depth: 600, hasDoors: true, numDoors: 2, numShelves: 3, numDrawers: 2, numDividers: 1 },
  { moduleType: 'standard', width: 1200, height: 2200, depth: 600, hasHangingRod: true, tamponado: 'both', nicheHeight: 300, baseType: 'legs' },
  { moduleType: 'base',     width: 1200, height: 900,  depth: 600, hasDoors: true, numDoors: 2, hasCountertop: true, countertopMaterial: 'mdf' },
  { moduleType: 'aereo',    width: 800,  height: 700,  depth: 350, hasDoors: true, numDoors: 2 },
  { moduleType: 'desk',     width: 1400, height: 750,  depth: 600, numDrawers: 3 },
  { moduleType: 'desk',     width: 1400, height: 750,  depth: 600, numDrawers: 0, hasPedestal: false },
]

function allCanonicalNames() {
  const set = new Set()
  for (const c of CFGS) {
    let d
    try { d = generateProject(c) } catch { continue }
    for (const p of d.pieces) {
      // Mismo recorte que groupPieces: quita sufijo numérico y paréntesis.
      const base = String(p.name || p.type || '').replace(/\s*\d+$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (base) set.add(base)
    }
  }
  return [...set]
}

describe('Nombres de pieza — cobertura del diccionario', () => {
  it('TODA pieza que el motor emite está traducida', () => {

    // La cobertura se mide sobre la MISMA base que usa la traducción (sin sufijo
    // numérico ni paréntesis): "Estante 1" está cubierto por la entrada 'estante'.
    const known = new Set(knownPieceKeys())
    const missing = allCanonicalNames().filter(n => !known.has(pieceNameKey(pieceBaseName(n))))
    assert.deepEqual(missing, [],
      `Piezas SIN traducir en pieceNames.js: ${missing.join(', ')}. ` +
      `Agregalas al diccionario o aparecerán en español dentro de un plano en inglés.`)
  })

  it('en ES el nombre mostrado no se degrada (nunca queda vacío)', () => {

    for (const n of allCanonicalNames()) {
      const es = localizePieceName(n, 'ES')
      assert.ok(es && es.trim().length > 0, `"${n}" quedó vacío en ES`)
    }
  })

  it('los tres idiomas devuelven algo distinto de vacío', () => {

    for (const n of allCanonicalNames()) {
      for (const L of ['ES', 'PT', 'EN']) {
        const out = localizePieceName(n, L)
        assert.ok(out && out.trim().length > 0, `"${n}" quedó vacío en ${L}`)
      }
    }
  })

  it('conserva número y paréntesis: "Estante 2 (vano 1)" → "Shelf 2 (bay 1)"', () => {

    assert.equal(localizePieceName('Estante 2 (vano 1)', 'EN'), 'Shelf 2 (bay 1)')
    assert.equal(localizePieceName('Estante 2 (vano 1)', 'PT'), 'Prateleira 2 (vão 1)')
    assert.equal(localizePieceName('Estante 2 (vano 1)', 'ES'), 'Estante 2 (vano 1)')
  })

  it('un nombre desconocido se devuelve tal cual, no desaparece', () => {

    assert.equal(localizePieceName('Pieza Futura Sin Traducir', 'EN'), 'Pieza Futura Sin Traducir')
  })

  it('idioma inválido no rompe ni vacía el nombre', () => {

    for (const L of [undefined, null, '', 'FR', 'pt-BR', 'en_US']) {
      const out = localizePieceName('Lateral Izquierdo', L)
      assert.ok(out && out.trim().length > 0, `lang=${L} devolvió vacío`)
    }
  })
})

describe('Nombres de pieza — coherencia entre superficies', () => {
  const company = { empresa: 'Test', material: 'MDF 18mm', desenhista: 'Dev' }

  it('la lista de cortes del plano muestra el nombre traducido', () => {

    const d = generateProject(CFGS[4])           // desk
    const mod = { id: d.id, configuration: d.configuration, pieces: d.pieces }
    const en = planGen.generateModulePlanSVG(mod, { theme: 'print', lang: 'EN', company })
    const es = planGen.generateModulePlanSVG(mod, { theme: 'print', lang: 'ES', company })
    assert.ok(en.includes('Desk Top'), 'el plano EN no muestra "Desk Top"')
    assert.ok(en.includes('Modesty Panel'), 'el plano EN no muestra "Modesty Panel"')
    assert.ok(!en.includes('Tampo Escritorio'), 'el plano EN todavía muestra el nombre canónico')
    assert.ok(es.includes('Tampo Escritorio'), 'el plano ES perdió el nombre en español')
  })

  it('el AGRUPADO de la lista de cortes no cambia según el idioma', () => {

    // Si se agrupara por el nombre traducido, dos piezas distintas que colapsan al mismo
    // término en un idioma se fusionarían y la lista de cortes mentiría.
    const d = generateProject(CFGS[0])
    const mod = { id: d.id, configuration: d.configuration, pieces: d.pieces }
    const count = (svg) => (svg.match(/LISTA DE CORTES|CUT LIST/g) || []).length
    const rowsOf = (svg) => (svg.match(/ — (\d+) (pzs|pçs|pcs)/) || [])[1]
    const es = planGen.generateModulePlanSVG(mod, { theme: 'print', lang: 'ES', company })
    const en = planGen.generateModulePlanSVG(mod, { theme: 'print', lang: 'EN', company })
    assert.equal(count(es), count(en))
    assert.equal(rowsOf(es), rowsOf(en), 'el total de piezas difiere entre idiomas')
  })

  it('la etiqueta térmica usa el mismo nombre que el plano', () => {

    for (const L of ['ES', 'PT', 'EN']) {
      const sticker = planGen.generatePieceStickerSVG({ id: 'p1', name: 'Lateral Izquierdo' }, 'proj', L)
      const expected = localizePieceName('Lateral Izquierdo', L)
      assert.ok(sticker.includes(expected),
        `la etiqueta en ${L} no dice "${expected}" — no emparejaría con el plano`)
    }
  })
})
