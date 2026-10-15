/**
 * Orbin AI — OpenRouter Client with DeepSeek V3 (Tier 1)
 * Uses fetch native to https://openrouter.ai/api/v1/chat/completions
 */

const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')

// ── Timeout de transporte (consistente con otros clientes) ─────────────────────
const FETCH_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS) || 10000

/**
 * Descripción de errores HTTP sin asumir que el cuerpo es JSON
 */
async function describeHttpError(response) {
  try {
    const data = await response.json()
    return data?.error?.message || response.statusText
  } catch {
    return `HTTP ${response.status} ${response.statusText}`
  }
}

/**
 * Construye el prompt para OpenRouter siguiendo el formato estándar
 */
function buildOpenRouterMessages(systemPrompt, messages) {
  const systemMessage = {
    role: 'system',
    content: systemPrompt
  }
  
  // Si hay historial de chat, construir el array de mensajes completo
  if (Array.isArray(messages) && messages.length > 0) {
    return [systemMessage, ...messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' ? msg.content : String(msg.content)
    }))]
  }
  
  // Para parseDesignIntent (solo mensaje del usuario)
  return [systemMessage, {
    role: 'user',
    content: typeof messages === 'string' ? messages : String(messages)
  }]
}

/**
 * Realiza la llamada a la API de OpenRouter
 */
async function callOpenRouter(systemPrompt, messages, model = 'deepseek/deepseek-chat') {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing')

  const url = 'https://openrouter.ai/api/v1/chat/completions'
  
  const body = {
    model,
    messages: buildOpenRouterMessages(systemPrompt, messages),
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: 'json_object' }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://orbin.ai',
      'X-Title': 'Orbin AI'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })

  if (!response.ok) {
    const errorDetail = await describeHttpError(response)
    throw new Error(`OpenRouter API error: ${errorDetail}`)
  }

  const data = await response.json()
  
  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error('OpenRouter response missing content')
  }

  return data.choices[0].message.content
}

/**
 * Parsea la respuesta JSON de manera segura
 */
function extractJsonObject(text) {
  if (!text) return null
  
  // Buscar primer objeto JSON y parsear
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

/**
 * Extrae parámetros del motor desde el texto
 */
function extractParamsFromText(text) {
  const json = extractJsonObject(text)
  if (!json) return null
  
  // Preferir estructura nested (parámetros dentro de `params`)
  const hasParams = json && typeof json === 'object' && json.params
  if (hasParams && typeof json.params === 'object') {
    return json
  }
  
  // Si tiene estructura plana de parámetros, empaquetar en `params`
  const expectedParams = ['moduleType', 'width', 'height', 'depth']
  const hasParamKeys = expectedParams.some(key => key in json)
  if (hasParamKeys) {
    return { params: json }
  }
  
  return json
}

/**
 * Extracción de intención de diseño (parseDesignIntent)
 */
async function parseDesignIntent(text) {
  try {
    const rawText = await callOpenRouter(FURNITURE_SYSTEM_PROMPT, text)
    const params = extractParamsFromText(rawText)
    if (!params) throw new Error('No JSON in OpenRouter response')
    
    return {
      params,
      specAdjustments: [],
      confidence: 0.95,
      interpreted: text,
      source: 'openrouter-deepseek-v3'
    }
  } catch (error) {
    console.error('[openrouterClient] parseDesignIntent failed:', error.message)
    throw error
  }
}

/**
 * Chat conversacional (chatDesign)
 */
async function chatDesign(history = [], userMessage = '', options = {}) {
  try {
    const rawText = await callOpenRouter(CHAT_SYSTEM_PROMPT, history.concat([{
      role: 'user',
      content: userMessage
    }]))
    
    const json = extractJsonObject(rawText)
    
    // Default response si no se puede parsear JSON
    if (!json) {
      return {
        message: rawText || 'OpenRouter devolvió una respuesta vacía',
        params: null,
        specAdjustments: [],
        source: 'openrouter-deepseek-v3'
      }
    }
    
    // Si es un objeto JSON válido, extraer parámetros
    const params = extractParamsFromText(rawText)
    const message = typeof json.message === 'string' ? json.message : rawText
    
    return {
      message,
      params: params?.params || null,
      specAdjustments: Array.isArray(json.specAdjustments) ? json.specAdjustments : [],
      source: params?.source || 'openrouter-deepseek-v3'
    }
  } catch (error) {
    console.error('[openrouterClient] chatDesign failed:', error.message)
    throw error
  }
}

module.exports = { parseDesignIntent, chatDesign }
