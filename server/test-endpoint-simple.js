/**
 * Test simple del endpoint sin middleware de auth
 */

async function testSimple() {
  console.log('🧪 Probando flujo de saludos directamente...\n');
  
  // Probar chatDesign directamente
  try {
    const { chatDesign } = require('./src/ai/aiOrchestrator');
    
    console.log('1. Probando "hola" con chatDesign...');
    const result = await chatDesign([], 'hola');
    
    console.log('   Resultado:');
    console.log('     params:', result.params);
    console.log('     source:', result.source);
    console.log('     isGreeting:', result.isGreeting);
    console.log('     reply (50 chars):', result.reply?.substring(0, 50));
    
    // Verificar que sea un saludo exitoso
    if (result.params === null && result.isGreeting) {
      console.log('✅ "hola" funciona correctamente - params:null, isGreeting:true');
    } else {
      console.log('❌ "hola" no se detectó como saludo');
    }
    
    // Test con mensaje de diseño
    console.log('\n2. Probando diseño normal...');
    const designResult = await chatDesign([], 'closet 2000x2400x600');
    
    console.log('   Resultado:');
    console.log('     params:', designResult.params ? 'SÍ (object)' : 'NULL');
    console.log('     source:', designResult.source);
    console.log('     isGreeting:', designResult.isGreeting);
    
    if (designResult.params && typeof designResult.params === 'object') {
      console.log('✅ Diseño funciona correctamente - params presentes');
    } else {
      console.log('❌ Diseño no generó parámetros');
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
  }
}

// Test separado para endpoint con curl/Invoke-RestMethod
function testWithCurl() {
  console.log('\n3. Instrucciones para probar con curl/Invoke-RestMethod:');
  console.log('');
  console.log('Con PowerShell (si el servidor está corriendo en puerto 3000):');
  console.log('```powershell');
  console.log('$body = @{"message" = "hola"; "sessionId" = "test-session"; "lang" = "ES"} | ConvertTo-Json');
  console.log('$headers = @{"Content-Type" = "application/json"; "Authorization" = "Bearer dev-token"}');
  console.log('Invoke-RestMethod -Uri "http://localhost:3000/api/chat/design" -Method POST -Body $body -Headers $headers');
  console.log('```');
  console.log('');
  console.log('Con curl:');
  console.log('```bash');
  console.log('curl -X POST \\');
  console.log('  http://localhost:3000/api/chat/design \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "Authorization: Bearer dev-token" \\');
  console.log('  -d \'{"message": "hola", "sessionId": "test-session", "lang": "ES"}\'');
  console.log('```');
}

if (require.main === module) {
  testSimple().then(() => {
    testWithCurl();
  });
}