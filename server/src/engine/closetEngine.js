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
const { z } = require('zod')
// ── Manifiesto matemático (Single Source of Truth) — DeepSeek R1 specs ──
const FurnitureMath = require('../ai/furnitureMathSpecs')
// ★ Ley física (chapa + herrajes): FUENTE ÚNICA en ./constants.
//   Generador y validador leen el MISMO MATERIAL y el MISMO HARDWARE para evitar
//   que el motor genere piezas que su propio validador rechaza (P0 resuelto 2026-07-19).
const { MATERIAL, HARDWARE, BASEBOARD, PANEL_VISTA, AEREO, STRUCTURAL_LIMITS } = require('./constants')

// ★ RODAPIÉ UNIVERSAL 2026-07-20 — recuo con guard de fondo.
//   El zócalo frontal se coloca en `z = D − T/2 − inset` y el trasero en `z = T/2 + inset`.
//   Con un recuo fijo, en muebles poco profundos el FRONTAL cae DETRÁS del TRASERO
//   (geometría invertida, mueble no ensamblable). Ej. D=200, T=18, inset=100:
//   frontal z=91, trasero z=109 → invertido. Este clamp reduce el recuo lo justo
//   para preservar `MIN_INNER_GAP` entre ambos, de forma determinista.
//   Devuelve 0 si ni siquiera eso es posible (fondo ridículo) → zócalos a ras.
function clampBaseboardInset(depth, thickness, desiredInset = BASEBOARD.INSET) {
  const maxInset = Math.floor((depth - thickness - BASEBOARD.MIN_INNER_GAP) / 2)
  return Math.max(0, Math.min(desiredInset, maxInset))
}

// ─── Zod Schema & Structural Validation ──────────────────────────────────────
const dimensionsSchema = z.object({
  width: z.number({ required_error: 'width es obligatorio', invalid_type_error: 'width debe ser un número' })
    .refine((v) => Number.isFinite(v), { message: 'width debe ser un número finito' })
    .refine((v) => v > 0, { message: 'width debe ser mayor a 0' }),
  height: z.number({ required_error: 'height es obligatorio', invalid_type_error: 'height debe ser un número' })
    .refine((v) => Number.isFinite(v), { message: 'height debe ser un número finito' })
    .refine((v) => v > 0, { message: 'height debe ser mayor a 0' }),
  depth: z.number({ required_error: 'depth es obligatorio', invalid_type_error: 'depth debe ser un número' })
    .refine((v) => Number.isFinite(v), { message: 'depth debe ser un número finito' })
    .refine((v) => v > 0, { message: 'depth debe ser mayor a 0' }),
  thickness: z.number({ required_error: 'thickness es obligatorio', invalid_type_error: 'thickness debe ser un número' })
    .refine((v) => Number.isFinite(v), { message: 'thickness debe ser un número finito' })
    .refine((v) => v > 0, { message: 'thickness debe ser mayor a 0' }),
})

function validateStructuralDimensions(cfg) {
  const fields = ['width', 'height', 'depth', 'thickness']
  const dimsToValidate = {}

  for (const field of fields) {
    const rawVal = cfg?.[field]
    if (rawVal === null || rawVal === undefined || typeof rawVal === 'boolean' || rawVal === '') {
      const err = new Error(`INVALID_DIMENSION: El campo "${field}" es obligatorio y no puede ser nulo, booleano ni vacío.`)
      err.code = 'STRUCTURAL_FAIL_BAD_INPUT'
      err.statusCode = 400
      throw err
    }
    const numVal = Number(rawVal)
    if (isNaN(numVal) || !Number.isFinite(numVal) || numVal <= 0) {
      const err = new Error(`INVALID_DIMENSION: El campo "${field}" debe ser un número finito y mayor a 0. Valor recibido: ${rawVal}`)
      err.code = 'STRUCTURAL_FAIL_BAD_INPUT'
      err.statusCode = 400
      throw err
    }
    dimsToValidate[field] = numVal
  }

  const parseResult = dimensionsSchema.safeParse(dimsToValidate)
  if (!parseResult.success) {
    const issueMessage = parseResult.error.issues.map(i => i.message).join(', ')
    const err = new Error(`STRUCTURAL_FAIL_BAD_INPUT: ${issueMessage}`)
    err.code = 'STRUCTURAL_FAIL_BAD_INPUT'
    err.statusCode = 400
    throw err
  }
}

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
  baseboard: true, baseboardHeight: BASEBOARD.DEFAULT_HEIGHT,
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
  pedestalWidth: 400,        // solo moduleType 'desk': ancho del gavetero
  // ── ADITIVO 2026-07-19 (work item topologías): defaults neutros = output idéntico
  nicheHeight: 0,            // >0: nicho abierto bajo las puertas (ref. gabinete c/nicho)
  drawerColumns: null,       // 2..4: N columnas de gavetas con montantes DIV-GAV
  drawerPrivacyPanel: true,  // ★ 2026-07-23: travesaño de cierre sobre gavetas (privacidad)
  drawerRailHeight: 50,      // ★ 2026-07-23: alto del travesaño (mm), estándar 50, ampliable
  // ── ADITIVO 2026-07-26: altura de INSTALACIÓN (piso → borde INFERIOR del mueble).
  //    Es metadato de MONTAJE, no de fabricación: no genera ni modifica NINGUNA pieza
  //    (la lista de cortes es idéntica con mountHeight 0 o 1450). Lo consumen el visor
  //    3D, el plano de conjunto y la nota de fijación de la BOM.
  //    Convención: borde INFERIOR, no superior — es la línea que marca el instalador
  //    para la riel, y no cambia sola si cambia la altura del mueble.
  //    null = NO ESPECIFICADO (sentinela). Se resuelve en el bloque INVARIANTE aéreo:
  //    aéreo → AEREO.KITCHEN_MOUNT_HEIGHT · resto → 0 (apoyado en el piso).
  //    OJO: no puede ser 0 acá. generateProject hace {...DEFAULTS,...params} ANTES de
  //    llamar a generateFurniture, así que un 0 de default sería indistinguible de un
  //    0 puesto por el usuario y el auto-default del aéreo nunca se dispararía.
  mountHeight: null,
  drawerFrontStyle: 'flat',
  cavaCncWidth: 140,
  cavaCncDepth: 35,
  slidingDoorSheets: 2,    // ★ 2026-10: hojas de correr (solo doorType='sliding')
  puxadorCava45: false,   // ★ 2026-10: mecanizado cava 45° CNC
  alturaTraviesaCava: 50,  // ★ 2026-10: altura de traviesa de respaldo en cava 45°
  // ── ADITIVO 2026-10-12 (carpintería avanzada). Defaults APAGADOS → output idéntico.
  puxadorCavaAereo: false,   // aéreo sin tirador: puerta con voladizo inferior
  tamponadoInferior: true,   // aéreo con cava: ¿lleva tamponado inferior? (voladizo 15 vs 30)
  cavaOverhang: null,        // mm: fuerza el voladizo (null = regla 15/30)
  ovenPanel: false,          // módulo horno: puerta falsa sobrepuesta + repisa estructural
  ovenNicheHeight: 600,      // mm libres sobre la repisa del horno
  topTieRails: false,        // base: travesaños de amarre en vez de techo macizo
  tieRailHeight: null,       // mm: alto de los travesaños superiores (null = 70 con encimera, 50 sin ella)
  slidingSheetOverlap: 100,  // mm: traslape corredizas (vigente 100; el taller indica 30)
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

// ★ FIX 2026-07-20 (auditoría estructural — profundidad de caja de gaveta):
//   El motor elegía `Math.max(250, floor((D-BT-20)/50)*50)`. El piso de 250mm
//   IGNORABA el espacio disponible: con D < 276mm emitía una caja MÁS PROFUNDA
//   que el propio mueble (verificado: aéreo de baño D=150 → caja de 250mm, 100mm
//   fuera de la carcasa) y el validador lo daba por VALIDADO.
//   Regla real de marcenaria: se monta la corredera comercial MÁS LARGA que quepa;
//   por debajo de 250mm no existe herraje telescópico → no hay caja fabricable.
//   Comportamiento IDÉNTICO al histórico para todo D >= 276mm (cero regresión).
// ★ RULES 2026-07-22 — despeje de profundidad PRECISO (diccionario paramétrico):
//   despeje = T (frente de gaveta) + fondoEfectivo (Tb, + profundidad de ranura si
//   el fondo es grooved) + DRAWER_REAR_CLEARANCE (10mm).
//   Sustituye el `D − Tb − 20` histórico, que ignoraba el FRENTE: en D=580/T=18
//   emitía caja de 550 → 550+6+10+18 = 584 > 580 (4mm de interferencia real).
// ─── ADITIVO 2026-10: Puertas de correr (Portas de Correr) ───────────────────
const SLIDING_RAIL_OFFSET = 80        // retranqueo para riel
const SLIDING_SHEET_OVERLAP = 100      // traslape entre hojas
const SLIDING_DOOR_HEIGHT_DEDUCTION = 35  // descontar para kit carros

function calculateSlidingDoors(cfg, D, CD, T, BT, internalWidth, internalDepth, H, hasDoors, nextId) {
  const { slidingDoorSheets = 2, puxadorCava45 = false } = cfg
  const doorType = cfg.doorType || "hinged"
  
  if (!hasDoors || doorType !== "sliding") {
    return { effectiveInternalDepth: internalDepth, pieces: [], bomItems: [], warnings: [] }
  }
  
  const effectiveInternalDepth = internalDepth - SLIDING_RAIL_OFFSET
  
  if (effectiveInternalDepth < 250) {
    return {
      effectiveInternalDepth: internalDepth,
      pieces: [],
      bomItems: [],
      warnings: [{ code: "SLIDING_DEPTH_INSUFFICIENT", severity: "error", message: `Profundidad insuficiente. Mínimo 250mm interior, solicitado ${effectiveInternalDepth}mm.` }]
    }
  }
  
  const spaceForSlides = internalWidth - 40
  const nSheets = Math.max(1, Math.min(4, slidingDoorSheets || 2))
  const sheetOverlap = (cfg.slidingSheetOverlap > 0) ? cfg.slidingSheetOverlap : SLIDING_SHEET_OVERLAP
  const sheetWidth = FurnitureMath.carpentry.slidingSheetWidth(spaceForSlides, nSheets, sheetOverlap)
  
  const bh = (cfg.baseboard && cfg.moduleType !== "aereo") ? (cfg.baseboardHeight || 100) : 0
  const drawerH = ((cfg.numDrawers || 0) > 0) ? ((cfg.numDrawers || 0) * (cfg.drawerHeight || 180)) : 0
  const nicheH = (cfg.nicheHeight || 0) > 0 ? (cfg.nicheHeight || 0) + T : 0
  const cavaLightDeduction = puxadorCava45 ? 30 : 0
  const doorHeight = H - bh - drawerH - nicheH - SLIDING_DOOR_HEIGHT_DEDUCTION - cavaLightDeduction
  
  if (doorHeight < 150) {
    return {
      effectiveInternalDepth,
      pieces: [],
      bomItems: [],
      warnings: [{ code: "SLIDING_HEIGHT_INSUFFICIENT", severity: "error", message: `Altura insuficiente. Mínimo 150mm, solicitado ${doorHeight}mm.` }]
    }
  }
  
  const pieces = []
  const yBase = bh + drawerH + nicheH
  const doorY = yBase + doorHeight / 2
  
  for (let i = 0; i < nSheets; i++) {
    const xPos = (internalWidth / 2) + (i - (nSheets - 1) / 2) * (sheetWidth - sheetOverlap)
    const notes = puxadorCava45 ? "USINAGEM: Cava 45° superior + labio 3mm" : ""
    
    pieces.push(makePiece(
      nextId("PORTA-CORRER"), `Porta de Correr ${i + 1}/${nSheets}`, "sliding_door",
      sheetWidth, doorHeight, T, 1,
      xPos, doorY, CD + T/2,
      "vertical", { all: true }, notes, "sliding_door"
    ))
  }

  // ★ ADITIVO 2026-10: Traviesa de respaldo para cava 45°
  if (puxadorCava45) {
    const traviesaHeight = cfg.alturaTraviesaCava || 50
    pieces.push(makePiece(
      nextId('TRAV-CAVA'), 'Traviesa Respaldo Cava 45°', 'travesano',
      internalWidth, traviesaHeight, T, 1,
      internalWidth / 2, yBase + doorHeight + traviesaHeight / 2, CD + T/2,
      'horizontal', { front: true },
      'Cierre visual y anti-polvo para cava 45°', 'travesano'
    ))
  }
  
  const bomItems = [
    { type: "Riel Corredor Inferior", description: `Riel Aluminio duplo 50mm x ${Math.round(internalWidth)}mm`, quantity: 1, unit: "un" },
    { type: "Riel Corredor Superior", description: `Riel Aluminio duplo 50mm x ${Math.round(internalWidth)}mm`, quantity: 1, unit: "un" },
    { type: "Carro Corredor", description: "Carro deslizante com rolamentos ABEC-9 (kit superior + inferior)", quantity: nSheets * 2, unit: "un" },
    { type: "Tope Lateral Riel", description: "Tope de goma para fin de carrera (par)", quantity: 2, unit: "par" }
  ]
  
  if (puxadorCava45) {
    bomItems.push({ type: "Usinagem CNC", description: `Mecanizado Cava 45° (bisel + labio 3mm) — ${nSheets} hojas`, quantity: nSheets, unit: "un" })
  }
  
  return { effectiveInternalDepth, pieces, bomItems, warnings: [] }
}

function drawerDepthClearance(T, Tb, backStyle, grooveDepth) {
  const fondoEfectivo = Tb + (backStyle === 'grooved' ? (grooveDepth || 8) : 0)
  return T + fondoEfectivo + HARDWARE.DRAWER_REAR_CLEARANCE
}

function pickSlideDepth(availableDepth) {
  let best = 0
  for (const len of HARDWARE.SLIDE_LENGTHS) {
    if (len <= availableDepth && len > best) best = len
  }
  return best
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
  validateStructuralDimensions(cfg)
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

  // ★ ADITIVO 2026-07-22 (escritorios v2): `hasPedestal` (default true = histórico)
  //   y `pedestalSide` 'left'|'right' (default 'right' = histórico → cero regresión:
  //   con los defaults, cada fórmula de posición es EXACTAMENTE la expresión previa).
  //   hasPedestal:false → ESCRITORIO SIMPLE: cubierta + 2 laterales de apoyo +
  //   faldón estructural a todo el vano. Sin gavetero.
  const hasPedestal = cfg.hasPedestal !== undefined ? !!cfg.hasPedestal : true
  const pedSide = (hasPedestal && cfg.pedestalSide === 'left') ? 'left' : 'right'
  cfg.hasPedestal = hasPedestal
  cfg.pedestalSide = hasPedestal ? pedSide : null

  const pedInterior = pedW - 2 * T          // entre PED-DIV y el lateral del lado del pedestal
  const kneeSpan = hasPedestal ? (W - pedW - T) : (W - 2 * T)   // vano libre para piernas

  let pedCenterX = 0
  if (hasPedestal) {
    // Costado interno que cierra el gavetero; el vano de piernas queda al lado opuesto
    const divX = pedSide === 'right' ? (W - pedW + T/2) : (pedW - T/2)
    pieces.push(makePiece(nextId('PED-DIV'), 'Costado Pedestal', 'divider', D, latH, T, 1, divX, latH/2, D/2, 'vertical', { front: true }, `Cierra el gavetero — vano libre a la ${pedSide === 'right' ? 'izquierda' : 'derecha'}`))

    const pedMidX = pedSide === 'right' ? (W - pedW/2) : (pedW/2)
    pedCenterX = pedSide === 'right' ? (W - pedW + T + pedInterior/2) : (T + pedInterior/2)

    // Piso del pedestal
    pieces.push(makePiece(nextId('PED-BASE'), 'Base Pedestal', 'piso', pedInterior, D - BT, T, 1, pedMidX, T/2, (D - BT)/2, 'horizontal', { front: true }))

    // Fondo solo detrás del pedestal (el vano queda abierto para cables)
    pieces.push(makePiece(nextId('PED-FUNDO'), 'Fondo Pedestal', 'fondo', pedInterior, latH - T, BT, 1, pedMidX, (latH + T)/2, D - BT/2, 'none'))
  }

  // Faldón trasero (modesty panel) — rigidiza el conjunto a la altura correcta:
  // pegado bajo el tampo (y = latH − apronH/2). Altura desde SSOT (furnitureMathSpecs).
  const apronH = FurnitureMath.desk.apronHeight(latH)
  // ★ FIX 2026-07-23: el faldón debe quedar DENTRO del vano de piernas, entre el
  //   borde interno del lateral (x=T) y el pedestal — antes estaba corrido ½T y
  //   pisaba el lateral. Centro del vano = punto medio de sus dos bordes reales.
  //   right: vano [T, W−pedW] → centro (W−pedW+T)/2 · left: vano [pedW, W−T] → (W+pedW−T)/2
  const apronCX = hasPedestal
    ? (pedSide === 'right' ? ((W - pedW + T)/2) : ((W + pedW - T)/2))
    : W/2
  pieces.push(makePiece(nextId('TRAV-FALDON'), 'Faldon Trasero', 'tie_strip', kneeSpan, apronH, T, 1, apronCX, latH - apronH/2, D - BT - T/2, 'horizontal', { front: true }, 'Modesty panel — rigidez del vano'))

  // Gavetas del pedestal — AUTO-FIT: se estiran para llenar el pedestal bajo un
  // TRAVESAÑO de cierre pegado al tampo. Holgura de corredera 26mm (CLEAR/gaveta).
  const CLEAR = 16, MINH = 80
  const reqDrawers = cfg.numDrawers || 0
  // ★ TRAVESAÑO 2026-07-23 (drawerRailHeight): tira de cierre superior sobre las
  //   gavetas, PEGADA al tampo, para privacidad. Estándar 50mm; el usuario puede
  //   pedir uno MAYOR (nunca menor a 50). drawerPrivacyPanel:false lo elimina.
  const railH = (hasPedestal && reqDrawers > 0 && cfg.drawerPrivacyPanel !== false)
    ? Math.max(50, Math.round(cfg.drawerRailHeight || 50))
    : 0
  const usableH    = latH - T          // de la base del pedestal (Y=T) al tampo (Y=latH)
  const drawerZone = usableH - railH   // espacio real para la pila de gavetas
  // Nº de gavetas que caben con altura mínima; luego se ESTIRAN para llenar la zona.
  const n = hasPedestal ? Math.min(reqDrawers, Math.max(0, Math.floor(drawerZone / (MINH + CLEAR)))) : 0
  // Altura de cada gaveta AUTO-AJUSTADA: reparte drawerZone en n filas (sin hueco).
  const dh = n > 0 ? Math.max(MINH, Math.floor(drawerZone / n) - CLEAR) : 0
  for (let i = 0; i < n; i++) {
    const yPos = T + i * (dh + CLEAR) + dh/2
    const drawerId = `DRW-${i + 1}`
    pieces.push({ ...makePiece(nextId('GAV-FF'), `Frente Gaveta ${i + 1}`, 'drawer_front',
      pedInterior - 2*HARDWARE.DRAWER_FRONT_GAP, dh - 2*HARDWARE.DRAWER_FRONT_GAP, T, 1,
      pedCenterX, yPos, D - T/2, 'horizontal', { all: true }, 'Holgura 2mm/lado', 'drawer_front'), drawerGroupId: drawerId })
    const boxOuterW = FurnitureMath.drawerBox.netWidth(pedInterior)
    const boxInnerW = FurnitureMath.drawerBox.headerWidth(boxOuterW, T)
    const boxD = pickSlideDepth(D - drawerDepthClearance(T, BT, cfg.backStyle, cfg.grooveDepth))
    const boxH = dh - 40
    if (boxOuterW > 2 * T && boxInnerW > 10 && boxH > 20 && boxD > 0) {
      pieces.push({ ...makePiece(nextId('GAV-LAT'), `Lateral Cajon ${i+1}`, 'drawer_box', boxD, boxH, T, 2, pedCenterX, yPos, D/2, 'horizontal', { front: true }), drawerGroupId: drawerId })
      pieces.push({ ...makePiece(nextId('GAV-EST'), `Frente/Trasera Cajon ${i+1}`, 'drawer_box', boxInnerW, boxH, T, 2, pedCenterX, yPos, D/2, 'horizontal', { front: true }), drawerGroupId: drawerId })
      pieces.push({ ...makePiece(nextId('GAV-FUNDO'), `Fondo Cajon ${i+1}`, 'drawer_bottom', boxOuterW, boxD, 6, 1, pedCenterX, yPos - boxH/2 + 3, D/2, 'horizontal', { none: true }), drawerGroupId: drawerId })
    }
  }

  // Travesaño de cierre PEGADO bajo el tampo (tope en latH = cara inferior del tampo).
  if (railH > 0 && n > 0) {
    // ★ 2026-07-23: el travesaño de cierre es ESTRUCTURAL — va de lateral a lateral
    //   (encastrado entre los costados del pedestal), ancho = pedInterior completo,
    //   NO un frente con holgura. Cierra el vano tocando ambos costados.
    pieces.push(makePiece(nextId('TRAV-GAV'), 'Travesaño Superior', 'tie_strip',
      pedInterior, railH, T, 1,
      pedCenterX, latH - railH / 2, D - T / 2, 'horizontal', { all: true },
      `Travesaño de cierre ${railH}mm sobre gavetas — privacidad`))
  }

  const specAdjustments = []
  if (!hasPedestal && reqDrawers > 0) {
    specAdjustments.push({
      code: 'DRAWERS_REQUIRE_PEDESTAL', severity: 'critical', field: 'numDrawers',
      requested: reqDrawers, applied: 0,
      message: `Se solicitaron ${reqDrawers} gavetas pero el escritorio es SIMPLE (hasPedestal:false). ` +
               `Las gavetas requieren cajonera/pedestal para fijar las correderas.`
    })
  } else if (n < reqDrawers) {
    specAdjustments.push({
      code: 'DRAWER_COUNT_REDUCED', severity: 'critical', field: 'numDrawers',
      requested: reqDrawers, applied: n,
      // ★ 2026-07-26: `drawerZone` distingue la variante ESCRITORIO de este aviso
      //   (el localizador elige DRAWER_COUNT_REDUCED_DESK cuando está presente).
      //   Sin él, la hoja en inglés caía al texto español.
      params: { requested: reqDrawers, applied: n, drawerZone },
      message: `Se solicitaron ${reqDrawers} gavetas pero solo caben ${n} en el pedestal (${drawerZone}mm útiles bajo el travesaño).`
    })
  }
  if (railH > 0 && n > 0) {
    specAdjustments.push({
      code: 'DRAWER_PRIVACY_PANEL', severity: 'info', field: 'drawerRailHeight',
      // ★ 2026-07-26: `params` expone los valores que hasta ahora sólo existían DENTRO
      //   del string, para que el cliente pueda re-renderizar el aviso en otro idioma.
      //   `message` NO se toca: 17 consumidores lo leen y es el fallback si falta una
      //   traducción. Un aviso en español es aceptable; uno vacío es peligroso.
      params: { railH, dh },
      message: `Travesaño de cierre de ${railH}mm pegado al tampo (privacidad); ` +
               `las gavetas se ajustaron a ${dh}mm de alto para llenar el pedestal.`
    })
  }
  cfg.numDrawers = n
  cfg.drawerHeight = dh || cfg.drawerHeight   // refleja la altura REAL fabricada (auto-fit)
  cfg.drawerRailHeight = railH
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
  validateStructuralDimensions(cfg)

  // ── ADITIVO 2026-07-19: topología escritorio — rama dedicada, path viejo intacto
  if (cfg.moduleType === 'desk') return generateDeskFurniture(cfg)

  // ── Base independiente / patas (compat: baseboard:false legacy → 'none') ──
  const legHeight = cfg.legHeight || 100
  let baseType = params.baseType || (params.baseboard === false ? 'none' : (cfg.baseType || 'recessed'))
  // ★ INVARIANTE 2026-07-23: un mueble AÉREO (colgado) NUNCA lleva base, patas ni
  //   zócalo. Antes, si un aéreo llegaba con baseType='legs', la BOM emitía 4 patas
  //   reguladoras (línea "Pe Nivelador") aunque la geometría no las generara →
  //   despiece incoherente. Se fuerza baseType='none' para bloquear patas/zócalo en
  //   geometría Y en BOM. Regla de dominio: aéreo = carcasa cerrada (laterales +
  //   techo + piso + fondo) + puertas + tamponado opcional, SIN apoyos inferiores.
  if (cfg.moduleType === 'aereo') {
    baseType = 'none'
    cfg.baseboard = false
    // ★ ADITIVO 2026-07-26: un aéreo SIN altura de instalación explícita salía con
    //   mountHeight undefined → el plano de conjunto lo dibujaba APOYADO EN EL PISO
    //   (físicamente falso: un aéreo va colgado). Auto-default al estándar de dominio
    //   ya definido en constants (AEREO.KITCHEN_MOUNT_HEIGHT = bancada 900 + vano 550).
    //   Se respeta SIEMPRE el valor explícito del usuario/IA (params.mountHeight).
    //   No toca geometría: mountHeight es metadato de montaje.
    if (params.mountHeight == null) cfg.mountHeight = AEREO.KITCHEN_MOUNT_HEIGHT
  } else {
    if (baseType === 'none') { cfg.baseboard = false }
    else if (baseType === 'legs') { cfg.baseboard = true; cfg.baseboardHeight = legHeight }
// ★ 2026-10-18: columnas automáticas para gavetas en layout horizontal. Antes: fijo en 2 en
//   tres sitios; con ancho amplio y 3 gavetas el auto-ajuste de altura descartaba una gaveta
//   en silencio. Frente mínimo ~300 mm; máximo 4 columnas (contrato drawerColumns).
function autoDrawerCols(numDrawers, widthMM, T) {
  const inner = Number(widthMM) - 2 * Number(T)
  if (!isFinite(inner) || inner <= 0) return Math.min(numDrawers, 2)
  return Math.min(numDrawers, 4, Math.max(2, Math.floor((inner + Number(T)) / (300 + Number(T)))))
}

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

  // ★ ADITIVO 2026-10-15 — gavetas por VANO: con divisores verticales cada vano es una columna
  //   de gavetas (spanWidth = (iW − nDiv·T)/(nDiv+1)). Antes la gaveta usaba el ancho interno
  //   TOTAL e ignoraba los divisores → frentes irreales (p. ej. 2360mm) sin corredera posible.
  //   Reusa el sistema de drawerColumns (2..4) y sus montantes DIV-GAV. Sin divisores, o con
  //   columnas ya explícitas, no cambia nada.
  if (cfg.moduleType !== 'desk' && (cfg.numDrawers || 0) > 1 && (cfg.numDividers || 0) > 0 &&
      !(cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4) && cfg.numDividers + 1 <= 4) {
    cfg.drawerColumns = cfg.numDividers + 1
    specAdjustments.push({
      code: 'DRAWER_COLUMNS_FROM_DIVIDERS',
      severity: 'info',
      field: 'drawerColumns',
      requested: null,
      applied: cfg.drawerColumns,
      params: { cols: cfg.drawerColumns, dividers: cfg.numDividers },
      message: `Con ${cfg.numDividers} divisor(es) las gavetas se distribuyen en ${cfg.drawerColumns} columnas (una por vano).`
    })
  }
  const requestedDrawers      = cfg.numDrawers
  const requestedDrawerHeight = cfg.drawerHeight

  if ((cfg.numDrawers || 0) > 0) {
    const CLEAR = 16, MINH = 80
    const availableHeight = cfg.height
      - (cfg.baseboard ? (cfg.baseboardHeight || BASEBOARD.DEFAULT_HEIGHT) : 0)
      - (2 * cfg.thickness)
    if (availableHeight > 0) {
      // ADITIVO 2026-07-19: drawerColumns también aplica al auto-fit de la pila
      const afCols = (cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4) ? Math.floor(cfg.drawerColumns) : null
      const isH = (cfg.drawerLayout === 'horizontal' && cfg.numDrawers > 1) || (afCols !== null && cfg.numDrawers > 1)
      let cols = (afCols !== null && cfg.numDrawers > 1) ? afCols : (isH ? autoDrawerCols(cfg.numDrawers, cfg.width, cfg.thickness) : 1)
      if (isH && afCols === null && cfg.numDrawers > 1) {
        // ★ 2026-10-18: si la altura sólo admite pocas filas, subir columnas (frente más estrecho)
        //   antes que descartar gavetas. Se guarda para que fillCols y el layout usen lo mismo.
        const rowsFit = Math.max(1, Math.floor(availableHeight / (CLEAR + MINH)))
        cols = Math.min(cfg.numDrawers, Math.max(cols, Math.ceil(cfg.numDrawers / rowsFit)))
        cfg._autoCols = cols
      }
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

  // ★ RULES 2026-07-22 — GUARD DE ESPESOR (diccionario paramétrico):
  //   solo espesores del catálogo real {15, 18, 25}. Basura (12, 30, NaN) lanza
  //   ANTES de generar una sola pieza. 25 se admite por decisión explícita:
  //   feature Pro del cliente + tampo de la topología desk.
  if (!MATERIAL.THICKNESS_ALLOWED.includes(cfg.thickness)) {
    const err = new Error(`INVALID_THICKNESS: espesor ${cfg.thickness}mm fuera del catálogo ` +
      `[${MATERIAL.THICKNESS_ALLOWED.join(', ')}]mm. Use un espesor comercial de MDF/MDP.`)
    err.statusCode = 400; throw err
  }

  // ★ RULES 2026-07-22 — FONDO ESTRUCTURAL EN AÉREOS (decisión explícita):
  //   un colgado transmite TODA la carga a la pared a través del fondo atornillado.
  //   Fondo ranurado de 3–6mm en aéreo = riesgo de arrancamiento. El motor fuerza
  //   Tb=15 y lo reporta vía specAdjustments (patrón existente, visible en UI).
  if (cfg.moduleType === 'aereo' && (cfg.backThickness || 6) < MATERIAL.BACK_AEREO_STRUCTURAL) {
    const requestedBT = cfg.backThickness || 6
    cfg.backThickness = MATERIAL.BACK_AEREO_STRUCTURAL
    cfg.backStyle = 'screwed'   // fondo estructural atornillado, no ranurado
    specAdjustments.push({
      code: 'AEREO_BACK_FORCED_STRUCTURAL',
      severity: 'warning',
      field: 'backThickness',
      requested: requestedBT,
      applied: MATERIAL.BACK_AEREO_STRUCTURAL,
      message: `Fondo de aéreo elevado de ${requestedBT}mm a ${MATERIAL.BACK_AEREO_STRUCTURAL}mm ` +
               `(estructural atornillado): el fondo transmite la carga al riel de pared.`
    })
  }

  const { moduleType, width: W_FIN, height: H, depth: D, thickness: T, backThickness: BT,
          numShelves, numDrawers, drawerHeight, drawerLayout, baseboard, baseboardHeight,
          hasDoors, numDoors, hasCountertop, topShelf } = cfg

  // ★ TAMPONADO = ANCHO ACABADO 2026-07-20 (decisión explícita del usuario):
  //   el W pedido INCLUYE los paneles tapatornillos. La carcasa se descuenta
  //   (900 acabado, tampón 9mm/lado → carcasa 882 — regla del manual del taller).
  //   Antes los tampones se SUMABAN por fuera: un "mueble de 900" medía 918/930
  //   reales y no entraba en un vano de obra de 900.
  //   `tamponadoThickness` default = T (tampón del mismo MDF de la carcasa).
  //   Sin tamponado ('none') W === W_FIN: cero regresión.
  const tampMode  = cfg.tamponado || 'none'
  const tampSides = FurnitureMath.tamponado.sidesFor(tampMode)
  const tampT     = cfg.tamponadoThickness || T
  const W = FurnitureMath.tamponado.carcassWidth(W_FIN, tampSides, tampT)
  cfg.tamponadoThickness = tampT   // persistir el valor aplicado en el JSON (aditivo)

  // ★ MOLDURA FRONTAL 2026-07-20 (opt-in, default off — cero regresión):
  //   cfg.frontMolding=true → laterales pierden 20mm de profundidad y las piezas
  //   horizontales (base/techo/repisas) 40mm, para alojar la moldura que define
  //   la profundidad acabada (600 → laterales 580 · base/repisas 560).
  const MOLD = cfg.frontMolding ? FurnitureMath.frontMolding.DEFAULT_DEPTH : 0

  // ★ RULES 2026-07-22 — PANEL VISTA ⊥ FIJACIÓN (separación ortogonal):
  //   `panelVista` ('ninguno'|'uno'|'ambos') = GEOMETRÍA: tapatornillos interiores de
  //   15mm que reducen el ancho neto Nw de las piezas horizontales (30/15/0mm).
  //   `fijacion` ('minifix'|'espiga'|'tornillo_visto') = HERRAJE: jamás toca Nw.
  //   El vano interior Vw = W − 2T queda PURO (internalWidth no se toca).
  //   Default 'ninguno' → PV=0 → despiece byte-idéntico (cero regresión).
  const pvMode  = PANEL_VISTA.MODES.includes(cfg.panelVista) ? cfg.panelVista : 'ninguno'
  const PV      = (pvMode === 'ambos' ? 2 : pvMode === 'uno' ? 1 : 0) * PANEL_VISTA.THICKNESS
  cfg.panelVista = pvMode
  cfg.fijacion   = PANEL_VISTA.FIJACIONES.includes(cfg.fijacion) ? cfg.fijacion : 'minifix'

  const pieces = []
  let pieceCounter = 1
  const nextId = (prefix) => prefix + '-' + String(pieceCounter++).padStart(3, '0')

  const isAereo = moduleType === 'aereo'
  const isBase = moduleType === 'base' || moduleType === 'standard'
  // ★ GUARD DE MUEBLE COLGADO: un aéreo NUNCA lleva rodapié (va a pared, no al piso).
  //   `!isAereo` es la barrera dura; `baseboard:false` es el opt-out explícito del usuario.
  //   BH3=0 → structuralHeight = H completa (la altura no se ve alterada).
  const BH3 = (baseboard && !isAereo) ? (baseboardHeight || BASEBOARD.DEFAULT_HEIGHT) : 0
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
  const countertopTies = (isBase && hasCountertop && moduleType !== 'standard')
  // ★ ADITIVO 2026-10-12: topTieRails=true reemplaza el techo macizo por travesaños de
  //   amarre (frontal+trasero) también SIN encimera. Con encimera se conserva el alto
  //   histórico de 70mm; sin ella usa cfg.tieRailHeight (50mm por defecto).
  const useTieRails = countertopTies || (cfg.topTieRails === true && !isAereo)
  //   Un tieRailHeight EXPLÍCITO manda siempre ("travesaños de 5cm" gana sobre el 70 histórico).
  const tieH = cfg.tieRailHeight > 0
    ? cfg.tieRailHeight
    : (countertopTies ? 70 : FurnitureMath.carpentry.TIE_RAIL_HEIGHT)
  // ★ FIX 2026-10-15 — base + tampo + gavetas SIN puertas: las gavetas llegan hasta el tampo
  //   (luz de 3mm) y queda UN solo travesaño, el trasero, oculto tras los frentes. Antes había
  //   un travesaño frontal de 70mm que asomaba por el hueco de ~18mm sobre el último frente.
  const drawerTopFlush = countertopTies && (numDrawers || 0) > 0 && !hasDoors && !cfg.topShelf && cfg.drawerFrontStyle !== 'cava45' && cfg.topTieRails !== true
  const hasTopPanel = !useTieRails
  const topT = (topStyle === 'overlay' && hasTopPanel && !isAereo) ? T : 0

  const latBottom = onLegs ? BH3 : 0
  const baseDeduction = cfg.baseThicknessDeduction || 0
  const latH = FurnitureMath.calculatePanelHeight(H, baseDeduction, topT, latBottom)
  const latY = latBottom + baseDeduction + latH/2
  // ★ ADITIVO 2026-10-12 — aéreo sin tirador (cava): la puerta rebasa hacia abajo y los
  //   tamponados laterales acompañan su altura. Voladizo: 15mm con tamponado inferior,
  //   30mm sin él (cfg.cavaOverhang manda). Opt-in: puxadorCavaAereo=false → sin efecto.
  const aereoCava = (isAereo && hasDoors && cfg.puxadorCavaAereo && (cfg.doorType || 'hinged') === 'hinged')
    ? FurnitureMath.carpentry.aereoCavaDoor({ carcassH: H, bottomTamponado: cfg.tamponadoInferior !== false, overhangOverride: cfg.cavaOverhang })
    : null
  const tampLatH = aereoCava ? aereoCava.tamponLateralH : latH
  const tampLatY = aereoCava ? latY - aereoCava.overhang / 2 : latY
  pieces.push(makePiece(nextId('LAT-L'), 'Lateral Izquierdo', 'lateral', CD - MOLD, latH, T, 1, T/2, latY, CD/2, 'vertical', { front: true }))
  pieces.push(makePiece(nextId('LAT-R'), 'Lateral Derecho', 'lateral', CD - MOLD, latH, T, 1, W - T/2, latY, CD/2, 'vertical', { front: true }))

  // ── TAMPONADO: panel de acabamiento que tapa tornillos en el costado visible ──
  const tamp = cfg.tamponado || 'none'
  // ★ ADITIVO 2026-10-12 — ALINEACIÓN EN Z: con puertas, el tamponado lateral llega a ras de la
  //   cara EXTERIOR de la puerta (cara frontal en CD+T). overlay: CD+T = D · legacy: CD+T = D+T.
  //   Sin puertas o sin tamponado el cálculo es el histórico (tampFlushExtra = 0).
  const tampFlushExtra = (tamp !== 'none' && hasDoors) ? T : 0
  const tampDepth = CD - MOLD + tampFlushExtra
  if (tamp === 'left' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-L'), 'Tampão Lateral Izq', 'tamponado', tampDepth, tampLatH, tampT, 1, -tampT/2, tampLatY, CD/2 + tampFlushExtra/2, 'vertical', { front: true }, `Tapatornillos ${tampT}mm — incluido en ancho acabado ${W_FIN}mm`))
  if (tamp === 'right' || tamp === 'both')
    pieces.push(makePiece(nextId('TAMP-R'), 'Tampão Lateral Der', 'tamponado', tampDepth, tampLatH, tampT, 1, W + tampT/2, tampLatY, CD/2 + tampFlushExtra/2, 'vertical', { front: true }, `Tapatornillos ${tampT}mm — incluido en ancho acabado ${W_FIN}mm`))

  if (useTieRails) {
    if (!drawerTopFlush) pieces.push(makePiece(nextId('TRAV-F'), 'Travesaño Frontal', 'tie_strip', internalWidth - PV, tieH, T, 1, W/2, H - tieH/2, T/2 + 20, 'horizontal', { front: true }, 'Refuerzo Estructural'))
    pieces.push(makePiece(nextId('TRAV-B'), 'Travesaño Trasero', 'tie_strip', internalWidth - PV, tieH, T, 1, W/2, H - tieH/2, D - BT - T/2, 'horizontal', { front: true }, 'Refuerzo Estructural'))
  } else {
    // COHERENCIA OBLIGATORIA: si el lateral se acortó (overlay), la tapa se apoya
    // encima y debe cubrir el ancho COMPLETO. Con W−2T quedaría flotando dejando
    // un hueco de T a cada lado sobre el canto del lateral.
    const topWidth = topT > 0 ? W : internalWidth - PV
    pieces.push(makePiece(nextId('TAMPO'), 'Techo', 'techo', topWidth, CD - 2*MOLD, T, 1, W/2, H - T/2, CD/2, 'horizontal', { front: true }))
  }

  pieces.push(makePiece(nextId('BASE'), 'Base Inferior', 'piso', internalWidth - PV, CD - 2*MOLD, T, 1, W/2, BH3 + T/2, CD/2, 'horizontal', { front: true }))

  // BUG FIX #5 & VULN-05: base+countertop has traversaños (70mm) at top, not a techo (T).
  const topDeduction = useTieRails ? tieH : T
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

  // ★ RODAPIÉ UNIVERSAL 2026-07-20: recuo desde SSOT (BASEBOARD.INSET = 100mm, estándar
  //   BR 10–15cm) con clamp para fondos poco profundos. Antes era `50` hardcodeado, por
  //   debajo del mínimo ergonómico de 76mm (3"). IDs renombrados a RODAPIE-FRONTAL/TRASERO
  //   (el `type: 'baseboard'` NO cambia — es la clave que consumen visor, cutlist,
  //   planRenderer y ExportPanel, así que el renombre es seguro).
  if (baseType === 'recessed' && BH3 > 0) {
    const bbInset = clampBaseboardInset(D, T)
    const bbNote  = bbInset < BASEBOARD.INSET
      ? `Recuo reducido a ${bbInset}mm (fondo ${D}mm insuficiente para el estándar de ${BASEBOARD.INSET}mm)`
      : `Recuo ${bbInset}mm (estándar marcenaria BR)`
    pieces.push(makePiece(nextId('RODAPIE-FRONTAL'), 'Zócalo Frontal', 'baseboard', internalWidth - PV, BH3, T, 1, W/2, BH3/2, D - T/2 - bbInset, 'vertical', { front: true }, bbNote))
    pieces.push(makePiece(nextId('RODAPIE-TRASERO'), 'Zócalo Trasero', 'baseboard', internalWidth - PV, BH3, T, 1, W/2, BH3/2, T/2 + bbInset, 'vertical', { front: true }, bbNote))
  }

  // ★ ADITIVO 2026-10-13 — SISTEMA MAESTRO DE GAVETAS (Padrão Brasil)
  // === COMPORTAMIENTO HISTÓRICO PRESERVADO PARA ESTABILIDAD ===
  // Restaurado código original del motor clósets sin cambios en la funcionalidad de gavetas
  const drawerAlignment = cfg.moduleType === 'base' ? 'top' : 'bottom'
  
  // 2. Calcular altura de vano disponible para gavetas (código histórico)
  const FLUSH_GAP = 3   // luz entre el último frente y la cara inferior del tampo
  // ★ FIX 2026-10-15 — zona de relleno medida en FILAS (no en nº de gavetas) y descontando las
  //   juntas de 3mm entre filas. Antes: n gavetas en 2-3 columnas llegaban sólo a media altura
  //   (zona/n), y la pila de n filas excedía la zona por (n−1)·3mm → frente pisaba techo/base 7-8mm.
  const fillCols = (numDrawers > 1)
    ? ((cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4) ? Math.floor(cfg.drawerColumns) : (drawerLayout === 'horizontal' ? (cfg._autoCols || autoDrawerCols(numDrawers, W, T)) : 1))
    : 1
  const fillRows = Math.max(1, Math.ceil(numDrawers / fillCols))
  const drawerZoneHeight = (drawerTopFlush
    ? H - BH3 - T - FLUSH_GAP                           // pila exacta: [BH3+T, H−3]
    : H - BH3 - 2*T - (cfg.topShelf ? T : 0)) - (fillRows - 1) * 3
  
  // 3. Fórmula histórica para distribución equal
  const equalHeight = Math.floor(drawerZoneHeight / fillRows)
  const safeDrawerHeight = Math.max(100, drawerHeight)
  
  // Variables para compatibilidad con sistema de cierre estructural
  // ★ FIX 2026-10-15 — clóset (gavetas ABAJO + puertas/estantes ARRIBA): el bloque de gavetas
  //   mide `drawerHeight` por fila, no zona/numDrawers. Antes los frentes se estiraban por todo
  //   el mueble (4 × 562mm), pisaban la SEP y las puertas. Pitch = safeDrawerHeight exacto
  //   (frente + 3mm de junta), coherente con shelfYStart/nicho/divisores y con el visor 3D.
  //   Cómoda pura (sin puertas ni estantes) y módulos 'base' conservan la fórmula histórica.
  // ★ FIX 2026-10-15 (base MIXTO) — base con gavetas + puertas (o estantes): los frentes miden
  //   `drawerHeight` (no zona/n), las gavetas van ARRIBA (bajo el tampo, como en cocina), la SEP
  //   cierra el bloque 16mm bajo el último frente y las puertas ocupan EXACTAMENTE el vano de abajo.
  //   Exige PUERTAS: un gavetero sin puertas (aunque el parser le deje estantes por defecto) conserva
  //   su relleno histórico. Base de sólo puertas, gavetero y puertas de correr / horno: intactos.
  const baseMixed = cfg.moduleType === 'base' && numDrawers > 0 && hasDoors
    && !drawerTopFlush && cfg.doorType !== 'sliding' && !cfg.ovenPanel
  const closetStack = (cfg.moduleType !== 'base' && (hasDoors || (cfg.numShelves || 0) > 0)) || baseMixed
  const frontHeights = Array(numDrawers).fill(closetStack ? Math.max(80, safeDrawerHeight - 3) : Math.max(80, equalHeight))
  const boxHeights = frontHeights.map(fh => Math.max(40, fh - 5)) // 5mm deducción histórica
  
  // 5. Determinar posición inicial según alineación
  let drawerYStart = BH3 + T
  if (drawerAlignment === 'top') {
    // Cocinas: empiezan arriba, dejando espacio para cava bajo encimera
    const totalFrontHeights = fillRows * frontHeights[0]
    const totalGaps = (fillRows - 1) * 3 // 3mm por gap
    
    if (H - totalFrontHeights - totalGaps - BH3 - T > 0) {
      drawerYStart = H - totalFrontHeights - totalGaps - ((drawerTopFlush || (baseMixed && countertopTies)) ? FLUSH_GAP : T) // pegadas bajo encimera
    }
    // Si no cabe, fallback al comportamiento histórico (BH3 + T)
  }
  
  const numDivs = cfg.numDividers || 0
  // ★ ADITIVO 2026-07-19 (work item N columnas): drawerColumns (2..4) generaliza el
  //   layout horizontal. Sin el parámetro, cols = 2 en 'horizontal' → drawerW
  //   (internal−T)/2 ≡ internal/2 − T/2: fórmula idéntica a la histórica.
  const explicitCols = (cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4) ? Math.floor(cfg.drawerColumns) : null
  const isHorizontal = (drawerLayout === 'horizontal' && numDrawers > 1) || (explicitCols !== null && numDrawers > 1)
  // ★ 2026-10-18: en horizontal sin drawerColumns, cols = las que caben con frente ≥300 mm
  //   (antes fijo en 2 → con 3 gavetas el motor descartaba una en silencio).
  const cols = (explicitCols !== null && numDrawers > 1) ? explicitCols : (isHorizontal ? (cfg._autoCols || autoDrawerCols(numDrawers, W, T)) : 1)
  const drawersPerCol = Math.ceil(numDrawers / cols)
  const drawerW = cols > 1 ? (internalWidth - (cols - 1) * T) / cols : internalWidth

  // ★ 2026-10-15 — altura (mm) del bloque de gavetas medida desde drawerYStart. En clóset va
  //   hasta el borde superior del último frente + DRAWER_TOP_CLEARANCE (16mm de holgura de
  //   corredera) y es donde nace la SEP. Fuera de clóset es la fórmula histórica (filas × altura).
  const drawerRows = isHorizontal ? drawersPerCol : numDrawers
  const stackMM = (closetStack && drawerRows > 0)
    ? (drawerRows - 1) * (frontHeights[0] + 3) + frontHeights[0] - HARDWARE.DRAWER_FRONT_GAP + STRUCTURAL_LIMITS.DRAWER_TOP_CLEARANCE
    : drawerRows * safeDrawerHeight

  // ★ AUDIT FIX 2026-07-19 (aditivo): con columnas de gavetas no existía montante:
  // las corredicas interiores no tenían superficie de fijación (mueble no montable).
  // Genera cols−1 montantes que ocupan el gap de T entre columnas.
  if (cols > 1) {
    const gavZoneH = drawersPerCol * safeDrawerHeight
    if (gavZoneH > 0) {
      for (let c = 1; c < cols; c++) {
        pieces.push(makePiece(
          nextId('DIV-GAV'), `Montante Gavetas ${cols > 2 ? c : 'Central'}`, 'divider',
          internalDepth, gavZoneH, T, 1,
          T + c * (drawerW + T) - T/2, drawerYStart + gavZoneH/2, D/2,
          'vertical', { front: true }, 'Fijación de corredicas — obligatorio entre columnas'
        ))
      }
    }
  }

  // ★ ADITIVO 2026-10-12 (R1) — travesaños físicos de 50mm entre gavetas cava45.
  //   Pieza visible en el frente, cierra el acceso a los herrajes y da apoyo a la cava.
  //   Opt-in: sólo cuando drawerFrontStyle='cava45'. Default: sin travesaños (comportamiento histórico).
  const cava45Drawers = cfg.drawerFrontStyle === 'cava45' && numDrawers > 0
  const CAVA45_RAIL_H = FurnitureMath.carpentry.CAVA_RAIL_MIN_HEIGHT   // 50mm
  
  for (let i = 0; i < numDrawers; i++) {
    const colIdx = isHorizontal ? (i % cols) : 0
    const rowIdx = isHorizontal ? Math.floor(i / cols) : i
    const xPos = isHorizontal ? (T + (colIdx * (drawerW + T)) + drawerW/2) : W/2
    
    // 6. Calcular posición Y acumulativa usando alturas individuales
    const individualHeight = frontHeights[i] || drawerSystem.MIN_FRONT_HEIGHT
    let yPos = drawerYStart
    for (let j = 0; j < rowIdx; j++) {
      yPos += frontHeights[j] + 3 // gap de 3mm entre frentes
    }
    yPos += individualHeight/2 // centro de la gaveta actual

    if (yPos < H - 50) {
      const drawerId = `DRW-${i + 1}`

      // Pieza frontal de gaveta con estilos condicionales
      const frontNotes = cfg.drawerFrontStyle === 'cava_cnc' 
        ? `Holgura 2mm/lado | USINAGEM: Cava central CNC ${cfg.cavaCncWidth}x${cfg.cavaCncDepth}mm R20`
        : cfg.drawerFrontStyle === 'cava45'
        ? `Holgura 2mm/lado | Bisel 45° con labio plano 3mm | Luz de agarre 30mm sobre el frente`
        : cfg.drawerFrontStyle === 'internal'
        ? `Holgura 2mm/lado | Gaveta embutida en interior`
        : `Holgura 2mm/lado`

      // ★ ADITIVO 2026-10-12 — cava 45° en gavetas: cada frente cede 30mm de luz de agarre
      //   Con drawerFrontStyle distinto de 'cava45' el cálculo es el histórico, byte a byte.
      const frontGap = HARDWARE.DRAWER_FRONT_GAP
      const cavaDrawer = cfg.drawerFrontStyle === 'cava45'
        ? FurnitureMath.carpentry.cavaOffsets({ nominalH: individualHeight - 2*frontGap, internalWidth: drawerW })
        : null
      const frontH = cavaDrawer ? cavaDrawer.leafH : individualHeight - 2*frontGap
      const frontY = cavaDrawer ? (yPos - individualHeight/2 + frontGap + frontH/2) : yPos

      const frontPiece = makePiece(
        nextId('GAV-FF'), `Frente Gaveta ${i + 1}`, 'drawer_front',
        drawerW - 2*HARDWARE.DRAWER_FRONT_GAP, frontH, T, 1,
        xPos, frontY, D - T/2, 'horizontal',
        { all: true }, frontNotes, 'drawer_front'
      )

      // Agregar operaciones de mecanizado si es cava CNC
      if (cfg.drawerFrontStyle === 'cava_cnc') {
        frontPiece.machiningOps = [{
          type: 'ROUTER_POCKET_HANDLE',
          width: cfg.cavaCncWidth,
          depth: cfg.cavaCncDepth,
          radius: 20,
          edge: 'top_center'
        }]
      }

      pieces.push({
        ...frontPiece,
        drawerGroupId: drawerId
      })

      const boxOuterW = FurnitureMath.drawerBox.netWidth(drawerW)
      const boxInnerW = FurnitureMath.drawerBox.headerWidth(boxOuterW, T)
      // VULN-03 FIX: Profundidad comercial basada en espacio útil con 20mm de holgura trasera
      const maxAvailableD = D - drawerDepthClearance(T, BT, cfg.backStyle, cfg.grooveDepth)
      const boxD = pickSlideDepth(maxAvailableD)
      
      // ★ ADITIVO 2026-10-13 — Altura de caja individual según distribución
      const individualBoxHeight = boxHeights[i] || Math.max(40, individualHeight - drawerSystem.BOX_HEIGHT_DEDUCTION)
      
      // ★ ADITIVO 2026-10-13 — Tipo de fondo según configuración
      const bottomThickness = (cfg.drawerBottomStyle === 'screwed_15mm') ? 15 : 6
      const boxZ = D/2 + BT/2

      // BUG FIX #2: skip drawer box if it's physically impossible (too narrow)
      if (boxOuterW > 2 * T && boxInnerW > 10 && boxD > 50 && individualBoxHeight > 20) {
        pieces.push({
          ...makePiece(nextId('GAV-LAT'), `Lateral Cajón ${i+1}`, 'drawer_box', boxD, individualBoxHeight, T, 2, xPos, yPos, boxZ, 'horizontal', { front: true }),
          drawerGroupId: drawerId
        })

        pieces.push({
          ...makePiece(nextId('GAV-EST'), `Frente/Trasera Cajón ${i+1}`, 'drawer_box', boxInnerW, individualBoxHeight, T, 2, xPos, yPos, boxZ, 'horizontal', { front: true }),
          drawerGroupId: drawerId
        })

        const bottomNotes = (cfg.drawerBottomStyle === 'screwed_15mm')
          ? 'Fondo estructural atornillado 15mm (carga pesada)'
          : 'Fondo ranurado 6mm (estándar)'

        pieces.push({
          ...makePiece(nextId('GAV-FUNDO'), `Fondo Cajón ${i+1}`, 'drawer_bottom', boxOuterW, boxD, bottomThickness, 1, xPos, yPos - individualBoxHeight/2 + 3, boxZ, 'horizontal', { none: true }),
          drawerGroupId: drawerId,
          notes: bottomNotes
        })
      } else {
        console.warn(`[Engine] Cajón ${i+1}: caja imposible (boxOuterW=${boxOuterW}, boxInnerW=${boxInnerW}) — solo frente generado.`)
      }
    }
  }

  // ★ ADITIVO 2026-10-12 (R1) — travesaños entre gavetas cava45 (N-1 por columna, altura 50mm).
  //   Z: a ras del frente de la carcasa (= cara exterior visible). Cierran la vista al interior.
  if (cava45Drawers) {
    const nRows = isHorizontal ? drawersPerCol : numDrawers
    for (let c = 0; c < cols; c++) {
      for (let r = 1; r < nRows; r++) {
        const idxFirst = isHorizontal ? ((r - 1) * cols + c) : (r - 1)
        if (isHorizontal && idxFirst >= numDrawers) continue
        if (!isHorizontal && idxFirst >= numDrawers - 1) continue
        const xTrav = isHorizontal ? (T + c * (drawerW + T) + drawerW/2) : W/2
        const yTopOfLowerFront = drawerYStart + (r - 1) * safeDrawerHeight + safeDrawerHeight - HARDWARE.DRAWER_FRONT_GAP
        const yCenter = yTopOfLowerFront + CAVA45_RAIL_H / 2
        pieces.push(makePiece(
          nextId('TRAV-GAV'), `Travesaño Gavetas ${c + 1}·${r}`, 'tie_strip',
          drawerW - 2*HARDWARE.DRAWER_FRONT_GAP, CAVA45_RAIL_H, T, 1,
          xTrav, yCenter, D - T/2, 'horizontal', { front: true },
          'Travesaño visible entre gavetas cava 45° (apoyo y cierre visual)'
        ))
      }
    }
  }

  let shelfYStart = baseMixed ? BH3 + T : drawerYStart + stackMM + T/2
  let baseMixedZoneTop = null   // cara inferior de la SEP (o del bloque de gavetas): techo del vano de puertas
  // ★ ADITIVO 2026-07-19 (nicho): estantes interiores arrancan sobre el nicho abierto
  if (hasDoors && (cfg.nicheHeight || 0) > 0) shelfYStart += (cfg.nicheHeight || 0) + T

  // HARD_CONSTRAINT: Structural closure required for all drawer modules
  // ★ ADITIVO 2026-10-13 — Cierre estructural OBLIGATORIO para clósets
  if (numDrawers > 0 && !drawerTopFlush) {
    // Calcular posición optimizada del separador
    let sepY
    
    if (baseMixed) {
      // Base mixto: SEP bajo el bloque (arriba), su cara superior a DRAWER_TOP_CLEARANCE del borde
      // inferior del último frente (drawerYStart + holgura de frente).
      sepY = drawerYStart + HARDWARE.DRAWER_FRONT_GAP - STRUCTURAL_LIMITS.DRAWER_TOP_CLEARANCE - T/2
    } else if (drawerAlignment === 'bottom' || cfg.moduleType === 'standard') {
      // ★ CERRADO: Clósets — partición inmediatamente sobre la última gaveta
      //   Clóset: la SEP nace en drawerYStart + stackMM (= último frente + 16mm de holgura).
      //   Resto: fórmula histórica.
      const lastDrawerBottomEdge = drawerYStart + numDrawers * (safeDrawerHeight + 3) - 3
      sepY = closetStack
        ? drawerYStart + stackMM + T/2
        : lastDrawerBottomEdge + T/2 + 3 // 3mm de holgura bajo el separador
    } else {
      // Caso histórico: cocinas (comportamiento conservador)
      sepY = shelfYStart
    }
    
    if (sepY < H - 100 && sepY > BH3 + 2*T) {
      const technicalDepth = (hasDoors ? (internalDepth - 20) : internalDepth) - 2*MOLD
      const separatorType = (!baseMixed && (drawerAlignment === 'bottom' || cfg.moduleType === 'standard'))
        ? 'SEP'  
        : (cfg.drawerPrivacyPanel ? 'PRIV_SEP' : 'SEP')
      
      pieces.push(makePiece(
        nextId(separatorType), 
        'Repisa Separadora (encima gavetas)', 'shelf',
        internalWidth - 2 - PV, technicalDepth, T, 1,
        W/2, sepY, internalDepth/2 + BT, 'horizontal', { front: true },
        `Separador estructural gavetas/estantes${separatorType === 'SEP' ? ' • Clóset: aislación obligatoria' : ''}`
      ))
      shelfYStart = baseMixed ? BH3 + T : (drawerAlignment === 'bottom' ? sepY + T + 10 : shelfYStart + T + 10)
      if (baseMixed) baseMixedZoneTop = sepY - T/2
    }
    
    // ★ ADITIVO 2026-10-13 — Si el separador no cabe físicamente, generar aviso
    if (sepY >= H - 100 || sepY <= BH3 + 2*T) {
      cfg.specAdjustments = [...(cfg.specAdjustments || []), {
        code: 'SEPARATOR_OMITTED',
        severity: 'warning',
        field: 'topShelf',
        message: 'No hay espacio suficiente para el separador estructural encima de las gavetas.'
      }]
    }
  }

  // BUG FIX #9: dynamic shelf spacing — distribute evenly in available zone.
  if (baseMixed && baseMixedZoneTop === null) baseMixedZoneTop = drawerYStart   // SEP omitida: el vano llega al bloque
  const shelfZoneTop = baseMixed ? baseMixedZoneTop - 20 : H - T - 50
  const shelfZoneH   = Math.max(0, shelfZoneTop - shelfYStart)
  // ★ FIX 2026-10-15 — con las gavetas llenando todo el frente (drawerTopFlush) no hay vano para
  //   estantes ni separador: antes el parser/UI dejaba numShelves=2 y salían PRIV_SEP + 2 Estantes
  //   (3 tiras de MDF) dentro del cajón. Se omiten y se REGISTRA (transparencia).
  const shelvesToBuild = drawerTopFlush ? 0 : numShelves
  if (drawerTopFlush && numShelves > 0) {
    cfg.numShelves = 0
    cfg.specAdjustments = [...(cfg.specAdjustments || []), {
      code: 'SHELVES_OMITTED_DRAWERS_FILL', severity: 'info', field: 'numShelves',
      requested: numShelves, applied: 0, params: { requested: numShelves },
      message: `Las gavetas ocupan todo el frente: se omitieron ${numShelves} estante(s) y el separador (no hay vano).`
    }]
  }
  const shelfSpacing = shelvesToBuild > 0 ? Math.floor(shelfZoneH / (shelvesToBuild + 1)) : 0

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
    shelfCompartments.push({ center: W / 2, span: internalWidth - PV })
  }

  for (let i = 0; i < shelvesToBuild; i++) {
    const yPos = shelfYStart + (i + 1) * shelfSpacing
    if (yPos > shelfYStart && yPos < shelfZoneTop) {
      const technicalDepth = (hasDoors ? (internalDepth - 20) : internalDepth) - 2*MOLD
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
    const totalDrawerH = (numDrawers > 0 ? stackMM : 0)
    let divStartY, divHeight
    // ★ ADITIVO 2026-07-19 (nicho): los divisores arrancan sobre el nicho abierto
    const divNicheOffset = ((cfg.nicheHeight || 0) > 0 && hasDoors) ? (cfg.nicheHeight || 0) + T : 0
    if (baseMixed) {
      // Vano de puertas = bajo la SEP: de la base hasta la cara inferior de la SEP
      divStartY = BH3 + T + divNicheOffset
      divHeight = baseMixedZoneTop - divStartY
    } else if (numDrawers > 0) {
      divStartY = BH3 + T + totalDrawerH + T + divNicheOffset
      divHeight = H - divStartY - T
    } else {
      divStartY = BH3 + T + divNicheOffset
      divHeight = structuralHeight - 2 * T - divNicheOffset
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

  // ★ ADITIVO 2026-07-19 (work item nicho): nicheHeight > 0 reserva un nicho ABIERTO
  //   bajo las puertas (ref. gabinete c/nicho inferior). Se genera una repisa fija de
  //   cierre del nicho (PRAT-NICHO) sobre la que arrancan las puertas. Default 0 →
  //   comportamiento byte-idéntico al histórico.
  let nicheH = Math.max(0, cfg.nicheHeight || 0)  // desk nunca llega aquí (rama propia)
  // ★ TRANSPARENCIA 2026-07-19: si el nicho no deja sitio para puertas (mín. 150mm),
  //   se recorta y se REGISTRA — el motor nunca altera el pedido en silencio.
  if (hasDoors && nicheH > 0) {
    const drawersH = (numDrawers > 0 ? (baseMixed ? (H - drawerYStart + 3 - T) : stackMM) : 0)
    const availForNiche = H - BH3 - drawersH - (isBase ? T : 0) - T - 151  // 151: el guard de puertas exige doorH > 150 estricto
    if (nicheH > availForNiche) {
      const applied = Math.max(0, Math.floor(availForNiche))
      cfg.specAdjustments = cfg.specAdjustments || []
      cfg.specAdjustments.push({
        code: 'NICHE_HEIGHT_ADJUSTED', severity: 'warning', field: 'nicheHeight',
        requested: nicheH, applied,
        message: `Nicho de ${nicheH}mm no deja altura mínima de puerta (150mm): ajustado a ${applied}mm.`
      })
      nicheH = applied
      cfg.nicheHeight = applied
    }
  }
  if (hasDoors && nicheH > 0) {
    const nicheTopY = BH3 + (numDrawers > 0 && !baseMixed ? stackMM : 0) + nicheH
    pieces.push(makePiece(
      nextId('PRAT-NICHO'), 'Repisa Cierre Nicho', 'repisa',
      internalWidth - 2, internalDepth, T, 1,
      W/2, nicheTopY + T/2, internalDepth/2 + BT, 'horizontal', { front: true },
      'Cierre superior del nicho abierto — fija, soporta las puertas'
    ))
  }

  // ★ ADITIVO 2026-10-12 — MÓDULO DE HORNO: puerta falsa sobrepuesta (panel fijo) +
  //   repisa estructural. Reemplaza las puertas operables; la profundidad de carcasa
  //   sigue siendo D−T (overlay), igual que con puertas reales.
  const ovenMode = !!cfg.ovenPanel && !isAereo && hasDoors
  if (hasDoors && !ovenMode) {
    // ★ ADITIVO 2026-10: Soporte para puertas de correr
    if (cfg.doorType === 'sliding') {
      const slidingResult = calculateSlidingDoors(cfg, D, CD, T, BT, internalWidth, internalDepth, H, hasDoors, nextId)
      pieces.push(...slidingResult.pieces)
      
      // Avisar si hay restricciones
      for (const warning of slidingResult.warnings) {
        if (warning.severity === 'error') {
          cfg.specAdjustments = cfg.specAdjustments || []
          cfg.specAdjustments.push(warning)
        }
      }
    } else {
      // Lógica original: puertas sobrepuestas (hinged)
      // ★ FIX 2026-10-15: en clóset `totalDrawerH` eran MILÍMETROS (bloque + base + SEP); antes era
      //   el CONTEO de gavetas (4 → 4mm) y las puertas medían casi la altura total, pisando
      //   gavetas y SEP. Fuera de clóset se conserva el valor histórico (conteo).
      //   Base MIXTO: bloque arriba → consume (H − drawerYStart + 3 de junta) desde el techo; se resta T
      //   porque doorHNominal ya descuenta T en módulos base. La hoja nace en el piso (doorLift = 0).
      const totalDrawerH = (numDrawers > 0)
        ? (baseMixed ? (H - drawerYStart + 3 - T) : (closetStack ? stackMM + 2*T : drawerRows))
        : 0
      const doorLift = baseMixed ? 0 : totalDrawerH
      const nicheOffset = nicheH > 0 ? nicheH + T : 0
      
      // ★ ADITIVO 2026-10-11: puxadorCavaAereo en módulos aéreos
      //   Extensión de puertas 30mm hacia abajo (overhang) + tamponado inferior retranqueado
      const puxadorOverhang = aereoCava ? aereoCava.overhang : 0
      // ★ ADITIVO 2026-10-12 (R3) — plinthReveal: la puerta nace 3mm por encima del rodapié
      //   (regla de taller del 12-oct). Opt-in: activo si el usuario lo pide o si lleva cava45
      //   (en cocinas premium el rodapié SIEMPRE queda visible). Default 0 → cero regresión.
      const plinthReveal = (isBase && BH3 > 0 && (cfg.plinthVisible === true || cfg.puxadorCava45))
        ? (cfg.plinthReveal > 0 ? cfg.plinthReveal : 3) : 0
      const doorHNominal = H - BH3 - plinthReveal - totalDrawerH - (isBase ? T : 0) - nicheOffset + puxadorOverhang
      // ★ ADITIVO 2026-10-12 — cava 45° en módulo bajo: altoHoja = altoNominal − 30mm.
      const cavaBase = (isBase && cfg.puxadorCava45)
        ? FurnitureMath.carpentry.cavaOffsets({ nominalH: doorHNominal, internalWidth, railHeight: cfg.alturaTraviesaCava })
        : null
      if (cavaBase && cavaBase.adjustments.length) {
        cfg.specAdjustments = [...(cfg.specAdjustments || []), ...cavaBase.adjustments]
      }
      const doorH = cavaBase ? cavaBase.leafH : doorHNominal
      // Aéreo con cava: altoHoja = H_carcasa + voladizo − 3mm (la puerta nace bajo la base).
      const aereoLeafH = aereoCava
        ? FurnitureMath.carpentry.aereoCavaDoor({ carcassH: H - BH3 - totalDrawerH - nicheOffset, bottomTamponado: cfg.tamponadoInferior !== false, overhangOverride: cfg.cavaOverhang }).leafH
        : null
      if (doorH > 150) {
        const n = Math.min(4, Math.max(1, numDoors || 1))
        const leafW = (W / n) - HARDWARE.DOOR_GAP_W
        const doorY = aereoLeafH !== null
          ? (BH3 + totalDrawerH + nicheOffset - puxadorOverhang + aereoLeafH/2)
          : (BH3 + plinthReveal + doorLift + nicheOffset + doorH/2 - (plinthReveal > 0 ? HARDWARE.DOOR_GAP_H/2 : 0))
        const leafPieceH = aereoLeafH !== null ? aereoLeafH : (doorH - HARDWARE.DOOR_GAP_H)

        for (let i = 0; i < n; i++) {
          const xPos = (W/n)/2 + i*(W/n)
          pieces.push(makePiece(
            nextId('PORTA'), `Puerta ${i + 1}`, 'standard_door',
            leafW, leafPieceH, T, 1,
            xPos, doorY, CD + T/2,   // cara frontal en CD+T: con overlay = D exacto; en legacy = D+T
            'vertical', { all: true }, 'Bisagra Reforzada', 'standard_door'
          ))
        }

        // ★ ADITIVO 2026-10-12 — TRAVIESA_RESPALDO_CAVA: cierre tras la luz de agarre de 30mm
        //   (alto ≥ 50mm, largo = vano interior). Si ya hay travesaños de amarre superiores
        //   (encimera / topTieRails) el frontal cumple esa función → no se duplica.
        if (cavaBase && !useTieRails) {
          const railTopY = H - T   // cara inferior del techo
          const railPiece = makePiece(
            nextId('TRAV-CAVA'), 'Traviesa Respaldo Cava 45°', 'travesano',
            cavaBase.rail.width, cavaBase.rail.height, T, 1,
            W/2, FurnitureMath.carpentry.railCenterY(railTopY, cavaBase.rail.height), CD - T/2,
            'horizontal', { front: true },
            'Cierre visual y anti-polvo tras la luz de cava (30mm bajo el tampo)', 'travesano'
          )
          pieces.push({ ...railPiece, role: 'TRAVIESA_RESPALDO_CAVA' })
        } else if (cavaBase && useTieRails) {
          // El travesaño frontal superior (≥50mm) ya cierra la luz de cava: se etiqueta, no se duplica.
          const frontTie = pieces.find(pc => typeof pc.id === 'string' && pc.id.startsWith('TRAV-F'))
          if (frontTie && frontTie.height >= cavaBase.rail.height) {
            frontTie.role = 'TRAVIESA_RESPALDO_CAVA'
            frontTie.notes = 'Refuerzo Estructural + cierre tras la luz de cava (30mm bajo el tampo)'
          }
        }
        
        // ★ ADITIVO 2026-10-11: Tamponado inferior aéreo (cierre visual + retranqueo Z)
        //   Se genera cuando isAereo && puxadorCavaAereo, para cerrar visualmente
        //   el espacio bajo la extensión de las puertas (30mm overhang).
        if (aereoCava && cfg.tamponadoInferior !== false) {
          const tamponRetranqueo = cfg.tamponadoInferiorRetranqueo || 25  // retranqueado en Z
          pieces.push(makePiece(
            nextId('TAMPON-INF-AERO'), 'Tamponado Inferior Aéreo', 'tampon_bottom',
            internalWidth - 2, internalDepth - tamponRetranqueo, cfg.tamponadoThickness || T, 1,
            W/2, Math.max((cfg.tamponadoThickness || T) / 2, BH3 + doorLift + nicheOffset + (puxadorOverhang - tamponRetranqueo) / 2), 
            internalDepth/2 + BT - tamponRetranqueo/2,
            'horizontal', { front: true },
            'Cierre visual inferior — retranqueado 25mm en profundidad'
          ))
        }
      }
    }
  }

  // ── ADITIVO 2026-10-12: MÓDULO DE HORNO — repisa estructural + puerta falsa sobrepuesta.
  if (ovenMode) {
    const lay = FurnitureMath.carpentry.ovenLayout({
      // ★ 2026-10-12 FIX: el nicho se mide contra la cara INFERIOR de la estructura superior
      //   (travesaño de amarre tieH, o techo T), no contra H: con travesaños de 70mm el hueco real
      //   quedaba en 530 en vez de los 600 comerciales.
      ceilingY: useTieRails ? H - tieH : H - T, floorY: BH3 + T, baseY: BH3,
      thickness: T, width: W, panelVistaThickness: PV, ovenNiche: cfg.ovenNicheHeight,
    })
    cfg.specAdjustments = [...(cfg.specAdjustments || []), ...lay.adjustments]
    if (lay.ok) {
      // Hueco comercial europeo: el horno estándar pide ≥560mm libres de ancho (nicho de 600).
      const clearW = Math.round(internalWidth - PV)
      cfg.specAdjustments.push(clearW >= 560
        ? { code: 'OVEN_NICHE_WIDTH', severity: 'info', field: 'width', clearWidth: clearW,
            message: `Ancho libre del nicho: ${clearW}mm (horno estándar 560–600mm: entra con holgura lateral).` }
        : { code: 'OVEN_NARROW', severity: 'warning', field: 'width', clearWidth: clearW,
            message: `El ancho libre (${clearW}mm) es menor que el nicho comercial de 560mm: el horno no entra. Aumentá el ancho del módulo.` })
      pieces.push(makePiece(
        nextId('REPISA-HORNO'), 'Repisa Estructural Horno', 'repisa',
        internalWidth - 2 - PV, internalDepth, T, 1,
        W/2, lay.shelf.centerY, internalDepth/2 + BT, 'horizontal', { front: true },
        `Soporta el horno — fija, estructural. Nicho libre ${cfg.ovenNicheHeight || FurnitureMath.carpentry.OVEN_NICHE_HEIGHT}mm sobre la repisa`
      ))
      pieces.push(makePiece(
        nextId('PORTA-FALSA'), 'Puerta Falsa (panel fijo sobrepuesto)', 'standard_door',
        lay.falseDoor.width, lay.falseDoor.height, T, 1,
        W/2, lay.falseDoor.centerY, CD + T/2,
        'vertical', { all: true }, 'PANEL FIJO — sin bisagras, sin apertura. Fijar con escuadras interiores', 'standard_door'
      ))
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
    // ★ SSOT 2026-07-22: el BOM calculaba su propia corredera (cap 500, paso 50)
    //   divergiendo del despiece. Ahora usa EXACTAMENTE el mismo despeje + catálogo.
    const slideLen = pickSlideDepth(depth - drawerDepthClearance(cfg.thickness || 18, cfg.backThickness || 6, cfg.backStyle, cfg.grooveDepth))
    if (slideLen > 0) {
      bom.push({ type: 'Corredica Telescopica', description: 'Par de corredicas ' + slideLen + 'mm', quantity: numDrawers * 2, unit: 'par' })
    }
  }

  // ★ RULES 2026-07-22 — fijación (ortogonal a la geometría, jamás toca Nw):
  if (cfg.fijacion === 'minifix') {
    bom.push({ type: 'Minifix', description: 'Excentrico 15mm + perno', quantity: ((numShelves || 0) + 2) * 4, unit: 'un' })
  } else if (cfg.fijacion === 'espiga') {
    bom.push({ type: 'Espiga', description: 'Espiga de madera 8x30mm', quantity: ((numShelves || 0) + 2) * 6, unit: 'un' })
  }

  if (numShelves > 0) {
    bom.push({ type: 'Pino para Prateleira', description: 'Pino metalico o5mm', quantity: numShelves * 4, unit: 'un' })
  }

  if (hasDoors && cfg.ovenPanel && cfg.moduleType !== 'aereo') {
    bom.push({ type: 'Escuadra', description: 'Escuadra de fijación interior para puerta falsa (panel fijo)', quantity: 4, unit: 'un' })
  } else if (hasDoors && doorType === 'hinged') {
    // ★ AUDIT FIX 2026-07-19 (aditivo-compatible): antes ignoraba cfg.numDoors
    // (ceil(width/600) daba 2 dobradiças para 2 puertas). Regla de taller:
    // puerta ≤900mm → 2 bisagras · ≤1600 → 3 · >1600 → 4. Fallback al cálculo
    // histórico si numDoors no viene.
    const nDoors = (cfg.numDoors && cfg.numDoors > 0) ? cfg.numDoors : Math.ceil(cfg.width / 600)
    const doorH = (cfg.height || 720)
      - ((cfg.baseboard && cfg.moduleType !== 'aereo') ? (cfg.baseboardHeight || BASEBOARD.DEFAULT_HEIGHT) : 0)
      - ((cfg.numDrawers || 0) > 0 ? (cfg.numDrawers * (cfg.drawerHeight || 180)) : 0)
    const perDoor = doorH > 1600 ? 4 : doorH > 900 ? 3 : 2
    bom.push({ type: 'Dobradica', description: 'Dobradica clip 35mm 110°', quantity: nDoors * perDoor, unit: 'un' })
  }

  if (hasDoors && doorType === 'sliding') {
    const nSheets = Math.max(1, Math.min(4, cfg.slidingDoorSheets || 2))
    const internalW = (cfg.width || 600) - 2 * (cfg.thickness || 18)
    bom.push(
      { type: 'Riel Corredor Inferior', description: `Riel Aluminio duplo 50mm x ${Math.round(internalW)}mm`, quantity: 1, unit: 'un' },
      { type: 'Riel Corredor Superior', description: `Riel Aluminio duplo 50mm x ${Math.round(internalW)}mm`, quantity: 1, unit: 'un' },
      { type: 'Carro Corredor', description: 'Carro deslizante com rolamentos ABEC-9 (kit superior + inferior)', quantity: nSheets * 2, unit: 'un' },
      { type: 'Tope Lateral Riel', description: 'Tope de goma para fin de carrera (par)', quantity: 2, unit: 'par' }
    )
    if (cfg.puxadorCava45) {
      bom.push({ type: 'Usinagem CNC', description: `Mecanizado Cava 45° (bisel + labio 3mm) — ${nSheets} hojas`, quantity: nSheets, unit: 'un' })
    }
  }

  bom.push({ type: 'Parafuso Confirmat', description: 'Confirmat o7x50mm fixacao estrutural', quantity: 24, unit: 'un' })

  // Defensa en profundidad: aéreo NUNCA lleva patas, aunque baseType llegara 'legs'.
  if (cfg.baseType === 'legs' && cfg.moduleType !== 'aereo') {
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
          // ★ 2026-07-26: params para i18n en presentación (message intacto, es el fallback).
          params: {
            count: group.oversizedPieces.length,
            thickness: group.thickness,
            plateW: MATERIAL.PLATE_WIDTH,
            plateH: MATERIAL.PLATE_HEIGHT,
            pieceList: group.oversizedPieces.map(p => p.id).join(', '),
          },
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
          // ★ 2026-07-26: params para i18n en presentación (message intacto, es el fallback).
          params: {
            pieceList: group.splitPieces.join(', '),
            plateW: MATERIAL.PLATE_WIDTH,
            plateH: MATERIAL.PLATE_HEIGHT,
          },
          message: `El fondo (${group.splitPieces.join(', ')}) no cabe entero en la chapa ` +
                   `${MATERIAL.PLATE_WIDTH}×${MATERIAL.PLATE_HEIGHT}mm: se cortará en 2 partes ` +
                   `para unir con regla de MDF. El material ya está contabilizado.`,
          pieces: group.splitPieces
        })
      }
    }

    // ★ SSOT 2026-07-20: geometría REAL de la caja de gaveta, DERIVADA de las piezas
    //   ya generadas (la lista de corte es la fuente autoritativa — es lo que se
    //   fabrica). Se publica en el payload para que Viewer3D la CONSUMA en vez de
    //   recalcularla por su cuenta. Antes el visor usaba `iD − 4`, divergiendo ~18mm
    //   del despiece y llegando a ENMASCARAR geometría imposible.
    //   `null` = el motor decidió que la caja NO es fabricable (sin corredera que quepa).
    const _gavLat   = pieces.find(p => p.type === 'drawer_box' && /GAV-LAT/.test(p.id))
    const _gavFundo = pieces.find(p => p.type === 'drawer_bottom')
    const drawerBoxSpec = _gavLat ? {
      depth:         _gavLat.width,      // profundidad = largo de la corredera comercial
      height:        _gavLat.height,
      outerWidth:    _gavFundo ? _gavFundo.width : null,
      wallThickness: _gavLat.thickness,
    } : null

    return {
      success:     true,
      specAdjustments,
      hasSpecAdjustments: specAdjustments.length > 0,
      drawerBox:   drawerBoxSpec,
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
      details: err.message,
      code: err.code || 'ENGINE_ERROR',
      statusCode: err.statusCode || 500
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

// ─── Preset Library & Load Validation ───────────────────────────────────────
const PRESETS = {
  kitchen_cabinet: { moduleType: 'base', width: 600, height: 870, depth: 580, thickness: 18, backThickness: 6, numShelves: 1, numDrawers: 0, numDividers: 0, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: true, baseboardHeight: 100, hasCountertop: true, handleType: 'gola' },
  kitchen_island:  { moduleType: 'base', width: 900, height: 870, depth: 650, thickness: 18, backThickness: 6, numShelves: 1, numDrawers: 2, numDividers: 0, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: true, baseboardHeight: 100, hasCountertop: true, drawerLayout: 'vertical', drawerHeight: 180, handleType: 'gola' },
  wardrobe:        { moduleType: 'standard', width: 1200, height: 2200, depth: 580, thickness: 18, backThickness: 6, numShelves: 3, numDrawers: 2, numDividers: 0, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: true, baseboardHeight: 100, drawerLayout: 'vertical', drawerHeight: 180, handleType: 'standard' },
  pantry:          { moduleType: 'standard', width: 800, height: 2200, depth: 500, thickness: 18, backThickness: 6, numShelves: 4, numDrawers: 0, numDividers: 0, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: true, baseboardHeight: 100, handleType: 'standard' },
  vanity:          { moduleType: 'base', width: 800, height: 850, depth: 500, thickness: 18, backThickness: 6, numShelves: 0, numDrawers: 2, numDividers: 0, hasDoors: false, baseboard: true, baseboardHeight: 100, hasCountertop: true, drawerLayout: 'vertical', drawerHeight: 200, handleType: 'push' },
  office_credenza: { moduleType: 'base', width: 1200, height: 750, depth: 450, thickness: 18, backThickness: 6, numShelves: 1, numDrawers: 2, numDividers: 1, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: true, baseboardHeight: 100, hasCountertop: true, drawerLayout: 'right', drawerHeight: 180, handleType: 'standard' },
  wall_unit:       { moduleType: 'aereo', width: 800, height: 700, depth: 350, thickness: 18, backThickness: 6, numShelves: 2, numDrawers: 0, numDividers: 0, hasDoors: true, numDoors: 2, doorType: 'hinged', baseboard: false, baseboardHeight: 0, hasCountertop: false, handleType: 'push' },
  desk:            { moduleType: 'desk', width: 1200, height: 750, depth: 600, thickness: 18, backThickness: 6, pedestalWidth: 400, numDrawers: 3, numShelves: 0, numDividers: 0, hasDoors: false, baseboard: false, baseboardHeight: 0, hasCountertop: false, handleType: 'standard' }
}

function loadPreset(presetName, overrides = {}) {
  const preset = PRESETS[presetName]
  if (!preset) {
    console.error(`[loadPreset] Error: El preset "${presetName}" no existe en la biblioteca.`)
    const err = new Error(`PRESET_NOT_FOUND: El preset "${presetName}" no existe.`)
    err.code = 'STRUCTURAL_FAIL_BAD_INPUT'
    err.statusCode = 400
    throw err
  }

  const merged = { ...DEFAULTS, ...preset, ...overrides }

  try {
    validateStructuralDimensions(merged)
  } catch (err) {
    console.error(`[loadPreset] Error de validación estructural en preset "${presetName}":`, err.message)
    throw err
  }

  return generateProject(merged)
}

module.exports = {
  generateProject,
  generateProjectAutoSplit,
  generateFurniture,
  generateCutList,
  estimateNesting,
  generateHardwareBOM,
  loadPreset,
  PRESETS
}
