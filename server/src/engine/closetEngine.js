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

// ─── Constants ──────────────────────────────────────────────────────────────
const HARDWARE = {
  DRAWER_FRONT_GAP: 2,
  DOOR_GAP_W: 2.5,
  DOOR_GAP_H: 4,
  SLIDE_CLEARANCE: 13,
  RECESO_TECNICO: 50
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
  const internalWidth = W - (2 * T)
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

  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', D, H, T, 1, T/2, H/2, D/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', D, H, T, 1, W - T/2, H/2, D/2, 'vertical', { front: true }))

  if (isBase && hasCountertop && moduleType !== 'standard') {
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, T/2 + 20, 'horizontal', { front: true }, 'Refuerzo Estructural'))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero', 'tie_strip', internalWidth, 70, T, 1, W/2, H - 70/2, D - BT - T/2, 'horizontal', { front: true }, 'Refuerzo Estructural'))
  } else {
    pieces.push(makePiece(nextId('TAMPO'), 'Techo', 'techo', internalWidth, D, T, 1, W/2, H - T/2, D/2, 'horizontal', { front: true }))
  }

  pieces.push(makePiece(nextId('BASE'), 'Base Inferior', 'piso', internalWidth, D, T, 1, W/2, BH3 + T/2, D/2, 'horizontal', { front: true }))

  // BUG FIX #5: base+countertop has traversaños (70mm) at top, not a techo (T).
  // Standard/aereo use 2*T (bottom base + top techo). Base+countertop uses T+70.
  const topDeduction = (isBase && hasCountertop && moduleType !== 'standard') ? 70 : T
  const backH = H - BH3 - T - topDeduction
  pieces.push(makePiece(nextId('FUNDO'), 'Fondo', 'fondo', internalWidth, backH, BT, 1, W/2, BH3 + T + backH/2, D - BT/2, 'none'))

  if (BH3 > 0) {
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

      const boxOuterW = drawerW - (2 * SLIDE_GAP)
      const boxInnerW = boxOuterW - (2 * T)
      const boxD = D - 50
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
          xPos, doorY, D + T/2,
          'vertical', { all: true }, 'Bisagra Reforzada', 'standard_door'
        ))
      }
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
