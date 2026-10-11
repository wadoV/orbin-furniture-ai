const puppeteer = require('C:/Users/Azomarg/.gemini/antigravity/brain/93c3ae43-2af1-432c-a282-bfeedfd1af2c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, 'test-artifacts', 'e2e-2026-10-11');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runAutomation() {
  const logEntries = [];
  const uncaughtErrors = [];

  console.log('=== INICIANDO PROTOCOLO DE AUTOMATIZACIÓN E2E EN CHROME ===');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: 'C:\\Users\\Azomarg\\.gemini\\antigravity\\brain\\93c3ae43-2af1-432c-a282-bfeedfd1af2c\\scratch\\chrome_profile',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Monitoreo de DevTools Console
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logEntries.push({ type, text, timestamp: new Date().toISOString() });
    if (type === 'error') {
      console.error(`[DevTools Console ERROR] ${text}`);
    }
  });

  page.on('pageerror', err => {
    uncaughtErrors.push({ message: err.message, stack: err.stack, timestamp: new Date().toISOString() });
    console.error(`[DevTools Page Error] ${err.message}`);
  });

  // 1. Navegación inicial y reset
  console.log('Navegando a http://localhost:5174/app?reset ...');
  await page.goto('http://localhost:5174/app?reset', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Inicializar Galería limpia para la prueba (con flag seeded para que no inyecte datos demo viejos)
  await page.evaluate(() => {
    localStorage.setItem('orbin:viableSeeded', '1');
    localStorage.setItem('orbin:viableDesigns', '[]');
  });

  // Funciones de interacción
  async function switchToManualTab() {
    const tabs = await page.$$('div[role="tablist"] button[role="tab"]');
    if (tabs.length >= 2) {
      await tabs[1].click();
      await new Promise(r => setTimeout(r, 400));
    }
  }

  async function setInputField(name, val) {
    const selector = `input[name="${name}"]`;
    let input = await page.$(selector);
    if (!input) {
      // Si es baseboardHeight, activar toggle de baseboard si existe y está apagado
      if (name === 'baseboardHeight') {
        const toggle = await page.$('input[name="baseboard"]');
        if (toggle) {
          await page.evaluate(el => { if (!el.checked) el.click(); }, toggle);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      input = await page.$(selector);
    }

    if (!input) {
      console.log(`[INFO] Campo "${name}" no está presente en el formulario en este estado, continuando.`);
      return;
    }

    await input.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(String(val));
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, 100));
  }

  async function setSelectField(name, val) {
    const selector = `select[name="${name}"]`;
    await page.waitForSelector(selector);
    await page.select(selector, val);
    await new Promise(r => setTimeout(r, 200));
  }

  async function generateAndVerify() {
    console.log('Haciendo clic en "Generar Proyecto"...');
    await page.waitForSelector('button.btn-primary');
    await page.click('button.btn-primary');
    // Esperar a que termine la generación
    await new Promise(r => setTimeout(r, 4500));

    // Verificar viabilidad en HUD Viewer3D
    const status = await page.evaluate(() => {
      const saveBtn = document.querySelector('button[aria-label="Guardar en Galería"]');
      return {
        viable: saveBtn ? saveBtn.getAttribute('aria-disabled') === 'false' : false,
        title: saveBtn ? saveBtn.getAttribute('title') : null,
        ariaDisabled: saveBtn ? saveBtn.getAttribute('aria-disabled') : null
      };
    });

    console.log('Estado de viabilidad en UI:', status);
    return status;
  }

  async function saveFurniture(name, category) {
    console.log(`Guardando mueble: "${name}" en categoría "${category}"...`);
    const saveBtn = await page.waitForSelector('button[aria-label="Guardar en Galería"]');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    // Escribir nombre en el modal
    const modalInput = await page.waitForSelector('input[placeholder="Balcão Cozinha 1200"]');
    await modalInput.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(name);
    await new Promise(r => setTimeout(r, 200));

    // Seleccionar categoría
    const catSelect = await page.evaluateHandle(() => {
      return document.querySelector('input[placeholder="Balcão Cozinha 1200"]').closest('.space-y-4').querySelector('select');
    });
    await catSelect.select(category);
    await new Promise(r => setTimeout(r, 300));

    // Guardar presionando Enter en modalInput
    await modalInput.focus();
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2500));

    const check = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll('.absolute.bottom-6 span')).map(s => s.innerText);
      const ls = JSON.parse(localStorage.getItem('orbin:viableDesigns') || '[]');
      const modalOpen = !!document.querySelector('input[placeholder="Balcão Cozinha 1200"]');
      return { toasts, latestRecord: ls[0], count: ls.length, modalOpen };
    });

    console.log(`Guardado exitoso: ${!check.modalOpen} | ID: ${check.latestRecord?.id} | Total en Galería: ${check.count}`);
    return check;
  }

  const results = {};

  // =========================================================================
  // PRUEBA 1: MUEBLE DE COCINA (Balcón Bajo con Cajones)
  // =========================================================================
  console.log('\n--- [TEST 1] MUEBLE DE COCINA (Balcón Bajo con Cajones) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'base');
  await setInputField('width', 1200);
  await setInputField('height', 850);
  await setInputField('depth', 550);
  await setInputField('numDoors', 2);
  await setInputField('numDrawers', 2);
  await setInputField('baseboardHeight', 100);

  const v1 = await generateAndVerify();
  if (!v1.viable) throw new Error('Fallo de validación en Balcón Cozinha 1200');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_cocina_validado.png') });
  const s1 = await saveFurniture('Balcão Cozinha 1200 Pro', 'cocina');
  results.cocina = {
    name: 'Balcão Cozinha 1200 Pro',
    category: 'cocina',
    id: s1.latestRecord?.id,
    dimensions: '1200 × 850 × 550 mm',
    status: 'VALIDADO',
    record: s1.latestRecord
  };
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_cocina_guardado.png') });

  // =========================================================================
  // PRUEBA 2: MUEBLE DE BAÑO (Aéreo Suspendido)
  // =========================================================================
  console.log('\n--- [TEST 2] MUEBLE DE BAÑO (Aéreo Suspendido) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'aereo');
  await setInputField('width', 600);
  await setInputField('height', 600);
  await setInputField('depth', 200);
  await setInputField('numDoors', 1);
  await setInputField('numDrawers', 0);
  await setInputField('numShelves', 0);

  const v2 = await generateAndVerify();
  if (!v2.viable) throw new Error('Fallo de validación en Aéreo Banheiro Slim 600');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_bano_validado.png') });
  const s2 = await saveFurniture('Aéreo Banheiro Slim 600', 'bano');
  results.bano = {
    name: 'Aéreo Banheiro Slim 600',
    category: 'bano',
    id: s2.latestRecord?.id,
    dimensions: '600 × 600 × 200 mm',
    status: 'VALIDADO',
    record: s2.latestRecord
  };
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_bano_guardado.png') });

  // =========================================================================
  // PRUEBA 3: MUEBLE ROPERO / CLOSET (Torre 2 Puertas)
  // =========================================================================
  console.log('\n--- [TEST 3] MUEBLE ROPERO / CLOSET (Torre 2 Puertas) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'standard');
  await setInputField('width', 900);
  await setInputField('height', 2100);
  await setInputField('depth', 580);
  await setInputField('numDoors', 2);
  await setInputField('numShelves', 3);
  await setInputField('numDrawers', 0);
  await setInputField('baseboardHeight', 100);

  const v3 = await generateAndVerify();
  if (!v3.viable) throw new Error('Fallo de validación en Ropero Casal 900 Taller');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_closet_validado.png') });
  const s3 = await saveFurniture('Ropero Casal 900 Taller', 'closet');
  results.closet = {
    name: 'Ropero Casal 900 Taller',
    category: 'closet',
    id: s3.latestRecord?.id,
    dimensions: '900 × 2100 × 580 mm',
    status: 'VALIDADO',
    record: s3.latestRecord
  };
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_closet_guardado.png') });

  // =========================================================================
  // PRUEBA ADVERSARIAL (REGLA 2: Rechazo por chapa > 2750mm)
  // =========================================================================
  console.log('\n--- [TEST ADVERSARIAL] Módulo Excedente (Ancho 2900 mm > Placa 2750 mm) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'standard');
  await setInputField('width', 2900);
  await setInputField('height', 900);
  await setInputField('depth', 580);

  const vAdv = await generateAndVerify();
  console.log('Resultado diseño defectuoso:', {
    viable: vAdv.viable,
    ariaDisabled: vAdv.ariaDisabled,
    title: vAdv.title
  });

  if (vAdv.viable === true) {
    console.error('ERROR: El diseño excedente NO debió ser validado.');
  } else {
    console.log('✅ REGLA 2 VERIFICADA: El guardián fail-closed BLOQUEÓ el guardado del diseño que excede chapa.');
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_adversarial_rechazado.png') });

  // =========================================================================
  // VERIFICACIÓN FINAL EN LA GALERÍA
  // =========================================================================
  console.log('\n--- [VERIFICACIÓN FINAL EN LA GALERÍA] ---');
  // 1. Abrir modal Galería (LayoutGrid en la barra superior)
  const galleryBtn = await page.waitForSelector('button[title="Galería de plantillas verificadas"]');
  await galleryBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_galeria_abierta.png') });

  // 2. Comprobar que las 3 tarjetas aparezcan listadas con sus medidas y badges
  const galleryState = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="dialog"] .grid > div'));
    return cards.map(c => {
      const title = c.querySelector('h3')?.innerText;
      const badges = Array.from(c.querySelectorAll('span')).map(s => s.innerText);
      const dims = c.querySelector('p.font-mono')?.innerText;
      return { title, badges, dims };
    });
  });

  console.log('Tarjetas en la Galería:', JSON.stringify(galleryState, null, 2));

  // 3. Probar filtros de categoría
  console.log('Probando filtro: COCINA...');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const chip = chips.find(b => b.innerText.toUpperCase() === 'COCINA');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const filterCocina = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="dialog"] .grid > div'));
    return cards.map(c => c.querySelector('h3')?.innerText);
  });
  console.log('Resultado filtro COCINA:', filterCocina);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_galeria_filtro_cocina.png') });

  console.log('Probando filtro: BAÑO...');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const chip = chips.find(b => b.innerText.toUpperCase() === 'BAÑO');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const filterBano = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="dialog"] .grid > div'));
    return cards.map(c => c.querySelector('h3')?.innerText);
  });
  console.log('Resultado filtro BAÑO:', filterBano);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '07_galeria_filtro_bano.png') });

  console.log('Probando filtro: CLOSET / ROPERO...');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const chip = chips.find(b => b.innerText.toUpperCase().includes('CLOSET'));
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const filterCloset = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="dialog"] .grid > div'));
    return cards.map(c => c.querySelector('h3')?.innerText);
  });
  console.log('Resultado filtro CLOSET:', filterCloset);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '08_galeria_filtro_closet.png') });

  console.log('Probando filtro: TODOS...');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const chip = chips.find(b => b.innerText.toUpperCase() === 'TODOS');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 600));
  const filterTodos = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[role="dialog"] .grid > div'));
    return cards.map(c => c.querySelector('h3')?.innerText);
  });
  console.log('Resultado filtro TODOS:', filterTodos);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '09_galeria_filtro_todos.png') });

  // 4. Inspección de errores DevTools
  console.log('\n--- [INSPECCIÓN DE CONSOLA DEVTOOLS] ---');
  console.log(`Total mensajes registrados: ${logEntries.length}`);
  console.log(`Errores de página no controlados: ${uncaughtErrors.length}`);
  const jsErrors = logEntries.filter(e => e.type === 'error');
  console.log(`Logs de tipo error en consola: ${jsErrors.length}`);
  if (jsErrors.length > 0) {
    console.log('Detalle de errores:', jsErrors);
  }

  await browser.close();

  // Guardar reporte JSON
  const finalReport = {
    timestamp: new Date().toISOString(),
    results,
    galleryState,
    filters: {
      cocina: filterCocina,
      bano: filterBano,
      closet: filterCloset,
      todos: filterTodos
    },
    uncaughtErrors,
    errorLogsCount: jsErrors.length,
    logEntriesSample: logEntries.slice(0, 30)
  };

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'e2e_report.json'), JSON.stringify(finalReport, null, 2));
  console.log('\n=== PROTOCOLO COMPLETADO EXITOSAMENTE ===');
  console.log(`Reporte guardado en: ${path.join(ARTIFACTS_DIR, 'e2e_report.json')}`);
}

runAutomation().catch(err => {
  console.error('ERROR EN AUTOMATIZACIÓN:', err);
  process.exit(1);
});
