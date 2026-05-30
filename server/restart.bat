@echo off
echo Deteniendo procesos Node.js existentes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul
echo Iniciando Orbin Server (puerto 3003)...
npm run dev
pause
