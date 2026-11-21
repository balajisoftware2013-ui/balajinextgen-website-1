@echo off
REM Opens the POS in Chrome with SILENT printing (no print dialog) - use as the shop-PC shortcut.
REM Fallback for when QZ Tray is not running. Close ALL Chrome windows first, then double-click this.
set URL=https://www.balajinextgen.in/Dashboard/restaurant/restaurant-dashboard.html
set CH=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CH%" set CH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
start "" "%CH%" --kiosk-printing --app=%URL%
