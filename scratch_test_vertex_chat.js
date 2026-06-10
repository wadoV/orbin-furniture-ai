const { VertexAI } = require('./server/node_modules/@google-cloud/vertexai')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\Users\\Azomarg\\Documents\\Claude_projects\\robust-root-495102-h1-583830a25255.json'

async function run() {
  try {
    const vertexAI = new VertexAI({
      project: 'robust-root-495102-h1',
      location: 'us-central1'
    })
    
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are a helpful assistant. Reply in Spanish.',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }
    })
    
    console.log('Generating content...')
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hola, ¿cómo estás?' }] }]
    })
    
    console.log('Full response metadata:', {
      modelVersion: response.response.modelVersion,
      createTime: response.response.createTime,
      responseId: response.response.responseId,
    })
    
    const candidate = response.response?.candidates?.[0];
    console.log('Candidate finishReason:', candidate?.finishReason)
    console.log('Candidate content parts:', JSON.stringify(candidate?.content?.parts, null, 2))
    
    const text = candidate?.content?.parts?.[0]?.text || ''
    console.log('Response text:', text)
  } catch (err) {
    console.error('Vertex AI error:', err)
  }
}
run()
