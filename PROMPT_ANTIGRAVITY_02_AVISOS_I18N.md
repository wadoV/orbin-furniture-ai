# Prompt Antigravity — P02: traducir OBSERVACIONES / NOTES del plano

> **Qué falta:** el plano en inglés ya traduce título, leyenda, columnas y **nombres de pieza**, pero el cuerpo de `NOTES` sigue en español: *"Travesaño de cierre de 50mm pegado al tampo (privacidad)…"*. Es la última superficie mezclada.
>
> **Cómo usarlo:** pegá **P0** (contexto y reglas), esperá que confirme, después P1 → P3.
>
> **Auditado contra el repo el 2026-07-26:**
> - Último commit: `823bdd8` · **8 archivos modificados sin commitear**.
> - Baseline de tests: **194 pass / 0 fail** con `cd server && node --test src/engine/*.test.js src/ai/*.test.js`.
> - `npm test` **no sirve**: incluye `src/routes/chatDesign.e2e.test.js`, que se cuelga sin backend vivo.
> - 26 códigos de aviso distintos, emitidos desde **17 sitios**. **17 archivos consumen `specAdjustments`.**

---

## ⛔ PRE-FLIGHT — hacelo VOS antes de abrir Antigravity

Hay trabajo sin commitear otra vez (diccionario de nombres de pieza, parser de escritorio, candados). Sin punto de restauración, un `git clean` del agente lo borra.

```bash
cd Orbin
git add -A
git commit -m "feat(i18n): nombres de pieza traducidos + escritorio en el parser + candados de espejo"
git tag pre-antigravity-avisos
git rev-parse HEAD
```

Rollback: `git reset --hard pre-antigravity-avisos`

---

## P0 — Contexto y reglas duras

```
You are a Senior Engineer in the Orbin AI monorepo (React+Vite client, Node/Express
server). Orbin generates parametric furniture designs and manufacturing drawings.

MISSION: the drawing sheet is fully localized (ES/PT/EN) EXCEPT the body of the
OBSERVACIONES / NOTES block. Those strings come from the engine already formatted in
Spanish. Make them localize, without breaking the 17 existing consumers.

=== NON-NEGOTIABLE RULES ===

1. ADDITIVE ONLY. Never delete or rewrite existing logic in server/src/engine/*,
   validator.js or aiOrchestrator.js. If a fix seems to need a rewrite, STOP and report.

2. NEVER REMOVE `adj.message`. Seventeen files read specAdjustments today (UI panels,
   chat routes, HITL preview, orchestrator, several tests). `message` stays exactly as
   it is, in Spanish, and remains the fallback. You ADD structured data next to it.
   Removing or renaming it is an instant failure of this task.

3. THE ENGINE IS THE SOURCE OF TRUTH FOR GEOMETRY. Never fake a dimension in a
   renderer. This task touches text only — no geometry, no piece sizes.

4. TESTS ARE THE CONTRACT. Baseline: `cd server && node --test src/engine/*.test.js
   src/ai/*.test.js` = 194 pass / 0 fail. Must stay 194+ pass / 0 fail.
   Do NOT use `npm test` (its route e2e test hangs without a live backend).
   Never edit or delete an existing test to make it pass.

5. SECRETS. Never print or commit .env content.

=== ⚠ THE TRAP THAT ALREADY BIT US — READ THIS TWICE ===

Two test files in this repo silently reported "pass" while executing NOTHING. They did
`require('esbuild')` inside a try/catch and, on failure, every test did `return`.
It failed EVERY time: esbuild lives in `client/node_modules` and does not resolve from
`server/`. The online↔offline parser parity check never ran for hours.

    → A test that passes when it cannot run is worse than no test at all.

If your new test needs to load client code, use the existing helper
`server/src/engine/clientBundle.helper.js` (`bundleClientEngine('file.js')`). It resolves
esbuild via createRequire from the client and FAILS LOUDLY with a fix instruction.
Do NOT write another try/catch + skip. Do NOT add `if (skip) return` guards.

=== PROTECTED WORK — do not undo ===

A. `client/src/engine/pieceNames.js` — piece-name dictionary. The engine keeps emitting
   CANONICAL names; translation happens only at presentation. `groupPieces` translates
   the DISPLAYED name but groups by the CANONICAL key (grouping must be identical in
   every language).
B. Plan, CSV and THERMAL LABEL must name a piece identically — they are attached to the
   same physical part. All three go through `localizePieceName`.
C. `normLang()` in planGenerator is the single language normalizer (LX, lx0,
   buildInfoPanel all use it). Three divergent fallbacks used to produce mixed sheets.
D. `buildAvisos` returns `{svg, nextY}`; the caller uses nextY, not an estimate.
E. `scaleLabel()` computes real paper scale via MM_PER_UNIT. ExportPanel places the PNG
   with letterbox `fit` (no 4.66% horizontal stretch); the AcroForm fields use the same
   fit + offsets.
F. `server/src/engine/nlParser.js` and `client/src/engine/offlineParser.js` are MIRRORS
   (see parserMirror.test.js).

=== FIRST STEP ===
Read, in this order: client/src/engine/pieceNames.js (this task follows the SAME
pattern), server/src/engine/pieceNamesI18n.test.js, server/src/engine/clientBundle.helper.js,
then grep every `specAdjustments.push(` in server/src.
Confirm the mission, restate rules A–F, and list your plan. DO NOT WRITE CODE YET.
```

---

## P1 — Motor: agregar `params` sin tocar `message`

> **Nota para Eduardo:** la decisión de arquitectura ya está tomada y va en el prompt. El motor **no** traduce — sigue siendo español canónico. Solo expone los números que hoy quedan atrapados dentro del string.

```
TASK 1 — Expose structured params on every spec adjustment.

PROBLEM. Adjustments carry a pre-formatted Spanish sentence, so the client cannot
re-render them in another language:

    specAdjustments.push({
      code: 'DRAWER_PRIVACY_PANEL', severity: 'info', field: 'drawerRailHeight',
      message: `Travesaño de cierre de ${railH}mm pegado al tampo (privacidad); ` +
               `las gavetas se ajustaron a ${dh}mm de alto para llenar el pedestal.`
    })

The numbers (railH, dh) exist only inside the string. Some codes ALREADY carry structured
fields (e.g. DRAWER_HEIGHT_ADJUSTED has `requested` and `applied`) — the codebase is
inconsistent about this.

DO THIS, at every `specAdjustments.push(` site in server/src:
  - KEEP `code`, `severity`, `field` and `message` byte-for-byte unchanged.
  - ADD a `params` object holding every value interpolated into the message:
        params: { railH, dh }
  - Where structured fields already exist (`requested`, `applied`, …), keep them AND
    mirror them inside `params` so there is one predictable place to read from.

CONSTRAINTS:
  - `message` must remain identical, including wording and punctuation. Diff it.
  - No behavioural change: the engine output is the same object plus one new key.
  - There are 26 distinct codes across ~17 push sites. Cover all of them.

DELIVERABLE: the diff, plus the list of codes with their params keys. Run the test
baseline and report it. Do not proceed to Task 2 until it is 194 pass / 0 fail.
```

---

## P2 — Cliente: diccionario de mensajes + fallback

```
TASK 2 — Localize the adjustment messages at presentation time.

Create `client/src/engine/adjustmentMessages.js`, following EXACTLY the architecture of
`client/src/engine/pieceNames.js` (read it first):

  export function localizeAdjustment(adj, lang)

Behaviour:
  1. Normalize lang the same way pieceNames does (accepts lowercase and locale
     prefixes: 'pt-BR' → PT, 'en_US' → EN; fallback PT).
  2. Look up `adj.code` in a dictionary of ES/PT/EN templates with {placeholders}
     matching the `params` keys added in Task 1.
  3. Interpolate `adj.params`.
  4. FALLBACK: if the code is unknown, or a required param is missing, return
     `adj.message` verbatim. A note must NEVER disappear from a drawing because a
     translation is missing — a Spanish note is bad, an empty note is dangerous.
  5. The ES template must reproduce the current Spanish wording, so nothing changes
     for Spanish users. Diff a few to confirm.

Then wire it in:
  - `client/src/engine/planGenerator.js` → `buildAvisos(...)`. It already receives `D`;
    pass `lang` through from the call site (generateModulePlanSVG has it).
    Respect rule D: buildAvisos still returns {svg, nextY} and the caller uses nextY.
    The wrap width is computed from `box.w` — English text is longer, so re-check that
    notes still fit and still truncate with "…" instead of overflowing the panel.
  - Check whether `client/src/components/ResultPanel.jsx` and `InputPanel.jsx` also show
    these messages to the user. If they do, they must use the same function — otherwise
    the app shows one language and the drawing another. Report what you find; if wiring
    them is more than a one-line change, STOP and report instead of refactoring.

DELIVERABLE: the module, the wiring, and a before/after of one note in ES / PT / EN.
```

---

## P3 — Candado de cobertura + verificación

```
TASK 3 — Coverage lock and verification.

1. Create `server/src/engine/adjustmentMessagesI18n.test.js`, modelled on
   `server/src/engine/pieceNamesI18n.test.js`. Use `bundleClientEngine` from
   clientBundle.helper.js — NO try/catch, NO skip guards (see the trap in P0).

   It must:
   a) Collect every `code` that the engine can actually emit. Generate designs across
      all module types AND the paths that trigger adjustments (drawer counts that get
      reduced, oversized pieces, niche heights, aereo back forced structural, desk
      privacy panel, etc.). Also scan the source for `code: '...'` literals so codes
      emitted from routes/paramContract are not missed.
   b) FAIL if any collected code has no dictionary entry, naming the missing codes.
   c) Assert the ES output is byte-identical to `adj.message` for every code — that is
      the proof nothing changed for Spanish users.
   d) Assert an unknown code falls back to `adj.message` instead of returning empty.
   e) Assert no localized string is empty in any of ES/PT/EN.

2. PROVE THE LOCK BITES. Temporarily delete one dictionary entry, run the test, confirm
   it FAILS naming that code, then restore. Report both outputs. A lock that has never
   failed proves nothing.

3. Visual check: run `npm run plan:snapshot`. Confirm ASSERTIONS 15/15 and that the
   English sheet's NOTES block is now in English. Report the exact note text you see in
   the three languages.

4. Update PROMPTS_LOG.md. Do NOT commit — leave the tree dirty for review.

FINAL REPORT: files touched and why (one line each), test count before/after, the
sabotage proof from step 2, anything found but not fixed, and any rule A–F you believe
is wrong (argue it, do not act on it).
```

---

## Lo que NO le delegamos

**El aéreo encima del bajo en la vista de conjunto.** Los módulos se dibujan en una fila, así que un aéreo de cocina queda al lado del bajo en vez de arriba. Superponerlos exige pasar los *placements* del lienzo en vez de `modules[]` — es un cambio de contrato de una función pública y merece diseño previo, no un agente improvisando sobre la firma.

**Las listas de sinónimos de base/aéreo entre los dos parsers.** No son idénticas (el offline tiene `'superior'`, el servidor no) y el offline usa un patrón `|| 900` que nunca dispara. Alinearlas cambia cómo se clasifican frases reales de clientes: necesita casos de prueba propios antes de tocar nada.
