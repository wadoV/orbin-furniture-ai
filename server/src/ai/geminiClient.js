/**
 * Orbin AI — Gemini API Client (Fallback)
 * Handles requests when Ollama times out or is unavailable.
 */

const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')

// ── Red de seguridad de transporte (aditivo 2026-08-02) ─────────────────────
// fetch() sin señal NO tiene timeout: un socket que no responde cuelga la
// petición para siempre. El orquestador ya impone un deadline, pero el cliente
// debe cortar su propio socket para no filtrar conexiones.
const FETCH_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 10000

/** Lee el cuerpo de error sin asumir que es JSON (un 502 de proxy es HTML). */
async function describeHttpError(response) {
  try {
    const data = await response.json()
    return data?.error?.message || response.statusText
  } catch {
    return `HTTP ${response.status} ${response.statusText}`
  }
}

async function callGemini(systemPrompt, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing')

  // Using standard fetch for Node 18+
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  
  const body = {
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser request: ${userMessage}` }] }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${await describeHttpError(response)}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

async function callGeminiVision(systemPrompt, userPrompt, base64Image, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing')

  const visionModel = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`
  
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${await describeHttpError(response)}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function extractParamsFromText(text) {
  if (!text || typeof text !== 'string') return null;

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  const jsonCandidate = codeBlockMatch ? codeBlockMatch[1] : text;

  try {
    const raw = JSON.parse(jsonCandidate.trim());
    return raw.params || (raw.width ? raw : null);
  } catch (err) {}

  const paramsBlockMatch = jsonCandidate.match(/"params"\s*:\s*(\{(?:[^{}]|\{[^{}]*\})*\})/);
  if (paramsBlockMatch) {
    try {
      return JSON.parse(paramsBlockMatch[1]);
    } catch (err) {}
  }

  let clean = jsonCandidate.replace(/```(?:json)?/gi, '').trim();
  const lastValidSeparator = Math.max(clean.lastIndexOf(','), clean.lastIndexOf('}'), clean.lastIndexOf('{'));
  if (lastValidSeparator !== -1) {
    clean = clean.slice(0, lastValidSeparator + 1).replace(/,\s*$/, '');
    let openBraces = (clean.match(/\{/g) || []).length - (clean.match(/\}/g) || []).length;
    let openBrackets = (clean.match(/\[/g) || []).length - (clean.match(/\]/g) || []).length;
    while (openBrackets > 0) { clean += ']'; openBrackets--; }
    while (openBraces > 0) { clean += '}'; openBraces--; }
    try {
      const raw = JSON.parse(clean);
      return raw.params || (raw.width ? raw : null);
    } catch (err) {}
  }

  return null;
}

async function parseDesignIntent(text) {
  try {
    const raw = await callGemini(FURNITURE_SYSTEM_PROMPT, text)
    const params = extractParamsFromText(raw)
    if (!params) throw new Error('No JSON in Gemini response')
    return { ...params, source: 'gemini-fallback' }
  } catch (err) {
    console.error('[geminiClient] Parse error:', err.message)
    throw err
  }
}

async function chatDesign(history, userMessage, options = {}) {
  try {
    const context = history.map(h => `${h.role}: ${h.content}`).join('\n')
    const fullMessage = context ? `History:\n${context}\n\nUser: ${userMessage}` : userMessage
    
    const text = await callGemini(options.systemPrompt || CHAT_SYSTEM_PROMPT, fullMessage)
    const params = extractParamsFromText(text)

    return { message: text, params, source: 'gemini-fallback' }
  } catch (err) {
    console.error('[geminiClient] Chat error:', err.message)
    throw err
  }
}

const VISION_SYSTEM_PROMPT = `You are an AI Spatial Architect and Furniture Designer.
Your task is to analyze the provided image of a physical space (room, wall, etc.) and generate an initial parametric configuration for a wooden furniture module (closet, TV stand, etc.).

Estimate the dimensions (width, height, depth) based on typical room proportions or reference objects (like doors, outlets, baseboards).
Also, suggest logical internal divisions (modules array) that would fit well.

Output strictly valid JSON with no markdown wrapping. The JSON must follow this structure:
{
  "width": number (mm, 100 to 6000),
  "height": number (mm, 200 to 3500),
  "depth": number (mm, 100 to 1000),
  "hasCountertop": boolean,
  "modules": [
     { "width": number, "numShelves": number, "numDrawers": number, "numDividers": number }
  ],
  "obstacles": ["list of strings, e.g. 'Wall outlet detected on the left', 'Window on the right'"]
}`

async function analyzeSpaceImage(base64Image, mimeType, userPrompt = "Analyze this space and suggest a furniture configuration.") {
  try {
    const rawAiText = await callGeminiVision(VISION_SYSTEM_PROMPT, userPrompt, base64Image, mimeType)
    let cleanCleanText = rawAiText.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanCleanText)
    return { ...parsed, source: 'gemini-vision' }
  } catch (err) {
    console.error('[geminiClient] analyzeSpaceImage error:', err.message)
    throw err
  }
}

module.exports = { parseDesignIntent, chatDesign, analyzeSpaceImage }
