/**
 * Validación rápida de integración OpenRouter + DeepSeek V3
 * Ejecutar: node test-openrouter.js
 */

const { chatDesign } = require('./src/ai/aiOrchestrator');

async function testOpenRouter() {
  console.log('🧪 Probando integración OpenRouter/DeepSeek V3...\n');
  
  try {
    // Test básico de chatDesign
    const result = await chatDesign(
      [],
      'Hola, necesito un armario de 1800x2400x600mm con 2 puertas y un estante',
      {}
    );
    
    console.log('✅ Comando ejecutado exitosamente');
    console.log('Proveedor utilizado:', result.source);
    console.log('Mensaje:', result.message);
    
    if (result.params) {
      console.log('Parámetros extraídos:', {
        moduleType: result.params.moduleType,
        width: result.params.width,
        height: result.params.height,
        depth: result.params.depth
      });
    }
    
    if (result.source === 'openrouter-deepseek-v3') {
      console.log('\n🎉 ¡OpenRouter está funcionando como Tier 1!');
    } else {
      console.log(`\n🔍 Sistema usando fallback: ${result.source} (OpenRouter sin API_KEY)`);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

if (require.main === module) {
  testOpenRouter();
}

module.exports = { testOpenRouter };