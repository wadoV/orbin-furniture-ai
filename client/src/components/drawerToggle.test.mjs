/**
 * CANDADO — clic en el frente de gaveta la abre/cierra (Viewer3D).
 * ─────────────────────────────────────────────────────────────────────────────
 * Esta función se rompe SIN romper nada visible: el clic sigue seleccionando la
 * pieza, el build pasa, ningún test falla. Sólo deja de abrirse la gaveta, y eso
 * se descubre mirando la pantalla — o peor, con la cámara grabando.
 *
 * Historia: el "A1 FIX" namespaceó la clave con design.id (correcto) y ADEMÁS
 * agregó `useEffect(() => setOpenDrawers(new Set()), [selectedModuleId])`. Como el
 * handler del clic hace `onSelectModule(...)` y `setOpenDrawers(toggle)` en el mismo
 * batch, ese efecto vaciaba el Set inmediatamente después de abrir → el primer clic
 * no hacía nada. Este candado impide que ese patrón vuelva.
 *
 * Es un test ESTÁTICO sobre el código fuente: la alternativa (montar Three.js +
 * WebGL + React en jsdom) no corre en CI y un candado que no puede ejecutarse
 * miente diciendo "pass".
 */
import assert from 'node:assert'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Viewer3D.jsx'), 'utf8')

test('el clic sobre una pieza con drawerKey togglea openDrawers', () => {
  assert.match(SRC, /const\s*\{[^}]*drawerKey[^}]*\}\s*=\s*mesh\.userData/,
    'el handler de clic ya no lee drawerKey de la pieza clicada')
  assert.match(SRC, /if\s*\(drawerKey\)\s*\{[\s\S]{0,200}setOpenDrawers/,
    'el clic sobre una gaveta ya no llama a setOpenDrawers')
})

test('el bucle de render desplaza las piezas de la gaveta abierta', () => {
  assert.match(SRC, /drawerKey\s*&&\s*st\.openDrawers\.has\(\s*ud\.drawerKey\s*\)/,
    'el render ya no consulta openDrawers: la gaveta no se movería aunque el estado cambie')
  assert.match(SRC, /openDrawers\.has\(\s*ud\.drawerKey\s*\)\s*\)\s*\{[\s\S]{0,160}new THREE\.Vector3\(\s*0\s*,\s*0\s*,/,
    'la gaveta abierta ya no se desplaza en Z (eje de profundidad)')
})

test('★ REGRESIÓN: nada puede vaciar openDrawers al cambiar de módulo seleccionado', () => {
  // El patrón exacto que rompía: un efecto dependiente de selectedModuleId que
  // resetea el Set. Con las claves namespaceadas por design.id no hace falta.
  const efectos = [...SRC.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/g)]
  for (const [, cuerpo, deps] of efectos) {
    if (!/setOpenDrawers/.test(cuerpo)) continue
    assert.ok(!/selectedModuleId/.test(deps),
      'un useEffect que toca openDrawers depende de selectedModuleId: vaciará el Set ' +
      'en el mismo batch del clic y la gaveta no abrirá al primer clic')
    assert.ok(!/setOpenDrawers\(\s*new Set\(\s*\)\s*\)/.test(cuerpo),
      'reset destructivo de openDrawers: filtrá las claves huérfanas en vez de vaciar todo')
  }
})

test('las claves de gaveta están namespaceadas por módulo (sin colisión entre módulos)', () => {
  const claves = [...SRC.matchAll(/const\s+dKey\s*=\s*`([^`]+)`/g)].map(m => m[1])
  assert.ok(claves.length >= 3, `se esperaban ≥3 sitios que construyen dKey, hay ${claves.length}`)
  for (const k of claves) {
    assert.ok(k.includes('${design.id}'),
      `clave de gaveta sin design.id ("${k}"): dos módulos compartirían clave y ` +
      'abrir una gaveta abriría la del módulo vecino')
  }
})

test('frente y caja de la misma gaveta comparten clave (se mueven juntos)', () => {
  // Todo makeMesh de un drawer_front debe recibir dKey, y el addDrawerBox contiguo también.
  const fronts = [...SRC.matchAll(/makeMesh\([^)]*'drawer_front'\s*,\s*(\w+)\s*\)/g)].map(m => m[1])
  assert.ok(fronts.length >= 3, `frentes de gaveta sin clave: ${fronts.length} encontrados`)
  for (const arg of fronts) {
    assert.equal(arg, 'dKey', `un frente de gaveta recibe "${arg}" en vez de dKey`)
  }
  // Ojo: las llamadas llevan paréntesis anidados (`toV(...)`, `?? (...)`), así que
  // no sirve `[^)]*` — se comprueba por línea, sobre el último argumento.
  const cajas = SRC.split('\n').filter(l => /\baddDrawerBox\(/.test(l))
  assert.ok(cajas.length >= 3, `llamadas a addDrawerBox encontradas: ${cajas.length}`)
  for (const l of cajas) {
    assert.match(l, /,\s*dKey\s*\)/,
      `la caja de la gaveta no recibe dKey → se abriría el frente y la caja quedaría dentro:\n    ${l.trim()}`)
  }
})

test('las PUERTAS no llevan drawerKey (es lo que distingue gaveta de puerta)', () => {
  const puertas = [...SRC.matchAll(/makeMesh\(([^)]*'standard_door'[^)]*)\)/g)].map(m => m[1])
  assert.ok(puertas.length >= 1, 'no se encontró la construcción de puertas')
  for (const args of puertas) {
    assert.ok(!/dKey/.test(args),
      'una puerta recibe dKey: se abriría deslizando como gaveta y se pierde la ' +
      'distinción visual entre puerta y gaveta')
  }
})
