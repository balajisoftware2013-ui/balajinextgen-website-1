@echo off
echo ============================================
echo   Balaji NextGen ERP - Local Dev Server
echo ============================================
echo.
echo Starting server at http://localhost:8000
echo.
echo Opening login page...
start http://localhost:8000/login.html
echo.
echo IMPORTANT: Do NOT close this window while using the ERP.
echo Press CTRL+C to stop the server when done.
echo.
echo Quick Links:
echo   Login    : http://localhost:8000/login.html
echo   Dashboard: http://localhost:8000/balaji_erp_package/welcome_v9_dashboard_selector.html
echo   Wizard   : http://localhost:8000/01_new_company_wizard.html
echo.
python -m http.server 8000
pause
