/**
 * Orbin AI — Diccionario i18n de ERRORES DE API (★ ADITIVO 2026-07-26)
 *
 * Tercer y último subsistema de textos que ve el usuario, después de los nombres de
 * pieza (`pieceNames.js`) y las observaciones del plano (`adjustmentMessages.js`).
 * Misma arquitectura en los tres: el servidor emite un CÓDIGO estable + un texto en
 * español; el cliente traduce por código y cae al texto original si no lo conoce.
 *
 * POR QUÉ EXISTE: `server/src/routes/design.js` devuelve
 *   { success:false, error:'Diseño no viable: no se guarda…', code:'NOT_VIABLE' }
 * y `ResultPanel` mostraba `err.message` TAL CUAL — o sea, español a usuarios PT/EN.
 * Peor: `api/client.js` pisaba el código del backend con 'SERVER', así que el cliente
 * ni siquiera podía traducir. Se agregó `serverCode` al ApiError para recuperarlo.
 *
 * REGLA: si agregás un `code:` nuevo a una respuesta de error de `routes/`, agregá acá
 * su entrada. El test `server/src/engine/i18nContract.test.js` lo verifica y falla.
 */

const LANG_IDX = { ES: 0, PT: 1, EN: 2 }
const normLang = (lang) => {
  const k = String(lang || '').trim().toUpperCase().split(/[-_]/)[0]
  return ['ES', 'PT', 'EN'].includes(k) ? k : 'PT'
}

// [ES, PT, EN] — el ES reproduce el texto del backend para que nada cambie en español.
const API_ERROR_MESSAGES = {
  BAD_INPUT: [
    'Nombre de diseño inválido (3–120 caracteres) o payload mal formado.',
    'Nome de projeto inválido (3–120 caracteres) ou payload malformado.',
    'Invalid design name (3–120 characters) or malformed payload.',
  ],
  ENGINE_FAIL: [
    'El motor no pudo generar este diseño. No se guardó.',
    'O motor não conseguiu gerar este projeto. Não foi salvo.',
    'The engine could not generate this design. Nothing was saved.',
  ],
  NOT_VIABLE: [
    'Diseño no viable: no se guarda en la Biblioteca Verificada.',
    'Projeto não viável: não é salvo na Biblioteca Verificada.',
    'Design is not viable: it will not be saved to the Verified Library.',
  ],
  STORAGE_UNAVAILABLE: [
    'El almacenamiento no está disponible en este momento. Intentá de nuevo en unos minutos.',
    'O armazenamento não está disponível no momento. Tente novamente em alguns minutos.',
    'Storage is unavailable right now. Please try again in a few minutes.',
  ],
  // Cuota diaria de IA del plan gratuito (server/src/middleware/planLimits.js).
  // La respuesta 403 trae además `limit`, `used` y `resetAt`: si el front quiere
  // decir "5 de 5, volvés a las 21:00", tiene los datos sin re-consultar.
  PLAN_LIMIT_REACHED: [
    'Alcanzaste el límite de generaciones con IA por día del plan gratuito. Actualizá a Pro para uso ilimitado.',
    'Você atingiu o limite de gerações com IA por dia do plano gratuito. Faça upgrade para o Pro e use sem limites.',
    'You have reached the free plan’s daily AI generation limit. Upgrade to Pro for unlimited use.',
  ],
  // Errores de transporte que genera el propio cliente (no llevan código de dominio).
  NETWORK: [
    'No se puede conectar al servidor. Verificá que el servidor esté activo.',
    'Não foi possível conectar ao servidor. Verifique se o servidor está ativo.',
    'Cannot reach the server. Check that the server is running.',
  ],
}

/**
 * Traduce un error de API. `err` puede ser un ApiError (con `serverCode`) o cualquier
 * objeto con `{ serverCode | code, message }`.
 * FALLBACK: si el código es desconocido, devuelve `err.message` intacto. Un error en
 * español es aceptable; un error vacío deja al usuario sin saber qué pasó.
 */
export function localizeApiError(err, lang) {
  const fallback = (err && err.message) ? String(err.message) : ''
  if (!err) return fallback
  const code = err.serverCode || (err.code !== 'SERVER' ? err.code : null)
  if (!code) return fallback
  const entry = API_ERROR_MESSAGES[code]
  if (!entry) return fallback
  const out = entry[LANG_IDX[normLang(lang)]]
  return (out && out.trim()) ? out : fallback
}

/** Códigos cubiertos — lo usa el contrato de i18n. */
export function knownApiErrorCodes() {
  return Object.keys(API_ERROR_MESSAGES)
}

// ─────────────────────────────────────────────────────────────────────────────
// COPY DEL MURO DE UPGRADE  (★ ADITIVO 2026-08-02 · bucle 006)
//
// POR QUÉ EXISTE: el cableado del 403 (commit a152af8) escribió la copia del modal
// como prosa en español DENTRO del JSX —`App.jsx`, `ImageToParametricPanel.jsx` y
// `UpgradePrompt.jsx`— en vez de traducir por código. El idioma por defecto de la app
// es **PT** (`PreferencesContext.jsx:5`, mercado primario Brasil), así que un usuario
// brasileño que agotaba la cuota veía un modal MEZCLADO: título y cuerpo en español,
// párrafo de fallback en portugués. Y eso ocurre exactamente en la pantalla de mayor
// intención de compra de todo el producto.
//
// `i18nContract.test.js` no lo detectó y no era su culpa: escanea `routes/` y
// `middleware/` buscando `code:` sin traducción. Prosa hardcodeada en JSX del cliente
// queda fuera de su radar. El candado de esa superficie es `planLimitCopy.test.js`.
//
// Mismo patrón que `adjustmentMessages.js`: plantillas [ES, PT, EN] con interpolación
// de `{placeholders}` y fallback que devuelve la plantilla ES antes que una cadena vacía.
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_LIMIT_COPY = {
  // Título del modal cuando el 403 es por cuota agotada (no por feature bloqueada).
  PLAN_LIMIT_TITLE: [
    'Alcanzaste tu límite diario',
    'Você atingiu seu limite diário',
    'You have reached your daily limit',
  ],
  // Cuerpo. {used} y {limit} vienen del 403; no se re-consulta nada.
  PLAN_LIMIT_BODY: [
    'Usaste {used}/{limit} solicitudes de IA de hoy en el plan Gratuito.',
    'Você usou {used}/{limit} solicitações de IA de hoje no plano Gratuito.',
    'You have used {used}/{limit} of today’s AI requests on the Free plan.',
  ],
  // Línea de reinicio. {time} ya viene formateado y CON su zona por `formatResetAt()`.
  PLAN_LIMIT_RESET: [
    'Tu cuota se reinicia a las {time}.',
    'Sua cota é renovada às {time}.',
    'Your quota resets at {time}.',
  ],
  // Etiquetas de la superficie que disparó el muro. Las emite el llamador como CÓDIGO,
  // nunca como texto: `setPlanAlert({ featureCode: 'FEATURE_AI_GENERATION' })`.
  FEATURE_AI_GENERATION: [
    'Generación con IA',
    'Geração com IA',
    'AI generation',
  ],
  FEATURE_AI_CHAT: [
    'Chat con IA',
    'Chat com IA',
    'AI chat',
  ],
  FEATURE_AI_VISION: [
    'IA Visión',
    'IA Visão',
    'AI Vision',
  ],
}

/**
 * Traduce una clave de copy del muro de upgrade, interpolando `{params}`.
 *
 * FALLBACK EN CASCADA (nunca devuelve vacío: un modal sin texto es peor que uno en
 * el idioma equivocado): idioma pedido → ES → la clave cruda.
 * Un placeholder sin valor se deja literal `{como_vino}` para que la falta se VEA
 * en pantalla y en los tests, en vez de imprimir "undefined" o desaparecer.
 */
export function localizePlanLimit(key, lang, params = {}) {
  const entry = PLAN_LIMIT_COPY[key]
  if (!entry) return String(key)
  const template = entry[LANG_IDX[normLang(lang)]] || entry[LANG_IDX.ES] || String(key)
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined || params[name] === null ? match : String(params[name])
  ))
}

/**
 * Formatea `resetAt` (ISO, UTC) para mostrarlo.
 *
 * ★ El cableado original imprimía `toLocaleTimeString()` —hora LOCAL del navegador—
 * y le pegaba la etiqueta fija "UTC" al lado. Un usuario en UTC-3 leía "18:00 UTC"
 * cuando el reinicio real era a las 21:00 UTC. El número y la etiqueta se
 * contradecían. Se muestra la hora LOCAL con el nombre de SU zona: es la que el
 * usuario puede usar para decidir si espera o paga.
 */
export function formatResetAt(resetAt, lang) {
  if (!resetAt) return null
  const d = new Date(resetAt)
  if (Number.isNaN(d.getTime())) return null
  const locale = { ES: 'es', PT: 'pt-BR', EN: 'en' }[normLang(lang)]
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    }).format(d)
  } catch {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
}

/** Claves cubiertas — lo usa `planLimitCopy.test.js`. */
export function knownPlanLimitKeys() {
  return Object.keys(PLAN_LIMIT_COPY)
}

/**
 * Detecta el 403 de cuota y arma el objeto de `planAlert`. Devuelve `null` si el
 * error es cualquier otra cosa, para que el llamador siga su camino normal.
 *
 * Existe para que la detección viva en UN solo lugar: el cableado original repetía
 * la misma condición y el mismo objeto en tres archivos, y cada copia era una
 * oportunidad de que una se quedara atrás. NO arma texto: sólo transporta el CÓDIGO
 * de la superficie (`featureCode`) y los datos crudos del 403. La traducción ocurre
 * en el componente, que es el único que sabe el idioma vigente.
 *
 * Acepta `serverCode` (ApiError) o `details.code` (respuesta cruda): las dos formas
 * existen en el código y no vale la pena unificarlas desde acá.
 */
export function planAlertFrom(err, featureCode) {
  if (!err) return null
  const code = err.serverCode || err.details?.code
  if (err.status !== 403 || code !== 'PLAN_LIMIT_REACHED') return null
  const d = err.details || {}
  return {
    code: 'PLAN_LIMIT_REACHED',
    featureCode,
    plan: d.plan,
    used: d.used,
    limit: d.limit,
    resetAt: d.resetAt,
    // Fallback del contrato: el español del backend, intacto, por si el modal no
    // reconociera el código. Nunca se muestra si la traducción existe.
    message: err.message || null,
  }
}

export default localizeApiError
