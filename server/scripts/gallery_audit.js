#!/usr/bin/env node
/**
 * Auditoría de SOLO LECTURA de la Biblioteca Verificada (viable_designs).
 * ─────────────────────────────────────────────────────────────────────────
 * Por cada fila: regenera el diseño con el motor desde parametric_json (payload
 * replayable), lo valida con validator.js y aplica una prueba de coherencia
 * (puertas pedidas vs. hojas generadas). Compara el veredicto con el `status`
 * guardado y reporta discrepancias. NO escribe en la base.
 *
 * Uso:  node scripts/gallery_audit.js            (texto)
 *       node scripts/gallery_audit.js --json     (JSON)
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno o en server/.env
 */
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }) } catch (_) {}

const { generateProject } = require('../src/engine/closetEngine')
const { validateDesign } = require('../src/engine/validator')

const COHERENCE = (cfg, pieces) => {
  const warnings = []
  const doors = pieces.filter(p => p.type === 'standard_door')
  const wantDoors = Number(cfg.numDoors || 0)
  if (cfg.hasDoors && cfg.doorType === 'hinged' && !cfg.ovenPanel && wantDoors > 0 && doors.length !== wantDoors) {
    warnings.push(`coherencia: pediste ${wantDoors} puertas abatibles, el motor generó ${doors.length}`)
  }
  if (cfg.hasDoors === false && doors.length > 0) {
    warnings.push(`coherencia: hasDoors=false pero hay ${doors.length} pieza(s) de puerta`)
  }
  return warnings
}

function verdict(row) {
  const cfg = row.parametric_json || {}
  let generated
  try {
    generated = generateProject(cfg)
  } catch (err) {
    return { id: row.id, name: row.design_name, stored: row.status, verdict: 'RECHAZADO', reasons: [`motor lanzó: ${err.message}`] }
  }
  if (!generated || !generated.success) {
    return { id: row.id, name: row.design_name, stored: row.status, verdict: 'RECHAZADO', reasons: ['motor no generó el diseño'] }
  }
  const v = validateDesign(generated)
  const critical = (generated.specAdjustments || []).filter(a => a && a.severity === 'critical')
  const reasons = [...v.errors.map(e => String(e)), ...critical.map(a => `ajuste crítico: ${a.message || a.code || 'sin detalle'}`)]
  const warnings = [...(v.warnings || []).map(w => String(w)), ...COHERENCE(generated.configuration || cfg, generated.pieces || [])]
  const ok = v.status === 'VALIDADO' && reasons.length === 0
  return { id: row.id, name: row.design_name, stored: row.status, verdict: ok ? 'VALIDADO' : 'RECHAZADO', reasons, warnings }
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY.')
    process.exit(2)
  }
  const { createClient } = require('@supabase/supabase-js')
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await sb
    .from('viable_designs')
    .select('id, design_name, parametric_json, status, created_at')
    .order('created_at', { ascending: false })
  if (error) { console.error('Error leyendo viable_designs:', error.message); process.exit(1) }

  const results = (data || []).map(verdict)
  const mismatches = results.filter(r => r.stored === 'validated' && r.verdict !== 'VALIDADO')
  const asJson = process.argv.includes('--json')
  if (asJson) {
    console.log(JSON.stringify({ total: results.length, mismatches: mismatches.length, results }, null, 2))
  } else {
    for (const r of results) {
      console.log(`${r.verdict === 'VALIDADO' ? 'OK ' : 'XX '} [${r.stored}] ${r.id}  ${r.name}`)
      for (const x of r.reasons || []) console.log(`      error: ${x}`)
      for (const x of r.warnings || []) console.log(`      aviso: ${x}`)
    }
    console.log(`\nTotal: ${results.length} · discrepancias (guardado validated, auditoría no): ${mismatches.length}`)
  }
  process.exit(mismatches.length > 0 ? 3 : 0)
}

if (require.main === module) main()
module.exports = { verdict, COHERENCE }
