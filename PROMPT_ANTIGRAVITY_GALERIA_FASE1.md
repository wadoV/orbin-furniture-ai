# Antigravity Task — Orbin AI · COMMIT the "Galería" arc (Verified Library + Catalog · Phase 1)

ROLE: Git release engineer for Orbin AI. The feature code is ALREADY WRITTEN and
verified. Your ONLY job is to produce ONE clean, scoped commit — no feature work.

════════════════════════════════════════════════════════════════════════
## CONTEXT — the working tree is messy (READ THIS)
════════════════════════════════════════════════════════════════════════
The repo has ~50 modified/untracked files spanning WEEKS of unrelated uncommitted
work (engine rodapié/desk/niche, AI orchestrator, blog pages, Viewer3D, build
artifacts). You must commit ONLY the "Galería / Verified Library" arc and nothing else.

Do NOT `git add -A`. Do NOT commit `client/dist/` (build artifacts). Do NOT commit the
unrelated work streams listed in the EXCLUDE section.

════════════════════════════════════════════════════════════════════════
## STEP 1 — Build gate (must pass BEFORE committing)
════════════════════════════════════════════════════════════════════════
```
cd client && npm run build
```
Must exit with **0 errors**. Paste the real output tail. If it fails, STOP and report —
do not commit. (This build was NOT run to completion in the authoring sandbox due to a
45s cap; you are the machine that closes that gap. A full-graph esbuild bundle of
main.jsx already passed with 0 errors, so failures here would be rollup/tailwind-level.)

════════════════════════════════════════════════════════════════════════
## STEP 2 — Stage ONLY these files
════════════════════════════════════════════════════════════════════════
NEW files (stage whole):
- server/supabase/migrations/005_create_viable_designs.sql
- server/supabase/migrations/006_viable_designs_reconcile.sql
- server/supabase/migrations/007_viable_designs_category.sql
- client/src/components/GalleryCatalog.jsx
- client/src/data/galleryCategories.js

MODIFIED files — clean arc, verified no foreign hunks (stage whole):
- server/src/routes/design.js        (save-viable/viable endpoints + category)
- server/src/index.js                (/api/designs alias mount)
- client/src/api/client.js           (saveViableDesign/listViableDesigns)
- client/src/components/Header.jsx    (Galería nav · LayoutGrid)
- client/src/components/ResultPanel.jsx (SaveViableButton + category selector)
- PROJECT_SNAPSHOT.md                 (changelog 2026-07-21)

MODIFIED file — INTERLEAVED, handle with care:
- client/src/App.jsx contains the Galería hunks (GalleryCatalog import, `galleryOpen`
  + `pasteToast` state, paste pipeline `handleUseTemplateParams`/`handleClipboardPaste`,
  Ctrl+V in the keydown handler, Header `onOpenGallery`, gallery overlay render, paste
  toast) MIXED with TWO unrelated pre-existing hunks:
    (a) removal of `OnboardingFlow` import + `showOnboarding` state,
    (b) a `server_offline_desc` copy tweak ("Los presets y el generador" → "El generador").
  Prefer `git add -p client/src/App.jsx` and select only the Galería hunks. If a hunk
  cannot be cleanly split (the `galleryOpen` state add shares a hunk with the
  `showOnboarding` removal), include it as-is — those orphan lines are the user's own
  prior edits, not garbage — and note it in the commit body. Never break the file to
  exclude them.

════════════════════════════════════════════════════════════════════════
## STEP 3 — EXCLUDE (do NOT stage — separate concerns / not this feature)
════════════════════════════════════════════════════════════════════════
- Engine work (separate rodapié/desk/niche arc): server/src/engine/closetEngine.js,
  validator.js, constants.js, engine.test.js
- AI/other backend: server/src/ai/*, server/src/routes/chat.js, projects.js, vision.js,
  server/src/engine/nlParser.js
- Frontend unrelated: client/src/components/InputPanel.jsx, Viewer3D.jsx, SeoMeta.jsx,
  client/src/i18n.js, client/src/pages/blog/*, client/package.json
- Untracked NOT part of this arc: SALES_FEEDBACK.md, client/scripts/prerender.mjs,
  server/src/ai/paramContract.js, server/src/ai/paramContract.test.js,
  PROMPT_ANTIGRAVITY_GALERIA_FASE1.md (this prompt itself)
- Build artifacts: client/dist/ (if staged, unstage it)
- QA_STRESS_TEST_REPORT.md and any CRLF-only line-ending noise

════════════════════════════════════════════════════════════════════════
## STEP 4 — Review, then commit
════════════════════════════════════════════════════════════════════════
1. `git diff --cached --stat` — confirm ONLY the Step-2 files are staged. If anything
   from the EXCLUDE list appears, unstage it (`git restore --staged <file>`).
2. Commit (single commit):
   ```
   feat(galeria): verified library + templates catalog with copy/paste pipeline

   Backend (additive; save-viable guard unchanged):
   - migrations 005/006/007 for viable_designs (+category column)
   - /api/designs/save-viable regenerates+revalidates server-side; category allow-list
   - GET /api/designs/viable returns category + parametric_json

   Frontend (charcoal parity):
   - GalleryCatalog.jsx: search + category filters over viable_designs
   - Header: Galería nav (LayoutGrid); ResultPanel: category selector on save
   - App.jsx: Ctrl+V paste hydrates params -> generateProject; paste toast
   - galleryCategories.js: shared category SSOT

   Note: App.jsx also carries two small pre-existing unrelated hunks
   (OnboardingFlow removal, offline-copy tweak) that could not be split from
   adjacent Galería hunks.
   ```
3. Report the commit hash and `git show --stat <hash>`. Do NOT push.
