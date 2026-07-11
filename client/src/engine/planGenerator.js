/**
 * Orbin AI — Plan Generator (Plano Ejecutivo)
 * Genera el SVG del plano de montaje/corte desde las piezas reales del módulo.
 * Vistas: alzado frontal + planta superior (vectoriales) + isométrico (PNG del visor,
 * opcional) + lista de cortes + cajetín editable + sello Orbin discreto.
 *
 * PURO: no toca DOM, red ni estado. Devuelve un string SVG (para preview en pantalla
 * o para rasterizar a PDF en el export). Aditivo: nadie lo importa hasta cablear el export.
 *
 * Temas: 'screen' (charcoal/ámbar, visión web) · 'print' (blanco y negro, imprenta).
 */

const PALETTES = {
  screen: {
    bg:'#141518', frame:'#3a3d42', thin:'#5a5e66', text:'#e8eaed', muted:'#9aa0a6',
    accent:'#F5A623', carc:'#F5A623', solid:'rgba(245,166,35,0.26)', light:'rgba(245,166,35,0.07)',
    cell:'#0d0e10', dim:'#c9ced4', vh:'#F5A623', rule:'#33363b', sealC:'#F5A623',
  },
  print: {
    bg:'#ffffff', frame:'#111111', thin:'#111111', text:'#111111', muted:'#666666',
    accent:'#111111', carc:'#111111', solid:'#d9d9d9', light:'#f2f2f2',
    cell:'#e9e9e9', dim:'#111111', vh:'#111111', rule:'#cccccc', sealC:'#111111',
  },
}

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]))
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }

// ── Config normalizada del módulo ──
function cfgOf(module) {
  const c = (module && module.configuration) || {}
  const width = num(c.width, 600), height = num(c.height, 720), depth = num(c.depth, 580)
  const thickness = num(c.thickness, 18), backThickness = num(c.backThickness, 6)
  const numDividers = num(c.numDividers, 0), numShelves = num(c.numShelves, 0)
  const numDrawers = num(c.numDrawers, 0), numDoors = num(c.numDoors, c.hasDoors ? 2 : 0)
  const hasDoors = !!c.hasDoors, baseboard = c.baseboard !== false && c.moduleType !== 'aereo'
  const baseboardHeight = baseboard ? num(c.baseboardHeight, 100) : 0
  const drawerHeight = num(c.drawerHeight, 180)
  const internalWidth = Math.max(0, width - 2 * thickness)
  const compartments = numDividers + 1
  const compW = Math.round((internalWidth - numDividers * thickness) / compartments)
  return { width, height, depth, thickness, backThickness, numDividers, numShelves,
    numDrawers, numDoors, hasDoors, baseboard, baseboardHeight, drawerHeight,
    internalWidth, compartments, compW }
}

// ── Agrupa piezas para la lista de cortes (largo = mayor, ancho = menor) ──
function groupPieces(pieces) {
  const map = new Map()
  for (const p of (pieces || [])) {
    const w = num(p.width || p.w), h = num(p.height || p.h), t = num(p.thickness || p.t, 18)
    if (!w || !h) continue
    const largo = Math.max(w, h), ancho = Math.min(w, h)
    const base = String(p.name || p.type || 'Peça').replace(/\s*\d+$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
    const key = `${base}|${largo}x${ancho}x${t}`
    const qty = num(p.quantity, 1)
    if (map.has(key)) map.get(key).qty += qty
    else map.set(key, { name: base, largo, ancho, t, qty, type: p.type })
  }
  return [...map.values()]
}
function grainLabel(type) {
  if (type === 'fondo' || type === 'drawer_bottom') return 'sem borda'
  if (type === 'lateral' || type === 'divider' || type === 'tamponado') return 'frente · vertical'
  if (type === 'door' || type === 'drawer_front') return 'frente · 4 lados'
  return 'frente · horizontal'
}

// ── Vista: ALZADO FRONTAL (adaptativo a la config) ──
function buildAlzado(cfg, box, P) {
  const scale = Math.min(box.w / cfg.width, box.h / cfg.height)
  const dw = cfg.width * scale, dh = cfg.height * scale
  const ax = box.x, ay = box.y + (box.h - dh)   // apoyar abajo
  const T = cfg.thickness * scale
  const yBot = (mm) => ay + dh - mm * scale       // mm desde el piso -> y svg
  let g = ''
  // carcasa
  g += `<rect x="${ax}" y="${ay}" width="${dw}" height="${dh}" fill="none" stroke="${P.carc}" stroke-width="2"/>`
  g += `<rect x="${ax}" y="${ay}" width="${T}" height="${dh}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  g += `<rect x="${ax + dw - T}" y="${ay}" width="${T}" height="${dh}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  g += `<rect x="${ax + T}" y="${ay}" width="${dw - 2 * T}" height="${T}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  g += `<rect x="${ax + T}" y="${ay + dh - T}" width="${dw - 2 * T}" height="${T}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  // zócalo
  if (cfg.baseboard && cfg.baseboardHeight > 0) {
    const bh = cfg.baseboardHeight * scale
    g += `<rect x="${ax + T}" y="${ay + dh - bh}" width="${dw - 2 * T}" height="${bh}" fill="${P.light}" stroke="${P.thin}" stroke-width="1"/>`
  }
  // divisores + cotas de compartimento
  const inX = ax + T, inW = dw - 2 * T
  const dividerXs = []
  if (cfg.numDividers > 0) {
    const step = inW / cfg.compartments
    for (let i = 1; i <= cfg.numDividers; i++) {
      const dx = inX + step * i - T / 2
      dividerXs.push(dx)
      g += `<rect x="${dx}" y="${ay + T}" width="${T}" height="${dh - 2 * T}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
    }
    // cotas de compartimentos (arriba)
    const edges = [inX, ...dividerXs.map(x => x + T / 2), inX + inW]
    const cy = ay - 16
    for (let i = 0; i < cfg.compartments; i++) {
      const x1 = (i === 0 ? inX : dividerXs[i - 1] + T)
      const x2 = (i === cfg.compartments - 1 ? inX + inW : dividerXs[i])
      g += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<line x1="${x1}" y1="${cy - 4}" x2="${x1}" y2="${cy + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<line x1="${x2}" y1="${cy - 4}" x2="${x2}" y2="${cy + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<text x="${(x1 + x2) / 2}" y="${cy - 5}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${P.text}">${cfg.compW}</text>`
    }
  }
  // gavetas (abajo)
  if (cfg.numDrawers > 0) {
    const cavBot = cfg.baseboardHeight + cfg.thickness
    const cols = 1, rows = cfg.numDrawers
    const dHmm = Math.min(cfg.drawerHeight, (cfg.height - cavBot - cfg.thickness) / rows)
    for (let i = 0; i < rows; i++) {
      const y0 = yBot(cavBot + (i + 1) * dHmm), h = dHmm * scale
      g += `<rect x="${inX + 2}" y="${y0}" width="${inW - 4}" height="${h - 2}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
      g += `<circle cx="${inX + inW / 2}" cy="${y0 + h / 2}" r="2.4" fill="${P.carc}"/>`
    }
  }
  // estantes (líneas horizontales dentro de cada compartimento)
  if (cfg.numShelves > 0 && !cfg.hasDoors) {
    const cavBot = cfg.baseboardHeight + cfg.thickness + (cfg.numDrawers > 0 ? cfg.numDrawers * Math.min(cfg.drawerHeight, 200) : 0)
    const cavTop = cfg.height - cfg.thickness
    const span = cavTop - cavBot
    for (let s = 1; s <= cfg.numShelves; s++) {
      const y = yBot(cavBot + (span * s) / (cfg.numShelves + 1))
      g += `<line x1="${inX}" y1="${y}" x2="${inX + inW}" y2="${y}" stroke="${P.thin}" stroke-width="1.2"/>`
    }
  }
  // puertas (split + tiradores) como overlay ligero
  if (cfg.hasDoors && cfg.numDoors > 0) {
    const doorTopY = ay + T, doorBotY = ay + dh - (cfg.baseboardHeight * scale) - T
    for (let d = 1; d < cfg.numDoors; d++) {
      const x = inX + (inW * d) / cfg.numDoors
      g += `<line x1="${x}" y1="${doorTopY}" x2="${x}" y2="${doorBotY}" stroke="${P.thin}" stroke-width="1" stroke-dasharray="4 3"/>`
    }
    for (let d = 0; d < cfg.numDoors; d++) {
      const cx = inX + (inW * (d + 0.5)) / cfg.numDoors
      const hx = (d < cfg.numDoors / 2) ? cx + (inW / cfg.numDoors) * 0.32 : cx - (inW / cfg.numDoors) * 0.32
      g += `<circle cx="${hx}" cy="${(doorTopY + doorBotY) / 2}" r="2.2" fill="${P.carc}"/>`
    }
  }
  // cota total ancho
  const ty = ay + dh + 16
  g += `<line x1="${ax}" y1="${ty}" x2="${ax + dw}" y2="${ty}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${ax}" y1="${ty - 4}" x2="${ax}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${ax + dw}" y1="${ty - 4}" x2="${ax + dw}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${ax + dw / 2}" y="${ty + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}">${cfg.width}</text>`
  g += `<text x="${ax + dw / 2}" y="${ty + 28}" text-anchor="middle" font-size="10" fill="${P.muted}">interno ${cfg.internalWidth}</text>`
  // cota alto
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay + dh}" x2="${hx + 4}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dh / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dh / 2})">${cfg.height}</text>`
  return g
}

// ── Vista: PLANTA SUPERIOR ──
function buildPlanta(cfg, box, P) {
  const scale = Math.min(box.w / cfg.width, box.h / cfg.depth)
  const dw = cfg.width * scale, dd = cfg.depth * scale
  const ax = box.x, ay = box.y
  const T = cfg.thickness * scale
  let g = `<rect x="${ax}" y="${ay}" width="${dw}" height="${dd}" fill="${P.light}" stroke="${P.carc}" stroke-width="1"/>`
  g += `<rect x="${ax}" y="${ay}" width="${dw}" height="${T}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  if (cfg.numDividers > 0) {
    const inX = ax + T, inW = dw - 2 * T, step = inW / cfg.compartments
    for (let i = 1; i <= cfg.numDividers; i++) {
      const x = inX + step * i
      g += `<line x1="${x}" y1="${ay}" x2="${x}" y2="${ay + dd}" stroke="${P.thin}" stroke-width="1"/>`
    }
  }
  g += `<text x="${ax + dw / 2}" y="${ay + dd / 2 + 4}" text-anchor="middle" font-size="10" fill="${P.muted}">fondo ${cfg.backThickness} mm</text>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dd}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay + dd}" x2="${hx + 4}" y2="${ay + dd}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dd / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dd / 2})">${cfg.depth}</text>`
  return g
}

// ── Cajetín (todos los campos editables vía options.company) ──
function buildCajetin(company, cfg, pieceCount, P) {
  const co = company || {}
  const f = (k, v) => `<text x="0" y="0" font-size="8.5" fill="${P.muted}" letter-spacing=".4">${esc(k)}</text><text x="0" y="13" font-size="11" font-weight="600" fill="${P.text}">${esc(v)}</text>`
  let g = ''
  g += `<g transform="translate(708,26)">${f('EMPRESA', co.empresa || co.name || 'Sua Marcenaria')}</g>`
  g += `<g transform="translate(708,58)">${f('SETOR', co.setor || 'Montagem')}</g>`
  g += `<g transform="translate(832,26)">${f('MATERIAL', co.material || `MDF ${cfg.thickness} mm`)}</g>`
  g += `<g transform="translate(832,58)">${f('DESENHISTA', co.desenhista || '—')}</g>`
  g += `<g transform="translate(924,26)">${f('PEÇAS', String(pieceCount))}</g>`
  g += `<g transform="translate(924,58)">${f('DATA', co.data || new Date().toLocaleDateString('pt-BR'))}</g>`
  return g
}

// ── Lista de cortes ──
function buildCutlist(rows, P, y0) {
  let g = `<line x1="16" y1="${y0}" x2="984" y2="${y0}" fill="none" stroke="${P.frame}" stroke-width="1.4"/>`
  g += `<text x="36" y="${y0 + 22}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">LISTA DE CORTES — ${rows.reduce((a, r) => a + r.qty, 0)} peças</text>`
  const tx = 36, ty = y0 + 40
  g += `<g transform="translate(${tx},${ty})" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${P.muted}">`
  g += `<text x="0" y="0">PEÇA</text><text x="300" y="0" text-anchor="middle">QTD</text><text x="420" y="0">LARGO × ALTO</text><text x="640" y="0" text-anchor="middle">ESP.</text><text x="730" y="0">BORDA / GRÃO</text></g>`
  g += `<line x1="${tx}" y1="${ty + 10}" x2="${tx + 912}" y2="${ty + 10}" stroke="${P.rule}" stroke-width="1"/>`
  const maxRows = 6
  const trunc = rows.length > maxRows
  const shown = trunc ? rows.slice(0, maxRows - 1) : rows.slice(0, maxRows)
  const rowStep = 20, rowTop = ty + 28
  shown.forEach((r, i) => {
    const ry = rowTop + i * rowStep
    g += `<g transform="translate(${tx},${ry})" font-size="11" fill="${P.text}">`
    g += `<text x="0" y="0">${esc(r.name)}</text><text x="300" y="0" text-anchor="middle">${r.qty}</text>`
    g += `<text x="420" y="0">${r.largo} × ${r.ancho}</text><text x="640" y="0" text-anchor="middle">${r.t}</text>`
    g += `<text x="730" y="0" fill="${P.muted}">${esc(grainLabel(r.type))}</text></g>`
    if (i < shown.length - 1) g += `<line x1="${tx}" y1="${ry + 10}" x2="${tx + 912}" y2="${ry + 10}" stroke="${P.rule}" stroke-width="1"/>`
  })
  if (trunc) g += `<text x="${tx}" y="${rowTop + (maxRows - 1) * rowStep}" font-size="10" fill="${P.muted}">+ ${rows.length - (maxRows - 1)} peça(s) — ver CSV completo</text>`
  return g
}

function sheetHeader(title, subtitle, P) {
  let g = `<rect x="0" y="0" width="1000" height="740" fill="${P.bg}"/>`
  g += `<rect x="16" y="16" width="968" height="708" fill="none" stroke="${P.frame}" stroke-width="1.4"/>`
  g += `<line x1="16" y1="92" x2="984" y2="92" stroke="${P.frame}" stroke-width="1.4"/>`
  g += `<line x1="694" y1="16" x2="694" y2="92" stroke="${P.thin}" stroke-width="1"/>`
  g += `<text x="36" y="44" font-size="15" font-weight="800" fill="${P.text}">${esc(title)}</text>`
  g += `<text x="36" y="63" font-size="11" fill="${P.muted}">${esc(subtitle)}</text>`
  return g
}
function orbinSeal(P) {
  return `<g transform="translate(968,716)" text-anchor="end"><text font-size="9" fill="${P.muted}" opacity="0.42" letter-spacing="1">gerado com <tspan font-weight="800" fill="${P.sealC}" opacity="0.6">◆ orbin</tspan></text></g>`
}

// ══ API pública ══

// Plano detallado de UN módulo (3 vistas + cortes)
export function generateModulePlanSVG(module, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const cfg = cfgOf(module)
  const rows = groupPieces(module && module.pieces)
  const pieceCount = rows.reduce((a, r) => a + r.qty, 0)
  const label = (module && module.configuration && module.configuration.moduleType) || (module && module.type) || 'Módulo'
  let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
  s += sheetHeader(`PLANO DE MONTAGEM — ${label}`, `Motor paramétrico Orbin · medidas reais · mm · MDF ${cfg.thickness} mm`, P)
  s += buildCajetin(options.company, cfg, pieceCount, P)
  s += `<text x="36" y="116" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">1 · ALZADO FRONTAL</text>`
  s += buildAlzado(cfg, { x: 78, y: 138, w: 440, h: 168 }, P)
  s += `<text x="36" y="392" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">2 · PLANTA SUPERIOR</text>`
  s += buildPlanta(cfg, { x: 78, y: 408, w: 440, h: 110 }, P)
  s += `<text x="812" y="132" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">3 · ISOMÉTRICO</text>`
  if (options.isoDataURL) {
    s += `<image x="640" y="146" width="330" height="250" href="${options.isoDataURL}" preserveAspectRatio="xMidYMid meet"/>`
  } else {
    s += `<rect x="660" y="150" width="300" height="230" fill="${P.light}" stroke="${P.thin}" stroke-width="1" stroke-dasharray="5 4"/>`
    s += `<text x="810" y="270" text-anchor="middle" font-size="10" fill="${P.muted}">captura 3D (gris CAD)</text>`
  }
  s += buildCutlist(rows, P, 540)
  s += orbinSeal(P)
  s += `</svg>`
  return s
}

// Vista de CONJUNTO: alzado frontal de todos los módulos alineados + cortes consolidados
export function generateConjuntoPlanSVG(modules, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const mods = (modules || []).filter(Boolean)
  const totalW = mods.reduce((a, m) => a + cfgOf(m).width, 0) || 1
  const maxH = Math.max(1, ...mods.map(m => cfgOf(m).height))
  let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
  s += sheetHeader(`PLANO DE CONJUNTO — ${mods.length} módulos`, `Vista frontal do conjunto · largura total ${totalW} mm`, P)
  const allRows = groupPieces(mods.flatMap(m => (m && m.pieces) || []))
  s += buildCajetin(options.company, cfgOf(mods[0] || {}), allRows.reduce((a, r) => a + r.qty, 0), P)
  // banda de alzados alineados a piso
  const areaX = 60, areaW = 880, areaY = 130, areaH = 300
  const scale = Math.min(areaW / totalW, areaH / maxH)
  let cx = areaX
  s += `<text x="36" y="118" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">VISTA FRONTAL DO CONJUNTO</text>`
  mods.forEach((m) => {
    const c = cfgOf(m)
    const bw = c.width * scale, bh = c.height * scale
    s += buildAlzado(c, { x: cx, y: areaY, w: bw, h: bh }, P)
    cx += bw + 6
  })
  s += buildCutlist(allRows, P, 540)
  s += orbinSeal(P)
  s += `</svg>`
  return s
}

export default generateModulePlanSVG
