# Directrices de Ingeniería y Restricciones para Agentes en Orbin AI

> **Estado:** activo · **Creado:** 2026-10-29
> **Alcance:** todo agente (humano o LLM) que modifique este repositorio.
> **Precedencia:** para límites físicos y tolerancias manda `rules/parametric_constraints.md`
> y `server/src/engine/constants.js`. Este archivo manda para decidir **qué NO está
> implementado** y para el flujo de trabajo/validación.

---

## 1. Fronteras estrictas: lo que NO existe en el código

Cualquier agente que asuma tareas en este repositorio debe consultar esta tabla. Si una
directriz requiere un campo o constante que pertenece a la documentación de taller, debe
responder obligatoriamente `NO IMPLEMENTADO` en lugar de alterar esquemas o modificar
constantes globales del motor.

| Concepto de Taller / Manual | Estado real en el código | Evidencia | Directriz para agentes |
|---|---|---|---|
| Códigos `ENC-` / `OP-` / `ACB-` | Inexistentes en `cutList` | `closetEngine.js:301` (`generateCutList`) emite `{id,name,type,nominalWidth,nominalHeight,cutWidth,cutHeight,thickness,grainDirection,edgeBanding,notes}`; los códigos solo viven en `agentes/artesano_pro.md:45-47,139-152,79-86` | Emitir únicamente en documentos externos de taller, **nunca** en el esquema del motor |
| Densidades y desperdicios (15% / 25%) | Inexistentes como campos de motor | `agentes/artesano_pro.md:16-28,241`; `agentes/carpinteria_fina.md:78-82` | Manejar exclusivamente en la capa de reportes o presupuestos |
| Holgura de 3 mm (madera maciza) | Constante fija `DOOR_GAP_W = 2.5` | `constants.js:71` (por hoja; `DOOR_GAP_H = 4` en `:72`) | No alterar la constante global; tratarlo como chequeo manual externo |
| Límite repisa maciza > 750 mm | Constante fija `MAX_SHELF_SPAN = 900` | `constants.js:78` | No alterar el límite de MDF; el 750 es criterio de taller, no invariante |
| Puntuación de complejidad (1–5) | Inexistente en el motor/despiece | sin ocurrencias en `server/src/**` | Reportar solo de forma descriptiva si se solicita |

**Regla de respuesta ante un vacío:** `NO IMPLEMENTADO` + qué haría falta para implementarlo
(esquema nuevo, campo aditivo, migración, test). Nunca:
- inventar campos que nadie consume,
- relajar/endurecer una constante global para "cumplir" una directriz,
- afirmar que un gate pasó sin haberlo ejecutado.

---

## 2. Prompt maestro de ejecución (drop-in)

```markdown
# Role
Senior Software Engineer + Parametric Furniture/Manufacturing Specialist, Orbin AI.
Objective: surgical changes preserving structural integrity and the despiece engine.

## Workflow (one task at a time)
1. ONE task per run. Never touch files outside the declared scope.
2. Gates, in this exact order. Stop and report on first red:
   - `node scripts/verify-integrity.cjs`        (always)
   - `npm test --prefix server`                 (always)
   - `npm run build`                            (only if client/ or a shared schema changed)
   Note: the server has NO compile step; it is plain JS. "Server build" = integrity + tests.
3. Commit ONLY the files you changed, by explicit path:
   `git add <file1> <file2> && git commit -m "<scope>: <what>"`.
   Never `git add -A` / `git add .` — the tree may hold other agents' work.
   Feature branches only; merge only when CI (`integrity.yml`) is green.
4. Never commit secrets. `.env` stays gitignored. Never reintroduce "Vision IA".
5. User-facing text is trilingual PT/ES/EN and the three blocks stay key-symmetric
   (`client/src/i18n.js`). A new user-facing `code:` requires its ES/PT/EN entry in the
   corresponding dictionary (`client/src/engine/{pieceNames,adjustmentMessages,apiErrors}.js`).

## Industrial metadata (ONLY for shop/manual deliverables)
Codes are catalogued in `agentes/artesano_pro.md` — they are NOT engine fields:
- Joinery: ENC-MAR (mortise+tenon) · ENC-DV (dovetail) · ENC-CAV (dowel)
- Operation: OP-ART-xx (hand) · OP-CNC-xx (machining)
- Finish: ACB-xxx
The engine cutList schema has no such columns. Either (a) emit them in the external shop
document, or (b) propose an additive `joinery` field, never a breaking schema change.
Hardware schedule, man-hours, m³/kg (densities: artesano_pro.md) and waste
(15% standard / 25% complex joinery) are report-layer outputs, not engine invariants.

## Craft validation — manual checklist, NOT global constants
1. Solid-wood doors: 3 mm clearance. Species-specific check; do NOT change
   `DOOR_GAP_W = 2.5`, which governs MDF for every existing test.
2. `grainDirection` must be defined on decorative panels (`makePiece` already sets it;
   back panels legitimately use `'none'`).
3. Solid-wood shelf span > 750 mm → warn. Do not touch `MAX_SHELF_SPAN = 900` (MDF).
4. Drawer boxes: recommend dovetail or finger joint.
5. Finish/species compatibility: report, don't encode.
6. Assembly complexity 1–5: report only; no such field exists today.

## Anti-false-positive rule (highest priority)
If a directive requires a capability that does not exist in the code, respond
`NO IMPLEMENTADO` and describe what would be needed. Never invent fields, never
relax a constant, never claim a green gate you did not run.

## Output format
`APROBADO | APROVADO | APPROVED` or `REVISIÓN | REVISÃO | REVIEW`, followed by the
numbered list of required adjustments, each tagged [code] / [doc] / [report].
```

---

## 3. Gates y línea base

Ejecutar desde la raíz del repo, en este orden. Parar y reportar al primer rojo.

| Gate | Comando | Qué valida |
|---|---|---|
| Integridad | `node scripts/verify-integrity.cjs` | nulls, sintaxis, routers que exportan |
| Tests | `npm test --prefix server` | motor, IA, rutas |
| Build cliente | `npm run build` | Vite build (solo si tocó `client/` o un esquema compartido) |

**Línea base al 2026-10-29:** 537 tests / 0 fallos · build del cliente verde (~64 s) ·
i18n 571/571/571 claves.

> Si el conteo difiere, verificar que sea **crecimiento esperado** (tests nuevos) y no un
> archivo que dejó de ejecutarse. Un test que no puede ejecutarse debe FALLAR, no saltarse.

---

## 4. Higiene de git

- Un commit por tarea, con **rutas explícitas**. Prohibido `git add -A` / `git add .`.
- El árbol de trabajo puede contener cambios de otros agentes. Antes de commitear:
  `git status --porcelain` y confirmar que solo aparecen los archivos de la tarea.
- Ramas de características; fusión solo con CI en verde.
- `.env` nunca se commitea (`.gitignore:43`).

---

## 5. Registro de cambios

| Fecha | Cambio |
|---|---|
| 2026-10-29 | Creación. Tabla de fronteras `NO IMPLEMENTADO` + prompt maestro corregido + gates y línea base. |
