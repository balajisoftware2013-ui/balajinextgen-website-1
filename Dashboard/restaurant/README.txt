BALAJI NEXTGEN ERP — KITCHEN/INVENTORY FIX PACKAGE
====================================================
Generated: 17 July 2026

🔴🔴🔴 CRITICAL CORRECTION — READ THIS FIRST 🔴🔴🔴
====================================================
Everything below about 08_CoreRouter.gs and 08_CoreRouter_COMPLETE.gs
was going into a file that NEVER ACTUALLY RUNS. Proven by exact string
match: your live /exec URL returns "Balaji NextGen Restaurant ERP API
is live (v3 - 3-database architecture)" — that message only exists in
a DIFFERENT file (your "Code.gs" / Code_RestaurantERP.gs, the one with
its own doPost/doGet/route()). Since both files declared top-level
doPost/doGet, Apps Script silently picked that one, not
08_CoreRouter.gs — no matter what was correctly written in the router.

USE THIS FILE INSTEAD: Code_RestaurantERP_v4_ACTUAL_LIVE_FILE.gs

This is your real, live Code.gs (v3) with the actual bugs fixed:
  - SAVE_KITCHEN_INDENT now accepts items[] batch — THIS is what was
    causing the blank ITEM_NAME/UNIT/REQUIRED_QTY bug this whole time.
    v3 only read a single top-level item, never looked inside items[].
  - GET_ITEMS added — reads 34_ITEM_MASTER (confirmed by v3's own
    comments as where real data lives, not the empty ITEM_MASTER tab)
  - SYNC_PUSH_TABLE/SYNC_PULL_ALL — real implementation (v3 explicitly
    returned "not implemented" for push)
  - GET_CONSUMPTION_HISTORY added
  - SAVE_BAR_INDENT / bar-aware GET_PENDING_INDENTS / APPROVE_ISSUE_INDENT added

DO THIS:
1. Paste Code_RestaurantERP_v4_ACTUAL_LIVE_FILE.gs's content over your
   live Code.gs file (the one that actually says "v3 - 3-database
   architecture" when you hit the URL directly)
2. Deploy → Manage deployments → New version → Deploy
3. ALSO CHECK: 07_ERPDatabaseRouter.gs and 09_MainRouter.gs — both
   sound like they could ALSO define doPost/doGet. If they do, you
   have 3+ competing entry points. Search each for "function doPost"
   and "function doGet" and remove/rename any that shouldn't be live.
4. Test SAVE_KITCHEN_INDENT and GET_ITEMS again — both should finally
   work correctly.

You can ignore 08_CoreRouter_COMPLETE.gs and everything said about it
below — it may still be useful as a reference for action names/shapes,
but it's not the file to actually deploy.


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

L) ADD NEW DEPARTMENT ("department can add")
   The Department dropdown was a fixed list (Main Kitchen, Bakery,
   Bar, Staff Kitchen, Banquet). Added "➕ Add New Department…" as the
   last option — selecting it prompts for a name and adds it to the
   dropdown. Saved to localStorage so it persists across visits on
   this device (this is just the picklist, not indent data — the
   actual submitted indent still goes to the real backend as before).

M) CATEGORY FIELD ON "ITEM NOT IN LIST" ("add category can add option")
   The custom-item modal had no category field. Added a dropdown
   populated from real categories already in the item list, plus a
   free-text field for a genuinely new category. Since the real
   KITCHEN_INDENT sheet has no separate category column, this is
   folded into REMARKS as "Category:X — notes" for custom items only
   (real master-list items don't need this, their category already
   comes from ITEM_MASTER).


=====================================================
🔴 CRITICAL FINDING — YOUR LIVE DEPLOYMENT IS OUT OF SYNC
=====================================================
Proof: kitchen-indent.html called GET_ITEMS and got back:
  {"success":false,"message":"Unknown action: GET_ITEMS"}

But GET_ITEMS is a real, working case in the 08_CoreRouter.gs you
shared with me earlier in this conversation. This means your LIVE
Apps Script project's 08_CoreRouter.gs does NOT match what you've
shown me — some cases are missing from what's actually deployed.

This is almost certainly the SAME root cause as:
  - The blank ITEM_NAME/UNIT/REQUIRED_QTY bug in SAVE_KITCHEN_INDENT
  - GET_CONSUMPTION_HISTORY not being found earlier
  - Possibly other silent failures you haven't hit yet

THE FIX: this zip includes 08_CoreRouter_COMPLETE.gs — a full,
verified copy of the router with every case confirmed from this
entire conversation (including GET_ITEMS and the new
GET_CONSUMPTION_HISTORY).

DO THIS:
1. Open Apps Script → open your live 08_CoreRouter.gs file
2. Select all its content, delete it, paste in
   08_CoreRouter_COMPLETE.gs's content instead (or carefully diff the
   two if you have custom cases in your live version that aren't in
   this file — don't blindly overwrite if so, merge instead)
3. Also double check 46_LiveInventoryBridge.gs matches what's been
   shown in this conversation, especially INV_saveKitchenIndent (the
   batch items[] handling) and INV_getItems
4. Deploy → Manage deployments → edit the active deployment →
   Version: New version → Deploy
5. Test GET_ITEMS and SAVE_KITCHEN_INDENT again — both should work
   correctly once the live code actually matches what's in the editor


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
3. wastage-entry.html — WHAT CHANGED
=====================================================

Good news: submitWastage() here was ALREADY correctly wired to the real
backend (SAVE_WASTAGE) — payload shape matches INV_saveWastage exactly.
Only two things needed fixing:

A) SAME LOGIN BUG AS THE OTHER FILES
   Wrong erp-config.js path (../erp-config.js instead of same-folder),
   and a broken ERP.requireLogin() call (doesn't exist on the real ERP
   object) that referenced loadDashboardData() — a function that
   doesn't exist in this file either (same copy-paste-from-
   chef-dashboard.html pattern as before). This block didn't actually
   break page functionality (the real init already ran as separate
   top-level script calls before this block), but it did throw a
   console error on every single page load. Fixed the same way as the
   other files.

B) WASTAGE LOG WAS LOCALSTORAGE-ONLY (no cross-device sync)
   Entries were correctly saved to the backend on submit, but nothing
   ever loaded them back — so a supervisor checking from a different
   device/browser would never see wastage logged elsewhere. Added
   loadRealWastageLog(), called on page load, which fetches the real
   GET_WASTAGE_LOG (already built server-side) and uses it as the
   source of truth for History and the KPI cards.


=====================================================
4. Restrostock_pro_inventory.html — NOT YET FIXED
=====================================================
Quick scan only (not requested yet): has the same wrong erp-config.js
path (../erp-config.js instead of same-folder) on line 5. No fake data
arrays or requireLogin bug found. Ask if you want this one done too.


=====================================================
5. bar_module.html — WHAT CHANGED
=====================================================

The bar "Indent to Store" tab's item list (DREG_ITEM_MASTER) was a
permanently hardcoded liquor list (Beer, Rum, Vodka, Gin, Whisky, etc)
with no connection to any real bar item master — so a new bottle SKU
added to your real inventory would never show up here.

Added loadRealBarItemMaster(), which fetches BAR_B1_ITEM_MASTER via
the already-generic FETCHSHEET action (no new backend code needed —
this action already works for any tab name) and groups it by category
to replace the hardcoded list. Falls back to the hardcoded list if
that sheet is empty, missing, or doesn't have recognizable columns.

⚠️ IMPORTANT: I have not confirmed BAR_B1_ITEM_MASTER's actual real
column names (unlike the other BAR_B* sheets, which were verified
directly from your screenshots/reports). The code tries a few common
variants (ITEM_NAME/NAME/STORE ITEM NAME for the item, CATEGORY/GROUP
for category) — if none match, it silently keeps the fallback list
rather than breaking the screen. If it's not picking up real data,
send me BAR_B1_ITEM_MASTER's actual header row and I'll match it
exactly instead of guessing at variants.

Note: category was ALREADY being sent correctly for real indent
submissions (SAVE_BAR_INDENT already includes category per item) —
this fix is specifically about the ITEM LIST shown to select from,
not the indent submission itself.


=====================================================
CONFIRMED — SAVE_KITCHEN_INDENT BUG IS 100% BACKEND-SIDE
=====================================================
After many rounds of diagnostics, this is now PROVEN, not theorized:

  [erpApi] → SAVE_KITCHEN_INDENT {...real items, real qty...}
  [erpApi] ← SAVE_KITCHEN_INDENT {"success":true}

The frontend sends a completely correct payload. The backend reports
success. But the resulting row in KITCHEN_INDENT still has blank
ITEM_NAME/UNIT/REQUIRED_QTY. This means the LIVE Apps Script function
is accepting the request and reporting success without actually using
the items[] array to populate the row — almost certainly because the
live version differs from what was shared in this conversation.

ACTION NEEDED: open the Apps Script editor, copy the ACTUAL live
INV_saveKitchenIndent function's full code, and send it over. This is
the only way to fix this for real instead of guessing further.


=====================================================
6. inventory.html + purchase-module.html — DATA CONNECTION
=====================================================

MAJOR FINDING: these two files (plus Restrostock_pro_inventory.html)
share ONE local data system — everything lives in browser localStorage
(BALAJI_SHARED_DB / BALAJI_INVENTORY_DB / BALAJI_PROCUREMENT via a
DB/InvBridge engine), completely separate from the real ITEM_MASTER/
PURCHASE_MASTER sheets used by kitchen-indent.html and friends.

inventory.html tries to sync this local data to the backend via
SYNC_PUSH_TABLE and SYNC_PULL_ALL — but NEITHER action existed
anywhere in the router. This sync has never worked, for any table,
ever — not just login_history as first suspected.

YOUR DECISION: build the missing sync generically, keeping Inventory/
Purchase as their own separate local-table schema (faster than
rewiring them onto the real ITEM_MASTER/PURCHASE_MASTER schema, but
means this stays a second, parallel dataset rather than one unified
system — you can revisit unifying them later if you want).

WHAT WAS BUILT:
- ADD_TO_46_LiveInventoryBridge_SYNC.gs — INV_syncPushTable and
  INV_syncPullAll. Each local "table" gets its own real sheet in
  TRANSACTION_DB named SYNC_<TABLE> (e.g. SYNC_ITEMS,
  SYNC_STOCK_LEDGER, SYNC_PURCHASE_INVOICES) — the SYNC_ prefix keeps
  these clearly separate from your real schema sheets, no collision
  risk. Add the 2 router cases shown at the bottom of that file to
  08_CoreRouter.gs (also already added to 08_CoreRouter_COMPLETE.gs
  in this zip).
- inventory.html — fixed a duplicate erp-config.js include (two
  separate includes, two different wrong paths: ../erp-config.js and
  ../../erp-config.js) down to one correct same-folder include.
- purchase-module.html — this file never pulled anything from the
  backend itself; it only ever saw real data if inventory.html
  happened to be opened first in the same browser (shared localStorage
  keys). Added its own independent pull (pullInventorySyncData()),
  called on page load, so it works standalone.

WHAT THIS DOES NOT DO: it does not connect Inventory/Purchase's items,
vendors, stock, etc to the same ITEM_MASTER/PURCHASE_MASTER/GRN_DETAIL
sheets kitchen-indent.html and purchase history elsewhere in the app
use. That would need the other option (rewiring these files to call
GET_ITEMS/SAVE_STOCK_ADJUSTMENT/etc directly) — a bigger job, available
if you want it done later.


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
