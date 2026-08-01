@echo off
title Balaji WealthPilot 360
cd /d "%~dp0"

echo ============================================================
echo   Balaji WealthPilot 360 - Starting local server...
echo ============================================================
echo.
echo   Why this window: opening the HTML file directly
echo   (double-clicking it) loads it as file:// which Chrome/Edge
echo   block from installing as an app or using offline storage.
echo   This script serves the same files over http://localhost
echo   instead, so the Install icon and offline mode both work.
echo.
echo   Leave this window open while using the app.
echo   Close this window (or press Ctrl+C) to stop the server.
echo ============================================================
echo.

set PORT=8080

REM ── Try Python first (most machines have it) ──
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python on port %PORT% ...
    start "" http://localhost:%PORT%/WealthPilot360.html
    python -m http.server %PORT%
    goto :eof
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python3 on port %PORT% ...
    start "" http://localhost:%PORT%/Balaji_WealthPilot360.html
    python3 -m http.server %PORT%
    goto :eof
)

REM ── Fall back to Node's npx serve ──
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python not found - starting server with Node "serve" on port %PORT% ...
    start "" http://localhost:%PORT%/Balaji_WealthPilot360.html
    npx --yes serve -l %PORT% .
    goto :eof
)

REM ── Neither found ──
echo.
echo ERROR: Could not find Python or Node.js on this computer.
echo Please install one of these, then run this file again:
echo   Python:  https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause
