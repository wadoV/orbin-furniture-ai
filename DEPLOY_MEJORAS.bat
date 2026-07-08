@echo off
title Orbin - Deploy Mejoras + Recuperacion landing
setlocal
set "REPO=%~dp0"
set "FIX=%~dp0Orbin_ActionPlan\fixes"
set "IMG=%~dp0Orbin_ActionPlan\recovered_images"

echo ============================================================
echo   ORBIN - DEPLOY
echo   1) Tamponado + Base independiente (sin rodapie/patas)
echo   2) Recuperacion landing: 3 imagenes reales + logo
echo ============================================================
echo.
echo  IMPORTANTE: cierra GitHub Desktop antes de continuar.
echo  NO se commitea si los tests o el build fallan.
echo.
pause

cd /d "%REPO%"
if exist ".git\index.lock" del ".git\index.lock" >nul 2>&1

echo.
echo [1/7] Sincronizando (git pull)...
git pull origin main
if errorlevel 1 ( echo. & echo  ERROR en git pull. Resuelve conflictos y reintenta. Aborto. & echo. & pause & exit /b 1 )

echo.
echo [2/7] Copiando los 5 archivos de mejoras...
copy /Y "%FIX%\dep_engine\closetEngine.js"        "%REPO%server\src\engine\closetEngine.js"   >nul || goto :err
copy /Y "%FIX%\dep_engine\engine.test.js"         "%REPO%server\src\engine\engine.test.js"    >nul || goto :err
copy /Y "%FIX%\dep_clientengine\exportAdapters.js" "%REPO%client\src\engine\exportAdapters.js" >nul || goto :err
copy /Y "%FIX%\dep_clientengine\planRenderer.js"   "%REPO%client\src\engine\planRenderer.js"   >nul || goto :err
copy /Y "%FIX%\dep_components\InputPanel.jsx"      "%REPO%client\src\components\InputPanel.jsx" >nul || goto :err
echo   OK: mejoras copiadas.

echo.
echo [3/7] Recuperando landing (LandingPage + imagenes)...
copy /Y "%FIX%\dep_components\LandingPage.jsx"     "%REPO%client\src\components\LandingPage.jsx" >nul || goto :err
if not exist "%REPO%client\public" mkdir "%REPO%client\public"
copy /Y "%IMG%\*.png"                              "%REPO%client\public\"                       >nul || goto :err
echo   OK: landing e imagenes restauradas.

echo.
echo [4/7] Tests del motor (deben ser 20/20)...
cd /d "%REPO%server"
call npm test
if errorlevel 1 ( echo. & echo  ERROR: tests fallaron. NO se commitea. & cd /d "%REPO%" & echo. & pause & exit /b 1 )

echo.
echo [5/7] Build del cliente (debe ser limpio)...
cd /d "%REPO%client"
call npm run build
if errorlevel 1 ( echo. & echo  ERROR: build fallo. NO se commitea. & cd /d "%REPO%" & echo. & pause & exit /b 1 )

echo.
echo [6/7] Commit...
cd /d "%REPO%"
git add server/src/engine/closetEngine.js server/src/engine/engine.test.js client/src/engine/exportAdapters.js client/src/engine/planRenderer.js client/src/components/InputPanel.jsx client/src/components/LandingPage.jsx client/public
git commit -m "feat: tamponado + base independiente + UI (tests 20/20); recover: imagenes reales y logo de la landing"

echo.
echo [7/7] Push...
git push origin main
if errorlevel 1 ( echo. & echo  ERROR en push (revisa credenciales). El commit quedo LOCAL; no se perdio nada. & echo. & pause & exit /b 1 )

echo.
echo ============================================================
echo   LISTO. Desplegado en main. Vercel/Railway redespliegan.
echo   - Panel: selector Tamponado y Base (rodapie/patas).
echo   - Landing: 3 imagenes reales + logo.
echo ============================================================
echo.
pause
exit /b 0

:err
echo.
echo  ERROR copiando archivos. Aborto (no se commitea nada).
echo.
pause
exit /b 1
