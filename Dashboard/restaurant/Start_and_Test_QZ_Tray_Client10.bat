@echo off
setlocal
title Balaji NextGen - QZ Tray Printer Diagnostic

echo ================================================
echo BALAJI NEXTGEN - QZ TRAY / IP PRINTER CHECK
echo ================================================
echo.

set "QZ=%PROGRAMFILES%\QZ Tray\qz-tray.exe"
set "QZCONSOLE=%PROGRAMFILES%\QZ Tray\qz-tray-console.exe"

if exist "%QZ%" (
  echo [OK] QZ Tray installed:
  echo      %QZ%
) else (
  echo [ERROR] QZ Tray was not found in:
  echo         %PROGRAMFILES%\QZ Tray
  echo.
  echo Install QZ Tray 2.3.0 from:
  echo https://qz.io/download/?os=windows
  echo.
  pause
  exit /b 1
)

echo.
echo [1/2] Starting QZ Tray...
tasklist /FI "IMAGENAME eq qz-tray.exe" 2>NUL | find /I "qz-tray.exe" >NUL
if errorlevel 1 (
  start "" "%QZ%"
  timeout /t 3 /nobreak >NUL
)

echo.
echo [2/2] Checking QZ Tray localhost ports...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=8181,8282,8383,8484,8182,8283,8384,8485; foreach($p in $ports){$r=Test-NetConnection -ComputerName localhost -Port $p -WarningAction SilentlyContinue; if($r.TcpTestSucceeded){Write-Host ('[OPEN]  localhost:'+ $p)}else{Write-Host ('[CLOSED] localhost:'+ $p)}}"

echo.
echo Checking restaurant printer IPs on port 9100...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$items=@(@('BILLING','192.168.0.210'),@('KITCHEN','192.168.0.192'),@('HUKKA','192.168.0.195'),@('BAR','192.168.0.151')); foreach($x in $items){$r=Test-NetConnection -ComputerName $x[1] -Port 9100 -WarningAction SilentlyContinue; if($r.TcpTestSucceeded){Write-Host ('[OPEN]  '+$x[0]+' '+$x[1]+':9100')}else{Write-Host ('[CLOSED] '+$x[0]+' '+$x[1]+':9100')}}"

echo.
echo If QZ ports are OPEN, reload the ERP and click Retry IP Printers.
echo If all QZ ports are CLOSED, QZ Tray is not listening or Windows security is blocking it.
echo.
pause
