@echo off
echo.
echo  ========================================
echo   ORBIN AI - Iniciando aplicacao...
echo  ========================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

echo  [1/3] Instalando dependencias do servidor...
cd /d "%~dp0server"
call npm install --loglevel=error

echo  [2/3] Instalando dependencias do cliente...
cd /d "%~dp0client"
call npm install --loglevel=error

echo  [3/3] Iniciando servidor e cliente...
cd /d "%~dp0"
echo.
echo  API:      http://localhost:3001
echo  Frontend: http://localhost:5173
echo.
start "Orbin API" cmd /k "cd /d %~dp0server && npm run dev"
timeout /t 2 >nul
start "Orbin Client" cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 3 >nul
start "" http://localhost:5173

echo  Aplicacao iniciada! Abrindo no navegador...
echo  Para encerrar, feche as janelas "Orbin API" e "Orbin Client"
pause
