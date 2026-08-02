/**
 * BANCO DE PRUEBAS — guion de prompts para el VIDEO PROMOCIONAL.
 * No es test de CI: es una sonda. Corre el camino REAL (parseNaturalLanguage →
 * generateProject → validateDesign) sobre los prompts que se van a teclear EN
 * CÁMARA, y verifica además REALISMO DE CARPINTERÍA: un frente de gaveta de 2.36m
 * pasa todos los tests del repo y aun así hace que un marcenaria cierre el video.
 *
 * Uso: node src/engine/_videoPrompts.probe.js
 */
const { parseNaturalLanguage } = require('./nlParser')
const { generateProject } = require('./closetEngine')
const { validateDesign } = require('./validator')

// Umbrales de PLAUSIBILIDAD (no son reglas del motor; son lo que un carpintero
// mira). Calibrados contra la sonda: corredera telescópica comercial ~1200mm;
// una puerta batiente de más de 700mm se descuelga; corrediza sí admite ~1250.
const LIM = { gavetaAncho: 1200, gavetaRatio: 7, puertaBatiente: 700, puertaCorrediza: 1300 }

const GUION = [
  { esc: 'E1 · CLOSET (hero shot)', lang: 'ES',
    p: 'Closet de 2.40m de ancho, 2.40m de alto y 60cm de fondo con 6 repisas y puertas corredizas' },
  { esc: 'E1 · CLOSET (hero shot)', lang: 'PT',
    p: 'Guarda-roupa 2.40m de largura, 2.40m de altura, 60cm de profundidade com 6 prateleiras e portas de correr' },

  { esc: 'E2 · ESCRITORIO', lang: 'ES',
    p: 'Escritorio de 1.60m de ancho, 75cm de alto y 60cm de fondo con 3 cajones' },
  { esc: 'E2 · ESCRITORIO', lang: 'PT',
    p: 'Escrivaninha 1.60m de largura, 75cm de altura, 60cm de profundidade com 3 gavetas' },

  // ── E3 · COCINA PEQUEÑA: un prompt POR MÓDULO (4 módulos, ~2.8m lineales) ──
  { esc: 'E3 · COCINA 1/4 bajo', lang: 'ES',
    p: 'Mueble bajo de cocina de 80cm de ancho, 90cm de alto y 60cm de fondo con 3 cajones y encimera' },
  { esc: 'E3 · COCINA 2/4 bajo', lang: 'ES',
    p: 'Mueble bajo de cocina de 60cm de ancho, 90cm de alto y 60cm de fondo con 2 puertas y encimera' },
  { esc: 'E3 · COCINA 3/4 aéreo', lang: 'ES',
    p: 'Módulo aéreo de cocina de 80cm de ancho, 70cm de alto y 35cm de fondo con 2 puertas, instalado a 1450mm del piso' },
  { esc: 'E3 · COCINA 4/4 aéreo', lang: 'ES',
    p: 'Módulo aéreo de cocina de 60cm de ancho, 70cm de alto y 35cm de fondo con 1 puerta, instalado a 1450mm del piso' },
  { esc: 'E3 · COCINA 1/4 bajo', lang: 'PT',
    p: 'Balcão de cozinha 80cm de largura, 90cm de altura, 60cm de profundidade com 3 gavetas e bancada' },
  { esc: 'E3 · COCINA 3/4 aéreo', lang: 'PT',
    p: 'Módulo aéreo de cozinha 80cm de largura, 70cm de altura, 35cm de profundidade com 2 portas, instalado a 1450mm do piso' },

  { esc: 'E4 · CÓMODA (gavetas)', lang: 'ES',
    p: 'Cómoda de 90cm de ancho, 1.10m de alto y 50cm de fondo con 4 cajones, sin puertas' },
  { esc: 'E4 · CÓMODA (gavetas)', lang: 'PT',
    p: 'Gaveteiro 90cm de largura, 1.10m de altura, 50cm de profundidade com 4 gavetas, sem portas' },

  { esc: 'E5 · ESTANTERÍA', lang: 'ES',
    p: 'Estantería de 1.80m de ancho, 2m de alto y 35cm de fondo con 5 repisas, sin puertas' },
  { esc: 'E5 · ESTANTERÍA', lang: 'PT',
    p: 'Estante 1.80m de largura, 2m de altura, 35cm de profundidade com 5 prateleiras, sem portas' },
]

let fallos = 0, irreales = 0
for (const g of GUION) {
  const { params, confidence, interpreted, specAdjustments = [] } = parseNaturalLanguage(g.p)
  let o
  try { o = generateProject(params) } catch (e) { console.log(`✗ ${g.esc}: MOTOR ROTO ${e.message}`); fallos++; continue }
  const c = o.configuration
  const fr = o.pieces.filter(x => x.type === 'drawer_front')
  const dr = o.pieces.filter(x => /door/.test(x.type))
  const sliding = c.doorType === 'sliding'

  // Realismo de taller
  const flags = []
  for (const f of fr) {
    if (f.width > LIM.gavetaAncho) flags.push(`gaveta ${f.width}mm supera corredera (${LIM.gavetaAncho})`)
    if (f.width / f.height > LIM.gavetaRatio) flags.push(`gaveta ${f.width}×${f.height} ratio ${(f.width / f.height).toFixed(1)}:1`)
  }
  const limP = sliding ? LIM.puertaCorrediza : LIM.puertaBatiente
  for (const d of dr) if (d.width > limP) flags.push(`puerta ${sliding ? 'corrediza' : 'batiente'} ${d.width}mm`)
  if (flags.length) irreales++

  const v = (() => { try { return validateDesign(o) } catch { return null } })()
  const ok = !v || (v.valid !== false && v.status !== 'RECHAZADO')
  if (!ok) fallos++

  console.log(`\n▸ ${g.esc}  [${g.lang}]`)
  console.log(`  "${g.p}"`)
  console.log(`  → ${c.width}×${c.height}×${c.depth}mm · tipo=${c.moduleType}/${c.type} · gav=${c.numDrawers} rep=${c.numShelves} pta=${c.numDoors}${sliding ? ' (corrediza)' : ''}` +
    `${c.mountHeight ? ' · mount=' + c.mountHeight + 'mm' : ''} · conf=${confidence}`)
  console.log(`  → ${o.pieces.length} piezas · ${o.cutList.length} cortes · validator ${ok ? '✓ VALIDADO' : '✗ RECHAZADO'}`)
  if (fr.length) console.log(`  → frentes gaveta: ${fr[0].width}×${fr[0].height}mm`)
  if (dr.length) console.log(`  → puertas: ${dr.length} × ${dr[0].width}×${dr[0].height}mm`)
  const adj = [...specAdjustments, ...(o.specAdjustments || [])]
  for (const a of adj) console.log(`  ⚠ EN PANTALLA [${a.severity}] ${a.code}: ${(a.message || '').slice(0, 88)}`)
  console.log(flags.length ? `  ✗ NO GRABAR — ${[...new Set(flags)].join(' · ')}` : `  ✓ plausible en taller`)
}
console.log('\n' + '═'.repeat(74))
console.log(`motor: ${fallos ? '✗ ' + fallos + ' fallo(s)' : '✓ sin fallos'} · realismo: ${irreales ? '✗ ' + irreales + ' irreal(es)' : '✓ todos plausibles'}`)
