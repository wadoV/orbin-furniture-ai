/**
 * load-env.cjs — Bootstrap de variables de entorno para Orbin AI backend (ADR-006)
 *
 * Objetivo: que el backend NUNCA arranque con variables nulas o con la clave
 * redactada. Carga el .env canónico con fallback ordenado y falla RUIDOSO si
 * falta algo crítico. Sin dependencias (parser propio) → funciona aunque
 * `dotenv` no esté instalado, y sirve tanto para backends ESM como CJS.
 *
 * Uso recomendado (cero ediciones al código del backend), vía PM2:
 *     node_args: '-r /ruta/abs/load-env.cjs'
 * o manual:
 *     node -r ./load-env.cjs src/index.js
 *
 * Alternativa in-file (primera línea de src/index.js):
 *     require('./config/load-env.cjs');   // CJS
 *     import './config/load-env.cjs';      // ESM (con "type":"module")
 *
 * Overrides por entorno:
 *     ORBIN_ENV_FILE       ruta explícita a un .env (máxima prioridad)
 *     ORBIN_REQUIRED_ENV   lista CSV de claves obligatorias (default abajo)
 */

'use strict';
const fs = require('fs');
const path = require('path');

// --- 1) Candidatos de archivo .env, en orden de prioridad ---
const candidates = [
  process.env.ORBIN_ENV_FILE,
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.orbin'),
  process.env.ORBIN_BACKEND_DIR ? path.resolve(process.env.ORBIN_BACKEND_DIR, '.env') : null,
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
].filter(Boolean);

// --- 2) Parser mínimo de .env (sin dependencias) ---
function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    // quita comillas envolventes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// --- 3) Cargar el primer archivo existente (sin override de env real) ---
let loadedFrom = null;
for (const file of candidates) {
  try {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined || process.env[k] === '') {
          process.env[k] = v; // precedencia: env real del proceso > archivo
        }
      }
      loadedFrom = file;
      break;
    }
  } catch (_) { /* seguir con el siguiente candidato */ }
}

// Default de producción si nadie lo fijó
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';

// --- 3b) Alias de retrocompatibilidad (derivados EN CÓDIGO, no por $expansión) ---
// El parser de arriba NO expande $VAR. El .env define solo el nombre canónico
// (GEMINI_API_KEY) y aquí derivamos el alias legacy (GOOGLE_GEMINI_API_KEY).
const ALIASES = [
  ['GOOGLE_GEMINI_API_KEY', 'GEMINI_API_KEY'],
];
for (const [alias, canonical] of ALIASES) {
  if ((process.env[alias] === undefined || process.env[alias] === '') && process.env[canonical]) {
    process.env[alias] = process.env[canonical];
  }
}

// --- 4) Validación fail-loud ---
const DEFAULT_REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const required = (process.env.ORBIN_REQUIRED_ENV
  ? process.env.ORBIN_REQUIRED_ENV.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_REQUIRED);

const missing = [];
const redacted = [];
for (const key of required) {
  const v = process.env[key];
  if (v === undefined || v === '') { missing.push(key); continue; }
  if (/^REDACTED/i.test(v) || /placeholder|changeme|tu_|your-|xxxx/i.test(v)) redacted.push(key);
}

function fail(title, lines) {
  console.error('\n[load-env] ✖ ' + title);
  for (const l of lines) console.error('[load-env]   - ' + l);
  console.error('[load-env] Archivo .env usado: ' + (loadedFrom || '(NINGUNO encontrado)'));
  console.error('[load-env] Abortando antes de arrancar para no correr con config inválida.\n');
  process.exit(1);
}

if (!loadedFrom) {
  fail('No se encontró ningún archivo .env', [
    'Rutas probadas: ' + candidates.join(' | '),
    'Fija ORBIN_ENV_FILE con la ruta absoluta del .env canónico.',
  ]);
}
if (missing.length) {
  fail('Variables obligatorias ausentes/vacías', missing.map((k) => k + ' = (vacío)'));
}
if (redacted.length) {
  fail('Variables con valor redactado/placeholder (rota y actualiza el .env)',
    redacted.map((k) => k + ' = ' + String(process.env[k]).slice(0, 12) + '…'));
}

// --- 5) Log de arranque (sin exponer valores) ---
const shown = Array.from(new Set([...required, 'NODE_ENV', 'PORT']));
const status = shown
  .map((k) => {
    const v = process.env[k];
    if (v === undefined || v === '') return k + '=∅';
    // NODE_ENV/PORT no son secretos: mostrarlos; el resto, solo presencia
    if (k === 'NODE_ENV' || k === 'PORT') return k + '=' + v;
    return k + '=ok(len' + v.length + ')';
  })
  .join('  ');
console.log('[load-env] ✔ cargado desde ' + loadedFrom);
console.log('[load-env] ' + status);

module.exports = { loadedFrom, required };
