@echo off
echo ============================================
echo   Balaji NextGen ERP - Local Server
echo ============================================
echo.
echo Starting server at http://localhost:8000
echo.
echo Opening browser...
start http://localhost:8000/balaji_erp_package/welcome_v9_dashboard_selector.html
echo.
echo IMPORTANT: Do NOT close this window while using the ERP.
echo Press CTRL+C to stop the server when done.
echo.
python -m http.server 8000
pause
