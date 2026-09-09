/**
 * BALAJI NEXTGEN ERP v3.0 -- GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * Backend Business Day: 06:00 AM → next day 06:00 AM.
 * MERGED BUILD (Sep 2026) -- single Code.gs. This is the ONLY .gs file that
 * should exist in this Apps Script project. Delete every other .gs file.
 *
 * This build folds in, on top of the PASS #1-65 history already documented
 * below:
 *   - PASS #65 v2 "LIST_BILLS payment mode always blank": bnxListBills now
 *     returns a real per-bill payBreakdown ({CASH,CARD,UPI,OTHER}) joined
 *     from PAYMENT_MASTER, plus isSplitPayment, alongside the original
 *     `pay` (dominant mode) field kept for backward compatibility.
 *   - bnxRebuildStockBalance v2: REORDER_LEVEL is now synced from
 *     ITEM_MASTER (hasOwnProperty-checked so "no ITEM_MASTER row" is never
 *     confused with "REORDER_LEVEL 0"), and every active ITEM_MASTER item
 *     that has never had a single STOCK_MOVEMENT row now gets a seeded
 *     zero-quantity STOCK_BALANCE row so Low Stock alerts can actually see
 *     it once it's genuinely out of stock.
 *   - Petty Cash real persistence (SAVE_PETTY_CASH / GET_PETTY_CASH_LEDGER)
 *     backed by a new PETTY_CASH_MASTER sheet with a server-computed
 *     running balance, replacing the old dashboard-only localStorage
 *     register that never reached the backend at all.
 *   - Real Online Orders list (GET_ONLINE_ORDERS_LIST) reading actual rows
 *     out of ONLINE_ORDER_MASTER (already written by SAVE_ONLINE_ORDER),
 *     for the operational Online Orders page's table -- separate from the
 *     Reports Hub's GET_ONLINE_ORDER_REPORT aggregate, which was already
 *     real and unaffected by this change.
 *
 * REQUIRED MANUAL SHEET CHANGE for Petty Cash to work: create a
 * PETTY_CASH_MASTER tab in the client's TEMPLATE_TRANSACTION_DB (copy the
 * format of any other transaction tab) with these columns:
 *   PETTY_CASH_ID, CLIENT_ID, LOCATION_ID, VOUCHER_NO, ENTRY_DATE,
 *   ENTRY_TYPE, ACCOUNT, PARTY_NAME, PURPOSE, AMOUNT, NARRATION,
 *   RUNNING_BALANCE, CREATED_BY, CREATED_AT
 * Until that tab exists, bnxClientSheet() throws a clear "tab not found"
 * error naming the missing sheet -- it never silently falls back to fake
 * data.
 *
 * Passes merged, in order applied (earlier history, unchanged):
 *   PASS #48 (production-entry / menu-card upload) -- SAVE_PRODUCTION,
 *     SAVE_MENU_CARD_UPLOAD, PRODUCTION_MASTER/PRODUCTION_ITEMS/
 *     MENU_CARD_UPLOAD sheets.
 *   PASS #48-PERF ("check mapping and fix slow read data") -- CacheService
 *     wraps for 12 report endpoints, cached derived-maps for
 *     ITEM_MASTER/CATEGORY_MASTER/TAX_MASTER/UNIT_MASTER lookups (with
 *     invalidation on write), and a date-bounded bnxListBills.
 *   PASS #49 ("add address and logo upload") -- COMPANY_SETTINGS gets
 *     ADDRESS/PHONE/EMAIL/FSSAI/LOGO_URL support, a real UPLOAD_LOGO
 *     action backed by Drive (not a Sheets cell), and bnxGetClientInfo
 *     returns these local fields.
 *   PASS #51 ("discount not recorded / round-off problem") -- bnxSaveBill
 *     now reads the real bill.disc the frontend sends instead of
 *     hardcoding 0, and ROUND_OFF is computed against the discounted
 *     taxable amount instead of silently absorbing the whole discount.
 *   PASS #52 -- bnxClientSheet() implemented for real: routes every
 *     (clientId, sheetName) pair to the correct one of the client's THREE
 *     per-client spreadsheets (MASTER_DB / TRANSACTION_DB / REPORT_DB),
 *     via CLIENT_DATABASE_REGISTRY in the central master-control sheet.
 *   PASS #53 -- backdated/offline-synced order & bill dates
 *     (bnxResolveClientDateTime_), and the staff-creation fix that also
 *     writes to the central USER_SECURITY_MASTER_DB so Steward login
 *     actually works.
 *   PASS #54 -- real ROLE_NAME resolution in bnxGetStaffList (was showing
 *     raw ROLE_ID strings like "ROLE_STEWARD_CL00010").
 *   PASS #55 -- GET_DSR_YTD: a real Year-to-Date aggregate, separate from
 *     the single-month bnxGetDsrMatrix.
 *   PASS #56 -- REBUILD_STOCK_BALANCE: on-demand recompute of every
 *     item's CURRENT_QUANTITY from the full real STOCK_MOVEMENT ledger,
 *     upserted into STOCK_BALANCE (which was previously empty). Not yet
 *     wired to run automatically on every sale/purchase -- see that
 *     function's own header comment for why.
 *   PASS #57 -- GET_ITEM_UNIT_CONVERSIONS: real per-item pack-size/
 *     bottle-size lookup, gated on three new UNIT_MASTER columns
 *     (UNITS_PER_PACK/UNIT_SIZE/BASE_UOM) that must be added manually
 *     first. Returns an honest empty map until those columns exist and
 *     are filled in -- never guesses. Frontend wiring into bar_module.html
 *     intentionally deferred -- see that function's header comment for
 *     the real blocker (no ITEM_ID/SKU linkage on Code Master rows yet).
 *   PASS #58 ("discount and round off and bill master record wrong") --
 *     bnxImportPosHeadBatch_ now reads the source file's real
 *     totalAmountAfterDiscount column for SUBTOTAL_AFTER_ITEM_DISCOUNT
 *     instead of reusing taxableAmount (which already excludes tax-free
 *     items and made ROUND_OFF silently absorb the tax-free portion --
 *     e.g. a bill with a real 0.72 round-off was showing 1876.72).
 *     bnxAppendRow no longer turns legitimate 0 values (TAX_AMOUNT,
 *     ROUND_OFF on fully tax-exempt bills) into blank cells -- it used
 *     `rowObject[header] || ''`, and 0 is falsy in JS. CLEAR_TEST_DATA
 *     now clears every real transactional table in TEMPLATE_TRANSACTION_DB
 *     (previously only 8 of ~45), so "clear all transaction data" actually
 *     does that instead of leaving most tables dirty.
 *   PASS #64 ("2nd KOT not save / bill print delay / address+logo") --
 *     bnxSaveOrder is no longer strictly insert-only: when the same real
 *     ORDER_NUMBER already has a live (not billed/cancelled) ORDER_MASTER
 *     row for this client, a second SAVE_ORDER call (add-on items, a
 *     second station's KOT, a retry) now APPENDS the new ORDER_ITEMS onto
 *     that same order instead of silently creating a second, disconnected
 *     ORDER_MASTER row under the same friendly order number -- which is
 *     what was actually happening every time an add-on KOT was sent
 *     ("2nd KOT not save" only looked like a save failure; it was really
 *     saving into an invisible duplicate order row). SYNC_LOG dedup
 *     (bnxCheckDuplicate/bnxClaimRequest/bnxMarkSynced), used by every
 *     single SAVE_* action, no longer does a full O(n) scan of the whole
 *     SYNC_LOG sheet on every call -- confirmed via the app's own
 *     [BN_HEALTH] console log averaging ~7.7s per API call, and SYNC_LOG
 *     grows by one row on every order/KOT/bill/payment ever synced, so
 *     that scan (done TWICE per save -- once to claim, once to mark
 *     synced) only gets slower over time. Now backed by a CacheService
 *     lookup keyed by requestId, falling back to the full scan only on a
 *     genuine cache miss (first time seeing that requestId, or a >6h-old
 *     retry) -- same dedup guarantee, far fewer full-sheet reads. This is
 *     the concrete fix for "bill print click delay, make it super fast."
 *     Address/Logo: COMPANY_SETTINGS ADDRESS/PHONE/EMAIL/FSSAI/LOGO_URL
 *     support (PASS #49) and UPLOAD_LOGO were already real and already
 *     wired end-to-end on both frontend and backend before this pass --
 *     nothing to fix in code. If address/logo still aren't saving, the
 *     one remaining step is the manual one flagged since PASS #49: add
 *     ADDRESS, PHONE, EMAIL, FSSAI, LOGO_URL columns to the REAL
 *     COMPANY_SETTINGS sheet tab (not this file) -- bnxSaveMaster/
 *     bnxUploadLogo silently no-op on any column that doesn't exist yet.
 *
 * TWO THINGS FROM THE OLD STANDALONE PASS #51 PATCH FILE WERE DELIBERATELY
 * **NOT** CARRIED OVER -- flagging honestly rather than guessing:
 *   1. That patch called bnxResolveClientDateTime_(bill.billDate,
 *      bill.billTime) for backdated-bill support. PASS #53 below now
 *      defines that function for real and wires it into bnxSaveBill AND
 *      bnxSaveOrder.
 *   2. That patch also switched BILL_ID/BILL_ITEM_ID/PAYMENT_ID/
 *      STOCK_MOVEMENT_ID from generateShortId_(...) to generateUUID().
 *      Every other function that writes to these same sheets (including
 *      the historical importer) still uses generateShortId_, so making
 *      that change ONLY inside bnxSaveBill would leave two different ID
 *      formats live in the same columns. Kept generateShortId_ throughout
 *      for consistency -- tell me if the UUID switch was intentional.
 *
 * PASS #18 ("login shows Demo Company but User Master / Client Master
 * already has real details"). CL00010's real company details live in a
 * SEPARATE spreadsheet -- the central USER_SECURITY_MASTER_DB (the same
 * one login already authenticates against). Sheet ID below taken directly
 * from the real USER_SECURITY_MASTER_DB URL. TAB_NAME is a best guess; if
 * wrong, bnxLookupClientMaster_ falls back to that spreadsheet's first
 * sheet, but confirm the real tab name and hardcode it for certainty.
 *
 * NOTE ON SCOPE: the separate ALL-CLIENT DATABASE MIGRATION ENGINE and
 * NEW CLIENT DATABASE CREATOR scripts are intentionally NOT merged into
 * this file. Both explicitly live in their own standalone Apps Script
 * project (BALAJI_NEXTGEN_ERP_V2_CORE per their own header comments) --
 * they define their own doGet(e), their own CFG/registry conventions,
 * and are a one-time/occasional onboarding & migration tool, not a
 * request handler this doPost() should share a global scope with.
 * Keep them in their own project. Say the word if you want them merged
 * in anyway and I'll do it deliberately (checking for name collisions
 * first), rather than silently combining two different projects.
 * ============================================================================
 */
const CLIENT_MASTER_DB_ID = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg';
const CLIENT_MASTER_TAB_NAME = 'CLIENT_MASTER';

/* =========================================================================
 * PASS #52 -- per-client 3-database routing (MASTER / TRANSACTION / REPORT)
 * ========================================================================= */

const CLIENT_DB_REGISTRY_SS_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';
const CLIENT_DB_REGISTRY_TAB = 'CLIENT_DATABASE_REGISTRY';
// CL00010 verified from BALAJI_ERP_MASTER_CONTROL_SYSTEM:
// MASTER_DB_ID      = 1ToXiZjH8a0Po...Sl-dDo
// TRANSACTION_DB_ID = 1rgCm4OlSGrBR...yHuDvQ0
// REPORT_DB_ID      = 12ND41xKVJDe...q3C3Q
// The full IDs MUST continue to come from CLIENT_DATABASE_REGISTRY at runtime.


const BNX_SHEET_DB_MAP_ = {
  // ---- TEMPLATE_MASTER_DB ----
  COMPANY_SETTINGS: 'MASTER', LOCATION_MASTER: 'MASTER', USER_MASTER: 'MASTER', ROLE_MASTER: 'MASTER', ITEM_GROUP_MASTER: 'MASTER', MENU_CARD_ITEMS: 'MASTER', MENU_ITEM_CATEGORY_LIST: 'MASTER', ITEM_MASTER_REVIEW: 'MASTER', LIQUOR_MASTER: 'MASTER', BAR_STOCK: 'MASTER',
  ITEM_MASTER: 'MASTER', CATEGORY_MASTER: 'MASTER', BAR_MENU_CARD: 'MASTER', UNIT_MASTER: 'MASTER', UNIT_CONVERSION_MASTER: 'MASTER',
  TAX_MASTER: 'MASTER', SUPPLIER_MASTER: 'MASTER', CUSTOMER_MASTER: 'MASTER', RAW_MATERIAL_MASTER: 'MASTER',
  TABLE_MASTER: 'MASTER', PAYMENT_MODE_MASTER: 'MASTER', LEDGER_MASTER: 'MASTER', RECIPE_MASTER: 'MASTER',
  RECIPE_ITEMS: 'MASTER', BAR_ITEM_MASTER: 'MASTER', ITEM_ALIAS_MASTER: 'MASTER', RECIPE_VERSION: 'MASTER',

  // ---- TEMPLATE_TRANSACTION_DB ----
  DAY_STATUS: 'TRANSACTION', SEQUENCE_COUNTERS: 'TRANSACTION', TABLE_LIVE_STATE: 'TRANSACTION',
  RESERVATION_MASTER: 'TRANSACTION', ORDER_MASTER: 'TRANSACTION', ORDER_ITEMS: 'TRANSACTION',
  KOT_MASTER: 'TRANSACTION', KOT_ITEMS: 'TRANSACTION', KOT_STATUS_LOG: 'TRANSACTION', KDS_TICKET: 'TRANSACTION', KDS_STATUS_LOG: 'TRANSACTION',
  BILL_MASTER: 'TRANSACTION', BILL_ITEMS: 'TRANSACTION', PAYMENT_MASTER: 'TRANSACTION',
  STOCK_BALANCE: 'TRANSACTION', STOCK_MOVEMENT: 'TRANSACTION', STOCK_ADJUSTMENT: 'TRANSACTION', STOCK_TRANSFER: 'TRANSACTION',
  KITCHEN_PRODUCTION: 'TRANSACTION', KITCHEN_WASTAGE: 'TRANSACTION', KITCHEN_REMAKE: 'TRANSACTION', PRODUCTION_MASTER: 'TRANSACTION', PRODUCTION_ITEMS: 'TRANSACTION', MENU_CARD_UPLOAD: 'TRANSACTION',
  ATTENDANCE_MASTER: 'TRANSACTION', SHIFT_TRANSACTION: 'TRANSACTION', LEAVE_TRANSACTION: 'TRANSACTION', PAYROLL_MASTER: 'TRANSACTION',
  CUSTOMER_DUES: 'TRANSACTION', SALARY_ADVANCE: 'TRANSACTION', INCENTIVE_TRANSACTION: 'TRANSACTION', PF_ESIC_TRANSACTION: 'TRANSACTION',
  TALLY_QUEUE: 'TRANSACTION', DUES_RECEIPT: 'TRANSACTION', SUPPLIER_DUES: 'TRANSACTION',
  MIGRATION_ID_MAP: 'TRANSACTION', MIGRATION_LOG: 'TRANSACTION', WASTAGE_MASTER: 'TRANSACTION', KITCHEN_CONSUMPTION: 'TRANSACTION',
  BAR_INDENT: 'TRANSACTION', KITCHEN_INDENT: 'TRANSACTION', JOURNAL: 'TRANSACTION', LEDGER_ENTRIES: 'TRANSACTION',
  DAILY_COLLECTION: 'TRANSACTION', ONLINE_ORDER_MASTER: 'TRANSACTION', PURCHASE_INDENT: 'TRANSACTION', PURCHASE_RFQ: 'TRANSACTION',
  PURCHASE_QUOTATION: 'TRANSACTION', PURCHASE_ORDER: 'TRANSACTION', PURCHASE_ORDER_ITEMS: 'TRANSACTION',
  GOODS_RECEIPT_NOTE: 'TRANSACTION', GRN_ITEMS: 'TRANSACTION', PURCHASE_INVOICE: 'TRANSACTION', PURCHASE_INVOICE_ITEMS: 'TRANSACTION',
  PURCHASE_RETURN: 'TRANSACTION', PURCHASE_RETURN_ITEMS: 'TRANSACTION', PURCHASE_PAYMENT: 'TRANSACTION',
  ONLINE_ORDER_ITEMS: 'TRANSACTION', AGGREGATOR_SETTLEMENT: 'TRANSACTION', AUDIT_LOG: 'TRANSACTION', SYNC_LOG: 'TRANSACTION', ERROR_LOG: 'TRANSACTION',
  // EDIT 2 (from the old report-engine header) -- these three tabs are
  // referenced elsewhere in this file via SHEETS.PURCHASE_MASTER /
  // SHEETS.PURCHASE_ITEMS / SHEETS.SALES_LEDGER but had no map entry,
  // so every call to them used to throw. Added for real.
  PURCHASE_MASTER: 'TRANSACTION', PURCHASE_ITEMS: 'TRANSACTION', SALES_LEDGER: 'TRANSACTION',
  // PETTY CASH PATCH -- new sheet for real Petty Cash persistence (see
  // top-of-file header). Requires the manual PETTY_CASH_MASTER tab to be
  // created in TEMPLATE_TRANSACTION_DB (see header comment).
  PETTY_CASH_MASTER: 'TRANSACTION',
  PETTY_CASH: 'TRANSACTION',
  A7_SETTINGS_TOGGLES: 'TRANSACTION',
  CASH_CONTROL: 'TRANSACTION', CASH_MOVEMENT: 'TRANSACTION',
  RATE_CONTRACT: 'TRANSACTION', VENDOR_RATING: 'TRANSACTION', VENDOR_RATE_CONTRACT: 'TRANSACTION',

  // ---- TEMPLATE_REPORT_ANALYTICS_DB ----
  REPORT_REGISTRY: 'REPORT', SALES_DAY_BOOK: 'REPORT', SALES_SUMMARY: 'REPORT', ITEM_SALES_REPORT: 'REPORT',
  CATEGORY_SALES_REPORT: 'REPORT', FOOD_COST_REPORT: 'REPORT', BAR_COST_REPORT: 'REPORT', STOCK_REPORT: 'REPORT',
  PURCHASE_REPORT: 'REPORT', SUPPLIER_REPORT: 'REPORT', GST_REPORT: 'REPORT', PAYMENT_REPORT: 'REPORT',
  CASH_BANK_REPORT: 'REPORT', CUSTOMER_DUES_REPORT: 'REPORT', SUPPLIER_DUES_REPORT: 'REPORT', PROFIT_LOSS_REPORT: 'REPORT',
  ONLINE_ORDER_REPORT: 'REPORT', AGGREGATOR_SETTLEMENT_REPORT: 'REPORT', HR_REPORT: 'REPORT', PAYROLL_REPORT: 'REPORT',
  KITCHEN_PERFORMANCE: 'REPORT', STEWARD_PERFORMANCE: 'REPORT', BAR_PERFORMANCE: 'REPORT', TABLE_PERFORMANCE: 'REPORT',
  WASTAGE_REPORT: 'REPORT', RECONCILIATION_REPORT: 'REPORT', DASHBOARD_KPI: 'REPORT', AI_ML_ANALYTICS: 'REPORT'
};

var _bnxOpenSpreadsheetCache_ = {};
function bnxOpenSpreadsheetCached_(ssId) {
  if (_bnxOpenSpreadsheetCache_[ssId]) return _bnxOpenSpreadsheetCache_[ssId];
  const ss = SpreadsheetApp.openById(ssId);
  _bnxOpenSpreadsheetCache_[ssId] = ss;
  return ss;
}

/* =========================================================================
 * PASS #67 -- AUTHORITATIVE CLIENT AUTO-PROVISIONING
 *
 * On the first authenticated request for a client, read CLIENT_DATABASE_REGISTRY
 * from the central master-control workbook. If any of MASTER_DB_ID,
 * TRANSACTION_DB_ID or REPORT_DB_ID is blank, create that database by copying
 * the exact template referenced by TEMPLATE_REGISTRY:
 *   TEM_MAST -> MASTER
 *   TEM_TXN  -> TRANSACTION
 *   TEM_RT   -> REPORT/ANALYTICS
 *
 * The copied spreadsheets are placed in the client's own Drive folder. The
 * newly-created Spreadsheet IDs and URLs are written back to the SAME
 * CLIENT_DATABASE_REGISTRY row. Existing IDs are never replaced.
 *
 * Login/password/session data remains in the central USER_SECURITY_MASTER_DB;
 * it is NOT copied into client databases. The authenticated USER_MASTER row
 * supplies the client identity and permissions, while this function supplies
 * only database provisioning/routing.
 * ========================================================================= */
const BNX_TEMPLATE_IDS_ = { MASTER: 'TEM_MAST', TRANSACTION: 'TEM_TXN', REPORT: 'TEM_RT' };
const BNX_CLIENT_DB_ROOT_FOLDER_NAME_ = 'BALAJI_NEXTGEN_CLIENT_DATABASES';

function bnxControlSheet_(name) {
  const ss = SpreadsheetApp.openById(CLIENT_DB_REGISTRY_SS_ID);
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(name + ' sheet not found in BALAJI_ERP_MASTER_CONTROL_SYSTEM');
  return sh;
}

function bnxFindHeaderIndex_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const p = headers.indexOf(String(names[i]).toUpperCase());
    if (p >= 0) return p;
  }
  return -1;
}

function bnxGetClientRegistryRow_(clientId) {
  const sh = bnxControlSheet_(CLIENT_DB_REGISTRY_TAB);
  const values = sh.getDataRange().getValues();
  if (!values.length) throw new Error(CLIENT_DB_REGISTRY_TAB + ' is empty');
  const headers = values[0].map(h => String(h == null ? '' : h).trim().toUpperCase());
  const ci = bnxFindHeaderIndex_(headers, ['CLIENT_ID']);
  if (ci < 0) throw new Error(CLIENT_DB_REGISTRY_TAB + ' missing CLIENT_ID column');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][ci] == null ? '' : values[r][ci]).trim() === String(clientId).trim()) {
      const obj = {};
      headers.forEach((h,c) => obj[h] = values[r][c]);
      obj._sheet = sh; obj._row = r + 1; obj._headers = headers;
      return obj;
    }
  }
  return null;
}

function bnxCreateClientRegistryRow_(clientId) {
  const sh = bnxControlSheet_(CLIENT_DB_REGISTRY_TAB);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => String(h == null ? '' : h).trim().toUpperCase());
  const cm = bnxLookupClientMaster_(clientId) || {};
  const out = headers.map(() => '');
  const set = function(name, value) { const c=headers.indexOf(name); if(c>=0) out[c]=value; };
  set('CLIENT_ID', clientId);
  set('COMPANY_NAME', cm.companyName || clientId);
  set('STATUS', 'ACTIVE');
  set('CREATED_ON', new Date().toISOString());
  sh.appendRow(out);
  return bnxGetClientRegistryRow_(clientId);
}

function bnxGetTemplateRow_(templateId) {
  const sh = bnxControlSheet_('TEMPLATE_REGISTRY');
  const values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('TEMPLATE_REGISTRY is empty');
  const headers = values[0].map(h => String(h == null ? '' : h).trim().toUpperCase());
  const idCol = bnxFindHeaderIndex_(headers, ['TEMPLATE_ID']);
  const sheetCol = bnxFindHeaderIndex_(headers, ['GOOGLE_SHEET_ID']);
  const statusCol = bnxFindHeaderIndex_(headers, ['STATUS']);
  if (idCol < 0 || sheetCol < 0) throw new Error('TEMPLATE_REGISTRY missing TEMPLATE_ID/GOOGLE_SHEET_ID');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol] == null ? '' : values[r][idCol]).trim() !== templateId) continue;
    const status = statusCol >= 0 ? String(values[r][statusCol] || '').trim().toUpperCase() : 'ACTIVE';
    if (status && status !== 'ACTIVE') throw new Error('Template ' + templateId + ' is ' + status + ' in TEMPLATE_REGISTRY');
    const row = {};
    headers.forEach((h,c) => row[h] = values[r][c]);
    return row;
  }
  throw new Error('Template ' + templateId + ' not found in TEMPLATE_REGISTRY');
}

function bnxEnsureClientFolder_(registryRow) {
  const existing = String(registryRow.FOLDER_ID || '').trim();
  if (existing) {
    try { return DriveApp.getFolderById(existing); }
    catch (e) { console.warn('[PROVISION] Registry FOLDER_ID invalid, creating a new folder:', e.message); }
  }
  const root = bnxGetOrCreateDriveFolder_(BNX_CLIENT_DB_ROOT_FOLDER_NAME_);
  const clientId = String(registryRow.CLIENT_ID || '').trim();
  const company = String(registryRow.COMPANY_NAME || clientId).trim();
  return bnxGetOrCreateDriveFolder_(clientId + ' - ' + company, root);
}

function bnxUpdateClientDatabaseRegistry_(row, ids, folderId) {
  const sh = row._sheet, rowNo = row._row, headers = row._headers;
  const out = sh.getRange(rowNo, 1, 1, headers.length).getValues()[0];
  const set = function(name, value) {
    const c = headers.indexOf(name);
    if (c >= 0) out[c] = value;
  };
  set('MASTER_DB_ID', ids.MASTER || ''); set('MASTER_DB_URL', ids.MASTER ? 'https://docs.google.com/spreadsheets/d/' + ids.MASTER + '/edit' : '');
  set('TRANSACTION_DB_ID', ids.TRANSACTION || ''); set('TRANSACTION_DB_URL', ids.TRANSACTION ? 'https://docs.google.com/spreadsheets/d/' + ids.TRANSACTION + '/edit' : '');
  set('REPORT_DB_ID', ids.REPORT || ''); set('REPORT_DB_URL', ids.REPORT ? 'https://docs.google.com/spreadsheets/d/' + ids.REPORT + '/edit' : '');
  if (folderId) set('FOLDER_ID', folderId);
  set('STATUS', 'ACTIVE');
  sh.getRange(rowNo, 1, 1, headers.length).setValues([out]);
}

function bnxEnsureClientDatabasesProvisioned_(clientId) {
  if (!clientId) throw new Error('clientId required for provisioning');
  const provisionCacheKey = 'clientdb_provisioned_v2_' + String(clientId).trim();
  try {
    if (CacheService.getScriptCache().get(provisionCacheKey) === '1') {
      const ids = bnxGetClientDbIds_(clientId);
      return { success:true, clientId:clientId, provisioned:false, created:{}, folderId:'', databases:ids, cached:true };
    }
  } catch (fastErr) {
    try { CacheService.getScriptCache().remove(provisionCacheKey); } catch (ignore) {}
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let row = bnxGetClientRegistryRow_(clientId);
    if (!row) row = bnxCreateClientRegistryRow_(clientId);
    if (!row) throw new Error('Client ' + clientId + ' could not be registered in CLIENT_DATABASE_REGISTRY');
    const current = {
      MASTER: String(row.MASTER_DB_ID || '').trim(),
      TRANSACTION: String(row.TRANSACTION_DB_ID || '').trim(),
      REPORT: String(row.REPORT_DB_ID || '').trim()
    };
    const missing = Object.keys(current).filter(k => !current[k]);
    let folder = null;
    const created = {};
    if (missing.length) {
      folder = bnxEnsureClientFolder_(row);
      const names = {
        MASTER: clientId + '_MASTER_DB',
        TRANSACTION: clientId + '_TRANSACTION_DB',
        REPORT: clientId + '_REPORT_DB'
      };
      missing.forEach(function(kind) {
        const tr = bnxGetTemplateRow_(BNX_TEMPLATE_IDS_[kind]);
        const templateId = String(tr.GOOGLE_SHEET_ID || '').trim();
        if (!templateId) throw new Error(BNX_TEMPLATE_IDS_[kind] + ' has no GOOGLE_SHEET_ID');
        const file = DriveApp.getFileById(templateId);
        const copy = file.makeCopy(names[kind], folder);
        current[kind] = copy.getId();
        created[kind] = { spreadsheetId: copy.getId(), url: 'https://docs.google.com/spreadsheets/d/' + copy.getId() + '/edit', templateId: BNX_TEMPLATE_IDS_[kind], name: copy.getName() };
      });
      bnxUpdateClientDatabaseRegistry_(row, current, folder.getId());
    }
    try { CacheService.getScriptCache().remove('clientdbids_v5_' + String(clientId).trim()); } catch (ignore) {}
    try { CacheService.getScriptCache().put(provisionCacheKey, '1', 300); } catch (ignore) {}
    return { success: true, clientId: clientId, provisioned: missing.length > 0, created: created, folderId: folder ? folder.getId() : String(row.FOLDER_ID || ''), databases: current };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}


/* =========================================================================
 * PASS #68 -- UNIVERSAL MULTI-CLIENT AUTO-ONBOARDING + SELF-HEALING
 *
 * Design:
 *   - No hard-coded maximum CLIENT_ID count.
 *   - Every tenant is routed only by CLIENT_DATABASE_REGISTRY.
 *   - New clients auto-provision MASTER / TRANSACTION / REPORT from the
 *     registered templates on first authenticated use.
 *   - Missing tabs are copied from the matching template automatically.
 *   - Each tenant has isolated caches keyed by CLIENT_ID.
 *   - Business/industry profile is client-owned data; missing profile safely
 *     defaults to RESTAURANT for backward compatibility.
 *   - Heavy repair is cached so normal POS traffic remains fast.
 * ========================================================================= */
const BNX_CLIENT_SCALE_POLICY_ = {
  schemaCacheSeconds: 21600,      // 6 hours
  routeCacheSeconds: 300,         // 5 minutes
  provisionCacheSeconds: 300,     // 5 minutes
  registryCacheSeconds: 300
};

function bnxNormalizeBusinessType_(value) {
  const x = String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (!x) return 'RESTAURANT';
  if (/RESTAURANT|HOTEL|RESORT|DHABA/.test(x)) return 'RESTAURANT';
  if (/CAFE|COFFEE/.test(x)) return 'CAFE';
  if (/BAKERY|PATISSERIE/.test(x)) return 'BAKERY';
  if (/RETAIL|STORE|SHOP|GROCERY/.test(x)) return 'RETAIL';
  if (/BAR|PUB|BREWPUB/.test(x)) return 'BAR';
  if (/MANUFACTUR|FACTORY|PRODUCTION/.test(x)) return 'MANUFACTURING';
  if (/WHOLESALE|DISTRIBUT/.test(x)) return 'WHOLESALE';
  return x;
}

function bnxGetClientPosProfile_(session, payload) {
  const clientId = String(session && session.CLIENT_ID || '').trim();
  if (!clientId) return {success:false,error:'Authenticated CLIENT_ID required'};
  try {
    const reg = bnxGetClientRegistryRow_(clientId) || {};
    let businessType = String(
      reg.BUSINESS_TYPE || reg.INDUSTRY || reg.CLIENT_TYPE || reg.VERTICAL || ''
    ).trim();

    if (!businessType) {
      try {
        const sh = bnxClientSheet(clientId, SHEETS.CONFIG);
        const values = sh.getDataRange().getValues();
        if (values.length) {
          const h = values[0].map(v=>String(v||'').trim().toUpperCase());
          for (let r=1;r<values.length;r++) {
            const o={}; h.forEach((k,c)=>o[k]=values[r][c]);
            businessType = String(o.BUSINESS_TYPE || o.INDUSTRY || o.CLIENT_TYPE || o.VERTICAL || '').trim();
            if (businessType) break;
          }
        }
      } catch (ignore) {}
    }

    const normalized = bnxNormalizeBusinessType_(businessType);
    const profile = {
      RESTAURANT: {
        menuSources:['MENU_CARD_ITEMS'],
        barSource:'BAR_MENU_CARD',
        features:{foodMenu:true,barMenu:true,tables:true,kot:true,steward:true,reservations:true}
      },
      CAFE: {
        menuSources:['MENU_CARD_ITEMS'],
        barSource:'',
        features:{foodMenu:true,barMenu:false,tables:true,kot:true,steward:true,reservations:true}
      },
      BAKERY: {
        menuSources:['MENU_CARD_ITEMS'],
        barSource:'',
        features:{foodMenu:true,barMenu:false,tables:false,kot:false,steward:false,reservations:false}
      },
      RETAIL: {
        menuSources:['ITEM_MASTER'],
        barSource:'',
        features:{foodMenu:false,barMenu:false,tables:false,kot:false,steward:false,reservations:false}
      },
      BAR: {
        menuSources:[],
        barSource:'BAR_MENU_CARD',
        features:{foodMenu:false,barMenu:true,tables:true,kot:true,steward:true,reservations:true}
      },
      MANUFACTURING: {
        menuSources:['ITEM_MASTER'],
        barSource:'',
        features:{foodMenu:false,barMenu:false,tables:false,kot:false,steward:false,reservations:false}
      },
      WHOLESALE: {
        menuSources:['ITEM_MASTER'],
        barSource:'',
        features:{foodMenu:false,barMenu:false,tables:false,kot:false,steward:false,reservations:false}
      }
    }[normalized] || {
      menuSources:['ITEM_MASTER'],
      barSource:'',
      features:{foodMenu:false,barMenu:false,tables:false,kot:false,steward:false,reservations:false}
    };

    return {
      success:true,
      clientId:clientId,
      businessType:normalized,
      detectedFrom: businessType ? 'CLIENT_DATABASE_REGISTRY_OR_COMPANY_SETTINGS' : 'DEFAULT',
      profile:profile,
      scaleSafe:true,
      timestamp:new Date().toISOString()
    };
  } catch (e) {
    return {success:false,clientId:clientId,error:e.message};
  }
}

function bnxAutoRepairClient_(session, payload) {
  const role = String(session && session.ROLE || '').toUpperCase();
  const clientId = String(session && session.CLIENT_ID || '').trim();
  if (!clientId) return {success:false,error:'Authenticated CLIENT_ID required'};

  /* A normal tenant may only repair itself. Super Admin/Developer can target
     another registered tenant explicitly. */
  const requested = String(payload && payload.clientId || '').trim();
  let target = clientId;
  if (requested && requested !== clientId) {
    if (role!=='SUPER_ADMIN' && role!=='DEVELOPER') return {success:false,error:'Super Admin authorization required for another client'};
    if (!bnxGetClientRegistryRow_(requested)) return {success:false,error:'Client '+requested+' is not registered'};
    target = requested;
  }

  const started=Date.now();
  try {
    const databases = bnxEnsureClientDatabasesProvisioned_(target);
    const schema = bnxEnsureClientSchema_(target);
    const profile = bnxGetClientPosProfile_({CLIENT_ID:target}, {});
    return {
      success:true,
      clientId:target,
      provisioned:databases,
      schema:schema,
      profile:profile,
      repairedAt:new Date().toISOString(),
      elapsedMs:Date.now()-started
    };
  } catch(e) {
    return {success:false,clientId:target,error:e.message,elapsedMs:Date.now()-started};
  }
}

function bnxGetClientScaleStatus_(session, payload) {
  const role=String(session && session.ROLE || '').toUpperCase();
  if(role!=='SUPER_ADMIN' && role!=='DEVELOPER') return {success:false,error:'Super Admin authorization required'};
  try {
    const reg=bnxControlSheet_(CLIENT_DB_REGISTRY_TAB);
    const vals=reg.getDataRange().getValues();
    if(!vals.length) return {success:true,activeClients:0,registeredClients:0,readyClients:0,incompleteClients:0};
    const h=vals[0].map(v=>String(v||'').trim().toUpperCase());
    const ix=n=>h.indexOf(n);
    let registered=0, active=0, ready=0, incomplete=0;
    const rows=[];
    for(let r=1;r<vals.length;r++){
      const id=ix('CLIENT_ID')>=0?String(vals[r][ix('CLIENT_ID')]||'').trim():'';
      if(!id) continue;
      registered++;
      const status=(ix('STATUS')>=0?String(vals[r][ix('STATUS')]||'ACTIVE'):'ACTIVE').trim().toUpperCase();
      if(!['ACTIVE','YES','ENABLED'].includes(status)) continue;
      active++;
      const m=ix('MASTER_DB_ID')>=0?String(vals[r][ix('MASTER_DB_ID')]||'').trim():'';
      const t=ix('TRANSACTION_DB_ID')>=0?String(vals[r][ix('TRANSACTION_DB_ID')]||'').trim():'';
      const p=ix('REPORT_DB_ID')>=0?String(vals[r][ix('REPORT_DB_ID')]||'').trim():'';
      const ok=!!(m&&t&&p);
      if(ok) ready++; else incomplete++;
      rows.push({CLIENT_ID:id,STATUS:status,READY:ok});
    }
    return {
      success:true,registeredClients:registered,activeClients:active,
      readyClients:ready,incompleteClients:incomplete,
      capacityModel:'REGISTRY_DRIVEN_NO_CODE_LEVEL_CLIENT_COUNT_CAP',
      clients:rows
    };
  }catch(e){ return {success:false,error:e.message}; }
}

function bnxGetClientDbIds_(clientId) {
  /*
   * AUTHORITATIVE CLIENT DATABASE ROUTING
   * ------------------------------------
   * MASTER_DB_ID / TRANSACTION_DB_ID / REPORT_DB_ID are read from the
   * BALAJI_ERP_MASTER_CONTROL_SYSTEM -> CLIENT_DATABASE_REGISTRY.
   *
   * CLIENT_DB_LOCATION_REGISTRY is retained as a compatibility fallback for
   * older SINGLE_SHEET clients, but CL00010 is a proper 3-DB client and its
   * three IDs below are already present in CLIENT_DATABASE_REGISTRY.
   *
   * IMPORTANT: never cache an invalid/stale registry row. If a cached ID
   * cannot be opened, the cache is cleared and the registry is read again.
   */
  if (!clientId) throw new Error('bnxGetClientDbIds_: clientId is required');

  const cache = CacheService.getScriptCache();
  const cacheKey = 'clientdbids_v5_' + String(clientId).trim();

  function normalize_(obj) {
    return {
      MASTER: String(obj.MASTER || obj.MASTER_DB_ID || '').trim(),
      TRANSACTION: String(obj.TRANSACTION || obj.TRANSACTION_DB_ID || '').trim(),
      REPORT: String(obj.REPORT || obj.REPORT_DB_ID || '').trim()
    };
  }

  function validate_(ids) {
    if (!ids.MASTER) throw new Error('MASTER_DB_ID missing for client ' + clientId);
    if (!ids.TRANSACTION) throw new Error('TRANSACTION_DB_ID missing for client ' + clientId);

    // Report DB is required by the v3 report engine. Keep the error explicit
    // instead of allowing a later report call to fail with a vague null error.
    if (!ids.REPORT) throw new Error('REPORT_DB_ID missing for client ' + clientId);

    const names = [['MASTER', ids.MASTER], ['TRANSACTION', ids.TRANSACTION], ['REPORT', ids.REPORT]];
    names.forEach(function(pair) {
      const ss = bnxOpenSpreadsheetCached_(pair[1]);
      if (!ss) throw new Error(pair[0] + '_DB could not be opened for client ' + clientId);
    });
    return ids;
  }

  // 1) FAST PATH: cached routing is authoritative for 5 minutes. Do NOT open
  // three spreadsheets just to validate the cache on every API request. That
  // was the main source of 10–15 second latency at busy clients. A failed
  // spreadsheet open in bnxClientSheet clears this cache and forces a fresh
  // registry lookup on the next request.
  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      const cachedIds = normalize_(JSON.parse(cached));
      if (cachedIds.MASTER && cachedIds.TRANSACTION && cachedIds.REPORT) return cachedIds;
      cache.remove(cacheKey);
    }
  } catch (e) { try { cache.remove(cacheKey); } catch (ignore) {} }

  // 2) Authoritative 3-DB registry.
  const controlSs = SpreadsheetApp.openById(CLIENT_DB_REGISTRY_SS_ID);
  const registry = controlSs.getSheetByName(CLIENT_DB_REGISTRY_TAB);
  if (!registry) {
    throw new Error(
      'CLIENT_DATABASE_REGISTRY sheet not found in BALAJI_ERP_MASTER_CONTROL_SYSTEM (' +
      CLIENT_DB_REGISTRY_SS_ID + ').'
    );
  }

  const values = registry.getDataRange().getValues();
  if (!values.length) throw new Error('CLIENT_DATABASE_REGISTRY is empty');

  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const ciCol = headers.indexOf('CLIENT_ID');
  const masterCol = headers.indexOf('MASTER_DB_ID');
  const txnCol = headers.indexOf('TRANSACTION_DB_ID');
  const rptCol = headers.indexOf('REPORT_DB_ID');

  if (ciCol < 0 || masterCol < 0 || txnCol < 0 || rptCol < 0) {
    throw new Error(
      'CLIENT_DATABASE_REGISTRY schema error. Required columns: ' +
      'CLIENT_ID, MASTER_DB_ID, TRANSACTION_DB_ID, REPORT_DB_ID.'
    );
  }

  let found = null;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][ciCol] || '').trim() !== String(clientId).trim()) continue;
    found = normalize_({
      MASTER_DB_ID: values[r][masterCol],
      TRANSACTION_DB_ID: values[r][txnCol],
      REPORT_DB_ID: values[r][rptCol]
    });
    break;
  }

  // STRICT 3-DB MODE: do not fall back to CLIENT_DB_LOCATION_REGISTRY.
  // Missing IDs are provisioned from TEM_MAST/TEM_TXN/TEM_RT above.

  if (!found || !found.MASTER || !found.TRANSACTION || !found.REPORT) {
    throw new Error(
      'Client ' + clientId +
      ' database routing is incomplete. Required MASTER_DB_ID, ' +
      'TRANSACTION_DB_ID and REPORT_DB_ID must be present in ' +
      CLIENT_DB_REGISTRY_TAB + '.'
    );
  }

  const ids = validate_(found);
  try { cache.put(cacheKey, JSON.stringify(ids), 300); } catch (e) {}
  return ids;
}

function bnxTemplateSpreadsheetId_(dbKey){
  const tr=bnxGetTemplateRow_(BNX_TEMPLATE_IDS_[dbKey]);
  return String(tr.GOOGLE_SHEET_ID||'').trim();
}
function bnxEnsureMissingSheetFromTemplate_(clientId, dbKey, sheetName){
  const ids=bnxGetClientDbIds_(clientId);
  const dbId=ids[dbKey];
  const target=bnxOpenSpreadsheetCached_(dbId);
  if(target.getSheetByName(sheetName)) return target.getSheetByName(sheetName);
  const templateId=bnxTemplateSpreadsheetId_(dbKey);
  let created=null;
  if(templateId){
    const tpl=bnxOpenSpreadsheetCached_(templateId);
    const src=tpl.getSheetByName(sheetName);
    if(src) created=src.copyTo(target).setName(sheetName);
  }
  if(!created){
    created=target.insertSheet(sheetName);
    // Minimal safe schema only when the template itself has no matching tab.
    created.getRange(1,1,1,2).setValues([['CLIENT_ID','CREATED_AT']]);
  }
  return created;
}
function bnxEnsureClientSchema_(clientId){
  const key='schema_ready_v2_'+String(clientId).trim();
  try{if(CacheService.getScriptCache().get(key)==='1')return {success:true,cached:true};}catch(e){}
  const required={
    MASTER:['COMPANY_SETTINGS','LOCATION_MASTER','USER_MASTER','ROLE_MASTER','ITEM_MASTER','CATEGORY_MASTER','ITEM_GROUP_MASTER','UNIT_MASTER','TAX_MASTER','UNIT_CONVERSION_MASTER','SUPPLIER_MASTER','CUSTOMER_MASTER','TABLE_MASTER','PAYMENT_MODE_MASTER','LEDGER_MASTER','RECIPE_MASTER','RECIPE_ITEMS','BAR_ITEM_MASTER','ITEM_ALIAS_MASTER','RECIPE_VERSION'],
    TRANSACTION:['DAY_STATUS','SEQUENCE_COUNTERS','TABLE_LIVE_STATE','RESERVATION_MASTER','ORDER_MASTER','ORDER_ITEMS','KOT_MASTER','KOT_ITEMS','KOT_STATUS_LOG','BILL_MASTER','BILL_ITEMS','PAYMENT_MASTER','STOCK_MOVEMENT','DAILY_COLLECTION','ONLINE_ORDER_MASTER','ONLINE_ORDER_ITEMS','AGGREGATOR_SETTLEMENT','AUDIT_LOG','SYNC_LOG','ERROR_LOG','KITCHEN_INDENT','BAR_INDENT','KITCHEN_CONSUMPTION','WASTAGE_MASTER','PURCHASE_MASTER','PURCHASE_ITEMS','PETTY_CASH_MASTER','PETTY_CASH'],
    REPORT:['REPORT_REGISTRY','SALES_DAY_BOOK','SALES_SUMMARY','ITEM_SALES_REPORT','CATEGORY_SALES_REPORT','FOOD_COST_REPORT','BAR_COST_REPORT','STOCK_REPORT','PURCHASE_REPORT','SUPPLIER_REPORT','GST_REPORT','PAYMENT_REPORT','CASH_BANK_REPORT','CUSTOMER_DUES_REPORT','SUPPLIER_DUES_REPORT','PROFIT_LOSS_REPORT','ONLINE_ORDER_REPORT','AGGREGATOR_SETTLEMENT_REPORT','HR_REPORT','PAYROLL_REPORT','KITCHEN_PERFORMANCE','STEWARD_PERFORMANCE','BAR_PERFORMANCE','TABLE_PERFORMANCE','WASTAGE_REPORT','RECONCILIATION_REPORT','DASHBOARD_KPI','AI_ML_ANALYTICS']
  };
  const result={success:true,clientId:clientId,created:[],missing:[]};
  Object.keys(required).forEach(function(dbKey){
    const ss=bnxOpenSpreadsheetCached_(bnxGetClientDbIds_(clientId)[dbKey]);
    required[dbKey].forEach(function(name){
      if(!ss.getSheetByName(name)){
        result.missing.push(dbKey+':'+name);
        try{bnxEnsureMissingSheetFromTemplate_(clientId,dbKey,name);result.created.push(dbKey+':'+name);}catch(e){throw new Error('Cannot create '+dbKey+'/'+name+': '+e.message);}
      }
    });
  });
  try{CacheService.getScriptCache().put(key,'1',21600);}catch(e){}
  return result;
}

function bnxClientSheet(clientId, sheetName) {
  if (!clientId) throw new Error('bnxClientSheet: clientId required');
  if (!sheetName) throw new Error('bnxClientSheet: sheetName required');

  // Real CL00010 template uses SUPPLIER_MASTER, not the obsolete
  // VENDOR_MASTER name used by an older build.
  const canonicalName = String(sheetName) === 'VENDOR_MASTER'
    ? 'SUPPLIER_MASTER'
    : String(sheetName);

  const dbKey = BNX_SHEET_DB_MAP_[canonicalName];
  if (!dbKey) {
    throw new Error(
      'bnxClientSheet: sheet "' + canonicalName +
      '" is not registered in the MASTER/TRANSACTION/REPORT routing map.'
    );
  }

  const dbIds = bnxGetClientDbIds_(clientId);
  const dbId = dbIds[dbKey];
  if (!dbId) {
    throw new Error(
      'bnxClientSheet: client ' + clientId + ' has no ' + dbKey +
      '_DB_ID in ' + CLIENT_DB_REGISTRY_TAB + '.'
    );
  }

  let ss;
  try {
    ss = bnxOpenSpreadsheetCached_(dbId);
  } catch (openErr) {
    // Clear routing cache so a corrected registry row is picked up
    // immediately on the next call.
    try { CacheService.getScriptCache().remove('clientdbids_v5_' + clientId); } catch (ignore) {}
    throw new Error(
      'Client database connection failed for ' + clientId +
      ' (' + dbKey + '_DB_ID=' + dbId + '): ' + openErr.message
    );
  }

  let sheet = ss.getSheetByName(canonicalName);
  if (!sheet) {
    // Automatic tenant migration: copy the exact tab from the registered
    // database template when available; otherwise create a safe blank tab.
    sheet = bnxEnsureMissingSheetFromTemplate_(clientId, dbKey, canonicalName);
  }
  return sheet;
}

const SHEETS = {
  CONFIG: 'COMPANY_SETTINGS',
  SYNC_LOG: 'SYNC_LOG',
  AUDIT_LOG: 'AUDIT_LOG',
  ERROR_LOG: 'ERROR_LOG',
  ITEM_MASTER: 'ITEM_MASTER',
  CATEGORY_MASTER: 'CATEGORY_MASTER',
  UNIT_MASTER: 'UNIT_MASTER',
  TAX_MASTER: 'TAX_MASTER',
  RAW_MATERIAL_MASTER: 'RAW_MATERIAL_MASTER',
  CUSTOMER_MASTER: 'CUSTOMER_MASTER',
  /* FIX ("ALL CORRECTION A TO Z" -- confirmed root cause, closes gap #4
     from the previous pass's own REMAINING GAPS list, "SUPPLIER_MASTER
     vs VENDOR_MASTER naming mismatch"): BNX_SHEET_DB_MAP_ above only
     ever registered a real routable sheet named VENDOR_MASTER -- there
     was never a 'SUPPLIER_MASTER' key in that map. Every call site in
     this file (bnxGetPurchaseReport, bnxGetSupplierReport, the
     'supplier' MASTER_CATEGORY_MAP entry, and even the already-added
     `|| 'VENDOR_MASTER'` fallback in bnxGetSupplierDuesReportV2 that
     never actually triggered because SHEETS.SUPPLIER_MASTER was always
     truthy) asked bnxClientSheet for 'SUPPLIER_MASTER' by name, which
     doesn't exist in that map and threw every single time -- meaning
     every supplier-facing report silently came back empty/failed
     against a real VENDOR_MASTER table that was there the whole time.
     Pointed this constant at the sheet name that's actually registered
     and routable; every other line of code that already writes
     SHEETS.SUPPLIER_MASTER keeps working unchanged, it now just
     resolves to a sheet that really exists. */
  SUPPLIER_MASTER: 'SUPPLIER_MASTER',
  USER_MASTER: 'USER_MASTER',
  ORDER_MASTER: 'ORDER_MASTER',
  ORDER_ITEMS: 'ORDER_ITEMS',
  KOT_MASTER: 'KOT_MASTER',
  KOT_ITEMS: 'KOT_ITEMS',
  BILL_MASTER: 'BILL_MASTER',
  BILL_ITEMS: 'BILL_ITEMS',
  PAYMENT_MASTER: 'PAYMENT_MASTER',
  STOCK_MOVEMENT: 'STOCK_MOVEMENT',
  STOCK_BALANCE: 'STOCK_BALANCE',
  CUSTOMER_DUES: 'CUSTOMER_DUES',
  DUES_RECEIPT: 'DUES_RECEIPT',
  JOURNAL: 'JOURNAL',
  LEDGER_ENTRIES: 'LEDGER_ENTRIES',
  TABLE_LIVE_STATE: 'TABLE_LIVE_STATE',
  RESERVATION_MASTER: 'RESERVATION_MASTER',
  DAY_STATUS: 'DAY_STATUS',
  SETTINGS_TOGGLES: 'A7_SETTINGS_TOGGLES',
  SEQUENCE_COUNTERS: 'SEQUENCE_COUNTERS',
  AGGREGATOR_SETTLEMENT: 'AGGREGATOR_SETTLEMENT',
  ONLINE_ORDER_MASTER: 'ONLINE_ORDER_MASTER',
  ONLINE_ORDER_ITEMS: 'ONLINE_ORDER_ITEMS',
  DAILY_COLLECTION: 'DAILY_COLLECTION',
  RECIPE_MASTER: 'RECIPE_MASTER',
  RECIPE_ITEMS: 'RECIPE_ITEMS',
  PRODUCTION_MASTER: 'PRODUCTION_MASTER',
  PRODUCTION_ITEMS: 'PRODUCTION_ITEMS',
  MENU_CARD_UPLOAD: 'MENU_CARD_UPLOAD',
  RESERVATION: 'RESERVATION_MASTER',
  KOT_STATUS_LOG: 'KOT_STATUS_LOG',
  KITCHEN_INDENT: 'KITCHEN_INDENT',
  BAR_INDENT: 'BAR_INDENT',
  KITCHEN_CONSUMPTION: 'KITCHEN_CONSUMPTION',
  WASTAGE_MASTER: 'WASTAGE_MASTER',
  SUPPLIER_DUES: 'SUPPLIER_DUES',
  PURCHASE_MASTER: 'PURCHASE_MASTER',
  PURCHASE_ITEMS: 'PURCHASE_ITEMS',
  SALES_LEDGER: 'SALES_LEDGER',
  // EDIT 1 (from the old report-engine header)
  LEDGER_MASTER: 'LEDGER_MASTER',
  TABLE_MASTER: 'TABLE_MASTER',
  BAR_ITEM_MASTER: 'BAR_ITEM_MASTER',
  MENU_CARD_ITEMS: 'MENU_CARD_ITEMS',
  BAR_MENU_CARD: 'BAR_MENU_CARD',
  // PETTY CASH PATCH
  PETTY_CASH_MASTER: 'PETTY_CASH_MASTER'
};

const TRANSACTION_TYPES = {
  ORDER: 'ORDER', KOT: 'KOT', BILL: 'BILL', PAYMENT: 'PAYMENT',
  PURCHASE: 'PURCHASE', STOCK_MOVEMENT: 'STOCK_MOVEMENT', STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT'
};

function doPost(e) {
  try {
    const requestBody = e.postData.contents;
    const payload = JSON.parse(requestBody);
    const action = payload.action || '';
    const sessionToken = payload.sessionToken || '';
    const clientId = payload.clientId || '';
    const requestId = payload.requestId || '';

    if (action === 'GET_CONFIG') {
      return respondJson(bnxGetConfig());
    }

    const session = bnxVerifySession(sessionToken, clientId);
    if (!session) {
      return respondJson(respondError(401, 'Invalid or expired session', requestId));
    }
    if (session.CLIENT_ID !== clientId) {
      bnxLogError(session.CLIENT_ID, `Unauthorized access attempt: client ${clientId}`, payload);
      return respondJson(respondError(403, 'Unauthorized access', requestId));
    }

    let result;
    switch (action) {
      case 'SAVE_ORDER': result = bnxSaveOrder(session, payload); break;
      case 'SAVE_KOT': result = bnxSaveKOT(session, payload); break;
      case 'SAVE_BILL': result = bnxSaveBill(session, payload); break;
      case 'NEXT_BILL_NO': result = bnxGetNextBillNumber(session, payload); break;
      case 'SET_BILL_NUMBERING': result = bnxSetBillNumbering(session, payload); break;
      case 'SAVE_PAYMENT': result = bnxSavePayment(session, payload); break;
      case 'VOID_BILL': result = bnxVoidBill(session, payload); break;


function bnxFindBillRowByNumber_(clientId, billNumber) {
  const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
  const lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return null;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const noCol = headers.indexOf('BILL_NUMBER');
  const ciCol = headers.indexOf('CLIENT_ID');
  if (noCol === -1) return null;
  const matches = sheet.getRange(2, noCol + 1, lastRow - 1, 1)
    .createTextFinder(String(billNumber).trim()).matchEntireCell(true).findAll();
  for (let i = matches.length - 1; i >= 0; i--) {
    const rowNo = matches[i].getRow();
    const vals = sheet.getRange(rowNo, 1, 1, lastCol).getValues()[0];
    if (ciCol !== -1 && String(vals[ciCol]) !== String(clientId)) continue;
    return { sheet: sheet, headers: headers, rowNo: rowNo, values: vals };
  }
  return null;
}

function bnxVoidBill(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const billNumber = String(payload.billNumber || payload.BILL_NUMBER || '').trim();
  const reason = String(payload.reason || '').trim();
  if (!billNumber) return { success: false, error: 'billNumber is required' };
  try {
    const found = bnxFindBillRowByNumber_(clientId, billNumber);
    if (!found) return { success: false, error: 'Bill not found for this client (billNumber: ' + billNumber + ')' };
    const sheet = found.sheet, headers = found.headers, rowNo = found.rowNo, values = found.values;
    const bill = bnxRowToObject(values, headers);
    const currentStatus = String(bill.BILL_STATUS || '').toUpperCase();
    if (currentStatus === 'CANCELLED' || currentStatus === 'VOID') {
      return { success: true, billNumber: billNumber, alreadyVoided: true };
    }

    const statusCol = headers.indexOf('BILL_STATUS');
    const reasonCol = headers.indexOf('VOID_REASON');
    const byCol = headers.indexOf('VOIDED_BY');
    const atCol = headers.indexOf('VOIDED_AT');
    const nowIso = new Date().toISOString();
    if (statusCol !== -1) sheet.getRange(rowNo, statusCol + 1).setValue('CANCELLED');
    if (reasonCol !== -1) sheet.getRange(rowNo, reasonCol + 1).setValue(reason);
    if (byCol !== -1) sheet.getRange(rowNo, byCol + 1).setValue(userId);
    if (atCol !== -1) sheet.getRange(rowNo, atCol + 1).setValue(nowIso);

    try {
      bnxReverseBillLedger_(clientId, bill, userId, nowIso, reason);
    } catch (ledgerErr) {
      console.warn('[bnxVoidBill] ledger reversal failed: ' + ledgerErr.message);
    }

    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, USER_ID: userId, ACTION: 'VOID', MODULE: 'BILLING',
      RECORD_TYPE: 'BILL', RECORD_ID: bill.BILL_ID || billNumber,
      OLD_VALUE: JSON.stringify({ BILL_STATUS: bill.BILL_STATUS }),
      NEW_VALUE: JSON.stringify({ BILL_STATUS: 'CANCELLED', reason: reason }), TIMESTAMP: nowIso
    });
    try { bnxInvalidateTodayReportCaches_(clientId); } catch (e) {}
    return { success: true, billNumber: billNumber, billId: bill.BILL_ID || '' };
  } catch (error) {
    bnxLogError(clientId, `bnxVoidBill failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxReverseBillLedger_(clientId, bill, userId, nowIso, reason) {
  const billId = bill.BILL_ID;
  if (!billId) return;
  const journalSheet = bnxClientSheet(clientId, SHEETS.JOURNAL);
  const journalValues = journalSheet.getDataRange().getValues();
  const journalHeaders = journalValues[0] || [];
  let originalJournal = null;
  for (let r = 1; r < journalValues.length; r++) {
    const j = bnxRowToObject(journalValues[r], journalHeaders);
    if (String(j.CLIENT_ID || '') !== String(clientId)) continue;
    if (String(j.SOURCE_TYPE || '') !== 'BILL' || String(j.SOURCE_ID || '') !== String(billId)) continue;
    originalJournal = j;
    break;
  }
  if (!originalJournal) return;

  const entrySheet = bnxClientSheet(clientId, SHEETS.LEDGER_ENTRIES);
  const entryValues = entrySheet.getDataRange().getValues();
  const entryHeaders = entryValues[0] || [];
  const originalLines = [];
  for (let r = 1; r < entryValues.length; r++) {
    const e = bnxRowToObject(entryValues[r], entryHeaders);
    if (String(e.JOURNAL_ID || '') !== String(originalJournal.JOURNAL_ID || '')) continue;
    originalLines.push(e);
  }
  if (!originalLines.length) return;

  const reversalJournalId = generateShortId_(clientId, 'JOURNAL_ID');
  const totalDr = +originalLines.reduce((s, l) => s + (Number(l.CREDIT) || 0), 0).toFixed(2);
  const totalCr = +originalLines.reduce((s, l) => s + (Number(l.DEBIT) || 0), 0).toFixed(2);
  const businessDate = bnxBusinessDateKey_(new Date());
  bnxAppendRow(clientId, SHEETS.JOURNAL, {
    JOURNAL_ID: reversalJournalId, CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '',
    JOURNAL_DATE: businessDate, JOURNAL_TYPE: 'SALES_VOID', SOURCE_TYPE: 'BILL_VOID', SOURCE_ID: billId,
    REFERENCE_NUMBER: bill.BILL_NUMBER, DESCRIPTION: 'Void reversal - Bill ' + bill.BILL_NUMBER + (reason ? ' (' + reason + ')' : ''),
    TOTAL_DEBIT: totalDr, TOTAL_CREDIT: totalCr, CREATED_BY: userId, CREATED_AT: nowIso,
    ENTRY_DATE: businessDate, REFERENCE_TYPE: 'BILL_VOID', REFERENCE_ID: billId,
    NARRATION: 'Void reversal - Bill ' + bill.BILL_NUMBER
  });
  const reversalLines = originalLines.map(l => ({
    LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), CLIENT_ID: clientId,
    JOURNAL_ID: reversalJournalId, LOCATION_ID: bill.LOCATION_ID || '', ACCOUNT: l.ACCOUNT,
    ENTRY_DATE: businessDate, DEBIT: +Number(l.CREDIT || 0).toFixed(2), CREDIT: +Number(l.DEBIT || 0).toFixed(2),
    REFERENCE_TYPE: 'BILL_VOID', REFERENCE_ID: billId, CREATED_AT: nowIso
  }));
  bnxAppendRowsBatch_(clientId, SHEETS.LEDGER_ENTRIES, reversalLines);
}

      case 'GET_ORDERS': result = bnxGetOrders(session, payload); break;
      case 'GET_ACTIVE_ORDERS': result = bnxGetActiveOrders(session, payload); break;
      case 'GET_BILLS': result = bnxGetBills(session, payload); break;
      case 'GET_KOT': result = bnxGetKOT(session, payload); break;
      case 'GET_SYNC_STATUS': result = bnxGetSyncStatus(session, payload); break;
      case 'GET_MASTER': result = bnxGetMaster(session, payload); break;
      case 'SAVE_MASTER': result = bnxSaveMaster(session, payload); break;
      case 'DELETE_MASTER': result = bnxDeleteMaster(session, payload); break;
      case 'BATCH_EXECUTE': result = bnxBatchExecute(session, payload); break;
      case 'GET_DASHBOARD_SUMMARY': result = bnxGetDashboardSummary(session, payload); break;
      case 'GET_ACCOUNTING_OVERVIEW': result = bnxGetAccountingOverview(session, payload); break;
      case 'GET_CASHBOOK_REPORT': result = bnxGetCashbookReport(session, payload); break;
      case 'GET_DSR_MATRIX': result = bnxGetDsrMatrix(session, payload); break;
      case 'GET_DSR_YTD': result = bnxGetDsrYtd(session, payload); break;
      case 'GET_STAFF_LIST': result = bnxGetStaffList(session, payload); break;
      case 'GET_ATTENDANCE_EMPLOYEES': result = bnxGetAttendanceEmployees(session, payload); break;
      case 'MARK_ATTENDANCE': result = bnxMarkAttendance(session, payload); break;
      case 'GET_MY_ATTENDANCE': result = bnxGetMyAttendance(session, payload); break;
      case 'GET_MY_INCENTIVE': result = bnxGetMyIncentive(session, payload); break;
      case 'CLEAR_TEST_DATA': result = bnxClearTestData(session, payload); break;
      case 'DAY_OPEN': result = bnxDayOpen(session, payload); break;
      case 'DAY_CLOSE': result = bnxDayClose(session, payload); break;
      case 'GET_BOOTSTRAP': result = bnxGetBootstrap(session, payload); break;
      case 'GET_CLIENT_INFO': result = bnxGetClientInfo(session, payload); break;
      case 'GET_MENU_ITEMS': result = bnxGetMenuItems(session, payload); break;
      case 'GET_BAR_MENU': result = bnxGetBarMenu(session, payload); break;
      case 'GET_POS_MENU': result = bnxGetPosMenu(session, payload); break;
      case 'GET_PAYMENT_MODES': result = bnxGetPaymentModes(session, payload); break;
      case 'GET_TAX_CONFIG': result = bnxGetTaxConfig(session, payload); break;
      case 'HEARTBEAT': result = { success: true, timestamp: new Date().toISOString() }; break;
      case 'LIST_BILLS': result = bnxListBills(session, payload); break;
      case 'LIST_RESERVATIONS': result = bnxListReservations(session, payload); break;
      case 'SAVE_RESERVATION': result = bnxSaveReservation(session, payload); break;
      case 'GET_TABLE_AVAILABILITY': result = bnxGetTableAvailability(session, payload); break;
      case 'CANCEL_RESERVATION': result = bnxCancelReservation(session, payload); break;
      case 'SEAT_RESERVATION': result = bnxSeatReservationHandler(session, payload); break;
      case 'RD_FETCH_SHEET': result = bnxRdFetchSheet(session, payload); break;
      case 'SAVE_TABLE_STATUS': result = bnxSaveTableStatusHandler(session, payload); break;
      case 'ADD_STAFF': result = bnxAddStaff(session, payload); break;
      case 'SAVE_MENU_AVAILABILITY': result = bnxSaveMenuAvailability(session, payload); break;
      case 'SAVE_MENU_ITEM': result = bnxSaveMenuItem(session, payload); break;
      case 'GET_RECIPE_COST': result = bnxGetRecipeCost(session, payload); break;
      case 'GET_RECIPE_DATA': result = bnxGetRecipeData(session, payload); break;
      case 'SAVE_RECIPE': result = bnxSaveRecipe(session, payload); break;
      case 'SAVE_UNIT_CONVERSION': result = bnxSaveUnitConversion(session, payload); break;
      case 'SAVE_ITEM_ALIAS': result = bnxSaveItemAlias(session, payload); break;
      case 'RECALCULATE_RECIPE_COST': result = bnxRecalculateRecipeCost(session, payload); break;
      case 'IMPORT_MENU_ITEMS': result = bnxImportMenuItems(session, payload); break;
      case 'BULK_IMPORT_MASTER': result = bnxBulkImportMaster(session, payload); break;
      case 'GET_PERMISSIONS': result = bnxGetPermissions(session, payload); break;
      case 'SAVE_PERMISSION': result = bnxSavePermission(session, payload); break;
      case 'GET_KOT_NUMBER_BATCH': result = bnxGetKotNumberBatch(session, payload); break;
      case 'UPDATE_KOT_STATUS': result = bnxUpdateKotStatus(session, payload); break;
      case 'UPDATE_ORDER_STATUS': result = bnxUpdateOrderStatus(session, payload); break;
      case 'UPDATE_ORDER_ITEMS': result = bnxUpdateOrderItems(session, payload); break;
      case 'GET_DUE_COLLECTION': result = bnxGetDueCollection(session, payload); break;
      case 'SAVE_DUES_RECEIPT': result = bnxSaveDuesReceipt(session, payload); break;
      case 'GET_DEBTORS_REPORT': result = bnxGetDebtorsReport(session, payload); break;
      case 'GET_DISCOUNT_REPORT': result = bnxGetDiscountReport(session, payload); break;
      case 'GET_DAILY_SALES': result = bnxGetDailySales(session, payload); break;
      case 'GET_DSR': result = bnxGetDsr(session, payload); break;
      case 'GET_ONLINE_ORDER_REPORT': result = bnxGetOnlineOrderReport(session, payload); break;
      case 'SAVE_ONLINE_ORDER': result = bnxSaveOnlineOrder(session, payload); break;
      case 'IMPORT_BATCH': result = bnxImportBatch(session, payload); break;
      case 'GET_KDS_REPORT': result = bnxGetKdsReport(session, payload); break;
      case 'CANCEL_ORDER_ITEM': result = bnxCancelOrderItem(session, payload); break;
      case 'GET_CANCELLED_ITEMS_REPORT': result = bnxGetCancelledItemsReport(session, payload); break;
      case 'GET_TIPS_REPORT': result = bnxGetTipsReport(session, payload); break;
      case 'GET_NC_REPORT': result = bnxGetNcReport(session, payload); break;
      case 'GET_CONSUMPTION_REPORT': result = bnxGetConsumptionReport(session, payload); break;
      case 'GET_BLIND_TILL_REPORT': result = bnxGetBlindTillReport(session, payload); break;
      case 'GET_BILL_FOR_REPRINT': result = bnxGetBillForReprint(session, payload); break;
      case 'GET_INSTRUCTIONS_REPORT': result = bnxGetInstructionsReport(session, payload); break;
      case 'GET_GSTR_SUMMARY': result = bnxGetGstrSummary(session, payload); break;
      case 'GET_DAY_BOOK_REPORT': result = bnxGetDayBookReport(session, payload); break;
      case 'GET_SMARTCARD_REPORT': result = bnxGetSmartcardReport(session, payload); break;
      case 'SAVE_PRODUCTION': result = bnxSaveProduction(session, payload); break;
      case 'SAVE_MENU_CARD_UPLOAD': result = bnxSaveMenuCardUpload(session, payload); break;
      case 'UPLOAD_LOGO': result = bnxUploadLogo(session, payload); break;
      case 'REBUILD_STOCK_BALANCE': result = bnxRebuildStockBalance(session, payload); break;
      case 'GET_ITEM_UNIT_CONVERSIONS': result = bnxGetItemUnitConversions(session, payload); break;
      // EDIT 6 (from the old report-engine header) -- report engine actions
      case 'GET_SALES_DAY_BOOK_REPORT': result = bnxGetSalesDayBookReport(session, payload); break;
      case 'GET_PAYMENT_REPORT_V2': result = bnxGetPaymentReportV2(session, payload); break;
      case 'GET_CASH_BANK_REPORT': result = bnxGetCashBankReport(session, payload); break;
      case 'GET_CUSTOMER_DUES_REPORT_V2': result = bnxGetCustomerDuesReportV2(session, payload); break;
      case 'GET_SUPPLIER_DUES_REPORT_V2': result = bnxGetSupplierDuesReportV2(session, payload); break;
      case 'GET_PROFIT_LOSS_REPORT': result = bnxGetProfitLossReport(session, payload); break;
      case 'GET_RECONCILIATION_REPORT': result = bnxGetReconciliationReport(session, payload); break;
      case 'GET_DASHBOARD_KPI_REPORT': result = bnxGetDashboardKpiReport(session, payload); break;
      case 'REFRESH_ALL_REPORTS': result = bnxRefreshAllReports(session, payload); break;
      case 'GET_REPORT_HUB_ALL': result = bnxRefreshAllReports(session, payload); break;
      case 'GET_ITEM_SALES_REPORT': result = bnxGetItemSalesReport(session, payload); break;
      case 'GET_CATEGORY_SALES_REPORT': result = bnxGetCategorySalesReport(session, payload); break;
      case 'GET_SALES_SUMMARY_REPORT': result = bnxGetSalesSummaryReport(session, payload); break;
      case 'GET_STOCK_REPORT': result = bnxGetStockReport(session, payload); break;
      case 'GET_PURCHASE_REPORT': result = bnxGetPurchaseReport(session, payload); break;
      case 'GET_SUPPLIER_REPORT': result = bnxGetSupplierReport(session, payload); break;
      case 'GET_GST_REPORT': result = bnxGetGstReport(session, payload); break;
      case 'GET_FOOD_COST_REPORT': result = bnxGetFoodCostReport(session, payload); break;
      case 'GET_BAR_COST_REPORT': result = bnxGetBarCostReport(session, payload); break;
      case 'GET_WASTAGE_REPORT': result = bnxGetWastageReport(session, payload); break;
      case 'GET_KITCHEN_PERFORMANCE_REPORT': result = bnxGetKitchenPerformanceReport(session, payload); break;
      case 'GET_STEWARD_PERFORMANCE_REPORT': result = bnxGetStewardPerformanceReport(session, payload); break;
      case 'GET_BAR_PERFORMANCE_REPORT': result = bnxGetBarPerformanceReport(session, payload); break;
      case 'GET_TABLE_PERFORMANCE_REPORT': result = bnxGetTablePerformanceReport(session, payload); break;
      // PETTY CASH + ONLINE ORDERS LIST PATCH
      case 'SAVE_PETTY_CASH': result = bnxSavePettyCash(session, payload); break;
      case 'GET_PETTY_CASH_LEDGER': result = bnxGetPettyCashLedger(session, payload); break;
      case 'GET_ONLINE_ORDERS_LIST': result = bnxGetOnlineOrdersList(session, payload); break;
      case 'CHECK_CLIENT_DATABASE': result = bnxCheckClientDatabase_(session, payload); break;
      case 'ENSURE_CLIENT_SCHEMA': result = bnxEnsureClientSchema_(session.CLIENT_ID); break;
      case 'GET_CLIENT_DATABASE_STATUS': result = bnxGetClientDatabaseStatus(session, payload); break;
      case 'GET_ALL_CLIENTS': result = bnxGetAllClients(session, payload); break;
      case 'CREATE_CLIENT': result = bnxCreateClient(session, payload); break;
      case 'PROVISION_CLIENT_DATABASES': result = bnxProvisionClientForAdmin_(session, payload); break;
      case 'GET_CLIENT_POS_PROFILE': result = bnxGetClientPosProfile_(session, payload); break;
      case 'AUTO_REPAIR_CLIENT': result = bnxAutoRepairClient_(session, payload); break;
      case 'GET_CLIENT_SCALE_STATUS': result = bnxGetClientScaleStatus_(session, payload); break;
      default:
        return respondJson(respondError(400, `Unknown action: ${action}`, requestId));
    }
    return respondJson(result);
  } catch (error) {
    console.error('[Backend Error]', error);
    return respondJson({ success: false, error: error.message });
  }
}

function bnxCheckClientDatabase_(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const ids = bnxGetClientDbIds_(clientId);
    const required = {
      MASTER: ['COMPANY_SETTINGS', 'LOCATION_MASTER', 'USER_MASTER', 'ROLE_MASTER', 'ITEM_MASTER', 'CATEGORY_MASTER', 'ITEM_GROUP_MASTER', 'UNIT_MASTER', 'TAX_MASTER', 'UNIT_CONVERSION_MASTER', 'SUPPLIER_MASTER', 'CUSTOMER_MASTER', 'TABLE_MASTER', 'PAYMENT_MODE_MASTER', 'LEDGER_MASTER', 'RECIPE_MASTER', 'RECIPE_ITEMS', 'BAR_ITEM_MASTER', 'ITEM_ALIAS_MASTER', 'RECIPE_VERSION'],
      TRANSACTION: ['DAY_STATUS', 'SEQUENCE_COUNTERS', 'TABLE_LIVE_STATE', 'RESERVATION_MASTER', 'ORDER_MASTER', 'ORDER_ITEMS', 'KOT_MASTER', 'KOT_ITEMS', 'KOT_STATUS_LOG', 'BILL_MASTER', 'BILL_ITEMS', 'PAYMENT_MASTER', 'STOCK_MOVEMENT', 'DAILY_COLLECTION', 'ONLINE_ORDER_MASTER', 'ONLINE_ORDER_ITEMS', 'AGGREGATOR_SETTLEMENT', 'AUDIT_LOG', 'SYNC_LOG', 'ERROR_LOG', 'KITCHEN_INDENT', 'BAR_INDENT', 'KITCHEN_CONSUMPTION', 'WASTAGE_MASTER', 'PURCHASE_MASTER', 'PURCHASE_ITEMS', 'PETTY_CASH_MASTER', 'PETTY_CASH'],
      REPORT: ['REPORT_REGISTRY', 'SALES_DAY_BOOK', 'SALES_SUMMARY', 'ITEM_SALES_REPORT', 'CATEGORY_SALES_REPORT', 'FOOD_COST_REPORT', 'BAR_COST_REPORT', 'STOCK_REPORT', 'PURCHASE_REPORT', 'SUPPLIER_REPORT', 'GST_REPORT', 'PAYMENT_REPORT', 'CASH_BANK_REPORT', 'CUSTOMER_DUES_REPORT', 'SUPPLIER_DUES_REPORT', 'PROFIT_LOSS_REPORT', 'ONLINE_ORDER_REPORT', 'AGGREGATOR_SETTLEMENT_REPORT', 'HR_REPORT', 'PAYROLL_REPORT', 'KITCHEN_PERFORMANCE', 'STEWARD_PERFORMANCE', 'BAR_PERFORMANCE', 'TABLE_PERFORMANCE', 'WASTAGE_REPORT', 'RECONCILIATION_REPORT', 'DASHBOARD_KPI', 'AI_ML_ANALYTICS']
    };
    const result = { success: true, clientId: clientId, databases: {}, checkedAt: new Date().toISOString() };

    Object.keys(required).forEach(function(dbKey) {
      const ss = bnxOpenSpreadsheetCached_(ids[dbKey]);
      const missing = required[dbKey].filter(function(name) {
        return !ss.getSheetByName(name);
      });
      result.databases[dbKey] = {
        spreadsheetId: ids[dbKey],
        spreadsheetName: ss.getName(),
        connected: true,
        missingTabs: missing
      };
    });

    result.ready = Object.keys(result.databases).every(function(k) {
      return result.databases[k].connected && result.databases[k].missingTabs.length === 0;
    });
    return result;
  } catch (e) {
    return { success: false, clientId: clientId, error: e.message, checkedAt: new Date().toISOString() };
  }
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================================
 * FINAL MULTI-CLIENT AUTH + 3-DB ROUTING
 *
 * Login/V2_AUTH creates a UUID session token and writes that token to the
 * authenticated central USER_MASTER row. Core must NOT merely accept any
 * UUID-shaped value: that was the old placeholder and caused Auth X / saves
 * / reports to fail or, worse, trust a clientId supplied by the browser.
 *
 * Resolution order:
 *   1) Central USER_MASTER SESSION / SESSION_TOKEN match
 *   2) Verify the row is ACTIVE and has web access
 *   3) Derive CLIENT_ID from the matched row, never from the browser
 *   4) Confirm the client has MASTER + TRANSACTION + REPORT DB registry
 *   5) Return the authenticated session context used by every handler
 *
 * Legacy fallback is retained only for deployments whose USER_MASTER has no
 * session column at all. Even there, the client must exist in the 3-DB
 * registry before a session is accepted.
 * ========================================================================= */
function bnxVerifySession(sessionToken, clientId) {
  const token = String(sessionToken || '').trim();
  const requestedClient = String(clientId || '').trim();
  if (!token) return null;

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_PATTERN.test(token)) return null;

  try {
    const ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    const sh = ss.getSheetByName('USER_MASTER');
    if (!sh) return null;

    const values = sh.getDataRange().getValues();
    if (!values.length) return null;

    const headers = values[0].map(function(h) {
      return String(h || '').trim().toUpperCase();
    });
    const idx = function() {
      const names = Array.prototype.slice.call(arguments);
      for (let i = 0; i < names.length; i++) {
        const n = names[i].toUpperCase();
        const p = headers.indexOf(n);
        if (p >= 0) return p;
      }
      return -1;
    };

    const sessionCol = idx('SESSION', 'SESSION_TOKEN', 'ERP_SESSION');
    const clientCol  = idx('CLIENT_ID');
    const userCol    = idx('USER_ID', 'EMP_ID');
    const roleCol    = idx('ROLE', 'USER_ROLE');
    const nameCol    = idx('FULL_NAME', 'NAME');
    const statusCol  = idx('STATUS');
    const webCol     = idx('WEB_ACCESS');

    if (clientCol < 0) return null;

    /* Strong path: V2_AUTH persists the UUID in USER_MASTER. */
    if (sessionCol >= 0) {
      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        if (String(row[sessionCol] || '').trim() !== token) continue;

        const rowClient = String(row[clientCol] || '').trim();
        if (!rowClient) return null;

        const status = statusCol >= 0
          ? String(row[statusCol] || 'ACTIVE').trim().toUpperCase()
          : 'ACTIVE';
        if (status && !['ACTIVE', 'YES', 'ENABLED'].includes(status)) return null;

        const web = webCol >= 0
          ? String(row[webCol] || 'YES').trim().toUpperCase()
          : 'YES';
        if (['NO', 'FALSE', 'BLOCKED', 'DISABLED'].includes(web)) return null;

        const role = roleCol >= 0 ? String(row[roleCol] || 'STAFF').trim().toUpperCase() : 'STAFF';
        const isGlobalAdmin = role === 'SUPER_ADMIN' || role === 'DEVELOPER';
        /* Normal users are tenant locked. Global Super Admin/Developer may
           explicitly target another registered client. */
        if (requestedClient && requestedClient !== rowClient && !isGlobalAdmin) return null;
        let effectiveClient = rowClient;
        // Global Super Admin/Developer may work on any registered client.
        // Normal users are permanently tenant-scoped to their own CLIENT_ID.
        if (isGlobalAdmin && requestedClient && requestedClient !== rowClient) {
          const target = bnxGetClientRegistryRow_(requestedClient);
          if (!target) throw new Error('Target client '+requestedClient+' is not registered');
          effectiveClient = requestedClient;
        }
        let dbIds;
        try { dbIds = bnxGetClientDbIds_(effectiveClient); }
        catch (routeErr) {
          // Automatic onboarding/migration only when the central registry is incomplete.
          dbIds = bnxEnsureClientDatabasesProvisioned_(effectiveClient).databases;
        }
        // Self-heal missing tenant tabs on the first authenticated request after
        // provisioning/schema changes. The schema cache keeps this out of the
        // normal per-request path for the next 6 hours.
        try { bnxEnsureClientSchema_(effectiveClient); } catch (schemaErr) {
          console.error('[TENANT AUTO-REPAIR] '+effectiveClient+': '+schemaErr.message);
        }
        return {
          CLIENT_ID: effectiveClient,
          AUTH_CLIENT_ID: rowClient,
          USER_ID: userCol >= 0 ? String(row[userCol] || '').trim() : '',
          ROLE: role,
          FULL_NAME: nameCol >= 0 ? String(row[nameCol] || '').trim() : '',
          IS_GLOBAL_ADMIN: isGlobalAdmin,
          DB_IDS: dbIds,
          timestamp: Date.now()
        };
      }

      /* A session column exists, so do NOT silently downgrade to UUID-only
         authentication when the token was not found. */
      return null;
    }

    /* Legacy deployment compatibility: only if USER_MASTER has no session
       field. The client must still be provisioned in all three databases. */
    if (!requestedClient) return null;
    let dbIds;
    try { dbIds = bnxGetClientDbIds_(requestedClient); }
    catch (routeErr) { dbIds = bnxEnsureClientDatabasesProvisioned_(requestedClient).databases; }
    try { bnxEnsureClientSchema_(requestedClient); } catch (schemaErr) { console.error('[TENANT AUTO-REPAIR] '+requestedClient+': '+schemaErr.message); }
    return { CLIENT_ID: requestedClient, USER_ID: token, ROLE: 'STAFF', IS_GLOBAL_ADMIN:false, DB_IDS: dbIds, timestamp: Date.now() };
  } catch (error) {
    console.error('[AUTH] Session validation failed:', error.message);
    return null;
  }
}

/* Return the tenant's three live Google Sheet IDs for diagnostics/settings.
   No IDs are accepted from the browser; they always come from the registry. */
function bnxGetAllClients(session, payload) {
  const role=String(session && session.ROLE || '').toUpperCase();
  if(role!=='SUPER_ADMIN' && role!=='DEVELOPER') return {success:false,error:'Super Admin authorization required'};
  try{
    const reg=bnxControlSheet_(CLIENT_DB_REGISTRY_TAB);
    const vals=reg.getDataRange().getValues();
    if(!vals.length) return {success:true,data:[],meta:{registeredClients:0,activeClients:0,readyClients:0}};
    const h=vals[0].map(x=>String(x||'').trim().toUpperCase()); const ix=n=>h.indexOf(n);
    const clients=[]; let active=0,ready=0;
    for(let r=1;r<vals.length;r++){
      const id=ix('CLIENT_ID')>=0?String(vals[r][ix('CLIENT_ID')]||'').trim():''; if(!id) continue;
      const status=ix('STATUS')>=0?String(vals[r][ix('STATUS')]||'ACTIVE').trim():'ACTIVE';
      const company=ix('COMPANY_NAME')>=0?String(vals[r][ix('COMPANY_NAME')]||'').trim():'';
      const industry=ix('BUSINESS_TYPE')>=0?String(vals[r][ix('BUSINESS_TYPE')]||'').trim():(ix('INDUSTRY')>=0?String(vals[r][ix('INDUSTRY')]||'').trim():'');
      const plan=ix('PLAN')>=0?String(vals[r][ix('PLAN')]||'').trim():'';
      const license=ix('LICENSE_STATUS')>=0?String(vals[r][ix('LICENSE_STATUS')]||'').trim():(ix('LICENSE')>=0?String(vals[r][ix('LICENSE')]||'').trim():'');
      const m=ix('MASTER_DB_ID')>=0?String(vals[r][ix('MASTER_DB_ID')]||'').trim():'';
      const t=ix('TRANSACTION_DB_ID')>=0?String(vals[r][ix('TRANSACTION_DB_ID')]||'').trim():'';
      const p=ix('REPORT_DB_ID')>=0?String(vals[r][ix('REPORT_DB_ID')]||'').trim():'';
      const isActive=['ACTIVE','YES','ENABLED'].includes(status.toUpperCase()); if(isActive) active++;
      const isReady=!!(m&&t&&p); if(isReady) ready++;
      clients.push({clientId:id,name:company||id,location:ix('LOCATION')>=0?String(vals[r][ix('LOCATION')]||'').trim():'',industry:industry||'RESTAURANT',plan:plan||'—',license:license||status,todaySales:null,tables:null,ready:isReady,status});
    }
    return {success:true,data:clients,meta:{registeredClients:clients.length,activeClients:active,readyClients:ready,incompleteClients:active-ready,source:'CLIENT_DATABASE_REGISTRY'}};
  }catch(e){ return {success:false,error:e.message}; }
}

function bnxNextClientId_(){
  const ss=SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
  const sh=ss.getSheetByName('CLIENT_MASTER') || ss.getSheetByName('USER_SECURITY_MASTER_DB') || ss.getSheets()[0];
  const vals=sh.getDataRange().getValues();
  const h=(vals[0]||[]).map(x=>String(x||'').trim().toUpperCase()); const ci=h.indexOf('CLIENT_ID');
  let max=0; if(ci>=0){ for(let r=1;r<vals.length;r++){ const m=String(vals[r][ci]||'').match(/^CL(\d+)$/i); if(m) max=Math.max(max,parseInt(m[1],10)||0); } }
  return 'CL'+String(max+1).padStart(5,'0');
}

function bnxCreateClient(session,payload){
  const role=String(session&&session.ROLE||'').toUpperCase();
  if(role!=='SUPER_ADMIN'&&role!=='DEVELOPER') return {success:false,error:'Super Admin authorization required'};
  payload=payload||{};
  const company=String(payload.companyName||payload.name||'').trim();
  if(!company) return {success:false,error:'Company name is required'};
  const businessType=bnxNormalizeBusinessType_(String(payload.businessType||payload.industry||'RESTAURANT'));
  const plan=String(payload.plan||'TRIAL').trim().toUpperCase();
  const phone=String(payload.phone||payload.mobile||'').trim(), email=String(payload.email||'').trim(), city=String(payload.city||'').trim();
  const requestedId=String(payload.clientId||'').trim().toUpperCase();
  let clientId='';
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    clientId=requestedId||bnxNextClientId_();
    if(!/^CL\d{5,}$/.test(clientId)) return {success:false,error:'Client ID must look like CL00001'};
    if(bnxGetClientRegistryRow_(clientId)) return {success:false,error:'Client '+clientId+' already exists'};
    const ss=SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    const sh=ss.getSheetByName('CLIENT_MASTER') || ss.getSheetByName('USER_SECURITY_MASTER_DB') || ss.getSheets()[0];
    const vals=sh.getDataRange().getValues(); const h=(vals[0]||[]).map(x=>String(x||'').trim().toUpperCase()); const out=h.map(()=>''), set=(n,v)=>{const i=h.indexOf(n);if(i>=0)out[i]=v;};
    set('CLIENT_ID',clientId); set('COMPANY_NAME',company); set('NAME',company); set('BUSINESS_TYPE',businessType); set('INDUSTRY',businessType); set('CLIENT_TYPE',businessType); set('PLAN',plan); set('STATUS','ACTIVE'); set('CREATED_ON',new Date());
    set('PHONE',phone); set('MOBILE_NO',phone); set('EMAIL',email); set('CITY',city); set('ADDRESS',String(payload.address||'')); set('STATE',String(payload.state||'')); set('GSTIN',String(payload.gstin||payload.gst||''));
    sh.appendRow(out);
    const regSh=bnxControlSheet_(CLIENT_DB_REGISTRY_TAB); const rv=regSh.getDataRange().getValues(); const rh=(rv[0]||[]).map(x=>String(x||'').trim().toUpperCase()); const rout=rh.map(()=>''), rset=(n,v)=>{const i=rh.indexOf(n);if(i>=0)rout[i]=v;};
    rset('CLIENT_ID',clientId); rset('COMPANY_NAME',company); rset('BUSINESS_TYPE',businessType); rset('INDUSTRY',businessType); rset('PLAN',plan); rset('STATUS','ACTIVE'); rset('CREATED_ON',new Date());
    regSh.appendRow(rout);
  }catch(e){ return {success:false,error:e.message}; }
  finally{ try{lock.releaseLock();}catch(e){} }
  try{
    const provision=bnxEnsureClientDatabasesProvisioned_(clientId);
    const schema=bnxEnsureClientSchema_(clientId);
    return {success:true,clientId,companyName:company,businessType,plan,provision,schema,createdAt:new Date().toISOString()};
  }catch(e){ return {success:false,clientId,error:e.message}; }
}

function bnxProvisionClientForAdmin_(session,payload){
  const role=String(session&&session.ROLE||'').toUpperCase();
  const requested=String(payload&&payload.clientId||'').trim();
  if(!requested||requested===String(session&&session.CLIENT_ID||'').trim()) return bnxEnsureClientDatabasesProvisioned_(session.CLIENT_ID);
  if(role!=='SUPER_ADMIN'&&role!=='DEVELOPER') return {success:false,error:'Super Admin authorization required for another client'};
  if(!bnxGetClientRegistryRow_(requested)) return {success:false,error:'Client '+requested+' is not registered'};
  return bnxEnsureClientDatabasesProvisioned_(requested);
}

function bnxGetClientDatabaseStatus(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const ids = bnxGetClientDbIds_(clientId);
    const reg = bnxGetClientRegistryRow_(clientId);
    const schema=bnxEnsureClientSchema_(clientId);
    const out = { success: true, clientId: clientId, folderId: reg ? String(reg.FOLDER_ID || '') : '', templates: BNX_TEMPLATE_IDS_, databases: {}, schema:schema, ready: true };

    [['MASTER', ids.MASTER], ['TRANSACTION', ids.TRANSACTION], ['REPORT', ids.REPORT]]
      .forEach(function(pair) {
        const ss = bnxOpenSpreadsheetCached_(pair[1]);
        out.databases[pair[0]] = {
          spreadsheetId: pair[1],
          spreadsheetName: ss.getName(),
          connected: true
        };
      });

    return out;
  } catch (e) {
    return { success: false, clientId: clientId, ready: false, error: e.message };
  }
}

function bnxNowParts_() {
  const now = new Date();
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  return {
    date: Utilities.formatDate(now, tz, 'yyyy-MM-dd'),
    businessDate: bnxBusinessDateKey_(now),
    time: Utilities.formatDate(now, tz, 'HH:mm:ss'),
    iso: now.toISOString()
  };
}

function bnxResolveClientDateTime_(clientDate, clientTime) {
  const dateOk = typeof clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientDate);
  const timeOk = typeof clientTime === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(clientTime);
  if (dateOk && timeOk) {
    const d = new Date(clientDate + 'T' + (clientTime.length === 5 ? clientTime + ':00' : clientTime));
    return {
      date: clientDate,
      businessDate: !isNaN(d.getTime()) ? bnxBusinessDateKey_(d) : clientDate,
      time: clientTime.length === 5 ? clientTime + ':00' : clientTime
    };
  }
  return null;
}

/* ============================================================================
 * PASS #64 -- SYNC_LOG dedup, cache-backed (was: full O(n) sheet scan on
 * EVERY single SAVE_ORDER / SAVE_KOT / SAVE_BILL / SAVE_PAYMENT /
 * PRODUCTION / IMPORT_BATCH call -- TWICE per call, once in
 * bnxClaimRequest and again in bnxMarkSynced). SYNC_LOG only ever grows
 * (one row per sync attempt, forever), so this scan got slower every day
 * the restaurant used the app -- the app's own [BN_HEALTH] console log
 * was already showing ~7.7s average API response before this fix, and
 * this was the single biggest confirmed cost in that number: two full
 * reads of an ever-growing sheet, on every save.
 *
 * Fix: keep a CacheService entry per (clientId, requestId) that mirrors
 * exactly what the SYNC_LOG row says (status/transactionId/rowIndex).
 * bnxCheckDuplicate now checks that cache first -- a hit (the overwhelmingly
 * common case: every request in this app carries a requestId and almost
 * always resolves the same run) skips the sheet scan entirely.  A cache
 * miss (first time this requestId has ever been seen, or the entry aged
 * out past CacheService's 6-hour ceiling) falls back to the exact same
 * full-sheet scan as before -- so correctness is unchanged, only the
 * common-case cost drops. bnxClaimRequest and bnxMarkSynced now also
 * WRITE that same cache entry, so the very next check (bnxMarkSynced
 * right after bnxClaimRequest, in the same request) is already a cache
 * hit and never touches the sheet at all for that row's own SYNC_LOG
 * update either -- bnxMarkSynced uses the cached rowIndex directly
 * instead of re-scanning to find its own row.
 * ============================================================================ */
function bnxSyncLogCacheKey_(clientId, requestId) {
  return 'synclog2_' + clientId + '_' + requestId;
}
function bnxSyncLogCacheGet_(clientId, requestId) {
  if (!requestId) return null;
  try {
    const raw = CacheService.getScriptCache().get(bnxSyncLogCacheKey_(clientId, requestId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function bnxSyncLogCachePut_(clientId, requestId, info) {
  if (!requestId) return;
  try { CacheService.getScriptCache().put(bnxSyncLogCacheKey_(clientId, requestId), JSON.stringify(info), 21600); } catch (e) {}
}

/* FINAL SHARED STEWARD AUTO-ASSIGNMENT + RUNNING TABLE SYNC */
function bnxResolveStewardAssignment_(clientId,tableNo,payload){
  payload=payload||{}; const explicitId=String(payload.createdById||payload.stewardId||payload.captainId||payload.waiterId||'').trim(); const explicitLogin=String(payload.createdByLogin||payload.stewardLogin||payload.captainLogin||payload.waiterLogin||'').trim(); const explicitName=String(payload.createdByName||payload.steward||payload.waiter||payload.captain||'').trim();
  if(explicitId||explicitLogin||explicitName) return {id:explicitId,login:explicitLogin,name:explicitName,source:'EXPLICIT'};
  const tno=String(tableNo||'').trim();
  const owner=(sheetName)=>{try{const sh=bnxClientSheet(clientId,sheetName),v=sh.getDataRange().getValues(),h=v[0]||[];for(let r=1;r<v.length;r++){const o=bnxRowToObject(v[r],h);const no=String(o.TABLE_NO||o.TABLE_NUMBER||o.TABLE_ID||o.TABLE_CODE||'').trim();if(no!==tno)continue;const id=o.CAPTAIN_ID||o.STEWARD_ID||o.WAITER_ID||o.ASSIGNED_STEWARD_ID||o.ASSIGNED_CAPTAIN_ID||'';const login=o.CAPTAIN_LOGIN||o.STEWARD_LOGIN||o.WAITER_LOGIN||'';const name=o.CAPTAIN||o.STEWARD||o.WAITER||o.ASSIGNED_STEWARD||o.ASSIGNED_CAPTAIN||'';if(id||login||name)return {id:String(id||''),login:String(login||''),name:String(name||''),source:sheetName};}}catch(e){}return null;};
  const mapped=owner('TABLE_LIVE_STATE')||owner('TABLE_MASTER'); if(mapped)return mapped;
  try{const sh=bnxClientSheet(clientId,SHEETS.USER_MASTER),v=sh.getDataRange().getValues(),h=v[0]||[],staff=[];for(let r=1;r<v.length;r++){const u=bnxRowToObject(v[r],h);if(u.CLIENT_ID&&String(u.CLIENT_ID)!==String(clientId))continue;if(u.IS_ACTIVE===false||String(u.IS_ACTIVE).toUpperCase()==='FALSE')continue;const role=String(u.ROLE||u.ROLE_NAME||u.ROLE_ID||u.STAFF_TYPE||'').toUpperCase();if(!['CAPTAIN','STEWARD','WAITER'].includes(role))continue;const id=u.USER_ID||u.USER_CODE||u.EMP_ID||'',login=u.USERNAME||u.LOGIN_ID||u.USER_CODE||'',name=u.FULL_NAME||u.NAME||'';if(id&&name)staff.push({id:String(id),login:String(login),name:String(name),role});}if(staff.length){const p=PropertiesService.getScriptProperties(),k='BNX_STEWARD_RR_'+clientId,n=(Number(p.getProperty(k)||0)||0)%staff.length;p.setProperty(k,String(n+1));return Object.assign({source:'ROUND_ROBIN'},staff[n]);}}catch(e){}
  return {id:'',login:'',name:'',source:'NONE'};
}
function bnxApplyRunningTableFromOrder_(clientId,tableNo,covers,billAmount,steward){const no=String(tableNo||'').trim();if(!no)return;try{const sh=bnxClientSheet(clientId,SHEETS.TABLE_LIVE_STATE),v=sh.getDataRange().getValues(),h=v[0]||[],tn=h.indexOf('TABLE_NO'),ci=h.indexOf('CLIENT_ID'),st=h.indexOf('STATUS'),cv=h.indexOf('COVERS'),ba=h.indexOf('BILL_AMOUNT'),bt=h.indexOf('START_TIME'),up=h.indexOf('UPDATED_AT'),cap=h.indexOf('CAPTAIN'),cid=h.indexOf('CAPTAIN_ID'),cl=h.indexOf('CAPTAIN_LOGIN');for(let r=1;r<v.length;r++){if(tn>=0&&String(v[r][tn]).trim()!==no)continue;if(ci>=0&&String(v[r][ci])!==String(clientId))continue;if(st>=0)sh.getRange(r+1,st+1).setValue('RUNNING');if(cv>=0)sh.getRange(r+1,cv+1).setValue(Number(covers)||0);if(ba>=0)sh.getRange(r+1,ba+1).setValue(Number(billAmount)||0);if(bt>=0&&!v[r][bt])sh.getRange(r+1,bt+1).setValue(new Date().toISOString());if(cap>=0&&steward?.name)sh.getRange(r+1,cap+1).setValue(steward.name);if(cid>=0&&steward?.id)sh.getRange(r+1,cid+1).setValue(steward.id);if(cl>=0&&steward?.login)sh.getRange(r+1,cl+1).setValue(steward.login);if(up>=0)sh.getRange(r+1,up+1).setValue(new Date().toISOString());return;}bnxAppendRow(clientId,SHEETS.TABLE_LIVE_STATE,{CLIENT_ID:clientId,TABLE_NO:no,STATUS:'RUNNING',COVERS:Number(covers)||0,BILL_AMOUNT:Number(billAmount)||0,START_TIME:new Date().toISOString(),CAPTAIN:steward?.name||'',CAPTAIN_ID:steward?.id||'',CAPTAIN_LOGIN:steward?.login||'',CREATED_AT:new Date().toISOString(),UPDATED_AT:new Date().toISOString()});}catch(e){bnxLogError(clientId,'bnxApplyRunningTableFromOrder_ failed: '+e.message,{tableNo:no});}}

function bnxSaveOrder(session, payload) {
  const requestId = payload.requestId;
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.ORDER);
  if (!claim.claimed) {
    return { success: true, transactionId: claim.existing.transactionId, message: 'Duplicate request detected -- using previous result', cached: true };
  }
  const validation = bnxValidateOrder(payload);
  if (!validation.valid) return respondError(400, validation.errors.join('; '), requestId);
  try {
    const locationId = payload.locationId || payload.LOCATION_ID || '';
    const tableNo = payload.tableId || payload.TABLE_ID || '';
    const assignedSteward = bnxResolveStewardAssignment_(clientId, tableNo, payload);
    if(assignedSteward.name){ payload.waiter=assignedSteward.name; payload.steward=assignedSteward.name; payload.captain=assignedSteward.name; payload.createdByName=assignedSteward.name; }
    if(assignedSteward.id){ payload.createdById=assignedSteward.id; payload.stewardId=assignedSteward.id; payload.captainId=assignedSteward.id; }
    if(assignedSteward.login){ payload.createdByLogin=assignedSteward.login; payload.stewardLogin=assignedSteward.login; payload.captainLogin=assignedSteward.login; }
    const clientDt = bnxResolveClientDateTime_(payload.orderDate, payload.orderTime);
    const now = clientDt || bnxNowParts_();
    const wallClockNow = bnxNowParts_();

    /* FIX ("2nd KOT not save" -- root cause, not a guess): bnxSaveOrder used
       to be strictly INSERT-ONLY (flagged honestly as a known gap in the
       old header's REMAINING GAPS list). Every station's KOT split
       (printKOTSplit) already avoids firing more than one SAVE_ORDER per
       ticket sent, but a SECOND, LATER ticket for the SAME real order
       (an add-on: more items sent to kitchen after the first KOT already
       went out, for the exact same table/order) still calls SAVE_ORDER
       again with the SAME friendly orderId (posOrderNo, e.g. "#ORD-1055").
       Insert-only meant that call silently created a SECOND, disconnected
       ORDER_MASTER row under the identical ORDER_NUMBER -- Order Register
       then either showed the same order twice with two different partial
       item lists, or (if the steward only looked at the first row) the
       add-on items looked like they never saved at all. Now: look for an
       existing, still-open (not BILLED/CANCELLED) ORDER_MASTER row for
       this client+ORDER_NUMBER first. If found, this call is an add-on --
       append the new ORDER_ITEMS onto that SAME order, bump its
       UPDATED_AT, and return the EXISTING order's real ORDER_ID (not a
       new one). Only create a brand-new ORDER_MASTER row when no live
       order with that number exists yet -- the original, correct
       first-KOT behavior is unchanged. */
    const friendlyOrderNo = payload.orderId || '';
    let orderId = '';
    let orderMaster = null;
    let isAddOn = false;
    if (friendlyOrderNo) {
      try {
        const omSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
        const omValues = omSheet.getDataRange().getValues();
        const omHeaders = omValues[0];
        const ciCol = omHeaders.indexOf('CLIENT_ID');
        const noCol = omHeaders.indexOf('ORDER_NUMBER');
        const idCol = omHeaders.indexOf('ORDER_ID');
        const statusCol = omHeaders.indexOf('ORDER_STATUS');
        const updatedCol = omHeaders.indexOf('UPDATED_AT');
        for (let r = omValues.length - 1; r >= 1; r--) {
          if (ciCol !== -1 && omValues[r][ciCol] !== clientId) continue;
          if (noCol === -1 || String(omValues[r][noCol] || '').trim() !== String(friendlyOrderNo).trim()) continue;
          const status = statusCol !== -1 ? String(omValues[r][statusCol] || '').toUpperCase() : '';
          if (status === 'BILLED' || status === 'CANCELLED') continue; // that order is closed -- a new SAVE_ORDER under the same old number is a fresh order, not an add-on
          orderId = idCol !== -1 ? omValues[r][idCol] : '';
          if (updatedCol !== -1) omSheet.getRange(r + 1, updatedCol + 1).setValue(wallClockNow.iso);
          isAddOn = true;
          break;
        }
      } catch (e) { /* lookup best-effort -- falls through to normal insert below on any error */ }
    }
    if (!isAddOn) {
      orderId = generateShortId_(clientId, 'ORDER_ID');
      orderMaster = {
        ORDER_ID: orderId, CLIENT_ID: clientId, LOCATION_ID: locationId,
        ORDER_NUMBER: friendlyOrderNo || bnxGenerateOrderNumber(clientId, locationId),
        ORDER_SOURCE: payload.orderSource || 'POS',
        ORDER_TYPE: payload.orderType || payload.ORDER_TYPE || 'DINEIN',
        TABLE_ID: payload.tableId || payload.TABLE_ID || '',
        CUSTOMER_ID: payload.customerId || '', PAX: payload.covers || payload.PAX || 0,
        ORDER_DATE: now.businessDate, ORDER_TIME: now.time, STARTED_BY: payload.waiter || payload.steward || payload.captain || userId,
        CREATED_BY: payload.waiter || payload.steward || payload.captain || payload.createdByName || userId, CREATED_BY_ID: payload.createdById || userId, CREATED_BY_LOGIN: payload.waiterLogin || payload.stewardLogin || payload.captainLogin || payload.createdByLogin || '', CREATED_BY_NAME: payload.waiterName || payload.stewardName || payload.captainName || payload.createdByName || payload.waiter || payload.steward || payload.captain || '',
        ASSIGNED_STEWARD_ID: assignedSteward.id || '', ASSIGNED_STEWARD_LOGIN: assignedSteward.login || '', ASSIGNED_STEWARD: assignedSteward.name || '', ASSIGNMENT_SOURCE: assignedSteward.source || '',
        ORDER_STATUS: 'NEW', SPECIAL_INSTRUCTIONS: payload.remarks || '',
        CREATED_AT: wallClockNow.iso, UPDATED_AT: wallClockNow.iso
      };
      bnxAppendRow(clientId, SHEETS.ORDER_MASTER, orderMaster);
    }
    let seq = 0;
    (payload.items || []).forEach((item) => {
      seq++;
      const qty = item.qty || item.QUANTITY || 0;
      const rate = item.price != null ? Number(item.price) : (item.rate != null ? Number(item.rate) : (item.RATE != null ? Number(item.RATE) : 0));
      const orderItem = {
        ORDER_ITEM_ID: generateShortId_(clientId, 'ORDER_ITEM_ID'), ORDER_ID: orderId, ITEM_ID: item.ITEM_ID || item.id || item.itemId || '',
        SEQUENCE: seq, ITEM_NAME: item.name || item.ITEM_NAME || '', QUANTITY: qty,
        UNIT_ID: item.UNIT_ID || 'PIECE', RATE: rate, LINE_DISCOUNT: item.LINE_DISCOUNT || 0,
        ITEM_TAX_RATE: item.TAX_RATE != null ? Number(item.TAX_RATE) : (item.gst != null ? Number(item.gst) : 0),
        ITEM_TAX: qty * rate * (item.TAX_RATE != null ? Number(item.TAX_RATE) : (item.gst != null ? Number(item.gst) : 0)),
        LINE_TOTAL: (qty * rate) + (qty * rate * (item.TAX_RATE != null ? Number(item.TAX_RATE) : (item.gst != null ? Number(item.gst) : 0))),
        KOT_STATION: item.station || item.STATION || item.KOT_STATION || '', STATION: item.station || item.STATION || item.KOT_STATION || '', SPECIAL_INSTRUCTIONS: item.SPECIAL_INSTRUCTIONS || '', ITEM_STATUS: 'PENDING', CREATED_AT: wallClockNow.iso
      };
      bnxAppendRow(clientId, SHEETS.ORDER_ITEMS, orderItem);
    });
    const runningAmount=(payload.items||[]).reduce((s,it)=>s+(Number(it.qty||it.QUANTITY||0)*Number(it.price!=null?it.price:(it.rate||it.RATE||0))),0);
    bnxApplyRunningTableFromOrder_(clientId, tableNo, payload.covers || payload.PAX || 0, runningAmount, assignedSteward);
    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, LOCATION_ID: locationId, USER_ID: userId, ACTION: isAddOn ? 'ADD_ITEMS' : 'CREATE',
      MODULE: payload.orderSource || 'POS', RECORD_TYPE: 'ORDER', RECORD_ID: orderId, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify(orderMaster || { ORDER_ID: orderId, addOnItems: (payload.items || []).length }), DEVICE_ID: '', REQUEST_ID: requestId, TIMESTAMP: wallClockNow.iso
    });
    bnxMarkSynced(clientId, requestId, orderId, TRANSACTION_TYPES.ORDER);
    // Invalidate today's dashboard cache immediately so Orders Placed KPI
    // reflects a newly saved order without waiting for the 30s report TTL.
    try { bnxInvalidateTodayReportCaches_(clientId); } catch (e) {}
    return { success: true, transactionId: orderId, data: Object.assign({}, orderMaster || { ORDER_ID: orderId, addOn: true }, { ASSIGNED_STEWARD_ID:assignedSteward.id||'', ASSIGNED_STEWARD_LOGIN:assignedSteward.login||'', ASSIGNED_STEWARD:assignedSteward.name||'', ASSIGNMENT_SOURCE:assignedSteward.source||'' }), addOn: isAddOn };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveOrder failed: ${error.message}`, { requestId, payload });
    return respondError(500, error.message, requestId);
  }
}

function bnxFindFinalizedBillByOrder_(clientId, orderId, locationId) {
  if (!orderId) return null;
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
    if (lastRow < 2 || lastCol < 1) return null;
    const headers = sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
    const orderCol = headers.indexOf('ORDER_ID');
    if (orderCol === -1) return null;
    // P0 HIGH-VOLUME OPTIMIZATION: do not read the entire BILL_MASTER for
    // every SAVE_BILL just to detect a duplicate order. TextFinder searches
    // the indexed sheet column server-side and only the matching rows are
    // read. This is important at ~3,000 invoices/day.
    const matches = sheet.getRange(2,orderCol+1,lastRow-1,1).createTextFinder(String(orderId).trim()).matchEntireCell(true).findAll();
    for (let i=matches.length-1;i>=0;i--){
      const rowNo=matches[i].getRow();
      const vals=sheet.getRange(rowNo,1,1,lastCol).getValues()[0];
      const b=bnxRowToObject(vals,headers);
      if (String(b.CLIENT_ID||'') !== String(clientId)) continue;
      if (locationId && b.LOCATION_ID && String(b.LOCATION_ID)!==String(locationId)) continue;
      if (String(b.BILL_STATUS||'').toUpperCase() !== 'FINALIZED') continue;
      if (!b.BILL_ID) continue;
      return b;
    }
  } catch (e) {
    console.warn('[bnxFindFinalizedBillByOrder_]', e);
  }
  return null;
}

function bnxResolveOrderIdByRef_(clientId, ref, locationId) {
  const key=String(ref||'').trim(); if(!key) return '';
  try{
    const sheet=bnxClientSheet(clientId,SHEETS.ORDER_MASTER);
    const lastCol=sheet.getLastColumn(), lastRow=sheet.getLastRow();
    if(lastRow<2||lastCol<1) return '';
    const headers=sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
    const candidates=['ORDER_ID','ORDER_NUMBER'];
    for(const field of candidates){
      const col=headers.indexOf(field); if(col===-1) continue;
      const matches=sheet.getRange(2,col+1,lastRow-1,1).createTextFinder(key).matchEntireCell(true).findAll();
      for(let i=matches.length-1;i>=0;i--){
        const rowNo=matches[i].getRow();
        const o=bnxRowToObject(sheet.getRange(rowNo,1,1,lastCol).getValues()[0],headers);
        if(String(o.CLIENT_ID||'')!==String(clientId)) continue;
        if(locationId && o.LOCATION_ID && String(o.LOCATION_ID)!==String(locationId)) continue;
        if(o.ORDER_ID) return String(o.ORDER_ID).trim();
      }
    }
  }catch(e){ console.warn('[bnxResolveOrderIdByRef_]',e); }
  return '';
}

function bnxSaveBill(session, payload) {
  const requestId = payload.requestId;
  const bill = payload.bill || {};
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.BILL);
  if (!claim.claimed) {
    const existingId = claim.existing && claim.existing.transactionId;
    const existingBill = existingId ? bnxFindBillById_(clientId, existingId) : null;
    return { success: true, transactionId: existingId || '', data: existingBill || undefined, message: 'Duplicate request detected — existing bill reused', cached: true };
  }
  const validation = bnxValidateBill(bill);
  if (!validation.valid) return respondError(400, validation.errors.join('; '), requestId);
  try {
    const billId = generateShortId_(clientId, 'BILL_ID');
    const locationId = payload.locationId || payload.LOCATION_ID || '';
    // Resolve friendly ORDER_NUMBER/KOT reference to the real ORDER_ID so
    // one order cannot be billed twice just because the browser generated
    // a fresh requestId on the second click/device.
    if(!bill.orderId && bill.orderNo) bill.orderId = bnxResolveOrderIdByRef_(clientId,bill.orderNo,locationId);
    if(!bill.orderId && bill.ORDER_ID) bill.orderId = String(bill.ORDER_ID);
    // P0 BILL SAFETY: one finalized bill per order unless the caller explicitly
    // opts into split billing. The browser can generate a new requestId on every
    // click, so requestId-only idempotency cannot stop a second bill for the same order.
    // This closes the exact BIL00348/BIL00349/BIL00350 duplication seen in CL00010.
    const allowSplitBill = payload.allowSplitBill === true || bill.allowSplitBill === true || payload.SPLIT_BILL === true;
    if (!allowSplitBill && bill.orderId) {
      const existingOrderBill = bnxFindFinalizedBillByOrder_(clientId, bill.orderId, locationId);
      if (existingOrderBill) {
        try { bnxMarkSynced(clientId, requestId, existingOrderBill.BILL_ID, TRANSACTION_TYPES.BILL); } catch (e) {}
        return { success: true, transactionId: existingOrderBill.BILL_ID, data: existingOrderBill, cached: true, duplicateOrder: true,
          message: 'Order is already billed — existing confirmed invoice reused.' };
      }
    }
    // Accept both the canonical billDate/billTime names and the legacy/front-end
    // dt/tm names. Older New Bill code sends dt/tm, while some callers send
    // billDate/billTime. Previously the latter were the only names read here,
    // so the selected invoice date could silently fall back to today's date.
    const requestedBillDate = bill.billDate || bill.dt || bill.date || '';
    const requestedBillTime = bill.billTime || bill.tm || bill.time || '';
    const clientDt = bnxResolveClientDateTime_(requestedBillDate, requestedBillTime);
    const wallClockNow = bnxNowParts_();
    const now = clientDt || {
      date: bnxBusinessDateKey_(new Date()),
      time: wallClockNow.time
    };
    const subtotal = Number(bill.sub) || 0;
    const tax = Number(bill.gst) || 0;
    const total = Number(bill.total) || (subtotal + tax);
    const billDiscount = Math.max(0, Number(bill.disc) || 0);
    const taxableAfterDiscount = Math.max(0, +(subtotal - billDiscount).toFixed(2));
    const isPaid = !/^pending$/i.test(bill.status || '');
    let customerId = '';
    if (!isPaid && (bill.customer || bill.mob)) {
      customerId = bnxResolveCustomerId_(clientId, bill.customer, bill.mob);
    }
    const billMaster = {
      BILL_ID: billId, CLIENT_ID: clientId, LOCATION_ID: locationId, ORDER_ID: bill.orderId || '',
      COUNTER_CODE: bnxNormalizeCounterCode_(bill.counterCode || payload.counterCode || 'C1'),
      BILL_NUMBER: bnxGenerateBillNumber(clientId, locationId, bill.counterCode || payload.counterCode || 'C1'), BILL_DATE: now.businessDate, BILL_TIME: now.time,
      TABLE_ID: bill.table || '', CUSTOMER_ID: customerId, CUSTOMER_NAME: bill.customer || 'Walk-in',
      BILL_TYPE: 'DINEIN', COVERS: 1, SUBTOTAL: subtotal, ITEM_DISCOUNT: 0,
      SUBTOTAL_AFTER_ITEM_DISCOUNT: taxableAfterDiscount, BILL_DISCOUNT: billDiscount, TAXABLE_AMOUNT: taxableAfterDiscount,
      TAX_RATE: taxableAfterDiscount > 0 ? +(tax / taxableAfterDiscount).toFixed(4) : 0, TAX_AMOUNT: tax,
      ROUND_OFF: +(total - (taxableAfterDiscount + tax)).toFixed(2), GRAND_TOTAL: total,
      DUE_AMOUNT: isPaid ? 0 : total, BILL_STATUS: 'FINALIZED', PAYMENT_STATUS: isPaid ? 'PAID' : 'DUE',
      GST_BREAKUP: JSON.stringify({ SGST: tax / 2, CGST: tax / 2 }),
      NOTES: bill.mob ? ('Customer mobile: ' + bill.mob) : '', CREATED_BY: bill.waiter || userId,
      CREATED_AT: wallClockNow.iso, FINALIZED_BY: bill.waiter || userId, FINALIZED_AT: wallClockNow.iso,
      NC_REASON: bill.ncReason || '', NC_APPROVED_BY: bill.ncApprovedBy || ''
    };
    bnxAppendRow(clientId, SHEETS.BILL_MASTER, billMaster);
    const itemNameMap_ = bnxCachedItemNameMap_(clientId);
    /* PASS #66: build every BILL_ITEMS row first, write them ALL in one
       batch call instead of one bnxAppendRow per item. */
    const billItemRows = [];
    (bill.itemsDetail || []).forEach((item, idx) => {
      const qty = item.qty || 0;
      const rate = item.rate || 0;
      const lineTotal = item.amt != null ? item.amt : qty * rate;
      const resolvedItemId = itemNameMap_[String(item.name||'').toLowerCase().trim()] || '';
      // FIX ("liquor items non-GST 0"): prefer the real per-item rate the
      // frontend now sends (item.taxRate, e.g. 0 for liquor, 0.05 for
      // food) over the old one-rate-for-the-whole-bill fallback.
      const lineTaxRate = (item.taxRate != null && item.taxRate !== '') ? Number(item.taxRate) : billMaster.TAX_RATE;
      billItemRows.push({
        BILL_ITEM_ID: generateShortId_(clientId, 'BILL_ITEM_ID'), BILL_ID: billId, ORDER_ITEM_ID: '', ITEM_ID: resolvedItemId,
        SEQUENCE: idx + 1, ITEM_NAME: item.name || '', QUANTITY: qty, UNIT_ID: 'PIECE', RATE: rate,
        LINE_DISCOUNT: 0, DISCOUNTED_RATE: rate, TAXABLE_PER_ITEM: lineTotal,
        TAX_RATE: lineTaxRate, TAX_PER_ITEM: +(lineTotal * lineTaxRate).toFixed(2),
        LINE_TOTAL: lineTotal, CREATED_AT: wallClockNow.iso
      });
    });
    bnxAppendRowsBatch_(clientId, SHEETS.BILL_ITEMS, billItemRows);
    if (isPaid && total > 0) {
      const paymentId = generateShortId_(clientId, 'PAYMENT_ID');
      const payment = {
        PAYMENT_ID: paymentId, CLIENT_ID: clientId, LOCATION_ID: locationId, BILL_ID: billId,
        PAYMENT_MODE_ID: '', PAYMENT_MODE: bill.pay || 'CASH', AMOUNT: total, PAYMENT_DATE: now.businessDate,
        PAYMENT_TIME: now.time, REFERENCE: '', PAYMENT_STATUS: 'SUCCESS', CREATED_BY: bill.waiter || userId,
        CREATED_AT: wallClockNow.iso,
        TIPS_AMOUNT: Number(bill.tips) || 0
      };
      bnxAppendRow(clientId, SHEETS.PAYMENT_MASTER, payment);
    }
    if (!isPaid && customerId && total > 0) {
      bnxUpsertCustomerDue_(clientId, customerId, total, now.businessDate, 'BILL');
    }
    /* PASS #66: STOCK_MOVEMENT rows batched the same way -- this used to
       be a SECOND separate one-row-at-a-time bnxAppendRow loop over the
       exact same items array (its own N round-trips, on top of
       BILL_ITEMS' own N above). */
    const stockMovementRows = [];
    (bill.itemsDetail || []).forEach(item => {
      const rate = item.rate || 0;
      const resolvedItemId = itemNameMap_[String(item.name||'').toLowerCase().trim()] || '';
      stockMovementRows.push({
        STOCK_MOVEMENT_ID: generateShortId_(clientId, 'STOCK_MOVEMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: locationId, ITEM_ID: resolvedItemId,
        MOVEMENT_TYPE: 'SALE', MOVEMENT_DATE: now.businessDate, QUANTITY_IN: 0, QUANTITY_OUT: item.qty || 0,
        RATE: rate * 0.5, SOURCE_TYPE: 'BILL', SOURCE_ID: billId, CREATED_BY: bill.waiter || userId,
        CREATED_AT: wallClockNow.iso
      });
    });
    bnxAppendRowsBatch_(clientId, SHEETS.STOCK_MOVEMENT, stockMovementRows);
    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, LOCATION_ID: locationId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'POS',
      RECORD_TYPE: 'BILL', RECORD_ID: billId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(billMaster),
      REQUEST_ID: requestId, TIMESTAMP: wallClockNow.iso
    });
    // Ledger posting is part of a successful bill. Do not report SAVE_BILL as
    // successful when the accounting entry failed; that leaves a paid invoice
    // without a balanced journal and causes the false 'syncing' state later.
    bnxPostBillToLedger_(clientId, billMaster, isPaid);
    bnxMarkSynced(clientId, requestId, billId, TRANSACTION_TYPES.BILL);
    bnxInvalidateTodayReportCaches_(clientId);
    return { success: true, transactionId: billId, data: billMaster };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveBill failed: ${error.message}`, { requestId, bill });
    return respondError(500, error.message, requestId);
  }
}

function bnxSaveKOT(session, payload) {
  const requestId = payload.requestId;
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.KOT);
  if (!claim.claimed) return { success: true, transactionId: claim.existing.transactionId, cached: true };
  try {
    const kotId = generateShortId_(clientId, 'KOT_ID');
    const locationId = payload.locationId || payload.LOCATION_ID || '';
    const now = bnxNowParts_();
    const kotNumber = payload.kotNumber || payload.KOT_NUMBER || bnxGenerateKOTNumber(clientId, locationId);

    // Resolve the real ORDER_ID. POS normally sends the friendly order
    // number (for example ORD-1040), while KOT_MASTER.ORDER_ID should point
    // to ORDER_MASTER.ORDER_ID. Keeping this link correct lets reports
    // recover the original ORDER_TIME and keeps KOT/order reconciliation
    // one-to-one.
    const suppliedOrderRef = String(payload.orderNo || payload.ORDER_ID || '').trim();
    let linkedOrderId = suppliedOrderRef;
    if (suppliedOrderRef) {
      try {
        const os = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
        const ov = os.getDataRange().getValues();
        const oh = ov[0] || [];
        for (let r = 1; r < ov.length; r++) {
          const o = bnxRowToObject(ov[r], oh);
          if (o.CLIENT_ID !== clientId) continue;
          if (String(o.ORDER_ID || '') === suppliedOrderRef || String(o.ORDER_NUMBER || '') === suppliedOrderRef) {
            linkedOrderId = o.ORDER_ID || suppliedOrderRef;
            break;
          }
        }
      } catch (linkErr) { console.warn('[bnxSaveKOT] order link lookup failed: ' + linkErr.message); }
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) return respondError(400, 'KOT requires at least one item', requestId);
    const kotMaster = {
      KOT_ID: kotId, CLIENT_ID: clientId, LOCATION_ID: locationId,
      ORDER_ID: linkedOrderId, KOT_NUMBER: kotNumber,
      TABLE_ID: payload.table || payload.TABLE_ID || '', CUSTOMER_NAME: payload.customerName || '',
      KOT_SOURCE: payload.kotSource || payload.KOT_SOURCE || 'POS',
      KOT_STATION: payload.station || payload.STATION || payload.kotStation || '', STATION: payload.station || payload.STATION || payload.kotStation || '',
      ASSIGNED_STEWARD: payload.steward || payload.waiter || payload.captain || '',
      KOT_DATE: now.businessDate, KOT_TIME: now.time, COVERS: payload.covers || payload.COVERS || 0,
      KOT_STATUS: 'PRINTED', PRIORITY: payload.priority || payload.PRIORITY || 'NORMAL',
      STARTED_BY: payload.waiter || userId, KITCHEN_NOTES: payload.remarks || '',
      STARTED_AT: now.iso, CREATED_AT: now.iso
    };
    // HARD GUARANTEE: write to the client's TRANSACTION_DB KOT_MASTER.
    // bnxClientSheet() routes KOT_MASTER/KOT_ITEMS through the client's
    // TRANSACTION_DB registry entry; do not fall back to browser/local data.
    const kotSheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const kotHeaders = kotSheet.getRange(1, 1, 1, kotSheet.getLastColumn()).getValues()[0].map(String);
    if (!kotHeaders.includes('KOT_ID')) throw new Error('KOT_MASTER is missing required KOT_ID header');
    bnxAppendRow(clientId, SHEETS.KOT_MASTER, kotMaster);
    items.forEach((item, idx) => {
      const qty = item.qty || item.QUANTITY || 0;
      const rate = item.rate != null ? item.rate : (item.price != null ? item.price : 0);
      const kotItem = {
        KOT_ITEM_ID: generateShortId_(clientId, 'KOT_ITEM_ID'), KOT_ID: kotId, ORDER_ITEM_ID: item.ORDER_ITEM_ID || '',
        ITEM_ID: item.ITEM_ID || '', SEQUENCE: idx + 1, ITEM_NAME: item.name || item.ITEM_NAME || '',
        QUANTITY: qty, UNIT_ID: item.UNIT_ID || 'PIECE', RATE: rate, AMOUNT: qty * rate,
        ITEM_STATUS: 'NEW', KOT_STATION: item.station || item.STATION || item.KOT_STATION || '', STATION: item.station || item.STATION || item.KOT_STATION || '', SPECIAL_INSTRUCTIONS: item.SPECIAL_INSTRUCTIONS || '', CREATED_AT: now.iso
      };
      bnxAppendRow(clientId, SHEETS.KOT_ITEMS, kotItem);
    });
    // VERIFY the physical write before reporting success. This prevents the
    // POS from saying KOT sent when the sheet routing/schema/write actually failed.
    const verifyValues = kotSheet.getDataRange().getValues();
    const verifyHeaders = verifyValues[0] || [];
    const kotIdCol = verifyHeaders.indexOf('KOT_ID');
    let masterWritten = false;
    for (let r = verifyValues.length - 1; r >= 1; r--) {
      if (String(verifyValues[r][kotIdCol] || '') === String(kotId)) { masterWritten = true; break; }
    }
    if (!masterWritten) throw new Error('KOT_MASTER write verification failed for ' + kotId);

    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, LOCATION_ID: locationId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'KITCHEN',
      RECORD_TYPE: 'KOT', RECORD_ID: kotId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(kotMaster),
      REQUEST_ID: requestId, TIMESTAMP: now.iso
    });
    bnxMarkSynced(clientId, requestId, kotId, TRANSACTION_TYPES.KOT);
    return { success: true, transactionId: kotId, kotNumber: kotNumber };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveKOT failed: ${error.message}`, { requestId, data: payload });
    return respondError(500, error.message, requestId);
  }
}

function bnxSavePayment(session, payload) {
  const requestId = payload.requestId;
  const data = payload.data || {};
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.PAYMENT);
  if (!claim.claimed) return { success: true, transactionId: claim.existing.transactionId, cached: true };
  if (!data.AMOUNT || data.AMOUNT <= 0) return respondError(400, 'AMOUNT must be > 0', requestId);
  try {
    const paymentId = generateShortId_(clientId, 'PAYMENT_ID');
    const now = bnxNowParts_();
    const payment = {
      PAYMENT_ID: paymentId, CLIENT_ID: clientId, LOCATION_ID: data.LOCATION_ID,
      BILL_ID: data.BILL_ID || '', CUSTOMER_ID: data.CUSTOMER_ID || '',
      PAYMENT_MODE_ID: data.PAYMENT_MODE_ID || '', PAYMENT_MODE: data.PAYMENT_MODE || 'CASH',
      AMOUNT: data.AMOUNT, PAYMENT_DATE: now.businessDate, PAYMENT_TIME: now.time,
      REFERENCE: data.PAYMENT_REFERENCE || '', PAYMENT_STATUS: 'SUCCESS', CREATED_BY: userId,
      CREATED_AT: now.iso,
      TIPS_AMOUNT: Number(data.TIPS_AMOUNT) || 0
    };
    bnxAppendRow(clientId, SHEETS.PAYMENT_MASTER, payment);
    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, LOCATION_ID: data.LOCATION_ID, USER_ID: userId, ACTION: 'CREATE',
      MODULE: 'PAYMENT', RECORD_TYPE: 'PAYMENT', RECORD_ID: paymentId, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify(payment), REQUEST_ID: requestId, TIMESTAMP: now.iso
    });
    bnxMarkSynced(clientId, requestId, paymentId, TRANSACTION_TYPES.PAYMENT);
    bnxInvalidateTodayReportCaches_(clientId);
    return { success: true, transactionId: paymentId, data: payment };
  } catch (error) {
    bnxLogError(clientId, `bnxSavePayment failed: ${error.message}`, { requestId, data });
    return respondError(500, error.message, requestId);
  }
}

function bnxFindBillById_(clientId, billId) {
  if (!billId) return null;
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    if (!values.length) return null;
    const headers = values[0];
    for (let r = values.length - 1; r >= 1; r--) {
      const b = bnxRowToObject(values[r], headers);
      if (String(b.CLIENT_ID || '') === String(clientId) && String(b.BILL_ID || '') === String(billId)) return b;
    }
  } catch (e) {}
  return null;
}

function bnxGetBills(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.LOCATION_ID || '';
  const fromDate = payload.FROM_DATE || '';
  const toDate = payload.TO_DATE || '';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    let filtered = rows.filter(row => {
      const rowObj = bnxRowToObject(row, headers);
      if (rowObj.CLIENT_ID !== clientId) return false;
      if (locationId && rowObj.LOCATION_ID !== locationId) return false;
      if (fromDate && rowObj.BILL_DATE < fromDate) return false;
      if (toDate && rowObj.BILL_DATE > toDate) return false;
      return true;
    });
    const bills = filtered.map(row => bnxRowToObject(row, headers));
    return { success: true, data: bills, count: bills.length };
  } catch (error) {
    bnxLogError(clientId, `bnxGetBills failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetOrders(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.LOCATION_ID || payload.locationId || '';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const data = sheet.getDataRange().getValues();
    if (!data || !data.length) return { success: true, data: [], count: 0 };
    const headers = data[0];
    const rows = data.slice(1);
    const filtered = rows.filter(row => {
      const rowObj = bnxRowToObject(row, headers);
      if (String(rowObj.CLIENT_ID || '') !== String(clientId)) return false;
      if (locationId && String(rowObj.LOCATION_ID || '') !== String(locationId)) return false;
      return true;
    });
    const orders = filtered.map(row => bnxRowToObject(row, headers));

    // Order Register needs the COMPLETE order history, including BILLED rows.
    // GET_ACTIVE_ORDERS intentionally removes BILLED/CANCELLED rows, which made
    // the Order Register appear blank immediately after a successful billing.
    // Attach ORDER_ITEMS here so Order View can show the same itemised order
    // without a second client-side data source.
    const itemsByOrderId = {};
    // Items are useful for Order View, but they are not allowed to make the
    // entire Order Register blank if an older deployment/database does not
    // have ORDER_ITEMS yet. Treat this join as optional data, never as a
    // prerequisite for returning ORDER_MASTER rows.
    try {
      const itemSheet = bnxClientSheet(clientId, SHEETS.ORDER_ITEMS);
      const itemData = itemSheet.getDataRange().getValues();
      const itemHeaders = itemData && itemData.length ? itemData[0] : [];
      for (let r = 1; r < (itemData || []).length; r++) {
        const it = bnxRowToObject(itemData[r], itemHeaders);
        const oid = String(it.ORDER_ID || '');
        if (!oid) continue;
        if (!itemsByOrderId[oid]) itemsByOrderId[oid] = [];
        itemsByOrderId[oid].push({
          itemName: it.ITEM_NAME || '',
          qty: Number(it.QUANTITY) || 0,
          rate: Number(it.RATE) || 0,
          amount: Number(it.LINE_TOTAL) || 0
        });
      }
    } catch (itemError) {
      console.warn('[Order Register] ORDER_ITEMS join unavailable:', itemError.message);
    }
    orders.forEach(o => {
      o.items = itemsByOrderId[String(o.ORDER_ID || '')] || [];
      o.amt = o.ORDER_AMOUNT != null && o.ORDER_AMOUNT !== '' ? Number(o.ORDER_AMOUNT) :
        o.ORDER_TOTAL != null && o.ORDER_TOTAL !== '' ? Number(o.ORDER_TOTAL) :
        o.items.reduce((sum, it) => sum + (Number(it.amount) || Number(it.qty) * Number(it.rate) || 0), 0);
    });
    return { success: true, data: orders, count: orders.length };
  } catch (error) {
    bnxLogError(clientId, `bnxGetOrders failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetActiveOrders(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.LOCATION_ID || payload.locationId || '';
  const orderSource = payload.orderSource || payload.ORDER_SOURCE || '';
  try {
    const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const orderData = orderSheet.getDataRange().getValues();
    const orderHeaders = orderData[0];
    const activeOrders = orderData.slice(1)
      .map(row => bnxRowToObject(row, orderHeaders))
      .filter(o => {
        if (o.CLIENT_ID !== clientId) return false;
        if (locationId && o.LOCATION_ID !== locationId) return false;
        if (orderSource && o.ORDER_SOURCE !== orderSource) return false;
        if (o.ORDER_STATUS === 'CANCELLED' || o.ORDER_STATUS === 'BILLED') return false;
        return true;
      });
    const itemSheet = bnxClientSheet(clientId, SHEETS.ORDER_ITEMS);
    const itemData = itemSheet.getDataRange().getValues();
    const itemHeaders = itemData[0];
    const itemsByOrderId = {};
    itemData.slice(1).forEach(row => {
      const item = bnxRowToObject(row, itemHeaders);
      if (!itemsByOrderId[item.ORDER_ID]) itemsByOrderId[item.ORDER_ID] = [];
      itemsByOrderId[item.ORDER_ID].push({ itemName: item.ITEM_NAME || '', qty: item.QUANTITY || 0, rate: item.RATE || 0, amount: item.LINE_TOTAL || 0, ITEM_ID:item.ITEM_ID||'', station:item.KOT_STATION||item.STATION||'', KOT_STATION:item.KOT_STATION||item.STATION||'' });
    });
    const neededCustomerIds = new Set(activeOrders.map(o => o.CUSTOMER_ID).filter(Boolean));
    const customerLookup = {};
    if (neededCustomerIds.size > 0) {
      const custSheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_MASTER);
      const custData = custSheet.getDataRange().getValues();
      const custHeaders = custData[0];
      custData.slice(1).forEach(row => {
        const c = bnxRowToObject(row, custHeaders);
        if (neededCustomerIds.has(c.CUSTOMER_ID)) customerLookup[c.CUSTOMER_ID] = { name: c.CUSTOMER_NAME || '\u2014', phone: c.PHONE || '\u2014' };
      });
    }
    const orders = activeOrders.map(o => {
      const cust = o.CUSTOMER_ID ? customerLookup[o.CUSTOMER_ID] : null;
      return {
        ORDER_ID: o.ORDER_ID, ORDER_NO: o.ORDER_NUMBER || '', ORDER_DATE: o.ORDER_DATE || '',
        INVOICE_NO: '', TABLE_ID: o.TABLE_ID || '', ORDER_SOURCE: o.ORDER_SOURCE || 'POS',
        ORDER_TYPE: o.ORDER_TYPE || 'DINEIN', ORDER_STATUS: o.ORDER_STATUS || 'NEW', PAX: o.PAX || 0,
        TEMP_ORDER_ID: '', SCAN_KEY: '', CUSTOMER_NAME: cust ? cust.name : '\u2014',
        MOBILE_NO: cust ? cust.phone : '\u2014', START_TIME: o.ORDER_TIME || '', END_TIME: '',
        NOTES: o.SPECIAL_INSTRUCTIONS || '', CREATED_BY: o.STARTED_BY || '\u2014',
        CREATED_BY_ID: o.CREATED_BY_ID || '', CREATED_BY_LOGIN: o.CREATED_BY_LOGIN || '', CREATED_BY_NAME: o.CREATED_BY_NAME || '',
        ASSIGNED_STEWARD_ID: o.ASSIGNED_STEWARD_ID || '', ASSIGNED_STEWARD_LOGIN: o.ASSIGNED_STEWARD_LOGIN || '', ASSIGNED_STEWARD: o.ASSIGNED_STEWARD || '', ASSIGNMENT_SOURCE: o.ASSIGNMENT_SOURCE || '',
        items: itemsByOrderId[o.ORDER_ID] || []
      };
    });
    return { success: true, data: { orders: orders }, count: orders.length };
  } catch (error) {
    bnxLogError(clientId, `bnxGetActiveOrders failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetKOT(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.LOCATION_ID || payload.locationId || '';
  const fromDate = payload.FROM_DATE || payload.from || '';
  const toDate = payload.TO_DATE || payload.to || '';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    // Join ORDER_MASTER to expose the original order time in the KOT
    // register even when KOT_MASTER has no ORDER_TIME column.
    const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const orderValues = orderSheet.getDataRange().getValues();
    const orderHeaders = orderValues[0] || [];
    const orderById = {};
    const orderByNo = {};
    orderValues.slice(1).forEach(row => {
      const o = bnxRowToObject(row, orderHeaders);
      if (o.CLIENT_ID !== clientId) return;
      if (o.ORDER_ID) orderById[String(o.ORDER_ID)] = o;
      if (o.ORDER_NUMBER) orderByNo[String(o.ORDER_NUMBER)] = o;
    });

    const itemSheet = bnxClientSheet(clientId, SHEETS.KOT_ITEMS);
    const itemData = itemSheet.getDataRange().getValues();
    const itemHeaders = itemData[0] || [];
    const itemsByKot = {};
    itemData.slice(1).forEach(row => {
      const it = bnxRowToObject(row, itemHeaders);
      const id = String(it.KOT_ID || '');
      if (!id) return;
      (itemsByKot[id] || (itemsByKot[id] = [])).push({
        itemName: it.ITEM_NAME || '', name: it.ITEM_NAME || '',
        qty: Number(it.QUANTITY) || 0, rate: Number(it.RATE) || 0,
        amount: Number(it.AMOUNT) || 0, sequence: Number(it.SEQUENCE) || 0,
        status: it.ITEM_STATUS || 'NEW'
      });
    });
    const kots = [];
    data.slice(1).forEach(row => {
      const k = bnxRowToObject(row, headers);
      if (k.CLIENT_ID !== clientId) return;
      if (locationId && String(k.LOCATION_ID || '') !== String(locationId)) return;
      if (['SERVED','CANCELLED'].includes(String(k.KOT_STATUS || '').toUpperCase())) return;
      const kd = String(k.KOT_DATE || '').slice(0,10);
      if (fromDate && kd < String(fromDate).slice(0,10)) return;
      if (toDate && kd > String(toDate).slice(0,10)) return;
      k.items = itemsByKot[String(k.KOT_ID || '')] || [];
      k.itemsDetail = k.items;
      const linkedOrder = orderById[String(k.ORDER_ID || '')] || orderByNo[String(k.ORDER_ID || '')] || null;
      k.ORDER_TIME = k.ORDER_TIME || (linkedOrder ? (linkedOrder.ORDER_TIME || '') : '');
      k.orderTime = k.ORDER_TIME || '';
      k.ORDER_NUMBER = linkedOrder ? (linkedOrder.ORDER_NUMBER || '') : (k.ORDER_NUMBER || '');
      kots.push(k);
    });
    return { success: true, data: kots, count: kots.length };
  } catch (error) {
    bnxLogError(clientId, `bnxGetKOT failed: ${error.message}`, payload);
    return { success: false, error: error.message, data: [] };
  }
}

function bnxGetSyncStatus(session, payload) {
  const clientId = session.CLIENT_ID;
  const requestId = payload.REQUEST_ID;
  try {
    const result = bnxCheckDuplicate(clientId, requestId);
    if (result) return { success: true, synced: true, transactionId: result.transactionId };
    return { success: true, synced: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function bnxValidateOrder(payload) {
  const errors = [];
  if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) errors.push('items array required (at least 1 item)');
  return { valid: errors.length === 0, errors };
}

function bnxValidateBill(bill) {
  const errors = [];
  if (!bill.itemsDetail || !Array.isArray(bill.itemsDetail) || bill.itemsDetail.length === 0) errors.push('itemsDetail array required (at least 1 item)');
  (bill.itemsDetail || []).forEach((item, idx) => {
    if (!item.name) errors.push(`Item ${idx + 1}: name required`);
    if (!item.qty || item.qty <= 0) errors.push(`Item ${idx + 1}: qty must be > 0`);
  });
  return { valid: errors.length === 0, errors };
}

const BNX_CLAIM_STALE_MS = 300000; // 5 min: never create a second bill while the first SAVE_BILL is still processing

/* PASS #64: cache-first duplicate check -- see the big comment above
   bnxSyncLogCacheKey_ for why. Falls back to the original full-sheet
   scan verbatim on a cache miss, and populates the cache once it does. */
function bnxCheckDuplicate(clientId, requestId) {
  if (!requestId) return null;
  const cached = bnxSyncLogCacheGet_(clientId, requestId);
  if (cached) {
    if (cached.status === 'SYNCED') return { transactionId: cached.transactionId, result: cached.result, rowIndex: cached.rowIndex };
    const ageMs = Date.now() - (cached.lastAttempt || 0);
    if (ageMs < BNX_CLAIM_STALE_MS) return { transactionId: cached.transactionId, result: cached.result, rowIndex: cached.rowIndex };
    return { stale: true, rowIndex: cached.rowIndex };
  }
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.SYNC_LOG);
    const lastRow=sheet.getLastRow(), lastCol=sheet.getLastColumn();
    if(lastRow<2||lastCol<1) return null;
    const headers=sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
    const reqCol=headers.indexOf('REQUEST_ID');
    if(reqCol===-1) return null;
    // PASS #64 HIGH-VOLUME REFINEMENT: the old cache-miss path loaded the
    // entire ever-growing SYNC_LOG into Apps Script memory for EVERY new
    // transaction. At 3,000 bills/day that becomes the dominant latency.
    // Search only the REQUEST_ID column server-side; read one matching row.
    const matches=sheet.getRange(2,reqCol+1,lastRow-1,1).createTextFinder(String(requestId)).matchEntireCell(true).findAll();
    if(!matches.length) return null;
    const rowIndex=matches[matches.length-1].getRow()-1; // zero-based data index, same convention as old code
    const row=sheet.getRange(rowIndex+1,1,1,lastCol).getValues()[0];
    const obj=bnxRowToObject(row,headers);
    if(obj.STATUS==='SYNCED'){
      bnxSyncLogCachePut_(clientId,requestId,{status:'SYNCED',transactionId:obj.TRANSACTION_ID,result:obj.RESULT,rowIndex});
      return {transactionId:obj.TRANSACTION_ID,result:obj.RESULT,rowIndex};
    }
    const lastAttempt=obj.LAST_ATTEMPT_AT?new Date(obj.LAST_ATTEMPT_AT).getTime():0;
    const ageMs=Date.now()-lastAttempt;
    bnxSyncLogCachePut_(clientId,requestId,{status:obj.STATUS||'IN_PROGRESS',transactionId:obj.TRANSACTION_ID,result:obj.RESULT,rowIndex,lastAttempt});
    if(ageMs<BNX_CLAIM_STALE_MS) return {transactionId:obj.TRANSACTION_ID,result:obj.RESULT,rowIndex};
    return {stale:true,rowIndex};
  } catch (error) {
    console.error('[bnxCheckDuplicate]', error);
    return null;
  }
}

function bnxClaimRequest(clientId, requestId, transactionType) {
  if (!requestId) return { claimed: true, existing: null };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const existing = bnxCheckDuplicate(clientId, requestId);
    if (existing && !existing.stale) return { claimed: false, existing: existing };
    if (existing && existing.stale) {
      const sheet = bnxClientSheet(clientId, SHEETS.SYNC_LOG);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const attemptCol = headers.indexOf('ATTEMPT_COUNT');
      const lastCol = headers.indexOf('LAST_ATTEMPT_AT');
      const r = existing.rowIndex;
      const prevAttempts = attemptCol !== -1 ? (parseInt(data[r][attemptCol], 10) || 1) : 1;
      if (attemptCol !== -1) sheet.getRange(r + 1, attemptCol + 1).setValue(prevAttempts + 1);
      if (lastCol !== -1) sheet.getRange(r + 1, lastCol + 1).setValue(new Date().toISOString());
      bnxSyncLogCachePut_(clientId, requestId, { status: 'IN_PROGRESS', rowIndex: r, lastAttempt: Date.now() });
      return { claimed: true, existing: null };
    }
    const newRowIndex = bnxAppendRowIndexed_(clientId, SHEETS.SYNC_LOG, {
      REQUEST_ID: requestId, CLIENT_ID: clientId, TRANSACTION_TYPE: transactionType, TRANSACTION_ID: '',
      STATUS: 'IN_PROGRESS', ATTEMPT_COUNT: 1, FIRST_ATTEMPTED_AT: new Date().toISOString(),
      LAST_ATTEMPT_AT: new Date().toISOString(), CREATED_AT: new Date().toISOString()
    });
    bnxSyncLogCachePut_(clientId, requestId, { status: 'IN_PROGRESS', rowIndex: newRowIndex, lastAttempt: Date.now() });
    return { claimed: true, existing: null };
  } catch (error) {
    console.error('[bnxClaimRequest]', error);
    return { claimed: true, existing: null };
  } finally {
    lock.releaseLock();
  }
}

/* PASS #64: uses the cached row index from bnxClaimRequest (set moments
   earlier, same request) to update that exact SYNC_LOG row directly --
   no scan. Falls back to the old full-sheet reverse scan only if the
   cache entry is missing for some reason (defensive, should be rare). */
function bnxMarkSynced(clientId, requestId, transactionId, transactionType) {
  try {
    if (requestId) {
      const cached = bnxSyncLogCacheGet_(clientId, requestId);
      const sheet = bnxClientSheet(clientId, SHEETS.SYNC_LOG);
      if (cached && cached.rowIndex != null) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const txnCol = headers.indexOf('TRANSACTION_ID');
        const statusCol = headers.indexOf('STATUS');
        const confirmedCol = headers.indexOf('CONFIRMED_AT');
        const updatedCol = headers.indexOf('UPDATED_AT');
        const r = cached.rowIndex;
        const nowIso = new Date().toISOString();
        if (txnCol !== -1) sheet.getRange(r + 1, txnCol + 1).setValue(transactionId);
        if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue('SYNCED');
        if (confirmedCol !== -1) sheet.getRange(r + 1, confirmedCol + 1).setValue(nowIso);
        if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(nowIso);
        bnxSyncLogCachePut_(clientId, requestId, { status: 'SYNCED', transactionId: transactionId, rowIndex: r });
        return;
      }
      // cache miss -- fall back to the original reverse scan
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const reqCol = headers.indexOf('REQUEST_ID');
      const txnCol = headers.indexOf('TRANSACTION_ID');
      const statusCol = headers.indexOf('STATUS');
      const confirmedCol = headers.indexOf('CONFIRMED_AT');
      const updatedCol = headers.indexOf('UPDATED_AT');
      for (let r = data.length - 1; r >= 1; r--) {
        if (data[r][reqCol] === requestId) {
          if (txnCol !== -1) sheet.getRange(r + 1, txnCol + 1).setValue(transactionId);
          if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue('SYNCED');
          if (confirmedCol !== -1) sheet.getRange(r + 1, confirmedCol + 1).setValue(new Date().toISOString());
          if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
          bnxSyncLogCachePut_(clientId, requestId, { status: 'SYNCED', transactionId: transactionId, rowIndex: r });
          return;
        }
      }
    }
    const newRowIndex = bnxAppendRowIndexed_(clientId, SHEETS.SYNC_LOG, {
      REQUEST_ID: requestId, CLIENT_ID: clientId, TRANSACTION_ID: transactionId,
      TRANSACTION_TYPE: transactionType, STATUS: 'SYNCED', CONFIRMED_AT: new Date().toISOString(),
      CREATED_AT: new Date().toISOString()
    });
    if (requestId) bnxSyncLogCachePut_(clientId, requestId, { status: 'SYNCED', transactionId: transactionId, rowIndex: newRowIndex });
  } catch (error) {
    console.error('[bnxMarkSynced]', error);
  }
}

function bnxCreateAuditLog(clientId, entry) {
  try {
    entry.AUDIT_LOG_ID = entry.AUDIT_LOG_ID || generateShortId_(clientId, 'AUDIT_LOG_ID');
    bnxAppendRow(clientId, SHEETS.AUDIT_LOG, entry);
  } catch (error) {
    console.error('[bnxCreateAuditLog]', error);
  }
}

function bnxLogError(clientId, message, context) {
  try {
    const entry = { ERROR_LOG_ID: generateShortId_(clientId, 'ERROR_LOG_ID'), CLIENT_ID: clientId, ERROR_MESSAGE: message, CONTEXT: JSON.stringify(context), TIMESTAMP: new Date().toISOString() };
    if (clientId) bnxAppendRow(clientId, SHEETS.ERROR_LOG, entry);
    else Logger.log('[bnxLogError, no clientId] ' + message + ' ' + JSON.stringify(context));
  } catch (error) {
    console.error('[bnxLogError]', error, message);
  }
}

function bnxCalculateBillAmount(items) {
  let subtotal = 0, itemDiscount = 0, tax = 0;
  items.forEach(item => {
    const lineAmount = (item.qty || 0) * (item.rate || 0);
    const lineDiscount = item.LINE_DISCOUNT || 0;
    const taxRate = (item.TAX_RATE === null || item.TAX_RATE === undefined || item.TAX_RATE === '') ? 0.18 : Number(item.TAX_RATE) || 0;
    subtotal += lineAmount; itemDiscount += lineDiscount; tax += (lineAmount - lineDiscount) * taxRate;
  });
  const subtotalAfterDiscount = subtotal - itemDiscount;
  const taxable = subtotalAfterDiscount;
  const roundOff = Math.round(tax) - tax;
  const total = taxable + Math.round(tax) + roundOff;
  return { subtotal, itemDiscount, subtotalAfterDiscount, billDiscount: 0, taxable, taxRate: items.length ? +(tax / Math.max(taxable, 0.000001)).toFixed(4) : 0, tax: Math.round(tax), roundOff, total };
}

function bnxAppendRow(clientId, sheetName, rowObject) {
  bnxAppendRowIndexed_(clientId, sheetName, rowObject);
}

// PASS #64: same as bnxAppendRow, but returns the 0-based row index the
// row landed on (needed by bnxClaimRequest/bnxMarkSynced's cache so a
// later call in the same request can jump straight to that row instead
// of re-scanning the whole sheet to find it again).
function bnxAppendRowIndexed_(clientId, sheetName, rowObject) {
  const sheet = bnxClientSheet(clientId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // FIX (PASS #58): was `rowObject[header] || ''`, which turns legitimate
  // 0 values (TAX_AMOUNT, ROUND_OFF on a fully tax-exempt bill, etc.) into
  // blank cells because 0 is falsy in JS. Only undefined/null become ''.
  const row = headers.map(header => {
    const v = rowObject[header];
    return (v === undefined || v === null) ? '' : v;
  });
  sheet.appendRow(row);
  return sheet.getLastRow() - 1; // 0-based, matches getDataRange().getValues() row indices used elsewhere
}

/* Normalize every sheet date into the single yyyy-MM-dd key used by the
   report/dashboard engines. Google Sheets can return a Date object, an ISO
   string, or legacy imported DD-MM-YYYY / DD/MM/YYYY text. Keeping this at
   the row-object boundary prevents each report from implementing its own
   fragile date parser and fixes the exact 'Today = 0' symptom when older
   imported rows use DD-MM-YYYY text. */
function bnxNormalizeDateKey_(value) {
  if (value === null || value === undefined || value === '') return '';
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T].*)?$/);
  if (m) return m[1] + '-' + String(Number(m[2])).padStart(2,'0') + '-' + String(Number(m[3])).padStart(2,'0');
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T].*)?$/);
  if (m) return m[3] + '-' + String(Number(m[2])).padStart(2,'0') + '-' + String(Number(m[1])).padStart(2,'0');
  return s;
}

function bnxRecentDataWindow_(sheet, headers, maxDataRows) {
  const lastRow=sheet.getLastRow();
  if(lastRow<2) return [];
  const count=Math.min(Math.max(1,maxDataRows||5000),lastRow-1);
  const start=lastRow-count+1;
  return sheet.getRange(start,1,count,headers.length).getValues();
}

function bnxRowToObject(row, headers) {
  const obj = {};
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  headers.forEach((header, idx) => {
    let val = row[idx];
    const isDateField = /_DATE$/.test(header) || header === 'DATE' || /DATE$/.test(header);
    const isTimeField = /_TIME$/.test(header) || header === 'TIME';
    if (isDateField) {
      val = bnxNormalizeDateKey_(val);
    } else if (val instanceof Date) {
      if (isTimeField) val = Utilities.formatDate(val, tz, 'HH:mm:ss');
      else val = val.toISOString();
    }
    obj[header] = (val === null || val === undefined) ? '' : val;
  });
  return obj;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const ENTITY_ID_PREFIXES = {
  SETTING_ID: 'CFG', LOCATION_ID: 'LOC', USER_ID: 'USR', ITEM_ID: 'ITM',
  CATEGORY_ID: 'CAT', UNIT_ID: 'UNT', TAX_ID: 'TAX', RECIPE_ID: 'RCP',
  RECIPE_ITEM_ID: 'RCI', CUSTOMER_ID: 'CUS', SUPPLIER_ID: 'SUP',
  LEDGER_ID: 'LDG', RESERVATION_ID: 'RES', PAYMENT_MODE_ID: 'PMD',
  ORDER_ID: 'ORD', ORDER_ITEM_ID: 'ORI', KOT_ID: 'KOT', KOT_ITEM_ID: 'KTI',
  KOT_STATUS_LOG_ID: 'KSL', BILL_ID: 'BIL', BILL_ITEM_ID: 'BLI',
  PAYMENT_ID: 'PAY', PURCHASE_ID: 'PUR', PURCHASE_ITEM_ID: 'PUI',
  STOCK_BALANCE_ID: 'STB', STOCK_MOVEMENT_ID: 'STM', CUSTOMER_DUES_ID: 'CDU',
  DUES_RECEIPT_ID: 'DRC', SUPPLIER_DUES_ID: 'SDU', JOURNAL_ID: 'JRN',
  LEDGER_ENTRY_ID: 'LGE', DAILY_COLLECTION_ID: 'DCL', ONLINE_ORDER_ID: 'OLO',
  ONLINE_ORDER_ITEM_ID: 'OLI', AGGREGATOR_SETTLEMENT_ID: 'AGS',
  AUDIT_LOG_ID: 'AUD', SYNC_LOG_ID: 'SYN', ERROR_LOG_ID: 'ERR',
  SYNC_ERROR_ID: 'SYE',
  PRODUCTION_ID: 'PRD', PRODUCTION_ITEM_ID: 'PRI', MENU_CARD_UPLOAD_ID: 'MCU',
  // EDIT 3 (from the old report-engine header)
  REPORT_ID: 'RPT',
  // PETTY CASH PATCH
  PETTY_CASH_ID: 'PTC'
};

function generateShortId_(clientId, entityType) {
  // High-volume ID path: reserve small server-side batches and consume them
  // from CacheService. IDs remain globally unique because a batch is reserved
  // under LockService before it is exposed to callers. Cache eviction only
  // creates harmless gaps; it can never create a duplicate.
  const key='bnx_id_batch_v2_'+String(clientId)+'_'+String(entityType);
  const cache=CacheService.getScriptCache();
  try{
    const raw=cache.get(key);
    if(raw){
      const q=JSON.parse(raw);
      if(Array.isArray(q)&&q.length){ const id=q.shift(); cache.put(key,JSON.stringify(q),21600); return id; }
    }
  }catch(e){}
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try{
    // Re-check after acquiring the lock so two simultaneous cache misses do
    // not reserve two batches unnecessarily.
    try{
      const raw=cache.get(key); const q=raw?JSON.parse(raw):[];
      if(Array.isArray(q)&&q.length){const id=q.shift();cache.put(key,JSON.stringify(q),21600);return id;}
    }catch(e){}
    const batchSize=(String(entityType)==='BILL_ID'||String(entityType)==='BILL_ITEM_ID'||String(entityType)==='PAYMENT_ID'||String(entityType)==='STOCK_MOVEMENT_ID')?100:20;
    const range=bnxReserveNumberBatch_(clientId,entityType,batchSize,true);
    const q=[]; for(let n=range.from;n<=range.to;n++) q.push(String(range.prefix)+String(n).padStart(range.padLength,'0'));
    const id=q.shift(); try{cache.put(key,JSON.stringify(q),21600);}catch(e){}
    return id;
  } finally { lock.releaseLock(); }
}

function bnxReserveNumberBatch_(clientId, counterType, batchSize, lockAlreadyHeld) {
  const lock = lockAlreadyHeld ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(10000);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.SEQUENCE_COUNTERS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const typeCol = headers.indexOf('COUNTER_TYPE');
    const valCol = headers.indexOf('NEXT_VALUE');
    const prefixCol = headers.indexOf('PREFIX');
    const padCol = headers.indexOf('PAD_LENGTH');
    const updatedCol = headers.indexOf('UPDATED_AT');
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] === clientId && values[r][typeCol] === counterType) {
        const current = parseInt(values[r][valCol], 10) || 1;
        const newValue = current + batchSize;
        sheet.getRange(r + 1, valCol + 1).setValue(newValue);
        if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
        return {
          from: current, to: newValue - 1,
          prefix: prefixCol !== -1 ? (values[r][prefixCol] || '') : '',
          padLength: padCol !== -1 ? (parseInt(values[r][padCol], 10) || 4) : 4
        };
      }
    }
    let start = 1, inferredPrefix = '', inferredPad = 0;
    if (counterType === 'BILL_NUMBER' || /^BILL_NUMBER_[A-Z0-9_-]+$/.test(counterType)) {
      const code = counterType === 'BILL_NUMBER' ? 'C1' : counterType.replace(/^BILL_NUMBER_/,'');
      const inferred = bnxInferBillCounterStart_(clientId, code);
      start = inferred.next; inferredPrefix = inferred.prefix; inferredPad = inferred.pad;
    }
    const newValue = start + batchSize;
    const isEntityId = ENTITY_ID_PREFIXES.hasOwnProperty(counterType);
    const defaultPrefix = inferredPrefix || (counterType === 'BILL_NUMBER' ? 'BN/'
      : /^BILL_NUMBER_[A-Z0-9_-]+$/.test(counterType) ? bnxDefaultBillPrefix_(counterType.replace(/^BILL_NUMBER_/,'') )
      : counterType === 'KOT_NUMBER' ? 'KOT-'
      : counterType === 'ORDER_NUMBER' ? '#ORD-'
      : isEntityId ? ENTITY_ID_PREFIXES[counterType]
      : counterType.replace(/_ID$/, '').slice(0, 3).toUpperCase());
    const defaultPad = inferredPad || (/^BILL_NUMBER_[A-Z0-9_-]+$/.test(counterType) ? 8 : (isEntityId ? 5 : 4));
    bnxAppendRow(clientId, SHEETS.SEQUENCE_COUNTERS, {
      COUNTER_ID: clientId + '-SEQ-' + counterType.replace('_NUMBER', ''),
      CLIENT_ID: clientId, COUNTER_TYPE: counterType, PREFIX: defaultPrefix,
      NEXT_VALUE: newValue, PAD_LENGTH: defaultPad, RESET_FREQUENCY: 'NEVER',
      UPDATED_AT: new Date().toISOString()
    });
    return { from: start, to: newValue - 1, prefix: defaultPrefix, padLength: defaultPad };
  } finally { if (lock) lock.releaseLock(); }
}

function bnxGenerateOrderNumber(clientId, locationId) {
  const range = bnxReserveNumberBatch_(clientId, 'ORDER_NUMBER', 1);
  return `${range.prefix}${String(range.to).padStart(range.padLength, '0')}`;
}

function bnxNormalizeCounterCode_(v) {
  const raw = String(v || 'C1').trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
  return cleaned || 'C1';
}
function bnxBillCounterType_(counterCode) {
  return 'BILL_NUMBER_' + bnxNormalizeCounterCode_(counterCode);
}
function bnxDefaultBillPrefix_(counterCode) {
  const c = bnxNormalizeCounterCode_(counterCode);
  // C1 keeps the legacy restaurant invoice format used by existing bills.
  // Other counters remain visibly separated so multiple POS counters cannot
  // accidentally present the same human-readable invoice number.
  return c === 'C1' ? 'BN/' : ('BN/' + c + '/');
}

function bnxInferBillCounterStart_(clientId, counterCode) {
  let maxNo = 0, bestPrefix = '', bestPad = 8;
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const billCol = headers.indexOf('BILL_NUMBER');
    const codeCol = headers.indexOf('COUNTER_CODE');
    if (billCol < 0) return {next:1,prefix:bnxDefaultBillPrefix_(counterCode),pad:8};
    const wanted = bnxNormalizeCounterCode_(counterCode);
    for (let r=1;r<values.length;r++) {
      if (headers.indexOf('CLIENT_ID')>=0 && String(values[r][headers.indexOf('CLIENT_ID')])!==String(clientId)) continue;
      const rowCode = codeCol>=0 ? bnxNormalizeCounterCode_(values[r][codeCol] || 'C1') : 'C1';
      if (rowCode !== wanted) continue;
      const raw=String(values[r][billCol]||'').trim();
      const m=raw.match(/^(.*?)(\d+)$/);
      if(!m) continue;
      const n=parseInt(m[2],10); if(!Number.isFinite(n)) continue;
      if(n>maxNo){maxNo=n;bestPrefix=m[1]||bnxDefaultBillPrefix_(counterCode);bestPad=m[2].length||8;}
    }
  } catch(e){ console.warn('[bnxInferBillCounterStart_] '+e.message); }
  return {next:maxNo+1,prefix:bestPrefix||bnxDefaultBillPrefix_(counterCode),pad:bestPad||8};
}
function bnxPeekBillNumber_(clientId, counterCode) {
  const type = bnxBillCounterType_(counterCode);
  const sheet = bnxClientSheet(clientId, SHEETS.SEQUENCE_COUNTERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const ciCol = headers.indexOf('CLIENT_ID'), typeCol = headers.indexOf('COUNTER_TYPE');
  const valCol = headers.indexOf('NEXT_VALUE'), prefixCol = headers.indexOf('PREFIX'), padCol = headers.indexOf('PAD_LENGTH');
  for (let r = 1; r < values.length; r++) {
    if (ciCol !== -1 && String(values[r][ciCol]) !== String(clientId)) continue;
    if (typeCol !== -1 && String(values[r][typeCol]) !== type) continue;
    const n = Math.max(1, parseInt(values[r][valCol], 10) || 1);
    const prefix = prefixCol !== -1 && values[r][prefixCol] ? String(values[r][prefixCol]) : bnxDefaultBillPrefix_(counterCode);
    const pad = padCol !== -1 ? (parseInt(values[r][padCol], 10) || 6) : 6;
    return prefix + String(n).padStart(pad, '0');
  }
  const inferred = bnxInferBillCounterStart_(clientId, counterCode);
  return (inferred.prefix || bnxDefaultBillPrefix_(counterCode)) + String(inferred.next || 1).padStart(inferred.pad || 8, '0');
}
function bnxGetNextBillNumber(session, payload) {
  try {
    const clientId = session.CLIENT_ID;
    const counterCode = bnxNormalizeCounterCode_(payload.counterCode || payload.COUNTER_CODE || 'C1');
    const billNumber = bnxPeekBillNumber_(clientId, counterCode);
    const m = String(billNumber).match(/^(.*?)(\d+)$/);
    return { success:true, billNumber, counterCode, prefix:m ? m[1] : bnxDefaultBillPrefix_(counterCode), nextValue:m ? Number(m[2]) : 1, padLength:m ? m[2].length : 8 };
  } catch (e) { return { success:false, error:e.message }; }
}

function bnxSetBillNumbering(session, payload) {
  const clientId=session.CLIENT_ID;
  const counterCode=bnxNormalizeCounterCode_(payload.counterCode||payload.COUNTER_CODE||'C1');
  const prefix=String(payload.prefix||'').trim() || bnxDefaultBillPrefix_(counterCode);
  const nextValue=Math.max(1,parseInt(payload.nextNumber!=null?payload.nextNumber:payload.NEXT_VALUE,10)||1);
  const padLength=Math.max(1,Math.min(12,parseInt(payload.padLength||payload.PAD_LENGTH,10)||8));
  const type=bnxBillCounterType_(counterCode);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=bnxClientSheet(clientId,SHEETS.SEQUENCE_COUNTERS);
    const values=sheet.getDataRange().getValues(); const headers=values[0]||[];
    const ci=headers.indexOf('CLIENT_ID'), tc=headers.indexOf('COUNTER_TYPE');
    const nv=headers.indexOf('NEXT_VALUE'), pc=headers.indexOf('PREFIX'), pl=headers.indexOf('PAD_LENGTH'), up=headers.indexOf('UPDATED_AT');
    for(let r=1;r<values.length;r++){
      if(ci>=0 && String(values[r][ci])!==String(clientId)) continue;
      if(tc>=0 && String(values[r][tc])!==type) continue;
      if(nv>=0) sheet.getRange(r+1,nv+1).setValue(nextValue);
      if(pc>=0) sheet.getRange(r+1,pc+1).setValue(prefix);
      if(pl>=0) sheet.getRange(r+1,pl+1).setValue(padLength);
      if(up>=0) sheet.getRange(r+1,up+1).setValue(new Date().toISOString());
      return {success:true,counterCode,prefix,nextValue,padLength,billNumber:prefix+String(nextValue).padStart(padLength,'0')};
    }
    const rowObj={COUNTER_ID:clientId+'-SEQ-'+type.replace('_NUMBER',''),CLIENT_ID:clientId,COUNTER_TYPE:type,PREFIX:prefix,NEXT_VALUE:nextValue,PAD_LENGTH:padLength,RESET_FREQUENCY:'NEVER',UPDATED_AT:new Date().toISOString()};
    sheet.getRange(sheet.getLastRow()+1,1,1,headers.length).setValues([headers.map(h=>rowObj[h]!==undefined?rowObj[h]:'')]);
    return {success:true,counterCode,prefix,nextValue,padLength,billNumber:prefix+String(nextValue).padStart(padLength,'0')};
  } finally { lock.releaseLock(); }
}
function bnxGenerateBillNumber(clientId, locationId, counterCode) {
  const code = bnxNormalizeCounterCode_(counterCode || 'C1');
  const type = bnxBillCounterType_(code);
  // First ensure the counter row exists using the same atomic reservation helper.
  const range = bnxReserveNumberBatch_(clientId, type, 1);
  return `${range.prefix || bnxDefaultBillPrefix_(code)}${String(range.to).padStart(range.padLength || 6, '0')}`;
}

function bnxGenerateKOTNumber(clientId, locationId) {
  const range = bnxReserveNumberBatch_(clientId, 'KOT_NUMBER', 1);
  return `${range.prefix}${String(range.to).padStart(range.padLength, '0')}`;
}

function bnxGetKotNumberBatch(session, payload) {
  const clientId = session.CLIENT_ID;
  const batchSize = Math.max(1, Math.min(100, parseInt(payload.batchSize, 10) || 20));
  try {
    const range = bnxReserveNumberBatch_(clientId, 'KOT_NUMBER', batchSize);
    const numbers = [];
    for (let n = range.from; n <= range.to; n++) numbers.push(range.prefix + String(n).padStart(range.padLength, '0'));
    return { success: true, numbers: numbers };
  } catch (error) {
    bnxLogError(clientId, `bnxGetKotNumberBatch failed: ${error.message}`, payload);
    return { success: false, error: error.message, numbers: [] };
  }
}

function bnxGetItemName(clientId, itemId) {
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('ITEM_ID');
    const nameCol = headers.indexOf('ITEM_NAME');
    for (let i = 1; i < data.length; i++) if (data[i][idCol] === itemId) return data[i][nameCol];
    return 'Unknown Item';
  } catch (e) { return 'Unknown Item'; }
}

/* FIX ("ALL LIVE DATA NO DEMO DATA" -- confirmed root cause, and the
   exact gap this file's own REMAINING GAPS list already flagged as
   "#5. GET_CONFIG runs pre-auth and always returns {} regardless of
   clientId"): this ran before session verification and unconditionally
   returned an empty object, so the frontend's centralized-deployment
   mechanism (bnxRefreshConfig() reading res.data.v2CoreId/v2AuthId,
   see restaurant-dashboard.html's own comment: "Once DEPLOYMENT_CONFIG
   exists in your security DB, both apps' V2_CORE/V2_AUTH stay in sync
   from one place") had nothing to ever read -- it always silently fell
   through to the hardcoded bootstrap deployment IDs baked into the
   frontend, every single load, forever. Now reads a real
   DEPLOYMENT_CONFIG sheet inside the same central security spreadsheet
   (CLIENT_MASTER_DB_ID) every other cross-client lookup in this file
   already uses (bnxLookupClientMaster_, bnxAddStaff's USER_MASTER
   write) -- one shared row of routing IDs, not per-client, matching
   "one place" in that comment. Column names for this sheet were never
   established anywhere else in the code (this is the very first read
   of it), so rather than guess a single fixed header this checks the
   couple of plausible spellings this schema's own naming convention
   would use. If DEPLOYMENT_CONFIG doesn't exist yet, or has no
   recognizable columns, this returns {} exactly as before (an honest
   "nothing to give you yet", never a fabricated ID) plus a clear note
   -- the frontend's hardcoded fallback keeps working unaffected either
   way, so this is a pure upgrade with no way to break existing logins. */
function bnxGetConfig() {
  try {
    const data = {};

    // PRIMARY: existing deployment registry used by the live ERP.
    // This is intentionally checked first so an existing
    // API_DEPLOYMENT_REGISTRY remains authoritative.
    const registryCandidates = [
      { db: 'MASTER_CONTROL', sheet: 'API_DEPLOYMENT_REGISTRY' },
      { db: 'MASTER_CONTROL', sheet: 'DEPLOYMENT_REGISTRY' }
    ];

    for (let i = 0; i < registryCandidates.length; i++) {
      const c = registryCandidates[i];
      try {
        if (typeof getERPDatabase === 'function') {
          const ss = getERPDatabase(c.db);
          const sh = ss && ss.getSheetByName(c.sheet);
          if (!sh) continue;

          const values = sh.getDataRange().getValues();
          if (!values || values.length < 2) continue;

          const headers = values[0].map(function(h) {
            return String(h == null ? '' : h).trim().toUpperCase();
          });

          // Support both key/value registry layouts and normal tabular layouts.
          const keyCol = headers.findIndex(function(h) {
            return ['KEY','NAME','CONFIG_KEY','SETTING','PARAMETER'].indexOf(h) >= 0;
          });
          const valueCol = headers.findIndex(function(h) {
            return ['VALUE','CONFIG_VALUE','SETTING_VALUE','PARAMETER_VALUE'].indexOf(h) >= 0;
          });

          if (keyCol >= 0 && valueCol >= 0) {
            for (let r = 1; r < values.length; r++) {
              const key = String(values[r][keyCol] == null ? '' : values[r][keyCol]).trim().toUpperCase();
              const val = String(values[r][valueCol] == null ? '' : values[r][valueCol]).trim();
              if (!key || !val) continue;

              if (['V2_CORE_ID','V2CORE_ID','V2_CORE_DEPLOYMENT_ID','V2_CORE'].indexOf(key) >= 0) {
                data.v2CoreId = val;
              }
              if (['V2_AUTH_ID','V2AUTH_ID','V2_AUTH_DEPLOYMENT_ID','V2_AUTH'].indexOf(key) >= 0) {
                data.v2AuthId = val;
              }
            }
          } else {
            // Tabular form: find deployment columns directly.
            const coreCol = headers.findIndex(function(h) {
              return ['V2_CORE_ID','V2CORE_ID','V2_CORE_DEPLOYMENT_ID','V2_CORE'].indexOf(h) >= 0;
            });
            const authCol = headers.findIndex(function(h) {
              return ['V2_AUTH_ID','V2AUTH_ID','V2_AUTH_DEPLOYMENT_ID','V2_AUTH'].indexOf(h) >= 0;
            });
            const row = values[1];

            if (coreCol >= 0 && row[coreCol] != null && String(row[coreCol]).trim()) {
              data.v2CoreId = String(row[coreCol]).trim();
            }
            if (authCol >= 0 && row[authCol] != null && String(row[authCol]).trim()) {
              data.v2AuthId = String(row[authCol]).trim();
            }
          }

          if (data.v2CoreId || data.v2AuthId) {
            return {
              success: true,
              data: data,
              source: c.db + '/' + c.sheet,
              timestamp: new Date().toISOString()
            };
          }
        }
      } catch (registryErr) {
        console.warn('[bnxGetConfig] registry candidate failed: ' + registryErr.message);
      }
    }

    // FALLBACK: current v3 centralized DEPLOYMENT_CONFIG.
    if (typeof CLIENT_MASTER_DB_ID !== 'undefined' && CLIENT_MASTER_DB_ID) {
      try {
        const ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
        const sheet = ss.getSheetByName('DEPLOYMENT_CONFIG');

        if (sheet) {
          const values = sheet.getDataRange().getValues();
          if (values.length >= 2) {
            const headers = values[0].map(function(h) {
              return String(h == null ? '' : h).trim().toUpperCase();
            });
            const row = values[1];

            function pick(names) {
              for (let n = 0; n < names.length; n++) {
                const idx = headers.indexOf(names[n]);
                if (idx >= 0 && row[idx] != null && String(row[idx]).trim()) {
                  return String(row[idx]).trim();
                }
              }
              return '';
            }

            const core = pick(['V2_CORE_ID','V2CORE_ID','V2_CORE_DEPLOYMENT_ID']);
            const auth = pick(['V2_AUTH_ID','V2AUTH_ID','V2_AUTH_DEPLOYMENT_ID']);

            if (core) data.v2CoreId = core;
            if (auth) data.v2AuthId = auth;

            if (core || auth) {
              return {
                success: true,
                data: data,
                source: 'CLIENT_MASTER_DB_ID/DEPLOYMENT_CONFIG',
                timestamp: new Date().toISOString()
              };
            }
          }
        }
      } catch (configErr) {
        console.warn('[bnxGetConfig] DEPLOYMENT_CONFIG fallback failed: ' + configErr.message);
      }
    }

    return {
      success: true,
      data: {},
      timestamp: new Date().toISOString(),
      note: 'No deployment registry values found.'
    };

  } catch (error) {
    console.error('[bnxGetConfig]', error);
    return {
      success: false,
      data: {},
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
function bnxBatchExecute(session, payload) {
  const results = [];
  const batch = payload.batch || [];
  batch.forEach(action => {
    const result = doPost({
      postData: { contents: JSON.stringify({ action: action.action, requestId: action.requestId || generateUUID(), data: action.data, sessionToken: payload.sessionToken, clientId: session.CLIENT_ID }) }
    });
    results.push(JSON.parse(result.getContent()));
  });
  return { success: true, results };
}

function respondError(statusCode, message, requestId) {
  return { success: false, error: message, statusCode, requestId };
}

const MASTER_CATEGORY_MAP = {
  company:  { table: 'COMPANY_SETTINGS', idField: 'SETTING_ID', fieldMap: {
      NAME: 'COMPANY_NAME', GSTIN: 'GST_NUMBER',
      ADDRESS: 'ADDRESS', PHONE: 'PHONE', EMAIL: 'EMAIL',
      FSSAI: 'FSSAI', CURRENCY: 'DEFAULT_CURRENCY', LOGO_URL: 'LOGO_URL'
    } },
  branch:   { table: 'LOCATION_MASTER', idField: 'LOCATION_ID', fieldMap: { BRANCH_NAME: 'LOCATION_NAME', MOBILE: 'PHONE' } },
  menu:     { table: 'ITEM_MASTER', idField: 'ITEM_ID', fieldMap: { ITEM_NAME: 'ITEM_NAME', RATE: 'SELLING_RATE' } },
  recipe:   { table: 'RECIPE_MASTER', idField: 'RECIPE_ID', fieldMap: { name: 'RECIPE_NAME' } },
  ingredients: { table: SHEETS.RAW_MATERIAL_MASTER, idField: 'ITEM_ID', fieldMap: { ITEM_NAME: 'ITEM_NAME', UNIT: 'UNIT', CATEGORY: 'CATEGORY', REORDER_LEVEL: 'REORDER_LEVEL' } },
  tables:   { table: 'TABLE_MASTER', idField: 'TABLE_ID', fieldMap: { TABLE_NAME: 'TABLE_NUMBER', FLOOR_NAME: 'SECTION', CAPACITY: 'CAPACITY' } },
  customer: { table: 'CUSTOMER_MASTER', idField: 'CUSTOMER_ID', fieldMap: { CUSTOMER_NAME: 'CUSTOMER_NAME', MOBILE: 'PHONE', EMAIL: 'EMAIL', ADDRESS: 'ADDRESS' } },
  supplier: { table: 'SUPPLIER_MASTER', idField: 'SUPPLIER_ID', fieldMap: { VENDOR_NAME: 'SUPPLIER_NAME', GSTIN: 'GST_NUMBER', MOBILE: 'PHONE' } },
  employee: { table: 'USER_MASTER', idField: 'USER_ID', fieldMap: { EMP_NAME: 'FULL_NAME', MOBILE: 'PHONE' } },
  user:     { table: 'USER_MASTER', idField: 'USER_ID', fieldMap: {} },
  item:     { table: 'ITEM_MASTER', idField: 'ITEM_ID', fieldMap: { ITEM_NAME: 'ITEM_NAME', HSN_CODE: 'HSN_CODE', REORDER_LEVEL: 'REORDER_LEVEL' } },
  item_master: { table: 'ITEM_MASTER', idField: 'ITEM_ID', fieldMap: {} },
  // LIVE POS category/group masters. Keep aliases because older frontend builds
  // use menucat while newer report code uses category/item_groups.
  category: { table: 'CATEGORY_MASTER', idField: 'CATEGORY_ID', fieldMap: { CATEGORY_NAME: 'CATEGORY_NAME', NAME: 'CATEGORY_NAME', IS_ACTIVE: 'IS_ACTIVE' } },
  categories: { table: 'CATEGORY_MASTER', idField: 'CATEGORY_ID', fieldMap: { CATEGORY_NAME: 'CATEGORY_NAME', NAME: 'CATEGORY_NAME', IS_ACTIVE: 'IS_ACTIVE' } },
  item_groups: { table: 'ITEM_GROUP_MASTER', idField: 'ITEM_GROUP_ID', fieldMap: { ITEM_GROUP_NAME: 'ITEM_GROUP_NAME', GROUP_NAME: 'GROUP_NAME', NAME: 'ITEM_GROUP_NAME', IS_ACTIVE: 'IS_ACTIVE' } },
  itemgroup: { table: 'ITEM_GROUP_MASTER', idField: 'ITEM_GROUP_ID', fieldMap: { ITEM_GROUP_NAME: 'ITEM_GROUP_NAME', GROUP_NAME: 'GROUP_NAME', NAME: 'ITEM_GROUP_NAME', IS_ACTIVE: 'IS_ACTIVE' } },
  item_groups_master: { table: 'ITEM_GROUP_MASTER', idField: 'ITEM_GROUP_ID', fieldMap: { ITEM_GROUP_NAME: 'ITEM_GROUP_NAME', GROUP_NAME: 'GROUP_NAME', NAME: 'ITEM_GROUP_NAME', IS_ACTIVE: 'IS_ACTIVE' } },
  warehouse: null,
  tax:      { table: 'TAX_MASTER', idField: 'TAX_ID', fieldMap: {} },
  /* Added alongside the bnxGetPaymentModes live-data fix above: before
     this, PAYMENT_MODE_MASTER had a routed sheet name and an ID prefix
     but no way for a client to ever add/edit/remove a real payment
     mode -- GET_MASTER/SAVE_MASTER/DELETE_MASTER (the same generic
     CRUD every other master table already uses) simply didn't know
     this category existed. Field names match what bnxGetPaymentModes
     now reads; adjust here too if the real sheet's headers turn out
     to differ once confirmed against it. */
  paymentmode: { table: 'PAYMENT_MODE_MASTER', idField: 'PAYMENT_MODE_ID', fieldMap: { MODE_NAME: 'MODE_NAME', MODE_CODE: 'MODE_CODE', IS_ACTIVE: 'IS_ACTIVE' } },
  role:     { table: 'ROLE_MASTER', idField: 'ROLE_ID', fieldMap: {} },
  menucat: { table: SHEETS.CATEGORY_MASTER, idField: 'CATEGORY_ID', fieldMap: { CATEGORY_NAME: 'CATEGORY_NAME', NAME: 'CATEGORY_NAME' } },
  store: null, kitchen: null, barmenu: null, steward: null, captain: null, chef: null, bankaccount: null, settings: null,
};

const BNX_MASTER_CACHE_TABLES_ = new Set(['ITEM_MASTER', 'CATEGORY_MASTER', 'TAX_MASTER', 'UNIT_MASTER']);

function bnxGetMaster(session, payload) {
  const clientId = session.CLIENT_ID;
  const category = payload.category || '';
  const cfg = MASTER_CATEGORY_MAP[category];
  if (!cfg) return { success: false, error: 'Category "' + category + '" has no v3 table configured yet.', data: [] };
  try {
    const sheet = bnxClientSheet(clientId, cfg.table);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciIdx = headers.indexOf('CLIENT_ID');
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      if (ciIdx !== -1 && values[r][ciIdx] !== clientId) continue;
      rows.push(bnxRowToObject(values[r], headers));
    }
    return { success: true, data: rows, count: rows.length };
  } catch (error) {
    bnxLogError(clientId, `bnxGetMaster failed for ${category}: ${error.message}`, payload);
    return { success: false, error: error.message, data: [] };
  }
}

function bnxSaveMaster(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const category = payload.category || '';
  const cfg = MASTER_CATEGORY_MAP[category];
  const record = typeof payload.record === 'string' ? JSON.parse(payload.record) : (payload.record || {});
  if (!cfg) return { success: false, error: 'Category "' + category + '" has no v3 table configured yet -- cannot save.' };
  try {
    const sheet = bnxClientSheet(clientId, cfg.table);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf(cfg.idField);
    const ciCol = headers.indexOf('CLIENT_ID');
    const v3Row = {};
    Object.keys(record).forEach(function (frontendField) {
      const v3Field = cfg.fieldMap[frontendField] || (headers.indexOf(frontendField) !== -1 ? frontendField : null);
      if (v3Field) v3Row[v3Field] = record[frontendField];
    });
    if (ciCol !== -1) v3Row.CLIENT_ID = clientId;
    if (headers.indexOf('UPDATED_AT') !== -1) v3Row.UPDATED_AT = new Date().toISOString();
    const existingId = record[cfg.idField] || record.id || '';
    let targetRow = -1;
    if (existingId) {
      for (let r = 1; r < values.length; r++) {
        if (values[r][idCol] === existingId && (ciCol === -1 || values[r][ciCol] === clientId)) { targetRow = r; break; }
      }
    }
    let out;
    if (targetRow !== -1) {
      const rowValues = values[targetRow];
      headers.forEach(function (h, c) { if (v3Row[h] !== undefined) rowValues[c] = v3Row[h]; });
      sheet.getRange(targetRow + 1, 1, 1, headers.length).setValues([rowValues]);
      bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'UPDATE', MODULE: 'MASTER_HUB', RECORD_TYPE: category, RECORD_ID: existingId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(v3Row), TIMESTAMP: new Date().toISOString() });
      out = { success: true, id: existingId, updated: true };
    } else {
      const newId = generateShortId_(clientId, cfg.idField);
      v3Row[cfg.idField] = newId;
      if (headers.indexOf('CREATED_AT') !== -1) v3Row.CREATED_AT = new Date().toISOString();
      const row = headers.map(function (h) { return v3Row[h] !== undefined ? v3Row[h] : ''; });
      sheet.appendRow(row);
      bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'MASTER_HUB', RECORD_TYPE: category, RECORD_ID: newId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(v3Row), TIMESTAMP: new Date().toISOString() });
      out = { success: true, id: newId, updated: false };
    }
    if (category === 'company' && out.success) {
      const cm = bnxSyncClientMaster_(clientId, {
        name: record.NAME != null ? record.NAME : record.COMPANY_NAME,
        gst: record.GSTIN != null ? record.GSTIN : record.GST_NUMBER,
        address: record.ADDRESS, phone: record.PHONE, email: record.EMAIL,
        fssai: record.FSSAI, currency: record.CURRENCY, logoUrl: record.LOGO_URL
      });
      out.clientMasterSaved = !!cm.saved;
      if (!cm.saved) out.clientMasterError = cm.error || 'Client Master update failed';
    }
    if (BNX_MASTER_CACHE_TABLES_.has(cfg.table)) bnxInvalidateMasterCache_(clientId);
    return out;
  } catch (error) {
    bnxLogError(clientId, `bnxSaveMaster failed for ${category}: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxDeleteMaster(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const category = payload.category || '';
  const cfg = MASTER_CATEGORY_MAP[category];
  const id = payload.id || '';
  if (!cfg) return { success: false, error: 'Category "' + category + '" has no v3 table configured yet.' };
  if (!id) return { success: false, error: 'id required' };
  try {
    const sheet = bnxClientSheet(clientId, cfg.table);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf(cfg.idField);
    const ciCol = headers.indexOf('CLIENT_ID');
    const activeCol = headers.indexOf('IS_ACTIVE');
    for (let r = 1; r < values.length; r++) {
      if (values[r][idCol] === id && (ciCol === -1 || values[r][ciCol] === clientId)) {
        if (activeCol !== -1) sheet.getRange(r + 1, activeCol + 1).setValue(false);
        else sheet.deleteRow(r + 1);
        bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'DELETE', MODULE: 'MASTER_HUB', RECORD_TYPE: category, RECORD_ID: id, OLD_VALUE: '{}', NEW_VALUE: '{}', TIMESTAMP: new Date().toISOString() });
        if (BNX_MASTER_CACHE_TABLES_.has(cfg.table)) bnxInvalidateMasterCache_(clientId);
        return { success: true };
      }
    }
    return { success: false, error: 'Record not found' };
  } catch (error) {
    bnxLogError(clientId, `bnxDeleteMaster failed for ${category}: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxBulkImportMaster(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const category = payload.category || '';
  const cfg = MASTER_CATEGORY_MAP[category];
  if (!cfg) return { success: false, error: 'Category "' + category + '" has no v3 table configured yet -- cannot bulk import.' };
  let records = [];
  try {
    records = typeof payload.records === 'string' ? JSON.parse(payload.records) : (payload.records || []);
  } catch (e) { return { success: false, error: 'records must be a JSON array' }; }
  if (!Array.isArray(records) || !records.length) return { success: false, error: 'No records to import' };
  try {
    const sheet = bnxClientSheet(clientId, cfg.table);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const idCol = headers.indexOf(cfg.idField);
    const existingIds = new Set();
    if (idCol !== -1) {
      const existingVals = sheet.getDataRange().getValues();
      for (let r = 1; r < existingVals.length; r++) {
        if (ciCol === -1 || existingVals[r][ciCol] === clientId) existingIds.add(existingVals[r][idCol]);
      }
    }
    const rowsToAppend = [];
    records.forEach(record => {
      const v3Row = {};
      Object.keys(record).forEach(function (frontendField) {
        const v3Field = cfg.fieldMap[frontendField] || (headers.indexOf(frontendField) !== -1 ? frontendField : null);
        if (v3Field) v3Row[v3Field] = record[frontendField];
      });
      const existingId = record[cfg.idField] || record.id || '';
      if (existingId && existingIds.has(existingId)) return;
      if (ciCol !== -1) v3Row.CLIENT_ID = clientId;
      v3Row[cfg.idField] = generateShortId_(clientId, cfg.idField);
      if (headers.indexOf('CREATED_AT') !== -1) v3Row.CREATED_AT = new Date().toISOString();
      rowsToAppend.push(headers.map(h => v3Row[h] !== undefined ? v3Row[h] : ''));
    });
    if (rowsToAppend.length) sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'BULK_CREATE', MODULE: 'MASTER_HUB', RECORD_TYPE: category, RECORD_ID: '', OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ imported: rowsToAppend.length, skipped: records.length - rowsToAppend.length }), TIMESTAMP: new Date().toISOString() });
    if (BNX_MASTER_CACHE_TABLES_.has(cfg.table)) bnxInvalidateMasterCache_(clientId);
    return { success: true, data: { count: rowsToAppend.length, skipped: records.length - rowsToAppend.length } };
  } catch (error) {
    bnxLogError(clientId, `bnxBulkImportMaster failed for ${category}: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetPermissions(session, payload) {
  const clientId = session.CLIENT_ID;
  const scope = payload.scope || payload.category || '';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.SETTINGS_TOGGLES);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const permissions = {};
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      if (row.SCOPE !== scope) continue;
      permissions[row.TOGGLE_KEY] = row.VALUE === true || row.VALUE === 'true' || row.VALUE === 'TRUE';
    }
    return { success: true, data: { permissions } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetPermissions failed for ${scope}: ${error.message}`, payload);
    return { success: false, error: error.message, data: { permissions: {} } };
  }
}

function bnxSavePermission(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const scope = payload.scope || payload.category || '';
  const permKey = payload.permKey || '';
  const value = payload.value;
  if (!scope || !permKey) return { success: false, error: 'scope and permKey required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.SETTINGS_TOGGLES);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const scopeCol = headers.indexOf('SCOPE');
    const keyCol = headers.indexOf('TOGGLE_KEY');
    const valCol = headers.indexOf('VALUE');
    const ciCol = headers.indexOf('CLIENT_ID');
    const updatedCol = headers.indexOf('UPDATED_AT');
    for (let r = 1; r < values.length; r++) {
      if (values[r][scopeCol] === scope && values[r][keyCol] === permKey && (ciCol === -1 || values[r][ciCol] === clientId)) {
        sheet.getRange(r + 1, valCol + 1).setValue(value);
        if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
        return { success: true, updated: true };
      }
    }
    bnxAppendRow(clientId, SHEETS.SETTINGS_TOGGLES, { CLIENT_ID: clientId, SCOPE: scope, TOGGLE_KEY: permKey, VALUE: value, CREATED_AT: new Date().toISOString(), UPDATED_AT: new Date().toISOString() });
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'UPDATE', MODULE: 'MASTER_HUB_SETTINGS', RECORD_TYPE: 'PERMISSION', RECORD_ID: scope + '.' + permKey, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ value }), TIMESTAMP: new Date().toISOString() });
    return { success: true, updated: false };
  } catch (error) {
    bnxLogError(clientId, `bnxSavePermission failed for ${scope}.${permKey}: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}


/* ============================================================================
 * BUSINESS DAY — 06:00 AM → next day 06:00 AM
 * Server-side source of truth for all report "today/yesterday/week" ranges.
 * A bill dated 06-Sep at 00:00–05:59 belongs to Business Date 05-Sep.
 * ============================================================================ */
const BNX_BUSINESS_DAY_START_HOUR = 6;

function bnxBusinessDateKey_(dateObj) {
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const d = dateObj ? new Date(dateObj) : new Date();
  if (isNaN(d.getTime())) return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const hour = Number(Utilities.formatDate(d, tz, 'H'));
  if (hour < BNX_BUSINESS_DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function bnxBusinessDateOffset_(businessDate, days) {
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const m = String(businessDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return bnxBusinessDateKey_();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function bnxResolveDateRange_(payload) {
  const now = new Date();
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const toISO = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const businessToday = bnxBusinessDateKey_(now);
  const clampBusinessToday = (dateKey) => {
    return dateKey > businessToday ? businessToday : dateKey;
  };
  const range = payload.range || 'today';

  if (range === 'custom' && payload.from && payload.to) {
    return { from: payload.from, to: payload.to };
  }

  if (range === 'yesterday') {
    const y = bnxBusinessDateOffset_(businessToday, -1);
    return { from: y, to: y };
  }

  if (range === 'week') {
    let monday;
    if (payload.weekStart && /^\d{4}-W\d{2}$/.test(payload.weekStart)) {
      const [, y, w] = payload.weekStart.match(/^(\d{4})-W(\d{2})$/);
      const jan4 = new Date(Number(y), 0, 4);
      const jan4Dow = (jan4.getDay() + 6) % 7;
      monday = new Date(jan4);
      monday.setDate(jan4.getDate() - jan4Dow + (Number(w) - 1) * 7);
    } else {
      const parts = businessToday.split('-').map(Number);
      const bd = new Date(parts[0], parts[1] - 1, parts[2]);
      const dow = (bd.getDay() + 6) % 7;
      monday = new Date(bd);
      monday.setDate(bd.getDate() - dow);
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toISO(monday), to: clampBusinessToday(toISO(sunday)) };
  }

  if (range === 'month') {
    const parts = businessToday.split('-').map(Number);
    let y = parts[0], m = parts[1] - 1;
    if (payload.month && /^\d{4}-\d{2}$/.test(payload.month)) {
      const [, my, mm] = payload.month.match(/^(\d{4})-(\d{2})$/);
      y = Number(my); m = Number(mm) - 1;
    }
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { from: toISO(start), to: clampBusinessToday(toISO(end)) };
  }

  if (range === 'quarter') {
    let fyStartYear, qIndex;
    if (payload.quarter && payload.fyYear) {
      qIndex = Math.max(0, Math.min(3, Number(payload.quarter) - 1));
      fyStartYear = Number(payload.fyYear);
    } else {
      const parts = businessToday.split('-').map(Number);
      const m = parts[1] - 1;
      const yr = parts[0];
      fyStartYear = m >= 3 ? yr : yr - 1;
      const monthsIntoFY = (m - 3 + 12) % 12;
      qIndex = Math.floor(monthsIntoFY / 3);
    }
    const startMonth = 3 + qIndex * 3;
    const startDate = new Date(fyStartYear, startMonth % 12, 1, 0, 0, 0);
    if (startMonth >= 12) startDate.setFullYear(fyStartYear + 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);
    return { from: toISO(startDate), to: clampBusinessToday(toISO(endDate)) };
  }

  if (range === 'year') {
    const parts = businessToday.split('-').map(Number);
    const currentFyStartYear = parts[1] >= 4 ? parts[0] : parts[0] - 1;
    const fyStartYear = payload.fyYear ? Number(payload.fyYear) : currentFyStartYear;
    const startDate = new Date(fyStartYear, 3, 1);
    const endDate = new Date(fyStartYear + 1, 2, 31);
    return { from: toISO(startDate), to: clampBusinessToday(toISO(endDate)) };
  }

  return { from: businessToday, to: businessToday };
}

function bnxDateKeySafe_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  const s = String(value == null ? '' : value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) {
    const p = s.split(/[-/]/); return `${p[2]}-${p[1]}-${p[0]}`;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
}

function bnxGetDashboardSummary(session, payload) {
  const clientId = session.CLIENT_ID;
  const range = payload.range || 'today';
  const cacheKey = 'dash_' + clientId + '_' + range + '_' + (payload.from||'') + '_' + (payload.to||'') +
    '_' + (payload.weekStart||'') + '_' + (payload.month||'') + '_' + (payload.quarter||'') + '_' + (payload.fyYear||'');
  return bnxCachedReport_(cacheKey, 30, () => bnxGetDashboardSummary_impl_(session, payload));
}
function bnxGetDashboardSummary_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    let revenue = 0, totalSales = 0, orders = 0, covers = 0, creditToday = 0;
    const hourlyMap = {};
    const isTodayRange = !payload.range || payload.range === 'today';
    let yesterday = '';
    if (isTodayRange) {
      yesterday = bnxBusinessDateOffset_(bnxBusinessDateKey_(), -1);
    }
    let revenueYesterday = 0, totalSalesYesterday = 0, ordersYesterday = 0, coversYesterday = 0;
    const billIdsInRange = {};
    const stewardMap = {};
    for (let r = 1; r < values.length; r++) {
      const b = bnxRowToObject(values[r], headers);
      if (String(b.CLIENT_ID || '') !== String(clientId)) continue;
      const billDateKey = bnxDateKeySafe_(b.BILL_DATE);
      // Revenue is based only on valid/finalized sales. Cancelled/void bills
      // must never contribute to Net Revenue, Gross Sales, bills or covers.
      const billStatus = String(b.BILL_STATUS || '').trim().toUpperCase();
      if (billStatus === 'CANCELLED' || billStatus === 'VOID') continue;
      if (isTodayRange && billDateKey === yesterday) {
        const yAmt = Number(b.GRAND_TOTAL) || 0;
        const yTax = Number(b.TAX_AMOUNT) || 0;
        const yRound = Number(b.ROUND_OFF) || 0;
        const yTaxableRaw = Number(b.TAXABLE_AMOUNT);
        const yTaxable = Number.isFinite(yTaxableRaw) && (yTaxableRaw !== 0 || yAmt === 0)
          ? yTaxableRaw
          : Math.max(0, +((yAmt - yTax - yRound)).toFixed(2));
        revenueYesterday += yTaxable; totalSalesYesterday += yAmt; ordersYesterday += 1; coversYesterday += Number(b.COVERS) || 0;
      }
      if (billDateKey < from || billDateKey > to) continue;
      const amt = Number(b.GRAND_TOTAL) || 0;
      const tax = Number(b.TAX_AMOUNT) || 0;
      const roundOff = Number(b.ROUND_OFF) || 0;
      const taxableRaw = Number(b.TAXABLE_AMOUNT);
      // Net Revenue = taxable sales (after discounts, excluding GST). Prefer
      // the stored TAXABLE_AMOUNT when it is populated. If an old/imported
      // row has a blank/zero taxable amount despite having a real sale, derive
      // it from GRAND_TOTAL - GST - round-off instead of reporting a false 0.
      const taxableAmt = Number.isFinite(taxableRaw) && (taxableRaw !== 0 || amt === 0)
        ? taxableRaw
        : Math.max(0, +((amt - tax - roundOff)).toFixed(2));
      revenue += taxableAmt; totalSales += amt; orders += 1; covers += Number(b.COVERS) || 0;
      if (String(b.PAYMENT_STATUS).toUpperCase() !== 'PAID') creditToday += amt;
      const hour = (b.BILL_TIME || '00:00:00').split(':')[0];
      if (!hourlyMap[hour]) hourlyMap[hour] = { v: 0, sales: 0, bills: 0, discount: 0, tax: 0 };
      hourlyMap[hour].v += taxableAmt;
      hourlyMap[hour].sales += amt;
      hourlyMap[hour].bills += 1;
      hourlyMap[hour].discount += (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0);
      hourlyMap[hour].tax += Number(b.TAX_AMOUNT) || 0;
      billIdsInRange[b.BILL_ID] = true;
      const steward = b.CREATED_BY || b.FINALIZED_BY || '';
      if (steward && steward.indexOf('HISTORICAL_IMPORT:') !== 0) {
        if (!stewardMap[steward]) stewardMap[steward] = { orders: 0, revenue: 0 };
        stewardMap[steward].orders += 1;
        stewardMap[steward].revenue += amt;
      }
    }
    let cash = 0, upi = 0, bank = 0;
    try {
      const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
      const payValues = paySheet.getDataRange().getValues();
      const payHeaders = payValues[0];
      for (let r = 1; r < payValues.length; r++) {
        const p = bnxRowToObject(payValues[r], payHeaders);
        if (String(p.CLIENT_ID || '') !== String(clientId)) continue;
        const paymentDateKey = bnxDateKeySafe_(p.PAYMENT_DATE);
        if (paymentDateKey < from || paymentDateKey > to) continue;
        const mode = String(p.PAYMENT_MODE || '').toUpperCase();
        const amt = Number(p.AMOUNT) || 0;
        if (mode === 'CASH') cash += amt;
        else if (mode === 'UPI') upi += amt;
        else if (mode === 'CARD' || mode === 'BANK' || mode === 'DEBIT CARD' || mode === 'CREDIT CARD') bank += amt;
        else cash += amt;
      }
    } catch (e) {}

    let topItems = [];
    try {
      const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
      const biValues = biSheet.getDataRange().getValues();
      const biHeaders = biValues[0];
      const itemMap = {};
      for (let r = 1; r < biValues.length; r++) {
        const it = bnxRowToObject(biValues[r], biHeaders);
        if (!billIdsInRange[it.BILL_ID]) continue;
        const name = it.ITEM_NAME || 'Unknown Item';
        if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 };
        itemMap[name].qty += Number(it.QUANTITY) || 0;
        itemMap[name].revenue += Number(it.LINE_TOTAL) || 0;
      }
      topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
    } catch (e) {}

    const stewardPerformance = Object.keys(stewardMap)
      .map(name => ({ name, orders: stewardMap[name].orders, revenue: stewardMap[name].revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    let inventoryAlerts = [];
    try {
      const sbSheet = bnxClientSheet(clientId, SHEETS.STOCK_BALANCE);
      const sbValues = sbSheet.getDataRange().getValues();
      const sbHeaders = sbValues[0];
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      const itemById = {};
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        itemById[it.ITEM_ID] = it;
      }
      for (let r = 1; r < sbValues.length; r++) {
        const sb = bnxRowToObject(sbValues[r], sbHeaders);
        if (sb.CLIENT_ID !== clientId) continue;
        const reorder = Number(sb.REORDER_LEVEL) || 0;
        const avail = Number(sb.AVAILABLE_QUANTITY != null && sb.AVAILABLE_QUANTITY !== '' ? sb.AVAILABLE_QUANTITY : sb.CURRENT_QUANTITY) || 0;
        if (reorder <= 0 || avail > reorder) continue;
        const item = itemById[sb.ITEM_ID] || {};
        inventoryAlerts.push({ name: item.ITEM_NAME || sb.ITEM_ID, stock: avail, unit: item.UNIT_ID || '', reorder: reorder });
      }
      inventoryAlerts.sort((a, b) => (a.stock / (a.reorder || 1)) - (b.stock / (b.reorder || 1)));
    } catch (e) {}

    let forecastTomorrow = null;
    try {
      const lookbackDays = 7;
      const dayTotals = {};
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - lookbackDays);
      const cutoffStr = Utilities.formatDate(cutoff, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
      for (let r = 1; r < values.length; r++) {
        const b = bnxRowToObject(values[r], headers);
        if (b.CLIENT_ID !== clientId) continue;
        const st = String(b.BILL_STATUS || '').trim().toUpperCase();
        if (st === 'CANCELLED' || st === 'VOID') continue;
        if (b.BILL_DATE < cutoffStr) continue;
        dayTotals[b.BILL_DATE] = (dayTotals[b.BILL_DATE] || 0) + (Number(b.GRAND_TOTAL) || 0);
      }
      const days = Object.keys(dayTotals);
      if (days.length) {
        const avg = days.reduce((s, d) => s + dayTotals[d], 0) / days.length;
        forecastTomorrow = { estimate: avg, basis: 'last ' + days.length + ' day' + (days.length === 1 ? '' : 's') };
      }
    } catch (e) {}

    let avgTableTurn = null;
    try {
      const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
      const orderValues = orderSheet.getDataRange().getValues();
      const orderHeaders = orderValues[0];
      const orderTimeByNumber = {};
      for (let r = 1; r < orderValues.length; r++) {
        const o = bnxRowToObject(orderValues[r], orderHeaders);
        if (o.CLIENT_ID !== clientId || !o.ORDER_NUMBER) continue;
        const key = o.ORDER_NUMBER + '|' + o.ORDER_DATE;
        if (!orderTimeByNumber[key]) orderTimeByNumber[key] = o.ORDER_TIME;
      }
      const durationsMin = [];
      for (let r = 1; r < values.length; r++) {
        const b = bnxRowToObject(values[r], headers);
        if (b.CLIENT_ID !== clientId) continue;
        const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
        if (!b.ORDER_ID) continue;
        const orderTime = orderTimeByNumber[b.ORDER_ID + '|' + b.BILL_DATE];
        if (!orderTime || !b.BILL_TIME) continue;
        const [oh, om] = String(orderTime).split(':').map(Number);
        const [bh, bm] = String(b.BILL_TIME).split(':').map(Number);
        if ([oh,om,bh,bm].some(isNaN)) continue;
        const mins = (bh*60+bm) - (oh*60+om);
        if (mins > 0 && mins < 720) durationsMin.push(mins);
      }
      if (durationsMin.length) {
        avgTableTurn = { minutes: Math.round(durationsMin.reduce((s,m)=>s+m,0) / durationsMin.length), sampleSize: durationsMin.length };
      } else {
        avgTableTurn = { minutes: null, sampleSize: 0 };
      }
    } catch (e) { avgTableTurn = null; }

    // FIX: dashboard "Orders Placed" KPI must count ORDER_MASTER records in
    // the selected date range, not only active/unbilled orders. Once all
    // today's orders are billed, GET_ACTIVE_ORDERS legitimately becomes 0,
    // which previously made the KPI show a blank/incorrect value.
    let ordersPlaced = 0;
    try {
      const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
      const orderValues = orderSheet.getDataRange().getValues();
      const orderHeaders = orderValues[0];
      for (let r = 1; r < orderValues.length; r++) {
        const o = bnxRowToObject(orderValues[r], orderHeaders);
        if (String(o.CLIENT_ID || '') !== String(clientId)) continue;
        const orderDateKey = bnxDateKeySafe_(o.ORDER_DATE);
        if (!orderDateKey || orderDateKey < from || orderDateKey > to) continue;
        if (String(o.ORDER_STATUS || '').toUpperCase() === 'CANCELLED') continue;
        ordersPlaced++;
      }
    } catch (e) {
      console.warn('[Dashboard] ordersPlaced lookup failed:', e.message);
    }

    const activeOrdersRes = bnxGetActiveOrders(session, {});
    const activeOrders = (activeOrdersRes && activeOrdersRes.success) ? activeOrdersRes.data.orders : [];
    const hourlyChart = Object.keys(hourlyMap).sort().map(h => ({
      h: h + ':00', v: hourlyMap[h].v, sales: hourlyMap[h].sales, bills: hourlyMap[h].bills,
      discount: hourlyMap[h].discount, tax: hourlyMap[h].tax
    }));
    const data = { revenue, totalSales, orders, ordersPlaced, covers, activeOrders, hourlyChart, collectionsByMode: { cash, upi, bank, creditToday }, topItems, stewardPerformance, inventoryAlerts, forecastTomorrow, avgTableTurn };
    if (isTodayRange) {
      const pctChange = (curr, prev) => prev > 0 ? +(((curr - prev) / prev) * 100).toFixed(1) : null;
      data.vsYesterday = { revenuePct: pctChange(revenue, revenueYesterday), totalSalesPct: pctChange(totalSales, totalSalesYesterday), ordersPct: pctChange(orders, ordersYesterday), coversPct: pctChange(covers, coversYesterday), revenueYesterday, totalSalesYesterday, ordersYesterday, coversYesterday };
    }
    return { success: true, data: data };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDashboardSummary failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxCachedReport_(cacheKey, ttlSeconds, computeFn) {
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const result = computeFn();
  try {
    if (result && result.success) CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), ttlSeconds);
  } catch (e) {}
  return result;
}

function bnxReportCacheKey_(prefix, clientId, payload) {
  return [
    prefix, clientId, payload.range || '', payload.from || '', payload.to || '',
    payload.weekStart || '', payload.month || '', payload.quarter || '', payload.fyYear || '',
    payload.mode || '', payload.businessDate || payload.date || ''
  ].join('_');
}

function bnxCachedCategoryNameMap_(clientId) {
  const key = 'catmap_' + clientId;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const map = bnxCategoryNameMap_(clientId);
  try { CacheService.getScriptCache().put(key, JSON.stringify(map), 60); } catch (e) {}
  return map;
}
function bnxCachedTaxRateMap_(clientId) {
  const key = 'taxmap_' + clientId;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const map = bnxTaxRateMap_(clientId);
  try { CacheService.getScriptCache().put(key, JSON.stringify(map), 60); } catch (e) {}
  return map;
}
function bnxCachedUnitNameMap_(clientId) {
  const key = 'unitmap_' + clientId;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const map = bnxUnitNameMap_(clientId);
  try { CacheService.getScriptCache().put(key, JSON.stringify(map), 60); } catch (e) {}
  return map;
}
function bnxCachedItemNameMap_(clientId) {
  const key = 'itemnamemap_' + clientId;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const map = {};
  try {
    const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const imValues = imSheet.getDataRange().getValues();
    const imHeaders = imValues[0];
    for (let r = 1; r < imValues.length; r++) {
      const it = bnxRowToObject(imValues[r], imHeaders);
      if (it.CLIENT_ID !== clientId || !it.ITEM_NAME) continue;
      map[String(it.ITEM_NAME).toLowerCase().trim()] = it.ITEM_ID;
    }
  } catch (e) {}
  try { CacheService.getScriptCache().put(key, JSON.stringify(map), 60); } catch (e) {}
  return map;
}
function bnxInvalidateMasterCache_(clientId) {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(['catmap_' + clientId, 'taxmap_' + clientId, 'unitmap_' + clientId, 'itemnamemap_' + clientId, 'itemgroupmap_' + clientId, 'posmenu_' + clientId]);
  } catch (e) {}
}

function bnxGetAccountingOverview(session, payload) {
  const clientId = session.CLIENT_ID;
  const range = bnxResolveDateRange_(payload || {});
  try {
    const from = String(range.from || payload.from || bnxBusinessDateKey_());
    const to = String(range.to || payload.to || from);
    const businessDate = from === to ? from : (payload.businessDate || bnxBusinessDateKey_());
    const out = {businessDate: businessDate, totalSales:0, totalCollection:0, creditSales:0, dueReceived:0, dueReceivedCash:0, cashExpenses:0, openingCash:0, closingCash:0, collectionsByMode:{cash:0,upi:0,bank:0}, dayBook:[]};
    const bills = bnxClientSheet(clientId, SHEETS.BILL_MASTER).getDataRange().getValues();
    const bh = bills[0] || [];
    for(let r=1;r<bills.length;r++){
      const b=bnxRowToObject(bills[r],bh); if(b.CLIENT_ID!==clientId) continue;
      if(String(b.BILL_DATE)<from || String(b.BILL_DATE)>to) continue;
      const amt=Number(b.GRAND_TOTAL)||0; out.totalSales+=amt;
      if(String(b.PAYMENT_STATUS||'').toUpperCase()!=='PAID') out.creditSales+=amt;
      const no=b.BILL_NUMBER||b.BILL_ID||('SV-'+r);
      out.dayBook.push({voucherNo:no,type:'Sales',account:'Sales / '+(b.PAYMENT_MODE||'Receivable'),debit:amt,credit:0,narration:'Bill '+no+(b.TABLE_ID?' · Table '+b.TABLE_ID:''),source:'POS',date:b.BILL_DATE});
    }
    try{
      const pays=bnxClientSheet(clientId,SHEETS.PAYMENT_MASTER).getDataRange().getValues(); const ph=pays[0]||[];
      for(let r=1;r<pays.length;r++){
        const x=bnxRowToObject(pays[r],ph); if(x.CLIENT_ID!==clientId) continue;
        if(String(x.PAYMENT_DATE)<from || String(x.PAYMENT_DATE)>to) continue;
        const a=Number(x.AMOUNT)||0, m=String(x.PAYMENT_MODE||'').toUpperCase(); out.totalCollection+=a;
        if(m==='CASH') out.collectionsByMode.cash+=a; else if(m==='UPI') out.collectionsByMode.upi+=a; else out.collectionsByMode.bank+=a;
        out.dayBook.push({voucherNo:x.PAYMENT_ID||x.VOUCHER_NO||('RC-'+r),type:'Receipt',account:(m||'Payment')+' A/c',debit:a,credit:0,narration:'Payment '+(x.BILL_ID||x.REFERENCE||''),source:'Payment',date:x.PAYMENT_DATE});
      }
    }catch(e){}
    try{
      const recs=bnxClientSheet(clientId,SHEETS.DUES_RECEIPT).getDataRange().getValues(); const rh=recs[0]||[];
      for(let r=1;r<recs.length;r++){
        const x=bnxRowToObject(recs[r],rh); if(x.CLIENT_ID!==clientId) continue;
        if(String(x.RECEIPT_DATE)!==businessDate) continue;
        const a=Number(x.AMOUNT)||0; out.dueReceived+=a; if(String(x.PAYMENT_MODE||'').toUpperCase()==='CASH') out.dueReceivedCash+=a;
        out.dayBook.push({voucherNo:x.VOUCHER_NO||x.DUES_RECEIPT_ID||('RV-'+r),type:'Receipt',account:'Customer Due',debit:a,credit:0,narration:'Due receipt · '+(x.CUSTOMER_ID||''),source:'Due Collection',date:x.RECEIPT_DATE});
      }
    }catch(e){}
    try{
      const pc=bnxGetPettyCashSheet_(clientId).getDataRange().getValues(); const ph=pc[0]||[];
      for(let r=1;r<pc.length;r++){
        const x=bnxRowToObject(pc[r],ph); if(x.CLIENT_ID!==clientId) continue;
        if(String(x.ENTRY_DATE)!==businessDate || String(x.ENTRY_TYPE||'').toLowerCase()!=='payment') continue;
        const a=Number(x.AMOUNT)||0; out.cashExpenses+=a;
        out.dayBook.push({voucherNo:x.VOUCHER_NO||x.PETTY_CASH_ID||('PV-'+r),type:'Payment',account:x.ACCOUNT||'Petty Cash',debit:0,credit:a,narration:x.NARRATION||x.PURPOSE||'Petty cash payment',source:'Petty Cash',date:x.ENTRY_DATE});
      }
    }catch(e){}
    out.dayBook.sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.voucherNo).localeCompare(String(b.voucherNo)));
    out.closingCash = out.openingCash + out.collectionsByMode.cash + out.dueReceivedCash - out.cashExpenses;
    return {success:true,data:out};
  } catch(error) {
    bnxLogError(clientId,'bnxGetAccountingOverview failed: '+error.message,payload);
    return {success:false,error:error.message};
  }
}

function bnxGetCashbookReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('cashbook', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetCashbookReport_impl_(session, payload));
}
/* NOTE: bnxGetCashbookReport_impl_ is intentionally NOT defined here --
   the report-engine section below (PASS #63) defines the real, final
   version (adds a proper from/to range instead of the old payload.from/
   payload.to-only version). Do not add a second copy. */

function bnxGetDsrMatrix(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('dsrmatrix', clientId, payload) + '_' + (payload.year||'') + '_' + (payload.month||'');
  return bnxCachedReport_(cacheKey, 20, () => bnxGetDsrMatrix_impl_(session, payload));
}

const BNX_DSR_LIQUOR_RE_ = /liquor|alcohol|wine|beer|whisky|whiskey|vodka|rum|gin|tequila|spirit|\bbar\b|imfl|cocktail|\bshots?\b|\bpeg\b|brandy|liqueur|champagne|cognac|feni|toddy|arrack|draught|draft/;
const BNX_DSR_BEVERAGE_RE_ = /beverage|\bdrink|juice|mocktail|soft ?drink|\bsoda\b|\bwater\b|\btea\b|\bcoffee\b|shake|smoothie|lassi|buttermilk|lemonade|\bcola\b/;
const BNX_DSR_OTHER_RE_ = /cigarette|tobacco|cigar|hookah|shisha|\bpaan\b/;

function bnxClassifyDsrItem_(categoryName, itemName) {
  const cat = String(categoryName || '').toLowerCase();
  const catLiquor = BNX_DSR_LIQUOR_RE_.test(cat);
  const catBeverage = !catLiquor && BNX_DSR_BEVERAGE_RE_.test(cat);
  const catOther = !catLiquor && !catBeverage && BNX_DSR_OTHER_RE_.test(cat);
  if (catLiquor || catBeverage || catOther) {
    return { isLiquor: catLiquor, isBeverage: catBeverage, isOther: catOther };
  }
  const name = String(itemName || '').toLowerCase();
  const nameLiquor = BNX_DSR_LIQUOR_RE_.test(name);
  const nameBeverage = !nameLiquor && BNX_DSR_BEVERAGE_RE_.test(name);
  const nameOther = !nameLiquor && !nameBeverage && BNX_DSR_OTHER_RE_.test(name);
  return { isLiquor: nameLiquor, isBeverage: nameBeverage, isOther: nameOther };
}

function bnxGetDsrMatrix_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const year = Number(payload.year);
  const month = Number(payload.month);
  try {
    const mm = String(month).padStart(2, '0');
    const prefix = year + '-' + mm + '-';
    const byDay = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, '0');
      byDay[key] = { liquor: 0, liquorMrp: 0, food: 0, beverage: 0, hashFreezer: 0, others: 0, grossSale: 0, tax: 0, roundOff: 0, netSale: 0, cash: 0, iciciCard: 0, iciciGpay: 0, guestDueSales: 0, zomato: 0, swiggy: 0, dueReceivedCash: 0, dueReceivedIcici: 0, totalCashCollection: 0, discount: 0, guestDuesCN: 0 };
    }
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const billDayByBillId = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (!String(b.BILL_DATE).startsWith(prefix)) continue;
      const day = String(b.BILL_DATE).slice(-2);
      if (!byDay[day]) continue;
      byDay[day].netSale += Number(b.SUBTOTAL) || 0;
      byDay[day].tax += Number(b.TAX_AMOUNT) || 0;
      byDay[day].roundOff += Number(b.ROUND_OFF) || 0;
      byDay[day].grossSale += Number(b.GRAND_TOTAL) || 0;
      byDay[day].discount += (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0);
      if (String(b.PAYMENT_STATUS).toUpperCase() !== 'PAID') byDay[day].guestDueSales += Number(b.GRAND_TOTAL) || 0;
      if (b.BILL_ID) billDayByBillId[b.BILL_ID] = day;
    }
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (!String(p.PAYMENT_DATE).startsWith(prefix)) continue;
      const day = String(p.PAYMENT_DATE).slice(-2);
      if (!byDay[day]) continue;
      const mode = String(p.PAYMENT_MODE).toUpperCase();
      const amt = Number(p.AMOUNT) || 0;
      if (mode === 'CASH') byDay[day].cash += amt;
      else if (mode === 'UPI') byDay[day].iciciGpay += amt;
      else byDay[day].iciciCard += amt;
      byDay[day].totalCashCollection += amt;
    }
    try {
      const catMap = bnxCachedCategoryNameMap_(clientId);
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      const itemFlagsByName = {};
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        if (it.CLIENT_ID !== clientId) continue;
        const catName = String(catMap.byId[it.CATEGORY_ID] || '').toLowerCase();
        itemFlagsByName[String(it.ITEM_NAME || '').toLowerCase()] =
          bnxClassifyDsrItem_(catName, it.ITEM_NAME);
      }
      const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
      const biValues = biSheet.getDataRange().getValues();
      const biHeaders = biValues[0];
      for (let r = 1; r < biValues.length; r++) {
        const it = bnxRowToObject(biValues[r], biHeaders);
        const day = billDayByBillId[it.BILL_ID];
        if (!day || !byDay[day]) continue;
        const amt = Number(it.LINE_TOTAL) || 0;
        const flags = itemFlagsByName[String(it.ITEM_NAME || '').toLowerCase()];
        if (flags && flags.isLiquor) byDay[day].liquor += amt;
        else if (flags && flags.isBeverage) byDay[day].beverage += amt;
        else if (flags && flags.isOther) byDay[day].others += amt;
        else byDay[day].food += amt;
      }
    } catch (e) {}
    try {
      const drSheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const drValues = drSheet.getDataRange().getValues();
      const drHeaders = drValues[0];
      for (let r = 1; r < drValues.length; r++) {
        const rec = bnxRowToObject(drValues[r], drHeaders);
        if (rec.CLIENT_ID !== clientId) continue;
        if (!String(rec.RECEIPT_DATE).startsWith(prefix)) continue;
        const day = String(rec.RECEIPT_DATE).slice(-2);
        if (!byDay[day]) continue;
        const mode = String(rec.PAYMENT_MODE).toUpperCase();
        const amt = Number(rec.AMOUNT) || 0;
        if (mode === 'CASH') byDay[day].dueReceivedCash += amt;
        else byDay[day].dueReceivedIcici += amt;
      }
    } catch (e) {}
    return { success: true, data: { byDay } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDsrMatrix failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetDsrYtd(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = 'dsrytd_' + clientId + '_' + (payload.year || '') + '_' + (payload.asOfDate || '');
  return bnxCachedReport_(cacheKey, 20, () => bnxGetDsrYtd_impl_(session, payload));
}
function bnxGetDsrYtd_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const year = Number(payload.year);
  const asOfDate = payload.asOfDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  const from = year + '-01-01';
  const to = asOfDate;
  try {
    const totals = { liquor: 0, liquorMrp: 0, food: 0, beverage: 0, hashFreezer: 0, others: 0, grossSale: 0, tax: 0, roundOff: 0, netSale: 0, cash: 0, iciciCard: 0, iciciGpay: 0, guestDueSales: 0, zomato: 0, swiggy: 0, dueReceivedCash: 0, dueReceivedIcici: 0, totalCashCollection: 0, discount: 0, guestDuesCN: 0 };

    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const billIdsInRange = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      totals.netSale += Number(b.SUBTOTAL) || 0;
      totals.tax += Number(b.TAX_AMOUNT) || 0;
      totals.roundOff += Number(b.ROUND_OFF) || 0;
      totals.grossSale += Number(b.GRAND_TOTAL) || 0;
      totals.discount += (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0);
      if (String(b.PAYMENT_STATUS).toUpperCase() !== 'PAID') totals.guestDueSales += Number(b.GRAND_TOTAL) || 0;
      if (b.BILL_ID) billIdsInRange[b.BILL_ID] = true;
    }

    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      const _payDateKey = bnxNormalizeDateKey_(p.PAYMENT_DATE); if (!_payDateKey || _payDateKey < from || _payDateKey > to) continue;
      const mode = String(p.PAYMENT_MODE).toUpperCase();
      const amt = Number(p.AMOUNT) || 0;
      if (mode === 'CASH') totals.cash += amt;
      else if (mode === 'UPI') totals.iciciGpay += amt;
      else totals.iciciCard += amt;
      totals.totalCashCollection += amt;
    }

    try {
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      const catMap = bnxCachedCategoryNameMap_(clientId);
      const itemFlagsByName = {};
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        if (it.CLIENT_ID !== clientId) continue;
        const catName = String(catMap.byId[it.CATEGORY_ID] || '').toLowerCase();
        itemFlagsByName[String(it.ITEM_NAME || '').toLowerCase()] =
          bnxClassifyDsrItem_(catName, it.ITEM_NAME);
      }
      const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
      const biValues = biSheet.getDataRange().getValues();
      const biHeaders = biValues[0];
      for (let r = 1; r < biValues.length; r++) {
        const it = bnxRowToObject(biValues[r], biHeaders);
        if (!billIdsInRange[it.BILL_ID]) continue;
        const amt = Number(it.LINE_TOTAL) || 0;
        const flags = itemFlagsByName[String(it.ITEM_NAME || '').toLowerCase()];
        if (flags && flags.isLiquor) totals.liquor += amt;
        else if (flags && flags.isBeverage) totals.beverage += amt;
        else if (flags && flags.isOther) totals.others += amt;
        else totals.food += amt;
      }
    } catch (e) {}

    try {
      const drSheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const drValues = drSheet.getDataRange().getValues();
      const drHeaders = drValues[0];
      for (let r = 1; r < drValues.length; r++) {
        const rec = bnxRowToObject(drValues[r], drHeaders);
        if (rec.CLIENT_ID !== clientId) continue;
        if (rec.RECEIPT_DATE < from || rec.RECEIPT_DATE > to) continue;
        const mode = String(rec.PAYMENT_MODE).toUpperCase();
        const amt = Number(rec.AMOUNT) || 0;
        if (mode === 'CASH') totals.dueReceivedCash += amt;
        else totals.dueReceivedIcici += amt;
      }
    } catch (e) {}

    return { success: true, data: totals, from, to };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDsrYtd failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}


function bnxMarkAttendance(session, payload) {
  const clientId = session.CLIENT_ID, sessionUserId = session.USER_ID;
  const type = String(payload.attendanceType || '').toUpperCase();
  if (!['IN','OUT'].includes(type)) return { success:false, error:'attendanceType must be IN or OUT' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ATTENDANCE_MASTER);
    const values = sheet.getDataRange().getValues(); const headers = values[0] || [];
    const tz = Session.getScriptTimeZone() || 'Asia/Kolkata'; const now = new Date();
    const date = bnxBusinessDateKey_(now), time = Utilities.formatDate(now, tz, 'HH:mm:ss');
    // Attendance may be marked by the employee themself OR by an authorised
    // manager/admin for a selected employee.  The old code always preferred
    // sessionUserId, so selecting another employee in an attendance screen
    // still marked the logged-in manager.  Prefer an explicit target employee
    // when supplied; otherwise fall back to the logged-in user.
    const targetUserId = payload.employeeUserId || payload.empUserId || payload.userId || payload.EMP_ID || payload.EMPLOYEE_ID || sessionUserId || '';
    const identity = {
      userId: targetUserId,
      loginId: payload.employeeLoginId || payload.loginId || payload.USER_CODE || '',
      fullName: payload.employeeName || payload.fullName || payload.FULL_NAME || '',
      role: payload.employeeRole || payload.role || payload.ROLE || '',
      locationId: payload.locationId || payload.LOCATION_ID || session.LOCATION_ID || ''
    };
    const pick=(obj,names)=>{for(const n of names){if(obj[n]!==undefined&&obj[n]!==null&&obj[n]!=='')return obj[n];}return '';};
    const same=(row)=>{
      const u=bnxRowToObject(row,headers);
      if (u.CLIENT_ID && u.CLIENT_ID !== clientId) return false;
      return (identity.userId && [u.USER_ID,u.EMP_ID,u.EMPLOYEE_ID].some(v=>String(v||'')===String(identity.userId))) ||
             (identity.loginId && [u.USER_CODE,u.LOGIN_ID, u.USERNAME].some(v=>String(v||'').toLowerCase()===String(identity.loginId).toLowerCase())) ||
             (identity.fullName && [u.FULL_NAME,u.EMP_NAME,u.EMPLOYEE_NAME].some(v=>String(v||'').trim().toLowerCase()===String(identity.fullName).trim().toLowerCase()));
    };
    let target=-1, obj=null;
    for(let r=1;r<values.length;r++){
      const o=bnxRowToObject(values[r],headers);
      if((o.ATTENDANCE_DATE||o.DATE)!==date || !same(values[r])) continue;
      const rowLoc=String(o.LOCATION_ID||'').trim();
      if(identity.locationId && rowLoc && rowLoc!==String(identity.locationId).trim()) continue;
      target=r; obj=o; break;
    }
    const data={CLIENT_ID:clientId, LOCATION_ID:identity.locationId || '', ATTENDANCE_ID:generateShortId_(clientId,'ATTENDANCE_ID'), EMP_ID:identity.userId || payload.empId || '', USER_ID:identity.userId || '', USER_CODE:identity.loginId || '', FULL_NAME:identity.fullName || '', ROLE:identity.role || '', ATTENDANCE_DATE:date, STATUS:type==='IN'?'PRESENT':'PRESENT', MARKED_BY:sessionUserId || '', UPDATED_AT:now.toISOString(), CREATED_AT:now.toISOString()};
    data.IN_TIME = type==='IN' ? time : (obj ? pick(obj,['IN_TIME','CHECK_IN']) : '');
    data.OUT_TIME = type==='OUT' ? time : (obj ? pick(obj,['OUT_TIME','CHECK_OUT']) : '');
    if(target>=0){
      headers.forEach((h,c)=>{if(data[h]!==undefined && data[h]!==null && data[h]!=='' || (h==='OUT_TIME'&&type==='OUT') || (h==='IN_TIME'&&type==='IN')) sheet.getRange(target+1,c+1).setValue(data[h]===undefined?'':data[h]);});
    } else { bnxAppendRow(clientId,SHEETS.ATTENDANCE_MASTER,data); }
    bnxCreateAuditLog(clientId,{CLIENT_ID:clientId,USER_ID:sessionUserId,ACTION:'ATTENDANCE_'+type,MODULE:'ATTENDANCE',RECORD_TYPE:'ATTENDANCE',RECORD_ID:data.ATTENDANCE_ID,NEW_VALUE:JSON.stringify(data),TIMESTAMP:now.toISOString()});
    return {success:true,data:{date,time,type},message:'Attendance '+type+' saved'};
  } catch(e){ bnxLogError(clientId,`bnxMarkAttendance failed: ${e.message}`,payload); return {success:false,error:e.message}; }
}

function bnxGetMyAttendance(session, payload) {
  const clientId=session.CLIENT_ID, userId=session.USER_ID, loginId=payload.loginId||payload.LOGIN_ID||payload.USER_CODE||'', fullName=payload.fullName||payload.FULL_NAME||'', locationId=payload.locationId||payload.LOCATION_ID||'';
  const from=payload.fromDate||payload.FROM_DATE||bnxBusinessDateKey_(new Date()), to=payload.toDate||payload.TO_DATE||from;
  try{
    const sheet=bnxClientSheet(clientId,SHEETS.ATTENDANCE_MASTER); const values=sheet.getDataRange().getValues(); const headers=values[0]||[];
    const out=[]; for(let r=1;r<values.length;r++){const o=bnxRowToObject(values[r],headers); if(o.CLIENT_ID&&o.CLIENT_ID!==clientId)continue; if(locationId && o.LOCATION_ID && String(o.LOCATION_ID)!==String(locationId))continue; if((o.ATTENDANCE_DATE||o.DATE)<from||(o.ATTENDANCE_DATE||o.DATE)>to)continue; const owner=[o.USER_ID,o.EMP_ID,o.EMPLOYEE_ID].some(v=>v&&String(v)===String(userId)) ||
        (loginId && o.USER_CODE&&String(o.USER_CODE).toLowerCase()===String(loginId).toLowerCase()) ||
        (fullName && o.FULL_NAME&&String(o.FULL_NAME).trim().toLowerCase()===String(fullName).trim().toLowerCase());
      if(owner)out.push(o);}
    out.sort((a,b)=>String(b.ATTENDANCE_DATE||b.DATE).localeCompare(String(a.ATTENDANCE_DATE||a.DATE))); return {success:true,data:{attendance:out,from,to}};
  }catch(e){return {success:false,error:e.message,data:{attendance:[]}};}
}

function bnxGetMyIncentive(session, payload) {
  const clientId=session.CLIENT_ID, userId=session.USER_ID;
  const from=payload.fromDate||payload.FROM_DATE||bnxBusinessDateKey_(new Date()), to=payload.toDate||payload.TO_DATE||from;
  try{
    const sheet=bnxClientSheet(clientId,SHEETS.INCENTIVE_TRANSACTION); const values=sheet.getDataRange().getValues(); const headers=values[0]||[]; const out=[];
    const loginId=String(payload.loginId||payload.LOGIN_ID||payload.USER_CODE||'').trim().toLowerCase(); const fullName=String(payload.fullName||payload.FULL_NAME||'').trim().toLowerCase();
    for(let r=1;r<values.length;r++){const o=bnxRowToObject(values[r],headers); if(o.CLIENT_ID&&o.CLIENT_ID!==clientId)continue; const d=String(o.INCENTIVE_DATE||o.DATE||o.TRANSACTION_DATE||''); if(d<from||d>to)continue; const owner=[o.USER_ID,o.EMP_ID,o.EMPLOYEE_ID,o.STAFF_ID,o.CREATED_BY].some(v=>v&&String(v)===String(userId)) || (loginId&&[o.USER_CODE,o.LOGIN_ID,o.CREATED_BY_LOGIN].some(v=>v&&String(v).trim().toLowerCase()===loginId)) || (fullName&&[o.FULL_NAME,o.EMP_NAME,o.EMPLOYEE_NAME,o.CREATED_BY_NAME].some(v=>v&&String(v).trim().toLowerCase()===fullName)); if(owner)out.push(o);}
    return {success:true,data:{incentives:out,from,to}};
  }catch(e){return {success:false,error:e.message,data:{incentives:[]}};}
}

function bnxGetStaffList(session, payload) {
  const clientId = session.CLIENT_ID;
  const roles = (payload.roles || []).map(r => String(r).toUpperCase());
  try {
    const roleNameByRoleId = {};
    try {
      const roleSheet = bnxClientSheet(clientId, SHEETS.ROLE_MASTER || 'ROLE_MASTER');
      const roleValues = roleSheet.getDataRange().getValues();
      const roleHeaders = roleValues[0];
      for (let r = 1; r < roleValues.length; r++) {
        const rr = bnxRowToObject(roleValues[r], roleHeaders);
        if (rr.CLIENT_ID && rr.CLIENT_ID !== clientId) continue;
        if (!rr.ROLE_ID) continue;
        roleNameByRoleId[rr.ROLE_ID] = rr.ROLE_NAME || rr.ROLE || rr.ROLE_ID;
      }
    } catch (e) { /* ROLE_MASTER read issue -- every row falls back to its raw ROLE_ID below, never blank */ }

    const sheet = bnxClientSheet(clientId, SHEETS.USER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const staff = [];
    for (let r = 1; r < values.length; r++) {
      const u = bnxRowToObject(values[r], headers);
      if (u.CLIENT_ID !== clientId) continue;
      if (u.IS_ACTIVE === false || u.IS_ACTIVE === 'false' || u.IS_ACTIVE === 'FALSE') continue;
      const roleRaw = String(u.ROLE || (u.ROLE_ID ? roleNameByRoleId[u.ROLE_ID] : '') || u.ROLE_ID || u.STAFF_TYPE || '').toUpperCase();
      if (roles.length && !roles.includes(roleRaw)) continue;
      staff.push({ USER_CODE: u.USERNAME || u.USER_CODE || u.USER_ID, FULL_NAME: u.FULL_NAME || u.NAME || 'Staff', ROLE: roleRaw });
    }
    return { success: true, data: { staff } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetStaffList failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

/* ============================================================================
 * ATTENDANCE EMPLOYEE BRIDGE
 * Same USER_MASTER identity as Staff/Steward login. Passwords are never
 * returned by this endpoint.
 * ============================================================================ */
function bnxGetAttendanceEmployees(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.USER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const staff = [];
    for (let r = 1; r < values.length; r++) {
      const u = bnxRowToObject(values[r], headers);
      if (u.CLIENT_ID !== clientId) continue;
      if (u.IS_ACTIVE === false || String(u.IS_ACTIVE).toUpperCase() === 'FALSE') continue;
      staff.push({
        EMP_ID: u.EMP_ID || u.USER_ID || u.USER_CODE || '',
        USER_ID: u.USER_ID || '',
        USER_CODE: u.USERNAME || u.USER_CODE || u.USER_ID || '',
        FULL_NAME: u.FULL_NAME || u.NAME || '',
        MOBILE: u.PHONE || u.MOBILE_NO || u.MOBILE || '',
        ROLE: u.ROLE || u.ROLE_ID || '',
        DEPARTMENT: u.DEPARTMENT || '',
        DESIGNATION: u.DESIGNATION || '',
        BRANCH: u.BRANCH || '',
        SHIFT: u.SHIFT || ''
      });
    }
    return { success: true, data: { employees: staff, count: staff.length } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetAttendanceEmployees failed: ${error.message}`, payload);
    return { success: false, error: error.message, data: { employees: [], count: 0 } };
  }
}

function bnxClearTestData(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  if (payload.confirm !== 'CLEAR TEST DATA') return { success: false, error: 'Confirmation phrase did not match -- nothing cleared.' };
  const tabsToClear = [
    SHEETS.BILL_MASTER, SHEETS.BILL_ITEMS, SHEETS.PAYMENT_MASTER,
    SHEETS.ORDER_MASTER, SHEETS.ORDER_ITEMS,
    SHEETS.KOT_MASTER, SHEETS.KOT_ITEMS, SHEETS.KOT_STATUS_LOG,
    SHEETS.STOCK_MOVEMENT, SHEETS.STOCK_BALANCE,
    SHEETS.CUSTOMER_DUES, SHEETS.DUES_RECEIPT, SHEETS.SUPPLIER_DUES,
    SHEETS.JOURNAL, SHEETS.LEDGER_ENTRIES,
    SHEETS.RESERVATION_MASTER, SHEETS.TABLE_LIVE_STATE,
    SHEETS.ONLINE_ORDER_MASTER, SHEETS.ONLINE_ORDER_ITEMS, SHEETS.AGGREGATOR_SETTLEMENT,
    SHEETS.DAY_STATUS, SHEETS.DAILY_COLLECTION,
    SHEETS.KITCHEN_INDENT, SHEETS.BAR_INDENT, SHEETS.KITCHEN_CONSUMPTION, SHEETS.WASTAGE_MASTER,
    SHEETS.PURCHASE_MASTER, SHEETS.PURCHASE_ITEMS, SHEETS.SALES_LEDGER,
    SHEETS.SYNC_LOG, SHEETS.AUDIT_LOG, SHEETS.ERROR_LOG
  ];
  const clearedTabs = [];
  const skippedTabs = [];
  try {
    tabsToClear.forEach(tabName => {
      try {
        const sheet = bnxClientSheet(clientId, tabName);
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        clearedTabs.push(tabName);
      } catch (innerErr) {
        console.warn('[bnxClearTestData] skipped ' + tabName + ': ' + innerErr.message);
        skippedTabs.push({ tab: tabName, reason: innerErr.message });
      }
    });
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CLEAR_TEST_DATA', MODULE: 'SETTINGS', RECORD_TYPE: 'BULK', RECORD_ID: '', OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ clearedTabs, skippedTabs }), TIMESTAMP: new Date().toISOString() });
    return { success: true, data: { clearedTabs, skippedTabs } };
  } catch (error) {
    bnxLogError(clientId, `bnxClearTestData failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxDayOpen(session, payload) {
  const clientId = session.CLIENT_ID;
  const businessDate = payload.businessDate || new Date().toISOString().split('T')[0];
  try { bnxUpsertDayStatus_(clientId, businessDate, { STATUS: 'OPEN', OPENED_AT: new Date().toISOString() }); return { success: true, businessDate }; }
  catch (error) { bnxLogError(clientId, `bnxDayOpen failed: ${error.message}`, payload); return { success: false, error: error.message }; }
}

function bnxDayClose(session, payload) {
  const clientId = session.CLIENT_ID;
  const businessDate = payload.businessDate || new Date().toISOString().split('T')[0];
  const cashCounted = Number(payload.cashCounted) || 0;
  try { bnxUpsertDayStatus_(clientId, businessDate, { STATUS: 'CLOSED', CLOSED_AT: new Date().toISOString(), CASH_COUNTED: cashCounted }); try { bnxInvalidateTodayReportCaches_(clientId); } catch (e) {} return { success: true, businessDate, whatsappSent: false }; }
  catch (error) { bnxLogError(clientId, `bnxDayClose failed: ${error.message}`, payload); return { success: false, error: error.message }; }
}

function bnxUpsertDayStatus_(clientId, businessDate, patch) {
  const sheet = bnxClientSheet(clientId, SHEETS.DAY_STATUS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ciCol = headers.indexOf('CLIENT_ID');
  const dateCol = headers.indexOf('BUSINESS_DATE');
  for (let r = 1; r < values.length; r++) {
    if (values[r][dateCol] === businessDate && (ciCol === -1 || values[r][ciCol] === clientId)) {
      headers.forEach((h, c) => { if (patch[h] !== undefined) sheet.getRange(r + 1, c + 1).setValue(patch[h]); });
      return;
    }
  }
  const row = { CLIENT_ID: clientId, BUSINESS_DATE: businessDate, CREATED_AT: new Date().toISOString() };
  Object.assign(row, patch);
  bnxAppendRow(clientId, SHEETS.DAY_STATUS, row);
}

function bnxGetBootstrap(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const menuRes = bnxGetMenuItems(session, {});
    const tableSheet = bnxClientSheet(clientId, 'TABLE_MASTER');
    const tableValues = tableSheet.getDataRange().getValues();
    const tableHeaders = tableValues[0];
    const tables = [];
    for (let r = 1; r < tableValues.length; r++) {
      const t = bnxRowToObject(tableValues[r], tableHeaders);
      if (t.CLIENT_ID !== clientId) continue;
      tables.push({ id: t.TABLE_ID, name: t.TABLE_NUMBER, capacity: Number(t.CAPACITY) || 0, section: t.SECTION || '' });
    }
    return { success: true, data: { menu: (menuRes.data || []), tables } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetBootstrap failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxLookupClientMaster_(clientId) {
  try {
    const ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    // CLIENT_MASTER is the authoritative client/company record in the central
    // USER_SECURITY_MASTER_DB control spreadsheet. Keep USER_SECURITY_MASTER_DB
    // as a fallback only for older deployments where the tab was named that.
    const sheet = ss.getSheetByName('CLIENT_MASTER') || ss.getSheetByName('USER_SECURITY_MASTER_DB') || ss.getSheets()[0];
    if (!sheet) return null;
    const values = sheet.getDataRange().getValues();
    if (!values.length) return null;
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    if (ciCol === -1) return null;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][ciCol]) !== String(clientId)) continue;
      const row = bnxRowToObject(values[r], headers);
      return {
        companyName: row.COMPANY_NAME || row.NAME || '',
        gst: row.GST_NO || row.GST_NUMBER || row.GSTIN || '',
        pan: row.PAN || '', companyType: row.COMPANY_TYPE || '',
        contactName: row.CONTACT_NAME || '', phone: row.PHONE || row.MOBILE_NO || '',
        email: row.EMAIL || '', address: row.ADDRESS || '',
        city: row.CITY || '', state: row.STATE || '',
        fssai: row.FSSAI || row.FSSAI_NO || '',
        currency: row.DEFAULT_CURRENCY || row.CURRENCY || '',
        logoUrl: row.LOGO_URL || '',
        latitude: row.LATITUDE || row.LAT || row.MAP_LAT || '',
        longitude: row.LONGITUDE || row.LNG || row.LON || row.MAP_LNG || ''
      };
    }
    return null;
  } catch (error) {
    console.warn('[bnxLookupClientMaster_] ' + error.message);
    return null;
  }
}

/* Central Client Master is the source of truth for bill identity. Whenever
 * Restaurant Info is saved, mirror the same values into the matching CLIENT_ID
 * row in the central USER_SECURITY_MASTER_DB/CLIENT_MASTER control sheet.
 * Only columns that actually exist are written; no guessed column is created. */
function bnxSyncClientMaster_(clientId, data) {
  if (!clientId) return { saved: false, error: 'clientId required' };
  try {
    const ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    const sheet = ss.getSheetByName('CLIENT_MASTER') || ss.getSheetByName('USER_SECURITY_MASTER_DB') || ss.getSheets()[0];
    if (!sheet) return { saved: false, error: 'CLIENT_MASTER sheet not found in central control database' };
    const values = sheet.getDataRange().getValues();
    if (!values.length) return { saved: false, error: 'CLIENT_MASTER has no header row' };
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    if (ciCol === -1) return { saved: false, error: 'CLIENT_MASTER is missing CLIENT_ID column' };

    const map = {
      COMPANY_NAME: data.name != null ? data.name : data.companyName,
      GST_NUMBER: data.gst,
      GST_NO: data.gst,
      GSTIN: data.gst,
      ADDRESS: data.address,
      PHONE: data.phone,
      MOBILE_NO: data.phone,
      EMAIL: data.email,
      FSSAI: data.fssai,
      FSSAI_NO: data.fssai,
      DEFAULT_CURRENCY: data.currency,
      CURRENCY: data.currency,
      LOGO_URL: data.logoUrl,
      PAN: data.pan,
      COMPANY_TYPE: data.companyType,
      CONTACT_NAME: data.contactName,
      CITY: data.city,
      STATE: data.state,
      LATITUDE: data.latitude != null ? data.latitude : data.lat,
      LONGITUDE: data.longitude != null ? data.longitude : (data.lng != null ? data.lng : data.lon),
      UPDATED_AT: new Date().toISOString()
    };

    let targetRow = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][ciCol]) === String(clientId)) { targetRow = r; break; }
    }
    if (targetRow === -1) {
      const rowObj = { CLIENT_ID: clientId };
      Object.keys(map).forEach(h => { if (map[h] !== undefined && map[h] !== null) rowObj[h] = map[h]; });
      const row = headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
      sheet.appendRow(row);
      return { saved: true, created: true, sheet: sheet.getName() };
    }

    const rowValues = values[targetRow].slice();
    let changed = false;
    headers.forEach((h, c) => {
      if (map[h] !== undefined && map[h] !== null) {
        rowValues[c] = map[h];
        changed = true;
      }
    });
    if (changed) sheet.getRange(targetRow + 1, 1, 1, headers.length).setValues([rowValues]);
    return { saved: true, updated: changed, sheet: sheet.getName() };
  } catch (error) {
    console.warn('[bnxSyncClientMaster_] ' + error.message);
    return { saved: false, error: error.message };
  }
}

function bnxBuildClientMapsUrl_(master){
  master=master||{};
  const lat=master.latitude||master.lat||'';
  const lng=master.longitude||master.lng||master.lon||'';
  if(lat!=='' && lng!=='') return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(String(lat)+','+String(lng));
  const q=[master.address||'',master.city||'',master.state||''].filter(Boolean).join(', ');
  return q ? 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q) : '';
}

function bnxGetClientInfo(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const master = bnxLookupClientMaster_(clientId);
    // If central Client Master has no usable address/coordinates, resolve the
    // logged-in client's first real LOCATION_MASTER row before building Maps.
    // This prevents a blank Maps button for multi-branch clients whose address
    // is maintained at branch level rather than company level.
    let locationMaster = null;
    try {
      const locSheet = bnxClientSheet(clientId, 'LOCATION_MASTER');
      const locValues = locSheet.getDataRange().getValues();
      const locHeaders = locValues[0] || [];
      for (let r = 1; r < locValues.length; r++) {
        const lo = bnxRowToObject(locValues[r], locHeaders);
        if (lo.CLIENT_ID && String(lo.CLIENT_ID) !== String(clientId)) continue;
        if (String(lo.IS_ACTIVE || lo.ACTIVE || 'true').toLowerCase() === 'false') continue;
        locationMaster = lo;
        break;
      }
    } catch (e) { /* LOCATION_MASTER is optional for single-address clients */ }
    const sheet = bnxClientSheet(clientId, SHEETS.CONFIG);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    let firstRow = null;
    let firstRowIndex = -1;
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      if (!firstRow) { firstRow = row; firstRowIndex = r; }
    }
    const row = firstRow;
    const local = row || {};

    // CENTRAL CLIENT_MASTER is authoritative for invoice identity. If a value
    // exists there, it wins over stale COMPANY_SETTINGS/local browser data.
    const merged = {
      settingId: local.SETTING_ID || '',
      companyName: master ? master.companyName : (local.COMPANY_NAME || ''),
      restaurantName: master ? master.companyName : (local.COMPANY_NAME || ''),
      name: master ? master.companyName : (local.COMPANY_NAME || ''),
      CLIENT_NAME: master ? master.companyName : (local.COMPANY_NAME || ''),
      gst: master ? master.gst : (local.GST_NUMBER || ''),
      pan: master ? master.pan : '', companyType: master ? master.companyType : '',
      contactName: master ? master.contactName : '',
      phone: master && master.phone ? master.phone : (local.PHONE || ''),
      email: master && master.email ? master.email : (local.EMAIL || ''),
      address: master && master.address ? master.address : (local.ADDRESS || locationMaster && (locationMaster.ADDRESS || locationMaster.ADDRESS_LINE1 || '') || ''),
      city: master && master.city ? master.city : (local.CITY || (locationMaster && (locationMaster.CITY || locationMaster.LOCATION_CITY || '')) || ''),
      state: master && master.state ? master.state : (local.STATE || (locationMaster && (locationMaster.STATE || locationMaster.LOCATION_STATE || '')) || ''),
      fssai: master && master.fssai ? master.fssai : (local.FSSAI || ''),
      currency: master && master.currency ? master.currency : (local.DEFAULT_CURRENCY || ''),
      logoUrl: master && master.logoUrl ? master.logoUrl : (local.LOGO_URL || ''),
      latitude: master && master.latitude ? master.latitude : (local.LATITUDE || local.LAT || (locationMaster && (locationMaster.LATITUDE || locationMaster.LAT || locationMaster.MAP_LAT)) || ''),
      longitude: master && master.longitude ? master.longitude : (local.LONGITUDE || local.LNG || local.LON || (locationMaster && (locationMaster.LONGITUDE || locationMaster.LNG || locationMaster.LON || locationMaster.MAP_LNG)) || ''),
      mapsUrl: bnxBuildClientMapsUrl_(master || { address: local.ADDRESS || (locationMaster && (locationMaster.ADDRESS || locationMaster.ADDRESS_LINE1 || '')) || '', city: local.CITY || (locationMaster && (locationMaster.CITY || locationMaster.LOCATION_CITY || '')) || '', state: local.STATE || (locationMaster && (locationMaster.STATE || locationMaster.LOCATION_STATE || '')) || '', latitude: local.LATITUDE || local.LAT || (locationMaster && (locationMaster.LATITUDE || locationMaster.LAT || locationMaster.MAP_LAT)) || '', longitude: local.LONGITUDE || local.LNG || local.LON || (locationMaster && (locationMaster.LONGITUDE || locationMaster.LNG || locationMaster.LON || locationMaster.MAP_LNG)) || '' }),
      tagline: local.TAGLINE || '',
      source: master ? 'CLIENT_MASTER' : 'COMPANY_SETTINGS'
    };

    // Keep the client's own COMPANY_SETTINGS in sync with the central master,
    // including address/phone/email/FSSAI/currency/logo, whenever those columns exist.
    if (master) {
      try {
        const sync = {
          COMPANY_NAME: master.companyName, GST_NUMBER: master.gst,
          ADDRESS: master.address, PHONE: master.phone, EMAIL: master.email,
          FSSAI: master.fssai, DEFAULT_CURRENCY: master.currency, LOGO_URL: master.logoUrl,
          LATITUDE: master.latitude, LONGITUDE: master.longitude
        };
        if (row && firstRowIndex !== -1) {
          headers.forEach((h, c) => {
            if (sync[h] !== undefined && sync[h] !== null) sheet.getRange(firstRowIndex + 1, c + 1).setValue(sync[h]);
          });
          if (headers.indexOf('UPDATED_AT') !== -1) sheet.getRange(firstRowIndex + 1, headers.indexOf('UPDATED_AT') + 1).setValue(new Date().toISOString());
        } else {
          bnxAppendRow(clientId, SHEETS.CONFIG, {
            SETTING_ID: generateShortId_(clientId, 'SETTING_ID'), CLIENT_ID: clientId,
            COMPANY_NAME: master.companyName, GST_NUMBER: master.gst, ADDRESS: master.address,
            PHONE: master.phone, EMAIL: master.email, FSSAI: master.fssai,
            DEFAULT_CURRENCY: master.currency, LOGO_URL: master.logoUrl, LATITUDE: master.latitude, LONGITUDE: master.longitude, UPDATED_AT: new Date().toISOString()
          });
        }
      } catch (syncErr) { console.warn('[bnxGetClientInfo master→client sync] ' + syncErr.message); }
    }
    return { success: true, data: merged };
  } catch (error) {
    bnxLogError(clientId, `bnxGetClientInfo failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetOrCreateDriveFolder_(name, parentFolder) {
  const iter = parentFolder ? parentFolder.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parentFolder ? parentFolder.createFolder(name) : DriveApp.createFolder(name);
}

function bnxUploadLogo(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const rawBase64 = payload.imageBase64 || payload.image || '';
  const mimeType = (payload.mimeType || 'image/png').trim();
  if (!rawBase64) return { success: false, error: 'imageBase64 required' };
  const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
  const approxBytes = Math.floor(cleanBase64.length * 0.75);
  if (approxBytes > 2 * 1024 * 1024) {
    return { success: false, error: 'Logo too large (max 2MB) -- please compress the image and try again.' };
  }
  try {
    const bytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(bytes, mimeType, clientId + '_logo');
    const root = bnxGetOrCreateDriveFolder_('BNX_LOGOS');
    const clientFolder = bnxGetOrCreateDriveFolder_(clientId, root);
    const existingFiles = clientFolder.getFiles();
    while (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); }
    const file = clientFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const logoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();

    const sheet = bnxClientSheet(clientId, SHEETS.CONFIG);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const logoCol = headers.indexOf('LOGO_URL');
    if (logoCol === -1) {
      return { success: false, error: 'COMPANY_SETTINGS has no LOGO_URL column yet -- add it to store this permanently. The image itself uploaded fine: ' + logoUrl, logoUrl: logoUrl };
    }
    const ciCol = headers.indexOf('CLIENT_ID');
    const updatedCol = headers.indexOf('UPDATED_AT');
    let targetRow = -1;
    for (let r = 1; r < values.length; r++) {
      if (ciCol === -1 || values[r][ciCol] === clientId) { targetRow = r; break; }
    }
    if (targetRow !== -1) {
      sheet.getRange(targetRow + 1, logoCol + 1).setValue(logoUrl);
      if (updatedCol !== -1) sheet.getRange(targetRow + 1, updatedCol + 1).setValue(new Date().toISOString());
    } else {
      bnxAppendRow(clientId, SHEETS.CONFIG, {
        SETTING_ID: generateShortId_(clientId, 'SETTING_ID'), CLIENT_ID: clientId,
        LOGO_URL: logoUrl, UPDATED_AT: new Date().toISOString()
      });
    }
    const cmLogo = bnxSyncClientMaster_(clientId, { logoUrl: logoUrl });
    if (!cmLogo.saved) console.warn('[bnxUploadLogo] central CLIENT_MASTER sync failed: ' + (cmLogo.error || 'unknown'));
    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, USER_ID: userId, ACTION: 'UPDATE', MODULE: 'SETTINGS',
      RECORD_TYPE: 'LOGO', RECORD_ID: clientId, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify({ logoUrl }), TIMESTAMP: new Date().toISOString()
    });
    return { success: true, logoUrl: logoUrl };
  } catch (error) {
    bnxLogError(clientId, `bnxUploadLogo failed: ${error.message}`, { mimeType });
    return { success: false, error: error.message };
  }
}

function bnxCategoryNameMap_(clientId) {
  const byId = {}; const idByName = {};
  const loadSheet = function(sheetName) {
    try {
      const sheet = bnxClientSheet(clientId, sheetName);
      const values = sheet.getDataRange().getValues();
      if (!values.length) return;
      const headers = values[0];
      for (let r = 1; r < values.length; r++) {
        const row = bnxRowToObject(values[r], headers);
        if (row.CLIENT_ID && String(row.CLIENT_ID) !== String(clientId)) continue;
        const id = row.CATEGORY_ID || row.ID || row.MENU_ITEM_CATEGORY_ID || '';
        const name = row.CATEGORY_NAME || row.NAME || row.MENU_ITEM_CATEGORY_NAME || row.CATEGORY || '';
        if (!id || !name) continue;
        const active = row.IS_ACTIVE;
        if (active === false || String(active).toLowerCase() === 'false') continue;
        const clean = String(name).trim();
        if (!clean) continue;
        byId[String(id).trim()] = clean;
        idByName[clean.toLowerCase()] = String(id).trim();
      }
    } catch (e) { console.warn('[bnxCategoryNameMap_] '+sheetName+': '+e.message); }
  };
  // CATEGORY_MASTER is authoritative. MENU_ITEM_CATEGORY_LIST is a legacy
  // compatibility source used only to fill gaps in older client templates.
  loadSheet(SHEETS.CATEGORY_MASTER);
  try {
    if (Object.keys(byId).length === 0 && BNX_SHEET_DB_MAP_.MENU_ITEM_CATEGORY_LIST) loadSheet('MENU_ITEM_CATEGORY_LIST');
  } catch (e) {}
  return { byId, idByName };
}

function bnxCachedItemGroupMap_(clientId) {
  const key = 'itemgroupmap_' + clientId;
  try { const cached = CacheService.getScriptCache().get(key); if (cached) return JSON.parse(cached); } catch (e) {}
  const byId = {}; const idByName = {};
  try {
    const sheet = bnxClientSheet(clientId, 'ITEM_GROUP_MASTER');
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    for (let r=1;r<values.length;r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && String(row.CLIENT_ID)!==String(clientId)) continue;
      const active=row.IS_ACTIVE;
      if (active===false || String(active).toLowerCase()==='false') continue;
      const id=String(row.ITEM_GROUP_ID||row.GROUP_ID||row.ID||'').trim();
      const name=String(row.ITEM_GROUP_NAME||row.GROUP_NAME||row.NAME||row.ITEM_GROUP||'').trim();
      if(!id||!name) continue;
      byId[id]=name; idByName[name.toLowerCase()]=id;
    }
  } catch(e) { console.warn('[bnxCachedItemGroupMap_] '+e.message); }
  const out={byId,idByName};
  try{CacheService.getScriptCache().put(key,JSON.stringify(out),60);}catch(e){}
  return out;
}

function bnxResolveCategoryId_(clientId, categoryName, catMap) {
  const name = String(categoryName || '').trim();
  if (!name) return '';
  const key = name.toLowerCase();
  if (catMap.idByName[key]) return catMap.idByName[key];
  const newId = generateShortId_(clientId, 'CATEGORY_ID');
  bnxAppendRow(clientId, SHEETS.CATEGORY_MASTER, { CATEGORY_ID: newId, CLIENT_ID: clientId, CATEGORY_NAME: name, CREATED_AT: new Date().toISOString() });
  bnxInvalidateMasterCache_(clientId);
  catMap.idByName[key] = newId; catMap.byId[newId] = name;
  return newId;
}

function bnxResolveUnitId_(clientId, unitName, unitMap) {
  const name = String(unitName || '').trim();
  if (!name) return '';
  const key = name.toLowerCase();
  if (unitMap.idByName[key]) return unitMap.idByName[key];
  const newId = generateShortId_(clientId, 'UNIT_ID');
  bnxAppendRow(clientId, SHEETS.UNIT_MASTER, { UNIT_ID: newId, CLIENT_ID: clientId, UNIT_NAME: name, ABBREVIATION: name.slice(0, 3).toUpperCase(), CONVERSION_FACTOR: 1, CREATED_AT: new Date().toISOString() });
  bnxInvalidateMasterCache_(clientId);
  unitMap.idByName[key] = newId; unitMap.byId[newId] = name;
  return newId;
}
function bnxUnitNameMap_(clientId) {
  const byId = {}; const idByName = {};
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.UNIT_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      if (!row.UNIT_ID || !row.UNIT_NAME) continue;
      byId[row.UNIT_ID] = row.UNIT_NAME; idByName[String(row.UNIT_NAME).toLowerCase()] = row.UNIT_ID;
    }
  } catch (error) { console.warn('[bnxUnitNameMap_] ' + error.message); }
  return { byId, idByName };
}

function bnxResolveTaxId_(clientId, ratePercent, taxMap) {
  const rate = Number(ratePercent) || 0;
  const rateFraction = rate > 1 ? rate / 100 : rate;
  const key = rateFraction.toFixed(4);
  if (taxMap.idByRate[key]) return taxMap.idByRate[key];
  const newId = generateShortId_(clientId, 'TAX_ID');
  bnxAppendRow(clientId, SHEETS.TAX_MASTER, { TAX_ID: newId, CLIENT_ID: clientId, TAX_NAME: 'GST ' + (rateFraction * 100) + '% (auto-created on import -- verify)', TAX_RATE: rateFraction, TAX_TYPE: 'GST', IS_ACTIVE: true, CREATED_AT: new Date().toISOString() });
  bnxInvalidateMasterCache_(clientId);
  taxMap.idByRate[key] = newId; taxMap.rateById[newId] = rateFraction;
  return newId;
}
function bnxTaxRateMap_(clientId) {
  const rateById = {}; const idByRate = {};
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.TAX_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      if (!row.TAX_ID) continue;
      const rate = Number(row.TAX_RATE) || 0;
      rateById[row.TAX_ID] = rate; idByRate[rate.toFixed(4)] = row.TAX_ID;
    }
  } catch (error) { console.warn('[bnxTaxRateMap_] ' + error.message); }
  return { rateById, idByRate };
}

/**
 * FAST POS MENU ENDPOINT — one request for Food + Bar.
 * Published Menu Card sheets remain authoritative.
 */

function bnxGetPosMenuHierarchy(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const food = bnxGetMenuItems(session, payload || {});
    const bar = bnxGetBarMenu(session, payload || {});
    const f = food && Array.isArray(food.data) ? food.data : [];
    const b = bar && Array.isArray(bar.data) ? bar.data : [];
    const cats = rows => [...new Set(rows.map(r => String(r.category || r.barCategory || r.menuSection || 'Uncategorised').trim()).filter(Boolean))].sort();
    return { success:true, clientId, data:{food:{categories:cats(f),count:f.length},bar:{categories:cats(b),count:b.length}}, source:'MENU_CARD_ITEMS+BAR_MENU_CARD' };
  } catch (e) {
    bnxLogError(clientId, `bnxGetPosMenuHierarchy failed: ${e.message}`, payload);
    return { success:false, error:e.message, data:{food:{categories:[],count:0},bar:{categories:[],count:0}} };
  }
}

function bnxGetPosMenu(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const cacheKey = 'posmenu_v2_' + clientId;
    try {
      const raw = CacheService.getScriptCache().get(cacheKey);
      if (raw) return Object.assign({}, JSON.parse(raw), { cached: true });
    } catch (e) {}
    const foodRes = bnxGetMenuItems(session, payload || {});
    const barRes = bnxGetBarMenu(session, payload || {});
    const bar = barRes && Array.isArray(barRes.data) ? barRes.data : [];
    const barKeys = new Set(bar.flatMap(r=>[r.id,r.itemId,r.ITEM_ID,r.itemCode,r.ITEM_CODE,r.name,r.ITEM_NAME].map(v=>String(v??'').trim().toUpperCase())).filter(Boolean));
    const food = (foodRes && Array.isArray(foodRes.data) ? foodRes.data : []).filter(r=>{
      const raw=String(r.isBar??r.IS_BAR??r.BAR_ITEM??'').trim().toLowerCase();
      if(['true','1','yes','y'].includes(raw)) return false;
      const ids=[r.id,r.ITEM_ID,r.itemId,r.itemCode,r.ITEM_CODE].map(v=>String(v??'').trim().toUpperCase()).filter(Boolean);
      const name=String(r.name??r.ITEM_NAME??r.MENU_ITEM_NAME??'').trim().toUpperCase();
      return !ids.some(v=>barKeys.has(v)) && !barKeys.has(name);
    });
    const result = {
      success: !!(foodRes && foodRes.success) || !!(barRes && barRes.success),
      data: { food, bar },
      available: { food: !!(foodRes && foodRes.success), bar: !!(barRes && barRes.success) },
      counts: { food: food.length, bar: bar.length, total: food.length + bar.length },
      errors: { food: foodRes && foodRes.success ? '' : String(foodRes && foodRes.error || ''), bar: barRes && barRes.success ? '' : String(barRes && barRes.error || '') },
      source: 'MENU_CARD_ITEMS+BAR_MENU_CARD'
    };
    try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 5); } catch (e) {}
    return result;
  } catch (error) {
    bnxLogError(clientId, `bnxGetPosMenu failed: ${error.message}`, payload);
    return { success:false, data:{food:[],bar:[]}, available:{food:false,bar:false}, counts:{food:0,bar:0,total:0}, error:error.message };
  }
}

function bnxGetMenuItems(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const cardSheet = bnxClientSheet(clientId, SHEETS.MENU_CARD_ITEMS);
    const cardValues = cardSheet.getDataRange().getValues();
    const cardHeaders = cardValues[0] || [];
    const itemSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0] || [];
    // BAR_ITEM_MASTER is an authoritative positive BAR identity source, while
    // ITEM_MASTER.IS_BAR covers legacy/bar items that have not yet been copied
    // into BAR_ITEM_MASTER (e.g. old liquor items still present in Food cards).
    const barSheet = bnxClientSheet(clientId, SHEETS.BAR_ITEM_MASTER);
    const barValues = barSheet.getDataRange().getValues();
    const barHeaders = barValues[0] || [];
    const itemById = {}, itemByName = {}, barIds = new Set();
    for (let r=1; r<itemValues.length; r++) {
      const o=bnxRowToObject(itemValues[r],itemHeaders);
      if(o.CLIENT_ID && String(o.CLIENT_ID)!==String(clientId)) continue;
      const id=String(o.ITEM_ID||'').trim(), name=String(o.ITEM_NAME||'').trim().toLowerCase();
      if(id) itemById[id]=o; if(name && !itemByName[name]) itemByName[name]=o;
    }
    for (let r=1; r<barValues.length; r++) {
      const o=bnxRowToObject(barValues[r],barHeaders);
      if(o.CLIENT_ID && String(o.CLIENT_ID)!==String(clientId)) continue;
      ['ITEM_ID','ITEM_CODE'].forEach(k=>{ const v=String(o[k]||'').trim().toUpperCase(); if(v) barIds.add(v); });
    }
    const catMap=bnxCachedCategoryNameMap_(clientId), groupMap=bnxCachedItemGroupMap_(clientId), taxMap=bnxCachedTaxRateMap_(clientId);
    const boolValue=v=>v===true || ['true','1','yes','y'].includes(String(v??'').trim().toLowerCase());
    const items=[];
    for(let r=1;r<cardValues.length;r++){
      const card=bnxRowToObject(cardValues[r],cardHeaders);
      if(card.CLIENT_ID && String(card.CLIENT_ID)!==String(clientId)) continue;
      const cardId=String(card.ITEM_ID||'').trim(), cardName=String(card.MENU_ITEM_NAME||card.ITEM_NAME||card.NAME||'').trim();
      if(!cardId&&!cardName) continue;
      const master=itemById[cardId]||itemByName[cardName.toLowerCase()]||{};
      // MENU_CARD_ITEMS is authoritative for published POS membership.
      // ITEM_MASTER.IS_ACTIVE is enrichment only and must not hide a published card row.
      const categoryId=String(card.CATEGORY_ID||master.CATEGORY_ID||'').trim();
      const categoryName=String(card.MENU_SECTION||card.CATEGORY_NAME||catMap.byId[categoryId]||master.CATEGORY_NAME||master.CATEGORY||'Food').trim()||'Food';
      const groupId=String(card.ITEM_GROUP_ID||master.ITEM_GROUP_ID||master.GROUP_ID||'').trim();
      const groupName=String(card.ITEM_GROUP_NAME||master.ITEM_GROUP_NAME||groupMap.byId[groupId]||'').trim();
      const menuType=String(card.MENU_TYPE||master.MENU_TYPE||'RESTAURANT').trim();
      const identityIds=[cardId,card.ITEM_CODE,master.ITEM_ID,master.ITEM_CODE].map(v=>String(v||'').trim().toUpperCase()).filter(Boolean);
      const identityText=[cardName,categoryName,groupName,menuType].join(' ').toLowerCase();
      const isBarIdentity = boolValue(card.IS_BAR) || boolValue(master.IS_BAR) ||
        identityIds.some(v=>barIds.has(v)) || /\b(bar|liquor|tobacco|alcohol|spirits|scotch|vodka|whisky|whiskey|rum|gin|tequila|brandy|cognac|beer|wine|cocktail|champagne|liqueur)\b/.test(identityText) ||
        /^(GRP00003|GRP00004)$/i.test(groupId);
      // A row can physically exist in MENU_CARD_ITEMS but still be a BAR item
      // because old imports used the restaurant card as a staging list. Never
      // expose such an item in Food POS.
      if(isBarIdentity) continue;
      const veg=String(card.VEG_TYPE||master.IS_VEG||master.DIETARY_TYPE||'').trim();
      const price=card.PRICE!==''&&card.PRICE!=null?Number(card.PRICE):Number(master.SELLING_RATE)||0;
      const taxId=String(card.TAX_ID||master.TAX_ID||'').trim();
      items.push({id:cardId||master.ITEM_ID||'',name:cardName||master.ITEM_NAME||'',price:Number.isFinite(price)?price:0,
        category:categoryName,categoryId,categoryName,itemGroupId:groupId,itemGroupName:groupName,ITEM_GROUP_ID:groupId,ITEM_GROUP_NAME:groupName,
        itemCode:card.ITEM_CODE||master.ITEM_CODE||cardId||master.ITEM_ID||'',code:cardId||master.ITEM_ID||master.ITEM_CODE||'',
        gst:taxId?(taxMap.rateById[taxId]||0):Number(master.GST_RATE||master.TAX_RATE||0),icon:master.ICON||'',hsn:card.HSN_CODE||master.HSN_CODE||'',veg,dietaryType:veg,
        avail:card.AVAILABILITY_STATUS||'available',printTo:master.PRINT_TO||master.PRINT_STATION||'',favorite:card.FAVOURITE!==undefined&&card.FAVOURITE!==''?boolValue(card.FAVOURITE):boolValue(master.FAVOURITE),
        popular:card.POPULAR!==undefined&&card.POPULAR!==''?boolValue(card.POPULAR):boolValue(master.POPULAR),isBar:false,menuType:'RESTAURANT',menuSection:card.MENU_SECTION||categoryName,
        menuActive:true,sortOrder:Number(card.MENU_SORT_ORDER||master.MENU_SORT_ORDER||r)||r,menuCardKey:'FOOD|'+r+'|'+(cardId||cardName)});
    }
    return {success:true,data:items,source:'MENU_CARD_ITEMS',count:items.length};
  } catch(error){bnxLogError(clientId,`bnxGetMenuItems(MENU_CARD_ITEMS) failed: ${error.message}`,payload);return {success:false,error:error.message,data:[],source:'MENU_CARD_ITEMS'};}
}
/** LIVE BAR MENU IDENTITY — BAR_ITEM_MASTER is authoritative. */
function bnxGetBarMenu(session, payload) {
  const clientId=session.CLIENT_ID;
  try{
    const cardSheet=bnxClientSheet(clientId,SHEETS.BAR_MENU_CARD), cardValues=cardSheet.getDataRange().getValues(), cardHeaders=cardValues[0]||[];
    const barSheet=bnxClientSheet(clientId,SHEETS.BAR_ITEM_MASTER), barValues=barSheet.getDataRange().getValues(), barHeaders=barValues[0]||[];
    const itemSheet=bnxClientSheet(clientId,SHEETS.ITEM_MASTER), itemValues=itemSheet.getDataRange().getValues(), itemHeaders=itemValues[0]||[];
    const barById={},itemById={};
    for(let r=1;r<barValues.length;r++){const o=bnxRowToObject(barValues[r],barHeaders),id=String(o.ITEM_ID||'').trim();if(id)barById[id]=o;}
    for(let r=1;r<itemValues.length;r++){const o=bnxRowToObject(itemValues[r],itemHeaders);if(o.CLIENT_ID&&String(o.CLIENT_ID)!==String(clientId))continue;const id=String(o.ITEM_ID||'').trim();if(id)itemById[id]=o;}
    const taxMap=bnxCachedTaxRateMap_(clientId), boolValue=v=>v===true||['true','1','yes','y'].includes(String(v??'').trim().toLowerCase());
    const rows=[],ids=[];
    for(let r=1;r<cardValues.length;r++){
      const card=bnxRowToObject(cardValues[r],cardHeaders);if(card.CLIENT_ID&&String(card.CLIENT_ID)!==String(clientId))continue;
      const id=String(card.ITEM_ID||'').trim(),bar=barById[id]||{},master=itemById[id]||{},name=String(card.ITEM_NAME||bar.ITEM_NAME||master.ITEM_NAME||'').trim();if(!id||!name)continue;
      const price=card.SERVING_PRICE!==''&&card.SERVING_PRICE!=null?Number(card.SERVING_PRICE):(Number(bar.SELLING_PRICE)||Number(master.SELLING_RATE)||0);
      const taxId=String(card.TAX_ID||bar.TAX_ID||master.TAX_ID||'').trim();
      const fav=card.FAVOURITE!==undefined&&card.FAVOURITE!==''?boolValue(card.FAVOURITE):boolValue(bar.FAVOURITE??master.FAVOURITE),pop=card.POPULAR!==undefined&&card.POPULAR!==''?boolValue(card.POPULAR):boolValue(bar.POPULAR??master.POPULAR);
      const section=String(card.MENU_SECTION||card.CATEGORY_NAME||card.BAR_CATEGORY||'BAR').trim()||'BAR',category=String(card.CATEGORY_NAME||card.BAR_CATEGORY||section).trim()||section;
      rows.push({itemId:id,id,ITEM_ID:id,name,ITEM_NAME:name,itemCode:card.ITEM_CODE||bar.ITEM_CODE||master.ITEM_CODE||id,price:Number.isFinite(price)?price:0,sellingPrice:Number.isFinite(price)?price:0,
        category,barCategory:category,categoryId:String(card.CATEGORY_ID||master.CATEGORY_ID||'').trim(),menuType:card.MENU_TYPE||'BAR',menuSection:section,menuActive:true,isBar:true,veg:'',dietaryType:'',gst:taxId?(taxMap.rateById[taxId]||0):0,hsn:master.HSN_CODE||'',icon:master.ICON||'🍸',availability:card.AVAILABILITY_STATUS||'available',favorite:fav,popular:pop,aliases:[],menuCardKey:'BAR|'+r+'|'+id+'|'+section+'|'+String(price)});ids.push(id);
    }
    return {success:true,data:rows,ids,source:'BAR_MENU_CARD',count:rows.length};
  }catch(error){bnxLogError(clientId,`bnxGetBarMenu(BAR_MENU_CARD) failed: ${error.message}`,payload);return {success:false,error:error.message,data:[],ids:[],source:'BAR_MENU_CARD'};}
}

/* FIX ("ALL LIVE DATA NO DEMO DATA" -- confirmed root cause): this
   used to return a hardcoded ['CASH','CARD','UPI'] array no matter
   which client asked -- the one genuinely fake/static payload left in
   the whole backend. PAYMENT_MODE_MASTER was already routed to the
   per-client MASTER DB in BNX_SHEET_DB_MAP_ and already had its own
   ENTITY_ID_PREFIXES entry (PMD) for real IDs, but nothing anywhere in
   this file had ever actually read or written it -- it was a
   completely orphaned table. Now reads the real sheet. Column names
   for this table were never established anywhere else in the code (no
   prior read/write to infer them from, unlike ITEM_NAME/SELLING_RATE
   etc. which are used in a dozen places), so this deliberately does
   NOT guess a single fixed header -- it checks a small set of the
   header names this schema's naming convention would plausibly use
   (MODE_NAME/PAYMENT_MODE_NAME/NAME for the label, MODE_CODE/
   PAYMENT_MODE_CODE/PAYMENT_MODE for the code) and returns the real
   row content precisely as stored, active rows only. If a client has
   no PAYMENT_MODE_MASTER rows yet, this returns Cash/Card/UPI as
   starter defaults -- clearly marked isDefault:true so the frontend
   (and anyone reading this response) can tell "nothing configured
   yet, here are sane starting options" apart from real saved data --
   never silently presented as if they were the client's own real
   configured modes. */
function bnxGetPaymentModes(session, payload) {
  const clientId = session.CLIENT_ID;
  const STARTER_DEFAULTS = [
    { id: 'CASH', name: 'Cash', isDefault: true },
    { id: 'CARD', name: 'Card', isDefault: true },
    { id: 'UPI', name: 'UPI', isDefault: true }
  ];
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MODE_MASTER || 'PAYMENT_MODE_MASTER');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { success: true, data: STARTER_DEFAULTS, source: 'defaults', note: 'PAYMENT_MODE_MASTER has no rows yet for this client -- showing starter defaults, not saved configuration.' };
    const headers = values[0];
    const idCol = headers.indexOf('PAYMENT_MODE_ID');
    const ciCol = headers.indexOf('CLIENT_ID');
    const activeCol = headers.indexOf('IS_ACTIVE');
    const modes = [];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (ciCol !== -1 && row.CLIENT_ID !== clientId) continue;
      if (activeCol !== -1 && (row.IS_ACTIVE === false || row.IS_ACTIVE === 'false' || row.IS_ACTIVE === 'FALSE')) continue;
      const name = row.MODE_NAME || row.PAYMENT_MODE_NAME || row.NAME || row.PAYMENT_MODE || '';
      if (!name) continue;
      const id = row.PAYMENT_MODE_ID || row.MODE_CODE || row.PAYMENT_MODE_CODE || String(name).toUpperCase().replace(/\s+/g, '_');
      modes.push({ id, name, code: row.MODE_CODE || row.PAYMENT_MODE_CODE || '', isCash: /cash/i.test(name) });
    }
    if (!modes.length) return { success: true, data: STARTER_DEFAULTS, source: 'defaults', note: 'PAYMENT_MODE_MASTER exists but has no active rows for this client yet -- showing starter defaults, not saved configuration.' };
    return { success: true, data: modes, source: 'PAYMENT_MODE_MASTER' };
  } catch (error) {
    bnxLogError(clientId, `bnxGetPaymentModes failed: ${error.message}`, payload);
    return { success: true, data: STARTER_DEFAULTS, source: 'defaults', note: 'Could not read PAYMENT_MODE_MASTER (' + error.message + ') -- showing starter defaults, not saved configuration.' };
  }
}

function bnxGetTaxConfig(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const sheet = bnxClientSheet(clientId, 'TAX_MASTER');
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      rows.push(row);
    }
    return { success: true, data: rows };
  } catch (error) { return { success: false, error: error.message, data: [] }; }
}

/**
 * PASS #65 v2 ("LIST_BILLS payment mode always blank" + split-payment
 * breakdown, matching the CASH/CARD/UPI/OTHER column shape already used
 * by SALES_DAY_BOOK / bnxGetSalesDayBookReport). Each bill now also
 * carries a real payBreakdown object -- { CASH, CARD, UPI, OTHER } --
 * summing every non-refunded PAYMENT_MASTER row for that bill, plus
 * isSplitPayment. `pay` (dominant mode by amount) is kept unchanged for
 * backward compatibility with anything already reading it.
 */
function bnxListBills(session, payload) {
  const clientId = session.CLIENT_ID;
  let fromDate = payload.FROM_DATE || payload.from || '';
  let toDate = payload.TO_DATE || payload.to || '';
  const wantsAll = fromDate === 'ALL' || toDate === 'ALL';
  if (!wantsAll && !fromDate && !toDate) {
    // High-volume safety: 3,000 invoices/day means the old 60-day default
    // could force LIST_BILLS to assemble ~180,000 bills + their item/payment
    // joins just to open Bills List. Everyday/default access is Today; older
    // history is still available when the caller supplies an explicit range.
    fromDate = bnxBusinessDateKey_();
    toDate = fromDate;
  }
  if (wantsAll) { fromDate = ''; toDate = ''; }
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billHeaderRow = billSheet.getRange(1,1,1,billSheet.getLastColumn()).getValues()[0].map(String);
    const singleBusinessDay = !!fromDate && !!toDate && fromDate===toDate && fromDate===bnxBusinessDateKey_();
    // At ~3,000 bills/day, Today should not transfer the entire lifetime
    // BILL_MASTER into Apps Script. BILL_MASTER is append-only in this POS,
    // so a generous 5,000-row tail covers the stated daily volume while
    // preserving the exact explicit-range path for older/history reports.
    const billValues = singleBusinessDay
      ? [billHeaderRow].concat(bnxRecentDataWindow_(billSheet,billHeaderRow,5000))
      : billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const inRangeBillIds = {};
    const billsInRange = [];
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const billDateKey = bnxNormalizeDateKey_(b.BILL_DATE);
      if (fromDate && billDateKey < fromDate) continue;
      if (toDate && billDateKey > toDate) continue;
      inRangeBillIds[b.BILL_ID] = true;
      billsInRange.push(b);
    }

    const itemSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const itemHeaderRow = itemSheet.getRange(1,1,1,itemSheet.getLastColumn()).getValues()[0].map(String);
    // Today: scan a bounded tail sized for a busy 3,000-bill day with
    // multiple line items. History/custom ranges retain full correctness.
    const itemValues = singleBusinessDay
      ? [itemHeaderRow].concat(bnxRecentDataWindow_(itemSheet,itemHeaderRow,100000))
      : itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0];
    const itemsByBillId = {};
    for (let r = 1; r < itemValues.length; r++) {
      const it = bnxRowToObject(itemValues[r], itemHeaders);
      if (!inRangeBillIds[it.BILL_ID]) continue;
      if (!itemsByBillId[it.BILL_ID]) itemsByBillId[it.BILL_ID] = [];
      itemsByBillId[it.BILL_ID].push({ name: it.ITEM_NAME || '', qty: Number(it.QUANTITY) || 0, rate: Number(it.RATE) || 0, amt: Number(it.LINE_TOTAL) || 0 });
    }

    // Real per-bill payment breakdown, joined from PAYMENT_MASTER -- same
    // CASH/CARD/UPI/OTHER buckets SALES_DAY_BOOK already uses, plus a
    // dominant-mode `pay` kept for backward compat.
    const breakdownByBillId = {};   // { billId: {CASH,CARD,UPI,OTHER} }
    const dominantByBillId = {};    // { billId: {mode, amt} }
    try {
      const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
      const payHeaderRow = paySheet.getRange(1,1,1,paySheet.getLastColumn()).getValues()[0].map(String);
      const payValues = singleBusinessDay
        ? [payHeaderRow].concat(bnxRecentDataWindow_(paySheet,payHeaderRow,10000))
        : paySheet.getDataRange().getValues();
      const payHeaders = payValues[0];
      for (let r = 1; r < payValues.length; r++) {
        const p = bnxRowToObject(payValues[r], payHeaders);
        if (!inRangeBillIds[p.BILL_ID]) continue;
        const status = String(p.PAYMENT_STATUS || '').toUpperCase();
        if (status === 'REFUNDED' || status === 'REVERSED') continue;
        const amt = Number(p.AMOUNT) || 0;
        const rawMode = String(p.PAYMENT_MODE || '').toUpperCase();
        // Same bucketing SALES_DAY_BOOK uses: CASH / UPI / CARD, everything
        // else (BANK, WALLET, etc.) rolls into OTHER rather than a guessed
        // fourth column.
        const bucket = rawMode === 'CASH' ? 'CASH' : rawMode === 'UPI' ? 'UPI' : rawMode === 'CARD' ? 'CARD' : 'OTHER';
        if (!breakdownByBillId[p.BILL_ID]) breakdownByBillId[p.BILL_ID] = { CASH: 0, CARD: 0, UPI: 0, OTHER: 0 };
        breakdownByBillId[p.BILL_ID][bucket] += amt;

        const existing = dominantByBillId[p.BILL_ID];
        if (!existing || amt > existing.amt) dominantByBillId[p.BILL_ID] = { mode: p.PAYMENT_MODE || '', amt: amt };
      }
    } catch (e) {
      // PAYMENT_MASTER unreadable for this client -- both breakdown and
      // dominant mode fall back to blank/zero below, same as before this
      // patch. Never guess a payment mode or amount.
    }

    const bills = billsInRange.map(b => {
      const itemsDetail = itemsByBillId[b.BILL_ID] || [];
      const dominant = dominantByBillId[b.BILL_ID];
      const breakdown = breakdownByBillId[b.BILL_ID] || { CASH: 0, CARD: 0, UPI: 0, OTHER: 0 };
      return {
        no: b.BILL_NUMBER, dt: b.BILL_DATE, tm: b.BILL_TIME, table: b.TABLE_ID || '-',
        customer: b.CUSTOMER_NAME || 'GENERAL CUSTOMER', mob: (b.NOTES || '').replace('Customer mobile: ', '') || '',
        items: itemsDetail.length, itemsDetail, sub: Number(b.SUBTOTAL) || 0, gst: Number(b.TAX_AMOUNT) || 0,
        total: Number(b.GRAND_TOTAL) || 0,
        pay: dominant ? dominant.mode : '',
        payBreakdown: { CASH: +breakdown.CASH.toFixed(2), CARD: +breakdown.CARD.toFixed(2), UPI: +breakdown.UPI.toFixed(2), OTHER: +breakdown.OTHER.toFixed(2) },
        isSplitPayment: [breakdown.CASH, breakdown.CARD, breakdown.UPI, breakdown.OTHER].filter(v => v > 0).length > 1,
        status: b.PAYMENT_STATUS === 'PAID' ? 'Paid' : 'Pending', waiter: b.CREATED_BY || ''
      };
    });

    return {
      success: true, bills, data: bills, filteredRange: { from: fromDate || null, to: toDate || null },
      note: (!wantsAll && !payload.FROM_DATE && !payload.TO_DATE)
        ? 'Defaulted to the current business date for high-volume speed -- pass an explicit FROM_DATE/TO_DATE (or ALL) for older history.'
        : undefined
    };
  } catch (error) {
    bnxLogError(clientId, `bnxListBills failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSaveReservation(session, payload) {
  const clientId = session.CLIENT_ID;
  const tableId = payload.table || '';
  const date = payload.date || '';
  try {
    if (tableId && date) {
      const sheet = bnxClientSheet(clientId, SHEETS.RESERVATION_MASTER);
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      for (let r = 1; r < values.length; r++) {
        const res = bnxRowToObject(values[r], headers);
        if (res.CLIENT_ID !== clientId) continue;
        if (res.TABLE_ID !== tableId || res.RES_DATE !== date) continue;
        if (String(res.STATUS || '').toLowerCase() === 'cancelled') continue;
        if (payload.id && res.RESERVATION_ID === payload.id) continue;
        return { success: false, error: 'Table ' + tableId + ' is already booked for ' + date + ' (Reservation ' + res.RESERVATION_ID + ', ' + res.GUEST_NAME + ') -- pick another table or date.', soldOut: true };
      }
    }
    const reservationId = payload.id || generateShortId_(clientId, 'RESERVATION_ID');
    const now = new Date().toISOString();
    bnxAppendRow(clientId, SHEETS.RESERVATION_MASTER, { RESERVATION_ID: reservationId, CLIENT_ID: clientId, LOCATION_ID: payload.locationId || '', GUEST_NAME: payload.name || '', PHONE: payload.phone || '', RES_DATE: date, RES_TIME: payload.time || '', COVERS: payload.covers || 0, TABLE_ID: tableId, PACKAGE_PRICE: Number(payload.packagePrice) || 0, ADVANCE_PAID: Number(payload.advance) || 0, NOTES: payload.note || '', STATUS: payload.status || 'upcoming', CREATED_AT: payload.createdAt || now, UPDATED_AT: now });
    return { success: true, id: reservationId };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveReservation failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxListReservations(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.RESERVATION_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const reservations = [];
    for (let r = 1; r < values.length; r++) {
      const res = bnxRowToObject(values[r], headers);
      if (res.CLIENT_ID !== clientId) continue;
      reservations.push({ id: res.RESERVATION_ID, name: res.GUEST_NAME, phone: res.PHONE, date: res.RES_DATE, time: res.RES_TIME, covers: Number(res.COVERS) || 0, table: res.TABLE_ID, packagePrice: Number(res.PACKAGE_PRICE) || 0, advance: Number(res.ADVANCE_PAID) || 0, note: res.NOTES, status: res.STATUS || 'upcoming' });
    }
    return { success: true, reservations, data: reservations };
  } catch (error) {
    bnxLogError(clientId, `bnxListReservations failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetTableAvailability(session, payload) {
  const clientId = session.CLIENT_ID;
  const date = payload.date || '';
  if (!date) return { success: false, error: 'date required' };
  try {
    const tableSheet = bnxClientSheet(clientId, 'TABLE_MASTER');
    const tableValues = tableSheet.getDataRange().getValues();
    const tableHeaders = tableValues[0];
    const bookedByTable = {};
    try {
      const resSheet = bnxClientSheet(clientId, SHEETS.RESERVATION_MASTER);
      const resValues = resSheet.getDataRange().getValues();
      const resHeaders = resValues[0];
      for (let r = 1; r < resValues.length; r++) {
        const res = bnxRowToObject(resValues[r], resHeaders);
        if (res.CLIENT_ID !== clientId) continue;
        if (res.RES_DATE !== date) continue;
        if (String(res.STATUS || '').toLowerCase() === 'cancelled') continue;
        bookedByTable[res.TABLE_ID] = { guest: res.GUEST_NAME, phone: res.PHONE, time: res.RES_TIME, reservationId: res.RESERVATION_ID };
      }
    } catch (e) {}
    const tables = [];
    for (let r = 1; r < tableValues.length; r++) {
      const t = bnxRowToObject(tableValues[r], tableHeaders);
      if (t.CLIENT_ID !== clientId) continue;
      if (t.IS_ACTIVE === false || t.IS_ACTIVE === 'false' || t.IS_ACTIVE === 'FALSE') continue;
      const booking = bookedByTable[t.TABLE_ID] || null;
      tables.push({ id: t.TABLE_ID, name: t.TABLE_NUMBER, section: t.SECTION || 'General', capacity: Number(t.CAPACITY) || 0, minSpend: Number(t.MIN_SPEND) || 0, status: booking ? 'SOLD_OUT' : 'AVAILABLE', booking: booking });
    }
    return { success: true, data: { date, tables } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetTableAvailability failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxCancelReservation(session, payload) {
  const clientId = session.CLIENT_ID;
  const id = payload.id || '';
  if (!id) return { success: false, error: 'id required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.RESERVATION_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const idCol = headers.indexOf('RESERVATION_ID');
    const statusCol = headers.indexOf('STATUS');
    const updatedCol = headers.indexOf('UPDATED_AT');
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] !== clientId || values[r][idCol] !== id) continue;
      if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue('cancelled');
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
      return { success: true };
    }
    return { success: false, error: 'Reservation not found' };
  } catch (error) {
    bnxLogError(clientId, `bnxCancelReservation failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSeatReservationHandler(session, payload) {
  const clientId = session.CLIENT_ID;
  const id = payload.id || '';
  if (!id) return { success: false, error: 'id required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.RESERVATION_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const idCol = headers.indexOf('RESERVATION_ID');
    const statusCol = headers.indexOf('STATUS');
    const updatedCol = headers.indexOf('UPDATED_AT');
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] !== clientId || values[r][idCol] !== id) continue;
      if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue('seated');
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
      return { success: true };
    }
    return { success: false, error: 'Reservation not found' };
  } catch (error) {
    bnxLogError(clientId, `bnxSeatReservationHandler failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxRdFetchSheet(session, payload) {
  const clientId = session.CLIENT_ID;
  const tab = payload.tab || '';
  if (tab !== '04_TABLE_MASTER') return { success: false, error: 'Tab "' + tab + '" is not wired to a real v3 source yet -- only 04_TABLE_MASTER is implemented.' };
  try {
    const tableSheet = bnxClientSheet(clientId, 'TABLE_MASTER');
    const tableValues = tableSheet.getDataRange().getValues();
    const tableHeaders = tableValues[0] || [];
    const liveSheet = bnxClientSheet(clientId, SHEETS.TABLE_LIVE_STATE);
    const liveValues = liveSheet.getDataRange().getValues();
    const liveHeaders = liveValues[0] || [];
    const liveByTableNo = {};
    for (let r = 1; r < liveValues.length; r++) {
      const l = bnxRowToObject(liveValues[r], liveHeaders);
      if (l.CLIENT_ID !== clientId) continue;
      liveByTableNo[String(l.TABLE_NO || '').trim()] = l;
    }
    const findFirst = (obj, names) => { for (const n of names) if (obj[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n]; return ''; };
    const rows = [];
    for (let r = 1; r < tableValues.length; r++) {
      const t = bnxRowToObject(tableValues[r], tableHeaders);
      if (t.CLIENT_ID !== clientId) continue;
      const tableNo = String(findFirst(t,['TABLE_NUMBER','TABLE_NO','TABLE_ID','TABLE_CODE']) || '').trim();
      if (!tableNo) continue;
      const live = liveByTableNo[tableNo] || {};
      const owner = findFirst(live,['CAPTAIN','STEWARD','WAITER','ASSIGNED_STEWARD','ASSIGNED_CAPTAIN']) || findFirst(t,['CAPTAIN','STEWARD','WAITER','ASSIGNED_STEWARD','ASSIGNED_CAPTAIN']);
      const ownerId = findFirst(live,['CAPTAIN_ID','STEWARD_ID','WAITER_ID','ASSIGNED_STEWARD_ID','ASSIGNED_CAPTAIN_ID']) || findFirst(t,['CAPTAIN_ID','STEWARD_ID','WAITER_ID']);
      const ownerLogin = findFirst(live,['CAPTAIN_LOGIN','STEWARD_LOGIN','WAITER_LOGIN']) || findFirst(t,['CAPTAIN_LOGIN','STEWARD_LOGIN','WAITER_LOGIN']);
      rows.push([ tableNo, t.SECTION || t.ZONE || '', '', live.STATUS || t.STATUS || 'AVAILABLE', Number(t.CAPACITY || t.PAX) || 4, owner, Number(live.COVERS) || 0, live.START_TIME || '', ownerId, ownerLogin, Number(live.BILL_AMOUNT) || 0 ]);
    }
    return { success: true, data: rows };
  } catch (error) {
    bnxLogError(clientId, `bnxRdFetchSheet failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}
function bnxSaveTableStatusHandler(session, payload) {
  const clientId = session.CLIENT_ID;
  const tableNo = payload.tableNo || payload.TABLE_ID || '';
  if (!tableNo) return { success: false, error: 'tableNo required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.TABLE_LIVE_STATE);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const tnCol = headers.indexOf('TABLE_NO');
    const statusCol = headers.indexOf('STATUS');
    const coversCol = headers.indexOf('COVERS');
    const billCol = headers.indexOf('BILL_AMOUNT');
    const startCol = headers.indexOf('START_TIME');
    const updatedCol = headers.indexOf('UPDATED_AT');
    const nowTime = new Date().toISOString().split('T')[1].slice(0, 5);
    const status = payload.status !== undefined ? String(payload.status).toUpperCase() : undefined;
    for (let r = 1; r < values.length; r++) {
      if (values[r][tnCol] === tableNo && (ciCol === -1 || values[r][ciCol] === clientId)) {
        if (status !== undefined && statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue(status);
        if (payload.covers !== undefined && coversCol !== -1) sheet.getRange(r + 1, coversCol + 1).setValue(payload.covers);
        if (payload.bill !== undefined && billCol !== -1) sheet.getRange(r + 1, billCol + 1).setValue(payload.bill);
        const capCol = headers.indexOf('CAPTAIN'); const capIdCol = headers.indexOf('CAPTAIN_ID'); const capLoginCol = headers.indexOf('CAPTAIN_LOGIN');
        if (capCol !== -1 && (payload.captain || payload.steward || payload.waiter)) sheet.getRange(r + 1, capCol + 1).setValue(payload.captain || payload.steward || payload.waiter);
        if (capIdCol !== -1 && (payload.captainId || payload.stewardId || payload.waiterId)) sheet.getRange(r + 1, capIdCol + 1).setValue(payload.captainId || payload.stewardId || payload.waiterId);
        if (capLoginCol !== -1 && (payload.captainLogin || payload.stewardLogin || payload.waiterLogin)) sheet.getRange(r + 1, capLoginCol + 1).setValue(payload.captainLogin || payload.stewardLogin || payload.waiterLogin);
        if (status === 'AVAILABLE' && startCol !== -1) sheet.getRange(r + 1, startCol + 1).setValue('');
        else if (status !== undefined && startCol !== -1 && !values[r][startCol]) sheet.getRange(r + 1, startCol + 1).setValue(nowTime);
        if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
        return { success: true, updated: true };
      }
    }
    bnxAppendRow(clientId, SHEETS.TABLE_LIVE_STATE, { CLIENT_ID: clientId, TABLE_NO: tableNo, STATUS: status || 'AVAILABLE', COVERS: payload.covers || 0, BILL_AMOUNT: payload.bill || 0, START_TIME: status && status !== 'AVAILABLE' ? nowTime : '', CAPTAIN: payload.captain || payload.steward || payload.waiter || '', CAPTAIN_ID: payload.captainId || payload.stewardId || payload.waiterId || '', CAPTAIN_LOGIN: payload.captainLogin || payload.stewardLogin || payload.waiterLogin || '', CREATED_AT: new Date().toISOString(), UPDATED_AT: new Date().toISOString() });
    return { success: true, updated: false };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveTableStatusHandler failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

const STAFF_ROLE_ACCESS_MAP = {
  ADMIN:       { access: 'FULL',     web: 'YES', app: 'YES', dashboard: 'ADMIN_DASHBOARD' },
  MANAGER:     { access: 'FULL',     web: 'YES', app: 'YES', dashboard: 'MANAGER_DASHBOARD' },
  ACCOUNTS:    { access: 'HIGH',     web: 'YES', app: 'NO',  dashboard: 'ACCOUNTS_DASHBOARD' },
  CASHIER:     { access: 'STANDARD', web: 'YES', app: 'NO',  dashboard: 'CASHIER_DASHBOARD' },
  CHEF:        { access: 'STANDARD', web: 'NO',  app: 'YES', dashboard: 'CHEF_DASHBOARD' },
  CAPTAIN:     { access: 'STANDARD', web: 'NO',  app: 'YES', dashboard: 'STEWARD_MOBILE' },
  STEWARD:     { access: 'BASIC',    web: 'NO',  app: 'YES', dashboard: 'STEWARD_MOBILE' },
  WAITER:      { access: 'BASIC',    web: 'NO',  app: 'YES', dashboard: 'STEWARD_MOBILE' },
  BAR_STAFF:   { access: 'STANDARD', web: 'NO',  app: 'YES', dashboard: 'BAR_DASHBOARD' },
  STORE_STAFF: { access: 'STANDARD', web: 'YES', app: 'YES', dashboard: 'STORE_DASHBOARD' }
};
const STAFF_ROLE_ACCESS_DEFAULT = { access: 'STANDARD', web: 'YES', app: 'YES', dashboard: 'STAFF_DASHBOARD' };

function bnxRoleAccessCfg_(role) {
  return STAFF_ROLE_ACCESS_MAP[String(role || '').toUpperCase()] || STAFF_ROLE_ACCESS_DEFAULT;
}

function bnxGenTempPassword_() {
  return Math.random().toString(36).slice(-8);
}

function bnxAddStaff_ensureRole_(clientId, role, accessCfg) {
  try {
    const sheet = bnxClientSheet(clientId, 'ROLE_MASTER');
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const nameCol = headers.indexOf('ROLE_NAME') !== -1 ? headers.indexOf('ROLE_NAME') : headers.indexOf('ROLE');
    const idCol = headers.indexOf('ROLE_ID');
    for (let r = 1; r < values.length; r++) {
      if ((ciCol === -1 || values[r][ciCol] === clientId) && nameCol !== -1 && String(values[r][nameCol]).trim().toUpperCase() === role) {
        return idCol !== -1 ? values[r][idCol] : role;
      }
    }
    const roleId = 'ROLE_' + role + '_' + clientId;
    bnxAppendRow(clientId, 'ROLE_MASTER', {
      ROLE_ID: roleId, CLIENT_ID: clientId, ROLE_NAME: role, ROLE: role,
      PERMISSIONS: JSON.stringify({ accessLevel: accessCfg.access, webAccess: accessCfg.web, appAccess: accessCfg.app }),
      DESCRIPTION: 'Auto-created via Add Staff', CREATED_AT: new Date().toISOString()
    });
    return roleId;
  } catch (e) {
    console.warn('[bnxAddStaff_ensureRole_] ' + e.message);
    return role;
  }
}

function bnxAddStaff_lookupCompanyName_(usmSs, clientId) {
  try {
    const sheet = usmSs.getSheetByName('CLIENT_MASTER');
    if (!sheet) return '';
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const nameCol = headers.indexOf('COMPANY_NAME');
    if (ciCol === -1 || nameCol === -1) return '';
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] === clientId) return values[r][nameCol] || '';
    }
    return '';
  } catch (e) {
    console.warn('[bnxAddStaff_lookupCompanyName_] ' + e.message);
    return '';
  }
}

function bnxAddStaff(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  if (!payload.name) return { success: false, error: 'name required' };
  if (!payload.loginCode) return { success: false, error: 'loginCode required' };

  const requestId = payload.requestId || '';
  if (requestId) {
    try {
      const cached = CacheService.getScriptCache().get('addstaff_req_' + requestId);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* cache miss/unavailable -- proceed normally */ }
  }

  try {
    const role = String(payload.role || '').trim().toUpperCase();
    const accessCfg = bnxRoleAccessCfg_(role);
    const newUserId = generateShortId_(clientId, 'USER_ID');
    /* ATTENDANCE LOGIN CONNECTION:
       Use one credential source for Restaurant Staff + Steward + Attendance.
       Explicit password wins; when omitted, the employee name becomes the
       initial/default password for the requested legacy compatibility. */
    const password = String(payload.password || '').trim() || String(payload.name || '').trim();
    if (!password) return { success: false, error: 'password or employee name required' };
    const now = new Date().toISOString();
    const roleId = bnxAddStaff_ensureRole_(clientId, role, accessCfg);

    const clientRow = {
      USER_ID: newUserId, EMP_ID: newUserId, CLIENT_ID: clientId, USERNAME: payload.loginCode || '',
      USER_CODE: payload.loginCode || '', EMAIL: payload.email || '', PHONE: payload.mobile || '',
      PASSWORD_HASH: password, FULL_NAME: payload.name, ROLE: role, ROLE_ID: roleId,
      DEPARTMENT: payload.department || '', DESIGNATION: payload.designation || role,
      BRANCH: payload.branch || '', SHIFT: payload.shift || '', IS_ACTIVE: true, CREATED_AT: now
    };
    bnxAppendRow(clientId, SHEETS.USER_MASTER, clientRow);

    let usmdbSaved = false;
    try {
      const usmSs = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
      const usmSheet = usmSs.getSheetByName('USER_MASTER');
      if (usmSheet) {
        const headers = usmSheet.getRange(1, 1, 1, usmSheet.getLastColumn()).getValues()[0];
        const companyName = bnxAddStaff_lookupCompanyName_(usmSs, clientId);
        const usmRow = {
          USER_ID: newUserId, EMP_ID: newUserId, CLIENT_ID: clientId, USER_CODE: payload.loginCode || '',
          USERNAME: payload.loginCode || '', FULL_NAME: payload.name, NAME: payload.name,
          EMAIL: payload.email || '', MOBILE_NO: payload.mobile || '', PHONE: payload.mobile || '',
          PASSWORD: password, PASSWORD_HASH: password, ROLE: role, INDUSTRY: payload.industry || '',
          BRANCH: payload.branch || 'HEAD_OFFICE', SHIFT: payload.shift || '',
          ACCESS_LEVEL: accessCfg.access, STATUS: 'ACTIVE', IS_ACTIVE: true,
          WEB_ACCESS: accessCfg.web, APP_ACCESS: accessCfg.app,
          OTP_ACCESS: 'NO', LOGIN_TYPE: 'PASSWORD', COMPANY_NAME: companyName,
          DEPARTMENT: payload.department || '', DESIGNATION: payload.designation || role
        };
        usmSheet.appendRow(headers.map(function (h) { return usmRow[h] !== undefined ? usmRow[h] : ''; }));
        usmdbSaved = true;
      } else {
        bnxLogError(clientId, 'bnxAddStaff: USER_MASTER tab not found inside USER_SECURITY_MASTER_DB spreadsheet -- staff saved to client DB only, will NOT be able to log in to Steward app.', payload);
      }
    } catch (usmErr) {
      bnxLogError(clientId, `bnxAddStaff: central USER_SECURITY_MASTER_DB write failed: ${usmErr.message} -- staff saved to client DB only, will NOT be able to log in to Steward app.`, payload);
    }

    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'STAFF',
      RECORD_TYPE: 'USER', RECORD_ID: newUserId, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify(clientRow), REQUEST_ID: requestId, TIMESTAMP: now
    });

    const result = {
      success: true, transactionId: newUserId, data: clientRow,
      tempPassword: password, usmdbSaved: usmdbSaved,
      accessLevel: accessCfg.access, dashboard: accessCfg.dashboard
    };
    if (requestId) {
      try { CacheService.getScriptCache().put('addstaff_req_' + requestId, JSON.stringify(result), 21600); } catch (e) { /* best-effort */ }
    }
    return result;
  } catch (error) {
    bnxLogError(clientId, `bnxAddStaff failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSaveMenuAvailability(session, payload) {
  const clientId = session.CLIENT_ID;
  const overrides = payload.overrides || {};
  const itemIds = Object.keys(overrides);
  if (!itemIds.length) return { success: false, error: 'No overrides sent' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('ITEM_ID');
    const availCol = headers.indexOf('AVAILABILITY_STATUS');
    if (availCol === -1) return { success: false, error: 'ITEM_MASTER has no AVAILABILITY_STATUS column yet -- add it to the v3 template to make this live.' };
    let updated = 0;
    const idToRow = {};
    for (let r = 1; r < values.length; r++) idToRow[values[r][idCol]] = r;
    itemIds.forEach(itemId => { const r = idToRow[itemId]; if (r === undefined) return; sheet.getRange(r + 1, availCol + 1).setValue(overrides[itemId]); updated++; });
    return { success: true, data: { updated } };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveMenuAvailability failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSaveMenuItem(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const name = String(payload.name || payload.itemName || payload.ITEM_NAME || '').trim();
  const category = String(payload.category || payload.CATEGORY_NAME || payload.CATEGORY || '').trim();
  const price = Number(payload.price != null ? payload.price : (payload.salePrice != null ? payload.salePrice : payload.SELLING_RATE));
  const isBar = payload.isBar === true || ['true','1','yes','y'].includes(String(payload.isBar ?? payload.IS_BAR ?? '').trim().toLowerCase()) || String(payload.menuType||payload.MENU_TYPE||'').toUpperCase()==='BAR';
  if (!name) return { success:false, error:'Item name is required' };
  if (!Number.isFinite(price) || price <= 0) return { success:false, error:'Selling price must be greater than 0' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const nameCol = headers.indexOf('ITEM_NAME');
    const ciCol = headers.indexOf('CLIENT_ID');
    for (let r=1;r<values.length;r++) {
      if (ciCol>=0 && String(values[r][ciCol])!==String(clientId)) continue;
      if (nameCol>=0 && String(values[r][nameCol]||'').trim().toLowerCase()===name.toLowerCase()) {
        return {success:false,error:'Item already exists: '+name,duplicate:true,id:values[r][headers.indexOf('ITEM_ID')]||''};
      }
    }
    const catMap=bnxCachedCategoryNameMap_(clientId);
    const unitMap=bnxCachedUnitNameMap_(clientId);
    const taxMap=bnxCachedTaxRateMap_(clientId);
    const categoryId=category ? bnxResolveCategoryId_(clientId,category,catMap) : '';
    const unitName=String(payload.unit||payload.UNIT_NAME||payload.UNIT||'NOS').trim();
    const unitId=unitName ? bnxResolveUnitId_(clientId,unitName,unitMap) : '';
    const gst=Number(payload.gst != null ? payload.gst : (payload.GST_RATE != null ? payload.GST_RATE : payload.taxRate));
    const taxId=Number.isFinite(gst) && gst>=0 ? bnxResolveTaxId_(clientId,gst,taxMap) : '';
    const itemId=generateShortId_(clientId,'ITEM_ID');
    const rowObj={
      ITEM_ID:itemId, CLIENT_ID:clientId, ITEM_NAME:name, CATEGORY_ID:categoryId, UNIT_ID:unitId,
      ITEM_CODE:String(payload.itemCode||payload.ITEM_CODE||itemId).trim(), PURCHASE_RATE:Number(payload.costPrice)||0, SELLING_RATE:price, TAX_ID:taxId,
      HSN_CODE:String(payload.hsn||payload.HSN_CODE||'').trim(), ICON:String(payload.icon||payload.ICON||'').trim(),
      IS_ACTIVE:payload.avail===false || String(payload.avail).toLowerCase()==='false' ? false : true,
      IS_BAR:isBar, ITEM_GROUP_ID:String(payload.itemGroupId||payload.ITEM_GROUP_ID||'').trim(),
      MENU_TYPE:isBar?'BAR':'RESTAURANT', MENU_ACTIVE:true, MENU_SECTION:category,
      CREATED_BY:userId||'', CREATED_AT:new Date().toISOString()
    };
    rowObj.VEG_NONVEG=isBar?'':String(payload.veg||payload.VEG_NONVEG||'').trim();
    rowObj.PRINT_TO=String(payload.printTo||payload.PRINT_TO||(isBar?'BAR':'Kitchen (Printer 2)')).trim();
    rowObj.AVAILABILITY_STATUS=payload.avail===false || String(payload.avail).toLowerCase()==='false' ? 'unavailable' : 'available';
    const out=headers.map(h=>rowObj[h]!==undefined?rowObj[h]:'');
    sheet.getRange(sheet.getLastRow()+1,1,1,headers.length).setValues([out]);

    // Publish to the authoritative POS card at the same time as ITEM_MASTER.
    let publishedId=itemId;
    if(isBar){
      const bsheet=bnxClientSheet(clientId,SHEETS.BAR_ITEM_MASTER);
      const bh=bsheet.getDataRange().getValues(); const headersB=bh[0]||[];
      const barItemId=generateShortId_(clientId,'BAR_ITEM_ID');
      const bObj={BAR_ITEM_ID:barItemId,CLIENT_ID:clientId,ITEM_ID:itemId,BAR_CATEGORY:category,SERVING_UOM:unitName,SERVING_SIZE:String(payload.servingSize||'').trim(),SELLING_PRICE:price,TAX_ID:taxId,STATUS:'ACTIVE',CREATED_AT:new Date().toISOString(),UPDATED_AT:new Date().toISOString(),IS_ACTIVE:true,FAVOURITE:false,POPULAR:false,AVAILABILITY_STATUS:rowObj.AVAILABILITY_STATUS,MENU_TYPE:'BAR'};
      bsheet.getRange(bsheet.getLastRow()+1,1,1,headersB.length).setValues([headersB.map(h=>bObj[h]!==undefined?bObj[h]:'')]);
      const c=bnxClientSheet(clientId,SHEETS.BAR_MENU_CARD); const ch=c.getDataRange().getValues(); const headersC=ch[0]||[];
      const cObj={CLIENT_ID:clientId,CATEGORY_ID:categoryId,CATEGORY_NAME:category,MENU_SECTION:category,ITEM_NAME:name,SERVING_PRICE:price,BOTTLE_PRICE:'',SOURCE_PAGE:'',SOURCE_FILE:'POS',ITEM_ID:itemId,ITEM_GROUP_ID:String(payload.itemGroupId||payload.ITEM_GROUP_ID||'').trim(),TAX_ID:taxId,IS_BAR:true,IS_ACTIVE:true,NOTES:'POS Add',AVAILABILITY_STATUS:rowObj.AVAILABILITY_STATUS,FAVOURITE:false,POPULAR:false,MENU_TYPE:'BAR'};
      c.getRange(c.getLastRow()+1,1,1,headersC.length).setValues([headersC.map(h=>cObj[h]!==undefined?cObj[h]:'')]);
      publishedId=barItemId;
    }else{
      const c=bnxClientSheet(clientId,SHEETS.MENU_CARD_ITEMS); const ch=c.getDataRange().getValues(); const headersC=ch[0]||[];
      const cObj={CLIENT_ID:clientId,MENU_ITEM_NAME:name,PRICE:price,MENU_SECTION:category,VEG_TYPE:String(payload.veg||'').trim(),SOURCE:'POS',ITEM_ID:itemId,ITEM_CODE:rowObj.ITEM_CODE,CATEGORY_ID:categoryId,AVAILABILITY_STATUS:rowObj.AVAILABILITY_STATUS,FAVOURITE:false,POPULAR:false,MENU_TYPE:'RESTAURANT'};
      c.getRange(c.getLastRow()+1,1,1,headersC.length).setValues([headersC.map(h=>cObj[h]!==undefined?cObj[h]:'')]);
    }
    bnxInvalidateMasterCache_(clientId);
    try { CacheService.getScriptCache().remove('posmenu_v2_'+clientId); } catch(e) {}
    bnxCreateAuditLog(clientId,{CLIENT_ID:clientId,USER_ID:userId,ACTION:'CREATE',MODULE:'MENU',RECORD_TYPE:isBar?'BAR_MENU_ITEM':'MENU_ITEM',RECORD_ID:itemId,NEW_VALUE:JSON.stringify(rowObj),TIMESTAMP:new Date().toISOString()});
    return {success:true,id:itemId,publishedId,data:{ITEM_ID:itemId,ITEM_NAME:name,CATEGORY_ID:categoryId,CATEGORY_NAME:category,SELLING_RATE:price,GST_RATE:Number.isFinite(gst)?gst:0,IS_BAR:isBar,MENU_TYPE:isBar?'BAR':'RESTAURANT'}};
  } catch(error) {
    bnxLogError(clientId,`bnxSaveMenuItem failed: ${error.message}`,payload);
    return {success:false,error:error.message};
  }
}

function bnxImportMenuItems(session, payload) {
  const clientId = session.CLIENT_ID;
  const items = payload.items || [];
  if (!items.length) return { success: false, message: 'No items to import' };
  try {
    const catMap = bnxCachedCategoryNameMap_(clientId);
    const unitMap = bnxCachedUnitNameMap_(clientId);
    const taxMap = bnxCachedTaxRateMap_(clientId);
    const sheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const nameCol = headers.indexOf('ITEM_NAME');
    const ciCol = headers.indexOf('CLIENT_ID');
    const existingNames = new Set();
    for (let r = 1; r < values.length; r++) { if (ciCol !== -1 && values[r][ciCol] !== clientId) continue; existingNames.add(String(values[r][nameCol] || '').toLowerCase()); }
    let imported = 0, skipped = 0;
    const rowsToAppend = [];
    items.forEach(item => {
      const key = String(item.name || '').toLowerCase();
      if (!key || existingNames.has(key)) { skipped++; return; }
      existingNames.add(key);
      const categoryId = bnxResolveCategoryId_(clientId, item.category, catMap);
      const unitId = item.unit ? bnxResolveUnitId_(clientId, item.unit, unitMap) : '';
      const taxId = item.taxRate != null && item.taxRate !== '' ? bnxResolveTaxId_(clientId, item.taxRate, taxMap) : '';
      const v3Row = { ITEM_ID: generateShortId_(clientId, 'ITEM_ID'), CLIENT_ID: clientId, ITEM_NAME: item.name, CATEGORY_ID: categoryId, UNIT_ID: unitId, PURCHASE_RATE: item.costPrice || 0, SELLING_RATE: item.salePrice || 0, TAX_ID: taxId, IS_ACTIVE: (item.status || 'Active') === 'Active', CREATED_AT: new Date().toISOString() };
      rowsToAppend.push(headers.map(h => v3Row[h] !== undefined ? v3Row[h] : ''));
      imported++;
    });
    if (rowsToAppend.length) sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    if (imported > 0) bnxInvalidateMasterCache_(clientId);
    return { success: true, data: { imported, skipped } };
  } catch (error) {
    bnxLogError(clientId, `bnxImportMenuItems failed: ${error.message}`, payload);
    return { success: false, message: error.message };
  }
}

const KOT_STATUS_MAP_IN_ = { pending: 'PRINTED', cooking: 'COOKING', ready: 'READY', served: 'SERVED', cancelled: 'CANCELLED' };

function bnxUpdateKotStatus(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const kotId = payload.kotId || payload.KOT_ID || '';
  const rawStatus = String(payload.status || '').toLowerCase();
  const newStatus = KOT_STATUS_MAP_IN_[rawStatus] || String(payload.status || '').toUpperCase();
  if (!kotId || !newStatus) return { success: false, error: 'kotId and status are required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const idCol = headers.indexOf('KOT_ID');
    const noCol = headers.indexOf('KOT_NUMBER');
    const statusCol = headers.indexOf('KOT_STATUS');
    const updatedCol = headers.indexOf('UPDATED_AT');
    const servedCol = headers.indexOf('SERVED_AT');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      const matches = (idCol !== -1 && values[r][idCol] === kotId) || (noCol !== -1 && values[r][noCol] === kotId);
      if (!matches) continue;
      if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue(newStatus);
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
      if (newStatus === 'SERVED' && servedCol !== -1) sheet.getRange(r + 1, servedCol + 1).setValue(new Date().toISOString());
      bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'UPDATE', MODULE: 'KITCHEN', RECORD_TYPE: 'KOT', RECORD_ID: (idCol !== -1 ? values[r][idCol] : kotId), OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ KOT_STATUS: newStatus }), TIMESTAMP: new Date().toISOString() });
      return { success: true, kotId: (idCol !== -1 ? values[r][idCol] : kotId), status: newStatus };
    }
    return { success: false, error: 'KOT not found for this client (kotId: ' + kotId + ')' };
  } catch (error) {
    bnxLogError(clientId, `bnxUpdateKotStatus failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxUpdateOrderItems(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const requestId = payload.requestId;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.ORDER);
  if (!claim.claimed) return { success: true, transactionId: claim.existing.transactionId, message: 'Duplicate request detected -- using previous result', cached: true };
  const orderRef = String(payload.orderId || payload.ORDER_ID || payload.ORDER_NUMBER || '').trim();
  if (!orderRef) return respondError(400, 'orderId is required', requestId);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return respondError(400, 'At least one order item is required', requestId);
  try {
    const master = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const vals = master.getDataRange().getValues();
    const headers = vals[0].map(String);
    const ciCol=headers.indexOf('CLIENT_ID'), idCol=headers.indexOf('ORDER_ID'), noCol=headers.indexOf('ORDER_NUMBER');
    const tableCol=headers.indexOf('TABLE_ID'), paxCol=headers.indexOf('PAX'), notesCol=headers.indexOf('SPECIAL_INSTRUCTIONS'), updatedCol=headers.indexOf('UPDATED_AT');
    let rowIndex=-1, realOrderId='';
    for(let r=1;r<vals.length;r++){
      if(ciCol!==-1 && String(vals[r][ciCol])!==String(clientId)) continue;
      if((idCol!==-1 && String(vals[r][idCol])===orderRef) || (noCol!==-1 && String(vals[r][noCol])===orderRef)){
        rowIndex=r+1; realOrderId=idCol!==-1?String(vals[r][idCol]):orderRef; break;
      }
    }
    if(rowIndex<0) return respondError(404, 'Order not found for this client (orderId: '+orderRef+')', requestId);
    const statusIdx=headers.indexOf('ORDER_STATUS');
    const currentStatus = statusIdx !== -1 ? String(vals[rowIndex-1][statusIdx]||'').toUpperCase() : '';
    if(currentStatus==='BILLED' || currentStatus==='CANCELLED') return respondError(409, 'Closed orders cannot be edited', requestId);
    if(tableCol!==-1) master.getRange(rowIndex,tableCol+1).setValue(String(payload.tableId||payload.TABLE_ID||'').trim());
    if(paxCol!==-1 && payload.pax!=null) master.getRange(rowIndex,paxCol+1).setValue(Number(payload.pax)||0);
    if(notesCol!==-1 && payload.remarks!=null) master.getRange(rowIndex,notesCol+1).setValue(String(payload.remarks||''));
    if(updatedCol!==-1) master.getRange(rowIndex,updatedCol+1).setValue(new Date().toISOString());

    const itemSheet=bnxClientSheet(clientId,SHEETS.ORDER_ITEMS);
    const itemVals=itemSheet.getDataRange().getValues();
    const itemHeaders=itemVals[0].map(String);
    const itemOrderCol=itemHeaders.indexOf('ORDER_ID');
    // This is an active/unbilled order edit. Replace only the ORDER_ITEMS rows
    // belonging to this real order. KOT history remains in KOT_MASTER/KOT_ITEMS.
    if(itemOrderCol!==-1){
      for(let r=itemVals.length-1;r>=1;r--){
        if(String(itemVals[r][itemOrderCol])===String(realOrderId)) itemSheet.deleteRow(r+1);
      }
    }
    items.forEach((item,i)=>{
      const qty=Math.max(1,Number(item.qty||item.QUANTITY||1));
      const rate=Number(item.price!=null?item.price:(item.rate!=null?item.rate:item.RATE))||0;
      const taxRate=Number(item.TAX_RATE!=null?item.TAX_RATE:(item.gst!=null?item.gst:0))||0;
      bnxAppendRow(clientId,SHEETS.ORDER_ITEMS,{
        ORDER_ITEM_ID:generateShortId_(clientId,'ORDER_ITEM_ID'), ORDER_ID:realOrderId,
        ITEM_ID:item.ITEM_ID||item.itemId||item.id||'', SEQUENCE:i+1,
        ITEM_NAME:item.name||item.itemName||item.ITEM_NAME||'', QUANTITY:qty,
        UNIT_ID:item.UNIT_ID||'PIECE', RATE:rate, LINE_DISCOUNT:Number(item.LINE_DISCOUNT||0)||0,
        ITEM_TAX_RATE:taxRate, ITEM_TAX:qty*rate*taxRate, LINE_TOTAL:(qty*rate)+(qty*rate*taxRate),
        SPECIAL_INSTRUCTIONS:item.SPECIAL_INSTRUCTIONS||'', ITEM_STATUS:'PENDING', CREATED_AT:new Date().toISOString()
      });
    });
    bnxCreateAuditLog(clientId,{CLIENT_ID:clientId,USER_ID:userId,ACTION:'EDIT',MODULE:'STEWARD',RECORD_TYPE:'ORDER',RECORD_ID:realOrderId,OLD_VALUE:JSON.stringify({TABLE_ID:vals[rowIndex-1][tableCol]||''}),NEW_VALUE:JSON.stringify({TABLE_ID:payload.tableId||'',ITEMS:items.length}),TIMESTAMP:new Date().toISOString(),REQUEST_ID:requestId});
    bnxMarkSynced(clientId,requestId,realOrderId,TRANSACTION_TYPES.ORDER);
    try{ bnxInvalidateTodayReportCaches_(clientId); }catch(e){}
    return { success:true, transactionId:realOrderId, orderId:realOrderId, message:'Order updated successfully', itemCount:items.length };
  } catch(error) {
    bnxLogError(clientId, `bnxUpdateOrderItems failed: ${error.message}`, { requestId, payload });
    return respondError(500,error.message,requestId);
  }
}

function bnxUpdateOrderStatus(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const orderId = payload.orderId || payload.ORDER_ID || payload.ORDER_NUMBER || '';
  const newStatus = String(payload.status || '').toUpperCase();
  if (!orderId || !newStatus) return { success: false, error: 'orderId and status are required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const idCol = headers.indexOf('ORDER_ID');
    const noCol = headers.indexOf('ORDER_NUMBER');
    const statusCol = headers.indexOf('ORDER_STATUS');
    const notesCol = headers.indexOf('SPECIAL_INSTRUCTIONS');
    const updatedCol = headers.indexOf('UPDATED_AT');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      const matches = (noCol !== -1 && values[r][noCol] === orderId) || (idCol !== -1 && values[r][idCol] === orderId);
      if (!matches) continue;
      if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue(newStatus);
      if (payload.remarks && notesCol !== -1) sheet.getRange(r + 1, notesCol + 1).setValue(String(payload.remarks));
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
      bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'UPDATE', MODULE: 'STEWARD', RECORD_TYPE: 'ORDER', RECORD_ID: (idCol !== -1 ? values[r][idCol] : orderId), OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ ORDER_STATUS: newStatus, remarks: payload.remarks || '' }), TIMESTAMP: new Date().toISOString() });
      return { success: true, orderId: (idCol !== -1 ? values[r][idCol] : orderId), status: newStatus };
    }
    return { success: false, error: 'Order not found for this client (orderId: ' + orderId + ')' };
  } catch (error) {
    bnxLogError(clientId, `bnxUpdateOrderStatus failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxResolveCustomerId_(clientId, name, mobile) {
  const cleanMobile = String(mobile || '').replace(/\D/g, '');
  const cleanName = String(name || '').trim();
  if (!cleanMobile && !cleanName) return '';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID !== clientId) continue;
      if (cleanMobile && String(row.PHONE || '').replace(/\D/g, '') === cleanMobile) return row.CUSTOMER_ID;
      if (!cleanMobile && cleanName && String(row.CUSTOMER_NAME || '').toLowerCase() === cleanName.toLowerCase()) return row.CUSTOMER_ID;
    }
    const newId = generateShortId_(clientId, 'CUSTOMER_ID');
    bnxAppendRow(clientId, SHEETS.CUSTOMER_MASTER, { CUSTOMER_ID: newId, CLIENT_ID: clientId, CUSTOMER_NAME: cleanName || 'Customer', PHONE: cleanMobile, CUSTOMER_TYPE: 'Individual', IS_ACTIVE: true, CREATED_AT: new Date().toISOString() });
    return newId;
  } catch (error) { console.warn('[bnxResolveCustomerId_] ' + error.message); return ''; }
}

function bnxUpsertCustomerDue_(clientId, customerId, amount, dateStr, txnType) {
  const sheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_DUES);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ciCol = headers.indexOf('CLIENT_ID');
  const custCol = headers.indexOf('CUSTOMER_ID');
  const balCol = headers.indexOf('CURRENT_BALANCE');
  const lastDateCol = headers.indexOf('LAST_TRANSACTION_DATE');
  const lastTypeCol = headers.indexOf('LAST_TRANSACTION_TYPE');
  const updatedCol = headers.indexOf('UPDATED_AT');
  for (let r = 1; r < values.length; r++) {
    if (values[r][ciCol] === clientId && values[r][custCol] === customerId) {
      const current = parseFloat(values[r][balCol]) || 0;
      sheet.getRange(r + 1, balCol + 1).setValue(current + amount);
      if (lastDateCol !== -1) sheet.getRange(r + 1, lastDateCol + 1).setValue(dateStr);
      if (lastTypeCol !== -1) sheet.getRange(r + 1, lastTypeCol + 1).setValue(txnType);
      if (updatedCol !== -1) sheet.getRange(r + 1, updatedCol + 1).setValue(new Date().toISOString());
      return;
    }
  }
  bnxAppendRow(clientId, SHEETS.CUSTOMER_DUES, { CUSTOMER_DUES_ID: generateShortId_(clientId, 'CUSTOMER_DUES_ID'), CLIENT_ID: clientId, CUSTOMER_ID: customerId, OPENING_BALANCE: 0, CURRENT_BALANCE: amount, LAST_TRANSACTION_DATE: dateStr, LAST_TRANSACTION_TYPE: txnType, STATUS: 'Active', UPDATED_AT: new Date().toISOString() });
}

function bnxGetDueCollection(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const duesSheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_DUES);
    const duesValues = duesSheet.getDataRange().getValues();
    const duesHeaders = duesValues[0];
    const custSheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_MASTER);
    const custValues = custSheet.getDataRange().getValues();
    const custHeaders = custValues[0];
    const custById = {};
    for (let r = 1; r < custValues.length; r++) { const c = bnxRowToObject(custValues[r], custHeaders); custById[c.CUSTOMER_ID] = c; }
    const today = new Date();
    const rows = [];
    let totalOutstanding = 0; let overdue30 = 0;
    for (let r = 1; r < duesValues.length; r++) {
      const d = bnxRowToObject(duesValues[r], duesHeaders);
      if (d.CLIENT_ID !== clientId) continue;
      const balance = parseFloat(d.CURRENT_BALANCE) || 0;
      if (balance <= 0) continue;
      const cust = custById[d.CUSTOMER_ID] || {};
      const lastDate = d.LAST_TRANSACTION_DATE ? new Date(d.LAST_TRANSACTION_DATE) : today;
      const overdueDays = Math.max(0, Math.floor((today - lastDate) / 86400000));
      totalOutstanding += balance;
      if (overdueDays >= 30) overdue30 += balance;
      rows.push({ customerId: d.CUSTOMER_ID, customer: cust.CUSTOMER_NAME || 'Unknown', phone: cust.PHONE || '', type: cust.CUSTOMER_TYPE || 'Individual', outstanding: balance, lastBillDate: d.LAST_TRANSACTION_DATE || '', overdueDays: overdueDays });
    }
    let receivedToday = 0, paymentsToday = 0;
    try {
      const recSheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const recValues = recSheet.getDataRange().getValues();
      const recHeaders = recValues[0];
      const todayStr = bnxBusinessDateKey_();
      for (let r = 1; r < recValues.length; r++) {
        const rec = bnxRowToObject(recValues[r], recHeaders);
        if (rec.CLIENT_ID !== clientId) continue;
        if (rec.RECEIPT_DATE !== todayStr) continue;
        receivedToday += parseFloat(rec.AMOUNT) || 0; paymentsToday++;
      }
    } catch (e) {}
    return { success: true, data: { totalOutstanding, receivedToday, netOutstanding: totalOutstanding, paymentsToday, overdue30Plus: overdue30, customers: rows } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDueCollection failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSaveDuesReceipt(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const customerId = payload.customerId || '';
  const amount = Number(payload.amount) || 0;
  if (!customerId || amount <= 0) return { success: false, error: 'customerId and a positive amount are required' };
  try {
    const now = bnxNowParts_();
    const receiptId = generateShortId_(clientId, 'DUES_RECEIPT_ID');
    bnxAppendRow(clientId, SHEETS.DUES_RECEIPT, { DUES_RECEIPT_ID: receiptId, CLIENT_ID: clientId, CUSTOMER_ID: customerId, AMOUNT: amount, PAYMENT_MODE: payload.paymentMode || 'CASH', REFERENCE: payload.reference || '', RECEIPT_DATE: now.businessDate, RECEIPT_TIME: now.time, CREATED_BY: userId, CREATED_AT: now.iso });
    const sheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_DUES);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const custCol = headers.indexOf('CUSTOMER_ID');
    const balCol = headers.indexOf('CURRENT_BALANCE');
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] === clientId && values[r][custCol] === customerId) {
        const current = parseFloat(values[r][balCol]) || 0;
        sheet.getRange(r + 1, balCol + 1).setValue(Math.max(0, current - amount));
        break;
      }
    }
    try { bnxInvalidateTodayReportCaches_(clientId); } catch (e) {}
    return { success: true, receiptId };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveDuesReceipt failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetDebtorsReport(session, payload) {
  const dueRes = bnxGetDueCollection(session, payload);
  if (!dueRes.success) return dueRes;
  const buckets = dueRes.data.customers.map(c => ({ customer: c.customer, b0_30: c.overdueDays < 30 ? c.outstanding : 0, b30_60: (c.overdueDays >= 30 && c.overdueDays < 60) ? c.outstanding : 0, b60plus: c.overdueDays >= 60 ? c.outstanding : 0, total: c.outstanding }));
  return { success: true, data: { rows: buckets, grandTotal: dueRes.data.totalOutstanding } };
}

function bnxGetDiscountReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('discount', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetDiscountReport_impl_(session, payload));
}
/* NOTE: bnxGetDiscountReport_impl_ is intentionally NOT defined here --
   the report-engine section below (PASS #63) defines the real, final
   version. Do not add a second copy. */

function bnxGetDailySales(session, payload) {
  const clientId = session.CLIENT_ID;
  const date = payload.date || payload.from || '';
  if (!date) return { success: false, error: 'date required' };
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    let grandTotal = 0, totalBills = 0;
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (b.BILL_DATE !== date) continue;
      grandTotal += Number(b.GRAND_TOTAL) || 0; totalBills += 1;
    }
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    let cash = 0, bank = 0;
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (p.PAYMENT_DATE !== date) continue;
      const mode = String(p.PAYMENT_MODE || '').toUpperCase();
      const amt = Number(p.AMOUNT) || 0;
      if (mode === 'CASH') cash += amt;
      else if (mode === 'UPI' || mode === 'CARD' || mode === 'BANK' || mode === 'DEBIT CARD' || mode === 'CREDIT CARD') bank += amt;
      else cash += amt;
    }
    return { success: true, data: [{ DATE: date, GRAND_TOTAL: grandTotal, CASH: cash, BANK: bank, TOTAL_BILLS: totalBills }] };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDailySales failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetDsr(session, payload) {
  const clientId = session.CLIENT_ID;
  const date = payload.date || '';
  if (!date) return { success: false, error: 'date required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    let netSale = 0;
    for (let r = 1; r < values.length; r++) {
      const b = bnxRowToObject(values[r], headers);
      if (b.CLIENT_ID !== clientId) continue;
      if (b.BILL_DATE !== date) continue;
      netSale += Number(b.SUBTOTAL) || 0;
    }
    return { success: true, data: { DATE: date, NET_SALE: netSale } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDsr failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetOnlineOrderReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('onlineorder', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetOnlineOrderReport_impl_(session, payload));
}
function bnxGetOnlineOrderReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const AGGREGATORS = ['ZOMATO', 'SWIGGY', 'ONDC', 'MAGICPIN'];
    const byAgg = {};
    AGGREGATORS.forEach(a => { byAgg[a] = { orders: 0, revenue: 0, commission: 0, netReceivable: 0 }; });
    const otherAgg = {};

    const sheet = bnxClientSheet(clientId, SHEETS.ONLINE_ORDER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    for (let r = 1; r < values.length; r++) {
      const o = bnxRowToObject(values[r], headers);
      if (o.CLIENT_ID !== clientId) continue;
      const createdDate = String(o.CREATED_AT || '').slice(0, 10);
      if (!createdDate || createdDate < from || createdDate > to) continue;
      const agg = String(o.AGGREGATOR || '').toUpperCase().trim();
      if (!agg) continue;
      const bucket = byAgg[agg] || (otherAgg[agg] = otherAgg[agg] || { orders: 0, revenue: 0, commission: 0, netReceivable: 0 });
      bucket.orders += 1;
      bucket.revenue += Number(o.ORDER_AMOUNT) || 0;
      bucket.commission += Number(o.PLATFORM_FEE) || 0;
      bucket.netReceivable += Number(o.NET_AMOUNT_TO_RESTAURANT) || 0;
    }

    const settlementByAgg = {};
    try {
      const setSheet = bnxClientSheet(clientId, SHEETS.AGGREGATOR_SETTLEMENT);
      const setValues = setSheet.getDataRange().getValues();
      const setHeaders = setValues[0];
      for (let r = 1; r < setValues.length; r++) {
        const s = bnxRowToObject(setValues[r], setHeaders);
        if (s.CLIENT_ID !== clientId) continue;
        const agg = String(s.AGGREGATOR || '').toUpperCase().trim();
        if (!agg) continue;
        const periodStart = String(s.SETTLEMENT_PERIOD_START || '').slice(0, 10);
        const periodEnd = String(s.SETTLEMENT_PERIOD_END || '').slice(0, 10);
        if (periodEnd < from || periodStart > to) continue;
        const existing = settlementByAgg[agg];
        if (!existing || periodEnd > existing.periodEnd) settlementByAgg[agg] = { status: s.STATUS || 'Pending', periodEnd };
      }
    } catch (e) {}

    const gstRate = 0.18;
    const buildRow = (name, agg) => {
      const gstOnComm = +(agg.commission * gstRate).toFixed(2);
      return {
        aggregator: name, orders: agg.orders, revenue: agg.revenue, commission: agg.commission,
        gstOnComm: gstOnComm, netReceivable: agg.netReceivable,
        settlementStatus: agg.orders > 0 ? ((settlementByAgg[name] && settlementByAgg[name].status) || 'Pending') : '\u2014'
      };
    };
    const rows = AGGREGATORS.map(a => buildRow(a, byAgg[a])).concat(Object.keys(otherAgg).map(a => buildRow(a, otherAgg[a])));
    const total = rows.reduce((acc, r) => ({
      orders: acc.orders + r.orders, revenue: acc.revenue + r.revenue,
      commission: acc.commission + r.commission, gstOnComm: acc.gstOnComm + r.gstOnComm,
      netReceivable: acc.netReceivable + r.netReceivable
    }), { orders: 0, revenue: 0, commission: 0, gstOnComm: 0, netReceivable: 0 });

    return { success: true, data: { rows, total, gstOnCommIsAssumed: true, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetOnlineOrderReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxSaveOnlineOrder(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const aggregator = String(payload.aggregator || '').toUpperCase().trim();
  const orderAmount = Number(payload.orderAmount) || 0;
  if (!aggregator) return { success: false, error: 'aggregator required' };
  if (orderAmount <= 0) return { success: false, error: 'orderAmount must be > 0' };
  try {
    const now = bnxNowParts_();
    const platformFee = Number(payload.platformFee) || 0;
    const deliveryFee = Number(payload.deliveryFee) || 0;
    const discountByPlatform = Number(payload.discountByPlatform) || 0;
    const netAmount = +(orderAmount - platformFee - deliveryFee - discountByPlatform).toFixed(2);
    const onlineOrderId = generateShortId_(clientId, 'ONLINE_ORDER_ID');
    const row = {
      ONLINE_ORDER_ID: onlineOrderId, CLIENT_ID: clientId, LOCATION_ID: payload.locationId || '',
      AGGREGATOR: aggregator, AGGREGATOR_ORDER_ID: payload.aggregatorOrderId || '',
      CUSTOMER_NAME: payload.customerName || '', CUSTOMER_PHONE: payload.customerPhone || '',
      DELIVERY_ADDRESS: payload.deliveryAddress || '', DELIVERY_INSTRUCTIONS: '',
      ORDER_STATUS: payload.orderStatus || 'DELIVERED', ORDER_AMOUNT: orderAmount,
      PLATFORM_FEE: platformFee, DELIVERY_FEE: deliveryFee, DISCOUNT_BY_PLATFORM: discountByPlatform,
      NET_AMOUNT_TO_RESTAURANT: netAmount, CREATED_AT: now.iso, NOTES: 'Logged manually by ' + userId
    };
    bnxAppendRow(clientId, SHEETS.ONLINE_ORDER_MASTER, row);
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'ONLINE_ORDERS', RECORD_TYPE: 'ONLINE_ORDER', RECORD_ID: onlineOrderId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(row), TIMESTAMP: now.iso });
    return { success: true, transactionId: onlineOrderId, data: row };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveOnlineOrder failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxImportBatch(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const sheetName = String(payload.sheet || '').trim();
  const requestId = payload.requestId || (payload.batchId ? payload.batchId + '-' + payload.batchNum : '');
  const claim = bnxClaimRequest(clientId, requestId, 'IMPORT_BATCH');
  if (!claim.claimed) return { success: true, message: 'Duplicate batch detected -- using previous result', cached: true, imported: 0, skipped: 0 };
  let rows;
  try {
    rows = typeof payload.rows === 'string' ? JSON.parse(payload.rows) : (payload.rows || []);
  } catch (e) {
    return { success: false, message: 'rows must be valid JSON' };
  }
  if (!Array.isArray(rows) || !rows.length) return { success: false, message: 'No rows in this batch' };
  try {
    let result;
    if (sheetName === 'POSHEAD') result = bnxImportPosHeadBatch_(clientId, userId, rows);
    else if (sheetName === 'ITEMWISE') result = bnxImportItemwiseBatch_(clientId, userId, rows);
    else return { success: false, message: 'Sheet "' + sheetName + '" is not recognized -- this importer only handles the confirmed real POSHEAD and ITEMWISE format. A differently-shaped file needs its own confirmed column mapping first, not a guessed one.' };
    bnxMarkSynced(clientId, requestId, '', 'IMPORT_BATCH');
    return { success: true, imported: result.imported, skipped: result.skipped, message: result.imported + ' imported, ' + result.skipped + ' skipped' };
  } catch (error) {
    bnxLogError(clientId, `bnxImportBatch failed for ${sheetName}: ${error.message}`, { requestId });
    return { success: false, message: error.message };
  }
}

function bnxExcelSerialToDate_(serial) {
  if (serial == null || serial === '') return null;
  const num = Number(serial);
  if (isNaN(num)) return null;
  const ms = Math.round((num - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function bnxImportPosHeadBatch_(clientId, userId, rows) {
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const existingNumbers = new Set();
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const noCol = headers.indexOf('BILL_NUMBER');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      if (noCol !== -1 && values[r][noCol]) existingNumbers.add(String(values[r][noCol]));
    }
  } catch (e) {}

  let imported = 0, skipped = 0;
  rows.forEach(row => {
    const invoiceNumber = String(row.invoiceNumber || '').trim();
    if (!invoiceNumber || existingNumbers.has(invoiceNumber)) { skipped++; return; }
    existingNumbers.add(invoiceNumber);
    const dt = bnxExcelSerialToDate_(row.invoiceDate);
    const billDate = dt ? Utilities.formatDate(dt, tz, 'yyyy-MM-dd') : '';
    const billTime = dt ? Utilities.formatDate(dt, tz, 'HH:mm:ss') : '';
    const billIso = dt ? dt.toISOString() : new Date().toISOString();

    const total = Number(row.total) || 0;
    const taxableAmount = Number(row.taxableAmount) || 0;
    const taxAmount = Number(row.taxAmount) || 0;
    const totalDiscount = Number(row.totalDiscount) || 0;
    const grossSales = (Number(row.food)||0) + (Number(row.bar)||0) + (Number(row.beverage)||0) + (Number(row.tobacco)||0);

    const subtotalAfterDiscount = (row.totalAmountAfterDiscount != null && row.totalAmountAfterDiscount !== '')
      ? Number(row.totalAmountAfterDiscount) || 0
      : Math.max(0, +(((grossSales || taxableAmount) - totalDiscount)).toFixed(2));

    const creditAmt = Number(row.credittotal) || 0;
    const isPaid = creditAmt <= 0;

    let customerId = '';
    const custName = String(row.customerName || '').trim();
    const custPhone = String(row.customerPhone || '').replace(/\D/g, '');
    if (custName && custName.toUpperCase() !== 'GENERAL CUSTOMER' && custPhone && custPhone !== '1111111111') {
      customerId = bnxResolveCustomerId_(clientId, custName, custPhone);
    }

    const importStaffName = String(
      row.stewardName || row.steward || row.waiterName || row.waiter ||
      row.captainName || row.captain || row.staffName || row.servedBy || ''
    ).trim();
    const createdByVal = importStaffName || ('HISTORICAL_IMPORT:' + userId);

    const billId = generateShortId_(clientId, 'BILL_ID');
    const billMaster = {
      BILL_ID: billId, CLIENT_ID: clientId, LOCATION_ID: '', ORDER_ID: '',
      BILL_NUMBER: invoiceNumber, BILL_DATE: billDate, BILL_TIME: billTime,
      TABLE_ID: row.tableName || '', CUSTOMER_ID: customerId, CUSTOMER_NAME: custName || 'GENERAL CUSTOMER',
      BILL_TYPE: 'DINEIN', COVERS: Number(row.pax) || 0,
      SUBTOTAL: grossSales || taxableAmount, ITEM_DISCOUNT: totalDiscount, SUBTOTAL_AFTER_ITEM_DISCOUNT: subtotalAfterDiscount,
      BILL_DISCOUNT: 0, TAXABLE_AMOUNT: taxableAmount,
      TAX_RATE: taxableAmount > 0 ? +(taxAmount / taxableAmount).toFixed(4) : 0, TAX_AMOUNT: taxAmount,
      ROUND_OFF: +(total - (subtotalAfterDiscount + taxAmount)).toFixed(2), GRAND_TOTAL: total,
      DUE_AMOUNT: isPaid ? 0 : creditAmt, BILL_STATUS: 'FINALIZED', PAYMENT_STATUS: isPaid ? 'PAID' : 'DUE',
      GST_BREAKUP: JSON.stringify({ SGST: taxAmount/2, CGST: taxAmount/2 }),
      NOTES: (row.remarks ? String(row.remarks) : '') + ' [Imported from historical POS export]',
      CREATED_BY: createdByVal, CREATED_AT: billIso,
      FINALIZED_BY: createdByVal, FINALIZED_AT: billIso,
      PLATFORM: row.payMode || ''
    };
    bnxAppendRow(clientId, SHEETS.BILL_MASTER, billMaster);

    const modeCols = [
      ['cashtotal', 'CASH'], ['cardtotal', 'CARD'], ['onlinetotal', 'UPI'],
      ['smartcardtotal', 'CARD'], ['banktransfertotal', 'BANK'], ['walletadjustmenttotal', 'WALLET']
    ];
    let tipsWritten = false;
    const tips = (Number(row.tipsAmount) || 0) + (Number(row.tipsDirectAmount) || 0);
    modeCols.forEach(([col, mode]) => {
      const amt = Number(row[col]) || 0;
      if (amt <= 0) return;
      bnxAppendRow(clientId, SHEETS.PAYMENT_MASTER, {
        PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: '', BILL_ID: billId,
        CUSTOMER_ID: customerId, PAYMENT_MODE_ID: '', PAYMENT_MODE: mode, AMOUNT: amt,
        PAYMENT_DATE: billDate, PAYMENT_TIME: billTime, REFERENCE: '', PAYMENT_STATUS: 'SUCCESS',
        CREATED_BY: 'HISTORICAL_IMPORT:' + userId, CREATED_AT: billIso,
        TIPS_AMOUNT: !tipsWritten ? tips : 0
      });
      tipsWritten = true;
    });
    if (!tipsWritten && tips > 0) {
      bnxAppendRow(clientId, SHEETS.PAYMENT_MASTER, {
        PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: '', BILL_ID: billId,
        CUSTOMER_ID: customerId, PAYMENT_MODE_ID: '', PAYMENT_MODE: 'OTHER', AMOUNT: 0,
        PAYMENT_DATE: billDate, PAYMENT_TIME: billTime, REFERENCE: 'Tip only', PAYMENT_STATUS: 'SUCCESS',
        CREATED_BY: 'HISTORICAL_IMPORT:' + userId, CREATED_AT: billIso, TIPS_AMOUNT: tips
      });
    }
    if (!isPaid && customerId && creditAmt > 0) {
      bnxUpsertCustomerDue_(clientId, customerId, creditAmt, billDate, 'BILL');
    }
    imported++;
  });
  return { imported, skipped };
}

function bnxImportItemwiseBatch_(clientId, userId, rows) {
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const billIdByNumber = {};
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const noCol = headers.indexOf('BILL_NUMBER');
    const idCol = headers.indexOf('BILL_ID');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      if (noCol !== -1 && values[r][noCol]) billIdByNumber[String(values[r][noCol])] = values[r][idCol];
    }
  } catch (e) {}

  const itemIdByName = bnxCachedItemNameMap_(clientId);

  let imported = 0, skipped = 0;
  const seqByBill = {};
  rows.forEach(row => {
    const invoiceNumber = String(row.InvoiceNumber || '').trim();
    const billId = billIdByNumber[invoiceNumber];
    if (!billId) { skipped++; return; }
    const dt = bnxExcelSerialToDate_(row.InvoiceDate);
    const createdIso = dt ? dt.toISOString() : new Date().toISOString();
    const qty = Number(row.QTY) || 0;
    const rate = Number(row.RATE) || 0;
    const netValue = Number(row.NETVALUE) || 0;
    const tax = Number(row.TAX) || 0;
    const billAmount = Number(row.BILLAMOUNT) || 0;
    const resolvedItemId = itemIdByName[String(row.ItemName||'').toLowerCase().trim()] || '';
    seqByBill[invoiceNumber] = (seqByBill[invoiceNumber] || 0) + 1;
    bnxAppendRow(clientId, SHEETS.BILL_ITEMS, {
      BILL_ITEM_ID: generateShortId_(clientId, 'BILL_ITEM_ID'), BILL_ID: billId, ORDER_ITEM_ID: '', ITEM_ID: resolvedItemId,
      SEQUENCE: seqByBill[invoiceNumber], ITEM_NAME: row.ItemName || '', QUANTITY: qty, UNIT_ID: 'PIECE',
      RATE: rate, LINE_DISCOUNT: Number(row.DISCOUNT) || 0, DISCOUNTED_RATE: rate,
      TAXABLE_PER_ITEM: netValue, TAX_RATE: netValue > 0 ? +(tax / netValue).toFixed(4) : 0,
      TAX_PER_ITEM: tax, LINE_TOTAL: billAmount, CREATED_AT: createdIso
    });
    bnxAppendRow(clientId, SHEETS.STOCK_MOVEMENT, {
      STOCK_MOVEMENT_ID: generateShortId_(clientId, 'STOCK_MOVEMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: '', ITEM_ID: resolvedItemId,
      MOVEMENT_TYPE: 'SALE', MOVEMENT_DATE: dt ? Utilities.formatDate(dt, tz, 'yyyy-MM-dd') : '',
      QUANTITY_IN: 0, QUANTITY_OUT: qty, RATE: rate, SOURCE_TYPE: 'BILL', SOURCE_ID: billId,
      CREATED_BY: 'HISTORICAL_IMPORT:' + userId, CREATED_AT: createdIso
    });
    imported++;
  });
  return { imported, skipped };
}

function bnxGetKdsReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('kds', clientId, payload);
  return bnxCachedReport_(cacheKey, 15, () => bnxGetKdsReport_impl_(session, payload));
}
function bnxGetKdsReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const hasServedAt = headers.indexOf('SERVED_AT') !== -1;
    if (!hasServedAt) {
      return { success: true, data: { rows: [], avgMinutes: null, sampleSize: 0,
        note: 'KOT_MASTER has no SERVED_AT column in this sheet -- add it (already written by bnxUpdateKotStatus whenever it exists) to make this report real.' } };
    }
    const rows = [];
    const durations = [];
    for (let r = 1; r < values.length; r++) {
      const k = bnxRowToObject(values[r], headers);
      if (k.CLIENT_ID !== clientId) continue;
      if (k.KOT_DATE < from || k.KOT_DATE > to) continue;
      if (!k.STARTED_AT || !k.SERVED_AT) continue;
      const start = new Date(k.STARTED_AT).getTime();
      const served = new Date(k.SERVED_AT).getTime();
      if (isNaN(start) || isNaN(served) || served <= start) continue;
      const mins = +((served - start) / 60000).toFixed(1);
      if (mins > 240) continue;
      durations.push(mins);
      rows.push({ kotNumber: k.KOT_NUMBER, table: k.TABLE_ID, date: k.KOT_DATE, startedAt: k.STARTED_AT, servedAt: k.SERVED_AT, minutes: mins });
    }
    const avgMinutes = durations.length ? +(durations.reduce((s, m) => s + m, 0) / durations.length).toFixed(1) : null;
    return { success: true, data: { rows, avgMinutes, sampleSize: durations.length, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetKdsReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxCancelOrderItem(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const orderItemId = payload.orderItemId || payload.ORDER_ITEM_ID || '';
  const reason = payload.reason || '';
  if (!orderItemId) return { success: false, error: 'orderItemId required' };
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ORDER_ITEMS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('ORDER_ITEM_ID');
    const statusCol = headers.indexOf('ITEM_STATUS');
    const reasonCol = headers.indexOf('CANCEL_REASON');
    const byCol = headers.indexOf('CANCELLED_BY');
    const atCol = headers.indexOf('CANCELLED_AT');
    for (let r = 1; r < values.length; r++) {
      if (values[r][idCol] !== orderItemId) continue;
      if (statusCol !== -1) sheet.getRange(r + 1, statusCol + 1).setValue('CANCELLED');
      if (reasonCol !== -1) sheet.getRange(r + 1, reasonCol + 1).setValue(reason);
      if (byCol !== -1) sheet.getRange(r + 1, byCol + 1).setValue(userId);
      if (atCol !== -1) sheet.getRange(r + 1, atCol + 1).setValue(new Date().toISOString());
      bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CANCEL', MODULE: 'KITCHEN', RECORD_TYPE: 'ORDER_ITEM', RECORD_ID: orderItemId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ reason }), TIMESTAMP: new Date().toISOString() });
      return { success: true };
    }
    return { success: false, error: 'Order item not found' };
  } catch (error) {
    bnxLogError(clientId, `bnxCancelOrderItem failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetCancelledItemsReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('cancelleditems', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetCancelledItemsReport_impl_(session, payload));
}
function bnxGetCancelledItemsReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const orderValues = orderSheet.getDataRange().getValues();
    const orderHeaders = orderValues[0];
    const orderById = {};
    for (let r = 1; r < orderValues.length; r++) {
      const o = bnxRowToObject(orderValues[r], orderHeaders);
      if (o.CLIENT_ID !== clientId) continue;
      if (o.ORDER_DATE < from || o.ORDER_DATE > to) continue;
      orderById[o.ORDER_ID] = o;
    }
    const itemSheet = bnxClientSheet(clientId, SHEETS.ORDER_ITEMS);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0];
    const hasReason = itemHeaders.indexOf('CANCEL_REASON') !== -1;
    const rows = [];
    let totalValue = 0;
    for (let r = 1; r < itemValues.length; r++) {
      const it = bnxRowToObject(itemValues[r], itemHeaders);
      if (it.ITEM_STATUS !== 'CANCELLED') continue;
      const order = orderById[it.ORDER_ID];
      if (!order) continue;
      const value = Number(it.LINE_TOTAL) || 0;
      totalValue += value;
      rows.push({ date: order.ORDER_DATE, orderNo: order.ORDER_NUMBER, table: order.TABLE_ID, itemName: it.ITEM_NAME, qty: it.QUANTITY, value: value, reason: hasReason ? (it.CANCEL_REASON || '') : '', cancelledBy: it.CANCELLED_BY || '' });
    }
    return { success: true, data: { rows, totalValue, count: rows.length, reasonTracked: hasReason } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetCancelledItemsReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetTipsReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('tips', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetTipsReport_impl_(session, payload));
}
function bnxGetTipsReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    if (headers.indexOf('TIPS_AMOUNT') === -1) {
      return { success: true, data: { rows: [], total: 0, note: 'PAYMENT_MASTER has no TIPS_AMOUNT column yet -- add it to make this real (bnxSaveBill/bnxSavePayment already write to it once it exists).' } };
    }
    const byStaff = {};
    let total = 0;
    for (let r = 1; r < values.length; r++) {
      const p = bnxRowToObject(values[r], headers);
      if (p.CLIENT_ID !== clientId) continue;
      const _payDateKey = bnxNormalizeDateKey_(p.PAYMENT_DATE); if (!_payDateKey || _payDateKey < from || _payDateKey > to) continue;
      const tip = Number(p.TIPS_AMOUNT) || 0;
      if (tip <= 0) continue;
      total += tip;
      const staff = p.CREATED_BY || 'Unknown';
      byStaff[staff] = (byStaff[staff] || 0) + tip;
    }
    const rows = Object.keys(byStaff).map(staff => ({ staff, tips: byStaff[staff] })).sort((a, b) => b.tips - a.tips);
    return { success: true, data: { rows, total, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetTipsReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetNcReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('nc', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetNcReport_impl_(session, payload));
}
function bnxGetNcReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const hasReason = billHeaders.indexOf('NC_REASON') !== -1;
    const ncBills = [];
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      if ((Number(b.GRAND_TOTAL) || 0) > 0) continue;
      ncBills.push(b);
    }
    const itemSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0];
    const valueByBillId = {};
    for (let r = 1; r < itemValues.length; r++) {
      const it = bnxRowToObject(itemValues[r], itemHeaders);
      const menuValue = (Number(it.QUANTITY) || 0) * (Number(it.RATE) || 0);
      valueByBillId[it.BILL_ID] = (valueByBillId[it.BILL_ID] || 0) + menuValue;
    }
    let totalGivenAway = 0;
    const rows = ncBills.map(b => {
      const val = valueByBillId[b.BILL_ID] || 0;
      totalGivenAway += val;
      return { date: b.BILL_DATE, billNo: b.BILL_NUMBER, table: b.TABLE_ID, customer: b.CUSTOMER_NAME, menuValue: val, reason: hasReason ? (b.NC_REASON || '') : '', approvedBy: hasReason ? (b.NC_APPROVED_BY || '') : '', staff: b.CREATED_BY || '' };
    });
    return { success: true, data: { rows, totalGivenAway, count: rows.length, reasonTracked: hasReason } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetNcReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetConsumptionReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('consumption', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetConsumptionReport_impl_(session, payload));
}
function bnxGetConsumptionReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const mode = payload.mode || 'item';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const billMeta = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      billMeta[b.BILL_ID] = { date: b.BILL_DATE, hour: (b.BILL_TIME || '00:00:00').split(':')[0] };
    }

    const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const imValues = imSheet.getDataRange().getValues();
    const imHeaders = imValues[0];
    const catMap = bnxCachedCategoryNameMap_(clientId);
    const itemMetaByName = {};
    for (let r = 1; r < imValues.length; r++) {
      const it = bnxRowToObject(imValues[r], imHeaders);
      if (it.CLIENT_ID !== clientId) continue;
      const key = String(it.ITEM_NAME || '').toLowerCase().trim();
      itemMetaByName[key] = { category: catMap.byId[it.CATEGORY_ID] || 'Uncategorised', itemId: it.ITEM_ID };
    }

    const recipeByItemId = {};
    try {
      const rmSheet = bnxClientSheet(clientId, SHEETS.RECIPE_MASTER);
      const rmValues = rmSheet.getDataRange().getValues();
      const rmHeaders = rmValues[0];
      for (let r = 1; r < rmValues.length; r++) {
        const rec = bnxRowToObject(rmValues[r], rmHeaders);
        if (rec.CLIENT_ID !== clientId || !rec.ITEM_ID) continue;
        recipeByItemId[rec.ITEM_ID] = rec.RECIPE_ID;
      }
    } catch (e) {}
    const ingredientsByRecipeId = {};
    try {
      const riSheet = bnxClientSheet(clientId, SHEETS.RECIPE_ITEMS);
      const riValues = riSheet.getDataRange().getValues();
      const riHeaders = riValues[0];
      for (let r = 1; r < riValues.length; r++) {
        const ri = bnxRowToObject(riValues[r], riHeaders);
        if (!ri.RECIPE_ID) continue;
        if (!ingredientsByRecipeId[ri.RECIPE_ID]) ingredientsByRecipeId[ri.RECIPE_ID] = [];
        ingredientsByRecipeId[ri.RECIPE_ID].push({ componentItemId: ri.COMPONENT_ITEM_ID, qtyPerUnit: Number(ri.QUANTITY) || 0, unitId: ri.UNIT_ID || '' });
      }
    } catch (e) {}
    const rawNameById = {};
    try {
      const rawSheet = bnxClientSheet(clientId, SHEETS.RAW_MATERIAL_MASTER);
      const rawValues = rawSheet.getDataRange().getValues();
      const rawHeaders = rawValues[0];
      for (let r = 1; r < rawValues.length; r++) {
        const raw = bnxRowToObject(rawValues[r], rawHeaders);
        if (raw.ITEM_ID) rawNameById[raw.ITEM_ID] = raw.ITEM_NAME;
      }
    } catch (e) {}

    const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const biValues = biSheet.getDataRange().getValues();
    const biHeaders = biValues[0];
    const bucket = {};
    let recipeBackedCount = 0, fallbackCount = 0;

    for (let r = 1; r < biValues.length; r++) {
      const it = bnxRowToObject(biValues[r], biHeaders);
      const meta = billMeta[it.BILL_ID];
      if (!meta) continue;
      const nameKey = String(it.ITEM_NAME || '').toLowerCase().trim();
      const im = itemMetaByName[nameKey] || {};
      const qty = Number(it.QUANTITY) || 0;
      const revenue = Number(it.LINE_TOTAL) || 0;
      const recipeId = im.itemId ? recipeByItemId[im.itemId] : undefined;
      const ingredients = recipeId ? ingredientsByRecipeId[recipeId] : undefined;

      const groupKey = mode === 'category' ? (im.category || 'Uncategorised')
        : mode === 'time' ? (meta.hour + ':00')
        : (it.ITEM_NAME || 'Unknown Item');

      if (ingredients && ingredients.length) {
        recipeBackedCount++;
        ingredients.forEach(ing => {
          const consumedQty = ing.qtyPerUnit * qty;
          const ingKey = groupKey + ' | ' + (rawNameById[ing.componentItemId] || ing.componentItemId);
          if (!bucket[ingKey]) bucket[ingKey] = { group: groupKey, name: rawNameById[ing.componentItemId] || ing.componentItemId, qty: 0, unit: ing.unitId, revenue: 0, level: 'ingredient' };
          bucket[ingKey].qty += consumedQty;
          bucket[ingKey].revenue += revenue;
        });
      } else {
        fallbackCount++;
        const fbKey = groupKey + ' | ' + (it.ITEM_NAME || '');
        if (!bucket[fbKey]) bucket[fbKey] = { group: groupKey, name: it.ITEM_NAME || 'Unknown', qty: 0, unit: it.UNIT_ID || '', revenue: 0, level: 'menu_item_fallback' };
        bucket[fbKey].qty += qty;
        bucket[fbKey].revenue += revenue;
      }
    }
    const rows = Object.values(bucket).sort((a, b) => b.qty - a.qty);
    return { success: true, data: { mode, rows, from, to, recipeBackedLineItems: recipeBackedCount, menuItemFallbackLineItems: fallbackCount,
      note: fallbackCount > 0 ? (fallbackCount + ' line item(s) reported at finished-menu-item level because no RECIPE_MASTER/RECIPE_ITEMS entry exists for them yet -- add recipes in Recipe Master to get true raw-ingredient consumption for those items.') : 'All line items resolved through a real recipe.' } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetConsumptionReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetBlindTillReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const businessDate = payload.businessDate || payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
  try {
    let expectedCash = 0;
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (p.PAYMENT_DATE !== businessDate) continue;
      if (String(p.PAYMENT_MODE).toUpperCase() !== 'CASH') continue;
      expectedCash += Number(p.AMOUNT) || 0;
    }
    let cashCounted = null, status = 'NOT_CLOSED';
    const daySheet = bnxClientSheet(clientId, SHEETS.DAY_STATUS);
    const dayValues = daySheet.getDataRange().getValues();
    const dayHeaders = dayValues[0];
    for (let r = 1; r < dayValues.length; r++) {
      const d = bnxRowToObject(dayValues[r], dayHeaders);
      if (d.CLIENT_ID !== clientId || d.BUSINESS_DATE !== businessDate) continue;
      status = d.STATUS || 'OPEN';
      if (d.CASH_COUNTED !== undefined && d.CASH_COUNTED !== '') cashCounted = Number(d.CASH_COUNTED) || 0;
      break;
    }
    const variance = cashCounted !== null ? +(cashCounted - expectedCash).toFixed(2) : null;
    return { success: true, data: { businessDate, expectedCash, cashCounted, variance, dayStatus: status } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetBlindTillReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetBillForReprint(session, payload) {
  const clientId = session.CLIENT_ID;
  const billNumber = payload.billNumber || payload.BILL_NUMBER || '';
  const billId = payload.billId || payload.BILL_ID || '';
  if (!billNumber && !billId) return { success: false, error: 'billNumber or billId required' };
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    let bill = null;
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (billId && b.BILL_ID === billId) { bill = b; break; }
      if (billNumber && b.BILL_NUMBER === billNumber) { bill = b; break; }
    }
    if (!bill) return { success: false, error: 'Bill not found' };
    const itemSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0];
    const items = [];
    for (let r = 1; r < itemValues.length; r++) {
      const it = bnxRowToObject(itemValues[r], itemHeaders);
      if (it.BILL_ID !== bill.BILL_ID) continue;
      items.push({ name: it.ITEM_NAME, qty: it.QUANTITY, rate: it.RATE, amount: it.LINE_TOTAL });
    }
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    const payments = [];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.BILL_ID !== bill.BILL_ID) continue;
      payments.push({ mode: p.PAYMENT_MODE, amount: p.AMOUNT });
    }
    return { success: true, data: { bill, items, payments } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetBillForReprint failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetInstructionsReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('instructions', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetInstructionsReport_impl_(session, payload));
}
function bnxGetInstructionsReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const rows = [];
    const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const orderValues = orderSheet.getDataRange().getValues();
    const orderHeaders = orderValues[0];
    for (let r = 1; r < orderValues.length; r++) {
      const o = bnxRowToObject(orderValues[r], orderHeaders);
      if (o.CLIENT_ID !== clientId) continue;
      if (o.ORDER_DATE < from || o.ORDER_DATE > to) continue;
      if (!o.SPECIAL_INSTRUCTIONS) continue;
      rows.push({ date: o.ORDER_DATE, time: o.ORDER_TIME, source: 'ORDER', ref: o.ORDER_NUMBER, table: o.TABLE_ID, note: o.SPECIAL_INSTRUCTIONS, by: o.STARTED_BY || '' });
    }
    const kotSheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const kotValues = kotSheet.getDataRange().getValues();
    const kotHeaders = kotValues[0];
    for (let r = 1; r < kotValues.length; r++) {
      const k = bnxRowToObject(kotValues[r], kotHeaders);
      if (k.CLIENT_ID !== clientId) continue;
      if (k.KOT_DATE < from || k.KOT_DATE > to) continue;
      if (!k.KITCHEN_NOTES) continue;
      rows.push({ date: k.KOT_DATE, time: k.KOT_TIME, source: 'KOT', ref: k.KOT_NUMBER, table: k.TABLE_ID, note: k.KITCHEN_NOTES, by: k.STARTED_BY || '' });
    }
    rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return { success: true, data: { rows, count: rows.length, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetInstructionsReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetGstrSummary(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('gstr', clientId, payload);
  return bnxCachedReport_(cacheKey, 30, () => bnxGetGstrSummary_impl_(session, payload));
}
function bnxGetGstrSummary_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const billMeta = {};
    let grossTaxable = 0, grossTax = 0;
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && String(b.LOCATION_ID || '') !== String(locationId)) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      billMeta[b.BILL_ID] = true;
      grossTaxable += Number(b.TAXABLE_AMOUNT) || 0;
      grossTax += Number(b.TAX_AMOUNT) || 0;
    }
    const hsnByName = {};
    try {
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        if (it.CLIENT_ID !== clientId) continue;
        hsnByName[String(it.ITEM_NAME || '').toLowerCase().trim()] = it.HSN_CODE || 'UNSPECIFIED';
      }
    } catch (e) {}
    const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const biValues = biSheet.getDataRange().getValues();
    const biHeaders = biValues[0];
    const byHsn = {};
    for (let r = 1; r < biValues.length; r++) {
      const it = bnxRowToObject(biValues[r], biHeaders);
      if (!billMeta[it.BILL_ID]) continue;
      const hsn = hsnByName[String(it.ITEM_NAME || '').toLowerCase().trim()] || 'UNSPECIFIED';
      const rate = Number(it.TAX_RATE) || 0;
      const key = hsn + '@' + rate;
      if (!byHsn[key]) byHsn[key] = { hsn, ratePct: +(rate * 100).toFixed(2), taxableValue: 0, taxAmount: 0, qty: 0 };
      byHsn[key].taxableValue += Number(it.TAXABLE_PER_ITEM) || 0;
      byHsn[key].taxAmount += Number(it.TAX_PER_ITEM) || 0;
      byHsn[key].qty += Number(it.QUANTITY) || 0;
    }
    const rows = Object.values(byHsn).sort((a, b) => b.taxableValue - a.taxableValue);
    return { success: true, data: { rows, grossTaxable, grossTax, locationId, from, to,
      isFilingReady: false,
      note: 'HSN-wise summary from real sales data. Not a filing-ready GSTR-1/3B export -- no B2B/B2C or place-of-supply split exists in this app yet. Verify with your CA before use.' } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetGstrSummary failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

/* NOTE: bnxPostBillToLedger_, bnxGetDayBookReport, bnxGetDayBookReport_impl_
   and BNX_DAYBOOK_ACCOUNT_MAP_ are intentionally NOT defined here -- the
   report-engine section below (PASS #59-#62) defines the real, final
   versions (posts to real ledger accounts via bnxGetOrCreateLedgerAccount_
   instead of an assumed flat account-name map). Do not add a second copy. */

function bnxGetSmartcardReport(session, payload) {
  return { success: true, data: { rows: [], available: false,
    note: 'No smartcard/prepaid-card system exists in this schema yet -- needs a new SMARTCARD_ACCOUNT_MASTER (balance ledger) and SMARTCARD_TRANSACTION (top-up/debit log) table, plus a top-up UI and a debit-at-billing step. This is a real feature to build, not a report to wire up.' } };
}

function bnxSaveProduction(session, payload) {
  const requestId = payload.requestId || '';
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, 'PRODUCTION');
  if (!claim.claimed) {
    return { success: true, transactionId: claim.existing.transactionId, message: 'Duplicate request detected -- using previous result', cached: true };
  }
  if (!payload.recipeKey && !payload.recipeName) {
    return respondError(400, 'recipeKey/recipeName required', requestId);
  }
  try {
    const now = bnxNowParts_();
    const productionId = generateShortId_(clientId, 'PRODUCTION_ID');
    const record = {
      PRODUCTION_ID: productionId, CLIENT_ID: clientId, LOCATION_ID: payload.locationId || '',
      PROD_NO: payload.no || '', PROD_DATE: payload.date || now.businessDate, PROD_TIME: payload.time || now.time,
      SHIFT: payload.shift || '', RECIPE_KEY: payload.recipeKey || '', RECIPE_NAME: payload.recipeName || '',
      CHEF: payload.chef || '', BATCHES: Number(payload.batches) || 1,
      EXPECTED_OUTPUT: payload.expOut || '', ACTUAL_OUTPUT: payload.actOut || '', OUTPUT_UNIT: payload.outputUnit || '',
      YIELD_PCT: payload.yieldPct || '', REMARKS: payload.remarks || '', STATUS: payload.status || 'completed',
      CREATED_BY: userId, CREATED_AT: now.iso
    };
    bnxAppendRow(clientId, SHEETS.PRODUCTION_MASTER, record);
    (payload.ingredients || []).forEach((ing, idx) => {
      bnxAppendRow(clientId, SHEETS.PRODUCTION_ITEMS, {
        PRODUCTION_ITEM_ID: generateShortId_(clientId, 'PRODUCTION_ITEM_ID'), PRODUCTION_ID: productionId,
        SEQUENCE: idx + 1, INGREDIENT_NAME: ing.name || '', UNIT: ing.unit || '',
        STD_QTY: ing.std || '', ACTUAL_QTY: ing.actual || '', NOTES: ing.notes || '', CREATED_AT: now.iso
      });
    });
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'PRODUCTION', RECORD_TYPE: 'PRODUCTION', RECORD_ID: productionId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(record), REQUEST_ID: requestId, TIMESTAMP: now.iso });
    bnxMarkSynced(clientId, requestId, productionId, 'PRODUCTION');
    return { success: true, transactionId: productionId, data: record };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveProduction failed: ${error.message}`, { requestId, payload });
    return respondError(500, error.message, requestId);
  }
}

function bnxSaveMenuCardUpload(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const name = payload.name || '';
  if (!name) return { success: false, message: 'name required' };
  try {
    const now = bnxNowParts_();
    const uploadId = generateShortId_(clientId, 'MENU_CARD_UPLOAD_ID');
    if (payload.active) {
      try {
        const sheet = bnxClientSheet(clientId, SHEETS.MENU_CARD_UPLOAD);
        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        const ciCol = headers.indexOf('CLIENT_ID');
        const activeCol = headers.indexOf('IS_ACTIVE');
        if (activeCol !== -1) {
          for (let r = 1; r < values.length; r++) {
            if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
            if (values[r][activeCol] === true || values[r][activeCol] === 'true') sheet.getRange(r + 1, activeCol + 1).setValue(false);
          }
        }
      } catch (e) {}
    }
    const record = {
      MENU_CARD_UPLOAD_ID: uploadId, CLIENT_ID: clientId, NAME: name,
      FILE_NAME: payload.fileName || '', MIME_TYPE: payload.mime || '',
      IS_ACTIVE: !!payload.active, UPLOADED_BY: userId, CREATED_AT: now.iso
    };
    bnxAppendRow(clientId, SHEETS.MENU_CARD_UPLOAD, record);
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'MENU_CARD', RECORD_TYPE: 'MENU_CARD_UPLOAD', RECORD_ID: uploadId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(record), TIMESTAMP: now.iso });
    return { success: true, transactionId: uploadId, data: record, note: 'Metadata saved for real. The file image itself is NOT stored server-side yet -- Sheets cells cannot hold a full image/PDF; needs Drive-backed storage to sync the actual file across devices.' };
  } catch (error) {
    bnxLogError(clientId, `bnxSaveMenuCardUpload failed: ${error.message}`, payload);
    return { success: false, message: error.message };
  }
}

/**
 * PATCH v2 -- bnxRebuildStockBalance: REORDER_LEVEL sync (hasOwnProperty-
 * checked so "no ITEM_MASTER row" is never confused with "REORDER_LEVEL
 * 0") + zero-movement item seeding (an active ITEM_MASTER item that has
 * never had a single STOCK_MOVEMENT row now gets a seeded zero-quantity
 * STOCK_BALANCE row, so Low Stock alerts can actually see it once it is
 * genuinely out of stock).
 */
function bnxRebuildStockBalance(session, payload) {
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  try {
    const moveSheet = bnxClientSheet(clientId, SHEETS.STOCK_MOVEMENT);
    const moveValues = moveSheet.getDataRange().getValues();
    const moveHeaders = moveValues[0];
    const totals = {};
    for (let r = 1; r < moveValues.length; r++) {
      const m = bnxRowToObject(moveValues[r], moveHeaders);
      if (m.CLIENT_ID !== clientId) continue;
      if (!m.ITEM_ID) continue;
      const locationId = m.LOCATION_ID || '';
      const key = m.ITEM_ID + '|' + locationId;
      if (!totals[key]) totals[key] = { itemId: m.ITEM_ID, locationId: locationId, qtyIn: 0, qtyOut: 0, lastMovementAt: '' };
      totals[key].qtyIn += Number(m.QUANTITY_IN) || 0;
      totals[key].qtyOut += Number(m.QUANTITY_OUT) || 0;
      if (m.CREATED_AT && m.CREATED_AT > totals[key].lastMovementAt) totals[key].lastMovementAt = m.CREATED_AT;
    }

    // Real reorder level per item, straight from ITEM_MASTER -- read once,
    // used below both for items with movements AND for seeding
    // zero-movement items. hasOwnProperty-checked so "no ITEM_MASTER row"
    // is never confused with "ITEM_MASTER row with REORDER_LEVEL 0".
    const reorderByItemId = {};
    const activeItemIds = []; // every active item, used for the zero-movement seed pass below
    try {
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        if (it.CLIENT_ID !== clientId) continue;
        if (!it.ITEM_ID) continue;
        if (it.IS_ACTIVE === false || it.IS_ACTIVE === 'false' || it.IS_ACTIVE === 'FALSE') continue;
        reorderByItemId[it.ITEM_ID] = Number(it.REORDER_LEVEL) || 0;
        activeItemIds.push(it.ITEM_ID);
      }
    } catch (e) {
      console.warn('[bnxRebuildStockBalance] ITEM_MASTER read failed, reorder levels will default to 0: ' + e.message);
    }
    const itemMasterFound = (itemId) => Object.prototype.hasOwnProperty.call(reorderByItemId, itemId);

    const balSheet = bnxClientSheet(clientId, SHEETS.STOCK_BALANCE);
    const balValues = balSheet.getDataRange().getValues();
    const balHeaders = balValues[0];
    const ciCol = balHeaders.indexOf('CLIENT_ID');
    const itemCol = balHeaders.indexOf('ITEM_ID');
    const locCol = balHeaders.indexOf('LOCATION_ID');
    const curCol = balHeaders.indexOf('CURRENT_QUANTITY');
    const availCol = balHeaders.indexOf('AVAILABLE_QUANTITY');
    const reorderCol = balHeaders.indexOf('REORDER_LEVEL');
    const lastMoveCol = balHeaders.indexOf('LAST_MOVEMENT_AT');
    const updatedCol = balHeaders.indexOf('UPDATED_AT');
    const existingRowByKey = {};
    const existingItemIds = {}; // any location -- used to know which active items still need a zero-seed row
    for (let r = 1; r < balValues.length; r++) {
      if (ciCol !== -1 && balValues[r][ciCol] !== clientId) continue;
      const key = balValues[r][itemCol] + '|' + (locCol !== -1 ? (balValues[r][locCol] || '') : '');
      existingRowByKey[key] = r;
      existingItemIds[balValues[r][itemCol]] = true;
    }

    const nowIso = new Date().toISOString();
    let updated = 0, created = 0, seeded = 0;
    const beforeAfter = [];
    const missingItemMasterIds = []; // items seen in STOCK_MOVEMENT but with no ITEM_MASTER row -- real data-quality flag

    // Pass 1: every item that has at least one real movement.
    Object.keys(totals).forEach(key => {
      const t = totals[key];
      const newQty = +(t.qtyIn - t.qtyOut).toFixed(4);
      const found = itemMasterFound(t.itemId);
      const realReorder = found ? reorderByItemId[t.itemId] : 0;
      if (!found && missingItemMasterIds.indexOf(t.itemId) === -1) missingItemMasterIds.push(t.itemId);
      const existingRow = existingRowByKey[key];
      if (existingRow !== undefined) {
        const oldQty = Number(balValues[existingRow][curCol]) || 0;
        const oldReorder = reorderCol !== -1 ? (Number(balValues[existingRow][reorderCol]) || 0) : 0;
        const qtyChanged = oldQty !== newQty;
        const reorderChanged = reorderCol !== -1 && found && oldReorder !== realReorder;
        if (qtyChanged) {
          balSheet.getRange(existingRow + 1, curCol + 1).setValue(newQty);
          if (availCol !== -1) {
            const reserved = Number(balValues[existingRow][balHeaders.indexOf('RESERVED_QUANTITY')]) || 0;
            balSheet.getRange(existingRow + 1, availCol + 1).setValue(+(newQty - reserved).toFixed(4));
          }
          if (lastMoveCol !== -1) balSheet.getRange(existingRow + 1, lastMoveCol + 1).setValue(t.lastMovementAt);
        }
        if (reorderChanged) balSheet.getRange(existingRow + 1, reorderCol + 1).setValue(realReorder);
        if ((qtyChanged || reorderChanged) && updatedCol !== -1) balSheet.getRange(existingRow + 1, updatedCol + 1).setValue(nowIso);
        if (qtyChanged || reorderChanged) {
          beforeAfter.push({ itemId: t.itemId, locationId: t.locationId, before: oldQty, after: newQty, reorderBefore: oldReorder, reorderAfter: realReorder, itemMasterFound: found });
          updated++;
        }
      } else {
        bnxAppendRow(clientId, SHEETS.STOCK_BALANCE, {
          STOCK_BALANCE_ID: generateShortId_(clientId, 'STOCK_BALANCE_ID'),
          CLIENT_ID: clientId, LOCATION_ID: t.locationId, ITEM_ID: t.itemId,
          CURRENT_QUANTITY: newQty, RESERVED_QUANTITY: 0, AVAILABLE_QUANTITY: newQty,
          REORDER_LEVEL: realReorder,
          LAST_MOVEMENT_AT: t.lastMovementAt, UPDATED_AT: nowIso
        });
        beforeAfter.push({ itemId: t.itemId, locationId: t.locationId, before: null, after: newQty, reorderBefore: null, reorderAfter: realReorder, itemMasterFound: found });
        existingItemIds[t.itemId] = true;
        created++;
      }
    });

    // Pass 2: active ITEM_MASTER items that have NEVER had a
    // STOCK_MOVEMENT row and don't already have a STOCK_BALANCE row --
    // seed them at zero quantity so a genuinely never-stocked item with
    // a real REORDER_LEVEL can actually show up in the Low Stock scan.
    activeItemIds.forEach(itemId => {
      if (existingItemIds[itemId]) return;
      const realReorder = reorderByItemId[itemId] || 0;
      bnxAppendRow(clientId, SHEETS.STOCK_BALANCE, {
        STOCK_BALANCE_ID: generateShortId_(clientId, 'STOCK_BALANCE_ID'),
        CLIENT_ID: clientId, LOCATION_ID: '', ITEM_ID: itemId,
        CURRENT_QUANTITY: 0, RESERVED_QUANTITY: 0, AVAILABLE_QUANTITY: 0,
        REORDER_LEVEL: realReorder,
        LAST_MOVEMENT_AT: '', UPDATED_AT: nowIso
      });
      beforeAfter.push({ itemId: itemId, locationId: '', before: null, after: 0, reorderBefore: null, reorderAfter: realReorder, itemMasterFound: true, seeded: true });
      seeded++;
    });

    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, USER_ID: userId, ACTION: 'REBUILD', MODULE: 'INVENTORY',
      RECORD_TYPE: 'STOCK_BALANCE', RECORD_ID: 'BULK', OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify({ updated: updated, created: created, seeded: seeded, itemsProcessed: Object.keys(totals).length, missingItemMasterCount: missingItemMasterIds.length }),
      TIMESTAMP: nowIso
    });

    return {
      success: true,
      data: {
        itemsProcessed: Object.keys(totals).length,
        updated: updated,
        created: created,
        seededZeroMovementItems: seeded,
        unchanged: Object.keys(totals).length - updated - created,
        sample: beforeAfter.slice(0, 25),
        reorderLevelColumnFound: reorderCol !== -1,
        missingItemMasterIds: missingItemMasterIds.slice(0, 25),
        note: (reorderCol === -1
          ? 'STOCK_BALANCE has no REORDER_LEVEL column in this client\'s sheet -- add it to make Low Stock alerts work at all. Quantities were still rebuilt correctly. '
          : '') + (missingItemMasterIds.length
          ? (missingItemMasterIds.length + ' item ID(s) appear in STOCK_MOVEMENT but have no matching ITEM_MASTER row -- their reorder level defaulted to 0 (genuinely unknown, not a real zero). See missingItemMasterIds.')
          : '') || undefined
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxRebuildStockBalance failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetItemUnitConversions(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const unitSheet = bnxClientSheet(clientId, SHEETS.UNIT_MASTER);
    const unitValues = unitSheet.getDataRange().getValues();
    const unitHeaders = unitValues[0];
    const hasConversionColumns =
      unitHeaders.indexOf('UNITS_PER_PACK') !== -1 &&
      unitHeaders.indexOf('UNIT_SIZE') !== -1 &&
      unitHeaders.indexOf('BASE_UOM') !== -1;

    if (!hasConversionColumns) {
      return { success: true, data: { conversions: {}, schemaReady: false,
        note: 'UNIT_MASTER has no UNITS_PER_PACK/UNIT_SIZE/BASE_UOM columns yet -- add them to start getting real per-item conversions instead of category defaults.' } };
    }

    const unitById = {};
    for (let r = 1; r < unitValues.length; r++) {
      const u = bnxRowToObject(unitValues[r], unitHeaders);
      if (u.CLIENT_ID !== clientId) continue;
      const unitsPerPack = Number(u.UNITS_PER_PACK) || 0;
      const unitSize = Number(u.UNIT_SIZE) || 0;
      if (unitsPerPack <= 0 && unitSize <= 0) continue;
      unitById[u.UNIT_ID] = {
        unitsPerPack: unitsPerPack || 1,
        unitSize: unitSize || 0,
        baseUOM: u.BASE_UOM || ''
      };
    }

    const itemSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemHeaders = itemValues[0];
    const conversions = {};
    for (let r = 1; r < itemValues.length; r++) {
      const it = bnxRowToObject(itemValues[r], itemHeaders);
      if (it.CLIENT_ID !== clientId) continue;
      const unitConv = unitById[it.UNIT_ID];
      if (!unitConv) continue;
      conversions[it.ITEM_ID] = {
        itemName: it.ITEM_NAME || '',
        unitsPerPack: unitConv.unitsPerPack,
        unitSize: unitConv.unitSize,
        baseUOM: unitConv.baseUOM,
        bottleML: /^ml$/i.test(unitConv.baseUOM) ? unitConv.unitSize : 0
      };
    }

    return { success: true, data: { conversions: conversions, schemaReady: true, itemCount: Object.keys(conversions).length } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetItemUnitConversions failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

/* ============================================================================
 * REPORT ENGINE (merged PASS #59-#63) -- previously a separate Apps Script
 * file; now part of this single Code.gs. Real ledger posting, Sales Day
 * Book, Payment/Cash-Bank/Dues/P&L reports, Item/Category sales +
 * reconciliation, Stock/Purchase/GST/Cost/Performance reports, and the
 * Cash Book + Discount Report period-filter fix.
 * ============================================================================ */

function bnxAppendRowsBatch_(clientId, sheetName, rowObjects) {
  if (!rowObjects || !rowObjects.length) return;
  const sheet = bnxClientSheet(clientId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = rowObjects.map(rowObject => headers.map(header => {
    const v = rowObject[header];
    return (v === undefined || v === null) ? '' : v;
  }));
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function bnxCachedLedgerAccountMap_(clientId) {
  const key = 'ledgermap_' + clientId;
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const map = {};
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.LEDGER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const codeCol = headers.indexOf('LEDGER_CODE');
    const idCol = headers.indexOf('LEDGER_ID');
    const nameCol = headers.indexOf('LEDGER_NAME');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      const code = codeCol !== -1 ? values[r][codeCol] : '';
      const id = idCol !== -1 ? values[r][idCol] : '';
      // Keyed by LEDGER_CODE when present (the normal case going
      // forward); falls back to the ledger's NAME (uppercased) for any
      // older row that predates the LEDGER_CODE column, so accounts
      // created before this pass are still found without being
      // recreated as a duplicate.
      if (code && id) map[code] = id;
      else if (nameCol !== -1 && id) map[String(values[r][nameCol]).toUpperCase()] = id;
    }
  } catch (e) { console.warn('[bnxCachedLedgerAccountMap_] ' + e.message); }
  try { CacheService.getScriptCache().put(key, JSON.stringify(map), 60); } catch (e) {}
  return map;
}

function bnxInvalidateLedgerCache_(clientId) {
  try { CacheService.getScriptCache().remove('ledgermap_' + clientId); } catch (e) {}
}

function bnxGetOrCreateLedgerAccount_(clientId, code, defaultName, defaultGroup) {
  try {
    const map = bnxCachedLedgerAccountMap_(clientId);
    if (map[code]) return map[code];
    if (map[String(defaultName).toUpperCase()]) return map[String(defaultName).toUpperCase()];

    // Cache miss: re-check against the real sheet before creating, so
    // two bills racing on a brand-new client can't both decide the
    // account is missing off a stale cache and create two rows for the
    // same account -- same safeguard the original scan-every-time code
    // effectively had.
    const sheet = bnxClientSheet(clientId, SHEETS.LEDGER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const codeCol = headers.indexOf('LEDGER_CODE');
    const nameCol = headers.indexOf('LEDGER_NAME');
    const idCol = headers.indexOf('LEDGER_ID');
    for (let r = 1; r < values.length; r++) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      if (codeCol !== -1 && values[r][codeCol] === code) {
        bnxInvalidateLedgerCache_(clientId);
        return idCol !== -1 ? values[r][idCol] : code;
      }
      if (codeCol === -1 && nameCol !== -1 && String(values[r][nameCol]).toUpperCase() === defaultName.toUpperCase()) {
        bnxInvalidateLedgerCache_(clientId);
        return idCol !== -1 ? values[r][idCol] : code;
      }
    }
    const newId = generateShortId_(clientId, 'LEDGER_ID');
    bnxAppendRow(clientId, SHEETS.LEDGER_MASTER, {
      LEDGER_ID: newId, CLIENT_ID: clientId, LEDGER_NAME: defaultName, LEDGER_CODE: code,
      LEDGER_GROUP: defaultGroup, CREATED_AT: new Date().toISOString()
    });
    bnxInvalidateLedgerCache_(clientId);
    return newId;
  } catch (e) {
    console.warn('[bnxGetOrCreateLedgerAccount_] ' + e.message);
    return code;
  }
}
function bnxLedgerNameMap_(clientId) {
  const map = {};
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.LEDGER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('LEDGER_ID');
    const nameCol = headers.indexOf('LEDGER_NAME');
    if (idCol === -1 || nameCol === -1) return map;
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
      map[values[r][idCol]] = values[r][nameCol];
    }
  } catch (e) {}
  return map;
}
function bnxPostBillToLedger_(clientId, bill, isPaid) {
  const journalId = generateShortId_(clientId, 'JOURNAL_ID');
  const now = new Date().toISOString();
  const salesAcct = bnxGetOrCreateLedgerAccount_(clientId, 'SALES', 'Sales', 'INCOME');
  const gstAcct = bnxGetOrCreateLedgerAccount_(clientId, 'GST_OUTPUT', 'GST Output', 'LIABILITY');
  const discAcct = bnxGetOrCreateLedgerAccount_(clientId, 'DISCOUNT_GIVEN', 'Discount Given', 'EXPENSE');
  const roundAcct = bnxGetOrCreateLedgerAccount_(clientId, 'ROUND_OFF', 'Round Off', 'INCOME');
  const cashAcct = bnxGetOrCreateLedgerAccount_(clientId, 'CASH', 'Cash', 'ASSET');
  const duesAcct = bnxGetOrCreateLedgerAccount_(clientId, 'CUSTOMER_DUES', 'Customer Dues', 'ASSET');

  const lines = [];
  const taxable = +Number(bill.TAXABLE_AMOUNT || 0).toFixed(2);
  const tax = +Number(bill.TAX_AMOUNT || 0).toFixed(2);
  const discount = +(Number(bill.BILL_DISCOUNT || 0) + Number(bill.ITEM_DISCOUNT || 0)).toFixed(2);
  const grand = +Number(bill.GRAND_TOTAL || 0).toFixed(2);
  const roundOff = +Number(bill.ROUND_OFF || 0).toFixed(2);

  if (taxable) lines.push({ ACCOUNT: salesAcct, DR: 0, CR: taxable });
  if (tax) lines.push({ ACCOUNT: gstAcct, DR: 0, CR: tax });
  if (discount) lines.push({ ACCOUNT: discAcct, DR: discount, CR: 0 });

  // The invoice total can be rounded from taxable + GST. That difference is
  // real accounting data and must be posted, not silently dropped.
  // Positive ROUND_OFF means the customer paid more than taxable+GST, so it
  // is credited to Round Off. Negative ROUND_OFF is debited.
  if (roundOff > 0) lines.push({ ACCOUNT: roundAcct, DR: 0, CR: roundOff });
  else if (roundOff < 0) lines.push({ ACCOUNT: roundAcct, DR: Math.abs(roundOff), CR: 0 });

  const debitAccount = isPaid ? cashAcct : duesAcct;
  if (grand) lines.push({ ACCOUNT: debitAccount, DR: grand, CR: 0 });

  const totalDr = +lines.reduce((s, l) => s + Number(l.DR || 0), 0).toFixed(2);
  const totalCr = +lines.reduce((s, l) => s + Number(l.CR || 0), 0).toFixed(2);
  if (Math.abs(totalDr - totalCr) > 0.01) {
    throw new Error('Bill ledger is not balanced: DR ₹' + totalDr.toFixed(2) + ' / CR ₹' + totalCr.toFixed(2));
  }

  // Match the real JOURNAL schema used by CL00010 while retaining the
  // reference fields used by newer templates.
  bnxAppendRow(clientId, SHEETS.JOURNAL, {
    JOURNAL_ID: journalId, CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '',
    JOURNAL_DATE: bill.BILL_DATE, JOURNAL_TYPE: 'SALES', SOURCE_TYPE: 'BILL', SOURCE_ID: bill.BILL_ID,
    REFERENCE_NUMBER: bill.BILL_NUMBER, DESCRIPTION: 'Sale - Bill ' + bill.BILL_NUMBER,
    TOTAL_DEBIT: totalDr, TOTAL_CREDIT: totalCr, CREATED_BY: bill.CREATED_BY || '', CREATED_AT: now,
    ENTRY_DATE: bill.BILL_DATE, REFERENCE_TYPE: 'BILL', REFERENCE_ID: bill.BILL_ID, NARRATION: 'Sale - Bill ' + bill.BILL_NUMBER
  });

  /* PASS #66: was a forEach calling bnxAppendRow per line (up to 6
     separate round-trips) -- now one batch write. */
  const ledgerEntryRows = lines.map(line => ({
    LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), CLIENT_ID: clientId,
    JOURNAL_ID: journalId, LOCATION_ID: bill.LOCATION_ID || '', ACCOUNT: line.ACCOUNT,
    ENTRY_DATE: bill.BILL_DATE, DEBIT: +Number(line.DR || 0).toFixed(2), CREDIT: +Number(line.CR || 0).toFixed(2),
    REFERENCE_TYPE: 'BILL', REFERENCE_ID: bill.BILL_ID, CREATED_AT: now
  }));
  bnxAppendRowsBatch_(clientId, SHEETS.LEDGER_ENTRIES, ledgerEntryRows);
}
function bnxGetDayBookReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('daybook', clientId, payload);
  return bnxCachedReport_(cacheKey, 20, () => bnxGetDayBookReport_impl_(session, payload));
}
function bnxGetDayBookReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    /*
     * SCHEMA-COMPATIBILITY FIX:
     * Older TRANSACTION_DB versions store CLIENT_ID / LOCATION_ID / ACCOUNT /
     * ENTRY_DATE on JOURNAL, while LEDGER_ENTRIES only has
     * LEDGER_ENTRY_ID, JOURNAL_ID, LEDGER_ID, DEBIT, CREDIT, DESCRIPTION,
     * CREATED_AT. The old implementation filtered LEDGER_ENTRIES directly by
     * e.CLIENT_ID/e.ENTRY_DATE, so every older-but-valid ledger line vanished.
     * Build the report from JOURNAL first, then join LEDGER_ENTRIES by JOURNAL_ID.
     * If a legacy line has no LEDGER_ID, do not invent an account: show the
     * journal/source description as the account label and preserve the real
     * debit/credit amounts.
     */
    const journalSheet = bnxClientSheet(clientId, SHEETS.JOURNAL || 'JOURNAL');
    const journalValues = journalSheet.getDataRange().getValues();
    const journalHeaders = journalValues[0] || [];
    const journals = {};
    const nameMap = bnxLedgerNameMap_(clientId);
    const journalIds = [];

    for (let r = 1; r < journalValues.length; r++) {
      const j = bnxRowToObject(journalValues[r], journalHeaders);
      if (j.CLIENT_ID && String(j.CLIENT_ID) !== String(clientId)) continue;
      const journalDate = String(j.JOURNAL_DATE || j.ENTRY_DATE || '').slice(0, 10);
      if (!journalDate || journalDate < from || journalDate > to) continue;
      if (locationId && j.LOCATION_ID && String(j.LOCATION_ID) !== String(locationId)) continue;
      const jid = String(j.JOURNAL_ID || '').trim();
      if (!jid) continue;
      journals[jid] = j;
      journalIds.push(jid);
    }

    const rows = [];
    const byAccount = {};
    let totalDebit = 0, totalCredit = 0;

    let entryRows = [];
    try {
      const entrySheet = bnxClientSheet(clientId, SHEETS.LEDGER_ENTRIES || 'LEDGER_ENTRIES');
      const entryValues = entrySheet.getDataRange().getValues();
      const entryHeaders = entryValues[0] || [];
      for (let r = 1; r < entryValues.length; r++) {
        const e = bnxRowToObject(entryValues[r], entryHeaders);
        const jid = String(e.JOURNAL_ID || '').trim();
        if (!jid || !journals[jid]) continue;
        entryRows.push({ e, j:journals[jid] });
      }
    } catch (e) {
      entryRows = [];
    }

    /* Legacy repair/fallback: a journal may exist with totals but no child
       ledger rows. Show one clearly labelled summary line rather than a blank
       report; this preserves the real accounting amount without fabricating
       ledger accounts. */
    if (!entryRows.length) {
      Object.keys(journals).forEach(jid => {
        const j = journals[jid];
        const dr = Number(j.TOTAL_DEBIT) || 0;
        const cr = Number(j.TOTAL_CREDIT) || 0;
        if (!(dr || cr)) return;
        const account = String(j.JOURNAL_TYPE || j.SOURCE_TYPE || 'UNMAPPED JOURNAL').trim();
        const row = {
          LEDGER_ENTRY_ID: '', JOURNAL_ID: jid, LEDGER_ID: '',
          ENTRY_DATE: String(j.JOURNAL_DATE || '').slice(0,10),
          REFERENCE_NUMBER: j.REFERENCE_NUMBER || j.REFERENCE_ID || j.SOURCE_ID || '',
          REFERENCE_ID: j.SOURCE_ID || '', REFERENCE_TYPE: j.SOURCE_TYPE || '',
          JOURNAL_TYPE: j.JOURNAL_TYPE || '', ACCOUNT: account, ACCOUNT_NAME: account,
          DEBIT: dr, CREDIT: cr, DESCRIPTION: j.DESCRIPTION || '', SOURCE_ID: j.SOURCE_ID || '', SOURCE_TYPE: j.SOURCE_TYPE || '',
          CREATED_AT: j.CREATED_AT || ''
        };
        rows.push(row);
        const key = account || 'UNMAPPED JOURNAL';
        if (!byAccount[key]) byAccount[key] = { account:key, accountName:key, debit:0, credit:0 };
        byAccount[key].debit += dr; byAccount[key].credit += cr;
        totalDebit += dr; totalCredit += cr;
      });
    } else {
      entryRows.forEach(({e,j}) => {
        const entryDate = String(j.JOURNAL_DATE || e.ENTRY_DATE || e.CREATED_AT || '').slice(0,10);
        const ledgerId = String(e.LEDGER_ID || '').trim();
        const rawAccount = String(e.ACCOUNT || '').trim();
        const accountName = rawAccount ? (nameMap[rawAccount] || rawAccount) :
          (ledgerId ? (nameMap[ledgerId] || ledgerId) : String(j.JOURNAL_TYPE || j.SOURCE_TYPE || 'UNMAPPED JOURNAL'));
        const accountKey = rawAccount || ledgerId || accountName;
        const dr = Number(e.DEBIT) || 0, cr = Number(e.CREDIT) || 0;
        const row = Object.assign({}, e, {
          CLIENT_ID: clientId,
          LOCATION_ID: j.LOCATION_ID || e.LOCATION_ID || '',
          ENTRY_DATE: entryDate,
          REFERENCE_NUMBER: j.REFERENCE_NUMBER || e.REFERENCE_NUMBER || j.SOURCE_ID || '',
          REFERENCE_ID: j.SOURCE_ID || e.REFERENCE_ID || '',
          REFERENCE_TYPE: j.SOURCE_TYPE || e.REFERENCE_TYPE || '',
          JOURNAL_TYPE: j.JOURNAL_TYPE || e.JOURNAL_TYPE || '',
          ACCOUNT: rawAccount || ledgerId || accountName,
          ACCOUNT_NAME: accountName,
          DESCRIPTION: e.DESCRIPTION || j.DESCRIPTION || ''
        });
        rows.push(row);
        if (!byAccount[accountKey]) byAccount[accountKey] = { account:accountKey, accountName, debit:0, credit:0 };
        byAccount[accountKey].debit += dr; byAccount[accountKey].credit += cr;
        totalDebit += dr; totalCredit += cr;
      });
    }

    rows.sort((a,b) => String(a.ENTRY_DATE).localeCompare(String(b.ENTRY_DATE)) || String(a.JOURNAL_ID||'').localeCompare(String(b.JOURNAL_ID||'')) || String(a.LEDGER_ENTRY_ID||'').localeCompare(String(b.LEDGER_ENTRY_ID||'')));
    Object.values(byAccount).forEach(x=>{ x.debit=+x.debit.toFixed(2); x.credit=+x.credit.toFixed(2); });
    return { success:true, data:{ entries:rows, byAccount:Object.values(byAccount), from, to,
      totalDebit:+totalDebit.toFixed(2), totalCredit:+totalCredit.toFixed(2), balanced:Math.abs(totalDebit-totalCredit)<0.01,
      schemaCompatible:true, note: entryRows.length ? undefined : 'No child LEDGER_ENTRIES matched the selected journals; journal totals are shown as an unmapped summary.' } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDayBookReport failed: ${error.message}`, payload);
    return { success:false, error:error.message };
  }
}

function bnxBuildStockLedgerDataset_(clientId, locationId, from, to) {
  const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
  const imValues = imSheet.getDataRange().getValues();
  const imHeaders = imValues[0];
  const itemMeta = {};
  for (let r = 1; r < imValues.length; r++) {
    const it = bnxRowToObject(imValues[r], imHeaders);
    if (it.CLIENT_ID !== clientId) continue;
    itemMeta[it.ITEM_ID] = {
      name: it.ITEM_NAME, purchaseRate: Number(it.PURCHASE_RATE) || 0,
      reorderLevel: Number(it.REORDER_LEVEL) || 0,
      isBar: (it.IS_BAR === true || String(it.IS_BAR).toUpperCase() === 'TRUE')
    };
  }
  const TYPE_BUCKET = {
    PURCHASE: 'purchase', PURCHASE_RETURN: 'adjustment',
    TRANSFER_IN: 'transferIn', TRANSFER_OUT: 'transferOut', TRANSFER: 'transferOut',
    CONSUMPTION: 'consumption', SALE: 'consumption', ISSUE: 'consumption',
    WASTAGE: 'wastage', BREAKAGE: 'breakage', ADJUSTMENT: 'adjustment'
  };
  const smSheet = bnxClientSheet(clientId, 'STOCK_MOVEMENT');
  const smValues = smSheet.getDataRange().getValues();
  const smHeaders = smValues[0];
  const byItem = {};
  const unmappedTypes = {};
  for (let r = 1; r < smValues.length; r++) {
    const m = bnxRowToObject(smValues[r], smHeaders);
    if (m.CLIENT_ID !== clientId) continue;
    if (locationId && m.LOCATION_ID !== locationId) continue;
    if (m.MOVEMENT_DATE < from || m.MOVEMENT_DATE > to) continue;
    const itemId = m.ITEM_ID;
    if (!byItem[itemId]) byItem[itemId] = { purchaseQty: 0, purchaseValue: 0, transferInQty: 0, transferInValue: 0, transferOutQty: 0, transferOutValue: 0, consumptionQty: 0, consumptionValue: 0, wastageQty: 0, wastageValue: 0, breakageQty: 0, breakageValue: 0, adjustmentQty: 0, adjustmentValue: 0, purchaseCostSum: 0, purchaseCostQty: 0 };
    const x = byItem[itemId];
    const qtyIn = Number(m.QUANTITY_IN) || 0;
    const qtyOut = Number(m.QUANTITY_OUT) || 0;
    const rate = Number(m.RATE) || 0;
    const type = String(m.MOVEMENT_TYPE || '').toUpperCase();
    const bucket = TYPE_BUCKET[type];
    if (!bucket) unmappedTypes[type || '(blank)'] = true;
    if (bucket === 'purchase') { x.purchaseQty += qtyIn; x.purchaseValue += qtyIn * rate; if (rate > 0) { x.purchaseCostSum += qtyIn * rate; x.purchaseCostQty += qtyIn; } }
    else if (bucket === 'transferIn') { x.transferInQty += qtyIn; x.transferInValue += qtyIn * rate; }
    else if (bucket === 'transferOut') { x.transferOutQty += qtyOut; x.transferOutValue += qtyOut * rate; }
    else if (bucket === 'consumption') { x.consumptionQty += qtyOut; x.consumptionValue += qtyOut * rate; }
    else if (bucket === 'wastage') { x.wastageQty += qtyOut; x.wastageValue += qtyOut * rate; }
    else if (bucket === 'breakage') { x.breakageQty += qtyOut; x.breakageValue += qtyOut * rate; }
    else { x.adjustmentQty += (qtyIn - qtyOut); x.adjustmentValue += (qtyIn - qtyOut) * rate; }
  }
  return { itemMeta, byItem, unmappedTypes };
}

function bnxStockOpeningForItem_(clientId, locationId, itemId, from) {
  let opening = 0, found = false, bestDate = '';
  try {
    const sheet = bnxClientSheet(clientId, 'STOCK_REPORT');
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    for (let r = 1; r < values.length; r++) {
      const row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID !== clientId) continue;
      if ((row.LOCATION_ID || '') !== locationId) continue;
      if (row.ITEM_ID !== itemId) continue;
      if (row.AS_OF_DATE >= from) continue;
      if (row.AS_OF_DATE > bestDate) { bestDate = row.AS_OF_DATE; opening = Number(row.CLOSING_QTY) || 0; found = true; }
    }
  } catch (e) {}
  return { opening, found };
}

function bnxGetStockReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const ds = bnxBuildStockLedgerDataset_(clientId, locationId, from, to);
    const rows = Object.keys(ds.byItem).map(itemId => {
      const x = ds.byItem[itemId];
      const meta = ds.itemMeta[itemId] || {};
      const openingInfo = bnxStockOpeningForItem_(clientId, locationId, itemId, from);
      const opening = openingInfo.opening;
      const closing = +(opening + x.purchaseQty + x.transferInQty - x.transferOutQty - x.consumptionQty - x.wastageQty - x.breakageQty + x.adjustmentQty).toFixed(3);
      const avgCost = x.purchaseCostQty > 0 ? (x.purchaseCostSum / x.purchaseCostQty) : (meta.purchaseRate || 0);
      const reorderLevel = meta.reorderLevel || 0;
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, AS_OF_DATE: to, ITEM_ID: itemId,
        ITEM_NAME: meta.name || itemId, OPENING_QTY: opening, PURCHASE_QTY: +x.purchaseQty.toFixed(3),
        TRANSFER_IN: +x.transferInQty.toFixed(3), SALES_CONSUMPTION: +x.consumptionQty.toFixed(3),
        WASTAGE: +x.wastageQty.toFixed(3), TRANSFER_OUT: +x.transferOutQty.toFixed(3),
        ADJUSTMENT: +x.adjustmentQty.toFixed(3), CLOSING_QTY: closing,
        STOCK_VALUE: +(closing * avgCost).toFixed(2), REORDER_LEVEL: reorderLevel,
        REORDER_STATUS: reorderLevel > 0 ? (closing <= reorderLevel ? 'LOW' : 'OK') : ''
      };
    });
    bnxReplaceReportByFields_(clientId, 'STOCK_REPORT', { LOCATION_ID: locationId, AS_OF_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'STOCK_REPORT', 'INVENTORY', 'REPORT', 'STOCK_MOVEMENT,ITEM_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to, note: Object.keys(ds.unmappedTypes).length
        ? ('MOVEMENT_TYPE value(s) not in the known set (PURCHASE/PURCHASE_RETURN/TRANSFER_IN/TRANSFER_OUT/CONSUMPTION/SALE/ISSUE/WASTAGE/BREAKAGE/ADJUSTMENT), counted as ADJUSTMENT so nothing is dropped, but should be reviewed: ' + Object.keys(ds.unmappedTypes).join(', '))
        : undefined }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetStockReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetPurchaseReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const pmSheet = bnxClientSheet(clientId, 'PURCHASE_MASTER');
    const pmValues = pmSheet.getDataRange().getValues();
    const pmHeaders = pmValues[0];
    const supSheet = bnxClientSheet(clientId, SHEETS.SUPPLIER_MASTER);
    const supValues = supSheet.getDataRange().getValues();
    const supHeaders = supValues[0];
    const supNameById = {};
    for (let r = 1; r < supValues.length; r++) {
      const s = bnxRowToObject(supValues[r], supHeaders);
      if (s.CLIENT_ID !== clientId) continue;
      supNameById[s.SUPPLIER_ID] = s.SUPPLIER_NAME;
    }
    const bySupplier = {};
    for (let r = 1; r < pmValues.length; r++) {
      const p = bnxRowToObject(pmValues[r], pmHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (locationId && p.LOCATION_ID !== locationId) continue;
      if (p.PURCHASE_DATE < from || p.PURCHASE_DATE > to) continue;
      const status = String(p.PURCHASE_STATUS || '').toUpperCase();
      if (status === 'CANCELLED') continue;
      const supId = p.SUPPLIER_ID || '';
      if (!bySupplier[supId]) bySupplier[supId] = { count: 0, amount: 0, tax: 0 };
      bySupplier[supId].count += 1;
      bySupplier[supId].amount += Number(p.TAXABLE_AMOUNT) || 0;
      bySupplier[supId].tax += Number(p.TAX_AMOUNT) || 0;
    }
    const rows = Object.keys(bySupplier).map(supId => {
      const x = bySupplier[supId];
      const netPurchase = +(x.amount + x.tax).toFixed(2);
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, SUPPLIER_ID: supId,
        SUPPLIER_NAME: supNameById[supId] || 'Unknown', PURCHASE_COUNT: x.count, PURCHASE_AMOUNT: +x.amount.toFixed(2),
        TAX_AMOUNT: +x.tax.toFixed(2), RETURN_AMOUNT: 0, NET_PURCHASE: netPurchase
      };
    });
    rows.sort((a, b) => b.NET_PURCHASE - a.NET_PURCHASE);
    bnxReplaceReportByFields_(clientId, 'PURCHASE_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'PURCHASE_REPORT', 'PURCHASE', 'REPORT', 'PURCHASE_MASTER,SUPPLIER_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to, note: 'RETURN_AMOUNT is a real 0, not fabricated: no PURCHASE_RETURN table exists in this schema yet.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetPurchaseReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetSupplierReport(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const pmSheet = bnxClientSheet(clientId, 'PURCHASE_MASTER');
    const pmValues = pmSheet.getDataRange().getValues();
    const pmHeaders = pmValues[0];
    const supSheet = bnxClientSheet(clientId, SHEETS.SUPPLIER_MASTER);
    const supValues = supSheet.getDataRange().getValues();
    const supHeaders = supValues[0];
    const supNameById = {};
    const dueById = {};
    for (let r = 1; r < supValues.length; r++) {
      const s = bnxRowToObject(supValues[r], supHeaders);
      if (s.CLIENT_ID !== clientId) continue;
      supNameById[s.SUPPLIER_ID] = s.SUPPLIER_NAME;
    }
    try {
      const sdSheet = bnxClientSheet(clientId, SHEETS.SUPPLIER_DUES);
      const sdValues = sdSheet.getDataRange().getValues();
      const sdHeaders = sdValues[0];
      for (let r = 1; r < sdValues.length; r++) {
        const d = bnxRowToObject(sdValues[r], sdHeaders);
        if (d.CLIENT_ID !== clientId) continue;
        dueById[d.SUPPLIER_ID] = Number(d.CURRENT_BALANCE) || 0;
      }
    } catch (e) {}

    const bySupplier = {};
    for (let r = 1; r < pmValues.length; r++) {
      const p = bnxRowToObject(pmValues[r], pmHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      const status = String(p.PURCHASE_STATUS || '').toUpperCase();
      if (status === 'CANCELLED') continue;
      const supId = p.SUPPLIER_ID || '';
      if (!bySupplier[supId]) bySupplier[supId] = { amount: 0, onTime: 0, delivered: 0 };
      const x = bySupplier[supId];
      x.amount += (Number(p.TAXABLE_AMOUNT) || 0) + (Number(p.TAX_AMOUNT) || 0);
      if (p.EXPECTED_DELIVERY && p.DELIVERY_DATE) {
        x.delivered += 1;
        if (p.DELIVERY_DATE <= p.EXPECTED_DELIVERY) x.onTime += 1;
      }
    }
    const rows = Object.keys(bySupplier).map(supId => {
      const x = bySupplier[supId];
      return {
        CLIENT_ID: clientId, SUPPLIER_ID: supId, SUPPLIER_NAME: supNameById[supId] || 'Unknown',
        PURCHASE_AMOUNT: +x.amount.toFixed(2), RETURN_AMOUNT: 0,
        PAYMENT_AMOUNT: '', DUE_AMOUNT: dueById[supId] !== undefined ? dueById[supId] : '',
        ORDER_COUNT: 0, GRN_COUNT: 0,
        ON_TIME_PERCENT: x.delivered > 0 ? +((x.onTime / x.delivered) * 100).toFixed(1) : ''
      };
    });
    rows.sort((a, b) => b.PURCHASE_AMOUNT - a.PURCHASE_AMOUNT);
    bnxReplaceReportByFields_(clientId, 'SUPPLIER_REPORT', { }, rows);
    bnxUpsertReportRegistry_(clientId, 'SUPPLIER_REPORT', 'PURCHASE', 'REPORT', 'PURCHASE_MASTER,SUPPLIER_MASTER,SUPPLIER_DUES');
    return {
      success: true, available: true, isDemo: false,
      data: { rows,
        note: 'PAYMENT_AMOUNT, ORDER_COUNT, and GRN_COUNT are left blank/0, not fabricated: no PURCHASE_PAYMENT, PURCHASE_ORDER, or GOODS_RECEIPT_NOTE table has any data in this schema yet (the tabs are reserved in the router but not yet in use). RETURN_AMOUNT is blank for the same reason (no PURCHASE_RETURN data). DUE_AMOUNT comes from SUPPLIER_DUES.CURRENT_BALANCE where a row exists. ON_TIME_PERCENT only counts purchases that have both EXPECTED_DELIVERY and DELIVERY_DATE set.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetSupplierReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetGstReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    let gstin = '';
    try {
      const csSheet = bnxClientSheet(clientId, SHEETS.CONFIG);
      const csValues = csSheet.getDataRange().getValues();
      const csHeaders = csValues[0];
      for (let r = 1; r < csValues.length; r++) {
        const row = bnxRowToObject(csValues[r], csHeaders);
        if (row.CLIENT_ID && row.CLIENT_ID !== clientId) continue;
        if (row.GST_NUMBER) { gstin = row.GST_NUMBER; break; }
      }
    } catch (e) {}

    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const gstBreakupByBill = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      let parsed = null;
      if (b.GST_BREAKUP) { try { parsed = JSON.parse(b.GST_BREAKUP); } catch (e) {} }
      gstBreakupByBill[b.BILL_ID] = parsed;
    }

    const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
    const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const imValues = imSheet.getDataRange().getValues();
    const imHeaders = imValues[0];
    const hsnByItem = {}; const taxRateById = bnxCachedTaxRateMap_(clientId);
    for (let r = 1; r < imValues.length; r++) {
      const it = bnxRowToObject(imValues[r], imHeaders);
      if (it.CLIENT_ID !== clientId) continue;
      hsnByItem[it.ITEM_ID] = it.HSN_CODE || 'UNSPECIFIED';
    }

    const byKey = {};
    let unsplitLineCount = 0, splitLineCount = 0;
    ds.itemRows.forEach(l => {
      const hsn = hsnByItem[l.itemId] || 'UNSPECIFIED';
      const bill = gstBreakupByBill[l.billId];
      const taxRate = l.net > 0 ? +((l.tax / l.net) * 100).toFixed(2) : 0;
      const key = hsn + '@' + taxRate;
      if (!byKey[key]) byKey[key] = { hsn, taxRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      const row = byKey[key];
      row.taxable += l.net; row.totalTax += l.tax;
      if (bill) {
        const billTaxTotal = (Number(bill.CGST) || 0) + (Number(bill.SGST) || 0) + (Number(bill.IGST) || 0);
        if (billTaxTotal > 0) {
          row.cgst += l.tax * ((Number(bill.CGST) || 0) / billTaxTotal);
          row.sgst += l.tax * ((Number(bill.SGST) || 0) / billTaxTotal);
          row.igst += l.tax * ((Number(bill.IGST) || 0) / billTaxTotal);
          splitLineCount++;
        } else { unsplitLineCount++; }
      } else { unsplitLineCount++; }
    });
    const rows = Object.values(byKey).map(x => ({
      CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, GSTIN: gstin,
      HSN_CODE: x.hsn, TAX_RATE: x.taxRate, TAXABLE_AMOUNT: +x.taxable.toFixed(2),
      CGST: +x.cgst.toFixed(2), SGST: +x.sgst.toFixed(2), IGST: +x.igst.toFixed(2), TOTAL_TAX: +x.totalTax.toFixed(2)
    }));
    rows.sort((a, b) => b.TAXABLE_AMOUNT - a.TAXABLE_AMOUNT);
    bnxReplaceReportByFields_(clientId, 'GST_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'GST_REPORT', 'TAX', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER,COMPANY_SETTINGS');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to,
        note: (gstin ? '' : 'GSTIN is blank: no GST_NUMBER set in COMPANY_SETTINGS. ') +
          (unsplitLineCount > 0 ? (unsplitLineCount + ' of ' + (unsplitLineCount + splitLineCount) + ' line(s) had no usable bill GST_BREAKUP, so their CGST/SGST/IGST are 0 even though TOTAL_TAX and TAXABLE_AMOUNT are complete for every line -- not filing-ready until every bill carries GST_BREAKUP.') : undefined) || undefined }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetGstReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetFoodOrBarCostReport_(session, payload, wantBar) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  const sheetName = wantBar ? 'BAR_COST_REPORT' : 'FOOD_COST_REPORT';
  try {
    const ds = bnxBuildStockLedgerDataset_(clientId, locationId, from, to);
    let openingValue = 0, purchases = 0, transferIn = 0, transferOut = 0, consumption = 0, wastage = 0, breakage = 0, closingValue = 0;
    Object.keys(ds.byItem).forEach(itemId => {
      const meta = ds.itemMeta[itemId] || {};
      if ((meta.isBar || false) !== wantBar) return;
      const x = ds.byItem[itemId];
      const openingInfo = bnxStockOpeningForItem_(clientId, locationId, itemId, from);
      const avgCost = x.purchaseCostQty > 0 ? (x.purchaseCostSum / x.purchaseCostQty) : (meta.purchaseRate || 0);
      const closingQty = openingInfo.opening + x.purchaseQty + x.transferInQty - x.transferOutQty - x.consumptionQty - x.wastageQty - x.breakageQty + x.adjustmentQty;
      openingValue += openingInfo.opening * avgCost;
      purchases += x.purchaseValue;
      transferIn += x.transferInValue;
      transferOut += x.transferOutValue;
      consumption += x.consumptionValue;
      wastage += x.wastageValue;
      breakage += x.breakageValue;
      closingValue += closingQty * avgCost;
    });
    const cost = +(consumption + wastage + breakage).toFixed(2);
    let periodNetSales = 0;
    try {
      const salesDs = bnxBuildSalesDataset_(clientId, locationId, from, to);
      const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
      const imValues = imSheet.getDataRange().getValues();
      const imHeaders = imValues[0];
      const isBarByItem = {};
      for (let r = 1; r < imValues.length; r++) {
        const it = bnxRowToObject(imValues[r], imHeaders);
        if (it.CLIENT_ID !== clientId) continue;
        isBarByItem[it.ITEM_ID] = (it.IS_BAR === true || String(it.IS_BAR).toUpperCase() === 'TRUE');
      }
      salesDs.itemRows.forEach(l => { if ((isBarByItem[l.itemId] || false) === wantBar) periodNetSales += l.net; });
    } catch (e) {}
    const costPercent = periodNetSales > 0 ? +((cost / periodNetSales) * 100).toFixed(2) : 0;

    const row = wantBar
      ? { CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, OPENING_STOCK: +openingValue.toFixed(2), PURCHASES: +purchases.toFixed(2), CONSUMPTION: +consumption.toFixed(2), WASTAGE: +wastage.toFixed(2), BREAKAGE: +breakage.toFixed(2), CLOSING_STOCK: +closingValue.toFixed(2), BAR_COST: cost, BAR_COST_PERCENT: costPercent }
      : { CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, OPENING_STOCK: +openingValue.toFixed(2), PURCHASES: +purchases.toFixed(2), TRANSFER_IN: +transferIn.toFixed(2), TRANSFER_OUT: +transferOut.toFixed(2), CONSUMPTION: +consumption.toFixed(2), WASTAGE: +wastage.toFixed(2), CLOSING_STOCK: +closingValue.toFixed(2), FOOD_COST: cost, FOOD_COST_PERCENT: costPercent };

    bnxReplaceReportByFields_(clientId, sheetName, { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, [row]);
    bnxUpsertReportRegistry_(clientId, sheetName, 'COST', 'REPORT', 'STOCK_MOVEMENT,ITEM_MASTER,BILL_MASTER,BILL_ITEMS');
    return {
      success: true, available: true, isDemo: false,
      data: { row, from, to,
        note: 'Stock values use ITEM_MASTER.PURCHASE_RATE / period weighted purchase cost at query time, not a historical cost snapshot. ' + (wantBar ? 'BAR_COST' : 'FOOD_COST') + '_PERCENT is against ' + (wantBar ? 'bar' : 'food') + '-item NET_SALES for the same period from the shared sales dataset, so it cannot disagree with ITEM_SALES_REPORT.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetFoodOrBarCostReport_ failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}
function bnxGetFoodCostReport(session, payload) { return bnxGetFoodOrBarCostReport_(session, payload, false); }
function bnxGetBarCostReport(session, payload) { return bnxGetFoodOrBarCostReport_(session, payload, true); }

function bnxGetWastageReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, 'WASTAGE_MASTER');
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const w = bnxRowToObject(values[r], headers);
      if (w.CLIENT_ID && String(w.CLIENT_ID) !== String(clientId)) continue;
      const dt = String(w.DATE || w.WASTAGE_DATE || '').slice(0, 10);
      if (!dt || dt < from || dt > to) continue;
      /* WASTAGE_MASTER currently has no LOCATION_ID column. Tenant isolation is
         still safe because CLIENT_ID is present and required. We do not invent
         a location; location-filtered views may therefore include the client's
         all-location wastage with an explicit note. */
      const qty = Number(w.QTY) || 0;
      const cost = Number(w.COST_VALUE) || 0;
      rows.push({
        CLIENT_ID: clientId,
        LOCATION_ID: '',
        WASTAGE_ID: w.WASTAGE_ID || '',
        DATE: dt,
        ITEM_CODE: w.ITEM_CODE || '',
        ITEM_NAME: w.ITEM_NAME || w.ITEM_CODE || '',
        QTY: qty,
        UOM: w.UOM || '',
        REASON: w.REASON || '',
        COST_VALUE: +cost.toFixed(2),
        APPROVED_BY: w.APPROVED_BY || '',
        DEPARTMENT: w.DEPARTMENT || '',
        ENTRY_BY: w.ENTRY_BY || ''
      });
    }
    rows.sort((a,b)=>String(a.DATE).localeCompare(String(b.DATE)) || String(a.ITEM_NAME).localeCompare(String(b.ITEM_NAME)));
    bnxReplaceReportRange_(clientId, 'WASTAGE_REPORT', 'DATE', from, to, rows);
    bnxUpsertReportRegistry_(clientId, 'WASTAGE_REPORT', 'INVENTORY', 'REPORT', 'WASTAGE_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to, note: locationId ? 'WASTAGE_MASTER is tenant-safe through CLIENT_ID but has no LOCATION_ID column; location filtering is therefore not applied.' : undefined }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetWastageReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}
function bnxGetKitchenPerformanceReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const kotSheet = bnxClientSheet(clientId, SHEETS.KOT_MASTER);
    const kotValues = kotSheet.getDataRange().getValues();
    const kotHeaders = kotValues[0];
    let kotCount = 0, prepSecondsSum = 0, prepSamples = 0;
    const kotIdsInRange = {};
    for (let r = 1; r < kotValues.length; r++) {
      const k = bnxRowToObject(kotValues[r], kotHeaders);
      if (k.CLIENT_ID !== clientId) continue;
      if (locationId && k.LOCATION_ID !== locationId) continue;
      if (k.KOT_DATE < from || k.KOT_DATE > to) continue;
      if (String(k.KOT_STATUS).toUpperCase() === 'CANCELLED') continue;
      kotCount++;
      kotIdsInRange[k.KOT_ID] = true;
      if (k.STARTED_AT && k.COMPLETED_AT) {
        const ms = new Date(k.COMPLETED_AT) - new Date(k.STARTED_AT);
        if (ms > 0) { prepSecondsSum += ms / 1000; prepSamples++; }
      }
    }
    let itemCount = 0;
    try {
      const kiSheet = bnxClientSheet(clientId, SHEETS.KOT_ITEMS);
      const kiValues = kiSheet.getDataRange().getValues();
      const kiHeaders = kiValues[0];
      for (let r = 1; r < kiValues.length; r++) {
        const it = bnxRowToObject(kiValues[r], kiHeaders);
        if (kotIdsInRange[it.KOT_ID]) itemCount++;
      }
    } catch (e) {}
    const row = {
      CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, KOT_COUNT: kotCount,
      ITEM_COUNT: itemCount, AVERAGE_PREP_TIME: prepSamples > 0 ? +((prepSecondsSum / prepSamples) / 60).toFixed(1) : '',
      READY_ON_TIME_PERCENT: '', REMAKE_COUNT: '', WASTAGE_AMOUNT: ''
    };
    bnxReplaceReportByFields_(clientId, 'KITCHEN_PERFORMANCE', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, [row]);
    bnxUpsertReportRegistry_(clientId, 'KITCHEN_PERFORMANCE', 'PERFORMANCE', 'REPORT', 'KOT_MASTER,KOT_ITEMS');
    return {
      success: true, available: true, isDemo: false,
      data: { row, from, to,
        note: 'AVERAGE_PREP_TIME is in minutes, from ' + prepSamples + ' of ' + kotCount + ' KOTs that had both STARTED_AT and COMPLETED_AT set. READY_ON_TIME_PERCENT is blank: no SLA/target prep time is configured anywhere in this app to measure "on time" against. REMAKE_COUNT is blank: no remake/redo flag exists in KOT_MASTER or KOT_STATUS_LOG. WASTAGE_AMOUNT is blank: blocked on the same WASTAGE_MASTER CLIENT_ID gap as WASTAGE_REPORT.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetKitchenPerformanceReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetStewardPerformanceReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const userSheet = bnxClientSheet(clientId, SHEETS.USER_MASTER);
    const userValues = userSheet.getDataRange().getValues();
    const userHeaders = userValues[0];
    const nameById = {};
    for (let r = 1; r < userValues.length; r++) {
      const u = bnxRowToObject(userValues[r], userHeaders);
      if (u.CLIENT_ID !== clientId) continue;
      nameById[u.USER_ID] = u.FULL_NAME;
    }
    const byStaff = {};
    const orderSheet = bnxClientSheet(clientId, SHEETS.ORDER_MASTER);
    const orderValues = orderSheet.getDataRange().getValues();
    const orderHeaders = orderValues[0];
    for (let r = 1; r < orderValues.length; r++) {
      const o = bnxRowToObject(orderValues[r], orderHeaders);
      if (o.CLIENT_ID !== clientId) continue;
      if (locationId && o.LOCATION_ID !== locationId) continue;
      if (o.ORDER_DATE < from || o.ORDER_DATE > to) continue;
      const staffId = o.STARTED_BY || '';
      if (!staffId || String(staffId).indexOf('HISTORICAL_IMPORT') === 0) continue;
      if (!byStaff[staffId]) byStaff[staffId] = { name: nameById[staffId] || staffId, orders: 0, bills: 0, cancellations: 0, sales: 0 };
      byStaff[staffId].orders++;
      if (String(o.ORDER_STATUS).toUpperCase() === 'CANCELLED') byStaff[staffId].cancellations++;
    }
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && b.LOCATION_ID !== locationId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      const status = String(b.BILL_STATUS || '').toUpperCase();
      const staffId = b.CREATED_BY || '';
      if (!staffId || String(staffId).indexOf('HISTORICAL_IMPORT') === 0) continue;
      if (!byStaff[staffId]) byStaff[staffId] = { name: nameById[staffId] || staffId, orders: 0, bills: 0, cancellations: 0, sales: 0 };
      if (status === 'CANCELLED' || status === 'VOID') { byStaff[staffId].cancellations++; continue; }
      byStaff[staffId].bills++;
      byStaff[staffId].sales += Number(b.TAXABLE_AMOUNT) || 0;
    }
    const rows = Object.keys(byStaff).map(staffId => {
      const x = byStaff[staffId];
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, EMPLOYEE_ID: staffId,
        EMPLOYEE_NAME: x.name, ORDERS_HANDLED: x.orders, BILLS_HANDLED: x.bills, SALES_AMOUNT: +x.sales.toFixed(2),
        AVERAGE_BILL_VALUE: x.bills > 0 ? +(x.sales / x.bills).toFixed(2) : 0, CANCELLATION_COUNT: x.cancellations
      };
    });
    rows.sort((a, b) => b.SALES_AMOUNT - a.SALES_AMOUNT);
    bnxReplaceReportByFields_(clientId, 'STEWARD_PERFORMANCE', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'STEWARD_PERFORMANCE', 'PERFORMANCE', 'REPORT', 'ORDER_MASTER,BILL_MASTER,USER_MASTER');
    return { success: true, available: true, isDemo: false, data: { rows, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetStewardPerformanceReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetBarPerformanceReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
    const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const imValues = imSheet.getDataRange().getValues();
    const imHeaders = imValues[0];
    const isBarByItem = {};
    for (let r = 1; r < imValues.length; r++) {
      const it = bnxRowToObject(imValues[r], imHeaders);
      if (it.CLIENT_ID !== clientId) continue;
      isBarByItem[it.ITEM_ID] = (it.IS_BAR === true || String(it.IS_BAR).toUpperCase() === 'TRUE');
    }
    const staffByBillId = {};
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const nameById = {};
    try {
      const userSheet = bnxClientSheet(clientId, SHEETS.USER_MASTER);
      const userValues = userSheet.getDataRange().getValues();
      const userHeaders = userValues[0];
      for (let r = 1; r < userValues.length; r++) {
        const u = bnxRowToObject(userValues[r], userHeaders);
        if (u.CLIENT_ID !== clientId) continue;
        nameById[u.USER_ID] = u.FULL_NAME;
      }
    } catch (e) {}
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      const staffId = b.CREATED_BY || '';
      if (staffId && String(staffId).indexOf('HISTORICAL_IMPORT') !== 0) staffByBillId[b.BILL_ID] = staffId;
    }
    const byStaff = {};
    ds.itemRows.forEach(l => {
      if (!isBarByItem[l.itemId]) return;
      const staffId = staffByBillId[l.billId] || '';
      if (!staffId) return;
      if (!byStaff[staffId]) byStaff[staffId] = { name: nameById[staffId] || staffId, sales: 0, cost: 0, billIds: {} };
      const x = byStaff[staffId];
      x.sales += l.net; x.cost += l.foodCost; x.billIds[l.billId] = true;
    });
    const rows = Object.keys(byStaff).map(staffId => {
      const x = byStaff[staffId];
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, EMPLOYEE_ID: staffId,
        EMPLOYEE_NAME: x.name, BAR_ORDERS: Object.keys(x.billIds).length, BAR_SALES: +x.sales.toFixed(2),
        BAR_COST: +x.cost.toFixed(2), BAR_COST_PERCENT: x.sales > 0 ? +((x.cost / x.sales) * 100).toFixed(2) : 0,
        WASTAGE_AMOUNT: ''
      };
    });
    rows.sort((a, b) => b.BAR_SALES - a.BAR_SALES);
    bnxReplaceReportByFields_(clientId, 'BAR_PERFORMANCE', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'BAR_PERFORMANCE', 'PERFORMANCE', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER,USER_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to, note: 'WASTAGE_AMOUNT is blank: blocked on the same WASTAGE_MASTER CLIENT_ID gap as WASTAGE_REPORT.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetBarPerformanceReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetTablePerformanceReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const tmSheet = bnxClientSheet(clientId, SHEETS.TABLE_MASTER);
    const tmValues = tmSheet.getDataRange().getValues();
    const tmHeaders = tmValues[0];
    const tableNumberById = {};
    for (let r = 1; r < tmValues.length; r++) {
      const t = bnxRowToObject(tmValues[r], tmHeaders);
      if (t.CLIENT_ID !== clientId) continue;
      tableNumberById[t.TABLE_ID] = t.TABLE_NUMBER;
    }
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const byTable = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && b.LOCATION_ID !== locationId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      if (!b.TABLE_ID) continue;
      const status = String(b.BILL_STATUS || '').toUpperCase();
      if (status === 'CANCELLED' || status === 'VOID') continue;
      if (!byTable[b.TABLE_ID]) byTable[b.TABLE_ID] = { tableNumber: tableNumberById[b.TABLE_ID] || b.TABLE_ID, orders: 0, covers: 0, sales: 0 };
      const x = byTable[b.TABLE_ID];
      const grand = Number(b.GRAND_TOTAL) || 0;
      const tax = Number(b.TAX_AMOUNT) || 0;
      const round = Number(b.ROUND_OFF) || 0;
      const taxableRaw = Number(b.TAXABLE_AMOUNT);
      const taxable = Number.isFinite(taxableRaw) && (taxableRaw !== 0 || grand === 0)
        ? taxableRaw
        : Math.max(0, +((grand - tax - round)).toFixed(2));
      // Table Performance's SALES_AMOUNT is the operational bill value
      // shown to management: tax-inclusive Grand Total. Keep taxable
      // revenue derivation available only where the schema explicitly calls
      // for it; do not silently mix GST-exclusive sales into this report.
      x.orders++; x.covers += Number(b.COVERS) || 0; x.sales += grand;
    }
    const rows = Object.keys(byTable).map(tableId => {
      const x = byTable[tableId];
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, TABLE_ID: tableId,
        TABLE_NUMBER: x.tableNumber, ORDER_COUNT: x.orders, COVERS: x.covers, SALES_AMOUNT: +x.sales.toFixed(2),
        AVERAGE_BILL_VALUE: x.orders > 0 ? +(x.sales / x.orders).toFixed(2) : 0, TURNOVER_COUNT: x.orders,
        AVERAGE_DWELL_MINUTES: ''
      };
    });
    rows.sort((a, b) => b.SALES_AMOUNT - a.SALES_AMOUNT);
    bnxReplaceReportByFields_(clientId, 'TABLE_PERFORMANCE', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'TABLE_PERFORMANCE', 'PERFORMANCE', 'REPORT', 'BILL_MASTER,TABLE_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: { rows, from, to,
        note: 'TURNOVER_COUNT is the same as ORDER_COUNT (number of bills at that table in the period) -- a real proxy, not the same thing as true seating turnover. AVERAGE_DWELL_MINUTES is blank: BILL_MASTER has no seating start/end time in this schema, so dwell time cannot be computed, only guessed -- and it is not guessed here.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetTablePerformanceReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxRefreshAllReports(session, payload) {
  const results = {
    salesDayBook: bnxGetSalesDayBookReport(session, payload),
    cashBook: bnxGetCashbookReport(session, payload),
    dayBook: bnxGetDayBookReport(session, payload),
    itemSales: bnxGetItemSalesReport(session, payload),
    categorySales: bnxGetCategorySalesReport(session, payload),
    salesSummary: bnxGetSalesSummaryReport(session, payload),
    paymentReport: bnxGetPaymentReportV2(session, payload),
    cashBankReport: bnxGetCashBankReport(session, payload),
    customerDues: bnxGetCustomerDuesReportV2(session, payload),
    supplierDues: bnxGetSupplierDuesReportV2(session, payload),
    profitLoss: bnxGetProfitLossReport(session, payload),
    stockReport: bnxGetStockReport(session, payload),
    purchaseReport: bnxGetPurchaseReport(session, payload),
    supplierReport: bnxGetSupplierReport(session, payload),
    gstReport: bnxGetGstReport(session, payload),
    foodCostReport: bnxGetFoodCostReport(session, payload),
    barCostReport: bnxGetBarCostReport(session, payload),
    kitchenPerformance: bnxGetKitchenPerformanceReport(session, payload),
    stewardPerformance: bnxGetStewardPerformanceReport(session, payload),
    barPerformance: bnxGetBarPerformanceReport(session, payload),
    tablePerformance: bnxGetTablePerformanceReport(session, payload),
    reconciliation: bnxGetReconciliationReport(session, payload),
    dashboardKpi: bnxGetDashboardKpiReport(session, payload),
    pettyCash: bnxGetPettyCashLedger(session, payload),
    onlineOrders: bnxGetOnlineOrderReport(session, payload)
  };
  const allOk = Object.keys(results).every(k => results[k] && results[k].success);
  return { success: allOk, data: results };
}

function bnxReplaceReportByFields_(clientId, sheetName, matchObj, rows) {
  const sheet = bnxClientSheet(clientId, sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ciCol = headers.indexOf('CLIENT_ID');
  const keys = Object.keys(matchObj);
  const cols = keys.map(k => headers.indexOf(k));
  const toDelete = [];
  for (let r = 1; r < values.length; r++) {
    if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
    let match = true;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i] === -1) continue;
      if (String(values[r][cols[i]]) !== String(matchObj[keys[i]])) { match = false; break; }
    }
    if (match) toDelete.push(r + 1);
  }
  toDelete.sort((a, b) => b - a).forEach(rn => sheet.deleteRow(rn));
  if (rows && rows.length) {
    const toAppend = rows.map(o => headers.map(h => (o[h] === undefined ? '' : o[h])));
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }
}

function bnxReplaceReportRange_(clientId, sheetName, dateField, from, to, rows) {
  const sheet = bnxClientSheet(clientId, sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ciCol = headers.indexOf('CLIENT_ID');
  const dateCol = headers.indexOf(dateField);
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const toDelete = [];
  for (let r = 1; r < values.length; r++) {
    if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
    let d = values[r][dateCol];
    if (d instanceof Date) d = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    if (String(d) < from || String(d) > to) continue;
    toDelete.push(r + 1);
  }
  toDelete.sort((a, b) => b - a).forEach(rn => sheet.deleteRow(rn));
  if (rows && rows.length) {
    const toAppend = rows.map(o => headers.map(h => (o[h] === undefined ? '' : o[h])));
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }
}

function bnxUpsertReportRegistry_(clientId, reportName, category, sourceDb, sourceTables) {
  try {
    const sheet = bnxClientSheet(clientId, 'REPORT_REGISTRY');
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const nameCol = headers.indexOf('REPORT_NAME');
    const lastCol = headers.indexOf('LAST_REFRESHED_AT');
    const nowIso = new Date().toISOString();
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] === clientId && values[r][nameCol] === reportName) {
        if (lastCol !== -1) sheet.getRange(r + 1, lastCol + 1).setValue(nowIso);
        return;
      }
    }
    bnxAppendRow(clientId, 'REPORT_REGISTRY', {
      REPORT_ID: generateShortId_(clientId, 'REPORT_ID'), CLIENT_ID: clientId, REPORT_NAME: reportName,
      REPORT_CATEGORY: category, SOURCE_DB: sourceDb, SOURCE_TABLES: sourceTables,
      REFRESH_FREQUENCY: 'ON_DEMAND', IS_ACTIVE: true, LAST_REFRESHED_AT: nowIso
    });
  } catch (e) { console.warn('[bnxUpsertReportRegistry_] ' + e.message); }
}

function bnxInvalidateTodayReportCaches_(clientId) {
  try {
    // Dashboard summary uses a 30s CacheService key assembled as:
    // dash_<client>_<range>_<from>_<to>_<week>_<month>_<quarter>_<fy>.
    // Invalidate the exact no-extra-params today key as well as the report
    // engine keys. Without this, a newly saved bill could leave the
    // Dashboard/Reports Hub showing the previous zero for up to 30s.
    const keys = [
      'dash_' + clientId + '_today______',
      bnxReportCacheKey_('dash', clientId, { range: 'today' }),
      bnxReportCacheKey_('salesdaybook', clientId, {}),
      bnxReportCacheKey_('paymentreport', clientId, {}),
      bnxReportCacheKey_('cashbank', clientId, {}),
      bnxReportCacheKey_('dashboardkpi', clientId, {}),
      bnxReportCacheKey_('reconciliation', clientId, {}),
      bnxReportCacheKey_('daybook', clientId, {})
    ];
    CacheService.getScriptCache().removeAll(keys);
  } catch (e) {}
}

function bnxGetSalesDayBookReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('salesdaybook', clientId, payload);
  return bnxCachedReport_(cacheKey, 15, () => bnxGetSalesDayBookReport_impl_(session, payload));
}
function bnxGetSalesDayBookReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    const byDate = {};
    const dateByBillId = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && b.LOCATION_ID !== locationId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      if (String(b.BILL_STATUS).toUpperCase() === 'CANCELLED' || String(b.BILL_STATUS).toUpperCase() === 'VOID') continue;
      const d = b.BILL_DATE;
      if (!byDate[d]) byDate[d] = { billCount: 0, gross: 0, disc: 0, taxable: 0, tax: 0, due: 0, cash: 0, card: 0, upi: 0, other: 0, refunds: 0 };
      byDate[d].billCount += 1;
      byDate[d].gross += Number(b.SUBTOTAL) || 0;
      byDate[d].disc += (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0);
      byDate[d].taxable += Number(b.TAXABLE_AMOUNT) || 0;
      byDate[d].tax += Number(b.TAX_AMOUNT) || 0;
      if (String(b.PAYMENT_STATUS).toUpperCase() !== 'PAID') byDate[d].due += Number(b.GRAND_TOTAL) || 0;
      dateByBillId[b.BILL_ID] = d;
    }
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      const status = String(p.PAYMENT_STATUS || '').toUpperCase();
      const d = dateByBillId[p.BILL_ID];
      if (!d || !byDate[d]) continue;
      const amt = Number(p.AMOUNT) || 0;
      if (status === 'REFUNDED' || status === 'REVERSED') { byDate[d].refunds += amt; continue; }
      const mode = String(p.PAYMENT_MODE || '').toUpperCase();
      if (mode === 'CASH') byDate[d].cash += amt;
      else if (mode === 'UPI') byDate[d].upi += amt;
      else if (mode === 'CARD') byDate[d].card += amt;
      else byDate[d].other += amt;
    }
    const rows = Object.keys(byDate).sort().map(d => {
      const x = byDate[d];
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, SALE_DATE: d, BILL_COUNT: x.billCount,
        GROSS_SALES: +x.gross.toFixed(2), DISCOUNT: +x.disc.toFixed(2), TAXABLE_SALES: +x.taxable.toFixed(2),
        TAX: +x.tax.toFixed(2), NET_SALES: +x.taxable.toFixed(2), CASH: +x.cash.toFixed(2), CARD: +x.card.toFixed(2),
        UPI: +x.upi.toFixed(2), OTHER: +x.other.toFixed(2), DUE: +x.due.toFixed(2), REFUNDS: +x.refunds.toFixed(2)
      };
    });
    bnxReplaceReportRange_(clientId, 'SALES_DAY_BOOK', 'SALE_DATE', from, to, rows);
    bnxUpsertReportRegistry_(clientId, 'SALES_DAY_BOOK', 'SALES', 'REPORT', 'BILL_MASTER,PAYMENT_MASTER');
    return { success: true, data: { rows, from, to }, available: true, isDemo: false };
  } catch (error) {
    bnxLogError(clientId, `bnxGetSalesDayBookReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetPaymentReportV2(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('paymentreport', clientId, payload);
  return bnxCachedReport_(cacheKey, 15, () => bnxGetPaymentReportV2_impl_(session, payload));
}
function bnxGetPaymentReportV2_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const byMode = {};
    for (let r = 1; r < values.length; r++) {
      const p = bnxRowToObject(values[r], headers);
      if (p.CLIENT_ID !== clientId) continue;
      if (locationId && p.LOCATION_ID !== locationId) continue;
      const _payDateKey = bnxNormalizeDateKey_(p.PAYMENT_DATE); if (!_payDateKey || _payDateKey < from || _payDateKey > to) continue;
      const mode = String(p.PAYMENT_MODE || 'OTHER').toUpperCase();
      if (!byMode[mode]) byMode[mode] = { count: 0, amount: 0, refund: 0 };
      const status = String(p.PAYMENT_STATUS || '').toUpperCase();
      const amt = Number(p.AMOUNT) || 0;
      if (status === 'REFUNDED' || status === 'REVERSED') byMode[mode].refund += amt;
      else { byMode[mode].amount += amt; byMode[mode].count += 1; }
    }
    const rows = Object.keys(byMode).map(mode => {
      const x = byMode[mode];
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, PAYMENT_MODE: mode,
        TRANSACTION_COUNT: x.count, AMOUNT: +x.amount.toFixed(2), REFUND_AMOUNT: +x.refund.toFixed(2),
        NET_AMOUNT: +(x.amount - x.refund).toFixed(2)
      };
    });
    bnxReplaceReportByFields_(clientId, 'PAYMENT_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'PAYMENT_REPORT', 'PAYMENTS', 'REPORT', 'PAYMENT_MASTER');
    return { success: true, data: { rows, from, to }, available: true, isDemo: false };
  } catch (error) {
    bnxLogError(clientId, `bnxGetPaymentReportV2 failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetCashBankReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const cacheKey = bnxReportCacheKey_('cashbank', clientId, payload);
  return bnxCachedReport_(cacheKey, 15, () => bnxGetCashBankReport_impl_(session, payload));
}
function bnxGetCashBankReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  const modes = ['CASH', 'CARD', 'UPI', 'BANK', 'OTHER'];
  try {
    const receiptsByMode = {}; modes.forEach(m => receiptsByMode[m] = 0);
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (locationId && p.LOCATION_ID !== locationId) continue;
      const _payDateKey = bnxNormalizeDateKey_(p.PAYMENT_DATE); if (!_payDateKey || _payDateKey < from || _payDateKey > to) continue;
      const status = String(p.PAYMENT_STATUS || '').toUpperCase();
      if (status === 'REFUNDED' || status === 'REVERSED') continue;
      let mode = String(p.PAYMENT_MODE || '').toUpperCase();
      if (!modes.includes(mode)) mode = 'OTHER';
      receiptsByMode[mode] += Number(p.AMOUNT) || 0;
    }
    try {
      const drSheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const drValues = drSheet.getDataRange().getValues();
      const drHeaders = drValues[0];
      for (let r = 1; r < drValues.length; r++) {
        const d = bnxRowToObject(drValues[r], drHeaders);
        if (d.CLIENT_ID !== clientId) continue;
        if (locationId && String(d.LOCATION_ID || '') !== String(locationId)) continue;
        if (d.RECEIPT_DATE < from || d.RECEIPT_DATE > to) continue;
        let mode = String(d.PAYMENT_MODE || '').toUpperCase();
        if (!modes.includes(mode)) mode = 'OTHER';
        receiptsByMode[mode] += Number(d.AMOUNT) || 0;
      }
    } catch (e) {}

    const paymentsByMode = {}; modes.forEach(m => paymentsByMode[m] = 0);
    let purchasePaymentAvailable = true;
    try {
      const ppSheet = bnxClientSheet(clientId, 'PURCHASE_PAYMENT');
      const ppValues = ppSheet.getDataRange().getValues();
      const ppHeaders = ppValues[0];
      for (let r = 1; r < ppValues.length; r++) {
        const pp = bnxRowToObject(ppValues[r], ppHeaders);
        if (pp.CLIENT_ID !== clientId) continue;
        if (locationId && String(pp.LOCATION_ID || '') !== String(locationId)) continue;
        const dt = pp.PAYMENT_DATE || pp.PAID_DATE || '';
        if (dt < from || dt > to) continue;
        let mode = String(pp.PAYMENT_MODE || '').toUpperCase();
        if (!modes.includes(mode)) mode = 'OTHER';
        paymentsByMode[mode] += Number(pp.AMOUNT) || 0;
      }
    } catch (e) { purchasePaymentAvailable = false; }

    const openingByMode = {}; const openingIsAssumedZero = {};
    modes.forEach(mode => {
      let opening = 0, found = false, bestToDate = '';
      try {
        const sheet = bnxClientSheet(clientId, 'CASH_BANK_REPORT');
        const values = sheet.getDataRange().getValues();
        const headers = values[0];
        for (let r = 1; r < values.length; r++) {
          const row = bnxRowToObject(values[r], headers);
          if (row.CLIENT_ID !== clientId) continue;
          if ((row.LOCATION_ID || '') !== locationId) continue;
          if (row.PAYMENT_MODE !== mode) continue;
          if (row.TO_DATE >= from) continue;
          if (row.TO_DATE > bestToDate) { bestToDate = row.TO_DATE; opening = Number(row.CLOSING_BALANCE) || 0; found = true; }
        }
      } catch (e) {}
      openingByMode[mode] = opening; openingIsAssumedZero[mode] = !found;
    });

    const rows = modes.filter(m => receiptsByMode[m] || paymentsByMode[m] || openingByMode[m]).map(mode => {
      const opening = openingByMode[mode];
      const receipts = +receiptsByMode[mode].toFixed(2);
      const payments = +paymentsByMode[mode].toFixed(2);
      return {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, PAYMENT_MODE: mode,
        OPENING_BALANCE: +opening.toFixed(2), RECEIPTS: receipts, PAYMENTS: payments, ADJUSTMENTS: 0,
        CLOSING_BALANCE: +(opening + receipts - payments).toFixed(2)
      };
    });

    let physicalCashNote;
    if (from === to) {
      try {
        const daySheet = bnxClientSheet(clientId, SHEETS.DAY_STATUS);
        const dayValues = daySheet.getDataRange().getValues();
        const dayHeaders = dayValues[0];
        for (let r = 1; r < dayValues.length; r++) {
          const d = bnxRowToObject(dayValues[r], dayHeaders);
          if (d.CLIENT_ID !== clientId || d.BUSINESS_DATE !== to) continue;
          if (d.CASH_COUNTED !== undefined && d.CASH_COUNTED !== '') {
            const cashRow = rows.find(r2 => r2.PAYMENT_MODE === 'CASH');
            const expected = cashRow ? cashRow.CLOSING_BALANCE : 0;
            physicalCashNote = { physicalCash: Number(d.CASH_COUNTED), expectedCash: expected, variance: +(Number(d.CASH_COUNTED) - expected).toFixed(2) };
          }
          break;
        }
      } catch (e) {}
    }

    bnxReplaceReportByFields_(clientId, 'CASH_BANK_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'CASH_BANK_REPORT', 'FINANCE', 'REPORT', 'PAYMENT_MASTER,DUES_RECEIPT,PURCHASE_PAYMENT');
    return {
      success: true, available: true, isDemo: false,
      data: {
        rows, from, to, physicalCash: physicalCashNote, purchasePaymentTableAvailable: purchasePaymentAvailable,
        note: !purchasePaymentAvailable
          ? 'PURCHASE_PAYMENT tab not found in this client\'s TRANSACTION_DB -- cash-out currently reflects 0 supplier payments, not a confirmed true zero.'
          : undefined
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetCashBankReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetCustomerDuesReportV2(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const asOfDate = payload.asOfDate || payload.date || bnxNowParts_().date;
  const isToday = asOfDate === bnxNowParts_().date;
  try {
    const duesSheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_DUES);
    const duesValues = duesSheet.getDataRange().getValues();
    const duesHeaders = duesValues[0];
    const custSheet = bnxClientSheet(clientId, SHEETS.CUSTOMER_MASTER);
    const custValues = custSheet.getDataRange().getValues();
    const custHeaders = custValues[0];
    const custById = {};
    for (let r = 1; r < custValues.length; r++) { const c = bnxRowToObject(custValues[r], custHeaders); custById[c.CUSTOMER_ID] = c; }

    const creditSalesByCust = {}, receiptsByCust = {};
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId || !b.CUSTOMER_ID) continue;
      if (b.BILL_DATE !== asOfDate) continue;
      if (String(b.PAYMENT_STATUS).toUpperCase() === 'PAID') continue;
      creditSalesByCust[b.CUSTOMER_ID] = (creditSalesByCust[b.CUSTOMER_ID] || 0) + (Number(b.GRAND_TOTAL) || 0);
    }
    try {
      const recSheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const recValues = recSheet.getDataRange().getValues();
      const recHeaders = recValues[0];
      for (let r = 1; r < recValues.length; r++) {
        const rec = bnxRowToObject(recValues[r], recHeaders);
        if (rec.CLIENT_ID !== clientId) continue;
        if (rec.RECEIPT_DATE !== asOfDate) continue;
        receiptsByCust[rec.CUSTOMER_ID] = (receiptsByCust[rec.CUSTOMER_ID] || 0) + (Number(rec.AMOUNT) || 0);
      }
    } catch (e) {}

    const rows = [];
    for (let r = 1; r < duesValues.length; r++) {
      const d = bnxRowToObject(duesValues[r], duesHeaders);
      if (d.CLIENT_ID !== clientId) continue;
      const closingDue = +(Number(d.CURRENT_BALANCE) || 0).toFixed(2);
      const creditSales = +(creditSalesByCust[d.CUSTOMER_ID] || 0).toFixed(2);
      const receipts = +(receiptsByCust[d.CUSTOMER_ID] || 0).toFixed(2);
      if (closingDue === 0 && creditSales === 0 && receipts === 0) continue;
      const openingDue = +(closingDue - creditSales + receipts).toFixed(2);
      const cust = custById[d.CUSTOMER_ID] || {};
      rows.push({
        CLIENT_ID: clientId, LOCATION_ID: locationId, AS_OF_DATE: asOfDate, CUSTOMER_ID: d.CUSTOMER_ID,
        CUSTOMER_NAME: cust.CUSTOMER_NAME || 'Unknown', OPENING_DUE: openingDue, SALES_ON_CREDIT: creditSales,
        RECEIPTS: receipts, ADJUSTMENTS: 0, CLOSING_DUE: closingDue, STATUS: closingDue <= 0 ? 'SETTLED' : 'OUTSTANDING'
      });
    }
    bnxReplaceReportByFields_(clientId, 'CUSTOMER_DUES_REPORT', { LOCATION_ID: locationId, AS_OF_DATE: asOfDate }, rows);
    bnxUpsertReportRegistry_(clientId, 'CUSTOMER_DUES_REPORT', 'FINANCE', 'REPORT', 'CUSTOMER_DUES,BILL_MASTER,DUES_RECEIPT');
    return {
      success: true, available: true, isDemo: false,
      data: {
        rows, asOfDate,
        note: isToday ? undefined : 'CLOSING_DUE reflects the current live CUSTOMER_DUES balance (this schema keeps no dated balance history), so OPENING_DUE for a past AS_OF_DATE is only exact if nothing moved between that date and today.'
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetCustomerDuesReportV2 failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetSupplierDuesReportV2(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const asOfDate = payload.asOfDate || payload.date || bnxNowParts_().date;
  try {
    let supRows = [];
    try {
      const dueSheet = bnxClientSheet(clientId, 'SUPPLIER_DUES');
      const dueValues = dueSheet.getDataRange().getValues();
      const dueHeaders = dueValues[0];
      let supById = {};
      try {
        const supSheet = bnxClientSheet(clientId, SHEETS.SUPPLIER_MASTER || 'VENDOR_MASTER');
        const supValues = supSheet.getDataRange().getValues();
        const supHeaders = supValues[0];
        for (let r = 1; r < supValues.length; r++) {
          const s = bnxRowToObject(supValues[r], supHeaders);
          supById[s.SUPPLIER_ID || s.VENDOR_ID] = s;
        }
      } catch (e) {}
      for (let r = 1; r < dueValues.length; r++) {
        const d = bnxRowToObject(dueValues[r], dueHeaders);
        if (d.CLIENT_ID !== clientId) continue;
        const closingDue = +(Number(d.CURRENT_BALANCE || d.BALANCE) || 0).toFixed(2);
        if (!closingDue) continue;
        const sup = supById[d.SUPPLIER_ID] || {};
        supRows.push({
          CLIENT_ID: clientId, LOCATION_ID: locationId, AS_OF_DATE: asOfDate, SUPPLIER_ID: d.SUPPLIER_ID,
          SUPPLIER_NAME: sup.SUPPLIER_NAME || sup.VENDOR_NAME || 'Unknown', OPENING_DUE: '', PURCHASE_CREDIT: '',
          PAYMENTS: '', RETURNS: '', CLOSING_DUE: closingDue, STATUS: closingDue > 0 ? 'OUTSTANDING' : 'SETTLED'
        });
      }
    } catch (e) {
      bnxReplaceReportByFields_(clientId, 'SUPPLIER_DUES_REPORT', { LOCATION_ID: locationId, AS_OF_DATE: asOfDate }, []);
      return {
        success: true, available: true, isDemo: false,
        data: { rows: [], asOfDate, note: 'SUPPLIER_DUES tab (or SUPPLIER_MASTER/VENDOR_MASTER) not found in this client\'s database: ' + e.message }
      };
    }
    bnxReplaceReportByFields_(clientId, 'SUPPLIER_DUES_REPORT', { LOCATION_ID: locationId, AS_OF_DATE: asOfDate }, supRows);
    bnxUpsertReportRegistry_(clientId, 'SUPPLIER_DUES_REPORT', 'FINANCE', 'REPORT', 'SUPPLIER_DUES,PURCHASE_INVOICE,PURCHASE_PAYMENT');
    return {
      success: true, available: true, isDemo: false,
      data: {
        rows: supRows, asOfDate,
        note: supRows.length === 0
          ? 'No supplier dues found. This backend has no SAVE_PURCHASE / purchase-invoice handler yet, so SUPPLIER_DUES is never populated by a live transaction today -- this report stays empty until a purchase module is built.'
          : undefined
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetSupplierDuesReportV2 failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetProfitLossReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    let netSales = 0;
    const billIdsInRange = {};
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && b.LOCATION_ID !== locationId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      netSales += Number(b.TAXABLE_AMOUNT) || 0;
      billIdsInRange[b.BILL_ID] = true;
    }
    const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
    const imValues = imSheet.getDataRange().getValues();
    const imHeaders = imValues[0];
    const costByName = {};
    for (let r = 1; r < imValues.length; r++) {
      const it = bnxRowToObject(imValues[r], imHeaders);
      if (it.CLIENT_ID !== clientId) continue;
      costByName[String(it.ITEM_NAME || '').toLowerCase().trim()] = Number(it.PURCHASE_RATE) || 0;
    }
    const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
    const biValues = biSheet.getDataRange().getValues();
    const biHeaders = biValues[0];
    let cogs = 0, itemsWithNoCost = 0;
    for (let r = 1; r < biValues.length; r++) {
      const it = bnxRowToObject(biValues[r], biHeaders);
      if (!billIdsInRange[it.BILL_ID]) continue;
      const cost = costByName[String(it.ITEM_NAME || '').toLowerCase().trim()];
      if (!cost) { itemsWithNoCost++; continue; }
      cogs += cost * (Number(it.QUANTITY) || 0);
    }
    const grossProfit = +(netSales - cogs).toFixed(2);
    const operatingExpenses = 0;
    const netProfit = +(grossProfit - operatingExpenses).toFixed(2);
    const row = {
      CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to,
      NET_SALES: +netSales.toFixed(2), COST_OF_GOODS: +cogs.toFixed(2), GROSS_PROFIT: grossProfit,
      OPERATING_EXPENSES: operatingExpenses, NET_PROFIT: netProfit,
      GROSS_MARGIN_PERCENT: netSales > 0 ? +((grossProfit / netSales) * 100).toFixed(2) : 0,
      NET_MARGIN_PERCENT: netSales > 0 ? +((netProfit / netSales) * 100).toFixed(2) : 0
    };
    bnxReplaceReportByFields_(clientId, 'PROFIT_LOSS_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, [row]);
    bnxUpsertReportRegistry_(clientId, 'PROFIT_LOSS_REPORT', 'FINANCE', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: {
        row, from, to, operatingExpensesAvailable: false,
        note: 'OPERATING_EXPENSES is a real 0, not fabricated: no expense/overhead table exists in this schema yet, so NET_PROFIT currently equals GROSS_PROFIT. COST_OF_GOODS uses ITEM_MASTER.PURCHASE_RATE at query time (not a historical cost snapshot); ' + itemsWithNoCost + ' bill line item(s) had no matching PURCHASE_RATE and were excluded from COGS.'
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetProfitLossReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetDashboardKpiReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const kpiDate = payload.date || bnxNowParts_().date;
  try {
    const dashRes = bnxGetDashboardSummary_impl_(session, { range: 'today' });
    if (!dashRes.success) return dashRes;
    const d = dashRes.data;
    const dueRes = bnxGetDueCollection(session, {});
    const outstandingDue = dueRes.success ? dueRes.data.totalOutstanding : '';
    const avgBill = d.orders > 0 ? +(d.totalSales / d.orders).toFixed(2) : 0;
    const lowStockCount = (d.inventoryAlerts || []).length;
    const nowIso = new Date().toISOString();
    const kpis = [
      { name: 'TODAYS_SALES', value: d.totalSales, trend: d.vsYesterday ? d.vsYesterday.totalSalesPct : '' },
      { name: 'TODAYS_NET_REVENUE', value: d.revenue, trend: d.vsYesterday ? d.vsYesterday.revenuePct : '' },
      { name: 'CASH_COLLECTION', value: d.collectionsByMode ? d.collectionsByMode.cash : 0 },
      { name: 'UPI_COLLECTION', value: d.collectionsByMode ? d.collectionsByMode.upi : 0 },
      { name: 'CARD_COLLECTION', value: d.collectionsByMode ? d.collectionsByMode.bank : 0 },
      { name: 'OUTSTANDING_CUSTOMER_DUE', value: outstandingDue },
      { name: 'BILL_COUNT', value: d.orders, trend: d.vsYesterday ? d.vsYesterday.ordersPct : '' },
      { name: 'AVERAGE_BILL_VALUE', value: avgBill },
      { name: 'LOW_STOCK_COUNT', value: lowStockCount, status: lowStockCount > 0 ? 'ALERT' : 'OK' },
      { name: 'TOP_ITEM_REVENUE' + ((d.topItems && d.topItems[0]) ? (' (' + d.topItems[0].name + ')') : ''), value: (d.topItems && d.topItems[0]) ? d.topItems[0].revenue : 0 }
    ];
    const rows = kpis.map(k => ({
      CLIENT_ID: clientId, LOCATION_ID: locationId, KPI_DATE: kpiDate, KPI_NAME: k.name,
      KPI_VALUE: (k.value === '' || k.value === null || k.value === undefined) ? '' : +Number(k.value).toFixed(2),
      TARGET_VALUE: '', VARIANCE: '', TREND: (k.trend === undefined ? '' : k.trend),
      STATUS: k.status || 'OK', CALCULATED_AT: nowIso
    }));
    bnxReplaceReportByFields_(clientId, 'DASHBOARD_KPI', { LOCATION_ID: locationId, KPI_DATE: kpiDate }, rows);
    bnxUpsertReportRegistry_(clientId, 'DASHBOARD_KPI', 'DASHBOARD', 'REPORT', 'BILL_MASTER,PAYMENT_MASTER,CUSTOMER_DUES,STOCK_BALANCE');
    return { success: true, data: { rows, kpiDate }, available: true, isDemo: false };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDashboardKpiReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxBuildSalesDataset_(clientId, locationId, from, to) {
  const cacheKey = 'salesds_' + clientId + '_' + locationId + '_' + from + '_' + to;
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const dataset = bnxBuildSalesDataset_impl_(clientId, locationId, from, to);
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(dataset), 20); } catch (e) {}
  return dataset;
}
function bnxBuildSalesDataset_impl_(clientId, locationId, from, to) {
  const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
  const billValues = billSheet.getDataRange().getValues();
  const billHeaders = billValues[0];
  const billMeta = {};
  let billCount = 0, totalCovers = 0;
  for (let r = 1; r < billValues.length; r++) {
    const b = bnxRowToObject(billValues[r], billHeaders);
    if (b.CLIENT_ID !== clientId) continue;
    if (locationId && b.LOCATION_ID !== locationId) continue;
    const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
    const status = String(b.BILL_STATUS || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'VOID') continue;
    billMeta[b.BILL_ID] = {
      subtotal: Number(b.SUBTOTAL) || 0,
      discount: (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0),
      tax: Number(b.TAX_AMOUNT) || 0, taxable: Number(b.TAXABLE_AMOUNT) || 0,
      grandTotal: Number(b.GRAND_TOTAL) || 0, covers: Number(b.COVERS) || 0
    };
    billCount++; totalCovers += Number(b.COVERS) || 0;
  }

  const catMap = bnxCachedCategoryNameMap_(clientId);
  const itemNameMap = bnxCachedItemNameMap_(clientId);
  const groupMap = bnxCachedItemGroupMap_(clientId);
  const imSheet = bnxClientSheet(clientId, SHEETS.ITEM_MASTER);
  const imValues = imSheet.getDataRange().getValues();
  const imHeaders = imValues[0];
  const itemMetaById = {};
  for (let r = 1; r < imValues.length; r++) {
    const it = bnxRowToObject(imValues[r], imHeaders);
    if (it.CLIENT_ID !== clientId) continue;
    itemMetaById[it.ITEM_ID] = { name: it.ITEM_NAME, categoryId: it.CATEGORY_ID || '', groupId: it.ITEM_GROUP_ID || it.GROUP_ID || '', costRate: Number(it.PURCHASE_RATE) || 0 };
  }

  const biSheet = bnxClientSheet(clientId, SHEETS.BILL_ITEMS);
  const biValues = biSheet.getDataRange().getValues();
  const biHeaders = biValues[0];
  const lineTotalByBill = {};
  const rawLines = [];
  for (let r = 1; r < biValues.length; r++) {
    const it = bnxRowToObject(biValues[r], biHeaders);
    if (!billMeta[it.BILL_ID]) continue;
    const lineTotal = Number(it.LINE_TOTAL) || 0;
    lineTotalByBill[it.BILL_ID] = (lineTotalByBill[it.BILL_ID] || 0) + lineTotal;
    rawLines.push(it);
  }

  const itemRows = [];
  const uncategorizedSet = {};
  rawLines.forEach(it => {
    const bill = billMeta[it.BILL_ID];
    const billTotal = lineTotalByBill[it.BILL_ID] || 0;
    const gross = Number(it.LINE_TOTAL) || 0;
    const share = billTotal > 0 ? gross / billTotal : 0;
    const itemId = it.ITEM_ID || itemNameMap[String(it.ITEM_NAME || '').toLowerCase().trim()] || '';
    const meta = itemMetaById[itemId] || {};
    const categoryId = meta.categoryId || '';
    const categoryName = categoryId ? (catMap.byId[categoryId] || meta.categoryName || 'Uncategorized') : 'Uncategorized';
    const groupId = meta.groupId || '';
    const groupName = groupId ? (groupMap.byId[groupId] || 'Unassigned') : 'Unassigned';
    if (!categoryId) uncategorizedSet[it.ITEM_NAME || itemId || 'unknown'] = true;
    const discount = +(bill.discount * share).toFixed(4);
    const tax = +(bill.tax * share).toFixed(4);
    const net = +(gross - discount).toFixed(4);
    const qty = Number(it.QUANTITY) || 0;
    const foodCost = (meta.costRate || 0) * qty;
    itemRows.push({
      billId: it.BILL_ID, itemId: itemId, itemName: it.ITEM_NAME || meta.name || 'Unknown Item',
      categoryId: categoryId, categoryName: categoryName, groupId: groupId, groupName: groupName, qty: qty, gross: gross,
      discount: discount, tax: tax, net: net, foodCost: foodCost
    });
  });

  return { billMeta: billMeta, billCount: billCount, totalCovers: totalCovers, itemRows: itemRows, uncategorizedItems: Object.keys(uncategorizedSet) };
}

function bnxGetItemSalesReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
    const byItem = {};
    let grandNet = 0;
    ds.itemRows.forEach(l => {
      const key = l.itemId || l.itemName;
      if (!byItem[key]) byItem[key] = { itemId: l.itemId, itemName: l.itemName, categoryId: l.categoryId, categoryName: l.categoryName || 'Uncategorized', groupId: l.groupId || '', groupName: l.groupName || 'Unassigned', qty: 0, gross: 0, discount: 0, tax: 0, net: 0, foodCost: 0, billIds: {} };
      const x = byItem[key];
      x.qty += l.qty; x.gross += l.gross; x.discount += l.discount; x.tax += l.tax; x.net += l.net; x.foodCost += l.foodCost;
      x.billIds[l.billId] = true;
      grandNet += l.net;
    });
    const sheetRows = [];
    const apiRows = [];
    Object.values(byItem).forEach(x => {
      const grossProfit = +(x.net - x.foodCost).toFixed(2);
      const base = {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, ITEM_ID: x.itemId,
        ITEM_NAME: x.itemName, CATEGORY_ID: x.categoryId, CATEGORY_NAME: x.categoryName || 'Uncategorized', ITEM_GROUP_ID: x.groupId || '', ITEM_GROUP_NAME: x.groupName || 'Unassigned', QUANTITY_SOLD: x.qty, GROSS_SALES: +x.gross.toFixed(2),
        DISCOUNT: +x.discount.toFixed(2), TAX: +x.tax.toFixed(2), NET_SALES: +x.net.toFixed(2),
        FOOD_COST: +x.foodCost.toFixed(2), GROSS_PROFIT: grossProfit,
        MARGIN_PERCENT: x.net > 0 ? +((grossProfit / x.net) * 100).toFixed(2) : 0
      };
      sheetRows.push(base);
      apiRows.push(Object.assign({}, base, {
        BILL_COUNT: Object.keys(x.billIds).length,
        BILL_IDS: Object.keys(x.billIds),
        AVERAGE_SELLING_PRICE: x.qty > 0 ? +(x.gross / x.qty).toFixed(2) : 0,
        SALES_PERCENT: grandNet > 0 ? +((x.net / grandNet) * 100).toFixed(2) : 0
      }));
    });
    apiRows.sort((a, b) => b.NET_SALES - a.NET_SALES);
    bnxReplaceReportByFields_(clientId, 'ITEM_SALES_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, sheetRows);
    bnxUpsertReportRegistry_(clientId, 'ITEM_SALES_REPORT', 'SALES', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER,CATEGORY_MASTER');
    return {
      success: true, available: true, isDemo: false,
      data: {
        rows: apiRows, from, to, totalNetSales: +grandNet.toFixed(2),
        note: ds.uncategorizedItems.length
          ? (ds.uncategorizedItems.length + ' item(s) sold with no CATEGORY_ID set in ITEM_MASTER, grouped as "Uncategorized": ' + ds.uncategorizedItems.slice(0, 10).join(', ') + ' -- fix in Master Data.')
          : undefined,
        limitation: 'No per-item return/refund table exists in this schema yet, so QUANTITY_SOLD is gross (not net of returns).'
      }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetItemSalesReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetCategorySalesReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
    const byCat = {};
    let grandNet = 0;
    ds.itemRows.forEach(l => {
      const key = l.categoryId || 'UNCATEGORIZED';
      if (!byCat[key]) byCat[key] = { categoryId: l.categoryId, categoryName: l.categoryName, qty: 0, gross: 0, discount: 0, tax: 0, net: 0, foodCost: 0, billIds: {} };
      const x = byCat[key];
      x.qty += l.qty; x.gross += l.gross; x.discount += l.discount; x.tax += l.tax; x.net += l.net; x.foodCost += l.foodCost;
      x.billIds[l.billId] = true;
      grandNet += l.net;
    });
    const sheetRows = [];
    const apiRows = [];
    Object.values(byCat).forEach(x => {
      const grossProfit = +(x.net - x.foodCost).toFixed(2);
      const base = {
        CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, CATEGORY_ID: x.categoryId,
        CATEGORY_NAME: x.categoryName, QUANTITY_SOLD: x.qty, GROSS_SALES: +x.gross.toFixed(2), DISCOUNT: +x.discount.toFixed(2),
        TAX: +x.tax.toFixed(2), NET_SALES: +x.net.toFixed(2), FOOD_COST: +x.foodCost.toFixed(2), GROSS_PROFIT: grossProfit,
        MARGIN_PERCENT: x.net > 0 ? +((grossProfit / x.net) * 100).toFixed(2) : 0
      };
      sheetRows.push(base);
      apiRows.push(Object.assign({}, base, {
        BILL_COUNT: Object.keys(x.billIds).length,
        SALES_PERCENT: grandNet > 0 ? +((x.net / grandNet) * 100).toFixed(2) : 0
      }));
    });
    apiRows.sort((a, b) => b.NET_SALES - a.NET_SALES);
    bnxReplaceReportByFields_(clientId, 'CATEGORY_SALES_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, sheetRows);
    bnxUpsertReportRegistry_(clientId, 'CATEGORY_SALES_REPORT', 'SALES', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER,CATEGORY_MASTER');
    return { success: true, available: true, isDemo: false, data: { rows: apiRows, from, to, totalNetSales: +grandNet.toFixed(2) } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetCategorySalesReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetSalesSummaryReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const dayBookRes = bnxGetSalesDayBookReport_impl_(session, payload);
    if (!dayBookRes.success) return dayBookRes;
    const days = dayBookRes.data.rows;
    let totalBills = 0, gross = 0, discount = 0, tax = 0, net = 0;
    let cash = 0, upi = 0, card = 0, other = 0, due = 0, refunds = 0;
    days.forEach(d => {
      totalBills += Number(d.BILL_COUNT)||0;
      gross += Number(d.GROSS_SALES)||0;
      discount += Number(d.DISCOUNT)||0;
      tax += Number(d.TAX)||0;
      net += Number(d.NET_SALES)||0;
      cash += Number(d.CASH)||0;
      upi += Number(d.UPI)||0;
      card += Number(d.CARD)||0;
      other += Number(d.OTHER)||0;
      due += Number(d.DUE)||0;
      refunds += Number(d.REFUNDS)||0;
    });

    /* Bill Total is the actual grand total charged on invoices (inclusive of
       GST), not NET_SALES. Compute directly from BILL_MASTER so the selected
       period never inherits a dashboard "today" number. */
    let billTotal = 0;
    try {
      const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
      const vals = billSheet.getDataRange().getValues();
      const headers = vals[0] || [];
      for(let r=1;r<vals.length;r++){
        const b=bnxRowToObject(vals[r],headers);
        if(b.CLIENT_ID!==clientId) continue;
        if(locationId && String(b.LOCATION_ID||'')!==String(locationId)) continue;
        if(b.BILL_DATE<from || b.BILL_DATE>to) continue;
        const st=String(b.BILL_STATUS||'').toUpperCase();
        if(st==='CANCELLED'||st==='VOID') continue;
        billTotal += Number(b.GRAND_TOTAL)||0;
      }
    } catch(e) {}

    let covers = 0;
    try { covers = bnxBuildSalesDataset_(clientId, locationId, from, to).totalCovers || 0; } catch (e) {}
    const row = {
      CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, TOTAL_BILLS: totalBills,
      BILL_TOTAL: +billTotal.toFixed(2),
      GROSS_SALES: +gross.toFixed(2), DISCOUNT: +discount.toFixed(2), TAX: +tax.toFixed(2), NET_SALES: +net.toFixed(2),
      CASH: +cash.toFixed(2), UPI: +upi.toFixed(2), CARD: +card.toFixed(2), OTHER: +other.toFixed(2),
      DUE: +due.toFixed(2), REFUNDS: +refunds.toFixed(2),
      AVERAGE_BILL_VALUE: totalBills > 0 ? +(billTotal / totalBills).toFixed(2) : 0, COVERS: covers,
      SALES_PER_COVER: covers > 0 ? +(net / covers).toFixed(2) : 0
    };
    bnxReplaceReportByFields_(clientId, 'SALES_SUMMARY', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, [row]);
    bnxUpsertReportRegistry_(clientId, 'SALES_SUMMARY', 'SALES', 'REPORT', 'SALES_DAY_BOOK,BILL_MASTER,PAYMENT_MASTER');
    return { success: true, available: true, isDemo: false, data: { row, from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetSalesSummaryReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetReconciliationReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const billSheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const billValues = billSheet.getDataRange().getValues();
    const billHeaders = billValues[0];
    let billTotalPaid = 0;
    const billIdsPaid = {};
    let netSalesFromBills = 0;
    for (let r = 1; r < billValues.length; r++) {
      const b = bnxRowToObject(billValues[r], billHeaders);
      if (b.CLIENT_ID !== clientId) continue;
      if (locationId && String(b.LOCATION_ID || '') !== String(locationId)) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      netSalesFromBills += Number(b.TAXABLE_AMOUNT) || 0;
      if (String(b.PAYMENT_STATUS).toUpperCase() !== 'PAID') continue;
      billTotalPaid += Number(b.GRAND_TOTAL) || 0;
      billIdsPaid[b.BILL_ID] = Number(b.GRAND_TOTAL) || 0;
    }
    const paySheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
    const payValues = paySheet.getDataRange().getValues();
    const payHeaders = payValues[0];
    const paidByBill = {};
    let paymentTotal = 0;
    for (let r = 1; r < payValues.length; r++) {
      const p = bnxRowToObject(payValues[r], payHeaders);
      if (p.CLIENT_ID !== clientId) continue;
      if (locationId && String(p.LOCATION_ID || '') !== String(locationId)) continue;
      const _payDateKey = bnxNormalizeDateKey_(p.PAYMENT_DATE); if (!_payDateKey || _payDateKey < from || _payDateKey > to) continue;
      if (String(p.PAYMENT_STATUS).toUpperCase() !== 'SUCCESS') continue;
      paymentTotal += Number(p.AMOUNT) || 0;
      if (p.BILL_ID) paidByBill[p.BILL_ID] = (paidByBill[p.BILL_ID] || 0) + (Number(p.AMOUNT) || 0);
    }
    let exceptionCount = 0;
    Object.keys(billIdsPaid).forEach(billId => {
      if (Math.abs(billIdsPaid[billId] - (paidByBill[billId] || 0)) > 0.5) exceptionCount++;
    });
    const diff1 = +(billTotalPaid - paymentTotal).toFixed(2);
    const rows = [{
      CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: 'BILL_VS_PAYMENT',
      SOURCE_TOTAL: +billTotalPaid.toFixed(2), TARGET_TOTAL: +paymentTotal.toFixed(2), DIFFERENCE: diff1,
      STATUS: Math.abs(diff1) < 1 ? 'MATCHED' : 'MISMATCH', EXCEPTION_COUNT: exceptionCount,
      REMARKS: 'Sum of PAID bills (BILL_MASTER) vs sum of successful payments (PAYMENT_MASTER), ' + from + ' to ' + to
    }];
    try {
      const ledgerSheet = bnxClientSheet(clientId, SHEETS.LEDGER_ENTRIES);
      const ledgerValues = ledgerSheet.getDataRange().getValues();
      const ledgerHeaders = ledgerValues[0];
      const salesAcct = bnxGetOrCreateLedgerAccount_(clientId, 'SALES', 'Sales', 'INCOME');
      let salesLedgerTotal = 0;
      for (let r = 1; r < ledgerValues.length; r++) {
        const e = bnxRowToObject(ledgerValues[r], ledgerHeaders);
        if (e.CLIENT_ID !== clientId) continue;
        const _entryDateKey = bnxNormalizeDateKey_(e.ENTRY_DATE); if (!_entryDateKey || _entryDateKey < from || _entryDateKey > to) continue;
        if (e.ACCOUNT !== salesAcct) continue;
        salesLedgerTotal += Number(e.CREDIT) || 0;
      }
      const diff2 = +(netSalesFromBills - salesLedgerTotal).toFixed(2);
      rows.push({
        CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: 'SALES_VS_LEDGER',
        SOURCE_TOTAL: +netSalesFromBills.toFixed(2), TARGET_TOTAL: +salesLedgerTotal.toFixed(2), DIFFERENCE: diff2,
        STATUS: Math.abs(diff2) < 1 ? 'MATCHED' : 'MISMATCH', EXCEPTION_COUNT: 0,
        REMARKS: 'Sum of BILL_MASTER.TAXABLE_AMOUNT vs Sales ledger credits, ' + from + ' to ' + to
      });
    } catch (e) {}
    try {
      const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
      const itemNetTotal = ds.itemRows.reduce((s, l) => s + l.net, 0);
      const diff3 = +(netSalesFromBills - itemNetTotal).toFixed(2);
      rows.push({
        CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: 'ITEM_VS_DAYBOOK',
        SOURCE_TOTAL: +netSalesFromBills.toFixed(2), TARGET_TOTAL: +itemNetTotal.toFixed(2), DIFFERENCE: diff3,
        STATUS: Math.abs(diff3) < 1 ? 'MATCHED' : 'MISMATCH', EXCEPTION_COUNT: 0,
        REMARKS: 'Sum of BILL_MASTER.TAXABLE_AMOUNT vs sum of ITEM_SALES_REPORT NET_SALES, ' + from + ' to ' + to
      });
      rows.push({
        CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: 'CATEGORY_VS_DAYBOOK',
        SOURCE_TOTAL: +netSalesFromBills.toFixed(2), TARGET_TOTAL: +itemNetTotal.toFixed(2), DIFFERENCE: diff3,
        STATUS: Math.abs(diff3) < 1 ? 'MATCHED' : 'MISMATCH', EXCEPTION_COUNT: 0,
        REMARKS: 'Category totals are a regrouping of the same item-level lines, so this equals ITEM_VS_DAYBOOK by construction, ' + from + ' to ' + to
      });
    } catch (e) {}
    bnxReplaceReportByFields_(clientId, 'RECONCILIATION_REPORT', { LOCATION_ID: locationId, RECON_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'RECONCILIATION_REPORT', 'CONTROL', 'REPORT', 'BILL_MASTER,BILL_ITEMS,PAYMENT_MASTER,LEDGER_ENTRIES');
    return { success: true, data: { rows, from, to }, available: true, isDemo: false };
  } catch (error) {
    bnxLogError(clientId, `bnxGetReconciliationReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

function bnxGetCashbookReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const day = {};
    const ensure = d => day[d] || (day[d] = { date:d, cashIn:0, cashOut:0, adjustments:0 });
    const prior = { cashIn:0, cashOut:0, adjustments:0 };
    const inRange = (d)=>String(d||'')>=from && String(d||'')<=to;
    const beforeRange = (d)=>String(d||'')<from;

    // Cash received from finalized payment rows.
    try {
      const sheet = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER);
      const values = sheet.getDataRange().getValues(), headers = values[0] || [];
      for (let r=1;r<values.length;r++){
        const p=bnxRowToObject(values[r],headers);
        if(p.CLIENT_ID!==clientId) continue;
        if(locationId && String(p.LOCATION_ID||'')!==String(locationId)) continue;
        const status=String(p.PAYMENT_STATUS||'').toUpperCase();
        if(status==='REFUNDED'||status==='REVERSED') continue;
        if(String(p.PAYMENT_MODE||'').toUpperCase()!=='CASH') continue;
        const dt=String(p.PAYMENT_DATE||'').slice(0,10), amt=Number(p.AMOUNT)||0;
        if(beforeRange(dt)) prior.cashIn+=amt;
        else if(inRange(dt)) ensure(dt).cashIn+=amt;
      }
    } catch(e) {}

    // Cash received against customer dues is also a cash-book receipt.
    try {
      const sheet = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT);
      const values = sheet.getDataRange().getValues(), headers = values[0] || [];
      for (let r=1;r<values.length;r++){
        const x=bnxRowToObject(values[r],headers);
        if(x.CLIENT_ID!==clientId) continue;
        if(locationId && String(x.LOCATION_ID||'')!==String(locationId)) continue;
        if(String(x.PAYMENT_MODE||'').toUpperCase()!=='CASH') continue;
        const dt=String(x.RECEIPT_DATE||'').slice(0,10), amt=Number(x.AMOUNT)||0;
        if(beforeRange(dt)) prior.cashIn+=amt; else if(inRange(dt)) ensure(dt).cashIn+=amt;
      }
    } catch(e) {}

    // Supplier cash payments are cash-book outflows when PURCHASE_PAYMENT exists.
    try {
      const sheet = bnxClientSheet(clientId, 'PURCHASE_PAYMENT');
      const values = sheet.getDataRange().getValues(), headers = values[0] || [];
      for (let r=1;r<values.length;r++){
        const x=bnxRowToObject(values[r],headers);
        if(x.CLIENT_ID!==clientId) continue;
        if(locationId && String(x.LOCATION_ID||'')!==String(locationId)) continue;
        if(String(x.PAYMENT_MODE||'').toUpperCase()!=='CASH') continue;
        const dt=String(x.PAYMENT_DATE||x.PAID_DATE||'').slice(0,10), amt=Number(x.AMOUNT)||0;
        if(beforeRange(dt)) prior.cashOut+=amt; else if(inRange(dt)) ensure(dt).cashOut+=amt;
      }
    } catch(e) {}

    // Petty cash payments are direct cash-book outflows.
    try {
      const sheet = bnxClientSheet(clientId, 'PETTY_CASH_MASTER');
      const values = sheet.getDataRange().getValues(), headers = values[0] || [];
      for (let r=1;r<values.length;r++){
        const x=bnxRowToObject(values[r],headers);
        if(x.CLIENT_ID!==clientId) continue;
        if(locationId && String(x.LOCATION_ID||'')!==String(locationId)) continue;
        const dt=String(x.ENTRY_DATE||'').slice(0,10), raw=Number(x.AMOUNT)||0;
        if(!dt) continue;
        const isIn=String(x.ENTRY_TYPE||'').toUpperCase().includes('RECEIPT') || raw<0;
        const amt=Math.abs(raw);
        if(beforeRange(dt)){ if(isIn) prior.cashIn+=amt; else prior.cashOut+=amt; }
        else if(inRange(dt)){ const d=ensure(dt); if(isIn) d.cashIn+=amt; else d.cashOut+=amt; }
      }
    } catch(e) {}

    let opening = prior.cashIn-prior.cashOut+prior.adjustments;
    const rows = Object.keys(day).sort().map(dt=>{
      const x=day[dt];
      const row={
        CLIENT_ID:clientId, LOCATION_ID:locationId, FROM_DATE:dt, TO_DATE:dt, date:dt,
        mode:'Cash', PAYMENT_MODE:'CASH', OPENING_BALANCE:+opening.toFixed(2),
        cashIn:+x.cashIn.toFixed(2), cashOut:+x.cashOut.toFixed(2),
        RECEIPTS:+x.cashIn.toFixed(2), PAYMENTS:+x.cashOut.toFixed(2), ADJUSTMENTS:+x.adjustments.toFixed(2),
        closingBalance:+(opening+x.cashIn-x.cashOut+x.adjustments).toFixed(2), CLOSING_BALANCE:+(opening+x.cashIn-x.cashOut+x.adjustments).toFixed(2)
      };
      opening=row.closingBalance;
      return row;
    });
    return { success:true, data:{ rows, from, to, openingBalance:+(prior.cashIn-prior.cashOut+prior.adjustments).toFixed(2), closingBalance:rows.length?rows[rows.length-1].closingBalance:+(prior.cashIn-prior.cashOut+prior.adjustments).toFixed(2) } };
  } catch(error){
    bnxLogError(clientId, `bnxGetCashbookReport failed: ${error.message}`, payload);
    return { success:false, error:error.message };
  }
}
function bnxGetDiscountReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const { from, to } = bnxResolveDateRange_(payload);
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows = [];
    let totalDiscount = 0;
    for (let r = 1; r < values.length; r++) {
      const b = bnxRowToObject(values[r], headers);
      if (b.CLIENT_ID !== clientId) continue;
      const _billDateKey = bnxNormalizeDateKey_(b.BILL_DATE); if (!_billDateKey || _billDateKey < from || _billDateKey > to) continue;
      const discAmt = (Number(b.BILL_DISCOUNT) || 0) + (Number(b.ITEM_DISCOUNT) || 0);
      if (discAmt <= 0) continue;
      // FIX ("discount report problem" -- confirmed, not guessed): both
      // bnxSaveBill (bill.sub, the raw pre-discount cart total the
      // frontend sends) and bnxImportPosHeadBatch_ (grossSales =
      // food+bar+beverage+tobacco, also pre-discount) already store
      // BILL_MASTER.SUBTOTAL as the GROSS, pre-discount amount -- e.g.
      // real bill HT/2627/00000007: SUBTOTAL_AFTER_ITEM_DISCOUNT 4407 +
      // ITEM_DISCOUNT 778 = SUBTOTAL 5185 exactly. This line was adding
      // discAmt a SECOND time on top of that already-gross SUBTOTAL
      // (5185 + 778 = 5963), which both showed a wrong, inflated "Gross"
      // column and silently under-reported every discount percentage
      // (778/5963 = 13.05% shown, when the real rate is 778/5185 =
      // 15.00%). SUBTOTAL alone already IS the gross figure.
      const gross = Number(b.SUBTOTAL) || 0;
      totalDiscount += discAmt;
      rows.push({ date: b.BILL_DATE, billNo: b.BILL_NUMBER, customer: b.CUSTOMER_NAME || 'GENERAL CUSTOMER', waiter: b.CREATED_BY || '', gross: gross, discPct: gross > 0 ? +((discAmt / gross) * 100).toFixed(1) : 0, discAmt: discAmt, netAmt: +(gross - discAmt).toFixed(2), authBy: '' });
    }
    return { success: true, data: { rows, totalDiscount: +totalDiscount.toFixed(2), from, to } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetDiscountReport failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

/* ============================================================================
 * PETTY CASH + REAL ONLINE ORDERS LIST
 * ----------------------------------------------------------------------
 * Confirmed by reading restaurant-dashboard.html directly:
 *   1. "Petty Cash not save" -- pettySave() never called the backend at
 *      all. It only appended a <tr> to the DOM and bumped a localStorage
 *      counter (bnx_petty_seq). Refresh the page, or open it on another
 *      device, and every voucher ever entered was gone -- it was never
 *      written to any sheet.
 *   2. "Online order demo data" -- the operational "Online Orders" page
 *      (left-nav item, aggregator cards + "All Online Orders" table) was
 *      not real -- loadOnlineOrders() just showed a fake toast and never
 *      touched the DOM. The Reports Hub's aggregate GET_ONLINE_ORDER_REPORT
 *      was already real and is untouched by this addition.
 *
 * REQUIRED MANUAL SHEET CHANGE: create a PETTY_CASH_MASTER tab in the
 * client's TEMPLATE_TRANSACTION_DB with these columns:
 *   PETTY_CASH_ID, CLIENT_ID, LOCATION_ID, VOUCHER_NO, ENTRY_DATE,
 *   ENTRY_TYPE, ACCOUNT, PARTY_NAME, PURPOSE, AMOUNT, NARRATION,
 *   RUNNING_BALANCE, CREATED_BY, CREATED_AT
 * Until that tab exists, bnxClientSheet() throws a clear "tab not found"
 * error naming the missing sheet -- never silently falls back to fake data.
 * ============================================================================ */
/* PETTY CASH TEMPLATE COMPATIBILITY
 * The current transaction template uses PETTY_CASH, while the merged
 * backend contract uses PETTY_CASH_MASTER. Prefer the new normalized
 * PETTY_CASH_MASTER sheet; if an older client still has only PETTY_CASH,
 * read/write it through this adapter so Petty Cash does not disappear.
 */
function bnxGetPettyCashSheet_(clientId) {
  try { return { sheet: bnxClientSheet(clientId, 'PETTY_CASH_MASTER'), legacy: false }; }
  catch (e1) {
    return { sheet: bnxClientSheet(clientId, 'PETTY_CASH'), legacy: true };
  }
}
function bnxPettyLegacyToRecord_(row) {
  return {
    PETTY_CASH_ID: row.VOUCHER_ID || '',
    CLIENT_ID: row.CLIENT_ID || '',
    LOCATION_ID: row.LOCATION_ID || '',
    VOUCHER_NO: row.VOUCHER_ID || '',
    ENTRY_DATE: row.DATE || '',
    ENTRY_TYPE: String(row.TYPE || '').toUpperCase() === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT',
    ACCOUNT: row.CATEGORY || '',
    PARTY_NAME: '',
    PURPOSE: row.DESCRIPTION || '',
    AMOUNT: (String(row.TYPE || '').toUpperCase() === 'RECEIPT' ? 1 : -1) * (Number(row.AMOUNT) || 0),
    NARRATION: row.DESCRIPTION || '',
    RUNNING_BALANCE: Number(row.RUNNING_BALANCE) || 0,
    CREATED_BY: row.USER_ID || '',
    CREATED_AT: row.CREATED_AT || ''
  };
}

function bnxSavePettyCash(session, payload) {
  const requestId = payload.requestId || '';
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  const claim = bnxClaimRequest(clientId, requestId, 'PETTY_CASH');
  if (!claim.claimed) {
    return { success: true, transactionId: claim.existing.transactionId, message: 'Duplicate request detected -- using previous result', cached: true };
  }
  const entryType = String(payload.type || '').toLowerCase() === 'receipt' ? 'RECEIPT' : 'PAYMENT';
  const account = String(payload.account || '').trim();
  const amount = Number(payload.amount) || 0;
  if (!account || amount <= 0) return respondError(400, 'account and a positive amount are required', requestId);
  try {
    const now = bnxNowParts_();
    const entryDate = (payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)) ? payload.date : now.businessDate;
    const signed = entryType === 'RECEIPT' ? amount : -amount;

    // Running balance is computed here, server-side, from the real ledger
    // -- never trusted from the client -- so two devices entering vouchers
    // back-to-back can never silently disagree on the balance the way the
    // old localStorage-only version could.
    const pettyTarget = bnxGetPettyCashSheet_(clientId);
    const sheet = pettyTarget.sheet;
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const ciCol = headers.indexOf('CLIENT_ID');
    const balCol = headers.indexOf('RUNNING_BALANCE');
    let prevBalance = 0;
    for (let r = values.length - 1; r >= 1; r--) {
      if (ciCol !== -1 && values[r][ciCol] !== clientId) continue;
      prevBalance = Number(values[r][balCol]) || 0;
      break;
    }
    const newBalance = +(prevBalance + signed).toFixed(2);

    const voucherRange = bnxReserveNumberBatch_(clientId, 'PETTY_CASH_VOUCHER', 1);
    const voucherNo = voucherRange.prefix + String(voucherRange.to).padStart(voucherRange.padLength, '0');

    const name = String(payload.name || '').trim();
    const purpose = String(payload.purpose || '').trim();
    const verb = entryType === 'RECEIPT' ? 'received from' : 'paid to';
    const narration = 'Being amount ' + verb + (name ? ' ' + name : ' \u2014') + (purpose ? ' towards ' + purpose : '');

    const pettyCashId = generateShortId_(clientId, 'PETTY_CASH_ID');
    const record = {
      PETTY_CASH_ID: pettyCashId, CLIENT_ID: clientId, LOCATION_ID: payload.locationId || '',
      VOUCHER_NO: voucherNo, ENTRY_DATE: entryDate, ENTRY_TYPE: entryType, ACCOUNT: account,
      PARTY_NAME: name, PURPOSE: purpose, AMOUNT: signed, NARRATION: narration,
      RUNNING_BALANCE: newBalance, CREATED_BY: userId, CREATED_AT: now.iso
    };
    if (pettyTarget.legacy) {
      bnxAppendRow(clientId, 'PETTY_CASH', {
        VOUCHER_ID: voucherNo, CLIENT_ID: clientId, DATE: entryDate,
        TIME: now.time, TYPE: entryType, CATEGORY: account, DESCRIPTION: narration,
        AMOUNT: amount, PAYMENT_MODE: 'CASH', REFERENCE: '', USER_ID: userId,
        STATUS: 'POSTED', CREATED_AT: now.iso, UPDATED_AT: now.iso
      });
    } else {
      bnxAppendRow(clientId, SHEETS.PETTY_CASH_MASTER, record);
    }
    bnxCreateAuditLog(clientId, {
      CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'PETTY_CASH',
      RECORD_TYPE: 'PETTY_CASH', RECORD_ID: pettyCashId, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify(record), REQUEST_ID: requestId, TIMESTAMP: now.iso
    });
    bnxMarkSynced(clientId, requestId, pettyCashId, 'PETTY_CASH');
    return { success: true, transactionId: pettyCashId, voucherNo: voucherNo, balance: newBalance, data: record };
  } catch (error) {
    bnxLogError(clientId, `bnxSavePettyCash failed: ${error.message}`, { requestId, payload });
    return respondError(500, error.message, requestId);
  }
}

function bnxGetPettyCashLedger(session, payload) {
  const clientId = session.CLIENT_ID;
  const from = payload.from || payload.FROM_DATE || '';
  const to = payload.to || payload.TO_DATE || '';
  try {
    const pettyTarget = bnxGetPettyCashSheet_(clientId);
    const values = pettyTarget.sheet.getDataRange().getValues();
    const headers = values[0];
    const allRows = [];
    let running = 0;

    for (let r = 1; r < values.length; r++) {
      let row = bnxRowToObject(values[r], headers);
      if (row.CLIENT_ID !== clientId) continue;

      if (pettyTarget.legacy) {
        // Legacy PETTY_CASH has no server running-balance column.
        // Rebuild it deterministically from the ledger order.
        const signed = String(row.TYPE||'').toUpperCase() === 'RECEIPT'
          ? Math.abs(Number(row.AMOUNT)||0)
          : -Math.abs(Number(row.AMOUNT)||0);
        running = +(running + signed).toFixed(2);
        row = bnxPettyLegacyToRecord_(row);
        row.RUNNING_BALANCE = running;
      } else {
        running = Number(row.RUNNING_BALANCE) || running;
      }
      allRows.push(row);
    }

    const closingBalance = allRows.length ? Number(allRows[allRows.length - 1].RUNNING_BALANCE) || 0 : 0;
    const rowsInRange = allRows.filter(row => (!from || String(row.ENTRY_DATE) >= from) && (!to || String(row.ENTRY_DATE) <= to));
    const openingBalance = rowsInRange.length
      ? +((Number(rowsInRange[0].RUNNING_BALANCE) || 0) - (Number(rowsInRange[0].AMOUNT) || 0)).toFixed(2)
      : closingBalance;
    return { success: true, data: { rows: rowsInRange, openingBalance, closingBalance, from, to, source: pettyTarget.legacy ? 'PETTY_CASH' : 'PETTY_CASH_MASTER' } };
  } catch (error) {
    bnxLogError(clientId, `bnxGetPettyCashLedger failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

/* ONLINE ORDERS -- real per-order list (the Reports Hub's aggregate
   GET_ONLINE_ORDER_REPORT already existed and is real; this is the
   missing "list individual orders" reader the operational Online
   Orders page needs instead of its hardcoded demo table). */
function bnxGetOnlineOrdersList(session, payload) {
  const clientId = session.CLIENT_ID;
  const date = (payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)) ? payload.date : bnxNowParts_().date;
  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  try {
    const sheet = bnxClientSheet(clientId, SHEETS.ONLINE_ORDER_MASTER);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const o = bnxRowToObject(values[r], headers);
      if (o.CLIENT_ID !== clientId) continue;
      let d = o.CREATED_AT, t = '';
      try {
        const dt = new Date(o.CREATED_AT);
        if (!isNaN(dt.getTime())) { d = Utilities.formatDate(dt, tz, 'yyyy-MM-dd'); t = Utilities.formatDate(dt, tz, 'HH:mm'); }
      } catch (e) {}
      if (d !== date) continue;
      rows.push({
        aggregator: o.AGGREGATOR || '', orderRef: o.AGGREGATOR_ORDER_ID || o.ONLINE_ORDER_ID, time: t,
        billAmount: Number(o.ORDER_AMOUNT) || 0, platformFee: Number(o.PLATFORM_FEE) || 0,
        deliveryFee: Number(o.DELIVERY_FEE) || 0, discountByPlatform: Number(o.DISCOUNT_BY_PLATFORM) || 0,
        netAmount: Number(o.NET_AMOUNT_TO_RESTAURANT) || 0, orderStatus: o.ORDER_STATUS || '',
        customerName: o.CUSTOMER_NAME || ''
      });
    }
    rows.sort((a, b) => a.time.localeCompare(b.time));
    const totalsByAgg = {};
    rows.forEach(r => {
      if (!totalsByAgg[r.aggregator]) totalsByAgg[r.aggregator] = { orders: 0, revenue: 0 };
      totalsByAgg[r.aggregator].orders += 1;
      totalsByAgg[r.aggregator].revenue += r.billAmount;
    });
    return {
      success: true, data: { rows, totalsByAgg, date,
        note: 'Settlement status and a separate GST/packing split are not tracked per-order in ONLINE_ORDER_MASTER yet (only PLATFORM_FEE/DELIVERY_FEE/DISCOUNT_BY_PLATFORM exist) -- those columns are left blank rather than guessed. This only shows orders logged via "Log Online Order" (SAVE_ONLINE_ORDER); there is no live Zomato/Swiggy/etc. API connection.' }
    };
  } catch (error) {
    bnxLogError(clientId, `bnxGetOnlineOrdersList failed: ${error.message}`, payload);
    return { success: false, error: error.message };
  }
}

// =====================================================================
// END OF FILE -- this is now the ONLY Code.gs in this Apps Script
// project (backend + full report engine + Petty Cash + Online Orders
// List, merged Sep 2026). Delete every other .gs file in the project.
//
// REMAINING GAPS (honestly flagged, carried over from earlier passes,
// still true as of this merge):
//  1. AI_QUERY -- needs an AI provider/API-key decision, not a data fix.
//  2. New sheets required before their handlers work: TABLE_LIVE_STATE,
//     RESERVATION_MASTER, DAY_STATUS, A7_SETTINGS_TOGGLES,
//     SEQUENCE_COUNTERS, PRODUCTION_MASTER, PRODUCTION_ITEMS,
//     MENU_CARD_UPLOAD, and now PETTY_CASH_MASTER (see the Petty Cash
//     section header above for its exact required columns) -- confirm
//     these tabs exist in your real TEMPLATE_TRANSACTION_DB /
//     TEMPLATE_MASTER_DB.
//  3. bnxVerifySession() is still the placeholder UUID-shape check --
//     genuine session verification lives in the separate V2_AUTH
//     deployment, not in this file.
//  4. SUPPLIER_MASTER naming is normalized to the real SUPPLIER_MASTER tab.
//  5. GET_CONFIG uses DEPLOYMENT_CONFIG when present; hardcoded bootstrap IDs
//     remain only as a startup fallback until that sheet is populated.
//  6. bnxSaveOrder add-on upsert only matches on ORDER_NUMBER.
//  7. No SETTLE_DUE_BILL backend action exists yet.
//  8. REQUIRED MANUAL SHEET CHANGE (PASS #49): add ADDRESS, PHONE,
//     EMAIL, FSSAI, LOGO_URL columns to the real COMPANY_SETTINGS tab.
//  9. CLIENT_DATABASE_REGISTRY must have MASTER_DB_ID AND
//     TRANSACTION_DB_ID filled for every client this backend serves.
//  10. REQUIRED MANUAL SHEET CHANGE (PASS #57): add UNITS_PER_PACK,
//      UNIT_SIZE, BASE_UOM columns to the real UNIT_MASTER tab.
//  11. REBUILD_STOCK_BALANCE is on-demand only (not auto-run on every
//      sale/purchase).
//  12. WASTAGE performance amounts require WASTAGE_MASTER.CLIENT_ID in the
//      deployed transaction schema for client-safe filtering.
//  13. HR_REPORT/PAYROLL_REPORT need ATTENDANCE_MASTER/SHIFT_TRANSACTION/
//      LEAVE_TRANSACTION/PAYROLL_MASTER/INCENTIVE_TRANSACTION/PF_ESIC_
//      TRANSACTION tables built first.
//  14. Attendance employee bridge is connected to USER_MASTER via
//      GET_ATTENDANCE_EMPLOYEES (identity fields only; no passwords returned).
//      Add Staff stores the same password in client USER_MASTER and central
//      USER_SECURITY_MASTER_DB; when omitted, employee name is the initial
//      password for the requested compatibility behavior.
//  15. REQUIRED MANUAL SHEET CHANGE: create PETTY_CASH_MASTER in
//      TEMPLATE_TRANSACTION_DB (or retain legacy PETTY_CASH, which the adapter
//      supports) before production Petty Cash use.
// =====================================================================


/* ============================================================================
 * LIVE RECIPE / COSTING ENGINE v1
 * --------------------------------------------------------------------------
 * Source of truth:
 *   ITEM_MASTER          -> finished/menu item + purchase rate fallback
 *   RAW_MATERIAL_MASTER  -> raw ingredient + live COST_PRICE
 *   UNIT_MASTER          -> unit identities
 *   UNIT_CONVERSION_MASTER -> only explicit conversion factors
 *   RECIPE_MASTER        -> recipe header/yield
 *   RECIPE_ITEMS         -> ingredients/components + wastage
 *   RECIPE_VERSION       -> immutable-ish version/cost snapshot
 *   ITEM_ALIAS_MASTER    -> alternate item lookup names/codes
 *
 * Important: this engine NEVER invents ingredient quantities or cross-unit
 * conversion ratios. If a recipe or cost is missing, it returns the exact
 * unresolved dependency so the admin can correct the master data.
 * ========================================================================== */
const BNX_RECIPE_WRITE_ROLES_ = ['ADMIN','SUPER_ADMIN','DEVELOPER'];

function bnxRecipeCanWrite_(session){
  return BNX_RECIPE_WRITE_ROLES_.indexOf(String(session && session.ROLE || '').toUpperCase()) !== -1;
}
function bnxRequireRecipeWrite_(session){
  if(!bnxRecipeCanWrite_(session)) throw new Error('Admin or Super Admin authorization required');
}
function bnxNormUnit_(v){ return String(v == null ? '' : v).trim().toUpperCase(); }
function bnxNum_(v, d){ const n=Number(v); return Number.isFinite(n) ? n : (d==null?0:d); }
function bnxBool_(v, d){
  if(v===true || String(v).toUpperCase()==='TRUE' || String(v)==='1' || String(v).toUpperCase()==='YES') return true;
  if(v===false || String(v).toUpperCase()==='FALSE' || String(v)==='0' || String(v).toUpperCase()==='NO') return false;
  return d==null?false:d;
}
function bnxEnsureColumns_(sheet, names){
  const vals=sheet.getDataRange().getValues(); const h=vals[0]||[]; let last=0;
  for(let i=0;i<h.length;i++) if(String(h[i]||'').trim()) last=i+1;
  names.forEach(name=>{ if(h.indexOf(name)===-1){ last++; sheet.getRange(1,last).setValue(name); h.push(name); } });
  return h;
}
function bnxRowObjByHeaders_(row, headers){
  const o={}; for(let i=0;i<headers.length;i++) if(headers[i]) o[String(headers[i]).trim()]=row[i]; return o;
}
function bnxUnitMapsForClient_(clientId){
  const byId={}, byToken={};
  try{
    const sh=bnxClientSheet(clientId,SHEETS.UNIT_MASTER||'UNIT_MASTER'); const v=sh.getDataRange().getValues(); const h=v[0]||[];
    for(let r=1;r<v.length;r++){
      const o=bnxRowObjByHeaders_(v[r],h); const id=String(o.UNIT_ID||'').trim(); if(!id) continue;
      const name=bnxNormUnit_(o.UNIT_NAME), ab=bnxNormUnit_(o.ABBREVIATION);
      byId[id]={id,name,ab,unitFactor:bnxNum_(o.CONVERSION_FACTOR,1)};
      [id,name,ab].filter(Boolean).forEach(k=>byToken[k]=id);
    }
  }catch(e){}
  return {byId,byToken};
}
function bnxResolveUnitIdLive_(clientId, token, maps){
  const t=String(token==null?'':token).trim(); if(!t) return '';
  return maps.byId[t] ? t : (maps.byToken[bnxNormUnit_(t)] || '');
}
function bnxConversionMapForClient_(clientId){
  const maps={};
  try{
    const sh=bnxClientSheet(clientId,SHEETS.UNIT_CONVERSION_MASTER||'UNIT_CONVERSION_MASTER'); const v=sh.getDataRange().getValues(); const h=v[0]||[];
    for(let r=1;r<v.length;r++){
      const o=bnxRowObjByHeaders_(v[r],h); if(o.IS_ACTIVE!==undefined && !bnxBool_(o.IS_ACTIVE,true)) continue;
      const f=String(o.FROM_UNIT_ID||'').trim(), t=String(o.TO_UNIT_ID||'').trim(), item=String(o.ITEM_ID||'').trim(); const factor=bnxNum_(o.CONVERSION_FACTOR,0);
      if(!f||!t||!(factor>0)) continue; maps[item+'|'+f+'|'+t]=factor;
    }
  }catch(e){}
  return maps;
}
function bnxFindLiveConversion_(clientId, fromToken, toToken, itemId, unitMaps, convMap){
  const f=bnxResolveUnitIdLive_(clientId,fromToken,unitMaps), t=bnxResolveUnitIdLive_(clientId,toToken,unitMaps);
  if(!f || !t) return {ok:false,reason:'UNIT_NOT_MAPPED',fromUnitId:f,toUnitId:t};
  if(f===t) return {ok:true,factor:1,fromUnitId:f,toUnitId:t,source:'IDENTITY'};
  const itemKey=String(itemId||'')+'|';
  if(convMap[itemKey+f+'|'+t]>0) return {ok:true,factor:convMap[itemKey+f+'|'+t],fromUnitId:f,toUnitId:t,source:'ITEM_CONVERSION'};
  if(convMap['|'+f+'|'+t]>0) return {ok:true,factor:convMap['|'+f+'|'+t],fromUnitId:f,toUnitId:t,source:'MASTER_CONVERSION'};
  if(convMap[itemKey+t+'|'+f]>0) return {ok:true,factor:1/convMap[itemKey+t+'|'+f],fromUnitId:f,toUnitId:t,source:'ITEM_CONVERSION_REVERSE'};
  if(convMap['|'+t+'|'+f]>0) return {ok:true,factor:1/convMap['|'+t+'|'+f],fromUnitId:f,toUnitId:t,source:'MASTER_CONVERSION_REVERSE'};
  return {ok:false,reason:'CONVERSION_NOT_FOUND',fromUnitId:f,toUnitId:t};
}
function bnxRawMaterialMaps_(clientId){
  const byId={}, byName={};
  try{
    const sh=bnxClientSheet(clientId,SHEETS.RAW_MATERIAL_MASTER||'RAW_MATERIAL_MASTER'); const v=sh.getDataRange().getValues(); const h=v[0]||[];
    for(let r=1;r<v.length;r++){
      const o=bnxRowObjByHeaders_(v[r],h); const id=String(o.ITEM_CODE||o.RAW_MATERIAL_ID||o.ITEM_ID||'').trim(); const name=String(o.ITEM_NAME||'').trim(); if(!id && !name) continue;
      const x={id:id||name,name,uom:String(o.UOM||o.UNIT||'').trim(),cost:bnxNum_(o.COST_PRICE,0),status:String(o.STATUS||'ACTIVE').toUpperCase()};
      if(id) byId[id]=x; if(name) byName[bnxNormUnit_(name)]=x;
    }
  }catch(e){}
  return {byId,byName};
}
function bnxItemPurchaseMap_(clientId){
  const m={};
  try{
    const sh=bnxClientSheet(clientId,SHEETS.ITEM_MASTER); const v=sh.getDataRange().getValues(); const h=v[0]||[];
    for(let r=1;r<v.length;r++){ const o=bnxRowObjByHeaders_(v[r],h); const id=String(o.ITEM_ID||'').trim(); if(id) m[id]={name:String(o.ITEM_NAME||''),unitId:String(o.UNIT_ID||''),cost:bnxNum_(o.PURCHASE_RATE,0)}; }
  }catch(e){}
  return m;
}
function bnxRecipeRows_(clientId){
  const out=[]; try{ const sh=bnxClientSheet(clientId,SHEETS.RECIPE_MASTER); const v=sh.getDataRange().getValues(); const h=v[0]||[]; for(let r=1;r<v.length;r++){const o=bnxRowObjByHeaders_(v[r],h); if(o.RECIPE_ID && (!o.CLIENT_ID || String(o.CLIENT_ID)===String(clientId))) out.push(o);} }catch(e){} return out;
}
function bnxRecipeItemRows_(clientId, recipeId){
  const out=[]; try{ const sh=bnxClientSheet(clientId,SHEETS.RECIPE_ITEMS); const v=sh.getDataRange().getValues(); const h=v[0]||[]; for(let r=1;r<v.length;r++){const o=bnxRowObjByHeaders_(v[r],h); if(String(o.RECIPE_ID||'')===String(recipeId) && (!o.CLIENT_ID || String(o.CLIENT_ID)===String(clientId))) out.push(o);} }catch(e){} return out;
}
function bnxRecipeCostEngine_(clientId, recipeId, opts){
  opts=opts||{}; const recipes=bnxRecipeRows_(clientId), recipe=recipes.find(x=>String(x.RECIPE_ID)===String(recipeId));
  if(!recipe) return {ok:false,recipeId,error:'Recipe not found'};
  const unitMaps=bnxUnitMapsForClient_(clientId), convMap=bnxConversionMapForClient_(clientId), raws=bnxRawMaterialMaps_(clientId), items=bnxItemPurchaseMap_(clientId);
  const memo={}, stack={};
  function calc(rid){
    if(memo[rid]) return memo[rid];
    if(stack[rid]) return {ok:false,recipeId:rid,error:'RECIPE_CYCLE_DETECTED'};
    stack[rid]=true;
    const rec=recipes.find(x=>String(x.RECIPE_ID)===String(rid)); if(!rec){delete stack[rid]; return {ok:false,recipeId:rid,error:'Nested recipe not found'};}
    const yieldQty=bnxNum_(rec.YIELD_QTY,1); const baseQty=bnxNum_(rec.BASE_QTY,1)||1; const lines=bnxRecipeItemRows_(clientId,rid); let total=0,wasteTotal=0,missing=[]; const details=[];
    lines.forEach(line=>{
      if(String(line.STATUS||'ACTIVE').toUpperCase()==='INACTIVE') return;
      const qty=bnxNum_(line.QTY!=null&&line.QTY!==''?line.QTY:line.QUANTITY,0); if(!(qty>0)) return;
      const wastePct=bnxNum_(line.WASTAGE_PCT!=null&&line.WASTAGE_PCT!==''?line.WASTAGE_PCT:line.WASTE_PERCENTAGE,0);
      const rawId=String(line.RAW_MATERIAL_ID||'').trim(); const componentId=String(line.COMPONENT_ITEM_ID||line.ITEM_ID||'').trim();
      let unitCost=bnxNum_(line.UNIT_COST,0), costSource=unitCost>0?'RECIPE_ITEM.UNIT_COST':''; let sourceObj=null; let sourceUom=String(line.UOM||'').trim();
      if(rawId){ sourceObj=raws.byId[rawId] || raws.byName[bnxNormUnit_(rawId)]; if(!sourceObj && componentId) sourceObj=raws.byId[componentId]; }
      if(!sourceObj && componentId) sourceObj=raws.byId[componentId];
      if(sourceObj){ if(!unitCost && sourceObj.cost>0){unitCost=sourceObj.cost;costSource='RAW_MATERIAL_MASTER.COST_PRICE';} if(!sourceUom) sourceUom=sourceObj.uom; }
      let nested=null;
      if(componentId && recipes.some(x=>String(x.RECIPE_ID)===String(componentId))) nested=calc(componentId);
      if(componentId && !nested){ const linked=recipes.find(x=>String(x.ITEM_ID||'')===String(componentId)); if(linked) nested=calc(linked.RECIPE_ID); }
      let factor=1, convSource='';
      if(nested && nested.ok){ unitCost=nested.costPerYield; costSource='NESTED_RECIPE'; sourceUom=String(nested.yieldUom||sourceUom); }
      const targetUom=String(line.UOM||line.UNIT_ID||'').trim();
      if(sourceUom && targetUom && bnxNormUnit_(sourceUom)!==bnxNormUnit_(targetUom)){
        const cv=bnxFindLiveConversion_(clientId,sourceUom,targetUom,rawId||componentId,unitMaps,convMap); if(!cv.ok){missing.push({recipeItemId:line.RECIPE_ITEM_ID,reason:cv.reason,from:sourceUom,to:targetUom,itemId:rawId||componentId});}
        else {factor=cv.factor; convSource=cv.source;}
      }
      const effectiveQty=qty*(1+wastePct/100)*factor, wasteQty=qty*(wastePct/100)*factor, lineCost=effectiveQty*unitCost, lineWasteCost=wasteQty*unitCost;
      if(!(unitCost>0)) missing.push({recipeItemId:line.RECIPE_ITEM_ID,reason:'UNIT_COST_MISSING',rawMaterialId:rawId,itemId:componentId});
      total+=lineCost; wasteTotal+=lineWasteCost;
      details.push({recipeItemId:line.RECIPE_ITEM_ID,rawMaterialId:rawId,componentItemId:componentId,qty,sourceUom,targetUom,wastagePct,effectiveQty,unitCost,costSource,conversionFactor:factor,conversionSource:convSource,extendedCost:lineCost,wasteCost:lineWasteCost});
    });
    const perYield=yieldQty>0?total/yieldQty:total; const result={ok:missing.length===0,recipeId:String(rid),recipeName:String(rec.RECIPE_NAME||''),itemId:String(rec.ITEM_ID||''),baseQty,baseUom:String(rec.BASE_UOM||''),yieldQty,yieldUom:String(rec.YIELD_UOM||''),materialCost:+(total-wasteTotal).toFixed(6),wastageCost:+wasteTotal.toFixed(6),totalCost:+total.toFixed(6),costPerYield:+perYield.toFixed(6),costPerBaseQty:+(total/baseQty).toFixed(6),missing,details}; memo[rid]=result; delete stack[rid]; return result;
  }
  return calc(recipeId);
}
function bnxWriteRecipeCost_(clientId, cost){
  try{
    const sh=bnxClientSheet(clientId,SHEETS.RECIPE_MASTER); const h=bnxEnsureColumns_(sh,['MATERIAL_COST','WASTAGE_COST','TOTAL_COST','COST_PER_YIELD','COST_STATUS','COST_UPDATED_AT']); const v=sh.getDataRange().getValues(); const idc=h.indexOf('RECIPE_ID'), mc=h.indexOf('MATERIAL_COST'), wc=h.indexOf('WASTAGE_COST'), tc=h.indexOf('TOTAL_COST'), pc=h.indexOf('COST_PER_YIELD'), sc=h.indexOf('COST_STATUS'), uc=h.indexOf('COST_UPDATED_AT');
    for(let r=1;r<v.length;r++) if(String(v[r][idc]||'')===String(cost.recipeId)){ sh.getRange(r+1,mc+1).setValue(cost.materialCost); sh.getRange(r+1,wc+1).setValue(cost.wastageCost); sh.getRange(r+1,tc+1).setValue(cost.totalCost); sh.getRange(r+1,pc+1).setValue(cost.costPerYield); sh.getRange(r+1,sc+1).setValue(cost.ok?'OK':'INCOMPLETE'); sh.getRange(r+1,uc+1).setValue(new Date().toISOString()); break; }
    const ri=bnxClientSheet(clientId,SHEETS.RECIPE_ITEMS); const rh=bnxEnsureColumns_(ri,['EFFECTIVE_QTY','EXTENDED_COST','WASTE_QTY','WASTE_COST','COST_SOURCE','COST_UPDATED_AT']); const rv=ri.getDataRange().getValues(); const ridc=rh.indexOf('RECIPE_ITEM_ID'), eq=rh.indexOf('EFFECTIVE_QTY'), ec=rh.indexOf('EXTENDED_COST'), wq=rh.indexOf('WASTE_QTY'), wc2=rh.indexOf('WASTE_COST'), cs=rh.indexOf('COST_SOURCE'), cu=rh.indexOf('COST_UPDATED_AT');
    (cost.details||[]).forEach(d=>{ for(let r=1;r<rv.length;r++) if(String(rv[r][ridc]||'')===String(d.recipeItemId)){ri.getRange(r+1,eq+1).setValue(d.effectiveQty);ri.getRange(r+1,ec+1).setValue(d.extendedCost);ri.getRange(r+1,wq+1).setValue(d.wasteQty);ri.getRange(r+1,wc2+1).setValue(d.wasteCost);ri.getRange(r+1,cs+1).setValue(d.costSource||'');ri.getRange(r+1,cu+1).setValue(new Date().toISOString());break;} });
  }catch(e){ throw e; }
}
function bnxGetRecipeCost(session,payload){
  const clientId=session.CLIENT_ID; try{
    let recipeId=String(payload.recipeId||payload.RECIPE_ID||'').trim(); const itemId=String(payload.itemId||payload.ITEM_ID||'').trim();
    if(!recipeId && itemId){ const rec=bnxRecipeRows_(clientId).find(r=>String(r.ITEM_ID||'')===itemId); if(rec) recipeId=String(rec.RECIPE_ID); }
    if(!recipeId) return {success:false,error:'recipeId or itemId required'};
    const cost=bnxRecipeCostEngine_(clientId,recipeId); return {success:true,data:cost};
  }catch(e){bnxLogError(clientId,'bnxGetRecipeCost failed: '+e.message,payload);return {success:false,error:e.message};}
}
function bnxGetRecipeData(session,payload){
  const clientId=session.CLIENT_ID; try{
    const recipes=bnxRecipeRows_(clientId); const rid=String(payload.recipeId||payload.RECIPE_ID||'').trim();
    const filtered=rid?recipes.filter(r=>String(r.RECIPE_ID)===rid):recipes; const items=[]; filtered.forEach(r=>bnxRecipeItemRows_(clientId,r.RECIPE_ID).forEach(x=>items.push(x)));
    let aliases=[]; try{const sh=bnxClientSheet(clientId,SHEETS.ITEM_ALIAS_MASTER);const v=sh.getDataRange().getValues();const h=v[0]||[];for(let i=1;i<v.length;i++){const x=bnxRowObjByHeaders_(v[i],h);if(!x.CLIENT_ID||String(x.CLIENT_ID)===String(clientId))aliases.push(x);}}catch(e){}
    let versions=[]; try{const sh=bnxClientSheet(clientId,SHEETS.RECIPE_VERSION);const v=sh.getDataRange().getValues();const h=v[0]||[];for(let i=1;i<v.length;i++){const x=bnxRowObjByHeaders_(v[i],h);if(!x.CLIENT_ID||String(x.CLIENT_ID)===String(clientId))versions.push(x);}}catch(e){}
    return {success:true,data:{recipes:filtered,items,aliases,versions}};
  }catch(e){return {success:false,error:e.message};}
}
function bnxSaveUnitConversion(session,payload){
  const clientId=session.CLIENT_ID; try{bnxRequireRecipeWrite_(session); const from=String(payload.fromUnitId||payload.FROM_UNIT_ID||'').trim(),to=String(payload.toUnitId||payload.TO_UNIT_ID||'').trim(),itemId=String(payload.itemId||payload.ITEM_ID||'').trim(),factor=bnxNum_(payload.factor!=null?payload.factor:payload.CONVERSION_FACTOR,0); if(!from||!to||!(factor>0))return {success:false,error:'FROM_UNIT_ID, TO_UNIT_ID and positive CONVERSION_FACTOR are required'};
    const sh=bnxClientSheet(clientId,SHEETS.UNIT_CONVERSION_MASTER); const h=bnxEnsureColumns_(sh,['CONVERSION_ID','CLIENT_ID','FROM_UNIT_ID','TO_UNIT_ID','CONVERSION_FACTOR','ITEM_ID','IS_ACTIVE','CREATED_AT','UPDATED_AT']); const v=sh.getDataRange().getValues(); const ic=h.indexOf('CONVERSION_ID'),cic=h.indexOf('CLIENT_ID'),fc=h.indexOf('FROM_UNIT_ID'),tc=h.indexOf('TO_UNIT_ID'),xc=h.indexOf('CONVERSION_FACTOR'),itc=h.indexOf('ITEM_ID'),ac=h.indexOf('IS_ACTIVE'),uc=h.indexOf('UPDATED_AT'); let row=-1;
    for(let r=1;r<v.length;r++) if(String(v[r][cic]||clientId)===String(clientId)&&String(v[r][fc]||'')===from&&String(v[r][tc]||'')===to&&String(v[r][itc]||'')===itemId){row=r+1;break;}
    if(row<0){row=sh.getLastRow()+1;sh.getRange(row,ic+1).setValue(generateShortId_(clientId,'CONVERSION_ID'));sh.getRange(row,cic+1).setValue(clientId);sh.getRange(row,fc+1).setValue(from);sh.getRange(row,tc+1).setValue(to);sh.getRange(row,itc+1).setValue(itemId);sh.getRange(row,h.indexOf('CREATED_AT')+1).setValue(new Date().toISOString());}
    sh.getRange(row,xc+1).setValue(factor);sh.getRange(row,ac+1).setValue(bnxBool_(payload.isActive,true));sh.getRange(row,uc+1).setValue(new Date().toISOString()); bnxInvalidateMasterCache_(clientId); return {success:true,data:{updated:true,row}};
  }catch(e){return {success:false,error:e.message};}
}
function bnxSaveItemAlias(session,payload){
  const clientId=session.CLIENT_ID; try{bnxRequireRecipeWrite_(session); const itemId=String(payload.itemId||payload.ITEM_ID||'').trim(),name=String(payload.aliasName||payload.ALIAS_NAME||'').trim(); if(!itemId||!name)return {success:false,error:'ITEM_ID and ALIAS_NAME are required'}; const sh=bnxClientSheet(clientId,SHEETS.ITEM_ALIAS_MASTER); const h=bnxEnsureColumns_(sh,['ALIAS_ID','CLIENT_ID','ITEM_ID','ALIAS_NAME','ALIAS_TYPE','BARCODE','SKU','STATUS','CREATED_AT','UPDATED_AT','ALIAS_CODE','SOURCE','IS_ACTIVE']); const v=sh.getDataRange().getValues(); const ic=h.indexOf('ALIAS_ID'),cic=h.indexOf('CLIENT_ID'),ii=h.indexOf('ITEM_ID'),an=h.indexOf('ALIAS_NAME'); for(let r=1;r<v.length;r++) if(String(v[r][cic]||clientId)===String(clientId)&&String(v[r][ii]||'')===itemId&&String(v[r][an]||'').trim().toUpperCase()===name.toUpperCase()) return {success:true,data:{existing:true,id:v[r][ic]}};
    const row=sh.getLastRow()+1; sh.getRange(row,ic+1).setValue(generateShortId_(clientId,'ALIAS_ID')); sh.getRange(row,cic+1).setValue(clientId); sh.getRange(row,ii+1).setValue(itemId); sh.getRange(row,an+1).setValue(name); sh.getRange(row,h.indexOf('ALIAS_TYPE')+1).setValue(String(payload.aliasType||payload.ALIAS_TYPE||'MANUAL')); sh.getRange(row,h.indexOf('BARCODE')+1).setValue(String(payload.barcode||payload.BARCODE||'')); sh.getRange(row,h.indexOf('SKU')+1).setValue(String(payload.sku||payload.SKU||'')); sh.getRange(row,h.indexOf('STATUS')+1).setValue('ACTIVE'); sh.getRange(row,h.indexOf('CREATED_AT')+1).setValue(new Date().toISOString()); sh.getRange(row,h.indexOf('UPDATED_AT')+1).setValue(new Date().toISOString()); sh.getRange(row,h.indexOf('ALIAS_CODE')+1).setValue(String(payload.aliasCode||payload.ALIAS_CODE||'')); sh.getRange(row,h.indexOf('SOURCE')+1).setValue(String(payload.source||payload.SOURCE||'MANUAL')); sh.getRange(row,h.indexOf('IS_ACTIVE')+1).setValue(true); return {success:true,data:{id:sh.getRange(row,ic+1).getValue()}};
  }catch(e){return {success:false,error:e.message};}
}
function bnxSaveRecipe(session,payload){
  const clientId=session.CLIENT_ID,userId=session.USER_ID; try{bnxRequireRecipeWrite_(session); const p=payload||{}; let recipeId=String(p.recipeId||p.RECIPE_ID||'').trim(); const itemId=String(p.itemId||p.ITEM_ID||'').trim(); const name=String(p.recipeName||p.RECIPE_NAME||'').trim(); if(!itemId||!name)return {success:false,error:'ITEM_ID and RECIPE_NAME are required'}; const rm=bnxClientSheet(clientId,SHEETS.RECIPE_MASTER); const h=bnxEnsureColumns_(rm,['RECIPE_ID','CLIENT_ID','ITEM_ID','RECIPE_NAME','BASE_QTY','BASE_UOM','YIELD_QTY','YIELD_UOM','COSTING_METHOD','STATUS','CREATED_AT','UPDATED_AT','MATERIAL_COST','WASTAGE_COST','TOTAL_COST','COST_PER_YIELD','COST_STATUS','COST_UPDATED_AT']); const v=rm.getDataRange().getValues(); const idc=h.indexOf('RECIPE_ID'); if(!recipeId){recipeId=generateShortId_(clientId,'RECIPE_ID');}
    let row=-1; for(let r=1;r<v.length;r++) if(String(v[r][idc]||'')===recipeId){row=r+1;break;} if(row<0){row=rm.getLastRow()+1;rm.getRange(row,idc+1).setValue(recipeId);rm.getRange(row,h.indexOf('CLIENT_ID')+1).setValue(clientId);rm.getRange(row,h.indexOf('CREATED_AT')+1).setValue(new Date().toISOString());}
    const set=(col,val)=>rm.getRange(row,h.indexOf(col)+1).setValue(val); set('ITEM_ID',itemId);set('RECIPE_NAME',name);set('BASE_QTY',bnxNum_(p.baseQty!=null?p.baseQty:p.BASE_QTY,1));set('BASE_UOM',String(p.baseUom||p.BASE_UOM||''));set('YIELD_QTY',bnxNum_(p.yieldQty!=null?p.yieldQty:p.YIELD_QTY,1));set('YIELD_UOM',String(p.yieldUom||p.YIELD_UOM||p.baseUom||''));set('COSTING_METHOD',String(p.costingMethod||p.COSTING_METHOD||'STANDARD'));set('STATUS',String(p.status||p.STATUS||'DRAFT').toUpperCase());set('UPDATED_AT',new Date().toISOString());
    const ri=bnxClientSheet(clientId,SHEETS.RECIPE_ITEMS); const ih=bnxEnsureColumns_(ri,['RECIPE_ITEM_ID','CLIENT_ID','RECIPE_ID','RAW_MATERIAL_ID','ITEM_ID','QTY','UOM','WASTAGE_PCT','UNIT_COST','STATUS','CREATED_AT','UPDATED_AT','COMPONENT_ITEM_ID','QUANTITY','UNIT_ID','WASTE_PERCENTAGE','EFFECTIVE_QTY','EXTENDED_COST','WASTE_QTY','WASTE_COST','COST_SOURCE','COST_UPDATED_AT']); const iv=ri.getDataRange().getValues(); const ric=ih.indexOf('RECIPE_ID'); for(let r=iv.length-1;r>=1;r--) if(String(iv[r][ric]||'')===recipeId) ri.deleteRow(r+1);
    const lines=Array.isArray(p.items)?p.items:[]; lines.forEach(line=>{const rr=ri.getLastRow()+1; const obj={RECIPE_ITEM_ID:generateShortId_(clientId,'RECIPE_ITEM_ID'),CLIENT_ID:clientId,RECIPE_ID:recipeId,RAW_MATERIAL_ID:String(line.rawMaterialId||line.RAW_MATERIAL_ID||'').trim(),ITEM_ID:String(line.itemId||line.ITEM_ID||'').trim(),QTY:bnxNum_(line.qty!=null?line.qty:line.QTY,0),UOM:String(line.uom||line.UOM||'').trim(),WASTAGE_PCT:bnxNum_(line.wastagePct!=null?line.wastagePct:line.WASTAGE_PCT,0),UNIT_COST:bnxNum_(line.unitCost!=null?line.unitCost:line.UNIT_COST,0),STATUS:String(line.status||line.STATUS||'ACTIVE').toUpperCase(),CREATED_AT:new Date().toISOString(),UPDATED_AT:new Date().toISOString(),COMPONENT_ITEM_ID:String(line.componentItemId||line.COMPONENT_ITEM_ID||'').trim(),QUANTITY:bnxNum_(line.quantity!=null?line.quantity:line.QUANTITY,line.qty||line.QTY||0),UNIT_ID:String(line.unitId||line.UNIT_ID||'').trim(),WASTE_PERCENTAGE:bnxNum_(line.wastePercentage!=null?line.wastePercentage:line.WASTE_PERCENTAGE,line.wastagePct||line.WASTAGE_PCT||0)}; ri.getRange(rr,1,1,ih.length).setValues([ih.map(x=>obj[x]!==undefined?obj[x]:'')]);});
    const cost=bnxRecipeCostEngine_(clientId,recipeId); bnxWriteRecipeCost_(clientId,cost); const rv=bnxClientSheet(clientId,SHEETS.RECIPE_VERSION); const vh=bnxEnsureColumns_(rv,['RECIPE_VERSION_ID','CLIENT_ID','RECIPE_ID','VERSION_NO','EFFECTIVE_FROM','EFFECTIVE_TO','STATUS','CREATED_BY','CREATED_AT','APPROVED_BY','APPROVED_AT','VERSION_LABEL','CHANGE_NOTE','TOTAL_COST_SNAPSHOT','COST_PER_YIELD_SNAPSHOT','COST_SNAPSHOT_AT']); const vv=rv.getDataRange().getValues(); let maxVer=0; for(let r=1;r<vv.length;r++) if(String(vv[r][vh.indexOf('RECIPE_ID')]||'')===recipeId) maxVer=Math.max(maxVer,bnxNum_(vv[r][vh.indexOf('VERSION_NO')],0)); const vr=rv.getLastRow()+1; const vo={RECIPE_VERSION_ID:generateShortId_(clientId,'RECIPE_VERSION_ID'),CLIENT_ID:clientId,RECIPE_ID:recipeId,VERSION_NO:maxVer+1,EFFECTIVE_FROM:String(p.effectiveFrom||p.EFFECTIVE_FROM||new Date().toISOString()),EFFECTIVE_TO:String(p.effectiveTo||p.EFFECTIVE_TO||''),STATUS:String(p.versionStatus||p.VERSION_STATUS||'DRAFT').toUpperCase(),CREATED_BY:userId||'',CREATED_AT:new Date().toISOString(),APPROVED_BY:'',APPROVED_AT:'',VERSION_LABEL:String(p.versionLabel||p.VERSION_LABEL||('v'+(maxVer+1))),CHANGE_NOTE:String(p.changeNote||p.CHANGE_NOTE||''),TOTAL_COST_SNAPSHOT:cost.totalCost,COST_PER_YIELD_SNAPSHOT:cost.costPerYield,COST_SNAPSHOT_AT:new Date().toISOString()}; rv.getRange(vr,1,1,vh.length).setValues([vh.map(x=>vo[x]!==undefined?vo[x]:'')]); bnxInvalidateMasterCache_(clientId); bnxCreateAuditLog(clientId,{CLIENT_ID:clientId,USER_ID:userId,ACTION:'SAVE',MODULE:'RECIPE',RECORD_TYPE:'RECIPE',RECORD_ID:recipeId,NEW_VALUE:JSON.stringify({recipe:vo,cost}),TIMESTAMP:new Date().toISOString()}); return {success:true,data:{recipeId,cost,versionNo:maxVer+1}};
  }catch(e){bnxLogError(clientId,'bnxSaveRecipe failed: '+e.message,payload);return {success:false,error:e.message};}
}
function bnxRecalculateRecipeCost(session,payload){
  const clientId=session.CLIENT_ID; try{bnxRequireRecipeWrite_(session); const recipes=bnxRecipeRows_(clientId); const wanted=String(payload.recipeId||payload.RECIPE_ID||'').trim(); const list=wanted?recipes.filter(r=>String(r.RECIPE_ID)===wanted):recipes; const results=[]; list.forEach(r=>{const c=bnxRecipeCostEngine_(clientId,r.RECIPE_ID); bnxWriteRecipeCost_(clientId,c); results.push(c);}); return {success:true,data:{count:results.length,results}}; }catch(e){return {success:false,error:e.message};}
}
