/**
 * Orbin AI — Ollama Configuration
 * Local LLM settings for privacy-first parametric design.
 *
 * Todo es sobreescribible por entorno (server/.env). Defaults calibrados para
 * DeepSeek-R1 7B local: modelo razonador → necesita presupuesto de tokens y
 * timeout muy superior al de un modelo instruct pequeño.
 */

// Acepta OLLAMA_BASE_URL con o sin sufijo /api ("http://localhost:11434[/api]").
const rootUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

module.exports = {
  defaultModel: process.env.OLLAMA_MODEL || 'deepseek-r1:7b',
  baseUrl:      `${rootUrl}/api`,
  // R1 7B en CPU/GPU modesta puede tardar >30s. El orquestador deriva su deadline de este valor.
  timeoutMs:    Number(process.env.OLLAMA_TIMEOUT_MS) || 90000,
  // El bloque <think> consume tokens ANTES del JSON: 1024 truncaba la respuesta a mitad del razonamiento.
  numPredict:   Number(process.env.OLLAMA_NUM_PREDICT) || 4096,
  // Para extraer JSON no necesitamos razonamiento visible. 'true' lo reactiva.
  think:        process.env.OLLAMA_THINK === 'true',
  keepAlive:    process.env.OLLAMA_KEEP_ALIVE || '30m',
  fallbackTo:   'gemini-3-flash'
}
