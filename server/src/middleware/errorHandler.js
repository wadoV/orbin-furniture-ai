/**
 * Orbin AI — Handler global de errores (ADITIVO 2026-10-12)
 * ─────────────────────────────────────────────────────────────────────────────
 * PROBLEMA REAL (reproducido): un body JSON truncado o inválido hace que
 * body-parser lance un SyntaxError con `err.status = 400`. El handler global
 * anterior IGNORABA `err.status` y respondía 500 a todo → el cliente mostraba
 * "El servidor tuvo un problema inesperado" por un error que era del REQUEST.
 *
 * Reglas:
 *   1. Errores del cliente (4xx de body-parser/express) → ese 4xx, JSON estructurado.
 *   2. Rutas de chat (/api/chat, /chat): un fallo inesperado NUNCA es 500. Responde 200
 *      con un payload degradado y vacío-pero-válido (el panel del chat no se rompe).
 *   3. Resto de rutas: comportamiento histórico (DEMO_MODE/dev → 200 degradado;
 *      producción → 500 sin stack trace).
 *   Nunca se filtra `err.message` al cliente (detalle sólo en el log del servidor).
 */

const CLIENT_ERROR_COPY = {
  'entity.parse.failed':   ['BAD_JSON',      'El mensaje llegó incompleto o no es JSON válido. Reenviá la solicitud.'],
  'entity.too.large':      ['PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.'],
  'request.aborted':       ['REQUEST_ABORTED',   'La conexión se cortó antes de recibir el mensaje completo. Reenviá la solicitud.'],
  'request.size.invalid':  ['BAD_REQUEST',   'El tamaño de la solicitud no coincide con su contenido. Reenviá la solicitud.'],
  'encoding.unsupported':  ['BAD_REQUEST',   'Codificación de la solicitud no soportada.'],
  'charset.unsupported':   ['BAD_REQUEST',   'Juego de caracteres de la solicitud no soportado.'],
}

const isChatPath = (req) => /^\/(?:api\/)?chat(?:\/|$)/.test(req.path || req.originalUrl || '')
const isDemo = () => process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'

function degradedPayload() {
  return {
    success: false,
    degraded: true,
    code: 'SERVER_FALLBACK',
    error: 'Procesado con fallback de seguridad. Intentá de nuevo en unos segundos.',
    design: null, modules: [], projects: [], pieces: [],
  }
}

// eslint-disable-next-line no-unused-vars
function apiErrorHandler(err, req, res, _next) {
  console.error('[Server Error Intercepted]', req.method, req.path, err && err.type ? `(${err.type})` : '', err)
  if (res.headersSent) return

  const status = Number.isInteger(err && (err.status || err.statusCode)) ? (err.status || err.statusCode) : 500
  if (status >= 400 && status < 500) {
    const [code, error] = CLIENT_ERROR_COPY[err.type] || ['BAD_REQUEST', 'No pudimos procesar la solicitud.']
    return res.status(status).json({ success: false, code, error })
  }

  if (isChatPath(req) || isDemo()) return res.status(200).json(degradedPayload())
  return res.status(500).json({ success: false, error: 'Error interno del servidor. Intentá de nuevo en unos segundos.' })
}

module.exports = { apiErrorHandler, degradedPayload, isChatPath }
