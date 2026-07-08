@echo off
chcp 65001 > nul
echo ============================================================
echo  ORBIN AI — Deploy Script (ejecutar como usuario normal)
echo ============================================================
echo.

cd /d "%~dp0"
echo [1/4] git push origin main...
git push origin main
if %errorlevel% neq 0 (
    echo ERROR: git push fallou. Revisa tus credenciales GitHub.
    pause
    exit /b 1
)
echo OK: push completado.
echo.

echo [2/4] npm install en client/...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install fallou.
    pause
    exit /b 1
)
echo OK: dependencias instaladas.
echo.

echo [3/4] npm audit fix en client/...
call npm audit fix
echo Nota: advisory HIGH de react-router puede requerir --force si no se resuelve solo.
echo.

echo [4/4] Verificando build...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: build fallou tras audit fix. Revertir con: git checkout -- package.json package-lock.json
    pause
    exit /b 1
)
echo OK: build verde.
echo.

echo ============================================================
echo  LISTO: push hecho + dependencias OK + build verde
echo  Proximos pasos manuales:
echo    1. Vercel: deploy client/ con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
echo    2. Railway: deploy server/ con todas las vars de docs/DEPLOYMENT_CHECKLIST.md
echo    3. GitHub: branch protection en main (requiere CI pass antes de merge)
echo ============================================================
pause
