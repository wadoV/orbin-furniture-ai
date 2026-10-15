/**
 * Test para ver la respuesta cruda de OpenRouter sin procesar
 */

const fs = require('fs');

async function testRawResponse() {
  console.log('🔍 Test de respuesta cruda de OpenRouter para saludos...\n');
  
  // Probar directamente la función de openrouterClient si está disponible
  try {
    const { callOpenRouter } = require('./src/ai/openrouterClient');
    
    console.log('⚠️  Nota: Esto hará llamadas reales a OpenRouter\n');
    
    const testMessages = [
      'hola', 
      '¡Hola!',
      'buen día'
    ];
    
    for (const message of testMessages) {
      console.log(`📤 Enviando: "${message}"`);
      
      try {
        // Replicar la lógica de chatDesign pero mostrando el raw response
        const { CHAT_SYSTEM_PROMPT } = require('./src/ai/openrouterClient');
        const rawText = await callOpenRouter(CHAT_SYSTEM_PROMPT, [
          { role: 'user', content: message }
        ]);
        
        console.log('📥 Respuesta cruda de OpenRouter:');
        console.log('   "' + rawText.substring(0, 200) + '..."');
        
        // Buscar si hay JSON en la respuesta
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('   JSON encontrado (primeros 100 caracteres):');
          console.log('   "' + jsonMatch[0].substring(0, 100) + '..."');
          
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('   JSON parseado exitosamente');
            console.log('   Keys:', Object.keys(parsed));
          } catch (parseError) {
            console.log('   ❌ ERROR al parsear JSON:', parseError.message);
          }
        } else {
          console.log('   No se encontró JSON en la respuesta');
        }
        
      } catch (error) {
        console.log('   ❌ Error en llamada a OpenRouter:', error.message);
      }
      
      console.log('---');
    }
    
  } catch (error) {
    console.log('No se pudo cargar openrouterClient:', error.message);
    console.log('Intentando cargar aiOrchestrator con debug...');
    
    // Probar con aiOrchestrator debug mode
    const { chatDesign } = require('./src/ai/aiOrchestrator');
    
    // Hack para ver respuesta raw - mirar logs
    console.log('\n⚠️  Ejecutando chatDesign con "¡Hola!". Revisá los logs...');
    const result = await chatDesign([], '¡Hola!');
    console.log('Resultado:', result);
  }
}

// También probar el parser de JSON directamente
function testJsonParser() {
  console.log('\n🧪 Probando parser de JSON con texto problemático...');
  
  const testCases = [
    '¡Hola!',
    'Hola {nombre: "test"}',
    'Texto {malformado: sin cerrar',
    '{"specAdjustments":[]}',
    'Respuesta: {"params": null, "message": "Hola"}',
  ];
  
  for (const text of testCases) {
    console.log(`\nTexto: "${text}"`);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('   JSON encontrado:', jsonMatch[0]);
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('   ✅ Parse exitoso');
      } catch (error) {
        console.log('   ❌ Parse error:', error.message);
      }
    } else {
      console.log('   No se encontró JSON');
    }
  }
}

if (require.main === module) {
  testJsonParser();
  // testRawResponse(); // Comentado para evitar hacer llamadas API durante debugging
}