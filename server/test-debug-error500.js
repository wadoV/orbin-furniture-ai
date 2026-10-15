/**
 * Debug del error 500 específico con saludo "hola"
 */

const { chatDesign } = require('./src/ai/aiOrchestrator');

async function debugError500() {
  console.log('🔍 Debug del posible error 500 con saludo...\n');
  
  // Saludos problemáticos según el test anterior
  const problemas = ['hola', 'buen día', '¡Hola!'];
  
  for (const problema of problemas) {
    console.log(`\n🧪 Probando saludo: "${problema}"`);
    
    try {
      // Call directo a chatDesign para ver qué recibe
      const result = await chatDesign([], problema);
      
      console.log('  ✅ chatDesign exitoso');
      console.log('  Parámetros tipo:', typeof result.params);
      console.log('  Parámetros valor:', result.params);
      console.log('  Source:', result.source);
      console.log('  isGreeting:', result.isGreeting);
      
      if (result.params) {
        console.log('  ⚠️  OpenRouter está devolviendo params para un saludo');
        
        // Probar qué pasa si hacemos normalizeDesignParams con estos params
        try {
          const { normalizeDesignParams } = require('./src/routes/chat');
          const normalized = normalizeDesignParams(result.params);
          console.log('  ✅ normalizeDesignParams exitoso');
        } catch (error) {
          console.log('  ❌ ERROR en normalizeDesignParams:', error.message);
          console.log('     Stack:', error.stack.split('\n')[0]);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR en chatDesign: ${error.message}`);
      console.log('  Stack:', error.stack.split('\n')[0]);
    }
  }
  
  console.log('\n🔍 Verificando qué contiene el resultado para saludos problemáticos...\n');
  
  for (const problema of ['hola', '¡Hola!']) {
    try {
      const result = await chatDesign([], problema);
      console.log(`Mensaje para "${problema}":`);
      console.log(`  "${result.message.substring(0, 100)}..."`);
      if (result.params) {
        console.log('  Parámetros inválidos encontrados:', 
          Object.keys(result.params).filter(k => result.params[k] !== undefined).join(', '));
      }
    } catch (error) {
      console.log(`Error con "${problema}": ${error.message}`);
    }
  }
}

if (require.main === module) {
  debugError500();
}