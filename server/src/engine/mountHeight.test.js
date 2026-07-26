/**
 * Orbin AI — Altura de INSTALACIÓN del aéreo (ADITIVO 2026-07-26).
 *
 * `mountHeight` = piso → borde INFERIOR del mueble (mm). Metadato de MONTAJE:
 * no genera ni modifica ninguna pieza.
 *
 * CANDADOS que cierra este archivo:
 *  1. El aéreo sin altura explícita salía con mountHeight undefined → el plano de
 *     conjunto lo dibujaba APOYADO EN EL PISO (físicamente falso).
 *  2. DEFAULTS.mountHeight no puede ser 0: generateProject hace {...DEFAULTS,...params}
 *     ANTES de generateFurniture, así que un 0 de default sería indistinguible de un 0
 *     del usuario y el auto-default del aéreo nunca dispararía.
 *  3. constants.DEFAULTS.mountHeight no puede ser 1450: siembra nlParser y GET /defaults
 *     para TODOS los tipos → un ropero heredaría altura de instalación y flotaría.
 *  4. El parser NLP mapeaba "altura" → height (alto DEL MUEBLE) e ignoraba por completo
 *     la altura de instalación dicha por el usuario ("colgalo a 1.20" salía 1450).
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { generateProject } = require('./closetEngine')
const { parseNaturalLanguage } = require('./nlParser')
const { DEFAULTS, AEREO } = require('./constants')

const aereo = (extra = {}) => generateProject({
  moduleType: 'aereo', width: 800, height: 700, depth: 350,
  hasDoors: true, numDoors: 2, ...extra,
})

describe('mountHeight — motor', () => {
  it('aéreo sin altura explícita recibe el default de dominio', () => {
    assert.equal(aereo().configuration.mountHeight, AEREO.KITCHEN_MOUNT_HEIGHT)
  })

  it('respeta la altura explícita del usuario', () => {
    assert.equal(aereo({ mountHeight: 900 }).configuration.mountHeight, 900)
  })

  it('respeta el 0 explícito (aéreo apoyado) — el default NO lo pisa', () => {
    // Candado #2: con DEFAULTS.mountHeight = 0 este caso devolvía 1450.
    assert.equal(aereo({ mountHeight: 0 }).configuration.mountHeight, 0)
  })

  it('los tipos apoyados NO reciben altura de instalación', () => {
    for (const moduleType of ['standard', 'base', 'desk']) {
      const d = generateProject({ moduleType, width: 1200, height: 900, depth: 600 })
      assert.ok(d.configuration.mountHeight == null,
        `${moduleType} no debe heredar mountHeight (obtuvo ${d.configuration.mountHeight})`)
    }
  })

  it('es metadato de MONTAJE: no altera ni una pieza', () => {
    const a = aereo({ mountHeight: 0 }).pieces
    const b = aereo({ mountHeight: 1450 }).pieces
    const norm = ps => JSON.stringify(ps.map(p => [p.name, p.width, p.height, p.thickness, p.quantity]))
    assert.equal(norm(a), norm(b))
  })

  it('constants.DEFAULTS no siembra altura de instalación', () => {
    // Candado #3: si esto es 1450, TODO módulo parseado hereda mountHeight.
    assert.ok(DEFAULTS.mountHeight == null,
      `constants.DEFAULTS.mountHeight debe ser null (obtuvo ${DEFAULTS.mountHeight})`)
  })
})

describe('mountHeight — parser NLP (preposicional)', () => {
  const mh = t => parseNaturalLanguage(t).params.mountHeight

  it('extrae por verbo de fijación', () => {
    assert.equal(mh('aereo suspendido a 1400mm'), 1400)
    assert.equal(mh('aereo mounted at 1400mm from floor'), 1400)
  })

  it('extrae por referencia al piso, en ES y PT', () => {
    assert.equal(mh('aereo a 1500mm del suelo'), 1500)
    assert.equal(mh('aereo pendurado a 1.30 do chao'), 1300)
  })

  it('extrae por "altura de instalación" (no por "altura" a secas)', () => {
    assert.equal(mh('armario superior, altura de instalacion 1600'), 1600)
  })

  it('interpreta metros con decimal — coma y punto', () => {
    // Candado: con \d{2,4} el regex capturaba el "20" de "1.20" y salía 200mm.
    assert.equal(mh('aereo colgado a 1.20 del piso'), 1200)
    assert.equal(mh('aereo colgado a 1,45 del piso'), 1450)
    assert.equal(mh('aereo a 145 del piso'), 1450)   // cm
  })

  it('NO confunde el ALTO del mueble con la altura de instalación', () => {
    // Candado #4: "altura"/"alto" pertenecen a `height`.
    for (const t of ['armario 2000mm de altura', 'mueble bajo 900mm de alto']) {
      assert.ok(parseNaturalLanguage(t).params.mountHeight == null,
        `"${t}" no debe producir mountHeight`)
    }
    assert.equal(parseNaturalLanguage('armario 2000mm de altura').params.height, 2000)
  })

  it('convive con el alto en la MISMA frase (se borra el match para no recapturar)', () => {
    const p = parseNaturalLanguage('aereo de 700mm de alto colgado a 1400 del piso').params
    assert.equal(p.height, 700)
    assert.equal(p.mountHeight, 1400)
  })

  it('no inventa altura de instalación cuando no se menciona', () => {
    assert.ok(parseNaturalLanguage('escritorio 1400mm x 750mm x 600mm').params.mountHeight == null)
  })
})
