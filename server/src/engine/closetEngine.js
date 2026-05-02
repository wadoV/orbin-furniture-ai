/**
 * Orbin AI — Parametric Furniture Engine v2
 * Generates complete furniture design JSON from input parameters.
 * Supports: Closets, Kitchen Low, Kitchen High, Islands.
 */

const { v4: uuidv4 } = require('uuid')
const { MATERIAL, HARDWARE, DEFAULTS } = require('./constants')
const { validateDesign } = require('./validator')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePiece(id, name, type, width, height, thickness, qty, grainDir, edgeBanding, notes, frontType = null) {
  return {
    id, name, type,
    width:  Math.round(width),
    height: Math.round(height),
    thickness, quantity: qty,
    grainDirection: grainDir || 'horizontal',
    edgeBanding: edgeBanding || { front: true },
    notes: notes || '',
    frontType: frontType // 'Gaveta' | 'Puerta' | null
  }
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

function generateFurniture(params) {
  const cfg = { ...DEFAULTS, ...params }
  const { type, width: W, height: H, depth: D, thickness: T, backThickness: BT,
          numShelves, numDrawers, drawerHeight, drawerLayout, baseboard, baseboardHeight,
          hasDoors } = cfg

  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  const BH3 = (baseboard && type !== 'kitchen_high') ? (baseboardHeight || 100) : 0
  const structuralHeight = H - BH3
  const internalWidth = W - (2 * T)
  const internalDepth = D - BT
  
  // 1. Laterals
  pieces.push(makePiece(nextId('LAT'), 'Lateral', 'structural', D, H, T, 2, 'vertical', { front: true, back: false, top: true, bottom: true }))

  // 2. Top & Base
  pieces.push(makePiece(nextId('TAMPO'), 'Tampo', 'structural', internalWidth, D, T, 1, 'horizontal', { front: true }))
  pieces.push(makePiece(nextId('BASE'), 'Base Structural', 'structural', internalWidth, D, T, 1, 'horizontal', { front: true }))

    // 3. Back (Complete back)
    pieces.push(makePiece(nextId('FUNDO'), 'Fundo Completo', 'structural', W - 10, H - BH3 - 10, BT, 1, 'none'))

  // 4. Internal Dividers (Lateral Interno) — user-defined, auto-adds 1 if width > 900 and none specified
  const numDividers = cfg.numDividers > 0 ? cfg.numDividers : (internalWidth > 900 ? 1 : 0)
  const needsDivider = numDividers > 0
  for (let i = 0; i < numDividers; i++) {
    pieces.push(makePiece(nextId('DIV-V'), `Lateral Interno ${i + 1}`, 'structural', internalDepth, structuralHeight - (2 * T), T, 1, 'vertical', { front: true }))
  }

  // 5. Countertop (for kitchens)
  if (cfg.hasCountertop) {
    pieces.push(makePiece(nextId('PIEDRA'), 'Encimera', 'countertop', W + 40, D + 20, 30, 1, 'horizontal', {}, 'Mármol o Granito'))
  }

  // 5. Rodapie (Improved with front/back logic)
  if (BH3 > 0) {
    pieces.push(makePiece(nextId('RDPE-F'), 'Zócalo Frontal', 'baseboard', internalWidth, BH3, T, 1, 'horizontal'))
    pieces.push(makePiece(nextId('RDPE-B'), 'Refuerzo Trasero Rodapié', 'baseboard', internalWidth, BH3, T, 1, 'horizontal'))
  }

  // 6. Drawers — frontType: 'drawer_front' (altura configurable vía drawerHeight)
  const isHorizontal = drawerLayout === 'horizontal' && numDrawers > 1
  const cols = isHorizontal ? 2 : 1
  const drawersPerCol = Math.ceil(numDrawers / cols)
  const drawerW = isHorizontal ? (internalWidth / 2) - T/2 - 2 : internalWidth

  for (let i = 0; i < numDrawers; i++) {
    // Category A: Drawer Front — perimetral gap 2mm/side → -4mm W and H
    pieces.push(makePiece(
      nextId('GAV-FF'), 'Frente Gaveta ' + (i + 1), 'drawer_front',
      drawerW - 2 * HARDWARE.DRAWER_FRONT_GAP_PERIMETER,
      drawerHeight - 2 * HARDWARE.DRAWER_FRONT_GAP_PERIMETER,
      T, 1, 'horizontal',
      { front: true, top: true, bottom: true, left: true, right: true },
      'Holgura perimetral: ' + HARDWARE.DRAWER_FRONT_GAP_PERIMETER + 'mm/lado (4mm total)',
      'drawer_front'
    ))
    // Box components
    pieces.push(makePiece(nextId('GAV-LAT'), 'Lateral Gaveta ' + (i + 1), 'drawer_box', D - 50, drawerHeight - 40, 15, 2, 'horizontal'))
    pieces.push(makePiece(nextId('GAV-FND'), 'Fondo Gaveta ' + (i + 1), 'drawer_box', drawerW - 26, D - 50, 6, 1, 'none'))
  }

  // 7. Shelves — qty = sections (one per span between dividers)
  const sections = numDividers + 1
  const shelfW = needsDivider ? (internalWidth - numDividers * T) / sections : internalWidth
  for (let i = 0; i < numShelves; i++) {
    pieces.push(makePiece(nextId('PRAT'), 'Prateleira ' + (i + 1), 'shelf', shelfW - 2, D - 20, T, sections, 'horizontal'))
  }

  // 8. Doors
  if (hasDoors) {
    const totalDrawerH = (numDrawers > 0 ? (isHorizontal ? drawersPerCol : numDrawers) * drawerHeight : 0)
    const doorH = H - BH3 - totalDrawerH - (type === 'kitchen_high' ? 0 : T)
    if (doorH > 100) {
      // Door: hinge overlay clearance — 2.5mm per side (5mm total W), 4mm H for hinge cup
      pieces.push(makePiece(nextId('PORTA'), 'Puerta', 'standard_door', W/2 - HARDWARE.DOOR_GAP_W_TOTAL, doorH - HARDWARE.DOOR_GAP_H, T, 2, 'vertical', { front: true, top: true, bottom: true, left: true, right: true }, 'Recubrimiento bisagra: ' + HARDWARE.DOOR_GAP_W_TOTAL + 'mm ancho / ' + HARDWARE.DOOR_GAP_H + 'mm alto', 'standard_door'))
    }
  }

  return { pieces, config: cfg, internalDimensions: { width: internalWidth, height: structuralHeight, depth: internalDepth } }
}

// ─── Cut List ─────────────────────────────────────────────────────────────────

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

// ─── Nesting Estimator ────────────────────────────────────────────────────────

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

// ─── Hardware BOM ─────────────────────────────────────────────────────────────

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

// ─── Main Entry Point ─────────────────────────────────────────────────────────

function generateProject(params) {
  const cfg = { ...DEFAULTS, ...params }

  const { pieces, config, internalDimensions } = generateFurniture(cfg)
  const cutList    = generateCutList(pieces)
  const nesting    = estimateNesting(cutList)
  const hardware   = generateHardwareBOM(config)
  const validation = validateDesign({ configuration: config, pieces, nesting })

  return {
    id:          'ORB-' + uuidv4().slice(0, 8).toUpperCase(),
    type:        config.type || 'closet',
    version:     '2.0',
    generatedAt: new Date().toISOString(),
    units:       'mm',
    meta: {
      material:     config.materialFront,
      countertop:   config.countertopMaterial,
      handle:       config.handleType
    },
    dimensions: {
      external: { width: config.width, height: config.height, depth: config.depth },
      internal: internalDimensions
    },
    configuration: config,
    summary: {
      totalPieces: pieces.length,
      drawerCount: config.numDrawers,
      shelfCount:  config.numShelves,
      totalPlates: nesting.reduce((acc, n) => acc + n.plateCount, 0),
      avgMaterialEfficiency: nesting.length > 0 ? (nesting.reduce((acc, n) => acc + n.overallEfficiency, 0) / nesting.length) : 0
    },
    validation,
    pieces,
    cutList,
    nesting,
    hardware
  }
}

module.exports = { generateProject, generateFurniture, generateCutList, estimateNesting }
