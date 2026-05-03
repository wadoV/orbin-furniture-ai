/**
 * Orbin AI — Parametric Furniture Engine v3.0.0
 * [PROTECTED] MASTER CONSTRUCTION LOGIC
 * CONSTRUCTION_STABLE_V3: Laterals to ground, vertical baseboards, 50mm shelf recess.
 */

const { v4: uuidv4 } = require('uuid')

// ─── Constants (Internal) ───────────────────────────────────────────────────
const MATERIAL = {
  PLATE_WIDTH: 2750,
  PLATE_HEIGHT: 1840,
  NESTING_MARGIN: 10,
  SAW_KERF: 4
}

const HARDWARE = {
  DRAWER_FRONT_GAP_PERIMETER: 2,
  DOOR_GAP_W_TOTAL: 5,
  DOOR_GAP_H: 4
}

const DEFAULTS = {
  moduleType: 'standard', // 'standard', 'base', 'aereo'
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

// ─── Main Engine ─────────────────────────────────────────────────────────────

function generateFurniture(params) {
  const cfg = { ...DEFAULTS, ...params }
  const { moduleType, width: W, height: H, depth: D, thickness: T, backThickness: BT,
          numShelves, numDrawers, drawerHeight, drawerLayout, baseboard, baseboardHeight,
          hasDoors, numDoors, hasCountertop } = cfg

  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  // Structural logic
  const isAereo = moduleType === 'aereo'
  const isBase = moduleType === 'base'
  
  const BH3 = (baseboard && !isAereo) ? (baseboardHeight || 100) : 0
  const structuralHeight = H - BH3
  const internalWidth = W - (2 * T)
  const internalDepth = D - BT
  
  // 1. Laterals (Vertical sides)
  // [PROTECTED] Rule: External laterals go to ground (y = H/2)
  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', D, H, T, 1, 0, H/2, D/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', D, H, T, 1, W - T, H/2, D/2, 'vertical', { front: true }))

  // 2. Top & Base (Horizontal)
  // [PROTECTED] Kitchen Logic: hasCountertop means we use tie-strips instead of a full wooden top.
  if (isBase && hasCountertop) {
    pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal', 'tie_strip', internalWidth, 100, T, 1, W/2, H - T/2, 50, 'horizontal', { front: true }))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero', 'tie_strip', internalWidth, 100, T, 1, W/2, H - T/2, D - 50, 'horizontal', { front: true }))
  } else {
    pieces.push(makePiece(nextId('TAMPO'), isAereo ? 'Techo' : 'Tampo', 'techo', internalWidth, D, T, 1, W/2, H - T/2, D/2, 'horizontal', { front: true }))
  }
  
  // Bottom base
  pieces.push(makePiece(nextId('BASE'), 'Base', 'piso', internalWidth, D, T, 1, W/2, BH3 + T/2, D/2, 'horizontal', { front: true }))

  // 3. Back Panel
  const backH = structuralHeight - 2*T
  pieces.push(makePiece(nextId('FUNDO'), 'Fundo', 'fondo', internalWidth, backH, BT, 1, W/2, BH3 + T + backH/2, D - BT/2, 'none'))

  // 4. Baseboard (Zócalo)
  if (BH3 > 0) {
    pieces.push(makePiece(nextId('RDPE-F'), 'Zócalo Frontal', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, 20 + T/2, 'horizontal'))
    pieces.push(makePiece(nextId('RDPE-B'), 'Zócalo Trasero', 'baseboard', internalWidth, BH3, T, 1, W/2, BH3/2, D - BT - T/2, 'horizontal'))
  }

  // 5. Drawers (Gavetas)
  const drawerYStart = BH3 + T 
  const numDivs = cfg.numDividers || 0
  const divideDrawers = cfg.divideDrawers || false
  const drawerCol = cfg.drawerColumnIndex || 0 
  
  let drawerW, drawerX
  if (divideDrawers && numDivs > 0) {
    const colW = internalWidth / (numDivs + 1)
    drawerW = colW - 10
    drawerX = T + (colW * drawerCol) + (colW / 2)
  } else {
    const isAsymmetric = numDrawers > 0 && (drawerLayout === 'left' || drawerLayout === 'right')
    drawerW = isAsymmetric ? (internalWidth / 2) - 10 : internalWidth - 10
    drawerX = drawerLayout === 'left' ? T + (drawerW / 2) + 5 : 
                    drawerLayout === 'right' ? W - T - (drawerW / 2) - 5 : 
                    W/2
  }

  let maxDrawerYReached = drawerYStart
  for (let i = 0; i < numDrawers; i++) {
    const yPos = drawerYStart + (i * drawerHeight) + (drawerHeight / 2)
    if (yPos < H - 50) {
      pieces.push(makePiece(
        nextId('GAV-FF'), `Frente Gaveta ${i + 1}`, 'drawer_front',
        drawerW, drawerHeight - 4, T, 1, 
        drawerX, yPos, 0, 'horizontal', 
        { front: true, top: true, bottom: true, left: true, right: true },
        'Holgura 2mm', 'drawer_front'
      ))
      pieces.push(makePiece(nextId('GAV-LAT'), `Caja Gaveta ${i + 1}`, 'drawer_box', D - 50, drawerHeight - 40, 15, 2, drawerX, yPos, D/2, 'horizontal'))
      maxDrawerYReached = yPos + (drawerHeight / 2)
    }
  }

  // 6. Shelves (Prateleiras)
  // [PRECISION] Rule: Shelf immediately above drawers is full depth (Drawer Cap)
  // Others have 50mm recess if module has doors.
  const shelfYStart = maxDrawerYReached + T/2
  for (let i = 0; i < numShelves; i++) {
    const yPos = shelfYStart + (i * 300)
    if (yPos < H - 100) {
      const isDrawerCap = i === 0 && numDrawers > 0
      const technicalDepth = (hasDoors && !isDrawerCap) ? (internalDepth - 50) : internalDepth
      const shelfZ = D - BT - (technicalDepth / 2)
      
      pieces.push(makePiece(
        nextId('PRAT'), 
        isDrawerCap ? 'Tapa Gavetas' : `Estante ${i + 1}`, 
        'repisa', 
        internalWidth - 2, technicalDepth, T, 1, 
        W/2, yPos, shelfZ, 
        'horizontal', { front: true },
        isDrawerCap ? 'Profundidad Total' : (hasDoors ? 'Receso 50mm' : '')
      ))
    }
  }

  // 7. Internal Vertical Dividers
  const effectiveDividers = numDivs > 0 ? numDivs : (numDrawers > 0 && !divideDrawers && (drawerLayout === 'left' || drawerLayout === 'right') ? 1 : 0)
  
  if (effectiveDividers > 0) {
    const spacing = internalWidth / (effectiveDividers + 1)
    for (let i = 0; i < effectiveDividers; i++) {
      let dividerX
      if (numDrawers > 0 && !divideDrawers && effectiveDividers === 1 && (drawerLayout === 'left' || drawerLayout === 'right')) {
        dividerX = drawerLayout === 'left' ? T + (internalWidth / 2) : W - T - (internalWidth / 2)
      } else {
        dividerX = T + spacing * (i + 1)
      }

      // [PRECISION] Internal lateral sits between base and top
      const LI_frontRecess = hasDoors ? 50 : 2
      const LI_depth = D - BT - LI_frontRecess
      const LI_z = D - BT - (LI_depth / 2)

      pieces.push(makePiece(
        nextId('DIV-V'), 
        'Lateral Interno', 
        'lateral', 
        LI_depth, structuralHeight - 2*T, T, 1, 
        dividerX, BH3 + T + (structuralHeight - 2*T)/2, LI_z, 
        'vertical', { front: true }
      ))
    }
  }

  // 8. Doors
  if (hasDoors) {
    const doorH = structuralHeight - 4
    const n = Math.min(4, Math.max(1, numDoors || 1))
    const totalGap = (n + 1) * 3
    const leafW = (W - totalGap) / n
    
    for (let i = 0; i < n; i++) {
      const xPos = 3 + leafW/2 + i * (leafW + 3)
      pieces.push(makePiece(
        nextId('PORTA'), `Puerta ${i + 1}`, 'standard_door', 
        leafW, doorH, T, 1, 
        xPos, BH3 + structuralHeight/2, -T/2, 
        'vertical', { all: true }, 'Bisagra', 'standard_door'
      ))
    }
  }
  return {
    pieces,
    config: cfg,
    internalDimensions: {
      width:  internalWidth,
      height: structuralHeight,
      depth:  internalDepth
    }
  }
}

function generateProject(params) {
  try {
    const cfg = { ...DEFAULTS, ...params }
    const { pieces, config, internalDimensions } = generateFurniture(cfg)

    return {
      success:     true,
      id:          'ORB-' + uuidv4().slice(0, 8).toUpperCase(),
      type:        config.moduleType,
      version:     '3.0.0',
      generatedAt: new Date().toISOString(),
      units:       'mm',
      dimensions: {
        external: { width: config.width, height: config.height, depth: config.depth },
        internal: internalDimensions
      },
      configuration: config,
      pieces: pieces
    }
  } catch (err) {
    console.error('Engine Error:', err)
    return { success: false, error: 'Failed to generate design', details: err.message }
  }
}

module.exports = { generateProject, generateFurniture }

