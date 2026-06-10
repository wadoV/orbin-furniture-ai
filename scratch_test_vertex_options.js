const { VertexAI } = require('./server/node_modules/@google-cloud/vertexai')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\Users\\Azomarg\\Documents\\Claude_projects\\robust-root-495102-h1-583830a25255.json'

async function run() {
  try {
    const vertexAI = new VertexAI({
      project: 'robust-root-495102-h1',
      location: 'us-central1'
    })
    
    // In Vertex AI, model configuration options are passed to getGenerativeModel:
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      systemInstruction: 'You are a helpful assistant. Reply with only one word: YES.',
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      }
    })
    
    console.log('Generating content...')
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello.' }] }]
    })
    
    const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('Response text:', text)
    console.log('Full response:', JSON.stringify(response, null, 2))
  } catch (err) {
    console.error('Vertex AI error:', err)
  }
}
run()
