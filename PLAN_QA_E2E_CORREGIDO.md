# Plan QA End-to-End — CORREGIDO (Claude / Cowork) — 2026-07-22

Revisión del plan P1–P7 de Antigravity. Las correcciones están marcadas **[CORRECCIÓN]**
y salen de haber corrido el código actual en sandbox (117/117 tests, health-check 200,
CASE A/B/C verificados). Reglas no negociables sin cambios: **additive-only**, no tocar
`server/src/engine/*`, `validator.js`, `aiOrchestrator.js`; secretos solo por nombre;
verificar antes de avanzar; loguear todo en `PROMPTS_LOG.md`.

---

## P1 — Arranque y health-check

- Levantar `server` (:3003) y `client` (:5174). Puede usarse `npm run dev` desde raíz
  o `node src/index.js` en `server/`.
- **[CORRECCIÓN 1 — bloqueador de auth]** `server/.env` tiene `NODE_ENV=production`.
  En producción `requireAuth` fail-cierra: como Supabase SÍ está configurado, todo
  `/api/chat/design` y `/api/design/generate` responden **401** sin JWT real, y el atajo
  `dev-token` está gateado a no-producción. **Arrancar con override de shell temporal:**
  - Windows CMD: `set NODE_ENV=development && node src/index.js`
  - PowerShell: `$env:NODE_ENV="development"; node src/index.js`
  - **NUNCA editar `server/.env`.** `dotenv` no pisa vars ya seteadas en el shell, así
    que el override gana sin tocar el archivo. Con `development`, sin header `Authorization`,
    `requireAuth` inyecta `dev-local-user` (plan `pro`) → todas las rutas funcionan.
- **[CORRECCIÓN 2 — cold boot]** El bind a :3003 tarda **~20s en frío** (require de
  `routes/projects.js` ≈11.7s + `socket.io` ≈5s). NO es un bug. El health-check debe
  **esperar ≥30s** (polling a `/api/health`) antes de declarar fallo, o da falso-negativo.
- Verificar: `GET http://localhost:3003/api/design/defaults` → **HTTP 200** con objeto
  `defaults` (baseline confirmado: `type:"closet", width:2400, height:2400, ...`).
- Log de éxito esperado: `[Orbin] Server running on port 3003 (development)` +
  `Supabase: ✓  Gemini: ✓`.
- Si algo crashea: diagnosticar → fix aditivo (guard/null-check/mapping) → re-verificar.

## P2 — Smoke test del shell (navegador)

- **[DECISIÓN DE MODO — ver sección final]** Modo híbrido: consola + red + screenshots
  DOM vía **harness headless** (autónomo en Windows); render 3D y clipboard, manual.
- Cargar `http://localhost:5174`, capturar render inicial.
- Leer consola DevTools → listar **verbatim** cualquier error rojo.
- Llegar al workspace (ruta `dev-local-user` — ya habilitada por CORRECCIÓN 1).
- Confirmar visibilidad de panel de parámetros (izq.) y panel de chat IA.
- Resolver errores bloqueantes de forma aditiva y re-testear.

## P3 — Chat con IA (End-to-End)

Cada turno: enviar `POST /api/chat/design` (verificar en Network), esperar reply,
capturar estado.

- **Turno 1:** "Quiero un armario de 1800mm de ancho, 2200 de alto y 580 de fondo,
  con 4 estantes y 3 cajones."
- **Turno 2:** "Agregale puertas y subí los cajones a 5."
- **Turno 3:** "Hacelo módulo aéreo de cocina, 800 de ancho y 350 de fondo."

Por cada turno verificar:
- La respuesta trae `success:true` + `reply` + `source` + (si hay params) un objeto
  `design` con `pieces`, **o** una pregunta aclaratoria. **Nunca** un string de error crudo.
- Con params presentes, la respuesta incluye `status:"pending_validation"` (HITL) — el
  cliente NO persiste hasta confirmación del usuario. Esto es esperado, no un bug.
- El viewer 3D / cutlist se actualizan al mueble descrito.
- **Turno 3 (crítico):** módulo `aereo` con **0 piezas de zócalo** (baseline confirmado
  a nivel motor: aéreo W800 H600 → 0 zócalos). El mapping `kitchen_high → aereo` vive en
  `normalizeDesignParams` (chat.js).

**Fallback chain (crítico):**
- Invalidar el proveedor primario **solo en env de shell temporal** — p.ej. lanzar el
  server con `GEMINI_API_KEY` vacía en el shell (`set GEMINI_API_KEY= && ...`).
  **NUNCA editar `server/.env`.** Restaurar el shell después.
- Confirmar que el chat sigue respondiendo por la cadena `gemini→vertex→ollama→regex`
  y devuelve `source:"regex-fallback"` (u otro proveedor vivo) **sin 500 al usuario**.
- Nota: el parser regex local (`nlParser`) es el piso de la cadena y **nunca lanza**,
  así que el 500 solo aparecería por un bug en la ruta, no por falta de LLM.

## P4 — Motor paramétrico + Viewer 3D (casos borde)

Baseline ya verificado por Claude a nivel motor — Antigravity debe reproducir:

- **CASE A (PASS):** base W800 H870 D580, `moduleType:"base"`, 2 cajones.
  → `success:true`, 0 errores de validación. **Fondo del cajón = 738mm**
  (interior 764 = 800 − 2×18; 764 − 26 de guía telescópica = 738). Piezas
  `"Fondo Cajón 1/2"` con `width:738`.
- **CASE B (PASS):** aéreo W800 H600 D320, `moduleType:"aereo"`, 2 estantes.
  → `success:true`, **0 piezas de zócalo**, sin warnings falsos de fondo.
- **CASE C (REJECT):** W3000 H2600.
  - **[CORRECCIÓN 3 — assertion real]** El validador **NO** emite un código
    `PIECE_EXCEEDS_PLATE`. Emite `status:"RECHAZADO"` + `errors` = array de **6 strings**
    tipo `'Peca "Techo" (2964mm) excede o comprimento maximo da chapa (2750mm)'`
    (Techo, Base Inferior, Zócalo Frontal, Zócalo Trasero, Estante 1, Estante 2).
    Assertar contra `status==="RECHAZADO"` y `errors.length===6` — **no** hacer grep por
    `PIECE_EXCEEDS_PLATE` (da falso FAIL). `summary` = "6 erro(s) critico(s)...".
  - La UI debe reflejar el rechazo real del validador, **no** un "all checks passed"
    hardcodeado. Si lo hace, ESO es el bug → fix aditivo.

## P5 — Galería (persistencia) + Clipboard

- **[CORRECCIÓN 4 — premisa 503]** Supabase SÍ está configurado (`SUPABASE_URL ✓`), así
  que `POST /api/designs/save-viable` probablemente pega a la DB real y devuelve **201**,
  no el 503 que el plan asumía. Verificar el 201 y la fila en `viable_designs`. Si hay
  503, reportar sin parchear.
- Generar CASE A → "Guardar como Diseño Viable" → validar POST + status.
- Galería: `GET /api/designs/viable` → corroborar badge + dimensiones.
- **Clipboard (manual):** "Copiar" → focus canvas → `Ctrl+V` → rehidratación vía
  `generateProject` + `Ctrl+Z`. Requiere mano de Eduardo (headless no cubre clipboard OS).
- CASE C → intentar guardar → rechazo `NOT_VIABLE`, no persiste.

## P6 — Loop de corrección de errores (sin cambios)

Ante cada error en P1–P5: **1)** Reproducir → **2)** Aislar (causa raíz en 1 frase) →
**3)** Fix aditivo (guard/null-check/mapping, sin tocar core) → **4)** Verificar
(`npm test` + caso puntual) → **5)** Loguear en `PROMPTS_LOG.md` (error, causa, fix
con archivo+líneas, resultado). Un fix, una verificación. Si un fix exigiera reescribir
lógica core → **PARAR y reportar como recomendación**, no ejecutarlo.

## P7 — Compuerta de regresión

- **[CORRECCIÓN 5 — conteo de tests]** `cd server && npm test` → **117/117 pass**
  (no 90). El "90" del brief está desactualizado; el real medido hoy es 117, 0 fail.
- `npm run build` en client → **0 errores** (esperar hasta ~3 min).
- Recargar app local y confirmar boot sin errores.

---

## DECISIÓN — Modo de browser (resuelta)

**Modo: HÍBRIDO.**

| Capa | Cómo | Quién |
|---|---|---|
| API/motor (design object, aéreo 0 zócalo, 738mm, W3000 RECHAZADO, fallback, save-viable) | `curl` + `node` directo — **sin browser** | Autónomo (Antigravity + Claude) |
| Consola DevTools, red `/api/chat/design`, screenshots DOM, panels visibles | **Harness headless** (Puppeteer/Playwright) — corre en Windows | Autónomo |
| Render del canvas 3D (three.js/WebGL), Clipboard `Ctrl+C`/`Ctrl+V` | Interacción manual | Eduardo |

**Por qué:** el `browser_subagent` de attach-a-Chrome-vivo falla en Windows
("local chrome mode only supported on Linux"), pero **headless Puppeteer sí corre en
Windows** — es otro mecanismo. Cubre consola + red + DOM de forma autónoma. Solo el
render WebGL (puede salir en blanco headless sin GPU) y el clipboard OS quedan manuales.
Requiere `npm i -D puppeteer` en el cliente (descarga Chromium ~150MB) — es una dep de
dev, aditiva, fuera del core.

**Riesgo latente:** si el canvas 3D es la única prueba de que el viewer "actualiza",
headless no lo garantiza. Mitigación: assertar el estado del viewer vía el objeto
`design.pieces` en red (fuente de verdad), y usar el screenshot solo como evidencia visual.
