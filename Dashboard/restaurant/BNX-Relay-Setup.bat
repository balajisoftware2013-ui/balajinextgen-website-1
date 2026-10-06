@echo off
setlocal
title BNX Print Relay - Setup
rem ============================================================
rem  BNX Print Relay - one-click setup (Windows)
rem  Put this file in the SAME folder as bnx-print-relay.js
rem  then double-click it.
rem ============================================================

rem --- 1. run as administrator (needed for firewall + auto-start) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"

echo.
echo ===== BNX Print Relay Setup =====
echo.

rem --- 2. check files and Node.js ---
if not exist "%~dp0bnx-print-relay.js" (
  echo [ERROR] bnx-print-relay.js not found in this folder: %~dp0
  echo Put setup.bat next to bnx-print-relay.js and run it again.
  pause
  exit /b 1
)
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed. Opening the download page...
  echo Install the LTS version, then run this setup again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
node -e "process.exit(+process.versions.node.split('.')[0]>=18?0:1)"
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is too old. Install Node.js 18 or newer, then run again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
echo [OK] Node.js found.

rem --- 3. secret key ---
echo.
echo Choose a secret key (16+ letters/numbers, no spaces or symbols).
echo Press ENTER to generate one automatically.
set "KEY="
set /p "KEY=Secret key: "
if "%KEY%"=="" (
  for /f "usebackq delims=" %%i in (`node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"`) do set "KEY=%%i"
)
node -e "process.exit(/^[A-Za-z0-9_-]{16,}$/.test(process.env.KEY||'')?0:1)"
if %errorlevel% neq 0 (
  echo [ERROR] Key must be at least 16 characters: letters, numbers, - or _ only.
  pause
  exit /b 1
)

rem --- 4. this PC's LAN address ---
set "IP="
for /f "usebackq delims=" %%i in (`node -e "var n=require('os').networkInterfaces(),r='';Object.keys(n).forEach(function(k){n[k].forEach(function(a){if(!r&&a.family==='IPv4'&&!a.internal&&/^(192\.168|10\.|172\.)/.test(a.address))r=a.address;});});console.log(r);"`) do set "IP=%%i"
if "%IP%"=="" (
  echo [ERROR] No Wi-Fi/LAN address found. Connect this PC to the same network as the printers.
  pause
  exit /b 1
)
echo [OK] This PC address: %IP%

rem --- 5. HTTPS certificate (iPhone needs a trusted one; Android works with the auto one) ---
set "TLS=0"
echo.
set "IPH="
set /p "IPH=Will iPhones use this relay? (Y/N, default N): "
if /i "%IPH%"=="Y" (
  where mkcert >nul 2>&1
  if errorlevel 1 (
    where winget >nul 2>&1
    if not errorlevel 1 (
      echo Installing mkcert...
      winget install -e --id FiloSottile.mkcert --accept-source-agreements --accept-package-agreements
    )
  )
  where mkcert >nul 2>&1
  if errorlevel 1 (
    echo [WARN] mkcert is not available yet. Close this window, open a NEW one and run setup again,
    echo        or install mkcert manually from https://github.com/FiloSottile/mkcert
  ) else (
    mkcert -install
    mkcert -cert-file "%~dp0relay-cert.pem" -key-file "%~dp0relay-key.pem" %IP% localhost 127.0.0.1
    if exist "%~dp0relay-cert.pem" (
      set "TLS=1"
      for /f "usebackq delims=" %%i in (`mkcert -CAROOT`) do copy /y "%%i\rootCA.pem" "%~dp0rootCA-for-iphone.crt" >nul
      echo [OK] Trusted certificate created. Send rootCA-for-iphone.crt to each iPhone.
    )
  )
) else (
  where openssl >nul 2>&1
  if errorlevel 1 (
    echo [WARN] openssl not found - the relay would run WITHOUT https and the website cannot use it.
    echo        Install "Git for Windows" ^(includes openssl^) then run this setup again.
  )
)

rem --- 6. create start-relay.bat ---
>"%~dp0start-relay.bat"  echo @echo off
>>"%~dp0start-relay.bat" echo title BNX Print Relay
>>"%~dp0start-relay.bat" echo cd /d "%%~dp0"
>>"%~dp0start-relay.bat" echo set BNX_PRINT_KEY=%KEY%
if "%TLS%"=="1" (
  >>"%~dp0start-relay.bat" echo set BNX_TLS_CERT=%%~dp0relay-cert.pem
  >>"%~dp0start-relay.bat" echo set BNX_TLS_KEY=%%~dp0relay-key.pem
)
>>"%~dp0start-relay.bat" echo node bnx-print-relay.js
>>"%~dp0start-relay.bat" echo if errorlevel 1 pause
echo [OK] start-relay.bat created.

rem --- 7. firewall ---
netsh advfirewall firewall delete rule name="BNX Print Relay" >nul 2>&1
netsh advfirewall firewall add rule name="BNX Print Relay" dir=in action=allow protocol=TCP localport=9191,9192 profile=private,domain >nul
echo [OK] Firewall opened for ports 9191 and 9192.
echo      (If your Wi-Fi is set to "Public", change it to "Private" in Windows network settings.)

rem --- 8. start automatically when Windows starts ---
schtasks /create /tn "BNX Print Relay" /tr "\"%~dp0start-relay.bat\"" /sc onlogon /rl highest /f >nul
if %errorlevel%==0 (echo [OK] Relay will start automatically after login.) else (echo [WARN] Auto-start could not be created.)

rem --- 9. start now ---
taskkill /fi "WINDOWTITLE eq BNX Print Relay*" /f >nul 2>&1
start "BNX Print Relay" "%~dp0start-relay.bat"

echo.
echo ============================================================
echo  DONE.  Enter these in the Steward app:
echo     Profile ^> Printer Setup ^> Backup: Print Relay
echo.
echo     Relay address :  https://%IP%:9191
echo     Relay key     :  %KEY%
echo.
echo  Android: open  https://%IP%:9191/health  once in Chrome ^> Advanced ^> Proceed.
if "%TLS%"=="1" echo  iPhone : install rootCA-for-iphone.crt, then Settings ^> General ^> About ^> Certificate Trust Settings ^> ON.
echo  Tip: reserve this PC's IP in your router so the address never changes.
echo ============================================================
echo.
pause
