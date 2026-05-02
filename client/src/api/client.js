/**
 * Orbin AI — API Client v2
 * Adds chat and projects endpoints.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(method, path, body) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('No se puede conectar al servidor. Verifica que el servidor esté activo.')
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`El servidor devolvió una respuesta inválida (HTTP ${res.status}). Revisa los logs del servidor.`)
  }
  if (!res.ok || !data.success) {
    throw new Error(data?.error || `HTTP ${res.status}`)
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
}
