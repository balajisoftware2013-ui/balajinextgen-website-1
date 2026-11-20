@echo off
setlocal
title Balaji NextGen - Tally connector auto-start
rem  One-time setup per PC. Puts the Tally connector in %LOCALAPPDATA%\BalajiNextGen\TallyConnector,
rem  starts it now (hidden) and every time Windows starts. Nothing in Tally is changed.
rem  To remove: delete "BalajiNextGen Tally Connector.vbs" from the Startup folder (Win+R, shell:startup).

set "DIR=%LOCALAPPDATA%\BalajiNextGen\TallyConnector"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%DIR%" mkdir "%DIR%"

echo.
echo  [1/4] Getting tally_connector.py ...
if exist "%~dp0tally_connector.py" (
  copy /y "%~dp0tally_connector.py" "%DIR%\tally_connector.py" >nul
) else (
  curl -fsSL -o "%DIR%\tally_connector.py" "https://www.balajinextgen.in/Dashboard/gst/tally_connector.py"
)
if not exist "%DIR%\tally_connector.py" (
  echo  Could not get tally_connector.py. Put it in the same folder as this file and run again.
  pause & exit /b 1
)

echo  [2/4] Checking Python ...
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (
  echo  Python is not installed. Install it from https://www.python.org/downloads/
  echo  and tick "Add python.exe to PATH", then run this file again.
  start "" "https://www.python.org/downloads/"
  pause & exit /b 1
)

echo  [3/4] Adding to Windows start-up (hidden) ...
> "%DIR%\run_hidden.vbs" echo Set s = CreateObject("WScript.Shell")
>> "%DIR%\run_hidden.vbs" echo s.CurrentDirectory = "%DIR%"
>> "%DIR%\run_hidden.vbs" echo s.Run "%PY% ""%DIR%\tally_connector.py""", 0, False
copy /y "%DIR%\run_hidden.vbs" "%STARTUP%\BalajiNextGen Tally Connector.vbs" >nul

echo  [4/4] Starting the connector now ...
wscript "%DIR%\run_hidden.vbs"
timeout /t 3 >nul

echo.
echo  Done. The connector now runs in the background on 127.0.0.1:9001 and starts with Windows.
echo  In TallyPrime keep: F1 Help ^> Settings ^> Connectivity ^> TallyPrime acts as Both, Port 9000.
echo  Open the GST page - the Tally button turns green by itself.
echo.
pause
