@echo off
echo ============================================
echo   ORBIN — Token Purge Cleanup Script v2
echo ============================================
echo.

cd /d "%~dp0"

echo [1/7] Eliminando BRAIN_TRAINER_REPORT JSONs...
del /f /q "BRAIN_TRAINER_REPORT_*.json" 2>nul
echo     OK

echo [2/7] Eliminando Vite timestamp artifacts (22 archivos)...
del /f /q "client\vite.config.js.timestamp-*.mjs" 2>nul
echo     OK

echo [3/7] Eliminando archivos _utf8 duplicados...
del /f /q "v1_engine_utf8.js" 2>nul
del /f /q "v1_input_utf8.jsx" 2>nul
del /f /q "v1_viewer_utf8.jsx" 2>nul
echo     OK

echo [4/7] Eliminando test files de Ollama...
del /f /q "server\src\ai\test_ollama.js" 2>nul
del /f /q "server\src\ai\test_ollama_fetch.js" 2>nul
echo     OK

echo [5/7] Eliminando scratchpads y logs...
del /f /q "client\src\components\combined.txt" 2>nul
del /f /q "verify_result.txt" 2>nul
del /f /q "QA_STRESS_TEST_REPORT.md" 2>nul
echo     OK

echo [6/7] Eliminando scripts de git temporales...
del /f /q "git-commit-v26.bat" 2>nul
del /f /q "git-push-v29.bat" 2>nul
echo     OK

echo [7/7] Eliminando ZIP de Supabase (usar migraciones SQL en su lugar)...
del /f /q "supabase-file.zip" 2>nul
echo     OK

echo.
echo ============================================
echo   Archivos restantes en raiz del proyecto:
dir /b /a-d *.* 2>nul
echo.
echo   Ejecuta: git status
echo   Luego:   git add -A ^&^& git commit -m "chore: purge legacy artifacts"
echo ============================================
pause
