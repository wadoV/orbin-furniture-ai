# Runbook — Deploy a Producción (Orbin AI)
Frontend en **Vercel** · Backend en **Railway** · DB/Auth en **Supabase** · Pagos con **Stripe**.
Basado en la config real del repo (`vercel.json`, `railway.json`, `server/Procfile`, `.env.example`).

---

## ⚠️ 0. Resolver ANTES de desplegar (traps reales del repo)

1. **Dos `vercel.json` en conflicto** — apuntan a backends distintos:
   - `/vercel.json` (raíz) → `https://orbin-furniture-ai-production.up.railway.app`
   - `/client/vercel.json` → `https://api.orbin.app` (+ `VITE_API_URL`)
   **Decisión:** usá `api.orbin.app` como URL canónica del backend. En Vercel poné **Root Directory = `client`** (así manda `client/vercel.json`) y borrá/ignorá el `/vercel.json` de la raíz. *(o al revés, pero UNA sola fuente.)*

2. **Dominio mezclado** — `index.html` tiene `canonical`/`hreflang`/OG en **`orbin.ai`**, pero `CLIENT_URL` por defecto es **`orbin.app`**. Elegí uno (recomiendo `orbin.app`) y unificá en `index.html` (canonical, hreflang, og:url, twitter, schema.org) y en las env vars.

3. **JWT_SECRET** — el server NO arranca sin él (≥32 chars). Generá uno real:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

---

## 1. Supabase (DB + Auth)

1. Proyecto Supabase creado. En **SQL Editor**, correr en orden las migraciones de `server/supabase/migrations/`:
   - `001_create_projects.sql`
   - `002_create_material_prices.sql`
   - `003_create_promo_redemptions.sql`
2. **Verificar RLS activo** en `public.projects`, `public.promo_redemptions`, `public.material_prices` (Table editor → RLS enabled).
3. Copiar llaves (Settings → API):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon/publishable) → va al **server Y al cliente**.
   - `SUPABASE_SERVICE_KEY` (service_role/secret) → **SOLO server**. Bypassa RLS: nunca al cliente ni a git.
4. Auth → URL Configuration: agregar `https://orbin.app` (y `https://www.orbin.app`) a **Site URL** y **Redirect URLs**. Si usás Google OAuth, cargar el mismo redirect.

---

## 2. Backend en Railway

- **Build:** NIXPACKS · **Start:** `node src/index.js` · **Healthcheck:** `/api/health` (ya en `railway.json`).
- **Root Directory** del servicio = `server`.
- **Custom domain:** `api.orbin.app` (Railway → Settings → Networking → Custom Domain).

**Variables de entorno (Railway → Variables):**
```
NODE_ENV=production
CLIENT_URL=https://orbin.app
SERVER_URL=https://api.orbin.app
JWT_SECRET=<64-hex generado>
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_KEY=<service_role>
GEMINI_API_KEY=<AIza...>
GEMINI_MODEL=gemini-2.0-flash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # se obtiene en el paso 4
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
ENABLE_MP_ONETIME=false
# MP_ACCESS_TOKEN=...  (opcional; MP está dormido)
```
> `PORT` lo inyecta Railway automáticamente (el server usa `process.env.PORT`).

Deploy y verificar: `GET https://api.orbin.app/api/health` → `{status:"ok"}`.

---

## 3. Frontend en Vercel

- **Root Directory = `client`** (clave, ver §0). Framework: Vite. Build: `npm run build`. Output: `dist`.
- **Custom domain:** `orbin.app` (+ `www` → redirect a apex).

**Variables de entorno (Vercel → Settings → Environment Variables):**
```
VITE_API_URL=https://api.orbin.app
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
```
> Con `VITE_API_URL` seteado, el cliente llama al backend **directo** (CORS ya permite `*.vercel.app` y podés añadir `orbin.app`). Si preferís proxy sin CORS, dejá `VITE_API_URL` vacío y confiá en el rewrite `/api → api.orbin.app` de `client/vercel.json`. **Elegí una, no ambas.**

Redeploy tras setear envs (las `VITE_*` se hornean en build-time).

---

## 4. Stripe (cobro global recurrente)

1. **Productos y Prices** (Dashboard → Product catalog): crear 2 productos con **Price recurrente mensual**:
   - Pro (ej. USD 19/mes) → copiar `price_...` a `STRIPE_PRICE_PRO`.
   - Enterprise (ej. USD 49/mes) → `STRIPE_PRICE_ENTERPRISE`.
2. **Webhook** (Developers → Webhooks → Add endpoint):
   - URL: `https://api.orbin.app/api/billing/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copiar el **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` en Railway → redeploy.
3. **Adaptive Pricing** (Settings → Payments) → activar: presenta moneda local por país sin tocar código.
4. **Customer Portal** (Settings → Billing → Customer portal) → activar (para cancelar/actualizar tarjeta; el server ya lo usa en `/api/billing/portal`).

---

## 5. DNS

En tu proveedor de dominio (`orbin.app`):
- `A`/`CNAME` apex `orbin.app` → Vercel.
- `CNAME www` → Vercel.
- `CNAME api` → el dominio que te da Railway.
- HTTPS lo emiten Vercel y Railway automáticamente.

---

## 6. Post-deploy (SEO + limpieza)

- Actualizar en `client/index.html`: `canonical`, `hreflang`, `og:url`, `twitter:*`, `schema.org` → dominio final (`orbin.app`).
- CORS: si el cliente llama directo a `api.orbin.app`, confirmá que `orbin.app` está permitido (agregar a `allowedOrigins` en `server/src/index.js` si tu dominio no matchea `*.vercel.app`).
- Plausible: `data-domain="orbin.app"` en `index.html` (ya está) — verificar que coincide con el dominio real.
- Borrar temporales `client/public/_master-*.svg`, `_r1024.png` (ya gitignorados).
- Guardar el endpoint dev de capturas: ya es `NODE_ENV !== 'production'` → no se monta en prod. ✓

---

## 7. Smoke test Go-Live (hacer en producción real)

- [ ] `api.orbin.app/api/health` responde `ok`.
- [ ] Registro + login (Supabase) funciona en `orbin.app`.
- [ ] Generar un mueble → lista de corte + 3D OK.
- [ ] Exportar DXF / SketchUp / CSV / Plano de Montaje.
- [ ] **Pago end-to-end**: primero en modo **Stripe test** (tarjeta `4242 4242 4242 4242`) → confirmar que el webhook sube el plan en `app_metadata`. Recién ahí pasar a **live**.
- [ ] Cancelar desde Customer Portal → el plan vuelve a `free`.
- [ ] Móvil gama baja: first-paint aceptable (visor 3D ya es lazy).

---

## 8. Rollback

- **Frontend:** Vercel → Deployments → deploy anterior → "Promote to Production" (instantáneo).
- **Backend:** Railway → Deployments → "Redeploy" del commit anterior.
- **DB:** las migraciones son aditivas; si una falla, revertir con un SQL inverso (no hay auto-rollback).

---

### Orden recomendado
Supabase (migraciones + keys) → Railway (backend + envs + health OK) → Stripe (prices + webhook) → Vercel (frontend + envs) → DNS → smoke test en test → activar Stripe live.
