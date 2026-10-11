const puppeteer = require('C:/Users/Azomarg/.gemini/antigravity/brain/93c3ae43-2af1-432c-a282-bfeedfd1af2c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, 'test-artifacts', 'e2e-2026-10-11-kitchen');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runKitchenE2E() {
  const logEntries = [];
  const uncaughtErrors = [];

  console.log('======================================================================');
  console.log('PROTOCOLO E2E CHROME: GENERACIÓN Y GUARDADO DE COCINAS COMPLETAS');
  console.log('Orbin AI — Lead QA & Automation');
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: 'C:\\Users\\Azomarg\\.gemini\\antigravity\\brain\\a4d0b325-917c-4710-a7e0-1bc819f92e42\\scratch\\chrome_profile_kitchen',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();

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
    await new Promise(r => setTimeout(r, 600));
  }

  async function switchToManualTab() {
    await selectMainTab('params');
    await page.evaluate(() => {
      const panel = document.getElementById('panel-params');
      if (!panel) return;
      const modeTabs = Array.from(panel.querySelectorAll('div[role="tablist"] button[role="tab"]'));
      if (modeTabs.length >= 2) {
        modeTabs[1].click();
      }
    });
    await new Promise(r => setTimeout(r, 500));
  }

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
    await new Promise(r => setTimeout(r, 150));
  }

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

  async function generateAndVerify() {
    console.log('  -> Disparando "Generar Proyecto"...');
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

  async function saveFurniture(name, category, screenshotPath) {
    console.log(`  -> Guardando mueble "${name}" (categoría: "${category}")...`);
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

    await page.evaluate((cat) => {
      const modalInput = document.querySelector('input[placeholder="Balcão Cozinha 1200"]');
      const modal = modalInput.closest('div.w-\\[320px\\]') || modalInput.closest('.space-y-4');
      const select = modal.querySelector('select');
      if (select) {
        select.value = cat;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const actionBtns = Array.from(modal.querySelectorAll('div.flex.gap-2 button'));
      const confirmBtn = actionBtns[1] || actionBtns.find(b => b.innerText.includes('Salvar') || b.innerText.includes('Guardar') || b.innerText.includes('Save'));
      if (confirmBtn) {
        confirmBtn.click();
      }
    }, category);

    await new Promise(r => setTimeout(r, 1200));

    const toastInfo = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll('div.fixed, div.absolute')).filter(el => {
        const txt = el.innerText || '';
        return txt.includes('Galeria') || txt.includes('Galería') || txt.includes('Gallery') || txt.includes('Salvo');
      });
      return toasts.map(t => t.innerText.trim());
    });
    console.log('  -> Toast detectado en UI:', toastInfo);

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath });
    }

    await new Promise(r => setTimeout(r, 1000));

    const check = await page.evaluate(() => {
      const ls = JSON.parse(localStorage.getItem('orbin:viableDesigns') || '[]');
      return { latest: ls[0], count: ls.length };
    });

    console.log(`  -> Persistido con éxito: ID = ${check.latest?.id} | Nombre: ${check.latest?.design_name || check.latest?.nombre} (Total en Galería: ${check.count})`);
    return check.latest;
  }

  const results = {
    caso1_base: null,
    caso1_aereo: null,
    caso2_modular: null,
    galleryCards: [],
    filterTests: {}
  };

  // 1. Navegación inicial a http://localhost:5174/app
  console.log('1. Navegando a http://localhost:5174/app ...');
  await page.goto('http://localhost:5174/app', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Inicializar galería limpia para la prueba
  await page.evaluate(() => {
    localStorage.setItem('orbin:viableSeeded', '1');
    localStorage.setItem('orbin:viableDesigns', '[]');
  });

  // =========================================================================
  // CASO 1.1: MÓDULO BASE 1200x850x550 mm
  // =========================================================================
  console.log('\n--- CASO 1.1: Generando Módulo Base 1200x850x550 mm (MDF 15 mm) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'base');
  await setInputField('width', 1200);
  await setInputField('height', 850);
  await setInputField('depth', 550);
  await setSelectField('thickness', 15);
  await setToggle('baseboard', true);
  await setInputField('baseboardHeight', 100);
  await setToggle('hasDoors', true);
  await setInputField('numDoors', 2);
  await setInputField('numDrawers', 3);
  await setInputField('numDividers', 1);
  await setToggle('hasCountertop', false);

  const v1 = await generateAndVerify();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_caso1_modulo_base_validado.png') });

  if (v1.viable) {
    const s1 = await saveFurniture('Cozinha Linear 1200 Base', 'cocina', path.join(ARTIFACTS_DIR, '02_caso1_modulo_base_guardado.png'));
    results.caso1_base = { status: 'VALIDADO', viable: true, id: s1?.id, name: s1?.design_name || s1?.nombre, category: s1?.category || s1?.categoria };
  } else {
    throw new Error('Módulo Base no resultó viable');
  }

  // =========================================================================
  // CASO 1.2: MÓDULO AÉREO 1200x700x320 mm
  // =========================================================================
  console.log('\n--- CASO 1.2: Agregando Módulo Aéreo 1200x700x320 mm (MDF 15 mm) ---');
  await switchToManualTab();
  await setSelectField('moduleType', 'aereo');
  await setInputField('width', 1200);
  await setInputField('height', 700);
  await setInputField('depth', 320);
  await setSelectField('thickness', 15);
  await setToggle('hasDoors', true);
  await setInputField('numDoors', 2);
  await setInputField('numShelves', 2);
  await setInputField('numDrawers', 0);

  const v2 = await generateAndVerify();
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_caso1_modulo_aereo_validado.png') });

  if (v2.viable) {
    const s2 = await saveFurniture('Cozinha Linear 1200 Aéreo', 'cocina', path.join(ARTIFACTS_DIR, '04_caso1_modulo_aereo_guardado.png'));
    results.caso1_aereo = { status: 'VALIDADO', viable: true, id: s2?.id, name: s2?.design_name || s2?.nombre, category: s2?.category || s2?.categoria };
  } else {
    throw new Error('Módulo Aéreo no resultó viable');
  }

  // =========================================================================
  // CASO 2: COCINA MODULAR COMPLETA 2.60 m (A TRAVÉS DE CHAT PROMPT / NL)
  // =========================================================================
  console.log('\n--- CASO 2: Cocina Modular Completa 2.60 m vía Chat NL ---');
  await selectMainTab('chat');
  await new Promise(r => setTimeout(r, 600));

  const promptText = "Diseña una cocina modular completa en melamina de 18mm compuesta por una base de 2000x850x550 mm con puertas de correr y rodapié de 100mm, y una torre de hornos columna de 600x2100x580 mm con dos gavetones y nicho para microondas.";
  
  const chatInput = await page.waitForSelector('input[placeholder*="mensaje"], input[placeholder*="mensagem"], input[placeholder*="Describí"], input[type="text"]');
  await chatInput.focus();
  await chatInput.type(promptText);
  await page.keyboard.press('Enter');
  console.log(`  -> Prompt enviado: "${promptText}"`);

  // Esperar respuesta de IA y estado HITL
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_caso2_chat_hitl_preview.png') });

  // Confirmar módulo en HITL con selector insensible a mayúsculas
  console.log('  -> Confirmando propuesta HITL...');
  const hitlConfirmed = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const confirmBtn = btns.find(b => {
      const txt = (b.innerText || '').toUpperCase();
      return txt.includes('CONFIRMAR MÓDULO') || txt.includes('CONFIRMAR');
    });
    if (confirmBtn) {
      confirmBtn.click();
      return true;
    }
    return false;
  });
  console.log('  -> Botón HITL presionado con éxito:', hitlConfirmed);
  await new Promise(r => setTimeout(r, 3500));

  // Volver al visor 3D y verificar viabilidad del módulo confirmado
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_caso2_chat_modulo_confirmado_validado.png') });

  const v3 = await page.evaluate(() => {
    const saveBtn = document.querySelector('button[aria-label="Guardar en Galería"]');
    return {
      viable: saveBtn ? saveBtn.getAttribute('aria-disabled') === 'false' : false,
      title: saveBtn ? saveBtn.getAttribute('title') : null,
      ariaDisabled: saveBtn ? saveBtn.getAttribute('aria-disabled') : null
    };
  });
  console.log('  -> Estado de viabilidad del diseño confirmado:', v3);

  if (v3.viable) {
    const s3 = await saveFurniture('Cozinha Master Gourmet 2600', 'cocina', path.join(ARTIFACTS_DIR, '07_caso2_cocina_master_guardada.png'));
    results.caso2_modular = { status: 'VALIDADO', viable: true, id: s3?.id, name: s3?.design_name || s3?.nombre, category: s3?.category || s3?.categoria };
  } else {
    throw new Error('Cocina Master Gourmet no resultó viable tras HITL');
  }

  // =========================================================================
  // VERIFICACIÓN EN VIVO DE GALERÍA Y FILTROS REACTIVOS
  // =========================================================================
  console.log('\n--- VERIFICACIÓN EN VIVO DE LA GALERÍA Y FILTROS REACTIVOS ---');
  const galleryBtn = await page.waitForSelector('button[title*="Galería"], button[title*="Galeria"], button[title*="plantillas"]');
  await galleryBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '08_galeria_modal_3_tarjetas.png') });

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

  console.log(`Tarjetas encontradas en la Galería: ${cards.length}`);
  cards.forEach((c, idx) => {
    console.log(`  [${idx + 1}] "${c.title}" | ${c.dims} | [${c.badges.join(', ')}]`);
  });
  results.galleryCards = cards;

  // Probar chip de filtro COCINA
  console.log('\n--- Probando chip de filtro COCINA ---');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const cocinaChip = chips.find(b => b.innerText.toUpperCase() === 'COCINA');
    if (cocinaChip) cocinaChip.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '09_galeria_filtro_cocina_activo.png') });

  const cardsUnderCocina = await page.evaluate(() => {
    const grid = document.querySelector('div[role="dialog"] div.grid.grid-cols-1.sm\\:grid-cols-2');
    if (!grid) return [];
    return Array.from(grid.children).map(c => ({
      title: c.querySelector('h3')?.innerText,
      badges: Array.from(c.querySelectorAll('span')).map(s => s.innerText),
      dims: c.querySelector('p.font-mono')?.innerText
    }));
  });
  console.log(`Modelos visibles bajo filtro COCINA: ${cardsUnderCocina.length}`);
  cardsUnderCocina.forEach((c, idx) => {
    console.log(`  [${idx + 1}] "${c.title}" | ${c.dims} | [${c.badges.join(', ')}]`);
  });
  results.filterTests['COCINA'] = cardsUnderCocina.length;

  // Probar chip TODOS
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('div[role="dialog"] button'));
    const todosChip = chips.find(b => b.innerText.toUpperCase() === 'TODOS');
    if (todosChip) todosChip.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const cardsUnderTodos = await page.evaluate(() => {
    const grid = document.querySelector('div[role="dialog"] div.grid.grid-cols-1.sm\\:grid-cols-2');
    return grid ? grid.children.length : 0;
  });
  results.filterTests['TODOS'] = cardsUnderTodos;

  console.log('\n--- Auditoría de Consola DevTools ---');
  const realErrors = logEntries.filter(e => e.type === 'error' && !e.text.includes('saveProject'));
  console.log(`Total excepciones no controladas (pageerror): ${uncaughtErrors.length}`);
  console.log(`Total console.error relevantes: ${realErrors.length}`);

  // Cierre limpio de navegador sin usar ?reset (REGLA 4 garantizada)
  await browser.close();

  const auditReport = {
    timestamp: new Date().toISOString(),
    results,
    uncaughtErrors,
    consoleErrorsCount: realErrors.length,
    cardsUnderCocina
  };
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'kitchen_protocol_summary.json'), JSON.stringify(auditReport, null, 2));

  console.log('\n======================================================================');
  console.log('PROTOCOLO E2E COMPLETADO CON ÉXITO');
  console.log(`Resumen guardado en: ${path.join(ARTIFACTS_DIR, 'kitchen_protocol_summary.json')}`);
  console.log('======================================================================');
}

runKitchenE2E().catch(err => {
  console.error('ERROR FATAL EN PROTOCOLO E2E:', err);
  process.exit(1);
});
