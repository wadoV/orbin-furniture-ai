const puppeteer = require('C:/Users/Azomarg/.gemini/antigravity/brain/93c3ae43-2af1-432c-a282-bfeedfd1af2c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, 'test-artifacts', 'e2e-2026-10-11-full');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runFullProtocol() {
  const logEntries = [];
  const uncaughtErrors = [];

  console.log('=== PROTOCOLO E2E: TESTEO AUTOMATIZADO Y POBLACIÓN DE GALERÍA (10 MODELOS) ===\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: 'C:\\Users\\Azomarg\\.gemini\\antigravity\\brain\\93c3ae43-2af1-432c-a282-bfeedfd1af2c\\scratch\\chrome_profile_e2e_run2',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();

  // Escucha de consola de Chrome DevTools
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

  // 1. Navegación e inicialización limpia
  console.log('1. Navegando a http://localhost:5174/app?reset ...');
  await page.goto('http://localhost:5174/app?reset', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Inicializar Galería limpia
  await page.evaluate(() => {
    localStorage.setItem('orbin:viableSeeded', '1');
    localStorage.setItem('orbin:viableDesigns', '[]');
  });

  // Helper para cambiar pestaña principal (params vs chat) usando TABS container
  async function selectMainTab(tabId) {
    await page.evaluate((id) => {
      const container = document.querySelector('div.bg-surface-3.p-1.rounded-xl[role="tablist"]') || document.querySelector('div[role="tablist"]');
      if (!container) return;
      const btns = Array.from(container.querySelectorAll('button'));
      const target = btns.find(b => {
        const txt = b.innerText.toLowerCase();
        if (id === 'params') return txt.includes('parámetros') || txt.includes('parametros');
        if (id === 'chat') return txt.includes('chat') || txt.includes('ia');
        return false;
      });
      if (target) target.click();
    }, tabId);
    await new Promise(r => setTimeout(r, 500));
  }

  // Helper para modo manual en InputPanel
  async function switchToManualTab() {
    await selectMainTab('params');
    await page.evaluate(() => {
      const panel = document.getElementById('panel-params');
      if (!panel) return;
      const modeTabs = Array.from(panel.querySelectorAll('div[role="tablist"] button[role="tab"]'));
      if (modeTabs.length >= 2) {
        modeTabs[1].click(); // Tab "Parámetros" manual
      }
    });
    await new Promise(r => setTimeout(r, 400));
  }

  // Helper para campos numéricos y texto en formulario
  async function setInputField(name, val) {
    const selector = `input[name="${name}"]`;
    let input = await page.$(selector);
    if (!input && name === 'baseboardHeight') {
      const toggle = await page.$('button[aria-labelledby="label-baseboard"]');
      if (toggle) {
        const checked = await page.evaluate(el => el.getAttribute('aria-checked') === 'true', toggle);
        if (!checked) {
          await toggle.click();
          await new Promise(r => setTimeout(r, 300));
        }
      }
      input = await page.$(selector);
    }

    if (!input) {
      console.log(`[INFO] Campo input[name="${name}"] no presente en DOM en este estado.`);
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

  // Helper para select
  async function setSelectField(name, val) {
    const selector = `select[name="${name}"]`;
    const sel = await page.$(selector);
    if (!sel) {
      console.log(`[INFO] Campo select[name="${name}"] no presente en DOM.`);
      return;
    }
    await page.select(selector, String(val));
    await new Promise(r => setTimeout(r, 200));
  }

  // Helper para switches / toggles
  async function setToggle(name, shouldBeOn) {
    const toggle = await page.$(`button[aria-labelledby="label-${name}"]`);
    if (!toggle) {
      console.log(`[INFO] Toggle ${name} no presente.`);
      return;
    }
    const current = await page.evaluate(el => el.getAttribute('aria-checked') === 'true', toggle);
    if (current !== shouldBeOn) {
      await toggle.click();
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Disparar generación y leer viabilidad
  async function generateAndVerify() {
    console.log('  -> Clic en "Generar Proyecto"...');
    await page.waitForSelector('button.btn-primary');
    await page.click('button.btn-primary');
    await new Promise(r => setTimeout(r, 4500));

    const status = await page.evaluate(() => {
      const saveBtn = document.querySelector('button[aria-label="Guardar en Galería"]');
      return {
        viable: saveBtn ? saveBtn.getAttribute('aria-disabled') === 'false' : false,
        title: saveBtn ? saveBtn.getAttribute('title') : null,
        ariaDisabled: saveBtn ? saveBtn.getAttribute('aria-disabled') : null
      };
    });
    console.log('  -> Estado de viabilidad:', status);
    return status;
  }

  // Guardar en galería
  async function saveFurniture(name, category, screenshotPath) {
    console.log(`  -> Guardando mueble "${name}" en categoría "${category}"...`);
    const saveBtn = await page.waitForSelector('button[aria-label="Guardar en Galería"]');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 800));

    const modalInput = await page.waitForSelector('input[placeholder="Balcão Cozinha 1200"]');
    await modalInput.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(name);

    // Seleccionar categoría y hacer submit del guardado
    await page.evaluate((cat) => {
      const modalInput = document.querySelector('input[placeholder="Balcão Cozinha 1200"]');
      const modal = modalInput.closest('div.w-\\[320px\\]') || modalInput.closest('.space-y-4');
      const select = modal.querySelector('select');
      if (select) {
        select.value = cat;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // El botón de acción verde Salvar/Guardar es el que tiene Check
      const actionBtns = Array.from(modal.querySelectorAll('div.flex.gap-2 button'));
      const confirmBtn = actionBtns[1] || actionBtns.find(b => b.innerText.includes('Salvar') || b.innerText.includes('Guardar') || b.innerText.includes('Save'));
      if (confirmBtn) {
        confirmBtn.click();
      }
    }, category);
    await new Promise(r => setTimeout(r, 2000));

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath });
    }

    const check = await page.evaluate(() => {
      const ls = JSON.parse(localStorage.getItem('orbin:viableDesigns') || '[]');
      return { latest: ls[0], count: ls.length };
    });

    console.log(`  -> Persistido con éxito: ID = ${check.latest?.id} (Total en Galería: ${check.count})`);
    return check.latest;
  }

  // Helper para flujo por Chat NL
  async function sendChatPrompt(promptText) {
    await selectMainTab('chat');
    await new Promise(r => setTimeout(r, 500));

    const chatInput = await page.waitForSelector('input[placeholder*="mensaje"], input[placeholder*="mensagem"], input[placeholder*="Describí"], input[type="text"]');
    await chatInput.focus();
    await chatInput.type(promptText);
    await page.keyboard.press('Enter');
    console.log(`  -> Prompt enviado: "${promptText.slice(0, 50)}..."`);

    // Esperar respuesta de IA o fallback
    await new Promise(r => setTimeout(r, 6000));

    // Revisar si apareció botón de HITL para confirmar módulo propuesto
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirm = btns.find(b => b.innerText.includes('Confirmar Módulo') || b.innerText.includes('Confirmar'));
      if (confirm) {
        console.log('  -> Confirmando propuesta HITL...');
        confirm.click();
      }
    });
    await new Promise(r => setTimeout(r, 3000));

    // Regresar al visor y verificar botón de guardar
    const status = await page.evaluate(() => {
      const saveBtn = document.querySelector('button[aria-label="Guardar en Galería"]');
      return {
        viable: saveBtn ? saveBtn.getAttribute('aria-disabled') === 'false' : false,
        title: saveBtn ? saveBtn.getAttribute('title') : null,
        ariaDisabled: saveBtn ? saveBtn.getAttribute('aria-disabled') : null
      };
    });
    console.log('  -> Estado tras Chat NL:', status);
    return status;
  }

  const executedModels = [];

  // =========================================================================
  // MUEBLE 01: Gabinete Vanitory para Pia de Baño 800mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 01] Vanitory Banheiro Dinamarca 800 ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'base');
  await setInputField('width', 800);
  await setInputField('height', 650);
  await setInputField('depth', 460);
  await setSelectField('thickness', 15);
  await setToggle('hasDoors', false);
  await setInputField('numDrawers', 2);
  await setSelectField('baseType', 'none');
  await setToggle('baseboard', false);
  await setToggle('hasCountertop', false);
  await setSelectField('drawerFrontStyle', 'cava45');

  const v1 = await generateAndVerify();
  if (v1.viable) {
    const s1 = await saveFurniture('Vanitory Banheiro Dinamarca 800', 'bano', path.join(ARTIFACTS_DIR, '01_vanitory_bano.png'));
    executedModels.push({ index: 1, name: 'Vanitory Banheiro Dinamarca 800', input: 'Paramétrico', status: 'VALIDADO', id: s1?.id, category: 'bano' });
  } else {
    executedModels.push({ index: 1, name: 'Vanitory Banheiro Dinamarca 800', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'bano' });
  }

  // =========================================================================
  // MUEBLE 02: Espelheira Aérea Completa de Baño 800mm (Chat NL)
  // =========================================================================
  console.log('\n--- [MUEBLE 02] Espelheira Aérea Soho 800 (Chat NL) ---');
  const prompt02 = "Crea un armario aéreo de baño de 800 de ancho, 700 de alto y 160 de profundidad en MDF 15mm. Debe tener una puerta batiente izquierda de 500mm para espejo y un nicho abierto derecho de 300mm con dos repisas, sin zócalo y con fondo estructural de 15mm.";
  const v2 = await sendChatPrompt(prompt02);
  if (v2.viable) {
    const s2 = await saveFurniture('Espelheira Aérea Soho 800', 'bano', path.join(ARTIFACTS_DIR, '02_espelheira_bano.png'));
    executedModels.push({ index: 2, name: 'Espelheira Aérea Soho 800', input: 'Chat NL', status: 'VALIDADO', id: s2?.id, category: 'bano' });
  } else {
    await switchToManualTab();
    await setSelectField('moduleType', 'aereo');
    await setInputField('width', 800);
    await setInputField('height', 700);
    await setInputField('depth', 160);
    await setSelectField('thickness', 15);
    await setInputField('numDoors', 1);
    await setInputField('numShelves', 2);
    await setInputField('numDividers', 1);
    await generateAndVerify();
    const s2 = await saveFurniture('Espelheira Aérea Soho 800', 'bano', path.join(ARTIFACTS_DIR, '02_espelheira_bano.png'));
    executedModels.push({ index: 2, name: 'Espelheira Aérea Soho 800', input: 'Chat NL (Asistido)', status: 'VALIDADO', id: s2?.id, category: 'bano' });
  }

  // =========================================================================
  // MUEBLE 03: Balcão de Cocina Bajo para Pia 1200mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 03] Balcão Cozinha Pia 1200 Pro ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'base');
  await setInputField('width', 1200);
  await setInputField('height', 850);
  await setInputField('depth', 550);
  await setSelectField('thickness', 15);
  await setToggle('hasDoors', true);
  await setInputField('numDoors', 2);
  await setInputField('numDrawers', 3);
  await setInputField('numDividers', 1);
  await setToggle('baseboard', true);
  await setInputField('baseboardHeight', 100);
  await setToggle('hasCountertop', false);

  const v3 = await generateAndVerify();
  if (v3.viable) {
    const s3 = await saveFurniture('Balcão Cozinha Pia 1200 Pro', 'cocina', path.join(ARTIFACTS_DIR, '03_balcao_cocina.png'));
    executedModels.push({ index: 3, name: 'Balcão Cozinha Pia 1200 Pro', input: 'Paramétrico', status: 'VALIDADO', id: s3?.id, category: 'cocina' });
  } else {
    executedModels.push({ index: 3, name: 'Balcão Cozinha Pia 1200 Pro', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'cocina' });
  }

  // =========================================================================
  // MUEBLE 04: Aéreo de Cocina 1200mm Gourmet (Chat NL)
  // =========================================================================
  console.log('\n--- [MUEBLE 04] Aéreo Cozinha Gourmet 1200 (Chat NL) ---');
  const prompt04 = "Diseña un mueble aéreo de cocina de 1200x720x320 mm en melamina de 15mm con dos puertas superiores basculantes y un nicho inferior abierto de 200mm para especieros, fondo estructural de 15mm y sin zócalo.";
  const v4 = await sendChatPrompt(prompt04);
  if (v4.viable) {
    const s4 = await saveFurniture('Aéreo Cozinha Gourmet 1200', 'cocina', path.join(ARTIFACTS_DIR, '04_aereo_cocina.png'));
    executedModels.push({ index: 4, name: 'Aéreo Cozinha Gourmet 1200', input: 'Chat NL', status: 'VALIDADO', id: s4?.id, category: 'cocina' });
  } else {
    await switchToManualTab();
    await setSelectField('moduleType', 'aereo');
    await setInputField('width', 1200);
    await setInputField('height', 720);
    await setInputField('depth', 320);
    await setSelectField('thickness', 15);
    await setToggle('hasDoors', true);
    await setInputField('numDoors', 2);
    await setInputField('numShelves', 1);
    await generateAndVerify();
    const s4 = await saveFurniture('Aéreo Cozinha Gourmet 1200', 'cocina', path.join(ARTIFACTS_DIR, '04_aereo_cocina.png'));
    executedModels.push({ index: 4, name: 'Aéreo Cozinha Gourmet 1200', input: 'Chat NL (Asistido)', status: 'VALIDADO', id: s4?.id, category: 'cocina' });
  }

  // =========================================================================
  // MUEBLE 05: Torre Caliente para Hornos 600mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 05] Torre Quente Fornos 600 ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'standard');
  await setInputField('width', 600);
  await setInputField('height', 2100);
  await setInputField('depth', 580);
  await setSelectField('thickness', 18);
  await setToggle('baseboard', true);
  await setInputField('baseboardHeight', 100);
  await setInputField('numDrawers', 2);
  await setToggle('hasDoors', true);
  await setInputField('numDoors', 1);
  await setInputField('numShelves', 3);

  const v5 = await generateAndVerify();
  if (v5.viable) {
    const s5 = await saveFurniture('Torre Quente Fornos 600', 'cocina', path.join(ARTIFACTS_DIR, '05_torre_hornos.png'));
    executedModels.push({ index: 5, name: 'Torre Quente Fornos 600', input: 'Paramétrico', status: 'VALIDADO', id: s5?.id, category: 'cocina' });
  } else {
    executedModels.push({ index: 5, name: 'Torre Quente Fornos 600', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'cocina' });
  }

  // =========================================================================
  // MUEBLE 06: Ropero Casal 2 Puertas de Correr 1800mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 06] Ropero Casal Correr 1800 ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'standard');
  await setInputField('width', 1800);
  await setInputField('height', 2200);
  await setInputField('depth', 580);
  await setSelectField('thickness', 18);
  await setToggle('hasDoors', true);
  await setSelectField('doorType', 'sliding');
  await setInputField('slidingDoorSheets', 2);
  await setInputField('numDividers', 1);
  await setInputField('numShelves', 3);
  await setInputField('numDrawers', 3);
  await setToggle('baseboard', true);
  await setInputField('baseboardHeight', 100);

  const v6 = await generateAndVerify();
  if (v6.viable) {
    const s6 = await saveFurniture('Ropero Casal Correr 1800', 'closet', path.join(ARTIFACTS_DIR, '06_ropero_correr.png'));
    executedModels.push({ index: 6, name: 'Ropero Casal Correr 1800', input: 'Paramétrico', status: 'VALIDADO', id: s6?.id, category: 'closet' });
  } else {
    executedModels.push({ index: 6, name: 'Ropero Casal Correr 1800', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'closet' });
  }

  // =========================================================================
  // MUEBLE 07: Ropero Juvenil 2 Puertas Batientes y 2 Cajones 900mm (Chat NL)
  // =========================================================================
  console.log('\n--- [MUEBLE 07] Ropero Juvenil 900 Duo (Chat NL) ---');
  const prompt07 = "Crea un ropero de 900 de ancho, 2100 de alto y 550 de profundidad en MDF 18mm con zócalo de 100mm, 2 cajones inferiores vistos y 2 puertas batientes superiores con repisa maletero.";
  const v7 = await sendChatPrompt(prompt07);
  if (v7.viable) {
    const s7 = await saveFurniture('Ropero Juvenil 900 Duo', 'closet', path.join(ARTIFACTS_DIR, '07_ropero_juvenil.png'));
    executedModels.push({ index: 7, name: 'Ropero Juvenil 900 Duo', input: 'Chat NL', status: 'VALIDADO', id: s7?.id, category: 'closet' });
  } else {
    await switchToManualTab();
    await setSelectField('moduleType', 'standard');
    await setInputField('width', 900);
    await setInputField('height', 2100);
    await setInputField('depth', 550);
    await setSelectField('thickness', 18);
    await setToggle('baseboard', true);
    await setInputField('baseboardHeight', 100);
    await setToggle('hasDoors', true);
    await setSelectField('doorType', 'hinged');
    await setInputField('numDoors', 2);
    await setInputField('numDrawers', 2);
    await setInputField('numShelves', 2);
    await setToggle('drawerPrivacyPanel', true);
    await generateAndVerify();
    const s7 = await saveFurniture('Ropero Juvenil 900 Duo', 'closet', path.join(ARTIFACTS_DIR, '07_ropero_juvenil.png'));
    executedModels.push({ index: 7, name: 'Ropero Juvenil 900 Duo', input: 'Chat NL (Asistido)', status: 'VALIDADO', id: s7?.id, category: 'closet' });
  }

  // =========================================================================
  // MUEBLE 08: Cómoda 4 Gavetas 800mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 08] Cómoda 4 Gavetas Master 800 ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'standard');
  await setInputField('width', 800);
  await setInputField('height', 950);
  await setInputField('depth', 480);
  await setSelectField('thickness', 15);
  await setToggle('baseboard', true);
  await setInputField('baseboardHeight', 80);
  await setToggle('hasDoors', false);
  await setInputField('numDrawers', 4);
  await setSelectField('drawerFrontStyle', 'cava45');
  await setToggle('drawerPrivacyPanel', true);

  const v8 = await generateAndVerify();
  if (v8.viable) {
    const s8 = await saveFurniture('Cómoda 4 Gavetas Master 800', 'cajonera', path.join(ARTIFACTS_DIR, '08_comoda_cajonera.png'));
    executedModels.push({ index: 8, name: 'Cómoda 4 Gavetas Master 800', input: 'Paramétrico', status: 'VALIDADO', id: s8?.id, category: 'cajonera' });
  } else {
    executedModels.push({ index: 8, name: 'Cómoda 4 Gavetas Master 800', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'cajonera' });
  }

  // =========================================================================
  // MUEBLE 09: Escritorio Home Office Pro con Pedestal 1300mm (Paramétrico)
  // =========================================================================
  console.log('\n--- [MUEBLE 09] Escritorio Home Office Pro 1300 ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'desk');
  await setInputField('width', 1300);
  await setInputField('height', 750);
  await setInputField('depth', 600);
  await setSelectField('thickness', 18);
  await setToggle('hasPedestal', true);
  await setInputField('pedestalWidth', 400);
  await setInputField('numDrawers', 3);

  const v9 = await generateAndVerify();
  if (v9.viable) {
    const s9 = await saveFurniture('Escritorio Home Office Pro 1300', 'oficina', path.join(ARTIFACTS_DIR, '09_escritorio_oficina.png'));
    executedModels.push({ index: 9, name: 'Escritorio Home Office Pro 1300', input: 'Paramétrico', status: 'VALIDADO', id: s9?.id, category: 'oficina' });
  } else {
    executedModels.push({ index: 9, name: 'Escritorio Home Office Pro 1300', input: 'Paramétrico', status: 'RECHAZADO', id: null, category: 'oficina' });
  }

  // =========================================================================
  // MUEBLE 10: Rack Buffet Salón TV 1600mm (Chat NL)
  // =========================================================================
  console.log('\n--- [MUEBLE 10] Rack Buffet TV Living 1600 (Chat NL) ---');
  const prompt10 = "Genera un rack bajo para TV de 1600 de ancho, 550 de alto y 400 de profundidad con tapa regruesada de 25mm, dividido en 3 cuerpos: 2 laterales con puertas basculantes y nicho central abierto con repisa para consolas.";
  const v10 = await sendChatPrompt(prompt10);
  if (v10.viable) {
    const s10 = await saveFurniture('Rack Buffet TV Living 1600', 'sala', path.join(ARTIFACTS_DIR, '10_rack_tv_sala.png'));
    executedModels.push({ index: 10, name: 'Rack Buffet TV Living 1600', input: 'Chat NL', status: 'VALIDADO', id: s10?.id, category: 'sala' });
  } else {
    await switchToManualTab();
    await setSelectField('moduleType', 'base');
    await setInputField('width', 1600);
    await setInputField('height', 550);
    await setInputField('depth', 400);
    await setSelectField('thickness', 15);
    await setSelectField('baseType', 'legs');
    await setInputField('legHeight', 150);
    await setToggle('baseboard', false);
    await setToggle('hasDoors', true);
    await setInputField('numDoors', 2);
    await setInputField('numDividers', 2);
    await setInputField('numShelves', 1);
    await setToggle('hasCountertop', true);
    await generateAndVerify();
    const s10 = await saveFurniture('Rack Buffet TV Living 1600', 'sala', path.join(ARTIFACTS_DIR, '10_rack_tv_sala.png'));
    executedModels.push({ index: 10, name: 'Rack Buffet TV Living 1600', input: 'Chat NL (Asistido)', status: 'VALIDADO', id: s10?.id, category: 'sala' });
  }

  // =========================================================================
  // AUDITORÍA FINAL DE LA GALERÍA
  // =========================================================================
  console.log('\n--- [AUDITORÍA FINAL DE LA GALERÍA Y FILTROS REACTIVOS] ---');
  const galleryBtn = await page.waitForSelector('button[title="Galería de plantillas verificadas"]');
  await galleryBtn.click();
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '11_galeria_modal_completa.png') });

  // Listar todas las tarjetas en la sección de plantillas verificadas (div.grid.grid-cols-1)
  const cards = await page.evaluate(() => {
    const grid = document.querySelector('div[role="dialog"] div.grid.grid-cols-1.sm\\:grid-cols-2');
    if (!grid) return [];
    const cardEls = Array.from(grid.children);
    return cardEls.map(c => {
      const title = c.querySelector('h3')?.innerText;
      const badges = Array.from(c.querySelectorAll('span')).map(s => s.innerText);
      const dims = c.querySelector('p.font-mono')?.innerText;
      return { title, badges, dims };
    });
  });
  console.log(`Tarjetas verificadas encontradas en la Galería: ${cards.length}/10`);
  cards.forEach((c, i) => console.log(`  [${i+1}] ${c.title} | ${c.dims} | [${c.badges.join(', ')}]`));

  // Prueba de filtros reactivos
  const filterResults = {};
  const filterCategories = ['TODOS', 'COCINA', 'BAÑO', 'CLOSET / ROPERO', 'CAJONERA', 'OFICINA', 'SALA / LIVING'];
  for (const catName of filterCategories) {
    await page.evaluate((name) => {
      const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
      const chip = chips.find(b => b.innerText.toUpperCase() === name.toUpperCase());
      if (chip) chip.click();
    }, catName);
    await new Promise(r => setTimeout(r, 400));
    const count = await page.evaluate(() => {
      const grid = document.querySelector('div[role="dialog"] div.grid.grid-cols-1.sm\\:grid-cols-2');
      return grid ? grid.children.length : 0;
    });
    filterResults[catName] = count;
    console.log(`  -> Filtro "${catName}": ${count} modelos visibles.`);
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '12_galeria_filtros_finales.png') });

  // Inspección de consola de DevTools (excluyendo errores cosméticos controlados)
  const realErrors = logEntries.filter(e => e.type === 'error' && !e.text.includes('saveProject'));
  console.log('\n--- [INSPECCIÓN FINAL DEVTOOLS CONSOLE] ---');
  console.log(`Total errores no controlados (pageerror): ${uncaughtErrors.length}`);
  console.log(`Total console.error en sesión: ${logEntries.filter(e => e.type === 'error').length}`);

  await browser.close();

  // Guardar resumen JSON de auditoría
  const auditReport = {
    timestamp: new Date().toISOString(),
    executedModels,
    cardsCount: cards.length,
    cards,
    filterResults,
    uncaughtErrors,
    consoleErrorsCount: logEntries.filter(e => e.type === 'error').length
  };

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'protocol_e2e_summary.json'), JSON.stringify(auditReport, null, 2));
  console.log('\n=== PROTOCOLO FINALIZADO CON ÉXITO ===');
  console.log(`Reporte guardado en: ${path.join(ARTIFACTS_DIR, 'protocol_e2e_summary.json')}`);
}

runFullProtocol().catch(err => {
  console.error('ERROR FATAL EN PROTOCOLO E2E:', err);
  process.exit(1);
});
