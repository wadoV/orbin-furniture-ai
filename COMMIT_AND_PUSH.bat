@echo off
echo ============================================
echo   ORBIN — Commit v4.0.0 CutList UX
echo ============================================
echo.
cd /d "%~dp0"

echo Eliminando lock de git si existe...
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo.
echo Agregando archivos al commit...
git add .gitignore
git add CLAUDE.md
git add ORBIN_STATUS_REPORT.md
git add PURGE_CLEANUP.bat
git add railway.json
git add client\vercel.json
git add client\vite.config.js
git add server\Procfile
git add server\.env.example
git add server\src\index.js
git add .cloud\agents\orbin_engine.md
git add client\src\
git add server\src\routes\stressTest.js
git add server\src\ai\systemPrompts.js
git add agentes\
git add ARRANCAR.bat
git add VERIFICAR_SUPABASE.bat
git add supabase_schema.sql
git add server\supabase\

echo.
echo Estado del commit:
git status --short

echo.
echo Haciendo commit...
git commit -m "feat(v4.0): CutList UX — seleccion sincronizada, delete por pieza, Ctrl+Z, boton ojo

- Fix: IDs de mesh en Viewer3D ahora determinísticos (design.id::type::name) para sincronizar con tabla
- Feat: CutListTable — click en fila resalta la pieza en el visor 3D correctamente
- Feat: CutListTable — botón ojo (Eye) por fila para ocultar/mostrar cortes individuales
- Feat: CutListTable — badge contador de piezas ocultas + botón 'mostrar todas'
- Feat: ResultPanel summary tab — selección también sincronizada con visor 3D via key determinística
- Keep: Delete pieza por pieza (botón X en hover) + Ctrl+Z para deshacer — ya funcional"

echo.
echo Pusheando a GitHub...
git push origin main

echo.
echo ============================================
echo   LISTO. Verifica en:
echo   https://github.com/wadoV/orbin-furniture-ai
echo ============================================
pause
