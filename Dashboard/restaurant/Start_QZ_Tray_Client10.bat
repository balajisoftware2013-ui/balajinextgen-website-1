@echo off
setlocal
set "QZDIR=%PROGRAMFILES%\QZ Tray"
if exist "%QZDIR%\qz-tray.exe" (
  start "QZ Tray" "%QZDIR%\qz-tray.exe"
  echo QZ Tray started.
  goto :end
)
if exist "%QZDIR%\qz-tray-console.exe" (
  start "QZ Tray Console" "%QZDIR%\qz-tray-console.exe"
  echo QZ Tray console started.
  goto :end
)
if exist "%PROGRAMFILES(x86)%\QZ Tray\qz-tray.exe" (
  start "QZ Tray" "%PROGRAMFILES(x86)%\QZ Tray\qz-tray.exe"
  echo QZ Tray started.
  goto :end
)
echo QZ Tray was not found.
echo Install it from https://qz.io/download/?os=windows
start "QZ Tray Download" "https://qz.io/download/?os=windows"
:end
pause
