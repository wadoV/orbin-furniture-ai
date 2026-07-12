/**
 * Orbin AI — Gemini Client (Google AI Studio)
 * Uses @google/generative-ai — requires only a GEMINI_API_KEY.
 * No GCP service account or Vertex AI credentials needed.
 *
 * Get a free key at: https://aistudio.google.com/apikey
 */

const { GoogleGenerativeAI } = require('@google/generative-ai')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')
require('dotenv').config()

const apiKey = process.env.GEMINI_API_KEY
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

// ─── Guard: warn early if no key configured ───────────────────────────────────
if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.warn(
    '[GeminiClient] ⚠  GEMINI_API_KEY not set in .env.\n' +
    '               Get a free key at https://aistudio.google.com/apikey\n' +
    '               and add it to server/.env as GEMINI_API_KEY=<your-key>'
  )
}

// Lazy-initialize so we don't crash at startup if key is missing
let _client = null
function getClient() {
  if (!_client) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY não configurado. Acesse https://aistudio.google.com/apikey')
    }
    _client = new GoogleGenerativeAI(apiKey)
  }
  return _client
}

// ─── Core call ────────────────────────────────────────────────────────────────

async function callGemini(systemPrompt, userMessage) {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.1,
      topP: 0.8,
    },
  })

  const result = await model.generateContent(userMessage)
  const response = await result.response
  return response.text()
}

// ─── Design Intent Parser ─────────────────────────────────────────────────────

async function parseDesignIntent(text) {
  const raw = await callGemini(FURNITURE_SYSTEM_PROMPT, text)

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) throw new Error('Gemini returned no JSON block')

  let cleanStr = (jsonMatch[1] || jsonMatch[0]).trim()
  // Bulletproof clean: remove trailing commas in objects or arrays that break standard JSON.parse
  cleanStr = cleanStr.replace(/,\s*([\]}])/g, '$1')

  try {
    const parsed = JSON.parse(cleanStr)
    return { ...parsed, source: 'gemini-api' }
  } catch (err) {
    console.error('[vertexClient] Failed to parse cleaned JSON. Original raw response was:', raw)
    throw err
  }
}

// ─── Chat Design ──────────────────────────────────────────────────────────────

async function chatDesign(history, userMessage, options = {}) {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: options.systemPrompt || CHAT_SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
  })

  // Build Gemini chat history format
  const geminiHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }))

  const chat = model.startChat({ history: geminiHistory })
  const result = await chat.sendMessage(userMessage)
  const text = result.response.text()

  // Extract JSON params from response
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/)
  let params = null
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      params = parsed.params || parsed
    } catch {}
  }

  return { message: text, params, source: 'gemini-api' }
}

// Keep legacy export name so aiOrchestrator doesn't need changes
module.exports = { parseDesignIntent, chatDesign, callVertex: callGemini }
