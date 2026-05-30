@echo off
echo ============================================
echo   ORBIN v4.0 — Fix Lock + Commit + Push
echo ============================================
cd /d "%~dp0"

echo Eliminando index.lock si existe...
if exist ".git\index.lock" (
    del /f /q ".git\index.lock"
    echo Lock eliminado.
) else (
    echo No habia lock.
)

echo.
echo Agregando archivos modificados...
git add client\src\components\CutListTable.jsx
git add client\src\components\Viewer3D.jsx
git add client\src\components\ResultPanel.jsx
git add COMMIT_AND_PUSH.bat

echo.
git status --short

echo.
echo Haciendo commit...
git commit -m "feat(v4.0): CutList UX — seleccion sincronizada, delete por pieza, Ctrl+Z, boton ojo

- Fix: IDs de mesh en Viewer3D ahora deterministicos (design.id::type::name) para sincronizar con tabla
- Feat: CutListTable — click en fila resalta la pieza en el visor 3D correctamente
- Feat: CutListTable — boton ojo (Eye) por fila para ocultar/mostrar cortes individuales de la lista
- Feat: CutListTable — badge contador de piezas ocultas + boton mostrar todas
- Feat: ResultPanel summary tab — seleccion tambien sincronizada con visor 3D via key deterministica
- Keep: Delete pieza por pieza (boton X hover) + Ctrl+Z deshacer — funcional"

echo.
echo Pusheando a GitHub...
git push origin main

echo.
echo ============================================
echo   LISTO. Verifica en:
echo   https://github.com/wadoV/orbin-furniture-ai
echo ============================================
pause
