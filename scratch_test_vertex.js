const { VertexAI } = require('./server/node_modules/@google-cloud/vertexai')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

// Set env var for Google Application Credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\Users\\Azomarg\\Documents\\Claude_projects\\robust-root-495102-h1-583830a25255.json'

async function run() {
  console.log('Initializing Vertex AI...')
  try {
    const vertexAI = new VertexAI({
      project: 'robust-root-495102-h1',
      location: 'us-central1'
    })
    
    console.log('Getting generative model...')
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash-002',
    })
    
    console.log('Sending message to Gemini on Vertex AI...')
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hola, di "hola" en portugués y termina.' }] }]
    })
    
    console.log('Response received:')
    console.log(JSON.stringify(response, null, 2))
    
    const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('Extracted text:', text)
  } catch (err) {
    console.error('Vertex AI call failed:', err)
  }
}
run()
