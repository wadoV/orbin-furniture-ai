/**
 * Orbin AI — Vertex AI (Google Cloud) Client
 * Primary cloud LLM client with Ollama fallback.
 */

const { VertexAI } = require('@google-cloud/vertexai');
const { FURNITURE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } = require('./systemPrompts');
require('dotenv').config();

const project = process.env.GCP_PROJECT_ID || 'robust-root-495102';
const location = process.env.GCP_LOCATION || 'us-central1';

// Initialize Vertex AI with the project and location
const vertex_ai = new VertexAI({ project, location });
const model = 'gemini-1.5-pro';

// Instantiate the generative models
const generativeModel = vertex_ai.getGenerativeModel({
  model,
  generationConfig: {
    maxOutputTokens: 4096,
    temperature: 0.1, // Lower temperature for higher precision
    topP: 0.8,
  },
});

async function callVertex(systemPrompt, userMessage) {
  try {
    const request = {
      contents: [
        { role: 'user', parts: [{ text: `System: ${systemPrompt}\n\nUser: ${userMessage}` }] }
      ],
    };

    const streamingResp = await generativeModel.generateContent(request);
    const response = await streamingResp.response;
    return response.candidates[0].content.parts[0].text || '';
  } catch (err) {
    console.error('[vertexClient] Error:', err.message);
    throw err;
  }
}

async function parseDesignIntent(text) {
  const raw = await callVertex(FURNITURE_SYSTEM_PROMPT, text);
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('No JSON in Vertex response');
  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  return { ...parsed, source: 'vertex-ai' };
}

async function chatDesign(history, userMessage) {
  const context = history.map(h => `${h.role}: ${h.content}`).join('\n');
  const fullMessage = context ? `History:\n${context}\n\nUser: ${userMessage}` : userMessage;

  const text = await callVertex(CHAT_SYSTEM_PROMPT, fullMessage);
  
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*"params"[\s\S]*\})/);
  let params = null;
  if (jsonMatch) {
    try { 
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      params = parsed.params || parsed;
    } catch {}
  }

  return { message: text, params, source: 'vertex-ai' };
}

module.exports = { parseDesignIntent, chatDesign };
