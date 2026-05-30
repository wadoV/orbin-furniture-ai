/**
 * Orbin AI — Cutlist Generator
 * ★ PROTECTED: Industrial CNC Cutlist logic with edgebanding deductions
 */

export function generateFactoryCutlist(rawPieces, options = {}) {
  const edgeThickness = options.edgeThickness || 1 // 1mm default edgebanding

  // Apply industrial logic:
  // 1. Assign edgebanding based on piece type
  // 2. Calculate net dimensions (gross - edgebanding)
  // 3. Ensure Largo >= Ancho (grain direction standard)
  const processedPieces = rawPieces.map(p => {
    let edgeL1 = 0, edgeL2 = 0, edgeA1 = 0, edgeA2 = 0
    let labelL1 = '', labelL2 = '', labelA1 = '', labelA2 = ''

    // Tapacanto (Edgebanding) rules
    if (p.type === 'door' || p.type === 'drawer_front') {
      // All 4 sides
      edgeL1 = edgeL2 = edgeA1 = edgeA2 = edgeThickness
      labelL1 = labelL2 = labelA1 = labelA2 = `${edgeThickness}mm`
    } else if (p.type === 'structural' || p.type === 'shelf') {
      if (!p.name.includes('Back') && !p.name.includes('Fondo')) {
        // Front edge only (typically one long edge)
        edgeL1 = edgeThickness
        labelL1 = `${edgeThickness}mm`
      }
    } else if (p.type === 'drawer_box') {
      // Top edge only
      edgeL1 = edgeThickness
      labelL1 = `${edgeThickness}mm`
    } else if (p.type === 'baseboard') {
      // Top and bottom
      edgeL1 = edgeL2 = edgeThickness
      labelL1 = labelL2 = `${edgeThickness}mm`
    }

    // Ensure Largo is the longest dimension (following grain if applicable)
    const isWLongest = p.w >= p.h
    let largoBruto = isWLongest ? p.w : p.h
    let anchoBruto = isWLongest ? p.h : p.w

    // Align edge deductions based on orientation
    let eL1 = isWLongest ? edgeL1 : edgeA1
    let eL2 = isWLongest ? edgeL2 : edgeA2
    let eA1 = isWLongest ? edgeA1 : edgeL1
    let eA2 = isWLongest ? edgeA2 : edgeL2

    let lL1 = isWLongest ? labelL1 : labelA1
    let lL2 = isWLongest ? labelL2 : labelA2
    let lA1 = isWLongest ? labelA1 : labelL1
    let lA2 = isWLongest ? labelA2 : labelL2

    let netoLargo = largoBruto - eL1 - eL2
    let netoAncho = anchoBruto - eA1 - eA2

    return {
      name: p.name,
      netoLargo: netoLargo.toFixed(1),
      netoAncho: netoAncho.toFixed(1),
      material: p.material || 'MDP',
      L1: lL1,
      L2: lL2,
      A1: lA1,
      A2: lA2,
      signature: `${p.name}_${netoLargo.toFixed(1)}_${netoAncho.toFixed(1)}_${p.material}_${lL1}_${lL2}_${lA1}_${lA2}`
    }
  })

  // Group identical pieces for "Cantidad"
  const grouped = {}
  processedPieces.forEach(p => {
    if (!grouped[p.signature]) {
      grouped[p.signature] = { ...p, quantity: 1 }
    } else {
      grouped[p.signature].quantity++
    }
  })

  // Build CSV content
  const headers = ['Nombre Pieza', 'Cantidad', 'Largo', 'Ancho', 'Material', 'Tapacanto L1', 'Tapacanto L2', 'Tapacanto A1', 'Tapacanto A2']
  let csv = headers.join(',') + '\n'

  Object.values(grouped).forEach(g => {
    const row = [
      `"${g.name}"`,
      g.quantity,
      g.netoLargo,
      g.netoAncho,
      `"${g.material}"`,
      `"${g.L1}"`,
      `"${g.L2}"`,
      `"${g.A1}"`,
      `"${g.A2}"`
    ]
    csv += row.join(',') + '\n'
  })

  // BOM (Byte Order Mark) for Excel UTF-8 compatibility
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
  const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' })

  return {
    blob,
    filename: `orbin-fabrica-cutlist-${Date.now()}.csv`,
    metadata: { pieceCount: processedPieces.length, format: 'CSV Cutlist' }
  }
}
