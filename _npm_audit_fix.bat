@echo off
chcp 65001 > nul
echo ============================================================
echo  ORBIN AI — npm audit fix (ejecutar en Windows)
echo ============================================================
cd /d "%~dp0client"

echo [1/3] npm install (restaura node_modules si estaban incompletos)...
call npm install
if %errorlevel% neq 0 (echo ERROR en npm install & pause & exit /b 1)

echo [2/3] npm audit fix...
call npm audit fix
echo.
echo [3/3] Verificando build...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: build roto tras audit fix.
    echo Revertir dependencias con: git checkout -- package.json package-lock.json
    pause & exit /b 1
)
echo.
echo OK: audit fix aplicado y build verde.
pause
