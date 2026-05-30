@echo off
title Orbin AI — Iniciando
cd /d "%~dp0"

echo.
echo ============================================================
echo   Orbin AI v2.2 — Arranque rapido
echo ============================================================
echo   API  : http://localhost:3003
echo   App  : http://localhost:5173
echo ============================================================
echo.

start "Orbin SERVER" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 3 /nobreak > nul
start "Orbin CLIENT" cmd /k "cd /d "%~dp0client" && npm run dev"
timeout /t 5 /nobreak > nul
start "" http://localhost:5173

echo  Listo. Ventanas abiertas. Cierra esta ventana.
