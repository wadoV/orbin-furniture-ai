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

export default localizeApiError
