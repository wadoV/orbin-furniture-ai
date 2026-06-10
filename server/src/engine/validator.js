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
  if (cfg.depth < 300) {
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
  } else if (internalWidth > STRUCTURAL_LIMITS.MAX_SHELF_SPAN) {
    warnings.push(
      'Vao interno (' + internalWidth + 'mm) supera ' + STRUCTURAL_LIMITS.MAX_SHELF_SPAN + 'mm. ' +
      'Adicione um montante central divisorio.'
    )
  } else if (internalWidth > 800) {
    warnings.push('Vao interno (' + internalWidth + 'mm) proximo do limite. Monitore deformacao em prateleiras com carga.')
  }

  // 4. Drawers
  if (cfg.numDrawers > 0) {
    const boxWidth = internalWidth - HARDWARE.DRAWER_SLIDE_TOTAL  // 13mm per side × 2
    if (boxWidth < 100) {
      errors.push('Caixa de gaveta muito estreita (' + boxWidth + 'mm) apos desconto das corredicas. Minimo: 100mm.')
    }
    if (cfg.drawerHeight < 80) {
      errors.push('Altura da gaveta (' + cfg.drawerHeight + 'mm) muito pequena. Minimo: 80mm.')
    }
    const isHorizontal = cfg.drawerLayout === 'horizontal' && cfg.numDrawers > 1
    const cols = isHorizontal ? 2 : 1
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
    } else if (drawerStack > availableHeight * 0.85) {
      // Una CÓMODA pura (solo gavetas, sin estantes ni puertas) está pensada para
      // llenar todo el interior: el llenado >85% es correcto, no un defecto.
      const drawerOnly = (cfg.numShelves || 0) === 0 && !cfg.hasDoors
      if (drawerOnly) {
        warnings.push(
          'Cômoda de gavetas: a pilha ocupa ' +
          Math.round(drawerStack/availableHeight*100) + '% da altura interna (preenchimento total, sem estantes).'
        )
      } else {
        errors.push(
          'Pilha de gavetas (' + drawerStack + 'mm) ocupa ' +
          Math.round(drawerStack/availableHeight*100) + '% da altura interna — sem espaco para estantes ou separador.'
        )
      }
    } else if (drawerStack > availableHeight * 0.7) {
      warnings.push('Pilha de gavetas (' + drawerStack + 'mm) ocupa mais de 70% da altura interna.')
    }
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
