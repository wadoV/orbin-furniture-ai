/**
 * Test para revisar normalizeDesignParams directamente desde el archivo
 */

// Copiar directamente la función de chat.js
function normalizeDesignParams(raw) {
  const p = { ...raw }

  // Numeric coercion
  const numFields = ['width', 'height', 'depth', 'thickness', 'numShelves', 'numDrawers', 'numDividers', 'drawerHeight', 'baseboardHeight', 'backThickness']
  for (const f of numFields) {
    if (p[f] !== undefined) {
      p[f] = Number(p[f])
      if (isNaN(p[f]) || !isFinite(p[f])) delete p[f]
    }
  }

  // Apply defaults for missing structural fields
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

  // Clamp to safe ranges (don't reject — clamp silently so chat never crashes engine)
  if (p.width  < 100)  p.width  = 100
  if (p.width  > 6000) p.width  = 6000
  if (p.height < 200)  p.height = 200
  if (p.height > 3500) p.height = 3500
  if (p.depth  < 100)  p.depth  = 100
  if (p.depth  > 1000) p.depth  = 1000

  // type → moduleType mapping
  if (!p.moduleType) {
    const typeMap = { kitchen_low: 'base', kitchen_high: 'aereo', kitchen_island: 'base', closet: 'standard' }
    p.moduleType = typeMap[p.type] || 'standard'
  }

  // Cross-field: thickness must be less than half the width
  if (p.thickness <= 0 || p.thickness >= p.width / 2) {
    p.thickness = Math.min(18, Math.floor(p.width / 4))
  }
  // Cross-field: baseboard height must be less than total height
  if (p.baseboard && p.baseboardHeight >= p.height) {
    p.baseboardHeight = Math.min(100, Math.floor(p.height / 4))
  }

  return p
}

function probarNormalizacion() {
  console.log('🧪 Probando normalizeDesignParams con casos extremos...\n');
  
  const testCases = [
    { desc: 'Parámetros NULL', params: null },
    { desc: 'Parámetros UNDEFINED', params: undefined },
    { desc: 'Objeto vacío', params: {} },
    { desc: 'Objeto con valores faltantes', params: { width: 2000, height: null } },
    { desc: 'Objeto válido normal', params: { width: 1800, height: 2400, depth: 600 } }
  ];
  
  for (const test of testCases) {
    try {
      console.log(`📝 ${test.desc}:`);
      console.log('   Input:', test.params);
      
      let result;
      if (test.params === null || test.params === undefined) {
        // Voy a probar el comportamiento real en el código
        const p = { ...test.params };
        console.log('   { ...raw } con:', typeof test.params, '=', p);
      }
      
      result = normalizeDesignParams(test.params);
      console.log('   Output:', JSON.stringify(result));
      console.log('   ✅ Sin error\n');
      
    } catch (error) {
      console.log('   ❌ ERROR:', error.message);
      console.log('   Stack:', error.stack.split('\n')[0]);
      console.log('');
    }
  }
}

if (require.main === module) {
  probarNormalizacion();
}