BALAJI NEXTGEN ERP — HAPPYSERVE COMPLETE ASSETS PACKAGE

UPLOAD ROOT
- steward-mobile.html
- restaurant-dashboard.html
- manifest.json
- service-worker.js
- assets/
- live-banners/
- ASSET_MANIFEST.csv
- backend/Code.gs (Google Apps Script source; deploy to V2_CORE only)
- database/CL00010_MASTER_DB_FIXED_FINAL.xlsx

IMAGE FALLBACK RULE
1. Client-specific item image URL/path
2. Client item icon
3. Item group PNG
4. Category PNG
5. Common default PNG

CATEGORY ASSETS
54 category PNGs are generated from the current CL00010 MENU_ITEM_CATEGORY_LIST and use the exact CATEGORY_ID filenames. No fake client menu rows are inserted.

CLIENT BRANDING
Only CL00010 is concretely present in the supplied master DB. The app is dynamic: for any other client, missing logo/banner assets fall back to the common Balaji/HAPPYSERVE assets rather than inventing client data. Add client-specific files under assets/clients/<CLIENT_ID>/ when a client supplies them.

TABLE BOOKING CALENDAR
The steward table screen now includes a date picker with previous/next day controls and calls GET_TABLE_AVAILABILITY for the selected date. Reservations remain server-authoritative.

KNOWN LIVE BACKEND ACTIONS
LIST_RESERVATIONS, SAVE_RESERVATION, GET_TABLE_AVAILABILITY, CANCEL_RESERVATION, SEAT_RESERVATION are already present in the supplied Code.gs.

IMPORTANT
The supplied backend deployment must be the live V2_CORE deployment. Do not create a second competing .gs file in the same Apps Script project.

BACKEND SCHEMA PATCH
Code.gs now self-heals RESERVATION_MASTER with a complete header schema and normalizes RES_DATE before comparing/listing reservations, so date-wise booking works even when older Sheets rows contain Date objects.
