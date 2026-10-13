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

// ─── Constants ──────────────────────────────────────────────────────────────
const HARDWARE = {
  DRAWER_FRONT_GAP: 2,
  DOOR_GAP_W: 2.5,
  DOOR_GAP_H: 4,
  SLIDE_CLEARANCE: 13,
  RECESO_TECNICO: 50,
  // ★ ADITIVO 2026-10-11 — Kitchen structural constants
  OVEN_OPENING_W: 595,        // Free front opening for standard 60cm oven
  CROSSBEAM_H_DEFAULT: 80,    // Sink/oven crossbeam height (70–100mm range)
  CAVA_OVERHANG: 30,          // Door extension below bottom for cava handle
  CAVA_BOTTOM_RECESS: 25,     // Bottom panel setback for grip clearance
}

const MATERIAL = {
  PLATE_WIDTH: 2800,
  PLATE_HEIGHT: 2070,
  SAW_KERF: 3.2,
  NESTING_MARGIN: 50
}

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
  tamponado: 'none',
  hasCountertop: true,
  handleType: 'standard'
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

function generateCutList(pieces) {
  const list = []
  for (const piece of pieces) {
    for (let q = 0; q < piece.quantity; q++) {
      list.push({
        id:        piece.quantity > 1 ? piece.id + '-' + (q + 1) : piece.id,
        name:      piece.quantity > 1 ? piece.name + ' (' + (q + 1) + '/' + piece.quantity + ')' : piece.name,
        type:      piece.type,
        cutWidth:  piece.width,
        cutHeight: piece.height,
        thickness: piece.thickness,
        grainDirection: piece.grainDirection,
        edgeBanding:    piece.edgeBanding
      })
    }
  }
  return list
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

function generateFurniture(params) {
  const cfg = { ...DEFAULTS, ...params }

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

      // ★ ADITIVO 2026-10-12 — Si hay travesaños físicos de 50mm entre gavetas,
      //   restar (numDrawers - 1) × 50 mm del presupuesto
      const crossbeamsBudget = cfg.puxadorCava45 ? (cfg.numDrawers - 1) * 50 : 0
      const adjustedAvailableHeight = availableHeight - crossbeamsBudget

      const drawerOnly = (cfg.numShelves || 0) === 0 && !cfg.hasDoors
      if (drawerOnly) {
        let maxRows = Math.max(1, Math.floor(adjustedAvailableHeight / (MINH + CLEAR)))
        if (maxRows < rows) {                 // ni al mínimo caben todas → reduce cantidad
          cfg.numDrawers = Math.max(1, maxRows * cols)
          rows = Math.ceil(cfg.numDrawers / cols)
        }
        cfg.drawerHeight = Math.max(MINH, Math.floor(adjustedAvailableHeight / rows) - CLEAR)
      } else {
        // Mixto (gavetas abajo + estantes/puertas arriba): reservar ~17% (validador < 85%).
        const budget = adjustedAvailableHeight * 0.83
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
  const { moduleType, width: W, height: H, depth: D, thickness: T, backThickness: BT,
          numShelves, numDrawers, drawerHeight, drawerLayout, baseboard, baseboardHeight,
          hasDoors, numDoors, hasCountertop } = cfg

  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  const isAereo = moduleType === 'aereo'
  const isBase = moduleType === 'base' || moduleType === 'standard'
  const BH3 = (baseboard && !isAereo) ? (baseboardHeight || 100) : 0
  const structuralHeight = H - BH3
  const internalWidth = FurnitureMath.internalSpan(W, T)
  const internalDepth = D - BT

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
  // ★ ADITIVO 2026-10-11 — Oven: validate internal width ≥ 595mm for standard oven opening
  if ((params.subType === 'oven_cavity') && internalWidth < HARDWARE.OVEN_OPENING_W) {
    const err = new Error(`OVEN_OPENING: internalWidth=${internalWidth}mm < ${HARDWARE.OVEN_OPENING_W}mm requeridos para la apertura frontal del horno. Aumente el ancho del módulo.`)
    err.statusCode = 400; throw err;
  }

  const onLegs = baseType === 'legs'
  const latH = onLegs ? (H - BH3) : H
  const latY = onLegs ? (BH3 + latH/2) : H/2
  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', D, latH, T, 1, T/2, latY, D/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', D, latH, T, 1, W - T/2, latY, D/2, 'vertical', { front: true }))

  // ── TAMPONADO: panel de acabamiento que tapa tornillos en el costado visible ──
  const tamp = cfg.tamponado || 'none'
  if (tamp === 'left' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-L'), 'Tampão Lateral Izq', 'tamponado', D, latH, T, 1, -T/2, latY, D/2, 'vertical', { front: true }, 'Cubre tornillos costado izquierdo'))
  if (tamp === 'right' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-R'), 'Tampão Lateral Der', 'tamponado', D, latH, T, 1, W + T/2, latY, D/2, 'vertical', { front: true }, 'Cubre tornillos costado derecho'))

  // ★ ADITIVO 2026-10-11 — Sub-type aware top structure
  const subType = cfg.subType || null
  const crossbeamH = Math.max(70, Math.min(150, cfg.crossbeamHeight || HARDWARE.CROSSBEAM_H_DEFAULT))

  if (subType === 'sink') {
    // ── SINK MODULE: solid top replaced by two structural crossbeams ──────────
    // The countertop (with sink cutout) rests on these. No solid techo.
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal (Fregadero)', 'tie_strip',
      internalWidth, crossbeamH, T, 1,
      W/2, H - crossbeamH/2, T/2 + 20,
      'horizontal', { front: true }, `Soporte estructural fregadero — ${crossbeamH}mm`))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero (Fregadero)', 'tie_strip',
      internalWidth, crossbeamH, T, 1,
      W/2, H - crossbeamH/2, D - BT - T/2,
      'horizontal', { front: true }, `Soporte estructural fregadero — ${crossbeamH}mm`))
  } else if (subType === 'oven_cavity') {
    // ── OVEN MODULE: reinforced support crossbeam + open front ────────────────
    // Top: two crossbeams (front+back) to support countertop weight above oven.
    // The oven sits on the base plate; the front is left completely open (595mm).
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal (Horno)', 'tie_strip',
      internalWidth, crossbeamH, T, 1,
      W/2, H - crossbeamH/2, T/2 + 20,
      'horizontal', { front: true }, `Refuerzo horno — ${crossbeamH}mm`))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero (Horno)', 'tie_strip',
      internalWidth, crossbeamH, T, 1,
      W/2, H - crossbeamH/2, D - BT - T/2,
      'horizontal', { front: true }, `Refuerzo horno — ${crossbeamH}mm`))
    // Bottom support crossbeam: the oven rests on this, not directly on the base plate.
    // Sits above the base plate at baseboard+T height.
    pieces.push(makePiece(nextId('TRAV-SOPORTE'), 'Travesaño Soporte Horno', 'tie_strip',
      internalWidth, crossbeamH, T, 1,
      W/2, BH3 + T + crossbeamH/2, D/2,
      'horizontal', { front: true }, 'Soporte base del horno — distribuye peso'))
  } else if (isBase && hasCountertop && moduleType !== 'standard') {
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, T/2 + 20, 'horizontal', { front: true }, 'Refuerzo Estructural'))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, D - BT - T/2, 'horizontal', { front: true }, 'Refuerzo Estructural'))
  } else {
    pieces.push(makePiece(nextId('TAMPO'), 'Techo', 'techo', internalWidth, D, T, 1, W/2, H - T/2, D/2, 'horizontal', { front: true }))
  }

  // ★ ADITIVO 2026-10-11 — Cava aéreo: bottom panel recessed for grip clearance
  if (isAereo && cfg.puxadorCavaAereo) {
    const recess = cfg.cavaOverhang || HARDWARE.CAVA_BOTTOM_RECESS
    // Base inferior retrocedida: profundidad reducida para dejar espacio de agarre
    pieces.push(makePiece(nextId('BASE'), 'Base Inferior (Cava)', 'piso',
      internalWidth, D - recess, T, 1,
      W/2, BH3 + T/2, (D - recess)/2 + recess,
      'horizontal', { front: true },
      `Retroceso ${recess}mm para agarre cava`))
  } else {
    pieces.push(makePiece(nextId('BASE'), 'Base Inferior', 'piso', internalWidth, D, T, 1, W/2, BH3 + T/2, D/2, 'horizontal', { front: true }))
  }

  // ★ ADITIVO 2026-10-12 — Base module con puxador cava 45°: top crossbeam + recessed bottom
  if (isBase && cfg.puxadorCava45) {
    const cavaGapTop = 50  // 50mm travesaño físico en la parte superior
    // Travesaño superior (50mm de altura) de amarre para soporte de puertas cava
    pieces.push(makePiece(
      nextId('TRAV-CAVA'), 'Travesaño Cava Superior', 'tie_strip',
      internalWidth, cavaGapTop, T, 1,
      W/2, H - cavaGapTop/2 - (isBase && hasCountertop ? 0 : T), T/2 + 20,
      'horizontal', { front: true }, 'Amarre superior para cava 45°'
    ))
    // Nota: la altura de gavetas se ajusta automáticamente vía auto-fit (resta el travesaño)
  }

  // BUG FIX #5: base+countertop has traversaños (70mm) at top, not a techo (T).
  // Standard/aereo use 2*T (bottom base + top techo). Base+countertop uses T+70.
  // ★ ADITIVO 2026-10-11: sink/oven use crossbeamH instead of hardcoded 70.
  const topDeduction = (subType === 'sink' || subType === 'oven_cavity') ? crossbeamH
    : (isBase && hasCountertop && moduleType !== 'standard') ? 70 : T
  const backH = H - BH3 - T - topDeduction
  // ── Fondo: ancho según método (manifiesto = SSOT). Default = vano interno (sin cambios).
  //   'grooved' (ranurado) = internalSpan + 2·grooveDepth ; 'nailed' (clavado) = W − 2mm.
  // ★ FIX 2026-10-13: open_niche → fondo covers full rear (W × H), nailed from behind.
  const isOpenNiche = subType === 'open_niche'
  const backWidth = isOpenNiche ? W
    : (cfg.backStyle === 'grooved')
      ? FurnitureMath.backPanels.groovedWidth(internalWidth, cfg.grooveDepth || 8)
      : (cfg.backStyle === 'nailed')
        ? FurnitureMath.backPanels.nailedWidth(W)
        : internalWidth
  const nicheBackH = isOpenNiche ? H : backH
  pieces.push(makePiece(nextId('FUNDO'), 'Fondo', 'fondo', backWidth, nicheBackH, BT, 1, W/2, BH3 + T + (isOpenNiche ? H/2 : backH/2), D - BT/2, 'none'))

  if (baseType === 'recessed' && BH3 > 0) {
    pieces.push(makePiece(nextId('RDPE-F'), 'Zócalo Frontal', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, D - T/2 - 50, 'vertical', { front: true }))
    pieces.push(makePiece(nextId('RDPE-B'), 'Zócalo Trasero', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, T/2 + 50, 'vertical', { front: true }))
  }

  // ★ ADITIVO 2026-10-11 — Oven cavity: drawer start offset accounts for support crossbeam
  const safeDrawerHeight = Math.max(100, drawerHeight)
  let drawerYStart = BH3 + T
  if (subType === 'oven_cavity') {
    // Oven support crossbeam sits above base plate; drawers (if any) start above it
    drawerYStart = BH3 + T + crossbeamH + T
  }
  const SLIDE_GAP = HARDWARE.SLIDE_CLEARANCE

  const numDivs = cfg.numDividers || 0
  const isHorizontal = drawerLayout === 'horizontal' && numDrawers > 1
  const cols = isHorizontal ? 2 : 1
  const drawersPerCol = Math.ceil(numDrawers / cols)
  const drawerW = isHorizontal ? (internalWidth / 2) - T/2 : internalWidth

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
      const boxD = D - 50
      // ★ FIX 2026-10-13: Box height must be SIGNIFICANTLY shorter than front.
      // Real carpentry: front overlaps box ~30mm top + ~30mm bottom minimum.
      // Formula: 60% of front height, capped at 150mm, minimum 40mm.
      const frontH = safeDrawerHeight - 2 * HARDWARE.DRAWER_FRONT_GAP
      const boxH = Math.max(40, Math.min(150, Math.round(frontH * 0.6)))
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

  // ★ FIX 2026-10-13: Separator shelf ONLY when there are shelves or doors above drawers.
  //   A pure drawer module (cómoda) has NO separator — drawers fill the full height.
  //   Previously always generated when numDrawers > 0, which made no sense for drawer-only modules.
  const drawerOnly = (numShelves || 0) === 0 && !hasDoors
  if (numDrawers > 0 && !drawerOnly && numShelves > 0) {
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
  // Available zone: from shelfYStart to H - T (below techo), minus 50mm headroom.
  const shelfZoneTop = H - T - 50
  const shelfZoneH   = Math.max(0, shelfZoneTop - shelfYStart)
  const shelfSpacing = numShelves > 0 ? Math.floor(shelfZoneH / (numShelves + 1)) : 0

  for (let i = 0; i < numShelves; i++) {
    const yPos = shelfYStart + (i + 1) * shelfSpacing
    if (yPos > shelfYStart && yPos < shelfZoneTop) {
      const technicalDepth = hasDoors ? (internalDepth - 20) : internalDepth
      pieces.push(makePiece(
        nextId('PRAT'), `Estante ${i + 1}`, 'repisa',
        internalWidth - 2, technicalDepth, T, 1,
        W/2, yPos, internalDepth/2 + BT, 'horizontal', { front: true }
      ))
    }
  }

  // ★ PROTECTED: Central Dividers — stop at drawer zone, not full height
  if (numDivs > 0) {
    const totalDrawerH = (numDrawers > 0 ? (isHorizontal ? drawersPerCol : numDrawers) * safeDrawerHeight : 0)
    let divStartY, divHeight
    if (numDrawers > 0) {
      // Divider only above drawer zone
      divStartY = BH3 + T + totalDrawerH
      divHeight = H - BH3 - totalDrawerH - 2 * T
    } else {
      // No drawers — full internal height
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
          'vertical', { front: true }, 'Divisor vertical — para en zona gavetas'
        ))
      }
    }
  }

  // ★ ADITIVO 2026-10-11 — Oven cavity: NO doors (front must stay open for appliance)
  if (hasDoors && subType !== 'oven_cavity') {
    const totalDrawerH = (numDrawers > 0 ? (isHorizontal ? drawersPerCol : numDrawers) * safeDrawerHeight : 0)
    const doorH = H - BH3 - totalDrawerH - (isBase ? T : 0)
    if (doorH > 150) {
      const n = Math.min(4, Math.max(1, numDoors || 1))
      const leafW = (W / n) - HARDWARE.DOOR_GAP_W
      const doorY = BH3 + totalDrawerH + doorH/2

      // ★ ADITIVO 2026-10-11 — Cava handle on aéreos: door extends below bottom panel
      const cavaExt = (isAereo && cfg.puxadorCavaAereo)
        ? (cfg.cavaOverhang || HARDWARE.CAVA_OVERHANG)
        : 0
      const finalDoorH = doorH - HARDWARE.DOOR_GAP_H + cavaExt
      const finalDoorY = doorY - cavaExt / 2  // shift center down by half the extension

      for (let i = 0; i < n; i++) {
        const xPos = (W/n)/2 + i*(W/n)
        const doorNote = cavaExt > 0
          ? `Puerta cava — extensión ${cavaExt}mm bajo base`
          : 'Bisagra Reforzada'
        pieces.push(makePiece(
          nextId('PORTA'), `Puerta ${i + 1}`, 'standard_door',
          leafW, finalDoorH, T, 1,
          xPos, finalDoorY, D + T/2,
          'vertical', { all: true }, doorNote, 'standard_door'
        ))
      }
    }
  }

  // ★ ADITIVO 2026-10-12 — False door (sobrepuesta): cubre toda la caja desde frente
  // ★ FIX 2026-10-12: oven_cavity SÍ puede tener puerta falsa (es su caso principal)
  if (hasDoors && cfg.doorType === 'false') {
    const falseDoorH = H - (isBase ? (BH3 || 0) : 0) - (isBase && hasCountertop ? 0 : T)
    const falseDoorY = BH3 + falseDoorH / 2
    const falseDoorW = W - T  // Cubre ancho completo, sobrepuesta en laterales
    pieces.push(makePiece(
      nextId('PORTA-FALSA'), 'Puerta Falsa Sobrepuesta', 'false_door',
      falseDoorW, falseDoorH, T, 1,
      W/2, falseDoorY, D + T/2,  // Z = D + T/2 (SOBRE los laterales)
      'vertical', { all: true }, 'Puerta sobrepuesta — cubre caja', 'false_door'
    ))
  }

  // ★ ADITIVO 2026-10-12 — Tamponado inferior (cierre inferior para aéreos)
  if (cfg.tamponadoInferior && isAereo) {
    const tamponW = internalWidth
    const tamponD = D
    pieces.push(makePiece(
      nextId('TAMPON-INF'), 'Tamponado Inferior', 'tampon_bottom',
      tamponW, tamponD, T, 1,
      W/2, T/2, D/2,
      'horizontal', { front: true }, 'Cierre inferior aéreo', 'tampon_bottom'
    ))
  }

  // ★ ADITIVO 2026-10-12 — Travesaños inter-gaveta (topTieRails)
  if (cfg.topTieRails && cfg.numDrawers > 1) {
    const tieH = cfg.tieRailHeight || 50
    const tieW = internalWidth
    const numTies = cfg.numDrawers - 1
    // Calculate positions between drawers (simplified: evenly spaced)
    const drawerZoneStart = BH3 + T
    const drawerZoneH = structuralHeight - (cfg.numShelves > 0 ? T : 0) - T
    const slotH = drawerZoneH / cfg.numDrawers
    for (let i = 0; i < numTies; i++) {
      const tieY = drawerZoneStart + slotH * (i + 1)
      pieces.push(makePiece(
        nextId('TRAV-GAV'), 'Travesaño Inter-Gaveta', 'tie_strip',
        tieW, tieH, T, 1,
        W/2, tieY, D/2,
        'horizontal', { front: true }, 'Travesaño entre gavetas', 'TRAV_INTER_GAVETA'
      ))
    }
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
    groups[t].push({ w: piece.cutWidth, h: piece.cutHeight, id: piece.id })
  }

  const result = []

  for (const [thickness, pieces] of Object.entries(groups)) {
    const sorted    = [...pieces].sort((a, b) => b.w * b.h - a.w * a.h)
    const plateArea = PW * PH
    const plates    = []
    let plate = { id: 1, usedArea: 0, pieces: [] }
    let curX = 0, curY = 0, rowH = 0

    for (const piece of sorted) {
      const pw = piece.w + KERF
      const ph = piece.h + KERF

      if (curX + pw <= PW) {
        plate.pieces.push({ ...piece, posX: curX, posY: curY })
        plate.usedArea += piece.w * piece.h
        curX += pw
        rowH  = Math.max(rowH, ph)
      } else {
        curX = 0
        curY += rowH
        rowH  = 0
        if (curY + ph <= PH) {
          plate.pieces.push({ ...piece, posX: curX, posY: curY })
          plate.usedArea += piece.w * piece.h
          curX = pw
          rowH = ph
        } else {
          plates.push({ ...plate, efficiency: plate.usedArea / plateArea })
          plate = { id: plates.length + 1, usedArea: piece.w * piece.h, pieces: [{ ...piece, posX: 0, posY: 0 }] }
          curX = pw; curY = 0; rowH = ph
        }
      }
    }
    if (plate.pieces.length) {
      plates.push({ ...plate, efficiency: plate.usedArea / plateArea })
    }

    const totalUsed  = pieces.reduce((s, p) => s + p.w * p.h, 0)
    const totalAvail = plates.length * plateArea

    result.push({
      thickness:         parseInt(thickness),
      plateCount:        plates.length,
      plates,
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
    const numDoors = Math.ceil(cfg.width / 600)
    bom.push({ type: 'Dobradica', description: 'Dobradica clip 35mm 110°', quantity: numDoors * 2, unit: 'un' })
  }

  bom.push({ type: 'Parafuso Confirmat', description: 'Confirmat o7x50mm fixacao estrutural', quantity: 24, unit: 'un' })

  if (cfg.baseType === 'legs') {
    bom.push({ type: 'Pe Nivelador', description: 'Pata regulable ' + (cfg.legHeight || 100) + 'mm', quantity: 4, unit: 'un' })
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

    return {
      success:     true,
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
const MAX_MODULE_WIDTH = MATERIAL.PLATE_WIDTH - 2 * MATERIAL.NESTING_MARGIN  // 2800 - 100 = 2700mm

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
