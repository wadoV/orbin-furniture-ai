Set-Location "C:\Users\Azomarg\Documents\Claude_projects\Orbin"
Write-Host "=== ORBIN COMMERCIAL_READY_V4.5 — FINAL PUSH ===" -ForegroundColor Yellow

# 1. Pausar GitHub Desktop para liberar locks
Write-Host "`n[1/5] Suspendiendo GitHub Desktop..." -ForegroundColor Cyan
$ghd = Get-Process -Name "GitHubDesktop" -ErrorAction SilentlyContinue
if ($ghd) {
    $ghd | Suspend-Process -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Write-Host "     GitHub Desktop suspendido." -ForegroundColor Green
} else {
    Write-Host "     GitHub Desktop no estaba corriendo." -ForegroundColor Gray
}

# 2. Eliminar TODOS los locks
Write-Host "`n[2/5] Limpiando locks..." -ForegroundColor Cyan
foreach ($lock in @(
    ".git\index.lock", ".git\HEAD.lock",
    ".git\refs\heads\main.lock", ".git\packed-refs.lock"
)) {
    if (Test-Path $lock) {
        Remove-Item $lock -Force
        Write-Host "     Eliminado: $lock" -ForegroundColor Green
    }
}

# 3. Stage archivos v4.5
Write-Host "`n[3/5] Staging archivos..." -ForegroundColor Cyan
$files = @(
    "client/src/context/UserContext.jsx",
    "client/src/components/LandingPage.jsx",
    "client/src/components/AuthPages.jsx",
    "client/src/main.jsx",
    "client/package.json",
    "client/src/App.jsx",
    "client/src/i18n.js",
    "client/src/components/ChatPanel.jsx",
    "client/src/components/InputPanel.jsx",
    "client/src/components/ExportPanel.jsx",
    "README.md",
    "COMMIT_V45.ps1",
    "PUSH_V45_FINAL.ps1"
)
foreach ($f in $files) {
    $r = git add $f 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "     OK: $f" -ForegroundColor Green }
    else { Write-Host "     ERR: $f — $r" -ForegroundColor Red }
}

git status --short

# 4. Commit
Write-Host "`n[4/5] Haciendo commit..." -ForegroundColor Cyan
$env:GIT_AUTHOR_NAME     = "Eduardo Ventura"
$env:GIT_AUTHOR_EMAIL    = "ejvm280890@gmail.com"
$env:GIT_COMMITTER_NAME  = "Eduardo Ventura"
$env:GIT_COMMITTER_EMAIL = "ejvm280890@gmail.com"

git commit -m "feat(v4.5): COMMERCIAL_READY -- Landing, Auth, SaaS plan system

LANDING PAGE (/)
- LandingPage.jsx: hero, 6 tech features, pricing table 3 plans
- Dark premium #0D0D0D, Orbin gold, full responsive

AUTH SYSTEM (/login, /register)
- AuthPages.jsx: LoginPage + RegisterPage with plan injection
- Flow: Landing -> plan -> register -> /app (protected route)

SAAS PLAN SYSTEM
- UserContext.jsx: global state free/pro/enterprise + localStorage
- PLANS: maxModules, aiChat, thicknesses, exportPDF/CSV/CNC/BOM
- React Router v6 in main.jsx: ProtectedRoute + PublicRoute

PLAN RESTRICTIONS (ZERO REGRESSION Viewer3D + closetEngine)
- App.jsx: PlanLimitAlert — free blocked at 3 modules
- ChatPanel.jsx: full chat lockout overlay for free plan
- InputPanel.jsx: thickness locked to 18mm on free plan
- ExportPanel.jsx: PDF/CSV/CNC/BOM gated per plan tier

i18n v4.5 — 28 new trilingual strings ES/PT/EN

PROTECTED: Viewer3D.jsx, closetEngine.js, validator.js UNTOUCHED"

$commitOk = $LASTEXITCODE

# 5. Push
if ($commitOk -eq 0) {
    Write-Host "`n[5/5] Pusheando a GitHub..." -ForegroundColor Cyan
    git push origin main
    Write-Host "`n=== LISTO — COMMERCIAL_READY_V4.5 ===" -ForegroundColor Green
    Write-Host "https://github.com/wadoV/orbin-furniture-ai" -ForegroundColor Cyan
} else {
    Write-Host "`nCommit falló (ya committeado o sin cambios)" -ForegroundColor Yellow
    git log --oneline -3
}

# Reanudar GitHub Desktop
if ($ghd) {
    Write-Host "`nReanudando GitHub Desktop..." -ForegroundColor Gray
    $ghd | Resume-Process -ErrorAction SilentlyContinue
}

Read-Host "`nPresiona Enter para cerrar"
