// ══════════════════════════════════════════════════════════════
// 08_CoreRouter.gs — COMPLETE, verified against this conversation.
// ------------------------------------------------------------------
// WHY THIS FILE MATTERS RIGHT NOW: your live deployment just returned
// "Unknown action: GET_ITEMS" — but GET_ITEMS is a real case below,
// and was already in the version of this file shared earlier in this
// conversation. That means your LIVE Apps Script project's
// 08_CoreRouter.gs does not match this file — some case statements
// (and possibly other logic) are missing or outdated in what's
// actually deployed. This is almost certainly also the cause of the
// SAVE_KITCHEN_INDENT blank-item bug.
//
// ACTION: Replace your live 08_CoreRouter.gs with this file's content
// EXACTLY, save, then Deploy → Manage deployments → edit the active
// deployment → Version: New version → Deploy.
// ══════════════════════════════════════════════════════════════

function doPost(e) {
  return ContentService
    .createTextOutput(JSON.stringify(safeHandlePost(e)))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action.toUpperCase() : '';
  if (action === 'PING') {
    return ContentService
      .createTextOutput(JSON.stringify({ status:'ok', success:true, v:'5.1', ts: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status:'error', message:'Unknown GET action: ' + action }))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeHandlePost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    Logger.log('[safeHandlePost] No POST data — returning error safely');
    return { status:'error', message:'No POST body received' };
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch(parseErr) {
    return { status:'error', message:'Invalid JSON: ' + parseErr.message };
  }

  if (!body) return { status:'error', message:'Empty request body' };

  if (body.batch && Array.isArray(body.batch)) {
    const results = [];
    body.batch.forEach(function(item) {
      try {
        results.push(handleSingleAction(item));
      } catch(err) {
        results.push({ ok:false, error: err.message, action: item.action });
      }
    });
    return { status:'success', results: results, processed: results.length };
  }

  if (!body.action) {
    return { status:'error', message:'No action in request body' };
  }

  try {
    return handleSingleAction(body);
  } catch(err) {
    Logger.log('[safeHandlePost] Error in action ' + body.action + ': ' + err.message);
    return { status:'error', message: err.message, action: body.action };
  }
}

function handleSingleAction(body) {
  const action = (body.action || '').toString().toUpperCase();

  switch(action) {

    // ── PING ──────────────────────────────────────────────────
    case 'PING':
      return { status:'ok', success:true, v:'5.1', ts: new Date().toISOString() };

    // ── LOGIN ─────────────────────────────────────────────────
    case 'LOGIN': {
      const loginId  = body.loginId  || body.email    || body.user_code || '';
      const password = body.password || body.PASSWORD || '';
      if (!loginId || !password) {
        return { status:'error', message:'loginId and password required' };
      }
      const ss   = SpreadsheetApp.openById('1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg');
      const sheet = ss.getSheetByName('USER_MASTER');
      if (!sheet) return { status:'error', message:'USER_MASTER sheet not found' };
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().toUpperCase().trim());
      const emailCol  = headers.indexOf('EMAIL');
      const mobileCol = headers.indexOf('MOBILE');
      const codeCol   = headers.indexOf('USER_CODE');
      const passCol   = headers.indexOf('PASSWORD');
      const roleCol   = headers.indexOf('ROLE');
      const nameCol   = headers.indexOf('FULL_NAME');
      const statusCol = headers.indexOf('STATUS');

      const lid = loginId.toString().toLowerCase().trim();
      let found = null;
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const eml = emailCol  >= 0 ? row[emailCol].toString().toLowerCase().trim()  : '';
        const mob = mobileCol >= 0 ? row[mobileCol].toString().toLowerCase().trim() : '';
        const cod = codeCol   >= 0 ? row[codeCol].toString().toLowerCase().trim()   : '';
        if (eml === lid || mob === lid || cod === lid) { found = row; break; }
      }
      if (!found) return { status:'error', message:'User not found' };
      if (statusCol >= 0 && found[statusCol].toString().toUpperCase() !== 'ACTIVE') {
        return { status:'error', message:'Account inactive — contact admin' };
      }
      const storedPass = passCol >= 0 ? found[passCol].toString().trim() : '';
      if (storedPass !== password.trim()) {
        return { status:'error', message:'Invalid password' };
      }
      return {
        status:    'success',
        message:   'Login successful',
        ROLE:      roleCol   >= 0 ? found[roleCol].toString().toUpperCase()   : 'EMPLOYEE',
        FULL_NAME: nameCol   >= 0 ? found[nameCol].toString()                 : '',
        EMAIL:     emailCol  >= 0 ? found[emailCol].toString()                : loginId,
        USER_CODE: codeCol   >= 0 ? found[codeCol].toString()                 : '',
        sessionToken: Utilities.getUuid()
      };
    }

    // ── APPEND ROW ────────────────────────────────────────────
    case 'APPENDROW': {
      const sheetId   = body.sheetId || body.sheet_id || '';
      const sheetName = body.sheet   || '';
      const row       = body.row     || {};
      if (!sheetId || !sheetName) return { ok:false, error:'sheetId and sheet required' };
      const ss    = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { ok:false, error:'Sheet not found: ' + sheetName };
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const newRow  = headers.map(h => row[h] !== undefined ? row[h] : '');
      sheet.appendRow(newRow);
      return { ok:true, action:'appendRow', sheet: sheetName };
    }

    // ── UPDATE ROW ────────────────────────────────────────────
    case 'UPDATEROW': {
      const sheetId   = body.sheetId   || '';
      const sheetName = body.sheet     || '';
      const matchCol  = body.matchCol  || '';
      const matchVal  = body.matchVal  || '';
      const updates   = body.updates   || {};
      if (!sheetId || !sheetName || !matchCol || !matchVal) {
        return { ok:false, error:'sheetId, sheet, matchCol, matchVal required' };
      }
      const ss    = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { ok:false, error:'Sheet not found: ' + sheetName };
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => h.toString().trim());
      const keyIdx  = headers.indexOf(matchCol);
      if (keyIdx < 0) return { ok:false, error:'Column not found: ' + matchCol };
      for (let i = 1; i < data.length; i++) {
        if (data[i][keyIdx].toString() === matchVal.toString()) {
          Object.keys(updates).forEach(function(col) {
            const ci = headers.indexOf(col);
            if (ci >= 0) sheet.getRange(i+1, ci+1).setValue(updates[col]);
          });
          return { ok:true, action:'updateRow', row: i+1 };
        }
      }
      return { ok:false, error:'Row not found for ' + matchCol + '=' + matchVal };
    }

    // ── GET SHEET ─────────────────────────────────────────────
    case 'GETSHEET': {
      const sheetId   = body.sheetId || '';
      const sheetName = body.sheet   || '';
      const limit     = parseInt(body.limit || '500');
      if (!sheetId || !sheetName) return { status:'error', message:'sheetId and sheet required' };
      const ss    = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { status:'error', message:'Sheet not found: ' + sheetName };
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows    = data.slice(1, limit + 1).map(function(row) {
        const obj = {};
        headers.forEach(function(h, i){ obj[h] = row[i]; });
        return obj;
      });
      return { status:'success', rows: rows, total: rows.length, sheet: sheetName };
    }

    // ── GET USER MASTER ───────────────────────────────────────
    case 'GETUSERMASTER': {
      const ss    = SpreadsheetApp.openById('1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg');
      const sheet = ss.getSheetByName('USER_MASTER');
      if (!sheet) return { status:'error', message:'USER_MASTER not found' };
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows    = data.slice(1).map(function(row) {
        const obj = {};
        headers.forEach(function(h, i){ obj[h] = row[i]; });
        return obj;
      });
      return { status:'success', rows: rows, total: rows.length };
    }

    // ── GET LOGIN HISTORY ─────────────────────────────────────
    case 'GETLOGINHISTORY': {
      const ss    = SpreadsheetApp.openById('1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg');
      const sheet = ss.getSheetByName('LOGIN_HISTORY');
      if (!sheet) return { status:'success', rows:[], total:0 };
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      const limit   = parseInt(body.limit || '200');
      const rows    = data.slice(1, limit+1).map(function(row) {
        const obj = {};
        headers.forEach(function(h, i){ obj[h] = row[i]; });
        return obj;
      });
      return { status:'success', rows: rows, total: rows.length };
    }

    // ══════════════════════════════════════════════════════════
    // RESTAURANT POS — SAVE_BILL / SAVE_KOT / Order Engine
    // ══════════════════════════════════════════════════════════

    case 'SAVE_BILL':
      return RPT_recordLiveBill_(body);

    case 'SAVE_KOT':
      return KOT_saveTicket(body);

    case 'SAVE_ORDER': {
      const r = ORD_saveOrder(body);
      return JSON.parse(r.getContent());
    }
    case 'UPDATE_ORDER_STATUS': {
      const r = ORD_updateStatus(body);
      return JSON.parse(r.getContent());
    }
    case 'GET_ACTIVE_ORDERS': {
      const r = ORD_getActiveOrders(body);
      return JSON.parse(r.getContent());
    }
    case 'GET_DASHBOARD_SUMMARY': {
      const r = ORD_getDashboardSummary(body);
      return JSON.parse(r.getContent());
    }

    // ══════════════════════════════════════════════════════════
    // CHEF / KOT (47_ChefKotBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'GET_CHEF_ORDERS':
      return CHEF_getOrders(body);
    case 'UPDATE_KOT_STATUS':
      return CHEF_updateKotStatus(body);

    // ══════════════════════════════════════════════════════════
    // BAR MODULE (48_BarModuleBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'GETALLCLIENTS':
      return BAR_getAllClients();
    case 'GETCLIENTINFO':
      return BAR_getClientInfo(body);
    case 'FETCHSHEET':
      return BAR_fetchSheet(body);
    case 'APPENDROWS':
      return BAR_appendRows(body);

    // ══════════════════════════════════════════════════════════
    // INVENTORY (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'GET_ITEMS':
      return INV_getItems(body);
    case 'SAVE_KITCHEN_INDENT':
      return INV_saveKitchenIndent(body);
    case 'SAVE_KITCHEN_CONSUMPTION':
      return INV_saveKitchenConsumption(body);
    case 'SAVE_STOCK_ADJUSTMENT':
      return INV_saveStockAdjustment(body);
    case 'GET_STOCK_LEDGER':
      return INV_getStockLedger(body);
    case 'GET_AI_PURCHASE_SUGGESTIONS':
      return INV_getAiPurchaseSuggestions(body);
    // FIX: added — this was missing from the live deployment, causing
    // kitchen-consumption.html's History/Analysis tabs to always fail.
    // See ADD_TO_46_LiveInventoryBridge.gs for the function itself.
    case 'GET_CONSUMPTION_HISTORY':
      return INV_getConsumptionHistory(body);

    // FIX: added — inventory.html/purchase-module.html/
    // Restrostock_pro_inventory.html all call these two actions for
    // their entire local-data sync layer, but neither existed anywhere
    // in the router, so that sync has never worked at all. See
    // ADD_TO_46_LiveInventoryBridge_SYNC.gs for the functions.
    case 'SYNC_PUSH_TABLE':
      return INV_syncPushTable(body);
    case 'SYNC_PULL_ALL':
      return INV_syncPullAll(body);

    // ══════════════════════════════════════════════════════════
    // CRM / LOYALTY / CUSTOMER SELF-ORDER CHECK-IN
    // ══════════════════════════════════════════════════════════
    case 'CUSTOMER_CHECKIN':
      return handleCustomerCheckin(body);
    case 'GET_RESTAURANT_INFO':
      return handleGetRestaurantInfo(body);
    case 'GET_LOYALTY_BALANCE':
      return handleGetLoyaltyBalance(body);
    case 'REDEEM_POINTS':
      return handleRedeemPoints(body);

    // ══════════════════════════════════════════════════════════
    // MASTER HUB (40_MasterHubAPI.gs)
    // ══════════════════════════════════════════════════════════
    case 'GET_MASTER':
      return MH_getMaster(body);
    case 'SAVE_MASTER':
      return MH_saveMaster(body);
    case 'DELETE_MASTER':
      return MH_deleteMaster(body);
    case 'BULK_IMPORT_MASTER':
      return MH_bulkImportMaster(body);
    case 'GET_PERMISSIONS':
      return MH_getPermissions(body);
    case 'SAVE_PERMISSION':
      return MH_savePermission(body);

    // ══════════════════════════════════════════════════════════
    // IMPORT HUB (41_ImportHubAPI.gs)
    // ══════════════════════════════════════════════════════════
    case 'IMPORT_PREVIEW':
      return IH_importPreview(body);
    case 'IMPORT_COMMIT':
      return IH_importCommit(body);

    // ══════════════════════════════════════════════════════════
    // INDENT → APPROVE → ISSUE WORKFLOW (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'SAVE_BAR_INDENT':
      return INV_saveBarIndent(body);
    case 'GET_PENDING_INDENTS':
      return INV_getPendingIndents(body);
    case 'APPROVE_ISSUE_INDENT':
      return INV_approveIssueIndent(body);

    // ══════════════════════════════════════════════════════════
    // WASTAGE LOG (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'SAVE_WASTAGE':
      return INV_saveWastage(body);
    case 'GET_WASTAGE_LOG':
      return INV_getWastageLog(body);

    // ══════════════════════════════════════════════════════════
    // PRODUCTION LOG (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'SAVE_PRODUCTION':
      return INV_saveProduction(body);
    case 'GET_PRODUCTION_LOG':
      return INV_getProductionLog(body);

    // ══════════════════════════════════════════════════════════
    // MENU FOR CUSTOMER/STEWARD ORDERING (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'GETMENUITEMS':
      return INV_getMenuItemsForOrdering(body);

    // ══════════════════════════════════════════════════════════
    // MENU AVAILABILITY (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'SAVE_MENU_AVAILABILITY':
      return INV_saveMenuAvailability(body);
    case 'GET_MENU_AVAILABILITY':
      return INV_getMenuAvailability(body);

    // ══════════════════════════════════════════════════════════
    // PURCHASE ORDERS (46_LiveInventoryBridge.gs)
    // ══════════════════════════════════════════════════════════
    case 'SAVE_PURCHASE_ORDER':
      return INV_savePurchaseOrder(body);
    case 'GET_PURCHASE_ORDERS':
      return INV_getPurchaseOrders(body);

    // ══════════════════════════════════════════════════════════
    // REPORTING (49_LiveReportsBridge.gs) — reads real POS_BILLING
    // ══════════════════════════════════════════════════════════
    case 'GET_DAILY_SALES':
      return RPT_getDailySales(body);
    case 'GET_DSR':
      return RPT_getDsr(body);
    case 'GET_CASHIER_SUMMARY':
      return RPT_getCashierSummary(body);
    case 'GET_DSR_RANGE':
      return RPT_getDsrRange(body);

    // ══════════════════════════════════════════════════════════
    // GENERIC AI INSIGHT (49_LiveReportsBridge.gs) — secure, server-side
    // ══════════════════════════════════════════════════════════
    case 'GET_AI_INSIGHT':
      return AI_getInsight(body);

    // ── UNKNOWN ACTION ────────────────────────────────────────
    default:
      Logger.log('[handleSingleAction] Unknown action: ' + action);
      return { status:'error', message:'Unknown action: ' + action };
  }
}

// ── TEST FUNCTIONS (run from Apps Script editor to verify) ────

function testPing() {
  const result = safeHandlePost(null);
  Logger.log('Null test: ' + JSON.stringify(result));
}

function testGetItems() {
  const fakeE = {
    postData: {
      contents: JSON.stringify({ action: 'GET_ITEMS', clientId: 'CL00010' })
    }
  };
  const result = safeHandlePost(fakeE);
  Logger.log('GET_ITEMS test: ' + JSON.stringify(result));
}
