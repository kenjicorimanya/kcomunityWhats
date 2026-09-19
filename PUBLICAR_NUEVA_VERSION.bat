@echo off
chcp 65001 >nul
title Gestor de Versiones - Kcomunitywhats
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0PUBLICAR_NUEVA_VERSION.ps1"
