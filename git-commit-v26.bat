@echo off
echo ============================================
echo  ORBIN AI — Git Commit v2.6.0
echo ============================================
echo.

cd /d "%~dp0"

:: Clean Vite temp files
echo [1/5] Cleaning Vite temp files...
del /q client\vite.config.js.timestamp-*.mjs 2>nul
echo Done.

:: Add all changes
echo [2/5] Staging all changes...
git add -A
echo Done.

:: Show status
echo [3/5] Current status:
git status --short
echo.

:: Commit
echo [4/5] Committing...
git commit -m "Orbin v2.6.0 — Fabrication Intelligence Phase 1 complete" -m "Features added:" -m "- AI Model badges (color-coded per provider)" -m "- AI Status Indicator (animated processing phases)" -m "- Auto-Save Projects (localStorage persistence)" -m "- Prompt History (recent prompts reuse)" -m "- Optimization Engine v1 (smart design analysis)" -m "- Material System (presets + selector)" -m "- Cut List Panel (industrial table)" -m "- Cost Estimation (automatic calculation)" -m "- Export System (JSON, OBJ, Technical PDF)" -m "- Preset Furniture Types (5 quick-start templates)" -m "- Central divider fix (stops at drawer zone)" -m "- i18n trilingual keys (PT/ES/EN)"
echo Done.

:: Push
echo [5/5] Pushing to GitHub...
git push origin main
echo.

echo ============================================
echo  COMMIT COMPLETE — Check GitHub
echo ============================================
pause
