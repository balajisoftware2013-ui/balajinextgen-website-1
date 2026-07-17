/**
 * ═══════════════════════════════════════════════════════════════════
 * ADD THIS to 46_LiveInventoryBridge.gs (anywhere alongside the other
 * INV_ functions), and add the matching case to 08_CoreRouter.gs
 * (shown at the bottom of this file).
 * ───────────────────────────────────────────────────────────────────
 * kitchen-consumption.html already calls kcApi('GET_CONSUMPTION_HISTORY',
 * {}) expecting back { success:true, history:[...] } — this action did
 * not exist anywhere on the backend yet, so that call was always
 * failing silently (frontend fell back to hardcoded demo rows).
 *
 * Real KITCHEN_CONSUMPTION columns (confirmed from your actual sheet):
 *   CON_ID, CLIENT_ID, DATE, ITEM_ID, ITEM_NAME, UNIT, OPENING,
 *   RECEIVED, ISSUED, CLOSING, WASTAGE, ENTERED_BY
 * Note there is NO rate/category/chef/shift column here — those only
 * exist in the frontend's demo data model, not your real sheet. This
 * function enriches each row with CATEGORY and an ESTIMATED value by
 * joining ITEM_NAME against MASTER_DB's ITEM_MASTER (which does have
 * CATEGORY and COST_PRICE) — labeled as an estimate at CURRENT cost,
 * since the sheet has no historical rate-at-time-of-use recorded.
 * ═══════════════════════════════════════════════════════════════════
 */

/** action:'GET_CONSUMPTION_HISTORY' — { clientId, fromDate?, toDate? } */
function INV_getConsumptionHistory(params) {
  try {
    const txnDbId = getClientDbId(params.clientId, 'TRANSACTION');
    const txnSs = SpreadsheetApp.openById(txnDbId);
    const sheet = txnSs.getSheetByName('KITCHEN_CONSUMPTION');
    if (!sheet) return { success: true, history: [] };

    let rows = LIB_sheetToObjects_(sheet);

    // Build a lookup of ITEM_NAME -> {category, costPrice} from ITEM_MASTER
    // so history rows can show a real category and an estimated value.
    let itemLookup = {};
    try {
      const masterDbId = getClientDbId(params.clientId, 'MASTER');
      const masterSs = SpreadsheetApp.openById(masterDbId);
      const itemSheet = masterSs.getSheetByName('ITEM_MASTER');
      if (itemSheet) {
        const items = LIB_sheetToObjects_(itemSheet);
        items.forEach(i => {
          itemLookup[String(i.NAME || '').trim().toUpperCase()] = {
            category: i.CATEGORY || 'Uncategorized',
            costPrice: Number(i.COST_PRICE) || 0,
          };
        });
      }
    } catch (e2) { /* non-fatal — history still returns without value/category if this fails */ }

    const history = rows.map(r => {
      const lookup = itemLookup[String(r.ITEM_NAME || '').trim().toUpperCase()] || {};
      const issued = Number(r.ISSUED) || 0;
      const costPrice = lookup.costPrice || 0;
      return {
        date: r.DATE || '',
        item: r.ITEM_NAME || '',
        unit: r.UNIT || '',
        qty: issued,
        category: lookup.category || 'Uncategorized',
        estValue: Math.round(issued * costPrice * 100) / 100, // estimate at CURRENT cost, not historical
        enteredBy: r.ENTERED_BY || '',
        wastage: Number(r.WASTAGE) || 0,
      };
    });

    if (params.fromDate) history = history.filter(h => new Date(h.date) >= new Date(params.fromDate));
    if (params.toDate) history = history.filter(h => new Date(h.date) <= new Date(params.toDate));

    return { success: true, history: history };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/*
═══════════════════════════════════════════════════════════════════
ADD THIS CASE to 08_CoreRouter.gs's handleSingleAction() switch,
alongside the other INVENTORY cases (GET_ITEMS, SAVE_KITCHEN_INDENT, etc.):

    case 'GET_CONSUMPTION_HISTORY':
      return INV_getConsumptionHistory(body);

═══════════════════════════════════════════════════════════════════
*/
