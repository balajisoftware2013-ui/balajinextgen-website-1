@echo off
REM Balaji NextGen ERP - trust this site in QZ Tray (stops the "Untrusted website / Allow" popup)
REM Right-click this file and choose "Run as administrator". Keep override.crt in the same folder.
net session >/dev/null 2>&1
if errorlevel 1 ( echo Please right-click and choose "Run as administrator". & pause & exit /b 1 )
set "QZ=%ProgramFiles%\QZ Tray"
if not exist "%QZ%" set "QZ=%ProgramFiles(x86)%\QZ Tray"
if not exist "%QZ%" ( echo QZ Tray folder not found. Install QZ Tray first. & pause & exit /b 1 )
if not exist "%~dp0override.crt" ( echo override.crt must be in the same folder as this file. & pause & exit /b 1 )
copy /Y "%~dp0override.crt" "%QZ%\override.crt" >nul
echo Copied override.crt to "%QZ%"
taskkill /F /IM qz-tray.exe >/dev/null 2>&1
taskkill /F /IM qz-tray-console.exe >/dev/null 2>&1
timeout /t 2 >nul
if exist "%QZ%\qz-tray.exe" start "" "%QZ%\qz-tray.exe"
echo QZ Tray restarted. Reload the Dashboard (Ctrl+F5) and print once:
echo tick "Remember this decision" and click Allow - it will not ask again.
pause
