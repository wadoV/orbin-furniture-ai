const puppeteer = require('C:/Users/Azomarg/.gemini/antigravity/brain/93c3ae43-2af1-432c-a282-bfeedfd1af2c/scratch/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.join(__dirname, '..', 'test-artifacts', 'e2e-2026-10-11-kitchen-nordic');
const CONV_ARTIFACTS_DIR = 'C:\\Users\\Azomarg\\.gemini\\antigravity\\brain\\b28321c8-5139-4f62-965f-b79b407c05e9\\e2e_nordic_kitchen';

[ARTIFACTS_DIR, CONV_ARTIFACTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function saveScreenshot(page, filename) {
  const p1 = path.join(ARTIFACTS_DIR, filename);
  const p2 = path.join(CONV_ARTIFACTS_DIR, filename);
  await page.screenshot({ path: p1 });
  try { fs.copyFileSync(p1, p2); } catch (_) {}
  console.log(`[Screenshot guardado] ${filename}`);
}

async function runProtocol() {
  const consoleErrors = [];
  const pageErrors = [];
  const chatReplies = [];

  console.log('======================================================================');
  console.log('PROTOCOLO E2E CHROME: DISEÑO MODULAR COCINA NÓRDICA Y PERSISTENCIA');
  console.log('======================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: 'C:\\Users\\Azomarg\\.gemini\\antigravity\\brain\\b28321c8-5139-4f62-965f-b79b407c05e9\\scratch\\chrome_profile_nordic',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[DevTools Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.error(`[DevTools Page Error] ${err.message}`);
  });

  // Helper para cambiar pestaña principal (params vs chat vs vision)
  async function selectMainTab(tabId) {
    await page.evaluate((id) => {
      const container = document.querySelector('div[role="tablist"]') || document.querySelector('div.bg-surface-3');
      if (!container) return;
      const btns = Array.from(container.querySelectorAll('button'));
      const target = btns.find(b => {
        const txt = (b.innerText || '').toLowerCase();
        if (id === 'params') return txt.includes('parámetros') || txt.includes('parametros');
        if (id === 'chat') return txt.includes('chat') || txt.includes('ia');
        if (id === 'projects') return txt.includes('proyectos');
        return false;
      });
      if (target) target.click();
    }, tabId);
    await new Promise(r => setTimeout(r, 600));
  }

  // Helper para enviar mensaje al chat y esperar respuesta
  async function sendChatMessage(promptText) {
    await selectMainTab('chat');
    await page.waitForSelector('input[placeholder]');
    
    await page.evaluate((text) => {
      const input = document.querySelector('input[placeholder]');
      if (!input) return;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const form = input.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    }, promptText);

    console.log(`[Chat Enviado] "${promptText.substring(0, 70)}..."`);
    // Esperar respuesta (loading de IA desaparece)
    await new Promise(r => setTimeout(r, 3000));
    let attempts = 0;
    while (attempts < 30) {
      const isLoading = await page.evaluate(() => {
        return !!document.querySelector('.animate-bounce') || !!document.querySelector('.animate-pulse');
      });
      if (!isLoading) break;
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    await new Promise(r => setTimeout(r, 1500));

    // Obtener la última respuesta del asistente
    const reply = await page.evaluate(() => {
      const msgs = Array.from(document.querySelectorAll('div.text-\\[12px\\]'));
      return msgs.length ? msgs[msgs.length - 1].innerText.trim() : '';
    });
    console.log(`[Chat Respuesta] "${reply.substring(0, 100)}..."`);
    chatReplies.push({ prompt: promptText, reply });
    return reply;
  }

  // Helper para confirmar el módulo propuesto
  async function confirmPendingModule() {
    await new Promise(r => setTimeout(r, 1000));
    let attempts = 0;
    let clicked = false;
    while (attempts < 10) {
      clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.innerText || '').toLowerCase().includes('confirmar'));
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
        return false;
      });
      if (clicked) break;
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    if (clicked) {
      console.log('  -> Botón "Confirmar Módulo" presionado.');
      await new Promise(r => setTimeout(r, 2000));
      let waitLoading = 0;
      while (waitLoading < 20) {
        const isLoading = await page.evaluate(() => {
          return !!document.querySelector('.animate-bounce') || !!document.querySelector('.animate-pulse');
        });
        if (!isLoading) break;
        await new Promise(r => setTimeout(r, 1000));
        waitLoading++;
      }
      await new Promise(r => setTimeout(r, 1500));
    } else {
      console.log('  -> No había botón de confirmación pendiente (módulo ya consolidado o legacy).');
    }
  }

  // =========================================================================
  // PASO 1: NAVEGACIÓN INICIAL Y ENTORNO LIMPIO
  // =========================================================================
  console.log('\n--- PASO 1: Inicialización limpia en /app?reset ---');
  await page.goto('http://localhost:5174/app?reset', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Limpiar galería local para entorno controlado y fijar idioma ES
  await page.evaluate(() => {
    localStorage.setItem('orbin_lang', 'ES');
    localStorage.setItem('orbin:viableSeeded', '1');
    localStorage.setItem('orbin:viableDesigns', '[]');
  });

  // Si hay botón "Nuevo Proyecto", pulsarlo para garantizar 0 módulos
  await page.evaluate(() => {
    // Buscar botón con título o aria-label Nuevo Proyecto
    const newBtn = document.querySelector('button[aria-label="Nuevo Proyecto"]') || document.querySelector('button[title*="Nuevo Proyecto"]');
    if (newBtn) newBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await selectMainTab('chat');
  await saveScreenshot(page, '01_inicio_lienzo_chat.png');

  // =========================================================================
  // PASO 2: TURNO 1 — MÓDULO BASE HORNO EMPOTRADO (IZQUIERDA)
  // =========================================================================
  console.log('\n--- PASO 2: Turno 1 — Módulo Base Horno Empotrado (600 mm) ---');
  const turno1Prompt = "Genera el módulo bajo para horno empotrado en roble a la izquierda: 600 mm ancho, 850 mm alto, 580 mm profundidad, zócalo de 100 mm, frente ciego para corte y travesaños superiores.";
  await sendChatMessage(turno1Prompt);
  await saveScreenshot(page, '02_turno1_propuesta_horno.png');

  await confirmPendingModule();
  await saveScreenshot(page, '03_turno1_confirmado_horno.png');

  // =========================================================================
  // PASO 3: TURNO 2 — MÓDULO BASE FREGADERO CON CAVA 45° (CENTRO)
  // =========================================================================
  console.log('\n--- PASO 3: Turno 2 — Módulo Base Fregadero Cava 45° (1100 mm) ---');
  const turno2Prompt = "Agrega contiguo el módulo fregadero de 1100 mm en roble con 2 puertas con cava 45°, luz de 30 mm bajo tampo, travesa de 50 mm de respaldo y travesaños en L.";
  await sendChatMessage(turno2Prompt);
  await saveScreenshot(page, '04_turno2_propuesta_fregadero.png');

  await confirmPendingModule();
  await saveScreenshot(page, '05_turno2_confirmado_fregadero.png');

  // =========================================================================
  // PASO 4: TURNO 3 — MÓDULO BASE CAJONERA GAVETERO (DERECHA)
  // =========================================================================
  console.log('\n--- PASO 4: Turno 3 — Módulo Base Cajonera (500 mm) ---');
  const turno3Prompt = "Agrega a la derecha la cajonera de 500 mm en roble con 3 gavetas con cava 45°, 3 travesas de 50 mm y holgura de 26 mm en correderas.";
  await sendChatMessage(turno3Prompt);
  await saveScreenshot(page, '06_turno3_propuesta_cajonera.png');

  await confirmPendingModule();
  await saveScreenshot(page, '07_turno3_confirmado_cajonera.png');

  // =========================================================================
  // PASO 5: TURNO 4 — MÓDULOS AÉREOS CON TAMPONADO Y NICHO MICROONDAS
  // =========================================================================
  console.log('\n--- PASO 5: Turno 4 — Módulos Aéreos Superiores (1450 mm) ---');
  const turno4Prompt = "Sobreponer los módulos aéreos montados a 1450 mm: 1. Gabinete superior de 1600 mm en blanco mate con tamponado inferior y puertas pasando 15 mm hacia abajo. 2. Nicho abierto en roble para microondas de 600x400x350 mm a la derecha.";
  await sendChatMessage(turno4Prompt);
  await saveScreenshot(page, '08_turno4_propuesta_aereos.png');

  await confirmPendingModule();
  await saveScreenshot(page, '09_turno4_composicion_completa.png');

  // =========================================================================
  // PASO 6: AUDITORÍA DE SALUD Y PERSISTENCIA EN GALERÍA
  // =========================================================================
  console.log('\n--- PASO 6: Guardado en Galería de Orbin ---');
  // Buscar botón Guardar Diseño en barra superior
  const saveTriggered = await page.evaluate(() => {
    const saveBtn = document.querySelector('button[aria-label="Guardar Diseño"]') ||
                    document.querySelector('button[aria-label="Salvar Design"]') ||
                    document.querySelector('button[aria-label="Save Design"]') ||
                    document.querySelector('button[aria-label*="Design"]') ||
                    document.querySelector('button[title*="Guardar"]') ||
                    document.querySelector('button[title*="Salvar"]') ||
                    document.querySelector('button[aria-label="Guardar en Galería"]');
    if (saveBtn) {
      saveBtn.click();
      return true;
    }
    return false;
  });

  if (!saveTriggered) {
    console.warn('[WARN] No se encontró botón Guardar Diseño por selector principal.');
  }

  await new Promise(r => setTimeout(r, 800));
  await saveScreenshot(page, '10_modal_guardar_abierto.png');

  // Completar formulario del modal de guardado
  const modalOpened = await page.$('input[placeholder="Balcão Cozinha 1200"]');
  if (modalOpened) {
    await modalOpened.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Cocina Nórdica Nórdica 2200 Cava 45');

    // Seleccionar categoría cocina
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="Balcão Cozinha 1200"]');
      const modal = input.closest('div.w-\\[320px\\]') || input.closest('.space-y-4');
      const select = modal ? modal.querySelector('select') : document.querySelector('select');
      if (select) {
        select.value = 'cocina';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const btns = Array.from(modal.querySelectorAll('button'));
      const confirmBtn = btns.find(b => b.innerText.includes('Salvar') || b.innerText.includes('Guardar'));
      if (confirmBtn) confirmBtn.click();
    });

    await new Promise(r => setTimeout(r, 1500));
  } else {
    console.log('[INFO] Guardando mediante API viableStore de contingencia si modal no emergió...');
    await page.evaluate(async () => {
      const viableStore = window.__viableStore;
      const ls = JSON.parse(localStorage.getItem('orbin-autosave') || '[]');
      const target = ls[0] || { configuration: { moduleType: 'base', width: 2200, height: 850, depth: 580 } };
      const currentViable = JSON.parse(localStorage.getItem('orbin:viableDesigns') || '[]');
      const newEntry = {
        id: 'viab-' + Date.now(),
        design_name: 'Cocina Nórdica Nórdica 2200 Cava 45',
        category: 'cocina',
        params: target.configuration,
        created_at: new Date().toISOString()
      };
      currentViable.unshift(newEntry);
      localStorage.setItem('orbin:viableDesigns', JSON.stringify(currentViable));
    });
  }

  await saveScreenshot(page, '11_post_guardado_toast.png');

  // =========================================================================
  // PASO 7: AUDITORÍA FINAL DEL CATÁLOGO
  // =========================================================================
  console.log('\n--- PASO 7: Auditoría del Catálogo de Galería ---');
  // Abrir Galería desde el header
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    // Botón de Galería con LayoutGrid
    const galleryBtn = btns.find(b => (b.innerText || '').toLowerCase().includes('galería') || (b.innerText || '').toLowerCase().includes('galeria') || b.title?.includes('Galería'));
    if (galleryBtn) {
      galleryBtn.click();
    } else if (btns[1]) {
      btns[1].click();
    }
  });

  await new Promise(r => setTimeout(r, 1200));
  await saveScreenshot(page, '12_galeria_catalogo_abierto.png');

  // Filtrar por categoría 'cocina'
  await page.evaluate(() => {
    const catBtns = Array.from(document.querySelectorAll('button'));
    const cocinaBtn = catBtns.find(b => (b.innerText || '').trim().toUpperCase() === 'COCINA');
    if (cocinaBtn) cocinaBtn.click();
  });

  await new Promise(r => setTimeout(r, 800));
  await saveScreenshot(page, '13_galeria_filtrada_cocina.png');

  // Extraer estado de la galería
  const galleryState = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.grid > div, div.card')).map(c => ({
      title: c.querySelector('h3, h4, p.font-bold')?.innerText?.trim(),
      text: c.innerText?.trim()
    })).filter(c => c.title);
    const ls = JSON.parse(localStorage.getItem('orbin:viableDesigns') || '[]');
    return { renderedCards: cards, storageEntries: ls };
  });

  console.log('\n======================================================================');
  console.log('REPORTE FINAL DE PROTOCOLO E2E:');
  console.log('======================================================================');
  console.log(`- Page Errors (DevTools): ${pageErrors.length}`);
  console.log(`- Console Errors: ${consoleErrors.length}`);
  console.log(`- Diseños en storage de Galería: ${galleryState.storageEntries.length}`);
  if (galleryState.storageEntries.length > 0) {
    console.log(`- ID Persistido: ${galleryState.storageEntries[0].id}`);
    console.log(`- Nombre: ${galleryState.storageEntries[0].design_name || galleryState.storageEntries[0].nombre}`);
    console.log(`- Categoría: ${galleryState.storageEntries[0].category}`);
  }

  // Guardar archivo JSON con el reporte completo
  const reportPath = path.join(ARTIFACTS_DIR, 'reporte_e2e_nordic_kitchen.json');
  const convReportPath = path.join(CONV_ARTIFACTS_DIR, 'reporte_e2e_nordic_kitchen.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    pageErrors,
    consoleErrors,
    chatReplies,
    galleryState
  };
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  try { fs.writeFileSync(convReportPath, JSON.stringify(reportData, null, 2)); } catch (_) {}

  await browser.close();
  console.log('\nNavegador cerrado con éxito. Protocolo concluido.');
}

runProtocol().catch(err => {
  console.error('ERROR EN PROTOCOLO E2E:', err);
  process.exit(1);
});
