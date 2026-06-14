# ORBIN — Deploy Guide: De Local a Live en 20 minutos
**Fecha:** 2026-05-29 | Resultado: Backend en Railway + Frontend en Vercel + Dominio

---

## PASO 0 — Antes de empezar (2 min)

### 0a. Cerrar GitHub Desktop
GitHub Desktop tiene un lock en el git index. Ciérralo.

### 0b. Ejecutar el commit
Doble-click en `COMMIT_AND_PUSH.bat` en la carpeta Orbin.

---

## PASO 1 — Obtener la Service Role Key de Supabase (2 min)

Estás en: `supabase.com/dashboard/project/fqbqdsmwnulvbysqukam/settings/api-keys`

1. Scroll hacia abajo hasta **Secret keys**
2. Haz click en **Reveal** junto a `service_role`
3. Copia esa clave — la necesitas en el Paso 2

---

## PASO 2 — Deploy Backend en Railway (8 min)

### 2a. Crear proyecto en Railway
1. Ve a: **https://railway.app/new**
2. Click **"Deploy from GitHub repo"**
3. Conecta GitHub si no está conectado → busca `wadoV/orbin-furniture-ai`
4. Click en el repo

### 2b. Configurar el directorio raíz
Cuando Railway detecte el repo:
- **Root Directory:** `/server`
- **Start Command:** `node src/index.js` (Railway lo lee del Procfile automáticamente)

### 2c. Variables de entorno (CRÍTICO)
Click en **Variables** → agrega estas una por una:

```
NODE_ENV=production
PORT=3003
CLIENT_URL=https://orbin-frontend.vercel.app

SUPABASE_URL=https://fqbqdsmwnulvbysqukam.supabase.co
SUPABASE_ANON_KEY=<TU_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_KEY=[LA CLAVE QUE COPIASTE EN EL PASO 1]

GEMINI_API_KEY=<TU_GEMINI_API_KEY>
GEMINI_MODEL=gemini-2.0-flash

JWT_SECRET=<GENERA_UNO_NUEVO: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
# IMPORTANTE: nunca pegar el secreto real en este archivo (es versionado).
# El valor real va SOLO en las Variables de entorno de Railway/Vercel.
```

### 2d. Deploy
Click **Deploy** → espera 2-3 minutos.

Cuando aparezca ✅ **Active**, copia la URL del backend (formato: `https://xxxx.railway.app`)

---

## PASO 3 — Deploy Frontend en Vercel (5 min)

### 3a. Crear proyecto en Vercel
1. Ve a: **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Busca `wadoV/orbin-furniture-ai` → click **Import**

### 3b. Configurar el proyecto
- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### 3c. Variable de entorno
Click **"Environment Variables"** → agrega:
```
VITE_API_URL = https://[TU-URL-DE-RAILWAY.railway.app]/api
```
(Reemplaza con la URL que copiaste en el Paso 2d)

### 3d. Deploy
Click **"Deploy"** → espera 2-3 minutos.

Cuando aparezca ✅, copia la URL de Vercel (ej: `https://orbin-furniture-ai.vercel.app`)

---

## PASO 4 — Verificación final (2 min)

### 4a. Test del backend
Abre en el browser:
```
https://[TU-URL-RAILWAY.railway.app]/api/health
```
Debe devolver: `{"status":"ok","version":"3.0.0",...}`

### 4b. Test del frontend
Abre la URL de Vercel. Debe cargar Orbin.

### 4c. Actualizar CORS en Railway
Si el frontend funciona con otra URL (no `orbin-frontend.vercel.app`), actualiza en Railway:
```
CLIENT_URL = https://[TU-URL-VERCEL-REAL.vercel.app]
```

---

## PASO 5 — Dominio orbin.app (opcional, post-deploy)

### Verificar disponibilidad
- https://www.namecheap.com/domains/registration/results/?domain=orbin.app
- https://domains.google.com/registrar/search?searchTerm=orbin.app

### Si está disponible (~$20/año)
1. Comprar en Namecheap o Google Domains
2. En Vercel: Settings → Domains → Add `orbin.app`
3. Vercel te da los DNS records → copiarlos al registrar
4. En Railway: actualizar `CLIENT_URL=https://orbin.app`

---

## JWT Secret generado para producción
```
<JWT_SECRET_REAL_VA_SOLO_EN_RAILWAY_ENV_VARS>
```
**Úsalo solo en Railway.** No lo commits al repo.

---

## Archivos creados en esta sesión
```
Orbin/
├── railway.json          ← Config de deploy para Railway
├── server/Procfile       ← Start command para Railway  
├── server/Dockerfile     ← Dockerfile de producción para el backend Express
├── client/vercel.json    ← SPA rewrites + cache headers
├── client/vite.config.js ← Code-splitting (three/react/socket)
├── COMMIT_AND_PUSH.bat   ← Script para hacer el commit
└── PURGE_CLEANUP.bat     ← Script para limpiar archivos basura
```

---

## PASO 6 — Configuración de Google OAuth 2.0 en Producción (3 min)

### 6a. Google Cloud Console
1. Ve a: **https://console.cloud.google.com/**
2. Selecciona tu proyecto y ve a **APIs & Services** > **Credentials**.
3. Edita la credencial del cliente de la aplicación web de Google OAuth 2.0.
4. En **Authorized redirect URIs**, agrega el callback oficial de producción de Supabase:
   `https://fqbqdsmwnulvbysqukam.supabase.co/auth/v1/callback`

### 6b. Supabase Dashboard
1. Ve a: **https://supabase.com/dashboard/project/fqbqdsmwnulvbysqukam/auth/url-configuration**
2. Establece el **Site URL** al dominio de producción del frontend:
   `https://orbin.app` (o tu dominio de Vercel).
3. En **Redirect URLs**, agrega la expresión wildcard para permitir el retorno al frontend:
   `https://orbin.app/**` (o tu subdominio de Vercel).

---

## PASO 7 — Migraciones de Base de Datos en Producción (3 min)

Para aplicar las tablas de perfiles, triggers de registro y telemetría a la base de datos de producción:
1. En el dashboard de Supabase, ve a **SQL Editor** > **New Query**.
2. Copia y ejecuta en orden las consultas de los archivos:
   - [[003_create_profiles.sql](file:///C:/Users/Azomarg/Documents/Claude_projects/Orbin/server/supabase/migrations/003_create_profiles.sql)]
   - [[004_create_telemetry_logs.sql](file:///C:/Users/Azomarg/Documents/Claude_projects/Orbin/server/supabase/migrations/004_create_telemetry_logs.sql)]