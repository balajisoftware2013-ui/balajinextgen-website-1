@echo off
setlocal
title Balaji NextGen - Tally auto-connect (one time)
rem  One-time setup per PC - no Python needed. Copies the small Tally bridge (PowerShell) to
rem  %LOCALAPPDATA%\BalajiNextGen\TallyConnector, starts it now (hidden) and every time Windows starts.
rem  The GST page then reads TallyPrime by itself. Tally data is never changed by the bridge.
rem  To remove: delete "BalajiNextGen Tally Connector.vbs" from the Startup folder (Win+R, shell:startup).

set "DIR=%LOCALAPPDATA%\BalajiNextGen\TallyConnector"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%DIR%" mkdir "%DIR%"

echo.
echo  [1/3] Getting the Tally bridge ...
if exist "%~dp0bnx_tally_bridge.ps1" (
  copy /y "%~dp0bnx_tally_bridge.ps1" "%DIR%\bnx_tally_bridge.ps1" >nul
) else (
  curl -fsSL -o "%DIR%\bnx_tally_bridge.ps1" "https://www.balajinextgen.in/Dashboard/gst/bnx_tally_bridge.ps1"
)
if not exist "%DIR%\bnx_tally_bridge.ps1" (
  echo  Could not get bnx_tally_bridge.ps1 - check internet, or keep it in the same folder as this file.
  pause & exit /b 1
)

echo  [2/3] Adding to Windows start-up (hidden) ...
> "%DIR%\run_hidden.vbs" echo Set s = CreateObject("WScript.Shell")
>> "%DIR%\run_hidden.vbs" echo s.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%DIR%\bnx_tally_bridge.ps1""", 0, False
copy /y "%DIR%\run_hidden.vbs" "%STARTUP%\BalajiNextGen Tally Connector.vbs" >nul

echo  [3/3] Starting it now ...
wscript "%DIR%\run_hidden.vbs"
timeout /t 3 >nul
curl -s -m 5 http://127.0.0.1:9001/ping >nul 2>nul && (echo  Bridge is running on 127.0.0.1:9001.) || (echo  Bridge did not answer yet - restart the PC once if the GST page still says "needs the connector".)

echo.
echo  Done - it now starts by itself with Windows.
echo  In TallyPrime keep: F1 Help ^> Settings ^> Connectivity ^> TallyPrime acts as Both, Port 9000.
echo  Open the GST page - the Tally button turns green by itself.
echo.
pause
