@echo off
title Balaji NextGen - make printing silent (QZ Tray)
net session >nul 2>&1
if %errorlevel% neq 0 (
 echo Asking Windows for permission...
 powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
 exit /b
)
set "QZ=%ProgramFiles%\QZ Tray"
if not exist "%QZ%\qz-tray.exe" if exist "%ProgramFiles(x86)%\QZ Tray\qz-tray.exe" set "QZ=%ProgramFiles(x86)%\QZ Tray"
if not exist "%QZ%\qz-tray.exe" goto noqz
echo Writing the Balaji NextGen certificate...
(
echo -----BEGIN CERTIFICATE-----
echo MIIDuTCCAqGgAwIBAgIUYO95lVPZ6oYLOTvy3i6FVP7B510wDQYJKoZIhvcNAQEN
echo BQAwbDELMAkGA1UEBhMCSU4xFDASBgNVBAgMC1dlc3QgQmVuZ2FsMREwDwYDVQQH
echo DAhTaWxpZ3VyaTEXMBUGA1UECgwOQmFsYWppIE5leHRHZW4xGzAZBgNVBAMMEkJh
echo bGFqaSBOZXh0R2VuIEVSUDAeFw0yNjEwMjIxNTE0NDFaFw0zNjEwMTkxNTE0NDFa
echo MGwxCzAJBgNVBAYTAklOMRQwEgYDVQQIDAtXZXN0IEJlbmdhbDERMA8GA1UEBwwI
echo U2lsaWd1cmkxFzAVBgNVBAoMDkJhbGFqaSBOZXh0R2VuMRswGQYDVQQDDBJCYWxh
echo amkgTmV4dEdlbiBFUlAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCg
echo TDI1L1euUtgF0usf8iIo/byjJ/QWzL8OAe0Z+QHjA+SO9bKZyzmTI8trWxihIA2x
echo s85v2Epy0zlwJVmqprAZI1arkqVygr1xglpm42dcROP4UNXH0BNce9i6PprmW60d
echo wwm+B315aS/3Vj/VZ2mXo1AU8js8ZY24WbnV+iK2BBYfKMFgl28bUDOKBuht5/VM
echo 6E3wKG/C0EzPpILb2DPoncU45/7aYXqeFDPNT94FFPkMqgIbw8eA2H1A1/T907Aj
echo I1/+7vxepfE7/vXaBCO0f6XHePbDgWJsWyhdvV7kqRtk/TZe9GdKWu9j7T/BtyPm
echo 1wCSOxorFyl7jQcL7YnnAgMBAAGjUzBRMB0GA1UdDgQWBBTYUpLWwg0fV018C17m
echo ALQ3Qg30ITAfBgNVHSMEGDAWgBTYUpLWwg0fV018C17mALQ3Qg30ITAPBgNVHRMB
echo Af8EBTADAQH/MA0GCSqGSIb3DQEBDQUAA4IBAQBwCKKLREuI050MdtcDYwRKC5H3
echo RLOufduAU8xAfsLik/L/cMEpsPmZ9Pr9HDekUxffKy69okc8t9tT2lYN/5FXh42N
echo WbsTrKyKN860vG6+miLQD7jIBXdxy8Fv7I8K/cuuPjEdiMJh/xkSlhO/e9QKg8SA
echo wdxEGAaXzwvA7cUngkm+5OflyLl4YGHAvQ60YEj9b/J11QVK5qPGTNoVLkF64jV/
echo IoAY5X+A0mmFBeSCPiQjckaH/E+LuRopjrgoS9Hh56F/CaOblt8sgRrGWOFPGIFS
echo 38wAlafLLK4pBRMmXjrfEEaCgDiPHqouZcepNcPtHYMn7fupWrHK+MZUQph0
echo -----END CERTIFICATE-----
) > "%QZ%\override.crt"
if not exist "%QZ%\override.crt" goto nowrite
echo Restarting QZ Tray...
taskkill /IM qz-tray.exe /F >nul 2>&1
taskkill /IM javaw.exe /FI "WINDOWTITLE eq QZ Tray*" /F >nul 2>&1
timeout /t 2 >nul
start "" "%QZ%\qz-tray.exe"
echo.
echo DONE. Printing from Balaji NextGen is now silent on this PC (no Allow box).
echo You can close this window.
timeout /t 8 >nul
exit /b 0
:noqz
echo QZ Tray is not installed on this PC. Install it from https://qz.io/download and run this file again.
pause
exit /b 1
:nowrite
echo Could not write the certificate into the QZ Tray folder.
pause
exit /b 1
