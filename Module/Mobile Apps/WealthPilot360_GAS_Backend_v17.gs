// ════════════════════════════════════════════════════════════════
//  Balaji Wealth Pilot 360 – Google Apps Script Backend v14
//  FILE: WealthPilot360_GAS_Backend_v14_Unified.gs
//  Powered by: Balaji NextGen Solutions
//
//  ✅ v14 CHANGES (over v13) — CRITICAL SECURITY FIX:
//     1. Your Super Admin username/password were hardcoded in PLAIN TEXT
//        inside the HTML file's client-side JavaScript (SUPER_ADMIN_ID /
//        SUPER_ADMIN_PASS). Anyone who opened DevTools or did "View Page
//        Source" on your live site could read the admin login directly —
//        this is almost certainly why you asked for the Super Admin
//        Portal to be removed from the public screen. Fixed properly:
//        the credential check now happens HERE, on the server, via the
//        new SUPER_ADMIN_LOGIN action. Nothing admin-related ships to
//        the browser anymore.
//     2. NEW: WP360_setSuperAdminCredentials(id, pass) — run this ONCE,
//        manually, from the Apps Script editor (never from the web) to
//        store your admin login in Script Properties (server-side only,
//        never sent to any browser). See instructions in that function.
//     3. NEW action SUPER_ADMIN_LOGIN — verifies id + password hash
//        against Script Properties and returns only {ok:true/false}.
//     Everything from v13 (duplicate-mobile/email guard on registration)
//     is preserved unchanged.
// ════════════════════════════════════════════════════════════════
//     1. FIXED: "same mobile number can register/login into a SEPARATE
//        dashboard" bug. WP360_registerClient() previously ONLY checked
//        if the exact CLIENT_ID (userid) already existed. It never
//        checked mobile number or email against CLIENT_MASTER, so a
//        person could register a 2nd, 3rd... account with a DIFFERENT
//        userid but the SAME mobile number, and the backend would
//        happily create a brand-new client, a brand-new Drive folder,
//        and a brand-new dashboard for it. This is now blocked
//        server-side (the only place duplicate checks can be trusted —
//        the browser's local cache can't be relied on for this).
//     2. NEW helper WP360_findDuplicateContact(mobile, email) — scans
//        CLIENT_MASTER (industry = WEALTH360) for an existing PHONE or
//        EMAIL match before any row is written.
//     3. REGISTER_CLIENT now returns status "duplicate_mobile" or
//        "duplicate_email" (instead of silently creating a duplicate),
//        including the existing client's ID + sheet link so the
//        frontend can tell the person "you already have an account,
//        please log in instead" and point them at the right dashboard.
//     4. Everything from v12 is preserved unchanged (DIAG self-test,
//        ADMIN_LIST_CLIENTS reading real sheets, hardened LOAD_USERS/
//        SAVE_USERS error strings, "<CLIENT_ID>_<Name>" folder naming
//        with legacy "WP360_" fallback).
//
//  ⚠️ DEPLOY: Apps Script changes do NOT take effect until you deploy
//     a NEW VERSION over the SAME /exec URL (Deploy → Manage deployments
//     → Edit → New version → Deploy). If you only save the script, the
//     live URL keeps serving the OLD code — this is almost certainly
//     why your console was still showing "LOAD_USERS undefined" even
//     though v12 already had the hardened error strings.
//
//  ⚠️ AFTER DEPLOYING: hit your /exec URL with ?action=diag (GET) or
//     POST {"action":"DIAG"} and confirm every step says ok:true.
// ════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────
const WP360_CONFIG = {
  MASTER_CONTROL_SHEET_ID: '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I', // BALAJI_ERP_MASTER_CONTROL_SYSTEM
  USER_SECURITY_SHEET_ID:  '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg', // USER_SECURITY_MASTER_DB

  TEMPLATE_ID:              'TEM048',
  TEMPLATE_SHEET_ID_FALLBACK: '1OpSQYEDBMw2Pawbwu80UcoIofj-yqJzNGhxx-9XeWwk',

  CLIENTS_ROOT_FOLDER_ID:   '1lY4wLnjtA0wkoKhYb6Q-JTSeyo0haRJm',
  CLIENT_DB_SUBFOLDER_NAME: 'CLIENT_DATABASES',
  DOC_SUBFOLDER_NAME:       'Documents',

  INDUSTRY:  'WEALTH360',
  PLAN_DAYS: { trial: 90, starter: 365, professional: 365, enterprise: 3650 }
};

// ── TEMPLATE TAB NAMES (client-level cloned sheet) ─────────────────
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
      case 'LOGIN_CLIENT':         return WP360_resp(true, WP360_loginClient(data));
      case 'CHECK_CONTACT':        return WP360_resp(true, WP360_checkContact(data));
      case 'SUPER_ADMIN_LOGIN':    return WP360_resp(true, WP360_superAdminLogin(data));
      case 'GET_CLIENT':           return WP360_resp(true, WP360_getClientInfo(uid));
      case 'GET_CLIENT_SHEET_URL': return WP360_resp(true, WP360_getClientSheetUrl(uid));
      case 'UPDATE_SUBSCRIPTION':  return WP360_resp(true, WP360_updateSubscription(uid, data));
      case 'UPLOAD_DOCUMENT':      return WP360_resp(true, WP360_uploadDocument(uid, data));
      case 'LOAN_UPLOAD_DOCUMENT': return WP360_resp(true, WP360_uploadLoanDocument(uid, data));
      case 'INSURANCE_UPLOAD_DOCUMENT': return WP360_resp(true, WP360_uploadInsuranceDocument(uid, data));
      case 'ADMIN_LIST_CLIENTS':   return WP360_resp(true, WP360_adminListClients());
      case 'DIAG':                 return WP360_resp(true, WP360_diag());
      case 'PING':                 return WP360_resp(true, 'pong – Balaji WP360 GAS v17 OK (Sequential CL000XX, DB_<id>_<name> naming, full folder structure, header-safe writes)');
      default:                     return WP360_resp(false, 'Unknown action: ' + action);
    }
  } catch(err) {
    WP360_logError(action, err.toString() + ' | stack: ' + (err.stack || 'n/a'));
    return WP360_resp(false, (action||'?') + ' failed: ' + err.toString());
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return WP360_resp(true, 'pong – Balaji WP360 GAS v17 OK (Sequential CL000XX, DB_<id>_<name> naming, full folder structure, header-safe writes)');
  if (action === 'diag') return WP360_resp(true, WP360_diag());
  return ContentService
    .createTextOutput(JSON.stringify({
      status:    'Balaji WealthPilot360 GAS v17 OK (Sequential CL000XX CLIENT_ID, DB_<id>_<name> naming, full client folder structure, header-safe writes)',
      templateId: WP360_CONFIG.TEMPLATE_ID,
      poweredBy: 'Balaji NextGen Solutions'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function WP360_resp(success, data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, data: data !== undefined ? data : (success ? null : 'Unknown error (no detail returned)') }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════════
//  SELF-DIAGNOSTIC — call action:"DIAG" (or ?action=diag via GET) to
//  quickly see WHICH resource is failing when something breaks.
//  This never throws; every step is individually try/caught.
// ══════════════════════════════════════════════════════════════════
function WP360_diag() {
  const out = { ok: true, steps: [] };
  function step(name, fn) {
    try { const r = fn(); out.steps.push({ step: name, ok: true, detail: r }); }
    catch(e) { out.ok = false; out.steps.push({ step: name, ok: false, error: e.toString() }); }
  }
  step('open USER_SECURITY_MASTER_DB', () => {
    const ss = SpreadsheetApp.openById(WP360_CONFIG.USER_SECURITY_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('open CLIENT_MASTER tab', () => {
    const sh = WP360_sheet(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER');
    return 'Rows: ' + sh.getLastRow() + ', Cols: ' + sh.getLastColumn();
  });
  step('open USER_MASTER tab', () => {
    const sh = WP360_sheet(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER');
    return 'Rows: ' + sh.getLastRow() + ', Cols: ' + sh.getLastColumn();
  });
  step('open BALAJI_ERP_MASTER_CONTROL_SYSTEM', () => {
    const ss = SpreadsheetApp.openById(WP360_CONFIG.MASTER_CONTROL_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('open TEMPLATE_REGISTRY row TEM048', () => {
    const row = WP360_findRow(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'TEMPLATE_REGISTRY', 'TEMPLATE_ID', WP360_CONFIG.TEMPLATE_ID);
    if (!row) throw new Error('TEM048 row not found in TEMPLATE_REGISTRY');
    return 'GOOGLE_SHEET_ID=' + row.GOOGLE_SHEET_ID;
  });
  step('ensure/read WEALTHPILOT_USER_CACHE (LOAD_USERS path)', () => {
    const blob = WP360_loadUsers();
    return 'Loaded cache, length=' + (blob ? blob.length : 0);
  });
  step('write test to WEALTHPILOT_USER_CACHE (SAVE_USERS path)', () => {
    const before = WP360_loadUsers();
    WP360_saveUsers(before); // round-trip, doesn't change data
    return 'Round-trip write OK';
  });
  step('duplicate-contact scan (CHECK_CONTACT path)', () => {
    const r = WP360_findDuplicateContact('0000000000', '__diag_no_match__@example.invalid');
    return 'Scan OK, matched=' + (r ? JSON.stringify(r) : 'none (expected none)');
  });
  step('open Drive root client folder', () => {
    const f = DriveApp.getFolderById(WP360_CONFIG.CLIENTS_ROOT_FOLDER_ID);
    return 'Opened folder: ' + f.getName();
  });
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  SHARED-SHEET HELPERS
// ══════════════════════════════════════════════════════════════════
function WP360_sheet(spreadsheetId, tabName) {
  const sh = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
  if (!sh) throw new Error('Tab not found: ' + tabName + ' in ' + spreadsheetId);
  return sh;
}

function WP360_appendRowByHeader(spreadsheetId, tabName, rowObj) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  const header = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  sh.appendRow(header.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
}

function WP360_findRow(spreadsheetId, tabName, matchCol, matchVal) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  if (sh.getLastRow() < 2) return null;
  const data = sh.getDataRange().getValues();
  const hdr  = data[0];
  const colIdx = hdr.indexOf(matchCol);
  if (colIdx === -1) return null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]).trim() === String(matchVal).trim()) {
      const obj = {}; hdr.forEach((h,j) => obj[h] = data[i][j]);
      obj._rowIndex = i + 1;
      obj._colIndex = colIdx;
      return obj;
    }
  }
  return null;
}

function WP360_findAllRows(spreadsheetId, tabName, matchCol, matchVal) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  if (sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const hdr  = data[0];
  const colIdx = matchCol ? hdr.indexOf(matchCol) : -1;
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (colIdx === -1 || String(data[i][colIdx]).trim() === String(matchVal).trim()) {
      const obj = {}; hdr.forEach((h,j) => obj[h] = data[i][j]);
      obj._rowIndex = i + 1;
      results.push(obj);
    }
  }
  return results;
}

function WP360_updateCell(spreadsheetId, tabName, rowIndex, colName, value) {
  const sh  = WP360_sheet(spreadsheetId, tabName);
  const hdr = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const c   = hdr.indexOf(colName);
  if (c === -1) return;
  sh.getRange(rowIndex, c+1).setValue(value);
}

function WP360_ensureUtilityTab(spreadsheetId, tabName, headers) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.appendRow(headers);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ══════════════════════════════════════════════════════════════════
//  TEMPLATE RESOLUTION (TEM048)
// ══════════════════════════════════════════════════════════════════
function WP360_getTemplateInfo() {
  const row = WP360_findRow(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'TEMPLATE_REGISTRY', 'TEMPLATE_ID', WP360_CONFIG.TEMPLATE_ID);
  if (row && row.GOOGLE_SHEET_ID) {
    return {
      sheetId:  String(row.GOOGLE_SHEET_ID),
      folderId: String(row.GOOGLE_DRIVE_FOLDER_ID || '')
    };
  }
  return { sheetId: WP360_CONFIG.TEMPLATE_SHEET_ID_FALLBACK, folderId: '' };
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT FOLDER + SHEET MANAGEMENT
// ══════════════════════════════════════════════════════════════════
function WP360_getClientDbFolder() {
  const rootFolder = DriveApp.getFolderById(WP360_CONFIG.CLIENTS_ROOT_FOLDER_ID);
  if (!WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME) return rootFolder;
  const subs = rootFolder.getFoldersByName(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
  if (subs.hasNext()) return subs.next();
  return rootFolder.createFolder(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
}

// v12: folder is named "<CLIENT_ID>_<Name>" (no "WP360_" prefix),
// e.g. "CL0001_Rahul Sharma". v13 keeps this unchanged.
function WP360_getOrCreateClientFolder(uid, name) {
  const parentFolder = WP360_getClientDbFolder();
  const safeName      = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').trim();
  const folderName    = uid + '_' + safeName;
  const existing       = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();

  // Backward-compat: if an OLD "WP360_<uid>_<name>" folder already
  // exists from before this change, reuse it instead of creating a
  // duplicate for the same client.
  const legacyName = 'WP360_' + uid + '_' + safeName;
  const legacy = parentFolder.getFoldersByName(legacyName);
  if (legacy.hasNext()) return legacy.next();

  return parentFolder.createFolder(folderName);
}

function WP360_getOrCreateSubFolder(parentFolder, subName) {
  const existing = parentFolder.getFoldersByName(subName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(subName);
}

// ══════════════════════════════════════════════════════════════════
//  v17: FULL CLIENT FOLDER STRUCTURE (spec section 13)
//  Clients/CL000XX_Name/{Database,Profile,Attachments,Assets,
//    Loans/{Sanction_Letters,Repayment_Receipts},Investments,Insurance,
//    Credit_Cards,Income,Expenses,Budget,Goals,Reports,QR_Codes,
//    Backup,Settings,Logs}
//  Idempotent — safe to call on every registration/login without
//  creating duplicates (WP360_getOrCreateSubFolder checks first).
// ══════════════════════════════════════════════════════════════════
function WP360_ensureClientFolderStructure(clientFolder) {
  const topLevel = [
    'Database', 'Profile', 'Attachments', 'Assets', 'Loans',
    'Investments', 'Insurance', 'Credit_Cards', 'Income', 'Expenses',
    'Budget', 'Goals', 'Reports', 'QR_Codes', 'Backup', 'Settings', 'Logs'
  ];
  const subs = {};
  topLevel.forEach(name => { subs[name] = WP360_getOrCreateSubFolder(clientFolder, name); });

  // Loans/ only gets these two — per spec, no other subfolders inside it.
  WP360_getOrCreateSubFolder(subs['Loans'], 'Sanction_Letters');
  WP360_getOrCreateSubFolder(subs['Loans'], 'Repayment_Receipts');

  return subs;
}

// v12: folder is named "<CLIENT_ID>_<Name>" (no "WP360_" prefix),
// e.g. "CL0001_Rahul Sharma". v13-v17 keep this unchanged.
function WP360_getOrCreateClientFolder(uid, name) {
  const parentFolder = WP360_getClientDbFolder();
  const safeName      = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').trim();
  const folderName    = uid + '_' + safeName;
  const existing       = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();

  // Backward-compat: if an OLD "WP360_<uid>_<name>" folder already
  // exists from before this change, reuse it instead of creating a
  // duplicate for the same client.
  const legacyName = 'WP360_' + uid + '_' + safeName;
  const legacy = parentFolder.getFoldersByName(legacyName);
  if (legacy.hasNext()) return legacy.next();

  return parentFolder.createFolder(folderName);
}

function WP360_createClientSheet(uid, name) {
  try {
    const folder    = WP360_getOrCreateClientFolder(uid, name);
    const safeName   = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').trim();
    const sheetName  = 'DB_' + uid + '_' + safeName;

    // Look for the v17-style name first...
    let existing = folder.getFilesByName(sheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      WP360_ensureClientFolderStructure(folder);
      return { id: f.getId(), url: f.getUrl(), name: sheetName, folderId: folder.getId() };
    }
    // ...then fall back to the legacy "WealthPilot360_<uid>" name so
    // existing clients created before v17 keep loading the SAME sheet
    // instead of silently getting a second, empty one.
    const legacySheetName = 'WealthPilot360_' + uid;
    existing = folder.getFilesByName(legacySheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      WP360_ensureClientFolderStructure(folder);
      return { id: f.getId(), url: f.getUrl(), name: legacySheetName, folderId: folder.getId() };
    }

    const tmpl     = WP360_getTemplateInfo();
    const template = DriveApp.getFileById(tmpl.sheetId);
    const copy     = template.makeCopy(sheetName, folder);
    const copyId   = copy.getId();
    const copyUrl  = copy.getUrl();

    try {
      const ss      = SpreadsheetApp.openById(copyId);
      const usersSh = ss.getSheetByName('👤 Users');
      if (usersSh) {
        const usersHeaders = ['User ID','Full Name','Mobile','Email','Password (hashed)','Registered On','Last Login','Plan'];
        const dataStart = WP360_findDataStartRow(usersSh, usersHeaders);
        const vals  = usersSh.getDataRange().getValues();
        const now   = new Date().toISOString().slice(0,10);
        let userRow = -1;
        // Only scan real data rows (dataStart onward), never the title/header rows.
        for (let i = dataStart - 1; i < vals.length; i++) {
          if (String(vals[i][0]).trim() === String(uid).trim()) { userRow = i + 1; break; }
        }
        if (userRow === -1) {
          const lastRow = usersSh.getLastRow();
          const nextRow = Math.max(dataStart, lastRow + 1);
          usersSh.getRange(nextRow,1,1,8).setValues([[uid,'','','',now,now,'Professional','Active']]);
        }
      }
    } catch(e) { Logger.log('Users tab seed failed: ' + e); }

    try {
      WP360_ensureClientFolderStructure(folder);
    } catch(e) { Logger.log('Client folder structure creation warning: ' + e); }

    Logger.log('✅ Client sheet created: ' + sheetName + ' → ' + copyUrl);
    return { id: copyId, url: copyUrl, name: sheetName, folderId: folder.getId() };

  } catch(err) {
    WP360_logError('WP360_createClientSheet', err.toString());
    throw new Error('Failed to create client sheet: ' + err.toString());
  }
}

function WP360_getClientSheetId(uid) {
  const row = WP360_findRow(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', uid);
  if (row && row.MASTER_DB_ID) {
    return { id: String(row.MASTER_DB_ID), url: String(row.MASTER_DB_URL || '') };
  }
  const dep = WP360_findRow(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', 'CLIENT_ID', uid);
  if (dep && dep.MASTER_DB_ID) {
    return { id: String(dep.MASTER_DB_ID), url: 'https://docs.google.com/spreadsheets/d/' + dep.MASTER_DB_ID + '/edit' };
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  APP-LEVEL USER CACHE  (SAVE_USERS / LOAD_USERS)
//  Hardened since v12: any internal failure is caught here and turned
//  into a descriptive string rather than bubbling up as a bare throw,
//  so the browser console always shows the real cause.
//  ⚠️ NOTE: this JSON blob is a CONVENIENCE CACHE ONLY. It must never
//  be the sole source of truth for duplicate-mobile checks — that's
//  what caused the multi-dashboard bug. CLIENT_MASTER is the source
//  of truth; see WP360_findDuplicateContact() below.
// ══════════════════════════════════════════════════════════════════
function WP360_saveUsers(usersJson) {
  try {
    const sh = WP360_ensureUtilityTab(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'WEALTHPILOT_USER_CACHE', ['KEY','REGISTRY_JSON','LAST_UPDATED']);
    const vals = sh.getDataRange().getValues();
    let blobRow = -1;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][0] === '__REGISTRY__') { blobRow = i + 1; break; }
    }
    const ts = new Date().toISOString();
    if (blobRow === -1) sh.appendRow(['__REGISTRY__', usersJson, ts]);
    else { sh.getRange(blobRow,2).setValue(usersJson); sh.getRange(blobRow,3).setValue(ts); }
    return 'saved';
  } catch(err) {
    WP360_logError('WP360_saveUsers', err.toString());
    throw new Error('SAVE_USERS failed: ' + err.toString());
  }
}

function WP360_loadUsers() {
  try {
    const sh = WP360_ensureUtilityTab(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'WEALTHPILOT_USER_CACHE', ['KEY','REGISTRY_JSON','LAST_UPDATED']);
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][0] === '__REGISTRY__') return vals[i][1] || '{}';
    }
    return '{}';
  } catch(err) {
    WP360_logError('WP360_loadUsers', err.toString());
    throw new Error('LOAD_USERS failed: ' + err.toString());
  }
}

// ══════════════════════════════════════════════════════════════════
//  ★ AUTHORITATIVE DUPLICATE-CONTACT CHECK ★
//  Scans the real CLIENT_MASTER rows (source of truth) for an existing
//  mobile or email within this app's industry. This is what closes the
//  "same mobile number can end up on a separate dashboard" hole, since
//  it is checked on the SERVER, not from a browser-side cache that can
//  be empty, stale, or fail silently.
// ══════════════════════════════════════════════════════════════════
function WP360_findDuplicateContact(mobile, email) {
  try {
    const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
    const m = mobile ? String(mobile).trim() : '';
    const e = email ? String(email).trim().toLowerCase() : '';
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (m && String(c.PHONE || '').trim() === m) {
        return { field: 'mobile', clientId: c.CLIENT_ID, name: c.CONTACT_NAME || c.COMPANY_NAME || '' };
      }
      if (e && String(c.EMAIL || '').trim().toLowerCase() === e) {
        return { field: 'email', clientId: c.CLIENT_ID, name: c.CONTACT_NAME || c.COMPANY_NAME || '' };
      }
    }
    return null;
  } catch(err) {
    WP360_logError('WP360_findDuplicateContact', err.toString());
    return null;
  }
}

// Frontend-callable pre-check (action: "CHECK_CONTACT") so the register
// form can warn the person BEFORE they fill out the whole form, not just
// at final submit.
function WP360_checkContact(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ duplicate: false }); }

  const dup = WP360_findDuplicateContact(d.mobile, d.email);
  if (!dup) return JSON.stringify({ duplicate: false });

  const ex = WP360_getClientSheetId(dup.clientId);
  return JSON.stringify({
    duplicate: true,
    field: dup.field,
    existingClientId: dup.clientId,
    existingName: dup.name,
    clientSheetUrl: ex ? ex.url : ''
  });
}

// ══════════════════════════════════════════════════════════════════
//  SEQUENTIAL CLIENT_ID GENERATOR (v16 fix)
//  WealthPilot360 used to set CLIENT_ID = the person's chosen login
//  string (e.g. "raijagarnath123"), which doesn't match the CL000XX
//  numbering used by Business OS / ERP. This scans BOTH the WP360
//  CLIENT_MASTER and the shared MASTER_CONTROL CLIENT_DATABASE_REGISTRY
//  (which is written to by every product) so the sequence never
//  collides with an ID already issued by another product.
// ══════════════════════════════════════════════════════════════════
function WP360_nextClientId() {
  let maxNum = 0;

  const scanForMax = (spreadsheetId, tabName, col) => {
    try {
      const sh = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
      if (!sh) return;
      const values = sh.getDataRange().getValues();
      const header = values[0];
      const idx = header.indexOf(col);
      if (idx === -1) return;
      for (let i = 1; i < values.length; i++) {
        const v = String(values[i][idx] || '').trim();
        const m = v.match(/^CL0*([0-9]+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    } catch(e) { Logger.log('WP360_nextClientId scan failed for ' + tabName + ': ' + e); }
  };

  scanForMax(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID');
  scanForMax(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID');

  const next = maxNum + 1;
  return 'CL' + String(next).padStart(5, '0');
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT REGISTRATION
// ══════════════════════════════════════════════════════════════════
function WP360_registerClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return 'parse_error'; }

  // loginId = the human-chosen "User ID" from the registration form —
  // used ONLY for login lookup from now on, never as CLIENT_ID.
  const loginId = d.uid || d.userid;
  if (!loginId) return 'no_uid';

  // ── Line of defense #1: this login id is already taken ────────────
  const existingLogin = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'ADMIN_USERNAME', loginId);
  if (existingLogin) {
    const ex = WP360_getClientSheetId(existingLogin.CLIENT_ID);
    return JSON.stringify({
      status: 'already_exists',
      clientId:       existingLogin.CLIENT_ID,
      clientSheetId:  ex ? ex.id  : '',
      clientSheetUrl: ex ? ex.url : ''
    });
  }

  // ── Line of defense #2: same mobile or email already tied to a
  //    DIFFERENT client. ─────────────────────────
  const dup = WP360_findDuplicateContact(d.mobile, d.email);
  if (dup) {
    const ex = WP360_getClientSheetId(dup.clientId);
    Logger.log('⛔ Blocked duplicate registration attempt: ' + dup.field + ' already used by CLIENT_ID ' + dup.clientId + ' (new attempt loginId=' + loginId + ')');
    return JSON.stringify({
      status:          dup.field === 'mobile' ? 'duplicate_mobile' : 'duplicate_email',
      existingClientId: dup.clientId,
      existingName:     dup.name,
      clientSheetId:   ex ? ex.id  : '',
      clientSheetUrl:  ex ? ex.url : ''
    });
  }

  // ── Generate the real CLIENT_ID (CL000XX) — used for the sheet,
  //    the folder, and every registry row below. loginId is kept
  //    ONLY as ADMIN_USERNAME for login lookup.
  const uid = WP360_nextClientId();

  const sheetInfo = WP360_createClientSheet(uid, d.name);
  const planDays  = WP360_CONFIG.PLAN_DAYS[d.plan] || 90;
  const now       = new Date();
  const expiry    = d.planExpiry ? new Date(d.planExpiry) : new Date(Date.now() + planDays*86400000);
  const apiUrl    = ScriptApp.getService().getUrl();
  const plan      = d.plan || 'trial';

  WP360_appendRowByHeader(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', {
    CLIENT_ID: uid, CONTACT_NAME: d.name||'', PHONE: d.mobile||'', ALT_PHONE:'', EMAIL: d.email||'',
    COMPANY_NAME: d.name||'', COMPANY_TYPE: 'INDIVIDUAL', GST_NO:'', PAN:'', ADDRESS:'', CITY: d.city||'',
    STATE:'', PIN:'', INDUSTRY: WP360_CONFIG.INDUSTRY, PLAN: plan, ERP_URL: apiUrl,
    ADMIN_NAME: d.name||'', ADMIN_EMAIL: d.email||'', ADMIN_USERNAME: loginId, ADMIN_PASSWORD: d.password||'',
    ADMIN_MOBILE: d.mobile||'', ADMIN_ROLE: 'OWNER', STATUS: 'ACTIVE', LICENSE_STATUS: 'ACTIVE',
    REGISTERED_BY: 'WEALTHPILOT360_SELF_REGISTER', REGISTERED_AT: now, LAST_UPDATED: now
  });

  WP360_appendRowByHeader(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', {
    USER_ID: uid + '-U1', CLIENT_ID: uid, USER_CODE: loginId, FULL_NAME: d.name||'', EMAIL: d.email||'',
    MOBILE_NO: d.mobile||'', PASSWORD: WP360_hashPass(d.password||''), ROLE: 'OWNER', INDUSTRY: WP360_CONFIG.INDUSTRY,
    BRANCH: 'PERSONAL', ACCESS_LEVEL: 'FULL', STATUS: 'ACTIVE', WEB_ACCESS: 'YES', APP_ACCESS: 'YES',
    OTP_ACCESS: 'NO', LOGIN_TYPE: 'PASSWORD', COMPANY_NAME: d.name||'', DEPARTMENT: 'PERSONAL_FINANCE',
    DESIGNATION: 'OWNER', DEFAULT_DASHBOARD: 'WEALTHPILOT360_DASHBOARD', CREATED_BY: 'SELF_REGISTER',
    CREATED_DATE: now, LAST_LOGIN: '', FAILED_ATTEMPTS: 0, ACCOUNT_LOCKED: 'NO'
  });

  WP360_appendRowByHeader(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', {
    CLIENT_ID: uid, COMPANY_NAME: d.name||'', INDUSTRY: WP360_CONFIG.INDUSTRY, OWNER_NAME: d.name||'',
    EMAIL: d.email||'', MOBILE_NO: d.mobile||'', PLAN_NAME: plan, LICENSE_STATUS: 'ACTIVE',
    START_DATE: now, EXPIRY_DATE: expiry, MAX_USERS: 1, MAX_BRANCHES: 1, DATABASE_ID: sheetInfo.id,
    API_URL: apiUrl, THEME: 'WealthPilot Gold',
    ACTIVE_MODULES: 'LOANS,BILLS,INSURANCE,INVESTMENTS,ASSETS,CREDITCARDS,SUBSCRIPTIONS,TRANSACTIONS,GOALS,DOCUMENTS,FAMILY,BUDGET,ACCOUNTING',
    LOGO_URL:'', ADDRESS:'', CITY: d.city||'', STATE:'', COUNTRY: 'INDIA', GST_NO:'', PAN_NO:'',
    CREATED_ON: now, LAST_UPDATED: now
  });

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_REGISTRY', {
    CLIENT_ID: uid, CLIENT_NAME: d.name||'', INDUSTRY: WP360_CONFIG.INDUSTRY, DATABASE_TYPE: 'WEALTHPILOT360_DB',
    DATABASE_NAME: sheetInfo.name, GOOGLE_SHEET_ID: sheetInfo.id, FOLDER_ID: sheetInfo.folderId,
    STATUS: 'ACTIVE', CREATED_AT: now, UPDATED_AT: now
  });

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', {
    CLIENT_ID: uid, COMPANY_NAME: d.name||'', MASTER_DB_ID: sheetInfo.id, MASTER_DB_URL: sheetInfo.url,
    TRANSACTION_DB_ID:'', TRANSACTION_DB_URL:'', REPORT_DB_ID:'', REPORT_DB_URL:'',
    FOLDER_ID: sheetInfo.folderId, CREATED_ON: now, STATUS: 'ACTIVE'
  });

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', {
    CLIENT_ID: uid, CLIENT_CODE: uid, CLIENT_NAME: d.name||'', INDUSTRY: WP360_CONFIG.INDUSTRY,
    TEMPLATE_ID: WP360_CONFIG.TEMPLATE_ID, MASTER_DB_ID: sheetInfo.id, MAIN_FOLDER_ID: sheetInfo.folderId,
    ADMIN_NAME: d.name||'', ADMIN_EMAIL: d.email||'', MOBILE_NO: d.mobile||'', PLAN_TYPE: plan,
    LICENSE_KEY: 'AUTO-'+uid, API_KEY: 'API-'+uid, TOTAL_BRANCH: 1, LIVE_STATUS: 'LIVE',
    CREATED_AT: now, UPDATED_AT: now, STATUS: 'ACTIVE'
  });

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'SAAS_SUBSCRIPTION_MASTER', {
    SUBSCRIPTION_ID: 'SUB-'+uid+'-'+Date.now(), CLIENT_ID: uid, PLAN_NAME: plan, START_DATE: now,
    END_DATE: expiry, AMOUNT: 0, PAYMENT_STATUS: plan === 'trial' ? 'FREE_TRIAL' : 'ACTIVE',
    LICENSE_STATUS: 'ACTIVE', USER_LIMIT: 1, BRANCH_LIMIT: 1, STORAGE_LIMIT: '', STATUS: 'ACTIVE'
  });

  const tmpl = WP360_getTemplateInfo();
  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'TEMPLATE_USAGE_LOG', {
    LOG_ID: Utilities.getUuid(), CLIENT_ID: uid, TEMPLATE_ID: WP360_CONFIG.TEMPLATE_ID,
    INDUSTRY: WP360_CONFIG.INDUSTRY, SOURCE_TEMPLATE_DB: tmpl.sheetId, COPIED_DB_ID: sheetInfo.id,
    COPIED_FOLDER_ID: sheetInfo.folderId, COPY_DATE: now, COPY_BY: 'WEALTHPILOT360_SELF_REGISTER',
    STATUS: 'SUCCESS'
  });

  Logger.log('✅ Registered WealthPilot360 client: ' + uid + ' (login: ' + loginId + ') → ' + sheetInfo.url);

  return JSON.stringify({
    status: 'registered',
    clientId:        uid,
    loginId:         loginId,
    clientSheetId:   sheetInfo.id,
    clientSheetUrl:  sheetInfo.url,
    clientSheetName: sheetInfo.name
  });
}

function WP360_hashPass(pw) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw)));
}

// ══════════════════════════════════════════════════════════════════
//  CLIENT LOGIN (v16 fix)
//  Resolves the person's typed "User ID" (ADMIN_USERNAME) + password
//  to their real CLIENT_ID (CL000XX), since the two are no longer the
//  same string. Also accepts mobile number as an alternate login key.
// ══════════════════════════════════════════════════════════════════
function WP360_loginClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const loginInput = String(d.uid || d.userid || d.mobile || '').trim();
  if (!loginInput) return JSON.stringify({ status: 'no_login_id' });

  let row = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'ADMIN_USERNAME', loginInput);
  if (!row) row = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'PHONE', loginInput);
  if (!row) return JSON.stringify({ status: 'not_found' });

  if (d.password) {
    const hashed = WP360_hashPass(d.password);
    const userRow = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', 'CLIENT_ID', row.CLIENT_ID);
    if (!userRow || String(userRow.PASSWORD) !== hashed) {
      return JSON.stringify({ status: 'wrong_password' });
    }
  }

  const sheetInfo = WP360_getClientSheetId(row.CLIENT_ID);
  return JSON.stringify({
    status:          'ok',
    clientId:        row.CLIENT_ID,
    loginId:         row.ADMIN_USERNAME,
    name:            row.CONTACT_NAME || row.COMPANY_NAME || '',
    mobile:          row.PHONE || '',
    email:           row.EMAIL || '',
    clientSheetId:   sheetInfo ? sheetInfo.id  : '',
    clientSheetUrl:  sheetInfo ? sheetInfo.url : ''
  });
}

// ══════════════════════════════════════════════════════════════════
//  ★ SUPER ADMIN LOGIN (server-side, credentials never ship to browser) ★
// ══════════════════════════════════════════════════════════════════
function WP360_superAdminLogin(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ ok: false }); }

  const props = PropertiesService.getScriptProperties();
  const storedId       = props.getProperty('SUPER_ADMIN_ID');
  const storedPassHash = props.getProperty('SUPER_ADMIN_PASS_HASH');

  if (!storedId || !storedPassHash) {
    WP360_logError('WP360_superAdminLogin', 'Not configured — run WP360_setSuperAdminCredentials() once from the Apps Script editor.');
    return JSON.stringify({ ok: false });
  }

  const idMatch   = String(d.id || '').trim() === storedId;
  const passMatch = WP360_hashPass(d.pass || '') === storedPassHash;
  return JSON.stringify({ ok: idMatch && passMatch });
}

// ══════════════════════════════════════════════════════════════════
//  ★ ONE-TIME SETUP: run this MANUALLY from the Apps Script
//  editor (select this function → Run) to store your Super Admin login.
//  It is NEVER called from the web app, so it's never reachable by a
//  browser. Edit the two values below, run it once, then you can leave
//  it here (running it again just re-saves the same values) or blank
//  the values back out — either way nothing here ever reaches the site.
// ══════════════════════════════════════════════════════════════════
function WP360_setSuperAdminCredentials() {
  const ADMIN_ID       = 'sumandebnath12';  // ← change if you want a different admin ID
  const ADMIN_PASSWORD = 'Radha@325';       // ← change to your real admin password

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SUPER_ADMIN_ID', ADMIN_ID);
  props.setProperty('SUPER_ADMIN_PASS_HASH', WP360_hashPass(ADMIN_PASSWORD));
  Logger.log('✅ Super Admin credentials saved to Script Properties for ID: ' + ADMIN_ID);
  Logger.log('   (The plaintext password was NOT stored — only its hash — and none of this is ever sent to the browser.)');
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN_LIST_CLIENTS — reads the REAL CLIENT_MASTER + CLIENT_REGISTRY
//  rows (source of truth written by REGISTER_CLIENT / UPDATE_SUBSCRIPTION),
//  filtered to INDUSTRY = WEALTH360, joined with USER_MASTER.
// ══════════════════════════════════════════════════════════════════
function WP360_adminListClients() {
  try {
    const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
    const registryRows = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
    const userRows = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);

    const regByClient = {};
    registryRows.forEach(r => { regByClient[r.CLIENT_ID] = r; });
    const userByClient = {};
    userRows.forEach(u => { userByClient[u.CLIENT_ID] = u; });

    const phoneCounts = {};
    clients.forEach(c => {
      const p = String(c.PHONE || '').trim();
      if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1;
    });

    const out = clients.map(c => {
      const reg  = regByClient[c.CLIENT_ID] || {};
      const user = userByClient[c.CLIENT_ID] || {};
      const sheetRef = WP360_getClientSheetId(c.CLIENT_ID);
      const meta = WP360_getSaveMeta(c.CLIENT_ID);
      const phoneKey = String(c.PHONE || '').trim();
      return {
        uid:            c.CLIENT_ID,
        name:           c.CONTACT_NAME,
        mobile:         c.PHONE,
        email:          c.EMAIL,
        city:           c.CITY,
        plan:           c.PLAN,
        status:         c.STATUS,
        planExpiry:     WP360_dateStr(reg.EXPIRY_DATE || ''),
        registeredAt:   WP360_dateStr(c.REGISTERED_AT || ''),
        userRole:       user.ROLE || '',
        userStatus:     user.STATUS || '',
        lastLogin:      WP360_dateStr(user.LAST_LOGIN || ''),
        accountLocked:  user.ACCOUNT_LOCKED || 'NO',
        totalSaves:     meta.totalSaves,
        clientSheetId:  sheetRef ? sheetRef.id  : '',
        clientSheetUrl: sheetRef ? sheetRef.url : '',
        duplicateMobile: phoneKey ? phoneCounts[phoneKey] > 1 : false
      };
    });

    return JSON.stringify(out);
  } catch(err) {
    WP360_logError('WP360_adminListClients', err.toString());
    throw new Error('ADMIN_LIST_CLIENTS failed: ' + err.toString());
  }
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
    WP360_registerClient(JSON.stringify({ uid, name: userName }));
    sheetRef = WP360_getClientSheetId(uid);
    if (!sheetRef) return 'client_not_registered';
  }

  return WP360_writeToClientSheet(sheetRef.id, uid, db);
}

function WP360_writeToClientSheet(sheetId, uid, db) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const ts = new Date().toISOString();

    WP360_writeTabData(ss, '🏦 Loans',
      ['Loan Name','Bank / Lender','Loan Type','Original Amount (₹)','Outstanding (₹)','Monthly EMI (₹)','Interest Rate (%)','EMI Due Date','User ID','Notes','Tenure (Months)','Manual Interest Override','Sanction Letter URL','Repayment Receipt URL'],
      (db.loans||[]).map(l => [l.name,l.bank,l.type,l.amount,l.outstanding,l.emi,l.interest,l.due,uid,l.notes||'',l.tenure||'',l.manualInterest?'YES':'NO',l.sanctionUrl||'',l.receiptUrl||''])
    );
    WP360_writeTabData(ss, '📋 Bills',
      ['Bill Name','Provider','Category','Amount (₹)','Due Date','Status','User ID','Notes'],
      (db.bills||[]).map(b => [b.name,b.provider,b.cat,b.amount,b.due,b.status||'Pending',uid,b.notes||''])
    );
    WP360_writeTabData(ss, '🛡️ Insurance',
      ['Policy Name','Type','Policy Number','Annual Premium (₹)','Renewal Date','Coverage (₹)','Nominee','User ID','Notes','Policy Document URL'],
      (db.insurance||[]).map(i => [i.name,i.type,i.policy,i.premium,i.renewal,i.coverage,i.nominee,uid,i.notes||'',i.policyDocUrl||''])
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

// ══════════════════════════════════════════════════════════════════
//  v17 CRITICAL FIX: the real TEM048 template has a 4-row title block
//  (Title / Subtitle / blank / REAL HEADERS) before data starts on
//  every tab. The old heuristic here only ever guessed row 2 or 3,
//  which meant every save was overwriting the actual header row (row 4)
//  and the TOTAL row with client data — silently corrupting the sheet
//  structure. This now finds the real header row by matching header
//  TEXT (headers[0]), scanning up to the first 12 rows, so it works
//  regardless of how many title/description rows a tab has.
// ══════════════════════════════════════════════════════════════════
function WP360_findDataStartRow(sh, headers) {
  const scanRows = Math.min(sh.getLastRow() || 1, 12);
  const target = String(headers[0]).trim().toLowerCase();
  if (scanRows >= 1) {
    const firstCol = sh.getRange(1,1,scanRows,1).getValues();
    for (let i = 0; i < firstCol.length; i++) {
      const cell = String(firstCol[i][0] || '').trim().toLowerCase();
      if (cell === target) return i + 2; // header row found at (i+1); data starts next row
    }
  }
  // Fallback (header text not found, e.g. brand-new/blank tab): assume
  // a 2-row title block, matching the template's usual pattern.
  const firstVals = sh.getRange(1,1,Math.min(sh.getLastRow()||1,3),1).getValues();
  if (firstVals[0] && firstVals[0][0] && firstVals[1] && firstVals[1][0] && String(firstVals[1][0]) !== headers[0]) {
    return 3;
  }
  return 2;
}

function WP360_writeTabData(ss, tabName, headers, rows) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) return;
  const dataStartRow = WP360_findDataStartRow(sh, headers);
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

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const db = {
      loans:[], bills:[], insurance:[], investments:[],
      assets:[], goals:[], transactions:[], family:[],
      business:[], creditCards:[], subscriptions:[],
      documents:[], budgets:[], accounting:[], profile:{}
    };

    db.loans = WP360_readTabRows(ss, '🏦 Loans', uid,
      r => ({
        name:r[0], bank:r[1], type:r[2], amount:r[3], outstanding:r[4], emi:r[5], interest:r[6], due:WP360_dateStr(r[7]),
        notes:r[9]||'', tenure:r[10]||'', manualInterest:String(r[11]).toUpperCase()==='YES',
        sanctionUrl:r[12]||'', receiptUrl:r[13]||''
      }),
      8
    );
    db.bills = WP360_readTabRows(ss, '📋 Bills', uid,
      r => ({ name:r[0], provider:r[1], cat:r[2], amount:r[3], due:WP360_dateStr(r[4]), status:r[5] }),
      6
    );
    db.insurance = WP360_readTabRows(ss, '🛡️ Insurance', uid,
      r => ({ name:r[0], type:r[1], policy:r[2], premium:r[3], renewal:WP360_dateStr(r[4]), coverage:r[5], nominee:r[6], policyDocUrl:r[9]||'' }),
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
        id:      String(r[0]||'') + '_' + String(r[1]||'') + '_' + String(r[8]||''),
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

    try {
      db._savedAt = DriveApp.getFileById(sheetRef.id).getLastUpdated().getTime();
    } catch(e) { db._savedAt = Date.now(); }

    return JSON.stringify(db);

  } catch(err) {
    WP360_logError('WP360_loadClientSheet', err.toString());
    return null;
  }
}

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
      const rowUid   = String(r[uidColIndex] || '').trim();
      const checkUid = String(uid).trim();
      if (rowUid !== checkUid) continue;
    }

    try { results.push(mapFn(r)); }
    catch(e) { Logger.log('⚠️ mapFn error in tab [' + tabName + '] row ' + i + ': ' + e); }
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
// Header row (first column text) for each data tab — used to find the
// real data-start row before a destructive clear, same detection as
// WP360_writeTabData. Keeping this list in one place so both stay in sync.
const WP360_TAB_FIRST_HEADER = {
  '🏦 Loans': 'Loan Name', '📋 Bills': 'Bill Name', '🛡️ Insurance': 'Policy Name',
  '📈 Investments': 'Investment Name', '💰 Assets': 'Name', '💳 Credit Cards': 'Card Name',
  '🔄 Subscriptions': 'Service Name', '💵 Transactions': 'Date', '🎯 Goals': 'Goal Name',
  '📁 Documents': 'Document Name', '👨‍👩‍👧‍👦 Family': 'Member Name', '📊 Budget': 'Category',
  'Accounting': 'Date'
};

function WP360_clearClientSheet(uid) {
  if (!uid) return 'no_uid';
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return 'sheet_not_found';
  try {
    const ss       = SpreadsheetApp.openById(sheetRef.id);
    const dataTabs = WP360_TABS.filter(t => t !== '📊 Dashboard' && t !== '👤 Users');
    dataTabs.forEach(tabName => {
      const sh = ss.getSheetByName(tabName);
      if (!sh) return;
      const firstHeader = WP360_TAB_FIRST_HEADER[tabName] || 'Name';
      const dataStartRow = WP360_findDataStartRow(sh, [firstHeader]);
      if (sh.getLastRow() >= dataStartRow) {
        sh.getRange(dataStartRow,1, sh.getLastRow()-dataStartRow+1, sh.getLastColumn()).clearContent();
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
  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return null;

  const cr       = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', uid);
  const sheetRef = WP360_getClientSheetId(uid);
  const meta     = WP360_getSaveMeta(uid);

  return JSON.stringify({
    uid:            uid,
    name:           cm.CONTACT_NAME,
    mobile:         cm.PHONE,
    email:          cm.EMAIL,
    city:           cm.CITY,
    plan:           cm.PLAN,
    planExpiry:     WP360_dateStr(cr ? cr.EXPIRY_DATE : ''),
    status:         cm.STATUS,
    totalSaves:     meta.totalSaves,
    clientSheetId:  sheetRef ? sheetRef.id  : '',
    clientSheetUrl: sheetRef ? sheetRef.url : ''
  });
}

function WP360_getClientSheetUrl(uid) {
  if (!uid) return null;
  const sheetRef = WP360_getClientSheetId(uid);
  if (sheetRef) return JSON.stringify({ url: sheetRef.url, id: sheetRef.id });
  return null;
}

function WP360_getSaveMeta(uid) {
  const sh = WP360_ensureUtilityTab(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'WEALTHPILOT_SAVE_META', ['CLIENT_ID','TOTAL_SAVES','LAST_SAVE']);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(uid).trim()) {
      return { totalSaves: Number(vals[i][1]||0), lastSave: vals[i][2], rowIndex: i+1 };
    }
  }
  return { totalSaves: 0, lastSave: '', rowIndex: -1 };
}

function WP360_updateClientSaveMeta(uid, ts) {
  const sh   = WP360_ensureUtilityTab(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'WEALTHPILOT_SAVE_META', ['CLIENT_ID','TOTAL_SAVES','LAST_SAVE']);
  const meta = WP360_getSaveMeta(uid);
  if (meta.rowIndex === -1) {
    sh.appendRow([uid, 1, ts]);
  } else {
    sh.getRange(meta.rowIndex,2).setValue(meta.totalSaves + 1);
    sh.getRange(meta.rowIndex,3).setValue(ts);
  }
  const cr = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', uid);
  if (cr) WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'LAST_UPDATED', ts);
}

// ══════════════════════════════════════════════════════════════════
//  SUBSCRIPTION UPDATE
// ══════════════════════════════════════════════════════════════════
function WP360_updateSubscription(uid, dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return 'parse_error'; }

  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return 'user_not_found';

  const ts       = new Date().toISOString();
  const planDays = WP360_CONFIG.PLAN_DAYS[d.plan] || 365;
  const expiry   = new Date(Date.now() + planDays*86400000);
  const oldPlan  = cm.PLAN;

  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'PLAN', d.plan);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'LAST_UPDATED', ts);

  const cr = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', uid);
  if (cr) {
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'PLAN_NAME', d.plan);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'EXPIRY_DATE', expiry);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'LAST_UPDATED', ts);
  }

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'SAAS_SUBSCRIPTION_MASTER', {
    SUBSCRIPTION_ID: 'SUB-'+uid+'-'+Date.now(), CLIENT_ID: uid, PLAN_NAME: d.plan, START_DATE: new Date(),
    END_DATE: expiry, AMOUNT: 0, PAYMENT_STATUS: 'ACTIVE', LICENSE_STATUS: 'ACTIVE',
    USER_LIMIT: 1, BRANCH_LIMIT: 1, STORAGE_LIMIT: '', STATUS: 'ACTIVE'
  });

  Logger.log('✅ Subscription changed for ' + uid + ': ' + oldPlan + ' → ' + d.plan + ' (' + (d.remark||'') + ')');
  return JSON.stringify({ plan: d.plan, planExpiry: WP360_dateStr(expiry) });
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
    const sheetRef = WP360_getClientSheetId(uid);
    if (!sheetRef) return JSON.stringify({ error: 'client_not_registered' });

    const parents      = DriveApp.getFileById(sheetRef.id).getParents();
    const clientFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    // v17: general document uploads go to Attachments/ (spec section 13).
    // Loan-specific uploads (sanction letters, repayment receipts) are
    // handled separately by WP360_uploadLoanDocument below.
    const docsFolder   = WP360_getOrCreateSubFolder(clientFolder, 'Attachments');
    const decoded       = Utilities.base64Decode(d.base64);
    const blob           = Utilities.newBlob(decoded, d.mimeType, d.fileName);

    const existing = docsFolder.getFilesByName(d.fileName);
    if (existing.hasNext()) { existing.next().setTrashed(true); }

    const file    = docsFolder.createFile(blob);
    const fileId  = file.getId();
    const fileUrl = file.getUrl();

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    WP360_logDocumentUpload(sheetRef.id, uid, d.docName || d.fileName, d.fileName, d.mimeType, fileUrl, fileId);

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

// ══════════════════════════════════════════════════════════════════
//  v17: LOAN DOCUMENT UPLOAD (Sanction Letter / Repayment Receipt only —
//  spec section 12). Goes into Loans/Sanction_Letters or
//  Loans/Repayment_Receipts, not the general Attachments folder.
// ══════════════════════════════════════════════════════════════════
function WP360_uploadLoanDocument(uid, dataJson) {
  if (!uid) return JSON.stringify({ error: 'no_uid' });
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ error: 'parse_error' }); }

  if (!d.base64 || !d.mimeType || !d.fileName) return JSON.stringify({ error: 'missing_fields' });
  const docType = d.docType === 'receipt' ? 'Repayment_Receipts' : 'Sanction_Letters';

  try {
    const sheetRef = WP360_getClientSheetId(uid);
    if (!sheetRef) return JSON.stringify({ error: 'client_not_registered' });

    const parents      = DriveApp.getFileById(sheetRef.id).getParents();
    const clientFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const loansFolder  = WP360_getOrCreateSubFolder(clientFolder, 'Loans');
    const targetFolder = WP360_getOrCreateSubFolder(loansFolder, docType);

    const decoded = Utilities.base64Decode(d.base64);
    const blob    = Utilities.newBlob(decoded, d.mimeType, d.fileName);

    const existing = targetFolder.getFilesByName(d.fileName);
    if (existing.hasNext()) { existing.next().setTrashed(true); }

    const file    = targetFolder.createFile(blob);
    const fileId  = file.getId();
    const fileUrl = file.getUrl();
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    Logger.log('✅ Loan document (' + docType + ') uploaded for ' + uid + ': ' + d.fileName);

    return JSON.stringify({
      status: 'uploaded', url: fileUrl, id: fileId, name: d.fileName,
      docType: docType, folderUrl: targetFolder.getUrl()
    });
  } catch(err) {
    WP360_logError('WP360_uploadLoanDocument', err.toString());
    return JSON.stringify({ error: err.toString() });
  }
}

// ══════════════════════════════════════════════════════════════════
//  v17: INSURANCE POLICY DOCUMENT UPLOAD — goes into Insurance/ folder
//  (spec section 13), parallel to the loan document upload above.
// ══════════════════════════════════════════════════════════════════
function WP360_uploadInsuranceDocument(uid, dataJson) {
  if (!uid) return JSON.stringify({ error: 'no_uid' });
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ error: 'parse_error' }); }

  if (!d.base64 || !d.mimeType || !d.fileName) return JSON.stringify({ error: 'missing_fields' });

  try {
    const sheetRef = WP360_getClientSheetId(uid);
    if (!sheetRef) return JSON.stringify({ error: 'client_not_registered' });

    const parents      = DriveApp.getFileById(sheetRef.id).getParents();
    const clientFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const targetFolder = WP360_getOrCreateSubFolder(clientFolder, 'Insurance');

    const decoded = Utilities.base64Decode(d.base64);
    const blob    = Utilities.newBlob(decoded, d.mimeType, d.fileName);

    const existing = targetFolder.getFilesByName(d.fileName);
    if (existing.hasNext()) { existing.next().setTrashed(true); }

    const file    = targetFolder.createFile(blob);
    const fileId  = file.getId();
    const fileUrl = file.getUrl();
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    Logger.log('✅ Insurance policy document uploaded for ' + uid + ': ' + d.fileName);

    return JSON.stringify({ status: 'uploaded', url: fileUrl, id: fileId, name: d.fileName, folderUrl: targetFolder.getUrl() });
  } catch(err) {
    WP360_logError('WP360_uploadInsuranceDocument', err.toString());
    return JSON.stringify({ error: err.toString() });
  }
}

function WP360_logDocumentUpload(clientSheetId, uid, docName, fileName, mimeType, driveUrl, driveId) {
  try {
    const ss = SpreadsheetApp.openById(clientSheetId);
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

    sh.appendRow([docName, typeLabel, fileName, ts, mimeType, driveUrl, uid, driveId]);
  } catch(e) {
    Logger.log('WP360_logDocumentUpload warning: ' + e);
  }
}

// ══════════════════════════════════════════════════════════════════
//  ERROR LOG
// ══════════════════════════════════════════════════════════════════
function WP360_logError(action, msg) {
  try {
    WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'ERROR_LOG', {
      TIMESTAMP: new Date().toISOString(),
      ERROR: '[WealthPilot360:' + action + '] ' + msg,
      STACK: ''
    });
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN HELPERS (run manually from the Apps Script editor)
// ══════════════════════════════════════════════════════════════════
function WP360_getClientSummary() {
  const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY)
    .map(c => ({ uid: c.CLIENT_ID, name: c.CONTACT_NAME, plan: c.PLAN, status: c.STATUS }));
  Logger.log('WealthPilot360 clients: ' + clients.length);
  Logger.log(JSON.stringify(clients, null, 2));
  return clients;
}

function WP360_findExistingDuplicates() {
  const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
  const byPhone = {};
  clients.forEach(c => {
    const p = String(c.PHONE || '').trim();
    if (!p) return;
    (byPhone[p] = byPhone[p] || []).push(c.CLIENT_ID + ' (' + (c.CONTACT_NAME||'') + ')');
  });
  const dups = {};
  Object.keys(byPhone).forEach(p => { if (byPhone[p].length > 1) dups[p] = byPhone[p]; });
  Logger.log('Duplicate mobile numbers found: ' + JSON.stringify(dups, null, 2));
  return dups;
}

function WP360_testLoadDB() {
  const testUid = 'radha123';
  const result  = WP360_loadClientSheet(testUid);
  if (result) {
    const db = JSON.parse(result);
    Logger.log('✅ LOAD_DB test passed for UID: ' + testUid);
    Logger.log('Accounting rows: ' + db.accounting.length);
    Logger.log('_savedAt: ' + new Date(db._savedAt));
  } else {
    Logger.log('❌ LOAD_DB test failed — null returned for UID: ' + testUid);
  }
}

// ══════════════════════════════════════════════════════════════════
//  v17 MIGRATION: adds the new column headers (Tenure, Manual Interest
//  Override, Sanction/Receipt URLs, Policy Document URL) to:
//    1. The TEM048 template itself (so every FUTURE client copy
//       already has them), and
//    2. Every ALREADY-CREATED WealthPilot360 client sheet (so
//       existing clients get the new columns too, without waiting
//       for a fresh registration).
//  Run this ONCE, manually, from the Apps Script editor (select this
//  function → Run). It only ADDS missing headers — never removes or
//  overwrites existing columns/data, so it's safe to run more than
//  once (re-running just finds nothing left to add).
// ══════════════════════════════════════════════════════════════════
function WP360_migrateAddNewColumns() {
  function ensureHeaders(sh, firstHeaderText, newHeaders) {
    const dataStartRow = WP360_findDataStartRow(sh, [firstHeaderText]);
    const headerRow = dataStartRow - 1;
    if (headerRow < 1) return { ok: false, reason: 'header row not found (tab may be empty/non-standard)' };
    const lastCol = sh.getLastColumn();
    const existingHeaders = sh.getRange(headerRow,1,1,lastCol).getValues()[0].map(h => String(h).trim());
    const added = [];
    newHeaders.forEach(h => {
      if (existingHeaders.indexOf(h) === -1) {
        const nextCol = sh.getLastColumn() + 1;
        sh.getRange(headerRow, nextCol).setValue(h).setFontWeight('bold');
        added.push(h);
      }
    });
    return { ok: true, added };
  }

  function migrateSheet(spreadsheetId, label) {
    try {
      const ss     = SpreadsheetApp.openById(spreadsheetId);
      const loanSh = ss.getSheetByName('🏦 Loans');
      const insSh  = ss.getSheetByName('🛡️ Insurance');
      const out = { label: label, spreadsheetId: spreadsheetId };
      if (loanSh) out.loans = ensureHeaders(loanSh, 'Loan Name',
        ['Tenure (Months)','Manual Interest Override','Sanction Letter URL','Repayment Receipt URL']);
      if (insSh) out.insurance = ensureHeaders(insSh, 'Policy Name', ['Policy Document URL']);
      return out;
    } catch(e) {
      return { label: label, spreadsheetId: spreadsheetId, error: e.toString() };
    }
  }

  const results = { template: null, clients: [] };

  // 1. Template first — every future registration already gets the
  //    new columns without needing this migration run again.
  const tmpl = WP360_getTemplateInfo();
  results.template = migrateSheet(tmpl.sheetId, 'TEMPLATE (TEM048)');

  // 2. Every already-created WealthPilot360 client sheet (filtered by
  //    DATABASE_TYPE so we never touch Business OS / ERP client sheets
  //    that happen to share the same MASTER_CONTROL registry).
  const wpClients = WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_REGISTRY', 'DATABASE_TYPE', 'WEALTHPILOT360_DB');
  wpClients.forEach(r => {
    if (!r.GOOGLE_SHEET_ID) return;
    results.clients.push(migrateSheet(String(r.GOOGLE_SHEET_ID), r.CLIENT_ID || r.CLIENT_NAME || ''));
  });

  Logger.log('✅ Migration complete. Template: ' + JSON.stringify(results.template));
  Logger.log('Clients migrated: ' + results.clients.length);
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

function WP360_runDiagNow() {
  Logger.log(JSON.stringify(WP360_diag(), null, 2));
}
