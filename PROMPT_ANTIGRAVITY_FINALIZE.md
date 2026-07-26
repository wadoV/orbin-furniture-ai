# Prompt — Antigravity: Finalize Orbin AI to a verifiable "Definition of Done"

> Paste the block below into Antigravity. Scope = make the **local** app 100%
> functional, error-free, and committed cleanly. Production deploy (Railway/Vercel)
> is a separate follow-up, NOT part of this mission.

---

```
ROLE: You are a Senior QA & Release Engineer finalizing the Orbin AI monorepo
(React+Vite client :5174, Node/Express server :3003, Supabase, Gemini/Vertex/Ollama).

CURRENT STATE (already verified — do NOT redo, do NOT regress):
- npm test = 117/117 pass. Production build = 0 errors.
- Structural invariants hold: drawer bottom 738mm (W800), aereo module = 0 baseboard
  pieces, W3000 => validator RECHAZADO with 6 plate-overflow errors.
- All .env keys are real (not placeholders). Migrations 001–007 exist locally.
  Vertex/Ollama clients are implemented.
So the app is FUNCTIONAL. This mission is about closing the last real gaps and
committing — NOT rebuilding anything that already works.

NON-NEGOTIABLE RULES:
1. ADDITIVE ONLY. Do not delete or rewrite existing core logic in
   server/src/engine/*, validator.js, aiOrchestrator.js. Fix via guards / narrow
   patches / additive branches only. The 117 tests and the 3 invariants above MUST
   stay green after every change.
2. SECRETS. Never print, echo, or commit .env contents. Reference keys by NAME only.
   Never edit server/.env on disk — use temporary shell env overrides when needed.
3. STRUCTURAL SAFETY unchanged: MDF plate 2750x1840mm max, 26mm total drawer
   clearance, 900mm max unsupported 18mm shelf span. No config may violate these.
4. VERIFY, DON'T ASSUME. After EACH change: re-run the specific affected test, then
   `cd server && npm test` (must stay 117/117) and `npm run build` (0 errors).
5. LOG EVERYTHING to PROMPTS_LOG.md: prompt, action, file+lines, result.
6. If a fix would require rewriting core logic, STOP and report it as a
   recommendation — do not execute it.

BOOT NOTE: server/.env sets NODE_ENV=production (fail-closes auth). For local QA,
launch the server with a SHELL override only:  set NODE_ENV=development && node src/index.js
(PowerShell: $env:NODE_ENV="development"). dotenv does not override shell vars.
Cold boot takes ~20s (module load) — wait >=30s before declaring a health-check failure.

=== DEFINITION OF DONE (this is the ONLY definition of "100% functional / no errors").
Every box must be objectively true and evidenced in PROMPTS_LOG.md: ===
  [ ] D1. `cd server && npm test` = 117/117 pass, 0 fail.
  [ ] D2. `npm run build` (client) = 0 errors.
  [ ] D3. App boots (server :3003 + client :5174); GET /api/design/defaults = HTTP 200.
  [ ] D4. Full UI pass in headless + real Chrome: landing + /app load with ZERO red
          console errors. Paste any console error verbatim; fix additively; re-test.
  [ ] D5. Chat 3-turn flow returns success:true + design object each turn; Turn 3
          (aereo) shows 0 baseboard pieces in the rendered cut list AND the 3D viewer.
  [ ] D6. Validator user-facing error strings are in SPANISH (CLAUDE.md rule). The
          W3000 case currently emits Portuguese ("Peca ... excede o comprimento
          maximo da chapa"). Fix the OUTPUT COPY to Spanish additively (do not change
          validation logic, thresholds, codes, or the RECHAZADO status). Keep all 117
          tests green — if a test asserts the Portuguese text, update the assertion
          string (test-only) to match, never weaken the check.
  [ ] D7. Live fallback resilience: launch the server with GEMINI_API_KEY emptied in
          the SHELL ONLY (never touch .env), send a chat/design request, confirm the
          response still returns HTTP 200 with source "regex-fallback" (or another live
          provider) and NO 500 reaches the user. Restore the shell after.
  [ ] D8. Manual (human) checks handed to Eduardo, listed explicitly in the report:
          3D canvas renders the module, and Ctrl+C / Ctrl+V clipboard rehydrates a
          design via generateProject. (These are NOT auto-verifiable — flag, don't fake.)
  [ ] D9. Clean commit: run `git diff --stat` and `git diff` over the working tree
          (currently ~35 dirty files, incl. audited engine work). Group into a
          coherent commit (or a small series). Do NOT commit .env, secrets, build
          artifacts you did not intend, or throwaway QA scratch files. State exactly
          what was committed and what was intentionally left out.

EXECUTION ORDER: D3 (boot) -> D1/D2 (gates) -> D4/D5 (UI) -> D6 (copy fix, one change +
full verify) -> D7 (fallback) -> D8 (list manual items) -> D9 (review + commit).
Apply the error loop (Reproduce -> Isolate -> Additive fix -> Verify -> Log) per issue.
One fix, one verification. Never batch risky changes.

FINAL REPORT: a filled DoD checklist (D1–D9) with evidence per line, the exact commit
hash(es) created, a list of anything deferred as a recommendation, and confirmation
that npm test is still 117/117 and build is 0 errors AFTER the commit.
DO NOT claim "100% / no errors" unless every D-box is objectively checked. Partial is
fine — report it honestly as partial.
```

---

### Notas para Eduardo (no van en el prompt)
- **Alcance:** esto deja el app **local** 100% funcional + commiteado. El deploy a
  producción (Railway/Vercel: env vars en el host, `CLIENT_URL`/CORS, aplicar
  migraciones 005–007 en la Supabase real, Stripe test→live) es **otro prompt**. Pedímelo.
- **El único fix de código nuevo** que le pido es D6 (copy del validador PT→ES), que es
  aditivo y no toca lógica. Todo lo demás es verificar + commitear.
- **D8 es tuyo:** 2 minutos — chat Turno 3 en pantalla + un Ctrl+V en el canvas.
