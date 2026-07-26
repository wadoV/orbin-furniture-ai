# Prompt Antigravity — Cierre de pendientes (planos + parser NLP)

> **Qué es esto:** el prompt para pegar en **Google Antigravity (Gemini 3)** y que cierre los pendientes abiertos tras la sesión de planos del **2026-07-26**, sin romper nada de lo ya logrado.
>
> **Cómo usarlo:** abrí Antigravity con la carpeta `Orbin` como workspace. Pegá **P0**, esperá que confirme el plan, y recién ahí pegá P1 → P4 en orden. Prompts en inglés a propósito (mejor rendimiento del modelo); las notas para vos, en español.

---

## ⛔ PRE-FLIGHT OBLIGATORIO — hacelo VOS, no Antigravity

**No abras Antigravity hasta hacer esto.** Ahora mismo hay **42 archivos modificados sin commitear (~1.700 líneas)**, y los archivos de test —que son la única red de seguridad— están **untracked**. Un `git checkout .` o un `git clean -fd` del agente borra la sesión entera y los candados que la protegen. No hay punto de restauración.

```bash
cd Orbin
git add -A
git commit -m "feat(planos): conjunto reacotado, aéreo colgado, escala real, leyenda contextual, mountHeight NLP"
git tag pre-antigravity-cierre
git rev-parse HEAD          # anotá este hash
```

Si algo sale mal: `git reset --hard pre-antigravity-cierre`.

**Además:**
1. Node ≥ 20 (`node -v`).
2. `server/.env` y `client/.env` presentes. **No los pegues en el chat de Antigravity.**
3. Baseline de tests, corrélo vos y anotá el número:
   ```bash
   cd server && node --test src/engine/*.test.js src/ai/*.test.js
   # esperado hoy: 149 pass / 0 fail
   ```
   ⚠️ **No uses `npm test` como red de seguridad**: incluye `src/routes/*.test.js`, y `chatDesign.e2e.test.js` **se cuelga** sin backend levantado y sin llaves. El subconjunto `engine + ai` es el que corre limpio y determinista.

---

## P0 — Mission brief (rol + reglas duras)

```
You are a Senior Engineer working inside the Orbin AI monorepo (React+Vite client
on :5174, Node/Express server on :3003, Supabase, Gemini/Claude). Orbin generates
parametric furniture designs and produces manufacturing drawings from them.

MISSION: close two pending defects left open after the 2026-07-26 drawing session,
without regressing any of that session's work.

=== NON-NEGOTIABLE RULES ===

1. ADDITIVE ONLY. Never delete or rewrite existing logic in server/src/engine/*,
   validator.js, or aiOrchestrator.js. Fix by adding guards or narrow patches.
   If a fix seems to require a rewrite, STOP and report instead of doing it.

2. THE ENGINE IS THE SOURCE OF TRUTH FOR GEOMETRY. Drawings project the real
   pieces[] the engine emits. NEVER fake a dimension in a renderer to make a
   drawing look better. If a size is wrong, it is wrong in the engine — report it,
   do not paper over it in the drawing layer.

3. STRUCTURAL LIMITS ARE HARD. MDF/MDP plate max 2750x1840mm. Drawer telescopic
   clearance 13mm per side (26mm total). Max unsupported MDF-18mm shelf span 900mm.
   No configuration violating these may pass validation.

4. TESTS ARE THE CONTRACT. Baseline: `cd server && node --test src/engine/*.test.js
   src/ai/*.test.js` = 149 pass / 0 fail. It must stay at 149+ pass / 0 fail after
   every change. Do NOT use `npm test` (its route e2e test hangs without a live
   backend). Never modify or delete an existing test to make it pass — if a test
   fails, your change is wrong until proven otherwise.

5. SECRETS. Never print, echo, or commit any .env content. Reference keys by name.

6. VERIFY, DON'T ASSUME. Re-run the affected tests after each fix, before moving on.

=== PROTECTED WORK — 2026-07-26 session. Do not undo these. ===

These were just fixed after careful visual auditing. Each line is an invariant that
must still hold when you are done:

A. server/src/engine/closetEngine.js — DEFAULTS.mountHeight MUST stay `null`, never 0.
   generateProject merges {...DEFAULTS,...params} BEFORE generateFurniture runs, so a
   0 default would be indistinguishable from a user-supplied 0 and the aereo
   auto-default would never fire.

B. server/src/engine/constants.js — DEFAULTS.mountHeight MUST stay `null`, never 1450.
   That object seeds nlParser AND GET /defaults for EVERY module type; a number there
   makes wardrobes inherit a mount height and float in the assembly drawing.
   The 1450 belongs ONLY to the aereo auto-default (AEREO.KITCHEN_MOUNT_HEIGHT).

C. server/src/ai/paramContract.js — mountHeight must stay in BOTH `RANGES` [0,2400]
   and `DIMENSION_KEYS`, plus the metres rule (`n>0 && n<10` → n*1000, code
   NLP_UNIT_INFERRED). Without all three, "colgalo a 1.5" reaches the engine as 1.5mm
   with zero warnings.

D. server/src/engine/nlParser.js AND client/src/engine/offlineParser.js are MIRRORS.
   Any change to MOUNT_PATTERNS / mountToMM / extractMountHeight must be applied to
   BOTH or online and offline parsing diverge. mountHeight extraction MUST run before
   dimension extraction and MUST strip its match from the text, otherwise the height
   extractor re-captures the number.
   NOTE the asymmetry, it is intentional: the SERVER parser sets no default (the
   engine applies it); the OFFLINE parser DOES set one, because App.jsx builds the
   offline module with `configuration: parsed.params` and `pieces: []` — the engine
   never runs on that path.

E. client/src/engine/planGenerator.js:
   - `normLang()` is the single language normalizer. LX, lx0 and buildInfoPanel must
     all use it. Three divergent fallbacks previously produced mixed-language sheets.
   - The assembly view (generateConjuntoPlanSVG) is the SOLE owner of per-module
     labelling; it calls buildAlzadoUnified with `{dims:false}`. Do not let the
     elevation draw its own dimensions there — that caused overlapping duplicates.
   - `floorY = areaY + areaH - LBL_H` (floor anchored to the bottom of the area).
   - scaleLabel() computes REAL paper scale via MM_PER_UNIT. Do not revert it to
     `1/s` on viewBox units — that reported 1:2 where the true scale was 1:8.
   - buildAvisos returns `{svg, nextY}`; the caller must use nextY, not an estimate.
   - The mount-height dimension line is CONTINUOUS on purpose (dashed already means
     "hidden part" for the apron).

F. client/src/components/ExportPanel.jsx — the plan PNG is placed with
   `fit = min(PW/vb.w, PH/vb.h)` and centred (letterbox). Do NOT go back to
   `addImage(png,'JPEG',0,0,PW,PH)`: that stretched the drawing 4.66% horizontally,
   so widths and heights were at different scales. The AcroForm cajetin fields MUST
   use the same `fit` + offX/offY or they detach from the drawing.

G. client/src/engine/domainConstants.js mirrors server constants for the client
   (the client cannot import the backend's CommonJS). If you change a value there,
   change it in server/src/engine/constants.js too.

=== FIRST STEP ===

Read, in this order: CLAUDE.md, client/src/engine/planGenerator.js,
client/src/engine/offlineParser.js, server/src/engine/nlParser.js,
server/src/ai/paramContract.js, server/src/engine/mountHeight.test.js.
Then confirm you understand the mission, restate rules A–G in your own words, and
list your test plan. DO NOT WRITE ANY CODE YET.
```

---

## P1 — Bug real: la heurística de unidades produce muebles 10× mal

> **Nota para Eduardo:** este es el único pendiente que toca el camino del dinero. Un cliente escribe "mueble de 900 de alto" en el chat y el motor genera 9 metros. La regla que decidí (plausibilidad por rango, con desempate por default comercial) está en el prompt — Antigravity la **implementa**, no la inventa.

```
TASK 1 — Unit heuristic produces 10x-wrong furniture.

PROBLEM. In BOTH server/src/engine/nlParser.js and client/src/engine/offlineParser.js:

    function toDimMM(raw, hasMMSuffix) {
      if (hasMMSuffix) return raw
      return raw < 1000 ? raw * 10 : raw     // assumes centimetres
    }

So "mueble de 900 de alto" yields height = 9000mm (nine metres). "700 de alto"
yields 7000mm. Any unit-less number below 1000 is multiplied by 10. This reaches
the engine and produces a wrong design silently.

DECIDED RULE — implement exactly this, do not invent your own semantics:

Resolve a unit-less number by PLAUSIBILITY against the field's own range, which
already exists in server/src/ai/paramContract.js -> RANGES:

  1. Build the candidate interpretations: mm = n, cm = n*10, m = n*1000.
  2. Keep only candidates that fall inside RANGES[field] for that field.
  3. Exactly one survivor  -> use it.
  4. Zero survivors        -> clamp as today and emit a warning
                              (code NLP_VALUE_IMPLAUSIBLE, severity warning).
  5. More than one survivor -> ambiguous. Pick the candidate CLOSEST to
                              COMMERCIAL_DEFAULTS[moduleType][field] (already in
                              paramContract.js) and emit a warning
                              (code NLP_UNIT_AMBIGUOUS) naming both readings, e.g.
                              '"180" para width puede ser 180mm o 1800mm; se
                              interpretó 1800mm (típico para base). Confirmá si no
                              es lo que querías.'

WORKED EXAMPLES that must hold (height range [200,3500], width [100,6000]):
  "900"  height -> 900mm   (mm plausible, cm=9000 out of range)
  "90"   height -> 900mm   (mm=90 out of range, cm plausible)
  "2.4"  height -> 2400mm  (m interpretation)
  "180"  width  -> 1800mm  + NLP_UNIT_AMBIGUOUS (both 180 and 1800 plausible;
                            1800 is closer to the commercial default)
  "1400" width  -> 1400mm  (unchanged)
  "600mm" depth -> 600mm   (explicit unit always wins, never re-interpreted)

CONSTRAINTS:
 - Apply to BOTH parsers (rule D). Keep them literally mirrored.
 - Do NOT change mountToMM — mountHeight already has its own correct scaling and
   its own tests. Leave it alone.
 - Explicit units (mm/cm/m suffix) must NEVER be re-interpreted.
 - counters (numDrawers, numDoors, numShelves...) must NEVER be scaled.

DELIVERABLE:
 - The fix in both parsers.
 - A new test file server/src/engine/unitHeuristic.test.js covering every worked
   example above plus: explicit units untouched, counters untouched, and a
   regression case asserting mountHeight parsing still works
   ("aereo de 700mm de alto colgado a 1400 del piso" -> height 700, mountHeight 1400).
 - Re-run: cd server && node --test src/engine/*.test.js src/ai/*.test.js
   Must be 149 + your new tests, 0 fail.

Report the diff and the test output before moving on.
```

---

## P2 — Verificación visual de no-regresión (obligatoria)

> **Nota:** los planos no tienen tests unitarios, se validan mirándolos. Sin este paso, P1 puede romper un plano y nadie se entera.

```
TASK 2 — Visual non-regression of the drawings.

The drawings have no unit tests; they are validated by looking at them. Prove your
P1 change did not disturb them.

SETUP (sandbox-friendly, no browser needed):
  pip install cairosvg --break-system-packages   # if missing

SCRIPT: write scripts/plan_snapshot.js that, for each moduleType in
[desk, base, aereo, standard] and each lang in [ES, PT, EN]:
  - generates the module plan (generateModulePlanSVG) and the assembly plan
    (generateConjuntoPlanSVG) by bundling client/src/engine/planGenerator.js with
    esbuild (format cjs) and requiring server/src/engine/closetEngine.js — the
    existing session used exactly this approach, reuse it.
  - writes the SVGs to _plan_review/

ASSERTIONS (fail loudly if violated):
  1. No SVG contains "undefined", "NaN", or an unsubstituted placeholder /\{[htwb]t?\}/.
  2. Language coherence: each sheet matches EXACTLY ONE language family. Use
     EXCLUSIVE markers only — ">PIEZA<" / ">PEÇA<" / ">PIECE<" and
     "del piso" / "do piso" / "from floor".
     ⚠ "LISTA DE CORTES" is IDENTICAL in ES and PT, and /COMP/ matches "COMPANY"
     in EN. Naive markers give false positives. Do not use them.
  3. No overflow: inside the assembly drawing band, no y coordinate exceeds 538
     (the cut-list separator sits at y=540).
  4. The desk sheet's legend contains the hidden-part entry and does NOT contain
     the door-split or plinth entries. The wardrobe (standard) sheet is the inverse.
  5. Scale label is a normalized ratio (1:5, 1:10, 1:20...), never "1:2" for a
     1400mm desk.

Then rasterize _plan_review/*.svg to PNG with cairosvg and REPORT which files you
generated. Do not claim the drawings look correct — Eduardo reviews the PNGs.

Add `npm run plan:snapshot` to the root package.json scripts pointing at this script.
```

---

## P3 — Cierre y registro

```
TASK 3 — Wrap up.

1. Update PROMPTS_LOG.md: append every prompt from this session plus a one-line
   outcome for each.
2. Update README.md ONLY if a documented behaviour changed. Do not rewrite sections
   that are still accurate.
3. Produce a final report with:
   - files touched and why (one line each)
   - test count before and after
   - anything you found but did NOT fix, and why
   - any point where you believe a rule A–G is wrong (argue it; do not act on it)
4. Do NOT commit. Leave the working tree dirty so Eduardo reviews the diff.
```

---

## Lo que NO le vamos a delegar (decisión de producto, no de ejecución)

**Nombres de pieza en planos EN.** Hoy la hoja inglesa tiene el chrome en inglés pero los nombres salen del motor en ES/PT ("Tampo Escritorio", "Lateral Izquierdo"). No es un bug: coincide con la regla de `CLAUDE.md` y mantiene coherencia con el CSV y las etiquetas físicas del taller. Con EN como mercado terciario, traducirlo ahora es trabajo sin retorno — y romper la correspondencia nombre-en-plano ↔ nombre-en-etiqueta sí tiene costo real en producción.

**Aéreo encima del bajo en la vista de conjunto.** Hoy los módulos se dibujan en una fila y el aéreo queda al lado del bajo, no arriba. Para superponerlos hace falta pasar los *placements* del lienzo al generador, no `modules[]`. Es un cambio de contrato del generador y merece su propia ronda con diseño previo, no un agente autónomo improvisando sobre una firma pública.
