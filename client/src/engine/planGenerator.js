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
import { pieceRectsMM, hasProjectablePieces } from './elevationModel.js'
// ★ 2026-07-26: los nombres de pieza se traducen al idioma del plano. El motor sigue
//   emitiendo canónicos; acá sólo se presentan. Ver pieceNames.js para la regla de
//   coherencia con la etiqueta térmica y el CSV.
import { localizePieceName } from './pieceNames.js'
import { localizeAdjustment } from './adjustmentMessages.js'

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
    mount_word:'inst. {h} mm do piso', floor_word:'PISO',
    top_word:'tampo {t} mm', hidden_word:'peça oculta', hidden_apron:'peça oculta (saia)',
    iso_placeholder:'captura 3D (linhas pretas · com volume)',
    cutlist:'LISTA DE CORTES', pieces:'peças',
    col_piece:'PEÇA', col_qty:'QTD', col_dims:'COMP × ALT', col_thick:'ESP.', col_edge:'BORDA / GRÃO',
    more_pieces:'+ {n} peça(s) — lista completa na FOLHA DE CORTE',
    cut_sheet_title:'FOLHA DE CORTE', cut_sheet_of:'folha {n} de {m}', cut_sheet_total:'{n} peças · {u} cortes únicos',
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
    mount_word:'inst. {h} mm del piso', floor_word:'PISO',
    top_word:'tampo {t} mm', hidden_word:'pieza oculta', hidden_apron:'pieza oculta (faldón)',
    iso_placeholder:'captura 3D (líneas negras · con volumen)',
    cutlist:'LISTA DE CORTES', pieces:'piezas',
    col_piece:'PIEZA', col_qty:'CANT', col_dims:'LARGO × ALTO', col_thick:'ESP.', col_edge:'CANTO / VETA',
    more_pieces:'+ {n} pieza(s) — lista completa en la HOJA DE CORTE',
    cut_sheet_title:'HOJA DE CORTE', cut_sheet_of:'hoja {n} de {m}', cut_sheet_total:'{n} piezas · {u} cortes únicos',
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
    mount_word:'mtd. {h} mm from floor', floor_word:'FLOOR',
    top_word:'top {t} mm', hidden_word:'hidden part', hidden_apron:'hidden part (modesty)',
    iso_placeholder:'3D capture (black lines · with volume)',
    cutlist:'CUT LIST', pieces:'pieces',
    col_piece:'PIECE', col_qty:'QTY', col_dims:'LENGTH × HEIGHT', col_thick:'THK.', col_edge:'EDGE / GRAIN',
    more_pieces:'+ {n} piece(s) — full list on the CUT SHEET',
    cut_sheet_title:'CUT SHEET', cut_sheet_of:'sheet {n} of {m}', cut_sheet_total:'{n} pieces · {u} unique cuts',
    seal:'generated with',
    cj_empresa:'COMPANY', cj_setor:'SECTOR', cj_material:'MATERIAL', cj_desenhista:'DESIGNER',
    cj_pecas:'PIECES', cj_data:'DATE',
    def_empresa:'Your Workshop', def_setor:'Assembly',
    grain_none:'no edge', grain_vert:'front · vertical', grain_4:'front · 4 sides', grain_horiz:'front · horizontal',
  },
}
// ★ 2026-07-26 — NORMALIZACIÓN ÚNICA DEL IDIOMA. Convivían TRES fallbacks distintos
//   para lo mismo: `LX` caía a PT, `buildInfoPanel` a ES (`?? 0`) y `lx0` a ES. Con un
//   `lang` no reconocido la MISMA HOJA salía mezclada: título en PT, "LEYENDA/Tirador/
//   Gaveta" en ES y "peça oculta (saia)" otra vez en PT — en la misma línea.
//   Hoy sólo llegan 'ES'|'PT'|'EN' (PreferencesContext), así que el bug estaba LATENTE;
//   basta que alguien pase 'pt', 'pt-BR' o un localStorage viejo para activarlo, y falla
//   en silencio (no hay error, sólo una hoja rara).
//   Se acepta minúsculas y prefijo de locale ('pt-BR' → 'PT'). Fallback: PT, que es el
//   default real de la app. Para 'ES'|'PT'|'EN' el comportamiento es IDÉNTICO al previo.
const normLang = (lang) => {
  const k = String(lang || '').trim().toUpperCase().split(/[-_]/)[0]
  return ['ES', 'PT', 'EN'].includes(k) ? k : 'PT'
}
const LX = (lang) => PLAN_I18N[normLang(lang)]

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
    internalWidth, compartments, compW,
    // ★ 2026-07-23: campos de topología necesarios para el alzado del escritorio
    //   (sin ellos, cfg.moduleType era undefined y el desk caía al alzado genérico).
    moduleType: c.moduleType, pedestalWidth: c.pedestalWidth, pedestalSide: c.pedestalSide,
    hasPedestal: c.hasPedestal, drawerRailHeight: c.drawerRailHeight, drawerPrivacyPanel: c.drawerPrivacyPanel,
    // ★ 2026-07-26: altura de INSTALACIÓN (piso → borde inferior). Sin este pass-through
    //   el conjunto veía mountHeight undefined y dibujaba el aéreo APOYADO EN EL PISO
    //   (mismo gotcha que moduleType del desk en la ronda 3). 0 = apoyado.
    mountHeight: Math.max(0, num(c.mountHeight, 0)) }
}

// ── Agrupa piezas para la lista de cortes (largo = mayor, ancho = menor) ──
// ★ 2026-07-26: acepta `lang` y devuelve el nombre TRADUCIDO para mostrar.
//   La CLAVE de agrupado sigue usando el nombre CANÓNICO del motor: si agrupara por el
//   nombre traducido, dos piezas distintas que colapsan al mismo término en un idioma
//   se fusionarían y la lista de cortes mentiría. El agrupado es idéntico en ES/PT/EN.
//   `nameCanonical` se conserva para que otras superficies (CSV, etiqueta térmica)
//   puedan emparejar la fila con la pieza real.
function groupPieces(pieces, lang) {
  const map = new Map()
  for (const p of (pieces || [])) {
    const w = num(p.width || p.w), h = num(p.height || p.h), t = num(p.thickness || p.t, 18)
    if (!w || !h) continue
    const largo = Math.max(w, h), ancho = Math.min(w, h)
    const base = String(p.name || p.type || 'Peça').replace(/\s*\d+$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
    const key = `${base}|${largo}x${ancho}x${t}`
    const qty = num(p.quantity, 1)
    if (map.has(key)) map.get(key).qty += qty
    else map.set(key, { name: localizePieceName(base, lang), nameCanonical: base, largo, ancho, t, qty, type: p.type })
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
// ── Adaptador SVG del ALZADO UNIFICADO ───────────────────────────────────────
// ★ 2026-07-23: proyecta las PIEZAS REALES (elevationModel, SSOT) a SVG. Misma
//   geometría que el Plano Ejecutivo (jsPDF) → los dos planos ya no divergen y
//   cualquier topología (incluido el escritorio) queda cubierta sin plantilla.
function buildAlzadoFromPieces(module, box, P, D, opts = {}) {
  const cfg = cfgOf(module)
  const W = cfg.width, H = cfg.height
  const rects = pieceRectsMM(module)
  const sc = Math.min(box.w / W, box.h / H)
  const dw = W * sc, dh = H * sc
  const ax = box.x + (box.w - dw) / 2, ay = box.y + (box.h - dh)
  const X = x => ax + x * sc, Y = y => ay + dh - y * sc     // y-up
  let g = ''
  for (const r of rects) {
    const px = X(r.x0), py = Y(r.y0 + r.dy), pw = r.dx * sc, ph = r.dy * sc
    if (r.style === 'drawer_front') {
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
      g += `<circle cx="${X(r.cx)}" cy="${Y(r.cy)}" r="2.4" fill="${P.carc}"/>`
    } else if (r.style === 'door') {
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.light}" stroke="${P.carc}" stroke-width="1"/>`
      // ★ Tirador hacia el CENTRO del mueble: en puertas dobles ambos se encuentran
      //   al medio (no los dos al mismo borde). Puerta en la mitad derecha → tirador
      //   a su izquierda; en la mitad izquierda → a su derecha.
      const hxmm = r.cx >= W / 2 ? (r.cx - r.dx / 2 + 60) : (r.cx + r.dx / 2 - 60)
      g += `<circle cx="${X(hxmm)}" cy="${Y(r.cy)}" r="2.2" fill="${P.carc}"/>`
    } else if (r.style === 'baseboard') {
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.light}" stroke="${P.thin}" stroke-width="1"/>`
    } else if (r.style === 'apron') {
      // Faldón/modesty panel: pieza TRASERA vista por el vano. Fill claro + contorno
      // en LÍNEA OCULTA (discontinua) = convención técnica de "detrás". El vano se lee
      // abierto; tamaño/posición REALES (fiel a la lista de cortes).
      // ★ 2026-07-26: el patrón era FIJO "5 3". En el plano de módulo (sc≈0.27) se lee
      //   bien, pero en la VISTA DE CONJUNTO (sc≈0.19, o menos con muchos muebles) los
      //   guiones se juntan y el contorno colapsa a línea llena → el faldón se confunde
      //   con una pieza sólida y el vano de piernas parece cerrado. El patrón se ajusta
      //   a la escala para que el guión conserve su longitud APARENTE, con topes para
      //   que no degenere ni en punteado fino ni en trazos enormes.
      const dash = Math.min(6, Math.max(2.5, 5 * (0.27 / Math.max(sc, 0.06))))
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.light}" stroke="${P.thin}" stroke-width="0.8" stroke-dasharray="${dash.toFixed(1)} ${(dash * 0.6).toFixed(1)}"/>`
    } else if (r.style === 'solid') {
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
    } else {
      g += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="none" stroke="${P.carc}" stroke-width="1"/>`
    }
  }
  // ★ 2026-07-26 — DUEÑO ÚNICO DEL ETIQUETADO. En la VISTA DE CONJUNTO estas cotas
  //   chocaban con las que dibuja generateConjuntoPlanSVG: (a) el ancho salía DOS veces
  //   superpuesto ("1200" bold acá + "1200×900 mm" gris del conjunto, a 4px);
  //   (b) la línea de cota caía justo sobre el ID del módulo, tachándolo; (c) la cota de
  //   alto se dibuja en ax−18, pero el GAP entre módulos es 14 → invadía el mueble VECINO.
  //   Con dims:false el conjunto acota por su cuenta y con espacio propio. El plano de
  //   módulo (una hoja por mueble) sigue llamando sin opts → conserva sus cotas.
  if (opts.dims === false) return g
  // cota ancho (abajo) + alto (izquierda)
  const ty = ay + dh + 16
  g += `<line x1="${ax}" y1="${ty}" x2="${ax + dw}" y2="${ty}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${ax}" y1="${ty - 4}" x2="${ax}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${ax + dw}" y1="${ty - 4}" x2="${ax + dw}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${ax + dw / 2}" y="${ty + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}">${W}</text>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx - 4}" y1="${ay + dh}" x2="${hx + 4}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dh / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dh / 2})">${H}</text>`
  return g
}

// Alzado unificado: proyección de piezas reales (SSOT) si el módulo las trae; si no
// (previews sin geometría), cae al dibujo paramétrico existente. Un solo punto.
function buildAlzadoUnified(module, box, P, D, opts = {}) {
  if (hasProjectablePieces(module)) return buildAlzadoFromPieces(module, box, P, D, opts)
  return buildAlzado(cfgOf(module), box, P, null, D, opts)
}

// ── Alzado del ESCRITORIO (topología real: tampo + vano de piernas + pedestal) ──
// ★ 2026-07-23: el alzado genérico dibujaba el desk como cómoda cerrada. Esta rama
//   espeja generateDeskFurniture: patas laterales, faldón en el vano, pedestal de
//   gavetas al lado (pedestalSide) y travesaño de cierre. Sin captura 3D.
function buildAlzadoDesk(cfg, box, P, D, opts = {}) {
  const W = cfg.width, H = cfg.height, T = cfg.thickness || 18
  const sc = Math.min(box.w / W, box.h / H)
  const dw = W * sc, dh = H * sc
  const ax = box.x + (box.w - dw) / 2, ay = box.y + (box.h - dh)
  const Tp = T * sc
  const yTop = (mm) => ay + dh - mm * sc     // borde a 'mm' desde el piso (y-down)
  const latH = H - T
  const hasPed = cfg.hasPedestal !== false
  const side = cfg.pedestalSide === 'left' ? 'left' : 'right'
  const pedW = Math.min(Math.max(cfg.pedestalWidth || 400, 300), (W - 600 > 300) ? (W - 600) : W * 0.4)
  let g = ''
  // Tampo (ancho completo, arriba)
  g += `<rect x="${ax}" y="${ay}" width="${dw}" height="${Tp}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1.4"/>`
  // Patas / laterales (de piso a bajo el tampo)
  g += `<rect x="${ax}" y="${ay + Tp}" width="${Tp}" height="${latH * sc}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  g += `<rect x="${ax + dw - Tp}" y="${ay + Tp}" width="${Tp}" height="${latH * sc}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
  if (hasPed) {
    const pedWp = pedW * sc
    const divX = side === 'right' ? (ax + dw - pedWp) : (ax + pedWp - Tp)  // costado interno del pedestal
    g += `<rect x="${divX}" y="${ay + Tp}" width="${Tp}" height="${latH * sc}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
    const pedInX = side === 'right' ? (divX + Tp) : (ax + Tp)
    const pedInW = pedWp - 2 * Tp
    // gavetas auto-fit + travesaño (espejo del motor)
    const railH = (cfg.drawerPrivacyPanel !== false && (cfg.numDrawers || 0) > 0) ? Math.max(50, Math.round(cfg.drawerRailHeight || 50)) : 0
    const CLEAR = 16, MINH = 80
    const drawerZone = (latH - T) - railH
    const n = Math.min(cfg.numDrawers || 0, Math.max(0, Math.floor(drawerZone / (MINH + CLEAR))))
    const dhmm = n > 0 ? Math.max(MINH, Math.floor(drawerZone / n) - CLEAR) : 0
    for (let i = 0; i < n; i++) {
      const y1 = T + i * (dhmm + CLEAR) + dhmm
      const gy = yTop(y1), gh = dhmm * sc
      g += `<rect x="${pedInX + 2}" y="${gy}" width="${pedInW - 4}" height="${gh - 2}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
      g += `<circle cx="${pedInX + pedInW / 2}" cy="${gy + gh / 2}" r="2.4" fill="${P.carc}"/>`
    }
    // travesaño de cierre estructural: va de LATERAL A LATERAL del pedestal (encastrado
    // entre los dos costados), pegado bajo el tampo. Sin holgura de frente.
    if (railH > 0) g += `<rect x="${pedInX}" y="${yTop(latH)}" width="${pedInW}" height="${railH * sc}" fill="${P.solid}" stroke="${P.carc}" stroke-width="1"/>`
    // faldón (modesty panel) en el vano de piernas, bajo el tampo
    const apronH = Math.min(300, Math.max(150, Math.round(latH * 0.35)))
    const kneeX0 = side === 'right' ? (ax + Tp) : (divX + Tp)
    const kneeX1 = side === 'right' ? divX : (ax + dw - Tp)
    g += `<rect x="${kneeX0}" y="${yTop(latH)}" width="${Math.max(0, kneeX1 - kneeX0)}" height="${apronH * sc}" fill="${P.light}" stroke="${P.thin}" stroke-width="1"/>`
  }
  // ★ 2026-07-26: ver nota en buildAlzadoFromPieces — en el conjunto el etiquetado
  //   lo dibuja generateConjuntoPlanSVG (dueño único), acá se omite para no duplicar.
  if (opts.dims === false) return g
  // cota ancho (abajo) + alto (izquierda)
  const ty = ay + dh + 16
  g += `<line x1="${ax}" y1="${ty}" x2="${ax + dw}" y2="${ty}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${ax}" y1="${ty - 4}" x2="${ax}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${ax + dw}" y1="${ty - 4}" x2="${ax + dw}" y2="${ty + 4}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${ax + dw / 2}" y="${ty + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}">${W}</text>`
  const hx = ax - 18
  g += `<line x1="${hx}" y1="${ay}" x2="${hx}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<line x1="${hx - 4}" y1="${ay}" x2="${hx + 4}" y2="${ay}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${hx - 4}" y1="${ay + dh}" x2="${hx + 4}" y2="${ay + dh}" stroke="${P.dim}" stroke-width="0.8"/>`
  g += `<text x="${hx - 9}" y="${ay + dh / 2}" text-anchor="middle" font-size="11" font-weight="600" fill="${P.text}" transform="rotate(-90 ${hx - 9} ${ay + dh / 2})">${H}</text>`
  return g
}

function buildAlzado(origCfg, box, P, cap, D, opts = {}) {
  // ★ El escritorio tiene su propia topología (vano de piernas + pedestal).
  if (origCfg.moduleType === 'desk') return buildAlzadoDesk(origCfg, box, P, D, opts)
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
  // ★ 2026-07-26: ver nota en buildAlzadoFromPieces — el conjunto acota por su cuenta.
  if (opts.dims === false) return g
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
  // ★ 2026-07-26 — el rótulo era SIEMPRE `back_word` ("fondo 6 mm"), hardcodeado.
  //   En el ESCRITORIO eso MIENTE: un desk no tiene fondo, lo que se ve en planta es
  //   el tampo (p. ej. 1400×600×18). El plano contradecía su propia lista de cortes.
  //   Se rotula "Tampo" (mismo término que usa la lista de cortes, para que el
  //   instalador empareje pieza y dibujo). Sólo cambia el desk: el resto conserva su
  //   rótulo histórico para no alterar planos ya validados.
  const isDesk = cfg.moduleType === 'desk'
  const plantaLabel = isDesk
    ? D.top_word.replace('{t}', cfg.thickness)
    : D.back_word.replace('{bt}', cfg.backThickness)
  g += `<text x="${ax + dw / 2}" y="${ay + dd / 2 + 4}" text-anchor="middle" font-size="10" fill="${P.muted}">${plantaLabel}</text>`
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
  data:       { x: 902, y: 60, w: 72,  h: 16 },
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
  g += `<g transform="translate(902,26)">${f(D.cj_pecas, String(pieceCount), 8)}</g>`
  g += `<g transform="translate(902,58)">${editable ? fEdit(D.cj_data, F.data.w) : f(D.cj_data, co.data || new Date().toLocaleDateString(D.locale), 12)}</g>`
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
// ★ ESCALA REAL EN PAPEL 2026-07-26. `alzScale` está en UNIDADES DE VIEWBOX por mm,
//   no en mm de papel: para un escritorio de 1400 daba 0.4286 y la hoja anunciaba
//   "esc. 1:2" cuando en A4 apaisado el dibujo sale a 1:8. Cuatro veces mal.
//   El SVG (1000×740) se estampa en A4 landscape (297×210 mm) respetando el aspecto
//   (ver ExportPanel), así que 1 unidad de viewBox = min(297/1000, 210/740) mm.
//   Si cambia PLAN_VIEWBOX o el tamaño de página, este factor debe seguirlos.
const PLAN_PAGE_MM = { w: 297, h: 210 }              // A4 apaisado
const MM_PER_UNIT = Math.min(PLAN_PAGE_MM.w / 1000, PLAN_PAGE_MM.h / 740)
// Se redondea a la escala normalizada más cercana (1:5, 1:10, 1:20…) y se marca "≈"
// cuando no cae exacta: un plano no se acota a "1:8.2", se dice a qué escala se leyó.
const NORMALIZED_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200]
const scaleLabel = (s) => {
  if (!(s > 0)) return ''
  const ratio = 1 / (s * MM_PER_UNIT)              // 1 : ratio sobre el papel
  const near = NORMALIZED_SCALES.reduce((b, n) => Math.abs(n - ratio) < Math.abs(b - ratio) ? n : b)
  const exact = Math.abs(near - ratio) / ratio < 0.02
  return `${exact ? '' : '≈'}1:${near}`
}

// ── Observaciones de fabricación ─────────────────────────────────────────────
// Las desviaciones respecto al pedido (menos gavetas de las pedidas, fondo que se
// parte en dos…) deben viajar EN EL PLANO. El plano es lo que llega al taller; un
// aviso que solo vive en la pantalla no existe para quien corta.
// ★ 2026-07-26: devuelve { svg, nextY } (antes sólo el string). El llamador estimaba
//   la altura a ojo con `avisos.length * 26` y, al corregir el ancho del wrap, un aviso
//   pasó a ocupar 3 líneas (~56px) → OBSERVACIONES se SOLAPABA con LISTA DE CORTES.
//   Ahora la altura consumida la reporta quien la conoce. Compatible: el `.svg` del
//   objeto es exactamente lo que se devolvía antes.
function buildAvisos(adjustments, P, D, box, lang) {
  const list = (adjustments || []).filter(Boolean)
  if (!list.length) return { svg: '', nextY: box.y }
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
  // ★ 2026-07-26 — el wrap estaba FIJO en 62 caracteres mientras el panel mide
  //   box.w = 252px. A font-size 9.5 en sans-serif un carácter ocupa ~5.1px, así que
  //   62 caracteres pedían ~316px: las observaciones se salían del panel y el borde
  //   de la hoja las cortaba a media palabra ("…pegado al tampo (privac").
  //   Ahora el ancho sale de la caja real. Sigue habiendo tope de 3 líneas, pero si
  //   se trunca se avisa con "…" en vez de cortar en seco.
  const CHAR_W = 5.1
  const cols = Math.max(20, Math.floor((box.w - 12) / CHAR_W))
  let g = `<text x="${box.x}" y="${box.y}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${esc(D.avisos || 'OBSERVACIONES')}</text>`
  let y = box.y + 16
  const maxY = box.y + box.h
  for (const a of sorted) {
    if (y > maxY - 8) break
    const col = a.severity === 'critical' ? '#C0392B' : a.severity === 'warning' ? '#B7791F' : P.muted
    const mark = a.severity === 'critical' ? '!' : '•'
    const msg = localizeAdjustment(a, lang)
    const all = wrap(msg, cols)
    const lines = all.slice(0, 3)
    if (all.length > 3 && lines.length === 3) lines[2] = lines[2].replace(/\s*\S*$/, '') + ' …'
    g += `<text x="${box.x}" y="${y}" font-size="9.5" font-weight="800" fill="${col}">${mark}</text>`
    lines.forEach((ln, i) => {
      if (y + i * 11 > maxY) return
      g += `<text x="${box.x + 10}" y="${y + i * 11}" font-size="9.5" fill="${i === 0 ? P.text : P.muted}">${esc(ln)}</text>`
    })
    y += lines.length * 11 + 7
  }
  return { svg: g, nextY: y }
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

// ── Panel lateral de datos del mueble + leyenda (columna derecha) ────────────
// ★ REDISEÑO 2026-07-23: los datos y la leyenda van AL LADO (no arriba, no cortes).
function buildInfoPanel(cfg, label, P, D, lang, x, y0) {
  const lx = { ES:0, PT:1, EN:2 }[normLang(lang)]   // ★ 2026-07-26: era `[lang] ?? 0` (caía a ES)
  const T3 = (es, pt, en) => [es, pt, en][lx]
  const row = (k, v, y) =>
    `<text x="${x}" y="${y}" font-size="8.5" fill="${P.muted}" letter-spacing=".4">${esc(k)}</text>` +
    `<text x="${x + 118}" y="${y}" text-anchor="end" font-size="10.5" font-weight="700" fill="${P.text}">${esc(v)}</text>`
  let g = `<text x="${x}" y="${y0}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${T3('DIMENSIONES','DIMENSÕES','DIMENSIONS')}</text>`
  let y = y0 + 20
  g += row(T3('Ancho','Largura','Width'),  `${cfg.width} mm`, y);  y += 17
  g += row(T3('Alto','Altura','Height'),   `${cfg.height} mm`, y); y += 17
  g += row(T3('Fondo','Profund.','Depth'), `${cfg.depth} mm`, y);  y += 17
  g += row(T3('Tipo','Tipo','Type'),       String(label).toUpperCase(), y); y += 17
  g += `<line x1="${x}" y1="${y - 2}" x2="${x + 118}" y2="${y - 2}" stroke="${P.rule}" stroke-width="0.8"/>`
  return { svg: g, nextY: y + 16 }
}

// Leyenda de símbolos del alzado — HORIZONTAL, en banda superior (deja el ancho
// libre para el dibujo). ★ 2026-07-23: pedido explícito "leyenda encima".
// ★ 2026-07-26 — LEYENDA CONTEXTUAL. Antes los 4 símbolos eran FIJOS: en un escritorio
//   la hoja anunciaba "División de puerta" y "Zócalo" (que no existen en ese mueble) y
//   NO anunciaba el faldón, que sí se dibuja y con una convención especial (línea
//   discontinua = pieza oculta). Una leyenda que nombra lo que no está y calla lo que
//   está es peor que no tener leyenda.
//   Ahora los ítems se derivan de las PIEZAS REALES proyectadas (mismo SSOT que el
//   alzado), con fallback a la config para previews sin geometría.
//   `module` es OPCIONAL: si no se pasa, se devuelve la leyenda completa de siempre
//   (ninguna llamada existente se rompe).
function buildLeyendaBar(P, D, lang, x, y, maxX, module) {
  const li = { ES:0, PT:1, EN:2 }[lx0(lang)] ?? 0
  const T3 = (es, pt, en) => [es, pt, en][li]

  let styles = null
  let isDesk = false
  if (module) {
    styles = new Set()
    isDesk = cfgOf(module).moduleType === 'desk'
    if (hasProjectablePieces(module)) {
      for (const r of pieceRectsMM(module)) styles.add(r.style)
    } else {
      const c = cfgOf(module)
      if (c.hasDoors && c.numDoors > 0) styles.add('door')
      if (c.numDrawers > 0) styles.add('drawer_front')
      if (c.baseboard && c.baseboardHeight > 0) styles.add('baseboard')
    }
  }
  const has = (s) => !styles || styles.has(s)
  // ★ El estilo 'apron' NO es exclusivo del faldón: isApron() matchea cualquier
  //   tie_strip con "trasero" en el nombre, así que el "Travesaño Trasero" de un
  //   módulo BASE también se dibuja con línea oculta — y eso es correcto (va detrás).
  //   Pero llamarlo "faldón" en la leyenda sería mentir sobre la pieza. Los rects del
  //   SSOT no traen el nombre, así que se decide por topología: sólo el escritorio
  //   nombra el faldón; el resto usa el término genérico, que es cierto siempre.
  const hiddenTxt = (isDesk ? D.hidden_apron : D.hidden_word) || 'pieza oculta'
  const items = [
    ['⎯', T3('División de puerta','Divisão de porta','Door split'), has('door')],
    ['○', T3('Tirador','Puxador','Handle'),                          has('door') || has('drawer_front')],
    ['▭', T3('Gaveta','Gaveta','Drawer'),                            has('drawer_front')],
    ['▬', T3('Zócalo','Rodapé','Plinth'),                            has('baseboard')],
    // Pieza trasera vista por el vano: se dibuja con línea oculta (discontinua).
    ['⌐', hiddenTxt,                                                 has('apron')],
  ].filter(it => it[2])

  let g = `<text x="${x}" y="${y}" font-size="9.5" font-weight="800" letter-spacing="1.2" fill="${P.vh}">${T3('LEYENDA','LEGENDA','LEGEND')}</text>`
  let cx = x + 78
  for (const [sym, txt, , ] of items) {
    const w = 20 + txt.length * 5.4
    if (cx + w > maxX) break
    // El faldón se anuncia con su propia convención gráfica (trazo discontinuo), no
    // con un glifo: el símbolo tiene que ser IGUAL a lo que aparece en el dibujo.
    if (txt === hiddenTxt) {
      g += `<line x1="${cx}" y1="${y - 3}" x2="${cx + 12}" y2="${y - 3}" stroke="${P.thin}" stroke-width="1" stroke-dasharray="4 2.5"/>`
    } else {
      g += `<text x="${cx}" y="${y}" font-size="11" fill="${P.carc}">${sym}</text>`
    }
    g += `<text x="${cx + 16}" y="${y}" font-size="9" fill="${P.text}">${esc(txt)}</text>`
    cx += w + 8
  }
  return g
}
// ★ 2026-07-26: delega en normLang para que TODA la hoja use el mismo idioma (antes
//   caía a ES mientras LX caía a PT → hojas mezcladas). Se conserva el nombre porque
//   ya lo usan buildLeyendaBar y buildCutlistCompact.
function lx0(lang){ return normLang(lang) }

// Lista de cortes COMPACTA para el panel lateral (el cliente la tiene en el plano,
// sin descargar el CSV). ★ 2026-07-23: pedido explícito. Una por módulo (cada hoja).
function buildCutlistCompact(rows, P, D, lang, x, y0, maxW, yBottom) {
  const li = { ES: 0, PT: 1, EN: 2 }[lx0(lang)] ?? 0
  const T3 = (es, pt, en) => [es, pt, en][li]
  const total = rows.reduce((a, r) => a + r.qty, 0)
  let g = `<text x="${x}" y="${y0}" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${T3('LISTA DE CORTES', 'LISTA DE CORTE', 'CUT LIST')} — ${total} ${T3('pzs', 'pçs', 'pcs')}</text>`
  let y = y0 + 15
  g += `<text x="${x}" y="${y}" font-size="7.5" fill="${P.muted}" letter-spacing=".3">${T3('PIEZA', 'PEÇA', 'PIECE')}</text>`
  g += `<text x="${x + maxW}" y="${y}" text-anchor="end" font-size="7.5" fill="${P.muted}" letter-spacing=".3">${T3('C · L×A · e', 'Q · C×L · e', 'Q · L×W · t')}</text>`
  y += 4
  g += `<line x1="${x}" y1="${y}" x2="${x + maxW}" y2="${y}" stroke="${P.rule}" stroke-width="0.8"/>`
  y += 13
  const step = 13.5
  const maxRows = Math.max(1, Math.floor((yBottom - y) / step))
  const overflow = rows.length > maxRows
  const shown = overflow ? rows.slice(0, maxRows - 1) : rows
  for (const r of shown) {
    const nm = r.name.length > 20 ? r.name.slice(0, 19) + '…' : r.name
    g += `<text x="${x}" y="${y}" font-size="8.5" fill="${P.text}">${esc(nm)}</text>`
    g += `<text x="${x + maxW}" y="${y}" text-anchor="end" font-size="8.5" fill="${P.text}">${r.qty} · ${r.largo}×${r.ancho} · ${r.t}</text>`
    y += step
  }
  if (overflow) {
    g += `<text x="${x}" y="${y}" font-size="8" fill="${P.muted}">+ ${rows.length - (maxRows - 1)} ${T3('piezas más — ver CSV', 'peças mais — ver CSV', 'more — see CSV')}</text>`
    y += step
  }
  return { svg: g, nextY: y }
}

// Plano de montaje de UN módulo — VISTA FRONTAL primero, datos y leyenda al lado,
// sin lista de cortes, sin isométrico (decisión 2026-07-23).
export function generateModulePlanSVG(module, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const D = LX(options.lang)
  const lang = lx0(options.lang)
  const cfg = cfgOf(module)
  const rows = groupPieces(module && module.pieces, lang)
  const pieceCount = rows.reduce((a, r) => a + r.qty, 0)
  const label = (module && module.configuration && module.configuration.moduleType) || (module && module.type) || 'Módulo'
  const modName = (module && (module.id || module.name)) || label

  let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
  s += sheetHeader(`${D.title_module} — ${label}`, D.subtitle.replace('{t}', cfg.thickness), P)
  s += buildCajetin(options.company, cfg, pieceCount, P, D, options.editableFields)

  // ── LEYENDA ENCIMA (banda horizontal) — deja el ancho libre al dibujo ──
  s += buildLeyendaBar(P, D, lang, 36, 112, 660, module)   // ★ contextual a las piezas reales
  s += `<line x1="16" y1="122" x2="984" y2="122" stroke="${P.rule}" stroke-width="0.8"/>`

  // Separador vertical: dibujo a la izquierda, datos del mueble a la derecha.
  const COLX = 700
  s += `<line x1="${COLX}" y1="122" x2="${COLX}" y2="708" stroke="${P.thin}" stroke-width="1"/>`

  // ── VISTA FRONTAL (alzado) — PRIMERO, grande, VECTORIAL (no captura 3D) ──
  const alzScale = Math.min(600 / Math.max(1, cfg.width), 380 / Math.max(1, cfg.height))
  s += `<text x="36" y="146" font-size="12" font-weight="800" letter-spacing="1.5" fill="${P.vh}">1 · ${D.view_alzado}</text>`
  s += `<text x="${COLX - 20}" y="146" text-anchor="end" font-size="9" fill="${P.muted}" letter-spacing=".6">esc. ${scaleLabel(alzScale)}</text>`
  // Alzado UNIFICADO: proyecta las piezas reales del módulo (misma fuente que el
  // Plano Ejecutivo). Cubre cualquier topología; sin captura 3D.
  s += buildAlzadoUnified(module, { x: 110, y: 164, w: 560, h: 372 }, P, D)

  // ── PLANTA SUPERIOR (secundaria, vectorial) ──
  s += `<text x="36" y="582" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">2 · ${D.view_planta}</text>`
  s += buildPlanta(cfg, { x: 110, y: 600, w: 560, h: 88 }, P, null, D)

  // ── COLUMNA DERECHA: datos + LISTA DE CORTES del módulo + observaciones ──
  const RX = COLX + 22, RW = 252
  const info = buildInfoPanel(cfg, label, P, D, lang, RX, 150)
  s += info.svg
  // Observaciones primero (suelen ser 1-2 líneas); la lista de cortes ocupa el resto.
  const avisos = options.specAdjustments || (module && module.specAdjustments)
  let avY = info.nextY + 4
  if (avisos && avisos.length) {
    // ★ 2026-07-26: se usa la altura REAL consumida (av.nextY), no la estimación
    //   `avisos.length * 26` que subestimaba los avisos largos y los hacía chocar
    //   contra el título de LISTA DE CORTES.
    const av = buildAvisos(avisos, P, D, { x: RX, y: avY + 10, w: RW, h: 88 }, lang)
    s += av.svg
    avY = Math.max(avY + 18, av.nextY)
  }
  // ★ Lista de cortes del módulo, en el plano (el cliente no necesita el CSV).
  s += buildCutlistCompact(rows, P, D, lang, RX, avY + 12, RW, 700).svg

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
  const allRows = groupPieces(mods.flatMap(m => (m && m.pieces) || []), options.lang)
  s += buildCajetin(options.company, cfgOf(mods[0] || {}), allRows.reduce((a, r) => a + r.qty, 0), P, D, options.editableFields)
  // banda de alzados — altura ampliada: con 300px un conjunto de roperos altos
  // quedaba diminuto por la misma causa que el alzado de módulo.
  // ★ REDISEÑO 2026-07-23 (respetar espacios): (1) el scale ahora DESCUENTA los
  //   gaps entre módulos → antes la banda se salía del área por 6px×(n−1) con
  //   varios muebles. (2) alzados APOYADOS al piso (línea base común), no colgados
  //   del tope. (3) banda centrada y etiqueta por módulo para identificarlos.
  // ★ REDISEÑO 2026-07-26 (ronda 11) — 4 defectos de acotación corregidos:
  //   (1) ANCHO DUPLICADO: el alzado escribía su cota en floorY+31 y el conjunto su
  //       etiqueta en floorY+27 → se pisaban ("1200 1200 mm" ilegible). Ahora el alzado
  //       se llama con dims:false y ESTE bloque es el dueño único del etiquetado.
  //   (2) ID TACHADO: la línea de cota caía en floorY+16, igual que el tag del módulo.
  //       Ahora hay una pila de alturas reservadas y separadas (LBL_*).
  //   (3) COTA DE ALTO INVADIENDO AL VECINO: se dibujaba en ax−18 con GAP=14 → entraba
  //       en el mueble anterior. Se eliminó del conjunto: la altura va en la etiqueta
  //       W×H. La única cota vertical que queda es la de INSTALACIÓN de los colgados,
  //       y se dibuja en el aire vacío BAJO el módulo, donde no colisiona con nada.
  //   (4) HUECO MUERTO ABAJO: floorY = areaY + min(areaH, maxH*scale) dejaba los muebles
  //       flotando arriba con hasta 240px vacíos debajo cuando mandaba el ancho. Ahora el
  //       piso está ANCLADO al fondo del área: los muebles se apoyan y el aire queda
  //       arriba, que es como se lee un alzado.
  const areaX = 60, areaW = 880, areaY = 126, areaH = 384
  const GAP = 14
  const LBL_H = 46                       // banda reservada bajo el piso para el etiquetado
  const nGaps = Math.max(0, mods.length - 1)
  const usableW = Math.max(1, areaW - GAP * nGaps)
  // ★ 2026-10-10: banda superior reservada para la COTA CORRIDA TOTAL (cota combinada
  //   del conjunto). Sin ella, en roperos altos el tope del dibujo tocaba areaY y la
  //   línea de cota general se montaba sobre las piezas. 0 cuando hay un solo módulo.
  const TOP_DIM = mods.length > 1 ? 26 : 0
  const usableH = Math.max(1, areaH - LBL_H - TOP_DIM)
  // ★ Altura de INSTALACIÓN: un aéreo va COLGADO, no apoyado. El tope del dibujo es
  //   mountHeight + height (no height), si no un aéreo a 1450 se saldría del área.
  const mountOf = (m) => Math.max(0, cfgOf(m).mountHeight || 0)
  const maxTop = Math.max(1, ...mods.map(m => mountOf(m) + cfgOf(m).height))
  const scale = Math.min(usableW / totalW, usableH / maxTop)
  const drawnW = totalW * scale + GAP * nGaps
  const floorY = areaY + areaH - LBL_H    // piso anclado al fondo del área
  const startX = areaX + Math.max(0, (areaW - drawnW) / 2) // borde izq. de la banda
  let cx = startX                                          // banda centrada
  s += `<text x="36" y="118" font-size="11" font-weight="800" letter-spacing="1.5" fill="${P.vh}">${D.view_conjunto}</text>`
  // línea de piso (referencia de apoyo y origen de las cotas de instalación)
  s += `<line x1="${areaX}" y1="${floorY + 0.5}" x2="${areaX + areaW}" y2="${floorY + 0.5}" stroke="${P.dim}" stroke-width="1"/>`
  s += `<text x="${areaX - 4}" y="${floorY + 3}" text-anchor="end" font-size="7" font-weight="700" letter-spacing=".5" fill="${P.muted}" opacity="0.75">${D.floor_word}</text>`
  mods.forEach((m, mi) => {
    const c = cfgOf(m)
    const mount = mountOf(m)
    const bw = c.width * scale, bh = c.height * scale
    const baseY = floorY - mount * scale        // borde INFERIOR del mueble
    s += buildAlzadoUnified(m, { x: cx, y: baseY - bh, w: bw, h: bh }, P, D, { dims: false })
    const mid = cx + bw / 2
    // ── cota de ANCHO (única, bajo el piso) ──
    const ty = floorY + 11
    s += `<line x1="${cx}" y1="${ty}" x2="${cx + bw}" y2="${ty}" stroke="${P.dim}" stroke-width="0.8"/>`
    s += `<line x1="${cx}" y1="${ty - 3}" x2="${cx}" y2="${ty + 3}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${cx + bw}" y1="${ty - 3}" x2="${cx + bw}" y2="${ty + 3}" stroke="${P.dim}" stroke-width="0.8"/>`
    s += `<text x="${mid}" y="${ty + 12}" text-anchor="middle" font-size="10" font-weight="700" fill="${P.text}">${c.width}</text>`
    // ── identificación del módulo (ya no la tacha la línea de cota) ──
    const tagRaw = (m && (m.id || m.name)) ? String(m.id || m.name) : `M${mi + 1}`
    const tag = tagRaw.length > 18 ? tagRaw.slice(0, 17) + '…' : tagRaw
    s += `<text x="${mid}" y="${floorY + 34}" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing=".4" fill="${P.muted}">${esc(tag)}</text>`
    s += `<text x="${mid}" y="${floorY + 44}" text-anchor="middle" font-size="7.5" fill="${P.muted}" opacity="0.75">${c.width}×${c.height} mm</text>`
    // ── cota de INSTALACIÓN (sólo colgados): del piso al borde inferior. Se dibuja en
    //    el vano vacío bajo el mueble, donde no hay dibujo con el que chocar.
    if (mount > 0 && baseY < floorY - 6) {
      const vx = mid
      // ★ Línea de cota CONTINUA a propósito: la discontinua ya está tomada por la
      //   convención de PIEZA OCULTA (faldón). Reusarla acá haría ambigua la lectura.
      s += `<line x1="${vx}" y1="${baseY}" x2="${vx}" y2="${floorY}" stroke="${P.dim}" stroke-width="0.8"/>`
      s += `<line x1="${vx - 4}" y1="${baseY}" x2="${vx + 4}" y2="${baseY}" stroke="${P.dim}" stroke-width="0.8"/><line x1="${vx - 4}" y1="${floorY}" x2="${vx + 4}" y2="${floorY}" stroke="${P.dim}" stroke-width="0.8"/>`
      s += `<text x="${vx + 5}" y="${(baseY + floorY) / 2 + 3}" font-size="9" font-weight="700" fill="${P.text}">${mount}</text>`
      s += `<text x="${mid}" y="${floorY + 54}" text-anchor="middle" font-size="7" fill="${P.muted}" opacity="0.75">${D.mount_word.replace('{h}', mount)}</text>`
    }
    cx += bw + GAP
  })
  // ── COTA CORRIDA TOTAL (cota combinada del conjunto) ──────────────────────────
  // ★ 2026-10-10: NIVEL 2 (exterior acabado). Las cotas individuales de cada módulo
  //   van bajo el piso (NIVEL 1, junto a las piezas); la cota CORRIDA total va arriba,
  //   en el aire reservado por TOP_DIM, abarcando toda la banda dibujada. Refleja el
  //   ancho instalado combinado (ej. 800 + 1000 = 1800 mm) SIN pisar las parciales.
  //   Solo con ≥2 módulos: para uno solo, su ancho ya está acotado abajo.
  if (mods.length > 1) {
    const dimY = areaY + 14, x0 = startX, x1 = startX + drawnW
    const parts = mods.map(m => cfgOf(m).width)
    const breakdown = parts.length <= 5 ? `${parts.join(' + ')} = ${totalW} mm` : `${totalW} mm`
    s += `<line x1="${x0}" y1="${dimY}" x2="${x1}" y2="${dimY}" stroke="${P.dim}" stroke-width="0.9"/>`
    s += `<line x1="${x0}" y1="${dimY - 4}" x2="${x0}" y2="${dimY + 4}" stroke="${P.dim}" stroke-width="0.9"/><line x1="${x1}" y1="${dimY - 4}" x2="${x1}" y2="${dimY + 4}" stroke="${P.dim}" stroke-width="0.9"/>`
    s += `<rect x="${(x0 + x1) / 2 - 62}" y="${dimY - 15}" width="124" height="13" fill="${P.bg}"/>`
    s += `<text x="${(x0 + x1) / 2}" y="${dimY - 5}" text-anchor="middle" font-size="10.5" font-weight="800" letter-spacing=".4" fill="${P.text}">${breakdown}</text>`
  }
  s += buildCutlist(allRows, P, 540, D)
  s += orbinSeal(P, D)
  s += `</svg>`
  return s
}

// TASK 3: FUTURE-PROOF DYNAMIC QR HOOKS (60x40mm thermal sticker)
// ★ 2026-07-26 — `lang` es OPCIONAL (llamadas existentes siguen funcionando), pero
//   DEBE pasarse el mismo idioma que el plano. Esta etiqueta se pega a la pieza física:
//   si el plano dice "Left Side Panel" y el sticker dice "Lateral Izquierdo", el
//   operario no puede emparejarlos. Es la superficie donde la incoherencia duele.
export function generatePieceStickerSVG(piece, projectId, lang) {
  const url = `https://orbin.app/track/piece?id=${piece.id}&proj=${projectId || 'mvp'}`;
  // 60x40mm sticker roughly maps to 226x151 pixels at 96 DPI
  return `<svg viewBox="0 0 226 151" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">
    <rect width="100%" height="100%" fill="white" />
    <!-- Placeholder for Barcode/QR Code Hook -->
    <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-dasharray="2 2"/>
    <text x="50" y="55" font-size="10" text-anchor="middle" fill="black">QR_HOOK</text>
    
    <text x="100" y="25" font-size="12" font-weight="bold" fill="black">${esc(localizePieceName(piece.name, lang) || 'PIEZA')}</text>
    <text x="10" y="110" font-size="9" fill="black">${url}</text>
  </svg>`;
}

// ── HOJA(S) DE CORTE DEDICADA(S) — lista COMPLETA, paginada, nada truncado ──────
// ★ 2026-10-10: el plano (módulo o conjunto) solo muestra un RESUMEN de la lista en
//   su banda inferior (se comparte la hoja con el dibujo). Para una lista de cortes
//   100% verificable —exigencia industrial— se emite una o más hojas A4 dedicadas con
//   TODAS las piezas del proyecto, en 2 columnas, sin cortar ninguna fila y sin pisar
//   el cajetín. Pura: devuelve un array de strings SVG (viewBox 1000×740), uno por
//   página. Devuelve [] cuando la lista cabe entera en el resumen del plano (≤6 filas).
// @returns {string[]}
export function generateCutlistSheetsSVG(modules, options = {}) {
  const P = PALETTES[options.theme === 'print' ? 'print' : 'screen']
  const D = LX(options.lang)
  const lang = lx0(options.lang)
  const mods = (modules || []).filter(Boolean)
  const rows = groupPieces(mods.flatMap(m => (m && m.pieces) || []), lang)
  if (rows.length <= 6) return []   // cabe en el resumen del plano → sin hoja extra

  const totalQty = rows.reduce((a, r) => a + r.qty, 0)
  const trunc = (str, len) => (str && str.length > len) ? str.substring(0, len - 1) + '…' : str
  // Layout de 2 columnas (x de cada columna y offsets de campo, en unidades del viewBox).
  const COLS = [36, 512], COLW = 460
  const Y_HEAD = 118, Y_FIRST = 142, STEP = 14, Y_BOTTOM = 700
  const rowsPerCol = Math.max(1, Math.floor((Y_BOTTOM - Y_FIRST) / STEP))
  const perPage = rowsPerCol * COLS.length
  const pageCount = Math.max(1, Math.ceil(rows.length / perPage))

  const colHeader = (x) =>
    `<g transform="translate(${x},${Y_HEAD})" font-size="8.5" font-weight="700" letter-spacing=".6" fill="${P.muted}">` +
    `<text x="0" y="0">${D.col_piece}</text><text x="238" y="0" text-anchor="middle">${D.col_qty}</text>` +
    `<text x="270" y="0">${D.col_dims}</text><text x="386" y="0" text-anchor="middle">${D.col_thick}</text>` +
    `<text x="410" y="0">${D.col_edge}</text></g>` +
    `<line x1="${x}" y1="${Y_HEAD + 8}" x2="${x + COLW}" y2="${Y_HEAD + 8}" stroke="${P.rule}" stroke-width="1"/>`

  const rowSvg = (r, x, y) =>
    `<g transform="translate(${x},${y})" font-size="9.5" fill="${P.text}">` +
    `<text x="0" y="0">${esc(trunc(r.name, 30))}</text><text x="238" y="0" text-anchor="middle">${r.qty}</text>` +
    `<text x="270" y="0">${r.largo} × ${r.ancho}</text><text x="386" y="0" text-anchor="middle">${r.t}</text>` +
    `<text x="410" y="0" fill="${P.muted}">${esc(trunc(grainLabel(r.type, D), 22))}</text></g>`

  const pages = []
  for (let pg = 0; pg < pageCount; pg++) {
    const pageRows = rows.slice(pg * perPage, (pg + 1) * perPage)
    const subtitle = D.cut_sheet_total.replace('{n}', totalQty).replace('{u}', rows.length) +
      (pageCount > 1 ? ` · ${D.cut_sheet_of.replace('{n}', pg + 1).replace('{m}', pageCount)}` : '')
    let s = `<svg viewBox="0 0 1000 740" xmlns="http://www.w3.org/2000/svg" font-family="ui-sans-serif, system-ui, sans-serif">`
    s += sheetHeader(D.cut_sheet_title, subtitle, P)
    s += colHeader(COLS[0])
    if (pageRows.length > rowsPerCol) s += colHeader(COLS[1])
    pageRows.forEach((r, i) => {
      const col = Math.floor(i / rowsPerCol)   // columna-mayor: llena col1 y luego col2
      const idx = i % rowsPerCol
      const x = COLS[col], y = Y_FIRST + idx * STEP
      s += rowSvg(r, x, y)
      // regla fina de separación: bajo cada fila que NO sea la última de su columna.
      const hasNextInCol = idx < rowsPerCol - 1 && (i + 1) < pageRows.length && Math.floor((i + 1) / rowsPerCol) === col
      if (hasNextInCol) s += `<line x1="${x}" y1="${y + 5}" x2="${x + COLW}" y2="${y + 5}" stroke="${P.rule}" stroke-width="0.4" opacity="0.5"/>`
    })
    // separador vertical entre columnas (solo si la 2ª tiene filas)
    if (pageRows.length > rowsPerCol) s += `<line x1="494" y1="${Y_HEAD - 4}" x2="494" y2="${Y_BOTTOM}" stroke="${P.thin}" stroke-width="0.6" opacity="0.6"/>`
    s += orbinSeal(P, D)
    s += `</svg>`
    pages.push(s)
  }
  return pages
}

export default generateModulePlanSVG
