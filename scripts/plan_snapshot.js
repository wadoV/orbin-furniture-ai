const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const planGeneratorSrc = path.join(rootDir, 'client/src/engine/planGenerator.js');
const planGeneratorDst = path.join(rootDir, 'scripts/planGenerator.cjs');
const outputDir = path.join(rootDir, '_plan_review');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Bundling planGenerator.js with esbuild...');
try {
  execSync(`npx esbuild "${planGeneratorSrc}" --bundle --format=cjs --platform=node --external:three --outfile="${planGeneratorDst}"`, { cwd: rootDir, stdio: 'inherit' });
} catch (err) {
  console.error('Failed to bundle planGenerator.js:', err.message);
  process.exit(1);
}

// Load generator and engine
const { generateModulePlanSVG, generateConjuntoPlanSVG } = require('./planGenerator.cjs');
const { generateProject } = require('../server/src/engine/closetEngine');

const langs = ['ES', 'PT', 'EN'];
const moduleTypes = ['desk', 'base', 'aereo', 'standard'];

const companyInfo = {
  empresa: 'Test Company',
  setor: 'Montaje',
  desenhista: 'Dev',
  material: 'MDF 18mm'
};

const normalizedScales = [1, 2, 5, 10, 20, 25, 50, 100, 200];

// Language markers
const pieceMarkers = {
  ES: '>PIEZA<',
  PT: '>PEÇA<',
  EN: '>PIECE<'
};
const floorMarkers = {
  ES: 'del piso',
  PT: 'do piso',
  EN: 'from floor'
};

const generatedFiles = [];

console.log('Generating drawings and running assertions...');

for (const lang of langs) {
  const mods = [];
  
  for (const mt of moduleTypes) {
    // Generate actual engine pieces
    const d = generateProject({
      moduleType: mt,
      width: mt === 'aereo' ? 800 : 1200,
      height: mt === 'desk' ? 750 : (mt === 'base' ? 900 : (mt === 'aereo' ? 700 : 2000)),
      depth: mt === 'aereo' ? 350 : 600,
      numDrawers: mt === 'desk' ? 3 : 0,
      hasDoors: mt !== 'desk',
      numDoors: 2
    });
    
    const mod = {
      id: d.id,
      configuration: d.configuration,
      pieces: d.pieces,
      specAdjustments: d.specAdjustments
    };
    mods.push(mod);
    
    // Generate Module Plan SVG
    const moduleSvg = generateModulePlanSVG(mod, { theme: 'print', lang, company: companyInfo });
    const moduleFile = `plan_${mt}_${lang.toLowerCase()}.svg`;
    const moduleFilePath = path.join(outputDir, moduleFile);
    fs.writeFileSync(moduleFilePath, moduleSvg);
    generatedFiles.push(moduleFile);
    
    // ASSERTION 1: No undefined or NaN or unsubstituted placeholders
    if (moduleSvg.includes('undefined')) throw new Error(`${moduleFile} contains "undefined"`);
    if (moduleSvg.includes('NaN')) throw new Error(`${moduleFile} contains "NaN"`);
    if (/\{[htwb]t?\}/.test(moduleSvg)) throw new Error(`${moduleFile} contains unsubstituted placeholder`);
    
    // ASSERTION 2: Language coherence (piece marker)
    const correctPieceMarker = pieceMarkers[lang];
    if (!moduleSvg.includes(correctPieceMarker)) {
      throw new Error(`${moduleFile} is missing expected piece marker: "${correctPieceMarker}"`);
    }
    for (const [otherLang, otherMarker] of Object.entries(pieceMarkers)) {
      if (otherLang !== lang && moduleSvg.includes(otherMarker)) {
        throw new Error(`${moduleFile} contains unexpected piece marker: "${otherMarker}"`);
      }
    }
    
    // ASSERTION 4: Contextual legend for desk/wardrobe
    if (mt === 'desk') {
      const hasApronMarker = moduleSvg.includes('stroke-dasharray') || moduleSvg.includes('pieza oculta') || moduleSvg.includes('peça oculta') || moduleSvg.includes('hidden part');
      if (!hasApronMarker) throw new Error(`${moduleFile} (desk) does not contain modesty/apron convention in legend`);
      
      if (moduleSvg.includes('División de puerta') || moduleSvg.includes('Divisão de porta') || moduleSvg.includes('Door split')) {
        throw new Error(`${moduleFile} (desk) contains door-split legend entry`);
      }
      if (moduleSvg.includes('Zócalo') || moduleSvg.includes('Rodapé') || moduleSvg.includes('Plinth')) {
        throw new Error(`${moduleFile} (desk) contains plinth/zócalo legend entry`);
      }
    } else if (mt === 'standard') {
      const hasDoorSplit = moduleSvg.includes('División de puerta') || moduleSvg.includes('Divisão de porta') || moduleSvg.includes('Door split');
      const hasPlinth = moduleSvg.includes('Zócalo') || moduleSvg.includes('Rodapé') || moduleSvg.includes('Plinth');
      if (!hasDoorSplit) throw new Error(`${moduleFile} (standard) is missing door-split legend entry`);
      if (!hasPlinth) throw new Error(`${moduleFile} (standard) is missing plinth/zócalo legend entry`);
      
      if (moduleSvg.includes('apron') || moduleSvg.includes('faldón') || moduleSvg.includes('saia')) {
        throw new Error(`${moduleFile} (standard) contains modesty/apron legend entries`);
      }
    }
    
    // ASSERTION 5: Scale label normalized ratio
    const scaleMatch = moduleSvg.match(/esc\.\s*(?:≈)?1:(\d+)/);
    if (!scaleMatch) throw new Error(`No scale label found in ${moduleFile}`);
    const ratio = parseInt(scaleMatch[1], 10);
    if (!normalizedScales.includes(ratio)) {
      throw new Error(`Scale ratio 1:${ratio} in ${moduleFile} is not a normalized scale!`);
    }
    if (mt === 'desk' && ratio === 2) {
      throw new Error(`${moduleFile} (desk) has incorrect scale label 1:2`);
    }
  }
  
  // Generate Conjunto (Assembly) Plan SVG
  const conjuntoSvg = generateConjuntoPlanSVG(mods, { theme: 'print', lang, company: companyInfo });
  const conjuntoFile = `conjunto_${lang.toLowerCase()}.svg`;
  const conjuntoFilePath = path.join(outputDir, conjuntoFile);
  fs.writeFileSync(conjuntoFilePath, conjuntoSvg);
  generatedFiles.push(conjuntoFile);
  
  // ASSERTION 1: No undefined or NaN or unsubstituted placeholders
  if (conjuntoSvg.includes('undefined')) throw new Error(`${conjuntoFile} contains "undefined"`);
  if (conjuntoSvg.includes('NaN')) throw new Error(`${conjuntoFile} contains "NaN"`);
  if (/\{[htwb]t?\}/.test(conjuntoSvg)) throw new Error(`${conjuntoFile} contains unsubstituted placeholder`);
  
  // ASSERTION 2: Language coherence (piece & floor markers)
  const correctPieceMarker = pieceMarkers[lang];
  if (!conjuntoSvg.includes(correctPieceMarker)) {
    throw new Error(`${conjuntoFile} is missing expected piece marker: "${correctPieceMarker}"`);
  }
  for (const [otherLang, otherMarker] of Object.entries(pieceMarkers)) {
    if (otherLang !== lang && conjuntoSvg.includes(otherMarker)) {
      throw new Error(`${conjuntoFile} contains unexpected piece marker: "${otherMarker}"`);
    }
  }
  
  const correctFloorMarker = floorMarkers[lang];
  if (!conjuntoSvg.includes(correctFloorMarker)) {
    throw new Error(`${conjuntoFile} is missing expected floor marker: "${correctFloorMarker}"`);
  }
  for (const [otherLang, otherMarker] of Object.entries(floorMarkers)) {
    if (otherLang !== lang && conjuntoSvg.includes(otherMarker)) {
      throw new Error(`${conjuntoFile} contains unexpected floor marker: "${otherMarker}"`);
    }
  }
  
  // ASSERTION 3: No overflow in drawing band (y <= 538 in top half)
  const parts = conjuntoSvg.split('y1="540"');
  if (parts.length < 2) throw new Error(`${conjuntoFile} does not contain cut-list separator line at y1="540"`);
  const topHalf = parts[0];
  const yMatches = topHalf.matchAll(/(?:y|y1|y2)="(-?\d+(?:\.\d+)?)"/g);
  for (const match of yMatches) {
    const yVal = parseFloat(match[1]);
    if (yVal > 538) {
      throw new Error(`${conjuntoFile} has element in top half with y-coordinate ${yVal} exceeding 538!`);
    }
  }
}

console.log('All SVGs generated and validated successfully!');

// ── Rasterizado a PNG ────────────────────────────────────────────────────────
// ★ 2026-07-26 — HONESTIDAD DEL PIPELINE. Antes cada fallo de cairosvg se tragaba con
//   un console.warn y el script terminaba diciendo "completed!" con exit 0. En Windows
//   cairocffi necesita las DLL nativas de Cairo, así que fallaban LAS 36 y el reporte
//   igual salía verde: el paso visual NO se ejecutaba y nadie se enteraba.
//   Un gate que informa verde cuando un paso no corrió es peor que no tener gate.
//   Ahora el resultado del rasterizado se CUENTA y se informa explícitamente, y con
//   --require-png (CI) la ausencia de PNG es un fallo duro.
const requirePng = process.argv.includes('--require-png');
console.log('\nRasterizing SVGs to PNGs using cairosvg...');
let rasterOk = 0;
const rasterFailed = [];
let firstRasterError = null;
for (const file of generatedFiles) {
  const baseName = path.basename(file, '.svg');
  const svgPath = path.join(outputDir, file);
  const pngPath = path.join(outputDir, `${baseName}.png`);
  try {
    execSync(`python -c "import cairosvg; cairosvg.svg2png(url='${svgPath.replace(/\\/g, '/')}', write_to='${pngPath.replace(/\\/g, '/')}', output_width=1200)"`, { cwd: rootDir, stdio: 'pipe' });
    rasterOk++;
  } catch (err) {
    rasterFailed.push(file);
    if (!firstRasterError) firstRasterError = String(err.message || err).split('\n').slice(-3).join(' ').trim();
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(`ASSERTIONS : ${generatedFiles.length}/${generatedFiles.length} SVG validados · OK`);
if (rasterFailed.length === 0) {
  console.log(`RASTERIZADO: ${rasterOk}/${generatedFiles.length} PNG generados en _plan_review/ · OK`);
  console.log('──────────────────────────────────────────────────────────────');
  console.log('Pipeline completo: las aserciones pasaron Y hay PNG para revisar a ojo.');
} else {
  console.log(`RASTERIZADO: ${rasterOk}/${generatedFiles.length} PNG generados · ${rasterFailed.length} FALLARON`);
  console.log('──────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  ⚠  ATENCIÓN — LA VERIFICACIÓN VISUAL NO SE EJECUTÓ  ⚠');
  console.log('');
  console.log('  Las aserciones automáticas pasaron, pero sólo miran el TEXTO del SVG.');
  console.log('  Sin PNG no hay nada que revisar a ojo: un plano puede estar validado');
  console.log('  y verse mal igual (solapes, cortes, proporciones).');
  if (firstRasterError) console.log(`\n  Causa: ${firstRasterError}`);
  console.log('');
  console.log('  En Windows, cairosvg necesita las DLL nativas de Cairo. Opciones:');
  console.log('    · pip install cairosvg  y  instalar GTK3 Runtime (trae libcairo-2.dll)');
  console.log('    · o abrir los .svg de _plan_review/ directamente en el navegador');
  console.log('');
  if (requirePng) {
    console.error('  --require-png activo → fallo duro.');
    process.exit(1);
  }
  console.log('  (Usá --require-png para que esto sea un fallo duro en CI.)');
}
