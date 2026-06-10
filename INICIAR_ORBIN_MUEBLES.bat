@echo off
title  ORBIN MUEBLES  -  IA Parametrica  (3003 / 5173)
color 0A
echo.
echo  ============================================================
echo    ORBIN  ^|  MUEBLES  --  IA de diseno parametrico de muebles
echo    (NO es "Orbin Logs" / n8n / WhatsApp)
echo  ============================================================
echo    Backend  API  : http://localhost:3003
echo    Frontend App  : http://localhost:5173
echo  ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no encontrado. Instala desde nodejs.org
  pause & exit /b 1
)

if not exist "server\node_modules" (
  echo [setup] Instalando dependencias del server...
  cd server && call npm install && cd ..
)
if not exist "client\node_modules" (
  echo [setup] Instalando dependencias del client...
  cd client && call npm install && cd ..
)

echo [run] Iniciando servidores de MUEBLES...
start "ORBIN MUEBLES - API 3003" cmd /k "cd /d %~dp0server && npm run dev"
timeout /t 2 /nobreak >nul
start "ORBIN MUEBLES - App 5173" cmd /k "cd /d %~dp0client && npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  Servidores de MUEBLES iniciados. Puedes cerrar esta ventana.
pause
