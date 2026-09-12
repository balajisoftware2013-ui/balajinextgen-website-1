HAPPYSERVE STEWARD MOBILE — FINAL ERROR-CLEAN PACKAGE

Base: HAPPYSERVE-Steward-Mobile-FINAL-PRODUCTION.html

Final fixes included:
1. Reservation uses the in-app sheet UI — no browser prompt for customer name.
2. Reservation date uses device-local calendar date; no calendarDate scope error.
3. Table Management uses real TABLE_MASTER table numbers/status/section/capacity.
4. Reservation data is re-synced from LIST_RESERVATIONS when available.
5. Active orders are merged into live table state.
6. Table icon can be supplied by TABLE_MASTER optional ICON/TABLE_ICON fields; old 14-column master remains compatible and falls back to a chair icon.
7. Removed unused icon preload hints that caused Chromium console warnings.
8. Optional config/reservation/active-order fallback diagnostics use console.debug instead of warning noise.
9. Live mode never shows fake table/menu data; demo fallback remains demo-only.
10. PWA manifest/service worker and client-brand assets are included.

IMPORTANT MASTER-DB RULE
- Live client menu/table data must come from the master/backend.
- Admin can change supported master fields; the steward app does not overwrite master data.
- The optional table ICON field is backward-compatible. If the backend projection does not expose it, the app uses the standard table icon.

DEPLOYMENT
Upload the complete folder contents together, preserving:
  steward-mobile.html
  manifest.json
  sw.js
  assets/
  icons/

For PWA installation, serve over HTTPS. Opening HTML directly with file:// cannot register a service worker.
