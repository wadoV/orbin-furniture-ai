const vertexClient = require('./vertexClient');
const ollamaClient = require('./ollamaClient');
const { parseNaturalLanguage } = require('../engine/nlParser');
const { FURNITURE_SYSTEM_PROMPT } = require('./systemPrompts');

/**
 * Audit Pass: A second AI instance verifies the structural integrity.
 */
async function auditDesign(designParams) {
  const auditPrompt = `
    Audit the following furniture design parameters for technical feasibility and manufacturing rules:
    1. Check for collisions between drawers and shelves.
    2. Ensure lateral panels go to floor (y = H/2).
    3. Verify internal shelf technical recess (50mm).
    4. Confirm baseboards are vertical.
    
    Design: ${JSON.stringify(designParams)}
    
    If corrections are needed, return the modified JSON. If perfect, return the original JSON.
    Return ONLY valid JSON.
  `;
  try {
    const raw = await vertexClient.callVertex(FURNITURE_SYSTEM_PROMPT, auditPrompt);
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    return jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : designParams;
  } catch (err) {
    console.warn('[Audit] Audit pass failed, using primary design.');
    return designParams;
  }
}

async function parseDesignIntent(text) {
  try {
    console.log('[Orchestrator] Pass 1: Generating with Vertex AI (Gemini Pro)...');
    let design = await vertexClient.parseDesignIntent(text);
    
    console.log('[Orchestrator] Pass 2: Auditing Design Integrity...');
    design = await auditDesign(design);
    
    return { ...design, source: 'vertex-ai-high-tier' };
  } catch (err) {
    console.warn('[Orchestrator] Vertex AI failed, attempting Ollama fallback...');
    try {
      return await ollamaClient.parseDesignIntent(text);
    } catch (ollamaErr) {
      console.error('[Orchestrator] Ollama failed, using local Regex parser.');
      const fallback = parseNaturalLanguage(text);
      return { ...fallback, source: 'regex-fallback' };
    }
  }
}

async function chatDesign(history, userMessage) {
  try {
    console.log('[Orchestrator] Vertex AI Chat (Gemini Pro) Active...');
    const result = await vertexClient.chatDesign(history, userMessage);
    
    if (result.params) {
      console.log('[Orchestrator] Auditing Chat-generated parameters...');
      result.params = await auditDesign(result.params);
      result.source = 'vertex-ai-high-tier-chat';
    }
    
    return result;
  } catch (err) {
    console.warn('[Orchestrator] Vertex AI Chat failed, attempting Ollama fallback...');
    try {
      return await ollamaClient.chatDesign(history, userMessage);
    } catch (ollamaErr) {
      console.error('[Orchestrator] Ollama Chat failed, using local Regex parser.');
      const parsed = parseNaturalLanguage(userMessage);
      return {
        message: `[Modo offline] Interpreté: ${parsed.interpreted}. (IA en la nube y local no disponibles)`,
        params:  parsed.params,
        source:  'regex-fallback',
      };
    }
  }
}

module.exports = { parseDesignIntent, chatDesign };
