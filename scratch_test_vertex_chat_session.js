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
      systemInstruction: 'You are a helpful assistant.',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }
    })
    
    console.log('Starting chat...')
    const history = [
      { role: 'user', parts: [{ text: 'Hola, mi nombre es Eduardo.' }] },
      { role: 'model', parts: [{ text: '¡Hola Eduardo! ¿En qué puedo ayudarte hoy?' }] }
    ]
    const chat = model.startChat({ history })
    
    console.log('Sending message to chat...')
    const result = await chat.sendMessage('¿Cuál es mi nombre?')
    const text = result.response.text()
    console.log('Response text from .text():', text)
  } catch (err) {
    console.error('Vertex AI chat session error:', err)
  }
}
run()
