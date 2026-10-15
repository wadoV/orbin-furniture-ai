/**
 * Script para reparar encoding del archivo chat.js
 */

const fs = require('fs');
const path = require('path');

function fixEncoding() {
  const filePath = path.join(__dirname, 'src', 'routes', 'chat.js');
  
  console.log('Leyendo archivo chat.js...');
  
  try {
    // Leer el archivo como buffer
    const buffer = fs.readFileSync(filePath);
    
    // Convertir a string con diferentes encodings
    let content;
    
    // Probar UTF-8 primero
    try {
      content = buffer.toString('utf8');
      console.log('✅ Archivo leído como UTF-8');
    } catch (error) {
      console.log('UTF-8 falló, probando latin1...');
      content = buffer.toString('latin1');
    }
    
    // Mostrar fragmento problemático
    const lines = content.split('\n');
    const problemSection = [];
    
    for (let i = 170; i < Math.min(230, lines.length); i++) {
      problemSection.push(`${i}: ${lines[i]}`);
    }
    
    console.log('\nFragmento problemático (líneas 170-230):');
    console.log(problemSection.join('\n').substring(0, 1000) + '...');
    
    // Buscar y reemplazar secciones con encoding corrupto
    const fixedContent = content
      .replace(/Â¡/g, '¡')
      .replace(/Â¿/g, '¿')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã\u00AD/g, 'í')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã©/g, 'é')
      .replace(/Â/g, '')
      .replace(/Ã/g, '');
    
    // Escribir archivo corregido
    fs.writeFileSync(filePath + '.fixed', fixedContent, 'utf8');
    console.log('\n✅ Archivo corregido guardado como chat.js.fixed');
    
    // Mostrar fragmento corregido
    const fixedLines = fixedContent.split('\n');
    const fixedSection = [];
    
    for (let i = 170; i < Math.min(230, fixedLines.length); i++) {
      fixedSection.push(`${i}: ${fixedLines[i]}`);
    }
    
    console.log('\nFragmento corregido:');
    console.log(fixedSection.join('\n').substring(0, 1000) + '...');
    
  } catch (error) {
    console.error('Error al procesar archivo:', error.message);
  }
}

if (require.main === module) {
  fixEncoding();
}