/**
 * Orbin AI — Gemini API Client (Fallback)
 * Handles requests when Ollama times out or is unavailable.
 */

const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')

async function callGemini(systemPrompt, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing')

  // Using standard fetch for Node 18+
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  
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

async function parseDesignIntent(text) {
  try {
    const raw = await callGemini(FURNITURE_SYSTEM_PROMPT, text)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('No JSON in Gemini response')
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
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
    
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/)
    let params = null
    if (jsonMatch) {
      try { params = JSON.parse(jsonMatch[1] || jsonMatch[0]).params } catch {}
    }

    return { message: text, params, source: 'gemini-fallback' }
  } catch (err) {
    console.error('[geminiClient] Chat error:', err.message)
    throw err
  }
}

module.exports = { parseDesignIntent, chatDesign }
