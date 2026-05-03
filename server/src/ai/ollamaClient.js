/**
 * Orbin AI — Ollama API Client
 * Primary local LLM client with Gemini fallback.
 */

const { defaultModel, baseUrl, timeoutMs } = require('./ollama_config')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')
const geminiClient = require('./geminiClient')

async function callOllama(systemPrompt, userMessage, isChat = false) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${baseUrl}/chat`
    const body = {
      model: defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 1024
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message?.content || ''
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      console.warn(`[ollamaClient] Timeout reached (${timeoutMs}ms). Falling back to Gemini...`)
    } else {
      console.warn(`[ollamaClient] Error: ${err.message}. Falling back to Gemini...`)
    }
    throw err // Re-throw to be caught by the parse/chat functions for fallback
  }
}

const { parseNaturalLanguage } = require('../engine/nlParser')

async function parseDesignIntent(text) {
  try {
    const raw = await callOllama(FURNITURE_SYSTEM_PROMPT, text)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('No JSON in Ollama response')
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
    return { ...parsed, source: 'ollama' }
  } catch (err) {
    try {
      return await geminiClient.parseDesignIntent(text)
    } catch (gemErr) {
      console.warn('[ollamaClient] Gemini fallback failed, using regex:', gemErr.message)
      const fallback = parseNaturalLanguage(text)
      return { ...fallback, source: 'regex-fallback' }
    }
  }
}

async function chatDesign(history, userMessage) {
  try {
    // Format history for Ollama chat
    const context = history.map(h => `${h.role}: ${h.content}`).join('\n')
    const fullMessage = context ? `History:\n${context}\n\nUser: ${userMessage}` : userMessage

    const text = await callOllama(CHAT_SYSTEM_PROMPT, fullMessage, true)
    
    // [PRECISION FIX] Ensure JSON compatibility with module state
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/)
    let params = null
    if (jsonMatch) {
      try { 
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
        params = parsed.params || parsed
      } catch {}
    }

    return { message: text, params, source: 'ollama' }
  } catch (err) {
    try {
      return await geminiClient.chatDesign(history, userMessage)
    } catch (gemErr) {
      console.warn('[ollamaClient] Gemini chat fallback failed, using regex:', gemErr.message)
      const parsed = parseNaturalLanguage(userMessage)
      return {
        message: `[Modo offline] Interpreté: ${parsed.interpreted}. (Ollama/Gemini no disponibles)`,
        params:  parsed.params,
        source:  'regex-fallback',
      }
    }
  }
}

module.exports = { parseDesignIntent, chatDesign }
