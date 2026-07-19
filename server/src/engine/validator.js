/**
 * Orbin AI - Structural Validator
 * Agent: agentes/structural_validator.md
 * Rules: rules/parametric_constraints.md
 */

const { STRUCTURAL_LIMITS, MATERIAL, HARDWARE } = require('./constants')

function validateDesign(design) {
  const errors   = []
  const warnings = []
  const { configuration: cfg, pieces } = design

  // 0. Hard sanity guards — geometry impossibilities
  if (cfg.thickness === undefined || cfg.thickness === null || isNaN(cfg.thickness)) {
    errors.push('Espesor nao definido ou invalido. Especifique um valor entre 15mm e 25mm.')
    return { status: 'RECHAZADO', errors, warnings, summary: errors.length + ' erro(s) critico(s). Corrija antes de produzir.' }
  }
  if (cfg.thickness <= 0) {
    errors.push('Espesor (' + cfg.thickness + 'mm) invalido — deve ser maior que 0mm. Geometria impossivel.')
    return { status: 'RECHAZADO', errors, warnings, summary: errors.length + ' erro(s) critico(s). Corrija antes de produzir.' }
  }

  // 1. External dimensions
  if (cfg.width > MATERIAL.PLATE_WIDTH) {
    warnings.push(`Largura total (${cfg.width}mm) excede a chapa (${MATERIAL.PLATE_WIDTH}mm). Divida em modulos.`)
  }
  if (cfg.height > STRUCTURAL_LIMITS.MAX_MODULE_HEIGHT) {
    warnings.push(`Altura (${cfg.height}mm) acima de ${STRUCTURAL_LIMITS.MAX_MODULE_HEIGHT}mm recomendado para montagem em obra.`)
  }
  // La regla de profundidad mínima es de mueble BASE. Un aéreo de cocina son
  // 320mm y uno de baño 150mm: avisar ahí era un FALSO POSITIVO que ensuciaba
  // todos los planos de aéreos y restaba credibilidad a los avisos reales.
  if (cfg.moduleType === 'aereo') {
    if (cfg.depth < 100) {
      warnings.push(`Profundidade (${cfg.depth}mm) muito rasa para um aereo. Minimo: 100mm.`)
    }
  } else if (cfg.depth < 300) {
    warnings.push(`Profundidade (${cfg.depth}mm) muito rasa. Minimo recomendado: 400mm.`)
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
          'Painel de fundo (' + piece.width + 'x' + piece.height + 'mm) nao cabe em uma unica chapa. ' +
          'Cortar em 2 partes e unir com regua de MDF.'
        )
      }
      continue
    }

    if (maxDim > MATERIAL.PLATE_WIDTH) {
      errors.push('Peca "' + piece.name + '" (' + maxDim + 'mm) excede o comprimento maximo da chapa (' + MATERIAL.PLATE_WIDTH + 'mm).')
    }
    if (minDim > MATERIAL.PLATE_HEIGHT) {
      errors.push('Peca "' + piece.name + '" (' + minDim + 'mm) excede a largura maxima da chapa (' + MATERIAL.PLATE_HEIGHT + 'mm).')
    }
    if (piece.width <= 0 || piece.height <= 0) {
      errors.push('Peca "' + piece.name + '" tem dimensao invalida (<= 0mm).')
    }
  }

  // 3. Internal width — minimum structural viability
  const internalWidth = cfg.width - 2 * cfg.thickness
  if (internalWidth <= 0) {
    errors.push('Ancho interno (' + internalWidth + 'mm) negativo ou zero. Espessura maior que a metade da largura — geometria impossivel.')
  } else if (internalWidth < 100) {
    errors.push('Ancho interno (' + internalWidth + 'mm) insuficiente. Minimo estrutural: 100mm (largura atual ' + cfg.width + 'mm com espessura ' + cfg.thickness + 'mm).')
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
        'Vao interno (' + effectiveSpan + 'mm' + (nDivs > 0 ? ' por compartimento' : '') + ') supera ' +
        STRUCTURAL_LIMITS.MAX_SHELF_SPAN + 'mm. Adicione um montante central divisorio.'
      )
    } else if (effectiveSpan > 800) {
      warnings.push('Vao interno (' + effectiveSpan + 'mm' + (nDivs > 0 ? ' por compartimento' : '') + ') proximo do limite. Monitore deformacao em prateleiras com carga.')
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
      errors.push('Caixa de gaveta muito estreita (' + boxWidth + 'mm) apos desconto das corredicas. Minimo: 100mm.')
    }
    if (cfg.drawerHeight < 80) {
      errors.push('Altura da gaveta (' + cfg.drawerHeight + 'mm) muito pequena. Minimo: 80mm.')
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
    const availableHeight = cfg.height - (cfg.baseboard ? (cfg.baseboardHeight || 100) : 0) - (2 * cfg.thickness)
    if (drawerStack > availableHeight) {
      errors.push(
        'Pilha de gavetas (' + drawersPerCol + ' × ' + slotHeight + 'mm c/folga = ' + drawerStack + 'mm) ' +
        'excede a altura interna util (' + availableHeight + 'mm).'
      )
    } else if (drawerStack > availableHeight * 0.85 && (cfg.numShelves > 0 || cfg.numDividers > 0)) {
      // El usuario pidió estantes/divisores ADEMÁS de gavetas, pero la pila los
      // deja sin espacio → error de diseño real.
      errors.push(
        'Pilha de gavetas (' + drawerStack + 'mm) ocupa ' +
        Math.round(drawerStack/availableHeight*100) + '% da altura interna — sem espaco para estantes ou separador.'
      )
    } else if (drawerStack > availableHeight * 0.85) {
      // [2026-07] Cômoda pura (numShelves === 0, sem divisores): llenar 85-100%
      // con gavetas ES el diseño buscado. Que quepa físicamente ya lo garantiza
      // el `if` inicial (drawerStack > availableHeight) → aviso, no rechazo.
      warnings.push(
        'Pilha de gavetas ocupa ' + Math.round(drawerStack/availableHeight*100) +
        '% da altura interna (cômoda de gavetas — sem estantes).'
      )
    } else if (drawerStack > availableHeight * 0.7) {
      warnings.push('Pilha de gavetas (' + drawerStack + 'mm) ocupa mais de 70% da altura interna.')
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
        'Compartimento (' + Math.round(compartmentWidth) + 'mm) muito estreito com ' + cfg.numDividers +
        ' divisores em ' + internalWidth + 'mm interno. Minimo: 150mm por compartimento.'
      )
    } else if (compartmentWidth < 250) {
      warnings.push(
        'Compartimento (' + Math.round(compartmentWidth) + 'mm) estreito. Considere reduzir o numero de divisores.'
      )
    }
  }

  // 5. Baseboard
  if (cfg.baseboard) {
    const bh = cfg.baseboardHeight || 100
    if (bh < STRUCTURAL_LIMITS.BASEBOARD_MIN_HEIGHT) {
      errors.push('Rodape (' + bh + 'mm) abaixo do minimo de ' + STRUCTURAL_LIMITS.BASEBOARD_MIN_HEIGHT + 'mm.')
    }
    if (bh > STRUCTURAL_LIMITS.BASEBOARD_MAX_HEIGHT) {
      warnings.push('Rodape (' + bh + 'mm) acima de ' + STRUCTURAL_LIMITS.BASEBOARD_MAX_HEIGHT + 'mm.')
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
            'COLISION: "' + s.name + '" atravessa "' + d.name + '" (x=' + d.x + ', y=' + s.y + '). ' +
            'Peca horizontal deve ser gerada por compartimento. Design nao montavel.'
          )
        }
      }
    }
  }

  // 6. Material efficiency
  if (design.nesting && design.nesting.length > 0) {
    for (const n of design.nesting) {
      if (n.overallEfficiency < 0.5) {
        warnings.push('Eficiencia baixa (' + Math.round(n.overallEfficiency * 100) + '%) para chapas de ' + n.thickness + 'mm.')
      }
    }
  }

  const status = errors.length > 0 ? 'RECHAZADO' : 'VALIDADO'

  return {
    status,
    errors,
    warnings,
    summary: errors.length > 0
      ? (errors.length + ' erro(s) critico(s). Corrija antes de produzir.')
      : warnings.length > 0
        ? ('Design aprovado com ' + warnings.length + ' aviso(s). Revise antes de cortar.')
        : 'Design estruturalmente valido. Pronto para producao.',
  }
}

module.exports = { validateDesign }
