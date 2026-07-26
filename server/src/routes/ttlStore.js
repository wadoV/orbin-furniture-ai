/**
 * Orbin AI — TTL Store  (ADITIVO 2026-07-23)
 * ─────────────────────────────────────────────────────────────────────────────
 * Map acotado con expiración por tiempo (TTL) y tope de entradas (evicción LRU).
 * Drop-in para los `new Map()` in-memory de chat.js (sessions, pendingProposals).
 *
 * PROBLEMA QUE RESUELVE (leak real):
 *   Un `Map` de sesiones/propuestas crece sin límite: cada sessionId nuevo deja
 *   una entrada que nunca se libera. En un proceso long-running (Railway) esto es
 *   una fuga de memoria que termina en OOM. TTL purga lo viejo; el cap evita el
 *   crecimiento no acotado ante picos o sessionIds basura.
 *
 * API COMPATIBLE con Map: get / set / delete / size, más get-como-touch (LRU) y
 * barrido perezoso en cada operación (sin timers → no retiene el event loop, no
 * hay que limpiar en tests ni en shutdown).
 */

class TTLStore {
  /**
   * @param {object} [opts]
   * @param {number} [opts.ttlMs=1800000]   vida de cada entrada (default 30 min)
   * @param {number} [opts.maxEntries=1000] tope duro de entradas
   */
  constructor({ ttlMs = 30 * 60 * 1000, maxEntries = 1000 } = {}) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this._m = new Map()   // key -> { value, exp }
  }

  _expired(rec) { return rec.exp <= Date.now() }

  // Purga perezosa: barre entradas vencidas. O(n) sólo en el peor caso; barato
  // frente al costo de un timer permanente.
  _sweep() {
    const now = Date.now()
    for (const [k, rec] of this._m) if (rec.exp <= now) this._m.delete(k)
  }

  get(key) {
    const rec = this._m.get(key)
    if (!rec) return undefined
    if (this._expired(rec)) { this._m.delete(key); return undefined }
    // touch → renueva TTL y reordena como más reciente (LRU real: re-inserción).
    this._m.delete(key)
    rec.exp = Date.now() + this.ttlMs
    this._m.set(key, rec)
    return rec.value
  }

  set(key, value) {
    if (this._m.has(key)) this._m.delete(key)   // reordenar como más reciente
    this._m.set(key, { value, exp: Date.now() + this.ttlMs })
    // Evicción: primero lo vencido; si aún excede, expulsa el más antiguo (LRU).
    if (this._m.size > this.maxEntries) {
      this._sweep()
      while (this._m.size > this.maxEntries) {
        const oldest = this._m.keys().next().value
        this._m.delete(oldest)
      }
    }
    return this
  }

  delete(key) { return this._m.delete(key) }

  get size() {
    this._sweep()
    return this._m.size
  }
}

module.exports = { TTLStore }
