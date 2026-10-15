/**
 * Test para encontrar el error 500 específico al enviar "hola"
 */

const { normalizeDesignParams } = require('./src/routes/chat');

function probarNormalizacion() {
  console.log('🧪 Probando normalizeDesignParams con null...');
  
  try {
    // Test donde podría estar el error
    const params = null;
    
    // Esto es lo que falla en el código actual
    const safe = normalizeDesignParams(params);
    console.log('✅ normalizeDesignParams(null) =', safe);
    
  } catch (error) {
    console.log('❌ ERROR en normalizeDesignParams(null):', error.message);
    console.log('Stack:', error.stack);
  }
  
  // Probar con objeto vacío también
  try {
    const safe = normalizeDesignParams({});
    console.log('✅ normalizeDesignParams({}) =', JSON.stringify(safe, null, 2));
  } catch (error) {
    console.log('❌ ERROR en normalizeDesignParams({}):', error.message);
  }
}

function probarAccesoPropiedadesNull() {
  console.log('\n🧪 Probando acceso a propiedades de null...');
  
  const testCases = [
    { desc: 'Objeto null', obj: null, prop: 'width' },
    { desc: 'Objeto undefined', obj: undefined, prop: 'moduleType' },
    { desc: 'Objeto vacío', obj: {}, prop: 'height' },
  ];
  
  for (const test of testCases) {
    try {
      const value = test.obj && test.obj[test.prop];
      console.log(`✅ ${test.desc}.${test.prop} = ${value} (sin error)`);
    } catch (error) {
      console.log(`❌ ERROR en ${test.desc}.${test.prop}:`, error.message);
    }
  }
  
  // Probar algunas funciones que podrían fallar
  console.log('\n🧪 Revisando código problemático potencial...');
  
  // Comportamiento de Array.isArray con null
  console.log('Array.isArray(null):', Array.isArray(null));
  console.log('Array.isArray(undefined):', Array.isArray(undefined));
  
  // Comportamiento de spread operator con null
  try {
    const arr1 = [...(null || [])];
    const arr2 = [...(undefined || [])];
    console.log('Spread con null/undefined OK:', arr1, arr2);
  } catch (error) {
    console.log('ERROR en spread con null:', error.message);
  }
}

if (require.main === module) {
  probarNormalizacion();
  probarAccesoPropiedadesNull();
}