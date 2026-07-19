# ORBIN — PLAN DE ATAQUE: BLOQUEADORES REALES PRE-LANZAMIENTO
**Fecha:** 2026-07-19 · **Regla madre:** aditivo, no destructivo · **Evidence contract activo**
**Rama de trabajo actual:** `design/presets-2026` (8 commits sobre main, tree limpio)

Orden por impacto/riesgo. Cada bloqueador tiene dueño sugerido, criterio de salida
verificable y tamaño estimado. No se avanza al siguiente sin cerrar el criterio.

---

## B1 — VERIFICACIÓN LOCAL EN NAVEGADOR (dueño: Eduardo + Claude · 1-2 h)
**Por qué primero:** hay 8 commits sin validación visual. Nada se mergea a ciegas.
**El síntoma "presets no funcionan" ya está diagnosticado:** con el server apagado el
clic moría en un banner fuera de pantalla (fix `[presets-silenciosos]` 58253f4). Los
params de los 5 aéreos están VALIDADOS por el motor — el problema era servidor+UX, no diseño.

Pasos:
1. Levantar servidores (terminal o Antigravity):
   ```
   cd C:\Users\Azomarg\Documents\Claude_projects\Orbin\server && npm run dev
   cd C:\Users\Azomarg\Documents\Claude_projects\Orbin\client && npm run dev
   ```
2. Claude vía Chrome: clic en los 10 presets (5 aéreos primero), verificar módulo 3D,
   cut list, BOM con herrajes de suspensión, banner offline al apagar el server.
3. `cd client && npm run build` — build de producción limpio.
**Salida:** los 10 presets generan y renderizan · build OK · captura de cada aéreo.

## B2 — MERGE A MAIN + DEPLOY STAGING (dueño: Eduardo · 30 min)
`design/presets-2026` → main tras B1. Deploy a entorno de prueba (mismo pipeline que
producción). Smoke test de /api/health, login y 1 generación en staging.
**Salida:** staging con motor 2026 respondiendo.

## B3 — PRERENDER ESTÁTICO (Fase 3 del plan original · dueño: Claude · 3-5 h)
GPTBot/PerplexityBot/ClaudeBot ven HTML vacío hoy: AEO/SEO = 0 hasta esto.
- `vite-plugin-ssg` o `react-snap` SOLO en rutas públicas (/, /blog/*, /terms, /privacy).
- Viewer3D (WebGL) jamás se ejecuta en prerender — ya es lazy().
- Guard de `localStorage/window` a nivel módulo — guardar, no borrar.
- Si no sale limpio en un intento enfocado: STOP y reportar (regla del plan original).
**Salida:** `grep -c "Orbin" dist/index.html` > 0 en body · blog con contenido real ·
SPA intacta (/app, 3D, auth).

## B4 — METADATA POR PÁGINA (Fase 4 · dueño: Claude · 2-3 h · depende de B3)
- `react-helmet-async`; title/description únicos por ruta pública.
- Schema `Article` + `BreadcrumbList` en los 3 posts; FAQPage al HTML prerenderizado.
- NO tocar el JSON-LD existente de index.html (correcto y estático).
**Salida:** titles únicos en dist/**/index.html · Rich Results Test en verde (pegado real).

## B5 — PROMO-CODES: REUSO (dueño: Eduardo/Claude · 2 h)
Riesgo conocido de billing (memoria del proyecto): códigos canjeables más de una vez.
Constraint de unicidad (user_id, code) en Supabase + check server-side ANTES de aplicar
descuento + test de doble canje. Aditivo: tabla/constraint nueva, sin tocar flujo feliz.
**Salida:** segundo canje del mismo código → rechazo verificado con curl/test.

## B6 — BETA CERRADA (dueño: Eduardo · en paralelo desde B2)
5-10 marcenarios reales (Brasil primero). Guion: generar armario, leer cut list en
taller, reportar 1 medida que no cuadre. Canal directo WhatsApp. La lista de cortes
correcta es el moat — validarla con quien corta chapa vale más que cualquier feature.
**Salida:** 5 sesiones reales, lista de discrepancias (aunque sea vacía).

## EXPLÍCITAMENTE FUERA (no tocar antes de lanzar)
Rutas i18n /pt /es /en (Fase 5 — post-launch) · Next.js (rechazado por diseño) ·
ripado/palhinha paramétrico · nuevos módulos del motor.

## NOTA OPERATIVA (restricción de entorno)
Claude no puede escribir en terminales/IDEs del escritorio (nivel "solo clic" por
política de seguridad) ni ejecutar `npm run dev` en su sandbox (node_modules es binario
Windows). Los comandos de B1.1 los ejecuta Eduardo o Antigravity; desde ahí Claude
opera el navegador vía extensión de Chrome sin intervención.
