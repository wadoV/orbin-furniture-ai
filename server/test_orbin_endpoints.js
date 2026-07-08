const axios = require('axios');

async function testHealthEndpoint() {
  try {
    const response = await axios.get('http://localhost:3003/api/health');
    console.log('✅ Prueba exitosa! Respuesta del endpoint /health:');
    console.log({
      status: response.data.status,
      service: response.data.service,
      version: response.data.version
    });
  } catch (error) {
    console.error('❌ Error en prueba:');
    console.error(error.message);
  }
}

testHealthEndpoint();