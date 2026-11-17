@echo off
title Smart TallySync Pro - Tally Connector
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is not installed. Install it from https://nodejs.org and run this again. & pause & exit /b)
:run
node tally-connector.js
echo Connector stopped. Restarting in 3 seconds. Close this window to stop.
timeout /t 3 >nul
goto run
