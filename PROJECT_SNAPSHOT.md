# PROJECT_SNAPSHOT.md — Orbin AI v4.6 (COMMERCIAL_READY)
> Generated: 2026-08-02 | For clean-context resumption
> ⚠️ Este snapshot refleja el estado verificado de HEAD v4.6 con 265/265 tests pasando en server y build 100% verde en cliente.

---

## ESTADO DEL SERVIDOR (verificado 2026-08-02)

| Ítem | Valor | Verificado en |
|---|---|---|
| Runtime | Node ≥ 20 · Express 4 | `server/package.json` |
| Puerto | **3003** (`process.env.PORT \|\| 3003`, bind `0.0.0.0`) | `server/src/index.js:53,294` |
| Suite | `node --test src/{engine,ai,routes}/*.test.js` | `npm test` |
| **Resultado** | **265/265 PASS · 52 suites · 0 fallos** | corrida 2026-08-02 (c) |
| Auth | `requireAuth` en toda ruta mutante · plan desde `app_metadata` | `authContract.test.js` |
| Cuota de IA | `free` 5/día (UTC) · `pro`/`enterprise` ilimitado | `aiPlanLimits.test.js` |
| Contador | Supabase `ai_usage` + RPC atómico · ⚠ **migración 008 sin correr** | `008_create_ai_usage.sql` |
| Cascada IA | `gemini → vertex → ollama → parser regex local` | `aiOrchestrator.js` |
| Deadline IA | `AI_PROVIDER_TIMEOUT_MS` (12000) por proveedor | `aiOrchestrator.js` |
| Timeout HTTP Gemini | `GEMINI_TIMEOUT_MS` (10000) vía `AbortSignal` | `geminiClient.js` |

⚠️ **`openrouterClient.js` es un stub y NO está en `PROVIDER_CHAIN`. No hay cliente DeepSeek.**
Los tres proveedores activos usan credenciales de Google: no hay redundancia externa real.

Bitácora de bucles autónomos: [`task.md`](task.md).

---

## CHANGELOG DE BACKEND

### 2026-08-02 (d) — CABLEADO DE MURO DE UPGRADE EN FRONTEND (BUCLE 006) ✅ 265/265 tests · build 100% verde · cierra P8

**Manejo de HTTP 403 `PLAN_LIMIT_REACHED`:**
- **`client/src/api/client.js`**: `ApiError` ahora propaga `details` con los metadatos de la cuota (`used`, `limit`, `resetAt`, `code`).
- **`client/src/components/UpgradePrompt.jsx`**: Acepta `details` y despliega la UI indicando exactamente el consumo de la cuota gratuita (`used/limit`) y la hora del reseteo en UTC.
- **`client/src/App.jsx` & `ImageToParametricPanel.jsx`**: Interceptan respuestas 403 en `/api/design/generate`, `/api/chat/design` y `/api/vision/analyze-space` para mostrar el modal de upgrade.

---

### 2026-08-02 (c) — GATE DE PLAN EN LOS ENDPOINTS DE IA ✅ 265/265 tests · cierra P5

**Regla:** `free` = 5 llamadas de IA por día (UTC) · `pro`/`enterprise` = ilimitado.
Plan desconocido → tratado como `free` (fail-closed en entitlements).

**El hallazgo que cambió el diseño: tres de los cinco caminos no consumen IA.**
`design.js POST /parse` es regex **local**; `design.js POST /generate` sólo llama al modelo
si viene `naturalLanguage` (con `params` es motor puro); y la Fase 2 del HITL
(`confirmFlow` + `action:'confirm'`) es **determinista y stateless**. Una guarda plana
habría convertido "5 generaciones con IA por día" en **"5 diseños por día en total"** —el
free ni siquiera podría usar el formulario manual— y le habría devuelto **403 al confirmar**
a quien gastó su última llamada proponiendo. Por eso `checkPlanLimit(feature, { when })`
acepta un predicado y sólo descuenta cuando de verdad va a haber una llamada al modelo.

- **`008_create_ai_usage.sql`** — tabla `ai_usage` (PK `user_id`+`day`), RLS habilitada
  **sin políticas** (sólo `service_role`), y RPC atómico `increment_ai_usage`
  (`INSERT … ON CONFLICT DO UPDATE … RETURNING`). Un read-then-write desde Node dejaría
  pasar 6 llamadas si dos peticiones concurrentes leen 4. Día en **UTC**.
- **`middleware/planLimits.js`** — store inyectable (`setUsageStore`) para tests.
  **Fail-OPEN deliberado** si el contador se cae: es una cuota comercial, no un control de
  seguridad; fail-closed convertiría una caída de Supabase en un apagón del producto para
  los que PAGAN. Un `free` no puede volverse `pro` durante la caída (el plan sale del JWT
  verificado), sólo gastar de más.
- **403 con superset compatible:** `code:'PLAN_LIMIT_REACHED'` (traducido ES/PT/EN),
  `error` legible en español, `action:'UPGRADE_REQUIRED'`, `plan`, `limit`, `used`,
  `resetAt`. Headers `X-Orbin-AI-Limit`/`X-Orbin-AI-Used` en las respuestas que pasan.
- **Contrato de i18n ampliado:** `i18nContract.test.js` escaneaba sólo `routes/`; un `code:`
  nacido en un middleware entraba a producción sin traducción y sin que nada fallara.
  Un middleware que responde al cliente es superficie user-facing.
- **`aiPlanLimits.test.js`** (+18): monta los routers reales y golpea por HTTP. Verificado
  por mutación (`free`→`Infinity` y quitar el predicado `when`): ambas fallan limpio.

⚠ **Falta para que esto exista en producción:** correr `008_create_ai_usage.sql` en
Supabase y tener `SUPABASE_SERVICE_KEY` en el entorno. Sin la tabla, el middleware queda en
fail-open: **la cuota no rige y nada falla**, que es justamente lo que la vuelve fácil de
olvidar. El front tampoco maneja el 403 todavía. → `task.md` P7/P8.

### 2026-08-02 (b) — AUTH & ENTITLEMENTS: candados sobre los fixes de seguridad ✅ 247/247 tests

**Auditoría de `server/src/routes/` — resultado: el código estaba bien; la protección
contra regresiones NO existía.**

Verificado empíricamente con `NODE_ENV=production` (servidor efímero + `fetch` real):
`POST /api/chat/design`, `POST /api/chat/parse`, `POST /api/design/generate`,
`POST /api/design/parse` → **401 sin token**, y `Bearer dev-token` **queda neutralizado**.

- **`requireAuth` está activo en todas las rutas mutantes.** `chat.js` y `projects.js` usan
  `router.use(requireAuth)` antes de declarar rutas; `design.js`, `vision.js` y `billing.js`
  lo aplican inline. Únicas excepciones, ambas correctas: `POST /billing/webhook` (lo llama
  el proveedor de pagos; se autentica por firma HMAC de Stripe y, en Mercado Pago,
  **re-consultando el pago contra la API en vez de confiar en el cuerpo recibido**) y
  `stressTest.js` (require condicional + guard: en producción no se monta).
- **El plan sale de `app_metadata`, nunca de `user_metadata`.** Confirmado en
  `middleware/auth.js` (`requireAuth` y `optionalAuth`) y en `billing.js` (escritura vía
  `service_role`). `user_metadata` sólo guarda `name` y `company_name` — datos de
  presentación, no de autorización.

**El problema real: ambos fixes estaban sostenidos por un comentario.** Los arreglos de
2026-06-27 (`user_metadata` → `app_metadata`) y 2026-07-21 (gate de `dev-token`) no tenían
ni una aserción. Las 234 pruebas seguían en verde si alguien quitaba `requireAuth` de una
ruta o volvía a leer `user_metadata`. Un comentario no impide que un refactor deshaga un
fix; sólo impide que se deshaga a propósito.

**Nuevo: `server/src/routes/authContract.test.js`** (+13 tests, 0 dependencias)

1. *Entitlements* — stub de `createClient` inyectado antes de cargar `auth.js`: el plan sale
   de `app_metadata`; un usuario que se autoasigna `user_metadata.plan = 'enterprise'`
   (ataque real vía `supabase.auth.updateUser()` desde devtools) sigue siendo `free`;
   sin plan → `free` (fail-closed). `optionalAuth` bajo la misma regla: si no, el bypass
   sólo se muda de puerta.
2. *Sin puerta trasera en producción* — `dev-token` y `dev-local-token` rechazados; token
   inválido no deja `req.user` adjunto; el mensaje de error no filtra `supabase`/`jwt`/stack.
3. *Barrido estático de `routes/`* — escanea el CÓDIGO FUENTE y exige que toda ruta
   `post|put|patch|delete` esté guardada. Para quedar fuera hay que declararla en
   `OUT_OF_SCOPE` **con motivo escrito** (el test valida que exista, que sea sustantivo y
   que no queden entradas muertas). Misma disciplina que `i18nContract.test.js`.

**El candado se verificó por mutación**, no por fe: leyendo `user_metadata` en `auth.js`
→ 2 fallos; quitando `requireAuth` de `vision.js` → 4 fallos. Ambas mutaciones revertidas
(`git diff` vacío).

**Hallazgo NO corregido — el paywall casi no existe donde cuesta plata.**
`req.user.plan` se consulta en **un solo lugar** de todo el backend: `projects.js:47`
(máx. 3 módulos en plan free al guardar). Los endpoints caros —`/api/chat/design` (LLM),
`/api/design/generate`, `/api/vision/analyze-space` (Gemini Vision, el más caro)— **no
miran el plan**. Un usuario `free` autenticado tiene IA ilimitada. Lo único que lo acota es
`aiLimiter`: **15 req/min por IP**, que es una defensa contra abuso, no un entitlement —
castiga a oficinas compartidas detrás de un NAT y se esquiva rotando IP. La arquitectura de
planes está impecablemente construida y casi nunca se consulta. Decisión de producto
(¿free trial deliberado o fuga de margen?), no defecto: ver `task.md` P5.

### 2026-08-02 — BACKEND: deadline en la cascada de IA ✅ 234/234 tests

**`npm test` no terminaba nunca.** No fallaba: colgaba en `chatDesign.e2e.test.js` tras 32
suites verdes. La causa era estructural, no del test.

- **El fallback sólo cubría errores, no cuelgues.** `runChain()` avanza de proveedor cuando
  el anterior *lanza*. Un proveedor que cuelga no lanza. `geminiClient` usaba `fetch()` sin
  `AbortSignal` — y `fetch` sin señal no tiene timeout. Ante un corte de red o un proveedor
  que acepta la conexión y no contesta, **la cascada quedaba detenida en el primer eslabón y
  el piso regex local nunca se alcanzaba**. Sólo `ollamaClient` tenía timeout propio.
- **Fix:** `withDeadline()` + `ProviderTimeoutError` en `runChain` (`AI_PROVIDER_TIMEOUT_MS`,
  default 12000). Un cuelgue se convierte en fallo y la cascada avanza. `AbortSignal.timeout()`
  en ambos `fetch` de `geminiClient` como defensa en profundidad, más `describeHttpError()`
  para no romper al parsear cuerpos de error no-JSON (un 502 de proxy es HTML).
- **Dos tests mentían sobre su premisa.** `chatDesign.e2e` y `paramContract` afirmaban correr
  "sin API keys" sin quitarlas: `vertexClient` hace `require('dotenv').config()` y
  `aiOrchestrator` lo importa, así que **salían a la red real contra Google en cada corrida**
  (facturable y no determinista). Hechos herméticos. `paramContract`: **9,2 s → 0,8 s**.
- **Trampa que costó un intento:** `delete process.env.X` NO alcanza — dotenv sólo respeta las
  claves que ya existen y la repuebla después del delete. Hay que asignar `''`.
- **Autocorrección:** el primer parche hacía `unref()` del timer del deadline. Con `unref()`,
  si el proveedor cuelga y nada más sostiene el event loop, Node sale **antes** de que el
  deadline dispare: el mismo cuelgue que venía a evitar. Quitado; documentado en el código.
- **Candado nuevo:** `server/src/ai/providerDeadline.test.js` — inyecta un proveedor que cuelga
  para siempre y exige que `chatDesign`/`parseDesignIntent` devuelvan bajo techo de tiempo y
  que `source === 'regex-fallback'` sea alcanzable.
- **Deuda documentada (no corregida):** el parser offline no entiende `"2000 x 2200"` y cae a
  defaults 2400×2400 **sin emitir `specAdjustment`**. Con la IA caída, el usuario pide 2,00 m
  y recibe 2,40 m sin aviso. Ver `task.md` P2.

Infraestructura agéntica creada: `.cloud/agents/backend_loop_agent.md`,
`.cloud/agents/qa_industrial_agent.md`, `task.md`.

### 2026-07-22 (d) — VIEWER: RENDER FIEL DE ESCRITORIOS ✅ 90/90 · build 0 errores

**La inversión recomendada en (c), ejecutada:** `Viewer3D.jsx` gana una rama `desk`
propia en vez del armado genérico de carcasa (que dibujaba techo/piso/fondo completos
que el motor NO corta en un escritorio).

- **Rama `isDeskViz`**: tampo sobrepuesto ancho completo, laterales H−T, pedestal en su
  lado (`pedestalSide` left/right con las MISMAS fórmulas del motor convertidas a
  coordenadas centradas `x_visor = x_motor − W/2`), PED-DIV/BASE/FONDO, pila de gavetas
  del pedestal (paso dh+16, animación open/close intacta vía `drawerKey`), faldón pegado
  bajo el tampo con el mismo clamp [150–300]. **Escritorio simple**: solo tampo +
  2 laterales + faldón a todo el vano.
- **Caja de gaveta desde `drawerBox` del motor** (SSOT sesión c): profundidad/ancho
  reales de la lista de corte; si el motor declara la caja no fabricable, el visor
  dibuja solo el frente.
- **Guards aditivos** en el armado genérico: carcasa completa, zócalo/patas y gavetas
  genéricas ya no se pintan para `desk` (antes un escritorio se renderizaba como un
  clóset con techo/fondo inexistentes y zócalo que el motor no corta).
- **PARIDAD VERIFICADA NUMÉRICAMENTE** (réplica de fórmulas del visor en Node vs piezas
  reales del motor): desviación máx de posición **0.5mm** (redondeo `Math.round` de
  T/2=12.5 del motor) en pedestal derecha/izquierda/simple; **0.0mm** en el default
  histórico t18. 10 piezas comparadas por variante.
- Suite **90/90** · build **exit 0** (10.98s). Cero cambios de contrato JSON.
- **Nota:** la deuda "visor construye desde cfg y no desde pieces" SIGUE VIVA para
  closets/aéreos (rewrite consciente, no quirúrgico); el desk queda como la primera
  topología con render 1:1 verificado contra el despiece.

### 2026-07-22 (c) — ESCRITORIOS v2: simple + pedestal izquierda/derecha ✅ 90/90 · build 0 errores

**Contexto:** la topología `desk` YA existía (tampo sobrepuesto, laterales H−T, faldón,
pedestal con gavetas). Lo faltante del brief era exactamente dos cosas, ambas aditivas:

- **`hasPedestal`** (default `true` = histórico): `false` → **ESCRITORIO SIMPLE** —
  cubierta + 2 laterales de apoyo + faldón estructural a todo el vano (`W−2T`, centrado).
  0 piezas PED-*. Verificado: 1400×750×600/t25 → faldón 1350mm, kneeSpan 1350, VALIDADO.
- **`pedestalSide: 'left'|'right'`** (default `'right'` = histórico): espejo completo del
  gavetero (PED-DIV, PED-BASE, PED-FUNDO, gavetas, faldón). Verificado pieza a pieza:
  x → W−x exacto (PED-DIV difiere 0.5mm por `Math.round` de 387.5 — artefacto de redondeo,
  física idéntica); los laterales correctamente NO se espejan. VALIDADO.
- **Gavetas sin pedestal → `DRAWERS_REQUIRE_PEDESTAL` (critical)** en specAdjustments:
  n=0 reportado, no silenciado (las correderas no tienen dónde fijarse).
- **SSOT:** `FurnitureMath.desk` nuevo (`apronHeight` [150–300, 35% del lateral] — el motor
  ahora lo CONSUME en vez de la fórmula inline; `kneeSpan`, defaults 750/600).
  `paramContract.js` + `hasPedestal`, `pedestalSide`.
- **Regla estructural verificada:** lateral 725 + tampo 25 = H 750 exacto (la cubierta
  APOYA sobre los laterales) · tope del faldón = base del tampo (y=725) — rigidiza a la
  altura correcta. `drawerBox` payload intacto para el visor (SSOT sesión c).
- **Cero regresión:** con defaults, cada fórmula de posición es la expresión previa
  literal. Suite **90/90** · build **exit 0** (11.78s) · JSON shape idéntico.

### 2026-07-22 (b) — DICCIONARIO PARAMÉTRICO UNIFICADO ✅ 90/90 · build 0 errores

**Reglas industriales integradas en motor + validador (decisiones explícitas del usuario
donde el diccionario chocaba con el producto):**

- **Guard de espesor `THICKNESS_ALLOWED [15,18,25]`** — el {15,18} literal del diccionario
  habría matado la feature Pro (mdf_25) y el tampo del desk; decisión: incluir 25.
  Espesor fuera de catálogo → `INVALID_THICKNESS` (400 limpio vía `generateProject`,
  sin stack al cliente). Verificado: 15/18/25 OK, 12 → rechazado.
- **Fondo ESTRUCTURAL en aéreos (decisión: forzar):** aéreo con Tb<15 → el motor eleva a
  `BACK_AEREO_STRUCTURAL 15` + `backStyle:'screwed'` y lo reporta vía specAdjustment
  `AEREO_BACK_FORCED_STRUCTURAL`. Razón: el fondo atornillado transmite la carga al riel;
  6mm ranurado = riesgo de arrancamiento. **SÍ cambia cutlists de aéreos guardados** (asumido).
- **Validador como 2ª barrera independiente** (payloads forjados/importados que no pasaron
  por el motor): espesor fuera de catálogo → error; aéreo con piezas de zócalo → error
  (invariante verificado sobre `pieces`, no config); aéreo Tb<15 → error. Verificado:
  payload forjado Tb=6 → **RECHAZADO**; vía motor → corregido y VALIDADO.
- **`panelVista` ⊥ `fijacion` (separación ortogonal):** `panelVista` ('ninguno'|'uno'|'ambos',
  panel de 15mm) reduce Nw de las horizontales (base/techo inset/travesaños/repisas/zócalo):
  870→855→840 verificado. `fijacion` ('minifix'|'espiga'|'tornillo_visto') solo toca BOM
  (16 minifix / 24 espigas), Nw idéntico. **Vw = W−2T queda PURO** (`internalWidth` intacto
  = 870 en los tres modos). Default 'ninguno' → byte-idéntico.
- **Despeje de profundidad PRECISO** (`drawerDepthClearance`): `T + (Tb + ranura si grooved)
  + 10` sustituye el `D − Tb − 20` mágico. **El modelo viejo ignoraba el FRENTE**: en D=580
  emitía caja de 550 → 550+6+10+18 = 584 > 580, **4mm de interferencia física real**.
  ⚠ REGRESIÓN DELIBERADA: D=580 ahora corta caja de **500** (antes 550). Es la corrección
  del defecto, no un efecto colateral. Catálogo `SLIDE_LENGTHS` +270 (medida comercial).
  Verificado en 6 fondos: `boxD + despeje ≤ D` siempre.
- **BOM alineado al despiece:** `generateHardwareBOM` calculaba su PROPIA corredera
  (`Math.min(500, paso 50)`) — tercera fuente de verdad. Ahora usa `pickSlideDepth +
  drawerDepthClearance`: cutlist boxD=500 ↔ BOM "corredicas 500mm", mismo número.
- **`paramContract.js`**: + `panelVista`, `fijacion`, `grooveDepth` (la capa NL los filtraba).
- **Verificado:** 90/90 · build exit 0 (11.57s) · JSON shape intacto (claves nuevas aditivas
  en `configuration`; `drawerBox` ya existente sigue alimentando al visor).
- **Nota:** los mensajes del validador aparecieron traducidos PT→ES fuera de esta sesión;
  las aserciones nuevas se escribieron en español para mantener consistencia.
- **DEUDA ABIERTA:** con `numDividers>0` + `panelVista`, los compartimentos extremos
  deberían perder 15mm cada uno (hoy la deducción aplica solo a repisas de vano completo);
  `tornillo_visto` no emite línea de BOM (correcto: va en tornillería general).

### 2026-07-22 — TAMPONADO = ANCHO ACABADO + MOLDURA FRONTAL ✅ 90/90 · build 0 errores

**CAMBIO DE SEMÁNTICA (decisión explícita del usuario):** con `tamponado ≠ 'none'`, el W
pedido pasa a ser el **ancho ACABADO** — incluye los tapatornillos. La carcasa se descuenta:
`carcassWidth = W − (lados × tamponadoThickness)`. Antes los tampones se sumaban POR FUERA:
un "mueble de 900" medía 918–930mm reales y **no entraba en un vano de obra de 900**.
Verificado: extensión física real (laterales+tampones) = **900mm exactos** en ambos modos.

- **Aritmética del manual reconciliada:** el brief mezclaba dos sistemas — "88,2cm para 90"
  (⇒ tampón de **9mm**/lado: 900−18=882) y "1,5cm por lado" (⇒ tampón **15mm**: 900−30=870).
  Resolución: nuevo parámetro **`tamponadoThickness`** (default = T, mismo MDF de la carcasa).
  El manual de 9mm se obtiene con `tamponadoThickness: 9`. El valor aplicado se persiste
  en `configuration` (aditivo, mismo shape JSON para UI/Supabase).
- **Cotas verificadas (log de sesión):**
  · 900 acabado, t15, tampón 9 both → carcasa 882 · base/techo/zócalo **852** · tampón 600×2200×**9**
  · 900 sin tamponado → base **870** = W − 2T estricto (corte a vista limpia, cero cambio)
  · 900 tampón default(15) both → carcasa 870 · base **840**
  · Zócalo frontal SIEMPRE idéntico al ancho de la base (regla 3 — automática: comparte
    `internalWidth` derivado de la carcasa). VALIDADO 0 errores.
- **`frontMolding` (opt-in, default off):** moldura frontal de 20mm que define la profundidad
  acabada → laterales `D−20` (600→**580**) · base/techo `D−40` (→**560**) · repisas con su
  retranqueo histórico adicional (→534). Nuevas fórmulas SSOT en `furnitureMathSpecs.js`
  (`tamponado.carcassWidth/sidesFor`, `frontMolding.lateralDepth/horizontalDepth`).
- **`paramContract.js`**: `tamponadoThickness` y `frontMolding` añadidos al whitelist del
  contrato IA (sin ellos la capa NL los filtraba en silencio).
- **Cero regresión:** default (`tamponado:'none'`, sin moldura) byte-idéntico al histórico
  (lateral 600 prof · base 870×600). Suite **90/90** · `vite build` **exit 0** (26.27s).
  Tests existentes de tamponado ('both'→2 paneles, 'left'→x<0) siguen en verde.
- **DEUDA ABIERTA:** (1) `validateDesign` calcula `internalWidth` desde `cfg.width` (acabado),
  no desde la carcasa — con tamponado sobreestima el vano en 18–30mm en sus checks (conservador
  en span, laxo en gavetas: revisar si se generaliza el uso de tamponado). (2) `Viewer3D` no
  dibuja los paneles de tamponado (nunca lo hizo); con la nueva semántica un módulo tamponado
  se renderiza con la carcasa descontada — fiel al despiece, pero sin los tampones visibles.

### 2026-07-21 — GALERÍA (Verified Templates Catalog · Fase 1) · additive

**Objetivo:** catálogo navegable de plantillas verificadas (`viable_designs`) con
búsqueda + filtro por categoría y pipeline Copiar/Pegar (Ctrl+C / Ctrl+V) paramétrico.

**Backend (delta mínimo — la persistencia ya existía y estaba verificada E2E):**
- Migración `007_viable_designs_category.sql` (additiva, idempotente): columna
  `category TEXT` + índice. **Aplicada y verificada contra la DB live**
  (`information_schema` → `category | text`).
- `POST /api/designs/save-viable`: acepta `category` opcional, normalizada contra
  allow-list `GALLERY_CATEGORIES = [cocina, aereo, bano, closet, escritorio]`
  (fuera de lista → null). El guard anti-forjado (regenerar + revalidar) queda intacto.
- `GET /api/designs/viable`: devuelve `category` (las dims salen de `parametric_json`).
- **Decisión:** `category` NO se deriva de `module_type` (un `standard` puede ser
  closet o baño) — se captura explícita al guardar.

**Frontend (charcoal parity, todo additivo):**
- `client/src/data/galleryCategories.js`: SSOT de categorías (labels + `suggestCategory`),
  compartida por ResultPanel y GalleryCatalog.
- `GalleryCatalog.jsx` (nuevo): overlay charcoal, fetch `listViableDesigns()`, búsqueda
  en vivo + chips (`Todos/Cocina/Aéreos/Baño/Closet/Escritorio`, icono `Filter`), cards
  con Nombre · Categoría · W×H×D. Botón **Copiar** (`navigator.clipboard`) + **Usar**.
- `Header.jsx`: nav **Galería** (`LayoutGrid`), solo en `/app`, prop `onOpenGallery`.
- `ResultPanel.jsx` (SaveViableButton): selector de categoría en el flujo de guardado.
- `App.jsx`: estado `galleryOpen`, render del overlay, `handleUseTemplateParams()` +
  **Ctrl+V global** que lee el portapapeles, valida el JSON y regenera vía
  `generateProject()` (Viewer3D + despiece se reconstruyen). Ctrl+V se ignora dentro de
  inputs/textarea/contentEditable para no secuestrar el paste nativo. Toast de feedback.

**Auditoría aéreos (read-only, sin cambios):** confirmado empíricamente que
`moduleType:'aereo'` omite rodapié (`!isAereo` → BH3=0, 0 piezas `baseboard`) y usa
min-depth 100mm en vez de 300mm. Aéreo de baño 600×600×150 → VALIDADO sin falsos avisos.

**Verificación:** endpoint save-viable+category insert/select OK contra DB live; grafo
esbuild completo (`main.jsx`) 0 errores; `vite build --logLevel error` corrió sin emitir
errores (no finaliza en el sandbox por el cap de 45s → **el build final 0-errores lo corre
Antigravity como gate previo al commit**).

### 2026-07-20 (d) — RODAPIÉ UNIVERSAL (SSOT + recuo estándar BR) ✅ 90/90 · build 0 errores

**Investigación previa (fuentes al pie del changelog):**
- Altura del sóculo BR: **100–150mm**. Toe kick US: 3.5–4" ≈ 89–100mm. → `DEFAULT_HEIGHT 100mm`
  cae en el consenso de ambos mercados (el valor que ya usaba el motor: confirmado correcto).
- Recuo (recúo/inset): estándar BR **10–15 CM = 100–150mm**. Mínimo ergonómico US **3" = 76mm**;
  por debajo de eso el toe kick deja de cumplir su función. El motor usaba **50mm**, es decir
  **por DEBAJO del piso ergonómico** → corregido a **100mm**.
- ⚠ El brief original pedía "inset 10mm a 15mm": error de unidad de **10×** (son cm, no mm).
  Un recuo de 10–15mm no es un toe kick, es una junta de sombra. Descartado.

**SEMÁNTICA DE ALTURA (decisión explícita del usuario):** `H` es la altura **TOTAL** e **INCLUYE**
el rodapié → `structuralHeight = H − BH`. Pedir 870mm devuelve un mueble de 870mm y el rodapié
consume interior. Se descartó "H crece con el rodapié" porque rompía la altura de TODOS los
diseños guardados y descuadraba la encimera de cocina (870+30=900). **Cero regresión.**
> Nota: el brief pedía "H incluye el rodapié SIN alterar el interior neto" — matemáticamente
> incompatible. No se puede fijar H, añadir rodapié y conservar interior salvo que H crezca.

- **SSOT nuevo `BASEBOARD` en `constants.js`**: `DEFAULT_HEIGHT 100`, `INSET 100`,
  `INSET_ERGONOMIC_MIN 76`, `MIN_HEIGHT 60`, `MAX_HEIGHT 150`, `MIN_INNER_GAP 50`.
  Eliminados `|| 100` hardcodeados en **4 puntos** de `closetEngine.js` y **2** de `validator.js`
  (misma duplicación que causó los P0 de chapa y de profundidad de caja).
- **`BASEBOARD_SETBACK_MIN/MAX` eliminados**: declarados y NUNCA consumidos (patrón `SLIDE_GAP`).
- **Guard de recuo (`clampBaseboardInset`)** — bug real evitado: con recuo fijo de 100mm y fondo
  bajo, el zócalo FRONTAL caía **detrás** del TRASERO (geometría invertida, no ensamblable).
  Ej. D=200/T=18: frontal z=91 vs trasero z=109. El clamp reduce el recuo lo justo para preservar
  `MIN_INNER_GAP`, de forma determinista. Verificado: D=300→gap 64mm · D=250→32mm · D=200→32mm,
  **0 inversiones**. La pieza documenta el recuo aplicado en `notes`.
- **Excepciones verificadas (0 piezas de rodapié):** `aereo` (incluso con `baseboard:true`
  forzado — un colgado no toca el piso), `baseboard:false`, `baseType:'none'`, `baseType:'legs'`.
  En los tres primeros `structuralHeight = H` (la altura no se altera).
- **Cutlist/CNC:** IDs renombrados `RDPE-F/B` → **`RODAPIE-FRONTAL` / `RODAPIE-TRASERO`**.
  Seguro: todo el downstream (Viewer3D, CutlistGenerator, planRenderer, ExportPanel, tests)
  discrimina por `type: 'baseboard'`, **nunca por el ID**. Exportan con cotas netas
  (`564×100×18` nominal → `cutHeight 99` tras el tapacanto de 1mm). ✓
- **Viewer3D: 3 divergencias con el motor corregidas (aditivo).**
  1. **Recuo**: usaba `5` (=50mm) fijo; ahora replica la fórmula del motor con el mismo clamp.
  2. **Faltaba el guard de aéreo**: un colgado con `baseboard` undefined pintaba un zócalo que
     el motor no corta.
  3. **`baseType 'legs'/'none'`**: el motor solo emite zócalo en `'recessed'`; el visor lo
     pintaba siempre. Ahora en `'legs'` dibuja solo las patas.
  4. Añadido el **zócalo trasero**, que el motor sí corta y el visor omitía.
- **Verificado:** suite **90/90 pass** · `vite build` **exit 0** (`✓ built in 16.05s`).

Fuentes: [Guia da Marcenaria — rodapés, alturas padrão](https://www.guiadamarcenaria.com.br/post/rodap%C3%A9s-na-marcenaria-tipos-alturas-padr%C3%A3o-materiais-e-t%C3%A9cnicas-de-instala%C3%A7%C3%A3o) ·
[Bruna Carvalho Arquitetura — o que é sóculo (recuo 10–15cm)](https://brunacarvalhoarquitetura.com.br/o-que-e-soculo/) ·
[Kitchen Cabinet Kings — standard toe kick height/depth](https://kitchencabinetkings.com/blog/standard-toe-kick-height/) ·
[ESS2GO — ideal toe kick dimensions (3" mínimo ergonómico)](https://www.ess2go.com/post/ideal-toe-kick-dimensions-and-height-for-cabinets)

### 2026-07-20 (c) — SSOT: eliminadas las fuentes de verdad duplicadas ✅ 90/90 · build 0 errores
- **`furnitureMathSpecs.js` ya CONSUME `constants.js`.** Hardcodeaba `internalSpan − 26`:
  era una segunda constitución numérica, igual que el P0 de chapa (jul-19) y el P0 de
  profundidad (jul-20b). Ahora `netWidth()` lee `HARDWARE.DRAWER_SLIDE_TOTAL`.
  **Propagación verificada en runtime:** mutando la constante a 40, `netWidth(564)` pasa
  538→524 y el motor emite `GAV-FUNDO` 838→824. Antes, mutarla no cambiaba nada.
  Solo consumidor: `closetEngine.js` + `smoke.test.js` (server-only, sin riesgo de bundle).
- **⚠ Trampa evitada:** se intentó usar `HARDWARE.BACK_GROOVE_DEPTH` (=6) como default de
  `groovedWidth`, pero el default histórico del motor es **8** y son magnitudes distintas
  (profundidad de ranura en el canto ≠ sobreancho del fondo). Revertido y documentado
  in-line. Habría alterado el ancho del fondo ranurado en silencio.
- **`Viewer3D.jsx` ya LEE la caja de gaveta del payload del motor.** El motor publica
  `drawerBox: { depth, height, outerWidth, wallThickness }` **derivado de las piezas reales
  de la lista de corte** (fuente autoritativa). El visor lo consume con fallback triple:
  payload del motor → módulo sin caja (`null`) → fórmula histórica (payloads antiguos).
  **Divergencia medida y eliminada: 18mm exactos** (visor 532 vs motor 550 en D=580);
  desk 600: −2mm. Ancho: 838 en ambos, sin cambio visual.
- **El visor deja de mentir:** si el motor declara la caja NO fabricable (`drawerBox: null`,
  p.ej. aéreo D=150), el visor ahora dibuja **solo el frente** en vez de inventar una caja
  de 102mm que "encajaba". Era exactamente el mecanismo que ocultó el P0 de jul-20b.
- **`SLIDE_GAP` eliminada** (`closetEngine.js`): declarada y nunca usada; sugería un segundo
  punto de aplicación de la holgura que no existía. 0 referencias restantes.
- **Verificado:** suite **90/90 pass** · `vite build` **exit 0** (`✓ built in 21.43s`).
- **DEUDA que SIGUE abierta (consciente):** `Viewer3D` hardcodea **2 columnas**
  (`Math.ceil(nD/2)`) mientras el motor soporta `drawerColumns` 2..4. Por eso el ancho de
  caja se mantiene local en la rama horizontal (el `outerWidth` del motor no corresponde a
  esa retícula). La profundidad —la divergencia documentada— sí se corrigió en ambas ramas.
  El visor sigue construyendo desde `cfg` y no desde `pieces`: unificarlo es un rewrite
  (perdería animación de gavetas, encimeras unificadas, drag & snap), NO un cambio quirúrgico.

### 2026-07-20 (b) — AUDITORÍA ESTRUCTURAL: P0 profundidad de caja de gaveta ✅ 90/90 tests
- **BUG P0 (geometría imposible, se daba por VALIDADO):** `closetEngine.js` calculaba
  `boxD = Math.max(250, floor((D−BT−20)/50)*50)`. El **piso de 250mm ignoraba el espacio
  disponible**: con `D < 276mm` la caja salía más profunda que el propio mueble.
  Verificado empíricamente: aéreo de baño `D=150` → `GAV-LAT` de **250mm** (100mm fuera de
  la carcasa) y `validateDesign` devolvía **VALIDADO, 0 errores**. Presente en las DOS rutas
  (pila normal L503 y pedestal `desk` L215).
- **Por qué nadie lo vio:** `Viewer3D.jsx` deriva la caja de `iD − 4` (= `D−BT−42`), NO del
  motor. El 3D dibujaba una caja de 102mm que encajaba perfecta mientras la lista de corte
  pedía 250mm. **El visor enmascaraba el defecto.**
- **Fix (`pickSlideDepth`)**: se elige la corredera comercial MÁS LARGA que quepa
  (`HARDWARE.SLIDE_LENGTHS = [250…600]`); si ninguna cabe (<250mm de fondo útil) **no existe
  herraje telescópico** → no se emite caja (cae en el guard existente `caja imposible`).
  Nuevas constantes: `SLIDE_LENGTHS`, `SLIDE_LENGTH_MIN: 250`, `DRAWER_BOX_REAR_GAP: 20`.
- **Cero regresión verificada:** para todo `D ≥ 276mm` el resultado es IDÉNTICO al histórico
  (580→550, 600→550, 400→350, 300→250, desk 600→550). Solo cambian los casos que antes
  producían geometría imposible. Suite **90/90 pass**.
- **Validator: faltaba por completo la regla de PROFUNDIDAD.** Añadida en la sección 4
  (`usableDepth < SLIDE_LENGTH_MIN` → error). Los 3 casos imposibles ahora dan **RECHAZADO**.
- **VERIFICADO OK (sin cambios):** holgura 26mm (13/lado) vía `FurnitureMath.drawerBox.netWidth`;
  frente de gaveta 2mm/lado (`DRAWER_FRONT_GAP`); tapacanto 1mm por canto rebajado
  (`generateCutList(pieces, defaultEdgeThickness=1.0)`, redondeo 0.1mm, piso 2mm);
  guardas de colisión **0 colisiones** en 7 configs (incl. 12 gavetas + 4 estantes, 2 divisores,
  3 columnas); **determinismo 200 corridas, 0 divergencias**; pila excesiva → RECHAZADO correcto.
- **DEUDA ABIERTA (no tocada, riesgo medio):**
  1. `furnitureMathSpecs.js` **hardcodea `internalSpan − 26`** en vez de leer
     `HARDWARE.DRAWER_SLIDE_TOTAL` → viola SSOT; cambiar la constante NO propaga al motor.
  2. `Viewer3D.jsx` calcula la caja por su cuenta (`iD − 4`) → **divergencia visor/despiece de
     ~18mm** en muebles válidos. El 3D no es fiel a la pieza fabricada.
  3. `Viewer3D.jsx` hardcodea **2 columnas** (`Math.ceil(nD/2)`); el motor soporta
     `drawerColumns` 2..4 → un mueble de 3 columnas se renderiza como 2.
  4. `SLIDE_GAP` (L451 `closetEngine.js`) declarada y **nunca usada** — la holgura real entra
     por `netWidth`. Variable muerta, engañosa.

### 2026-07-20 — PURGA DE PRESETS (production readiness) ✅ BUILD 0 ERRORES
- **Eliminado `FURNITURE_PRESETS` + `<FurniturePresets/>`** (`client/src/components/InputPanel.jsx`):
  los 10 botones quick-start (cocina, isla, ropero, baño, escritorio, flotante + 4 aéreos) y su
  `onApply → onGenerate({replace:true})`. El flujo del usuario queda: **NL Chat + controles
  paramétricos manuales**. ~205 líneas fuera; import `Layout` (lucide) retirado.
- **CONSERVADO deliberadamente:** `DrawerPresets` (★ PROTECTED — helper local de cajones, solo
  setea `numDrawers`/`drawerLayout` en el form, NO dispara generación); `materials.js` (data core);
  `OnboardingWizard` (primer arranque, funcional — usa plantillas internas propias; si también debe
  salir, es un corte aparte). La lógica `payload.replace` en `handleGenerate` se mantiene (aditiva,
  inofensiva, reutilizable).
- **Código muerto retirado en `App.jsx`:** import de `OnboardingFlow` (nunca renderizado; su lógica
  fue absorbida por `OnboardingWizard` el 2026-06-23) y estado huérfano `showOnboarding` (declarado,
  jamás leído).
- **Copy i18n:** `server_offline_desc` (pt/es/en) + fallback en `App.jsx` ya no mencionan presets.
  Las claves `preset_*`/`furniture_presets`/`FURNITURE_PRESETS` en `i18n.js` quedan como strings
  muertos (inertes, sin referencias en código; limpiables en un pass de i18n).
- **Verificado:** `vite build` → `✓ built in 17.18s`, **exit 0, 0 errores** (copia materializada en
  /tmp por la lentitud/truncado del mount OneDrive — ver nota de entorno 2026-07-19). Único aviso:
  chunks >500kB, preexistente.
- **Colateral de entorno:** quedaron 2 paquetes de plataforma Linux en `client/node_modules`
  (`@rollup/rollup-linux-x64-gnu`, `@esbuild/linux-x64`, --no-save, ~3MB, inertes en Windows;
  `npm ci` los elimina). Hay ~13 `vite.config.js.timestamp-*.mjs` basura en `client/` (artefactos
  de vite crasheado) — borrables sin riesgo.

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

> Reescrito 2026-08-02 contra el árbol real de HEAD `ed3a1b9` (rama `design/presets-2026`).
> Las secciones 2–4 habían quedado congeladas en v4.5 y **contradecían el header**: afirmaban
> que la autenticación era simulada y que el usuario podía saltarse los límites de plan
> editando estado, cosa que el BUCLE 002 refutó ejecutando (`401` real con `NODE_ENV=production`
> y candado `authContract.test.js`). Un snapshot cuyo propósito es la reanudación en contexto
> limpio y que se contradice a sí mismo hace que cada sesión nueva reimplemente trabajo hecho.

### Root: `C:\Users\Azomarg\Documents\Claude_projects\Orbin\`

### Server (`server/src/`) — 29 módulos de producción · 22 archivos de test

| File | Function |
|---|---|
| `index.js` | Entry point Express, init Socket.IO, CORS, montaje de rutas. Puerto **3003**, bind `0.0.0.0` |
| **Engine** | |
| `engine/closetEngine.js` | **CORE** — motor paramétrico. Cut list completa + validación geométrica. Reglas DNA V1: laterales piso-a-techo, tapas internas `W-2T`, holgura 13mm por lado para correderas, veta vertical en rodapiés. Soporta MDF 15/18/25mm |
| `engine/validator.js` | Validación estructural → `VALIDADO` / `RECHAZADO` + warnings |
| `engine/nlParser.js` | Parser NL regex ES/PT/EN. Normaliza unidades (cm→mm, pulgadas→mm). Piso de la cascada de IA |
| `engine/constants.js` | Estándares MDF/MDP BR: chapa, kerf, márgenes |
| `engine/clientBundle.helper.js` | Carga código del cliente desde tests del server. **Obligatorio**: nunca `try/catch + return` (dos candados reportaron *pass* sin correr) |
| `engine/_videoPrompts.probe.js` | Sonda reproducible de los 14 prompts del guion de video |
| **AI** | |
| `ai/aiOrchestrator.js` | Router multi-proveedor. `PROVIDER_CHAIN` real: **`gemini → vertex → ollama → parser regex local`**. `withDeadline()` + `ProviderTimeoutError` por proveedor (`AI_PROVIDER_TIMEOUT_MS`, default 12000) |
| `ai/geminiClient.js` | `AbortSignal.timeout()` en ambos `fetch` (`GEMINI_TIMEOUT_MS`, default 10000) + `describeHttpError()` |
| `ai/vertexClient.js` | Vertex AI. ⚠ hace `require('dotenv').config()` al cargarse — ver trampa de hermeticidad abajo |
| `ai/ollamaClient.js` | Ollama local (`deepseek-r1:7b`). Único cliente con timeout propio desde siempre |
| `ai/claudeClient.js` | Cliente Claude — existe, **fuera de `PROVIDER_CHAIN`** |
| `ai/openrouterClient.js` | ⚠ **STUB de 12 líneas** que lanza `'not implemented yet'`. **Fuera de `PROVIDER_CHAIN`**. No hay cliente DeepSeek |
| `ai/paramContract.js` | Contrato de params entre IA y motor |
| `ai/furnitureMathSpecs.js` · `ai/systemPrompts.js` | Specs matemáticas y prompts de carpintería por proveedor |
| **Middleware** | |
| `middleware/auth.js` | `requireAuth` / `optionalAuth`. **El plan sale de `app_metadata`**, nunca de `user_metadata`. Sin plan → `free` (fail-closed) |
| `middleware/planLimits.js` | `checkPlanLimit(feature, { when })`. Cuota `free` 5 IA/día (UTC). Store inyectable (`setUsageStore`). **Fail-OPEN deliberado** si el contador se cae |
| **Routes** | |
| `routes/design.js` | `POST /generate`, `POST /parse`, `GET /defaults`. Gate de plan sólo cuando viene `naturalLanguage` |
| `routes/chat.js` | `POST /design` (Fase 1 HITL), `POST /parse`. `router.use(requireAuth)` |
| `routes/projects.js` | CRUD. Supabase primario + fallback en memoria. Único lugar del backend que consultaba `req.user.plan` antes del bucle 003 |
| `routes/billing.js` | Stripe + Mercado Pago. `POST /webhook` sin `requireAuth` **por diseño**: firma HMAC (Stripe) y re-consulta del pago contra la API (MP) |
| `routes/hitlPreview.js` · `routes/ttlStore.js` | Preview stateless del flujo HITL de 2 fases + store con TTL |
| `routes/vision.js` | Image-to-parametric (Gemini Vision) — el endpoint más caro |
| `routes/stressTest.js` | Carga. `require` condicional: **en producción no se monta** |

**Trampa registrada (`dotenv`):** `delete process.env.X` **no alcanza** para aislar un test de
la red. `dotenv` sólo respeta claves que ya existen; si la borrás, la repuebla al cargarse
`vertexClient`. Hay que **asignar `''`**: existe (dotenv no la pisa) y es falsy.

### Client (`client/src/`) — 28 componentes · 17 módulos de engine

| File | Function |
|---|---|
| `App.jsx` | Orquestador. Estado global, undo/redo, ciclo de Socket.IO, `planAlert` → `UpgradePrompt`. **`sanitizeModulesPositions()`**: calcula `X_nuevo = X_anterior + W_anterior` para módulos sin `position` válida (fix de colisión 3D, bucle 004) |
| `main.jsx` · `i18n.js` · `index.css` | Entry + React Router · i18next ES/PT/EN · design system Tailwind |
| `api/client.js` | Wrapper Axios → `http://localhost:3003/api` |
| `lib/supabase.js` · `lib/analytics.js` · `lib/stackingMath.js` | Cliente Supabase · analytics · matemática de apilado |
| `context/UserContext.jsx` | **Auth REAL de Supabase**: `signInWithPassword`, `signUp`, `signInWithOAuth`, `getSession`, `onAuthStateChange`. `localStorage` es **sólo hint de pintado inicial**, no fuente de verdad; el bypass por `localStorage` está acotado a `import.meta.env.DEV` |
| `context/PreferencesContext.jsx` | Idioma, unidades, preferencias de UI |
| **Contrato i18n** (ver CLAUDE.md) | |
| `engine/pieceNames.js` | `localizePieceName(name, lang)` — el motor **nunca** traduce: los nombres son identificadores (nesting, BOM, hash, tests golden) |
| `engine/adjustmentMessages.js` | `localizeAdjustment(adj, lang)`. **Nunca borrar `message`**: 17 archivos lo leen y es el fallback |
| `engine/apiErrors.js` | `localizeApiError(err, lang)`. Incluye `PLAN_LIMIT_REACHED` ES/PT/EN |
| **Engine cliente** | |
| `engine/planGenerator.js` · `engine/planRenderer.js` | Plano ejecutivo (página completa por módulo) + conjunto SVG con espacios respetados |
| `engine/elevationModel.js` · `engine/domainConstants.js` | Modelo de alzado · constantes de dominio (SSOT) |
| `engine/exportAdapters.js` | **343 líneas, generación real** (no stub): OBJ, COLLADA 1.4.1, glTF 2.0, DXF R12 con capas, G-code CNC. `nestPieces()` incluido |
| `engine/offlineParser.js` | Espejo cliente del parser NL, con candado de paridad (`parserMirror.test.js`) |
| `engine/CutlistGenerator.js` · `PricingEngine.js` · `designAnalyzer.js` · `materialLibrary.js` · `projectMemory.js` · `collaboration.js` | Cut list · costos · scoring de salud · catálogo · historial/localStorage · Socket.IO |
| **Componentes destacados** | |
| `components/Viewer3D.jsx` | Three.js. Hidrata `modulePositionsRef` desde `design.position` (`* SCALE + W/2`). ResizeObserver + teardown de memoria verificados |
| `components/UpgradePrompt.jsx` | **Muro de upgrade real, ya cableado** a `planAlert` en `App.jsx:1064`. ⚠ **No se dispara con el 403 `PLAN_LIMIT_REACHED`** — ver P8 |
| `components/GalleryCatalog.jsx` | Galería de Verified Templates (Fase 1) |
| `components/OnboardingWizard.jsx` · `OnboardingFlow.jsx` | Wizard conservado en la purga de presets · flujo de alta |
| `components/LegalPages.jsx` · `SeoMeta.jsx` | Legales · meta tags SEO |
| `components/ResultPanel.jsx` | Validación + resumen. **Único consumidor de `localizeApiError`** |
| `components/ExportPanel.jsx` · `CutListTable.jsx` · `InputPanel.jsx` · `ChatPanel.jsx` · `ProjectsPanel.jsx` | Export gated por plan · cut list con selección sincronizada y Ctrl+Z · params (incl. `hasPedestal`/`pedestalSide`) · chat IA · proyectos |
| `pages/blog/` | Contenido para SEO |

⚠️ **`FurniturePresets` fue eliminado del UI** en la purga de producción (2026-07-20).
`DrawerPresets` y `OnboardingWizard` se conservaron.

### Infra

| File | Notes |
|---|---|
| `server/.env` | 24 claves. `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_KEY` · `GEMINI_API_KEY` ✅ (sí está presente) · `GEMINI_MODEL` · `OLLAMA_MODEL=deepseek-r1:7b` · `STRIPE_*` · `GCP_*`. ⚠ `OPEN_ROUTER_API_KEY` y `DEEPSEEK_API_KEY` existen **pero ningún cliente las usa** |
| `server/supabase/migrations/` | **8 migraciones**: 001 projects · 002 material_prices · 003 promo_redemptions · 004 projects_owner_and_lockdown · 005 viable_designs · 006 viable_designs_reconcile · 007 viable_designs_category · **008 create_ai_usage ⚠ SIN CORRER** |
| `start.bat` / `ARRANCAR.bat` | Lanzadores. Server 3003 + client 5173 |
| `.cloud/agents/` | `orbin_engine.md` · `backend_loop_agent.md` · `qa_industrial_agent.md` |

---

## 3. RECENT CHANGES & LOGS

### Git History (últimos commits, `design/presets-2026`)

```
ed3a1b9  fix(3d-layout): resolve module overlap by computing sequential X-offsets  [HEAD]
8b11574  feat(i18n): nombres de pieza traducidos + escritorio en el parser + candados de espejo
823bdd8  feat(planos): conjunto reacotado, aereo colgado y escala real en papel
01b4fe8  fix(i18n): finish Spanish validator copy (D6 remainder)
563ad2f  fix(qa): Spanish validator copy, auth dev bypass & full E2E QA stability [DoD D1-D9]
```

Historial completo de bucles autónomos con evidencia: [`task.md`](task.md).
Changelog de backend detallado: sección **CHANGELOG DE BACKEND** arriba en este mismo archivo.

### Verificación de la suite — corrida propia 2026-08-02 (sesión de auditoría)

Ejecutada **por directorio** porque el sandbox tiene techo de 45 s por invocación y los
procesos en background mueren entre llamadas (`--die-with-parent`). Números reales:

| Directorio | Suites | Tests | Fallos |
|---|---|---|---|
| `src/engine/*.test.js` | 33 | 185 | 0 |
| `src/ai/*.test.js` | 7 | 31 | 0 |
| `src/routes/*.test.js` | 12 | 49 | 0 |
| **Total** | **52** | **265** | **0** |

Coincide exactamente con lo reportado por el bucle 004. ✅

⚠️ **El build de Vite NO fue re-verificado en esta sesión.** Dos intentos fallaron por
límites del sandbox, no del código: `EMFILE: too many open files` sobre el FS montado
(`ulimit -n` = 1024) y, tras subir el límite, timeout del techo de 45 s. Verificación
parcial que **sí** se logró: `esbuild --bundle` sobre `src/main.jsx` resolvió el grafo
completo de módulos **sin errores** (5,5 MB), lo que valida sintaxis JSX y resolución de
imports de todo el cliente — **no** valida la compilación de Tailwind ni los plugins de Vite.
`dist/` quedó intacto (timestamp 20:26, del build verde de Antigravity): ninguno de los
intentos fallidos llegó a la fase de escritura.
**Para cerrarlo hace falta `npm run build` en la máquina local.**

### Supabase

- CRUD de `projects` operativo (verificado 2026-05-17: SELECT · INSERT · GET · DELETE).
- ⚠️ **`008_create_ai_usage.sql` no fue ejecutada.** Sin la tabla y el RPC
  `increment_ai_usage`, `planLimits.js` entra en **fail-open**: la cuota no rige, nada
  falla y nada avisa. Es el pendiente que vuelve real todo el bucle 003. → **P7**

---

## 4. ACTIVE BACKLOG & IMMEDIATE NEXT STEPS

> Fuente de verdad de los pendientes: tabla **Pendientes abiertos** de [`task.md`](task.md).
> Esta sección los ordena por impacto comercial, no por orden de descubrimiento.

### 🔴 Bloqueantes reales

| # | Pendiente | Por qué bloquea |
|---|---|---|
| **P7** | **Correr `008_create_ai_usage.sql` en Supabase** + confirmar `SUPABASE_SERVICE_KEY` en el entorno donde corra el server | Sin esto la cuota de IA **no existe**. Por diseño (fail-open) no rompe nada, así que la ausencia es invisible: cada usuario `free` tiene IA ilimitada a costo de tokens de Gemini. Los 18 tests del bucle 003 protegen un candado que no está instalado en la puerta |
| **P6** | **Borrar `.git/index.lock`** (`Remove-Item -Force .git/index.lock` en PowerShell) | Reapareció con timestamp posterior a `ed3a1b9`. `git status` falla; no hay commit posible ni forma de separar P3 |
| **P3** | Revisar y separar los cambios previos sin commitear del árbol | Depende de P6. Un commit ahora mezclaría dos trabajos |

### 🟡 Producto / conversión

| # | Pendiente | Estado real |
|---|---|---|
| **P8** | Disparar el muro de upgrade con el 403 `PLAN_LIMIT_REACHED` | **Más chico de lo que parece**: `UpgradePrompt.jsx` ya existe y ya está cableado a `planAlert` en `App.jsx:1064`. Falta que el catch de la llamada a la API lea `code:'PLAN_LIMIT_REACHED'` y setee `planAlert` con `used`/`limit`/`resetAt` (ya vienen en la respuesta). Hoy `ResultPanel` sólo pinta el texto traducido |
| **P1** | Decidir redundancia real de IA | `openrouterClient.js` es un stub fuera de la cadena; no hay cliente DeepSeek; las claves `OPEN_ROUTER_API_KEY`/`DEEPSEEK_API_KEY` están en `.env` sin consumidor. **Los 3 proveedores activos son de Google**: un incidente los tumba a los tres y el sistema cae al parser regex. El deadline garantiza que degrade *rápido*, no que degrade *bien*. Decisión de CEO |
| **P2** | Parser offline: emitir `specAdjustment` de baja confianza | `"placard 2000 x 2200"` → defaults 2400×2400 **sin ningún aviso**. Sólo se dispara con la IA caída, o sea exactamente cuando nadie está mirando |
| **P4** | Verificar arranque real en `:3003` + health check contra Supabase | Precondición de deploy y de la grabación promocional |

### 🟠 Defecto de motor conocido — visible en demo

`GUION_VIDEO_PROMOCIONAL.md` documenta que un closet de 2,40 m con cajones produce frentes
de **2360 × 176 mm** (ratio 13:1). Ninguna corredera telescópica comercial pasa de ~1200 mm.
Agregar divisores **no** lo corrige: el motor no acota las gavetas a los vanos.
La mitigación vigente es una **regla de guion** ("cajones sólo en muebles ≤ 1,0 m"), no un fix.
Un marceneiro lo detecta en dos segundos. → decidir si se corrige antes o después del lanzamiento.

### 🟢 Cerrados (no reabrir)

- ~~**Auth real no implementada**~~ — **Falso desde el bucle 002.** Supabase Auth está
  operativa en `UserContext.jsx`; el plan sale de `app_metadata` verificado en el JWT;
  `requireAuth` cubre toda ruta mutante (401 verificado por HTTP con `NODE_ENV=production`);
  `dev-token` neutralizado en producción. Protegido por `authContract.test.js` (+13),
  verificado **por mutación**, no por lectura.
- ~~**Export adapters posiblemente stubs**~~ — `exportAdapters.js` genera OBJ, COLLADA,
  glTF, DXF y G-code reales (343 líneas).
- ~~**`GEMINI_API_KEY` no visible en `.env`**~~ — está presente en `server/.env`.
- ~~**P5 · gate de plan en endpoints de IA**~~ — cerrado en el bucle 003.
- ~~**Colisión de módulos en el visor 3D**~~ — cerrado en el bucle 004.

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
