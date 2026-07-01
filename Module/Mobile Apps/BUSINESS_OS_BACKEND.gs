/***********************************************************************
 * BALAJI NEXTGEN — BUSINESS OS BACKEND (Code.gs) — v2
 * Rebuilt using your ACTUAL sheet headers (read from the xlsx you shared).
 * Deploy as Web App → Execute as: Me → Who has access: Anyone
 * Keep the SAME /exec URL you already gave me — it's already wired into
 * balaji-business-os.html as GAS_URL.
 ***********************************************************************/

// ── CONFIG ─────────────────────────────────────────────────────────
const MASTER_CONTROL_SHEET_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I'; // BALAJI_ERP_MASTER_CONTROL_SYSTEM
const USER_SECURITY_SHEET_ID  = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg'; // USER_SECURITY_MASTER_DB
const TEMPLATE_SHEET_ID       = '18moaYrNWFKR5etfS2Y4HVjbmyrxCRJxBxQeynz1i9hA'; // TEM049 Balaji_BusinessOS_Database_Template
const CLIENTS_DRIVE_FOLDER_ID = '1QUzavRsSwhIy-keXpHf3zguAvHkU8dUy';            // Balaji Business OS NextGen (Drive root)
const TEMPLATE_ID_FOR_BOS     = 'TEM049';
const TRIAL_DAYS = 90;
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

// ── REAL HEADERS (confirmed from your uploaded xlsx — do not reorder) ─
const H = {
  CLIENT_MASTER: ['CLIENT_ID','CONTACT_NAME','PHONE','ALT_PHONE','EMAIL','COMPANY_NAME','COMPANY_TYPE','GST_NO','PAN','ADDRESS','CITY','STATE','PIN','INDUSTRY','PLAN','ERP_URL','ADMIN_NAME','ADMIN_EMAIL','ADMIN_USERNAME','ADMIN_PASSWORD','ADMIN_MOBILE','ADMIN_ROLE','STATUS','LICENSE_STATUS','REGISTERED_BY'],
  USER_MASTER: ['USER_ID','CLIENT_ID','USER_CODE','FULL_NAME','EMAIL','MOBILE_NO','PASSWORD','ROLE','INDUSTRY','BRANCH','ACCESS_LEVEL','STATUS','WEB_ACCESS','APP_ACCESS','OTP_ACCESS','LOGIN_TYPE','COMPANY_NAME','DEPARTMENT','DESIGNATION','DEFAULT_DASHBOARD','CREATED_BY','CREATED_DATE','LAST_LOGIN','FAILED_ATTEMPTS','ACCOUNT_LOCKED'],
  LOGIN_HISTORY: ['LOG_ID','USER_ID','USER_CODE','FULL_NAME','ROLE','LOGIN_DATE','LOGIN_TIME','LOGOUT_TIME','SESSION_DURATION','LOGIN_STATUS','LOGIN_METHOD','OTP_VERIFIED','LOGIN_IP','DEVICE_NAME','BROWSER_INFO','SESSION_TOKEN','LOCATION','CREATED_AT'],
  SESSIONS: ['SESSION_ID','USER_ID','USER_CODE','ROLE','SESSION_TOKEN','SESSION_STATUS','LOGIN_METHOD','LOGIN_DATE','LAST_ACTIVITY','TOKEN_EXPIRY','DEVICE_NAME','LOGIN_IP','FORCE_LOGOUT','REMARKS'],
  USEC_CLIENT_REGISTRY: ['CLIENT_ID','COMPANY_NAME','INDUSTRY','OWNER_NAME','EMAIL','MOBILE_NO','PLAN_NAME','LICENSE_STATUS','START_DATE','EXPIRY_DATE','MAX_USERS','MAX_BRANCHES','DATABASE_ID','API_URL','THEME','ACTIVE_MODULES','LOGO_URL','ADDRESS','CITY','STATE','COUNTRY','GST_NO','PAN_NO','CREATED_ON','LAST_UPDATED'],
  MC_CLIENT_REGISTRY: ['CLIENT_ID','CLIENT_NAME','INDUSTRY','DATABASE_TYPE','DATABASE_NAME','GOOGLE_SHEET_ID','FOLDER_ID','STATUS','CREATED_AT','UPDATED_AT'],
  CLIENT_DATABASE_REGISTRY: ['CLIENT_ID','COMPANY_NAME','MASTER_DB_ID','MASTER_DB_URL','TRANSACTION_DB_ID','TRANSACTION_DB_URL','REPORT_DB_ID','REPORT_DB_URL','FOLDER_ID','CREATED_ON','STATUS'],
  CLIENT_DEPLOYMENT_REGISTRY: ['CLIENT_ID','CLIENT_CODE','CLIENT_NAME','INDUSTRY','TEMPLATE_ID','MASTER_DB_ID','MAIN_FOLDER_ID','ADMIN_NAME','ADMIN_EMAIL','MOBILE_NO','PLAN_TYPE','LICENSE_KEY','API_KEY','TOTAL_BRANCH','LIVE_STATUS','CREATED_AT','UPDATED_AT','STATUS'],
  SAAS_SUBSCRIPTION_MASTER: ['SUBSCRIPTION_ID','CLIENT_ID','PLAN_NAME','START_DATE','END_DATE','AMOUNT','PAYMENT_STATUS','LICENSE_STATUS','USER_LIMIT','BRANCH_LIMIT','STORAGE_LIMIT','STATUS'],
  ACTIVE_SESSION_MASTER: ['SESSION_ID','USER_ID','CLIENT_ID','TOKEN','DEVICE_ID','LOGIN_TIME','EXPIRY_TIME','STATUS'],
};

const BOS_INDUSTRIES = ['COMPUTER_SHOP','STATIONERY_SHOP','SHOP','RETAIL','SUPERMARKET','ELECTRONICS','CLOTHING','FOOTWEAR','JEWELLERY','GIFT_SHOP','OPTICAL','SPORTS',
  'MEDICAL_STORE','PHARMA_DIST','PRINTING','FURNITURE','WHOLESALER','AUTO_DEALER','CYBER_CAFE','GROCERY','FRUIT_CENTER','JUICE_CENTER',
  'TEA_SHOP','COFFEE_CENTER','HARDWARE_SHOP','ELECTRICAL_ELECTRONIC_ITEM','MOBILE_SHOP','SMALL_CAFE','RESTRO_SMALL','CARTRIDGE_POINT','WHOLESALE'];

function doGet(e){
  return ContentService.createTextOutput(JSON.stringify({success:true, message:'Balaji NextGen Business OS API is live', industries: BOS_INDUSTRIES})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    const req = JSON.parse(e.postData.contents);
    let out;
    switch(req.action){
      case 'REGISTER_CLIENT':
        lock.waitLock(30000);
        out = registerClient(req);
        break;
      case 'LOGIN':               out = login(req); break;
      case 'SUITE_SAVE_DB':       out = saveDB(req); break;
      case 'SUITE_LOAD_DB':       out = loadDB(req); break;
      case 'LOG_SALE':            out = logSaleRow(req); break;
      case 'LOG_PURCHASE':        out = logPurchaseRow(req); break;
      case 'LOG_PARTY':           out = logPartyRow(req); break;
      case 'UPLOAD_ATTACHMENT':   out = uploadAttachment(req); break;
      case 'CHECK_SUBSCRIPTION':  out = checkSubscription(req); break;
      case 'GET_INDUSTRIES':      out = {success:true, industries: BOS_INDUSTRIES}; break;
      default: out = {success:false, message:'Unknown action'};
    }
    return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }finally{
    try{ lock.releaseLock(); }catch(e){}
  }
}

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

function hashPass(pw){ return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw))); }

function nextClientId(){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER');
  const data = sh.getDataRange().getValues();
  let maxNum = 15; // last known real client is CL00015 — never go below this
  for(let i=1;i<data.length;i++){
    const id = String(data[i][0]||'');
    const m = id.match(/^CL(\d+)$/);
    if(m) maxNum = Math.max(maxNum, parseInt(m[1],10));
  }
  return 'CL' + String(maxNum+1).padStart(5,'0');
}

function registerClient(req){
  const clientId = nextClientId();
  const dbName = clientId + '_' + req.bizName;
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS*86400000);

  const templateFile = DriveApp.getFileById(TEMPLATE_SHEET_ID);
  const clientFolder = DriveApp.getFolderById(CLIENTS_DRIVE_FOLDER_ID).createFolder(dbName);
  const clonedFile = templateFile.makeCopy(dbName, clientFolder);
  const clientSheetId = clonedFile.getId();

  appendRowByHeader(USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', H.CLIENT_MASTER, {
    CLIENT_ID:clientId, CONTACT_NAME:req.owner, PHONE:req.mobile, ALT_PHONE:'', EMAIL:req.email||'',
    COMPANY_NAME:req.bizName, COMPANY_TYPE:req.industry, GST_NO:'', PAN:'', ADDRESS:'', CITY:'', STATE:'', PIN:'',
    INDUSTRY:req.industry, PLAN:'TRIAL', ERP_URL:BACKEND_API_URL, ADMIN_NAME:req.owner, ADMIN_EMAIL:req.email||'',
    ADMIN_USERNAME:req.mobile, ADMIN_PASSWORD:req.password, ADMIN_MOBILE:req.mobile, ADMIN_ROLE:'OWNER',
    STATUS:'ACTIVE', LICENSE_STATUS:'ACTIVE', REGISTERED_BY:'SELF_REGISTER'
  });

  const userId = clientId + '-U1';
  appendRowByHeader(USER_SECURITY_SHEET_ID, 'USER_MASTER', H.USER_MASTER, {
    USER_ID:userId, CLIENT_ID:clientId, USER_CODE:clientId+'ADMIN', FULL_NAME:req.owner, EMAIL:req.email||'',
    MOBILE_NO:req.mobile, PASSWORD:hashPass(req.password), ROLE:'OWNER', INDUSTRY:req.industry, BRANCH:'HEAD_OFFICE',
    ACCESS_LEVEL:'FULL', STATUS:'ACTIVE', WEB_ACCESS:'YES', APP_ACCESS:'YES', OTP_ACCESS:'NO', LOGIN_TYPE:'PASSWORD',
    COMPANY_NAME:req.bizName, DEPARTMENT:'MANAGEMENT', DESIGNATION:'OWNER', DEFAULT_DASHBOARD:'BUSINESS_OS_DASHBOARD',
    CREATED_BY:'SELF_REGISTER', CREATED_DATE:now, LAST_LOGIN:'', FAILED_ATTEMPTS:0, ACCOUNT_LOCKED:'NO'
  });

  appendRowByHeader(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', H.USEC_CLIENT_REGISTRY, {
    CLIENT_ID:clientId, COMPANY_NAME:req.bizName, INDUSTRY:req.industry, OWNER_NAME:req.owner, EMAIL:req.email||'',
    MOBILE_NO:req.mobile, PLAN_NAME:'TRIAL', LICENSE_STATUS:'ACTIVE', START_DATE:now, EXPIRY_DATE:trialEnd,
    MAX_USERS:5, MAX_BRANCHES:1, DATABASE_ID:clientSheetId, API_URL:BACKEND_API_URL, THEME:'Default Mango',
    ACTIVE_MODULES:'BILLING,INVENTORY,MONEY,REPORTS', LOGO_URL:'', ADDRESS:'', CITY:'', STATE:'', COUNTRY:'INDIA',
    GST_NO:'', PAN_NO:'', CREATED_ON:now, LAST_UPDATED:now
  });

  appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_REGISTRY', H.MC_CLIENT_REGISTRY, {
    CLIENT_ID:clientId, CLIENT_NAME:req.bizName, INDUSTRY:req.industry, DATABASE_TYPE:'BUSINESS_OS_DB',
    DATABASE_NAME:dbName, GOOGLE_SHEET_ID:clientSheetId, FOLDER_ID:clientFolder.getId(), STATUS:'ACTIVE',
    CREATED_AT:now, UPDATED_AT:now
  });

  appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', H.CLIENT_DATABASE_REGISTRY, {
    CLIENT_ID:clientId, COMPANY_NAME:req.bizName, MASTER_DB_ID:clientSheetId,
    MASTER_DB_URL:'https://docs.google.com/spreadsheets/d/'+clientSheetId+'/edit',
    TRANSACTION_DB_ID:'', TRANSACTION_DB_URL:'', REPORT_DB_ID:'', REPORT_DB_URL:'',
    FOLDER_ID:clientFolder.getId(), CREATED_ON:now, STATUS:'ACTIVE'
  });

  appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', H.CLIENT_DEPLOYMENT_REGISTRY, {
    CLIENT_ID:clientId, CLIENT_CODE:clientId.replace('CL',''), CLIENT_NAME:req.bizName, INDUSTRY:req.industry,
    TEMPLATE_ID:TEMPLATE_ID_FOR_BOS, MASTER_DB_ID:clientSheetId, MAIN_FOLDER_ID:clientFolder.getId(),
    ADMIN_NAME:req.owner, ADMIN_EMAIL:req.email||'', MOBILE_NO:req.mobile, PLAN_TYPE:'TRIAL',
    LICENSE_KEY:'AUTO-'+clientId, API_KEY:'API-'+clientId, TOTAL_BRANCH:1, LIVE_STATUS:'LIVE',
    CREATED_AT:now, UPDATED_AT:now, STATUS:'ACTIVE'
  });

  appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'SAAS_SUBSCRIPTION_MASTER', H.SAAS_SUBSCRIPTION_MASTER, {
    SUBSCRIPTION_ID:'SUB-'+clientId, CLIENT_ID:clientId, PLAN_NAME:'TRIAL', START_DATE:now, END_DATE:trialEnd,
    AMOUNT:0, PAYMENT_STATUS:'FREE_TRIAL', LICENSE_STATUS:'ACTIVE', USER_LIMIT:5, BRANCH_LIMIT:1,
    STORAGE_LIMIT:'', STATUS:'ACTIVE'
  });

  if(req.migrateData){
    saveDB({sheetId:clientSheetId, data:req.migrateData});
  }

  return {
    success:true, clientId, sheetId:clientSheetId, folderId:clientFolder.getId(),
    trialEnd: trialEnd.getTime(), userId, loginId:req.mobile
  };
}

function login(req){
  const sh = sheet(USER_SECURITY_SHEET_ID, 'USER_MASTER');
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idx = {}; hdr.forEach((h,i)=> idx[h]=i);
  const hashed = hashPass(req.password);

  for(let i=1;i<data.length;i++){
    const row = data[i];
    const mobileMatch = String(row[idx.MOBILE_NO]) === String(req.loginId);
    const emailMatch = row[idx.EMAIL] && String(row[idx.EMAIL]).toLowerCase() === String(req.loginId).toLowerCase();
    if((mobileMatch || emailMatch) && String(row[idx.PASSWORD]) === hashed){
      const userId = row[idx.USER_ID], clientId = row[idx.CLIENT_ID], role = row[idx.ROLE];
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
    appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'ACTIVE_SESSION_MASTER', H.ACTIVE_SESSION_MASTER, {
      SESSION_ID:Utilities.getUuid(), USER_ID:userId, CLIENT_ID:clientId||'ALL', TOKEN:Utilities.getUuid(),
      DEVICE_ID:'WEB', LOGIN_TIME:new Date(), EXPIRY_TIME:new Date(Date.now()+8*3600000), STATUS:'ACTIVE'
    });
  }catch(e){}
}

function saveDB(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');
  sh.getRange(1,1).setValue('DB_JSON');
  sh.getRange(1,2).setValue(JSON.stringify(req.data));
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
  return {success:true, data: json ? JSON.parse(json) : null, lastSynced: ts ? new Date(ts).getTime() : 0};
}

// ── ROW-LEVEL SYNC — writes an actual visible row into SALES/PURCHASES tabs
// (in addition to the fast APP_DATA JSON blob) so entries show up directly
// in the Google Sheet, are auditable/exportable, and match what you see
// when you open SALES/PURCHASES manually. Upserts by ID to avoid duplicate
// rows if the frontend retries a save. ──
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
function logSaleRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('SALES');
  if(!sh) return {success:false, message:'SALES tab not found in this client sheet'};
  upsertRowById(sh, 0, req.id, [req.id, req.cust, req.date, req.total, req.mode]);
  return {success:true};
}
function logPurchaseRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('PURCHASES');
  if(!sh) return {success:false, message:'PURCHASES tab not found in this client sheet'};
  upsertRowById(sh, 0, req.id, [req.id, req.supp, req.date, req.total, req.mode]);
  return {success:true};
}
// Generic: keeps CUSTOMERS / SUPPLIERS / ITEMS tabs in sync too (req.tab = 'CUSTOMERS'|'SUPPLIERS'|'ITEMS', req.row = array matching that tab's header order)
function logPartyRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName(req.tab);
  if(!sh) return {success:false, message:req.tab+' tab not found'};
  upsertRowById(sh, 0, req.row[0], req.row);
  return {success:true};
}

// ── REAL GOOGLE DRIVE UPLOAD — purchase bill / invoice attachments ──
// req: {sheetId, fileName, mimeType, base64Data (no data: prefix)}
// Saves into the SAME Drive folder as the client's database sheet.
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
