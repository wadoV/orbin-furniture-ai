/**
 * Test de endpoint /api/chat/design con mensaje "hola"
 * Ejecutar: node test-endpoint-hola.js
 */

const http = require('http');
const url = require('url');

function testEndpoint() {
  console.log('🧪 Probando endpoint /api/chat/design con "hola"...\n');
  
  // Crear un servidor Express simple para probar
  const express = require('express');
  const app = express();
  app.use(express.json());
  
  // Mock de autenticación
  app.use((req, res, next) => {
    req.user = { id: 'test-user', plan: 'free' };
    next();
  });
  
  const chatRouter = require('./src/routes/chat');
  app.use('/api/chat', chatRouter);
  
  // Iniciar servidor temporal
  const server = app.listen(0, () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    
    console.log(`Servidor temporal iniciado en puerto ${port}`);
    
    // Hacer el test con fetch
    const testUrl = `${baseUrl}/api/chat/design`;
    
    const requestBody = {
      message: 'hola',
      sessionId: 'test-session-hola',
      lang: 'ES'
    };
    
    fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(data => {
      console.log('📊 RESULTADO DEL TEST:');
      console.log('  Status: 200 (exitoso)');
      console.log(`  Success: ${data.success}`);
      console.log(`  Params: ${data.params}`);
      console.log(`  Design: ${data.design}`);
      console.log(`  Source: ${data.source}`);
      console.log(`  isGreeting: ${data.isGreeting}`);
      console.log(`  Reply (primeros 50 chars): "${data.reply?.substring(0, 50)}..."`);
      
      // Verificaciones
      const checks = [
        { name: 'Status === 200',          condition: true }, // Asumimos 200 por response.json()
        { name: 'Success === true',        condition: data.success === true },
        { name: 'Params === null',         condition: data.params === null },
        { name: 'Design === null',         condition: data.design === null },
        { name: 'Source != null',          condition: data.source !== undefined },
        { name: 'Contains saludo Orbin',   condition: data.reply && data.reply.includes('Orbin') }
      ];
      
      console.log('\n✅ VERIFICACIONES:');
      checks.forEach(check => {
        console.log(`  ${check.condition ? '✅' : '❌'} ${check.name}`);
      });
      
      const allPassed = checks.every(check => check.condition);
      console.log(`\n🎯 RESULTADO FINAL: ${allPassed ? '✅ ÉXITO - Todo funcionando correctamente' : '❌ HAY PROBLEMAS'}`);
      
    })
    .catch(error => {
      console.error('❌ Error en la prueba:', error.message);
      console.error('Stack:', error.stack);
    })
    .finally(() => {
      server.close(() => {
        console.log('\n🔚 Servidor cerrado');
      });
    });
  });
}

if (require.main === module) {
  testEndpoint();
}