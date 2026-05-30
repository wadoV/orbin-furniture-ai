@echo off
title Orbin — Git Push v2.9
cd /d "C:\Users\Azomarg\Documents\Claude_projects\Orbin"

echo [1/4] Eliminando lock si existe...
if exist ".git\index.lock" del /f ".git\index.lock"

echo [2/4] Staging archivos...
git add -u
git add client/src/components/PricingDisplay.jsx
git add client/src/components/AIVisualStylist.jsx
git add client/src/components/ImageToParametricPanel.jsx
git add client/src/components/MultiplayerLayer.jsx
git add client/src/components/PresentationMode.jsx
git add client/src/components/PresentationMode.css
git add client/src/components/ViralShare.jsx
git add client/src/engine/PricingEngine.js
git add client/src/engine/CutlistGenerator.js
git add client/src/engine/collaboration.js
git add client/src/engine/materialLibrary.js
git add server/src/routes/vision.js
git add server/src/routes/stressTest.js
git add QA_STRESS_TEST_REPORT.md
git add restart-server.bat
git add run-brain-trainer.bat
git add brain-trainer.js

echo [3/4] Committing...
git commit -m "feat(v2.9): Dynamic Quoting Engine + Unified Countertop + New Components" -m "PRICING ENGINE:" -m "- PricingEngine.js: real-time m2 calc per material + hinge/slide inference by module type" -m "- 14 module profiles (COCINA, CUARTO, BANO, SALA) with door/drawer/shelf hardware counts" -m "- Cost matrix: material $/m2 + hardware units + labor $18/m2 + 12pct overhead + 35pct margin" -m "PRICING UI:" -m "- PricingDisplay.jsx: fixed overlay top-left, CountUp animation 60fps easeOutExpo" -m "- Expandable breakdown: materials, hardware chips, labor, overhead, margin, final price" -m "- Flash amber pulse on every price change, zero external dependencies" -m "UNIFIED COUNTERTOP (v2.8):" -m "- 2-pass algorithm: detect X-adjacent chains, render single merged slab" -m "- edgeHelper position fix: synced to slab coordinates" -m "NEW COMPONENTS:" -m "- AIVisualStylist, ImageToParametricPanel, MultiplayerLayer, PresentationMode, ViralShare" -m "- vision.js route, stressTest.js route" -m "- README updated to v2.9.0"

echo [4/4] Pushing to origin/main...
git push origin main

echo.
echo ======================================
echo  Push completado exitosamente!
echo ======================================
pause
