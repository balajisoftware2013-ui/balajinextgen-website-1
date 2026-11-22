@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-Balaji-POS.ps1"
set "BNX_EXIT=%ERRORLEVEL%"
if not "%BNX_EXIT%"=="0" pause
exit /b %BNX_EXIT%
