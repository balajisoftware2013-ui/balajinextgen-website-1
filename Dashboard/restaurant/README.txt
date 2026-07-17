BALAJI NEXTGEN ERP — KITCHEN/INVENTORY FIX PACKAGE
====================================================
Generated: 17 July 2026

FILES IN THIS ZIP
------------------
1. kitchen-indent.html  — Kitchen Indent screen, fully rewired
2. chef-dashboard.html  — Chef/Kitchen Command dashboard, session bug fixed
3. erp-config.js        — Shared session config, session-key bug fixed

=====================================================
1. kitchen-indent.html — WHAT CHANGED
=====================================================

A) DIAGNOSTIC LOGGING (still active — remove once the save bug is confirmed fixed)
   Every backend call now prints to Console:
     [erpApi] → ACTION_NAME {...full outgoing payload as JSON...}
     [erpApi] ← ACTION_NAME {...full response as JSON...}
   Use this to confirm SAVE_KITCHEN_INDENT is sending real item data.

B) REAL ITEM LIST ("indent items load default")
   The item list was a permanently hardcoded array (INDENT_ITEMS), never
   synced with your real item master. Now:
     - Renamed to INDENT_ITEMS_FALLBACK (used only if the server can't
       be reached — offline safety net, not the primary source anymore)
     - loadRealItems() fetches GET_ITEMS from the backend on page load
       and replaces the list with your real ITEM_MASTER data
   If your item master changes, this screen now reflects it automatically.

C) KEYBOARD UP/DOWN ARROWS on quantity fields
   ArrowUp = +1, ArrowDown = -1 (never goes below 0), and immediately
   updates the running total — same as typing a number.

D) DATE-RANGE FILTER ON INDENT HISTORY ("day/month/qtr/year/custom date")
   Added filter buttons: Today, This Week, This Month, This Quarter,
   This Year, All Time, plus a custom From/To date range with an
   "Apply" button. Defaults to "Today" on load.
   NOTE: parses your backend's real DATE format (dd-MM-yyyy) explicitly,
   since browsers commonly misread that format as MM-dd-yyyy otherwise.

E) REAL "VIEW" MODAL (was a placeholder toast before)
   Clicking "View" on any indent (History or Pending) now opens a real
   detail popup: item, qty requested, requested by, full dept/shift/
   priority context, and status. If still pending, includes an editable
   "Issue Qty" field so Store can adjust the amount before approving —
   not just approve the full requested qty blindly.

F) PRINT / PDF ("can print proper format")
   "Print / PDF" button in the View modal opens a clean, formatted
   printable page. Choosing "Save as PDF" in the browser's print dialog
   produces a real PDF file.

G) WHATSAPP SHARE ("whatsapp both text and pdf copy direct shared")
   "WhatsApp" button in the View modal sends a formatted text summary
   via wa.me (or copies to clipboard if no number is saved yet).
   IMPORTANT LIMITATION: WhatsApp does not allow any website or browser
   script to silently attach a file to a message — this is a WhatsApp
   platform restriction, not something fixable in this file. The real
   flow is: (1) Print/PDF → Save as PDF, (2) WhatsApp button → opens
   chat with text pre-filled, (3) manually attach the saved PDF using
   WhatsApp's own attach button. There is no client-side way to skip
   step 3 without WhatsApp's paid Business API (server-side, not
   something a static HTML page can do).

H) REAL SUMMARY TILES
   "Pending Approval" and "Received Today" were hardcoded (3 and 2).
   Now computed from real fetched data.

I) APPROVE/REJECT NOW ACTUALLY CALL THE BACKEND
   Previously these buttons only showed a toast and did nothing.
   Now call APPROVE_ISSUE_INDENT for real, then refresh both lists.

J) ADD ITEM NOT IN THE MASTER LIST ("item can add chef if not in his list")
   New "➕ Item Not In List" button next to the search box. Opens a
   small form (name, unit, qty, remarks) — added items show in their
   own "Items Not In List" section below the main table. On submit,
   these are merged into the SAME SAVE_KITCHEN_INDENT call as the
   regular items — Store sees one combined indent, not two separate
   ones. Custom items are tagged "(NOT IN LIST)" in ITEM_NAME so
   Store/kitchen staff can spot them at a glance in the sheet.

K) KEYBOARD UP/DOWN ARROWS — also added to the custom-item qty field
   (was already on the main table's qty fields from the previous
   round). Pressing Up/Down while focused in either now increments/
   decrements by 1, never below 0.


=====================================================
2. kitchen-consumption.html — WHAT CHANGED
=====================================================

A) LOGIN BUG FIXED (same pattern as chef-dashboard.html)
   Was calling ERP.requireLogin() — a method that doesn't exist on the
   real ERP object — with the wrong erp-config.js path (../../ instead
   of same-folder). Fixed both. ALSO found and removed a second,
   completely duplicate erp-config.js include with its own broken
   login block that referenced loadDashboardData() — a function that
   doesn't even exist in this file (copy-pasted from chef-dashboard.html
   by mistake, never belonged here).

B) NEW BACKEND ACTION NEEDED — GET_CONSUMPTION_HISTORY
   This file already called kcApi('GET_CONSUMPTION_HISTORY', {}) —
   but that action never existed anywhere in your GAS backend, so it
   always failed silently. See ADD_TO_46_LiveInventoryBridge.gs in
   this zip — paste that function into 46_LiveInventoryBridge.gs, and
   add the one router case shown at the bottom of that file into
   08_CoreRouter.gs. Then redeploy (Deploy → Manage deployments →
   New version).

C) REAL DATA EVERYWHERE ("load data all")
   CONSUMPTION_DATA, WASTAGE_DATA, VARIANCE_DATA were all hardcoded
   fake arrays — matching the suspiciously round demo numbers you saw
   (₹14,280 today consumed, etc). Now:
     - Entry tab's "Today's Consumption" table shows real entries for
       today, filtered from real loaded history
     - History tab shows real consumption history
     - Wastage tab calls the already-built GET_WASTAGE_LOG action
     - Category Analysis, 7-day trend, and Top Items are all computed
       from real data, not fabricated
     - The 6 KPI summary cards at the top (Today Consumed, Wastage,
       category totals, Entries) were hardcoded directly in the HTML
       itself — not even JS-rendered before. Now computed for real.

D) IMPORTANT SCHEMA GAP — "estimated" values, clearly labeled
   Your real KITCHEN_CONSUMPTION sheet only stores DATE, ITEM_NAME,
   UNIT, ISSUED qty, ENTERED_BY — no rate, category, chef name, or
   shift. There is no historical rate-at-time-of-use recorded. So all
   ₹ values shown are ESTIMATES using each item's CURRENT cost price
   from ITEM_MASTER (joined by item name) — labeled "(est.)" everywhere
   they appear, rather than presented as exact historical figures.
   Category is also pulled from ITEM_MASTER the same way. Chef/shift
   columns show "—" since that data isn't recorded anywhere real yet.

E) VARIANCE TAB — honest placeholder, not fake numbers
   A real theoretical-vs-actual variance report needs recipe/BOM data
   (ingredient qty per dish) linked to sales — your RECIPE_MASTER is
   confirmed empty for both CL00010 and CL00011. Rather than show fake
   numbers, this tab now explains clearly what's needed before it can
   show anything real.

F) STILL HARDCODED, NOT TOUCHED (flagging honestly, not silently left)
   "⚠ 3 Low Stock Items" and "✓ Synced to Inventory" badges near the
   top are still static text — computing real low-stock count needs
   comparing ITEM_MASTER's STOCK vs MIN_STOCK, which is a quick
   addition if you want it done next.


=====================================================
STILL UNRESOLVED — NEEDS YOUR ACTION
=====================================================

⚠️ BLANK ITEM_NAME / UNIT / REQUIRED_QTY BUG
   This has been tested across many rounds. The frontend code (this
   file) sends the item data correctly — confirmed by re-reading it
   multiple times. Evidence points to the LIVE APPS SCRIPT DEPLOYMENT
   running an OLDER version of INV_saveKitchenIndent than what you
   showed me — one that predates batch-items support.

   PROOF: the DATE column in your sheet shows "17/07/2026 05:12:05"
   (slash format, includes time) — but the code you shared produces
   "17-07-2026" (dash format, date only) via
   Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy').
   These don't match — meaning the deployed function differs from the
   one reviewed.

   ACTION NEEDED:
   1. Open Apps Script editor → find the LIVE INV_saveKitchenIndent
      function → compare it line-by-line against what you originally
      sent me. If it's different, that's the bug.
   2. Deploy → Manage deployments → edit the active deployment →
      Version: New version → Deploy (same step as the earlier crash
      fix — Apps Script does NOT auto-update a deployed /exec URL when
      you save code changes in the editor).
   3. After redeploying, submit one test indent and check the Console
      for the [erpApi] → SAVE_KITCHEN_INDENT log line — screenshot it
      and send it over to confirm the payload looks right.

⚠️ erp-shared.css / erp-shared.js — still 404
   Referenced via ../../css/erp-shared.css and ../../js/erp-shared.js.
   Confirm whether these files actually exist anywhere in your Netlify
   project. If not, this is a missing shared asset, not a path bug.

⚠️ login_history LiveSync push — still failing
   The warning "[LiveSync] push failed for login_history" comes FROM
   YOUR BACKEND (whatever function handles SYNC_PUSH_TABLE), not from
   inventory.html. Send me that .gs file if you want this fixed —
   I can't guess the correct sheet/column mapping without seeing it.

⚠️ purchase-module.html — reviewed, looks correctly wired
   CLIENT_ID resolution, SAVE_PURCHASE_INVOICE/SAVE_GRN/etc. all call
   the real backend with proper error handling already. No changes
   made — let me know if you see a specific bug here.

⚠️ inventory.html Dashboard — still needs confirmation
   Never got confirmation on whether clicking the 🏠 Dashboard nav tab
   shows real data or stays blank. The screen you showed me was
   actually the "Dept Issue Register" panel, a different tab.
