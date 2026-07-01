// ════════════════════════════════════════════════════════════════
//  Balaji Wealth Pilot 360 – Google Apps Script Backend v10
//  FILE: WealthPilot360_GAS_Backend_v10.gs
//  Powered by: Balaji NextGen Solutions
//
//  ✅ v10 FIX: _savedAt is now the Google Sheet file's REAL last-modified
//     time (DriveApp.getLastUpdated()) instead of a script-property stamp
//     that only updated when the app itself wrote data.
//     → Manual edits made directly inside the Google Sheet are now
//       correctly detected as "newer" by the app's cloud-vs-local sync
//       check, fixing the "Sheet has 5 rows but app shows 2 different
//       rows" mismatch.
//
//  (v9 fixes retained: explicit UID column index in WP360_readTabRows,
//   dataStart always row 2, trimmed UID comparison)
// ════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────
const WP360_CONFIG = {
  MASTER_FOLDER_ID:         '1lY4wLnjtA0wkoKhYb6Q-JTSeyo0haRJm',
  TEMPLATE_SHEET_ID:        '1OpSQYEDBMw2Pawbwu80UcoIofj-yqJzNGhxx-9XeWwk',
  CLIENT_DB_SUBFOLDER_NAME: 'CLIENT_DATABASES',
  MASTER_SS_NAME:           'WealthPilot360_MasterDB',
  PROP_MASTER_ID:           'WP360_MASTER_SS_ID_v6',
  PLAN_DAYS: { trial: 90, starter: 365, professional: 365, enterprise: 3650 },
  DOC_SUBFOLDER_NAME:       'Documents'
};

// ── SHEET NAMES ───────────────────────────────────────────────────
const WP360_SH = {
  USERS:     'USER_REGISTRY',
  CLIENT:    'CLIENT_MASTER',
  SUBS_LOG:  'SUBSCRIPTION_LOG',
  DB_INDEX:  'CLIENT_DB_INDEX',
  ERROR_LOG: 'ERROR_LOG'
};

// ── TEMPLATE TAB NAMES ────────────────────────────────────────────
const WP360_TABS = [
  '📊 Dashboard', '👤 Users', '🏦 Loans', '📋 Bills',
  '🛡️ Insurance', '📈 Investments', '💰 Assets', '💳 Credit Cards',
  '🔄 Subscriptions', '💵 Transactions', '🎯 Goals', '📁 Documents',
  '👨‍👩‍👧‍👦 Family', '📊 Budget', 'Accounting'
];

// ══════════════════════════════════════════════════════════════════
//  ENTRY POINTS
// ══════════════════════════════════════════════════════════════════
function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch(err) { return WP360_resp(false, 'Invalid JSON: ' + err); }

  const { action, uid, data } = payload;
  try {
    switch (action) {
      case 'SAVE_USERS':           return WP360_resp(true, WP360_saveUsers(data));
      case 'LOAD_USERS':           return WP360_resp(true, WP360_loadUsers());
      case 'SAVE_DB':              return WP360_resp(true, WP360_saveClientSheet(uid, data));
      case 'LOAD_DB':              return WP360_resp(true, WP360_loadClientSheet(uid));
      case 'DELETE_DB':            return WP360_resp(true, WP360_clearClientSheet(uid));
      case 'REGISTER_CLIENT':      return WP360_resp(true, WP360_registerClient(data));
      case 'GET_CLIENT':           return WP360_resp(true, WP360_getClientInfo(uid));
      case 'GET_CLIENT_SHEET_URL': return WP360_resp(true, WP360_getClientSheetUrl(uid));
      case 'UPDATE_SUBSCRIPTION':  return WP360_resp(true, WP360_updateSubscription(uid, data));
      case 'UPLOAD_DOCUMENT':      return WP360_resp(true, WP360_uploadDocument(uid, data));
      case 'PING':                 return WP360_resp(true, 'pong – Balaji WP360 GAS v10 OK (Accounting+Sync+RealMTime)');
      default:                     return WP360_resp(false, 'Unknown action: ' + action);
    }
  } catch(err) {
    WP360_logError(action, err.toString());
    return WP360_resp(false, err.toString());
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return WP360_resp(true, 'pong – Balaji WP360 GAS v10 OK (Accounting+Sync+RealMTime)');
  const ssId = WP360_getMasterSSId();
  return ContentService
    .createTextOutput(JSON.stringify({
      status:    'Balaji WealthPilot360 GAS v10 OK (Accounting+Sync+RealMTime)',
      masterSSId: ssId,
      poweredBy: 'Balaji NextGen Solutions'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function WP360_resp(success, data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, data: data !== undefined ? data : null }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  UPLOAD_DOCUMENT
// ══════════════════════════════════════════════════════════════════
function WP360_uploadDocument(uid, dataJson) {
  if (!uid) return JSON.stringify({ error: 'no_uid' });

  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ error: 'parse_error' }); }

  if (!d.base64 || !d.mimeType || !d.fileName) {
    return JSON.stringify({ error: 'missing_fields' });
  }

  try {
    const clientFolder = WP360_getOrCreateClientFolder(uid, WP360_getClientName(uid));
    const docsFolder   = WP360_getOrCreateSubFolder(clientFolder, WP360_CONFIG.DOC_SUBFOLDER_NAME);
    const decoded      = Utilities.base64Decode(d.base64);
    const blob         = Utilities.newBlob(decoded, d.mimeType, d.fileName);

    const existing = docsFolder.getFilesByName(d.fileName);
    if (existing.hasNext()) { existing.next().setTrashed(true); }

    const file    = docsFolder.createFile(blob);
    const fileId  = file.getId();
    const fileUrl = file.getUrl();

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    WP360_logDocumentUpload(uid, d.docName || d.fileName, d.fileName, d.mimeType, fileUrl, fileId);

    Logger.log('✅ Document uploaded for ' + uid + ': ' + d.fileName + ' → ' + fileUrl);

    return JSON.stringify({
      status:    'uploaded',
      url:       fileUrl,
      id:        fileId,
      name:      d.fileName,
      folder:    docsFolder.getName(),
      folderUrl: docsFolder.getUrl()
    });

  } catch(err) {
    WP360_logError('WP360_uploadDocument', err.toString());
    return JSON.stringify({ error: err.toString() });
  }
}

function WP360_getClientName(uid) {
  try {
    const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === String(uid).trim()) return String(vals[i][1]) || uid;
    }
  } catch(e) {}
  return uid;
}

function WP360_getOrCreateSubFolder(parentFolder, subName) {
  const existing = parentFolder.getFoldersByName(subName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(subName);
}

function WP360_logDocumentUpload(uid, docName, fileName, mimeType, driveUrl, driveId) {
  try {
    const sheetRef = WP360_getClientSheetId(uid);
    if (!sheetRef) return;

    const ss = SpreadsheetApp.openById(sheetRef.id);
    const sh = ss.getSheetByName('📁 Documents');
    if (!sh) return;

    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][7]).trim() === driveId) {
        sh.getRange(i+1, 6).setValue(driveUrl);
        return;
      }
    }

    const ts        = new Date().toISOString().slice(0, 10);
    const typeLabel = mimeType === 'application/pdf' ? 'PDF'
                    : mimeType.startsWith('image/')  ? 'Image'
                    : 'File';

    sh.appendRow([
      docName, typeLabel, fileName, ts, mimeType, driveUrl, uid, driveId
    ]);
  } catch(e) {
    Logger.log('WP360_logDocumentUpload warning: ' + e);
  }
}

// ══════════════════════════════════════════════════════════════════
//  MASTER SPREADSHEET
// ══════════════════════════════════════════════════════════════════
function WP360_getMasterSSId() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(WP360_CONFIG.PROP_MASTER_ID);
  if (ssId) {
    try { SpreadsheetApp.openById(ssId); return ssId; } catch(e) { ssId = null; }
  }
  const folder = DriveApp.getFolderById(WP360_CONFIG.MASTER_FOLDER_ID);
  const files  = folder.getFilesByName(WP360_CONFIG.MASTER_SS_NAME);
  if (files.hasNext()) {
    ssId = files.next().getId();
    props.setProperty(WP360_CONFIG.PROP_MASTER_ID, ssId);
    return ssId;
  }
  const ss = SpreadsheetApp.create(WP360_CONFIG.MASTER_SS_NAME);
  ssId = ss.getId();
  const file = DriveApp.getFileById(ssId);
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  WP360_initMasterSheets(ss);
  props.setProperty(WP360_CONFIG.PROP_MASTER_ID, ssId);
  Logger.log('✅ Created WealthPilot360 MasterDB: https://docs.google.com/spreadsheets/d/' + ssId);
  return ssId;
}

function WP360_masterSS() {
  return SpreadsheetApp.openById(WP360_getMasterSSId());
}

function WP360_initMasterSheets(ss) {
  WP360_ensureSheet(ss, WP360_SH.USERS,
    ['UID','REGISTRY_JSON','LAST_UPDATED'], '#FF7A1A');
  WP360_ensureSheet(ss, WP360_SH.CLIENT, [
    'CLIENT_ID','FULL_NAME','MOBILE','EMAIL','CITY',
    'PLAN','PLAN_EXPIRY','STATUS','REGISTERED_AT','LAST_UPDATED',
    'TOTAL_SAVES','LAST_SAVE','CLIENT_SHEET_ID','CLIENT_SHEET_URL'
  ], '#1A6FFF');
  WP360_ensureSheet(ss, WP360_SH.SUBS_LOG, [
    'LOG_ID','CLIENT_ID','OLD_PLAN','NEW_PLAN','CHANGED_AT','CHANGED_BY','EXPIRY','REMARK'
  ], '#8B5CF6');
  WP360_ensureSheet(ss, WP360_SH.DB_INDEX, [
    'CLIENT_ID','SHEET_ID','SHEET_URL','SHEET_NAME','CREATED_AT','LAST_WRITE'
  ], '#10B981');
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}

function WP360_ensureSheet(ss, name, headers, color) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() !== headers[0]) {
    sh.clearContents();
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length)
      .setFontWeight('bold')
      .setBackground(color)
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    headers.forEach((_,i) => sh.setColumnWidth(i+1, i < 2 ? 160 : 200));
  }
  return sh;
}

function WP360_getMasterSheet(name) {
  const ss = WP360_masterSS();
  let sh = ss.getSheetByName(name);
  if (!sh) { WP360_initMasterSheets(ss); sh = ss.getSheetByName(name); }
  return sh;
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT FOLDER + SHEET MANAGEMENT
// ══════════════════════════════════════════════════════════════════
function WP360_getClientDbFolder() {
  const masterFolder = DriveApp.getFolderById(WP360_CONFIG.MASTER_FOLDER_ID);
  if (!WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME) return masterFolder;
  const subs = masterFolder.getFoldersByName(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
  if (subs.hasNext()) return subs.next();
  return masterFolder.createFolder(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
}

function WP360_getOrCreateClientFolder(uid, name) {
  const parentFolder = WP360_getClientDbFolder();
  const safeName     = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').trim();
  const folderName   = 'WP360_' + uid + '_' + safeName;
  const existing     = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(folderName);
}

function WP360_createClientSheet(uid, name) {
  try {
    const folder    = WP360_getOrCreateClientFolder(uid, name);
    const sheetName = 'WealthPilot360_' + uid;

    const existing = folder.getFilesByName(sheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      return { id: f.getId(), url: f.getUrl(), name: sheetName };
    }

    const template = DriveApp.getFileById(WP360_CONFIG.TEMPLATE_SHEET_ID);
    const copy     = template.makeCopy(sheetName, folder);
    const copyId   = copy.getId();
    const copyUrl  = copy.getUrl();

    try {
      const ss      = SpreadsheetApp.openById(copyId);
      const usersSh = ss.getSheetByName('👤 Users');
      if (usersSh) {
        const vals  = usersSh.getDataRange().getValues();
        const now   = new Date().toISOString().slice(0,10);
        let userRow = -1;
        for (let i = 1; i < vals.length; i++) {
          if (String(vals[i][0]).trim() === String(uid).trim()) { userRow = i + 1; break; }
        }
        if (userRow === -1) {
          if (vals.length >= 2 && vals[1][0]) {
            usersSh.getRange(2,1,1,8).setValues([[uid,'','','',now,now,'Professional','Active']]);
          } else {
            usersSh.appendRow([uid,'','','',now,now,'Professional','Active']);
          }
        }
      }
    } catch(e) { Logger.log('Users tab seed failed: ' + e); }

    try {
      WP360_getOrCreateSubFolder(folder, WP360_CONFIG.DOC_SUBFOLDER_NAME);
      Logger.log('✅ Documents folder created for ' + uid);
    } catch(e) { Logger.log('Documents subfolder creation warning: ' + e); }

    Logger.log('✅ Client sheet created: ' + sheetName + ' → ' + copyUrl);
    return { id: copyId, url: copyUrl, name: sheetName };

  } catch(err) {
    WP360_logError('WP360_createClientSheet', err.toString());
    throw new Error('Failed to create client sheet: ' + err.toString());
  }
}

function WP360_getClientSheetId(uid) {
  const sh   = WP360_getMasterSheet(WP360_SH.DB_INDEX);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      return { id: String(vals[i][1]), url: String(vals[i][2]) };
    }
  }
  return null;
}

function WP360_indexClientSheet(uid, sheetId, sheetUrl, sheetName) {
  const sh   = WP360_getMasterSheet(WP360_SH.DB_INDEX);
  const vals = sh.getDataRange().getValues();
  const ts   = new Date().toISOString();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      sh.getRange(i+1,2).setValue(sheetId);
      sh.getRange(i+1,3).setValue(sheetUrl);
      sh.getRange(i+1,6).setValue(ts);
      return;
    }
  }
  sh.appendRow([uid, sheetId, sheetUrl, sheetName, ts, ts]);
}

// ══════════════════════════════════════════════════════════════════
//  USER REGISTRY
// ══════════════════════════════════════════════════════════════════
function WP360_saveUsers(usersJson) {
  const sh   = WP360_getMasterSheet(WP360_SH.USERS);
  const vals = sh.getDataRange().getValues();
  let blobRow = -1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '__REGISTRY__') { blobRow = i + 1; break; }
  }
  const ts = new Date().toISOString();
  if (blobRow === -1) sh.appendRow(['__REGISTRY__', usersJson, ts]);
  else { sh.getRange(blobRow,2).setValue(usersJson); sh.getRange(blobRow,3).setValue(ts); }
  return 'saved';
}

function WP360_loadUsers() {
  const sh   = WP360_getMasterSheet(WP360_SH.USERS);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '__REGISTRY__') return vals[i][1] || '{}';
  }
  return '{}';
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT REGISTRATION
// ══════════════════════════════════════════════════════════════════
function WP360_registerClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return 'parse_error'; }

  const uid = d.uid || d.userid;
  if (!uid) return 'no_uid';

  const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals = sh.getDataRange().getValues();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      const ex = WP360_getClientSheetId(uid);
      return JSON.stringify({
        status: 'already_exists',
        clientSheetId:  ex ? ex.id  : '',
        clientSheetUrl: ex ? ex.url : ''
      });
    }
  }

  const sheetInfo = WP360_createClientSheet(uid, d.name);
  const planDays  = WP360_CONFIG.PLAN_DAYS[d.plan] || 90;
  const expiry    = d.planExpiry || new Date(Date.now() + planDays*86400000).toISOString().slice(0,10);
  const ts        = new Date().toISOString();

  sh.appendRow([
    uid, d.name||'', d.mobile||'', d.email||'', d.city||'',
    d.plan||'professional', expiry, 'ACTIVE', ts, ts,
    0, '', sheetInfo.id, sheetInfo.url
  ]);

  WP360_indexClientSheet(uid, sheetInfo.id, sheetInfo.url, sheetInfo.name);
  Logger.log('✅ Registered client: ' + uid + ' → ' + sheetInfo.url);

  return JSON.stringify({
    status: 'registered',
    clientSheetId:   sheetInfo.id,
    clientSheetUrl:  sheetInfo.url,
    clientSheetName: sheetInfo.name
  });
}

// ══════════════════════════════════════════════════════════════════
//  SAVE DB → CLIENT SHEET
// ══════════════════════════════════════════════════════════════════
function WP360_saveClientSheet(uid, dbJson) {
  if (!uid) return 'no_uid';
  let db;
  try { db = typeof dbJson === 'string' ? JSON.parse(dbJson) : dbJson; }
  catch(e) { return 'parse_error'; }

  let sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) {
    const usersBlob = WP360_loadUsers();
    let userName = uid;
    try { const u = JSON.parse(usersBlob); if (u[uid]) userName = u[uid].name || uid; } catch(e) {}
    const sheetInfo = WP360_createClientSheet(uid, userName);
    WP360_indexClientSheet(uid, sheetInfo.id, sheetInfo.url, sheetInfo.name);
    sheetRef = { id: sheetInfo.id };
  }

  return WP360_writeToClientSheet(sheetRef.id, uid, db);
}

function WP360_writeToClientSheet(sheetId, uid, db) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const ts = new Date().toISOString();

    WP360_writeTabData(ss, '🏦 Loans',
      ['Loan Name','Bank / Lender','Loan Type','Original Amount (₹)','Outstanding (₹)','Monthly EMI (₹)','Interest Rate (%)','EMI Due Date','User ID','Notes'],
      (db.loans||[]).map(l => [l.name,l.bank,l.type,l.amount,l.outstanding,l.emi,l.interest,l.due,uid,l.notes||''])
    );
    WP360_writeTabData(ss, '📋 Bills',
      ['Bill Name','Provider','Category','Amount (₹)','Due Date','Status','User ID','Notes'],
      (db.bills||[]).map(b => [b.name,b.provider,b.cat,b.amount,b.due,b.status||'Pending',uid,b.notes||''])
    );
    WP360_writeTabData(ss, '🛡️ Insurance',
      ['Policy Name','Type','Policy Number','Annual Premium (₹)','Renewal Date','Coverage (₹)','Nominee','User ID','Notes'],
      (db.insurance||[]).map(i => [i.name,i.type,i.policy,i.premium,i.renewal,i.coverage,i.nominee,uid,i.notes||''])
    );
    WP360_writeTabData(ss, '📈 Investments',
      ['Investment Name','Type','Invested Amount (₹)','Current Value (₹)','Gain/Loss (₹)','Return (%)','User ID','Notes'],
      (db.investments||[]).map(inv => {
        const gain = Number(inv.current) - Number(inv.invested);
        const ret  = Number(inv.invested) ? gain/Number(inv.invested) : 0;
        return [inv.name,inv.type,inv.invested,inv.current,gain,ret,uid,inv.notes||''];
      })
    );
    WP360_writeTabData(ss, '💰 Assets',
      ['Name','Type (Asset/Liability)','Asset Value (₹)','Liability Value (₹)','User ID','Notes'],
      (db.assets||[]).map(a => [
        a.name,
        a.kind==='asset'?'Asset':'Liability',
        a.kind==='asset'?a.value:0,
        a.kind==='liability'?a.value:0,
        uid, a.notes||''
      ])
    );
    WP360_writeTabData(ss, '💳 Credit Cards',
      ['Card Name','Bank','Credit Limit (₹)','Outstanding (₹)','Min Due (₹)','Payment Due Date','Utilization (%)','User ID'],
      (db.creditCards||[]).map(c => {
        const util = Number(c.limit) ? Number(c.outstanding)/Number(c.limit) : 0;
        return [c.name,c.bank,c.limit,c.outstanding,c.mindue,c.due,util,uid];
      })
    );
    WP360_writeTabData(ss, '🔄 Subscriptions',
      ['Service Name','Category','Amount (₹)','Cycle','Renewal Date','Monthly Cost (₹)','User ID','Notes'],
      (db.subscriptions||[]).map(s => {
        const monthly = s.cycle==='Yearly' ? Number(s.amount)/12 : Number(s.amount);
        return [s.name,s.cat,s.amount,s.cycle,s.renewal,monthly,uid,s.notes||''];
      })
    );
    WP360_writeTabData(ss, '💵 Transactions',
      ['Date','Description','Category','Type','Amount (₹)','Month','User ID','Notes'],
      (db.transactions||[]).map(t => [t.date,t.desc,t.cat,t.type,t.amount,(t.date||'').slice(0,7),uid,t.notes||''])
    );
    WP360_writeTabData(ss, '🎯 Goals',
      ['Goal Name','Category','Target Amount (₹)','Saved So Far (₹)','Remaining (₹)','Progress (%)','Target Date','Days Left','User ID'],
      (db.goals||[]).map(g => {
        const rem      = Number(g.target) - Number(g.saved);
        const pct      = Number(g.target) ? Number(g.saved)/Number(g.target) : 0;
        const daysLeft = g.date ? Math.max(0,Math.ceil((new Date(g.date)-new Date())/86400000)) : '';
        return [g.name,g.cat,g.target,g.saved,rem,pct,g.date,daysLeft,uid];
      })
    );
    WP360_writeTabData(ss, '📁 Documents',
      ['Document Name','Type','Number / ID','Expiry Date','Days to Expiry','Drive URL','User ID','Drive File ID'],
      (db.documents||[]).map(doc => {
        const daysLeft = doc.expiry ? Math.max(0,Math.ceil((new Date(doc.expiry)-new Date())/86400000)) : '';
        return [
          doc.name, doc.type, doc.number||'', doc.expiry||'', daysLeft,
          doc.driveUrl||'', uid, doc.driveId||''
        ];
      })
    );
    WP360_writeTabData(ss, '👨‍👩‍👧‍👦 Family',
      ['Member Name','Relation','Date of Birth','Age','PAN','Aadhaar (last 4)','Primary User ID','Notes'],
      (db.family||[]).map(f => [f.name,f.relation,'','','','',uid,f.notes||''])
    );
    WP360_writeTabData(ss, '📊 Budget',
      ['Category','Budget Amount (₹)','Actual Spent (₹)','Remaining (₹)','Used (%)','Status','User ID'],
      (db.budgets||[]).map(b => [b.cat,b.amount,0,b.amount,0,'✅ On Track',uid])
    );
    WP360_writeTabData(ss, 'Accounting',
      ['Date','Name','Type','Amount','DueDate','Status','Notes','UserID','CreatedAt'],
      (db.accounting||[]).map(a => [
        a.date||'', a.name||'',
        a.type === 'creditor' ? 'Creditor' : 'Debtor',
        a.amount||0, a.due||'', a.status||'outstanding', a.notes||'',
        uid, ts
      ])
    );

    try {
      const userSh = ss.getSheetByName('👤 Users');
      if (userSh) {
        const uVals = userSh.getDataRange().getValues();
        for (let i = 1; i < uVals.length; i++) {
          if (String(uVals[i][0]).trim() === String(uid).trim()) {
            userSh.getRange(i+1,6).setValue(ts.slice(0,10));
            break;
          }
        }
      }
    } catch(e) {}

    WP360_updateClientSaveMeta(uid, ts);
    return JSON.stringify({ status: 'saved', sheetId, savedAt: ts });

  } catch(err) {
    WP360_logError('WP360_writeToClientSheet', err.toString());
    throw new Error('Write failed: ' + err.toString());
  }
}

function WP360_writeTabData(ss, tabName, headers, rows) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) return;
  const firstVals  = sh.getRange(1,1,3,1).getValues();
  let dataStartRow = 2;
  if (firstVals[0][0] && firstVals[1][0] && String(firstVals[1][0]) !== headers[0]) {
    dataStartRow = 3;
  }
  const lastRow = sh.getLastRow();
  if (lastRow >= dataStartRow) {
    sh.getRange(dataStartRow,1, lastRow-dataStartRow+1, sh.getLastColumn()).clearContent();
  }
  if (rows && rows.length > 0) {
    sh.getRange(dataStartRow,1, rows.length, headers.length).setValues(rows);
  }
}

// ══════════════════════════════════════════════════════════════════
//  LOAD DB ← CLIENT SHEET
// ══════════════════════════════════════════════════════════════════
function WP360_loadClientSheet(uid) {
  if (!uid) return null;

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) {
    Logger.log('❌ LOAD_DB: No sheet found for UID: [' + uid + ']');
    return null;
  }

  Logger.log('✅ LOAD_DB: Loading sheet for UID: [' + uid + '] → ' + sheetRef.id);

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const db = {
      loans:[], bills:[], insurance:[], investments:[],
      assets:[], goals:[], transactions:[], family:[],
      business:[], creditCards:[], subscriptions:[],
      documents:[], budgets:[], accounting:[], profile:{}
    };

    db.loans = WP360_readTabRows(ss, '🏦 Loans', uid,
      r => ({ name:r[0], bank:r[1], type:r[2], amount:r[3], outstanding:r[4], emi:r[5], interest:r[6], due:WP360_dateStr(r[7]) }),
      8
    );
    db.bills = WP360_readTabRows(ss, '📋 Bills', uid,
      r => ({ name:r[0], provider:r[1], cat:r[2], amount:r[3], due:WP360_dateStr(r[4]), status:r[5] }),
      6
    );
    db.insurance = WP360_readTabRows(ss, '🛡️ Insurance', uid,
      r => ({ name:r[0], type:r[1], policy:r[2], premium:r[3], renewal:WP360_dateStr(r[4]), coverage:r[5], nominee:r[6] }),
      7
    );
    db.investments = WP360_readTabRows(ss, '📈 Investments', uid,
      r => ({ name:r[0], type:r[1], invested:r[2], current:r[3] }),
      6
    );
    db.assets = WP360_readTabRows(ss, '💰 Assets', uid,
      r => ({
        name: r[0],
        kind:  String(r[1]).toLowerCase().includes('liability') ? 'liability' : 'asset',
        value: String(r[1]).toLowerCase().includes('liability') ? r[3] : r[2]
      }),
      4
    );
    db.creditCards = WP360_readTabRows(ss, '💳 Credit Cards', uid,
      r => ({ name:r[0], bank:r[1], limit:r[2], outstanding:r[3], mindue:r[4], due:WP360_dateStr(r[5]) }),
      7
    );
    db.subscriptions = WP360_readTabRows(ss, '🔄 Subscriptions', uid,
      r => ({ name:r[0], cat:r[1], amount:r[2], cycle:r[3], renewal:WP360_dateStr(r[4]) }),
      6
    );
    db.transactions = WP360_readTabRows(ss, '💵 Transactions', uid,
      r => ({ date:WP360_dateStr(r[0]), desc:r[1], cat:r[2], type:r[3], amount:r[4] }),
      6
    );
    db.goals = WP360_readTabRows(ss, '🎯 Goals', uid,
      r => ({ name:r[0], cat:r[1], target:r[2], saved:r[3], date:WP360_dateStr(r[6]) }),
      8
    );
    db.documents = WP360_readTabRows(ss, '📁 Documents', uid,
      r => ({
        name:     r[0],
        type:     r[1],
        number:   r[2],
        expiry:   WP360_dateStr(r[3]),
        driveUrl: String(r[5] || ''),
        driveId:  String(r[7] || '')
      }),
      6
    );
    db.family = WP360_readTabRows(ss, '👨‍👩‍👧‍👦 Family', uid,
      r => ({ name:r[0], relation:r[1] }),
      6
    );
    db.budgets = WP360_readTabRows(ss, '📊 Budget', uid,
      r => ({ cat:r[0], amount:r[1] }),
      6
    );
    db.accounting = WP360_readTabRows(ss, 'Accounting', uid,
      r => ({
        id:      String(r[0]||'') + '_' + String(r[1]||'') + '_' + String(r[8]||''), // includes CreatedAt for uniqueness
        date:    WP360_dateStr(r[0]),
        name:    r[1],
        type:    String(r[2]).toLowerCase().includes('creditor') ? 'creditor' : 'debtor',
        amount:  r[3],
        due:     WP360_dateStr(r[4]),
        status:  r[5] || 'outstanding',
        notes:   r[6],
        paidAmt: String(r[5]).toLowerCase() === 'paid' ? r[3] : 0
      }),
      7
    );

    // ══════════════════════════════════════════════════════════════
    // ✅ v10 FIX: _savedAt is now the spreadsheet FILE's real last-modified
    // time, via DriveApp — this reflects ANY change to the file, whether
    // made by the app (SAVE_DB) or by hand directly in Google Sheets.
    // Previously this used a script property that only the app's own
    // SAVE_DB call updated, so manual sheet edits were invisible to the
    // app's cloud-vs-local freshness check and got silently overwritten
    // by stale cached data on next load.
    // ══════════════════════════════════════════════════════════════
    try {
      db._savedAt = DriveApp.getFileById(sheetRef.id).getLastUpdated().getTime();
    } catch(e) { db._savedAt = Date.now(); }

    Logger.log('✅ LOAD_DB complete for UID: [' + uid + '] — loans:' + db.loans.length
      + ' bills:' + db.bills.length + ' investments:' + db.investments.length
      + ' accounting:' + db.accounting.length + ' docs:' + db.documents.length);

    return JSON.stringify(db);

  } catch(err) {
    WP360_logError('WP360_loadClientSheet', err.toString());
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  WP360_readTabRows
// ══════════════════════════════════════════════════════════════════
function WP360_readTabRows(ss, tabName, uid, mapFn, uidColIndex) {
  const sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return [];

  const allVals = sh.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < allVals.length; i++) {
    const r = allVals[i];

    if (!r[0] || String(r[0]).trim() === '') continue;

    const firstCell = String(r[0]).toUpperCase();
    if (firstCell === 'TOTAL' || firstCell.startsWith('NET')) continue;

    if (uid !== undefined && uid !== null && uidColIndex !== undefined) {
      const rowUid = String(r[uidColIndex] || '').trim();
      const checkUid = String(uid).trim();
      if (rowUid !== checkUid) continue;
    }

    try {
      results.push(mapFn(r));
    } catch(e) {
      Logger.log('⚠️ mapFn error in tab [' + tabName + '] row ' + i + ': ' + e);
    }
  }

  return results;
}

function WP360_dateStr(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0,10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  return s;
}

// ══════════════════════════════════════════════════════════════════
//  CLEAR CLIENT SHEET DATA
// ══════════════════════════════════════════════════════════════════
function WP360_clearClientSheet(uid) {
  if (!uid) return 'no_uid';
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return 'sheet_not_found';
  try {
    const ss       = SpreadsheetApp.openById(sheetRef.id);
    const dataTabs = WP360_TABS.filter(t => t !== '📊 Dashboard' && t !== '👤 Users');
    dataTabs.forEach(tabName => {
      const sh = ss.getSheetByName(tabName);
      if (sh && sh.getLastRow() > 3) {
        sh.getRange(4,1, sh.getLastRow()-3, sh.getLastColumn()).clearContent();
      }
    });
    return 'cleared';
  } catch(e) { return 'error: ' + e.toString(); }
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT INFO
// ══════════════════════════════════════════════════════════════════
function WP360_getClientInfo(uid) {
  if (!uid) return null;
  const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      const sheetRef = WP360_getClientSheetId(uid);
      return JSON.stringify({
        uid:            vals[i][0],
        name:           vals[i][1],
        mobile:         vals[i][2],
        email:          vals[i][3],
        city:           vals[i][4],
        plan:           vals[i][5],
        planExpiry:     WP360_dateStr(vals[i][6]),
        status:         vals[i][7],
        totalSaves:     vals[i][10],
        clientSheetId:  vals[i][12] || (sheetRef ? sheetRef.id  : ''),
        clientSheetUrl: vals[i][13] || (sheetRef ? sheetRef.url : '')
      });
    }
  }
  return null;
}

function WP360_getClientSheetUrl(uid) {
  if (!uid) return null;
  const sheetRef = WP360_getClientSheetId(uid);
  if (sheetRef) return JSON.stringify({ url: sheetRef.url, id: sheetRef.id });
  const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim() && vals[i][13]) {
      return JSON.stringify({ url: String(vals[i][13]), id: String(vals[i][12]) });
    }
  }
  return null;
}

function WP360_updateClientSaveMeta(uid, ts) {
  const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      const saves = Number(vals[i][10] || 0) + 1;
      sh.getRange(i+1,10).setValue(ts);
      sh.getRange(i+1,11).setValue(saves);
      sh.getRange(i+1,12).setValue(ts);
      return;
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  SUBSCRIPTION UPDATE
// ══════════════════════════════════════════════════════════════════
function WP360_updateSubscription(uid, dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return 'parse_error'; }

  const sh   = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals = sh.getDataRange().getValues();
  const ts   = new Date().toISOString();

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      const oldPlan  = vals[i][5];
      const planDays = WP360_CONFIG.PLAN_DAYS[d.plan] || 365;
      const expiry   = new Date(Date.now() + planDays*86400000).toISOString().slice(0,10);
      sh.getRange(i+1,6).setValue(d.plan);
      sh.getRange(i+1,7).setValue(expiry);
      sh.getRange(i+1,10).setValue(ts);
      const logSh = WP360_getMasterSheet(WP360_SH.SUBS_LOG);
      logSh.appendRow(['SUB-'+Date.now(), uid, oldPlan, d.plan, ts, d.changedBy||'USER', expiry, d.remark||'Plan change']);
      return JSON.stringify({ plan: d.plan, planExpiry: expiry });
    }
  }
  return 'user_not_found';
}

// ══════════════════════════════════════════════════════════════════
//  ERROR LOG
// ══════════════════════════════════════════════════════════════════
function WP360_logError(action, msg) {
  try {
    const ss = WP360_masterSS();
    let sh   = ss.getSheetByName(WP360_SH.ERROR_LOG);
    if (!sh) { sh = ss.insertSheet(WP360_SH.ERROR_LOG); sh.appendRow(['TIMESTAMP','ACTION','ERROR']); }
    sh.appendRow([new Date().toISOString(), action, msg]);
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN HELPERS
// ══════════════════════════════════════════════════════════════════
function WP360_runSetup() {
  const ssId = WP360_getMasterSSId();
  const ss   = SpreadsheetApp.openById(ssId);
  WP360_initMasterSheets(ss);
  Logger.log('✅ WealthPilot360 MasterDB v10 ready!');
  Logger.log('URL: https://docs.google.com/spreadsheets/d/' + ssId);
  Logger.log('Sheets: ' + ss.getSheets().map(s=>s.getName()).join(', '));
}

function WP360_getClientSummary() {
  const sh      = WP360_getMasterSheet(WP360_SH.CLIENT);
  const vals    = sh.getDataRange().getValues();
  const clients = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0]) clients.push({
      uid: vals[i][0], name: vals[i][1], plan: vals[i][5],
      expiry: vals[i][6], status: vals[i][7], saves: vals[i][10],
      sheetId: vals[i][12], sheetUrl: vals[i][13]
    });
  }
  Logger.log('Total clients: ' + clients.length);
  Logger.log(JSON.stringify(clients, null, 2));
  return clients;
}

// ══════════════════════════════════════════════════════════════════
//  TEST: Run this from Apps Script editor to verify LOAD_DB
// ══════════════════════════════════════════════════════════════════
function WP360_testLoadDB() {
  const testUid = 'radha123'; // change to a real UID in your system
  const result  = WP360_loadClientSheet(testUid);
  if (result) {
    const db = JSON.parse(result);
    Logger.log('✅ LOAD_DB test passed for UID: ' + testUid);
    Logger.log('Accounting rows: ' + db.accounting.length);
    Logger.log('_savedAt (file last-modified ms): ' + db._savedAt + ' = ' + new Date(db._savedAt));
  } else {
    Logger.log('❌ LOAD_DB test failed — null returned for UID: ' + testUid);
  }
}
