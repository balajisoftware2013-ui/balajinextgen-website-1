============================================================
 BALAJI NEXTGEN ERP — CONSOLE ERROR FIX
============================================================

THE PROBLEM
------------
"Unsafe attempt to load URL ... from frame with URL ...
 'file:' URLs are treated as unique security origins."

This happens because you are opening the HTML files directly
from disk (file:///D:/...). Modern browsers (Edge/Chrome)
treat every local file:// page as its OWN security origin.
This blocks:
  - Page-to-page navigation (window.location.href)
  - localStorage (used to remember login, business type,
    target dashboard, theme, etc.)
  - Any cross-file resource loading

This is NOT a bug in the ERP code — it's a browser security
restriction that ONLY appears with file:// URLs.


THE FIX (2 minutes)
--------------------
Run this project through a local web server instead of
opening files directly.

OPTION A — Easiest (Windows, Python already on most PCs)
  1. Double-click START_SERVER.bat (included in this folder)
  2. It will open your browser automatically at:
     http://localhost:8000/balaji_erp_package/welcome_v9_dashboard_selector.html
  3. Keep the black command window open while using the ERP.

OPTION B — VS Code "Live Server" extension
  1. Open this folder in VS Code
  2. Install extension "Live Server" (Ritwick Dey)
  3. Right-click welcome_v9_dashboard_selector.html
     -> "Open with Live Server"

OPTION C — Manual (any OS with Python)
  cd into this folder, then run:
     python -m http.server 8000
  Open: http://localhost:8000/balaji_erp_package/welcome_v9_dashboard_selector.html


AFTER THIS FIX
---------------
- All console "Unsafe attempt to load URL... frame..." errors
  disappear.
- localStorage works correctly (login persistence, theme,
  dashboard selection, etc.).
- All internal links / dashboard routing work normally.

NOTE: When you deploy this to Netlify (it already has a
_redirects file and is Netlify-ready), everything is served
over https:// automatically and this issue will NOT occur
at all. This fix is only needed for local testing.
============================================================
