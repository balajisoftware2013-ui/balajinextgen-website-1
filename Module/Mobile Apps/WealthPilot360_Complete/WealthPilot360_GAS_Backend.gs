// ════════════════════════════════════════════════════════════════
//  WealthPilot360 – Google Apps Script Backend
//  FILE: WealthPilot360_GAS_Backend.gs
//
//  ✅ ALREADY DEPLOYED AT:
//  https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec
//
//  HOW TO RE-DEPLOY (if you make changes):
//  1. Go to script.google.com → Open your project → paste updated code
//  2. Deploy → Manage Deployments → Edit → New Version → Deploy
//  3. Copy the Web App URL → already set in WealthPilot360_Final.html
//
//  SHEETS INSIDE WealthPilot360_Database (Google Sheets):
//    └─ USER_REGISTRY   sheet  – all user accounts
//    └─ USER_DATA       sheet  – per-user financial DB (1 row/user)
// ════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────
const DRIVE_FOLDER_ID = '1u2yVJCgH2EwLAP950l_97vo5Ckx9cgL7';

const SS_NAME     = 'WealthPilot360_DB';
const SHEET_USERS = 'USER_REGISTRY';
const SHEET_DATA  = 'USER_DATA';
const PROP_SS_ID  = 'WP360_SS_ID';

// ── ENTRY POINTS ─────────────────────────────────────────────────
function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); } catch(err) {
    return _resp(false, 'Invalid JSON: ' + err.toString());
  }
  const { action, uid, data } = payload;
  try {
    switch (action) {
      case 'SAVE_USERS': return _resp(true,  _saveUsers(data));
      case 'LOAD_USERS': return _resp(true,  _loadUsers());
      case 'SAVE_DB':    return _resp(true,  _saveUserDB(uid, data));
      case 'LOAD_DB':    return _resp(true,  _loadUserDB(uid));
      case 'DELETE_DB':  return _resp(true,  _deleteUserDB(uid));
      case 'PING':       return _resp(true,  'pong');
      default:           return _resp(false, 'Unknown action: ' + action);
    }
  } catch(err) {
    return _resp(false, err.toString());
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return _resp(true, 'pong – WealthPilot360 GAS Backend OK');
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'WealthPilot360 GAS Backend OK', ssId: _getSSId() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── RESPONSE ─────────────────────────────────────────────────────
function _resp(success, data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, data: data !== undefined ? data : null }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════
//  SPREADSHEET – AUTO CREATE IN DRIVE FOLDER
// ════════════════════════════════════════════════════════════════
function _getSSId() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(PROP_SS_ID);
  if (ssId) {
    try { SpreadsheetApp.openById(ssId); return ssId; } catch(e) {}
  }
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const files = folder.getFilesByName(SS_NAME);
    if (files.hasNext()) {
      ssId = files.next().getId();
      props.setProperty(PROP_SS_ID, ssId);
      return ssId;
    }
    const ss = SpreadsheetApp.create(SS_NAME);
    ssId = ss.getId();
    const file = DriveApp.getFileById(ssId);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    _initSheets(ss);
    props.setProperty(PROP_SS_ID, ssId);
    Logger.log('✅ Created WealthPilot360_DB: https://docs.google.com/spreadsheets/d/' + ssId);
    return ssId;
  } catch(err) {
    throw new Error('Cannot access Drive folder ' + DRIVE_FOLDER_ID + ': ' + err.toString());
  }
}

function _ss() { return SpreadsheetApp.openById(_getSSId()); }

function _initSheets(ss) {
  let sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) { sh = ss.insertSheet(SHEET_USERS); }
  if (sh.getLastRow() === 0) {
    sh.appendRow(['UID', 'REGISTRY_JSON', 'LAST_UPDATED']);
    sh.getRange(1,1,1,3).setFontWeight('bold').setBackground('#FF7A1A').setFontColor('#FFFFFF');
    sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 600); sh.setColumnWidth(3, 200);
    sh.setFrozenRows(1);
  }
  let sd = ss.getSheetByName(SHEET_DATA);
  if (!sd) { sd = ss.insertSheet(SHEET_DATA); }
  if (sd.getLastRow() === 0) {
    sd.appendRow(['UID', 'NAME', 'LAST_SAVED', 'DB_JSON']);
    sd.getRange(1,1,1,4).setFontWeight('bold').setBackground('#FF7A1A').setFontColor('#FFFFFF');
    sd.setColumnWidth(1, 160); sd.setColumnWidth(2, 180); sd.setColumnWidth(3, 200); sd.setColumnWidth(4, 600);
    sd.setFrozenRows(1);
  }
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}

function _getOrCreateSheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) { _initSheets(ss); sh = ss.getSheetByName(name); }
  return sh;
}

// ════════════════════════════════════════════════════════════════
//  USER REGISTRY
// ════════════════════════════════════════════════════════════════
function _saveUsers(usersJson) {
  const sh = _getOrCreateSheet(SHEET_USERS);
  const vals = sh.getDataRange().getValues();
  let blobRow = -1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '__REGISTRY__') { blobRow = i + 1; break; }
  }
  const ts = new Date().toISOString();
  if (blobRow === -1) { sh.appendRow(['__REGISTRY__', usersJson, ts]); }
  else { sh.getRange(blobRow, 2).setValue(usersJson); sh.getRange(blobRow, 3).setValue(ts); }
  return 'saved';
}

function _loadUsers() {
  const sh = _getOrCreateSheet(SHEET_USERS);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '__REGISTRY__') return vals[i][1] || '{}';
  }
  return '{}';
}

// ════════════════════════════════════════════════════════════════
//  PER-USER DATABASE
// ════════════════════════════════════════════════════════════════
function _saveUserDB(uid, dbJson) {
  if (!uid) return 'no_uid';
  const sh = _getOrCreateSheet(SHEET_DATA);
  let userName = uid;
  try {
    const usersRaw = _loadUsers();
    const users = JSON.parse(usersRaw);
    if (users[uid] && users[uid].name) userName = users[uid].name;
  } catch(e) {}
  const vals = sh.getDataRange().getValues();
  let userRow = -1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === uid) { userRow = i + 1; break; }
  }
  const ts = new Date().toISOString();
  if (userRow === -1) { sh.appendRow([uid, userName, ts, dbJson]); }
  else { sh.getRange(userRow, 2).setValue(userName); sh.getRange(userRow, 3).setValue(ts); sh.getRange(userRow, 4).setValue(dbJson); }
  return 'saved';
}

function _loadUserDB(uid) {
  if (!uid) return null;
  const sh = _getOrCreateSheet(SHEET_DATA);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === uid) return vals[i][3] || null;
  }
  return null;
}

function _deleteUserDB(uid) {
  if (!uid) return 'no_uid';
  const sh = _getOrCreateSheet(SHEET_DATA);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === uid) {
      sh.getRange(i + 1, 3).setValue(new Date().toISOString());
      sh.getRange(i + 1, 4).setValue('{}');
      return 'deleted';
    }
  }
  return 'not_found';
}

// ════════════════════════════════════════════════════════════════
//  SETUP – Run once manually before first deploy
// ════════════════════════════════════════════════════════════════
function runSetup() {
  const ssId = _getSSId();
  const ss = SpreadsheetApp.openById(ssId);
  _initSheets(ss);
  const url = 'https://docs.google.com/spreadsheets/d/' + ssId;
  Logger.log('✅  WealthPilot360_DB ready! URL: ' + url);
}
