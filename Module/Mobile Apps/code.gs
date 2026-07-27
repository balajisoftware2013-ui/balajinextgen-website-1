// ════════════════════════════════════════════════════════════════════════════════
// BALAJI NEXTGEN — BUSINESS OS v77 BACKEND (Code.gs) — CONSOLIDATED
// ════════════════════════════════════════════════════════════════════════════════
// v77 CHANGES OVER v76 (this is the fix pass you asked for):
//   • FIX: saveDB (SUITE_SAVE_DB) now TRUE-SYNCS Customers/Suppliers/Items/
//     Purchases/Sales — records removed on the frontend (edit/delete) are now
//     actually deleted from the Google Sheet. v76's bulkUpsertRows_ only ever
//     added/updated rows and NEVER removed a row, so deleting a transaction or
//     a master record in the app never actually removed it from the sheet.
//   • Added single-record DELETE_CUSTOMER / DELETE_SUPPLIER / DELETE_ITEM
//     (same pattern as the existing DELETE_SALE / DELETE_PURCHASE) with audit log.
//   • Every write path still auto-creates missing tabs/columns
//     (getOrCreateSheet_ / getOrAddColumn_ / _migrateClientSheet_) — unchanged,
//     just confirmed wired everywhere new code touches a sheet.
//   • Added direct "Post to Tally" (POST_TO_TALLY / CHECK_TALLY_STATUS),
//     rewritten to match this app's ACTUAL sheet schema (INVOICE_ID,
//     CUSTOMER_ID, CUSTOMER_NAME, TOTAL, ITEMS_JSON etc.) instead of the
//     placeholder "Customer Name"/"Total Amount" headers from the draft notes.
//   • Added automatic nightly backup, now scheduled AFTER 3:00 AM (was 2:00 AM),
//     with retention (30 days / min 5 backups) and cleanup running in the same
//     job, plus restore + verification helpers.
// ════════════════════════════════════════════════════════════════════════════════

const MASTER_CONTROL_SHEET_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';
const USER_SECURITY_SHEET_ID  = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg';
const TEMPLATE_SHEET_ID       = '18moaYrNWFKR5etfS2Y4HVjbmyrxCRJxBxQeynz1i9hA';
const CLIENTS_DRIVE_FOLDER_ID = '1QUzavRsSwhIy-keXpHf3zguAvHkU8dUy';
const TEMPLATE_ID_FOR_BOS     = 'TEM049';
const TRIAL_DAYS = 90;
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbwPLcnWaO9csLohtX6yNwGDhjSCnLhW_jfzmWJBc-LtwScphFC9oGeFps_rLsHC92DRjw/exec';

const H = {
  CLIENT_MASTER: ['CLIENT_ID','CONTACT_NAME','PHONE','ALT_PHONE','EMAIL','COMPANY_NAME','COMPANY_TYPE','GST_NO','PAN','ADDRESS','CITY','STATE','PIN','INDUSTRY','PLAN','ERP_URL','ADMIN_NAME','ADMIN_EMAIL','ADMIN_USERNAME','ADMIN_PASSWORD','ADMIN_MOBILE','ADMIN_ROLE','STATUS','LICENSE_STATUS','REGISTERED_BY'],
  CLIENT_REGISTRY: ['CLIENT_ID','COMPANY_NAME','DATABASE_ID','PLAN_NAME','EXPIRY_DATE','STATUS','CREATED_DATE','LAST_SYNC'],
  USER_MASTER: ['USER_ID','CLIENT_ID','USER_CODE','FULL_NAME','EMAIL','MOBILE_NO','PASSWORD','ROLE','INDUSTRY','BRANCH','ACCESS_LEVEL','STATUS','WEB_ACCESS','APP_ACCESS','OTP_ACCESS','LOGIN_TYPE','COMPANY_NAME','DEPARTMENT','DESIGNATION','DEFAULT_DASHBOARD','CREATED_BY','CREATED_DATE','LAST_LOGIN','FAILED_ATTEMPTS','ACCOUNT_LOCKED'],
  LOGIN_HISTORY: ['LOG_ID','USER_ID','USER_CODE','FULL_NAME','ROLE','LOGIN_DATE','LOGIN_TIME','LOGOUT_TIME','SESSION_DURATION','LOGIN_STATUS','LOGIN_METHOD','OTP_VERIFIED','LOGIN_IP','DEVICE_NAME','BROWSER_INFO','SESSION_TOKEN','LOCATION','CREATED_AT'],
  SESSIONS: ['SESSION_ID','USER_ID','USER_CODE','ROLE','SESSION_TOKEN','SESSION_STATUS','LOGIN_METHOD','LOGIN_DATE','LAST_ACTIVITY','TOKEN_EXPIRY','DEVICE_NAME','LOGIN_IP','FORCE_LOGOUT','REMARKS'],
  CUSTOMERS: ['ID','NAME','MOBILE','DUE','CREDIT_LIMIT','LAST_DATE','ADDRESS','STATE','GSTIN'],
  SUPPLIERS: ['SUPPLIER_ID','ID','NAME','MOBILE','DUE','ADDRESS','STATE','GSTIN'],
  ITEMS: ['ID','NAME','UNIT','HSN','PURCHASE_RATE','SALE_RATE','GST_PERCENT','STOCK','OPENING_STOCK','MIN_STOCK','CATEGORY'],
  PURCHASES: ['PURCHASE_ID','SUPPLIER_ID','SUPPLIER_NAME','DATE','INVOICE_NO','TOTAL','TAXABLE','GST_TOTAL','COURIER_CHARGE','LABOUR_CHARGE','MODE','ITEM_SUMMARY','ITEMS_JSON','TALLY_POSTED','TALLY_REFERENCE'],
  SALES: ['INVOICE_ID','CUSTOMER_ID','CUSTOMER_NAME','DATE','TOTAL','INVOICE_NO','COURIER_CHARGE','LABOUR_CHARGE','MODE','SALESPERSON','ITEMS_JSON','TALLY_POSTED','TALLY_REFERENCE'],
  STOCK_LEDGER: ['ITEM_ID','ITEM_NAME','OPENING_STOCK','INWARD_QTY','OUTWARD_QTY','CLOSING_STOCK','UNIT'],
  META: ['ID','CASH','BANK','UPDATED_AT'],
  SETTINGS: ['ID','SETTINGS_JSON','UPDATED_AT'],
  BANK_ACCOUNTS: ['ID','NAME','BALANCE'],
  SALESPEOPLE: ['ID','NAME'],
  PAYMENTS_IN: ['ID','CUST','AMOUNT','MODE','ACCT_ID','BILL_REF','TXN_REF','DATE'],
  PAYMENTS_OUT: ['ID','SUPP','AMOUNT','MODE','ACCT_ID','BILL_REF','TXN_REF','DATE'],
  EXPENSES: ['ID','CATEGORY','AMOUNT','NOTE','PENDING','MODE','DATE'],
  CREDIT_NOTES: ['ID','CUST','BILL_REF','AMOUNT','REASON','LINE_ITEMS_JSON','DATE'],
  DEBIT_NOTES: ['ID','SUPP','BILL_REF','AMOUNT','REASON','LINE_ITEMS_JSON','DATE'],
  BANK_TXNS: ['ID','TYPE','AMOUNT','DETAIL','CATEGORY','DATE'],
  AUDIT_LOG: ['LOG_ID','ACTION','TABLE','RECORD_ID','TIMESTAMP','USER_ID','CHANGE_DETAIL','STATUS'],
  INVOICE_SERIES: ['SERIES_TYPE','NEXT_NUMBER','LAST_ISSUED','UPDATED_AT'],
  ITEM_REGISTRY: ['ITEM_ID','NAME','STATUS','ADDED_AT','LAST_MODIFIED','CATEGORY','MODIFICATION_REASON']
};

const BOS_INDUSTRIES = ['COMPUTER_SHOP','STATIONERY_SHOP','SHOP','RETAIL','SUPERMARKET','ELECTRONICS','CLOTHING','FOOTWEAR','JEWELLERY','GIFT_SHOP','OPTICAL','SPORTS',
  'MEDICAL_STORE','PHARMA_DIST','PRINTING','FURNITURE','WHOLESALER','AUTO_DEALER','CYBER_CAFE','GROCERY','FRUIT_CENTER','JUICE_CENTER',
  'TEA_SHOP','COFFEE_CENTER','HARDWARE_SHOP','ELECTRICAL_ELECTRONIC_ITEM','MOBILE_SHOP','SMALL_CAFE','RESTRO_SMALL','CARTRIDGE_POINT','WHOLESALE'];

// ════════════════════════════════════════════════════════════════════════════════
// HTTP ENTRY POINTS
// ════════════════════════════════════════════════════════════════════════════════

function doGet(e){
  const action = e && e.parameter && e.parameter.action;
  if (action === 'diag') return ContentService.createTextOutput(JSON.stringify(runDiag())).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify({
    success:true,
    message:'Balaji NextGen Business OS API is live (v77)',
    deploymentUrl: ScriptApp.getService().getUrl(),
    industries: BOS_INDUSTRIES
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try{
    const req = JSON.parse(e.postData.contents);
    let out;

    switch(req.action){
      case 'REGISTER_CLIENT':               lock.waitLock(30000); lockAcquired = true; out = registerClient(req); break;
      case 'LOGIN':                         out = login(req); break;
      case 'SUITE_SAVE_DB':                 lock.waitLock(30000); lockAcquired = true; out = saveDB(req); break;
      case 'SUITE_LOAD_DB':                 out = loadDB(req); break;
      case 'SAVE_SETTINGS':                 out = saveSettings(req); break;
      case 'PROCESS_SALES_ENTRY':           lock.waitLock(30000); lockAcquired = true; out = processSalesEntry(req); break;
      case 'PROCESS_PURCHASE_ENTRY':        lock.waitLock(30000); lockAcquired = true; out = processPurchaseEntry(req); break;
      case 'SYNC_PURCHASE_ROW':             lock.waitLock(30000); lockAcquired = true; out = syncPurchaseRow(req); break;
      case 'SYNC_SALE_ROW':                 lock.waitLock(30000); lockAcquired = true; out = syncSaleRow(req); break;
      case 'SYNC_CUSTOMER_ROW':             lock.waitLock(30000); lockAcquired = true; out = syncCustomerRow(req); break;
      case 'SYNC_SUPPLIER_ROW':             lock.waitLock(30000); lockAcquired = true; out = syncSupplierRow(req); break;
      case 'SYNC_ITEM_ROW':                 lock.waitLock(30000); lockAcquired = true; out = syncItemRow(req); break;
      case 'SYNC_ITEM_CHANGE':              lock.waitLock(30000); lockAcquired = true; out = syncItemChange(req); break;
      case 'SYNC_SETTING_CHANGE':           lock.waitLock(30000); lockAcquired = true; out = syncSettingChange(req); break;
      case 'SYNC_BANK_ACCOUNT_ROW':         lock.waitLock(30000); lockAcquired = true; out = syncBankAccountRow(req); break;
      case 'LOG_SALE':                      lock.waitLock(30000); lockAcquired = true; out = syncSaleRow(req); break;
      case 'LOG_PURCHASE':                  lock.waitLock(30000); lockAcquired = true; out = syncPurchaseRow(req); break;
      case 'LOG_PARTY':                     lock.waitLock(30000); lockAcquired = true; out = logPartyRow(req); break;
      case 'DELETE_SALE':                   lock.waitLock(30000); lockAcquired = true; out = deleteSaleRecord(req); break;
      case 'DELETE_PURCHASE':               lock.waitLock(30000); lockAcquired = true; out = deletePurchaseRecord(req); break;
      case 'DELETE_CUSTOMER':               lock.waitLock(30000); lockAcquired = true; out = deleteCustomerRecord(req); break;
      case 'DELETE_SUPPLIER':               lock.waitLock(30000); lockAcquired = true; out = deleteSupplierRecord(req); break;
      case 'DELETE_ITEM':                   lock.waitLock(30000); lockAcquired = true; out = deleteItemRecord(req); break;
      case 'DELETE_EXPENSE':                lock.waitLock(30000); lockAcquired = true; out = deleteExpenseRecordById(req); break;
      case 'DELETE_BANK_TXN':               lock.waitLock(30000); lockAcquired = true; out = deleteBankTxnRecordById(req); break;
      case 'DELETE_PAYMENT_IN':             lock.waitLock(30000); lockAcquired = true; out = deletePaymentInRecordById(req); break;
      case 'DELETE_PAYMENT_OUT':            lock.waitLock(30000); lockAcquired = true; out = deletePaymentOutRecordById(req); break;
      case 'DELETE_CREDIT_NOTE':            lock.waitLock(30000); lockAcquired = true; out = deleteCreditNoteRecordById(req); break;
      case 'DELETE_DEBIT_NOTE':             lock.waitLock(30000); lockAcquired = true; out = deleteDebitNoteRecordById(req); break;
      case 'GET_NEXT_INVOICE_NUMBER':       out = getNextInvoiceNumber(req); break;
      case 'REGISTER_INVOICE_NUMBER':       lock.waitLock(30000); lockAcquired = true; out = registerInvoiceNumber(req); break;
      case 'UPLOAD_ATTACHMENT':             out = uploadAttachment(req); break;
      case 'CHECK_SUBSCRIPTION':            out = checkSubscription(req); break;
      case 'GET_INDUSTRIES':                out = {success:true, industries: BOS_INDUSTRIES}; break;
      case 'DIAG':                          out = runDiag(); break;
      case 'RESET_ALL_DATA':                lock.waitLock(30000); lockAcquired = true; out = resetAllData(req); break;
      case 'GET_PURCHASE_LEDGER':           out = generatePurchaseLedger(req); break;
      case 'GET_SALES_LEDGER':              out = generateSalesLedger(req); break;
      case 'GET_ITEM_WISE_PURCHASE':        out = generateItemWisePurchase(req); break;
      case 'GET_ITEM_WISE_SALES':           out = generateItemWiseSales(req); break;
      case 'GET_MONTHWISE_PURCHASE':        out = generateMonthwisePurchase(req); break;
      case 'GET_MONTHWISE_SALES':           out = generateMonthwiseSales(req); break;
      case 'GET_STOCK_LEDGER':              out = generateStockLedger(req); break;
      case 'GET_STOCK_SUMMARY':             out = generateStockSummary(req); break;
      case 'GET_BALANCE_SHEET':             out = generateBalanceSheet(req); break;
      case 'GET_PL_STATEMENT':              out = generatePLStatement(req); break;
      case 'GET_CASH_FLOW':                 out = generateCashFlow(req); break;
      case 'VERIFY_MASTER_CONTROL':         out = verifyMasterControl(); break;
      case 'REPAIR_MASTER_CONTROL':         out = repairMasterControl(); break;
      case 'REPAIR_ALL_CLIENT_DATABASES':   out = repairAllClientDatabases(); break;
      case 'REPAIR_ONE_CLIENT_DATABASE':    out = ensureClientDatabase_(req.clientId); break;
      case 'RECONCILE_REPORT':              out = reconcileReport(req); break;
      case 'RECONCILE_AND_SAVE':            out = reconcileAndSave(req); break;
      case 'DEDUPE_AND_RELINK':             lock.waitLock(30000); lockAcquired = true; out = dedupeAndRelink(req); break;
      case 'CHECK_DATA_CHANGE':             out = checkDataChange(req); break;
      case 'VERIFY_NAVIGATION_STATE':       out = verifyNavigationState(req); break;
      case 'GET_AUDIT_LOG':                 out = getAuditLog(req); break;
      case 'CLEAR_DELETED_RECORDS':         lock.waitLock(30000); lockAcquired = true; out = clearDeletedRecords(req); break;

      // ── Tally direct posting ──────────────────────────────────────────
      case 'POST_TO_TALLY':                 out = postToTallyAPI(req); break;
      case 'CHECK_TALLY_STATUS':            out = checkTallyStatusAPI(req); break;

      // ── Backup / restore ──────────────────────────────────────────────
      case 'BACKUP_SINGLE_CLIENT':          out = backupSingleClientAPI(req); break;
      case 'RESTORE_FROM_BACKUP':           lock.waitLock(30000); lockAcquired = true; out = restoreClientAPI(req); break;
      case 'LIST_BACKUPS':                  out = listBackupsAPI(req); break;
      case 'BACKUP_STATUS':                 out = backupStatusAPI(req); break;
      case 'SETUP_BACKUP_TRIGGER':          lock.waitLock(30000); lockAcquired = true; out = setupDailyBackupTrigger(); break;
      case 'REMOVE_BACKUP_TRIGGER':         lock.waitLock(30000); lockAcquired = true; out = removeDailyBackupTrigger(); break;
      case 'VERIFY_BACKUP_INTEGRITY':       out = verifyBackupIntegrity(req.backupId); break;
      case 'GET_BACKUP_STATISTICS':         out = getBackupStatistics(req.clientSheetId); break;
      case 'RUN_AUTOMATIC_BACKUP_NOW':      lock.waitLock(60000); lockAcquired = true; out = dailyAutomaticBackup(); break;
      case 'VERIFY_RETENTION_POLICY':       out = verifyRetentionPolicy(req.clientSheetId); break;
      case 'FORCE_MANUAL_CLEANUP':          lock.waitLock(30000); lockAcquired = true; out = forceManualCleanup(); break;

      // ── Bug fix: repair a client already showing the wrong business name ──
      case 'FIX_CLIENT_BIZNAME':            lock.waitLock(30000); lockAcquired = true; out = fixClientBizName(req); break;

      // ── Client provisioning from template ───────────────────────────────
      case 'PROVISION_NEW_CLIENT':          lock.waitLock(30000); lockAcquired = true; out = PROVISION_NEW_CLIENT(req); break;
      case 'BATCH_PROVISION_CLIENTS':       lock.waitLock(60000); lockAcquired = true; out = BATCH_PROVISION_CLIENTS(req); break;
      case 'GET_TEMPLATE_INFO':             out = GET_TEMPLATE_INFO(req); break;
      case 'SYNC_TEMPLATE_TO_CLIENT':       lock.waitLock(30000); lockAcquired = true; out = SYNC_TEMPLATE_TO_CLIENT(req); break;

      // ── Excel purchase import (Import Center) ───────────────────────────
      case 'IMPORT_PURCHASES_FROM_EXCEL':   lock.waitLock(60000); lockAcquired = true; out = IMPORT_PURCHASES_FROM_EXCEL(req); break;
      case 'PREPARE_PURCHASE_DATA_FROM_EXCEL': out = PREPARE_PURCHASE_DATA_FROM_EXCEL(req); break;

      default: out = {success:false, message:'Unknown action', error:'UNKNOWN_ACTION'};
    }

    if (out && out.success === false && out.error === undefined) out.error = out.message || 'Unknown error';
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    try{ logError('doPost:uncaught', (e && e.postData ? e.postData.contents.substring(0,300) : '') + ' | ' + err.toString()); }catch(e2){}
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message, error: err.message, stack:err.stack})).setMimeType(ContentService.MimeType.JSON);
  }finally{
    if (lockAcquired) { try{ lock.releaseLock(); }catch(e){} }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ════════════════════════════════════════════════════════════════════════════════

function sheet(id, tab){ return SpreadsheetApp.openById(id).getSheetByName(tab); }

function appendRowByHeader(id, tab, headers, rowObj){
  const sh = sheet(id, tab);
  if(!sh) throw new Error('Tab not found: '+tab);
  const existingHeader = sh.getLastRow()>0 ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0] : [];
  const useHeaders = existingHeader.length ? existingHeader : headers;
  if(sh.getLastRow()===0) sh.appendRow(headers);
  sh.appendRow(useHeaders.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
}

function findRow(id, tab, matchCol, matchVal){
  const sh = sheet(id, tab);
  if(!sh || sh.getLastRow()<2) return null;
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const colIdx = hdr.indexOf(matchCol);
  if(colIdx===-1) return null;
  for(let i=1;i<data.length;i++){
    if(String(data[i][colIdx]).trim() === String(matchVal).trim()){
      const obj = {}; hdr.forEach((h,j)=> obj[h]=data[i][j]);
      obj._rowIndex = i+1;
      return obj;
    }
  }
  return null;
}

function upsertRowByHeaderName(id, tab, matchCol, matchVal, rowObj){
  const sh = sheet(id, tab);
  if(!sh) throw new Error('Tab not found: '+tab);
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const colIdx = hdr.indexOf(matchCol);
  if(colIdx===-1) throw new Error('Column '+matchCol+' not found in '+tab);

  let targetRow = -1;
  for(let i=1;i<data.length;i++){
    if(String(data[i][colIdx]).trim() === String(matchVal).trim()){
      targetRow = i+1;
      break;
    }
  }

  if(targetRow === -1){
    appendRowByHeader(id, tab, hdr, rowObj);
  } else {
    Object.keys(rowObj).forEach(key=>{
      const keyIdx = hdr.indexOf(key);
      if(keyIdx > -1){
        sh.getRange(targetRow, keyIdx+1).setValue(rowObj[key]);
      }
    });
  }
}

function findRowByPhoneAnyIndustry(id, tab, phone){
  const sh = sheet(id, tab);
  if(!sh || sh.getLastRow()<2) return null;
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const phoneIdx = hdr.indexOf('PHONE');
  if(phoneIdx===-1) return null;
  for(let i=1;i<data.length;i++){
    if(String(data[i][phoneIdx]).trim() === String(phone).trim()){
      const obj = {}; hdr.forEach((h,j)=> obj[h]=data[i][j]);
      obj._rowIndex = i+1;
      return obj;
    }
  }
  return null;
}

function findRowByEmailAnyIndustry(id, tab, email){
  if (!email) return null;
  const sh = sheet(id, tab);
  if(!sh || sh.getLastRow()<2) return null;
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const emailIdx = hdr.indexOf('EMAIL');
  if(emailIdx===-1) return null;
  const target = String(email).trim().toLowerCase();
  for(let i=1;i<data.length;i++){
    const rowEmail = String(data[i][emailIdx]||'').trim().toLowerCase();
    if(rowEmail && rowEmail === target){
      const obj = {}; hdr.forEach((h,j)=> obj[h]=data[i][j]);
      obj._rowIndex = i+1;
      return obj;
    }
  }
  return null;
}

function logError(action, msg){
  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'ERROR_LOG', ['TIMESTAMP','ERROR','STACK'], {
      TIMESTAMP: new Date().toISOString(),
      ERROR: '[BusinessOS:' + action + '] ' + msg,
      STACK: ''
    });
  }catch(e){}
}

function logAuditEntry(sheetId, action, table, recordId, detail, status='SUCCESS'){
  try{
    const ss = SpreadsheetApp.openById(sheetId);
    const auditSh = getOrCreateSheet_(ss, 'AUDIT_LOG', H.AUDIT_LOG);
    appendRowFast_(auditSh, {
      LOG_ID: Utilities.getUuid(),
      ACTION: action,
      TABLE: table,
      RECORD_ID: recordId,
      TIMESTAMP: new Date().toISOString(),
      USER_ID: 'SYSTEM',
      CHANGE_DETAIL: detail,
      STATUS: status
    });
  }catch(e){
    logError('logAuditEntry:'+action, 'sheetId='+sheetId+' | '+e.toString());
  }
}

function getTemplateInfo(){
  try{
    const row = findRow(MASTER_CONTROL_SHEET_ID, 'TEMPLATE_REGISTRY', 'TEMPLATE_ID', TEMPLATE_ID_FOR_BOS);
    if(row && row.GOOGLE_SHEET_ID){
      return { sheetId: String(row.GOOGLE_SHEET_ID), folderId: String(row.GOOGLE_DRIVE_FOLDER_ID || '') };
    }
  }catch(e){ logError('getTemplateInfo', e.toString()); }
  return { sheetId: TEMPLATE_SHEET_ID, folderId: '' };
}

function getHeaderIndexMap_(sh){
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return {};
  const headers = sh.getRange(1,1,1,lastCol).getValues()[0];
  const map = {};
  headers.forEach((h,i)=>{ const key=String(h||'').trim().toUpperCase(); if(key) map[key]=i; });
  return map;
}

function getOrAddColumn_(sh, headerName){
  const map = getHeaderIndexMap_(sh);
  const key = String(headerName).toUpperCase();
  if (map[key] !== undefined) return map[key];
  const newCol = sh.getLastColumn() + 1;
  sh.getRange(1, newCol).setValue(headerName);
  return newCol - 1;
}

function upsertRowBatched_(sh, idVal, rowObj){
  const lastRow = sh.getLastRow();
  let targetRow = -1;
  if (lastRow >= 2){
    const idColVals = sh.getRange(2,1,lastRow-1,1).getValues();
    for(let i=0;i<idColVals.length;i++){
      if (String(idColVals[i][0]) === String(idVal)){ targetRow = i+2; break; }
    }
  }
  const isNewRow = targetRow === -1;
  if (isNewRow) targetRow = Math.max(lastRow + 1, 2);

  Object.keys(rowObj).forEach(key => getOrAddColumn_(sh, key));
  const hdrMap = getHeaderIndexMap_(sh);
  const lastCol = sh.getLastColumn();
  const rowArr = isNewRow ? new Array(lastCol).fill('') :
    sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];
  Object.keys(rowObj).forEach(key=>{
    const col = hdrMap[String(key).toUpperCase()];
    if (col !== undefined) rowArr[col] = rowObj[key];
  });
  sh.getRange(targetRow, 1, 1, lastCol).setValues([rowArr]);
  return isNewRow;
}

function appendRowFast_(sh, rowObj){
  Object.keys(rowObj).forEach(key => getOrAddColumn_(sh, key));
  const hdrMap = getHeaderIndexMap_(sh);
  const lastCol = sh.getLastColumn();
  const rowArr = new Array(lastCol).fill('');
  Object.keys(rowObj).forEach(key=>{
    const col = hdrMap[String(key).toUpperCase()];
    if (col !== undefined) rowArr[col] = rowObj[key];
  });
  sh.appendRow(rowArr);
}

function getOrCreateSheet_(ss, tabName, headers){
  let sh = ss.getSheetByName(tabName);
  if (!sh){
    sh = ss.insertSheet(tabName);
    sh.appendRow(headers);
  } else if (sh.getLastRow() === 0){
    sh.appendRow(headers);
  }
  return sh;
}

function readAllRows_(ss, tabName){
  const sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return [];
  const hdrMap = getHeaderIndexMap_(sh);
  const rows = sh.getRange(2, 1, sh.getLastRow()-1, sh.getLastColumn()).getValues();
  return { rows, hdrMap };
}

// ════════════════════════════════════════════════════════════════════════════════
// PASSWORD HASHING
// ════════════════════════════════════════════════════════════════════════════════

function hashPass(pw, salt){
  salt = salt || Utilities.getUuid().replace(/-/g,'');
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(pw)));
  return salt + '$' + hash;
}

function _legacyHashPass(pw){
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw)));
}

function verifyPass(pw, stored){
  stored = String(stored||'');
  if (!stored) return false;
  const sep = stored.indexOf('$');
  if (sep > -1) {
    const salt = stored.slice(0, sep);
    const expected = stored.slice(sep+1);
    return hashPass(pw, salt) === (salt + '$' + expected);
  }
  return _legacyHashPass(pw) === stored;
}

// ════════════════════════════════════════════════════════════════════════════════
// CLIENT REGISTRATION
// ════════════════════════════════════════════════════════════════════════════════

function nextClientId(){
  let maxNum = 15;
  function scan(sheetId, tab, col){
    try{
      const sh = sheet(sheetId, tab);
      if(!sh) return;
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const idx = hdr.indexOf(col);
      if(idx === -1) return;
      for(let i=1;i<data.length;i++){
        const m = String(data[i][idx]||'').match(/^CL0*([0-9]+)$/i);
        if(m) maxNum = Math.max(maxNum, parseInt(m[1],10));
      }
    }catch(e){ logError('nextClientId:scan', tab+' | '+e.toString()); }
  }
  scan(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID');
  scan(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID');
  return 'CL' + String(maxNum+1).padStart(5,'0');
}

function initClientSheets_(sheetId){
  const ss = SpreadsheetApp.openById(sheetId);
  Object.keys(H).forEach(tabName => {
    getOrCreateSheet_(ss, tabName, H[tabName]);
  });
  const metaSh = ss.getSheetByName('META');
  if (metaSh.getLastRow() < 2){
    metaSh.appendRow(['META', 0, 0, new Date()]);
  }

  const invSh = ss.getSheetByName('INVOICE_SERIES');
  if (invSh && invSh.getLastRow() < 2){
    invSh.appendRow(['SALES', 1, '', new Date()]);
    invSh.appendRow(['PURCHASE', 1, '', new Date()]);
  }
}

function writeRemainingRegistries_(p){
  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_REGISTRY',
      ['CLIENT_ID','CLIENT_NAME','INDUSTRY','DATABASE_TYPE','DATABASE_NAME','GOOGLE_SHEET_ID','FOLDER_ID','STATUS','CREATED_AT','UPDATED_AT','CREATED_DATE'],
      {
        CLIENT_ID: p.clientId, CLIENT_NAME: p.bizName, INDUSTRY: p.industry,
        DATABASE_TYPE: 'BUSINESS_OS_DB', DATABASE_NAME: p.clientId+'_'+p.bizName,
        GOOGLE_SHEET_ID: p.clientSheetId, FOLDER_ID: p.folderId, STATUS: 'ACTIVE',
        CREATED_AT: p.now, UPDATED_AT: p.now, CREATED_DATE: p.now
      });
  }catch(e){ logError('writeRemainingRegistries:CLIENT_REGISTRY(MC)', p.clientId+' | '+e.toString()); }

  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY',
      ['CLIENT_ID','COMPANY_NAME','MASTER_DB_ID','MASTER_DB_URL','TRANSACTION_DB_ID','TRANSACTION_DB_URL','REPORT_DB_ID','REPORT_DB_URL','FOLDER_ID','CREATED_ON','STATUS','APPLIED_TEMPLATE_VERSION'],
      {
        CLIENT_ID: p.clientId, COMPANY_NAME: p.bizName, MASTER_DB_ID: p.clientSheetId,
        MASTER_DB_URL: p.clientSheetUrl, TRANSACTION_DB_ID:'', TRANSACTION_DB_URL:'',
        REPORT_DB_ID:'', REPORT_DB_URL:'', FOLDER_ID: p.folderId, CREATED_ON: p.now,
        STATUS: 'ACTIVE', APPLIED_TEMPLATE_VERSION: TEMPLATE_ID_FOR_BOS
      });
  }catch(e){ logError('writeRemainingRegistries:CLIENT_DATABASE_REGISTRY', p.clientId+' | '+e.toString()); }

  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY',
      ['CLIENT_ID','CLIENT_CODE','CLIENT_NAME','INDUSTRY','TEMPLATE_ID','MASTER_DB_ID','MAIN_FOLDER_ID','ADMIN_NAME','ADMIN_EMAIL','MOBILE_NO','PLAN_TYPE','LICENSE_KEY','API_KEY','TOTAL_BRANCH','LIVE_STATUS','CREATED_AT','UPDATED_AT','STATUS'],
      {
        CLIENT_ID: p.clientId, CLIENT_CODE: p.clientId, CLIENT_NAME: p.bizName,
        INDUSTRY: p.industry, TEMPLATE_ID: TEMPLATE_ID_FOR_BOS, MASTER_DB_ID: p.clientSheetId,
        MAIN_FOLDER_ID: p.folderId, ADMIN_NAME: p.owner, ADMIN_EMAIL: p.email,
        MOBILE_NO: p.mobile, PLAN_TYPE: p.plan, LICENSE_KEY: 'AUTO-'+p.clientId,
        API_KEY: 'API-'+p.clientId, TOTAL_BRANCH: 1, LIVE_STATUS: 'LIVE',
        CREATED_AT: p.now, UPDATED_AT: p.now, STATUS: 'ACTIVE'
      });
  }catch(e){ logError('writeRemainingRegistries:CLIENT_DEPLOYMENT_REGISTRY', p.clientId+' | '+e.toString()); }

  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'SAAS_SUBSCRIPTION_MASTER',
      ['SUBSCRIPTION_ID','CLIENT_ID','PLAN_NAME','START_DATE','END_DATE','AMOUNT','PAYMENT_STATUS','LICENSE_STATUS','USER_LIMIT','BRANCH_LIMIT','STORAGE_LIMIT','STATUS'],
      {
        SUBSCRIPTION_ID: 'SUB-'+p.clientId+'-'+Date.now(), CLIENT_ID: p.clientId,
        PLAN_NAME: p.plan, START_DATE: p.now, END_DATE: p.trialEnd, AMOUNT: 0,
        PAYMENT_STATUS: p.plan==='TRIAL' ? 'FREE_TRIAL' : 'ACTIVE',
        LICENSE_STATUS: 'ACTIVE', USER_LIMIT: 1, BRANCH_LIMIT: 1, STORAGE_LIMIT:'', STATUS: 'ACTIVE'
      });
  }catch(e){ logError('writeRemainingRegistries:SAAS_SUBSCRIPTION_MASTER', p.clientId+' | '+e.toString()); }

  try{
    appendRowByHeader(USER_SECURITY_SHEET_ID, 'LICENSE_MASTER',
      ['LICENSE_ID','CLIENT_ID','PLAN_NAME','LICENSE_STATUS','TRIAL_DAYS','START_DATE','EXPIRY_DATE','PAYMENT_STATUS','NEXT_RENEWAL','AI_ACCESS','CLOUD_BACKUP','MAX_USERS','MAX_BRANCHES','MAX_STORAGE_GB','API_ACCESS','WHATSAPP_ACCESS','MOBILE_APP_ACCESS','LAST_PAYMENT_DATE','RENEWAL_AMOUNT','AUTO_RENEWAL','CREATED_ON','LAST_UPDATED','REMARKS'],
      {
        LICENSE_ID: 'LIC-'+p.clientId, CLIENT_ID: p.clientId, PLAN_NAME: p.plan,
        LICENSE_STATUS: 'ACTIVE', TRIAL_DAYS: TRIAL_DAYS, START_DATE: p.now,
        EXPIRY_DATE: p.trialEnd, PAYMENT_STATUS: p.plan==='TRIAL' ? 'FREE_TRIAL' : 'ACTIVE',
        NEXT_RENEWAL: p.trialEnd, AI_ACCESS: 'NO', CLOUD_BACKUP: 'YES', MAX_USERS: 1,
        MAX_BRANCHES: 1, MAX_STORAGE_GB: 1, API_ACCESS: 'YES', WHATSAPP_ACCESS: 'NO',
        MOBILE_APP_ACCESS: 'YES', LAST_PAYMENT_DATE:'', RENEWAL_AMOUNT: 0,
        AUTO_RENEWAL: 'NO', CREATED_ON: p.now, LAST_UPDATED: p.now, REMARKS: 'Auto-created at registration'
      });
  }catch(e){ logError('writeRemainingRegistries:LICENSE_MASTER', p.clientId+' | '+e.toString()); }

  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'TEMPLATE_USAGE_LOG',
      ['LOG_ID','CLIENT_ID','TEMPLATE_ID','INDUSTRY','SOURCE_TEMPLATE_DB','COPIED_DB_ID','COPIED_FOLDER_ID','COPY_DATE','COPY_BY','STATUS'],
      {
        LOG_ID: Utilities.getUuid(), CLIENT_ID: p.clientId, TEMPLATE_ID: TEMPLATE_ID_FOR_BOS,
        INDUSTRY: p.industry, SOURCE_TEMPLATE_DB: p.tmplSheetId, COPIED_DB_ID: p.clientSheetId,
        COPIED_FOLDER_ID: p.folderId, COPY_DATE: p.now, COPY_BY: 'SELF_REGISTER', STATUS: 'SUCCESS'
      });
  }catch(e){ logError('writeRemainingRegistries:TEMPLATE_USAGE_LOG', p.clientId+' | '+e.toString()); }
}

function registerClient(req){
  const bizName = (req.bizName || '').trim();
  const owner   = (req.owner   || '').trim();
  const mobile  = (req.mobile  || '').trim();
  if(!bizName) return { success:false, message:'Business name is required.' };
  if(!owner)   return { success:false, message:'Owner name is required.' };
  if(!/^[6-9]\d{9}$/.test(mobile)) return { success:false, message:'Enter a valid 10-digit mobile number.' };
  const email = (req.email || '').trim();
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success:false, message:'Enter a valid email address (or leave it blank).' };
  if(!req.password || String(req.password).length < 6) return { success:false, message:'Password must be at least 6 characters.' };

  const dupPhone = findRowByPhoneAnyIndustry(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', mobile);
  if(dupPhone){
    return {
      success: false, duplicate: true, duplicateField: 'mobile',
      message: 'This mobile number is already registered' + (dupPhone.COMPANY_NAME ? ' to "'+dupPhone.COMPANY_NAME+'"' : '') + ' (Client ID: '+dupPhone.CLIENT_ID+').',
      existingClientId: dupPhone.CLIENT_ID
    };
  }
  const dupEmail = findRowByEmailAnyIndustry(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', email);
  if(dupEmail){
    return {
      success: false, duplicate: true, duplicateField: 'email',
      message: 'This email is already registered' + (dupEmail.COMPANY_NAME ? ' to "'+dupEmail.COMPANY_NAME+'"' : '') + ' (Client ID: '+dupEmail.CLIENT_ID+').',
      existingClientId: dupEmail.CLIENT_ID
    };
  }

  const clientId = nextClientId();
  const dbName = clientId + '_' + bizName;
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS*86400000);

  let clientSheetId, clientFolder, tmplSheetId;
  try {
    const tmpl = getTemplateInfo();
    tmplSheetId = tmpl.sheetId;
    const templateFile = DriveApp.getFileById(tmpl.sheetId);
    clientFolder = DriveApp.getFolderById(CLIENTS_DRIVE_FOLDER_ID).createFolder(dbName);
    const clonedFile = templateFile.makeCopy(dbName, clientFolder);
    clientSheetId = clonedFile.getId();
  } catch(err) {
    logError('registerClient:createFolder', 'clientId='+clientId+' bizName='+bizName+' | ' + err.toString());
    return { success:false, message:'Could not create the client database. This has been logged. Detail: ' + err.message };
  }

  const pwHash = hashPass(req.password);

  appendRowByHeader(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', H.CLIENT_MASTER, {
    CLIENT_ID:clientId, CONTACT_NAME:owner, PHONE:mobile, ALT_PHONE:'', EMAIL:email||'',
    COMPANY_NAME:bizName, COMPANY_TYPE:req.industry, GST_NO:'', PAN:'', ADDRESS:'', CITY:'', STATE:'', PIN:'',
    INDUSTRY:req.industry, PLAN:'TRIAL', ERP_URL:BACKEND_API_URL, ADMIN_NAME:owner, ADMIN_EMAIL:email||'',
    ADMIN_USERNAME:mobile, ADMIN_PASSWORD:pwHash, ADMIN_MOBILE:mobile, ADMIN_ROLE:'OWNER',
    STATUS:'ACTIVE', LICENSE_STATUS:'ACTIVE', REGISTERED_BY:'SELF_REGISTER'
  });

  const userId = clientId + '-U1';
  appendRowByHeader(USER_SECURITY_SHEET_ID, 'USER_MASTER', H.USER_MASTER, {
    USER_ID:userId, CLIENT_ID:clientId, USER_CODE:clientId+'ADMIN', FULL_NAME:owner, EMAIL:email||'',
    MOBILE_NO:mobile, PASSWORD:pwHash, ROLE:'OWNER', INDUSTRY:req.industry, BRANCH:'HEAD_OFFICE',
    ACCESS_LEVEL:'FULL', STATUS:'ACTIVE', WEB_ACCESS:'YES', APP_ACCESS:'YES', OTP_ACCESS:'NO', LOGIN_TYPE:'PASSWORD',
    COMPANY_NAME:bizName, DEPARTMENT:'MANAGEMENT', DESIGNATION:'OWNER', DEFAULT_DASHBOARD:'BUSINESS_OS_DASHBOARD',
    CREATED_BY:'SELF_REGISTER', CREATED_DATE:now, LAST_LOGIN:'', FAILED_ATTEMPTS:0, ACCOUNT_LOCKED:'NO'
  });

  appendRowByHeader(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', H.CLIENT_REGISTRY, {
    CLIENT_ID: clientId, COMPANY_NAME: bizName, DATABASE_ID: clientSheetId,
    PLAN_NAME: 'TRIAL', EXPIRY_DATE: trialEnd, STATUS: 'ACTIVE',
    CREATED_DATE: now, LAST_SYNC: now
  });

  try {
    initClientSheets_(clientSheetId);
    if(!req.migrateData){
      resetAllData({sheetId: clientSheetId});
      const clientSs = SpreadsheetApp.openById(clientSheetId);
      const metaSh = getOrCreateSheet_(clientSs, 'META', H.META);
      if(metaSh.getLastRow() >= 2){
        metaSh.getRange(2,1,1,4).setValues([['META', 0, 0, new Date()]]);
      }
    }
    // ── FIX (bug: wrong company name after login, e.g. CL00024) ──────────
    // initClientSheets_() clones the TEMPLATE spreadsheet as-is. If that
    // template's own SETTINGS tab already has a BUSINESS_NAME/bizName value
    // baked in (left over from whoever last edited/tested the template),
    // EVERY newly-registered client silently inherits that stale name —
    // and login() (see below) prefers the client's own SETTINGS.bizName
    // over CLIENT_REGISTRY.COMPANY_NAME, so the wrong name shows up on the
    // very first login, before the client has touched Settings at all.
    // Force the new client's SETTINGS blob to the name they actually
    // registered with, every time, so nothing from the template can leak
    // through.
    _resetClientBizIdentity_(clientSheetId, bizName, req.industry);
  } catch(err) {
    logError('registerClient:initClientSheets', 'clientId='+clientId + ' | '+err.toString());
  }

  if(req.migrateData){
    saveDB({sheetId:clientSheetId, data:req.migrateData});
  }

  writeRemainingRegistries_({
    clientId, bizName, owner, mobile, email: email||'', industry: req.industry,
    plan: 'TRIAL', now, trialEnd, clientSheetId,
    clientSheetUrl: 'https://docs.google.com/spreadsheets/d/'+clientSheetId+'/edit',
    folderId: clientFolder.getId(), tmplSheetId
  });

  return {
    success:true, clientId, sheetId:clientSheetId, folderId:clientFolder.getId(),
    trialEnd: trialEnd.getTime(), userId, loginId:mobile
  };
}

// Overwrites the new client's SETTINGS blob (ID='SETTINGS' row, matching the
// same shape saveSettings()/loadDB() already read/write) with the business
// name and industry actually entered at registration, so a value cloned from
// the shared TEMPLATE_SHEET_ID can never surface as the client's business
// name. Also used standalone via FIX_CLIENT_BIZNAME to repair an
// already-provisioned client (e.g. CL00024) without touching the sheet by hand.
function _resetClientBizIdentity_(clientSheetId, bizName, industry){
  const ss = SpreadsheetApp.openById(clientSheetId);
  const sh = getOrCreateSheet_(ss, 'SETTINGS', H.SETTINGS);
  upsertRowBatched_(sh, 'SETTINGS', {
    ID: 'SETTINGS',
    SETTINGS_JSON: JSON.stringify({ bizName: bizName, industry: industry || '' }),
    UPDATED_AT: new Date()
  });
}

// Self-service repair for a client already showing the wrong business name
// (the bug that hit CL00024 / RR Fresh and More before the fix above
// existed). Pass either clientId (looked up in CLIENT_REGISTRY) or a
// sheetId directly, plus the correct bizName.
function fixClientBizName(req){
  if(!req.bizName) return {success:false, message:'bizName required'};
  let sheetId = req.sheetId;
  if(!sheetId && req.clientId){
    const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', req.clientId);
    if(!cr || !cr.DATABASE_ID) return {success:false, message:'Client not found in CLIENT_REGISTRY'};
    sheetId = String(cr.DATABASE_ID);
  }
  if(!sheetId) return {success:false, message:'sheetId or clientId required'};
  try{
    _resetClientBizIdentity_(sheetId, req.bizName, req.industry);
    // Also keep CLIENT_REGISTRY / CLIENT_MASTER's COMPANY_NAME in sync so
    // future logins agree even before this fix, since login() falls back
    // to CLIENT_REGISTRY.COMPANY_NAME when SETTINGS has no bizName.
    if(req.clientId){
      try{ upsertRowByHeaderName(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', req.clientId, {COMPANY_NAME: req.bizName}); }catch(e){}
      try{ upsertRowByHeaderName(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', req.clientId, {COMPANY_NAME: req.bizName}); }catch(e){}
    }
    logAuditEntry(sheetId, 'FIX_CLIENT_BIZNAME', 'SETTINGS', req.clientId||sheetId, 'bizName corrected to: '+req.bizName, 'SUCCESS');
    return {success:true, message:'Business name corrected to "'+req.bizName+'"', sheetId};
  }catch(e){
    logError('fixClientBizName', 'sheetId='+sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// LOGIN & SESSION
// ════════════════════════════════════════════════════════════════════════════════

function login(req){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'USER_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);

  const loginId = String(req.loginId || '').trim();
  const loginIdLower = loginId.toLowerCase();

  for(let i=1;i<data.length;i++){
    const row = data[i];
    const mobileMatch   = String(row[idx.MOBILE_NO] || '').trim() === loginId;
    const emailMatch    = row[idx.EMAIL] && String(row[idx.EMAIL]).trim().toLowerCase() === loginIdLower;
    const usernameMatch = idx.USER_CODE !== undefined && row[idx.USER_CODE] &&
                           String(row[idx.USER_CODE]).trim().toLowerCase() === loginIdLower;

    const storedPw = row[idx.PASSWORD];
    if((mobileMatch || emailMatch || usernameMatch) && verifyPass(req.password, storedPw)){
      const userId = row[idx.USER_ID], clientId = row[idx.CLIENT_ID], role = row[idx.ROLE];
      const rowIndustry = String(row[idx.INDUSTRY] || '');

      if(role !== 'SUPER_ADMIN' && BOS_INDUSTRIES.indexOf(rowIndustry) === -1){
        return {
          success:false,
          message:'This account is not configured for Business OS.'
        };
      }

      let sheetId=null, bizName=row[idx.FULL_NAME], plan='TRIAL', trialEnd=null;
      if(role !== 'SUPER_ADMIN' && clientId){
        const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', clientId);
        if(cr){
          sheetId = cr.DATABASE_ID;
          bizName = cr.COMPANY_NAME;
          plan = cr.PLAN_NAME;
          trialEnd = new Date(cr.EXPIRY_DATE).getTime();
        }
      }

      const loaded = sheetId ? loadDB({sheetId}) : {data:null, lastSynced:0};
      if(loaded.data && loaded.data.bizName) bizName = loaded.data.bizName;

      return {
        success:true, clientId: clientId||'ALL', sheetId, role, bizName, plan, trialEnd,
        data: loaded.data, lastSynced: loaded.lastSynced, userId
      };
    }
  }

  return {success:false, message:'Invalid mobile, email, username or password'};
}

// ════════════════════════════════════════════════════════════════════════════════
// AUTO-DEDUPE ON EVERY LOAD
// ════════════════════════════════════════════════════════════════════════════════

function _autoDedupeOnLoad_(ss){
  const purchSh = ss.getSheetByName('PURCHASES');
  const salesSh = ss.getSheetByName('SALES');
  if (!purchSh || !salesSh) return {purchases:0, sales:0};

  const purchDedupe = _dedupeVoucherTab_(purchSh, 'PURCHASE_ID', 'SUPPLIER_ID', 'SUPPLIER_NAME', 'INVOICE_NO', 'TOTAL');
  const salesDedupe = _dedupeVoucherTab_(salesSh, 'INVOICE_ID', 'CUSTOMER_ID', 'CUSTOMER_NAME', 'INVOICE_NO', 'TOTAL');

  return {
    purchases: purchDedupe.removed,
    sales: salesDedupe.removed
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DATA I/O (with AUTO-DEDUPE on every load, and OPENING_STOCK read/write)
// ════════════════════════════════════════════════════════════════════════════════

function loadDB(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  const ss = SpreadsheetApp.openById(req.sheetId);
  try{ _migrateClientSheet_(req.sheetId); }catch(e){ logError('loadDB:autoMigrate', 'sheetId='+req.sheetId+' | '+e.toString()); }

  try{ _autoDedupeOnLoad_(ss); }catch(e){ logError('loadDB:autoDedup', 'sheetId='+req.sheetId+' | '+e.toString()); }

  function readArr(tab, mapFn){
    const sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return [];
    const hdrMap = getHeaderIndexMap_(sh);
    const rows = sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues();
    return rows.map(r => mapFn(r, hdrMap)).filter(x => x && x.id !== undefined && x.id !== '');
  }

  const customers = readArr('CUSTOMERS', (r,h)=>({
    id: r[h['ID']], name: r[h['NAME']], mobile: r[h['MOBILE']]||'', due: Number(r[h['DUE']])||0,
    limit: Number(r[h['CREDIT_LIMIT']])||0, lastDate: r[h['LAST_DATE']]||'',
    address: h['ADDRESS']!==undefined ? (r[h['ADDRESS']]||'') : '',
    state: h['STATE']!==undefined ? (r[h['STATE']]||'') : '',
    gstin: h['GSTIN']!==undefined ? (r[h['GSTIN']]||'') : ''
  }));
  const suppliers = readArr('SUPPLIERS', (r,h)=>({
    id: r[h['SUPPLIER_ID']] !== undefined ? r[h['SUPPLIER_ID']] : r[h['ID']],
    name: r[h['NAME']], mobile: r[h['MOBILE']]||'', due: Number(r[h['DUE']])||0,
    address: h['ADDRESS']!==undefined ? (r[h['ADDRESS']]||'') : '',
    state: h['STATE']!==undefined ? (r[h['STATE']]||'') : '',
    gstin: h['GSTIN']!==undefined ? (r[h['GSTIN']]||'') : ''
  }));
  const items = readArr('ITEMS', (r,h)=>({
    id: String(r[h['ID']]||''), name: r[h['NAME']], unit: String(r[h['UNIT']]||''), hsn: String(r[h['HSN']]||''),
    pRate: Number(r[h['PURCHASE_RATE']])||0, sRate: Number(r[h['SALE_RATE']])||0,
    gst: Number(r[h['GST_PERCENT']])||0, stock: Number(r[h['STOCK']])||0,
    openingStock: h['OPENING_STOCK']!==undefined ? (Number(r[h['OPENING_STOCK']])||0) : 0,
    min: Number(r[h['MIN_STOCK']])||0,
    category: h['CATEGORY']!==undefined ? (r[h['CATEGORY']]||'') : ''
  }));
  const purchases = readArr('PURCHASES', (r,h)=>{
    const dateVal = r[h['DATE']];
    const dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(dateVal||'');
    let lineItems = [];
    const raw = h['ITEMS_JSON']!==undefined ? r[h['ITEMS_JSON']] : '';
    if (raw && typeof raw === 'string' && raw.trim().charAt(0)==='[') { try{ lineItems = JSON.parse(raw); }catch(e){} }
    return {
      id: r[h['PURCHASE_ID']], supp: r[h['SUPPLIER_ID']], date: dateStr, total: Number(r[h['TOTAL']])||0, mode: r[h['MODE']]||'Cash',
      invNo: h['INVOICE_NO']!==undefined ? (r[h['INVOICE_NO']]||null) : null,
      courierCharge: h['COURIER_CHARGE']!==undefined ? (Number(r[h['COURIER_CHARGE']])||0) : 0,
      labourCharge: h['LABOUR_CHARGE']!==undefined ? (Number(r[h['LABOUR_CHARGE']])||0) : 0,
      suppName: h['SUPPLIER_NAME']!==undefined ? (r[h['SUPPLIER_NAME']]||null) : null,
      tallyPosted: h['TALLY_POSTED']!==undefined ? !!r[h['TALLY_POSTED']] : false,
      lineItems
    };
  });
  const sales = readArr('SALES', (r,h)=>{
    const dateVal = r[h['DATE']];
    const dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(dateVal||'');
    let lineItems = [];
    const raw = h['ITEMS_JSON']!==undefined ? r[h['ITEMS_JSON']] : '';
    if (raw && typeof raw === 'string' && raw.trim().charAt(0)==='[') { try{ lineItems = JSON.parse(raw); }catch(e){} }
    return {
      id: r[h['INVOICE_ID']], cust: r[h['CUSTOMER_ID']], date: dateStr, total: Number(r[h['TOTAL']])||0, mode: r[h['MODE']]||'Cash',
      invNo: h['INVOICE_NO']!==undefined ? (r[h['INVOICE_NO']]||null) : null,
      courierCharge: h['COURIER_CHARGE']!==undefined ? (Number(r[h['COURIER_CHARGE']])||0) : 0,
      labourCharge: h['LABOUR_CHARGE']!==undefined ? (Number(r[h['LABOUR_CHARGE']])||0) : 0,
      salesperson: h['SALESPERSON']!==undefined ? (r[h['SALESPERSON']]||null) : null,
      custName: h['CUSTOMER_NAME']!==undefined ? (r[h['CUSTOMER_NAME']]||null) : null,
      tallyPosted: h['TALLY_POSTED']!==undefined ? !!r[h['TALLY_POSTED']] : false,
      lineItems
    };
  });

  const paymentsIn = readArr('PAYMENTS_IN', (r,h)=>({
    id: r[h['ID']], cust: r[h['CUST']], amount: Number(r[h['AMOUNT']])||0,
    mode: r[h['MODE']]||'Cash', acctId: h['ACCT_ID']!==undefined ? (r[h['ACCT_ID']]||null) : null, billRef: r[h['BILL_REF']]||null, txnRef: r[h['TXN_REF']]||null,
    date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
  }));
  const paymentsOut = readArr('PAYMENTS_OUT', (r,h)=>({
    id: r[h['ID']], supp: r[h['SUPP']], amount: Number(r[h['AMOUNT']])||0,
    mode: r[h['MODE']]||'Cash', acctId: h['ACCT_ID']!==undefined ? (r[h['ACCT_ID']]||null) : null, billRef: r[h['BILL_REF']]||null, txnRef: r[h['TXN_REF']]||null,
    date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
  }));
  const expenses = readArr('EXPENSES', (r,h)=>({
    id: r[h['ID']], category: r[h['CATEGORY']]||'', amount: Number(r[h['AMOUNT']])||0,
    note: r[h['NOTE']]||'', pending: String(r[h['PENDING']]).toUpperCase()==='TRUE', mode: r[h['MODE']]||'Cash',
    date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
  }));
  const creditNotes = readArr('CREDIT_NOTES', (r,h)=>{
    let lineItems = [];
    const raw = h['LINE_ITEMS_JSON']!==undefined ? r[h['LINE_ITEMS_JSON']] : '';
    if (raw && typeof raw === 'string' && raw.trim().charAt(0)==='[') { try{ lineItems = JSON.parse(raw); }catch(e){} }
    return {
      id: r[h['ID']], cust: r[h['CUST']], billRef: r[h['BILL_REF']]||null, amount: Number(r[h['AMOUNT']])||0,
      reason: r[h['REASON']]||'', lineItems,
      date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
    };
  });
  const debitNotes = readArr('DEBIT_NOTES', (r,h)=>{
    let lineItems = [];
    const raw = h['LINE_ITEMS_JSON']!==undefined ? r[h['LINE_ITEMS_JSON']] : '';
    if (raw && typeof raw === 'string' && raw.trim().charAt(0)==='[') { try{ lineItems = JSON.parse(raw); }catch(e){} }
    return {
      id: r[h['ID']], supp: r[h['SUPP']], billRef: r[h['BILL_REF']]||null, amount: Number(r[h['AMOUNT']])||0,
      reason: r[h['REASON']]||'', lineItems,
      date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
    };
  });
  const bankTxns = readArr('BANK_TXNS', (r,h)=>({
    id: r[h['ID']], type: r[h['TYPE']]||'', amount: Number(r[h['AMOUNT']])||0,
    detail: r[h['DETAIL']]||'', category: r[h['CATEGORY']]||'',
    date: (r[h['DATE']] instanceof Date) ? Utilities.formatDate(r[h['DATE']], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[h['DATE']]||'')
  }));

  const meta = {cash: 0, bank: 0};
  const metaSh = ss.getSheetByName('META');
  if (metaSh && metaSh.getLastRow() >= 2) {
    const metaRow = metaSh.getRange(2, 1, 1, 4).getValues()[0];
    meta.cash = Number(metaRow[1]) || 0;
    meta.bank = Number(metaRow[2]) || 0;
  }

  let settingsData = {};
  try{
    const setSh = ss.getSheetByName('SETTINGS');
    if (setSh && setSh.getLastRow() >= 2){
      const setHdr = getHeaderIndexMap_(setSh);
      const idCol = setHdr['ID'] !== undefined ? setHdr['ID'] : 0;
      const valCol = setHdr['SETTINGS_JSON'] !== undefined ? setHdr['SETTINGS_JSON'] : 1;
      const KEY_MAP = {
        BUSINESS_NAME:'bizName', INDUSTRY:'industry', GST_REGISTERED:'gstRegistered',
        GSTIN:'gstin', UPI_ID:'upiId', THEME:'theme', BIZ_STATE:'bizState',
        BIZ_MOBILE:'bizMobile', BIZ_EMAIL:'bizEmail', BIZ_ADDRESS:'bizAddress',
        BIZ_PAN:'bizPan', BANK_HOLDER:'bankHolder', BANK_NAME:'bankName',
        BANK_ACC:'bankAcc', BANK_IFSC:'bankIfsc', BANK_BRANCH:'bankBranch',
        DEF_UNIT:'defUnit', SHOW_QR:'showQr'
      };
      const rows = setSh.getRange(2,1,setSh.getLastRow()-1, setSh.getLastColumn()).getValues();
      // Two passes so the current single-blob save format always wins,
      // regardless of physical row order in the sheet: legacy per-field rows
      // (old KEY_MAP style, e.g. a leftover GST_REGISTERED row from an
      // earlier version) are applied first, then the 'SETTINGS' JSON blob —
      // which is what saveSettings()/syncSettingsToSheet() actually write
      // today — is applied LAST and overrides them. Previously this was one
      // pass in raw row order, so a stale legacy row sitting below the
      // current blob silently reverted a setting the user had just saved.
      rows.forEach(row=>{
        const key = String(row[idCol]||'').trim();
        const val = row[valCol];
        if (!key || key === 'SETTINGS') return;
        if (KEY_MAP[key]) settingsData[KEY_MAP[key]] = val;
      });
      rows.forEach(row=>{
        const key = String(row[idCol]||'').trim();
        const val = row[valCol];
        if (key === 'SETTINGS' && typeof val === 'string' && val.trim().charAt(0)==='{'){
          try{ Object.assign(settingsData, JSON.parse(val)); }catch(e){}
        }
      });
    }
  }catch(e){ logError('loadDB:readSettings', 'sheetId='+req.sheetId+' | '+e.toString()); }

  let bankAccounts = [];
  try{
    const baSh = ss.getSheetByName('BANK_ACCOUNTS');
    if (baSh && baSh.getLastRow() >= 2){
      const baHdr = getHeaderIndexMap_(baSh);
      const baRows = baSh.getRange(2,1,baSh.getLastRow()-1, baSh.getLastColumn()).getValues();
      bankAccounts = baRows
        .map(r=>({
          id: r[baHdr['ID']], name: r[baHdr['NAME']] || '', balance: Number(r[baHdr['BALANCE']])||0
        }))
        .filter(b=> b.id !== undefined && b.id !== '' && b.id !== null);
    }
  }catch(e){ logError('loadDB:readBankAccounts', 'sheetId='+req.sheetId+' | '+e.toString()); }

  let salespeople = [];
  try{
    const spSh = ss.getSheetByName('SALESPEOPLE');
    if (spSh && spSh.getLastRow() >= 2){
      const spHdr = getHeaderIndexMap_(spSh);
      const spRows = spSh.getRange(2,1,spSh.getLastRow()-1, spSh.getLastColumn()).getValues();
      salespeople = spRows
        .map(r=>({ id: r[spHdr['ID']], name: r[spHdr['NAME']] || '' }))
        .filter(sp=> sp.id !== undefined && sp.id !== '' && sp.id !== null);
    }
  }catch(e){ logError('loadDB:readSalespeople', 'sheetId='+req.sheetId+' | '+e.toString()); }

  const data = Object.assign({}, settingsData, {
    customers, suppliers, items, purchases, sales, cash: meta.cash, bank: meta.bank,
    paymentsIn, paymentsOut, expenses, creditNotes, debitNotes, bankTxns
  });
  if (bankAccounts.length) data.bankAccounts = bankAccounts;
  if (salespeople.length) data.salespeople = salespeople;

  let lastSynced;
  try{ lastSynced = DriveApp.getFileById(req.sheetId).getLastUpdated().getTime(); }
  catch(e){ lastSynced = Date.now(); }

  return {success:true, data, lastSynced};
}

// ════════════════════════════════════════════════════════════════════════════════
// BULK UPSERT (no deletion) — kept for tables where the frontend only ever sends
// a partial / "safety-net" slice (BANK_ACCOUNTS, SALESPEOPLE).
// ════════════════════════════════════════════════════════════════════════════════
function bulkUpsertRows_(sh, idHeader, records, mapFn){
  const neededHeaders = {};
  records.forEach(rec=>{
    const rowObj = mapFn(rec);
    if (rowObj) Object.keys(rowObj).forEach(k=> neededHeaders[k]=true);
  });
  Object.keys(neededHeaders).forEach(h => getOrAddColumn_(sh, h));

  const hdrMap = getHeaderIndexMap_(sh);
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  const idColIdx = hdrMap[idHeader.toUpperCase()];
  const grid = lastRow >= 2 ? sh.getRange(2,1,lastRow-1,lastCol).getValues() : [];

  const idToRowIdx = {};
  if (idColIdx !== undefined){
    grid.forEach((row,i)=>{
      const id = row[idColIdx];
      if (id !== undefined && id !== '' && id !== null) idToRowIdx[String(id)] = i;
    });
  }

  const newRows = [];
  let updated = 0, appended = 0, skipped = 0;
  records.forEach(rec=>{
    const rowObj = mapFn(rec);
    if (!rowObj){ skipped++; return; }
    const idVal = rowObj[idHeader];
    if (idVal === undefined || idVal === '' || idVal === null){ skipped++; return; }
    const existingIdx = idToRowIdx[String(idVal)];
    if (existingIdx !== undefined){
      Object.keys(rowObj).forEach(key=>{
        const col = hdrMap[key.toUpperCase()];
        if (col !== undefined) grid[existingIdx][col] = rowObj[key];
      });
      updated++;
    } else {
      const newRow = new Array(lastCol).fill('');
      Object.keys(rowObj).forEach(key=>{
        const col = hdrMap[key.toUpperCase()];
        if (col !== undefined) newRow[col] = rowObj[key];
      });
      newRows.push(newRow);
      idToRowIdx[String(idVal)] = grid.length + newRows.length - 1;
      appended++;
    }
  });

  if (grid.length){
    sh.getRange(2,1,grid.length,lastCol).setValues(grid);
  }
  if (newRows.length){
    sh.getRange(2+grid.length,1,newRows.length,lastCol).setValues(newRows);
  }
  return {updated, appended, skipped};
}

// ════════════════════════════════════════════════════════════════════════════════
// ★ NEW: BULK SYNC (upsert + DELETE) — one read + one write per table.
// Used for the 5 core tables (CUSTOMERS/SUPPLIERS/ITEMS/PURCHASES/SALES) because
// the frontend always sends its COMPLETE current array for these. Any row that
// exists in the sheet but is NOT present in the incoming array is understood to
// have been deleted (or the two records merged) in the app, and is removed.
// Rows with a blank/missing ID are left untouched as a safety measure.
// ════════════════════════════════════════════════════════════════════════════════
function bulkSyncRows_(sh, idHeader, records, mapFn){
  const rowObjs = [];
  records.forEach(rec=>{
    const o = mapFn(rec);
    if (o) rowObjs.push(o);
  });

  const neededHeaders = {};
  rowObjs.forEach(o => Object.keys(o).forEach(k => neededHeaders[k]=true));
  Object.keys(neededHeaders).forEach(h => getOrAddColumn_(sh, h));

  const hdrMap = getHeaderIndexMap_(sh);
  const lastCol = sh.getLastColumn();
  const idColIdx = hdrMap[idHeader.toUpperCase()];
  const lastRow = sh.getLastRow();
  const grid = lastRow >= 2 ? sh.getRange(2,1,lastRow-1,lastCol).getValues() : [];

  const incomingById = {};
  rowObjs.forEach(o=>{
    const idVal = o[idHeader];
    if (idVal === undefined || idVal === '' || idVal === null) return;
    incomingById[String(idVal)] = o;
  });

  const keptRows = [];
  const seenIds = {};

  if (idColIdx !== undefined){
    grid.forEach(row=>{
      const id = row[idColIdx];
      const idStr = (id !== undefined && id !== '' && id !== null) ? String(id) : null;
      if (idStr && incomingById[idStr]){
        const o = incomingById[idStr];
        Object.keys(o).forEach(key=>{
          const col = hdrMap[key.toUpperCase()];
          if (col !== undefined) row[col] = o[key];
        });
        keptRows.push(row);
        seenIds[idStr] = true;
      } else if (!idStr){
        keptRows.push(row);
      }
    });
  } else {
    grid.forEach(r => keptRows.push(r));
  }

  let appended = 0, updated = 0;
  Object.keys(incomingById).forEach(idStr=>{
    if (seenIds[idStr]){ updated++; return; }
    const o = incomingById[idStr];
    const newRow = new Array(lastCol).fill('');
    Object.keys(o).forEach(key=>{
      const col = hdrMap[key.toUpperCase()];
      if (col !== undefined) newRow[col] = o[key];
    });
    keptRows.push(newRow);
    appended++;
  });

  const deleted = grid.length - (keptRows.length - appended);

  if (lastRow >= 2){
    sh.getRange(2,1,lastRow-1,lastCol).clearContent();
  }
  if (keptRows.length){
    sh.getRange(2,1,keptRows.length,lastCol).setValues(keptRows);
  }
  return {updated, appended, deleted: Math.max(0, deleted), total: keptRows.length};
}

function saveDB(req){
  if(!req.sheetId){
    logError('saveDB:missingSheetId', 'clientId='+req.clientId);
    return {success:false, message:'No database (sheetId) linked to this session.', error:'MISSING_SHEET_ID'};
  }
  const ss = SpreadsheetApp.openById(req.sheetId);
  const data = req.data || {};
  try{ _migrateClientSheet_(req.sheetId); }catch(e){ logError('saveDB:autoMigrate', 'sheetId='+req.sheetId+' | '+e.toString()); }

  if(!req.force){
    const shrink = _detectSuspiciousShrink_(ss, data);
    if(shrink){
      logError('saveDB:BLOCKED_SUSPICIOUS_SHRINK', 'sheetId='+req.sheetId+' '+shrink.detail);
      return {success:false, error:'SUSPICIOUS_SHRINK', message:shrink.message};
    }
  }

  const custSh = getOrCreateSheet_(ss, 'CUSTOMERS', H.CUSTOMERS);
  const custResult = bulkSyncRows_(custSh, 'ID', (data.customers||[]).filter(c=>c && c.id), c=>(
    { ID:c.id, NAME:c.name, MOBILE:c.mobile||'', DUE:c.due||0, CREDIT_LIMIT:c.limit||0, LAST_DATE:c.lastDate||'',
      ADDRESS:c.address||'', STATE:c.state||'', GSTIN:c.gstin||'' }
  ));

  const suppSh = getOrCreateSheet_(ss, 'SUPPLIERS', H.SUPPLIERS);
  const suppResult = bulkSyncRows_(suppSh, 'ID', (data.suppliers||[]).filter(s=>s && s.id), s=>(
    { SUPPLIER_ID:s.id, ID:s.id, NAME:s.name, MOBILE:s.mobile||'', DUE:s.due||0,
      ADDRESS:s.address||'', STATE:s.state||'', GSTIN:s.gstin||'' }
  ));

  const itemSh = getOrCreateSheet_(ss, 'ITEMS', H.ITEMS);
  const itemResult = bulkSyncRows_(itemSh, 'ID', (data.items||[]).filter(it=>it && it.id), it=>(
    { ID:it.id, NAME:it.name, UNIT:it.unit||'', HSN:it.hsn||'', PURCHASE_RATE:it.pRate||0,
      SALE_RATE:it.sRate||0, GST_PERCENT:it.gst||0, STOCK:it.stock||0, OPENING_STOCK:it.openingStock||0, MIN_STOCK:it.min||0,
      CATEGORY:it.category||'' }
  ));

  const purchSh = getOrCreateSheet_(ss, 'PURCHASES', H.PURCHASES);
  const purchResult = bulkSyncRows_(purchSh, 'PURCHASE_ID', (data.purchases||[]).filter(p=>p && p.id), p=>{
    const row = {
      PURCHASE_ID:p.id, SUPPLIER_ID:p.supp, DATE:p.date, TOTAL:p.total, MODE:p.mode,
      ITEMS_JSON: p.lineItems ? JSON.stringify(p.lineItems) : ''
    };
    if (p.invNo !== undefined && p.invNo !== '' && p.invNo !== null) row.INVOICE_NO = p.invNo;
    if (p.courierCharge !== undefined) row.COURIER_CHARGE = p.courierCharge;
    if (p.labourCharge !== undefined) row.LABOUR_CHARGE = p.labourCharge;
    if (p.suppName) row.SUPPLIER_NAME = p.suppName;
    return row;
  });

  const salesSh = getOrCreateSheet_(ss, 'SALES', H.SALES);
  const salesResult = bulkSyncRows_(salesSh, 'INVOICE_ID', (data.sales||[]).filter(s=>s && s.id), s=>{
    const row = {
      INVOICE_ID:s.id, CUSTOMER_ID:s.cust, DATE:s.date, TOTAL:s.total, MODE:s.mode,
      ITEMS_JSON: s.lineItems ? JSON.stringify(s.lineItems) : ''
    };
    if (s.invNo !== undefined && s.invNo !== '' && s.invNo !== null) row.INVOICE_NO = s.invNo;
    if (s.courierCharge !== undefined) row.COURIER_CHARGE = s.courierCharge;
    if (s.labourCharge !== undefined) row.LABOUR_CHARGE = s.labourCharge;
    if (s.custName) row.CUSTOMER_NAME = s.custName;
    if (s.salesperson) row.SALESPERSON = s.salesperson;
    return row;
  });

  const metaSh = getOrCreateSheet_(ss, 'META', H.META);
  if (metaSh.getLastRow() < 2) {
    metaSh.appendRow(['META', data.cash || 0, data.bank || 0, new Date()]);
  } else {
    const newCash = data.cash !== undefined ? data.cash : 0;
    const newBank = data.bank !== undefined ? data.bank : 0;
    metaSh.getRange(2, 1, 1, 4).setValues([['META', newCash, newBank, new Date()]]);
  }

  if (data.bankAccounts && data.bankAccounts.length){
    const bankAcctSh = getOrCreateSheet_(ss, 'BANK_ACCOUNTS', H.BANK_ACCOUNTS);
    bulkUpsertRows_(bankAcctSh, 'ID', data.bankAccounts.filter(b=>b && b.id), b=>(
      { ID:b.id, NAME:b.name||'', BALANCE:b.balance||0 }
    ));
  }
  if (data.salespeople && data.salespeople.length){
    const spSh = getOrCreateSheet_(ss, 'SALESPEOPLE', H.SALESPEOPLE);
    bulkUpsertRows_(spSh, 'ID', data.salespeople.filter(sp=>sp && sp.id), sp=>(
      { ID:sp.id, NAME:sp.name||'' }
    ));
  }

  // ── EXPENSES / PAYMENTS_IN / PAYMENTS_OUT / CREDIT_NOTES / DEBIT_NOTES /
  // BANK_TXNS — true sync (add/update/DELETE), same pattern as the 5 core
  // tables above. These 6 tables were previously NEVER written by saveDB()
  // at all — loadDB() read them back from the sheet, but saving only ever
  // covered customers/suppliers/items/purchases/sales/meta/bankAccounts/
  // salespeople. Every edit or delete to an expense, a bank deposit/
  // withdrawal, a payment received/made, or a credit/debit note only ever
  // lived in the browser's memory; new entries "looked" synced only because
  // each has its own separate append-only create-time call (logRowToSheet/
  // LOG_PARTY), which never runs again on edit or delete. This is the fix
  // for "expense delete not actually deleted in the sheet" and "bank/cash
  // transactions need proper edit/delete".
  const expSh = getOrCreateSheet_(ss, 'EXPENSES', H.EXPENSES);
  const expResult = bulkSyncRows_(expSh, 'ID', (data.expenses||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, CATEGORY:x.category||'', AMOUNT:x.amount||0, NOTE:x.note||'', PENDING:!!x.pending, MODE:x.mode||'Cash', DATE:x.date||'' }
  ));

  const payInSh = getOrCreateSheet_(ss, 'PAYMENTS_IN', H.PAYMENTS_IN);
  const payInResult = bulkSyncRows_(payInSh, 'ID', (data.paymentsIn||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, CUST:x.cust||'', AMOUNT:x.amount||0, MODE:x.mode||'Cash', ACCT_ID:x.acctId||'', BILL_REF:x.billRef||'', TXN_REF:x.txnRef||'', DATE:x.date||'' }
  ));

  const payOutSh = getOrCreateSheet_(ss, 'PAYMENTS_OUT', H.PAYMENTS_OUT);
  const payOutResult = bulkSyncRows_(payOutSh, 'ID', (data.paymentsOut||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, SUPP:x.supp||'', AMOUNT:x.amount||0, MODE:x.mode||'Cash', ACCT_ID:x.acctId||'', BILL_REF:x.billRef||'', TXN_REF:x.txnRef||'', DATE:x.date||'' }
  ));

  const cnSh = getOrCreateSheet_(ss, 'CREDIT_NOTES', H.CREDIT_NOTES);
  const cnResult = bulkSyncRows_(cnSh, 'ID', (data.creditNotes||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, CUST:x.cust||'', BILL_REF:x.billRef||'', AMOUNT:x.amount||0, REASON:x.reason||'', LINE_ITEMS_JSON: x.lineItems ? JSON.stringify(x.lineItems) : '', DATE:x.date||'' }
  ));

  const dnSh = getOrCreateSheet_(ss, 'DEBIT_NOTES', H.DEBIT_NOTES);
  const dnResult = bulkSyncRows_(dnSh, 'ID', (data.debitNotes||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, SUPP:x.supp||'', BILL_REF:x.billRef||'', AMOUNT:x.amount||0, REASON:x.reason||'', LINE_ITEMS_JSON: x.lineItems ? JSON.stringify(x.lineItems) : '', DATE:x.date||'' }
  ));

  const bankTxnSh = getOrCreateSheet_(ss, 'BANK_TXNS', H.BANK_TXNS);
  const bankTxnResult = bulkSyncRows_(bankTxnSh, 'ID', (data.bankTxns||[]).filter(x=>x && x.id), x=>(
    { ID:x.id, TYPE:x.type||'', AMOUNT:x.amount||0, DETAIL:x.detail||'', CATEGORY:x.category||'', DATE:x.date||'' }
  ));

  const totalDeleted = custResult.deleted + suppResult.deleted + itemResult.deleted + purchResult.deleted + salesResult.deleted
    + expResult.deleted + payInResult.deleted + payOutResult.deleted + cnResult.deleted + dnResult.deleted + bankTxnResult.deleted;
  if (totalDeleted > 0){
    logAuditEntry(req.sheetId, 'SYNC_SAVE_DELETE', 'MULTI', 'SUITE_SAVE_DB',
      `customers-${custResult.deleted} suppliers-${suppResult.deleted} items-${itemResult.deleted} purchases-${purchResult.deleted} sales-${salesResult.deleted} expenses-${expResult.deleted} paymentsIn-${payInResult.deleted} paymentsOut-${payOutResult.deleted} creditNotes-${cnResult.deleted} debitNotes-${dnResult.deleted} bankTxns-${bankTxnResult.deleted} removed on sync`, 'SUCCESS');
  }

  let lastSynced;
  try{ lastSynced = DriveApp.getFileById(req.sheetId).getLastUpdated().getTime(); }
  catch(e){ lastSynced = Date.now(); }

  return {success:true, lastSynced, synced:{
    customers:custResult, suppliers:suppResult, items:itemResult, purchases:purchResult, sales:salesResult,
    expenses:expResult, paymentsIn:payInResult, paymentsOut:payOutResult, creditNotes:cnResult, debitNotes:dnResult, bankTxns:bankTxnResult
  }};
}

// ════════════════════════════════════════════════════════════════════════════════
// DELETE HANDLERS — single-record deletes with audit trail
// ════════════════════════════════════════════════════════════════════════════════

function _deleteById_(sheetId, tabName, idHeader, idVal, actionName, extraDetail){
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return {success:false, message:tabName+' tab not found'};

  const hdrMap = getHeaderIndexMap_(sh);
  const idIdx = hdrMap[idHeader.toUpperCase()];
  if (idIdx === undefined) return {success:false, message:idHeader+' column not found'};

  if (sh.getLastRow() < 2) return {success:false, message:'Record not found'};
  const rows = sh.getRange(2, 1, sh.getLastRow()-1, sh.getLastColumn()).getValues();
  for (let i=0;i<rows.length;i++){
    if (String(rows[i][idIdx]) === String(idVal)){
      sh.deleteRow(i+2);
      logAuditEntry(sheetId, actionName, tabName, idVal, extraDetail||'Deleted by user', 'SUCCESS');
      return {success:true, message:tabName+' record '+idVal+' deleted successfully'};
    }
  }
  return {success:false, message:'Record not found'};
}

function deleteSaleRecord(req){
  if(!req.sheetId || !req.saleId) return {success:false, message:'sheetId and saleId required'};
  try{
    return _deleteById_(req.sheetId, 'SALES', 'INVOICE_ID', req.saleId, 'DELETE_SALE',
      'Total: '+req.total+' | Customer: '+req.custName);
  }catch(e){
    logError('deleteSaleRecord', 'sheetId='+req.sheetId+' saleId='+req.saleId+' | '+e.toString());
    return {success:false, message:'Error deleting sale: '+e.message};
  }
}

function deletePurchaseRecord(req){
  if(!req.sheetId || !req.purchaseId) return {success:false, message:'sheetId and purchaseId required'};
  try{
    return _deleteById_(req.sheetId, 'PURCHASES', 'PURCHASE_ID', req.purchaseId, 'DELETE_PURCHASE',
      'Total: '+req.total+' | Supplier: '+req.suppName);
  }catch(e){
    logError('deletePurchaseRecord', 'sheetId='+req.sheetId+' purchaseId='+req.purchaseId+' | '+e.toString());
    return {success:false, message:'Error deleting purchase: '+e.message};
  }
}

function deleteCustomerRecord(req){
  if(!req.sheetId || !req.customerId) return {success:false, message:'sheetId and customerId required'};
  try{
    return _deleteById_(req.sheetId, 'CUSTOMERS', 'ID', req.customerId, 'DELETE_CUSTOMER', 'Name: '+(req.name||''));
  }catch(e){
    logError('deleteCustomerRecord', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:'Error deleting customer: '+e.message};
  }
}

function deleteSupplierRecord(req){
  if(!req.sheetId || !req.supplierId) return {success:false, message:'sheetId and supplierId required'};
  try{
    return _deleteById_(req.sheetId, 'SUPPLIERS', 'ID', req.supplierId, 'DELETE_SUPPLIER', 'Name: '+(req.name||''));
  }catch(e){
    logError('deleteSupplierRecord', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:'Error deleting supplier: '+e.message};
  }
}

function deleteItemRecord(req){
  if(!req.sheetId || !req.itemId) return {success:false, message:'sheetId and itemId required'};
  try{
    return _deleteById_(req.sheetId, 'ITEMS', 'ID', req.itemId, 'DELETE_ITEM', 'Name: '+(req.name||''));
  }catch(e){
    logError('deleteItemRecord', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:'Error deleting item: '+e.message};
  }
}

// Immediate single-record deletes for the 6 tables saveDB() now true-syncs
// (see above). Not strictly required since the next full save already
// removes anything missing from the incoming array — but gives instant
// server confirmation instead of waiting on the next periodic save.
function deleteExpenseRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'EXPENSES', 'ID', req.id, 'DELETE_EXPENSE', 'Category: '+(req.category||'')); }
  catch(e){ logError('deleteExpenseRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}
function deleteBankTxnRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'BANK_TXNS', 'ID', req.id, 'DELETE_BANK_TXN', 'Type: '+(req.type||'')); }
  catch(e){ logError('deleteBankTxnRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}
function deletePaymentInRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'PAYMENTS_IN', 'ID', req.id, 'DELETE_PAYMENT_IN', 'Cust: '+(req.cust||'')); }
  catch(e){ logError('deletePaymentInRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}
function deletePaymentOutRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'PAYMENTS_OUT', 'ID', req.id, 'DELETE_PAYMENT_OUT', 'Supp: '+(req.supp||'')); }
  catch(e){ logError('deletePaymentOutRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}
function deleteCreditNoteRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'CREDIT_NOTES', 'ID', req.id, 'DELETE_CREDIT_NOTE', 'Cust: '+(req.cust||'')); }
  catch(e){ logError('deleteCreditNoteRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}
function deleteDebitNoteRecordById(req){
  if(!req.sheetId || !req.id) return {success:false, message:'sheetId and id required'};
  try{ return _deleteById_(req.sheetId, 'DEBIT_NOTES', 'ID', req.id, 'DELETE_DEBIT_NOTE', 'Supp: '+(req.supp||'')); }
  catch(e){ logError('deleteDebitNoteRecordById', 'sheetId='+req.sheetId+' | '+e.toString()); return {success:false, message:e.message}; }
}

// ════════════════════════════════════════════════════════════════════════════════
// INVOICE SERIES MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

function getNextInvoiceNumber(req){
  if(!req.sheetId || !req.type) return {success:false, message:'sheetId and type required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const invSh = getOrCreateSheet_(ss, 'INVOICE_SERIES', H.INVOICE_SERIES);
    if (invSh.getLastRow() < 2){
      invSh.appendRow(['SALES', 1, '', new Date()]);
      invSh.appendRow(['PURCHASE', 1, '', new Date()]);
    }

    const data = invSh.getDataRange().getValues();
    const hdr = data[0];
    const typeIdx = hdr.indexOf('SERIES_TYPE');
    const nextIdx = hdr.indexOf('NEXT_NUMBER');
    if (typeIdx === -1 || nextIdx === -1) return {success:false, message:'Invalid invoice series schema'};

    for(let i = 1; i < data.length; i++){
      if (String(data[i][typeIdx]).toUpperCase() === String(req.type).toUpperCase()){
        const nextNum = Number(data[i][nextIdx]) || 1;
        return {success:true, nextNumber:nextNum, type:req.type};
      }
    }
    invSh.appendRow([String(req.type).toUpperCase(), 1, '', new Date()]);
    return {success:true, nextNumber:1, type:req.type};
  }catch(e){
    logError('getNextInvoiceNumber', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function registerInvoiceNumber(req){
  if(!req.sheetId || !req.type || !req.invoiceNo) return {success:false, message:'sheetId, type, and invoiceNo required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const invSh = getOrCreateSheet_(ss, 'INVOICE_SERIES', H.INVOICE_SERIES);

    const data = invSh.getDataRange().getValues();
    const hdr = data[0];
    const typeIdx = hdr.indexOf('SERIES_TYPE');
    const nextIdx = hdr.indexOf('NEXT_NUMBER');
    const lastIdx = hdr.indexOf('LAST_ISSUED');
    const updIdx = hdr.indexOf('UPDATED_AT');
    if (typeIdx === -1 || nextIdx === -1) return {success:false, message:'Invalid invoice series schema'};

    for(let i = 1; i < data.length; i++){
      if (String(data[i][typeIdx]).toUpperCase() === String(req.type).toUpperCase()){
        const currentNext = Number((String(req.invoiceNo).match(/\d+$/)||[])[0]) || 1;
        const newNext = Math.max(currentNext + 1, Number(data[i][nextIdx]||1) + 1);

        invSh.getRange(i+1, nextIdx+1).setValue(newNext);
        if (lastIdx !== -1) invSh.getRange(i+1, lastIdx+1).setValue(req.invoiceNo);
        if (updIdx !== -1) invSh.getRange(i+1, updIdx+1).setValue(new Date());

        logAuditEntry(req.sheetId, 'REGISTER_INVOICE', 'INVOICE_SERIES', req.type,
          'Registered invoice '+req.invoiceNo+' | Next: '+newNext, 'SUCCESS');

        return {success:true, invoiceNo:req.invoiceNo, nextNumber:newNext};
      }
    }

    invSh.appendRow([String(req.type).toUpperCase(), 2, req.invoiceNo, new Date()]);
    return {success:true, invoiceNo:req.invoiceNo, nextNumber:2};
  }catch(e){
    logError('registerInvoiceNumber', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// STATE/SETTING/ITEM CHANGE TRACKING
// ════════════════════════════════════════════════════════════════════════════════

function syncItemChange(req){
  if(!req.sheetId || !req.itemId) return {success:false, message:'sheetId and itemId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);

    const itemSh = getOrCreateSheet_(ss, 'ITEMS', H.ITEMS);
    upsertRowBatched_(itemSh, req.itemId, {
      ID: req.itemId, NAME: req.name || '', UNIT: req.unit || '', HSN: req.hsn || '',
      PURCHASE_RATE: req.pRate || 0, SALE_RATE: req.sRate || 0, GST_PERCENT: req.gst || 0,
      STOCK: req.stock || 0, OPENING_STOCK: req.openingStock || 0, MIN_STOCK: req.min || 0,
      CATEGORY: req.category || ''
    });

    const regSh = getOrCreateSheet_(ss, 'ITEM_REGISTRY', H.ITEM_REGISTRY);
    upsertRowBatched_(regSh, req.itemId, {
      ITEM_ID: req.itemId, NAME: req.name || '', STATUS: req.status || 'ACTIVE',
      ADDED_AT: req.addedAt || new Date().toISOString(), LAST_MODIFIED: new Date().toISOString(),
      CATEGORY: req.category || '', MODIFICATION_REASON: req.reason || 'Updated'
    });

    logAuditEntry(req.sheetId, 'SYNC_ITEM_CHANGE', 'ITEMS', req.itemId,
      'Item updated: '+req.name+' | Reason: '+(req.reason||'User edit'), 'SUCCESS');

    return {success:true, message:'Item '+req.itemId+' synced', itemId:req.itemId};
  }catch(e){
    logError('syncItemChange', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function syncSettingChange(req){
  if(!req.sheetId || !req.setting) return {success:false, message:'sheetId and setting required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const setSh = getOrCreateSheet_(ss, 'SETTINGS', H.SETTINGS);

    upsertRowBatched_(setSh, req.setting, {
      ID: req.setting, SETTINGS_JSON: req.value ? JSON.stringify(req.value) : '', UPDATED_AT: new Date()
    });

    if (req.allSettings){
      upsertRowBatched_(setSh, 'SETTINGS', {
        ID: 'SETTINGS', SETTINGS_JSON: JSON.stringify(req.allSettings), UPDATED_AT: new Date()
      });
    }

    logAuditEntry(req.sheetId, 'SYNC_SETTING_CHANGE', 'SETTINGS', req.setting,
      'Setting '+req.setting+' updated | Reason: '+(req.reason||'User edit'), 'SUCCESS');

    return {success:true, message:'Setting '+req.setting+' synced', setting:req.setting};
  }catch(e){
    logError('syncSettingChange', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SHRINK PROTECTION
// ════════════════════════════════════════════════════════════════════════════════

function _detectSuspiciousShrink_(ss, data){
  const MIN_EXISTING = 5;
  const SHRINK_TOLERANCE = 2;
  const tables = [
    {key:'purchases', tab:'PURCHASES'},
    {key:'sales', tab:'SALES'},
    {key:'customers', tab:'CUSTOMERS'},
    {key:'suppliers', tab:'SUPPLIERS'},
    {key:'items', tab:'ITEMS'}
  ];
  for(let i=0;i<tables.length;i++){
    const t = tables[i];
    const sh = ss.getSheetByName(t.tab);
    const existing = sh ? Math.max(0, sh.getLastRow()-1) : 0;
    const incoming = (data[t.key]||[]).length;
    if(existing >= MIN_EXISTING && incoming < existing - SHRINK_TOLERANCE){
      return {
        message: 'This save would erase '+(existing-incoming)+' of your '+existing+' existing '+t.key+' — refused to protect your data. If this is genuinely intentional (e.g. you deleted several records or ran Reset Data), use Force Save to override.',
        detail: 'table='+t.tab+' existing='+existing+' incoming='+incoming
      };
    }
  }
  return null;
}

function syncSaleRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'SALES', H.SALES);
  const rowObj = {
    INVOICE_ID: req.id, CUSTOMER_ID: req.cust, DATE: req.date, TOTAL: req.total, MODE: req.mode,
    ITEMS_JSON: req.lineItems ? JSON.stringify(req.lineItems) : ''
  };
  if (req.invNo !== undefined && req.invNo !== '' && req.invNo !== null) rowObj.INVOICE_NO = req.invNo;
  if (req.courierCharge !== undefined) rowObj.COURIER_CHARGE = req.courierCharge;
  if (req.labourCharge !== undefined) rowObj.LABOUR_CHARGE = req.labourCharge;
  if (req.custName) rowObj.CUSTOMER_NAME = req.custName;
  if (req.salesperson) rowObj.SALESPERSON = req.salesperson;

  upsertRowBatched_(sh, req.id, rowObj);
  return {success:true};
}

function syncPurchaseRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'PURCHASES', H.PURCHASES);
  const rowObj = {
    PURCHASE_ID: req.id, SUPPLIER_ID: req.supp, DATE: req.date, TOTAL: req.total, MODE: req.mode,
    ITEMS_JSON: req.lineItems ? JSON.stringify(req.lineItems) : ''
  };
  if (req.suppName) rowObj.SUPPLIER_NAME = req.suppName;
  if (req.invNo !== undefined && req.invNo !== '') rowObj.INVOICE_NO = req.invNo;
  if (req.courierCharge !== undefined) rowObj.COURIER_CHARGE = req.courierCharge;
  if (req.labourCharge !== undefined) rowObj.LABOUR_CHARGE = req.labourCharge;

  upsertRowBatched_(sh, req.id, rowObj);
  return {success:true};
}

function syncCustomerRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'CUSTOMERS', H.CUSTOMERS);
  upsertRowBatched_(sh, req.id, {
    ID: req.id, NAME: req.name, MOBILE: req.mobile||'', DUE: req.due||0, CREDIT_LIMIT: req.limit||0, LAST_DATE: req.lastDate||'',
    ADDRESS: req.address||'', STATE: req.state||'', GSTIN: req.gstin||''
  });
  return {success:true};
}

function syncSupplierRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'SUPPLIERS', H.SUPPLIERS);
  upsertRowBatched_(sh, req.id, {
    SUPPLIER_ID: req.id, ID: req.id, NAME: req.name, MOBILE: req.mobile||'', DUE: req.due||0,
    ADDRESS: req.address||'', STATE: req.state||'', GSTIN: req.gstin||''
  });
  return {success:true};
}

function syncItemRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'ITEMS', H.ITEMS);
  upsertRowBatched_(sh, req.id, {
    ID:req.id, NAME:req.name, UNIT:req.unit||'', HSN:req.hsn||'', PURCHASE_RATE:req.pRate||0,
    SALE_RATE:req.sRate||0, GST_PERCENT:req.gst||0, STOCK:req.stock||0, OPENING_STOCK:req.openingStock||0, MIN_STOCK:req.min||0,
    CATEGORY:req.category||''
  });
  return {success:true};
}

function syncBankAccountRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = getOrCreateSheet_(ss, 'BANK_ACCOUNTS', H.BANK_ACCOUNTS);
  upsertRowBatched_(sh, req.id, { ID: req.id, NAME: req.name||'', BALANCE: req.balance||0 });
  return {success:true};
}

function logPartyRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName(req.tab);
  if(!sh){
    sh = ss.insertSheet(req.tab);
    if(req.headers && req.headers.length) sh.appendRow(req.headers);
  } else if (sh.getLastRow()===0 && req.headers && req.headers.length){
    sh.appendRow(req.headers);
  }
  if (req.isNew){
    if (req.headers && req.headers.length && req.row && req.row.length === req.headers.length){
      req.headers.forEach(h => getOrAddColumn_(sh, h));
      const hdrMap = getHeaderIndexMap_(sh);
      const lastCol = sh.getLastColumn();
      const rowArr = new Array(lastCol).fill('');
      req.headers.forEach((h, i) => {
        const col = hdrMap[String(h).toUpperCase()];
        if (col !== undefined) rowArr[col] = req.row[i];
      });
      sh.appendRow(rowArr);
    } else {
      sh.appendRow(req.row);
    }
  }
  return {success:true};
}

// ════════════════════════════════════════════════════════════════════════════════
// MONTHWISE REPORTS
// ════════════════════════════════════════════════════════════════════════════════

function generateMonthwisePurchase(req){
  const data = req.data || {};
  const purchases = data.purchases || [];
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });

  const byMonth = {};
  purchases.forEach(p => {
    const dateStr = String(p.date || '');
    const monthKey = dateStr.substring(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, count: 0, total: 0, invoices: [] };
    byMonth[monthKey].count++;
    byMonth[monthKey].total += (p.total || 0);
    byMonth[monthKey].invoices.push({
      id: p.id, date: p.date, supplier: suppById[p.supp] ? suppById[p.supp].name : p.supp,
      total: p.total, mode: p.mode
    });
  });

  const report = Object.keys(byMonth).sort().map(k => byMonth[k]);
  const totalAmount = purchases.reduce((a,p)=>a+(p.total||0),0);

  return {success:true, report, totalAmount, totalCount: purchases.length};
}

function generateMonthwiseSales(req){
  const data = req.data || {};
  const sales = data.sales || [];
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });

  const byMonth = {};
  sales.forEach(s => {
    const dateStr = String(s.date || '');
    const monthKey = dateStr.substring(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { month: monthKey, count: 0, total: 0, invoices: [] };
    byMonth[monthKey].count++;
    byMonth[monthKey].total += (s.total || 0);
    byMonth[monthKey].invoices.push({
      id: s.id, date: s.date, customer: custById[s.cust] ? custById[s.cust].name : s.cust,
      total: s.total, mode: s.mode
    });
  });

  const report = Object.keys(byMonth).sort().map(k => byMonth[k]);
  const totalAmount = sales.reduce((a,s)=>a+(s.total||0),0);

  return {success:true, report, totalAmount, totalCount: sales.length};
}

// ════════════════════════════════════════════════════════════════════════════════
// ITEMWISE REPORTS
// ════════════════════════════════════════════════════════════════════════════════

function generateItemWisePurchase(req){
  const data = req.data || {};
  const purchases = data.purchases || [];
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
  const byItem = {};
  purchases.forEach(p => {
    (p.lineItems || []).forEach(li => {
      if(!byItem[li.id]) byItem[li.id] = { itemId: li.id, itemName: itemsById[li.id] ? itemsById[li.id].name : li.id, transactions: [] };
      byItem[li.id].transactions.push({ date: p.date, billNo: p.id, supplier: suppById[p.supp] ? suppById[p.supp].name : p.supp, qty: li.qty, rate: li.rate });
    });
  });
  const report = Object.values(byItem).map(item => ({
    ...item, totalQty: item.transactions.reduce((a,t)=>a+t.qty, 0),
    totalAmount: item.transactions.reduce((a,t)=>a+(t.qty*t.rate),0)
  }));
  return {success:true, report};
}

function generateItemWiseSales(req){
  const data = req.data || {};
  const sales = data.sales || [];
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });
  const byItem = {};
  sales.forEach(s => {
    (s.lineItems || []).forEach(li => {
      if(!byItem[li.id]) byItem[li.id] = { itemId: li.id, itemName: itemsById[li.id] ? itemsById[li.id].name : li.id, transactions: [] };
      byItem[li.id].transactions.push({ date: s.date, billNo: s.id, customer: custById[s.cust] ? custById[s.cust].name : s.cust, qty: li.qty, rate: li.rate });
    });
  });
  const report = Object.values(byItem).map(item => ({
    ...item, totalQty: item.transactions.reduce((a,t)=>a+t.qty, 0),
    totalAmount: item.transactions.reduce((a,t)=>a+(t.qty*t.rate),0)
  }));
  return {success:true, report};
}

// ════════════════════════════════════════════════════════════════════════════════
// OTHER REPORTS
// ════════════════════════════════════════════════════════════════════════════════

function generatePurchaseLedger(req){
  const data = req.data || {};
  const purchases = data.purchases || [];
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
  const ledger = purchases.map(p => ({
    date: p.date, billNo: p.id, supplier: suppById[p.supp] ? suppById[p.supp].name : p.supp,
    total: p.total, mode: p.mode
  })).sort((a,b)=> new Date(a.date) - new Date(b.date));
  return {success:true, ledger, total:purchases.reduce((a,p)=>a+(p.total||0),0), count:purchases.length};
}

function generateSalesLedger(req){
  const data = req.data || {};
  const sales = data.sales || [];
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });
  const ledger = sales.map(s => ({
    date: s.date, billNo: s.id, customer: custById[s.cust] ? custById[s.cust].name : s.cust,
    total: s.total, mode: s.mode
  })).sort((a,b)=> new Date(a.date) - new Date(b.date));
  return {success:true, ledger, total:sales.reduce((a,s)=>a+(s.total||0),0), count:sales.length};
}

function generateStockLedger(req){
  const data = req.data || {};
  const all = [...(data.purchases||[]), ...(data.sales||[])];
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });
  const byItem = {};
  all.forEach(t => {
    const isP = t.supp !== undefined;
    (t.lineItems || []).forEach(li => {
      if(!byItem[li.id]) byItem[li.id] = { itemId: li.id, itemName: itemsById[li.id] ? itemsById[li.id].name : li.id, openingStock: itemsById[li.id] ? (itemsById[li.id].openingStock||0) : 0, movements: [] };
      byItem[li.id].movements.push({
        date: t.date, type: isP ? 'Purchase' : 'Sale', billNo: t.id,
        party: isP ? (suppById[t.supp] ? suppById[t.supp].name : t.supp) : (custById[t.cust] ? custById[t.cust].name : t.cust),
        qty: isP ? li.qty : -li.qty, rate: li.rate
      });
    });
  });
  const report = Object.values(byItem).map(item => {
    let balance = item.openingStock||0;
    const movements = item.movements.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(m => { balance += m.qty; return {...m, balance}; });
    return { ...item, movements, closingStock: balance };
  });
  return {success:true, report};
}

function generateStockSummary(req){
  const data = req.data || {};
  const summary = (data.items || []).map(it => ({
    itemId: it.id, itemName: it.name, unit: it.unit, currentStock: it.stock, minLevel: it.min,
    stockValue: (it.stock||0) * (it.pRate||0),
    status: it.stock <= it.min ? 'LOW' : it.stock === 0 ? 'OUT' : 'OK'
  })).filter(s => s.itemId);
  const lowStock = summary.filter(s => s.status !== 'OK');
  const totalStockValue = summary.reduce((a,s)=>a + s.stockValue, 0);
  return {success:true, summary, lowStock, totalItems:summary.length, lowStockCount:lowStock.length, totalStockValue};
}

function generateBalanceSheet(req){
  const data = req.data || {};
  let totalAssets = 0, totalLiabilities = 0;
  let totalCash = data.cash || 0;
  let totalBank = data.bank || 0;
  let totalStock = (data.items || []).reduce((a,it)=>a+(it.stock*(it.pRate||0)), 0);
  let totalRecievables = 0, totalPayables = 0;

  (data.customers || []).forEach(c=>{ totalRecievables += (c.due || 0); });
  (data.suppliers || []).forEach(s=>{ totalPayables += (s.due || 0); });

  totalAssets = totalCash + totalBank + totalStock + totalRecievables;
  totalLiabilities = totalPayables;

  return {
    success:true,
    assets: {
      cash: totalCash, bank: totalBank, inventory: totalStock,
      receivables: totalRecievables, totalAssets
    },
    liabilities: {
      payables: totalPayables, totalLiabilities
    },
    equity: { totalEquity: totalAssets - totalLiabilities }
  };
}

function generatePLStatement(req){
  const data = req.data || {};
  const purchases = data.purchases || [];
  const sales = data.sales || [];

  let totalSalesValue = sales.reduce((a,s)=>a+(s.total||0), 0);
  let totalCOGS = purchases.reduce((a,p)=>a+(p.total||0), 0);
  let grossProfit = totalSalesValue - totalCOGS;
  let netProfit = grossProfit;

  return {
    success:true,
    revenue: totalSalesValue,
    cogs: totalCOGS,
    grossProfit: grossProfit,
    expenses: 0,
    netProfit: netProfit,
    profitMargin: totalSalesValue > 0 ? ((netProfit / totalSalesValue) * 100).toFixed(2) : 0
  };
}

function generateCashFlow(req){
  const data = req.data || {};
  const purchases = data.purchases || [];
  const sales = data.sales || [];

  let cashInflow = sales.filter(s=>s.mode==='Cash').reduce((a,s)=>a+(s.total||0), 0);
  let cashOutflow = purchases.filter(p=>p.mode==='Cash').reduce((a,p)=>a+(p.total||0), 0);
  let netCashFlow = cashInflow - cashOutflow;

  return {
    success:true,
    inflow: cashInflow,
    outflow: cashOutflow,
    netFlow: netCashFlow,
    closingCash: (data.cash || 0) + netCashFlow
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ENTRY PROCESSING
// ════════════════════════════════════════════════════════════════════════════════

function processSalesEntry(req){
  if(!req.sheetId) return {success:false, message:'sheetId required', error:'MISSING_SHEET_ID'};
  if(!req.billData) return {success:false, message:'billData required', error:'MISSING_BILLDATA'};

  const bill = req.billData;

  try {
    syncSaleRow({
      sheetId: req.sheetId,
      id: bill.id || ('INV-' + Date.now()),
      cust: bill.customerId,
      custName: bill.customerName,
      date: bill.date || new Date().toISOString().split('T')[0],
      total: bill.grandTotal || 0,
      mode: bill.paymentMode || 'Cash',
      lineItems: bill.items || [],
      invNo: bill.invoiceNo,
      courierCharge: bill.courierCharge || 0,
      labourCharge: bill.labourCharge || 0
    });

    return {
      success: true,
      message: 'Sale processed successfully',
      billId: bill.id || 'AUTO',
      updatedTabs: ['SALES', 'CUSTOMERS', 'META']
    };
  } catch(err) {
    logError('processSalesEntry', 'sheetId=' + req.sheetId + ' | ' + err.toString());
    return {
      success: false,
      message: 'Error processing sale: ' + err.message,
      error: err.toString()
    };
  }
}

function processPurchaseEntry(req){
  if(!req.sheetId) return {success:false, message:'sheetId required', error:'MISSING_SHEET_ID'};
  if(!req.billData) return {success:false, message:'billData required', error:'MISSING_BILLDATA'};

  const bill = req.billData;

  try {
    syncPurchaseRow({
      sheetId: req.sheetId,
      id: bill.id || ('PUR-' + Date.now()),
      supp: bill.supplierId,
      suppName: bill.supplierName,
      date: bill.date || new Date().toISOString().split('T')[0],
      total: bill.grandTotal || 0,
      mode: bill.paymentMode || 'Cash',
      lineItems: bill.items || [],
      invNo: bill.invoiceNo,
      courierCharge: bill.courierCharge || 0,
      labourCharge: bill.labourCharge || 0
    });

    return {
      success: true,
      message: 'Purchase processed successfully',
      billId: bill.id || 'AUTO',
      updatedTabs: ['PURCHASES', 'SUPPLIERS', 'META']
    };
  } catch(err) {
    logError('processPurchaseEntry', 'sheetId=' + req.sheetId + ' | ' + err.toString());
    return {
      success: false,
      message: 'Error processing purchase: ' + err.message,
      error: err.toString()
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION
// ════════════════════════════════════════════════════════════════════════════════

function _dedupeVoucherTab_(sh, idCol, partyCol, nameCol, invCol, totalCol){
  if (!sh || sh.getLastRow() < 2) return {before:0, after:0, removed:0};
  const hdrMap = getHeaderIndexMap_(sh);
  const lastCol = sh.getLastColumn();
  const rows = sh.getRange(2,1,sh.getLastRow()-1,lastCol).getValues();
  const before = rows.length;
  const dateIdx = hdrMap['DATE'], partyIdx = hdrMap[partyCol], nameIdx = hdrMap[nameCol], invIdx = hdrMap[invCol], totalIdx = hdrMap[totalCol];
  const seen = {};
  const keep = [];
  rows.forEach(r=>{
    const date = r[dateIdx] instanceof Date ? Utilities.formatDate(r[dateIdx], Session.getScriptTimeZone(),'yyyy-MM-dd') : String(r[dateIdx]||'');
    const name = nameIdx!==undefined ? String(r[nameIdx]||'').trim().toLowerCase() : '';
    const party = name || String(r[partyIdx]||'').trim();
    const inv = invIdx!==undefined ? String(r[invIdx]||'').trim() : '';
    const total = totalIdx!==undefined ? (Math.round((Number(r[totalIdx])||0)*100)/100) : 0;
    const key = inv ? ('I|'+date+'|'+party+'|'+inv) : ('T|'+date+'|'+party+'|'+total);
    if (seen[key]) return;
    seen[key] = true;
    keep.push(r);
  });
  const removed = before - keep.length;
  if (removed > 0){
    sh.getRange(2,1,before,lastCol).clearContent();
    if (keep.length) sh.getRange(2,1,keep.length,lastCol).setValues(keep);
  }
  return {before, after: keep.length, removed};
}

function _relinkOrphanParties_(ss, voucherTab, idCol, nameCol, partyTab, partyIdCol){
  const vSh = ss.getSheetByName(voucherTab);
  const pSh = ss.getSheetByName(partyTab);
  if (!vSh || !pSh || vSh.getLastRow() < 2) return 0;
  const vHdr = getHeaderIndexMap_(vSh);
  if (vHdr[idCol] === undefined) return 0;
  const vRows = vSh.getRange(2,1,vSh.getLastRow()-1, vSh.getLastColumn()).getValues();

  const pHdr = getHeaderIndexMap_(pSh);
  const pIdIdx = pHdr[partyIdCol];
  const existingIds = {};
  if (pIdIdx !== undefined && pSh.getLastRow() >= 2){
    pSh.getRange(2, pIdIdx+1, pSh.getLastRow()-1, 1).getValues().forEach(r=>{
      const id = r[0]; if (id !== undefined && id !== '') existingIds[String(id)] = true;
    });
  }

  const toCreate = {};
  vRows.forEach(r=>{
    const id = r[vHdr[idCol]];
    const name = vHdr[nameCol]!==undefined ? r[vHdr[nameCol]] : '';
    if (id !== undefined && id !== '' && !existingIds[String(id)] && name){
      toCreate[String(id)] = String(name);
    }
  });

  const ids = Object.keys(toCreate);
  if (!ids.length) return 0;
  ids.forEach(id=>{
    if (partyTab === 'SUPPLIERS'){
      appendRowFast_(pSh, {SUPPLIER_ID:id, ID:id, NAME:toCreate[id], MOBILE:'', DUE:0});
    } else {
      appendRowFast_(pSh, {ID:id, NAME:toCreate[id], MOBILE:'', DUE:0, CREDIT_LIMIT:0, LAST_DATE:''});
    }
  });
  return ids.length;
}

function dedupeAndRelink(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const purchSh = ss.getSheetByName('PURCHASES');
    const salesSh = ss.getSheetByName('SALES');

    const purchDedupe = _dedupeVoucherTab_(purchSh, 'PURCHASE_ID', 'SUPPLIER_ID', 'SUPPLIER_NAME', 'INVOICE_NO', 'TOTAL');
    const salesDedupe = _dedupeVoucherTab_(salesSh, 'INVOICE_ID', 'CUSTOMER_ID', 'CUSTOMER_NAME', 'INVOICE_NO', 'TOTAL');

    const suppliersCreated = _relinkOrphanParties_(ss, 'PURCHASES', 'SUPPLIER_ID', 'SUPPLIER_NAME', 'SUPPLIERS', 'SUPPLIER_ID');
    const customersCreated = _relinkOrphanParties_(ss, 'SALES', 'CUSTOMER_ID', 'CUSTOMER_NAME', 'CUSTOMERS', 'ID');

    logError('DATA_REPAIR:dedupeAndRelink', 'sheetId='+req.sheetId+' purchRemoved='+purchDedupe.removed+' salesRemoved='+salesDedupe.removed+' suppliersCreated='+suppliersCreated+' customersCreated='+customersCreated);

    return {
      success:true,
      duplicatesRemoved: purchDedupe.removed + salesDedupe.removed,
      purchasesBefore: purchDedupe.before, purchasesAfter: purchDedupe.after,
      salesBefore: salesDedupe.before, salesAfter: salesDedupe.after,
      suppliersCreated, customersCreated
    };
  }catch(e){
    logError('dedupeAndRelink', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// RECONCILE
// ════════════════════════════════════════════════════════════════════════════════

function _RECONCILE_TABS(){
  return [
    {key:'customers', tab:'CUSTOMERS', idCol:'ID', prefix:'CUST', totalCol:null},
    {key:'suppliers', tab:'SUPPLIERS', idCol:'ID', prefix:'SUPP', totalCol:null},
    {key:'items',     tab:'ITEMS', idCol:'ID', prefix:'ITEM', totalCol:null},
    {key:'purchases', tab:'PURCHASES', idCol:'PURCHASE_ID', prefix:'PUR', totalCol:'TOTAL'},
    {key:'sales',     tab:'SALES', idCol:'INVOICE_ID', prefix:'INV', totalCol:'TOTAL'}
  ];
}

function _reconcileStats(ss){
  const valid = {}, raw = {}, gaps = {};
  _RECONCILE_TABS().forEach(cfg=>{
    const sh = ss.getSheetByName(cfg.tab);
    valid[cfg.key] = 0; raw[cfg.key] = 0; gaps[cfg.key] = 0;
    if (cfg.totalCol){ valid[cfg.key+'Total'] = 0; raw[cfg.key+'Total'] = 0; }
    if (!sh || sh.getLastRow() < 2) return;
    const hdrMap = getHeaderIndexMap_(sh);
    const idIdx = hdrMap[cfg.idCol];
    const totalIdx = cfg.totalCol ? hdrMap[cfg.totalCol] : undefined;
    const rows = sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues();
    rows.forEach(r=>{
      const id = idIdx!==undefined ? r[idIdx] : '';
      const total = totalIdx!==undefined ? (Number(r[totalIdx])||0) : 0;
      raw[cfg.key]++;
      if (cfg.totalCol) raw[cfg.key+'Total'] += total;
      if (id !== undefined && id !== '' && id !== null){
        valid[cfg.key]++;
        if (cfg.totalCol) valid[cfg.key+'Total'] += total;
      } else {
        gaps[cfg.key]++;
      }
    });
  });
  return {valid, raw, gaps};
}

function _healBlankIds(ss){
  let healed = 0;
  _RECONCILE_TABS().forEach(cfg=>{
    const sh = ss.getSheetByName(cfg.tab);
    if (!sh || sh.getLastRow() < 2) return;
    const hdrMap = getHeaderIndexMap_(sh);
    const idIdx = hdrMap[cfg.idCol];
    if (idIdx === undefined) return;
    const lastRow = sh.getLastRow();
    const idVals = sh.getRange(2, idIdx+1, lastRow-1, 1).getValues();
    idVals.forEach((row, i)=>{
      const id = row[0];
      if (id === undefined || id === '' || id === null){
        const newId = cfg.prefix + '-' + Date.now() + '-' + (i+2);
        sh.getRange(i+2, idIdx+1).setValue(newId);
        healed++;
      }
    });
  });
  return healed;
}

function reconcileReport(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const stats = _reconcileStats(ss);
    const gapsFound = Object.keys(stats.gaps).reduce((a,k)=> a + (stats.gaps[k]||0), 0);
    return {
      success:true,
      gapsFound,
      before: {
        purchases: stats.valid.purchases, sales: stats.valid.sales,
        customers: stats.valid.customers, suppliers: stats.valid.suppliers, items: stats.valid.items,
        purchaseTotal: stats.valid.purchasesTotal, salesTotal: stats.valid.salesTotal
      },
      after: {
        purchases: stats.raw.purchases, sales: stats.raw.sales,
        customers: stats.raw.customers, suppliers: stats.raw.suppliers, items: stats.raw.items,
        purchaseTotal: stats.raw.purchasesTotal, salesTotal: stats.raw.salesTotal
      }
    };
  }catch(e){
    logError('reconcileReport', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function reconcileAndSave(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const healedCount = _healBlankIds(ss);
    const stats = _reconcileStats(ss);
    return {
      success:true,
      healedCount,
      after: {
        purchases: stats.valid.purchases, sales: stats.valid.sales,
        customers: stats.valid.customers, suppliers: stats.valid.suppliers, items: stats.valid.items,
        purchaseTotal: stats.valid.purchasesTotal, salesTotal: stats.valid.salesTotal
      }
    };
  }catch(e){
    logError('reconcileAndSave', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE VERIFICATION
// ════════════════════════════════════════════════════════════════════════════════

function verifyNavigationState(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const checks = {
      sales: {exists: false, count: 0},
      purchases: {exists: false, count: 0},
      customers: {exists: false, count: 0},
      suppliers: {exists: false, count: 0},
      items: {exists: false, count: 0},
      meta: {exists: false},
      settings: {exists: false}
    };

    const tabs = Object.keys(checks);
    tabs.forEach(tab => {
      const sh = ss.getSheetByName(tab.toUpperCase());
      if (sh){
        checks[tab].exists = true;
        if (sh.getLastRow() > 1){
          checks[tab].count = sh.getLastRow() - 1;
        }
      }
    });

    const allValid = Object.values(checks).every(c => c.exists);
    return {
      success: true,
      state: checks,
      allTabsValid: allValid,
      timestamp: new Date().toISOString()
    };
  }catch(e){
    logError('verifyNavigationState', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// AUDIT LOG & RECORD MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

function getAuditLog(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const auditSh = ss.getSheetByName('AUDIT_LOG');
    if (!auditSh || auditSh.getLastRow() < 2) return {success:true, logs:[], count:0};

    const hdrMap = getHeaderIndexMap_(auditSh);
    const rows = auditSh.getRange(2, 1, auditSh.getLastRow()-1, auditSh.getLastColumn()).getValues();

    const logs = rows.map(r => ({
      logId: r[hdrMap['LOG_ID']],
      action: r[hdrMap['ACTION']],
      table: r[hdrMap['TABLE']],
      recordId: r[hdrMap['RECORD_ID']],
      timestamp: r[hdrMap['TIMESTAMP']],
      userId: r[hdrMap['USER_ID']],
      detail: r[hdrMap['CHANGE_DETAIL']],
      status: r[hdrMap['STATUS']]
    })).filter(l => l.logId).reverse();

    return {success:true, logs: logs.slice(0, 100), count: logs.length, total: rows.length};
  }catch(e){
    logError('getAuditLog', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function clearDeletedRecords(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const auditSh = ss.getSheetByName('AUDIT_LOG');
    if (!auditSh || auditSh.getLastRow() < 2) return {success:true, message:'No audit records to clear'};

    const hdrMap = getHeaderIndexMap_(auditSh);
    const actionIdx = hdrMap['ACTION'];
    const rows = auditSh.getRange(2, 1, auditSh.getLastRow()-1, auditSh.getLastColumn()).getValues();

    let cleared = 0;
    if (req.clearNonDeletions){
      for(let i = rows.length - 1; i >= 0; i--){
        if (String(rows[i][actionIdx]).indexOf('DELETE') === -1){
          auditSh.deleteRow(i + 2);
          cleared++;
        }
      }
    }

    return {success:true, message:'Cleared '+cleared+' non-deletion audit records', cleared};
  }catch(e){
    logError('clearDeletedRecords', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

function checkDataChange(req){
  if(!req.clientId) return {success:false, message:'clientId required'};
  try{
    const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', req.clientId);
    if(!cr || !cr.DATABASE_ID) return {success:false, message:'Client database not found'};
    const lastModified = DriveApp.getFileById(String(cr.DATABASE_ID)).getLastUpdated().getTime();
    const lastKnownSync = Number(req.lastKnownSync) || 0;
    return {
      success:true,
      hasChanges: lastModified > lastKnownSync,
      lastDataChange: lastModified
    };
  }catch(e){
    logError('checkDataChange', 'clientId='+req.clientId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function resetAllData(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const tabs = ['PURCHASES', 'SALES', 'CUSTOMERS', 'SUPPLIERS', 'ITEMS', 'STOCK_LEDGER', 'PAYMENTS_IN', 'PAYMENTS_OUT', 'EXPENSES', 'CREDIT_NOTES', 'DEBIT_NOTES', 'BANK_TXNS'];
    let cleared = 0;
    tabs.forEach(tabName => {
      try{
        const sh = ss.getSheetByName(tabName);
        if(sh){
          const lastRow = sh.getLastRow();
          if(lastRow > 1){ sh.deleteRows(2, lastRow - 1); cleared++; }
        }
      }catch(e){}
    });
    logError('ADMIN:FULL_RESET', 'sheetId='+req.sheetId+' cleared '+cleared+' tabs');
    return {success:true, message:'All data cleared', tablesCleared: tabs.length};
  }catch(e){
    logError('resetAllData:exception', e.toString());
    return {success:false, message:e.toString()};
  }
}

function uploadAttachment(req){
  try{
    const parents = DriveApp.getFileById(req.sheetId).getParents();
    const folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const bytes = Utilities.base64Decode(req.base64Data);
    const blob = Utilities.newBlob(bytes, req.mimeType || 'application/octet-stream', req.fileName || 'attachment');
    const file = folder.createFile(blob);
    return {success:true, fileId:file.getId(), url:file.getUrl()};
  }catch(err){
    return {success:false, message:'Upload failed: '+err.message};
  }
}

function checkSubscription(req){
  const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', req.clientId);
  if(!cr) return {success:false};
  return {success:true, plan:cr.PLAN_NAME, trialEnd:new Date(cr.EXPIRY_DATE).getTime(), status:cr.STATUS};
}

function saveSettings(req){
  if(!req.sheetId) return {success:false, message:'sheetId required'};
  try{
    const ss = SpreadsheetApp.openById(req.sheetId);
    const sh = getOrCreateSheet_(ss, 'SETTINGS', H.SETTINGS);
    upsertRowBatched_(sh, 'SETTINGS', { ID: 'SETTINGS', SETTINGS_JSON: JSON.stringify(req.settings || {}), UPDATED_AT: new Date() });
    return {success:true, message:'Settings saved'};
  }catch(e){
    logError('saveSettings', 'sheetId='+req.sheetId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// MIGRATION & REPAIR
// ════════════════════════════════════════════════════════════════════════════════

function _migrateClientSheet_(sheetId){
  const result = {sheetId, tabsCreated:[], columnsAdded:{}};
  const ss = SpreadsheetApp.openById(sheetId);
  Object.keys(H).forEach(tabName=>{
    let sh = ss.getSheetByName(tabName);
    if (!sh){
      sh = getOrCreateSheet_(ss, tabName, H[tabName]);
      result.tabsCreated.push(tabName);
      return;
    }
    if (sh.getLastRow() === 0){
      sh.appendRow(H[tabName]);
      return;
    }
    const existing = getHeaderIndexMap_(sh);
    const missing = H[tabName].filter(h => existing[h.toUpperCase()] === undefined);
    missing.forEach(h => getOrAddColumn_(sh, h));
    if (missing.length) result.columnsAdded[tabName] = missing;
  });
  return result;
}

function ensureClientDatabase_(clientId){
  if(!clientId) return {success:false, message:'clientId required'};
  const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', clientId);
  if(!cr || !cr.DATABASE_ID) return {success:false, clientId, status:'NOT_FOUND', message:'No DATABASE_ID on record for this client in CLIENT_REGISTRY'};
  try{
    const migration = _migrateClientSheet_(String(cr.DATABASE_ID));
    const healthy = !migration.tabsCreated.length && !Object.keys(migration.columnsAdded).length;
    return {
      success:true, clientId, status: healthy ? 'OK' : 'REPAIRED',
      message: healthy ? 'Client database already had every tab/column' : 'Added missing tabs/columns',
      tabsCreated: migration.tabsCreated, columnsAdded: migration.columnsAdded
    };
  }catch(e){
    logError('ensureClientDatabase_', 'clientId='+clientId+' sheetId='+cr.DATABASE_ID+' | '+e.toString());
    return {success:false, clientId, status:'ERROR', message:e.toString()};
  }
}

function repairAllClientDatabases(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY');
  if(!sh || sh.getLastRow()<2) return {success:true, message:'No clients in CLIENT_REGISTRY', results:[]};
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idCol = hdr.indexOf('CLIENT_ID');
  if(idCol===-1) return {success:false, message:'CLIENT_ID column not found in CLIENT_REGISTRY'};
  const results = [];
  for(let i=1;i<data.length;i++){
    const clientId = String(data[i][idCol]||'').trim();
    if(!clientId) continue;
    results.push(ensureClientDatabase_(clientId));
  }
  const repaired = results.filter(r=>r.status==='REPAIRED').length;
  const failed = results.filter(r=>!r.success).length;
  return {success:true, message:`Checked ${results.length} client(s) — ${repaired} repaired, ${failed} failed`, results};
}

function verifyMasterControl(){
  const checks = [];
  function check(name, fn){
    try{ checks.push({check:name, ok:true, detail:fn()}); }
    catch(e){ checks.push({check:name, ok:false, error:e.toString()}); }
  }
  check('open MASTER_CONTROL_SHEET_ID', ()=>{
    const ss = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID); return 'Opened: '+ss.getName();
  });
  check('open USER_SECURITY_SHEET_ID', ()=>{
    const ss = SpreadsheetApp.openById(USER_SECURITY_SHEET_ID); return 'Opened: '+ss.getName();
  });
  ['CLIENT_MASTER','USER_MASTER','CLIENT_REGISTRY','LICENSE_MASTER'].forEach(tab=>{
    check('open '+tab+' (USER_SECURITY)', ()=>{
      const sh = sheet(USER_SECURITY_SHEET_ID, tab);
      if(!sh) throw new Error('Tab not found: '+tab);
      return 'Rows: '+sh.getLastRow();
    });
  });
  ['CLIENT_REGISTRY','CLIENT_DATABASE_REGISTRY','CLIENT_DEPLOYMENT_REGISTRY','SAAS_SUBSCRIPTION_MASTER','TEMPLATE_USAGE_LOG'].forEach(tab=>{
    check('open '+tab+' (MASTER_CONTROL)', ()=>{
      const sh = sheet(MASTER_CONTROL_SHEET_ID, tab);
      if(!sh) throw new Error('Tab not found: '+tab+' (MASTER_CONTROL)');
      return 'Rows: '+sh.getLastRow();
    });
  });
  check('open TEMPLATE_REGISTRY row '+TEMPLATE_ID_FOR_BOS, ()=>{
    const row = findRow(MASTER_CONTROL_SHEET_ID, 'TEMPLATE_REGISTRY', 'TEMPLATE_ID', TEMPLATE_ID_FOR_BOS);
    if(!row) throw new Error(TEMPLATE_ID_FOR_BOS+' row not found in TEMPLATE_REGISTRY');
    return 'GOOGLE_SHEET_ID='+row.GOOGLE_SHEET_ID;
  });
  const allOk = checks.every(c=>c.ok);
  return {success:allOk, message: allOk ? 'Master Control verified — all checks passed' : 'Master Control has issues — see checks', checks};
}

function repairMasterControl(){
  const repaired = [];
  ['CLIENT_MASTER','USER_MASTER','CLIENT_REGISTRY','LICENSE_MASTER'].forEach(tab=>{
    const ss = SpreadsheetApp.openById(USER_SECURITY_SHEET_ID);
    if(!ss.getSheetByName(tab) && H[tab]){
      getOrCreateSheet_(ss, tab, H[tab]);
      repaired.push(tab+' (USER_SECURITY)');
    }
  });
  ['CLIENT_REGISTRY','CLIENT_DATABASE_REGISTRY','CLIENT_DEPLOYMENT_REGISTRY','SAAS_SUBSCRIPTION_MASTER','TEMPLATE_USAGE_LOG'].forEach(tab=>{
    const ss = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID);
    if(!ss.getSheetByName(tab)){
      ss.insertSheet(tab);
      repaired.push(tab+' (MASTER_CONTROL)');
    }
  });
  const verify = verifyMasterControl();
  return {success:verify.success, message: repaired.length ? 'Created missing tab(s): '+repaired.join(', ') : 'Nothing to repair', repaired, verify};
}

function runDiag(){
  return {
    ok:true,
    message:'Balaji NextGen Business OS v78 — true-sync save/delete for masters & transactions, auto tab/header creation, Tally direct posting, nightly backup after 3AM, Excel purchase import, client bizName repair',
    timestamp: new Date().toISOString(),
    features: ['true-sync-save-delete', 'auto-dedupe', 'monthwise-reports', 'itemwise-reports', 'opening-stock', 'audit-logging', 'deletion-records', 'setting-tracking', 'invoice-series', 'tally-direct-post', 'nightly-backup-after-3am', 'excel-purchase-import', 'client-provisioning', 'bizname-repair']
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// TALLY PRIME — DIRECT POSTING
// ════════════════════════════════════════════════════════════════════════════════

const TALLY_CONFIG = {
  TALLY_SERVER: 'http://localhost:9000',
  AUTH: { COMPANY: 'Default Company' },
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
  TIMEOUT_MS: 30000,
  AUTO_CREATE_MASTERS: true
};

function checkTallyConnection(){
  try{
    const url = TALLY_CONFIG.TALLY_SERVER + '/api/gateway?action=CheckConnection';
    const response = UrlFetchApp.fetch(url, {method:'GET', muteHttpExceptions:true});
    const result = JSON.parse(response.getContentText());
    return {success:true, connected: result.status === 'connected', version: result.version, message: result.message};
  }catch(e){
    return {success:false, connected:false, error:'Tally not reachable. Start Tally Prime / check gateway URL.', message:e.toString()};
  }
}

function checkTallyStatusAPI(req){
  return checkTallyConnection();
}

function _tallyMasterExists_(name, type){
  try{
    const url = TALLY_CONFIG.TALLY_SERVER + '/api/gateway';
    const payload = {action:'CheckMaster', type:'Ledger', name:name};
    const response = UrlFetchApp.fetch(url, {method:'POST', contentType:'application/json', payload:JSON.stringify(payload), muteHttpExceptions:true});
    const result = JSON.parse(response.getContentText());
    return result.exists === true;
  }catch(e){ return false; }
}

function _createTallyMaster_(name, address, ledgerType){
  try{
    const url = TALLY_CONFIG.TALLY_SERVER + '/api/gateway';
    const payload = {
      action:'CreateMaster', type:'Ledger', company: TALLY_CONFIG.AUTH.COMPANY,
      master: { name, ledgerType, address: address||'', email:'', phone:'' }
    };
    const response = UrlFetchApp.fetch(url, {method:'POST', contentType:'application/json', payload:JSON.stringify(payload), muteHttpExceptions:true});
    const result = JSON.parse(response.getContentText());
    return {success: result.status === 'success', error: result.error};
  }catch(e){ return {success:false, error:e.message}; }
}

function postVoucherToTally_(voucher, voucherType){
  let attempt = 0, lastError = null;
  while (attempt < TALLY_CONFIG.RETRY_ATTEMPTS){
    try{
      const url = TALLY_CONFIG.TALLY_SERVER + '/api/gateway';
      const payload = {action:'CreateVoucher', type:voucherType, company: TALLY_CONFIG.AUTH.COMPANY, voucher};
      const response = UrlFetchApp.fetch(url, {method:'POST', contentType:'application/json', payload:JSON.stringify(payload), timeout: TALLY_CONFIG.TIMEOUT_MS, muteHttpExceptions:true});
      const result = JSON.parse(response.getContentText());
      if (result.status === 'success'){
        return {success:true, tallyVoucherId: result.voucherId, reference: result.reference, message: result.message};
      }
      lastError = result.error || result.message;
    }catch(e){
      lastError = e.message;
    }
    attempt++;
    if (attempt < TALLY_CONFIG.RETRY_ATTEMPTS) Utilities.sleep(TALLY_CONFIG.RETRY_DELAY_MS);
  }
  return {success:false, error:lastError, attempt};
}

function _getVoucherForTally_(sheetId, tab, idHeader, id, partyIdHeader, partyNameHeader, itemsById){
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(tab);
  if (!sh || sh.getLastRow() < 2) return null;
  const hdrMap = getHeaderIndexMap_(sh);
  const idIdx = hdrMap[idHeader];
  if (idIdx === undefined) return null;
  const rows = sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues();
  for (let i=0;i<rows.length;i++){
    if (String(rows[i][idIdx]) === String(id)){
      const r = rows[i];
      const dateVal = r[hdrMap['DATE']];
      const dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(),'yyyy-MM-dd') : String(dateVal||'');
      let lineItems = [];
      const raw = hdrMap['ITEMS_JSON']!==undefined ? r[hdrMap['ITEMS_JSON']] : '';
      if (raw && typeof raw==='string' && raw.trim().charAt(0)==='[') { try{ lineItems = JSON.parse(raw); }catch(e){} }
      return {
        rowIndex: i+2,
        id: r[idIdx],
        partyName: hdrMap[partyNameHeader]!==undefined ? (r[hdrMap[partyNameHeader]] || r[hdrMap[partyIdHeader]]) : r[hdrMap[partyIdHeader]],
        date: dateStr,
        invoiceNo: hdrMap['INVOICE_NO']!==undefined ? r[hdrMap['INVOICE_NO']] : '',
        total: Number(r[hdrMap['TOTAL']])||0,
        items: lineItems.map(li=>({
          name: itemsById[li.id] ? itemsById[li.id].name : li.id,
          quantity: li.qty || 0, rate: li.rate || 0, amount: (li.qty||0)*(li.rate||0)
        }))
      };
    }
  }
  return null;
}

function _itemsById_(sheetId){
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName('ITEMS');
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  const hdrMap = getHeaderIndexMap_(sh);
  sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues().forEach(r=>{
    const id = String(r[hdrMap['ID']]||'');
    if (id) map[id] = {name: r[hdrMap['NAME']]};
  });
  return map;
}

function postSaleToTallyDirect(sheetId, saleId){
  try{
    const itemsById = _itemsById_(sheetId);
    const sale = _getVoucherForTally_(sheetId, 'SALES', 'INVOICE_ID', saleId, 'CUSTOMER_ID', 'CUSTOMER_NAME', itemsById);
    if (!sale) return {success:false, message:'Sale '+saleId+' not found'};

    if (TALLY_CONFIG.AUTO_CREATE_MASTERS && !_tallyMasterExists_(sale.partyName)){
      const created = _createTallyMaster_(sale.partyName, '', 'Sundry Debtors');
      if (!created.success) return {success:false, message:'Failed to create customer in Tally: '+created.error};
    }

    const voucher = {
      voucherNumber: sale.invoiceNo || sale.id, date: sale.date, partyName: sale.partyName,
      lineItems: sale.items, totalAmount: sale.total, narration: 'Auto-posted from Business OS ' + sale.id
    };
    const postResult = postVoucherToTally_(voucher, 'SalesInvoice');
    if (!postResult.success) return postResult;

    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName('SALES');
    getOrAddColumn_(sh, 'TALLY_POSTED'); getOrAddColumn_(sh, 'TALLY_REFERENCE');
    const hdrMap = getHeaderIndexMap_(sh);
    sh.getRange(sale.rowIndex, hdrMap['TALLY_POSTED']+1).setValue(true);
    sh.getRange(sale.rowIndex, hdrMap['TALLY_REFERENCE']+1).setValue(postResult.tallyVoucherId||postResult.reference||'');

    logAuditEntry(sheetId, 'POST_TO_TALLY', 'SALES', saleId, 'Posted to Tally, ref='+(postResult.tallyVoucherId||''), 'SUCCESS');
    return {success:true, message:'Sale posted to Tally', saleId, tallyVoucherId: postResult.tallyVoucherId, tallyReference: postResult.reference};
  }catch(e){
    logError('postSaleToTallyDirect', 'sheetId='+sheetId+' saleId='+saleId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function postPurchaseToTallyDirect(sheetId, purchaseId){
  try{
    const itemsById = _itemsById_(sheetId);
    const purch = _getVoucherForTally_(sheetId, 'PURCHASES', 'PURCHASE_ID', purchaseId, 'SUPPLIER_ID', 'SUPPLIER_NAME', itemsById);
    if (!purch) return {success:false, message:'Purchase '+purchaseId+' not found'};

    if (TALLY_CONFIG.AUTO_CREATE_MASTERS && !_tallyMasterExists_(purch.partyName)){
      const created = _createTallyMaster_(purch.partyName, '', 'Sundry Creditors');
      if (!created.success) return {success:false, message:'Failed to create supplier in Tally: '+created.error};
    }

    const voucher = {
      voucherNumber: purch.invoiceNo || purch.id, date: purch.date, partyName: purch.partyName,
      lineItems: purch.items, totalAmount: purch.total, narration: 'Auto-posted from Business OS ' + purch.id
    };
    const postResult = postVoucherToTally_(voucher, 'PurchaseInvoice');
    if (!postResult.success) return postResult;

    const ss = SpreadsheetApp.openById(sheetId);
    const sh = ss.getSheetByName('PURCHASES');
    getOrAddColumn_(sh, 'TALLY_POSTED'); getOrAddColumn_(sh, 'TALLY_REFERENCE');
    const hdrMap = getHeaderIndexMap_(sh);
    sh.getRange(purch.rowIndex, hdrMap['TALLY_POSTED']+1).setValue(true);
    sh.getRange(purch.rowIndex, hdrMap['TALLY_REFERENCE']+1).setValue(postResult.tallyVoucherId||postResult.reference||'');

    logAuditEntry(sheetId, 'POST_TO_TALLY', 'PURCHASES', purchaseId, 'Posted to Tally, ref='+(postResult.tallyVoucherId||''), 'SUCCESS');
    return {success:true, message:'Purchase posted to Tally', purchaseId, tallyVoucherId: postResult.tallyVoucherId, tallyReference: postResult.reference};
  }catch(e){
    logError('postPurchaseToTallyDirect', 'sheetId='+sheetId+' purchaseId='+purchaseId+' | '+e.toString());
    return {success:false, message:e.toString()};
  }
}

function postToTallyAPI(req){
  if (!req.sheetId || !req.documentId || !req.documentType){
    return {success:false, message:'sheetId, documentId and documentType required'};
  }
  if (req.documentType === 'SALE') return postSaleToTallyDirect(req.sheetId, req.documentId);
  if (req.documentType === 'PURCHASE') return postPurchaseToTallyDirect(req.sheetId, req.documentId);
  return {success:false, message:'Unknown document type: '+req.documentType};
}

// ════════════════════════════════════════════════════════════════════════════════
// AUTOMATIC NIGHTLY BACKUP
// ════════════════════════════════════════════════════════════════════════════════

const BACKUP_CONFIG = {
  ENABLED: true,
  BACKUP_TIME_HOUR: 3,
  BACKUP_TIME_MINUTE: 0,
  RETENTION_DAYS: 30,
  RETENTION_BACKUPS: 5,
  BACKUP_PARENT_FOLDER_ID: '1QUzavRsSwhIy-keXpHf3zguAvHkU8dUy',
  BACKUP_FOLDER_NAME: '_BACKUPS',
  BACKUP_PREFIX: 'BOS_BACKUP_',
  MAX_PARALLEL_BACKUPS: 5,
  NOTIFY_ON_BACKUP: true,
  NOTIFY_ON_ERROR: true,
  ADMIN_EMAIL: 'balajisoftware2013@gmail.com'
};

function dailyAutomaticBackup(){
  const startTime = new Date();
  const backupId = Utilities.getUuid();
  const log = [];

  try{
    logBackup('INFO', 'Automatic backup started', {backupId});

    const clients = getAllActiveClients();
    log.push(`Found ${clients.length} active clients`);
    if (clients.length === 0){
      logBackup('WARN', 'No active clients found', {});
      return {success:true, message:'No clients to backup', backupId};
    }

    const backupResults = backupClientsParallel(clients, backupId);
    const successful = backupResults.filter(r=>r.success).length;
    const failed = backupResults.filter(r=>!r.success).length;
    log.push(`Backups: ${successful} successful, ${failed} failed`);

    const cleanupResults = cleanupOldBackups(clients);
    log.push(`Cleanup: Removed ${cleanupResults.removed} old backups`);

    const duration = Math.round((new Date() - startTime) / 1000);
    logBackup('INFO', `Daily backup completed in ${duration}s`, {backupId, successful, failed, duration});

    if (BACKUP_CONFIG.NOTIFY_ON_BACKUP) sendBackupNotification(backupId, successful, failed, log);

    return {
      success:true, backupId,
      summary:{ timestamp:new Date().toISOString(), totalClients:clients.length, successful, failed, duration, log }
    };
  }catch(e){
    logBackup('ERROR', 'Backup failed: ' + e.toString(), {backupId, error:e.message});
    if (BACKUP_CONFIG.NOTIFY_ON_ERROR){
      try{
        GmailApp.sendEmail(BACKUP_CONFIG.ADMIN_EMAIL, 'Balaji NextGen Backup ERROR',
          `Automatic backup failed!\n\nError: ${e.message}\n\nBackup ID: ${backupId}`);
      }catch(e2){}
    }
    return {success:false, message:e.toString(), backupId, error:e.message};
  }
}

function backupClientDatabase(clientId, clientSheetId){
  const backupTime = new Date();
  const timestamp = formatTimestamp(backupTime);

  try{
    const clientFolder = DriveApp.getFolderById(getClientFolderIdBySheetId(clientSheetId));
    const backupFolder = getOrCreateBackupFolder(clientFolder);

    const ss = SpreadsheetApp.openById(clientSheetId);
    const sheets = ss.getSheets();

    const backupName = `${BACKUP_CONFIG.BACKUP_PREFIX}${clientId}_${timestamp}`;
    const backupSs = SpreadsheetApp.create(backupName);
    const backupSheetId = backupSs.getId();

    if (backupSs.getSheets().length > 0) backupSs.deleteSheet(backupSs.getSheets()[0]);

    let sheetsCopied = 0;
    sheets.forEach(sh=>{
      try{ sh.copyTo(backupSs); sheetsCopied++; }
      catch(e){ logBackup('WARN', `Failed to copy sheet ${sh.getName()}: ${e.message}`, {clientId}); }
    });

    const backupFile = DriveApp.getFileById(backupSheetId);
    backupFile.moveTo(backupFolder);

    addBackupMetadata(backupSheetId, clientId, backupTime, sheets.length);

    logBackup('INFO', `Client ${clientId} backed up: ${sheetsCopied} sheets`, {clientId, backupId:backupSheetId, sheetCount:sheetsCopied});

    return {success:true, clientId, backupId:backupSheetId, backupName, sheetsCopied, timestamp: backupTime.toISOString()};
  }catch(e){
    logBackup('ERROR', `Backup failed for client ${clientId}: ${e.message}`, {clientId, error:e.message});
    return {success:false, clientId, message:e.toString(), timestamp:new Date().toISOString()};
  }
}

function backupClientsParallel(clients, backupId){
  const results = [];
  const batchSize = BACKUP_CONFIG.MAX_PARALLEL_BACKUPS;
  for (let i=0;i<clients.length;i+=batchSize){
    const batch = clients.slice(i, i+batchSize);
    batch.forEach(client=>{
      results.push(backupClientDatabase(client.clientId, client.sheetId));
    });
    if (i+batchSize < clients.length) Utilities.sleep(1000);
  }
  return results;
}

function addBackupMetadata(backupSheetId, clientId, backupTime, sheetCount){
  try{
    const backupSs = SpreadsheetApp.openById(backupSheetId);
    let metaSh = backupSs.getSheetByName('BACKUP_META');
    if (!metaSh){
      metaSh = backupSs.insertSheet('BACKUP_META', backupSs.getSheets().length);
      metaSh.appendRow(['PROPERTY','VALUE']);
    }
    const metadata = {
      PROPERTY: ['CLIENT_ID','BACKUP_TIME','SHEET_COUNT','BACKUP_VERSION','CREATED_BY','RESTORE_INSTRUCTIONS','DATA_INTEGRITY_CHECK'],
      VALUE: [clientId, backupTime.toISOString(), sheetCount, 'v78', 'AUTOMATIC_BACKUP', 'Use RESTORE_FROM_BACKUP action', 'Use VERIFY_BACKUP_INTEGRITY action']
    };
    if (metaSh.getLastRow() > 1) metaSh.deleteRows(2, metaSh.getLastRow() - 1);
    for (let i=0;i<metadata.PROPERTY.length;i++) metaSh.appendRow([metadata.PROPERTY[i], metadata.VALUE[i]]);
  }catch(e){
    logBackup('WARN', `Failed to add metadata to backup ${backupSheetId}`, {error:e.message});
  }
}

function restoreFromBackup(clientId, clientSheetId, backupId){
  const restoreTime = new Date();
  try{
    logBackup('INFO', `Starting restore for client ${clientId} from backup ${backupId}`, {clientId, backupId});

    const backupSs = SpreadsheetApp.openById(backupId);
    const backupSheets = backupSs.getSheets().filter(s => s.getName() !== 'BACKUP_META');

    const activeSs = SpreadsheetApp.openById(clientSheetId);
    const activeSheets = activeSs.getSheets();

    const archiveName = `${BACKUP_CONFIG.BACKUP_PREFIX}${clientId}_PRE_RESTORE_${formatTimestamp(restoreTime)}`;
    const archiveSs = SpreadsheetApp.create(archiveName);
    if (archiveSs.getSheets().length > 0) archiveSs.deleteSheet(archiveSs.getSheets()[0]);

    let archivedSheets = 0;
    activeSheets.forEach(sh=>{ try{ sh.copyTo(archiveSs); archivedSheets++; }catch(e){} });
    logBackup('INFO', `Created safety archive: ${archivedSheets} sheets`, {clientId});

    activeSheets.forEach(sh=>{ try{ if (sh.getMaxRows() > 1) sh.deleteRows(2, sh.getLastRow()-1); }catch(e){} });

    let restoredSheets = 0;
    backupSheets.forEach(backupSheet=>{
      try{
        const sheetName = backupSheet.getName();
        let activeSheet = activeSs.getSheetByName(sheetName);
        if (!activeSheet) activeSheet = activeSs.insertSheet(sheetName);
        const data = backupSheet.getRange(1,1,backupSheet.getLastRow(), backupSheet.getLastColumn()).getValues();
        activeSheet.clearContents();
        activeSheet.getRange(1,1,data.length,data[0].length).setValues(data);
        restoredSheets++;
      }catch(e){ logBackup('WARN', `Failed to restore sheet ${backupSheet.getName()}`, {error:e.message}); }
    });

    try{
      const clientFolder = DriveApp.getFolderById(getClientFolderIdBySheetId(clientSheetId));
      const backupFolder = getOrCreateBackupFolder(clientFolder);
      DriveApp.getFileById(archiveSs.getId()).moveTo(backupFolder);
    }catch(e){}

    logBackup('INFO', `Restore completed for client ${clientId}`, {clientId, restoredSheets, archivedSheets, archiveId: archiveSs.getId()});

    return {
      success:true, clientId, message:`Restored ${restoredSheets} sheets from backup`,
      restoredSheets, archiveId: archiveSs.getId(), archiveName, timestamp: restoreTime.toISOString()
    };
  }catch(e){
    logBackup('ERROR', `Restore failed for client ${clientId}`, {clientId, error:e.message});
    return {success:false, message:e.toString(), error:e.message};
  }
}

function listClientBackups(clientSheetId){
  try{
    const clientFolder = DriveApp.getFolderById(getClientFolderIdBySheetId(clientSheetId));
    const backupFolder = getOrCreateBackupFolder(clientFolder);
    const backupFiles = backupFolder.getFilesByType('application/vnd.google-apps.spreadsheet');
    const backups = [];
    while (backupFiles.hasNext()){
      const file = backupFiles.next();
      const name = file.getName();
      if (name.startsWith(BACKUP_CONFIG.BACKUP_PREFIX)){
        backups.push({name, id:file.getId(), created:file.getDateCreated(), modified:file.getLastUpdated(), size: formatFileSize(file.getSize())});
      }
    }
    backups.sort((a,b)=> new Date(b.created) - new Date(a.created));
    return {success:true, backups, count:backups.length};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function cleanupOldBackups(clients){
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - BACKUP_CONFIG.RETENTION_DAYS);
  let totalRemoved = 0;

  clients.forEach(client=>{
    try{
      const clientFolder = DriveApp.getFolderById(getClientFolderIdBySheetId(client.sheetId));
      const backupFolder = getOrCreateBackupFolder(clientFolder);
      const backupFiles = backupFolder.getFilesByType('application/vnd.google-apps.spreadsheet');
      const backups = [];
      while (backupFiles.hasNext()){
        const file = backupFiles.next();
        if (file.getName().startsWith(BACKUP_CONFIG.BACKUP_PREFIX)) backups.push({file, date:file.getDateCreated()});
      }
      backups.sort((a,b)=> b.date - a.date);

      let removed = 0;
      for (let i = BACKUP_CONFIG.RETENTION_BACKUPS; i < backups.length; i++){
        if (backups[i].date < retentionDate){
          backups[i].file.setTrashed(true);
          removed++; totalRemoved++;
        }
      }
      if (removed > 0) logBackup('INFO', `Cleaned up ${removed} old backups for ${client.clientId}`, {clientId:client.clientId, removed});
    }catch(e){
      logBackup('WARN', `Cleanup failed for client ${client.clientId}`, {error:e.message});
    }
  });

  return {removed: totalRemoved};
}

function verifyBackupIntegrity(backupId){
  try{
    const backupSs = SpreadsheetApp.openById(backupId);
    const sheets = backupSs.getSheets();
    const integrity = {valid:true, sheetCount: sheets.length, sheets:[], issues:[]};
    sheets.forEach(sh=>{
      const name = sh.getName(), lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
      integrity.sheets.push({name, rows:lastRow, columns:lastCol, isEmpty: lastRow<1 || lastCol<1});
      if (lastRow < 1) integrity.issues.push(`Sheet ${name} is empty`);
    });
    if (integrity.issues.length > 0) integrity.valid = false;
    return {success:true, integrity};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function getBackupStatistics(clientSheetId){
  try{
    const backups = listClientBackups(clientSheetId);
    if (!backups.success) return backups;
    const stats = {
      totalBackups: backups.count,
      oldestBackup: backups.backups.length ? backups.backups[backups.backups.length-1].created : null,
      newestBackup: backups.backups.length ? backups.backups[0].created : null,
      backupsByAge: {}
    };
    backups.backups.forEach(b=>{
      const ageDays = Math.floor((new Date() - new Date(b.created)) / (1000*60*60*24));
      const key = ageDays + 'd';
      stats.backupsByAge[key] = (stats.backupsByAge[key]||0) + 1;
    });
    return {success:true, statistics: stats};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function getOrCreateBackupFolder(parentFolder){
  try{
    const folders = parentFolder.getFoldersByName(BACKUP_CONFIG.BACKUP_FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    return parentFolder.createFolder(BACKUP_CONFIG.BACKUP_FOLDER_NAME);
  }catch(e){
    return parentFolder.createFolder(BACKUP_CONFIG.BACKUP_FOLDER_NAME);
  }
}

function getAllActiveClients(){
  try{
    const masterSh = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID).getSheetByName('CLIENT_REGISTRY');
    if (!masterSh || masterSh.getLastRow() < 2) return [];
    const hdrMap = getHeaderIndexMap_(masterSh);
    const statusIdx = hdrMap['STATUS'], clientIdIdx = hdrMap['CLIENT_ID'], dbIdIdx = hdrMap['DATABASE_ID'];
    const rows = masterSh.getRange(2,1,masterSh.getLastRow()-1, masterSh.getLastColumn()).getValues();
    return rows
      .filter(r => String(r[statusIdx]||'').toUpperCase() === 'ACTIVE')
      .map(r => ({clientId: r[clientIdIdx], sheetId: r[dbIdIdx]}))
      .filter(c => c.clientId && c.sheetId);
  }catch(e){
    logBackup('ERROR', 'Failed to get active clients', {error:e.message});
    return [];
  }
}

function getClientFolderIdBySheetId(sheetId){
  try{
    const file = DriveApp.getFileById(sheetId);
    const parents = file.getParents();
    if (parents.hasNext()) return parents.next().getId();
    return BACKUP_CONFIG.BACKUP_PARENT_FOLDER_ID;
  }catch(e){
    return BACKUP_CONFIG.BACKUP_PARENT_FOLDER_ID;
  }
}

function formatTimestamp(date){
  if (!date) date = new Date();
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  const h=String(date.getHours()).padStart(2,'0'), mi=String(date.getMinutes()).padStart(2,'0'), s=String(date.getSeconds()).padStart(2,'0');
  return `${y}-${m}-${d}_${h}${mi}${s}`;
}

function formatFileSize(bytes){
  if (bytes === 0) return '0 B';
  const k=1024, sizes=['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes)/Math.log(k));
  return Math.round((bytes/Math.pow(k,i))*100)/100 + ' ' + sizes[i];
}

function logBackup(level, message, details){
  try{
    let masterSh = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID).getSheetByName('BACKUP_LOG');
    if (!masterSh){
      const ss = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID);
      masterSh = ss.insertSheet('BACKUP_LOG');
      masterSh.appendRow(['TIMESTAMP','LEVEL','MESSAGE','DETAILS']);
    }
    masterSh.appendRow([new Date().toISOString(), level, message, JSON.stringify(details||{})]);
    if (masterSh.getLastRow() > 1001) masterSh.deleteRows(2, masterSh.getLastRow()-1001);
  }catch(e){}
}

function sendBackupNotification(backupId, successful, failed, log){
  try{
    const subject = `Balaji NextGen Backup Report - ${new Date().toLocaleDateString()}`;
    const body = `Automatic Database Backup Report\n================================\n\nBackup ID: ${backupId}\nTime: ${new Date().toISOString()}\n\nSummary:\n- Successful: ${successful}\n- Failed: ${failed}\n\nDetails:\n${log.join('\n')}\n\nBackups are stored in each client's Drive folder under _BACKUPS.\nTo restore, use the RESTORE_FROM_BACKUP action with the backup ID.`;
    GmailApp.sendEmail(BACKUP_CONFIG.ADMIN_EMAIL, subject, body);
  }catch(e){
    logBackup('ERROR', 'Failed to send backup notification', {error:e.message});
  }
}

function setupDailyBackupTrigger(){
  try{
    ScriptApp.getProjectTriggers().forEach(trigger=>{
      if (trigger.getHandlerFunction() === 'dailyAutomaticBackup') ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger('dailyAutomaticBackup')
      .timeBased()
      .atHour(BACKUP_CONFIG.BACKUP_TIME_HOUR)
      .everyDays(1)
      .create();
    logBackup('INFO', 'Daily backup trigger installed', {time: `${BACKUP_CONFIG.BACKUP_TIME_HOUR}:00 AM window`});
    return {success:true, message:'Daily backup trigger installed for after 3:00 AM'};
  }catch(e){
    logBackup('ERROR', 'Failed to install backup trigger', {error:e.message});
    return {success:false, message:e.toString()};
  }
}

function removeDailyBackupTrigger(){
  try{
    ScriptApp.getProjectTriggers().forEach(trigger=>{
      if (trigger.getHandlerFunction() === 'dailyAutomaticBackup') ScriptApp.deleteTrigger(trigger);
    });
    logBackup('INFO', 'Daily backup trigger removed', {});
    return {success:true, message:'Daily backup trigger removed'};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function listDailyBackupTriggers(){
  const triggers = ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='dailyAutomaticBackup');
  return {
    success:true, count:triggers.length,
    triggers: triggers.map(t=>({id:t.getUniqueId(), handler:t.getHandlerFunction(), source:t.getTriggerSource(), type:t.getEventType()}))
  };
}

function backupSingleClientAPI(req){
  if (!req.clientId || !req.clientSheetId) return {success:false, message:'clientId and clientSheetId required'};
  return backupClientDatabase(req.clientId, req.clientSheetId);
}

function restoreClientAPI(req){
  if (!req.clientId || !req.clientSheetId || !req.backupId) return {success:false, message:'clientId, clientSheetId, and backupId required'};
  return restoreFromBackup(req.clientId, req.clientSheetId, req.backupId);
}

function listBackupsAPI(req){
  if (!req.clientSheetId) return {success:false, message:'clientSheetId required'};
  return listClientBackups(req.clientSheetId);
}

function backupStatusAPI(req){
  const triggers = listDailyBackupTriggers();
  return {
    success:true,
    backupEnabled: BACKUP_CONFIG.ENABLED,
    triggerInstalled: triggers.count > 0,
    retentionPolicy: {days: BACKUP_CONFIG.RETENTION_DAYS, minBackups: BACKUP_CONFIG.RETENTION_BACKUPS},
    scheduledWindow: `${BACKUP_CONFIG.BACKUP_TIME_HOUR}:00–${BACKUP_CONFIG.BACKUP_TIME_HOUR}:59 AM`,
    lastBackupTime: getLastBackupTime()
  };
}

function getLastBackupTime(){
  try{
    const masterSh = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID).getSheetByName('BACKUP_LOG');
    if (!masterSh || masterSh.getLastRow() < 2) return 'Never';
    return masterSh.getRange(masterSh.getLastRow(), 1).getValue() || 'Unknown';
  }catch(e){
    return 'Unknown';
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// BACKUP RETENTION VERIFICATION / REPORTING
// ════════════════════════════════════════════════════════════════════════════════

function verifyRetentionPolicy(clientSheetId){
  try{
    const backups = listClientBackups(clientSheetId);
    if (!backups.success) return {success:false, message:'Cannot list backups'};

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_CONFIG.RETENTION_DAYS);

    const result = {
      status:'OK', verificationDate: now.toISOString(),
      retentionDays: BACKUP_CONFIG.RETENTION_DAYS, retentionBackups: BACKUP_CONFIG.RETENTION_BACKUPS,
      backupCount: backups.backups.length,
      oldestBackup: backups.backups.length ? backups.backups[backups.backups.length-1] : null,
      newestBackup: backups.backups.length ? backups.backups[0] : null,
      backupsWithinRetention: 0, backupsOutsideRetention: 0, shouldBeDeleted: []
    };

    backups.backups.forEach(b=>{
      const bDate = new Date(b.created);
      if (bDate >= cutoffDate) result.backupsWithinRetention++;
      else {
        result.backupsOutsideRetention++;
        result.shouldBeDeleted.push({name:b.name, date:b.created, ageInDays: Math.floor((now-bDate)/(1000*60*60*24))});
      }
    });

    if (result.backupCount < BACKUP_CONFIG.RETENTION_BACKUPS) result.status = 'SAFE: Under minimum backup count, none should be deleted';
    else if (result.backupsOutsideRetention === 0) result.status = 'OK: All backups within retention window';
    else result.status = 'WARNING: Old backups exist and should be deleted by tonight\'s cleanup';

    return {success:true, verification: result};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function forceManualCleanup(){
  try{
    const clients = getAllActiveClients();
    const result = cleanupOldBackups(clients);
    return {success:true, message:'Manual cleanup completed', backupsRemoved: result.removed, timestamp: new Date().toISOString()};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// CLIENT PROVISIONING FROM TEMPLATE (added v78 — no schema conflicts)
// ════════════════════════════════════════════════════════════════════════════════

function PROVISION_NEW_CLIENT(payload) {
  try {
    const { clientId, companyName, contactName, phone, email, address, gstNo, pan, plan, templateSheetId } = payload;
    if (!clientId || !companyName || !templateSheetId) {
      return { success: false, error: 'MISSING_PARAMS', message: 'clientId, companyName, templateSheetId required' };
    }

    let templateSS;
    try { templateSS = SpreadsheetApp.openById(templateSheetId); }
    catch(err) { return { success: false, error: 'TEMPLATE_NOT_FOUND', message: 'Template sheet not found: ' + templateSheetId }; }

    const sheetName = clientId + '_' + companyName.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
    const newSheet = templateSS.copy(sheetName);
    const newSheetId = newSheet.getId();
    if (!newSheetId) return { success: false, error: 'COPY_FAILED', message: 'Failed to copy template sheet' };

    try {
      const clientsFolder = DriveApp.getFolderById(CLIENTS_DRIVE_FOLDER_ID);
      const file = DriveApp.getFileById(newSheetId);
      let clientFolder = null;
      const folders = clientsFolder.getFoldersByName(clientId);
      clientFolder = folders.hasNext() ? folders.next() : clientsFolder.createFolder(clientId);
      file.moveTo(clientFolder);
    } catch(err) {
      return { success: false, error: 'MOVE_FAILED', message: 'Failed to move sheet to client folder: ' + err.message };
    }

    // Same fix as registerClient(): never let the template's own SETTINGS
    // leak into a newly-provisioned client's business name.
    try{ _resetClientBizIdentity_(newSheetId, companyName, ''); }catch(e){}

    const registryResult = SAVE_CLIENT_REGISTRY_ROW_({
      clientId, companyName, contactName, phone, email, address, gstNo, pan,
      plan: plan || 'BASIC', status: 'ACTIVE', databaseId: newSheetId
    });
    if (!registryResult.success) {
      return { success: false, error: 'REGISTRY_FAILED', message: 'Failed to save to CLIENT_REGISTRY: ' + registryResult.message };
    }

    logAuditEntry(newSheetId, 'CLIENT_PROVISIONED', 'CLIENT_REGISTRY', clientId,
      'New client ' + clientId + ' (' + companyName + ') provisioned from template ' + templateSheetId, 'SUCCESS');

    return {
      success: true, message: 'Client provisioned successfully', clientId, sheetId: newSheetId,
      companyName, phone, email, status: 'ACTIVE', next: 'Configure app with sheetId: ' + newSheetId
    };
  } catch(err) {
    return { success: false, error: 'PROVISION_FAILED', message: err.message, stack: err.stack };
  }
}

// Writes/updates a row in the REAL CLIENT_REGISTRY (USER_SECURITY_SHEET_ID,
// schema H.CLIENT_REGISTRY) rather than inventing a second differently-shaped
// CLIENT_REGISTRY sheet — keeps PROVISION_NEW_CLIENT compatible with login()
// and every other function that reads CLIENT_REGISTRY.
function SAVE_CLIENT_REGISTRY_ROW_(p){
  try{
    const trialEnd = new Date(Date.now() + TRIAL_DAYS*86400000);
    upsertRowByHeaderName(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', p.clientId, {
      CLIENT_ID: p.clientId, COMPANY_NAME: p.companyName, DATABASE_ID: p.databaseId,
      PLAN_NAME: p.plan, EXPIRY_DATE: trialEnd, STATUS: p.status, CREATED_DATE: new Date(), LAST_SYNC: new Date()
    });
    return {success:true};
  }catch(e){
    return {success:false, message:e.toString()};
  }
}

function BATCH_PROVISION_CLIENTS(payload) {
  try {
    const { clients, templateSheetId } = payload;
    if (!clients || !Array.isArray(clients) || !templateSheetId) {
      return { success: false, error: 'MISSING_PARAMS', message: 'clients array and templateSheetId required' };
    }
    const results = [], errors = [];
    clients.forEach(client => {
      const result = PROVISION_NEW_CLIENT({
        clientId: client.clientId, companyName: client.companyName, contactName: client.contactName,
        phone: client.phone, email: client.email, address: client.address, gstNo: client.gstNo,
        pan: client.pan, plan: client.plan, templateSheetId
      });
      if (result.success) results.push(result);
      else errors.push({ clientId: client.clientId, error: result.error, message: result.message });
    });
    return { success: errors.length === 0, message: 'Batch provisioning completed', provisioned: results.length, failed: errors.length, results, errors };
  } catch(err) {
    return { success: false, error: 'BATCH_PROVISION_FAILED', message: err.message };
  }
}

function GET_TEMPLATE_INFO(payload) {
  try {
    const { templateSheetId } = payload;
    if (!templateSheetId) return { success: false, error: 'MISSING_PARAMS', message: 'templateSheetId required' };
    const ss = SpreadsheetApp.openById(templateSheetId);
    const sheets = ss.getSheets();
    const sheetInfo = sheets.map(sh=>{
      const range = sh.getDataRange();
      return { name: sh.getName(), rows: range.getNumRows(), columns: range.getNumColumns(),
        headers: range.getNumRows() > 0 ? range.getValues()[0] : [] };
    });
    return { success: true, templateId: templateSheetId, name: ss.getName(), sheets: sheets.length, sheetInfo };
  } catch(err) {
    return { success: false, error: 'GET_INFO_FAILED', message: err.message };
  }
}

function SYNC_TEMPLATE_TO_CLIENT(payload) {
  try {
    const { templateSheetId, clientSheetId } = payload;
    if (!templateSheetId || !clientSheetId) {
      return { success: false, error: 'MISSING_PARAMS', message: 'templateSheetId and clientSheetId required' };
    }
    const templateSS = SpreadsheetApp.openById(templateSheetId);
    const clientSS = SpreadsheetApp.openById(clientSheetId);
    const templateSheets = templateSS.getSheets();
    let newSheetsCreated = 0, sheetsSkipped = 0;

    templateSheets.forEach(templateSheet => {
      const sheetName = templateSheet.getName();
      let clientSheet = clientSS.getSheetByName(sheetName);
      if (!clientSheet) {
        clientSheet = clientSS.insertSheet(sheetName);
        newSheetsCreated++;
        const templateData = templateSheet.getDataRange().getValues();
        if (templateData.length > 0) {
          const headers = templateData[0];
          clientSheet.appendRow(headers);
          const templateRange = templateSheet.getRange(1, 1, 1, headers.length);
          const backgroundColor = templateRange.getBackgroundColor();
          const fontColor = templateRange.getFontColor();
          const clientRange = clientSheet.getRange(1, 1, 1, headers.length);
          if (backgroundColor) clientRange.setBackgroundColor(backgroundColor);
          if (fontColor) clientRange.setFontColor(fontColor);
        }
      } else {
        sheetsSkipped++;
      }
    });

    return { success: true, message: 'Template sync completed', newSheetsCreated, sheetsSkipped, totalSheets: templateSheets.length };
  } catch(err) {
    return { success: false, error: 'SYNC_FAILED', message: err.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// PURCHASE IMPORT FROM EXCEL (added v78 — wired to the real H schema, and the
// stock-update step rewritten: the original draft kept a global "last row of
// STOCK_LEDGER" as openingQty regardless of WHICH item, so importing invoice A
// for Item X could silently use Item Y's running balance as the opening
// quantity — a real cross-item stock corruption bug. Fixed to update each
// item's own ITEMS.STOCK directly, the same field every other part of this
// app already treats as the source of truth for on-hand quantity.
// ════════════════════════════════════════════════════════════════════════════════

function IMPORT_PURCHASES_FROM_EXCEL(payload) {
  try {
    const { sheetId, purchaseData } = payload;
    if (!sheetId || !purchaseData || !Array.isArray(purchaseData)) {
      return { success: false, error: 'MISSING_PARAMS', message: 'sheetId and purchaseData array required' };
    }
    if (purchaseData.length === 0) {
      return { success: false, error: 'EMPTY_DATA', message: 'No purchase data to import' };
    }

    const ss = SpreadsheetApp.openById(sheetId);
    const invoices = _groupLineItemsByInvoice(purchaseData);
    const invoiceCount = Object.keys(invoices).length;
    const totalLineItems = purchaseData.length;

    const suppliersCreated = _createSuppliersIfMissing(ss, invoices);
    const itemsCreated = _createItemsIfMissing(ss, purchaseData);
    const saved = _savePurchaseInvoices(ss, invoices);
    const stockUpdated = _updateItemStockFromImportedPurchases_(ss, invoices);

    logAuditEntry(sheetId, 'IMPORT_PURCHASES_FROM_EXCEL', 'PURCHASES', 'BULK_IMPORT',
      `${invoiceCount} invoice(s), ${totalLineItems} line item(s), ${suppliersCreated} new supplier(s), ${itemsCreated} new item(s)`, 'SUCCESS');

    return {
      success: true, message: 'Purchase import completed successfully',
      summary: { invoicesProcessed: invoiceCount, lineItemsProcessed: totalLineItems, suppliersCreated, itemsCreated, invoicesSaved: saved.count, itemsStockUpdated: stockUpdated },
      details: { invoices: invoiceCount, lineItems: totalLineItems, newSuppliers: suppliersCreated, newItems: itemsCreated }
    };
  } catch(err) {
    return { success: false, error: 'IMPORT_FAILED', message: err.message, stack: err.stack };
  }
}

function _groupLineItemsByInvoice(purchaseData) {
  const invoices = {};
  purchaseData.forEach(item => {
    const invoiceNo = String(item['Invoice No.'] || item.invoice_no || '');
    const supplierName = String(item['Party Name (Supplier)'] || item.supplier || '');
    if (!invoiceNo || !supplierName) return;
    const key = invoiceNo + '|' + supplierName;
    if (!invoices[key]) {
      invoices[key] = {
        invoiceNo, supplierName, date: item.Date || new Date().toISOString().split('T')[0],
        mode: item.Mode || 'Credit', courierCharge: Number(item['Courier Charges']) || 0,
        labourCharge: Number(item['Extra Charges']) || 0, lineItems: []
      };
    }
    invoices[key].lineItems.push({
      itemName: String(item['Item Name'] || ''), qty: Number(item.Qty) || 0, rate: Number(item.Rate) || 0,
      gstPercent: Number(item['GST%']) || 0, amount: Number(item.Amount) || 0
    });
  });
  return invoices;
}

function _createSuppliersIfMissing(ss, invoices) {
  const sh = getOrCreateSheet_(ss, 'SUPPLIERS', H.SUPPLIERS);
  const data = sh.getDataRange().getValues();
  const hdrMap = getHeaderIndexMap_(sh);
  const nameCol = hdrMap['NAME'];
  const existingSuppliers = new Set();
  for (let i = 1; i < data.length; i++) existingSuppliers.add(String(data[i][nameCol]||'').toLowerCase());

  const uniqueSuppliers = new Set(Object.values(invoices).map(inv => inv.supplierName));
  let created = 0;
  uniqueSuppliers.forEach(supplierName => {
    if (!existingSuppliers.has(supplierName.toLowerCase())) {
      const supplierId = 'SUP' + Date.now() + Math.floor(Math.random()*1000);
      appendRowFast_(sh, { SUPPLIER_ID: supplierId, ID: supplierId, NAME: supplierName, MOBILE: '', DUE: 0, ADDRESS: '', STATE: '', GSTIN: '' });
      created++;
    }
  });
  return created;
}

function _createItemsIfMissing(ss, purchaseData) {
  const sh = getOrCreateSheet_(ss, 'ITEMS', H.ITEMS);
  const data = sh.getDataRange().getValues();
  const hdrMap = getHeaderIndexMap_(sh);
  const nameCol = hdrMap['NAME'];
  const existingItems = new Set();
  for (let i = 1; i < data.length; i++) existingItems.add(String(data[i][nameCol]||'').toLowerCase());

  const uniqueItems = new Set();
  const itemRates = {};
  purchaseData.forEach(item => {
    const itemName = String(item['Item Name'] || '');
    const rate = Number(item.Rate) || 0;
    if (itemName) {
      uniqueItems.add(itemName);
      if (!itemRates[itemName] || rate > itemRates[itemName]) itemRates[itemName] = rate;
    }
  });

  let created = 0;
  uniqueItems.forEach(itemName => {
    if (!existingItems.has(itemName.toLowerCase())) {
      const itemId = 'ITEM' + Date.now() + Math.floor(Math.random()*1000);
      const rate = itemRates[itemName] || 0;
      appendRowFast_(sh, {
        ID: itemId, NAME: itemName, UNIT: 'Kg', HSN: '', PURCHASE_RATE: rate,
        SALE_RATE: Math.round(rate * 1.2 * 100) / 100, GST_PERCENT: 18, STOCK: 0, OPENING_STOCK: 0, MIN_STOCK: 0, CATEGORY: ''
      });
      created++;
    }
  });
  return created;
}

function _calculateInvoiceTotals(invoice) {
  let taxable = 0, gstTotal = 0, total = 0;
  invoice.lineItems.forEach(item => {
    const amount = item.amount || (item.qty * item.rate);
    const gst = amount * (item.gstPercent / 100);
    taxable += amount; gstTotal += gst; total += amount + gst;
  });
  total += (invoice.courierCharge || 0) + (invoice.labourCharge || 0);
  return { taxable: Math.round(taxable*100)/100, gstTotal: Math.round(gstTotal*100)/100, total: Math.round(total*100)/100 };
}

function _savePurchaseInvoices(ss, invoices) {
  const suppliersSheet = getOrCreateSheet_(ss, 'SUPPLIERS', H.SUPPLIERS);
  const suppliersData = suppliersSheet.getDataRange().getValues();
  const supHdr = getHeaderIndexMap_(suppliersSheet);
  const idCol = supHdr['ID'], nameCol = supHdr['NAME'];
  const supplierMap = {};
  for (let i = 1; i < suppliersData.length; i++) supplierMap[String(suppliersData[i][nameCol])] = String(suppliersData[i][idCol]);

  const sh = getOrCreateSheet_(ss, 'PURCHASES', H.PURCHASES);
  let count = 0;

  for (const key in invoices) {
    const invoice = invoices[key];
    const supplierId = supplierMap[invoice.supplierName] || ('SUP' + Date.now());
    const purchaseId = 'PUR' + Date.now() + Math.floor(Math.random()*1000);
    const totals = _calculateInvoiceTotals(invoice);
    const itemSummary = invoice.lineItems.map(item => `${item.itemName}: ${item.qty}`).join(' | ');

    appendRowFast_(sh, {
      PURCHASE_ID: purchaseId, SUPPLIER_ID: supplierId, SUPPLIER_NAME: invoice.supplierName,
      DATE: invoice.date, INVOICE_NO: invoice.invoiceNo, TOTAL: totals.total, TAXABLE: totals.taxable,
      GST_TOTAL: totals.gstTotal, COURIER_CHARGE: invoice.courierCharge || 0, LABOUR_CHARGE: invoice.labourCharge || 0,
      MODE: invoice.mode || 'Credit', ITEM_SUMMARY: itemSummary, ITEMS_JSON: JSON.stringify(invoice.lineItems),
      TALLY_POSTED: false, TALLY_REFERENCE: ''
    });
    count++;
  }
  return { count, success: true };
}

// Increments each imported item's own ITEMS.STOCK (the field every report/
// sale/purchase path in this app already treats as on-hand qty) instead of
// writing to a separate ledger with a shared, easily-crossed-wire opening
// balance.
function _updateItemStockFromImportedPurchases_(ss, invoices) {
  const sh = getOrCreateSheet_(ss, 'ITEMS', H.ITEMS);
  const data = sh.getDataRange().getValues();
  const hdrMap = getHeaderIndexMap_(sh);
  const nameCol = hdrMap['NAME'], stockCol = hdrMap['STOCK'];

  const rowByNameLower = {};
  for (let i = 1; i < data.length; i++) rowByNameLower[String(data[i][nameCol]||'').toLowerCase()] = i + 1;

  let updated = 0;
  Object.values(invoices).forEach(invoice => {
    invoice.lineItems.forEach(li => {
      const rowNum = rowByNameLower[String(li.itemName||'').toLowerCase()];
      if (!rowNum) return;
      const cell = sh.getRange(rowNum, stockCol + 1);
      const current = Number(cell.getValue()) || 0;
      cell.setValue(Math.round((current + (Number(li.qty)||0)) * 1000) / 1000);
      updated++;
    });
  });
  return updated;
}

function PREPARE_PURCHASE_DATA_FROM_EXCEL(payload) {
  try {
    const rawData = payload.rawData || payload;
    const prepared = [];
    (rawData||[]).forEach(row => {
      if (!row['Date'] || !row['Invoice No.'] || !row['Party Name (Supplier)'] || !row['Item Name']) return;
      prepared.push({
        Date: row['Date'], 'Invoice No.': String(row['Invoice No.']).trim(),
        'Party Name (Supplier)': String(row['Party Name (Supplier)']).trim(), 'Item Name': String(row['Item Name']).trim(),
        'Qty': Number(row['Qty']) || 0, 'Rate': Number(row['Rate']) || 0, 'GST%': Number(row['GST%']) || 0,
        'Mode': String(row['Mode'] || 'Credit').trim(), 'Courier Charges': Number(row['Courier Charges']) || 0,
        'Extra Charges': Number(row['Extra Charges']) || 0, 'Amount': Number(row['Amount']) || 0, 'Grand Total': Number(row['Grand Total']) || 0
      });
    });
    return { success: true, prepared, count: prepared.length,
      message: `Prepared ${prepared.length} line items from ${new Set(prepared.map(r => r['Invoice No.'])).size} invoices` };
  } catch(err) {
    return { success: false, error: 'PREPARE_FAILED', message: err.message };
  }
}
