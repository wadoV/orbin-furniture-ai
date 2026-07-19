# PROJECT_SNAPSHOT.md — Orbin AI v4.5 (COMMERCIAL_READY)
> Generated: 2026-05-31 | For clean-context resumption
> ⚠️ Este snapshot está DESACTUALIZADO respecto al código real (HEAD ~jul-2026 ya tiene
>   Stripe+Mercado Pago, Supabase Auth real, exports DXF/DAE/OBJ/GLTF, Plano PDF, PBR).
>   Auditar sobre el código, no sobre este archivo.

---

## CHANGELOG DE AUDITORÍA

### 2026-07-19 — P0 ley de chapa + HARDWARE unificados ✅ COMMITEADO `c35a248` (45/45 tests)
- **Bug P0 resuelto:** el motor tenía DOS constituciones físicas contradictorias. `closetEngine.js`
  definía `MATERIAL` local (2800×2070, kerf 3.2) mientras `validator.js` usaba el de `constants.js`
  (2750×1840, kerf 4). El generador producía diseños que su propio validador rechazaba y violaba la
  regla dura (chapa 2750×1840).
- **Fix:** `constants.js` es FUENTE ÚNICA — `PLATE 2750×1840`, `SAW_KERF 3.2`, `NESTING_MARGIN 50`,
  y un único objeto `HARDWARE` con todas las claves (motor: `SLIDE_CLEARANCE 13`, `DRAWER_FRONT_GAP 2`,
  `DOOR_GAP_W 2.5` [por hoja ≠ `DOOR_GAP_W_TOTAL 5`], `DOOR_GAP_H 4`; validador: `DRAWER_SLIDE_TOTAL 26`).
  `closetEngine.js` → `const { MATERIAL, HARDWARE } = require('./constants')`, sin objetos locales.
- **Verificado:** suite 45/45 con constantes de chapa unificadas; unificación HARDWARE probada
  behavior-preserving (mismos valores). Revalidar local: `cd server && node --test src/engine/smoke.test.js src/engine/engine.test.js` → pass 45/fail 0.
- **Colateral:** el working tree tenía un `closetEngine.js` truncado sin commitear (WIP de `generateCutList`
  con descuento de tapacanto); se reparó la cola preservando el WIP.
- **Nota de entorno:** proyecto en OneDrive (`Documents\...`). El mount del sandbox trunca de forma
  intermitente la lectura de archivos recién escritos — es artefacto del mount, NO corrupción real
  (la ruta Windows siempre está íntegra). Correr tests localmente o materializar copia en `/tmp`.
### 2026-07-19 (l) — La app "no arrancaba": puerto equivocado en el lanzador
- **CAUSA RAÍZ:** `ARRANCAR.bat` abría el navegador en `localhost:5173` pero `vite.config.js`
  fija `port: 5174`. La app SÍ arrancaba — en 5174 — y el navegador iba a un puerto vacío.
  Confirmado por `.env`: `VITE_AUTH_REDIRECT_URL=http://localhost:5174/app`. Corregido el .bat.
- **Descartado que fuera código:** el bundle completo de `App.jsx` con todos los imports locales
  resueltos compila (548kb, 0 errores). Ningún cambio de esta sesión rompe el arranque.
- **Presets de cocina irreales:** `kitchen_cabinet` tenía 720mm ⇒ con encimera de 30mm daba
  750mm de altura de trabajo, **150mm por debajo del estándar** (ISO/ABNT 850-920, típico 900).
  `kitchen_island` igual (900+30=930). Ambos a **870** ⇒ 900mm exactos con encimera. VALIDADOS.

### 2026-07-19 (k) — doorStyle + avisos falsos (87/87 tests)
- **`doorStyle:'overlay'|'legacy'`** — simétrico a `topStyle` pero en PROFUNDIDAD:
  `overlay` ⇒ carcasa `CD = D − T`, puerta montada con su cara en `D` ⇒ profundidad
  ACABADA = lo pedido (580 → 580). `legacy` ⇒ comportamiento histórico (580 → 598).
  Default: `base`→overlay, resto→legacy (cero regresión). Sin puertas no descuenta nada.
  Todas las piezas de carcasa (laterales, tamponado, techo, piso, fondo, internalDepth)
  pasan a usar `CD`.
- **Aviso falso eliminado:** el validador exigía 300mm de profundidad mínima también a los
  AÉREOS (un aéreo de baño son 150mm, uno de cocina 320mm). Ensuciaba todos los planos de
  aéreos y restaba credibilidad a los avisos reales. Ahora la regla base solo aplica a no-aéreos;
  para aéreos el mínimo es 100mm.
- **Preset `office_desk`:** `drawerLayout:'right'` → `'vertical'`. El motor solo reconoce
  `'horizontal'`; `'right'` se ignoraba en silencio y el preset prometía algo que no ocurría.
- **Servidor:** el error de pantalla es "No se puede conectar al servidor" (backend caído),
  no un fallo del motor: los 10 presets generan y VALIDAN sin excepciones.

### 2026-07-19 (j) — Botón "+" y hallazgos abiertos
- **Botón "+" NO agregaba módulos:** `onAddModule` solo hacía `setActiveTab('params')` + scroll.
  No creaba nada. El usuario pulsaba luego un preset (`replace:true`) y el módulo anterior
  desaparecía ⇒ síntoma "reemplaza en vez de agregar". Ahora genera desde la config actual y
  APILA vía `handleGenerate` sin replace (aditivo, reversible con Ctrl+Z).
- **Stale closure:** `App.jsx` apilaba con `[...modules, …]` mientras `saveHistory` ya usaba
  `modulesRef.current`. Unificado a `modulesRef` (misma causa, segundo síntoma).
- **PROFUNDIDAD — confirmado que NO aplica la reducción:** con puertas sobrepuestas el lateral
  mide `D` completo (580) y la puerta se monta a `z=589` ⇒ profundidad ACABADA real = **598mm**,
  18mm más de lo pedido. Es el mismo patrón que la altura. Falta `doorStyle:'overlay'|'inset'`
  simétrico a `topStyle` (`overlay` ⇒ lateral = D − T). **PENDIENTE de implementar.**
- **Presets:** los 10 generan diseños VALIDADOS (0 errores). Las "inconsistencias" son otras:
  `office_desk` usa `drawerLayout:'right'` que el motor NO reconoce (solo `'horizontal'`) y lo
  ignora en silencio; y los `aereo` disparan el aviso "profundidad muy rasa (mín 400mm)" que es
  una regla de mueble base y no aplica a aéreos ⇒ aviso FALSO. **PENDIENTE.**

### 2026-07-19 (i) — topStyle: tapa sobrepuesta vs encajada (81/81 tests)
- **Verificación pedida:** la regla `lateral = H − T` NO estaba inyectada. El motor emitía
  lateral=700 para H=700 en 15mm y 18mm — desvío de exactamente `T`.
- **Conflicto resuelto (no era un bug olvidado):** la cabecera del motor está marcada
  `[PROTECTED] DNA_V1_RESTORATION` y declara lo contrario ("sides floor-to-top", "top = W−2T").
  Son dos armados legítimos, así que se parametriza en vez de reemplazar:
  - `topStyle:'overlay'` → tapa APOYADA encima: `lateral = H − T` · `techo = W`.
    La altura pedida es la ALTURA ACABADA. 700 con 15mm ⇒ 685; con 18mm ⇒ 682.
  - `topStyle:'inset'` → DNA V1: `lateral = H` · `techo = W − 2T`.
  - Default automático: `moduleType:'base'` → overlay; standard/aereo → inset (cero
    regresión en diseños y tests existentes).
- **Coherencia obligatoria:** en overlay la tapa pasa a ancho COMPLETO `W`. Con `W−2T`
  quedaría flotando dejando un hueco de `T` a cada lado sobre el canto del lateral.
- **Excepción:** base + encimera comprada aparte (travesaños, sin tapa de MDF) ⇒ no se
  descuenta espesor, el lateral llega arriba y la encimera apoya sobre él.
- **Nota:** `makePiece` redondea x/y/z a entero, así que con espesor impar el EJE 3D se
  desplaza 0.5mm. Las medidas de CORTE son exactas (685+15=700). A escala 1:8 son 0.06mm
  en papel: por debajo de la resolución del dibujo, no se corrige.

### 2026-07-19 (h) — El cruce eran las PUERTAS + cotas derivadas del modelo
- **CULPABLE IDENTIFICADO (no era la cubierta):** las puertas son SOBREPUESTAS y solapan los
  laterales ~17mm por lado (Puerta 1 x=1..299, laterales x=0..18) — correcto en carpintería.
  Pero se dibujaban en trazo abierto, así que sus aristas cruzaban los laterales y el interior
  se transparentaba. Ahora van opacas (`'FD'`, z=6, las últimas): la puerta está delante y tapa.
- **Cota de rodapié ELIMINADA:** la cadena interna derecha ya descompone toda la altura (sus
  tramos suman H). Era duplicada y forzaba un segundo nivel de cota. Plano más limpio.
- **Cota de altura derivada del MODELO:** `elevationBox` calcula `carcassH` (arista superior más
  alta de laterales/techo/travesaños). Nivel 1 acota la carcasa; nivel 2 acota la altura total
  SOLO si difiere. Hoy coinciden (720/720) ⇒ una sola cota.
- **⚠️ HALLAZGO DE MODELADO (decisión de producto pendiente):** no existe pieza de cubierta en
  el despiece (`hasCountertop:true` no emite pieza) y `latH = H`, es decir los laterales llegan
  a la altura final. Si la regla de taller es que la cubierta se apoya encima y H es la altura
  ACABADA, entonces los laterales deberían medir `H − espesor_cubierta` y el despiece actual los
  emite altos de más. Afecta medidas de corte reales — requiere decisión de Eduardo.

### 2026-07-19 (g) — Niveles de cota del lado derecho
- **Segundo cruce (distinto del marco):** en el lado derecho convivían DOS sistemas de cota
  a 2mm uno de otro — la cadena interna de alturas (`drawElevation`, `xMax+12`) y la cota del
  rodapié (`ExportPanel`, `xMax+10`, con extensiones desde `xMax+3`). Las extensiones del
  rodapié atravesaban la cadena: por eso "59"/"50" se enredaban con "100 mm".
- **Fix (convención de dibujo técnico — un sistema por nivel):** nivel 1 `+10mm` = cadena
  interna (vía `opts.internalDimOffset`); nivel 2 `+26mm` = rodapié, con líneas de extensión
  arrancando en `+14` (después del nivel 1, no desde el mueble). Separación verificada: 16mm.

### 2026-07-19 (f) — Marco de cotas desalineado + planta vectorial
- **CAUSA RAÍZ (líneas cruzando + rodapié fuera de sitio):** había DOS geometrías para el
  mismo dibujo. `drawElevation` escala con `min((areaW-40)/W,(areaH-40)/H)` y centra;
  `ExportPanel` recalculaba por su cuenta `modulePaperW/H = img*0.85`. Desvío medido:
  **+21%**. El marco de cotas era un 21% mayor que el mueble ⇒ sus líneas lo cruzaban, y
  `yMax - bhPaper` dejaba la cota del rodapié por debajo del zócalo real.
  Fix: `elevationBox()` exportado como FUENTE ÚNICA; `drawElevation` la usa y la devuelve;
  `ExportPanel` acota con ella y calcula `bhPaper` con la escala real. Desvío ahora 0%.
  El rótulo "E 1:N" también se derivaba del marco falso — ahora usa la escala real.
- **Guard:** la cota del rodapié solo se dibuja si `cfg.baseboard !== false && BH > 0`.
  Antes se acotaba la altura de un zócalo inexistente.
- **Planta sin fondo:** la vista superior deja de usar la captura 3D (que arrastra el fondo
  del visor) y pasa a ser SIEMPRE vectorial: rect relleno `#f2f2f2` con trazo `#111` —
  mueble gris limpio, sin fondo — y centrada para compartir eje con el alzado.

### 2026-07-19 (e) — Armonía del plano: colisiones, oclusión y cotas duplicadas
- **Amontonamiento (plano de montaje) — CAUSA RAÍZ:** `alzadoFromCapture` escribe su cota de
  ancho POR DEBAJO del dibujo (línea +16, medida +31, interno +44 ⇒ ~48px), pero el layout
  solo dejaba 22px antes del título de la planta → la cota invadía "2 · PLANTA SUPERIOR".
  `planLayout` ahora reserva canales de anotación explícitos (`ALZ_DIM=50`). Holgura medida:
  9px en todos los casos extremos. Planta acotada a 80px.
- **Rótulo redundante eliminado:** `plantaFromCapture` escribía "{w} × {d} · prof." en `ay-10`,
  justo sobre el título. El ancho ya se acota en el alzado y la profundidad a la izquierda.
- **Líneas cruzando la carcasa (plano ejecutivo) — CAUSA RAÍZ:** `drawElevation` dibujaba todas
  las piezas en el orden del motor y solo con trazo, así que la cubierta y el zócalo se veían
  atravesando los laterales. Ahora hay orden de profundidad (`Z_ORDER`, back→front) y las
  piezas macizas (`SOLID`) se rellenan de blanco (`'FD'`) para ocultar lo que tapan. Puertas y
  frentes siguen en trazo abierto para no esconder el interior. Verificado: la cubierta se
  dibuja la última.
- **Cotas duplicadas:** `ExportPanel` dibujaba sus propias cotas de ancho/alto ADEMÁS de las de
  `drawElevation` ⇒ "600"+"600 mm" y "720"+"720 mm" superpuestas. `drawElevation` acepta
  `opts.overallDims/internalDims/title` (por defecto `true` ⇒ retrocompatible) y el plano
  ejecutivo lo llama con `overallDims:false`.
- **i18n:** clave `avisos` añadida a los 3 diccionarios (OBSERVACIONES / OBSERVAÇÕES / NOTES) y
  el título del alzado del plano ejecutivo ya no está hardcodeado — se pasa según `lang`.
  Verificado ES/PT/EN.

### 2026-07-19 (d) — Cableado UI/PDF + plano adaptativo + cajetín editable
- **Alertas visibles:** `design.specAdjustments` se pinta en `ResultPanel.jsx` (banner por
  severidad, ANTES de la validación estructural) y viaja al plano en una banda
  `OBSERVACIONES` (`buildAvisos` en `planGenerator.js`). Un aviso que solo vive en pantalla
  no existe para quien corta: ahora va impreso en el plano que llega al taller.
- **Alzado desfigurado — CAUSA RAÍZ:** la caja del alzado era fija (440×168) y `buildAlzado`
  escala con `min(w/ancho, h/alto)`. En un mueble de 2400mm de alto mandaba el alto → escala
  0.07 → dibujo de 168px ahogado por cotas de 11px fijas. No era deformación de aspecto,
  era inanición de escala. Nuevo `planLayout(cfg)`: reparto vertical adaptativo que prioriza
  el alzado y acota la planta (máx 92px, solo debe mostrar la profundidad).
  Ganancia medida: ropero 2400 **+59%**, columna 600×2000 **+70%**, base cocina **+43%**.
  Cada vista rotula su escala (`esc. 1:N`). Banda del conjunto 300→384px.
- **PDF con cajetín EDITABLE:** el plano se rasteriza a PNG (todo su texto es imagen). Ahora
  el SVG deja en blanco empresa/setor/diseñador/fecha (`options.editableFields`) y
  `ExportPanel` superpone campos **AcroForm** reales pre-rellenados. Geometría compartida vía
  `CAJETIN_FIELDS`/`PLAN_VIEWBOX` exportados (sin números mágicos duplicados).
  Verificado: jsPDF `Rect` usa origen top-left y hace el flip internamente.
  Material y nº de piezas siguen impresos (son datos derivados, no editables).

### 2026-07-19 (c) — Transparencia de spec + integridad de nesting (74/74 tests)
- **Silencio corregido:** el auto-fit de gavetas alteraba el pedido del cliente sin avisar.
  Ahora todo cambio se reporta en `design.specAdjustments[]` con `code` estable (i18n-able),
  `severity`, `requested` y `applied`. Códigos: `DRAWER_COUNT_REDUCED` (critical),
  `DRAWER_HEIGHT_ADJUSTED` (info), `PIECE_EXCEEDS_PLATE` (critical), `BACK_PANEL_SPLIT` (warning).
  Bandera rápida: `design.hasSpecAdjustments`.
- **Bug de nesting (grave):** el packer era ciego a la orientación — un lateral 600×2400 no
  entraba en el alto útil (1740) y caía en una rama que lo colocaba IGUAL, fuera de la chapa.
  Layout imposible y conteo de chapas no confiable. Corregido: normalización de orientación
  (lado largo sobre el largo de chapa) + guardas que re-verifican AMBOS ejes.
- **Defecto de material (costaba dinero):** el fondo de un ropero 2400 (2364×2263) no cabe en
  ninguna orientación → se descartaba → el motor pedía **0 chapas de 6mm**. Ahora se parte en 2
  por el eje que viola la chapa (práctica de taller, ya recomendada por el validador), las partes
  llevan sus dimensiones reales en `w/h`, y el material se contabiliza: 6mm → 2 chapas.
- **Cobertura nueva:** `server/src/engine/manufacturing.test.js` (15 tests) — invariante de que
  ninguna pieza colocada sale de la chapa, conteo ≥ mínimo geométrico, nada se pierde en silencio.
- **Pendiente:** commitear. Ver riesgos aún sin test en el bloque siguiente.

- **RIESGO CERRADO en `2004ca1`:** `c35a248` incluía también el WIP de
  `generateCutList` (descuento de tapacanto en `cutWidth`/`cutHeight`) que estaba a medias en el
  working tree. Ese cambio altera las MEDIDAS DE CORTE reales y **no tiene test propio**: la suite
  solo verifica que el corte sea > 0 y determinista; el test "edgeBanding descuenta el espesor"
  valida `furnitureMathSpecs`, NO la deducción del motor. Añadir un test de la deducción neta
  (pieza con tapacanto 1 lado / 2 lados / all) antes de que llegue a un taller real.

---

## 1. ARCHITECTURAL STACK & SYSTEM OVERVIEW

### Runtime & Frameworks
| Layer | Tech | Port |
|---|---|---|
| Frontend | React 18 + Vite + React Router v6 | 5173 |
| Backend | Node.js + Express | 3003 |
| Styling | Tailwind CSS (custom design system) | — |
| Realtime | Socket.IO (collaboration) | via 3003 |
| DB | Supabase (PostgreSQL) + in-memory fallback | — |
| i18n | react-i18next (ES/PT/EN) | — |

### AI Orchestration (server/src/ai/)
- **Primary:** Gemini 2.5 Flash (`GEMINI_MODEL=gemini-2.5-flash`, Google AI Studio key configured)
- **Local fallback:** Ollama → `deepseek-r1:7b` (localhost:11434)
- **Tertiary:** Claude client (claudeClient.js) + Vertex AI client (vertexClient.js)
- **Orchestrator:** `aiOrchestrator.js` routes requests across providers with auto-fallback

### UI Design System
- **Theme:** Ultra-dark premium SaaS (`bg: #0D0D0D`, surface layers: `#111`, `#1A1A1A`, `#2E2E2E`)
- **Primary accent:** Gold `#F5A623` (hover: `#E8951A`, dark: `#D4890F`)
- **Typography:** Inter, all-caps tracking for labels (`tracking-[0.15em]`)
- **Component classes:** `.btn-primary`, `.btn-secondary`, `.card`, `.card-glass`, `.input-field`, `.label`, `.badge-validado`, `.badge-rechazado`, `.badge-warning`, `.text-gradient`, `.chip`
- **Scrollbar accent:** Gold on hover
- **Icons:** lucide-react

---

## 2. CURRENT STATE OF THE CODEBASE

### Root: `C:\Users\Azomarg\Documents\Claude_projects\Orbin\`

### Server (`server/src/`)

| File | Function |
|---|---|
| `index.js` | Express entry point, Socket.IO init, CORS, routes mount |
| `engine/closetEngine.js` | **CORE** — Parametric furniture engine v4.5.0. Generates full cut list, validates geometry. DNA V1 rules: sides floor-to-top, internal top/bottom = W-2T, 13mm slide clearance, vertical grain on plinths. Supports 15/18/25mm MDF. |
| `engine/validator.js` | Structural validation → returns VALIDADO / RECHAZADO + warnings |
| `engine/nlParser.js` | Regex NL parser ES/PT/EN. Normalizes units (cm→mm, inches→mm). Used as Gemini fallback. |
| `engine/constants.js` | Brazilian MDF/MDP standards: plate 2800×2070mm, kerf 3.2mm, margin 50mm |
| `routes/design.js` | `POST /api/design/generate`, `POST /api/design/parse`, `GET /api/design/defaults` |
| `routes/projects.js` | CRUD persistence — Supabase primary, in-memory fallback. `POST /save`, `GET /`, `GET /:id`, `DELETE /:id` |
| `routes/chat.js` | AI chat endpoint, routes through aiOrchestrator |
| `routes/vision.js` | Image-to-parametric vision endpoint |
| `routes/stressTest.js` | Load testing route (dev only) |
| `ai/aiOrchestrator.js` | Multi-provider AI router: Gemini → Ollama → Claude fallback chain |
| `ai/systemPrompts.js` | Carpentry-specific system prompts for each AI provider |

### Client (`client/src/`)

| File | Function |
|---|---|
| `App.jsx` | Main orchestrator. Manages global state: design, modules, activeTab, plan limits, undo/redo, Socket.IO collaboration lifecycle |
| `main.jsx` | React entry, Router, context providers wrapping |
| `index.css` | Full design system (Tailwind layers + custom component classes) |
| `api/client.js` | Axios wrapper → `http://localhost:3003/api` |
| `context/UserContext.jsx` | **SaaS plan system** — `free | pro | enterprise`. Defines limits: maxModules, export permissions, AI access, allowed thicknesses. Simulated auth (no real backend auth yet). |
| `context/PreferencesContext.jsx` | User preferences: language, units, UI settings |
| `components/LandingPage.jsx` | Marketing landing page. Entry point for unauthenticated users. |
| `components/AuthPages.jsx` | Login + Register with plan injection (`?plan=pro` param). Routes to `/app` after auth. |
| `components/PricingDisplay.jsx` | Pricing table: Free / Pro (R$99/U$19) / Enterprise (R$249/U$49) |
| `components/InputPanel.jsx` | Main design input: dimensions, module type, NL input field |
| `components/ResultPanel.jsx` | Renders validation badge + design summary |
| `components/CutListTable.jsx` | Cut list UX: synchronized selection, delete by piece, Ctrl+Z undo, eye toggle per piece |
| `components/Viewer3D.jsx` | Three.js 3D visualization of generated module |
| `components/ChatPanel.jsx` | AI chat assistant panel (Pro/Enterprise gated) |
| `components/CarpentryAdvisor.jsx` | Specialized carpentry advice AI component |
| `components/ExportPanel.jsx` | Export to PDF/CSV/CNC/BOM (plan-gated) |
| `components/ProjectsPanel.jsx` | Project save/load/delete UI (calls /api/projects) |
| `components/MemoryPanel.jsx` | Project memory/version history UI |
| `components/DesignHealthPanel.jsx` | Visual design quality metrics panel |
| `components/ValidationReport.jsx` | Detailed structural validation display |
| `components/AIVisualStylist.jsx` | AI-powered visual style suggestions |
| `components/ImageToParametricPanel.jsx` | Image → parametric params via vision AI |
| `components/MultiplayerLayer.jsx` | Socket.IO real-time collaboration cursor overlay |
| `components/PresentationMode.jsx` | Client presentation / full-screen mode |
| `components/OnboardingFlow.jsx` | New user onboarding steps |
| `components/WelcomeScreen.jsx` | First-run welcome screen |
| `components/ViralShare.jsx` | Social sharing component |
| `components/Header.jsx` | Top nav: plan badge, tab navigation, undo/redo controls |
| `engine/CutlistGenerator.js` | Client-side cut list generation utilities |
| `engine/PricingEngine.js` | Material cost estimation engine |
| `engine/designAnalyzer.js` | Design health scoring logic |
| `engine/materialLibrary.js` | Materials catalog with prices |
| `engine/exportAdapters.js` | PDF/CSV/CNC export format adapters |
| `engine/projectMemory.js` | Version history, undo stack, project snapshots, localStorage |
| `engine/collaboration.js` | Socket.IO client — room join, cursor broadcast, design sync |
| `data/materials.js` | Brazilian market material prices |
| `i18n.js` | i18next setup, ES/PT/EN namespaces |

### Infra
| File | Notes |
|---|---|
| `server/.env` | `SUPABASE_URL` ✅ `SUPABASE_ANON_KEY` ✅ `SUPABASE_SERVICE_KEY` ✅ `GEMINI_MODEL=gemini-2.5-flash` ✅ `OLLAMA_MODEL=deepseek-r1:7b` ✅ |
| `server/supabase/migrations/001_create_projects.sql` | Migration SQL created — **status unknown if executed against live DB** |
| `start.bat` | One-click launcher: installs deps, starts server + client, opens browser |
| `.cloud/agents/orbin_engine.md` | Agent definition for Orbin engine cloud operations |

---

## 3. RECENT CHANGES & LOGS

### Git History (chronological):
```
da141e0  Initial commit
dcce563  feat(ai): Ollama llama3.2:1b + Gemini fallback + precision fixes v3.1.0
77ccd83  feat: Vertex AI integration + AI Orchestrator + carpentry stabilization v3.5
013f06f  Orbin v2.6.0 — Fabrication Intelligence Phase 1
d3cd5ba  feat(v2.7): Visual Intelligence + Project Memory evolution
c779302  feat(v4.0): CutList UX — synchronized selection, delete by piece, Ctrl+Z, eye button
98ec9f2  feat(v4.5): COMMERCIAL_READY — Landing, Auth, SaaS plan system [LATEST]
```

### v4.5 Critical Changes (last commit — LATEST):
- **LandingPage.jsx** — Full marketing landing page added (public entry point)
- **AuthPages.jsx** — Login/Register pages with `?plan=` query param injection
- **UserContext.jsx** — Complete SaaS plan system: `free | pro | enterprise` with feature gates
- **PricingDisplay.jsx** — Pricing table component (BRL + USD pricing)
- **App.jsx** — Integrated plan-limit enforcement: `PlanLimitAlert` modal, plan-gated features
- **React Router** — Added routes: `/` (Landing), `/login`, `/register`, `/app` (main tool)

### v4.0 Critical Changes:
- **CutListTable.jsx** — Rewritten UX: click-to-select synced with 3D viewer, per-piece delete, Ctrl+Z undo stack, eye visibility toggle
- **closetEngine.js** — `[LEGACY_RESTORATION]` tag: DNA V1 rules restored: sides floor-to-top, internal plates at W-2T, 13mm slide clearance hardcoded in HARDWARE constants

### Supabase Status (verified 2026-05-17):
- SELECT ✅ INSERT ✅ GET ✅ DELETE ✅ — **Fully operational**
- Both ANON_KEY and SERVICE_KEY configured (both point to anon key — valid for MVP with RLS allow_all policy)

---

## 4. ACTIVE BACKLOG & IMMEDIATE NEXT STEPS

### 🔴 Critical / Blockers
- **Real authentication not implemented** — `UserContext.jsx` simulates auth state locally (no JWT, no Supabase Auth). Users can bypass plan limits by editing state. Next: implement Supabase Auth (`supabase.auth.signUp`, `signIn`, session persistence).
- **Migration execution unknown** — `001_create_projects.sql` was created but confirm via Supabase dashboard whether it was run. If not, run it before any data persistence testing.

### 🟡 Pending / Medium Priority
- **`GEMINI_API_KEY` not shown in .env** — Key is described as configured but not visible in env dump (may be present but masked). Verify key is active in `server/.env`.
- **Vertex AI / Claude client** — `vertexClient.js` and `claudeClient.js` exist but likely have no credentials configured. Low priority for MVP.
- **Export adapters** — PDF/CSV export components exist but export functionality may be UI-only stubs without real file generation logic. Needs audit of `exportAdapters.js`.
- **OnboardingFlow.jsx** — Created but integration into routing flow needs verification.
- **ViralShare.jsx** — Created, integration status unknown.

### 🟢 Immediate Next Step (Start Here)
**Implement Supabase Auth** — This is the critical path to a real commercial product:
1. `server/.env`: add `SUPABASE_ANON_KEY` to client-side (already have it)
2. `client/src/context/UserContext.jsx`: replace mock auth with `supabase.auth.signUp()` / `signIn()` / `onAuthStateChange()`
3. Store `plan` field in Supabase `users` table or `user_metadata`
4. Gate `UserContext` plan state on real session — not localStorage
5. Add `supabase.auth.signOut()` to Header logout button

---

## 5. Funcionalidades pospuestas para V2

- **AI Vision**: El módulo de "AI Vision" (conversión de imagen a diseño paramétrico) ha sido desactivado de forma elegante. Esta decisión responde a un enfoque comercial más directo en la etapa actual. La funcionalidad, incluyendo la interfaz y las rutas, se ha pausado y se retomará para la versión V2.

---

## QUICK START (for new session)
```bash
# Project location
C:\Users\Azomarg\Documents\Claude_projects\Orbin\

# Launch
start.bat              # starts both server (3003) and client (5173)

# Or manually:
cd server && npm run dev
cd client && npm run dev
```

**Supabase Dashboard:** https://supabase.com/dashboard/project/fqbqdsmwnulvbysqukam  
**Project URL:** https://fqbqdsmwnulvbysqukam.supabase.co
