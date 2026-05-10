@echo off
title Orbin AI - Server Launcher
echo.
echo  ========================================
echo   ORBIN AI v2 - Starting Servers...
echo  ========================================
echo.

REM Kill any existing processes on ports 3003 and 5173
echo [1/4] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3003 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

REM Start Backend
echo [2/4] Starting Backend (port 3003)...
cd /d "%~dp0server"
start "Orbin-Backend" cmd /k "title Orbin Backend && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [3/4] Starting Frontend (port 5173)...
cd /d "%~dp0client"
start "Orbin-Frontend" cmd /k "title Orbin Frontend && npm run dev"
timeout /t 5 /nobreak >nul

REM Open browser
echo [4/4] Opening browser...
start http://localhost:5173

echo.
echo  ========================================
echo   Orbin AI is running!
echo   Backend:  http://localhost:3003
echo   Frontend: http://localhost:5173
echo   Health:   http://localhost:3003/api/health
echo  ========================================
echo.
echo  Press any key to close this launcher
echo  (servers will keep running)
pause >nul
