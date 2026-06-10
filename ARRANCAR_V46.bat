@echo off
title Orbin AI v4.6 — Servidores Dev
color 0A
echo.
echo  ██████╗ ██████╗ ██████╗ ██╗███╗   ██╗
echo  ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║
echo  ██║  ██║██████╔╝██████╔╝██║██╔██╗ ██║
echo  ██║  ██║██╔══██╗██╔══██╗██║██║╚██╗██║
echo  ██████╔╝██║  ██║██████╔╝██║██║ ╚████║
echo  ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
echo                         v4.6 COMMERCIAL_READY
echo.

:: Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no encontrado. Instala desde nodejs.org
  pause & exit /b 1
)

:: Instalar dependencias si faltan
if not exist "server\node_modules" (
  echo [1/3] Instalando dependencias del servidor...
  cd server && npm install --silent && cd ..
)
if not exist "client\node_modules" (
  echo [2/3] Instalando dependencias del cliente...
  cd client && npm install --silent && cd ..
)

echo [3/3] Iniciando servidores...
echo.
echo  API  Backend  → http://localhost:3003
echo  App  Frontend → http://localhost:5173
echo.
echo  Presiona Ctrl+C en cualquier ventana para detener.
echo.

:: Abrir servidor backend en nueva ventana
start "Orbin API :3003" cmd /k "cd /d %~dp0server && npm run dev"

:: Esperar 2 segundos y abrir cliente
timeout /t 2 /nobreak > nul
start "Orbin App :5173" cmd /k "cd /d %~dp0client && npm run dev"

:: Esperar 4 segundos y abrir navegador
timeout /t 4 /nobreak > nul
start "" "http://localhost:5173"

echo  Servidores iniciados. Esta ventana puede cerrarse.
pause
