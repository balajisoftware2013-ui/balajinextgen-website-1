BALAJI NEXTGEN — BUSINESS OS — FINAL DEPLOYMENT PACKAGE
==========================================================

WHAT'S IN THIS ZIP
-------------------
1. balaji-business-os.html
   - The frontend app: logo, WhatsApp help, register/login/demo gate,
     3-month trial flow, business-name display fix, 31-industry dropdown
     (30 items each), animated setup loading screen, splash screen,
     light-theme onboarding, Tally-style keyboard shortcuts, working
     voice search (search bar + AI panel).
   - GAS_URL is already pointed at your existing /exec deployment.

2. BUSINESS_OS_BACKEND.gs  (renamed from Code.gs)
   - IMPORTANT: your Apps Script project (BALAJI_NEXTGEN_ERP_V2_CORE) is
     shared across multiple products — WealthPilot360, leads-api,
     security-api, master-control, etc. all live in the SAME project,
     and GAS merges every .gs file into one execution context. Your
     Business OS backend already lives there as a file literally named
     "BUSINESS OS BACKEND.gs" (per your screenshot) — this file is the
     UPDATED version of that same file. Paste this content INTO that
     existing file (don't create a new one called "Code.gs" — that
     name is already taken by something else in your project and
     could collide).
   - NEW this round: LOG_SALE / LOG_PURCHASE actions — every sale and
     purchase now writes an actual visible row into the SALES /
     PURCHASES tabs of the client's Sheet (upserted by ID, so retries
     don't create duplicates), IN ADDITION to the existing fast
     APP_DATA JSON sync. This is what makes new invoices show up when
     you open the Sheet directly — previously only the JSON blob was
     updated, never the visible SALES/PURCHASES rows.
   - NEW: UPLOAD_ATTACHMENT action — purchase bill photos/PDFs now
     upload for real to the client's Google Drive folder (same folder
     as their database Sheet) and get a real Drive link stored on the
     purchase record, instead of just remembering the filename.
   - Still handles REGISTER_CLIENT, LOGIN, SUITE_SAVE_DB / SUITE_LOAD_DB,
     CHECK_SUBSCRIPTION as before. Same TEM049 template, same
     sequential CLIENT_ID logic.

3. Balaji_BusinessOS_Database_Template.xlsx
   - The per-client database template (TEM049) — matches the app's DB
     structure: CUSTOMERS, SUPPLIERS, ITEMS, SALES, PURCHASES,
     SETTINGS, APP_DATA. CUSTOMERS/SUPPLIERS/SALES/PURCHASES start
     empty (just a Walk-in Customer); ITEMS shows a 30-item Retail
     sample for reference — real registrations overwrite ITEMS with
     the correct industry's 30 items within seconds via
     freshBizDB()/SUITE_SAVE_DB, per the README tab inside the file.
   - Use this as the content of TEM049 in your Drive/TEMPLATE_REGISTRY
     (already registered per your screenshot — just re-upload this
     file's tab contents to keep it in sync with the app).

4. BALAJI_ERP_MASTER_CONTROL_SYSTEM_UPDATED.xlsx
   - Your master control sheet with BUSINESS_TYPE_MASTER filled out
     (BT021-BT074) to match all industries in MASTER_DROPDOWNS.
   - Re-import only the BUSINESS_TYPE_MASTER tab — don't overwrite the
     whole file, since it also holds your live CLIENT_REGISTRY etc.

5. USER_SECURITY_MASTER_DB_UPDATED.xlsx
   - Your user security sheet with 13 new industries added to
     MASTER_DROPDOWNS!INDUSTRY.
   - Re-import only the MASTER_DROPDOWNS tab for the same reason.

6. manifest.json
   - PWA manifest — makes the app installable ("Add to Home Screen" /
     Install banner) on Android Chrome and iOS Safari.
   - MUST be uploaded to the SAME folder as balaji-business-os.html on
     Netlify (same relative path as assets/Logos/logo.png).

7. sw.js
   - Minimal service worker, required by Chrome/Android for the app
     to be installable. Also gives basic offline app-shell caching.
     Never caches Google Apps Script calls (always fetches live data).
   - MUST also be uploaded to the SAME folder as balaji-business-os.html.


DEPLOY ORDER
-------------
Step 1 — Templates first
  Open TEM049 (Balaji_BusinessOS_Database_Template, already registered
  at 18moaYrNWFKR5etfS2Y4HVjbmyrxCRJxBxQeynz1i9hA per your
  TEMPLATE_REGISTRY) and replace its content with the xlsx in this zip.
  This is what every new client's Sheet gets cloned from.

Step 2 — Master data
  In BALAJI_ERP_MASTER_CONTROL_SYSTEM, import just the
  BUSINESS_TYPE_MASTER tab from the _UPDATED file (File > Import >
  Insert new sheet(s), then move/replace the tab — do NOT replace the
  whole spreadsheet).
  In USER_SECURITY_MASTER_DB, do the same for MASTER_DROPDOWNS.

Step 3 — Backend
  Open BALAJI_NEXTGEN_ERP_V2_CORE in Apps Script, click on the file
  literally named "BUSINESS OS BACKEND.gs" in the left sidebar, select
  all, delete, and paste in the full content of BUSINESS_OS_BACKEND.gs
  from this zip. Deploy > Manage deployments > Edit (pencil icon on
  your existing deployment) > New version > Deploy.
  (Keep the SAME /exec URL — don't create a new deployment, or the
  URL in the HTML won't match anymore.)

Step 4 — Frontend + PWA files
  Upload balaji-business-os.html, manifest.json, and sw.js to your
  Netlify site — ALL THREE in the same folder (same path segment
  where assets/Logos/logo.png lives). If manifest.json or sw.js sit
  in a different folder than the HTML, the install prompt won't work.

Step 5 — Test before going live
  Register ONE throwaway test business first. Confirm:
    - Client ID is CL00016 (not a timestamp)
    - Business name shows correctly on dashboard after registering
    - Rows appear correctly in CLIENT_MASTER, USER_MASTER,
      CLIENT_REGISTRY (both sheets), CLIENT_DATABASE_REGISTRY,
      CLIENT_DEPLOYMENT_REGISTRY, SAAS_SUBSCRIPTION_MASTER
    - Login works with the mobile number + password just created
    - On an Android phone (Chrome), open the site — the "Install
      Balaji NextGen" banner should appear near the bottom within a
      few seconds; tapping Install should add a home-screen icon.
    - On iPhone (Safari), the banner should say "Tap Share then Add
      to Home Screen" instead (iOS doesn't support auto-install
      banners — this is an Apple platform limitation, not a bug).

STILL OPEN / KNOWN GAP
------------------------
- assets/Logos/logo.png is referenced in the HTML, manifest.json, and
  sw.js but not included in this zip (I don't have your actual logo
  file) — the app falls back to an emoji automatically in-app, but
  the manifest icons need a REAL png at that path for the install
  banner/home-screen icon to look right instead of blank.
- Data currently syncs as one JSON blob (APP_DATA tab), not
  row-by-row into CUSTOMERS/ITEMS/etc. Let me know if you want that
  upgraded next.
