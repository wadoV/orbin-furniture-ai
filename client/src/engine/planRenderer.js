/**
 * Orbin AI — Adaptador jsPDF del ALZADO (Plano Ejecutivo).
 * ─────────────────────────────────────────────────────────────────────────────
 * ★ UNIFICADO 2026-07-23: la geometría (qué piezas y dónde) vive en elevationModel.js
 *   (SSOT compartida con el Plano de Montaje). Aquí SOLO se traduce el modelo a
 *   comandos jsPDF. Antes este archivo tenía su propia copia de la proyección y
 *   divergía del montaje. Ahora ambos proyectan las MISMAS piezas reales.
 */
import { pieceRectsMM, elevationBox as _elevationBox } from './elevationModel.js'

// Re-export para compatibilidad (ExportPanel importa elevationBox desde aquí).
export const elevationBox = (mod, ox, oy, areaW, areaH) => _elevationBox(mod, ox, oy, areaW, areaH, 20)

export function drawElevation(doc, mod, ox, oy, areaW, areaH, opts = {}) {
  const cfg = mod.configuration || {}
  const W = cfg.width || 600, H = cfg.height || 720
  const box = elevationBox(mod, ox, oy, areaW, areaH)
  const sc = box.scale, bx = box.x, by = box.y
  const X = x => bx + x * sc, Y = y => by + (H - y) * sc   // y-up → pantalla
  doc.setDrawColor(27, 27, 27); doc.setFillColor(255, 255, 255)

  // ── Piezas (modelo compartido, ya ordenado atrás→adelante) ──
  const rects = pieceRectsMM(mod)
  for (const r of rects) {
    const px = X(r.x0), py = Y(r.y0 + r.dy), pw = r.dx * sc, ph = r.dy * sc
    if (r.style === 'drawer_front') {
      doc.setLineWidth(0.3); doc.rect(px, py, pw, ph, 'FD')
      doc.setLineWidth(0.5); doc.line(X(r.cx - 90), Y(r.cy), X(r.cx + 90), Y(r.cy))
    } else if (r.style === 'door') {
      doc.setLineWidth(0.3); doc.rect(px, py, pw, ph, 'FD')
      // Tirador hacia el CENTRO del mueble (puertas dobles se encuentran al medio).
      const hxmm = r.cx >= W / 2 ? (r.cx - r.dx / 2 + 60) : (r.cx + r.dx / 2 - 60)
      doc.circle(X(hxmm), Y(r.cy), 0.8, 'F')
    } else if (r.style === 'baseboard') {
      doc.setLineWidth(0.25); doc.rect(px, py, pw, ph, 'FD')
    } else if (r.style === 'apron') {
      // Faldón/modesty panel: pieza TRASERA vista por el vano → fill claro + contorno
      // en LÍNEA OCULTA (discontinua). Vano abierto; tamaño/posición reales (fiel a cortes).
      doc.setFillColor(242, 242, 242)
      doc.setLineWidth(0.25); doc.setLineDashPattern([1, 0.7], 0)
      doc.rect(px, py, pw, ph, 'FD')
      doc.setLineDashPattern([], 0); doc.setFillColor(255, 255, 255)
    } else if (r.style === 'solid') {
      doc.setLineWidth(0.35); doc.rect(px, py, pw, ph, 'FD')
    } else {
      doc.setLineWidth(0.35); doc.rect(px, py, pw, ph)
    }
  }

  // ── cotas ──
  doc.setDrawColor(90, 90, 90); doc.setTextColor(60, 60, 60); doc.setFontSize(7); doc.setLineWidth(0.18)
  const dimH = (x1, x2, y, txt) => { doc.line(X(x1), Y(y), X(x2), Y(y)); doc.text(String(txt), (X(x1) + X(x2)) / 2, Y(y) - 1.2, { align: 'center' }) }
  const dimV = (y1, y2, x, txt) => { doc.line(X(x), Y(y1), X(x), Y(y2)); doc.text(String(txt), X(x) - 1.5, (Y(y1) + Y(y2)) / 2, { align: 'center', angle: 90 }) }
  if (opts.overallDims !== false) {
    dimH(0, W, H + (12 / sc), W)
    dimV(0, H, -(12 / sc), H)
  }
  // cotas internas (derecha): niveles Y de horizontales y frentes.
  if (opts.internalDims !== false) {
    const lv = new Set([0, H])
    for (const r of rects) {
      if (['piso', 'techo', 'base', 'shelf', 'repisa', 'estante', 'baseboard'].includes(r.type)) lv.add(Math.round(r.cy))
      if (r.type === 'drawer_front') { lv.add(Math.round(r.cy - r.dy / 2)); lv.add(Math.round(r.cy + r.dy / 2)) }
    }
    // FIX cotas solapadas ("50 59"): mergear niveles <20mm y umbral >=55mm.
    let ys = [...lv].sort((a, b) => a - b)
    const merged = []; for (const y of ys) { if (!merged.length || y - merged[merged.length - 1] >= 20) merged.push(y) }
    ys = merged
    const cxr = W + ((opts.internalDimOffset || 12) / sc)
    for (let i = 0; i < ys.length - 1; i++) { const d = ys[i + 1] - ys[i]; if (d >= 55) dimV(ys[i], ys[i + 1], cxr, d) }
  }
  // título (traducible: lo aporta el llamador)
  if (opts.showTitle !== false) {
    const label = opts.title || 'Alzado frontal'
    doc.setTextColor(27, 27, 27); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text(`${mod.id || 'MOD'} · ${W}×${H}×${cfg.depth || ''} mm · ${label}`, ox + 2, oy + areaH - 1)
    doc.setFont('helvetica', 'normal')
  }
  return box   // FUENTE ÚNICA de encuadre para el llamador (marco de cotas)
}

/** Añade al doc una página por módulo con su alzado. */
export function addProjectPlans(doc, modules, opts = {}) {
  const A4W = 297, A4H = 210, M = 12; let n = 0
  modules.forEach((mod, i) => { if (i > 0) doc.addPage(); doc.rect(M, M, A4W - 2 * M, A4H - 2 * M); drawElevation(doc, mod, M + 4, M + 4, A4W - 2 * M - 8, A4H - 2 * M - 8); n++ })
  return n
}

export default { drawElevation, addProjectPlans, elevationBox }
