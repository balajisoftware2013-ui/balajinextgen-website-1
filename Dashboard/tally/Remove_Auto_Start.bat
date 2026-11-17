@echo off
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v SmartTallySyncConnector /f >nul 2>&1
reg delete "HKCU\Software\Classes\tallysync" /f >nul 2>&1
echo Auto start removed.
pause
