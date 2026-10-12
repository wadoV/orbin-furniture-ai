/**
 * Orbin AI — Ollama API Client
 * Tier 2 de la cascada (gemini → ollama → regex local).
 *
 * Compatible con modelos razonadores (DeepSeek-R1): remueve <think>…</think>
 * antes de extraer JSON o mostrar texto al usuario.
 */

const { defaultModel, baseUrl, timeoutMs, numPredict, think, keepAlive } = require('./ollama_config')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')

// ── Limpieza de razonamiento ────────────────────────────────────────────────
/**
 * Quita el razonamiento de modelos tipo R1:
 *  - bloques cerrados  <think>…</think>
 *  - bloque SIN cerrar (respuesta truncada por num_predict) → descarta hasta el final
 *  - cierre huérfano  "razonamiento…</think> respuesta" (R1 a veces omite la apertura)
 */
function stripThinkTags(text) {
  if (typeof text !== 'string') return ''
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const open = t.search(/<think>/i)
  if (open !== -1) t = t.slice(0, open)
  const orphan = t.lastIndexOf('</think>')
  if (orphan !== -1) t = t.slice(orphan + '</think>'.length)
  return t.trim()
}

/**
 * Primer objeto JSON parseable del texto: bloque ```json primero, luego escaneo
 * de llaves balanceadas (respeta strings). Devuelve null si no hay ninguno.
 */
function extractJsonObject(text) {
  if (typeof text !== 'string') return null
  const candidates = []
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  candidates.push(text)

  for (const src of candidates) {
    for (let start = src.indexOf('{'); start !== -1; start = src.indexOf('{', start + 1)) {
      let depth = 0, inStr = false, esc = false
      for (let i = start; i < src.length; i++) {
        const ch = src[i]
        if (inStr) {
          if (esc) esc = false
          else if (ch === '\\') esc = true
          else if (ch === '"') inStr = false
          continue
        }
        if (ch === '"') inStr = true
        else if (ch === '{') depth++
        else if (ch === '}' && --depth === 0) {
          try { return JSON.parse(src.slice(start, i + 1)) } catch { /* probar siguiente '{' */ }
          break
        }
      }
    }
  }
  return null
}

async function callOllama(systemPrompt, userMessage) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        think,
        keep_alive: keepAlive,
        options: { temperature: 0.1, num_predict: numPredict }
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`Ollama Error: HTTP ${response.status} ${response.statusText}`)
    }

    const data = await response.json()   // el timeout sigue activo durante la lectura del body
    return data.message?.content || ''
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[ollamaClient] Timeout (${timeoutMs}ms, modelo ${defaultModel}). Cascada continúa.`)
    } else {
      console.warn(`[ollamaClient] Error: ${err.message}. Cascada continúa.`)
    }
    throw err // la cascada del orquestador decide el siguiente tier
  } finally {
    clearTimeout(timeoutId)
  }
}

async function parseDesignIntent(text) {
  const raw = await callOllama(FURNITURE_SYSTEM_PROMPT, text)
  const parsed = extractJsonObject(stripThinkTags(raw))
  if (!parsed) throw new Error('No JSON in Ollama response')
  return { ...parsed, source: 'ollama' }
}

async function chatDesign(history, userMessage, options = {}) {
  const context = history.map(h => `${h.role}: ${h.content}`).join('\n')
  const fullMessage = context ? `History:\n${context}\n\nUser: ${userMessage}` : userMessage

  const text = stripThinkTags(await callOllama(options.systemPrompt || CHAT_SYSTEM_PROMPT, fullMessage))

  const parsed = extractJsonObject(text)
  let params = null
  if (parsed) params = parsed.params || (parsed.width ? parsed : null)

  // Sin prosa ni params (típico: num_predict agotado dentro de <think>) → fallar para que la cascada siga.
  if (!text && !params) throw new Error('Ollama devolvió respuesta vacía tras limpiar <think>')

  return { message: text, params, source: 'ollama' }
}

module.exports = { parseDesignIntent, chatDesign, stripThinkTags, extractJsonObject }
