/**
 * ═══════════════════════════════════════════════════════════════════
 * ADD THIS to 46_LiveInventoryBridge.gs, and add the two matching
 * router cases to 08_CoreRouter.gs (shown at the bottom of this file).
 * ───────────────────────────────────────────────────────────────────
 * inventory.html, purchase-module.html, and Restrostock_pro_inventory.html
 * all share ONE local data system (browser localStorage via a DB/InvBridge
 * engine) and call SYNC_PUSH_TABLE / SYNC_PULL_ALL to sync it to the
 * backend — but neither action existed anywhere in the router, so this
 * whole sync layer has never actually worked; everything entered in
 * these 3 screens has only ever lived in that one browser's storage.
 *
 * DESIGN CHOICE (per your instruction — "faster, keep separate local
 * schema"): this does NOT map onto your real ITEM_MASTER/PURCHASE_MASTER
 * schema used elsewhere. Instead, each local "table" (items,
 * stock_ledger, purchase_invoices, kitchen_indents, stock_transfers,
 * issues, bar_orders, vouchers, login_history, categories, warehouses,
 * etc) gets its own sheet in TRANSACTION_DB, named SYNC_<TABLE> (e.g.
 * SYNC_ITEMS, SYNC_STOCK_LEDGER) — the SYNC_ prefix keeps these clearly
 * separate from your real schema sheets (ITEM_MASTER, KITCHEN_INDENT,
 * etc), so there's no naming collision or accidental cross-contamination.
 *
 * This means: Inventory/Purchase's data is now safely backed up to real
 * Google Sheets and synced across devices/browsers, but it remains a
 * SEPARATE dataset from the ITEM_MASTER/PURCHASE_MASTER your other
 * modules (kitchen-indent, etc) use. If you ever want these unified
 * into one real schema, that's a bigger job for later — this gets you
 * working sync now.
 * ═══════════════════════════════════════════════════════════════════
 */

/** action:'SYNC_PUSH_TABLE' — { clientId, table, rows: [...] }
 *  Overwrites the entire SYNC_<TABLE> sheet with the given rows (full
 *  snapshot push, matching how inventory.html's DB.save() already
 *  works locally — it always saves the complete current table, not
 *  incremental changes). Header row is the union of all keys seen
 *  across the rows, so this works for any table shape without needing
 *  to know its schema in advance. */
function INV_syncPushTable(params) {
  const clientId = params.clientId;
  const table = params.table;
  const rows = params.rows || [];
  if (!clientId || !table) return { success: false, message: 'clientId and table required' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const dbId = getClientDbId(clientId, 'TRANSACTION');
    const ss = SpreadsheetApp.openById(dbId);
    const sheetName = 'SYNC_' + String(table).toUpperCase();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    if (!rows.length) {
      return { success: true, pushed: 0 };
    }

    // Union of all keys across all rows — handles rows with slightly
    // different shapes (e.g. optional fields) without breaking.
    const headerSet = {};
    rows.forEach(r => Object.keys(r || {}).forEach(k => { headerSet[k] = true; }));
    const headers = Object.keys(headerSet);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const dataRows = rows.map(r => headers.map(h => {
      const v = (r || {})[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v); // nested objects/arrays stored as JSON text
      return v;
    }));
    sheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);

    return { success: true, pushed: dataRows.length, sheet: sheetName };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/** action:'SYNC_PULL_ALL' — { clientId } → { success:true, tables: { tableName: [...rows] } }
 *  Reads every SYNC_<TABLE> sheet that exists for this client and
 *  returns them all keyed by lowercase table name, matching exactly
 *  the shape inventory.html's pullAllFromBackend() already expects
 *  (Object.entries(r.tables).forEach(([table,rows]) => ...)). JSON
 *  text fields (objects/arrays stored by SYNC_PUSH_TABLE above) are
 *  parsed back automatically. */
function INV_syncPullAll(params) {
  const clientId = params.clientId;
  if (!clientId) return { success: false, message: 'clientId required' };

  try {
    const dbId = getClientDbId(clientId, 'TRANSACTION');
    const ss = SpreadsheetApp.openById(dbId);
    const tables = {};

    ss.getSheets().forEach(sheet => {
      const name = sheet.getName();
      if (!name.startsWith('SYNC_')) return;
      const tableKey = name.substring(5).toLowerCase();

      const data = sheet.getDataRange().getValues();
      if (data.length < 1 || !data[0].length) { tables[tableKey] = []; return; }
      const headers = data[0];
      const rows = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let v = row[i];
          if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
            try { v = JSON.parse(v); } catch (e) { /* leave as plain string if not valid JSON */ }
          }
          obj[h] = v;
        });
        return obj;
      });
      tables[tableKey] = rows;
    });

    return { success: true, tables: tables };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/*
═══════════════════════════════════════════════════════════════════
ADD THESE TWO CASES to 08_CoreRouter.gs's handleSingleAction() switch,
alongside the other INVENTORY cases:

    case 'SYNC_PUSH_TABLE':
      return INV_syncPushTable(body);
    case 'SYNC_PULL_ALL':
      return INV_syncPullAll(body);

═══════════════════════════════════════════════════════════════════
*/
