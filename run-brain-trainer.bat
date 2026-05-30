@echo off
title Orbin Brain Trainer — QA Adversarial Agent
color 0B
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  ORBIN BRAIN TRAINER — ADVERSARIAL QA AGENT         ║
echo  ║  20 test cases hostiles contra el motor parametrico  ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Conectando a: http://localhost:3003/api/v1/stress-test
echo  Asegurate de que el servidor Orbin IA este corriendo.
echo.

cd /d C:\Users\Azomarg\Documents\Claude_projects\Orbin
node brain-trainer.js

echo.
echo  Tests completados. Revisa el archivo BRAIN_TRAINER_REPORT_*.json
pause
