@echo off
title Balaji NextGen - Tally connector
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0BNX-Tally-Connector.ps1"
pause
