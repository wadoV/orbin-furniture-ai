# Prompt — Antigravity: build + commit del fix de despiece (flujo IA)

> Pegá el bloque de código en Antigravity.

---

```
CONTEXT: A one-file additive bugfix is already applied in client/src/App.jsx (by the
QA auditor). It fixes: the AI chat design flow staged a preview into `volatileOverlay`
(which fed Viewer3D) but ResultPanel/CutListTable read `currentResult` from
`modules`/`selectedModuleId`, so the cut list never rendered for AI-generated designs.
The fix adds `const shownResult = volatileOverlay || currentResult` (App.jsx ~795) and
feeds ResultPanel with `shownResult` instead of `currentResult` (design + onSave).
Do NOT re-implement it. Your job is to VERIFY, BUILD, and COMMIT it.

NON-NEGOTIABLE RULES:
1. ADDITIVE ONLY. Do not modify the fix's intent or touch core logic
   (server/src/engine/*, validator.js, aiOrchestrator.js). If you believe the fix is
   wrong, STOP and report — do not rewrite.
2. SECRETS: reference .env keys by name only; never print/commit .env.
3. VERIFY before commit. LOG the outcome to PROMPTS_LOG.md.

TASKS:
  1. Confirm the diff is present and minimal:
     `git diff client/src/App.jsx` → expect only: the new `shownResult` line + its
     comment block, `design={shownResult}`, and `shownResult?.id` in onSave. Nothing else.
  2. Regression gate — BOTH must be green:
     - `cd server && npm test`  → 117/117 pass, 0 fail.
     - `npm run build` (client) → 0 errors. (If rollup/esbuild throws a
       MODULE_NOT_FOUND / platform-binary error, run `npm install` in client/ first to
       restore native binaries, then rebuild. That is an env issue, not the code.)
  3. Manual smoke (headless or real Chrome): start the app
     (`set NODE_ENV=development && node src/index.js` in server/, wait >=30s; `npm run dev`
     in client/), open the chat, send:
     "Quiero un armario de 1800mm de ancho, 2200 de alto y 580 de fondo, con 4 estantes
     y 3 cajones." Confirm the CUT LIST now renders below (CutListTable populated) for the
     AI design preview — same as the params flow. Screenshot it.
  4. Commit ONLY App.jsx (+ PROMPTS_LOG.md):
     `git add client/src/App.jsx PROMPTS_LOG.md`
     `git commit -m "fix(ui): render cut list for AI chat design preview (volatile overlay)"`
     Do NOT stage build artifacts (client/dist/*), .env, or unrelated files.
  5. Report: the commit hash, npm test result (117/117), build result (0 errors), and a
     one-line confirmation the cut list appears for AI designs. If any step fails, STOP,
     paste the exact error, and do not commit.
```

---

### Nota para Eduardo (no va en el prompt)
- Ya verifiqué la sintaxis del cambio (esbuild transform → 0 errores). Lo único que no
  pude correr en mi sandbox fue el build completo de rollup (binarios Windows en
  `node_modules`), por eso el paso 2 lo cierra Antigravity en tu máquina.
- Si el build tira `MODULE_NOT_FOUND` de rollup/esbuild, es el mismo tema de binarios:
  un `npm install` en `client/` lo resuelve.
