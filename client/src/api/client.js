/**
 * Orbin AI — API Client v2
 * Adds chat, projects and billing endpoints.
 */
import { supabase } from '../lib/supabase.js'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// FIX #8 (QA 2026-06-26): la UI mostraba texto técnico crudo al usuario
// ("El servidor devolvió una respuesta inválida (HTTP 500). Revisa los logs
// del servidor.", "HTTP 500", etc). Ahora todo error lanzado por `request()`
// tiene un mensaje en español apto para mostrar directo en la UI, y además
// `.code` / `.status` para que el código que llama pueda distinguir casos
// (red caída vs. error de servidor) sin parsear el texto del mensaje.
class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code     // 'NETWORK' | 'SERVER' | 'CLIENT'
    this.status = status // HTTP status, si aplica
  }
}

function friendlyMessageForStatus(status) {
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.'
  if (status === 403) return 'No tenés permiso para realizar esta acción.'
  if (status === 404) return 'No encontramos lo que buscabas.'
  if (status === 429) return 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.'
  if (status >= 500) return 'El servidor tuvo un problema inesperado. Intentá de nuevo en unos segundos.'
  if (status >= 400) return 'No pudimos procesar la solicitud.'
  return 'Ocurrió un error inesperado.'
}

async function request(method, path, body) {
  let res
  try {
    // RECOVERY [2026-06-26]: requireAuth en projects.js/billing.js espera
    // Authorization: Bearer <token>, pero el cliente nunca lo enviaba — en
    // producción (Supabase configurado) esto rompía /projects/* y /billing/checkout
    // con 401 silencioso. Se adjunta el access_token de la sesión activa si existe;
    // no afecta rutas con optionalAuth ni el fallback DEV_USER en local.
    const headers = { 'Content-Type': 'application/json' }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
    } catch {}

    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (networkErr) {
    console.error(`[api] Network error on ${method} ${path}:`, networkErr)
    throw new ApiError('No se puede conectar al servidor. Verificá que el servidor esté activo.', { code: 'NETWORK' })
  }
  let data
  try {
    data = await res.json()
  } catch (parseErr) {
    console.error(`[api] Non-JSON response on ${method} ${path}: HTTP ${res.status} ${res.statusText}`, parseErr)
    throw new ApiError(friendlyMessageForStatus(res.status), { code: 'SERVER', status: res.status })
  }
  if (!res.ok || !data.success) {
    console.error(`[api] Request failed on ${method} ${path}: HTTP ${res.status}`, data)
    // data.error ya viene en español y apto para el usuario (lo garantiza el backend);
    // si no vino, usamos un mensaje genérico en vez de exponer "HTTP 500" crudo.
    throw new ApiError(data?.error || friendlyMessageForStatus(res.status), { code: 'SERVER', status: res.status })
  }
  return data
}

export const api = {
  // Design engine
  generateDesign: (payload)  => request('POST', '/design/generate', payload),
  parseNL:        (text)     => request('POST', '/design/parse', { text }),
  getDefaults:    ()         => request('GET',  '/design/defaults'),
  health:         ()         => request('GET',  '/health'),

  // Chat (AI-powered design)
  chatDesign:     (message, sessionId) => request('POST', '/chat/design', { message, sessionId }),
  chatParse:      (text)     => request('POST', '/chat/parse', { text }),

  // Projects (persistence)
  saveProject(design, label) {
    // Check if design is already wrapped in an object or if it's the raw modules/design
    const payload = design.modules ? design : { design };
    return request('POST', '/projects/save', { design: payload, label });
  },
  listProjects:   ()         => request('GET',  '/projects'),
  getProject:     (id)       => request('GET',  `/projects/${id}`),
  deleteProject:  (id)       => request('DELETE', `/projects/${id}`),

  // Billing (checkout real Stripe/MercadoPago)
  createCheckout: (planId, provider, region) => request('POST', '/billing/checkout', { planId, provider, region }),
  // SECURITY [2026-06-27]: el grant de plan (promo code y downgrade) ahora pasa
  // siempre por el server (service_role escribe app_metadata) — ver
  // server/src/routes/billing.js. El cliente ya no puede otorgarse un plan
  // directamente vía supabase.auth.updateUser().
  redeemPromo:    (code)     => request('POST', '/billing/redeem-promo', { code }),
  downgradeFree:  ()         => request('POST', '/billing/downgrade-free'),
  // RECOVERY [2026-06-27] Tarea #5 Layer 3: Stripe Customer Portal real (ver
  // server/src/routes/billing.js POST /billing/portal). Devuelve {success,url}
  // o 400 con mensaje en español si la cuenta no tiene stripe_customer_id
  // (usuarios MP/BR o código promocional — ver SettingsModal en Header.jsx).
  openBillingPortal: ()      => request('POST', '/billing/portal'),

  // Vision (imagen → diseño paramétrico)
  // FIX #8 (QA 2026-06-26): ImageToParametricPanel.jsx llamaba a `api.post(...)`,
  // un método que nunca existió en este cliente → TypeError silencioso, capturado
  // y mal mostrado como "No se pudo conectar con el servidor de IA Visión." La
  // función de Visión por IA estaba 100% rota desde el cliente, no por el backend.
  analyzeSpace: (imageBase64, userPrompt, mimeType) =>
    request('POST', '/vision/analyze-space', { imageBase64, userPrompt, mimeType }),
}
