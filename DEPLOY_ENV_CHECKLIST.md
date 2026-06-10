# Orbin AI — Deploy Environment Variables Checklist

Last updated: 2026-06-04

---

## 🚂 Railway (Backend — api.orbin.app)

Set these in Railway Dashboard → Service → Variables.

| Variable | Required | Security | Where to get it | Notes |
|---|---|---|---|---|
| `NODE_ENV` | ✅ Required | Public | Set manually | Value: `production` |
| `PORT` | ✅ Required | Public | **Injected by Railway automatically** | Do NOT set manually — Railway manages this |
| `JWT_SECRET` | ✅ Required | 🔴 Secret | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Min 64-char hex. Server refuses to start without it. |
| `SUPABASE_URL` | ✅ Required | Public | Supabase Dashboard → Settings → General | Format: `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ Required | Public* | Supabase → Settings → API Keys → Legacy → anon | *Safe to expose in server context |
| `SUPABASE_SERVICE_KEY` | ✅ Required | 🔴 Secret | Supabase → Settings → API Keys → Legacy → service_role → Reveal | Bypasses RLS — never expose to client |
| `GEMINI_API_KEY` | ✅ Required | 🔴 Secret | [Google AI Studio](https://aistudio.google.com/apikey) | Falls back to regex parser if missing |
| `GEMINI_MODEL` | ⚪ Optional | Public | Set manually | Default: `gemini-2.5-flash` |
| `CLIENT_URL` | ✅ Required | Public | Set manually | Value: `https://orbin.app` (no trailing slash) |
| `CLAUDE_API_KEY` | ⚪ Optional | 🔴 Secret | Anthropic Console | Optional fallback AI engine API Key |
| `DEEPSEEK_API_KEY`| ⚪ Optional | 🔴 Secret | DeepSeek Developer Platform | Optional fallback AI engine API Key |
| `GOOGLE_API_KEY`  | ⚪ Optional | 🔴 Secret | Google Cloud Console | Optional fallback AI engine API Key |
| `OLLAMA_BASE_URL` | ⚪ Optional | Public | Set manually | Only needed if running Ollama on Railway (not recommended) |
| `OLLAMA_MODEL` | ⚪ Optional | Public | Set manually | Default: `deepseek-r1:7b` |

> **Railway tip:** Go to Service → Variables → Add Variable. Never commit these to git.

---

## ▲ Vercel (Frontend — orbin.app)

Set these in Vercel Dashboard → Project → Settings → Environment Variables.

| Variable | Required | Security | Where to get it | Notes |
|---|---|---|---|---|
| `VITE_API_URL` | ✅ Required | Public | Set manually | Value: `https://api.orbin.app` (no trailing slash) |
| `VITE_SUPABASE_URL` | ✅ Required | Public | Supabase → Settings → General | Same as Railway `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | ✅ Required | Public | Supabase → Settings → API Keys → Legacy → anon | This is the only key safe for the browser |

> ⚠️ **Never** add `SUPABASE_SERVICE_KEY` or `JWT_SECRET` to Vercel/frontend variables.
> All `VITE_*` variables are bundled into the JS output and visible to any user.

---

## ✅ Pre-deploy Verification

Run through this checklist before every production deploy:

- [ ] `JWT_SECRET` is set in Railway and is ≥32 chars (not the placeholder)
- [ ] `SUPABASE_SERVICE_KEY` ≠ `SUPABASE_ANON_KEY` in Railway variables
- [ ] `CLIENT_URL` matches the actual Vercel domain (no trailing slash)
- [ ] `VITE_API_URL` matches the actual Railway domain
- [ ] Railway healthcheck passing: `curl https://api.orbin.app/api/health`
- [ ] Supabase RLS enabled on `projects` table
- [ ] `NODE_ENV=production` set in Railway (stress-test route must be disabled)

---

## 🔒 Security Classification Reference

| Level | Meaning |
|---|---|
| 🔴 Secret | Never expose — not in git, not in client, not in logs |
| Public | Safe to expose in source code or client bundles |
| Public* | Safe for server-side use but avoid exposing in client |
