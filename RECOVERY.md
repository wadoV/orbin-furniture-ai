# RECOVERY — Cómo recuperar Orbin AI si pierdo acceso

Guía de recuperación de acceso y **datos de clientes**. No contiene contraseñas ni
llaves (esas van en tu gestor de contraseñas). Guardá una copia de este archivo
**fuera del repo** también: mandátelo a tu correo personal y/o Google Drive.

> Regla de oro: **nunca** un "backdoor" en la app. La recuperación vive en las
> plataformas (con 2FA) + los **backups cifrados** que vos controlás.

---

## 0) Configuración que debés dejar hecha UNA vez (blindaje)

Activá **2FA (verificación en 2 pasos) + guardá los códigos de respaldo** en tu
gestor de contraseñas para CADA cuenta:

- [ ] **Google** (login de la app) — myaccount.google.com → Seguridad → Verificación en 2 pasos + email/teléfono de recuperación + **códigos de respaldo**.
- [ ] **GitHub** (código) — Settings → Password and authentication → 2FA + recovery codes.
- [ ] **Supabase** (datos) — Account → Security → 2FA. Agregá un **segundo Owner** a la organización (otro email tuyo) como respaldo.
- [ ] **Vercel** (web) — Settings → Authentication → 2FA.
- [ ] **Railway** (backend) — Account → 2FA.
- [ ] **Stripe** (pagos) — Settings → Team & Security → 2FA + guardá tu clave de recuperación.

**Segunda cuenta admin de la app (break-glass):** creá un usuario extra con OTRO
email tuyo y dale rol admin desde Supabase (Auth → Users → tu usuario →
`app_metadata` → agregar `"role":"admin"`). Si perdés el login principal de
Google, entrás con este.

**Gestor de contraseñas:** guardá ahí TODO lo sensible: contraseñas, códigos de
respaldo de 2FA, `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`, llaves de Stripe/Supabase.
Si te acordás de UNA sola contraseña maestra, recuperás todo lo demás.

---

## 1) Backups de la base de datos (los datos de clientes)

- Automático: el workflow `.github/workflows/backup-db.yml` corre **semanal** y sube
  un backup **cifrado AES-256** como *artifact* del run (GitHub → pestaña Actions).
- Requiere 2 secrets (GitHub → Settings → Secrets → Actions):
  - `SUPABASE_DB_URL` → Supabase → Settings → Database → Connection string (URI, puerto 5432).
  - `BACKUP_PASSPHRASE` → una frase larga tuya (guardala en el gestor; **sin ella el backup no sirve**).
- Recomendado además: en **Supabase Pro** activá los **backups diarios automáticos + PITR** (Settings → Database → Backups). Es el respaldo más cómodo.

### Restaurar un backup (si perdés la DB)
1. GitHub → Actions → run de "Orbin DB Backup" → descargá el artifact `.sql.gz.gpg`.
2. Descifrar y descomprimir (en tu compu, con la passphrase):
   ```
   gpg --decrypt --passphrase "TU_PASSPHRASE" orbin-backup-XXXX.sql.gz.gpg > orbin.sql.gz
   gunzip orbin.sql.gz
   ```
3. Creá un proyecto Supabase nuevo, copiá su Connection string y cargá los datos:
   ```
   psql "postgresql://postgres:...@db.NUEVO.supabase.co:5432/postgres" < orbin.sql
   ```
4. Actualizá `SUPABASE_URL` y las llaves en Railway (backend) y en Vercel (`VITE_*`).

---

## 2) Escenarios "perdí acceso a X"

**Perdí mi cuenta de Google (login de la app):**
1. Recuperá Google en g.co/recover (por eso necesitás 2FA + email/teléfono de recuperación configurados).
2. Mientras tanto, entrás a la app con tu **segunda cuenta admin** (§0).
3. Tus datos de cliente están intactos en Supabase (no dependen de tu Google).

**Perdí Supabase (o se cae el proyecto):**
- Restaurá desde el backup cifrado (§1) a un proyecto nuevo. Repuntá backend y web.

**Perdí GitHub:**
- Recuperá con los códigos de respaldo de 2FA. El código también lo tenés clonado
  localmente en tu compu (`git`), así que nunca lo perdés del todo.

**Perdí Vercel / Railway:**
- Son solo el "motor de hosting": recreás la cuenta, reconectás el repo de GitHub y
  recargás las env vars (ver `docs/runbook-deploy-produccion.md`). Los datos no están ahí.

**Perdí Stripe:**
- Recuperá con 2FA/clave de recuperación. Contactá soporte de Stripe con tu identidad;
  ellos protegen el historial de pagos.

---

## 3) Inventario (completá con TUS datos, sin contraseñas)

| Pieza | Cuenta (email) | 2FA activo | Dónde están los códigos |
|-------|----------------|-----------|-------------------------|
| Google (login) |  | ☐ | gestor de contraseñas |
| GitHub (código) |  | ☐ | gestor |
| Supabase (datos) |  | ☐ | gestor |
| Vercel (web) |  | ☐ | gestor |
| Railway (backend) |  | ☐ | gestor |
| Stripe (pagos) |  | ☐ | gestor |

**Contacto de emergencia / dueño:** ejvm280890@gmail.com

> Revisá este documento cada 3 meses y después de cualquier cambio de infraestructura.
