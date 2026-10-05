@echo off
title BNX Print Relay
cd /d "%~dp0"
REM ---- CHANGE THIS to your own secret (16+ characters). Type the SAME key in the app: Printer Setup > Relay key ----
set BNX_PRINT_KEY=happys-hashtag-2026-key
:loop
node bnx-print-relay.js
echo Relay stopped. Restarting in 3 seconds...
timeout /t 3 >nul
goto loop
