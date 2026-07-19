# ORBIN — LAUNCH READINESS EXECUTION PLAN
**Target executor:** Fable 5 · **Mode:** additive, non-destructive · **Date:** 2026-07-19

---

## 0. NON-NEGOTIABLE GUARDRAILS

Read this section fully before touching any file. Violating any rule invalidates the run.

### 0.1 Additive-only contract
- **NEVER delete a file.** If something must stop being used, stop referencing it — leave the file in place.
- **NEVER remove or rewrite an existing i18n key.** Only ADD new keys. Existing translations are ground truth.
- **NEVER modify `server/src/engine/*`.** The parametric engine is out of scope. No exceptions.
- **NEVER change a function signature in a breaking way.** New parameters must be optional and backward compatible.
- **NEVER reformat, re-indent, or "clean up" files you are not explicitly assigned to change.** No drive-by refactors.
- Preserve every existing comment, especially blocks marked `★ FIX`, `★ PROTECTED`, `BUG FIX`, `SECURITY`, and `RECOVERY`. They encode prior incident knowledge.

### 0.2 Evidence contract — read carefully
A previous agent was asked to diagnose a bug, executed nothing, and returned **fabricated data** formatted to look like real console output (placeholder values like `piecesLen: N` and `"ORB-XXXXXXXX"`). This wasted a full cycle.

Therefore:
- **Never report a value you did not actually observe.** If you could not run something, write exactly: `NOT VERIFIED — <reason>`.
- **Never present static analysis as if it were runtime output.** Label predictions as predictions.
- Every acceptance criterion below must be validated by a command you actually ran, with its real output pasted in.
- Partial completion honestly reported beats full completion claimed.

### 0.3 Git safety
```bash
git checkout -b launch/seo-i18n-readiness
git status                       # must be clean before starting
```
One commit per phase, prefixed `[P<n>]`. Never force-push. Never rebase onto main.

### 0.4 Phase gate
Phases are ordered by risk. **Stop after each phase, report, and wait for human approval before continuing.** Do not chain phases autonomously.

---

## PHASE 0 — BASELINE (do not skip)

Establish what "working" means before changing anything.

```bash
cd server && npm test 2>&1 | tail -30
cd ../client && npm run build 2>&1 | tail -30
```

**Record:** number of tests passing, build success/failure, bundle size, any warning.
This is the regression baseline. If the build is already failing, STOP and report — do not build on broken ground.

**Acceptance:** baseline recorded with real command output.

---

## PHASE 1 — i18n GAP (highest user-visible impact, lowest risk)

### 1.1 Root cause — fix this first
`client/src/context/PreferencesContext.jsx` line ~32:
```js
return translations[lang]?.[key] || key;
```
When a key is missing it returns **the key itself**, which is a truthy string. Consequence: the defensive pattern used across the codebase —
```js
t('top_style') || 'Armado de tapa'
```
— can never fire, because `'top_style' || 'x'` evaluates to `'top_style'`. Every one of those fallbacks is dead code, and the raw key leaks to the UI. This is why the parameters panel shows `TOP_STYLE`, `DOOR_STYLE`, and `auto_by_type` instead of Spanish labels.

**Additive fix** — add an optional second parameter, fully backward compatible:
```js
return (key, fallback) => {
  const hit = translations[lang]?.[key];
  if (hit) return hit;
  if (fallback) return fallback;
  if (import.meta.env.DEV) console.warn('[i18n] missing key:', key, lang);
  return key;
};
```
Existing single-argument calls behave exactly as before. Do NOT change any call site in this step.

### 1.2 Add the 29 genuinely missing keys
Add to **all three languages** (PT / ES / EN) in `client/src/i18n.js`. Append to the existing blocks — do not reorder or rewrite what is there.

| Component | Keys |
|---|---|
| `InputPanel.jsx` | `top_style`, `door_style`, `auto_by_type`, `top_inset`, `top_overlay`, `door_overlay`, `door_legacy` |
| `ResultPanel.jsx` | `copy`, `spec_adjusted`, `spec_changed`, `spec_notice`, `validation_unavailable`, `validation_unavailable_desc` |
| `ValidationReport.jsx` | `critical_errors`, `rejected`, `warnings` |
| `CutListTable.jsx` | `h_m`, `h_mm`, `w_mm` |
| `OnboardingWizard.jsx` | `onboard_step_size_title`, `onboard_step_size_subtitle`, `onboard_size_width`, `onboard_size_height`, `onboard_size_depth`, `onboard_size_custom`, `onboard_size_custom_hint`, `onboard_size_recommended` |
| `App.jsx` | `plan_module_limit_feature` |

**Terminology constraint:** this is professional carpentry software. Use trade vocabulary, not literal translation. PT-BR is the primary market — validate against Brazilian marcenaria terms (`fita de borda`, `prateleira`, `corrediça`, `rodapé`, `tamponamento`). Ambiguous term → flag it, do not guess silently.

### 1.3 Do NOT touch these
`LandingPage.jsx` and `AuthPages.jsx` define their own local `t()` with local dictionaries. Their keys are **false positives** in any global audit. Leave both files alone in this phase.

### 1.4 Full sweep for underscore leakage
The visible symptom is any UI label rendering a raw snake_case key. Audit every heading, label, option, and placeholder:

```bash
cd client/src && python3 - <<'EOF'
import re,glob,os
used={}
for p in glob.glob('**/*.jsx',recursive=True):
    if 'LandingPage' in p or 'AuthPages' in p: continue
    txt=open(p,encoding='utf-8',errors='ignore').read()
    for m in re.finditer(r"\bt\(\s*['\"]([a-zA-Z0-9_]+)['\"]",txt):
        used.setdefault(m.group(1),set()).add(os.path.basename(p))
i18=open('i18n.js',encoding='utf-8',errors='ignore').read()
defined=set(re.findall(r"^\s{2,}([a-zA-Z0-9_]+)\s*:",i18,re.M))
missing={k:v for k,v in used.items() if k not in defined}
print("MISSING:",len(missing))
for k,v in sorted(missing.items()): print(f"  {k:32s} <- {', '.join(sorted(v))}")
EOF
```

**Acceptance (must be verified in a real browser, all 3 languages):**
- Script above prints `MISSING: 0`.
- Screenshot of the parameters panel showing translated labels where `TOP_STYLE` / `DOOR_STYLE` / `auto_by_type` appeared.
- No `[i18n] missing key` warning in console during a full click-through: generate a module → view cut list → open export panel → run onboarding wizard.
- `cd server && npm test` still matches the Phase 0 baseline.

---

## PHASE 2 — SITEMAP / ROUTE INTEGRITY (1 hour, stops active damage)

### 2.1 The sitemap lies
`client/public/sitemap.xml` declares **6** blog URLs. Only **3** routes exist in `client/src/main.jsx`. The other three fall through to `<Route path="*" element={<Navigate to="/" replace />} />` — they redirect to home. A sitemap where half the URLs are invalid degrades crawl trust for the whole domain.

Non-existent, currently advertised to Google:
- `/blog/software-marcenaria-lista-corte-automatica`
- `/blog/calculo-armario-embutido-mdf-18mm`
- `/blog/normas-chapa-mdf-brasil-2750x1840`

**Action:** remove those three `<url>` blocks from the sitemap. Do NOT delete the file, do NOT touch the homepage entry, do NOT touch the 3 valid entries. Keep the removed slugs in a comment block inside the sitemap as a content backlog marker.

### 2.2 Non-ASCII URL
`/blog/diseño-parametrico-muebles-cocina` contains `ñ`, which percent-encodes to `dise%C3%B1o-`, breaking canonical consistency and shared links.

**Action (additive):** add the ASCII route `/blog/diseno-parametrico-muebles-cocina` pointing at the same component. **Keep the old route registered** and redirect it to the new one. Update `sitemap.xml` to list only the ASCII URL. Nothing is deleted; the old path keeps working.

### 2.3 AI crawler directives
Append to `client/public/robots.txt` (append only — do not rewrite existing rules):
```
User-agent: GPTBot
Allow: /
Disallow: /app

User-agent: OAI-SearchBot
Allow: /
Disallow: /app

User-agent: PerplexityBot
Allow: /
Disallow: /app

User-agent: ClaudeBot
Allow: /
Disallow: /app
```

**Acceptance:** every `<loc>` in the sitemap resolves to a real route in `main.jsx` — verify by listing both sets side by side. Old `ñ` URL still loads (via redirect). `npm run build` succeeds.

---

## PHASE 3 — STATIC PRERENDER (highest leverage, moderate risk)

### 3.1 Problem
`client/index.html` ships `<div id="root"></div>`. All content is JS-injected. Fetching `https://orbin.app/` without executing JavaScript returns an empty document — which is exactly what GPTBot, PerplexityBot, and ClaudeBot see, since none of them execute JS. The SEO metadata already in `index.html` is well built, but it describes a page whose body arrives empty.

### 3.2 Action
Add build-time prerendering for **public routes only**: `/`, `/blog/*`, `/terms`, `/privacy`.
`/app`, `/login`, `/register`, `/verify` stay client-only — they are behind auth and `Disallow`ed in robots.txt anyway.

Prefer `vite-plugin-ssg` or `react-snap`. Constraints:
- `Viewer3D.jsx` uses Three.js and WebGL — it **must not** execute during prerender. It is already `lazy()`-loaded; keep it out of every prerendered route.
- Anything touching `localStorage`, `window`, or `document` at module scope will crash the prerender. Guard, do not delete.
- The existing SPA build must keep working identically. If prerender cannot be made to work cleanly in one focused attempt, **STOP and report** — do not half-migrate the app.

### 3.3 Explicit non-goal
Do **not** migrate to Next.js. It is weeks of work, it forces `dynamic({ssr:false})` surgery on the 3D viewer, and it pauses the product to solve a marketing problem. Rejected by design.

**Acceptance:**
```bash
cd client && npm run build
grep -c "Orbin" dist/index.html          # must be > 0 in rendered body, not just <head>
cat dist/blog/*/index.html | head -50    # real content, not an empty shell
```
Then run the app and confirm `/app` still loads, the 3D viewer still renders, and auth still works.

---

## PHASE 4 — PER-PAGE METADATA (depends on Phase 3)

### 4.1 Problem
No `react-helmet` and no `document.title` anywhere in the project — verified by grep across all of `client/src`. All 3 blog posts inherit the homepage `<title>` and `<meta description>`. Four distinct URLs, one identical title: they cannibalize each other in the SERP and none of them ranks.

### 4.2 Action
- Add `react-helmet-async` and wrap the router.
- Unique `<title>` (50-60 chars) and `<meta description>` (140-160 chars) per public route.
- Add `Article` schema per blog post: `headline`, `datePublished`, `dateModified`, `author`, `publisher` (reference the existing `#org` node), `inLanguage`.
- Add `BreadcrumbList` schema on blog posts.
- Move the `FAQPage` schema currently inside `LandingPage.jsx` so it is emitted in prerendered HTML.
- **Do not modify the existing JSON-LD block in `index.html`** — the `SoftwareApplication` + `Organization` + `WebSite` graph is correct and already static.

**Acceptance:** each prerendered `dist/**/index.html` contains a distinct `<title>`. Validate every JSON-LD block against Google Rich Results Test and paste the real result.

---

## PHASE 5 — i18n ROUTES (recommend deferring past launch)

### Recommendation: cut this from launch scope.

`CLAUDE.md` targets `/pt` `/es` `/en` route prefixes. Correct destination, wrong moment. Current `hreflang` points at `?lang=PT|ES|EN` query params that do not change the served HTML, so those annotations are inert — they neither help nor actively harm.

Reordering all public routes is the single largest source of regression risk in this plan, and it delivers nothing until there is content worth ranking in three languages. Ship first, then restructure once Phase 3 and 4 have produced measurable data.

**If it is executed anyway:** it requires locale-prefixed routes, real per-locale prerendered HTML, `hreflang` pointing at those paths, and 301s from every `?lang=` URL. All-or-nothing — partial delivery is worse than the current state.

---

## PHASE 6 — FINAL VERIFICATION

Run and paste real output for every item:

1. `cd server && npm test` — matches Phase 0 baseline.
2. `cd client && npm run build` — succeeds; report bundle delta vs baseline.
3. Browser click-through in PT, ES, and EN: landing → register → login → generate module → cut list → export → logout. Zero raw snake_case labels. Zero console errors.
4. Every sitemap `<loc>` resolves — verified, not assumed.
5. Prerendered HTML contains real body content for `/` and all 3 blog posts.
6. `/app` fully functional: 3D viewer renders, "+" appends a module, undo works.
7. Lighthouse on `/`: report actual SEO, Performance, and Accessibility scores.

**Final report format:**
- Phase-by-phase: `DONE` / `PARTIAL` / `NOT VERIFIED`, each with the command output that proves it.
- Every file touched, with a one-line rationale.
- Anything deliberately left undone, and why.
- No predictions presented as measurements.

---

## OUT OF SCOPE

- `server/src/engine/*` — untouchable.
- Deleting any file, including the empty `ORBIN_BACKUP_20260708_1957.zip` (0 bytes, tracked in git — flag it, let a human remove it).
- `AUDITORIA_SEO_ORBIN.md` — stale (dated 2026-05-31, describes an `index.html` that has since been fixed). Do not act on it. Do not delete it.
- Rewriting existing translations.
- Promo-code redemption logic — known open risk, separate work item.

---

## KNOWN OPEN RISK (do not fix here, just be aware)

`client/src/engine/PricingEngine.js:298` computes `moduleCount` as
`modules.filter(m => m && m.configuration).length`, not `modules.length`.
Today they agree because `handleGenerate` guarantees `configuration`. Any future path that inserts a module without it (import, AI vision, collaboration sync) would silently produce a lying counter. Out of scope for launch; documented so it is not rediscovered as a mystery bug.
