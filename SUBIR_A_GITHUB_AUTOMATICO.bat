@echo off
chcp 65001 >nul
title Subir Actualizacion a GitHub Automaticamente
cd /d "%~dp0"

echo ==========================================================
echo    SUBIDA AUTOMATICA DE ACTUALIZACION A GITHUB RELEASES
echo       Repositorio: kenjicorimanya/kcomunityWhats
echo ==========================================================
echo.

node tools\publish-release.js

echo.
echo ==========================================================
pause
