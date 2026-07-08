/**
 * Orbin AI — Gemini API Client (Fallback)
 * Handles requests when Ollama times out or is unavailable.
 */

const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')

async function callGemini(systemPrompt, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY
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
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

async function callGeminiVision(systemPrompt, userPrompt, base64Image, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY
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
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function parseDesignIntent(text) {
  try {
    const raw = await callGemini(FURNITURE_SYSTEM_PROMPT, text)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('No JSON in Gemini response')
    
    let cleanStr = (jsonMatch[1] || jsonMatch[0]).trim()
    // Remove trailing commas which break standard JSON.parse in Node
    cleanStr = cleanStr.replace(/,\s*([\]}])/g, '$1')
    
    const parsed = JSON.parse(cleanStr)
    return { ...parsed, source: 'gemini-fallback' }
  } catch (err) {
    console.error('[geminiClient] Parse error:', err.message)
    throw err
  }
}

async function chatDesign(history, userMessage) {
  try {
    // History needs to be formatted for Gemini if we wanted full context, 
    // but for fallback we might just send the latest context or a simplified summary.
    // For now, let's just send the user message with the system prompt.
    const context = history.map(h => `${h.role}: ${h.content}`).join('\n')
    const fullMessage = context ? `History:\n${context}\n\nUser: ${userMessage}` : userMessage
    
    const text = await callGemini(CHAT_SYSTEM_PROMPT, fullMessage)
    
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
    let params = null
    if (jsonMatch) {
      try {
        const raw = JSON.parse(jsonMatch[1] || jsonMatch[0])
        // Accept nested { params: {...} } OR flat root-level { width:..., height:... }
        params = raw.params || (raw.width ? raw : null)
      } catch {}
    }

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
    const raw = await callGeminiVision(VISION_SYSTEM_PROMPT, userPrompt, base64Image, mimeType)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    const parsed = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : raw)
    return { ...parsed, source: 'gemini-vision' }
  } catch (err) {
    console.error('[geminiClient] analyzeSpaceImage error:', err.message)
    throw err
  }
}

module.exports = { parseDesignIntent, chatDesign, analyzeSpaceImage }
