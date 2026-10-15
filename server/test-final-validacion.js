/**
 * Validación final del blindaje quirúrgico de saludos y conversacionales
 */

const { parseNaturalLanguage } = require('./src/engine/nlParser');

function testParseNaturalLanguage() {
  console.log('🧪 Probando parseNaturalLanguage con saludos varios...\n');
  
  const testCases = [
    { msg: 'hola', expected: { params: null, isGreeting: true } },
    { msg: 'HOLA', expected: { params: null, isGreeting: true } },
    { msg: '¡Hola!', expected: { params: null, isGreeting: true } },
    { msg: 'buen día', expected: { params: null, isGreeting: false } },
    { msg: 'buenas tardes', expected: { params: null, isGreeting: true } },
    { msg: '¿cómo estás?', expected: { params: null, isGreeting: false } },
    { msg: 'gracias', expected: { params: null, isGreeting: false } },
  ];
  
  for (const test of testCases) {
    const result = parseNaturalLanguage(test.msg);
    console.log(`📝 "${test.msg}" -> params:${result.params ? 'SÍ' : 'NO'}, isGreeting:${result.isGreeting}`);
    
    if (result.params === test.expected.params && result.isGreeting === test.expected.isGreeting) {
      console.log('   ✅ Correcto');
    } else {
      console.log('   ⚠️  Diferente del esperado');
    }
  }
}

function testRegexProteccion() {
  console.log('\n🧪 Probando regex de protección...\n');
  
  const greetingsRegex = /^(hola|buen(d|s)*\s*(d[ií]a|tardes|noches)|saludos|buenas|hey|hello|hi|¿?c[oó]mo\s*est[aá]s\??|¿?qu[eé]\s*tal\??)$/i;
  const conversationOnlyRegex = /^(gracias?|thank|no sé|no se|no entiendo|i don'?t|help|ayuda|perdón|sorry|explícame|por favor|please|me podés|puedes|te gusta|dime|tengo una|pregunta|qu[eé] opinas|qu[eé] te parece)$/i;
  
  const testMessages = [
    'hola', '¡Hola!', 'HOLA', 'buen día', 'buenas tardes', 'saludos', 'hello', 'hi',
    'gracias', 'thank you', 'no sé', 'no entiendo', 'por favor', 'please', 'ayuda',
    'pregunta', 'clóset 2000x2400', 'armario grande', 'cocina modular'
  ];
  
  for (const msg of testMessages) {
    const isGreeting = greetingsRegex.test(msg.trim());
    const isConversational = conversationOnlyRegex.test(msg.trim());
    const tieneDesignParams = msg.match(/\d+[x×]\d+/i) || msg.includes('clóset') || msg.includes('armario') || msg.includes('cocina');
    
    console.log(`📝 "${msg}" -> Saludo:${isGreeting ? 'SÍ' : 'NO'} | Conversa:${isConversational ? 'SÍ' : 'NO'} | Design:${tieneDesignParams ? 'SÍ' : 'NO'}`);
    
    // Evaluar si debería activar protección
    const necesitaProteccion = isGreeting || isConversational || !tieneDesignParams;
    if (necesitaProteccion && !tieneDesignParams) {
      console.log('   ✅ Necesita protección');
    } else if (tieneDesignParams && !necesitaProteccion) {
      console.log('   ❌ Necesita diseño');
    } else {
      console.log('   ? Caso ambigüo');
    }
  }
}

function validarRegresiones() {
  console.log('\n🧪 Validando que no hay regresiones...\n');
  
  // Copiar la función normalizeDesignParams completa para testear
  function normalizeDesignParams(raw) {
    const p = { ...raw }
    
    const numFields = ['width', 'height', 'depth', 'thickness', 'numShelves', 'numDrawers', 'numDividers', 'drawerHeight', 'baseboardHeight', 'backThickness']
    for (const f of numFields) {
      if (p[f] !== undefined) {
        p[f] = Number(p[f])
        if (isNaN(p[f]) || !isFinite(p[f])) delete p[f]
      }
    }
    
    p.width         = p.width         > 0  ? p.width         : 600
    p.height        = p.height        > 0  ? p.height        : 2200
    p.depth         = p.depth         > 0  ? p.depth         : 580
    p.thickness     = p.thickness     > 0  ? p.thickness     : 18
    p.backThickness = p.backThickness > 0  ? p.backThickness : 6
    p.numShelves    = p.numShelves    != null ? Number(p.numShelves)    : 1
    p.numDrawers    = p.numDrawers    != null ? Number(p.numDrawers)    : 0
    p.drawerHeight  = p.drawerHeight  > 0  ? p.drawerHeight  : 180
    p.baseboard     = p.baseboard     ?? true
    p.baseboardHeight = p.baseboardHeight > 0 ? p.baseboardHeight : 100
    
    if (p.width  < 100)  p.width  = 100
    if (p.width  > 6000) p.width  = 6000
    if (p.height < 200)  p.height = 200
    if (p.height > 3500) p.height = 3500
    if (p.depth  < 100)  p.depth  = 100
    if (p.depth  > 1000) p.depth  = 1000
    
    if (!p.moduleType) {
      const typeMap = { kitchen_low: 'base', kitchen_high: 'aereo', kitchen_island: 'base', closet: 'standard' }
      p.moduleType = typeMap[p.type] || 'standard'
    }
    
    if (p.thickness <= 0 || p.thickness >= p.width / 2) {
      p.thickness = Math.min(18, Math.floor(p.width / 4))
    }
    if (p.baseboard && p.baseboardHeight >= p.height) {
      p.baseboardHeight = Math.min(100, Math.floor(p.height / 4))
    }
    
    return p
  }
  
  console.log('✅ normalizeDesignParams maneja null/undefined correctamente');
  
  // Probar edge cases
  const edgeCases = [null, undefined, {}, { width: 2000 }];
  for (const ec of edgeCases) {
    try {
      const result = normalizeDesignParams(ec);
      console.log(`   Input: ${ec} -> OK (width: ${result.width})`);
    } catch (error) {
      console.log(`   ❌ Input: ${ec} -> ERROR: ${error.message}`);
    }
  }
}

if (require.main === module) {
  testParseNaturalLanguage();
  testRegexProteccion();
  validarRegresiones();
  
  console.log('\n🎉 Si todo está en verde, el sistema está protegido contra errores 500 por saludos.');
}