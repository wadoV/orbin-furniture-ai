# Orbin AI — Deployment Checklist (Soft Launch)

Front: **Vercel** (client) · Server: **Railway** (Node/Express). Auth/DB: **Supabase**.
Marca cada ítem antes de abrir la beta.

---

## 0 · Fixes de seguridad de esta sesión (verificar que estén desplegados)
Aplicados en código (ya en el repo, validados con `node --check`):
- [x] **Auth bypass cerrado** — `middleware/auth.js`: el `DEV_USER` solo actúa fuera de producción; en prod sin Supabase = 503 / anónimo (fail-closed).
- [x] **Webhook de billing fail-closed** — `routes/billing.js`: rechaza si no hay `STRIPE_WEBHOOK_SECRET` + firma (evita upgrades de plan gratis).
- [x] **CORS endurecido** — `index.js`: comodines `*.vercel.app`/`*.railway.app`/ngrok solo fuera de prod; en prod solo `allowedOrigins` + `CLIENT_URL`.
- [ ] **RLS de projects** — correr `server/supabase/migrations/006_fix_projects_rls.sql` en Supabase (reemplaza el `allow_all_mvp`). ⚠️ pendiente tuyo.

Pendientes tuyos (consola / infra):
- [ ] Confirmar que las keys filtradas en el historial (`c779302`) están **revocadas** (Gemini vieja `…SFBA`, anon antigua). Las nuevas ya están en `.env`.
- [ ] (Opcional, ya no bloqueante) scrub del historial Git con BFG/git-filter-repo antes de hacer el repo público.
- [ ] `npm audit fix` en `client/` (3 advisories HIGH, react-router transitivo).

---

## 1 · Variables de entorno

### Vercel (client) — Build env
| Var | Valor |
|---|---|
| `VITE_SUPABASE_URL` | https://fqbqdsmwnulvbysqukam.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | (anon key NUEVA) |

> Solo la **anon key** va al cliente. NUNCA poner la service_role en variables `VITE_*`.

### Railway (server)
| Var | Valor / Nota |
|---|---|
| `NODE_ENV` | **production** (crítico: activa los fail-closed de auth/CORS) |
| `PORT` | el que asigne Railway (o 3003) |
| `SUPABASE_URL` | https://fqbqdsmwnulvbysqukam.supabase.co |
| `SUPABASE_ANON_KEY` | anon key NUEVA (usada por auth.getUser) |
| `SUPABASE_SERVICE_KEY` | service_role NUEVA (solo server; ignora RLS) |
| `JWT_SECRET` | 64+ hex (el guard del server aborta si <32 o placeholder) |
| `CLIENT_URL` | **https://TU-DOMINIO** (Vercel o dominio propio) — sin esto, CORS bloquea el front en prod |
| `GEMINI_API_KEY` | Gemini NUEVA |
| `GEMINI_MODEL` | gemini-2.5-flash (o el que uses) |
| `STRIPE_WEBHOOK_SECRET` | requerido para que `/billing/webhook` funcione (hasta entonces, fail-closed) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⚠️ NO uses ruta de Windows en Railway. Sube el JSON como secret o usa base64 → archivo en runtime. Si no lo configuras, el orquestador cae a Gemini/Ollama (OK). |
| `GCP_PROJECT_ID`, `GCP_LOCATION` | solo si usas Vertex |

**Limpieza recomendada** (auditoría): elimina del `.env` las vars duplicadas/confusas `SERVICE_ROLE` (¡tenía la anon key!), `SECRET_API_KEY`, `SUPABASE_API_KEY`, `ANON_PUBLIC`. Deja solo `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_KEY`.

---

## 2 · Pre-deploy
- [ ] Supabase: correr migraciones pendientes en SQL Editor → `005_create_beta_feedback.sql` (hecho ✓) y `006_fix_projects_rls.sql`.
- [ ] Supabase Auth: **Confirm email = ON** (hecho ✓) y template *Confirm signup* con `{{ .Token }}` (hecho ✓).
- [ ] `cd client && npm run build` → limpio.
- [ ] `node --check` de los archivos del server editados → OK (hecho ✓).
- [ ] Commit de los cambios (auth/CORS/billing/migraciones) y push.

---

## 3 · Deploy
- [ ] **Railway**: deploy del `server/`; setear todas las env vars de arriba; confirmar arranque sin error del guard de `JWT_SECRET`.
- [ ] **Vercel**: deploy del `client/`; setear `VITE_*`; build command `vite build`.
- [ ] Apuntar el front al server (URL del API) y `CLIENT_URL` del server al dominio del front.

---

## 4 · Verificación post-deploy (humo en PRODUCCIÓN)
- [ ] **Health**: `GET https://<server>/api/health` → 200.
- [ ] **OTP real (crítico)**: registrarse con un correo real → llega **código de 6 dígitos** → `/verify` → entra a `/app`. (Prueba el corazón del soft launch.)
- [ ] **Sesión**: recargar `/app` → sigue logueado; logout → `/app` redirige a login.
- [ ] **API autenticada**: crear y guardar un proyecto → se persiste; con otra cuenta NO se ve (RLS owner-scoped funcionando).
- [ ] **CORS**: el front en prod carga y llama al API sin error CORS (gracias a `CLIENT_URL`).
- [ ] **Feedback**: enviar feedback desde `/app` → aparece fila en `beta_feedback` (Supabase Table Editor).
- [ ] **Límites de plan**: cuenta Free topa en 3 módulos; export bloqueado en Free.
- [ ] **Webhook billing**: `POST /api/billing/webhook` sin firma → 401/503 (ya NO permite upgrades gratis).
- [ ] **Consola del navegador** sin errores en el flujo principal, en ES/PT/EN.

---

## 5 · Listo para invitar beta
- [ ] QA checklist (`docs/QA_CHECKLIST.md`) recorrido en los 3 idiomas y móvil.
- [ ] Invitar a 3–5 marceneros; monitorear `beta_feedback` y logs de Railway.

> Nota: SMTP propio (Supabase usa email service con rate limit) y pagos reales (Stripe/Mercado Pago) son los siguientes hitos hacia el GA — ver `Antigravity_Launch_Prompts.md`.
