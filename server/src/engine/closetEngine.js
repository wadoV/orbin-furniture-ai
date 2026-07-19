/**
 * Orbin AI — Parametric Furniture Engine v4.5.0 [LEGACY_RESTORATION]
 * [PROTECTED] DNA_V1_RESTORATION - Senior Fullstack Auditor & Software Archeologist
 *
 * Manufacturing Principles:
 * - Laterales al suelo (DNA V1): Master sides go from ground to top.
 * - Techo/Piso Internos: Internal top and bottom plates (W - 2*T).
 * - Caja Técnica Completa: 13mm deduction for telescopic slides per side.
 * - Vertical Zócalos: Front and back plinths with vertical grain.
 * - MDF Thickness support: 15mm, 18mm, 25mm industrial standards.
 */

const { v4: uuidv4 } = require('uuid')
// ── Manifiesto matemático (Single Source of Truth) — DeepSeek R1 specs ──
const FurnitureMath = require('../ai/furnitureMathSpecs')
// ★ Ley física (chapa + herrajes): FUENTE ÚNICA en ./constants.
//   Generador y validador leen el MISMO MATERIAL y el MISMO HARDWARE para evitar
//   que el motor genere piezas que su propio validador rechaza (P0 resuelto 2026-07-19).
const { MATERIAL, HARDWARE } = require('./constants')

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  moduleType: 'standard',
  width: 600, height: 720, depth: 580,
  thickness: 18, backThickness: 6,
  numShelves: 1, numDrawers: 0, drawerHeight: 180,
  numDividers: 0,
  drawerLayout: 'vertical',
  hasDoors: true, numDoors: 2, doorType: 'hinged',
  edgeBandingType: 'thin',
  baseboard: true, baseboardHeight: 100,
  baseType: 'recessed', legHeight: 100,
  topStyle: null,   // null = auto por moduleType ('base'→overlay, resto→inset)
  doorStyle: null,  // null = auto por moduleType ('base'→overlay, resto→legacy)
  tamponado: 'none',
  hasCountertop: true,
  handleType: 'standard',
  // ── ADITIVO 2026-07-19 (tendencias 2026 + BOM completo). Defaults neutros:
  //    con estos valores el output es IDÉNTICO al histórico (golden master).
  hasHangingRod: false,      // wardrobe: cabideiro + suportes en BOM
  doorFinish: null,          // 'mirror' → espejo 4mm sobre puerta en BOM
  hasLed: false,             // fita LED + fonte en BOM (nichos/aéreos)
  countertopMaterial: null,  // 'mdf' → genera pieza BANCADA 25mm; null → BOM externo
  pedestalWidth: 400         // solo moduleType 'desk': ancho del gavetero
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePiece(id, name, type, w, h, t, qty, x, y, z, grainDir, edgeBanding, notes, frontType = null) {
  return {
    id, name, type,
    width:  Math.max(2, Math.round(w)),
    height: Math.max(2, Math.round(h)),
    thickness: t,
    quantity: qty,
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    grainDirection: grainDir || 'horizontal',
    edgeBanding: edgeBanding || { front: true },
    notes: notes || '',
    frontType: frontType
  }
}

function generateCutList(pieces, defaultEdgeThickness = 1.0) {
  const list = []
  for (const piece of pieces) {
    const eb = piece.edgeBanding || {}
    const tEdge = typeof eb.thickness === 'number' ? eb.thickness : defaultEdgeThickness

    let countW = 0
    if (eb.all) {
      countW = 2
    } else {
      if (eb.left) countW++
      if (eb.right) countW++
    }

    let countH = 0
    if (eb.all) {
      countH = 2
    } else {
      if (eb.top || eb.front) countH++
      if (eb.bottom || eb.back) countH++
    }

    const netCutWidth  = Math.max(2, Math.round((piece.width - (countW * tEdge)) * 10) / 10)
    const netCutHeight = Math.max(2, Math.round((piece.height - (countH * tEdge)) * 10) / 10)

    for (let q = 0; q < piece.quantity; q++) {
      list.push({
        id:             piece.quantity > 1 ? piece.id + '-' + (q + 1) : piece.id,
        name:           piece.quantity > 1 ? piece.name + ' (' + (q + 1) + '/' + piece.quantity + ')' : piece.name,
        type:           piece.type,
        nominalWidth:   piece.width,
        nominalHeight:  piece.height,
        cutWidth:       netCutWidth,
        cutHeight:      netCutHeight,
        thickness:      piece.thickness,
        grainDirection: piece.grainDirection,
        edgeBanding:    piece.edgeBanding
      })
    }
  }
  return list
}

// ─── Desk Topology (ADITIVO 2026-07-19) ─────────────────────────────────────
// moduleType 'desk': escritorio real — tampo sobrepuesto, vano libre para
// piernas y pedestal de gavetas a la derecha. Rama independiente: no toca
// ningún path existente. El preset "Escritorio" generaba antes un aparador
// cerrado (sin vano, gavetas de ancho completo) — topología incorrecta.
function generateDeskFurniture(cfg) {
  const { width: W, height: H, depth: D, thickness: T, backThickness: BT } = cfg
  const pedW = Math.min(Math.max(cfg.pedestalWidth || 400, 300), W - 600 > 300 ? W - 600 : W * 0.4)
  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  // Tampo sobrepuesto: ancho completo, apoya sobre laterales y pedestal
  pieces.push(makePiece(nextId('TAMPO'), 'Tampo Escritorio', 'bancada', W, D, T, 1, W/2, H - T/2, D/2, 'horizontal', { all: true }, 'Tampo de trabajo — canto ABS 2mm'))

  const latH = H - T
  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', D, latH, T, 1, T/2, latH/2, D/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', D, latH, T, 1, W - T/2, latH/2, D/2, 'vertical', { front: true }))

  // Pedestal: costado interno que cierra el gavetero (lado derecho)
  const divX = W - pedW + T/2
  pieces.push(makePiece(nextId('PED-DIV'), 'Costado Pedestal', 'divider', D, latH, T, 1, divX, latH/2, D/2, 'vertical', { front: true }, 'Cierra el gavetero — vano libre a la izquierda'))

  const pedInterior = pedW - 2 * T          // entre PED-DIV y LAT-R
  const kneeSpan = W - pedW - T             // vano libre para piernas

  // Piso del pedestal
  pieces.push(makePiece(nextId('PED-BASE'), 'Base Pedestal', 'piso', pedInterior, D - BT, T, 1, W - pedW/2 - T/2 + T/2, T/2, (D - BT)/2, 'horizontal', { front: true }))

  // Fondo solo detrás del pedestal (el vano queda abierto para cables)
  pieces.push(makePiece(nextId('PED-FUNDO'), 'Fondo Pedestal', 'fondo', pedInterior, latH - T, BT, 1, W - pedW/2, (latH + T)/2, D - BT/2, 'none'))

  // Faldón trasero (modesty panel) en el vano — rigidiza y oculta cables
  const apronH = Math.min(300, Math.max(150, Math.round(latH * 0.35)))
  pieces.push(makePiece(nextId('TRAV-FALDON'), 'Faldon Trasero', 'tie_strip', kneeSpan, apronH, T, 1, (W - pedW - T)/2 + T/2, latH - apronH/2, D - BT - T/2, 'horizontal', { front: true }, 'Modesty panel — rigidez del vano'))

  // Gavetas del pedestal (pila desde abajo, holgura corredera 26mm)
  const CLEAR = 16, MINH = 80
  const availH = latH - 2 * T
  const reqDrawers = cfg.numDrawers || 0
  const dh = Math.max(MINH, cfg.drawerHeight || 150)
  const maxRows = Math.max(0, Math.floor(availH / (dh + CLEAR)))
  const n = Math.min(reqDrawers, maxRows)
  const pedCenterX = W - pedW + T + pedInterior/2
  for (let i = 0; i < n; i++) {
    const yPos = T + i * (dh + CLEAR) + dh/2
    const drawerId = `DRW-${i + 1}`
    pieces.push({ ...makePiece(nextId('GAV-FF'), `Frente Gaveta ${i + 1}`, 'drawer_front',
      pedInterior - 2*HARDWARE.DRAWER_FRONT_GAP, dh - 2*HARDWARE.DRAWER_FRONT_GAP, T, 1,
      pedCenterX, yPos, D - T/2, 'horizontal', { all: true }, 'Holgura 2mm/lado', 'drawer_front'), drawerGroupId: drawerId })
    const boxOuterW = FurnitureMath.drawerBox.netWidth(pedInterior)
    const boxInnerW = FurnitureMath.drawerBox.headerWidth(boxOuterW, T)
    const boxD = Math.max(250, Math.floor((D - BT - 20) / 50) * 50)
    const boxH = dh - 40
    if (boxOuterW > 2 * T && boxInnerW > 10 && boxH > 20) {
      pieces.push({ ...makePiece(nextId('GAV-LAT'), `Lateral Cajon ${i+1}`, 'drawer_box', boxD, boxH, T, 2, pedCenterX, yPos, D/2, 'horizontal', { front: true }), drawerGroupId: drawerId })
      pieces.push({ ...makePiece(nextId('GAV-EST'), `Frente/Trasera Cajon ${i+1}`, 'drawer_box', boxInnerW, boxH, T, 2, pedCenterX, yPos, D/2, 'horizontal', { front: true }), drawerGroupId: drawerId })
      pieces.push({ ...makePiece(nextId('GAV-FUNDO'), `Fondo Cajon ${i+1}`, 'drawer_bottom', boxOuterW, boxD, 6, 1, pedCenterX, yPos - boxH/2 + 3, D/2, 'horizontal', { none: true }), drawerGroupId: drawerId })
    }
  }

  const specAdjustments = []
  if (n < reqDrawers) {
    specAdjustments.push({
      code: 'DRAWER_COUNT_REDUCED', severity: 'critical', field: 'numDrawers',
      requested: reqDrawers, applied: n,
      message: `Se solicitaron ${reqDrawers} gavetas pero solo caben ${n} en el pedestal (${availH}mm útiles).`
    })
  }
  cfg.numDrawers = n
  cfg.specAdjustments = specAdjustments

  return {
    pieces,
    config: cfg,
    internalDimensions: { width: kneeSpan, height: latH, depth: D - BT }
  }
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

function generateFurniture(params) {
  const cfg = { ...DEFAULTS, ...params }

  // ── ADITIVO 2026-07-19: topología escritorio — rama dedicada, path viejo intacto
  if (cfg.moduleType === 'desk') return generateDeskFurniture(cfg)

  // ── Base independiente / patas (compat: baseboard:false legacy → 'none') ──
  const legHeight = cfg.legHeight || 100
  let baseType = params.baseType || (params.baseboard === false ? 'none' : (cfg.baseType || 'recessed'))
  if (cfg.moduleType !== 'aereo') {
    if (baseType === 'none') { cfg.baseboard = false }
    else if (baseType === 'legs') { cfg.baseboard = true; cfg.baseboardHeight = legHeight }
  }
  cfg.baseType = baseType
  cfg.legHeight = legHeight

  // ★ AUTO-FIT de cajones: la pila no puede exceder la altura interna útil (misma fórmula
  //   que el validador). Primero baja la altura del cajón; si ni al mínimo (80mm) caben,
  //   reduce la cantidad. Corrige el config que se devuelve y, por ende, la geometría.
  //
  // ⚠️ REGLA DE TRANSPARENCIA (2026-07-19): el motor NUNCA altera el pedido del cliente
  //    en silencio. Toda corrección se registra en cfg.specAdjustments y se propaga hasta
  //    el proyecto (y de ahí a UI/PDF). Un marcenario que pide 5 gavetas y recibe 4 sin
  //    aviso pierde la confianza en la herramienta de forma irreversible.
  const specAdjustments = []
  const requestedDrawers      = cfg.numDrawers
  const requestedDrawerHeight = cfg.drawerHeight

  if ((cfg.numDrawers || 0) > 0) {
    const CLEAR = 16, MINH = 80
    const availableHeight = cfg.height
      - (cfg.baseboard ? (cfg.baseboardHeight || 100) : 0)
      - (2 * cfg.thickness)
    if (availableHeight > 0) {
      const isH = cfg.drawerLayout === 'horizontal' && cfg.numDrawers > 1
      const cols = isH ? 2 : 1
      let rows = Math.ceil(cfg.numDrawers / cols)
      // ¿Cómoda pura? (solo gavetas: sin estantes ni puertas) → las gavetas LLENAN
      //   el interior, sin dejar hueco abierto arriba. CLEAR (16mm) es la holgura de
      //   corredera que el validador exige por gaveta (drawerHeight+16)·filas ≤ interna,
      //   así que repartimos: drawerHeight = floor(interna/filas) − CLEAR ⇒ pila == interna.
      const drawerOnly = (cfg.numShelves || 0) === 0 && !cfg.hasDoors
      if (drawerOnly) {
        let maxRows = Math.max(1, Math.floor(availableHeight / (MINH + CLEAR)))
        if (maxRows < rows) {                 // ni al mínimo caben todas → reduce cantidad
          cfg.numDrawers = Math.max(1, maxRows * cols)
          rows = Math.ceil(cfg.numDrawers / cols)
        }
        cfg.drawerHeight = Math.max(MINH, Math.floor(availableHeight / rows) - CLEAR)
      } else {
        // Mixto (gavetas abajo + estantes/puertas arriba): reservar ~17% (validador < 85%).
        const budget = availableHeight * 0.83
        let maxDH = Math.floor(budget / rows) - CLEAR
        if ((cfg.drawerHeight || 0) > maxDH) cfg.drawerHeight = Math.max(MINH, maxDH)
        const maxRows = Math.floor(budget / (MINH + CLEAR))
        if (maxRows < rows) {
          cfg.numDrawers = Math.max(1, maxRows * cols)
          rows = Math.ceil(cfg.numDrawers / cols)
          maxDH = Math.floor(budget / rows) - CLEAR
          cfg.drawerHeight = Math.max(MINH, Math.min(cfg.drawerHeight || MINH, maxDH))
        }
      }
    }
  }

  // ── Registro de correcciones al spec del cliente (transparencia obligatoria) ──
  if (cfg.numDrawers !== requestedDrawers) {
    specAdjustments.push({
      code: 'DRAWER_COUNT_REDUCED',
      severity: 'critical',
      field: 'numDrawers',
      requested: requestedDrawers,
      applied: cfg.numDrawers,
      message: `Se solicitaron ${requestedDrawers} gavetas pero solo caben ${cfg.numDrawers} ` +
               `en la altura interna útil (mínimo ${80}mm por gaveta + 16mm de corredera). ` +
               `Aumente la altura del módulo o reduzca el pedido.`
    })
  }
  if (cfg.drawerHeight !== requestedDrawerHeight) {
    specAdjustments.push({
      code: 'DRAWER_HEIGHT_ADJUSTED',
      severity: 'info',
      field: 'drawerHeight',
      requested: requestedDrawerHeight,
      applied: cfg.drawerHeight,
      message: `Altura de gaveta ajustada de ${requestedDrawerHeight}mm a ${cfg.drawerHeight}mm ` +
               `para que la pila entre en la altura interna útil.`
    })
  }
  cfg.specAdjustments = specAdjustments

  const { moduleType, width: W, height: H, depth: D, thickness: T, backThickness: BT,
          numShelves, numDrawers, drawerHeight, drawerLayout, baseboard, baseboardHeight,
          hasDoors, numDoors, hasCountertop, topShelf } = cfg

  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  const isAereo = moduleType === 'aereo'
  const isBase = moduleType === 'base' || moduleType === 'standard'
  const BH3 = (baseboard && !isAereo) ? (baseboardHeight || 100) : 0
  const structuralHeight = H - BH3

  // ── MÉTODO DE MONTAJE DE PUERTA (cfg.doorStyle) ─────────────────────────────
  // Simétrico a topStyle, pero en el eje de la PROFUNDIDAD.
  // 'overlay': la puerta va por FUERA y la profundidad pedida es la ACABADA ⇒
  //     carcasa = D − T, la puerta ocupa los últimos T ⇒ total = D exacto.
  // 'legacy': comportamiento histórico — carcasa = D y la puerta se monta por
  //     fuera SUMANDO su espesor ⇒ profundidad real = D + T (580 pedido → 598 real).
  // Default: 'overlay' en módulos base (igual criterio que topStyle), 'legacy' en
  // el resto para no alterar diseños ya guardados.
  const doorStyle = (cfg.doorStyle && cfg.doorStyle !== 'auto')
    ? cfg.doorStyle : (moduleType === 'base' ? 'overlay' : 'legacy')
  const doorT = (doorStyle === 'overlay' && hasDoors) ? T : 0
  const CD = D - doorT   // profundidad de la CARCASA (sin la puerta sobrepuesta)

  const internalWidth = FurnitureMath.internalSpan(W, T)
  const internalDepth = CD - BT

  // BUG FIX T06/T09/T10/T12/T15/T23/T29: Descriptive guard before any calculation
  if (internalWidth <= 0) {
    const err = new Error(`INSUFFICIENT_SPACE: internalWidth=${internalWidth}mm (width=${W} - 2×thickness=${T}). Largura insuficiente para acomodar as laterais.`)
    err.statusCode = 400; throw err;
  }
  if (internalWidth < 50) {
    const err = new Error(`INSUFFICIENT_SPACE: internalWidth=${internalWidth}mm é menor que 50mm mínimo. Aumente a largura ou reduza o espessura.`)
    err.statusCode = 400; throw err;
  }
  if (structuralHeight <= 0) {
    const err = new Error(`INSUFFICIENT_SPACE: structuralHeight=${structuralHeight}mm (height=${H} - baseboard=${BH3}). Rodapé maior ou igual à altura total.`)
    err.statusCode = 400; throw err;
  }
  if (structuralHeight < 100) {
    const err = new Error(`INSUFFICIENT_SPACE: structuralHeight=${structuralHeight}mm é menor que 100mm mínimo. Reduza o rodapé ou aumente a altura.`)
    err.statusCode = 400; throw err;
  }

  const onLegs = baseType === 'legs'

  // ── MÉTODO DE ARMADO DE LA TAPA (cfg.topStyle) ──────────────────────────────
  // 'overlay' (tapa sobrepuesta): la tapa se apoya ENCIMA de los laterales.
  //     lateral = H − T   ·   tapa = ancho COMPLETO (W)
  //     Cliente pide 700mm con 18mm ⇒ lateral 682mm. Armado de módulos base /
  //     superficie de uso. La altura pedida es la ALTURA ACABADA.
  // 'inset' (DNA V1 histórico): el lateral corre de piso a techo y la tapa encaja
  //     ENTRE los laterales.  lateral = H   ·   tapa = W − 2T
  //     Armado de roperos y columnas (canto del lateral visto en todo el alto).
  // Ambos son correctos: cambian el despiece, no la calidad. Por eso es un
  // parámetro y no una constante — ver PROJECT_SNAPSHOT 2026-07-19.
  const topStyle = (cfg.topStyle && cfg.topStyle !== 'auto')
    ? cfg.topStyle : (moduleType === 'base' ? 'overlay' : 'inset')
  // Con travesaños (base + cubierta comprada aparte) no hay tapa de MDF que
  // apoyar: el lateral llega arriba y la encimera va sobre él.
  const hasTopPanel = !(isBase && hasCountertop && moduleType !== 'standard')
  const topT = (topStyle === 'overlay' && hasTopPanel && !isAereo) ? T : 0

  const latBottom = onLegs ? BH3 : 0
  const latH = H - latBottom - topT
  const latY = latBottom + latH/2
  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', CD, latH, T, 1, T/2, latY, CD/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', CD, latH, T, 1, W - T/2, latY, CD/2, 'vertical', { front: true }))

  // ── TAMPONADO: panel de acabamiento que tapa tornillos en el costado visible ──
  const tamp = cfg.tamponado || 'none'
  if (tamp === 'left' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-L'), 'Tampão Lateral Izq', 'tamponado', CD, latH, T, 1, -T/2, latY, CD/2, 'vertical', { front: true }, 'Cubre tornillos costado izquierdo'))
  if (tamp === 'right' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-R'), 'Tampão Lateral Der', 'tamponado', CD, latH, T, 1, W + T/2, latY, CD/2, 'vertical', { front: true }, 'Cubre tornillos costado derecho'))

  if (isBase && hasCountertop && moduleType !== 'standard') {
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, T/2 + 20, 'horizontal', { front: true }, 'Refuerzo Estructural'))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, D - BT - T/2, 'horizontal', { front: true }, 'Refuerzo Estructural'))
  } else {
    // COHERENCIA OBLIGATORIA: si el lateral se acortó (overlay), la tapa se apoya
    // encima y debe cubrir el ancho COMPLETO. Con W−2T quedaría flotando dejando
    // un hueco de T a cada lado sobre el canto del lateral.
    const topWidth = topT > 0 ? W : internalWidth
    pieces.push(makePiece(nextId('TAMPO'), 'Techo', 'techo', topWidth, CD, T, 1, W/2, H - T/2, CD/2, 'horizontal', { front: true }))
  }

  pieces.push(makePiece(nextId('BASE'), 'Base Inferior', 'piso', internalWidth, CD, T, 1, W/2, BH3 + T/2, CD/2, 'horizontal', { front: true }))

  // BUG FIX #5 & VULN-05: base+countertop has traversaños (70mm) at top, not a techo (T).
  const topDeduction = (isBase && hasCountertop && moduleType !== 'standard') ? 70 : T
  const baseBackH = H - BH3 - T - topDeduction
  const grooveDepth = cfg.grooveDepth || 8
  const backH = (cfg.backStyle === 'grooved') ? baseBackH + (2 * grooveDepth) : baseBackH
  // ── Fondo: ancho según método (manifiesto = SSOT).
  const backWidth = (cfg.backStyle === 'grooved')
    ? FurnitureMath.backPanels.groovedWidth(internalWidth, grooveDepth)
    : (cfg.backStyle === 'nailed')
      ? FurnitureMath.backPanels.nailedWidth(W)
      : internalWidth
  pieces.push(makePiece(nextId('FUNDO'), 'Fondo', 'fondo', backWidth, backH, BT, 1, W/2, BH3 + T + baseBackH/2, CD - BT/2, 'none'))

  if (baseType === 'recessed' && BH3 > 0) {
    pieces.push(makePiece(nextId('RDPE-F'), 'Zócalo Frontal', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, D - T/2 - 50, 'vertical', { front: true }))
    pieces.push(makePiece(nextId('RDPE-B'), 'Zócalo Trasero', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, T/2 + 50, 'vertical', { front: true }))
  }

  const safeDrawerHeight = Math.max(100, drawerHeight)
  let drawerYStart = BH3 + T
  const SLIDE_GAP = HARDWARE.SLIDE_CLEARANCE

  const numDivs = cfg.numDividers || 0
  const isHorizontal = drawerLayout === 'horizontal' && numDrawers > 1
  const cols = isHorizontal ? 2 : 1
  const drawersPerCol = Math.ceil(numDrawers / cols)
  const drawerW = isHorizontal ? (internalWidth / 2) - T/2 : internalWidth

  // ★ AUDIT FIX 2026-07-19 (aditivo — solo rama horizontal): con 2 columnas de
  // gavetas no existía montante central: las corredicas interiores no tenían
  // superficie de fijación (mueble no montable). Genera un montante que ocupa
  // exactamente el gap de T entre columnas, a la altura de la zona de gavetas.
  if (isHorizontal) {
    const gavZoneH = drawersPerCol * safeDrawerHeight
    if (gavZoneH > 0) {
      pieces.push(makePiece(
        nextId('DIV-GAV'), 'Montante Central Gavetas', 'divider',
        internalDepth, gavZoneH, T, 1,
        T + drawerW + T/2, drawerYStart + gavZoneH/2, D/2,
        'vertical', { front: true }, 'Fijación de corredicas interiores — obligatorio en 2 columnas'
      ))
    }
  }

  for (let i = 0; i < numDrawers; i++) {
    const colIdx = isHorizontal ? (i % 2) : 0
    const rowIdx = isHorizontal ? Math.floor(i / 2) : i
    const xPos = isHorizontal ? (T + (colIdx * (drawerW + T)) + drawerW/2) : W/2
    const yPos = drawerYStart + (rowIdx * safeDrawerHeight) + safeDrawerHeight/2

    if (yPos < H - 50) {
      const drawerId = `DRW-${i + 1}`

      pieces.push({
        ...makePiece(
          nextId('GAV-FF'), `Frente Gaveta ${i + 1}`, 'drawer_front',
          drawerW - 2*HARDWARE.DRAWER_FRONT_GAP, safeDrawerHeight - 2*HARDWARE.DRAWER_FRONT_GAP, T, 1,
          xPos, yPos, D - T/2, 'horizontal',
          { all: true }, 'Holgura 2mm/lado', 'drawer_front'
        ),
        drawerGroupId: drawerId
      })

      const boxOuterW = FurnitureMath.drawerBox.netWidth(drawerW)
      const boxInnerW = FurnitureMath.drawerBox.headerWidth(boxOuterW, T)
      // VULN-03 FIX: Profundidad comercial basada en espacio útil con 20mm de holgura trasera
      const maxAvailableD = D - BT - 20
      const boxD = Math.max(250, Math.floor(maxAvailableD / 50) * 50)
      const boxH = safeDrawerHeight - 40
      const boxZ = D/2 + BT/2

      // BUG FIX #2: skip drawer box if it's physically impossible (too narrow)
      if (boxOuterW > 2 * T && boxInnerW > 10 && boxD > 50 && boxH > 20) {
        pieces.push({
          ...makePiece(nextId('GAV-LAT'), `Lateral Cajón ${i+1}`, 'drawer_box', boxD, boxH, T, 2, xPos, yPos, boxZ, 'horizontal', { front: true }),
          drawerGroupId: drawerId
        })

        pieces.push({
          ...makePiece(nextId('GAV-EST'), `Frente/Trasera Cajón ${i+1}`, 'drawer_box', boxInnerW, boxH, T, 2, xPos, yPos, boxZ, 'horizontal', { front: true }),
          drawerGroupId: drawerId
        })

        pieces.push({
          ...makePiece(nextId('GAV-FUNDO'), `Fondo Cajón ${i+1}`, 'drawer_bottom', boxOuterW, boxD, 6, 1, xPos, yPos - boxH/2 + 3, boxZ, 'horizontal', { none: true }),
          drawerGroupId: drawerId
        })
      } else {
        console.warn(`[Engine] Cajón ${i+1}: caja imposible (boxOuterW=${boxOuterW}, boxInnerW=${boxInnerW}) — solo frente generado.`)
      }
    }
  }

  let shelfYStart = drawerYStart + (isHorizontal ? drawersPerCol : numDrawers) * safeDrawerHeight + T/2

  // HARD_CONSTRAINT: Structural closure required for all drawer modules
  // ★ PROTECTED: Separator shelf on top of drawer zone (closes gap visually)
  if (numDrawers > 0) {
    const sepY = shelfYStart
    if (sepY < H - 100) {
      const technicalDepth = hasDoors ? (internalDepth - 20) : internalDepth
      pieces.push(makePiece(
        nextId('SEP'), 'Repisa Separadora (encima gavetas)', 'shelf',
        internalWidth - 2, technicalDepth, T, 1,
        W/2, sepY, internalDepth/2 + BT, 'horizontal', { front: true },
        'Separador estructural gavetas/estantes'
      ))
      shelfYStart = sepY + T + 10  // offset regular shelves above separator
    }
  }

  // BUG FIX #9: dynamic shelf spacing — distribute evenly in available zone.
  const shelfZoneTop = H - T - 50
  const shelfZoneH   = Math.max(0, shelfZoneTop - shelfYStart)
  const shelfSpacing = numShelves > 0 ? Math.floor(shelfZoneH / (numShelves + 1)) : 0

  // ── ADITIVO 2026-07-19: con divisores, los estantes se generan POR COMPARTIMENTO.
  //    Antes: estante de ancho completo atravesaba los divisores (colisión física
  //    verificada con posiciones — mueble no ensamblable). Sin divisores (numDivs=0)
  //    el despiece es byte-idéntico al histórico.
  const shelfCompartments = []
  if (numDivs > 0) {
    const divSpacingS = internalWidth / (numDivs + 1)
    for (let c = 0; c <= numDivs; c++) {
      const leftEdge  = c === 0       ? T       : T + divSpacingS * c + T / 2
      const rightEdge = c === numDivs ? W - T   : T + divSpacingS * (c + 1) - T / 2
      shelfCompartments.push({ center: (leftEdge + rightEdge) / 2, span: rightEdge - leftEdge })
    }
  } else {
    shelfCompartments.push({ center: W / 2, span: internalWidth })
  }

  for (let i = 0; i < numShelves; i++) {
    const yPos = shelfYStart + (i + 1) * shelfSpacing
    if (yPos > shelfYStart && yPos < shelfZoneTop) {
      const technicalDepth = hasDoors ? (internalDepth - 20) : internalDepth
      for (let c = 0; c < shelfCompartments.length; c++) {
        const comp = shelfCompartments[c]
        pieces.push(makePiece(
          nextId('PRAT'),
          shelfCompartments.length > 1 ? `Estante ${i + 1} (vano ${c + 1})` : `Estante ${i + 1}`,
          'repisa',
          comp.span - 2, technicalDepth, T, 1,
          comp.center, yPos, internalDepth/2 + BT, 'horizontal', { front: true }
        ))
      }
    }
  }

  // ★ PROTECTED: Central Dividers — stop at drawer zone, not full height
  // VULN-04 FIX: divStartY arranca SOBRE la repisa separadora (+T) para no colisionar 18mm con SEP
  if (numDivs > 0) {
    const totalDrawerH = (numDrawers > 0 ? (isHorizontal ? drawersPerCol : numDrawers) * safeDrawerHeight : 0)
    let divStartY, divHeight
    if (numDrawers > 0) {
      divStartY = BH3 + T + totalDrawerH + T
      divHeight = H - divStartY - T
    } else {
      divStartY = BH3 + T
      divHeight = structuralHeight - 2 * T
    }
    if (divHeight > T) {
      const divSpacing = internalWidth / (numDivs + 1)
      for (let i = 1; i <= numDivs; i++) {
        const xPos = T + divSpacing * i
        pieces.push(makePiece(
          nextId('DIV'), `Lateral Central ${i}`, 'divider',
          internalDepth, divHeight, T, 1,
          xPos, divStartY + divHeight / 2, D / 2,
          'vertical', { front: true }, 'Divisor vertical — para encima de separadora'
        ))
      }
    }
  }

  if (hasDoors) {
    const totalDrawerH = (numDrawers > 0 ? (isHorizontal ? drawersPerCol : numDrawers) * safeDrawerHeight : 0)
    const doorH = H - BH3 - totalDrawerH - (isBase ? T : 0)
    if (doorH > 150) {
      const n = Math.min(4, Math.max(1, numDoors || 1))
      const leafW = (W / n) - HARDWARE.DOOR_GAP_W
      const doorY = BH3 + totalDrawerH + doorH/2

      for (let i = 0; i < n; i++) {
        const xPos = (W/n)/2 + i*(W/n)
        pieces.push(makePiece(
          nextId('PORTA'), `Puerta ${i + 1}`, 'standard_door',
          leafW, doorH - HARDWARE.DOOR_GAP_H, T, 1,
          xPos, doorY, CD + T/2,   // cara frontal en CD+T: con overlay = D exacto; en legacy = D+T
          'vertical', { all: true }, 'Bisagra Reforzada', 'standard_door'
        ))
      }
    }
  }

  // ── ADITIVO 2026-07-19: bancada de MDF 25mm opcional (countertopMaterial:'mdf').
  //    Default null → sin pieza (bancada de piedra/porcelanato va como ítem de BOM).
  if (isBase && hasCountertop && moduleType !== 'standard' && cfg.countertopMaterial === 'mdf') {
    const ctT = 25, ctOverhang = 20
    pieces.push(makePiece(
      nextId('BANCADA'), 'Bancada MDF 25mm', 'bancada',
      W + 2 * ctOverhang, D + ctOverhang, ctT, 1,
      W/2, H + ctT/2, D/2, 'horizontal', { all: true },
      'Sobrepasa 20mm frontal/lateral — canto ABS 2mm'
    ))
  }

  return { pieces, config: cfg, internalDimensions: { width: internalWidth, height: structuralHeight, depth: internalDepth } }
}

function estimateNesting(cutList) {
  const PW   = MATERIAL.PLATE_WIDTH  - MATERIAL.NESTING_MARGIN * 2
  const PH   = MATERIAL.PLATE_HEIGHT - MATERIAL.NESTING_MARGIN * 2
  const KERF = MATERIAL.SAW_KERF

  const groups = {}
  for (const piece of cutList) {
    const t = piece.thickness
    if (!groups[t]) groups[t] = []
    groups[t].push({ w: piece.cutWidth, h: piece.cutHeight, id: piece.id, type: piece.type, grainDirection: piece.grainDirection })
  }

  const result = []

  for (const [thickness, pieces] of Object.entries(groups)) {
    // ── Normalización de orientación ─────────────────────────────────────────
    // El packer no rota dentro del bucle: se acuesta cada pieza con su lado LARGO
    // sobre el largo de la chapa (práctica de taller). Sin esto, un lateral de
    // 600×2400 nunca entra en el alto aprovechable (1740) y caía en una rama que
    // lo colocaba igual → layout imposible y conteo de chapas no confiable.
    //
    // Además: un FONDO que no cabe no es un error de diseño — el taller lo corta en
    // 2 partes y las une con regla de MDF (es lo que ya recomienda el validador).
    // Se parte por el eje que viola la chapa para que el material SÍ se contabilice;
    // descartarlo haría que el motor pidiera 0 chapas de 6mm para un ropero con fondo.
    const SPLITTABLE = new Set(['fondo'])
    const expand = (p) => {
      const long = Math.max(p.w, p.h), short = Math.min(p.w, p.h)
      const fits = long <= MATERIAL.PLATE_WIDTH && short <= MATERIAL.PLATE_HEIGHT
      if (fits) return [{ ...p, long, short, rotated: long !== p.w }]
      if (!SPLITTABLE.has(p.type)) return [{ ...p, long, short, impossible: true }]

      // Se parte por el eje que viola la chapa. Las partes llevan sus dimensiones
      // REALES en w/h: si conservaran las del panel entero, el visor, el DXF y la
      // lista de compra leerían medidas que no existen.
      const halveShort = short > MATERIAL.PLATE_HEIGHT
      let nw = p.w, nh = p.h
      if (halveShort) { if (p.w === short) nw = p.w / 2; else nh = p.h / 2 }
      else            { if (p.w === long)  nw = p.w / 2; else nh = p.h / 2 }

      const nl = Math.max(nw, nh), ns = Math.min(nw, nh)
      if (nl > MATERIAL.PLATE_WIDTH || ns > MATERIAL.PLATE_HEIGHT) {
        return [{ ...p, long, short, impossible: true }]
      }
      return [1, 2].map(i => ({
        ...p, id: `${p.id}-P${i}`, w: nw, h: nh, long: nl, short: ns,
        split: true, splitFrom: p.id
      }))
    }

    const norm      = pieces.flatMap(expand)
    const splitFrom = [...new Set(norm.filter(p => p.split).map(p => p.splitFrom))]
    const sorted    = norm.sort((a, b) => b.long * b.short - a.long * a.short)
    const plateArea = PW * PH
    const plates    = []
    const oversized = []
    let plate = { id: 1, usedArea: 0, pieces: [] }
    let curX = 0, curY = 0, rowH = 0

    const closePlate = () => {
      if (plate.pieces.length) plates.push({ ...plate, efficiency: plate.usedArea / plateArea })
    }

    for (const p of sorted) {
      const area = p.long * p.short

      // GUARD A — no cabe en la chapa física en NINGUNA orientación ni admite
      // partición (no es fondo). Nunca se coloca: se reporta como error real.
      if (p.impossible) {
        oversized.push({ id: p.id, width: p.w, height: p.h, type: p.type, reason: 'EXCEEDS_PLATE' })
        continue
      }

      const pl = p.long + KERF, ps = p.short + KERF

      // GUARD B — cabe en la chapa física pero no dentro de los márgenes de
      // aprovechamiento: va sola en chapa dedicada (el taller reduce márgenes).
      if (pl > PW || ps > PH) {
        closePlate()
        plates.push({
          id: plates.length + 1, usedArea: area, dedicated: true,
          pieces: [{ ...p, posX: 0, posY: 0 }], efficiency: area / plateArea
        })
        plate = { id: plates.length + 1, usedArea: 0, pieces: [] }
        curX = 0; curY = 0; rowH = 0
        continue
      }

      // Colocación: fila actual → nueva fila → nueva chapa. Siempre re-verifica AMBOS ejes.
      if (curX + pl <= PW && curY + ps <= PH) {
        plate.pieces.push({ ...p, posX: curX, posY: curY })
        plate.usedArea += area
        curX += pl
        rowH = Math.max(rowH, ps)
      } else if (curY + rowH + ps <= PH) {
        curY += rowH; curX = 0; rowH = 0
        plate.pieces.push({ ...p, posX: curX, posY: curY })
        plate.usedArea += area
        curX = pl; rowH = ps
      } else {
        closePlate()
        plate = { id: plates.length + 1, usedArea: area, pieces: [{ ...p, posX: 0, posY: 0 }] }
        curX = pl; curY = 0; rowH = ps
      }
    }
    closePlate()

    // El área usada se calcula SOLO sobre piezas realmente colocadas: una pieza
    // descartada no puede inflar la eficiencia ni ocultar que falta material.
    const totalUsed  = plates.reduce((s, pl) => s + pl.usedArea, 0)
    const totalAvail = plates.length * plateArea

    result.push({
      thickness:         parseInt(thickness),
      plateCount:        plates.length,
      plates,
      placedPieces:      plates.reduce((s, pl) => s + pl.pieces.length, 0),
      oversizedPieces:   oversized,
      splitPieces:       splitFrom,
      grainRotatedCount: sorted.filter(p => p.rotated && p.grainDirection).length,
      totalPieceArea:    totalUsed,
      totalPlateArea:    totalAvail,
      overallEfficiency: totalAvail > 0 ? Math.round((totalUsed / totalAvail) * 100) / 100 : 0
    })
  }

  return result
}

function generateHardwareBOM(cfg) {
  const { numDrawers, numShelves, depth, hasDoors, doorType } = cfg
  const bom = []

  if (numDrawers > 0) {
    const slideLen = Math.min(500, Math.round((depth - 50) / 50) * 50)
    bom.push({ type: 'Corredica Telescopica', description: 'Par de corredicas ' + slideLen + 'mm', quantity: numDrawers * 2, unit: 'par' })
  }

  if (numShelves > 0) {
    bom.push({ type: 'Pino para Prateleira', description: 'Pino metalico o5mm', quantity: numShelves * 4, unit: 'un' })
  }

  if (hasDoors && doorType === 'hinged') {
    // ★ AUDIT FIX 2026-07-19 (aditivo-compatible): antes ignoraba cfg.numDoors
    // (ceil(width/600) daba 2 dobradiças para 2 puertas). Regla de taller:
    // puerta ≤900mm → 2 bisagras · ≤1600 → 3 · >1600 → 4. Fallback al cálculo
    // histórico si numDoors no viene.
    const nDoors = (cfg.numDoors && cfg.numDoors > 0) ? cfg.numDoors : Math.ceil(cfg.width / 600)
    const doorH = (cfg.height || 720)
      - ((cfg.baseboard && cfg.moduleType !== 'aereo') ? (cfg.baseboardHeight || 100) : 0)
      - ((cfg.numDrawers || 0) > 0 ? (cfg.numDrawers * (cfg.drawerHeight || 180)) : 0)
    const perDoor = doorH > 1600 ? 4 : doorH > 900 ? 3 : 2
    bom.push({ type: 'Dobradica', description: 'Dobradica clip 35mm 110°', quantity: nDoors * perDoor, unit: 'un' })
  }

  bom.push({ type: 'Parafuso Confirmat', description: 'Confirmat o7x50mm fixacao estrutural', quantity: 24, unit: 'un' })

  if (cfg.baseType === 'legs') {
    bom.push({ type: 'Pe Nivelador', description: 'Pata regulable ' + (cfg.legHeight || 100) + 'mm', quantity: 4, unit: 'un' })
  }

  // ── ADITIVO 2026-07-19: BOM completo (auditoría carpinteria_fina + tendencias 2026).
  //    Todos los bloques son APPEND condicionales; con params históricos el único cambio
  //    intencional es que aéreos y módulos base con bancada dejan de tener BOM incompleto.

  // Aéreos: sistema de suspensión (regla: ceil(width/600) × 2 puntos de anclaje)
  if (cfg.moduleType === 'aereo') {
    const anchorPoints = Math.ceil((cfg.width || 600) / 600) * 2
    bom.push({ type: 'Riel Oculto Cabfix', description: 'Riel de fixacao oculto p/ aereo (60kg/riel)', quantity: Math.max(1, Math.ceil((cfg.width || 600) / 900)), unit: 'un' })
    bom.push({ type: 'Taco + Tirafondo', description: 'Taco 6x60 + tirafondo 6x60mm (alvenaria)', quantity: anchorPoints, unit: 'un' })
  }

  // Wardrobe: cabideiro (barra de colgar) + soportes
  if (cfg.hasHangingRod) {
    const rodLen = (cfg.width || 600) - 2 * (cfg.thickness || 18)
    const supports = rodLen > 900 ? 3 : 2
    bom.push({ type: 'Cabideiro Oval', description: 'Tubo oval 30x15mm x ' + rodLen + 'mm', quantity: 1, unit: 'un' })
    bom.push({ type: 'Suporte Cabideiro', description: 'Suporte lateral p/ tubo oval', quantity: supports, unit: 'un' })
  }

  // Puerta con espejo (preset espejo de baño)
  if (cfg.doorFinish === 'mirror' && hasDoors) {
    const nMirror = Math.max(1, cfg.numDoors || 1)
    bom.push({ type: 'Espelho 4mm', description: 'Espelho prata 4mm colado sobre porta (corte sob medida)', quantity: nMirror, unit: 'un' })
    bom.push({ type: 'Fita VHB', description: 'Fita dupla-face VHB 19mm p/ espelho', quantity: 1, unit: 'rolo' })
  }

  // Tendencia handleless 2026: perfil gola / push / barra
  const nFronts = (cfg.hasDoors ? (cfg.numDoors || 0) : 0) + (cfg.numDrawers || 0)
  if (cfg.handleType === 'gola') {
    bom.push({ type: 'Perfil Gola', description: 'Perfil gola J aluminio anodizado x ' + (cfg.width || 600) + 'mm', quantity: 1, unit: 'un' })
  } else if (cfg.handleType === 'push' && nFronts > 0) {
    bom.push({ type: 'Tip-On Push', description: 'Mecanismo push-to-open magnetico', quantity: nFronts, unit: 'un' })
  } else if (cfg.handleType === 'bar' && nFronts > 0) {
    bom.push({ type: 'Puxador Barra', description: 'Puxador barra inox 128mm', quantity: nFronts, unit: 'un' })
  }

  // Bancada: si no se genera en MDF, es suministro externo — debe constar en el BOM
  if (cfg.moduleType === 'base' && cfg.hasCountertop) {
    if (cfg.countertopMaterial === 'mdf') {
      bom.push({ type: 'Canto ABS 2mm', description: 'Fita ABS 2mm p/ bancada MDF (perimetro)', quantity: 1, unit: 'rolo' })
    } else {
      bom.push({ type: 'Bancada (externa)', description: 'Bancada pedra/porcelanato — fornecimento e instalacao externos', quantity: 1, unit: 'un' })
    }
  }

  // Tendencia 2026: iluminación LED en nichos/aéreos
  if (cfg.hasLed) {
    bom.push({ type: 'Fita LED 24V', description: 'Fita LED 24V 4000K x ' + (cfg.width || 600) + 'mm + perfil difusor', quantity: 1, unit: 'un' })
    bom.push({ type: 'Fonte LED', description: 'Fonte 24V 30W c/ sensor de porta', quantity: 1, unit: 'un' })
  }

  // Desk: niveladores
  if (cfg.moduleType === 'desk') {
    bom.push({ type: 'Pe Nivelador', description: 'Nivelador embutido M8', quantity: 4, unit: 'un' })
  }

  return bom
}

function generateProject(params) {
  try {
    const cfg = { ...DEFAULTS, ...params }
    const { pieces, config, internalDimensions } = generateFurniture(cfg)
    const cutList = generateCutList(pieces)
    const nesting = estimateNesting(cutList)
    const hardware = generateHardwareBOM(config)

    // ── Transparencia de fabricación ─────────────────────────────────────────
    // Toda desviación respecto al pedido del cliente viaja en specAdjustments,
    // para que UI y PDF puedan mostrarla. Nada se corrige en silencio.
    const specAdjustments = [...(config.specAdjustments || [])]
    for (const group of nesting) {
      if (group.oversizedPieces && group.oversizedPieces.length) {
        specAdjustments.push({
          code: 'PIECE_EXCEEDS_PLATE',
          severity: 'critical',
          field: 'nesting',
          message: `${group.oversizedPieces.length} pieza(s) de ${group.thickness}mm no caben en la ` +
                   `chapa ${MATERIAL.PLATE_WIDTH}×${MATERIAL.PLATE_HEIGHT}mm y quedaron FUERA del ` +
                   `plan de corte: ${group.oversizedPieces.map(p => p.id).join(', ')}. Divida el módulo.`,
          pieces: group.oversizedPieces
        })
      }
      if (group.splitPieces && group.splitPieces.length) {
        specAdjustments.push({
          code: 'BACK_PANEL_SPLIT',
          severity: 'warning',
          field: 'nesting',
          message: `El fondo (${group.splitPieces.join(', ')}) no cabe entero en la chapa ` +
                   `${MATERIAL.PLATE_WIDTH}×${MATERIAL.PLATE_HEIGHT}mm: se cortará en 2 partes ` +
                   `para unir con regla de MDF. El material ya está contabilizado.`,
          pieces: group.splitPieces
        })
      }
    }

    return {
      success:     true,
      specAdjustments,
      hasSpecAdjustments: specAdjustments.length > 0,
      id:          'ORB-' + uuidv4().slice(0, 8).toUpperCase(),
      type:        config.moduleType,
      version:     '4.5.0-LEGACY_RESTORATION',
      generatedAt: new Date().toISOString(),
      units:       'mm',
      dimensions: {
        external: { width: config.width, height: config.height, depth: config.depth },
        internal: internalDimensions
      },
      configuration: config,
      pieces: pieces,
      cutList: cutList,
      nesting: nesting,
      hardware: hardware
    }
  } catch (err) {
    console.error('Engine Error:', err)
    return {
      success: false,
      error: 'Error en la generación del diseño.',
      details: err.message
    }
  }
}

// ─── AUTO-SPLIT ──────────────────────────────────────────────────────────────
// La pieza horizontal más ancha (techo/piso/fondo/zócalo ≈ ancho del módulo) debe caber
// en la chapa. Si el ancho total supera el aprovechable, se parte en N módulos iguales
// fabricables. Distribuye cajones/divisores; estantes y puertas por módulo según su ancho.
const MAX_MODULE_WIDTH = MATERIAL.PLATE_WIDTH - 2 * MATERIAL.NESTING_MARGIN  // 2750 - 100 = 2650mm

function distributeCount(total, n, i) {
  const q = Math.floor(total / n), r = total % n
  return q + (i < r ? 1 : 0)
}

function generateProjectAutoSplit(params) {
  const cfg = { ...DEFAULTS, ...params }
  const totalWidth = Number(cfg.width) || DEFAULTS.width

  if (totalWidth <= MAX_MODULE_WIDTH) {
    const single = generateProject(cfg)
    return { success: single.success, split: false, count: 1, totalWidth, maxModuleWidth: MAX_MODULE_WIDTH, modules: [single] }
  }

  const N = Math.ceil(totalWidth / MAX_MODULE_WIDTH)
  const baseW = Math.floor(totalWidth / N)
  const remainder = totalWidth - baseW * N

  const modules = []
  for (let i = 0; i < N; i++) {
    const w = baseW + (i === N - 1 ? remainder : 0)
    const subCfg = {
      ...cfg,
      width:       w,
      numDrawers:  distributeCount(cfg.numDrawers  || 0, N, i),
      numDividers: distributeCount(cfg.numDividers || 0, N, i),
      numShelves:  cfg.numShelves || 0,
      numDoors:    cfg.hasDoors ? (w > 600 ? 2 : 1) : 0,
    }
    const proj = generateProject(subCfg)
    proj.splitIndex = i + 1
    proj.splitTotal = N
    proj.splitLabel = `Módulo ${i + 1}/${N}`
    modules.push(proj)
  }

  return {
    success: modules.every(m => m.success),
    split: true, count: N, totalWidth, maxModuleWidth: MAX_MODULE_WIDTH, modules,
  }
}

module.exports = { generateProject, generateProjectAutoSplit, generateFurniture, generateCutList, estimateNesting, generateHardwareBOM }
