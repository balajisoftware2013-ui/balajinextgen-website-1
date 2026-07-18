/***********************************************************************
 * BALAJI NEXTGEN — BUSINESS OS BACKEND (Code.gs) — v13
 * 
 * This is the v13 production-ready backend with data healing support
 * for missing purchases/sales and automatic item-level stock recovery.
 * 
 * Deploy to: BALAJI_NEXTGEN_ERP_V2_CORE Google Apps Script project
 ***********************************************************************/

// -- CONFIG -----------------------------------------------------------
const MASTER_CONTROL_SHEET_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';
const USER_SECURITY_SHEET_ID  = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg';
const TEMPLATE_SHEET_ID       = '18moaYrNWFKR5etfS2Y4HVjbmyrxCRJxBxQeynz1i9hA';
const CLIENTS_DRIVE_FOLDER_ID = '1QUzavRsSwhIy-keXpHf3zguAvHkU8dUy';
const TEMPLATE_ID_FOR_BOS     = 'TEM049';
const TRIAL_DAYS = 90;
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbweBrJ9QH9ItEE_5t2hzwASZPblf0m6NHSr6vxr5s4w-dcj2bUdQFANnyUcXuxSK4YK/exec';

const BOS_INDUSTRIES = ['COMPUTER_SHOP','STATIONERY_SHOP','SHOP','RETAIL','SUPERMARKET','ELECTRONICS','CLOTHING','FOOTWEAR','JEWELLERY','GIFT_SHOP','OPTICAL','SPORTS',
  'MEDICAL_STORE','PHARMA_DIST','PRINTING','FURNITURE','WHOLESALER','AUTO_DEALER','CYBER_CAFE','GROCERY','FRUIT_CENTER','JUICE_CENTER',
  'TEA_SHOP','COFFEE_CENTER','HARDWARE_SHOP','ELECTRICAL_ELECTRONIC_ITEM','MOBILE_SHOP','SMALL_CAFE','RESTRO_SMALL','CARTRIDGE_POINT','WHOLESALE'];

// Note: Headers object shortened for brevity in this file
// See full version in original documentation

function doGet(e){
  const action = e && e.parameter && e.parameter.action;
  if (action === 'diag') return ContentService.createTextOutput(JSON.stringify(runDiag())).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(JSON.stringify({success:true, message:'Balaji NextGen Business OS API is live (v13)', industries: BOS_INDUSTRIES})).setMimeType(ContentService.MimeType.JSON);
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
      case 'DIAG':                out = runDiag(); break;
      case 'RECONCILE_REPORT':    out = reconcileReport(req); break;
      case 'RECONCILE_AND_SAVE':  out = reconcileAndSave(req); break;
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
        return {success:false, message:'This user is registered under a different app, not Business OS.'};
      }

      let sheetId=null, bizName=row[idx.FULL_NAME], plan='TRIAL', trialEnd=null;
      if(role !== 'SUPER_ADMIN' && clientId){
        const cr = findRow(USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', clientId);
        if(cr){ sheetId = cr.DATABASE_ID; bizName = cr.COMPANY_NAME; plan = cr.PLAN_NAME; trialEnd = new Date(cr.EXPIRY_DATE).getTime(); }
      }
      const loaded = sheetId ? loadDB({sheetId}) : {data:null, lastSynced:0};
      return {success:true, clientId: clientId||'ALL', sheetId, role, bizName, plan, trialEnd, data: loaded.data, lastSynced: loaded.lastSynced, userId};
    }
  }
  return {success:false, message:'Invalid credentials'};
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

  let ss;
  try{ ss = SpreadsheetApp.openById(sheetId); }
  catch(e){ return data; }

  const itemsById = {}; data.items.forEach(it=>{ if(it && it.id) itemsById[it.id]=it; });

  // Process PURCHASES sheet
  const pSheet = ss.getSheetByName('PURCHASES');
  if(pSheet && pSheet.getLastRow() >= 2){
    const rows = pSheet.getRange(2,1,pSheet.getLastRow()-1,6).getValues();
    const haveIds = {}; data.purchases.forEach(p=>{ if(p && p.id) haveIds[p.id]=true; });
    const suppById = {}; data.suppliers.forEach(s=>{ if(s && s.id) suppById[s.id]=s; });
    rows.forEach(r=>{
      const id=r[0], supp=r[1], date=r[2], total=Number(r[3])||0, mode=r[4], itemsJsonRaw=r[5];
      if(!id || haveIds[id]) return;
      const dateStr = (date instanceof Date) ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(date);
      data.purchases.push({id, supp, date:dateStr, total, mode});
      if(mode==='Credit'){ if(suppById[supp]) suppById[supp].due = (suppById[supp].due||0) + total; }
      else if(mode==='Cash'){ data.cash = (data.cash||0) - total; }
      else { data.bank = (data.bank||0) - total; }
      if (itemsJsonRaw) {
        try {
          const lineItems = JSON.parse(itemsJsonRaw);
          (lineItems||[]).forEach(li=>{
            const it = itemsById[li.id];
            if (it) {
              it.stock = (it.stock||0) + (Number(li.qty)||0);
            }
          });
        } catch(e){ /* ignore */ }
      }
    });
  }

  // Process SALES sheet
  const sSheet = ss.getSheetByName('SALES');
  if(sSheet && sSheet.getLastRow() >= 2){
    const rows = sSheet.getRange(2,1,sSheet.getLastRow()-1,6).getValues();
    const haveIds = {}; data.sales.forEach(s=>{ if(s && s.id) haveIds[s.id]=true; });
    const custById = {}; data.customers.forEach(c=>{ if(c && c.id) custById[c.id]=c; });
    rows.forEach(r=>{
      const id=r[0], cust=r[1], date=r[2], total=Number(r[3])||0, mode=r[4], itemsJsonRaw=r[5];
      if(!id || haveIds[id]) return;
      const dateStr = (date instanceof Date) ? Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(date);
      data.sales.push({id, cust, date:dateStr, total, mode});
      if(mode==='Credit'){ if(custById[cust]) custById[cust].due = (custById[cust].due||0) + total; }
      else if(mode==='Cash'){ data.cash = (data.cash||0) + total; }
      else { data.bank = (data.bank||0) + total; }
      if (itemsJsonRaw) {
        try {
          const lineItems = JSON.parse(itemsJsonRaw);
          (lineItems||[]).forEach(li=>{
            const it = itemsById[li.id];
            if (it) {
              it.stock = Math.max(0, (it.stock||0) - (Number(li.qty)||0));
            }
          });
        } catch(e){ /* ignore */ }
      }
    });
  }

  return data;
}

function reconcileAndSave(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');
  const json = sh.getRange(1,2).getValue();
  const before = json ? JSON.parse(json) : {};
  const beforePurch = (before.purchases||[]).length;
  const beforeSales = (before.sales||[]).length;
  const beforePurchTotal = (before.purchases||[]).reduce((a,p)=>a+(p.total||0),0);
  const beforeSalesTotal = (before.sales||[]).reduce((a,p)=>a+(p.total||0),0);

  const healed = reconcileDB(req.sheetId, before);

  sh.getRange(1,1).setValue('DB_JSON');
  sh.getRange(1,2).setValue(JSON.stringify(healed));
  const ts = new Date();
  sh.getRange(1,3).setValue(ts);

  return {
    success:true,
    before: {purchases:beforePurch, sales:beforeSales, purchaseTotal:beforePurchTotal, salesTotal:beforeSalesTotal},
    after: {
      purchases:healed.purchases.length, sales:healed.sales.length,
      purchaseTotal:healed.purchases.reduce((a,p)=>a+(p.total||0),0),
      salesTotal:healed.sales.reduce((a,p)=>a+(p.total||0),0)
    },
    healedCount: (healed.purchases.length-beforePurch) + (healed.sales.length-beforeSales),
    lastSynced: ts.getTime()
  };
}

function saveDB(req){
  const data = reconcileDB(req.sheetId, req.data);
  const ss = SpreadsheetApp.openById(req.sheetId);
  let sh = ss.getSheetByName('APP_DATA') || ss.insertSheet('APP_DATA');
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
  if(data) data = reconcileDB(req.sheetId, data);
  return {success:true, data, lastSynced: ts ? new Date(ts).getTime() : 0};
}

function logSaleRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('SALES');
  if(!sh) return {success:false, message:'SALES tab not found'};
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  const lastRow = sh.getLastRow();
  sh.insertRowAfter(lastRow).getRange(lastRow+1, 1, 1, 6).setValues([[req.id, req.cust, req.date, req.total, req.mode, itemsJson]]);
  return {success:true};
}

function logPurchaseRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('PURCHASES');
  if(!sh) return {success:false, message:'PURCHASES tab not found'};
  const itemsJson = req.lineItems ? JSON.stringify(req.lineItems) : '';
  const lastRow = sh.getLastRow();
  sh.insertRowAfter(lastRow).getRange(lastRow+1, 1, 1, 6).setValues([[req.id, req.supp, req.date, req.total, req.mode, itemsJson]]);
  return {success:true};
}

function logPartyRow(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName(req.tab);
  if(!sh) return {success:false, message:req.tab+' tab not found'};
  const lastRow = sh.getLastRow();
  sh.insertRowAfter(lastRow).getRange(lastRow+1, 1, 1, req.row.length).setValues([req.row]);
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

function reconcileReport(req){
  const ss = SpreadsheetApp.openById(req.sheetId);
  const sh = ss.getSheetByName('APP_DATA');
  const json = sh ? sh.getRange(1,2).getValue() : '';
  const before = json ? JSON.parse(json) : {};
  return {success:true, before, after: reconcileDB(req.sheetId, before)};
}

function verifyPass(pw, stored){
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw))) === stored;
}

function runDiag(){
  const out = { ok:true, steps:[] };
  try {
    const ss1 = SpreadsheetApp.openById(USER_SECURITY_SHEET_ID);
    out.steps.push({step: 'USER_SECURITY_MASTER_DB', ok: true});
    const ss2 = SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID);
    out.steps.push({step: 'MASTER_CONTROL_SYSTEM', ok: true});
  } catch(e) {
    out.ok = false;
    out.steps.push({step: 'Open sheets', ok: false, error: e.toString()});
  }
  return out;
}

function registerClient(req){
  return {success: false, message: 'Registration not available via this interface'};
}

function fixCL00022Now(){
  const sheetId = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';
  const result = reconcileAndSave({ sheetId });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
