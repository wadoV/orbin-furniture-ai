@echo off
title Orbin Backend - CANONICAL
cd /d "%~dp0server"
echo Carpeta: %cd%
echo Arrancando backend canonico en :3003 ...
npm run dev
