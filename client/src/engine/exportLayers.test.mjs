/**
 * Orbin AI — CANDADO de integridad de exportación CAD/3D.
 * ─────────────────────────────────────────────────────────────────────────────
 * Estas tres garantías se rompen SILENCIOSAMENTE: el archivo se descarga igual,
 * abre igual, y el fallo solo aparece cuando el operario ya está en la CNC o el
 * cliente abre el .glb en Blender. Por eso se verifican con test estático.
 *
 *  1. DXF con 3 familias de capas separadas (geometría / cotas / cajetín).
 *  2. 3D multi-módulo NO aplanado: una mesh nombrada por pieza, agrupada por módulo.
 *  3. Todo formato lleva cabecera de procedencia (proyecto, fecha, unidades).
 */
import assert from 'node:assert'
import test from 'node:test'
import { exportDesign } from './exportAdapters.js'

const cfg = (w, h) => ({
  width: w, height: h, depth: 580, thickness: 18, backThickness: 6,
  shelfCount: 2, drawerCount: 1, drawerHeight: 150, doorCount: 1
})
const TWO_MODULES = [
  { id: 'MOD-01', configuration: cfg(600, 720), pieces: [] },
  { id: 'MOD-02', configuration: cfg(900, 2100), pieces: [] }
]
const OPTS = { projectName: 'QA-Audit', companyName: 'Orbin', clientName: 'Taller Test' }

// Módulos con pieces[] POSICIONADAS: es el camino real de producción (el motor
// entrega coordenadas). El mock sin posiciones cae al fallback plano y no prueba
// la integridad de coordenadas relativas, que es justo lo que hay que blindar.
const POSITIONED = [
  { id: 'MOD-01', configuration: cfg(600, 720), pieces: [
    { name: 'Lateral Izq', type: 'lateral', width: 580, height: 720, thickness: 18, x: 9, y: 360, z: 290 },
    { name: 'Lateral Der', type: 'lateral', width: 580, height: 720, thickness: 18, x: 591, y: 360, z: 290 },
    { name: 'Piso', type: 'piso', width: 564, height: 580, thickness: 18, x: 300, y: 9, z: 290 },
    { name: 'Techo', type: 'techo', width: 564, height: 580, thickness: 18, x: 300, y: 711, z: 290 },
    { name: 'Estante 1', type: 'shelf', width: 564, height: 560, thickness: 18, x: 300, y: 360, z: 290 }
  ] },
  { id: 'MOD-02', configuration: cfg(900, 2100), pieces: [
    { name: 'Lateral Izq', type: 'lateral', width: 580, height: 2100, thickness: 18, x: 9, y: 1050, z: 290 },
    { name: 'Lateral Der', type: 'lateral', width: 580, height: 2100, thickness: 18, x: 891, y: 1050, z: 290 },
    { name: 'Piso', type: 'piso', width: 864, height: 580, thickness: 18, x: 450, y: 9, z: 290 },
    { name: 'Techo', type: 'techo', width: 864, height: 580, thickness: 18, x: 450, y: 2091, z: 290 }
  ] }
]

/**
 * Parser de pares (código, valor) del DXF. Partir el texto por '0\n' es
 * DESTRUCTIVO — el propio valor "0" de las coordenadas Z lo rompe y el test
 * reporta fallos fantasma. Un DXF es una lista plana de pares: se lee así.
 */
function parseDXF(txt) {
  const lines = txt.split('\n')
  const pairs = []
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i].trim(), lines[i + 1]])
  const sections = {}, entities = [], layers = []
  let section = null, cur = null, inTable = null
  for (const [code, val] of pairs) {
    if (code === '0' && val === 'SECTION') { section = '?'; continue }
    if (code === '2' && section === '?') { section = val; sections[val] = true; continue }
    if (code === '0' && val === 'ENDSEC') { if (cur) { entities.push(cur); cur = null } section = null; continue }
    if (section === 'TABLES') {
      if (code === '0' && val === 'TABLE') inTable = '?'
      else if (code === '2' && inTable === '?') inTable = val
      else if (code === '0' && val === 'LAYER') layers.push({})
      else if (inTable === 'LAYER' && layers.length) {
        const l = layers[layers.length - 1]
        if (code === '2' && l.name === undefined) l.name = val
        if (code === '62') l.aci = +val
      }
      continue
    }
    if (section === 'ENTITIES') {
      if (code === '0') { if (cur) entities.push(cur); cur = { type: val, codes: {} } }
      else if (cur) { (cur.codes[code] = cur.codes[code] || []).push(val) }
    }
  }
  if (cur) entities.push(cur)
  const layerOf = e => (e.codes['8'] || [])[0]
  return { entities, layers: layers.map(l => l.name).filter(Boolean), layerOf }
}

// ── 1. DXF: separación de capas ──────────────────────────────────────────────
test('DXF — geometría, cotas y cajetín viven en capas DISTINTAS', async () => {
  const txt = await (await exportDesign('dxf', POSITIONED, OPTS)).blob.text()
  const { entities, layers, layerOf } = parseDXF(txt)

  assert.ok(layers.includes('ORBIN-TITULO'), 'falta la capa de cajetín ORBIN-TITULO')
  assert.ok(layers.includes('M1-COTAS') && layers.includes('M2-COTAS'), 'falta capa de cotas por módulo')
  const geom = layers.filter(l => /^M\d+-(LAT|EST|TAM|BASE|PTA|FFR|ZOC|TMP|DIV|FND|PZA)-\d+$/.test(l))
  assert.ok(geom.length >= 8, `capas de geometría por pieza insuficientes: ${geom.length}`)

  // Toda entidad declara una capa que existe en la tabla LAYER
  for (const e of entities) {
    const l = layerOf(e)
    assert.ok(l, `entidad ${e.type} sin capa`)
    assert.ok(layers.includes(l) || l === '0', `capa usada sin declarar: ${l}`)
  }

  // Aislamiento: el cajetín SOLO lleva texto y NO comparte capa con cotas/geometría
  const title = entities.filter(e => layerOf(e) === 'ORBIN-TITULO')
  assert.ok(title.length >= 3, `cajetín incompleto (${title.length}): falta rótulo por módulo o bloque de proyecto`)
  assert.ok(title.every(e => e.type === 'TEXT'), 'la capa de cajetín solo debe contener texto')

  // La capa de cotas debe contener COTAS REALES (líneas), no solo una etiqueta suelta
  const cotaL = entities.filter(e => layerOf(e) === 'M1-COTAS' && e.type === 'LINE')
  assert.ok(cotaL.length >= 6, `M1-COTAS sin líneas de cota (${cotaL.length}): es capa de etiqueta, no de acotado`)

  // Ninguna capa de geometría puede contener texto (anotación filtrada en la capa equivocada)
  for (const e of entities.filter(e => geom.includes(layerOf(e)))) {
    assert.equal(e.type, 'LINE', `anotación ${e.type} contaminando capa de geometría ${layerOf(e)}`)
  }
})

test('DXF — cabecera con extents (el archivo abre encuadrado)', async () => {
  const txt = await (await exportDesign('dxf', TWO_MODULES, OPTS)).blob.text()
  for (const k of ['$ACADVER', '$INSUNITS', '$EXTMIN', '$EXTMAX']) {
    assert.ok(txt.includes(k), `falta ${k} en el HEADER`)
  }
  const min = txt.match(/\$EXTMIN\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/)
  const max = txt.match(/\$EXTMAX\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/)
  assert.ok(min && max, 'EXTMIN/EXTMAX mal formados')
  assert.ok(+max[1] > +min[1] && +max[2] > +min[2], 'extents degenerados (max <= min)')
})

test('DXF — módulos NO se solapan en X', async () => {
  // Con pieces[] reales el ancho ocupado lo marca la geometría, no cfg.width:
  // es el caso que hacía pisarse los módulos cuando ambos divergían.
  const txt = await (await exportDesign('dxf', POSITIONED, OPTS)).blob.text()
  const { entities, layerOf } = parseDXF(txt)
  const xs = {}
  for (const e of entities) {
    if (e.type !== 'LINE') continue
    const m = /^M(\d+)-(?:LAT|EST|TAM|BASE|PTA|FFR|ZOC|TMP|DIV|FND|PZA)-\d+$/.exec(layerOf(e) || '')
    if (!m) continue
    const a = +e.codes['10'][0], b = +e.codes['11'][0]
    const k = m[1]
    xs[k] = xs[k] || { min: Infinity, max: -Infinity }
    xs[k].min = Math.min(xs[k].min, a, b); xs[k].max = Math.max(xs[k].max, a, b)
  }
  assert.ok(xs['1'] && xs['2'], 'no se detectó geometría de ambos módulos')
  assert.ok(xs['2'].min > xs['1'].max, `módulos solapados: M1 termina en ${xs['1'].max}, M2 empieza en ${xs['2'].min}`)
})

// ── 2. 3D: NO aplanado ───────────────────────────────────────────────────────
test('GLTF — una mesh por PIEZA, agrupada por MÓDULO (no un blob)', async () => {
  const g = JSON.parse(await (await exportDesign('gltf', TWO_MODULES, OPTS)).blob.text())
  assert.ok(g.meshes.length > 1, 'glTF aplanado: una sola mesh para todo el proyecto')
  assert.equal(g.scenes[0].nodes.length, 2, 'la escena debe tener un nodo raíz por módulo')

  const roots = g.scenes[0].nodes.map(i => g.nodes[i])
  assert.deepEqual(roots.map(n => n.name), ['MOD-01', 'MOD-02'], 'nodos de módulo sin nombrar')
  for (const r of roots) {
    assert.ok(r.children && r.children.length > 1, `módulo ${r.name} sin piezas hijas`)
    for (const c of r.children) {
      const n = g.nodes[c]
      assert.ok(n.name && n.name.includes(r.name), `pieza sin nombre trazable al módulo: ${n.name}`)
      assert.equal(typeof n.mesh, 'number', `pieza ${n.name} sin mesh propia`)
    }
  }
  // Todas las meshes referenciadas exactamente una vez → sin geometría huérfana
  const refs = g.nodes.filter(n => typeof n.mesh === 'number').map(n => n.mesh)
  assert.equal(new Set(refs).size, g.meshes.length, 'hay meshes huérfanas o reusadas')
})

test('GLTF — accessors alineados y coordenadas relativas correctas', async () => {
  const g = JSON.parse(await (await exportDesign('gltf', POSITIONED, OPTS)).blob.text())
  for (const a of g.accessors) {
    const size = a.componentType === 5126 ? 4 : 4
    assert.equal((a.byteOffset || 0) % size, 0, 'byteOffset desalineado (glTF lo rechaza)')
    assert.ok(a.count > 0, 'accessor vacío')
  }
  for (const bv of g.bufferViews) assert.equal((bv.byteOffset || 0) % 4, 0, 'bufferView desalineado')
  // Cada pieza ocupa un volumen propio y no degenerado
  const pos = g.accessors.filter(a => a.type === 'VEC3')
  assert.ok(pos.length >= 2, 'faltan accessors de posición')
  for (const a of pos) {
    assert.equal(a.count, 8, 'una caja debe tener 8 vértices')
    assert.ok(a.max.some((v, k) => v > a.min[k]), 'caja degenerada (min === max)')
  }
  // Los dos laterales de MOD-01 (x=9 y x=591, espesor 18) deben conservar su luz interior
  const m1 = g.nodes.find(n => n.name === 'MOD-01')
  const lats = m1.children.map(c => g.nodes[c]).filter(n => /Lateral/.test(n.name))
  assert.equal(lats.length, 2, 'MOD-01 debe tener 2 laterales')
  const [left, right] = lats
    .map(n => g.accessors[g.meshes[n.mesh].primitives[0].attributes.POSITION])
    .sort((p, q) => p.min[0] - q.min[0])
  const gap = right.min[0] - left.max[0]
  assert.ok(gap > 500, `luz interior perdida entre laterales (${gap}mm): coordenadas relativas rotas`)
})

test('3D — los módulos NO se superponen en el ensamble', async () => {
  // Los pieces[] del motor son LOCALES al módulo. Sin offset de ensamble los N
  // módulos del proyecto salen encimados en el mismo origen y el cliente ve los
  // muebles atravesándose. glTF/DAE lo resuelven con transform de nodo; OBJ horneado.
  const g = JSON.parse(await (await exportDesign('gltf', POSITIONED, OPTS)).blob.text())
  const roots = g.scenes[0].nodes.map(i => g.nodes[i])
  for (const r of roots) assert.ok(Array.isArray(r.translation), `${r.name} sin translation de ensamble`)
  const [t1, t2] = roots.map(r => r.translation[0])
  assert.notEqual(t1, t2, 'los dos módulos comparten el mismo origen X: se superponen')
  assert.ok(Math.abs(t2 - t1) >= 600, `separación insuficiente entre módulos (${Math.abs(t2 - t1)}mm < ancho de MOD-01)`)

  const dae = await (await exportDesign('dae', POSITIONED, OPTS)).blob.text()
  const tr = [...dae.matchAll(/<translate sid="location">([^<]+)<\/translate>/g)].map(m => m[1])
  assert.equal(tr.length, 2, 'DAE sin translate por módulo')
  assert.notEqual(tr[0], tr[1], 'DAE: módulos en el mismo origen')

  // OBJ: sin transforms de nodo, el offset va horneado → las X de MOD-02 no pisan MOD-01
  const obj = await (await exportDesign('obj', POSITIONED, OPTS)).blob.text()
  const perGroup = {}
  let cur = null
  for (const line of obj.split('\n')) {
    if (line.startsWith('g ')) cur = line.slice(2).trim()
    else if (line.startsWith('v ') && cur) {
      const x = +line.split(/\s+/)[1]
      perGroup[cur] = perGroup[cur] || { min: Infinity, max: -Infinity }
      perGroup[cur].min = Math.min(perGroup[cur].min, x)
      perGroup[cur].max = Math.max(perGroup[cur].max, x)
    }
  }
  assert.ok(perGroup['MOD-01'] && perGroup['MOD-02'], 'OBJ sin grupos por módulo')
  assert.ok(perGroup['MOD-02'].min >= perGroup['MOD-01'].max,
    `OBJ: módulos solapados (M1 hasta ${perGroup['MOD-01'].max}, M2 desde ${perGroup['MOD-02'].min})`)
})

test('3D — módulo aéreo respeta su altura de instalación', async () => {
  const aereo = [{ id: 'AER-01', configuration: { ...cfg(800, 700), moduleType: 'aereo', mountHeight: 1450 },
    pieces: [{ name: 'Lateral', type: 'lateral', width: 350, height: 700, thickness: 18, x: 9, y: 350, z: 175 }] }]
  const g = JSON.parse(await (await exportDesign('gltf', aereo, OPTS)).blob.text())
  const root = g.nodes[g.scenes[0].nodes[0]]
  assert.equal(root.translation[1], 1450, 'el aéreo se exporta apoyado en el piso, no a su altura de montaje')
})

test('DAE / OBJ — jerarquía por pieza preservada', async () => {
  const dae = await (await exportDesign('dae', TWO_MODULES, OPTS)).blob.text()
  assert.ok((dae.match(/<node id="MOD-01"/g) || []).length === 1, 'DAE sin nodo de módulo MOD-01')
  assert.ok((dae.match(/<instance_geometry/g) || []).length > 4, 'DAE aplanado: pocas geometrías')

  const obj = await (await exportDesign('obj', TWO_MODULES, OPTS)).blob.text()
  const objects = (obj.match(/^o /gm) || []).length
  const groups = new Set((obj.match(/^g (.+)$/gm) || []).map(s => s.slice(2)))
  assert.ok(objects > 4, `OBJ aplanado: ${objects} objetos`)
  assert.equal(groups.size, 2, 'OBJ debe agrupar por módulo')
})

// ── 3. Procedencia / metadata ────────────────────────────────────────────────
test('Metadata — todo formato declara proyecto, fecha y unidades', async () => {
  const dxf = await (await exportDesign('dxf', TWO_MODULES, OPTS)).blob.text()
  assert.ok(dxf.includes('QA-Audit'), 'DXF sin nombre de proyecto en el cajetín')
  assert.ok(dxf.includes('$INSUNITS\n70\n4'), 'DXF sin unidades (mm)')

  const obj = await (await exportDesign('obj', TWO_MODULES, OPTS)).blob.text()
  assert.ok(/^# project: QA-Audit$/m.test(obj), 'OBJ sin cabecera de proyecto')
  assert.ok(/^# units: mm/m.test(obj), 'OBJ sin unidades')

  const dae = await (await exportDesign('dae', TWO_MODULES, OPTS)).blob.text()
  assert.ok(dae.includes('<created>') && dae.includes('millimeter'), 'DAE sin created/unit')

  const g = JSON.parse(await (await exportDesign('gltf', TWO_MODULES, OPTS)).blob.text())
  assert.equal(g.asset.extras.units, 'mm', 'glTF sin unidades declaradas')
  // glTF asume METROS por spec: sin este factor el importador escala x1000.
  assert.equal(g.asset.extras.unitScaleToMeters, 0.001, 'glTF sin factor de conversión a metros')

  const cnc = await (await exportDesign('cnc', TWO_MODULES, OPTS)).blob.text()
  assert.ok(cnc.includes('; project: QA-Audit'), 'G-code sin cabecera de proyecto')
  assert.ok(cnc.includes('kerf'), 'G-code sin declarar kerf (el operario no puede validar el corte)')
})

// ── 4. Guardas de robustez ───────────────────────────────────────────────────
test('Guardas — módulo sin configuración no rompe ni emite geometría degenerada', async () => {
  const bare = [{ id: 'MOD-X' }]
  const dxf = await (await exportDesign('dxf', bare, OPTS)).blob.text()
  assert.ok(dxf.includes('EOF'), 'DXF truncado con módulo vacío')
  assert.ok(!/\bNaN\b|Infinity|undefined/.test(dxf), 'DXF con NaN/Infinity/undefined')

  const g = await (await exportDesign('gltf', bare, OPTS)).blob.text()
  assert.ok(!/NaN|Infinity|null,null/.test(g), 'glTF con valores no finitos')
})
