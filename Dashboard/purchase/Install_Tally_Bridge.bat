@echo off
title Install Tally Bridge (one time)
set "D=%LOCALAPPDATA%\BalajiTallyBridge"
mkdir "%D%" 2>nul
copy /y "%~dp0Tally_Bridge.ps1" "%D%\Tally_Bridge.ps1" >nul
> "%D%\run.vbs" echo CreateObject("WScript.Shell").Run "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""%D%\Tally_Bridge.ps1""", 0, False
copy /y "%D%\run.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BalajiTallyBridge.vbs" >nul
wscript "%D%\run.vbs"
echo.
echo Done. Tally Bridge now starts automatically with Windows. You can close this window.
pause
