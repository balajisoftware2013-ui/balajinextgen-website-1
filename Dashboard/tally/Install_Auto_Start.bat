@echo off
title Smart TallySync Pro - one-time setup
set "D=%~dp0"
where node >nul 2>&1 || (echo Node.js is not installed. Install it from https://nodejs.org and run this again. & pause & exit /b)
rem 1) start the connector (hidden) every time you sign in to Windows
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v SmartTallySyncConnector /d "wscript.exe \"%D%Start_Tally_Connector_Hidden.vbs\"" /f >nul
rem 2) let the web page start it on demand (tallysync://start)
reg add "HKCU\Software\Classes\tallysync" /ve /d "URL:Smart TallySync Pro" /f >nul
reg add "HKCU\Software\Classes\tallysync" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\tallysync\shell\open\command" /ve /d "wscript.exe \"%D%Start_Tally_Connector_Hidden.vbs\"" /f >nul
rem start it now
wscript.exe "%D%Start_Tally_Connector_Hidden.vbs"
echo.
echo Done. The Tally connector now starts by itself when Windows starts,
echo and Smart TallySync Pro starts it automatically if it is not running.
echo (If the browser asks "Open Smart TallySync Pro?" tick "Always allow" once.)
echo To undo: run Remove_Auto_Start.bat
pause
