# Orbin AI — Plan para subir la puntuación (72 → 85+)

> Estado base: 72/100. Cliente y servidor compilan. Ordenado por **impacto en la nota**.
> Ejecuta en LOCAL (Windows) + git + `npm run build` verde. Un agente a la vez, un prompt por vez.
> Quick wins ya hechos esta sesión: recuperación de 13 archivos corruptos, `.env.example` de pagos, CI verificado.

---

## BLOQUE A — Lo que MÁS sube la nota (madurez + monetización) · hacer primero

### A1 · Desplegar y validar en producción  → madurez 5.5→8 (+6 pts)
El código ya no bloquea; lo que falta es que esté VIVO y probado en limpio.
```
On the LOCAL Windows repo (NOT a synced mount):
1. git pull / sync the recovered code. `cd client && npm install && npm run build` → must be CLEAN.
2. `cd server && npm install`.
3. Deploy: Vercel (client, set VITE_SUPABASE_URL/ANON_KEY) + Railway (server, set NODE_ENV=production, CLIENT_URL=<prod front domain>, SUPABASE_* , JWT_SECRET, GEMINI_API_KEY).
4. Smoke test in PRODUCTION (docs/QA_CHECKLIST.md §1): signup→OTP→login → generate a wardrobe → export PDF. Confirm no console errors in ES/PT/EN.
Acceptance: app reachable on prod URL, OTP works live, core flow works, CORS OK.
```

### A2 · Completar el webhook de pagos (falta el handler)  → GTM 6→8.5 + seguridad (+3 pts)
Antigravity hizo el checkout (Stripe + Mercado Pago) pero NO existe el handler que recibe el pago y sube el plan.
```
In server/src/routes/billing.js add the missing POST /webhook handler:
1. Stripe: read the RAW body (express.raw for this route), verify signature with stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET). On checkout.session.completed / customer.subscription.updated → update Supabase user_metadata.plan via service_role using metadata.userId + metadata.plan. On subscription.deleted → set plan 'free'. Reject unsigned/forged.
2. Mercado Pago: handle the notification (verify via MP API lookup of the payment id) and upgrade the plan similarly.
3. Never expose service_role to the client; this is server-only.
Acceptance: a Stripe test payment upgrades the user to pro (features unlock); an MP sandbox Pix upgrades via webhook; a forged POST is rejected (401/400). Build clean.
```

### A3 · Confirmar CI como guard real  → proceso 5→7.5 (+2 pts)
```
Push to a feature branch, open a PR, and confirm the CI workflow (.github/workflows/ci.yml) runs: client build + server check + gitleaks. Enable branch protection on `main` (require CI to pass before merge) in GitHub repo settings. Squash/remove the test commits "test: commit a secret" before/while doing this.
Acceptance: a PR with a broken build is blocked from merging; main is protected.
```

---

## BLOQUE B — Producto y diferenciación · siguiente

### B1 · Catálogos de fabricante (Arauco / Duratex)  → producto + ticket (+2 pts)
```
Create data-driven catalogs in client/src/data/catalogs/ (start with Arauco or Duratex): board, finish/color, thickness, sheet size, price hook. Wire into the material pickers + PricingEngine so cost reflects the chosen board; map catalog colors to Viewer3D MATERIAL_COLORS. Acceptance: user picks a real board+finish, 3D + quote update; adding a 2nd manufacturer needs only a new data file.
```

### B2 · SMTP propio para email de producción  → entregabilidad OTP (+1 pt)
```
Configure Resend or Amazon SES in Supabase → Authentication → Emails → SMTP Settings (host, 587, user, pass, sender). Verify sender domain (SPF/DKIM); document DNS in docs/EMAIL_SETUP.md. Keep the "Confirm signup" template ({{ .Token }}). Send a real test signup; OTP must arrive from the custom domain (inbox, not spam).
```

### B3 · Screenshot REAL del visor 3D para la landing  → conversión (+1 pt)
```
With the app deployed/running, log in, generate the "armario 2.40m, 3 puertas, 3 cajones, Roble" example, take a high-res screenshot of the 3D viewer, save to client/public/orbin_viewer_real.png, and point the LandingPage "IA por Texto" feature <img> to it (replacing the coded mockup). Acceptance: feature shows a real Orbin production screenshot.
```

---

## BLOQUE C — Robustez y calidad · consolidar

### C1 · Tests automatizados del motor  → madurez (+2 pts)
```
Add a test runner (vitest) with unit tests for server/src/engine: closetEngine.generateProject (wardrobe, kitchen, auto-split >2700mm, drawer-only fill) and validator (VALIDADO/RECHAZADO cases). Wire `npm test` into CI. Acceptance: tests pass and run in CI.
```

### C2 · Actualizar dependencias vulnerables  → seguridad (+1 pt)
```
On the local Windows repo: `cd client && npm audit fix` (no --force first; resolve the react-router HIGH advisory). Re-run npm run build to confirm green. Review server `npm audit`. Acceptance: high/critical advisories resolved without breaking the build.
```

### C3 · Limpieza de historial Git + claves  → seguridad (+1 pt)
```
Confirm the old leaked keys (Gemini/anon in commit c779302) are revoked in their consoles. Optionally scrub history with git filter-repo/BFG before making the repo public. Remove the "test: commit a secret" commits.
```

### C4 · Observabilidad básica  → operación (+1 pt)
```
Add error logging (e.g., a lightweight error boundary report + Railway logs review) and monitor the beta_feedback table. Define what "good" looks like (no console errors, OTP success rate, etc.).
```

---

## Proyección de nota
- Hoy: **72/100**.
- Tras BLOQUE A (deploy + webhook + CI): **~82/100** → soft launch sólido + monetización funcional.
- Tras BLOQUE B: **~85-87/100** → GA-ready.
- Tras BLOQUE C: **~88-90/100** → producto robusto y mantenible.

**Regla de oro:** local + git + build verde, un agente a la vez. Eso solo evita repetir la corrupción de hoy y mantiene la nota subiendo sin retrocesos.
