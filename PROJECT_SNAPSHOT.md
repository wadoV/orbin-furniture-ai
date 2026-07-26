# PROJECT_SNAPSHOT.md — Orbin AI v4.5 (COMMERCIAL_READY)
> Generated: 2026-05-31 | For clean-context resumption
> ⚠️ Este snapshot está DESACTUALIZADO respecto al código real (HEAD ~jul-2026 ya tiene
>   Stripe+Mercado Pago, Supabase Auth real, exports DXF/DAE/OBJ/GLTF, Plano PDF, PBR).
>   Auditar sobre el código, no sobre este archivo.

---

## CHANGELOG DE AUDITORÍA

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
