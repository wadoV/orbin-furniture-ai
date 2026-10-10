/**
 * Orbin AI — Persistencia LOCAL de proyectos (fs) — ADITIVO 2026-10-10
 *
 * POR QUÉ: la demo de taller (y, más adelante, Hermes Agent en la PC de planta) no
 * puede depender de internet ni de Supabase. Cada proyecto guardado se escribe como
 * un archivo JSON en disco, ADEMÁS del memStore y de Supabase (si está configurado).
 * Local-first: el archivo es la copia que sobrevive a un reinicio del server.
 *
 * Garantías:
 *   · Escritura ATÓMICA: tmp + rename → nunca queda un JSON a medio escribir.
 *   · Nombres saneados: `<owner>__<id>.json`, sin path traversal (se verifica que el
 *     path resuelto quede dentro del directorio).
 *   · Determinismo: `contentHash` = sha256 del JSON CANÓNICO (claves ordenadas) de los
 *     módulos. Mismo diseño ⇒ mismo hash, en cualquier máquina. Es la clave que un
 *     árbitro (Hermes) puede usar para saber si lo que se corta es lo que se aprobó.
 *
 * Directorio: ORBIN_LOCAL_STORE_DIR o server/data/approved_projects (gitignored).
 * Desactivable con ORBIN_LOCAL_STORE=false (sin tocar código).
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const SCHEMA = 'orbin.project/v1'

function storeDir() {
  return path.resolve(process.env.ORBIN_LOCAL_STORE_DIR || path.join(__dirname, '..', '..', 'data', 'approved_projects'))
}

function isEnabled() {
  return process.env.ORBIN_LOCAL_STORE !== 'false'
}

function safeSegment(value, fallback) {
  const s = String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 100)
  return s || fallback
}

function fileFor(ownerId, id) {
  const dir = storeDir()
  const file = path.resolve(dir, `${safeSegment(ownerId, 'anon')}__${safeSegment(id, 'sin-id')}.json`)
  if (!file.startsWith(dir + path.sep)) throw new Error('Ruta de proyecto inválida')
  return file
}

/** JSON canónico: claves ordenadas recursivamente → hash estable entre máquinas. */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      if (value[k] !== undefined) acc[k] = canonicalize(value[k])
      return acc
    }, {})
  }
  return value
}

function contentHash(modules) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(modules ?? []))).digest('hex')
}

/** Guarda el registro. Devuelve { file, contentHash }. Lanza si el disco falla. */
function saveProject(record) {
  if (!record || !record.id) throw new Error('El registro necesita "id"')
  const dir = storeDir()
  fs.mkdirSync(dir, { recursive: true })
  const hash = contentHash(record.modules)
  const doc = {
    schema: SCHEMA,
    ...record,
    contentHash: hash,
    savedAt: new Date().toISOString(),
    // Contrato para el árbitro de planta: el diseñador aprobó; producción aún no.
    productionStatus: record.productionStatus || 'pending_arbiter',
  }
  const file = fileFor(record.owner_id, record.id)
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8')
  fs.renameSync(tmp, file) // atómico en el mismo volumen (Windows incluido: reemplaza)
  return { file, contentHash: hash }
}

function readFileSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function getProject(ownerId, id) {
  try { return readFileSafe(fileFor(ownerId, id)) } catch { return null }
}

/** Lista resúmenes {id,label,created_at,savedAt,contentHash}. ownerId null = todos. */
function listProjects(ownerId = null, limit = 50) {
  const dir = storeDir()
  let names = []
  try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json')) } catch { return [] }
  const prefix = ownerId ? `${safeSegment(ownerId, 'anon')}__` : null
  return names
    .filter(n => !prefix || n.startsWith(prefix))
    .map(n => readFileSafe(path.join(dir, n)))
    .filter(Boolean)
    .map(r => ({ id: r.id, label: r.label, created_at: r.created_at, savedAt: r.savedAt, contentHash: r.contentHash }))
    .sort((a, b) => String(b.savedAt || b.created_at).localeCompare(String(a.savedAt || a.created_at)))
    .slice(0, limit)
}

function deleteProject(ownerId, id) {
  try { fs.unlinkSync(fileFor(ownerId, id)); return true } catch { return false }
}

module.exports = { SCHEMA, storeDir, isEnabled, saveProject, getProject, listProjects, deleteProject, contentHash, canonicalize }
