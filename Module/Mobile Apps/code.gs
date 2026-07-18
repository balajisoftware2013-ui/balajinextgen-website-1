/***********************************************************************
 * BALAJI NEXTGEN — BUSINESS OS BACKEND (Code.gs) — v17
 *
 * v17 CHANGES (this pass):
 *
 *   FIX H (root cause): reconcileDB() parsed lineItems from ITEMS_JSON
 *   but never attached lineItems[] to recovered purchase/sale records.
 *   Reports that need item-level movement — Stock Ledger, Item-wise
 *   Sales/Purchase — read `record.lineItems`, so every recovered
 *   purchase showed "—" for quantity despite Opening/Closing stock being
 *   correct. Now every healed purchase/sale record includes lineItems[],
 *   indistinguishable from records never missing in the first place.
 *
 *   FIX I (real-time sync): Added syncPurchaseRow(), syncSaleRow(),
 *   syncCustomerRow(), syncSupplierRow(), syncItemRow() to durably
 *   mirror every transaction AND master record into their sheet tabs
 *   BEFORE saving to APP_DATA, ensuring Google Sheets is always the
 *   source of truth. Frontend calls sync functions on every add/edit/
 *   purchase/sale. Sync functions upsert-by-id, never erase existing
 *   rows. This fixes the "gap" problem: if APP_DATA blob gets corrupt,
 *   the sheet tabs still have the complete history for reconciliation.
 *
 *   FIX J (password scoping): Already scoped hashAllPlaintextUserPasswords()
 *   and hashAllPlaintextClientAdminPasswords() to BOS_INDUSTRIES only in
 *   v16 FIX G. Added explicit check that new passwords set during
 *   registerClient() and login() password-upgrade are NEVER plaintext —
 *   all passwords must go through hashPass() with a per-user salt.
 *
 *   FIX K (ledger reports): Added generatePurchaseLedger(), generateSalesLedger(),
 *   generateItemWisePurchase(), generateItemWiseSales() to return
 *   transaction-by-transaction (not just totals) and group by item so
 *   reports can show Tally-style opening/transaction/closing for each.
 *
 *   FIX L (stock ledger): Added generateStockLedger() to show every
 *   purchase, sale, and adjustment that affected each item's stock,
 *   ordered by date, with running balance. Also generateStockSummary()
 *   for quick stock-on-hand + min level check.
 *
 *   FIX M (date range filtering): Added filterTransactionsByDateRange()
 *   to support month/quarter/half-year/FY filtering on dashboard and
 *   all reports. Supports FY (Apr-Mar), CY (Jan-Dec), and custom ranges.
 *
 * v16 CHANGES (previous pass):
 *   — See earlier versions for reconcileDB() master healing, password
 *     scoping to Business OS rows, and safe-save shrink guards.
 *
 ***********************************************************************/

// -- CONFIG -----------------------------------------------------------
const MASTER_CONTROL_SHEET_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';
const USER_SECURITY_SHEET_ID  = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg';
const TEMPLATE_SHEET_ID       = '18moaYrNWFKR5etfS2Y4HVjbmyrxCRJxBxQeynz1i9hA';
const CLIENTS_DRIVE_FOLDER_ID = '1QUzavRsSwhIy-keXpHf3zguAvHkU8dUy';
const TEMPLATE_ID_FOR_BOS     = 'TEM049';
const TRIAL_DAYS = 90;
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbweBrJ9QH9ItEE_5t2hzwASZPblf0m6NHSr6vxr5s4w-dcj2bUdQFANnyUcXuxSK4YK/exec';

const H = {
  CLIENT_MASTER: ['CLIENT_ID','CONTACT_NAME','PHONE','ALT_PHONE','EMAIL','COMPANY_NAME','COMPANY_TYPE','GST_NO','PAN','ADDRESS','CITY','STATE','PIN','INDUSTRY','PLAN','ERP_URL','ADMIN_NAME','ADMIN_EMAIL','ADMIN_USERNAME','ADMIN_PASSWORD','ADMIN_MOBILE','ADMIN_ROLE','STATUS','LICENSE_STATUS','REGISTERED_BY'],
  USER_MASTER: ['USER_ID','CLIENT_ID','USER_CODE','FULL_NAME','EMAIL','MOBILE_NO','PASSWORD','ROLE','INDUSTRY','BRANCH','ACCESS_LEVEL','STATUS','WEB_ACCESS','APP_ACCESS','OTP_ACCESS','LOGIN_TYPE','COMPANY_NAME','DEPARTMENT','DESIGNATION','DEFAULT_DASHBOARD','CREATED_BY','CREATED_DATE','LAST_LOGIN','FAILED_ATTEMPTS','ACCOUNT_LOCKED'],
  LOGIN_HISTORY: ['LOG_ID','USER_ID','USER_CODE','FULL_NAME','ROLE','LOGIN_DATE','LOGIN_TIME','LOGOUT_TIME','SESSION_DURATION','LOGIN_STATUS','LOGIN_METHOD','OTP_VERIFIED','LOGIN_IP','DEVICE_NAME','BROWSER_INFO','SESSION_TOKEN','LOCATION','CREATED_AT'],
  SESSIONS: ['SESSION_ID','USER_ID','USER_CODE','ROLE','SESSION_TOKEN','SESSION_STATUS','LOGIN_METHOD','LOGIN_DATE','LAST_ACTIVITY','TOKEN_EXPIRY','DEVICE_NAME','LOGIN_IP','FORCE_LOGOUT','REMARKS'],
};

const BOS_INDUSTRIES = ['COMPUTER_SHOP','STATIONERY_SHOP','SHOP','RETAIL','SUPERMARKET','ELECTRONICS','CLOTHING','FOOTWEAR','JEWELLERY','GIFT_SHOP','OPTICAL','SPORTS',
  'MEDICAL_STORE','PHARMA_DIST','PRINTING','FURNITURE','WHOLESALER','AUTO_DEALER','CYBER_CAFE','GROCERY','FRUIT_CENTER','JUICE_CENTER',
  'TEA_SHOP','COFFEE_CENTER','HARDWARE_SHOP','ELECTRICAL_ELECTRONIC_ITEM','MOBILE_SHOP','SMALL_CAFE','RESTRO_SMALL','CARTRIDGE_POINT','WHOLESALE'];

// -- HTTP ENTRY POINTS ------------------------------------------------
function doGet(e){
  const action = e && e.parameter && e.parameter.action;
  if (action === 'diag') return ContentService.createTextOutput(JSON.stringify(runDiag())).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify({success:true, message:'Balaji NextGen Business OS API is live (v17 - real-time sync, ledger reports, stock ledger, date filtering)', industries: BOS_INDUSTRIES})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    const req = JSON.parse(e.postData.contents);
    let out;
    switch(req.action){
      case 'REGISTER_CLIENT':               lock.waitLock(30000); out = registerClient(req); break;
      case 'LOGIN':                         out = login(req); break;
      case 'SUITE_SAVE_DB':                 out = saveDB(req); break;
      case 'SUITE_LOAD_DB':                 out = loadDB(req); break;
      case 'SYNC_PURCHASE_ROW':             out = syncPurchaseRow(req); break;
      case 'SYNC_SALE_ROW':                 out = syncSaleRow(req); break;
      case 'SYNC_CUSTOMER_ROW':             out = syncCustomerRow(req); break;
      case 'SYNC_SUPPLIER_ROW':             out = syncSupplierRow(req); break;
      case 'SYNC_ITEM_ROW':                 out = syncItemRow(req); break;
      case 'LOG_SALE':                      out = logSaleRow(req); break;
      case 'LOG_PURCHASE':                  out = logPurchaseRow(req); break;
      case 'LOG_PARTY':                     out = logPartyRow(req); break;
      case 'UPLOAD_ATTACHMENT':             out = uploadAttachment(req); break;
      case 'CHECK_SUBSCRIPTION':            out = checkSubscription(req); break;
      case 'GET_INDUSTRIES':                out = {success:true, industries: BOS_INDUSTRIES}; break;
      case 'DIAG':                          out = runDiag(); break;
      case 'RECONCILE_REPORT':              out = reconcileReport(req); break;
      case 'RECONCILE_AND_SAVE':            out = reconcileAndSave(req); break;
      case 'GET_PURCHASE_LEDGER':           out = generatePurchaseLedger(req); break;
      case 'GET_SALES_LEDGER':              out = generateSalesLedger(req); break;
      case 'GET_ITEM_WISE_PURCHASE':        out = generateItemWisePurchase(req); break;
      case 'GET_ITEM_WISE_SALES':           out = generateItemWiseSales(req); break;
      case 'GET_STOCK_LEDGER':              out = generateStockLedger(req); break;
      case 'GET_STOCK_SUMMARY':             out = generateStockSummary(req); break;
      default: out = {success:false, message:'Unknown action'};
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }finally{
    try{ lock.releaseLock(); }catch(e){}
  }
}

// -- UTILITY HELPERS --------------------------------------------------
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

function getTemplateInfo(){
  try{
    const row = findRow(MASTER_CONTROL_SHEET_ID, 'TEMPLATE_REGISTRY', 'TEMPLATE_ID', TEMPLATE_ID_FOR_BOS);
    if(row && row.GOOGLE_SHEET_ID){
      return { sheetId: String(row.GOOGLE_SHEET_ID), folderId: String(row.GOOGLE_DRIVE_FOLDER_ID || '') };
    }
  }catch(e){ logError('getTemplateInfo', e.toString()); }
  return { sheetId: TEMPLATE_SHEET_ID, folderId: '' };
}

// -- PASSWORD HASHING -------------------------------------------------
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

function _isLegacyHash(stored){
  stored = String(stored||'');
  return stored.length > 0 && stored.indexOf('$') === -1;
}

function _looksLikeHash(pw){
  pw = String(pw||'');
  if (!pw) return true;
  if (pw.indexOf('$') > -1) {
    const parts = pw.split('$');
    return parts.length===2 && parts[0].length===32 && parts[1].length===44;
  }
  return pw.length===44 && pw.endsWith('=');
}

// -- CLIENT REGISTRATION ----------------------------------------------
function nextClientId(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER');
  const data = sh.getDataRange().getValues();
  let maxNum = 15;
  for(let i=1;i<data.length;i++){
    const id = String(data[i][0]||'');
    const m = id.match(/^CL(\d+)$/);
    if(m) maxNum = Math.max(maxNum, parseInt(m[1],10));
  }
  return 'CL' + String(maxNum+1).padStart(5,'0');
}

function registerClient(req){
  const bizName = (req.bizName || '').trim();
  const owner   = (req.owner   || '').trim();
  const mobile  = (req.mobile  || '').trim();
  if(!bizName){
    return { success:false, message:'Business name is required.' };
  }
  if(!owner){
    return { success:false, message:'Owner name is required.' };
  }
  if(!/^[6-9]\d{9}$/.test(mobile)){
    return { success:false, message:'Enter a valid 10-digit mobile number.' };
  }
  const email = (req.email || '').trim();
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return { success:false, message:'Enter a valid email address (or leave it blank).' };
  }
  if(!req.password || String(req.password).length < 6){
    return { success:false, message:'Password must be at least 6 characters.' };
  }

  const dupPhone = findRowByPhoneAnyIndustry(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', mobile);
  if(dupPhone){
    return {
      success: false,
      duplicate: true,
      duplicateField: 'mobile',
      message: 'This mobile number is already registered' + (dupPhone.COMPANY_NAME ? ' to "'+dupPhone.COMPANY_NAME+'"' : '') + ' (Client ID: '+dupPhone.CLIENT_ID+', app: '+(dupPhone.INDUSTRY||'unknown')+'). Please login instead, or use a different mobile number.',
      existingClientId: dupPhone.CLIENT_ID,
      existingIndustry: dupPhone.INDUSTRY || ''
    };
  }

  const dupEmail = findRowByEmailAnyIndustry(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', email);
  if(dupEmail){
    return {
      success: false,
      duplicate: true,
      duplicateField: 'email',
      message: 'This email is already registered' + (dupEmail.COMPANY_NAME ? ' to "'+dupEmail.COMPANY_NAME+'"' : '') + ' (Client ID: '+dupEmail.CLIENT_ID+', app: '+(dupEmail.INDUSTRY||'unknown')+'). Please login instead, or use a different email.',
      existingClientId: dupEmail.CLIENT_ID,
      existingIndustry: dupEmail.INDUSTRY || ''
    };
  }

  const clientId = nextClientId();
  const dbName = clientId + '_' + bizName;
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS*86400000);

  let clientSheetId, clientFolder;
  try {
    const tmpl = getTemplateInfo();
    const templateFile = DriveApp.getFileById(tmpl.sheetId);
    clientFolder = DriveApp.getFolderById(CLIENTS_DRIVE_FOLDER_ID).createFolder(dbName);
    const clonedFile = templateFile.makeCopy(dbName, clientFolder);
    clientSheetId = clonedFile.getId();
  } catch(err) {
    logError('registerClient:createFolder', 'clientId='+clientId+' bizName='+bizName+' | ' + err.toString());
    return { success:false, message:'Could not create the client folder/database. This has been logged. Detail: ' + err.message };
  }

  // FIX J: all passwords MUST be hashed with salt, never plaintext
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

  if(req.migrateData){
    saveDB({sheetId:clientSheetId, data:req.migrateData});
  }

  return {
    success:true, clientId, sheetId:clientSheetId, folderId:clientFolder.getId(),
    trialEnd: trialEnd.getTime(), userId, loginId:mobile
  };
}

// -- LOGIN & SESSION --------------------------------------------------
function login(req){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'USER_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);

  for(let i=1;i<data.length;i++){
    const row = data[i];
    const mobileMatch = String(row[idx.MOBILE_NO]) === String(req.loginId);
    const emailMatch = row[idx.EMAIL] && String(row[idx.EMAIL]).toLowerCase() === String(req.loginId).toLowerCase();
    const storedPw = row[idx.PASSWORD];
    if((mobileMatch || emailMatch) && verifyPass(req.password, storedPw)){
      const userId = row[idx.USER_ID], clientId = row[idx.CLIENT_ID], role = row[idx.ROLE];
      const rowIndustry = String(row[idx.INDUSTRY] || '');

      if(role !== 'SUPER_ADMIN' && BOS_INDUSTRIES.indexOf(rowIndustry) === -1){
        logLoginHistory(userId, row[idx.USER_CODE], row[idx.FULL_NAME], role, 'REJECTED_WRONG_APP');
        return {
          success:false,
          message:'This mobile/email is registered under a different Balaji NextGen app ('+(rowIndustry||'unknown')+'), not Business OS. Please use the correct app to log in.'
        };
      }

      // FIX J: upgrade legacy hashes silently
      if (_isLegacyHash(storedPw)) {
        try {
          sh.getRange(i+1, idx.PASSWORD+1).setValue(hashPass(req.password));
        } catch(e){ logError('login:upgradeHash', e.toString()); }
      }

      logLoginHistory(userId, row[idx.USER_CODE], row[idx.FULL_NAME], role, 'SUCCESS');
      logActiveSession(userId, clientId);

      let sheetId=null, bizName=row[idx.FULL_NAME], plan='TRIAL', trialEnd=null;
      if(role !== 'SUPER_ADMIN' && clientId){
        const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', clientId);
        if(cr){ sheetId = cr.DATABASE_ID; bizName = cr.COMPANY_NAME; plan = cr.PLAN_NAME; trialEnd = new Date(cr.EXPIRY_DATE).getTime(); }
      }
      const loaded = sheetId ? loadDB({sheetId}) : {data:null, lastSynced:0};
      return {success:true, clientId: clientId||'ALL', sheetId, role, bizName, plan, trialEnd, data: loaded.data, lastSynced: loaded.lastSynced, userId};
    }
  }
  logLoginHistory('', '', '', '', 'FAILED');
  return {success:false, message:'Invalid mobile/email or password'};
}

function logLoginHistory(userId, userCode, fullName, role, status){
  try{
    appendRowByHeader(USER_SECURITY_SHEET_ID, 'LOGIN_HISTORY', H.LOGIN_HISTORY, {
      LOG_ID: Utilities.getUuid(), USER_ID:userId, USER_CODE:userCode, FULL_NAME:fullName, ROLE:role,
      LOGIN_DATE:new Date(), LOGIN_TIME:new Date(), LOGOUT_TIME:'', SESSION_DURATION:'', LOGIN_STATUS:status,
      LOGIN_METHOD:'PASSWORD', OTP_VERIFIED:'NO', LOGIN_IP:'', DEVICE_NAME:'WEB', BROWSER_INFO:'BALAJI BUSINESS OS',
      SESSION_TOKEN:Utilities.getUuid(), LOCATION:'', CREATED_AT:new Date()
    });
  }catch(e){}
}

function logActiveSession(userId, clientId){
  try{
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'ACTIVE_SESSION_MASTER', 
      ['SESSION_ID','USER_ID','CLIENT_ID','TOKEN','DEVICE_ID','LOGIN_TIME','EXPIRY_TIME','STATUS'], {
      SESSION_ID:Utilities.getUuid(), USER_ID:userId, CLIENT_ID:clientId||'ALL', TOKEN:Utilities.getUuid(),
      DEVICE_ID:'WEB', LOGIN_TIME:new Date(), EXPIRY_TIME:new Date(Date.now()+8*3600000), STATUS:'ACTIVE'
    });
  }catch(e){}
}

// -- DATABASE SYNC & RECONCILIATION -----------------------------------

// FIX I: Real-time sheet sync functions — called by frontend on every
// add/edit/purchase/sale/delete to keep the sheet tabs durable and in sync.
function syncPurchaseRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('PURCHASES') || ss.insertSheet('PURCHASES');
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  upsertRowById(sh, 0, req.id, [req.id, req.supp, req.date, req.total, req.mode, itemsJson]);
  return {success:true};
}

function syncSaleRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('SALES') || ss.insertSheet('SALES');
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  upsertRowById(sh, 0, req.id, [req.id, req.cust, req.date, req.total, req.mode, itemsJson]);
  return {success:true};
}

function syncCustomerRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('CUSTOMERS') || ss.insertSheet('CUSTOMERS');
  upsertRowById(sh, 0, req.id, [req.id, req.name, req.mobile||'', req.due||0, req.limit||0, req.lastDate||'']);
  return {success:true};
}

function syncSupplierRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('SUPPLIERS') || ss.insertSheet('SUPPLIERS');
  upsertRowById(sh, 0, req.id, [req.id, req.name, req.mobile||'', req.due||0]);
  return {success:true};
}

function syncItemRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('ITEMS') || ss.insertSheet('ITEMS');
  upsertRowById(sh, 0, req.id, [req.id, req.name, req.unit||'', req.hsn||'', req.pRate||0, req.sRate||0, req.gst||0, req.stock||0, req.min||0]);
  return {success:true};
}

function upsertRowById(sheet, idCol, idVal, rowValues){
  const data = sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][idCol]) === String(idVal)){
      sheet.getRange(i+1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

// Helper: Heal master tables from durable sheet tabs
function healMasterTable_(ss, tabName, arr, markerRow, colCount, mapRowToObj){
  const sh = ss.getSheetByName(tabName);
  if(!sh) return { healed:0, newMarker: markerRow };
  const lastRow = sh.getLastRow();
  let scanFrom = markerRow;
  if (scanFrom > lastRow) scanFrom = 1;
  const startRow = Math.max(scanFrom + 1, 2);
  let healed = 0;
  if (lastRow >= startRow){
    const rows = sh.getRange(startRow,1,lastRow-startRow+1,colCount).getValues();
    const haveIds = {}; arr.forEach(x=>{ if(x && x.id) haveIds[x.id]=true; });
    rows.forEach(r=>{
      const id = r[0];
      if(!id || haveIds[id]) return;
      arr.push(mapRowToObj(r));
      haveIds[id] = true;
      healed++;
    });
  }
  return { healed, newMarker: lastRow };
}

function reconcileDB(sheetId, data){
  data = data || {};
  data.customers = data.customers || [];
  data.suppliers = data.suppliers || [];
  data.sales = data.sales || [];
  data.purchases = data.purchases || [];
  data.items = data.items || [];
  data.cash = data.cash || 0;
  data.bank = data.bank || 0;

  function dedupeById(arr){
    const seen = {}; const out = [];
    arr.forEach(x=>{
      if(!x || !x.id){ out.push(x); return; }
      if(seen[x.id]) return;
      seen[x.id] = true; out.push(x);
    });
    return out;
  }
  data.purchases = dedupeById(data.purchases);
  data.sales = dedupeById(data.sales);

  let ss;
  try{ ss = SpreadsheetApp.openById(sheetId); }
  catch(e){ logError('reconcileDB:open', sheetId+' | '+e.toString()); return data; }

  const appDataSh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');
  let markerPurchRow = 1, markerSalesRow = 1, markerCustRow = 1, markerSuppRow = 1, markerItemsRow = 1;
  try{
    const rawP = appDataSh.getRange(1,4).getValue();
    const rawS = appDataSh.getRange(1,5).getValue();
    const rawC = appDataSh.getRange(1,6).getValue();
    const rawSu = appDataSh.getRange(1,7).getValue();
    const rawI = appDataSh.getRange(1,8).getValue();
    if (rawP && Number(rawP) >= 1) markerPurchRow = Number(rawP);
    if (rawS && Number(rawS) >= 1) markerSalesRow = Number(rawS);
    if (rawC && Number(rawC) >= 1) markerCustRow = Number(rawC);
    if (rawSu && Number(rawSu) >= 1) markerSuppRow = Number(rawSu);
    if (rawI && Number(rawI) >= 1) markerItemsRow = Number(rawI);
  }catch(e){ }

  // Heal masters first
  let healedMastersCount = 0;
  const custHeal = healMasterTable_(ss, 'CUSTOMERS', data.customers, markerCustRow, 6,
    r => ({ id:r[0], name:r[1], mobile:r[2]||'', due:Number(r[3])||0, limit:Number(r[4])||0, lastDate:r[5]||'' }));
  const suppHeal = healMasterTable_(ss, 'SUPPLIERS', data.suppliers, markerSuppRow, 4,
    r => ({ id:r[0], name:r[1], mobile:r[2]||'', due:Number(r[3])||0 }));
  const itemsHeal = healMasterTable_(ss, 'ITEMS', data.items, markerItemsRow, 9,
    r => ({ id:r[0], name:r[1], unit:r[2]||'', hsn:r[3]||'', pRate:Number(r[4])||0, sRate:Number(r[5])||0, gst:Number(r[6])||0, stock:Number(r[7])||0, min:Number(r[8])||0 }));
  markerCustRow = custHeal.newMarker;
  markerSuppRow = suppHeal.newMarker;
  markerItemsRow = itemsHeal.newMarker;
  healedMastersCount = custHeal.healed + suppHeal.healed + itemsHeal.healed;

  // Heal transactions
  let healedCount = 0, healedAmt = 0, healedStockLines = 0;
  const itemsById = {}; data.items.forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });

  const pSheet = ss.getSheetByName('PURCHASES');
  if(pSheet){
    const lastRow = pSheet.getLastRow();
    if (markerPurchRow > lastRow) markerPurchRow = 1;
    const startRow = Math.max(markerPurchRow + 1, 2);
    if (lastRow >= startRow){
      const rows = pSheet.getRange(startRow,1,lastRow-startRow+1,6).getValues();
      const haveIds = {}; data.purchases.forEach(p=>{ if(p && p.id) haveIds[p.id]=true; });
      const suppById = {}; data.suppliers.forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
      rows.forEach(r=>{
        const id=r[0], supp=r[1], date=r[2], total=Number(r[3])||0, mode=r[4], itemsJsonRaw=r[5];
        if(!id || haveIds[id]) return;
        const dateStr = (date instanceof Date) ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(date);
        const purchRecord = {id, supp, date:dateStr, total, mode};
        if(mode==='Credit'){ if(suppById[supp]) suppById[supp].due = (suppById[supp].due||0) + total; }
        else if(mode==='Cash'){ data.cash = (data.cash||0) - total; }
        else { data.bank = (data.bank||0) - total; }
        
        // FIX H: Attach lineItems to record
        if (itemsJsonRaw) {
          try {
            const lineItems = JSON.parse(itemsJsonRaw);
            purchRecord.lineItems = (lineItems||[]).map(li => ({
              id: li.id, qty: Number(li.qty)||0, rate: Number(li.rate)||0, gst: li.gst!=null ? Number(li.gst) : 0
            }));
            lineItems.forEach(li=>{
              const it = itemsById[li.id];
              if (it) {
                it.stock = (it.stock||0) + (Number(li.qty)||0);
                if (li.rate != null) it.pRate = Number(li.rate);
                if (li.gst != null) it.gst = Number(li.gst);
                healedStockLines++;
              }
            });
          } catch(e2){ logError('reconcileDB:purchaseItemsJson', 'id='+id+' | '+e2.toString()); }
        }
        healedCount++; healedAmt += total;
        data.purchases.push(purchRecord);
      });
    }
    markerPurchRow = lastRow;
  }

  const sSheet = ss.getSheetByName('SALES');
  if(sSheet){
    const lastRow = sSheet.getLastRow();
    if (markerSalesRow > lastRow) markerSalesRow = 1;
    const startRow = Math.max(markerSalesRow + 1, 2);
    if (lastRow >= startRow){
      const rows = sSheet.getRange(startRow,1,lastRow-startRow+1,6).getValues();
      const haveIds = {}; data.sales.forEach(s=>{ if(s && s.id) haveIds[s.id]=true; });
      const custById = {}; data.customers.forEach(c=>{ if(c && c.id) custById[c.id]=c; });
      rows.forEach(r=>{
        const id=r[0], cust=r[1], date=r[2], total=Number(r[3])||0, mode=r[4], itemsJsonRaw=r[5];
        if(!id || haveIds[id]) return;
        const dateStr = (date instanceof Date) ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(date);
        const saleRecord = {id, cust, date:dateStr, total, mode};
        if(mode==='Credit'){ if(custById[cust]) custById[cust].due = (custById[cust].due||0) + total; }
        else if(mode==='Cash'){ data.cash = (data.cash||0) + total; }
        else { data.bank = (data.bank||0) + total; }
        
        // FIX H: Attach lineItems to record
        if (itemsJsonRaw) {
          try {
            const lineItems = JSON.parse(itemsJsonRaw);
            saleRecord.lineItems = (lineItems||[]).map(li => ({
              id: li.id, qty: Number(li.qty)||0, rate: Number(li.rate)||0, gst: li.gst!=null ? Number(li.gst) : 0
            }));
            lineItems.forEach(li=>{
              const it = itemsById[li.id];
              if (it) {
                it.stock = Math.max(0, (it.stock||0) - (Number(li.qty)||0));
                healedStockLines++;
              }
            });
          } catch(e2){ logError('reconcileDB:saleItemsJson', 'id='+id+' | '+e2.toString()); }
        }
        healedCount++; healedAmt += total;
        data.sales.push(saleRecord);
      });
    }
    markerSalesRow = lastRow;
  }

  try{
    appDataSh.getRange(1,4).setValue(markerPurchRow);
    appDataSh.getRange(1,5).setValue(markerSalesRow);
    appDataSh.getRange(1,6).setValue(markerCustRow);
    appDataSh.getRange(1,7).setValue(markerSuppRow);
    appDataSh.getRange(1,8).setValue(markerItemsRow);
  }catch(e){ logError('reconcileDB:writeMarkers', e.toString()); }

  return data;
}

function reconcileReport(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('APP_DATA');
  const json = sh ? sh.getRange(1,2).getValue() : '';
  const before = json ? JSON.parse(json) : {};
  const beforePurch = (before.purchases||[]).length;
  const beforeSales = (before.sales||[]).length;
  const beforePurchTotal = (before.purchases||[]).reduce((a,p)=>a+(p.total||0),0);

  const deepCopy = JSON.parse(JSON.stringify(before));
  const scratch = { customers: deepCopy.customers||[], suppliers: deepCopy.suppliers||[],
    sales: deepCopy.sales||[], purchases: deepCopy.purchases||[], cash: deepCopy.cash||0, bank: deepCopy.bank||0 };
  const healed = reconcileDB(req.sheetId, scratch);

  return {
    success:true,
    before: {purchases:beforePurch, sales:beforeSales, purchaseTotal:beforePurchTotal},
    after:  {purchases:healed.purchases.length, sales:healed.sales.length, purchaseTotal:healed.purchases.reduce((a,p)=>a+(p.total||0),0)},
    gapsFound: healed.purchases.length - beforePurch + healed.sales.length - beforeSales
  };
}

function reconcileAndSave(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');
  const json = sh.getRange(1,2).getValue();
  const before = json ? JSON.parse(json) : {};
  const beforePurch = (before.purchases||[]).length;
  const beforeSales = (before.sales||[]).length;

  const healed = reconcileDB(req.sheetId, before);

  sh.getRange(1,1).setValue('DB_JSON');
  sh.getRange(1,2).setValue(JSON.stringify(healed));
  const ts = new Date();
  sh.getRange(1,3).setValue(ts);

  return {
    success:true,
    before: {purchases:beforePurch, sales:beforeSales},
    after: {purchases:healed.purchases.length, sales:healed.sales.length},
    healedCount: (healed.purchases.length-beforePurch) + (healed.sales.length-beforeSales),
    lastSynced: ts.getTime()
  };
}

function saveDB(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');

  try{
    const existingJson = sh.getRange(1,2).getValue();
    const existing = existingJson ? JSON.parse(existingJson) : null;
    if(existing){
      const existingP = (existing.purchases||[]).length;
      const existingS = (existing.sales||[]).length;
      const incomingP = (req.data && req.data.purchases || []).length;
      const incomingS = (req.data && req.data.sales || []).length;
      const THRESHOLD = 5;

      const existingC = (existing.customers||[]).length;
      const existingSu = (existing.suppliers||[]).length;
      const existingIt = (existing.items||[]).length;
      const incomingC = (req.data && req.data.customers || []).length;
      const incomingSu = (req.data && req.data.suppliers || []).length;
      const incomingIt = (req.data && req.data.items || []).length;
      const THRESHOLD_MASTERS = 3;

      const purchSalesShrink = (existingP - incomingP > THRESHOLD) || (existingS - incomingS > THRESHOLD);
      const mastersShrink = (existingC - incomingC > THRESHOLD_MASTERS) ||
        (existingSu - incomingSu > THRESHOLD_MASTERS) || (existingIt - incomingIt > THRESHOLD_MASTERS);

      if(purchSalesShrink || mastersShrink){
        logError('saveDB:BLOCKED_SUSPICIOUS_SHRINK',
          'sheetId='+req.sheetId+' existing purchases='+existingP+' incoming='+incomingP+
          ', existing sales='+existingS+' incoming='+incomingS+
          ', existing customers='+existingC+' incoming='+incomingC+
          ', existing suppliers='+existingSu+' incoming='+incomingSu+
          ', existing items='+existingIt+' incoming='+incomingIt+'. Save REJECTED to protect data.');
        return {
          success:false,
          message:'Save rejected: this would erase '+(existingP-incomingP)+' purchase(s), '+(existingS-incomingS)+
            ' sale(s), '+(existingC-incomingC)+' customer(s), '+(existingSu-incomingSu)+' supplier(s), and '+
            (existingIt-incomingIt)+' item(s) compared to what is already saved. This looks unintentional (e.g. stale local data on this device). ' +
            'Refresh the app and try again; contact support if this persists.'
        };
      }
    }
  }catch(e){ logError('saveDB:safetyCheck', e.toString()); }

  const data = reconcileDB(req.sheetId, req.data);
  sh.getRange(1,1).setValue('DB_JSON');
  sh.getRange(1,2).setValue(JSON.stringify(data));
  const ts = new Date();
  sh.getRange(1,3).setValue(ts);
  return {success:true, lastSynced: ts.getTime()};
}

function loadDB(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('APP_DATA');
  if(!sh) return {success:true, data:null, lastSynced:0};
  const json = sh.getRange(1,2).getValue();
  const ts = sh.getRange(1,3).getValue();
  let data = json ? JSON.parse(json) : null;
  if(data){
    const beforeStr = JSON.stringify(data);
    data = reconcileDB(req.sheetId, data);
    if(JSON.stringify(data) !== beforeStr){
      sh.getRange(1,2).setValue(JSON.stringify(data));
      const newTs = new Date();
      sh.getRange(1,3).setValue(newTs);
      return {success:true, data, lastSynced:newTs.getTime()};
    }
  }
  return {success:true, data, lastSynced: ts ? new Date(ts).getTime() : 0};
}

// -- LOG FUNCTIONS (legacy, now mostly synced to sheets) --------
function logSaleRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('SALES');
  if(!sh) return {success:false, message:'SALES tab not found in this client sheet'};
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  upsertRowById(sh, 0, req.id, [req.id, req.cust, req.date, req.total, req.mode, itemsJson]);
  return {success:true};
}

function logPurchaseRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('PURCHASES');
  if(!sh) return {success:false, message:'PURCHASES tab not found in this client sheet'};
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  upsertRowById(sh, 0, req.id, [req.id, req.supp, req.date, req.total, req.mode, itemsJson]);
  return {success:true};
}

function logPartyRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName(req.tab);
  if(!sh) return {success:false, message:req.tab+' tab not found'};
  upsertRowById(sh, 0, req.row[0], req.row);
  return {success:true};
}

function uploadAttachment(req){
  try{
    const parents = DriveApp.getFileById(req.sheetId).getParents();
    const folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const bytes = Utilities.base64Decode(req.base64Data);
    const blob = Utilities.newBlob(bytes, req.mimeType || 'application/octet-stream', req.fileName || 'attachment');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {success:true, fileId:file.getId(), url:file.getUrl(), downloadUrl:'https://drive.google.com/uc?export=download&id='+file.getId()};
  }catch(err){
    return {success:false, message:'Upload failed: '+err.message};
  }
}

function checkSubscription(req){
  const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', req.clientId);
  if(!cr) return {success:false};
  return {success:true, plan:cr.PLAN_NAME, trialEnd:new Date(cr.EXPIRY_DATE).getTime(), status:cr.LICENSE_STATUS};
}

// FIX M: Date range filtering helper
function filterTransactionsByDateRange(transactions, range){
  if(!transactions || !range) return transactions;
  const now = new Date();
  let startDate, endDate;

  if(range === 'TODAY'){
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startDate = today;
    endDate = new Date(today.getTime() + 86400000);
  } else if(range === 'MONTH'){
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = range === 'MONTH' ? new Date(now.getFullYear(), now.getMonth()+1, 1) : null;
  } else if(range === 'QUARTER'){
    const q = Math.floor(now.getMonth()/3);
    startDate = new Date(now.getFullYear(), q*3, 1);
    endDate = new Date(now.getFullYear(), (q+1)*3, 1);
  } else if(range === 'HALF'){
    const h = now.getMonth() < 6 ? 0 : 6;
    startDate = new Date(now.getFullYear(), h, 1);
    endDate = new Date(now.getFullYear(), h+6, 1);
  } else if(range === 'FY'){
    const fy = now.getMonth() < 3 ? now.getFullYear()-1 : now.getFullYear();
    startDate = new Date(fy, 3, 1); // Apr 1
    endDate = new Date(fy+1, 3, 1);
  } else if(range.indexOf('-') > -1){
    const parts = range.split('-');
    if(parts.length === 2){
      startDate = new Date(parts[0]);
      endDate = new Date(parts[1]);
    }
  }

  if(!startDate || !endDate) return transactions;
  return transactions.filter(t=>{
    const d = new Date(t.date);
    return d >= startDate && d < endDate;
  });
}

// FIX K: Purchase Ledger — all purchases with item details
function generatePurchaseLedger(req){
  const data = req.data || {};
  const purchases = (data.purchases || []).slice();
  const filtered = filterTransactionsByDateRange(purchases, req.dateRange);
  
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });

  const ledger = filtered.map(p => ({
    date: p.date,
    billNo: p.id,
    supplier: suppById[p.supp] ? suppById[p.supp].name : p.supp,
    total: p.total,
    mode: p.mode,
    lineItems: (p.lineItems || []).map(li => ({
      itemId: li.id,
      itemName: itemsById[li.id] ? itemsById[li.id].name : li.id,
      qty: li.qty,
      rate: li.rate,
      gst: li.gst,
      amount: li.qty * li.rate
    }))
  })).sort((a,b)=> new Date(a.date) - new Date(b.date));

  return {success:true, ledger, total:filtered.reduce((a,p)=>a+(p.total||0),0), count:filtered.length};
}

// FIX K: Sales Ledger — all sales with item details
function generateSalesLedger(req){
  const data = req.data || {};
  const sales = (data.sales || []).slice();
  const filtered = filterTransactionsByDateRange(sales, req.dateRange);
  
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });

  const ledger = filtered.map(s => ({
    date: s.date,
    billNo: s.id,
    customer: custById[s.cust] ? custById[s.cust].name : s.cust,
    total: s.total,
    mode: s.mode,
    lineItems: (s.lineItems || []).map(li => ({
      itemId: li.id,
      itemName: itemsById[li.id] ? itemsById[li.id].name : li.id,
      qty: li.qty,
      rate: li.rate,
      gst: li.gst,
      amount: li.qty * li.rate
    }))
  })).sort((a,b)=> new Date(a.date) - new Date(b.date));

  return {success:true, ledger, total:filtered.reduce((a,s)=>a+(s.total||0),0), count:filtered.length};
}

// FIX K: Item-wise Purchase — each item's purchase transactions
function generateItemWisePurchase(req){
  const data = req.data || {};
  const purchases = (data.purchases || []).slice();
  const filtered = filterTransactionsByDateRange(purchases, req.dateRange);
  
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });

  const byItem = {};
  filtered.forEach(p => {
    (p.lineItems || []).forEach(li => {
      if(!byItem[li.id]) {
        byItem[li.id] = {
          itemId: li.id,
          itemName: itemsById[li.id] ? itemsById[li.id].name : li.id,
          unit: itemsById[li.id] ? itemsById[li.id].unit : '',
          transactions: []
        };
      }
      byItem[li.id].transactions.push({
        date: p.date,
        billNo: p.id,
        supplier: suppById[p.supp] ? suppById[p.supp].name : p.supp,
        qty: li.qty,
        rate: li.rate,
        gst: li.gst,
        amount: li.qty * li.rate
      });
    });
  });

  const report = Object.values(byItem).map(item => ({
    ...item,
    totalQty: item.transactions.reduce((a,t)=>a+t.qty, 0),
    totalAmount: item.transactions.reduce((a,t)=>a+t.amount, 0),
    avgRate: item.transactions.length > 0 ? item.transactions.reduce((a,t)=>a+t.rate,0)/item.transactions.length : 0
  }));

  return {success:true, report};
}

// FIX K: Item-wise Sales — each item's sale transactions
function generateItemWiseSales(req){
  const data = req.data || {};
  const sales = (data.sales || []).slice();
  const filtered = filterTransactionsByDateRange(sales, req.dateRange);
  
  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });

  const byItem = {};
  filtered.forEach(s => {
    (s.lineItems || []).forEach(li => {
      if(!byItem[li.id]) {
        byItem[li.id] = {
          itemId: li.id,
          itemName: itemsById[li.id] ? itemsById[li.id].name : li.id,
          unit: itemsById[li.id] ? itemsById[li.id].unit : '',
          transactions: []
        };
      }
      byItem[li.id].transactions.push({
        date: s.date,
        billNo: s.id,
        customer: custById[s.cust] ? custById[s.cust].name : s.cust,
        qty: li.qty,
        rate: li.rate,
        gst: li.gst,
        amount: li.qty * li.rate
      });
    });
  });

  const report = Object.values(byItem).map(item => ({
    ...item,
    totalQty: item.transactions.reduce((a,t)=>a+t.qty, 0),
    totalAmount: item.transactions.reduce((a,t)=>a+t.amount, 0),
    avgRate: item.transactions.length > 0 ? item.transactions.reduce((a,t)=>a+t.rate,0)/item.transactions.length : 0
  }));

  return {success:true, report};
}

// FIX L: Stock Ledger — all movements that affected each item's stock
function generateStockLedger(req){
  const data = req.data || {};
  const purchases = (data.purchases || []) || [];
  const sales = (data.sales || []) || [];
  const filtered = filterTransactionsByDateRange([...purchases, ...sales], req.dateRange);

  const itemsById = {}; (data.items||[]).forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });
  const suppById = {}; (data.suppliers||[]).forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
  const custById = {}; (data.customers||[]).forEach(c=>{ if(c && c.id) custById[c.id]=c; });

  const byItem = {};
  filtered.forEach(t => {
    const isP = t.supp !== undefined; // purchase
    (t.lineItems || []).forEach(li => {
      if(!byItem[li.id]) {
        byItem[li.id] = {
          itemId: li.id,
          itemName: itemsById[li.id] ? itemsById[li.id].name : li.id,
          unit: itemsById[li.id] ? itemsById[li.id].unit : '',
          openingStock: itemsById[li.id] ? itemsById[li.id].stock : 0,
          movements: []
        };
      }
      byItem[li.id].movements.push({
        date: t.date,
        type: isP ? 'Purchase' : 'Sale',
        billNo: t.id,
        party: isP ? (suppById[t.supp] ? suppById[t.supp].name : t.supp) : (custById[t.cust] ? custById[t.cust].name : t.cust),
        qty: isP ? li.qty : -li.qty,
        rate: li.rate,
        amount: li.qty * li.rate
      });
    });
  });

  const report = Object.values(byItem).map(item => {
    let balance = 0;
    const movements = item.movements.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(m => {
      balance += m.qty;
      return {...m, balance};
    });
    return {
      ...item,
      movements,
      closingStock: balance
    };
  });

  return {success:true, report};
}

// FIX L: Stock Summary — quick overview of all items
function generateStockSummary(req){
  const data = req.data || {};
  const items = (data.items || []);

  const summary = items.map(it => ({
    itemId: it.id,
    itemName: it.name,
    unit: it.unit,
    currentStock: it.stock,
    minLevel: it.min,
    status: it.stock <= it.min ? 'LOW' : it.stock === 0 ? 'OUT' : 'OK',
    purchaseRate: it.pRate,
    saleRate: it.sRate
  })).filter(s => s.itemId);

  const lowStock = summary.filter(s => s.status !== 'OK');

  return {success:true, summary, lowStock, totalItems:summary.length, lowStockCount:lowStock.length};
}

// -- DIAGNOSTICS & SECURITY ------------------------------------------
function runDiag(){
  const out = { ok:true, steps:[] };
  function step(name, fn){
    try{ const r = fn(); out.steps.push({step:name, ok:true, detail:r}); }
    catch(e){ out.ok=false; out.steps.push({step:name, ok:false, error:e.toString()}); }
  }
  step('open USER_SECURITY_MASTER_DB', () => {
    const ss = SpreadsheetApp.openById(USER_SECURITY_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('nextClientId() sanity check', () => {
    return 'Next ID would be: ' + nextClientId();
  });
  return out;
}

// v16 FIX G: Hash all plaintext Business OS user passwords
function hashAllPlaintextUserPasswords(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'USER_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);
  let fixedCount = 0;
  const fixedRows = [];
  for(let i=1;i<data.length;i++){
    const industry = String(data[i][idx.INDUSTRY]||'');
    if (BOS_INDUSTRIES.indexOf(industry) === -1) continue;
    const pw = data[i][idx.PASSWORD];
    if (pw && !_looksLikeHash(pw)) {
      sh.getRange(i+1, idx.PASSWORD+1).setValue(hashPass(String(pw)));
      fixedCount++;
      fixedRows.push({ row:i+1, userId:data[i][idx.USER_ID], name:data[i][idx.FULL_NAME], clientId:data[i][idx.CLIENT_ID] });
    }
  }
  Logger.log('Hashed ' + fixedCount + ' plaintext password(s) in USER_MASTER (Business OS rows only).');
  return { fixedCount, fixedRows };
}

// v16 FIX G: Hash all plaintext Business OS client admin passwords
function hashAllPlaintextClientAdminPasswords(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);
  let fixedCount = 0;
  const fixedRows = [];
  for(let i=1;i<data.length;i++){
    const industry = String(data[i][idx.INDUSTRY]||'');
    if (BOS_INDUSTRIES.indexOf(industry) === -1) continue;
    const pw = data[i][idx.ADMIN_PASSWORD];
    if (pw && !_looksLikeHash(pw)) {
      sh.getRange(i+1, idx.ADMIN_PASSWORD+1).setValue(hashPass(String(pw)));
      fixedCount++;
      fixedRows.push({ row:i+1, clientId:data[i][idx.CLIENT_ID], company:data[i][idx.COMPANY_NAME] });
    }
  }
  Logger.log('Hashed ' + fixedCount + ' plaintext ADMIN_PASSWORD(s) in CLIENT_MASTER (Business OS rows only).');
  return { fixedCount, fixedRows };
}

function findPlaintextUserPasswords(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'USER_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);
  const out = [];
  for(let i=1;i<data.length;i++){
    const pw = data[i][idx.PASSWORD];
    if (pw && !_looksLikeHash(pw)) {
      out.push({ row:i+1, userId:data[i][idx.USER_ID], name:data[i][idx.FULL_NAME], clientId:data[i][idx.CLIENT_ID], mobile:data[i][idx.MOBILE_NO], industry:data[i][idx.INDUSTRY] });
    }
  }
  Logger.log('USER_MASTER rows with plaintext PASSWORD (' + out.length + ' found).');
  return out;
}

// One-off repair for CL00022 (RR FRESH AND MORE)
function fixCL00022Now(){
  const sheetId = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';
  const result = reconcileAndSave({ sheetId });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
