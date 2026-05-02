/**
 * Orbin AI — Claude API Client
 * Wraps @anthropic-ai/sdk for furniture design intent parsing.
 * Falls back gracefully to nlParser.js (regex) when API key is absent.
 */

const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts')
const { parseNaturalLanguage } = require('../engine/nlParser')

let anthropic = null

function getClient() {
  if (anthropic) return anthropic
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const Anthropic = require('@anthropic-ai/sdk')
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    return anthropic
  } catch {
    return null
  }
}

// ─── Parse design intent via Claude ──────────────────────────────────────────

async function parseDesignIntent(text) {
  const client = getClient()

  // Fallback: regex parser (no API key or SDK not installed)
  if (!client) {
    const fallback = parseNaturalLanguage(text)
    return { ...fallback, source: 'regex' }
  }

  try {
    const message = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system:     FURNITURE_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: text }],
    })

    const raw = message.content[0]?.text || ''

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('No JSON in Claude response')

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
    return { ...parsed, source: 'claude' }
  } catch (err) {
    console.warn('[claudeClient] Claude parse failed, falling back to regex:', err.message)
    const fallback = parseNaturalLanguage(text)
    return { ...fallback, source: 'regex-fallback', claudeError: err.message }
  }
}

// ─── Chat design session ──────────────────────────────────────────────────────

async function chatDesign(history, userMessage) {
  const client = getClient()

  if (!client) {
    // No API key: return structured response from parser
    const parsed = parseNaturalLanguage(userMessage)
    return {
      message: `[Modo offline] Interprelé: ${parsed.interpreted}. Confidence: ${parsed.confidence}%.`,
      params:  parsed.params,
      source:  'regex',
    }
  }

  try {
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage },
    ]

    const response = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      system:     CHAT_SYSTEM_PROMPT,
      messages,
    })

    const text = response.content[0]?.text || ''

    // Try to extract params from response if JSON is present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/)
    let params = null
    if (jsonMatch) {
      try { params = JSON.parse(jsonMatch[1] || jsonMatch[0]).params } catch {}
    }

    return { message: text, params, source: 'claude' }
  } catch (err) {
    console.error('[claudeClient] Chat error:', err.message)
    throw err
  }
}

module.exports = { parseDesignIntent, chatDesign }
