/**
 * ecosystem.config.js — PM2 Production config para Orbin AI backend
 * Aplica ADR-006 (proceso administrado). Node.js 20+.
 *
 * Rutas y tuning son configurables por entorno (no hay placeholders: hay defaults).
 * Variables de entorno reconocidas:
 *   ORBIN_BACKEND_DIR    cwd del backend (default: /opt/orbin/server)
 *   ORBIN_BACKEND_ENTRY  script de arranque relativo al cwd (default: src/index.js)
 *   ORBIN_PORT           puerto (default: 3003)
 *   ORBIN_INSTANCES      nº de instancias; >1 activa cluster (default: 1 -> fork)
 *   ORBIN_MAX_MEM        umbral de reinicio por RAM (default: 1500M)
 *   ORBIN_ENV_FILE       ruta absoluta al .env canónico (la usa load-env.cjs)
 */

const path = require('path');

const BACKEND_DIR = process.env.ORBIN_BACKEND_DIR || __dirname;
const ENTRY = process.env.ORBIN_BACKEND_ENTRY || 'src/index.js';
const PORT = process.env.ORBIN_PORT || '3003';
const INSTANCES = parseInt(process.env.ORBIN_INSTANCES || '1', 10);
const MAX_MEM = process.env.ORBIN_MAX_MEM || '1500M';

// Los logs viven junto a ESTE archivo (logs), no en el backend
const LOG_DIR = path.join(__dirname, 'logs');

// Preload de entorno (fix del 503 por variables nulas): se inyecta ANTES de que
// arranque el backend, sin tocar su código. Ruta absoluta para que PM2 lo resuelva
// desde cualquier cwd.
const ENV_PRELOAD = path.join(__dirname, 'config', 'load-env.cjs');

module.exports = {
  apps: [
    {
      name: 'orbinai-backend',
      cwd: BACKEND_DIR,
      script: ENTRY,
      interpreter: 'node',
      // -r <preload>: carga y valida el .env canónico antes del backend (fail-loud).
      node_args: `--enable-source-maps -r ${ENV_PRELOAD}`,

      // --- Clustering / ejecución ---
      // fork (1 instancia) por defecto: seguro para backends con estado o binds directos.
      // Si el backend es stateless, subir ORBIN_INSTANCES activa cluster con balanceo interno.
      exec_mode: INSTANCES > 1 ? 'cluster' : 'fork',
      instances: INSTANCES,

      // --- Resiliencia (ADR-006) ---
      autorestart: true,
      watch: false,
      max_memory_restart: MAX_MEM,
      min_uptime: '10s',            // si cae antes de 10s, cuenta como fallo de arranque
      max_restarts: 10,             // tope de reintentos dentro de la ventana
      restart_delay: 3000,          // espera fija entre reinicios
      exp_backoff_restart_delay: 200, // backoff exponencial ante crash loops
      kill_timeout: 5000,           // gracia para cerrar conexiones antes del SIGKILL
      listen_timeout: 8000,

      // --- Variables de entorno ---
      env: {
        NODE_ENV: 'production',
        PORT: PORT
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: PORT
      },

      // --- Logs ---
      out_file: path.join(LOG_DIR, 'pm2-out.log'),
      error_file: path.join(LOG_DIR, 'pm2-error.log'),
      merge_logs: true,             // unifica logs de todas las instancias en cluster
      time: true,                   // antepone timestamp ISO a cada línea
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
