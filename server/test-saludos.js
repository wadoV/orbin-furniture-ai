/**
 * Validación del blindaje quirúrgico de saludos en /api/chat/design
 * Ejecutar: node test-saludos.js
 */

const { chatDesign } = require('./src/ai/aiOrchestrator');

async function testSaludo() {
  console.log('🧪 Probando blindaje de saludos...\n');
  
  try {
    // Test de saludos varios
    const saludos = [
      'hola',
      'buen día',
      'buenas tardes',
      '¿cómo estás?',
      '¿qué tal?',
      'HOLA',
      'Hola Orbin',
      '¡Hola!',
      'Buenos días',
      'saludos'
    ];
    
    let testCount = 0;
    let successCount = 0;
    
    for (const saludo of saludos) {
      testCount++;
      try {
        const result = await chatDesign(
          [],
          saludo,
          {}
        );
        
        console.log(`✅ "${saludo}" - Parámetros: ${result.params ? 'SÍ' : 'NO'}, Fuente: ${result.source}`);
        
        if (result.params === null) {
          successCount++;
        } else {
          console.log(`   ⚠️  ¡ADVERTENCIA! El saludo debería devolver params:null`);
        }
        
      } catch (error) {
        console.log(`❌ "${saludo}" - ERROR: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Resultado: ${successCount}/${testCount} saludos manejados correctamente (params:null)`);
    
    if (successCount === testCount) {
      console.log('🎉 ¡Todos los saludos funcionan correctamente sin errores 500!');
    } else {
      console.log('⚠️  Algunos saludos necesitan ajustes');
    }
    
    // Test adicional: mensaje de diseño normal (debería tener parámetros)
    console.log('\n🧪 Probando mensaje de diseño...');
    const resultNormal = await chatDesign(
      [],
      'Necesito un clóset de 2000x2400x600mm',
      {}
    );
    
    console.log(`Parámetros: ${resultNormal.params ? 'SÍ' : 'NO'}, Fuente: ${resultNormal.source}`);
    
    if (resultNormal.params) {
      console.log('✅ Diseño normal funcionando correctamente');
    } else {
      console.log('❌ Error: Diseño normal debería tener parámetros');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba general:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  testSaludo();
}

module.exports = { testSaludo };