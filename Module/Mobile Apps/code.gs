// ════════════════════════════════════════════════════════════════
//  Balaji Wealth Pilot 360 – Google Apps Script Backend v24
//  FILE: WealthPilot360_GAS_Backend_v24_WipeGuard.gs
//  Powered by: Balaji NextGen Solutions
// ════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────
const WP360_CONFIG = {
  MASTER_CONTROL_SHEET_ID: '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I',
  USER_SECURITY_SHEET_ID:  '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg',

  TEMPLATE_ID:              'TEM048',
  TEMPLATE_SHEET_ID_FALLBACK: '1OpSQYEDBMw2Pawbwu80UcoIofj-yqJzNGhxx-9XeWwk',

  CLIENTS_ROOT_FOLDER_ID:   '1lY4wLnjtA0wkoKhYb6Q-JTSeyo0haRJm',
  CLIENT_DB_SUBFOLDER_NAME: 'CLIENT_DATABASES',
  DOC_SUBFOLDER_NAME:       'Documents',

  INDUSTRY:  'WEALTH360',
  PLAN_DAYS: { trial: 90, starter: 365, professional: 365, enterprise: 3650 }
};

// ── TEMPLATE TAB NAMES ───────────────────────────────────────────
const WP360_TABS = [
  '📊 Dashboard', '👤 Users', '🏦 Loans', '📋 Bills',
  '🛡️ Insurance', '📈 Investments', '💰 Assets', '💳 Credit Cards',
  '🔄 Subscriptions', '💵 Transactions', '🎯 Goals', '📁 Documents',
  '👨‍👩‍👧‍👦 Family', '📊 Budget', 'Accounting'
];

const WP360_APP_META_TAB   = 'App_Meta';
const WP360_APP_META_KEYS  = ['bankAccounts', 'cashSettings', 'customAcctHeads'];

const WP360_ClientDataCache = {
  CACHE_TTL_MS: 10 * 60 * 1000,

  _getCacheKey: function(uid) {
    return 'WP360_SNAPSHOT_' + uid;
  },

  get: function(uid) {
    try {
      const props = PropertiesService.getScriptProperties();
      const cached = props.getProperty(this._getCacheKey(uid));
      if (!cached) return null;
      const obj = JSON.parse(cached);
      if (Date.now() - obj.timestamp > this.CACHE_TTL_MS) {
        this._clear(uid); return null;
      }
      return obj.data;
    } catch(e) { return null; }
  },

  set: function(uid, data) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty(this._getCacheKey(uid), JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch(e) { Logger.log('Cache set warning: ' + e); }
  },

  _clear: function(uid) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(this._getCacheKey(uid));
    } catch(e) {}
  }
};

function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch(err) { return WP360_resp(false, 'Invalid JSON: ' + err); }

  const { action, uid, data } = payload;
  const lock = (action === 'REGISTER_CLIENT') ? LockService.getScriptLock() : null;

  try {
    if (lock) lock.waitLock(30000);
    switch (action) {
      case 'SAVE_USERS':           return WP360_resp(true, WP360_saveUsers(data));
      case 'LOAD_USERS':           return WP360_resp(true, WP360_loadUsers());
      case 'SAVE_DB':              return WP360_resp(true, WP360_saveClientSheet(uid, data));
      case 'LOAD_DB':              return WP360_resp(true, WP360_loadClientSheet(uid, payload.lastSyncTime || 0));
      case 'DELETE_DB':            return WP360_resp(true, WP360_clearClientSheet(uid));
      case 'REGISTER_CLIENT':      return WP360_resp(true, WP360_registerClient(data));
      case 'LOGIN_CLIENT':         return WP360_resp(true, WP360_loginClient(data));
      case 'CHECK_CONTACT':        return WP360_resp(true, WP360_checkContact(data));
      case 'SUPER_ADMIN_LOGIN':    return WP360_resp(true, WP360_superAdminLogin(data));
      case 'GET_CLIENT':           return WP360_resp(true, WP360_getClientInfo(uid));
      case 'GET_CLIENT_SHEET_URL': return WP360_resp(true, WP360_getClientSheetUrl(uid));
      case 'UPDATE_SUBSCRIPTION':  return WP360_resp(true, WP360_updateSubscription(uid, data));
      case 'UPDATE_PROFILE':       return WP360_resp(true, WP360_updateProfile(uid, data));
      case 'UPLOAD_DOCUMENT':      return WP360_resp(true, WP360_uploadDocument(uid, data));
      case 'LOAN_UPLOAD_DOCUMENT': return WP360_resp(true, WP360_uploadLoanDocument(uid, data));
      case 'INSURANCE_UPLOAD_DOCUMENT': return WP360_resp(true, WP360_uploadInsuranceDocument(uid, data));
      case 'ADMIN_LIST_CLIENTS':   return WP360_resp(true, WP360_adminListClients());
      case 'ADMIN_RESET_PASSWORD':  return WP360_resp(true, WP360_adminResetPassword(uid, data));
      case 'DIAG':                 return WP360_resp(true, WP360_diag());
      case 'DEBUG_CLIENT':         return WP360_resp(true, WP360_debugClientData(uid));
      case 'LIST_BACKUPS':         return WP360_resp(true, WP360_listClientBackups(uid));
      case 'BACKUP_CLIENT_NOW':    return WP360_resp(true, WP360_backupClientByUid(uid));
      case 'RESTORE_CLIENT_BACKUP': return WP360_resp(true, WP360_restoreClientFromBackup(uid, (typeof data === 'string' ? JSON.parse(data) : data).backupFileId));
      case 'REPAIR_HEADERS':       return WP360_resp(true, uid ? WP360_repairClientHeaders(uid) : WP360_repairAllClientHeaders());
      case 'PING':                 return WP360_resp(true, 'pong');
      default:                     return WP360_resp(false, 'Unknown action: ' + action);
    }
  } catch(err) {
    WP360_logError(action, err.toString() + ' | stack: ' + (err.stack || 'n/a'));
    return WP360_resp(false, (action||'?') + ' failed: ' + err.toString());
  } finally {
    if (lock) { try { lock.releaseLock(); } catch(e) {} }
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return WP360_resp(true, 'pong');
  if (action === 'diag') return WP360_resp(true, WP360_diag());
  if (action === 'debug_client') return WP360_resp(true, WP360_debugClientData(e.parameter.uid));
  if (action === 'list_backups') return WP360_resp(true, WP360_listClientBackups(e.parameter.uid));
  return ContentService
    .createTextOutput(JSON.stringify({
      status:    'Balaji WealthPilot360 GAS v25 OK',
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
  step('open BALAJI_ERP_MASTER_CONTROL_SYSTEM', () => {
    const ss = SpreadsheetApp.openById(WP360_CONFIG.MASTER_CONTROL_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('daily backup trigger status', () => {
    const installed = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'WP360_runDailyBackupAllClients');
    return installed
      ? 'Installed — runs daily, ' + WP360_BACKUP_RETENTION_DAYS + '-day retention'
      : 'NOT installed — run WP360_installDailyBackupTrigger() once from the Apps Script editor';
  });
  step('SAVE_DB wipe guard', () => {
    return 'Active';
  });
  return out;
}

function WP360_debugClientData(uid) {
  if (!uid) return { error: 'no_uid' };
  const out = { uid: uid };

  out.masterControlRegistry = WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', uid)
    .map(r => ({ rowIndex: r._rowIndex, MASTER_DB_ID: r.MASTER_DB_ID, MASTER_DB_URL: r.MASTER_DB_URL, COMPANY_NAME: r.COMPANY_NAME }));
  out.deploymentRegistry = WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', 'CLIENT_ID', uid)
    .map(r => ({ rowIndex: r._rowIndex, MASTER_DB_ID: r.MASTER_DB_ID, CLIENT_NAME: r.CLIENT_NAME }));
  out.clientMasterRows = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid)
    .map(r => ({ rowIndex: r._rowIndex, CONTACT_NAME: r.CONTACT_NAME, ADMIN_USERNAME: r.ADMIN_USERNAME, PHONE: r.PHONE, PLAN: r.PLAN }));

  const sheetRef = WP360_getClientSheetId(uid);
  out.resolvedSheet = sheetRef ? { id: sheetRef.id, url: sheetRef.url } : null;

  try {
    const props = PropertiesService.getScriptProperties();
    const cachedRaw = props.getProperty('WP360_SNAPSHOT_' + uid);
    if (cachedRaw) {
      const obj = JSON.parse(cachedRaw);
      out.cache = {
        present: true,
        cachedAtISO: new Date(obj.timestamp).toISOString(),
        ageSeconds: Math.round((Date.now() - obj.timestamp) / 1000)
      };
    } else {
      out.cache = { present: false };
    }
  } catch(e) { out.cache = { error: e.toString() }; }

  if (!sheetRef) { out.error = 'no_sheet_resolved_for_uid'; return out; }

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    out.sheetName = ss.getName();
    try { out.sheetLastModified = DriveApp.getFileById(sheetRef.id).getLastUpdated().toISOString(); } catch(e) {}

    const tabChecks = [
      { tab: '🏦 Loans', uidCol: 8 }, { tab: '📋 Bills', uidCol: 6 },
      { tab: '🛡️ Insurance', uidCol: 7 }, { tab: '📈 Investments', uidCol: 6 },
      { tab: '💰 Assets', uidCol: 4 }, { tab: '💳 Credit Cards', uidCol: 7 },
      { tab: '🔄 Subscriptions', uidCol: 6 }, { tab: '💵 Transactions', uidCol: 6 },
      { tab: '🎯 Goals', uidCol: 8 }, { tab: '📁 Documents', uidCol: 6 },
      { tab: '👨‍👩‍👧‍👦 Family', uidCol: 6 }, { tab: '📊 Budget', uidCol: 6 },
      { tab: 'Accounting', uidCol: 8 }
    ];

    out.tabs = tabChecks.map(({ tab, uidCol }) => {
      const sh = ss.getSheetByName(tab);
      if (!sh) return { tab, error: 'tab_not_found' };
      const lastRow = sh.getLastRow();
      if (lastRow < 2) return { tab, totalDataRows: 0, matchingUidRows: 0, distinctUidsSeen: [] };

      const vals = sh.getDataRange().getValues();
      let totalDataRows = 0, matchingUidRows = 0;
      const uidsSeen = {};
      for (let i = 1; i < vals.length; i++) {
        const r = vals[i];
        if (!r[0] || String(r[0]).trim() === '') continue;
        const firstCell = String(r[0]).toUpperCase();
        if (firstCell === 'TOTAL' || firstCell.startsWith('NET')) continue;
        totalDataRows++;
        const rowUid = String(r[uidCol] || '').trim();
        if (rowUid) uidsSeen[rowUid] = (uidsSeen[rowUid] || 0) + 1;
        if (rowUid === String(uid).trim()) matchingUidRows++;
      }
      return { tab, totalDataRows, matchingUidRows, distinctUidsSeen: uidsSeen };
    });
  } catch(e) {
    out.sheetReadError = e.toString();
  }

  return out;
}

const WP360_BACKUP_RETENTION_DAYS = 15;
const WP360_BACKUP_MARKER = '_BACKUP_';

function WP360_installDailyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'WP360_runDailyBackupAllClients') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('WP360_runDailyBackupAllClients')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log('Daily backup trigger installed');
}

function WP360_runDailyBackupAllClients() {
  const rows = WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', null, null);
  const results = [];
  rows.forEach(r => {
    const uid = r.CLIENT_ID;
    const dbId = r.MASTER_DB_ID;
    if (!uid || !dbId) return;
    try {
      const res = WP360_backupClientSheet(uid, String(dbId));
      results.push({ uid: uid, status: res.skipped ? 'already_backed_up_today' : 'backed_up', backupId: res.id });
    } catch(e) {
      results.push({ uid: uid, status: 'error', error: e.toString() });
      WP360_logError('WP360_runDailyBackupAllClients', 'uid=' + uid + ': ' + e.toString());
    }
  });
  Logger.log('Daily backup run complete: ' + JSON.stringify(results));
  return results;
}

function WP360_backupClientByUid(uid) {
  if (!uid) return { error: 'no_uid' };
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return { error: 'no_sheet_resolved_for_uid' };
  return WP360_backupClientSheet(uid, sheetRef.id);
}

function WP360_backupClientSheet(uid, sheetId) {
  const file = DriveApp.getFileById(sheetId);
  const parents = file.getParents();
  const clientFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const backupFolder = WP360_getOrCreateSubFolder(clientFolder, 'Backup');

  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const backupName = file.getName() + WP360_BACKUP_MARKER + dateStr;

  const existing = backupFolder.getFilesByName(backupName);
  if (existing.hasNext()) {
    WP360_pruneOldBackups(backupFolder);
    return { id: existing.next().getId(), skipped: true };
  }

  const copy = file.makeCopy(backupName, backupFolder);
  WP360_pruneOldBackups(backupFolder);
  return { id: copy.getId(), skipped: false };
}

function WP360_pruneOldBackups(backupFolder) {
  const cutoff = new Date(Date.now() - WP360_BACKUP_RETENTION_DAYS * 86400000);
  const files = backupFolder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getName().indexOf(WP360_BACKUP_MARKER) === -1) continue;
    if (f.isTrashed()) continue;
    if (f.getDateCreated() < cutoff) {
      try { f.setTrashed(true); } catch(e) { Logger.log('WP360_pruneOldBackups: could not trash ' + f.getName() + ': ' + e); }
    }
  }
}

function WP360_listClientBackups(uid) {
  if (!uid) return { error: 'no_uid' };
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return { error: 'no_sheet_resolved_for_uid' };

  const file = DriveApp.getFileById(sheetRef.id);
  const parents = file.getParents();
  const clientFolder = parents.hasNext() ? parents.next() : null;
  if (!clientFolder) return { error: 'no_parent_folder' };

  const backupFolder = WP360_getOrCreateSubFolder(clientFolder, 'Backup');
  const files = backupFolder.getFiles();
  const list = [];
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed() || f.getName().indexOf(WP360_BACKUP_MARKER) === -1) continue;
    list.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), created: f.getDateCreated().toISOString() });
  }
  list.sort((a, b) => b.created.localeCompare(a.created));
  return list;
}

function WP360_restoreClientFromBackup(uid, backupFileId) {
  if (!uid || !backupFileId) return { error: 'missing_params' };
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return { error: 'no_sheet_resolved_for_uid' };

  const liveFile = DriveApp.getFileById(sheetRef.id);
  const parents = liveFile.getParents();
  const clientFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const backupFolder = WP360_getOrCreateSubFolder(clientFolder, 'Backup');

  const tz = Session.getScriptTimeZone() || 'Asia/Kolkata';
  const ts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmmss');

  const preRestoreCopy = liveFile.makeCopy(liveFile.getName() + '_PRE_RESTORE_' + ts, backupFolder);

  const backupFile = DriveApp.getFileById(backupFileId);
  const restored = backupFile.makeCopy(liveFile.getName(), clientFolder);

  WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', uid).forEach(r => {
    WP360_updateCell(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', r._rowIndex, 'MASTER_DB_ID', restored.getId());
    WP360_updateCell(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', r._rowIndex, 'MASTER_DB_URL', restored.getUrl());
  });
  WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', 'CLIENT_ID', uid).forEach(r => {
    WP360_updateCell(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DEPLOYMENT_REGISTRY', r._rowIndex, 'MASTER_DB_ID', restored.getId());
  });

  WP360_ClientDataCache._clear(uid);
  Logger.log('Restored ' + uid + ' from backup ' + backupFileId);

  return {
    status: 'restored',
    newSheetId: restored.getId(),
    newSheetUrl: restored.getUrl(),
    oldSheetId: sheetRef.id,
    preRestoreSafetyCopyId: preRestoreCopy.getId()
  };
}

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

function WP360_getClientDbFolder() {
  const rootFolder = DriveApp.getFolderById(WP360_CONFIG.CLIENTS_ROOT_FOLDER_ID);
  if (!WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME) return rootFolder;
  const subs = rootFolder.getFoldersByName(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
  if (subs.hasNext()) return subs.next();
  return rootFolder.createFolder(WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
}

function WP360_getOrCreateSubFolder(parentFolder, subName) {
  const existing = parentFolder.getFoldersByName(subName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(subName);
}

function WP360_ensureClientFolderStructure(clientFolder) {
  const topLevel = [
    'Database', 'Profile', 'Attachments', 'Assets', 'Loans',
    'Investments', 'Insurance', 'Credit_Cards', 'Income', 'Expenses',
    'Budget', 'Goals', 'Reports', 'QR_Codes', 'Backup', 'Settings', 'Logs'
  ];
  const subs = {};
  topLevel.forEach(name => { subs[name] = WP360_getOrCreateSubFolder(clientFolder, name); });
  WP360_getOrCreateSubFolder(subs['Loans'], 'Sanction_Letters');
  WP360_getOrCreateSubFolder(subs['Loans'], 'Repayment_Receipts');
  return subs;
}

function WP360_getOrCreateClientFolder(uid, name) {
  const parentFolder = WP360_getClientDbFolder();
  const safeName      = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').trim();
  const folderName    = uid + '_' + safeName;
  const existing       = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();

  const legacyName = 'WP360_' + uid + '_' + safeName;
  const legacy = parentFolder.getFoldersByName(legacyName);
  if (legacy.hasNext()) return legacy.next();

  return parentFolder.createFolder(folderName);
}

function WP360_createClientSheet(uid, name, mobile, email, passwordHash, plan) {
  try {
    const folder    = WP360_getOrCreateClientFolder(uid, name);
    const safeName   = (name || uid).replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_').trim();
    const sheetName  = 'DB_' + uid + '_' + safeName;

    let existing = folder.getFilesByName(sheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      WP360_ensureClientFolderStructure(folder);
      WP360_ensureClientSheetMigrated(f.getId());
      return { id: f.getId(), url: f.getUrl(), name: sheetName, folderId: folder.getId() };
    }

    const legacySheetName = 'WealthPilot360_' + uid;
    existing = folder.getFilesByName(legacySheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      WP360_ensureClientFolderStructure(folder);
      WP360_ensureClientSheetMigrated(f.getId());
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
        for (let i = dataStart - 1; i < vals.length; i++) {
          if (String(vals[i][0]).trim() === String(uid).trim()) { userRow = i + 1; break; }
        }
        if (userRow === -1) {
          const lastRow = usersSh.getLastRow();
          const nextRow = Math.max(dataStart, lastRow + 1);
          usersSh.getRange(nextRow,1,1,8).setValues([[
            uid, name || '', mobile || '', email || '',
            passwordHash || '', now, '', plan || 'trial'
          ]]);
        }
      }
    } catch(e) { Logger.log('Users tab seed failed: ' + e); }

    try {
      WP360_ensureClientFolderStructure(folder);
    } catch(e) { Logger.log('Client folder structure creation warning: ' + e); }

    Logger.log('Client sheet created: ' + sheetName + ' -> ' + copyUrl);
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

const WP360_TAB_HEADER_SPEC = {
  '🏦 Loans': { first: 'Loan Name', all: ['Loan Name','Bank / Lender','Loan Type','Original Amount (₹)','Outstanding (₹)','Monthly EMI (₹)','Interest Rate (%)','EMI Due Date','User ID','Notes','Tenure (Months)','Manual Interest Override','Sanction Letter URL','Repayment Receipt URL'] },
  '📋 Bills': { first: 'Bill Name', all: ['Bill Name','Provider','Category','Amount (₹)','Due Date','Status','User ID','Notes'] },
  '🛡️ Insurance': { first: 'Policy Name', all: ['Policy Name','Type','Policy Number','Annual Premium (₹)','Renewal Date','Coverage (₹)','Nominee','User ID','Notes','Policy Document URL'] },
  '📈 Investments': { first: 'Investment Name', all: ['Investment Name','Type','Invested Amount (₹)','Current Value (₹)','Gain/Loss (₹)','Return (%)','User ID','Notes'] },
  '💰 Assets': { first: 'Name', all: ['Name','Type (Asset/Liability)','Asset Value (₹)','Liability Value (₹)','User ID','Notes'] },
  '💳 Credit Cards': { first: 'Card Name', all: ['Card Name','Bank','Credit Limit (₹)','Outstanding (₹)','Min Due (₹)','Payment Due Date','Utilization (%)','User ID'] },
  '🔄 Subscriptions': { first: 'Service Name', all: ['Service Name','Category','Amount (₹)','Cycle','Renewal Date','Monthly Cost (₹)','User ID','Notes'] },
  '💵 Transactions': { first: 'Date', all: ['Date','Description','Category','Type','Amount (₹)','Month','User ID','Notes'] },
  '🎯 Goals': { first: 'Goal Name', all: ['Goal Name','Category','Target Amount (₹)','Saved So Far (₹)','Remaining (₹)','Progress (%)','Target Date','Days Left','User ID'] },
  '📁 Documents': { first: 'Document Name', all: ['Document Name','Type','Number / ID','Expiry Date','Days to Expiry','Drive URL','User ID','Drive File ID'] },
  '👨‍👩‍👧‍👦 Family': { first: 'Member Name', all: ['Member Name','Relation','Date of Birth','Age','PAN','Aadhaar (last 4)','Primary User ID','Notes'] },
  '📊 Budget': { first: 'Category', all: ['Category','Budget Amount (₹)','Actual Spent (₹)','Remaining (₹)','Used (%)','Status','User ID'] },
  'Accounting': { first: 'Date', all: ['Date','Name','Type','Head','Amount','DueDate','Status','Notes','UserID','CreatedAt','PaidAmt','PaidMode','BankAccountId','LinkedTxId'] }
};

function WP360_ensureAppMetaTab(ss) {
  let sh = ss.getSheetByName(WP360_APP_META_TAB);
  if (!sh) {
    sh = ss.insertSheet(WP360_APP_META_TAB);
    sh.appendRow(['KEY', 'VALUE_JSON', 'UPDATED_AT']);
    sh.getRange(1,1,1,3).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function WP360_ensureClientSheetMigrated(sheetId) {
  if (!sheetId) return;
  try {
    const ss = SpreadsheetApp.openById(sheetId);

    let tmplSs = null;
    WP360_TABS.forEach(tabName => {
      if (ss.getSheetByName(tabName)) return;
      try {
        if (!tmplSs) tmplSs = SpreadsheetApp.openById(WP360_getTemplateInfo().sheetId);
        const tmplSh = tmplSs.getSheetByName(tabName);
        if (tmplSh) {
          const copied = tmplSh.copyTo(ss);
          copied.setName(tabName);
        }
      } catch(e) { Logger.log('tab clone failed for ' + tabName + ': ' + e); }
    });

    Object.keys(WP360_TAB_HEADER_SPEC).forEach(tabName => {
      try {
        const sh = ss.getSheetByName(tabName);
        if (!sh) return;
        const spec = WP360_TAB_HEADER_SPEC[tabName];
        const dataStartRow = WP360_findDataStartRow(sh, [spec.first]);
        const headerRow = dataStartRow - 1;
        if (headerRow < 1) return;
        // v26 FIX ("blank green header band, e.g. DB_CL00030_demo →
        // Transactions row 4"): this used to only APPEND headers that
        // were "missing" compared to whatever was already sitting in the
        // row, appending each one at sh.getLastColumn()+1. On a sheet
        // whose header row has NO text at all (just the colored band —
        // template row 4 was styled but never actually seeded with
        // labels), `existing` came back all-blank and getLastColumn()
        // could be 1, so headers landed one at a time starting at column
        // B instead of filling A onward — or, worse, WP360_findDataStartRow
        // (see below) sometimes pointed headerRow at row 1 or row 2 (the
        // title/date rows) instead of row 4, so headers never appeared
        // where the user could see them at all. Now: always (re)write
        // the FULL header row in one shot, at the correct positions, on
        // every migration pass. Idempotent and safe — this only touches
        // the single header row, never the data rows below it.
        sh.getRange(headerRow, 1, 1, spec.all.length).setValues([spec.all]);
        sh.getRange(headerRow, 1, 1, spec.all.length).setFontWeight('bold');
      } catch(e) { Logger.log('header check failed for ' + tabName + ': ' + e); }
    });

    try { WP360_ensureAppMetaTab(ss); }
    catch(e) { Logger.log('App_Meta tab creation failed: ' + e); }

  } catch(e) {
    Logger.log('WP360_ensureClientSheetMigrated failed for sheetId=' + sheetId + ': ' + e);
  }
}

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

function WP360_findDuplicateContact(mobile, email, excludeClientId) {
  try {
    const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
    const m = mobile ? String(mobile).trim() : '';
    const e = email ? String(email).trim().toLowerCase() : '';
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (excludeClientId && String(c.CLIENT_ID).trim() === String(excludeClientId).trim()) continue;
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

function WP360_registerClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return 'parse_error'; }

  const loginId = d.uid || d.userid;
  if (!loginId) return 'no_uid';

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

  const dup = WP360_findDuplicateContact(d.mobile, d.email);
  if (dup) {
    const ex = WP360_getClientSheetId(dup.clientId);
    return JSON.stringify({
      status:          dup.field === 'mobile' ? 'duplicate_mobile' : 'duplicate_email',
      existingClientId: dup.clientId,
      existingName:     dup.name,
      clientSheetId:   ex ? ex.id  : '',
      clientSheetUrl:  ex ? ex.url : ''
    });
  }

  const uid = WP360_nextClientId();

  const sheetInfo = WP360_createClientSheet(uid, d.name, d.mobile, d.email, WP360_hashPass(d.password||''), d.plan || 'trial');
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

  WP360_ClientDataCache._clear(uid);

  Logger.log('Registered WealthPilot360 client: ' + uid + ' (login: ' + loginId + ') -> ' + sheetInfo.url);

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

function WP360_setSuperAdminCredentials() {
  const ADMIN_ID       = 'sumandebnath12';
  const ADMIN_PASSWORD = 'Radha@325';

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SUPER_ADMIN_ID', ADMIN_ID);
  props.setProperty('SUPER_ADMIN_PASS_HASH', WP360_hashPass(ADMIN_PASSWORD));
  Logger.log('Super Admin credentials saved for ID: ' + ADMIN_ID);
}

function WP360_adminResetPassword(uid, dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }
  if (!uid) return JSON.stringify({ status: 'no_uid' });

  const newPass = String(d.newPassword || '');
  if (newPass.length < 6) return JSON.stringify({ status: 'too_short' });

  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return JSON.stringify({ status: 'not_found' });
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'ADMIN_PASSWORD', newPass);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'LAST_UPDATED', new Date());

  const um = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', 'CLIENT_ID', uid);
  if (um) WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'PASSWORD', WP360_hashPass(newPass));

  WP360_ClientDataCache._clear(uid);

  Logger.log('Super Admin reset password for CLIENT_ID ' + uid);
  return JSON.stringify({ status: 'ok' });
}

function WP360_updateProfile(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return JSON.stringify({ status: 'not_found' });

  const name   = (d.name   !== undefined) ? String(d.name).trim()   : cm.CONTACT_NAME;
  const mobile = (d.mobile !== undefined) ? String(d.mobile).trim() : cm.PHONE;
  const email  = (d.email  !== undefined) ? String(d.email).trim()  : cm.EMAIL;

  const mobileChanged = String(mobile) !== String(cm.PHONE || '');
  const emailChanged   = String(email).toLowerCase() !== String(cm.EMAIL || '').toLowerCase();
  if (mobileChanged || emailChanged) {
    const dup = WP360_findDuplicateContact(mobileChanged ? mobile : '', emailChanged ? email : '', uid);
    if (dup) {
      return JSON.stringify({
        status: dup.field === 'mobile' ? 'duplicate_mobile' : 'duplicate_email',
        existingClientId: dup.clientId,
        existingName: dup.name
      });
    }
  }

  const ts = new Date();

  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'CONTACT_NAME', name);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'PHONE', mobile);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'EMAIL', email);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'COMPANY_NAME', name);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'ADMIN_NAME', name);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'ADMIN_EMAIL', email);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'ADMIN_MOBILE', mobile);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'LAST_UPDATED', ts);
  if (d.newPassword) {
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'ADMIN_PASSWORD', d.newPassword);
  }

  const um = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', 'CLIENT_ID', uid);
  if (um) {
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'FULL_NAME', name);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'EMAIL', email);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'MOBILE_NO', mobile);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'COMPANY_NAME', name);
    if (d.newPassword) {
      WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'USER_MASTER', um._rowIndex, 'PASSWORD', WP360_hashPass(d.newPassword));
    }
  }

  const cr = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', 'CLIENT_ID', uid);
  if (cr) {
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'OWNER_NAME', name);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'EMAIL', email);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'MOBILE_NO', mobile);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'COMPANY_NAME', name);
    WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_REGISTRY', cr._rowIndex, 'LAST_UPDATED', ts);
  }

  try {
    const sheetRef = WP360_getClientSheetId(uid);
    if (sheetRef) {
      const ss = SpreadsheetApp.openById(sheetRef.id);
      const usersSh = ss.getSheetByName('👤 Users');
      if (usersSh) {
        const vals = usersSh.getDataRange().getValues();
        for (let i = 1; i < vals.length; i++) {
          if (String(vals[i][0]).trim() === String(uid).trim()) {
            usersSh.getRange(i+1,2).setValue(name);
            usersSh.getRange(i+1,3).setValue(mobile);
            usersSh.getRange(i+1,4).setValue(email);
            if (d.newPassword) usersSh.getRange(i+1,5).setValue(WP360_hashPass(d.newPassword));
            break;
          }
        }
      }
    }
  } catch(e) { Logger.log('WP360_updateProfile: Users tab refresh warning: ' + e); }

  WP360_ClientDataCache._clear(uid);

  Logger.log('Profile updated for ' + uid);
  return JSON.stringify({ status: 'ok', name, mobile, email });
}

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

const WP360_WIPE_GUARD_TAB_MAP = {
  loans: '🏦 Loans', bills: '📋 Bills', insurance: '🛡️ Insurance',
  investments: '📈 Investments', assets: '💰 Assets', creditCards: '💳 Credit Cards',
  subscriptions: '🔄 Subscriptions', transactions: '💵 Transactions', goals: '🎯 Goals',
  documents: '📁 Documents', family: '👨‍👩‍👧‍👦 Family', budgets: '📊 Budget',
  accounting: 'Accounting'
};

function WP360_checkForSuspiciousWipe(sheetId, incomingDb) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    let currentTotal = 0, incomingTotal = 0;
    const currentCounts = {}, incomingCounts = {};

    Object.keys(WP360_WIPE_GUARD_TAB_MAP).forEach(key => {
      const sh = ss.getSheetByName(WP360_WIPE_GUARD_TAB_MAP[key]);
      let cCount = 0;
      if (sh) {
        const lastRow = sh.getLastRow();
        if (lastRow >= 2) {
          const firstCol = sh.getRange(1, 1, lastRow, 1).getValues();
          for (let i = 1; i < firstCol.length; i++) {
            const v = String(firstCol[i][0] || '').trim();
            if (v && v.toUpperCase() !== 'TOTAL' && !v.toUpperCase().startsWith('NET')) cCount++;
          }
        }
      }
      const iCount = Array.isArray(incomingDb[key]) ? incomingDb[key].length : 0;
      currentCounts[key] = cCount;
      incomingCounts[key] = iCount;
      currentTotal += cCount;
      incomingTotal += iCount;
    });

    if (currentTotal >= 1 && incomingTotal === 0) {
      return {
        blocked: true,
        reason: 'Incoming save has ZERO records across every tracked tab, but the Sheet currently has ' + currentTotal + ' total. Refusing to overwrite.',
        currentCounts: currentCounts,
        incomingCounts: incomingCounts
      };
    }
    return { blocked: false, currentCounts: currentCounts, incomingCounts: incomingCounts };
  } catch(e) {
    Logger.log('WP360_checkForSuspiciousWipe warning (failing open): ' + e);
    return { blocked: false };
  }
}

function WP360_saveClientSheet(uid, dbJson) {
  if (!uid) return 'no_uid';
  let db;
  try { db = typeof dbJson === 'string' ? JSON.parse(dbJson) : dbJson; }
  catch(e) { return 'parse_error'; }

  let sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) {
    const recoveryLock = LockService.getScriptLock();
    try {
      recoveryLock.waitLock(30000);
      sheetRef = WP360_getClientSheetId(uid);
      if (!sheetRef) {
        const usersBlob = WP360_loadUsers();
        let userName = uid;
        try { const u = JSON.parse(usersBlob); if (u[uid]) userName = u[uid].name || uid; } catch(e) {}
        WP360_logError('WP360_saveClientSheet:orphanRecovery', 'No registered sheet for uid=' + uid + ' — auto-registering with name="' + userName + '"');
        WP360_registerClient(JSON.stringify({ uid, name: userName }));
        sheetRef = WP360_getClientSheetId(uid);
      }
    } finally {
      try { recoveryLock.releaseLock(); } catch(e) {}
    }
    if (!sheetRef) return 'client_not_registered';
  }

  const guard = WP360_checkForSuspiciousWipe(sheetRef.id, db);
  if (guard.blocked) {
    WP360_logError('WP360_saveClientSheet:BLOCKED_SUSPICIOUS_WIPE', 'uid=' + uid + ': ' + guard.reason);
    return JSON.stringify({
      status: 'blocked_suspicious_wipe',
      reason: guard.reason,
      currentCounts: guard.currentCounts,
      incomingCounts: guard.incomingCounts
    });
  }

  const result = WP360_writeToClientSheet(sheetRef.id, uid, db);
  WP360_ClientDataCache._clear(uid);
  return result;
}

function WP360_writeAppMetaKey(ss, key, value, ts) {
  try {
    const sh = WP360_ensureAppMetaTab(ss);
    const vals = sh.getDataRange().getValues();
    const json = JSON.stringify(value !== undefined ? value : null);
    let rowIdx = -1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === key) { rowIdx = i + 1; break; }
    }
    if (rowIdx === -1) sh.appendRow([key, json, ts]);
    else { sh.getRange(rowIdx,2).setValue(json); sh.getRange(rowIdx,3).setValue(ts); }
  } catch(e) { Logger.log('WP360_writeAppMetaKey failed for key=' + key + ': ' + e); }
}

function WP360_readAppMetaKey(ss, key) {
  try {
    const sh = WP360_ensureAppMetaTab(ss);
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === key) {
        try { return JSON.parse(vals[i][1] || 'null'); }
        catch(e) { return null; }
      }
    }
    return null;
  } catch(e) {
    Logger.log('WP360_readAppMetaKey failed for key=' + key + ': ' + e);
    return null;
  }
}

function WP360_writeToClientSheet(sheetId, uid, db) {
  try {
    WP360_ensureClientSheetMigrated(sheetId);

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
      ['Date','Name','Type','Head','Amount','DueDate','Status','Notes','UserID','CreatedAt','PaidAmt','PaidMode','BankAccountId','LinkedTxId'],
      (db.accounting||[]).map(a => [
        a.date||'', a.name||'',
        a.type === 'creditor' ? 'Creditor' : 'Debtor',
        a.head || (a.type === 'creditor' ? 'Vendor Payment' : 'Customer Payment'),
        a.amount||0, a.due||'', a.status||'outstanding', a.notes||'',
        uid, ts,
        a.paidAmt||0, a.paidMode||'Cash', a.bankAccountId||'', a.linkedTxId||''
      ])
    );

    if (db.bankAccounts !== undefined)    WP360_writeAppMetaKey(ss, 'bankAccounts', db.bankAccounts, ts);
    if (db.cashSettings !== undefined)    WP360_writeAppMetaKey(ss, 'cashSettings', db.cashSettings, ts);
    if (db.customAcctHeads !== undefined) WP360_writeAppMetaKey(ss, 'customAcctHeads', db.customAcctHeads, ts);

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

function WP360_findDataStartRow(sh, headers) {
  const scanRows = Math.min(sh.getLastRow() || 1, 12);
  const target = String(headers[0]).trim().toLowerCase();
  if (scanRows >= 1) {
    const firstCol = sh.getRange(1,1,scanRows,1).getValues();
    for (let i = 0; i < firstCol.length; i++) {
      const cell = String(firstCol[i][0] || '').trim().toLowerCase();
      if (cell === target) return i + 2;
    }
  }
  // v26 FIX: the actual header text wasn't found anywhere in the scan
  // above — either it's genuinely missing (the blank-green-band bug) or
  // this is a brand-new sheet. The WealthPilot360 template's known,
  // consistent layout is: row1 = title, row2 = subtitle/date, row3 =
  // blank spacer, row4 = header band, row5+ = data. Check row 4 for ANY
  // content across its columns (label text OR the colored-band
  // formatting reaching across it); if it looks like the header band
  // exists but is just unlabeled, trust that structure over the old
  // row2/row3 guess below, which previously pointed headers at the
  // title/date rows instead.
  try {
    const maxRows = sh.getMaxRows();
    if (maxRows >= 4) {
      const row4Range = sh.getRange(4, 1, 1, Math.max(sh.getLastColumn(), 1));
      const row4HasText = row4Range.getValues()[0].some(v => String(v || '').trim() !== '');
      const row4HasBandColor = row4Range.getBackgrounds()[0].some(c => c && c !== '#ffffff' && c !== '#ffffff00');
      if (row4HasText || row4HasBandColor) return 5;
    }
  } catch(e) { Logger.log('WP360_findDataStartRow: row4 band check warning: ' + e); }
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

function WP360_readAllTabsParallel(ss, uid, lastSyncTime) {
  const result = {};

  const promises = [
    Promise.resolve().then(() => {
      result.loans = WP360_readTabRows(ss, '🏦 Loans', uid,
        r => ({
          name:r[0], bank:r[1], type:r[2], amount:r[3], outstanding:r[4], emi:r[5], interest:r[6], due:WP360_dateStr(r[7]),
          notes:r[9]||'', tenure:r[10]||'', manualInterest:String(r[11]).toUpperCase()==='YES',
          sanctionUrl:r[12]||'', receiptUrl:r[13]||''
        }),
        8
      );
    }),
    Promise.resolve().then(() => {
      result.bills = WP360_readTabRows(ss, '📋 Bills', uid,
        r => ({ name:r[0], provider:r[1], cat:r[2], amount:r[3], due:WP360_dateStr(r[4]), status:r[5] }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.insurance = WP360_readTabRows(ss, '🛡️ Insurance', uid,
        r => ({ name:r[0], type:r[1], policy:r[2], premium:r[3], renewal:WP360_dateStr(r[4]), coverage:r[5], nominee:r[6], policyDocUrl:r[9]||'' }),
        7
      );
    }),
    Promise.resolve().then(() => {
      result.investments = WP360_readTabRows(ss, '📈 Investments', uid,
        r => ({ name:r[0], type:r[1], invested:r[2], current:r[3] }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.assets = WP360_readTabRows(ss, '💰 Assets', uid,
        r => ({
          name: r[0],
          kind:  String(r[1]).toLowerCase().includes('liability') ? 'liability' : 'asset',
          value: String(r[1]).toLowerCase().includes('liability') ? r[3] : r[2]
        }),
        4
      );
    }),
    Promise.resolve().then(() => {
      result.creditCards = WP360_readTabRows(ss, '💳 Credit Cards', uid,
        r => ({ name:r[0], bank:r[1], limit:r[2], outstanding:r[3], mindue:r[4], due:WP360_dateStr(r[5]) }),
        7
      );
    }),
    Promise.resolve().then(() => {
      result.subscriptions = WP360_readTabRows(ss, '🔄 Subscriptions', uid,
        r => ({ name:r[0], cat:r[1], amount:r[2], cycle:r[3], renewal:WP360_dateStr(r[4]) }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.transactions = WP360_readTabRows(ss, '💵 Transactions', uid,
        r => ({ date:WP360_dateStr(r[0]), desc:r[1], cat:r[2], type:r[3], amount:r[4] }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.goals = WP360_readTabRows(ss, '🎯 Goals', uid,
        r => ({ name:r[0], cat:r[1], target:r[2], saved:r[3], date:WP360_dateStr(r[6]) }),
        8
      );
    }),
    Promise.resolve().then(() => {
      result.documents = WP360_readTabRows(ss, '📁 Documents', uid,
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
    }),
    Promise.resolve().then(() => {
      result.family = WP360_readTabRows(ss, '👨‍👩‍👧‍👦 Family', uid,
        r => ({ name:r[0], relation:r[1] }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.budgets = WP360_readTabRows(ss, '📊 Budget', uid,
        r => ({ cat:r[0], amount:r[1] }),
        6
      );
    }),
    Promise.resolve().then(() => {
      result.accounting = WP360_readTabRows(ss, 'Accounting', uid,
        r => ({
          id:      String(r[0]||'') + '_' + String(r[1]||'') + '_' + String(r[8]||''),
          date:    WP360_dateStr(r[0]),
          name:    r[1],
          type:    String(r[2]).toLowerCase().includes('creditor') ? 'creditor' : 'debtor',
          head:    r[3] || '',
          amount:  r[4],
          due:     WP360_dateStr(r[5]),
          status:  r[6] || 'outstanding',
          notes:   r[7],
          paidAmt:       (r[10] !== undefined && r[10] !== '') ? Number(r[10]) : (String(r[6]).toLowerCase() === 'paid' ? Number(r[4]) : 0),
          paidMode:      r[11] || 'Cash',
          bankAccountId: r[12] || '',
          linkedTxId:    r[13] || null
        }),
        8
      );
    })
  ];

  try {
    for (const p of promises) {
      try { Utilities.sleep(0); } catch(e) {}
    }
  } catch(e) { Logger.log('Parallel read warning: ' + e); }

  return result;
}

function WP360_loadClientSheet(uid, lastSyncTime) {
  if (!uid) return null;

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) {
    Logger.log('LOAD_DB: No sheet found for UID: [' + uid + ']');
    return null;
  }

  const cached = WP360_ClientDataCache.get(uid);
  if (cached) {
    let sheetLastModified = 0;
    try {
      sheetLastModified = DriveApp.getFileById(sheetRef.id).getLastUpdated().getTime();
    } catch(e) { }

    const cacheTakenAt = cached._loadedAt || 0;
    if (sheetLastModified && cacheTakenAt && sheetLastModified <= cacheTakenAt) {
      Logger.log('Cache hit for ' + uid);
      return JSON.stringify(cached);
    }
    WP360_ClientDataCache._clear(uid);
    Logger.log('Cache stale for ' + uid + ' — re-reading');
  }

  try {
    WP360_ensureClientSheetMigrated(sheetRef.id);

    const ss = SpreadsheetApp.openById(sheetRef.id);
    const db = {
      loans:[], bills:[], insurance:[], investments:[],
      assets:[], goals:[], transactions:[], family:[],
      business:[], creditCards:[], subscriptions:[],
      documents:[], budgets:[], accounting:[], profile:{},
      bankAccounts:{},
      cashSettings:{ set:false, openingAmount:0, openingDate:'', user:'', account:'Personal', note:'' },
      customAcctHeads:{ debtor:[], creditor:[] },
      _loadedAt: Date.now(),
      _syncTime: lastSyncTime || 0
    };

    const tabData = WP360_readAllTabsParallel(ss, uid, lastSyncTime || 0);

    db.loans = tabData.loans || [];
    db.bills = tabData.bills || [];
    db.insurance = tabData.insurance || [];
    db.investments = tabData.investments || [];
    db.assets = tabData.assets || [];
    db.creditCards = tabData.creditCards || [];
    db.subscriptions = tabData.subscriptions || [];
    db.transactions = tabData.transactions || [];
    db.goals = tabData.goals || [];
    db.documents = tabData.documents || [];
    db.family = tabData.family || [];
    db.budgets = tabData.budgets || [];
    db.accounting = tabData.accounting || [];

    try {
      const ba = WP360_readAppMetaKey(ss, 'bankAccounts');
      if (ba !== null) db.bankAccounts = ba;
      const cs = WP360_readAppMetaKey(ss, 'cashSettings');
      if (cs !== null) db.cashSettings = cs;
      const ch = WP360_readAppMetaKey(ss, 'customAcctHeads');
      if (ch !== null) db.customAcctHeads = ch;
    } catch(e) { Logger.log('WP360_loadClientSheet: App_Meta read warning: ' + e); }

    try {
      db._savedAt = DriveApp.getFileById(sheetRef.id).getLastUpdated().getTime();
    } catch(e) { db._savedAt = Date.now(); }

    WP360_ClientDataCache.set(uid, db);

    Logger.log('LOAD_DB complete for ' + uid);
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
    catch(e) { Logger.log('mapFn error in tab [' + tabName + '] row ' + i + ': ' + e); }
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
    try {
      const ts = new Date().toISOString();
      WP360_writeAppMetaKey(ss, 'bankAccounts', {}, ts);
      WP360_writeAppMetaKey(ss, 'cashSettings', { set:false, openingAmount:0, openingDate:'', user:'', account:'Personal', note:'' }, ts);
      WP360_writeAppMetaKey(ss, 'customAcctHeads', { debtor:[], creditor:[] }, ts);
    } catch(e) { Logger.log('WP360_clearClientSheet: App_Meta clear warning: ' + e); }

    WP360_ClientDataCache._clear(uid);
    return 'cleared';
  } catch(e) { return 'error: ' + e.toString(); }
}

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

  WP360_ClientDataCache._clear(uid);

  Logger.log('Subscription changed for ' + uid + ': ' + oldPlan + ' -> ' + d.plan);
  return JSON.stringify({ plan: d.plan, planExpiry: WP360_dateStr(expiry) });
}

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

    Logger.log('Document uploaded for ' + uid + ': ' + d.fileName);

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

    Logger.log('Loan document (' + docType + ') uploaded for ' + uid + ': ' + d.fileName);

    return JSON.stringify({
      status: 'uploaded', url: fileUrl, id: fileId, name: d.fileName,
      docType: docType, folderUrl: targetFolder.getUrl()
    });
  } catch(err) {
    WP360_logError('WP360_uploadLoanDocument', err.toString());
    return JSON.stringify({ error: err.toString() });
  }
}

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

    Logger.log('Insurance policy document uploaded for ' + uid + ': ' + d.fileName);

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

function WP360_logError(action, msg) {
  try {
    WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'ERROR_LOG', {
      TIMESTAMP: new Date().toISOString(),
      ERROR: '[WealthPilot360:' + action + '] ' + msg,
      STACK: ''
    });
  } catch(e) {}
}

function WP360_findDuplicateClientIds() {
  const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
  const byId = {};
  clients.forEach(c => {
    const id = String(c.CLIENT_ID || '').trim();
    if (!id) return;
    (byId[id] = byId[id] || []).push({ row: c._rowIndex, name: c.CONTACT_NAME, phone: c.PHONE, email: c.EMAIL });
  });
  const dups = {};
  Object.keys(byId).forEach(id => { if (byId[id].length > 1) dups[id] = byId[id]; });
  Logger.log('Duplicate CLIENT_IDs found in CLIENT_MASTER: ' + JSON.stringify(dups, null, 2));
  return dups;
}

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
    Logger.log('LOAD_DB test passed for UID: ' + testUid);
    Logger.log('Accounting rows: ' + db.accounting.length);
    Logger.log('Bank accounts: ' + JSON.stringify(db.bankAccounts));
    Logger.log('_savedAt: ' + new Date(db._savedAt));
  } else {
    Logger.log('LOAD_DB test failed — null returned for UID: ' + testUid);
  }
}

function WP360_runDiagNow() {
  Logger.log(JSON.stringify(WP360_diag(), null, 2));
}

// ══════════════════════════════════════════════════════════════════
//  v26: ONE-TIME HEADER REPAIR — fixes client sheets created/loaded
//  before the row-4 header-band fix (e.g. DB_CL00030_demo →
//  Transactions showing a blank green header band). This just calls
//  the (now-fixed) WP360_ensureClientSheetMigrated, which rewrites the
//  full header row on every tab — safe to run repeatedly, never
//  touches data rows.
// ══════════════════════════════════════════════════════════════════
function WP360_repairClientHeaders(uid) {
  if (!uid) return { error: 'no_uid' };
  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return { error: 'no_sheet_resolved_for_uid' };
  WP360_ensureClientSheetMigrated(sheetRef.id);
  WP360_ClientDataCache._clear(uid);
  Logger.log('Repaired headers for ' + uid + ' (' + sheetRef.url + ')');
  return { status: 'repaired', uid: uid, sheetUrl: sheetRef.url };
}

// Run this ONCE from the Apps Script editor (select it in the function
// dropdown, click Run) to repair every client sheet in one pass.
function WP360_repairAllClientHeaders() {
  const rows = WP360_findAllRows(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', null, null);
  const results = [];
  rows.forEach(r => {
    const uid = r.CLIENT_ID;
    if (!uid) return;
    try {
      results.push(WP360_repairClientHeaders(uid));
    } catch(e) {
      results.push({ uid: uid, status: 'error', error: e.toString() });
      WP360_logError('WP360_repairAllClientHeaders', 'uid=' + uid + ': ' + e.toString());
    }
  });
  Logger.log('Header repair run complete: ' + JSON.stringify(results));
  return results;
}
