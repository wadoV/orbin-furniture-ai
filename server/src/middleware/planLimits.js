/**
 * Orbin AI — Gate de Plan / Entitlements de IA  (ADITIVO 2026-08-02)
 * ═════════════════════════════════════════════════════════════════════════════
 * Cierra P5: hasta hoy `req.user.plan` se consultaba en UN SOLO lugar de todo el
 * backend (projects.js:47). Los endpoints que queman tokens no miraban el plan:
 * un usuario `free` autenticado tenía IA ilimitada, acotada apenas por un
 * rate-limit de 15 req/min POR IP — que es defensa contra abuso, no un
 * entitlement (castiga a una oficina detrás de un NAT y se esquiva rotando IP).
 *
 * REGLA DE NEGOCIO
 *   free              → 5 llamadas de IA por día (UTC)
 *   pro / enterprise  → ilimitado
 *
 * ── DOS DECISIONES QUE PARECEN DETALLE Y NO LO SON ──────────────────────────
 *
 * 1) SÓLO SE COBRA LO QUE REALMENTE CONSUME IA.
 *    Auditando las rutas antes de escribir esto apareció que:
 *      · `design.js POST /parse` usa `parseNaturalLanguage` — regex LOCAL, sin IA.
 *      · `design.js POST /generate` sólo llama al modelo si viene `naturalLanguage`;
 *        con `params` es motor paramétrico puro, gratis de correr.
 *      · `chat.js POST /design` en Fase 2 (`confirmFlow` + `action:'confirm'`) es
 *        DETERMINISTA y stateless: no toca ningún proveedor.
 *    Cobrarle cuota a esas tres sería vender humo: el usuario `free` no tendría
 *    "5 generaciones con IA por día" sino "5 diseños por día en total", incluidos
 *    los que no te cuestan un centavo. Por eso el gate acepta un predicado
 *    `when(req)` y sólo descuenta cuando de verdad va a haber una llamada al
 *    modelo.
 *
 * 2) SI EL CONTADOR NO ESTÁ DISPONIBLE, SE DEJA PASAR (fail-open) Y SE LOGUEA.
 *    Es una cuota comercial, no un control de seguridad. Si Supabase se cae y
 *    esto fuera fail-closed, la caída bloquearía también a los que PAGAN — se
 *    convertiría en un interruptor de apagado del producto entero por un
 *    problema de facturación. El plan sí es fail-closed, pero eso ya lo resuelve
 *    `requireAuth` leyendo `app_metadata` del JWT verificado: durante una caída
 *    del contador un `free` NO puede volverse `pro`, sólo gastar de más.
 *    Se pierde margen por un rato; no se pierden clientes.
 *
 * FORMATO DE ERROR — respeta el CONTRATO DE i18n de CLAUDE.md:
 *   el servidor emite `code` estable + texto en español; el cliente traduce por
 *   código (`client/src/engine/apiErrors.js`). Poner un token de máquina dentro
 *   de `error` haría que un usuario PT/EN leyera "PLAN_LIMIT_REACHED" en pantalla.
 */

// ─── Reglas por plan ─────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  free:       { aiCallsPerDay: 5 },
  pro:        { aiCallsPerDay: Infinity },
  enterprise: { aiCallsPerDay: Infinity },
}

/** Plan desconocido → se trata como `free`. Fail-closed en entitlements. */
function limitFor(plan) {
  const rule = PLAN_LIMITS[String(plan || 'free').toLowerCase()]
  return rule ? rule.aiCallsPerDay : PLAN_LIMITS.free.aiCallsPerDay
}

/** Clave de día en UTC (YYYY-MM-DD). Ver nota de huso horario en la migración. */
function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** Próxima medianoche UTC en ISO — el front lo usa para decir "volvés a las X". */
function nextResetISO(now = new Date()) {
  const d = new Date(now)
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString()
}

// ─── Almacén del contador ────────────────────────────────────────────────────
// Interfaz mínima: `increment(userId, day, feature) → Promise<number>` (conteo
// YA incluida esta llamada). Inyectable para tests; en producción, Supabase.

let _store = null
let _supabaseStore = null

/** Store real: RPC atómico `increment_ai_usage` vía service_role. */
function getSupabaseStore() {
  if (_supabaseStore) return _supabaseStore
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const { createClient } = require('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    _supabaseStore = {
      async increment(userId, day, feature) {
        const { data, error } = await admin.rpc('increment_ai_usage', {
          p_user_id: userId, p_day: day, p_feature: feature || null,
        })
        if (error) throw new Error(error.message)
        return Number(data)
      },
    }
    return _supabaseStore
  } catch (err) {
    console.error('[planLimits] No se pudo inicializar el store de cuota:', err.message)
    return null
  }
}

/** Inyección para tests. `null` restaura el store real. */
function setUsageStore(store) { _store = store }

function activeStore() { return _store || getSupabaseStore() }

// ─── Respuesta 403 ───────────────────────────────────────────────────────────
// Superset compatible: `code` traducible (contrato i18n) + `action` legible por
// máquina + los números que el front necesita para pintar el muro sin re-consultar.
function limitReachedPayload({ plan, limit, used }) {
  return {
    success: false,
    error: `Alcanzaste el límite de ${limit} generaciones con IA por día del plan gratuito. Actualizá a Pro para uso ilimitado.`,
    code: 'PLAN_LIMIT_REACHED',
    action: 'UPGRADE_REQUIRED',
    plan,
    limit,
    used,
    resetAt: nextResetISO(),
  }
}

/**
 * Middleware factory.
 *
 * @param {string} feature  Etiqueta del consumo (queda en `ai_usage.last_feature`).
 * @param {object} [opts]
 * @param {(req) => boolean} [opts.when]  Predicado: si devuelve false, la petición
 *        NO consume cuota y pasa directo. Se usa para no cobrar por caminos que
 *        no llaman a ningún proveedor de IA (ver nota 1 de la cabecera).
 * @returns {import('express').RequestHandler}
 */
function checkPlanLimit(feature, { when } = {}) {
  return async function planLimitGate(req, res, next) {
    try {
      // ¿Esta petición concreta va a gastar IA?
      if (typeof when === 'function') {
        let consumes
        try {
          consumes = when(req)
        } catch (err) {
          // Un predicado que revienta no debe tumbar la petición: se cobra por
          // defecto (conservador) y se deja rastro.
          console.error(`[planLimits] predicado when() falló en ${feature}:`, err.message)
          consumes = true
        }
        if (!consumes) return next()
      }

      const plan = req.user?.plan || 'free'
      const limit = limitFor(plan)

      // Planes pagos: ni se consulta el store.
      if (limit === Infinity) return next()

      const userId = req.user?.id
      if (!userId) {
        // requireAuth garantiza identidad antes de este middleware. Si no hay id,
        // el orden de middlewares está mal montado: es un bug, no un usuario.
        console.error(`[planLimits] ${feature}: sin req.user.id — ¿checkPlanLimit montado antes que requireAuth?`)
        return next()
      }

      const store = activeStore()
      if (!store) {
        console.warn(`[planLimits] ${feature}: sin store de cuota — se deja pasar (fail-open). Revisá SUPABASE_SERVICE_KEY.`)
        return next()
      }

      let used
      try {
        used = await store.increment(userId, dayKey(), feature)
      } catch (err) {
        // Fail-open deliberado. Ver nota 2 de la cabecera.
        console.error(`[planLimits] ${feature}: el contador falló, se deja pasar (fail-open):`, err.message)
        return next()
      }

      if (used > limit) {
        return res.status(403).json(limitReachedPayload({ plan, limit, used }))
      }

      // Rastro para el front: cuánto queda sin tener que pedirlo aparte.
      res.setHeader('X-Orbin-Plan', plan)
      res.setHeader('X-Orbin-AI-Limit', String(limit))
      res.setHeader('X-Orbin-AI-Used', String(used))

      req.planUsage = { plan, limit, used, remaining: Math.max(0, limit - used) }
      return next()
    } catch (err) {
      // Ningún fallo del gate puede tumbar una ruta de producto.
      console.error(`[planLimits] error inesperado en ${feature}:`, err.message)
      return next()
    }
  }
}

module.exports = {
  checkPlanLimit,
  setUsageStore,
  PLAN_LIMITS,
  limitFor,
  dayKey,
  nextResetISO,
  limitReachedPayload,
}
