/**
 * Orbin AI — Ollama Configuration
 * Local LLM settings for privacy-first parametric design.
 */

module.exports = {
  defaultModel: 'llama3.2:1b',
  baseUrl:      'http://localhost:11434/api',
  timeoutMs:    10000,
  fallbackTo:   'gemini-2.5-flash'  // ★ FIX: 'gemini-3-flash' no existe
}
