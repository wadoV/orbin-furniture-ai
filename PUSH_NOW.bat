@echo off
echo =============================================
echo   ORBIN v3.1 — Commit All + Push to GitHub
echo =============================================
cd /d "%~dp0"

echo Eliminando lock si existe...
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo Agregando todos los cambios...
git add -A

echo.
echo Estado:
git status --short

echo.
echo Haciendo commit...
git commit -m "feat(v3.1): Cut list interactive + piece delete + Ctrl+Z + Gemini 2.5 Flash + Supabase fix

FEATURES:
- feat(CutListTable): rows clickable — click piece highlights it in 3D viewer
- feat(ResultPanel): summary tab rows clickable + delete per piece (X button)
- feat(App): handleDeletePiece — removes piece from module, saves to history
- feat: Ctrl+Z (undo) works for piece deletion — restores piece instantly

BUGFIXES:
- fix(App): finally{setLoading(false)} — GENERATING spinner no longer gets stuck
- fix(.env): SUPABASE_SERVICE_KEY fixed (placeholder removed), Supabase 100% operational
- fix(.env): GEMINI_API_KEY new AQ. format key (proyecto Orbin), model gemini-2.5-flash
- fix(README): accurate tech stack, Quick Start table, env vars documentation

VERIFIED:
- Gemini 2.5 Flash: ES/PT/EN trilingual, Tier 1 confidence 1.0
- Supabase CRUD: SELECT/INSERT/GET/DELETE all working
- PricingEngine: real-time quotes ($1111 sample)
- 3D Canvas: active with piece highlight
- Ctrl+Z: 18->17->18 pieces verified"

echo.
echo Pusheando...
git push origin main

echo.
echo =============================================
echo   Verificar en: https://github.com/wadoV/orbin-furniture-ai
echo =============================================
exit
