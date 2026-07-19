# ORBIN — PLAN: UI DE PARÁMETROS 2026 + COBERTURA VISUAL DE PIEZAS NUEVAS
**Objetivo:** eliminar el riesgo latente dejado por `design/presets-2026` — los params
nuevos del engine (`handleType`†, `hasLed`, `hasHangingRod`, `doorFinish`,
`countertopMaterial`, `pedestalWidth`, `moduleType:'desk'`) viajan desde los presets
pero el usuario no puede editarlos, y las piezas nuevas (`bancada`, faldón, desk)
no están mapeadas explícitamente en visor/planos/tabla.
**Regla madre:** ADITIVO, NO DESTRUCTIVO. Jamás eliminar controles, keys i18n,
tipos de pieza ni ramas existentes. Todo control nuevo es opcional y con default
= comportamiento actual.
† `handleType` ya tiene SELECT en InputPanel (línea ~834) pero solo visible con
`hasDoors:true` — un desk (solo gavetas) no puede configurarlo. Ver F1.3.

**Estado verificado 2026-07-19 (base de este plan):**
- Engine: 94/94 tests · golden master 10/10 · correspondencia cutList↔diseño 10/10
  (cantidades expandidas, holgura corredera 26mm exacta, 0 huérfanos, 0 oversized).
- Viewer3D renderiza piezas genéricamente por geometría (x,y,z,w,h,t); `type` solo
  modula opacidad → las piezas nuevas DEBERÍAN renderizar, pero NOT VERIFIED en browser.

---

## F1 — INPUTPANEL: CONTROLES NUEVOS (aditivo puro)

1.1 `moduleType` SELECT (~línea 576): AÑADIR opción `{ value: 'desk', label: t('desk') }`.
    No tocar las 3 opciones existentes.
1.2 Sección condicional `isDesk` (nueva, patrón idéntico a `isAereo`):
    - FIELD `pedestalWidth` (min 300, max width−600, default 400).
    - Ocultar controles sin sentido en desk: shelves/dividers/doors se OCULTAN con
      renderizado condicional — NO se eliminan del estado ni del DEFAULTS.
1.3 Mover el SELECT `handleType` fuera del bloque `hasDoors`: mostrarlo si
    `hasDoors || numDrawers > 0`. El control existente no se toca, solo su guard.
    Añadir opción `{ value: 'bar', label: t('bar_handle') }` (el engine ya la soporta).
1.4 TOGGLES nuevos en fieldset "Extras 2026" (fieldset nuevo, al final):
    - `hasLed` (todos los tipos) · `hasHangingRod` (solo `standard`) ·
      `doorFinish === 'mirror'` como TOGGLE "Puerta con espejo" (solo si hasDoors).
    - SELECT `countertopMaterial` (solo `base` + hasCountertop): externo (default) / MDF 25mm.
1.5 DEFAULTS del formulario (client): añadir las keys nuevas con los MISMOS defaults
    neutros del engine. Nunca sobrescribir valores ya guardados de un proyecto.

**Aceptación F1:** click-through en navegador: cada preset carga sus params en el
formulario, cada control nuevo dispara regeneración, y un proyecto guardado ANTES
del cambio abre sin diferencias (golden de params).

## F2 — i18n (append-only, 3 idiomas)
Keys nuevas: `desk`, `bar_handle`, `extras_2026`, `has_led`, `has_hanging_rod`,
`mirror_door`, `countertop_material`, `countertop_external`, `countertop_mdf`,
`pedestal_width`. Vocabulario de oficio PT-BR primero (cabideiro, bancada, espelho,
pedestal/gaveteiro). Regla de PLAN_LAUNCH F1: append al final de cada bloque, jamás
reordenar. Sweep `MISSING: 0` (con el caveat conocido de keys multi-línea).

## F3 — VIEWER3D: COBERTURA EXPLÍCITA DE PIEZAS NUEVAS
3.1 Verificar (no asumir) el render de: `bancada` (desk + countertopMaterial:'mdf'),
    faldón trasero, pedestal, espejo. Screenshot por preset.
3.2 Aditivo si hace falta: en el mapa de materiales/opacidad, casos nuevos
    (`bancada` → material tampo; puerta con `doorFinish:'mirror'` → material reflectivo
    simple). Solo AÑADIR casos al switch/mapa; el default genérico queda como fallback.
3.3 LED: representación visual mínima (strip emisiva bajo la pieza superior) SOLO si
    `hasLed` — detrás de flag, cero costo cuando está apagado.

## F4 — PLANOS 2D / PDF / EXPORT
4.1 `planGenerator.js`: verificar que `bancada` y `tie_strip` del desk aparecen en
    vistas; añadir hatch/rotulado si faltan (append a los mapas de tipo existentes).
4.2 `CutListTable.jsx`: añadir `bancada` a TYPE_COLOR y typeLabel (fallback actual
    ya funciona — esto es cosmético, no bloqueante).
4.3 `exportAdapters.js`: confirmar que los tipos nuevos pasan a CSV/DXF sin filtros
    por whitelist. Si hay whitelist, AÑADIR los tipos, no reescribirla.
4.4 BOM en PDF: los ítems nuevos (riel, cabideiro, espejo, gola, LED, bancada externa)
    ya viajan en `hardware[]` — verificar que la tabla del PDF los lista completos.

## F5 — VERIFICACIÓN INTEGRAL (evidence contract)
1. `cd server && npm test` — 94/94, sin regresión.
2. Golden master: geometría 10/10 idéntica con params históricos.
3. Script de correspondencia cutList↔diseño: 10/10 (el de la auditoría 2026-07-19).
4. Browser click-through PT/ES/EN: aplicar cada preset → editar cada control nuevo →
   regenerar → visor 3D correcto → cut list → export. Cero warnings `[i18n] missing key`.
5. structural_validator sobre los 10: VALIDADO, cero COLISION.
6. Un proyecto guardado pre-cambio abre y regenera idéntico (compatibilidad).

## FUERA DE ALCANCE
- Tocar geometría del engine (ya entregada y testeada).
- Rediseñar el formulario existente o migrar su estado.
- Ripado paramétrico y palhinha (tendencias 2026 sin soporte de motor — backlog).
- Sensor de apertura LED como lógica (solo ítem de BOM).

## RIESGOS
- [Probable] Viewer3D usa whitelist implícita de materiales por `type` en algún branch
  no auditado → F3.1 lo detecta antes de tocar código.
- [Probable] Proyectos guardados con `moduleType` desconocido en versiones viejas del
  cliente: el server responde igual; el cliente viejo renderiza genérico. Sin migración.
- [Seguro] `handleType` fuera de `hasDoors` cambia UI visible — es el único cambio de
  guard sobre un control existente; revisar con ux_ui_critic antes de release.
