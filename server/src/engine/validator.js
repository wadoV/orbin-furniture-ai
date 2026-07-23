/**
 * Orbin AI - Structural Validator
 * Agent: agentes/structural_validator.md
 * Rules: rules/parametric_constraints.md
 */

const { STRUCTURAL_LIMITS, MATERIAL, HARDWARE, BASEBOARD } = require('./constants')

function validateDesign(design) {
  const errors   = []
  const warnings = []
  const { configuration: cfg, pieces } = design

  // 0. Hard sanity guards — geometry impossibilities
  if (cfg.thickness === undefined || cfg.thickness === null || isNaN(cfg.thickness)) {
    errors.push('Espesor no definido o inválido. Especifique un valor entre 15mm y 25mm.')
    return { status: 'RECHAZADO', errors, warnings, summary: errors.length + ' error(es) crítico(s). Corrija antes de producir.' }
  }
  if (cfg.thickness <= 0) {
    errors.push('Espesor (' + cfg.thickness + 'mm) inválido — debe ser mayor que 0mm. Geometría imposible.')
    return { status: 'RECHAZADO', errors, warnings, summary: errors.length + ' error(es) crítico(s). Corrija antes de producir.' }
  }

  // 1. External dimensions
  if (cfg.width > MATERIAL.PLATE_WIDTH) {
    warnings.push(`Ancho total (${cfg.width}mm) excede la placa (${MATERIAL.PLATE_WIDTH}mm). Dividí en módulos.`)
  }
  if (cfg.height > STRUCTURAL_LIMITS.MAX_MODULE_HEIGHT) {
    warnings.push(`Altura (${cfg.height}mm) por encima de ${STRUCTURAL_LIMITS.MAX_MODULE_HEIGHT}mm recomendado para montaje en obra.`)
  }
  // La regla de profundidad mínima es de mueble BASE. Un aéreo de cocina son
  // 320mm y uno de baño 150mm: avisar ahí era un FALSO POSITIVO que ensuciaba
  // todos los planos de aéreos y restaba credibilidad a los avisos reales.
  if (cfg.moduleType === 'aereo') {
    if (cfg.depth < 100) {
      warnings.push(`Profundidad (${cfg.depth}mm) muy escasa para un aéreo. Mínimo: 100mm.`)
    }
  } else if (cfg.depth < 300) {
    warnings.push(`Profundidad (${cfg.depth}mm) muy escasa. Mínimo recomendado: 400mm.`)
  }

  // 2. Individual piece size
  for (const piece of pieces) {
    const maxDim = Math.max(piece.width, piece.height)
    const minDim = Math.min(piece.width, piece.height)

    // Fundo/Fondo pode ser unido em 2 partes - apenas aviso
    // BUG FIX: engine uses Spanish "Fondo", validator was only checking Portuguese "fundo"
    const pieceLower = piece.name ? piece.name.toLowerCase() : ''
    if (pieceLower.includes('fundo') || pieceLower.includes('fondo')) {
      if (maxDim > MATERIAL.PLATE_WIDTH || minDim > MATERIAL.PLATE_HEIGHT) {
        warnings.push(
          'Panel de fondo (' + piece.width + 'x' + piece.height + 'mm) no cabe en una sola placa. ' +
          'Cortar en 2 partes y unir con regla de MDF.'
        )
      }
      continue
    }

    if (maxDim > MATERIAL.PLATE_WIDTH) {
      errors.push('Pieza "' + piece.name + '" (' + maxDim + 'mm) excede el largo máximo de la placa (' + MATERIAL.PLATE_WIDTH + 'mm).')
    }
    if (minDim > MATERIAL.PLATE_HEIGHT) {
      errors.push('Pieza "' + piece.name + '" (' + minDim + 'mm) excede el ancho máximo de la placa (' + MATERIAL.PLATE_HEIGHT + 'mm).')
    }
    if (piece.width <= 0 || piece.height <= 0) {
      errors.push('Pieza "' + piece.name + '" tiene dimensión inválida (<= 0mm).')
    }
  }

  // 3. Internal width — minimum structural viability
  const internalWidth = cfg.width - 2 * cfg.thickness
  if (internalWidth <= 0) {
    errors.push('Ancho interno (' + internalWidth + 'mm) negativo o cero. Espesor mayor que la mitad del ancho — geometría imposible.')
  } else if (internalWidth < 100) {
    errors.push('Ancho interno (' + internalWidth + 'mm) insuficiente. Mínimo estructural: 100mm (ancho actual ' + cfg.width + 'mm con espesor ' + cfg.thickness + 'mm).')
  } else {
    // ADITIVO 2026-07-19: el vao efectivo descuenta los divisores (cada montante
    // central divide la luz). Antes un modulo de 1600mm con 2 divisores (vaos
    // reales de ~509mm) recibia un falso "supera 900mm". Con numDividers=0 el
    // comportamiento y los mensajes son identicos a los historicos.
    const nDivs = cfg.numDividers || 0
    // ADITIVO 2026-07-19: en 'desk' el vano central es espacio de piernas por diseño
    // (sin estantes cargados); el tampo de 25mm apoya en 3 puntos (2 laterales + pedestal).
    const isDeskKneeSpace = cfg.moduleType === 'desk'
    // ADITIVO 2026-07-19: 2 columnas de gavetas llevan montante central (DIV-GAV,
    // generado por el engine) → el vao efectivo del tampo/base se reduce a la mitad.
    // ADITIVO 2026-07-19: drawerColumns (N columnas) genera cols−1 montantes DIV-GAV
    const dCols = (cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4 && (cfg.numDrawers || 0) > 1)
      ? Math.floor(cfg.drawerColumns)
      : ((cfg.drawerLayout === 'horizontal' && (cfg.numDrawers || 0) > 1) ? 2 : 1)
    let effectiveSpan = isDeskKneeSpace ? 0 : (nDivs > 0
      ? Math.round((internalWidth - nDivs * cfg.thickness) / (nDivs + 1))
      : internalWidth)
    if (dCols > 1) effectiveSpan = Math.min(effectiveSpan, Math.round((internalWidth - (dCols - 1) * cfg.thickness) / dCols))
    if (effectiveSpan > STRUCTURAL_LIMITS.MAX_SHELF_SPAN) {
      warnings.push(
        'Vano interno (' + effectiveSpan + 'mm' + (nDivs > 0 ? ' por compartimento' : '') + ') supera ' +
        STRUCTURAL_LIMITS.MAX_SHELF_SPAN + 'mm. Agregue un montante central divisorio.'
      )
    } else if (effectiveSpan > 800) {
      warnings.push('Vano interno (' + effectiveSpan + 'mm' + (nDivs > 0 ? ' por compartimento' : '') + ') próximo al límite. Monitore deformación en estantes con carga.')
    }
  }

  // 4. Drawers
  // ADITIVO 2026-07-19: en 'desk' las gavetas viven en el pedestal (pedestalWidth),
  // no en el ancho interno total; el engine ya hace auto-fit de la pila.
  const drawerZoneWidth = cfg.moduleType === 'desk'
    ? (cfg.pedestalWidth || 400) - 2 * cfg.thickness
    : internalWidth
  if (cfg.numDrawers > 0) {
    const boxWidth = drawerZoneWidth - HARDWARE.DRAWER_SLIDE_TOTAL  // 13mm per side × 2
    if (boxWidth < 100) {
      errors.push('Cajón muy estrecho (' + boxWidth + 'mm) tras descuento de las correderas. Mínimo: 100mm.')
    }
    if (cfg.drawerHeight < 80) {
      errors.push('Altura del cajón (' + cfg.drawerHeight + 'mm) muy pequeña. Mínimo: 80mm.')
    }
    // ★ FIX 2026-07-20 (auditoría estructural): faltaba por completo la regla de
    //   PROFUNDIDAD. El motor emitia cajas de 250mm en muebles de 150mm de fondo
    //   y esto se daba por VALIDADO. Por debajo de 250mm de fondo util no existe
    //   corredica telescopica comercial → gaveta no fabricable.
    const usableDepth = cfg.depth - (cfg.backThickness || 6) - HARDWARE.DRAWER_BOX_REAR_GAP
    if (usableDepth < HARDWARE.SLIDE_LENGTH_MIN) {
      errors.push(
        'Profundidad útil (' + usableDepth + 'mm) insuficiente para corredera telescópica comercial ' +
        '(mínima: ' + HARDWARE.SLIDE_LENGTH_MIN + 'mm). Aumente la profundidad a >=' +
        (HARDWARE.SLIDE_LENGTH_MIN + (cfg.backThickness || 6) + HARDWARE.DRAWER_BOX_REAR_GAP) +
        'mm o remueva los cajones.'
      )
    }
    // ADITIVO 2026-07-19: drawerColumns también aplica al cálculo de pila
    const vCols = (cfg.drawerColumns >= 2 && cfg.drawerColumns <= 4) ? Math.floor(cfg.drawerColumns) : null
    const isHorizontal = (cfg.drawerLayout === 'horizontal' && cfg.numDrawers > 1) || (vCols !== null && cfg.numDrawers > 1)
    const cols = (vCols !== null && cfg.numDrawers > 1) ? vCols : (isHorizontal ? 2 : 1)
    const drawersPerCol = Math.ceil(cfg.numDrawers / cols)
    // BUG FIX: Each drawer needs its nominal height PLUS top clearance for the slide
    // mechanism (DRAWER_TOP_CLEARANCE = 16mm). Without this, 20×100mm drawers in
    // a 2264mm cabinet appeared valid (2000 < 2037 threshold) but physically don't fit
    // when slide clearance is added (20 × 116mm = 2320mm > 2264mm → STRUCTURAL_FAIL).
    const slotHeight = cfg.drawerHeight + STRUCTURAL_LIMITS.DRAWER_TOP_CLEARANCE
    const drawerStack = drawersPerCol * slotHeight
    const availableHeight = cfg.height - (cfg.baseboard ? (cfg.baseboardHeight || BASEBOARD.DEFAULT_HEIGHT) : 0) - (2 * cfg.thickness)
    if (drawerStack > availableHeight) {
      errors.push(
        'Cajones acumulados (' + drawersPerCol + ' × ' + slotHeight + 'mm c/holgura = ' + drawerStack + 'mm) ' +
        'excede la altura interna útil (' + availableHeight + 'mm).'
      )
    } else if (drawerStack > availableHeight * 0.85 && (cfg.numShelves > 0 || cfg.numDividers > 0)) {
      // El usuario pidió estantes/divisores ADEMÁS de gavetas, pero la pila los
      // deja sin espacio → error de diseño real.
      errors.push(
        'Cajones acumulados (' + drawerStack + 'mm) ocupa ' +
        Math.round(drawerStack/availableHeight*100) + '% de la altura interna — sin espacio para estantes o separador.'
      )
    } else if (drawerStack > availableHeight * 0.85) {
      // [2026-07] Cômoda pura (numShelves === 0, sem divisores): llenar 85-100%
      // con gavetas ES el diseño buscado. Que quepa físicamente ya lo garantiza
      // el `if` inicial (drawerStack > availableHeight) → aviso, no rechazo.
      warnings.push(
        'Cajones acumulados ocupa ' + Math.round(drawerStack/availableHeight*100) +
        '% de la altura interna (cómoda de cajones — sin estantes).'
      )
    } else if (drawerStack > availableHeight * 0.7) {
      warnings.push('Cajones acumulados (' + drawerStack + 'mm) ocupa más del 70% de la altura interna.')
    }
  }

  // 4c. Drawer Top Covering Rule
  if (cfg.numDrawers > 0 && cfg.topShelf !== true) {
    cfg.topShelf = true;
    warnings.push('Repisa superior de cierre forzada (DRAWER TOP COVERING RULE) para proteger estructura.');
  }

  // 4b. Dividers — compartment width minimum
  if (cfg.numDividers > 0 && internalWidth > 0) {
    const compartmentWidth = internalWidth / (cfg.numDividers + 1)
    if (compartmentWidth < 150) {
      errors.push(
        'Compartimento (' + Math.round(compartmentWidth) + 'mm) muy estrecho con ' + cfg.numDividers +
        ' divisores en ' + internalWidth + 'mm interno. Mínimo: 150mm por compartimento.'
      )
    } else if (compartmentWidth < 250) {
      warnings.push(
        'Compartimento (' + Math.round(compartmentWidth) + 'mm) estrecho. Considere reducir el número de divisores.'
      )
    }
  }

  // 5. Baseboard
  if (cfg.baseboard) {
    const bh = cfg.baseboardHeight || BASEBOARD.DEFAULT_HEIGHT
    if (bh < STRUCTURAL_LIMITS.BASEBOARD_MIN_HEIGHT) {
      errors.push('Zócalo (' + bh + 'mm) debajo del mínimo de ' + STRUCTURAL_LIMITS.BASEBOARD_MIN_HEIGHT + 'mm.')
    }
    if (bh > STRUCTURAL_LIMITS.BASEBOARD_MAX_HEIGHT) {
      warnings.push('Zócalo (' + bh + 'mm) por encima de ' + STRUCTURAL_LIMITS.BASEBOARD_MAX_HEIGHT + 'mm.')
    }
  }

  // 5b. ADITIVO 2026-07-19 — Deteccion de colisiones geometricas entre piezas
  // estructurales (divisores vs estantes/separadores). El caso que motiva esto:
  // el engine generaba estantes de ancho completo atravesando divisores y este
  // validador lo aprobaba. Interseccion AABB en los ejes X (ancho) e Y (altura).
  if (pieces && pieces.length > 1) {
    const dividers = pieces.filter(p => p.type === 'divider')
    const horizontals = pieces.filter(p => p.type === 'repisa' || p.type === 'shelf')
    for (const d of dividers) {
      for (const s of horizontals) {
        const sHalfW = Math.max(s.width, s.height) / 2
        const dHalfH = d.height / 2
        const overlapX = Math.abs((d.x || 0) - (s.x || 0)) < (sHalfW - 1)   // -1mm tolerancia
        const overlapY = Math.abs((d.y || 0) - (s.y || 0)) < (dHalfH - 1)
        if (overlapX && overlapY) {
          errors.push(
            'COLISIÓN: "' + s.name + '" atraviesa "' + d.name + '" (x=' + d.x + ', y=' + s.y + '). ' +
            'Pieza horizontal debe ser generada por compartimento. Diseño no armable.'
          )
        }
      }
    }
  }

  // 6. Material efficiency
  if (design.nesting && design.nesting.length > 0) {
    for (const n of design.nesting) {
      if (n.overallEfficiency < 0.5) {
        warnings.push('Eficiencia baja (' + Math.round(n.overallEfficiency * 100) + '%) para placas de ' + n.thickness + 'mm.')
      }
    }
  }

  const status = errors.length > 0 ? 'RECHAZADO' : 'VALIDADO'

  return {
    status,
    errors,
    warnings,
    summary: errors.length > 0
      ? (errors.length + ' error(es) crítico(s). Corrija antes de producir.')
      : warnings.length > 0
        ? ('Diseño aprobado con ' + warnings.length + ' aviso(s). Revise antes de cortar.')
        : 'Diseño estructuralmente válido. Listo para producción.',
  }
}

module.exports = { validateDesign }
