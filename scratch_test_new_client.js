const vertexClient = require('./server/src/ai/vertexClient')

async function run() {
  console.log('Testing callVertex...')
  try {
    const raw = await vertexClient.callVertex('You are a helpful assistant.', 'Hola, responde "OK" en español.')
    console.log('Raw output:', raw)
    
    console.log('Testing parseDesignIntent...')
    const design = await vertexClient.parseDesignIntent('Quiero un armario de 180cm de ancho por 2 metros de alto con 2 cajones.')
    console.log('Parsed design:', JSON.stringify(design, null, 2))
  } catch (err) {
    console.error('Test failed:', err)
  }
}
run()
