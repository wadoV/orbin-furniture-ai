/**
 * Orbin AI — AI Orchestrator
 * Prioritizes Vertex AI (Google Cloud) with Ollama (Local) as fallback.
 */

const vertexClient = require('./vertexClient');
const ollamaClient = require('./ollamaClient');
const { parseNaturalLanguage } = require('../engine/nlParser');

async function parseDesignIntent(text) {
  try {
    console.log('[Orchestrator] Attempting Vertex AI...');
    return await vertexClient.parseDesignIntent(text);
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
    console.log('[Orchestrator] Attempting Vertex AI Chat...');
    return await vertexClient.chatDesign(history, userMessage);
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
