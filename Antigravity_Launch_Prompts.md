# Orbin AI — Antigravity Prompts (v2, ruta al lanzamiento)

> Reglas de oro:
> 1. **Un solo agente edita el cliente a la vez.** No corras Antigravity y otro agente sobre los mismos archivos (eso rompió el i18n y node_modules).
> 2. Ejecuta **un prompt a la vez**, en orden. Tras cada uno: `cd client && npm run build` debe quedar VERDE antes de seguir.
> 3. Trabaja en una rama por tarea (`feat/...`), prueba en preview, luego merge.
>
> Pega el **CONTEXT** al inicio de cada sesión; luego el prompt de la tarea.

---

## CONTEXT (pegar siempre)
```
You are a Principal Engineer on "Orbin AI" — a web app for parametric furniture design (closets/kitchens) for the Brazilian/Chilean woodworking market.
STACK: client = React 18 + Vite + Tailwind + Three.js (path client/src). server = Node/Express + Socket.IO (server/src). Auth/DB = Supabase. i18n = client/src/i18n.js (translations = { PT, ES, EN }). Language via client/src/context/PreferencesContext.jsx (usePreferences().t).
HARD RULES:
- Never reintroduce the removed "Vision IA" (photo→3D) feature.
- Never commit secrets; .env stays gitignored.
- Do NOT change the t() function or the Provider unless the task says so.
- After any change: `cd client && npm run build` MUST be clean. Don't finish with a broken build.
- Keep all user-facing text trilingual ES/PT/EN, with the three language blocks SYMMETRIC (same keys).
- Work on a feature branch; small commits.
```

---

# P0 — ESTABILIZAR (bloquean el soft launch; hacer primero, en este orden)

## Prompt 1 · Reparar i18n (claves crudas en la UI) — CRÍTICO
```
BUG: After a refactor, the app shows RAW i18n keys in the UI (e.g. "tab_parameters", "welcome_title", "EMPTY_VIEWER", "HDR_OFFLINE_BADGE", "PRESET_KITCHEN", "DESIGN_ASSISTANT", "NL_INPUT", "FURNITURE_PRESETS", "APP_SUBTITLE", "HDR_LOGOUT_SHORT", "title") instead of translated text, and the brand "Orbin AI" renders as "Orbin ALLÁ" (the literal "AI" got translated).

TASK
1. Scan EVERY t('KEY') / t("KEY") call across client/src/**/*.jsx (EXCLUDE: LandingPage.jsx — it has its own local `t` dict — and any jsPDF `doc.text(...)` calls, which are NOT i18n).
2. Build the complete set of keys actually used. For EACH key, ensure it exists in translations.PT, translations.ES AND translations.EN in client/src/i18n.js, with a REAL human translation (not the humanized fallback). The three language blocks must stay symmetric (identical key sets).
3. Add the new keys the refactor introduced (uppercase/new) with proper translations, e.g. EMPTY_VIEWER, EMPTY_VIEWER_HINT, HDR_OFFLINE_BADGE, HDR_LOGOUT_SHORT, DESIGN_ASSISTANT, NL_INPUT, TAB_PARAMETERS, FURNITURE_PRESETS, PRESET_KITCHEN, PRESET_WARDROBE, PRESET_BATHROOM, PRESET_OFFICE, PRESET_FLOATING_SHELF, welcome_title, app_subtitle — adapt to the actual keys you find.
4. The brand name is a PROPER NOUN: ensure "Orbin AI" is rendered literally and NEVER translated (fix the "Orbin ALLÁ" issue — likely a key holding "Orbin AI" that got translated, or the component splitting/translating "AI"). If a key holds the brand, set it to "Orbin AI" in all 3 languages.
5. Do a quick consistency check: write a tiny node script (or grep) that lists any t() key used in components but missing from any of the 3 language blocks. Result must be EMPTY.

ACCEPTANCE
- In ES, PT and EN, NO raw key, snake_case or UPPERCASE token appears anywhere in the landing or /app. Every label is properly translated.
- Header brand reads "Orbin AI" in all languages.
- `cd client && npm run build` is clean.

GUARDRAILS
- Do NOT modify PreferencesContext.jsx t()/Provider or main.jsx.
- Only edit i18n.js (and, if a component uses a wrong/typo key, fix the key reference in that component).
```

## Prompt 2 · OTP resiliente a la longitud del código
```
BUG: Supabase emails an 8-digit signup OTP, but VerifyOTPPage (client/src/components/AuthPages.jsx) renders only 6 input boxes, so verification fails ("token expired or invalid").

TASK
- Make OTP entry resilient to the configured length (6–8 digits), not hardcoded to 6. Preferred: replace the fixed 6 boxes with a single numeric input (inputMode="numeric", maxLength 8, paste-friendly); trim spaces; pass the full string to verifyCode(code). Keep the resend button, error message, theme, and the existing async `await verifyCode(...)`. Read the pending email from localStorage 'orbin-pending-email' / user.email.
- (Manual note for Eduardo, not code): Supabase → Authentication → Providers → Email → "Email OTP Length" can also be set to 6. Code must work regardless.

ACCEPTANCE
- Entering the exact code from the signup email (any length) verifies and routes to /app; resend delivers a fresh working code. `npm run build` clean.

GUARDRAILS: don't touch server/ or security middleware.
```

## Prompt 3 · Registrar 10 códigos promocionales Industrial
```
TASK: In client/src/context/UserContext.jsx, add these codes to the PROMO_CODES object (KEEP existing KIRA2080 and ORBIN_TEST_INDUSTRIAL_2026). Each value: { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado' }.
  ORBIN-TWX2-KGXU, ORBIN-GT3J-QURV, ORBIN-SYP9-TACN, ORBIN-TUTW-DN3D, ORBIN-NRDZ-BLDS,
  ORBIN-A49L-UPSZ, ORBIN-VH6W-6Y58, ORBIN-J59N-3FGS, ORBIN-B9MR-36AX, ORBIN-ZJR5-GBRD
Keys stored UPPERCASE exactly as above (applyPromoCode does code.trim().toUpperCase()).
ACCEPTANCE: applying any of the 10 codes in the register/account promo field sets user_metadata.plan='enterprise' and unlocks PDF/CSV/CNC/BOM. `npm run build` clean.
GUARDRAILS: do NOT commit PROMO_CODES_INDUSTRIAL.md (confidential list).
```

## Prompt 4 · Guard rails de release (CI build-gate + secret scan)
```
GOAL: Prevent broken builds and secret leaks from reaching production (both happened during development).
TASK
1. Add .github/workflows/ci.yml: on every push/PR, run `cd client && npm ci && npm run build` and `cd server && npm ci && node -e "require('./src/index.js')" ` (or a lint/syntax check). Fail the workflow if build fails.
2. Add gitleaks to the same workflow (secret scan) and a local pre-commit hook that blocks commits containing AIza…/eyJ…JWT/sk_… patterns.
3. Confirm .gitignore covers .env, *.env, *service-account*.json, *-key.json, *.pem.
ACCEPTANCE: a PR with a failing build is blocked; a commit with a fake "AIzaSyTEST…" is rejected by the hook.
```

---

# P1 — PRE-GA (cobro real y catálogos)

## Prompt 5 · Pagos reales (Stripe + Mercado Pago/Pix) + webhooks
```
GOAL: Replace the MOCK checkout in server/src/routes/billing.js with real payments + automatic plan upgrades. NOTE: the webhook is currently fail-closed (requires STRIPE_WEBHOOK_SECRET) — keep it secure.
TASK
1. Stripe Checkout for cards (server-side session; env STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, price IDs per plan free/pro/enterprise).
2. Mercado Pago (Pix + card) for Brazil (env MP_ACCESS_TOKEN); pick provider by region or query param.
3. Webhooks: VERIFY signatures; on success update Supabase user_metadata.plan via service_role (server-only). Reject unsigned/forged calls.
4. Wire the client flow (UpgradePrompt.jsx / PricingDisplay.jsx) to call the real endpoint; handle pending/success/failure.
ACCEPTANCE: a Stripe test payment upgrades to pro and unlocks features; a Mercado Pago sandbox Pix upgrades via webhook; forged webhook is rejected. Builds clean; service_role never reaches the client.
```

## Prompt 6 · Catálogos de fabricante (Arauco / Duratex / MASISA)
```
GOAL: Use real board catalogs so quotes reflect real materials/finishes (differentiator vs generic tools).
TASK
1. Create data-driven catalogs under client/src/data/catalogs/ (start with one: Arauco or Duratex): board name, finish/color, thickness options, sheet size, price hook.
2. Wire catalog selection into the material pickers (materials.js / InputPanel) and into PricingEngine so cost reflects the chosen board.
3. Map catalog colors to the 3D viewer MATERIAL_COLORS so the preview matches the finish.
ACCEPTANCE: user picks a real board+finish → 3D preview and quote update; adding a 2nd manufacturer needs only a new data file. Builds clean.
```

## Prompt 7 · Email de producción (SMTP propio)
```
GOAL: Move off Supabase built-in email (rate-limited) for reliable OTP at launch.
TASK
1. Document exact steps to configure a transactional provider (Resend or Amazon SES) in Supabase → Authentication → Emails → SMTP Settings (host, port 587, user, pass, sender). Verify sender domain (SPF/DKIM); list the DNS records.
2. Keep the "Confirm signup" template ({{ .Token }}). Send a real test signup; confirm the OTP arrives from the custom domain (inbox, not spam).
3. Write docs/EMAIL_SETUP.md.
ACCEPTANCE: OTP email delivered via custom SMTP/domain (not supabase.io).
```

---

## Orden sugerido
P0: 1 (i18n) → 2 (OTP) → 3 (promos) → 4 (CI/secret-scan) → **SOFT LAUNCH** → P1: 7 (SMTP) → 5 (pagos) → 6 (catálogos) → **GA**.

## Recordatorios del USUARIO (no son de Antigravity)
- Tras Prompt 1/2: `cd client && npm install` (Windows) si node_modules quedó incompleto, y hard-refresh del navegador.
- Deploy: Vercel (front) + Railway (server) con **NODE_ENV=production** y **CLIENT_URL=https://tu-dominio** (sin esto el CORS endurecido bloquea el front).
- Migraciones 005 (feedback ✅) y 006 (projects RLS ✅) ya corridas; `allow_all_mvp` ya eliminada.
