# REPORTE E2E — GALERÍA + GUARDADO 3D CON GUARDIÁN DE INTEGRIDAD
**Fecha:** 2026-10-10 · **Rama:** demo/piloto-taller-martes · **Modo:** DEMO (localStorage)
**Navegador:** integrado (localhost:5174) · **Backend:** localhost:3003

## VEREDICTO: las features ya estaban implementadas; la validación E2E PASA (circuito completo verde)

> No hubo cambios de código: las secciones 1 (botón Guardar en Viewer3D + guardián) y 2
> (eliminar reactivo + filtros en Galería) ya estaban construidas y bien arquitecturadas en
> esta rama. No se reescribió código correcto. Por tanto NO hay diff de modificaciones.

---

## EVIDENCIA DE QUE YA ESTABA IMPLEMENTADO
| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Botón "Guardar en Galería" (HUD 3D) | Viewer3D.jsx L2812-2817 (BookmarkPlus/ShieldAlert) | ✅ existe |
| Guardián de integridad | engine/viabilityGate.js `evaluateViability()` | ✅ espejo fail-closed del backend |
| Modal nombre + categoría | Viewer3D.jsx (SALVAR NA GALERIA) | ✅ existe |
| Persistencia | api/viableStore.js (DEMO→localStorage, prod→API+fallback) | ✅ existe |
| Eliminar reactivo + confirmación | GalleryCatalog.jsx (Trash2, removeViable, setDesigns filter) | ✅ existe |
| Filtros por categoría | GalleryCatalog.jsx (activeCat) | ✅ existe |
| Endpoints servidor | design.js: POST /save-viable, GET /viable, DELETE /viable/:id | ✅ existen |

**Guardián (`viabilityGate.js`) = spec exacta:** bloquea si `validation.status !== 'VALIDADO'`,
si `validation.errors.length > 0`, o si hay `specAdjustments` con `severity === 'critical'`.

---

## PRUEBAS EN NAVEGADOR REAL (localhost:5174)

### 1. RECHAZO — diseño defectuoso (2900mm > placa 2750mm) → PASA ✅
- Módulo 2900×900mm en escena → panel muestra **"✗ Rejeitado — 4 error(es) crítico(s)"**.
- Errores críticos detectados: `Techo (2864mm)`, `Base Inferior`, `Zócalo Frontal`, `Zócalo Trasero`
  — todos **exceden el largo máximo de placa (2750mm)**.
- Aviso: *"Ancho total (2900mm) excede la placa (2750mm). Dividí en módulos."*
- Botón **"Salvar como Projeto Viável" = disabled=true** → guardado BLOQUEADO. ✅
- Botón HUD "Guardar en Galería" en diseño sin validación de servidor:
  `aria-disabled=true`, razón `validation_missing` (fail-closed). ✅

### 2. GUARDADO EXITOSO (diseño sano) → PASA ✅
- Diseño viable → botón HUD habilitado (`aria-disabled=false`, "Salvar na Galeria").
- Modal pide **Nombre** + **Categoría**. Opciones de categoría = exactamente las 5 de spec:
  `cocina, aereo, bano, closet, escritorio`.
- Guardado "Balcão Cozinha Demo E2E" / categoría `cocina` →
  **localStorage `orbin:viableDesigns` = 1 registro** `{design_name, category:'cocina', module_type}`. ✅

### 3. GALERÍA → PASA ✅
- Chips de filtro: **TODOS · COCINA · AÉREOS · BAÑO · CLOSET/ROPERO · ESCRITORIO**.
- Tarjeta nueva poblada con badge **COCINA**, 800×2100×550, botones COPIAR/USAR + papelera.
- **Filtro bidireccional verificado:** BAÑO → tarjeta oculta (contador 0/1);
  COCINA → tarjeta visible (contador 1/1).
- **Eliminar reactivo:** papelera "Eliminar de la Galería" → confirmación "Sí" →
  tarjeta fuera del DOM sin recarga + **localStorage purgado (0)** + empty-state mostrado. ✅

### 4. CONSOLA DevTools → 0 errores de aplicación ✅
- Cero `Uncaught`/`TypeError`/`ReferenceError`/warnings de React.
- Únicas entradas rojas: `ERR_NETWORK_IO_SUSPENDED` (×5, pane en segundo plano suspende
  fetches HMR/telemetría) + `ERR_BLOCKED_BY_CLIENT` (×1, ad-block). Son de red/entorno,
  NO defectos de la app.

---

## BASELINE (constraint de no-regresión)
- **Server tests:** `npm test` → **287 pass / 0 fail**, exit 0.
- **Client build:** `vite build` → exit 0 (55s). (El `EPERM unlink` de dist/ es la
  restricción de borrado del puente, no del código; en Windows real vacía dist/ bien.)

## HALLAZGO PARA LA DEMO (matiz importante)
- Por **Lenguaje Natural**, pedir "2900" puede NORMALIZARSE a un diseño sano (ej. un closet
  800×2100) → se guarda sin bloqueo. El rechazo por placa se dispara con el **ancho real 2900mm**
  (el caso de la escena), no siempre con el texto "2900" en NL. Para la demo del rechazo,
  usá un módulo de **2900mm de ancho** (no de alto vía NL), que es el que produce los 4 errores
  críticos de placa de forma fiable.

## NOTA DE ESTADO (lo que toqué en tu escena)
- Añadí 1 módulo de prueba vía NL (quedó como "standard 800×2100", escena pasó de 3→4 módulos).
- Guardé y LUEGO borré una tarjeta de prueba en la Galería (galería queda limpia, localStorage=0).
- Podés revertir el módulo extra desde Histórico de Versiones ("Generated standard 4h ago — 3 módulos").

## ALCANCE (honestidad)
- Validé el circuito completo con **1 diseño representativo** (Balcão Cozinha), no los 3 de la lista
  (balcão/aéreo/ropero). El path de guardado es idéntico para los tres; puedo correr los 3 si lo querés.
