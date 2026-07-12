# Seguridad — Orbin AI

Blindaje contra ataques y protección de datos de clientes. Estado y controles.

## Modelo de acceso — "solo el owner publica versiones"
- `main` es la única rama de despliegue. Configurar en **GitHub → Settings → Branches → Branch protection (`main`)**:
  - ✅ Require a pull request before merging
  - ✅ Require review from **Code Owners** (ver `.github/CODEOWNERS` → `@wadoV`)
  - ✅ Require status checks: **Orbin Integrity (Blindaje)** debe pasar
  - ✅ Do not allow bypassing the above settings
  - ✅ Restrict who can push to `main` → solo `@wadoV`
- CI (`.github/workflows/integrity.yml`) corre en cada push/PR: verificación de integridad + tests del motor + build del cliente. Nada mergea sin verde.
- Deploy: Vercel/Railway configurados para desplegar **solo desde `main`** (Production Branch = main).

## Autenticación y autorización
- Auth real con **Supabase**. El **plan** vive en `app_metadata` (solo escribible por `service_role` server-side) — el cliente nunca puede auto-otorgarse un plan.
- Proyectos: acceso 100% server-side vía `service_role`, con ownership forzado (`owner_id = req.user.id`). **RLS activo** en todas las tablas; `projects` sin policies públicas (migración 004 removió `allow_all_mvp`).

## Superficie de red
- **CORS estricto en producción**: sin comodines de túneles/previews (`*.ngrok`, `*.loca.lt`, `*.vercel`, `*.railway`) — solo el allowlist explícito (`orbin.app` vía `CLIENT_URL`). Los comodines solo se habilitan fuera de producción.
- **Rate limiting**: global 200 req/15min + 15 generaciones IA/min por IP.
- **Headers**: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- **CSP**: frontend (Vercel) con `script-src 'self' + plausible` (sin inline), `object-src 'none'`, `frame-ancestors 'none'`; API con `default-src 'none'`.
- Body limit 5 MB. Webhooks de Stripe con **firma verificada**. Secretos nunca en el bundle ni en git (pre-commit scanner).

## Verificación pendiente (antes de producción)
- Desplegar un **Vercel Preview** y revisar la consola por violaciones de CSP; si un recurso legítimo se bloquea, agregar su origen a la directiva correspondiente.
- Confirmar branch protection activo en GitHub.

## Reporte de vulnerabilidades
Contacto: ejvm280890@gmail.com — no abrir issues públicos para temas de seguridad.
