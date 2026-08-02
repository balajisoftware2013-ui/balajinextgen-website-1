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

REM ── v2 FIX: the old script hardcoded three DIFFERENT guessed
REM    filenames across its three fallback branches (WealthPilot360.html /
REM    Balaji_WealthPilot360.html / Balaji_WealthPilot360.html), none of
REM    which matched the real file once it was renamed or redownloaded
REM    with a different name. Whichever branch fired, it could open a
REM    404 page - which has no manifest and no service worker, so the
REM    Install option would never work no matter what you did in the
REM    browser menu. Auto-detect the actual .html file in this folder
REM    instead, so renaming the file never breaks this script again.
set "HTMLFILE="
for %%F in ("%~dp0*.html") do (
    if not defined HTMLFILE set "HTMLFILE=%%~nxF"
)

if not defined HTMLFILE (
    echo ERROR: No .html file found in this folder:
    echo   %~dp0
    echo Put this .bat file in the same folder as the WealthPilot360 HTML file and run it again.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0sw.js" (
    echo WARNING: sw.js was not found next to %HTMLFILE%
    echo   Install / offline mode will not work without it.
    echo   Make sure sw.js is in this exact same folder:
    echo   %~dp0
    echo.
)

echo Found app file: %HTMLFILE%
echo.

set PORT=8080
set "URL=http://localhost:%PORT%/%HTMLFILE%"

REM ── v2 FIX: previously the browser was launched with "start" (which
REM    returns immediately) in the same breath as starting the server,
REM    so the tab often loaded before the server was actually listening
REM    -> "this site can't be reached" on first load. Open the browser
REM    from a short delayed background command instead, so it fires
REM    ~2 seconds AFTER the server section below has already started.
where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"
) else (
    start "" "%URL%"
)

REM ── Try Python first (most machines have it) ──
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python on port %PORT% ...
    echo Opening %URL%
    python -m http.server %PORT%
    goto :eof
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python3 on port %PORT% ...
    echo Opening %URL%
    python3 -m http.server %PORT%
    goto :eof
)

REM ── Fall back to Node's npx serve ──
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python not found - starting server with Node "serve" on port %PORT% ...
    echo Opening %URL%
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
