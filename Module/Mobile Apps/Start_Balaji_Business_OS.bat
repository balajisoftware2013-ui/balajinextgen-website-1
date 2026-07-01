@echo off
title Balaji NextGen - Business OS
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  set PYCMD=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PYCMD=py
  ) else (
    echo Python was not found on this computer.
    echo Please install Python from https://www.python.org/downloads/ ^(tick "Add to PATH" during install^), then double-click this file again.
    pause
    exit /b
  )
)

echo Starting Balaji NextGen Business OS local server...
start "" http://localhost:8765/balaji-business-os.html
%PYCMD% -m http.server 8765
