/**
 * Orbin AI — Google Cloud Vertex AI Client
 * Uses @google-cloud/vertexai with service account credentials.
 * Automatically loads credentials from GCP JSON file.
 */

const { VertexAI } = require('@google-cloud/vertexai')
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')
const fs = require('fs')
require('dotenv').config()

// ─── Google Cloud Credentials Setup ──────────────────────────────────────────
const CREDENTIALS_PATH = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').replace(/^"|"$/g, '').trim()

if (CREDENTIALS_PATH && fs.existsSync(CREDENTIALS_PATH)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = CREDENTIALS_PATH
} else {
  console.warn('[VertexClient] GOOGLE_APPLICATION_CREDENTIALS no configurada; Tier-1 (Vertex) se omite y el orquestador usa el fallback (Gemini/Ollama).')
}

const PROJECT_ID = process.env.GCP_PROJECT_ID || ''
const LOCATION = process.env.GCP_LOCATION || 'us-central1'
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-pro'

// Lazy initialize VertexAI client
let _vertexAI = null
function getVertexAI() {
  if (!_vertexAI) {
    _vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION })
  }
  return _vertexAI
}

// Extract text from Vertex AI response structure safely
function extractText(result) {
  if (result?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.response.candidates[0].content.parts[0].text
  }
  if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text
  }
  return ''
}

// ─── callVertex (Raw generation) ──────────────────────────────────────────────
async function callVertex(systemPrompt, userMessage) {
  const vertex = getVertexAI()
  const model = vertex.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.1,
      topP: 0.8,
    }
  })

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userMessage }] }]
  })
  return extractText(result)
}

// Bulletproof JSON cleaner and parser
function cleanAndParseJSON(raw) {
  // 1. Extract JSON block if wrapped in markdown codeblock or braces
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
  let cleanStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : raw.trim()

  // 2. Remove comments (both single line // and multi-line /* */)
  cleanStr = cleanStr.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')

  // 3. Remove trailing commas in objects or arrays
  cleanStr = cleanStr.replace(/,\s*([\]}])/g, '$1')

  try {
    return JSON.parse(cleanStr)
  } catch (err) {
    try {
      // Fallback: Attempt to replace single quotes with double quotes
      const fixedSingleQuotes = cleanStr.replace(/'/g, '"')
      return JSON.parse(fixedSingleQuotes)
    } catch {
      console.error('[vertexClient] Failed to parse JSON. Cleaned string was:', cleanStr)
      throw err
    }
  }
}

// ─── parseDesignIntent ────────────────────────────────────────────────────────
async function parseDesignIntent(text) {
  const raw = await callVertex(FURNITURE_SYSTEM_PROMPT, text)
  try {
    const parsed = cleanAndParseJSON(raw)
    return { ...parsed, source: 'vertex-ai-high-tier' }
  } catch (err) {
    console.error('[vertexClient] parseDesignIntent JSON parse error:', err.message)
    throw err
  }
}

// ─── chatDesign ──────────────────────────────────────────────────────────────
async function chatDesign(history, userMessage) {
  const vertex = getVertexAI()
  const model = vertex.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: CHAT_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.2,
    }
  })

  // Format history for Vertex AI
  const formattedHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }))

  const chat = model.startChat({ history: formattedHistory })
  const result = await chat.sendMessage(userMessage)
  const text = extractText(result)

  // Try to extract design parameters if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/)
  let params = null
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      params = parsed.params || parsed
    } catch {}
  }

  return { message: text, params, source: 'vertex-ai-high-tier-chat' }
}

module.exports = { parseDesignIntent, chatDesign, callVertex }
