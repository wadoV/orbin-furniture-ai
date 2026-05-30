/**
 * Orbin AI — Orchestrator
 *
 * Chain de fallback para parseDesignIntent y chatDesign:
 *   1. vertexClient  (Gemini SDK — @google/generative-ai, con historial nativo)
 *   2. geminiClient  (Gemini REST — fetch puro, sin SDK)
 *   3. ollamaClient  (LLM local — deepseek-r1:7b via Ollama)
 *   4. nlParser      (Regex local — sin IA, 100% offline)
 */

const vertexClient  = require('./vertexClient')
const geminiClient  = require('./geminiClient')
const ollamaClient  = require('./ollamaClient')
const { parseNaturalLanguage } = require('../engine/nlParser')
const { FURNITURE_SYSTEM_PROMPT } = require('./systemPrompts')

// ─── Audit Pass (optional second pass to verify structural integrity) ─────────

async function auditDesign(designParams) {
  const auditPrompt = `
Audit the following furniture design parameters for technical feasibility:
1. Check for collisions between drawers and shelves.
2. Ensure lateral panels reach the floor.
3. Verify internal shelf recess (50mm).
4. Confirm baseboard placement is valid.

Design: ${JSON.stringify(designParams)}

If corrections are needed, return the modified JSON. If already correct, return the original JSON.
Return ONLY valid JSON — no markdown, no explanation.
`
  try {
    const raw = await vertexClient.callVertex(FURNITURE_SYSTEM_PROMPT, auditPrompt)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    return jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : designParams
  } catch {
    // Audit is best-effort — never block the main flow
    return designParams
  }
}

// ─── parseDesignIntent ────────────────────────────────────────────────────────

async function parseDesignIntent(text) {
  // Tier 1 — Gemini SDK (vertexClient)
  try {
    console.log('[Orchestrator] Tier 1: Gemini SDK (vertexClient)…')
    const design = await vertexClient.parseDesignIntent(text)
    return { ...design, source: design.source || 'gemini-api' }
  } catch (err1) {
    console.warn('[Orchestrator] Tier 1 failed:', err1.message)
  }

  // Tier 2 — Gemini REST (geminiClient, fetch-based)
  try {
    console.log('[Orchestrator] Tier 2: Gemini REST (geminiClient)…')
    const design = await geminiClient.parseDesignIntent(text)
    return { ...design, source: design.source || 'gemini-fallback' }
  } catch (err2) {
    console.warn('[Orchestrator] Tier 2 failed:', err2.message)
  }

  // Tier 3 — Ollama (local LLM)
  try {
    console.log('[Orchestrator] Tier 3: Ollama (local LLM)…')
    return await ollamaClient.parseDesignIntent(text)
  } catch (err3) {
    console.warn('[Orchestrator] Tier 3 failed:', err3.message)
  }

  // Tier 4 — Regex parser (always works, no network)
  console.warn('[Orchestrator] Tier 4: Regex parser (offline fallback)')
  const fallback = parseNaturalLanguage(text)
  return { ...fallback, source: 'regex-fallback' }
}

// ─── chatDesign ───────────────────────────────────────────────────────────────

async function chatDesign(history, userMessage) {
  // Tier 1 — Gemini SDK (vertexClient)
  try {
    console.log('[Orchestrator] Chat Tier 1: Gemini SDK (vertexClient)…')
    const result = await vertexClient.chatDesign(history, userMessage)
    return { ...result, source: result.source || 'gemini-api' }
  } catch (err1) {
    console.warn('[Orchestrator] Chat Tier 1 failed:', err1.message)
  }

  // Tier 2 — Gemini REST (geminiClient)
  try {
    console.log('[Orchestrator] Chat Tier 2: Gemini REST (geminiClient)…')
    const result = await geminiClient.chatDesign(history, userMessage)
    return { ...result, source: result.source || 'gemini-fallback' }
  } catch (err2) {
    console.warn('[Orchestrator] Chat Tier 2 failed:', err2.message)
  }

  // Tier 3 — Ollama
  try {
    console.log('[Orchestrator] Chat Tier 3: Ollama…')
    return await ollamaClient.chatDesign(history, userMessage)
  } catch (err3) {
    console.warn('[Orchestrator] Chat Tier 3 failed:', err3.message)
  }

  // Tier 4 — Regex (offline)
  console.warn('[Orchestrator] Chat Tier 4: Regex offline fallback')
  const parsed = parseNaturalLanguage(userMessage)
  return {
    message: `[Modo offline] Interpreté: ${parsed.interpreted}. (IA en la nube y local no disponibles)`,
    params:  parsed.params,
    source:  'regex-fallback',
  }
}

module.exports = { parseDesignIntent, chatDesign }
