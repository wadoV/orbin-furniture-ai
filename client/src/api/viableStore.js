/**
 * Orbin AI — Viable Designs Store (persistencia resiliente de la Biblioteca Verificada).
 * ─────────────────────────────────────────────────────────────────────────────
 * Fuente única que usan el visor 3D (guardar) y la Galería (listar/eliminar).
 *
 * ★ 2026-10-10 — RESILIENCIA DE PILOTO. El backend /save-viable exige Supabase y
 *   devuelve 503 si no está (fallback en memoria omitido a propósito). Para el piloto
 *   de taller eso es frágil: una demo no puede depender de Supabase remoto. Igual que
 *   auth.js ya hace ("Supabase caído no debe expulsar al taller"), acá:
 *     · DEMO_MODE → localStorage es la fuente de verdad (offline-first, sin 503).
 *     · Producción → API server (Supabase), con fallback a localStorage ante fallo de
 *       transporte (503/red). NUNCA se hace fallback ante NOT_VIABLE (400): la
 *       viabilidad la decide el guard; un diseño rechazado no se guarda en ningún lado.
 *
 * La forma de cada registro espeja la fila que devuelve GET /designs/viable, para que
 * GalleryCatalog renderice sin ramas especiales:
 *   { id, design_name, module_type, category, parametric_json, engine_version, created_at }
 */
import { api } from './client.js'
import { DEMO_MODE } from '../config/demoMode.js'
import { getInitialSeeds } from '../data/seedViableDesigns.js'

const LS_KEY = 'orbin:viableDesigns'
const isLocalId = (id) => typeof id === 'string' && id.startsWith('local:')

// ─────────────────────────────────────────────────────────────────────────────
// ★ DEMO SEED — 3 diseños verificados para que la Galería abra poblada.
//   Se inyectan UNA VEZ si localStorage está vacío. El usuario puede eliminarlos
//   y no vuelven (el flag `orbin:viableSeeded` lo impide).
// ─────────────────────────────────────────────────────────────────────────────
const SEED_FLAG = 'orbin:viableSeeded'
const DISMISSED_SEEDS_FLAG = 'orbin:dismissedSeeds'

// Convertir seedViableDesigns.js a formato viable_designs (con aliases esperados)
function buildDemoSeed() {
  const seeds = getInitialSeeds()
  return Object.freeze(seeds.map(s => ({
    id: s.id,
    design_name: s.nombre,
    module_type: s.parametric_json?.moduleType || 'standard',
    category: s.categoria,
    parametric_json: s.parametric_json,
    engine_version: 'seed-certified-v1',
    created_at: s.createdAt,
    updatedAt: s.updatedAt,
    _local: true,
    _isSeed: true,
    validation: { status: 'VALIDADO', errors: [], specAdjustments: [] },
  })))
}

const DEMO_SEED = buildDemoSeed()

function ensureDemoSeed() {
  try {
    const seeded = localStorage.getItem(SEED_FLAG)
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_SEEDS_FLAG) || '[]')
    const existing = readLocal()
    
    // Si ya hay datos de usuario, marca como sembrado y retorna
    if (existing.length > 0 && !seeded) {
      localStorage.setItem(SEED_FLAG, '1')
      return
    }
    
    // Si ya está marcado como sembrado, solo agrega seeds que no fueron descartadas
    if (seeded) {
      const filtered = DEMO_SEED.filter(s => !dismissed.includes(s.id))
      const current = readLocal()
      const seedIds = new Set(filtered.map(s => s.id))
      const userDesigns = current.filter(d => !d._isSeed)
      const toWrite = [...filtered, ...userDesigns]
      if (toWrite.length > 0 && JSON.stringify(current) !== JSON.stringify(toWrite)) {
        writeLocal(toWrite)
      }
      return
    }
    
    // Primera vez: escribe seeds completos
    writeLocal([...DEMO_SEED])
    localStorage.setItem(SEED_FLAG, '1')
  } catch { /* silencioso: localStorage deshabilitado */ }
}

function markSeedDismissed(seedId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_SEEDS_FLAG) || '[]')
    if (!dismissed.includes(seedId)) {
      dismissed.push(seedId)
      localStorage.setItem(DISMISSED_SEEDS_FLAG, JSON.stringify(dismissed))
    }
  } catch { /* silencioso */ }
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function writeLocal(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); return true } catch { return false }
}

function toLocalRecord({ designName, params, category, moduleType, engineVersion }) {
  return {
    id: `local:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    design_name: designName,
    module_type: moduleType || params?.moduleType || 'standard',
    category: category || null,
    parametric_json: params || {},
    engine_version: engineVersion || null,
    created_at: new Date().toISOString(),
    _local: true,
  }
}

/** Error tipado para distinguir "rechazado por no viable" de un fallo de transporte. */
export class ViabilityError extends Error {
  constructor(message, { blocked = false, code = null } = {}) {
    super(message); this.name = 'ViabilityError'; this.blocked = blocked; this.code = code
  }
}

/**
 * Guarda un diseño verificado. `design` es el módulo completo (lleva configuration).
 * Lanza ViabilityError{blocked:true} si el server lo rechaza por NO VIABLE (no se
 * persiste en ningún lado). Cualquier otro fallo de transporte cae a localStorage.
 * @returns {Promise<object>} registro guardado (forma de fila `viable_designs`).
 */
export async function saveViable({ designName, params, category }) {
  const moduleType = params?.moduleType
  if (DEMO_MODE) {
    const rec = toLocalRecord({ designName, params, category, moduleType })
    const all = readLocal(); all.unshift(rec); writeLocal(all)
    return rec
  }
  try {
    const res = await api.saveViableDesign(designName, params, category || null)
    return res?.saved || res
  } catch (err) {
    // ApiError: `.serverCode` lleva el código de dominio ('NOT_VIABLE'|'BAD_INPUT'|…),
    // `.status` el HTTP. NOT_VIABLE/BAD_INPUT = 400 → decisión del guard: NO persistir.
    const code = err?.serverCode
    if (err?.status === 400 || code === 'NOT_VIABLE' || code === 'BAD_INPUT') {
      throw new ViabilityError(err?.message || 'Diseño no viable', { blocked: true, code })
    }
    // 503 / red / 500 → fallback de transporte a localStorage (demo-resiliencia).
    const rec = toLocalRecord({ designName, params, category, moduleType })
    const all = readLocal(); all.unshift(rec); writeLocal(all)
    return rec
  }
}

/**
 * Lista la biblioteca. DEMO → localStorage. Producción → server + merge con cualquier
 * registro local (fallback) deduplicado, orden descendente por fecha.
 * @returns {Promise<object[]>}
 */
export async function listViable() {
  ensureDemoSeed()  // Siempre garantiza seeds si está vacío (modo y no-modo)
  if (DEMO_MODE) { return readLocal() }
  
  let server = []
  try {
    const res = await api.listViableDesigns()
    server = Array.isArray(res?.designs) ? res.designs : []
  } catch { /* cae a solo-local */ }
  const local = readLocal()
  const seen = new Set(server.map(d => d.id))
  const merged = [...server, ...local.filter(d => !seen.has(d.id))]
  const sorted = merged.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  
  // Si el resultado está vacío, retorna al menos las seeds (fallback absoluto)
  if (sorted.length === 0) {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_SEEDS_FLAG) || '[]')
    return DEMO_SEED.filter(s => !dismissed.includes(s.id))
  }
  return sorted
}

/**
 * Elimina un registro. Los `local:` se purgan de localStorage; los del server pasan por
 * DELETE /designs/viable/:id (y además se limpia cualquier espejo local).
 * @returns {Promise<boolean>}
 */
export async function removeViable(id) {
  // Si es una seed, marcala como descartada
  if (id && id.startsWith('seed:')) {
    markSeedDismissed(id)
  }
  
  if (DEMO_MODE || isLocalId(id)) {
    const all = readLocal().filter(d => d.id !== id)
    writeLocal(all)
    if (!DEMO_MODE && !isLocalId(id)) {
      try { await api.deleteViableDesign(id) } catch { /* best-effort en no-demo */ }
    }
    return true
  }
  await api.deleteViableDesign(id)            // server autoritativo (lanza si falla)
  writeLocal(readLocal().filter(d => d.id !== id))
  return true
}

export default { saveViable, listViable, removeViable, ViabilityError }
