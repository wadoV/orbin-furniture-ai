/**
 * Orbin AI — Tests de TTLStore (ADITIVO 2026-07-23).
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { TTLStore } = require('./ttlStore')

describe('TTLStore', () => {
  it('get/set/delete básico compatible con Map', () => {
    const s = new TTLStore()
    assert.equal(s.get('a'), undefined)
    s.set('a', 1)
    assert.equal(s.get('a'), 1)
    assert.equal(s.delete('a'), true)
    assert.equal(s.get('a'), undefined)
  })

  it('expira entradas vencidas (TTL)', async () => {
    const s = new TTLStore({ ttlMs: 20 })
    s.set('k', 'v')
    assert.equal(s.get('k'), 'v')
    await new Promise(r => setTimeout(r, 35))
    assert.equal(s.get('k'), undefined, 'debe expirar tras el TTL')
  })

  it('get renueva el TTL (touch)', async () => {
    const s = new TTLStore({ ttlMs: 150 })
    s.set('k', 'v')
    await new Promise(r => setTimeout(r, 60))
    assert.equal(s.get('k'), 'v')          // touch → renueva
    await new Promise(r => setTimeout(r, 100))
    assert.equal(s.get('k'), 'v', 'el touch previo debe haber extendido la vida')
  })

  it('respeta el tope de entradas (evicción LRU del más antiguo)', () => {
    const s = new TTLStore({ ttlMs: 60000, maxEntries: 3 })
    s.set('a', 1); s.set('b', 2); s.set('c', 3)
    s.get('a')                              // 'a' pasa a ser el más reciente
    s.set('d', 4)                           // excede tope → expulsa el más antiguo ('b')
    assert.equal(s.size, 3)
    assert.equal(s.get('b'), undefined, "'b' era el más antiguo tras el touch de 'a'")
    assert.equal(s.get('a'), 1)
    assert.equal(s.get('d'), 4)
  })

  it('size purga vencidos', async () => {
    const s = new TTLStore({ ttlMs: 20 })
    s.set('x', 1); s.set('y', 2)
    await new Promise(r => setTimeout(r, 35))
    assert.equal(s.size, 0)
  })
})
