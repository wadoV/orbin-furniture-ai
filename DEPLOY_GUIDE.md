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
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxYnFkc213bnVsdmJ5c3F1a2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzkxNDUsImV4cCI6MjA5MzMxNTE0NX0.yU41qJZQZLJ6sa146fhxNN6Z2qhXfwDpbYUQvIYlVlU
SUPABASE_SERVICE_KEY=[LA CLAVE QUE COPIASTE EN EL PASO 1]

GEMINI_API_KEY=***REDACTED_API_KEY***
GEMINI_MODEL=gemini-2.0-flash

JWT_SECRET=99fab7976eaa26adfd18a631872893e0c871c28b6b6633d65f8b73a282633ff2da1d912595b7f1c5bd92071598b2b69e28a9c4574000eae73e3f63d3b14666b4
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
99fab7976eaa26adfd18a631872893e0c871c28b6b6633d65f8b73a282633ff2da1d912595b7f1c5bd92071598b2b69e28a9c4574000eae73e3f63d3b14666b4
```
**Úsalo solo en Railway.** No lo commits al repo.

---

## Archivos creados en esta sesión
```
Orbin/
├── railway.json          ← Config de deploy para Railway
├── server/Procfile       ← Start command para Railway  
├── client/vercel.json    ← SPA rewrites + cache headers
├── client/vite.config.js ← Code-splitting (three/react/socket)
├── COMMIT_AND_PUSH.bat   ← Script para hacer el commit
└── PURGE_CLEANUP.bat     ← Script para limpiar archivos basura
```
