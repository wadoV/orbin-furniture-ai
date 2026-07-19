/**
 * Orbin AI — Plan Generator (Plano Ejecutivo)
 * Genera el SVG del plano de montaje/corte desde las piezas reales del módulo.
 * Vistas: alzado frontal + planta superior + isométrico (captura gris CAD) +
 * lista de cortes + cajetín editable + sello Orbin discreto.
 *
 * PURO: no toca DOM, red ni estado. Devuelve un string SVG.
 * i18n: options.lang ∈ {PT, ES, EN}. Dict autocontenido (no depende de i18n.js).
 * Temas: 'screen' (charcoal/ámbar) · 'print' (blanco y negro).
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

// ── i18n del plano (autocontenido) ──────────────────────────────────────────
const PLAN_I18N = {
  PT: {
    locale:'pt-BR',
    title_module:'PLANO DE MONTAGEM', title_conjunto:'PLANO DE CONJUNTO',
    modules_word:'módulos',
    subtitle:'Motor paramétrico Orbin · medidas reais · mm · MDF {t} mm',
    subtitle_conjunto:'Vista frontal do conjunto · largura total {w} mm',
    view_alzado:'ALÇADO FRONTAL', view_planta:'PLANTA SUPERIOR', view_iso:'ISOMÉTRICO',
    avisos:'OBSERVAÇÕES',
    view_conjunto:'VISTA FRONTAL DO CONJUNTO',
    internal:'interno', depth_abbr:'prof.', back_word:'fundo {bt} mm',
    iso_placeholder:'captura 3D (linhas pretas · com volume)',
    cutlist:'LISTA DE CORTES', pieces:'peças',
    col_piece:'PEÇA', col_qty:'QTD', col_dims:'COMP × ALT', col_thick:'ESP.', col_edge:'BORDA / GRÃO',
    more_pieces:'+ {n} peça(s) — ver CSV completo',
    seal:'gerado com',
    cj_empresa:'EMPRESA', cj_setor:'SETOR', cj_material:'MATERIAL', cj_desenhista:'DESENHISTA',
    cj_pecas:'PEÇAS', cj_data:'DATA',
    def_empresa:'Sua Marcenaria', def_setor:'Montagem',
    grain_none:'sem borda', grain_vert:'frente · vertical', grain_4:'frente · 4 lados', grain_horiz:'frente · horizontal',
  },
  ES: {
    locale:'es-ES',
    title_module:'PLANO DE MONTAJE', title_conjunto:'PLANO DE CONJUNTO',
    modules_word:'módulos',
    subtitle:'Motor paramétrico Orbin · medidas reales · mm · MDF {t} mm',
    subtitle_conjunto:'Vista frontal del conjunto · ancho total {w} mm',
    view_alzado:'ALZADO FRONTAL', view_planta:'PLANTA SUPERIOR', view_iso:'ISOMÉTRICO',
    avisos:'OBSERVACIONES',
    view_conjunto:'VISTA FRONTAL DEL CONJUNTO',
    internal:'interno', depth_abbr:'prof.', back_word:'fondo {bt} mm',
    iso_placeholder:'captura 3D (líneas negras · con volumen)',
    cutlist:'LISTA DE CORTES', pieces:'piezas',
    col_piece:'PIEZA', col_qty:'CANT', col_dims:'LARGO × ALTO', col_thick:'ESP.', col_edge:'CANTO / VETA',
    more_pieces:'+ {n} pieza(s) — ver CSV completo',
    seal:'generado con',
    cj_empresa:'EMPRESA', cj_setor:'SECTOR', cj_material:'MATERIAL', cj_desenhista:'DISEÑADOR',
    cj_pecas:'PIEZAS', cj_data:'FECHA',
    def_empresa:'Tu Carpintería', def_setor:'Montaje',
    grain_none:'sin canto', grain_vert:'frente · vertical', grain_4:'frente · 4 lados', grain_horiz:'frente · horizontal',
  },
  EN: {
    locale:'en-US',
    title_module:'ASSEMBLY PLAN', title_conjunto:'ASSEMBLY OVERVIEW',
    modules_word:'modules',
    subtitle:'Orbin parametric engine · real dimensions · mm · MDF {t} mm',
    subtitle_conjunto:'Front view of assembly · total width {w} mm',
    view_alzado:'FRONT ELEVATION', view_planta:'TOP VIEW', view_iso:'ISOMETRIC',
    avisos:'NOTES',
    view_conjunto:'FRONT VIEW — ASSEMBLY',
    internal:'internal', depth_abbr:'depth', back_word:'back {bt} mm',
    iso_placeholder:'3D capture (black lines · with volume)',
    cutlist:'CUT LIST', pieces:'pieces',
    col_piece:'PIECE', col_qty:'QTY', col_dims:'LENGTH × HEIGHT', col_thick:'THK.', col_edge:'EDGE / GRAIN',
    more_pieces:'+ {n} piece(s) — see full CSV',
    seal:'generated with',
    cj_empresa:'COMPANY', cj_setor:'SECTOR', cj_material:'MATERIAL', cj_desenhista:'DESIGNER',
    cj_pecas:'PIECES', cj_data:'DATE',
    def_empresa:'Your Workshop', def_setor:'Assembly',
    grain_none:'no edge', grain_vert:'front · vertical', grain_4:'front · 4 sides', grain_horiz:'front · horizontal',
  },
}
const LX = (lang) => PLAN_I18N[lang] || PLAN_I18N.PT

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
function grainLabel(type, D) {
  if (type === 'fondo' || type === 'drawer_bottom') return D.grain_none
  if (type === 'lateral' || type === 'divider' || type === 'tamponado') return D.grain_vert
  if (type === 'door' || type === 'drawer_front') return D.grain_4
  return D.grain_horiz
}

// ── Vista desde captura del visor (gris CAD) + cotas vectoriales alineadas ──
function alzadoFromCapture(cfg, box, P, cap, D) {
  const scale = Math.min(box.w / cfg.width, box.h / cfg.height)
  const dw = cfg.width * scale, dh = cfg.height * scale
  const ax = box.x + (box.w - dw) / 2, ay = box.y + (box.h - dh)
  const fx = cap.fx || 1, fy = cap.fy || 1
  const imgW = dw / fx, imgH = dh / fy
  const imgX = ax - (imgW - dw) / 2, imgY = ay - (imgH - dh) / 2
  let g = `<image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" href="${cap.url}" preserveAspectRatio="none"/>`
  if (cfg.numDividers > 0) {
    const cy = ay - 16, seg = dw / cfg.compartments
    for (let i = 0; i < cfg.compartments; i++) {
      const x1 = ax + seg * i, x2 = ax + seg * (i + 1)
      g += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<line x1="${x1}" y1="${cy-4}" x2="${x1}" y2="${cy+4}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<line x1="${x2}" y1="${cy-4}" x2="${x2}" y2="${cy+4}" stroke="${P.dim}" stroke-width="0.8"/>`
      g += `<text x="${(x1+x2)/2}" y="${cy-5}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${P.text}">${cfg.compW}</text>`
    }
  }
  const ty = ay + dh + 16
  g += `<line x1="${ax}" y1="${ty}" x2="${ax+dw}" y2="${ty}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${ax}" y1="${ty-4}" x2="${ax}" y2="${ty+4}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${ax+dw}" y1="${ty-4}" x2="${ax+dw}" y2="${ty+4}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${ax+dw/2}" y="${ty+15}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}">${cfg.width}</text><text x="${ax+dw/2}" y="${ty+28}" text-anchor="middle" font-size="10" fill="${P.muted}">${D.internal} ${cfg.internalWidth}</text>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay+dh}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx-4}" y1="${ay}" x2="${hx+4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx-4}" y1="${ay+dh}" x2="${hx+4}" y2="${ay+dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx-9}" y="${ay+dh/2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx-9} ${ay+dh/2})">${cfg.height}</text>`
  return g
}
function plantaFromCapture(cfg, box, P, cap, D) {
  const scale = Math.min(box.w / cfg.width, box.h / cfg.depth)
  const dw = cfg.width * scale, dd = cfg.depth * scale
  const ax = box.x + (box.w - dw) / 2, ay = box.y
  const fx = cap.fx || 1, fy = cap.fy || 1
  const imgW = dw / fx, imgH = dd / fy
  const imgX = ax - (imgW - dw) / 2, imgY = ay - (imgH - dd) / 2
  let g = `<image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" href="${cap.url}" preserveAspectRatio="none"/>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay+dd}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx-4}" y1="${ay}" x2="${hx+4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx-4}" y1="${ay+dd}" x2="${hx+4}" y2="${ay+dd}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx-9}" y="${ay+dd/2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx-9} ${ay+dd/2})">${cfg.depth}</text>`
  // Rótulo redundante eliminado: el ancho ya está acotado en el alzado y la
  // profundidad en la cota izquierda de esta misma vista. Escrito en ay-10
  // pisaba el título "2 · PLANTA SUPERIOR".
  return g
}

// ── Vista: ALZADO FRONTAL (adaptativo a la config) ──
function buildAlzado(origCfg, box, P, cap, D) {
  // CLONACIÓN Y MUTACIÓN ADITIVA DE REGLAS DE DIBUJO
  const cfg = { ...origCfg };
  if (cfg.showDoors === false) {
    cfg.hasDoors = false;
    cfg.numDoors = 0;
  }
  if (cfg.hasRodapie === false || cfg.hasPlinth === false) {
    if (cfg.baseboard && cfg.baseboardHeight > 0) {
      cfg.height -= cfg.baseboardHeight;
      cfg.baseboard = false;
      cfg.baseboardHeight = 0;
    }
  }

  if (cap && cap.url) return alzadoFromCapture(cfg, box, P, cap, D)
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
    const rows = cfg.numDrawers
    const dHmm = Math.min(cfg.drawerHeight, (cfg.height - cavBot - cfg.thickness) / rows)
    for (let i = 0; i < rows; i++) {
      const y0 = yBot(cavBot + (i + 1) * dHmm), h = dHmm * scale
      g += `<rect x="${inX + 2}" y="${y0}" width="${inW - 4}" height="${h - 2}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
      g += `<circle cx="${inX + inW / 2}" cy="${y0 + h / 2}" r="2.4" fill="${P.carc}"/>`
    }
  }
  // estantes
  if (cfg.numShelves > 0 && !cfg.hasDoors) {
    const cavBot = cfg.baseboardHeight + cfg.thickness + (cfg.numDrawers > 0 ? cfg.numDrawers * Math.min(cfg.drawerHeight, 200) : 0)
    const cavTop = cfg.height - cfg.thickness
    const span = cavTop - cavBot
    for (let s = 1; s <= cfg.numShelves; s++) {
      const y = yBot(cavBot + (span * s) / (cfg.numShelves + 1))
      g += `<line x1="${inX}" y1="${y}" x2="${inX + inW}" y2="${y}" stroke="${P.thin}" stroke-width="1.2"/>`
    }
  }
  // puertas
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
  g += `<text x="${ax + dw / 2}" y="${ty + 28}" text-anchor="middle" font-size="10" fill="${P.muted}">${D.internal} ${cfg.internalWidth}</text>`
  // cota alto
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay + dh}" x2="${hx + 4}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dh / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dh / 2})">${cfg.height}</text>`
  return g
}

// ── Vista: PLANTA SUPERIOR ──
function buildPlanta(cfg, box, P, cap, D) {
  if (cap && cap.url) return plantaFromCapture(cfg, box, P, cap, D)
  const scale = Math.min(box.w / cfg.width, box.h / cfg.depth)
  const dw = cfg.width * scale, dd = cfg.depth * scale
  // Centrada como el alzado: en proyección ortográfica ambas vistas comparten eje.
  const ax = box.x + (box.w - dw) / 2, ay = box.y
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
  g += `<text x="${ax + dw / 2}" y="${ay + dd / 2 + 4}" text-anchor="middle" font-size="10" fill="${P.muted}">${D.back_word.replace('{bt}', cfg.backThickness)}</text>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dd}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay + dd}" x2="${hx + 4}" y2="${ay + dd}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dd / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dd / 2})">${cfg.depth}</text>`
  return g
}

// ── Cajetín ──────────────────────────────────────────────────────────────────
// Geometría de los campos EDITABLES, en coordenadas del viewBox (1000×740).
// El exportador de PDF la usa para superponer campos AcroForm reales: sin esta
// tabla habría números mágicos duplicados entre el SVG y el PDF.
export const PLAN_VIEWBOX = { w: 1000, h: 740 }
export const CAJETIN_FIELDS = {
  empresa:    { x: 708, y: 28, w: 118, h: 16 },
  setor:      { x: 708, y: 60, w: 118, h: 16 },
  desenhista: { x: 832, y: 60, w: 86,  h: 16 },
  data:       { x: 924, y: 60, w: 58,  h: 16 },
}

function buildCajetin(company, cfg, pieceCount, P, D, editable) {
  const co = company || {}
  const trunc = (str, len) => (str && str.length > len) ? str.substring(0, len - 1) + '…' : str;
  const f = (k, v, maxL = 22) => `<text x="0" y="0" font-size="8.5" fill="${P.muted}" letter-spacing=".4">${esc(k)}</text><text x="0" y="13" font-size="11" font-weight="600" fill="${P.text}">${esc(trunc(v, maxL))}</text>`
  // Campo intencionalmente vacío: el valor lo aporta un campo AcroForm editable
  // superpuesto en el PDF. Si lo rasterizáramos aquí, el texto quedaría "quemado"
  // debajo del campo y el marcenario vería el nombre viejo por detrás.
  const fEdit = (k, w) => `<text x="0" y="0" font-size="8.5" fill="${P.muted}" letter-spacing=".4">${esc(k)}</text>` +
                          `<line x1="0" y1="17" x2="${w}" y2="17" stroke="${P.rule}" stroke-width="0.8"/>`
  const F = CAJETIN_FIELDS
  let g = ''
  g += `<g transform="translate(708,26)">${editable ? fEdit(D.cj_empresa, F.empresa.w) : f(D.cj_empresa, co.empresa || co.name || D.def_empresa, 18)}</g>`
  g += `<g transform="translate(708,58)">${editable ? fEdit(D.cj_setor, F.setor.w) : f(D.cj_setor, co.setor || D.def_setor, 18)}</g>`
  g += `<g transform="translate(832,26)">${f(D.cj_material, co.material || `MDF ${cfg.thickness} mm`, 12)}</g>`
  g += `<g transform="translate(832,58)">${editable ? fEdit(D.cj_desenhista, F.desenhista.w) : f(D.cj_desenhista, co.desenhista || '—', 12)}</g>`
  g += `<g transform="translate(924,26)">${f(D.cj_pecas, String(pieceCount), 8)}</g>`
  g += `<g transform="translate(924,58)">${editable ? fEdit(D.cj_data, F.data.w) : f(D.cj_data, co.data || new Date().toLocaleDateString(D.locale), 12)}</g>`
  return g
}

// ── Reparto vertical de la columna izquierda (alzado + planta) ───────────────
// CAUSA RAÍZ del "alzado desfigurado": la caja del alzado era fija (440×168) y
// buildAlzado escala con min(w/ancho, h/alto). En un mueble alto (2400mm) mandaba
// el alto → escala 0.07 → dibujo de 168px ahogado por cotas de 11px fijas.
// Ahora el alzado —la vista que se usa para fabricar— tiene prioridad y la planta
// se acota: solo necesita representar la profundidad, casi siempre << el alto.
function planLayout(cfg) {
  const X = 78, W = 440, TOP = 100, BOT = 530
  // Canales de anotación reservados. El alzado escribe su cota de ancho POR DEBAJO
  // del dibujo: línea a +16, medida a +31, interno a +44 ⇒ necesita ~50px libres.
  // Sin reservarlos, esa cota invadía el título de la planta (amontonamiento).
  const TITLE_H = 26, ALZ_DIM = 50, PLA_TITLE = 22, BOTTOM_PAD = 8
  const plantaNat = cfg.depth * (W / Math.max(1, cfg.width))
  const plantaH   = Math.max(40, Math.min(plantaNat, 80))
  const alzTitleY = TOP + 16
  const alzY      = TOP + TITLE_H
  const alzadoH   = (BOT - TOP) - TITLE_H - ALZ_DIM - PLA_TITLE - plantaH - BOTTOM_PAD
  const plaTitleY = alzY + alzadoH + ALZ_DIM + 14
  const plaY      = plaTitleY + 10
  return {
    X, W, TOP, BOT, alzTitleY, alzY, alzadoH, plaTitleY, plaY, plantaH,
    alzRect: { x: 22, y: TOP, w: 518, h: (alzY + alzadoH + ALZ_DIM + 4) - TOP },
    plaRect: { x: 22, y: alzY + alzadoH + ALZ_DIM + 8, w: 518, h: BOT - (alzY + alzadoH + ALZ_DIM + 8) },
    alzScale: Math.min(W / Math.max(1, cfg.width), alzadoH / Math.max(1, cfg.height)),
    plaScale: Math.min(W / Math.max(1, cfg.width), plantaH / Math.max(1, cfg.depth)),
  }
}
const scaleLabel = (s) => s > 0 ? `1:${Math.round(1 / s)}` : ''

// ── Observaciones de fabricación ─────────────────────────────────────────────
// Las desviaciones respecto al pedido (menos gavetas de las pedidas, fondo que se
// parte en dos…) deben viajar EN EL PLANO. El plano es lo que llega al taller; un
// aviso que solo vive en la pantalla no existe para quien corta.
function buildAvisos(adjustments, P, D, box) {
  const list = (adjustments || []).filter(Boolean)
  if (!list.length) return ''
  const order = { critical: 0, warning: 1, info: 2 }
  const sorted = [...list].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
  const wrap = (str, n) => {
    const words = String(str).split(/\s+/); const lines = []; let cur = ''
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w } else { cur = (cur + ' ' + w).trim() }
    }
    if (cur) lines.push(cur)
    return lines
  }
  let g = `<text x="${box.x}" y="${box.y}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${esc(D.avisos || 'OBSERVACIONES')}</text>`
  let y = box.y + 16
  const maxY = box.y + box.h
  for (const a of sorted) {
    if (y > maxY - 8) break
    const col = a.severity === 'critical' ? '#C0392B' : a.severity === 'warning' ? '#B7791F' : P.muted
    const mark = a.severity === 'critical' ? '!' : '•'
    const lines = wrap(a.message, 62).slice(0, 3)
    g += `<text x="${box.x}" y="${y}" font-size="9.5" font-weight="800" fill="${col}">${mark}</text>`
    lines.forEach((ln, i) => {
      if (y + i * 11 > maxY) return
      g += `<text x="${box.x + 10}" y="${y + i * 11}" font-size="9.5" fill="${i === 0 ? P.text : P.muted}">${esc(ln)}</text>`
    })
    y += lines.length * 11 + 7
  }
  return g
}

// ── Lista de cortes ──
function buildCutlist(rows, P, y0, D) {
  const total = rows.reduce((a, r) => a + r.qty, 0)
  const trunc = (str, len) => (str && str.length > len) ? str.substring(0, len - 1) + '…' : str;
  let g = `<line x1="16" y1="${y0}" x2="984" y2="${y0}" fill="none" stroke="${P.frame}" stroke-width="1.4"/>`
  g += `<text x="36" y="${y0 + 22}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${D.cutlist} — ${total} ${D.pieces}</text>`
  const tx = 36, ty = y0 + 40
  g += `<g transform="translate(${tx},${ty})" font-size="9.5" font-weight="700" letter-spacing=".8" fill="${P.muted}">`
  g += `<text x="0" y="0">${D.col_piece}</text><text x="300" y="0" text-anchor="middle">${D.col_qty}</text><text x="420" y="0">${D.col_dims}</text><text x="640" y="0" text-anchor="middle">${D.col_thick}</text><text x="730" y="0">${D.col_edge}</text></g>`
  g += `<line x1="${tx}" y1="${ty + 10}" x2="${tx + 912}" y2="${ty + 10}" stroke="${P.rule}" stroke-width="1"/>`
  const maxRows = 6
  const trunc_rows = rows.length > maxRows
  const shown = trunc_rows ? rows.slice(0, maxRows - 1) : rows.slice(0, maxRows)
  const rowStep = 20, rowTop = ty + 28
  shown.forEach((r, i) => {
    const ry = rowTop + i * rowStep
    g += `<g transform="translate(${tx},${ry})" font-size="11" fill="${P.text}">`
    g += `<text x="0" y="0">${esc(trunc(r.name, 40))}</text><text x="300" y="0" text-anchor="middle">${r.qty}</text>`
    g += `<text x="420" y="0">${r.largo} × ${r.ancho}</text><text x="640" y="0" text-anchor="middle">${r.t}</text>`
    g += `<text x="730" y="0" fill="${P.muted}">${esc(trunc(grainLabel(r.type, D), 25))}</text></g>`
    if (i < shown.length - 1) g += `<line x1="${tx}" y1="${ry + 10}" x2="${tx + 912}" y2="${ry + 10}" stroke="${P.rule}" stroke-width="1"/>`
  })
  if (trunc_rows) g += `<text x="${tx}" y="${rowTop + (maxRows - 1) * rowStep}" font-size="10" fill="${P.muted}">${D.more_pieces.replace('{n}', rows.length - (maxRows - 1))}</text>`
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
function orbinSeal(P, D) {
  return `<g transform="translate(968,716)" text-anchor="end"><text font-size="9" fill="${P.muted}" opacity="0.42" letter-spacing="1">${D.seal} <tspan font-weight="800" fill="${P.sealC}" opacity="0.6">◆ orbin</tspan></text></g>`
}

// ══ API pública ══

// Plano detallado de UN módulo (3 vistas + cortes)
export function generateModulePlanSVG(module, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const D = LX(options.lang)
  const cfg = cfgOf(module)
  const rows = groupPieces(module && module.pieces)
  const pieceCount = rows.reduce((a, r) => a + r.qty, 0)
  const label = (module && module.configuration && module.configuration.moduleType) || (module && module.type) || 'Módulo'
  let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
  s += sheetHeader(`${D.title_module} — ${label}`, D.subtitle.replace('{t}', cfg.thickness), P)
  s += buildCajetin(options.company, cfg, pieceCount, P, D, options.editableFields)

  // Reparto adaptativo: el alzado manda, la planta se acota (ver planLayout).
  const L = planLayout(cfg)

  // GRID DE DELIMITACIÓN: Separaciones geométricas sutiles para los diferentes tipos de diseño
  s += `<rect x="${L.alzRect.x}" y="${L.alzRect.y}" width="${L.alzRect.w}" height="${L.alzRect.h}" fill="none" stroke="${P.rule}" stroke-width="0.8" rx="4"/>`
  s += `<rect x="${L.plaRect.x}" y="${L.plaRect.y}" width="${L.plaRect.w}" height="${L.plaRect.h}" fill="none" stroke="${P.rule}" stroke-width="0.8" rx="4"/>`
  s += `<rect x="550" y="100" width="426" height="430" fill="none" stroke="${P.rule}" stroke-width="0.8" rx="4"/>`

  const caps = options.captures || {}
  s += `<text x="36" y="${L.alzTitleY}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">1 · ${D.view_alzado}</text>`
  s += `<text x="524" y="${L.alzTitleY}" text-anchor="end" font-size="9" fill="${P.muted}" letter-spacing=".6">esc. ${scaleLabel(L.alzScale)}</text>`
  s += buildAlzado(cfg, { x: L.X, y: L.alzY, w: L.W, h: L.alzadoH }, P, caps.front, D)
  s += `<text x="36" y="${L.plaTitleY}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">2 · ${D.view_planta}</text>`
  s += `<text x="524" y="${L.plaTitleY}" text-anchor="end" font-size="9" fill="${P.muted}" letter-spacing=".6">esc. ${scaleLabel(L.plaScale)}</text>`
  // Planta SIEMPRE vectorial (no captura 3D): la captura arrastra el fondo del
  // visor y en un plano de planta —que es un rectángulo con la profundidad
  // acotada— no aporta nada. Vector = mueble gris limpio, sin fondo.
  s += buildPlanta(cfg, { x: L.X, y: L.plaY, w: L.W, h: L.plantaH }, P, null, D)
  // Isométrico centrado en su media (columna derecha), título centrado sobre el dibujo.
  const isoCx = 765, isoW = 340, isoH = 252, isoY = 198
  s += `<text x="${isoCx}" y="184" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">3 · ${D.view_iso}</text>`
  const isoUrl = (caps.iso && caps.iso.url) || options.isoDataURL
  if (isoUrl) {
    s += `<image x="${isoCx - isoW / 2}" y="${isoY}" width="${isoW}" height="${isoH}" href="${isoUrl}" preserveAspectRatio="xMidYMid meet"/>`
  } else {
    s += `<rect x="${isoCx - isoW / 2}" y="${isoY}" width="${isoW}" height="${isoH}" fill="none" stroke="${P.thin}" stroke-width="1" stroke-dasharray="5 4"/>`
    s += `<text x="${isoCx}" y="${isoY + isoH / 2}" text-anchor="middle" font-size="10" fill="${P.muted}">${D.iso_placeholder}</text>`
  }
  // Observaciones: espacio libre de la columna derecha, bajo el isométrico.
  const avisos = options.specAdjustments || (module && module.specAdjustments)
  s += buildAvisos(avisos, P, D, { x: 566, y: isoY + isoH + 24, w: 400, h: 530 - (isoY + isoH + 24) })

  s += buildCutlist(rows, P, 540, D)
  s += orbinSeal(P, D)
  s += `</svg>`
  return s
}

// Vista de CONJUNTO: alzado frontal de todos los módulos alineados + cortes consolidados
export function generateConjuntoPlanSVG(modules, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const D = LX(options.lang)
  const mods = (modules || []).filter(Boolean)
  const totalW = mods.reduce((a, m) => a + cfgOf(m).width, 0) || 1
  const maxH = Math.max(1, ...mods.map(m => cfgOf(m).height))
  let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
  s += sheetHeader(`${D.title_conjunto} — ${mods.length} ${D.modules_word}`, D.subtitle_conjunto.replace('{w}', totalW), P)
  const allRows = groupPieces(mods.flatMap(m => (m && m.pieces) || []))
  s += buildCajetin(options.company, cfgOf(mods[0] || {}), allRows.reduce((a, r) => a + r.qty, 0), P, D, options.editableFields)
  // banda de alzados alineados a piso — altura ampliada: con 300px un conjunto de
  // roperos altos quedaba diminuto por la misma causa que el alzado de módulo.
  const areaX = 60, areaW = 880, areaY = 126, areaH = 384
  const scale = Math.min(areaW / totalW, areaH / maxH)
  let cx = areaX
  s += `<text x="36" y="118" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${D.view_conjunto}</text>`
  mods.forEach((m) => {
    const c = cfgOf(m)
    const bw = c.width * scale, bh = c.height * scale
    s += buildAlzado(c, { x: cx, y: areaY, w: bw, h: bh }, P, null, D)
    cx += bw + 6
  })
  s += buildCutlist(allRows, P, 540, D)
  s += orbinSeal(P, D)
  s += `</svg>`
  return s
}

// TASK 3: FUTURE-PROOF DYNAMIC QR HOOKS (60x40mm thermal sticker)
export function generatePieceStickerSVG(piece, projectId) {
  const url = `https://orbin.app/track/piece?id=${piece.id}&proj=${projectId || 'mvp'}`;
  // 60x40mm sticker roughly maps to 226x151 pixels at 96 DPI
  return `<svg viewBox="0 0 226 151" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">
    <rect width="100%" height="100%" fill="white" />
    <!-- Placeholder for Barcode/QR Code Hook -->
    <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-dasharray="2 2"/>
    <text x="50" y="55" font-size="10" text-anchor="middle" fill="black">QR_HOOK</text>
    
    <text x="100" y="25" font-size="12" font-weight="bold" fill="black">${piece.name || 'PIEZA'}</text>
    <text x="10" y="110" font-size="9" fill="black">${url}</text>
  </svg>`;
}

export default generateModulePlanSVG
