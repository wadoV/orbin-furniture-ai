@echo off
title Orbin AI — Servers
echo.
echo  ╔═══════════════════════════════════╗
echo  ║   ORBIN AI — Arrancando...        ║
echo  ╚═══════════════════════════════════╝
echo.

cd /d "C:\Users\Azomarg\Documents\Claude_projects\Orbin"

REM Actualizar ref de git al ultimo commit con el fix de auth
git update-ref refs/heads/main 14d6587ee05089c28bc2f3cd8066e4fde5b4de88 2>nul

REM Arrancar Backend (puerto 3003)
start "Orbin Backend :3003" cmd /k "cd server && node src/index.js"

REM Esperar 2 segundos
timeout /t 2 /nobreak >nul

REM Arrancar Frontend (puerto 5173)
start "Orbin Frontend :5173" cmd /k "cd client && npx vite --port 5173"

REM Esperar que Vite cargue
timeout /t 4 /nobreak >nul

REM Abrir navegador
start "" "http://localhost:5173/register?plan=free"

echo.
echo  ✅ Backend: http://localhost:3003
echo  ✅ Frontend: http://localhost:5173
echo.
echo  Prueba de registro: http://localhost:5173/register?plan=free
echo.
pause
