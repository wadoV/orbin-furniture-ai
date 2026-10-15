/**
 * Simulación del endpoint /api/chat/design para diagnosticar el error 500 en saludos
 */

const express = require('express');
const request = require('supertest');
const chatRouter = require('./src/routes/chat');

async function simularEndpoint() {
  console.log('🔧 Simulando endpoint /api/chat/design...\n');
  
  const app = express();
  app.use(express.json());
  
  // Mock de autenticación para pasar requireAuth
  app.use((req, res, next) => {
    req.user = { id: 'test-user', plan: 'free' };
    next();
  });
  
  app.use('/api/chat', chatRouter);
  
  try {
    // Test de saludo simple
    const response = await request(app)
      .post('/api/chat/design')
      .set('Authorization', 'Bearer test-token')
      .send({
        message: 'hola',
        sessionId: 'test-session',
        lang: 'ES'
      });
    
    console.log('📊 Respuesta del endpoint:');
    console.log('  Status:', response.status);
    console.log('  Body:', JSON.stringify(response.body, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Status 200 - OK');
    } else {
      console.log('❌ Status', response.status, '- ERROR');
    }
    
  } catch (error) {
    console.error('❌ Error en la simulación:', error.message);
    if (error.response) {
      console.log('Response error:', error.response.text);
    }
  }
}

if (require.main === module) {
  simularEndpoint();
}