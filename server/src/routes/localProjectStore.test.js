/**
 * Candado: persistencia local de proyectos (server/src/storage/localProjectStore.js)
 * + integración real del router /api/projects SIN Supabase (modo planta / demo).
 * Usa un directorio temporal: nunca toca server/data del usuario.
 */
'use strict'
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orbin-store-'))
process.env.ORBIN_LOCAL_STORE_DIR = TMP
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_ANON_KEY
delete process.env.SUPABASE_SERVICE_ROLE_KEY
delete process.env.SUPABASE_SERVICE_KEY

const store = require('../storage/localProjectStore')

describe('localProjectStore — disco', () => {
  it('escribe atómicamente y relee el mismo registro', () => {
    const rec = { id: 'PRJ-1', owner_id: 'taller', label: 'L', modules: [{ id: 'm', configuration: { width: 800 } }], created_at: 'x' }
    const { file, contentHash } = store.saveProject(rec)
    assert.ok(fs.existsSync(file))
    assert.equal(fs.readdirSync(TMP).filter(n => n.endsWith('.tmp')).length, 0, 'no quedan temporales')
    const back = store.getProject('taller', 'PRJ-1')
    assert.equal(back.schema, 'orbin.project/v1')
    assert.equal(back.contentHash, contentHash)
    assert.equal(back.productionStatus, 'pending_arbiter')
    assert.deepEqual(back.modules, rec.modules)
  })

  it('contentHash es determinista e independiente del orden de claves', () => {
    const a = store.contentHash([{ id: 'm', configuration: { width: 800, height: 2100 } }])
    const b = store.contentHash([{ configuration: { height: 2100, width: 800 }, id: 'm' }])
    const c = store.contentHash([{ id: 'm', configuration: { width: 801, height: 2100 } }])
    assert.equal(a, b)
    assert.notEqual(a, c)
  })

  it('bloquea path traversal en owner/id', () => {
    store.saveProject({ id: '../../evil', owner_id: '../..', modules: [] })
    const inside = fs.readdirSync(TMP)
    assert.ok(inside.some(n => n.includes('evil')), 'el archivo queda DENTRO del directorio')
    assert.equal(fs.existsSync(path.join(TMP, '..', '..', 'evil.json')), false)
  })

  it('lista y borra', () => {
    assert.ok(store.listProjects('taller').some(p => p.id === 'PRJ-1'))
    assert.equal(store.deleteProject('taller', 'PRJ-1'), true)
    assert.equal(store.getProject('taller', 'PRJ-1'), null)
  })
})

describe('POST/GET /api/projects sin Supabase → 200 + archivo en disco', () => {
  let server, base
  before(async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEMO_MODE = 'true'
    const express = require('express')
    const app = express()
    app.use(express.json())
    app.use('/api/projects', require('./projects'))
    await new Promise(r => { server = app.listen(0, r) })
    base = `http://127.0.0.1:${server.address().port}/api/projects`
  })
  after(() => { server?.close(); fs.rmSync(TMP, { recursive: true, force: true }) })

  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer demo-local-token' }

  it('guarda en disco y responde 200 con storage=local', async () => {
    const design = { id: 'PRJ-DEMO', modules: [{ id: 'mod-base-demo', configuration: { width: 800, height: 2100, depth: 550 }, pieces: [{ name: 'Lateral', width: 550, height: 2100 }] }] }
    const r = await fetch(`${base}/save`, { method: 'POST', headers: H, body: JSON.stringify({ design, label: 'Demo' }) })
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.equal(j.success, true)
    assert.equal(j.storage, 'local')
    assert.match(j.local.file, /^dev-local-user__PRJ-DEMO\.json$/)
    assert.match(j.local.contentHash, /^[a-f0-9]{64}$/)
    const onDisk = JSON.parse(fs.readFileSync(path.join(TMP, j.local.file), 'utf8'))
    assert.deepEqual(onDisk.modules, design.modules)
  })

  it('GET /:id lo recupera desde disco aunque la memoria esté vacía (reinicio)', async () => {
    fs.writeFileSync(path.join(TMP, 'dev-local-user__PRJ-DISK.json'), JSON.stringify({ id: 'PRJ-DISK', label: 'solo disco', modules: [], created_at: '2026-10-10T00:00:00Z' }))
    const r = await fetch(`${base}/PRJ-DISK`, { headers: H })
    assert.equal(r.status, 200)
    const j = await r.json()
    assert.equal(j.success, true)
    assert.equal(j.label, 'solo disco')
    const list = await (await fetch(base, { headers: H })).json()
    assert.ok(list.projects.some(p => p.id === 'PRJ-DISK'))
  })
})
