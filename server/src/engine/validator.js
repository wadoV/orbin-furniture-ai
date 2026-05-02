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

    // Fundo pode ser unido em 2 partes - apenas aviso
    if (piece.name && piece.name.toLowerCase().includes('fundo')) {
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

  // 3. Shelf span
  const internalWidth = cfg.width - 2 * cfg.thickness
  if (internalWidth > STRUCTURAL_LIMITS.MAX_SHELF_SPAN) {
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
    const drawerStack = drawersPerCol * cfg.drawerHeight
    const availableHeight = cfg.height - (cfg.baseboard ? (cfg.baseboardHeight || 100) : 0) - (2 * cfg.thickness)
    if (drawerStack > availableHeight * 0.9) {
      errors.push('Pilha de gavetas (' + drawerStack + 'mm) excede a altura interna util.')
    } else if (drawerStack > availableHeight * 0.7) {
      warnings.push('Pilha de gavetas (' + drawerStack + 'mm) ocupa mais de 70% da altura interna.')
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
