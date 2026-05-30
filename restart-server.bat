@echo off
title Orbin IA — Server RESTART (fixes validator + stressTest)
color 0C
echo.
echo  Deteniendo proceso Node.js en puerto 3003...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3003 ^| findstr LISTEN') do (
    echo  Matando PID %%a
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul
echo.
color 0A
echo  Iniciando Orbin IA servidor (src/index.js)...
echo  Puerto: 3003
echo.
cd /d C:\Users\Azomarg\Documents\Claude_projects\Orbin\server
node src/index.js
