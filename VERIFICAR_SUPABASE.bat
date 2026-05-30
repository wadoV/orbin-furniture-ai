@echo off
cd /d "%~dp0"
echo.
echo ============================================================
echo   Orbin AI — Verificacao Supabase
echo ============================================================
node verify_supabase.js > verify_result.txt 2>&1
type verify_result.txt
echo.
echo Resultado salvo em: verify_result.txt
pause
