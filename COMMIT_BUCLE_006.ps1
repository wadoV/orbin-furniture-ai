# Orbin AI — Commit del BUCLE 006 (muro de upgrade · i18n)
# Ejecutar desde PowerShell en C:\Users\Azomarg\Documents\Claude_projects\Orbin
#
# POR QUÉ ESTE ARCHIVO: el agente no puede commitear. El FS montado del sandbox
# deniega el unlink de .git/index.lock, así que cada comando de git que escribe el
# índice deja un lock huérfano que bloquea al siguiente. Ver task.md · BUCLE 006.
#
# Borralo después de correrlo (o dejalo: está en .gitignore vía *.ps1 si aplica).

Set-Location "C:\Users\Azomarg\Documents\Claude_projects\Orbin"

# 1 · Liberar el lock residual de a152af8
if (Test-Path ".git\index.lock") {
    Remove-Item -Force ".git\index.lock"
    Write-Host "[OK] index.lock eliminado" -ForegroundColor Green
}

# 2 · Verificar el build que el sandbox no pudo cerrar (EMFILE + techo de 45s)
Write-Host "`n[1/3] Build del cliente..." -ForegroundColor Cyan
Push-Location client
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "[ABORTADO] El build falló. No se commitea." -ForegroundColor Red; exit 1 }
Pop-Location

# 3 · Suite completa del server (debe dar 281/281)
Write-Host "`n[2/3] Tests del server..." -ForegroundColor Cyan
Push-Location server
npm test
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "[ABORTADO] Tests en rojo. No se commitea." -ForegroundColor Red; exit 1 }
Pop-Location

# 4 · Commit atómico (rutas explícitas, no `git add .`)
Write-Host "`n[3/3] Commit..." -ForegroundColor Cyan
git add client/src/engine/apiErrors.js `
        client/src/components/UpgradePrompt.jsx `
        client/src/components/ImageToParametricPanel.jsx `
        client/src/App.jsx `
        server/src/engine/planLimitCopy.test.js `
        task.md

git commit -m "fix(i18n): translate upgrade-wall copy by code instead of hardcoded Spanish" -m @"
El cableado del 403 PLAN_LIMIT_REACHED (a152af8) escribio la copia del modal como
prosa en espanol dentro del JSX, en tres archivos, teniendo el codigo ya traducido
ES/PT/EN en apiErrors.js desde el bucle 003.

El idioma por defecto de la app es PT (mercado primario Brasil): un usuario
brasileno que agotaba la cuota veia un modal mezclado espanol/portugues, en la
unica pantalla del producto cuyo proposito es cobrar.

i18nContract.test.js no podia detectarlo: escanea routes/ y middleware/ buscando
'code:' sin traduccion, no prosa hardcodeada en JSX del cliente.

- apiErrors.js: +PLAN_LIMIT_COPY (ES/PT/EN con placeholders), +localizePlanLimit(),
  +formatResetAt(), +planAlertFrom() para centralizar la deteccion del 403.
- UpgradePrompt.jsx: traduce por codigo leyendo lang de usePreferences.
- App.jsx / ImageToParametricPanel.jsx: emiten featureCode, no prosa.
- Corrige una etiqueta de zona horaria falsa: se imprimia la hora LOCAL del
  navegador rotulada 'UTC' (un usuario en UTC-3 leia 21:00 UTC en vez de 00:00 UTC).
- planLimitCopy.test.js: +16 tests. Cubre la superficie que i18nContract no ve,
  con barrido estatico que impide que la copia vuelva al JSX.

281/281 PASS - 56 suites - 0 fallos. Verificado por mutacion.
"@

git log --oneline -3
Write-Host "`n[LISTO] Bucle 006 commiteado." -ForegroundColor Green
