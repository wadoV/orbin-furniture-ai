Set-Location "C:\Users\Azomarg\Documents\Claude_projects\Orbin"

Write-Host "=== ORBIN v4.0 Git Push ===" -ForegroundColor Yellow

# Eliminar todos los locks
foreach ($lock in @(".git\index.lock", ".git\HEAD.lock", ".git\refs\heads\main.lock")) {
    if (Test-Path $lock) {
        Remove-Item $lock -Force
        Write-Host "Eliminado: $lock" -ForegroundColor Green
    }
}

# Stage archivos
git add client\src\components\CutListTable.jsx
git add client\src\components\Viewer3D.jsx
git add client\src\components\ResultPanel.jsx
git add COMMIT_AND_PUSH.bat
git add FIX_AND_PUSH.bat
git add GIT_PUSH_v4.ps1

git status --short

# Commit
git commit -m "feat(v4.0): CutList UX - seleccion sincronizada, delete por pieza, Ctrl+Z, boton ojo

- Fix: IDs deterministicos en Viewer3D (design.id::type::name) para sync con tabla
- Feat: click en fila de CutListTable resalta pieza en visor 3D
- Feat: boton ojo (Eye) por fila para ocultar/mostrar cortes individuales
- Feat: badge contador piezas ocultas + boton mostrar todas
- Feat: summary tab de ResultPanel sincronizado con visor 3D"

# Push
git push origin main

Write-Host "=== LISTO ===" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
