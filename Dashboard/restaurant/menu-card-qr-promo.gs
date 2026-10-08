/**
 * ============================================================
 * BALAJI NEXTGEN — MENU CARD + QR PROMO (VIDEO / EVENTS) + PUBLIC CUSTOMER MENU
 * ============================================================
 * REPLACES BOTH:  the old "menu card" .gs  AND  the separate "CUSTOMER QR PROMOTION" .gs.
 * Delete the old QR-promo file — the same functions in two files = Apps Script keeps only one.
 *
 * ROOT CAUSES FIXED (2026-10-08)
 *  1. bnxMcSave_ / bnxMcRows_ called bnxCrmSheet(...) — function is bnxCrmSheet_ → ReferenceError,
 *     so SAVE_MENU_CARD_LINK / GET_MENU_CARDS / GET_ACTIVE_MENU_CARD always failed  ("not save / not show").
 *  2. SAVE_MENU_CARD_UPLOAD (file upload from menu-card.html) had NO handler in this file.
 *  3. bnxPublicMenu_ called bnxQrPromoPublic_ (does not exist; real name bnxQrpPublic_) → promo always empty
 *     → customer never saw video / event.
 *  4. MENU_CARDS had no CARD_TYPE: activating ANY card (video, event, bar) de-activated the food menu card.
 *     Now one active card PER TYPE (FOOD / BAR / OTHER); VIDEO / EVENT go to QR promo sheets, not MENU_CARDS.
 *  5. Video > 8 MB could never be sent in one POST. New chunked upload straight into Drive
 *     (QR_PROMO_UPLOAD_INIT / QR_PROMO_UPLOAD_CHUNK, 2 MB pieces, Drive resumable upload) — up to 100 MB.
 *  6. Event date / time cells were auto-converted by Sheets (time "Open Till 2AM" safe, "22:00" became 1899 date).
 *     Date + time columns are now plain text; readers also normalise old Date cells.
 *  7. Event poster was returned as a Drive /view link — not an image. Public data now carries posterImg
 *     (lh3 direct image) + posterThumb fallback.
 *  8. Events vanished at midnight during a party: "today" now follows the business day (06:00 → 05:59 IST).
 *
 * INSTALL
 *  A) Replace the menu-card .gs with this file. Delete the separate QR-promo .gs file.
 *  B) Put THIS FILE LAST in the editor's file list (⋮ next to the file name → "Move file down" until it is
 *     at the bottom). It then wraps the live doPost by itself — "Unknown action: QR_PROMO_…" was the main
 *     router never forwarding these actions. No router edit needed.
 *     (Optional, same effect: first line inside bnxCrmRoute_:  var mp = bnxMenuPromoRoute_(action, req); if (mp) return mp;)
 *  C) If appsscript.json lists oauthScopes, it must contain:
 *       https://www.googleapis.com/auth/drive , https://www.googleapis.com/auth/spreadsheets ,
 *       https://www.googleapis.com/auth/script.external_request
 *  D) Run bnxQrpAuthorize() once, then bnxMenuPromoCheck() — the log must say "ROUTING OK".
 *  E) Deploy > Manage deployments > Edit (pencil) > Version: NEW VERSION > Deploy.
 *     (Saving the code alone does NOT change the live /exec URL.)
 * ============================================================
 */

var MC_SHEET = 'MENU_CARDS';
var MC_HEAD = ['CARD_ID','NAME','FILE_URL','FILE_ID','ACTIVE','UPLOADED_AT','CLIENT_ID','CARD_TYPE'];
var MC_ROOT_NAME = 'CLIENT_DATABASES';
var MC_SUB_NAME = 'MENU_CARDS';
var MC_MAX_UPLOAD = 15 * 1024 * 1024;

var QRP_SETTINGS_SHEET = 'QR_PROMO_SETTINGS';
var QRP_EVENTS_SHEET   = 'QR_EVENTS';
var QRP_SETTINGS_HEAD  = ['CLIENT_ID','VIDEO_URL','VIDEO_ACTIVE','UPDATED_AT','VIDEO_FILE_ID','VIDEO_NAME'];
var QRP_EVENTS_HEAD    = ['EVENT_ID','CLIENT_ID','TITLE','EVENT_DATE','START_TIME','VENUE','DESCRIPTION','POSTER_URL','ACTIVE','UPDATED_AT','POSTER_FILE_ID'];
var QRP_SUB_NAME       = 'QR_PROMO';
var QRP_CHUNK          = 2 * 1024 * 1024;          /* multiple of 256 KB (Drive resumable rule) */
var QRP_MAX_FILE       = 100 * 1024 * 1024;
var QRP_TZ             = 'Asia/Kolkata';

/* ============================================================
   ROUTER — call from bnxCrmRoute_ (see INSTALL B). Returns null when the action is not ours.
   ============================================================ */
function bnxMenuPromoRoute_(action, req) {
  req = req || {};
  switch (String(action || '')) {
    case 'SAVE_MENU_CARD_LINK':    return bnxMcSave_(req);
    case 'SAVE_MENU_CARD_UPLOAD':  return bnxMcUpload_(req);
    case 'GET_MENU_CARDS':         return bnxMcList_(req);
    case 'GET_ACTIVE_MENU_CARD':   return bnxMcActive_(req);
    case 'ACTIVATE_MENU_CARD':     return bnxMcActivate_(req);
    case 'DELETE_MENU_CARD':       return bnxMcDelete_(req);
    case 'QR_PROMO_GET':           return bnxQrpGet_(req);
    case 'QR_PROMO_SAVE_VIDEO':    return bnxQrpSaveVideo_(req);
    case 'QR_PROMO_DELETE_VIDEO':  return bnxQrpDeleteVideo_(req);
    case 'QR_PROMO_SAVE_EVENT':    return bnxQrpSaveEvent_(req);
    case 'QR_PROMO_DELETE_EVENT':  return bnxQrpDeleteEvent_(req);
    case 'QR_PROMO_SAVE_EVENTS':   return bnxQrpSaveEvents_(req);
    case 'QR_PROMO_UPLOAD_INIT':   return bnxQrpUploadInit_(req);
    case 'QR_PROMO_UPLOAD_CHUNK':  return bnxQrpUploadChunk_(req);
  }
  if (/^APPROVAL_/.test(String(action || '')) && typeof bnxApprovalRoute_ === 'function') return bnxApprovalRoute_(String(action), req);   /* bill-approvals.gs */
  return null;
}

/* ============================================================
   SMALL HELPERS
   ============================================================ */
function bnxMcId_(u) {
  var m = String(u || '').match(/(?:\/d\/|[?&]id=|lh3\.googleusercontent\.com\/d\/)([\w-]{10,})/);
  return m ? m[1] : '';
}
function bnxMcBool_(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  if (v === true || v === false) return v;
  var s = String(v).trim().toUpperCase();
  return !(s === 'FALSE' || s === 'NO' || s === '0' || s === 'N' || s === 'OFF');
}
function bnxMcType_(t) {
  t = String(t || '').trim().toUpperCase();
  return (t === 'BAR' || t === 'OTHER' || t === 'VIDEO' || t === 'EVENT') ? t : 'FOOD';
}
function bnxMcCid_(req) {
  var cid = String((req || {}).clientId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) throw new Error('Valid Client ID is required');
  return cid;
}
function bnxMcClearPublicCache_(clientId) {
  clientId = String(clientId || '').trim();
  if (!clientId) return;
  try { CacheService.getScriptCache().remove('pubmenu_' + clientId); } catch (e) { console.log('Public cache clear failed: ' + e.message); }
}
function bnxMcShare_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return ''; }
  catch (e) { return 'Could not set Drive sharing automatically — set the file to "Anyone with the link: Viewer".'; }
}
/* ROOT FIX 2026-10-08 ("all drive save"): with no MC_ROOT_FOLDER_ID property the root was found BY NAME — the first
   folder called CLIENT_DATABASES anywhere in Drive (there can be copies under DEMO / Suite Module / shared folders),
   so uploads could land in the wrong place. Default is now the real folder:
   My Drive › Balaji NextGen ERP › CLIENT_DATABASES  (1u2yVJCgH2EwLAP950l_97vo5Ckx9cgL7).
   Every upload goes to  CLIENT_DATABASES/<clientId>/MENU_CARDS  or  CLIENT_DATABASES/<clientId>/QR_PROMO. */
var MC_ROOT_FOLDER_DEFAULT = '1u2yVJCgH2EwLAP950l_97vo5Ckx9cgL7';
function bnxMcRootFolder_() {
  var ids = [PropertiesService.getScriptProperties().getProperty('MC_ROOT_FOLDER_ID'), MC_ROOT_FOLDER_DEFAULT];
  for (var i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    try { var f = DriveApp.getFolderById(ids[i]); if (!f.isTrashed()) return f; } catch (e) {}
  }
  var it = DriveApp.getFoldersByName(MC_ROOT_NAME);
  if (!it.hasNext()) throw new Error('Drive folder ' + MC_ROOT_NAME + ' not found — set Script property MC_ROOT_FOLDER_ID');
  return it.next();
}
function bnxMcSubFolder_(clientId, sub) {
  clientId = String(clientId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(clientId)) throw new Error('Invalid client id');
  var root = bnxMcRootFolder_();
  var c = root.getFoldersByName(clientId), client = c.hasNext() ? c.next() : root.createFolder(clientId);
  var s = client.getFoldersByName(sub);
  return s.hasNext() ? s.next() : client.createFolder(sub);
}
function bnxMcFolder_(clientId) { return bnxMcSubFolder_(clientId, MC_SUB_NAME); }
function bnxQrpFolder_(clientId) { return bnxMcSubFolder_(clientId, QRP_SUB_NAME); }

function bnxMcFileToClientFolder_(fileOrId, clientId) {
  var file = typeof fileOrId === 'string' ? DriveApp.getFileById(fileOrId) : fileOrId;
  var folder = bnxMcFolder_(clientId), ps = file.getParents();
  while (ps.hasNext()) { if (ps.next().getId() === folder.getId()) return file.getUrl(); }
  file.moveTo(folder);
  return file.getUrl();
}
function bnxMcDataUrlBlob_(dataUrl, fileName, maxBytes) {
  var m = String(dataUrl || '').match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/);
  if (!m) throw new Error('Invalid file data');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > maxBytes) throw new Error('File is ' + (bytes.length / 1048576).toFixed(1) + ' MB — limit ' + Math.round(maxBytes / 1048576) + ' MB');
  var name = String(fileName || ('file-' + Date.now())).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return Utilities.newBlob(bytes, m[1], name);
}
function bnxDriveViewUrl_(id) { return id ? 'https://drive.google.com/file/d/' + id + '/view' : ''; }
function bnxDriveImg_(id) { return id ? 'https://lh3.googleusercontent.com/d/' + id + '=w1600' : ''; }
function bnxDriveThumb_(id) { return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' : ''; }

/* business day: 06:00 → 05:59 next morning, IST */
function bnxQrpBusinessDay_() {
  return Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), QRP_TZ, 'yyyy-MM-dd');
}

/* ============================================================
   MENU CARDS  (FOOD / BAR / OTHER — one active per type)
   ============================================================ */
function bnxMcRowType_(r, C) { return bnxMcType_(C.CARD_TYPE ? r[C.CARD_TYPE - 1] : ''); }

function bnxMcClearActive_(sh, C, clientId, type) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return;
  var data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  var act = sh.getRange(2, C.ACTIVE, n, 1), av = act.getValues(), changed = false;
  for (var i = 0; i < n; i++) {
    if (String(data[i][C.CLIENT_ID - 1]) !== String(clientId)) continue;
    if (type && bnxMcRowType_(data[i], C) !== type) continue;
    if (av[i][0] !== 'NO') { av[i][0] = 'NO'; changed = true; }
  }
  if (changed) act.setValues(av);
}

/* insert or update one MENU_CARDS row — caller must hold the script lock */
function bnxMcUpsert_(clientId, o) {
  var sh = bnxCrmSheet_(MC_SHEET, MC_HEAD, clientId), C = bnxCrmCols_(sh);
  var type = bnxMcType_(o.type), id = String(o.cardId || ('MC' + Utilities.formatDate(new Date(), QRP_TZ, 'yyMMddHHmmss')));
  var n = sh.getLastRow() - 1, existing = 0;
  if (n > 0) {
    var data = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (String(r[C.CLIENT_ID - 1]) !== clientId) continue;
      if (String(r[C.CARD_ID - 1]) === id || (o.link && String(r[C.FILE_URL - 1]) === o.link)) { existing = i + 2; break; }
    }
  }
  if (o.active) bnxMcClearActive_(sh, C, clientId, type);
  var row = {
    CARD_ID: id, NAME: o.name, FILE_URL: o.link, FILE_ID: o.fid || '', ACTIVE: o.active ? 'YES' : 'NO',
    UPLOADED_AT: new Date(), CLIENT_ID: clientId, CARD_TYPE: type
  };
  if (existing) {
    var keep = sh.getRange(existing, C.CARD_ID).getValue();
    if (keep) row.CARD_ID = id = String(keep);
    var cur = sh.getRange(existing, 1, 1, sh.getLastColumn()).getValues()[0];
    Object.keys(row).forEach(function (k) { if (C[k]) cur[C[k] - 1] = row[k]; });
    sh.getRange(existing, 1, 1, cur.length).setValues([cur]);
  } else {
    bnxCrmAppend_(sh, row);
  }
  bnxMcClearPublicCache_(clientId);
  return { cardId: id, name: o.name, fileUrl: o.link, fileId: o.fid || '', active: !!o.active, clientId: clientId, cardType: type };
}

/* SAVE_MENU_CARD_LINK — Drive link (FOOD / BAR / OTHER). VIDEO / EVENT links are sent to the QR promo sheets. */
function bnxMcSave_(req) {
  try {
    req = req || {};
    var clientId = bnxMcCid_(req);
    var link = String(req.link || req.fileUrl || req.url || '').trim();
    var name = String(req.name || 'Menu Card').trim().slice(0, 200);
    var type = bnxMcType_(req.cardType);
    if (!/^https:\/\//i.test(link)) return { success: false, error: 'Paste a full https:// link' };

    if (type === 'VIDEO') return bnxQrpSaveVideo_({ clientId: clientId, videoUrl: link, name: name, active: bnxMcBool_(req.active, true) });
    if (type === 'EVENT') {
      var ev = bnxMcEventFromName_(name) || { title: name };
      ev.posterUrl = link; ev.active = bnxMcBool_(req.active, true);
      return bnxQrpSaveEvent_({ clientId: clientId, event: ev });
    }
    if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(link)) return { success: false, error: 'Paste a valid Google Drive link' };

    var fid = bnxMcId_(link), warn = '';
    if (fid) {
      try { warn = bnxMcShare_(DriveApp.getFileById(fid)); } catch (e) { warn = 'Drive file not reachable by the ERP account: ' + e.message; }
      try { bnxMcFileToClientFolder_(fid, clientId); } catch (e) { /* file owned by someone else — link still works */ }
    }
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var d = bnxMcUpsert_(clientId, { cardId: req.cardId, name: name, link: link, fid: fid, active: bnxMcBool_(req.active, true), type: type });
      d.warn = warn;
      return { success: true, data: d };
    } finally { lock.releaseLock(); }
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* SAVE_MENU_CARD_UPLOAD — file (PDF / image) from menu-card.html, base64 dataUrl.  (Was missing.) */
function bnxMcUpload_(req) {
  try {
    req = req || {};
    var clientId = bnxMcCid_(req);
    var type = bnxMcType_(req.cardType);
    var name = String(req.name || 'Menu Card').trim().slice(0, 200);
    var blob = bnxMcDataUrlBlob_(req.dataUrl, req.fileName || (name + (/pdf/i.test(String(req.mime)) ? '.pdf' : '.jpg')), MC_MAX_UPLOAD);

    if (type === 'VIDEO' || type === 'EVENT') {                                   /* old admin page path */
      var pf = bnxQrpFolder_(clientId).createFile(blob), pw = bnxMcShare_(pf);
      if (type === 'VIDEO') return bnxQrpSaveVideo_({ clientId: clientId, fileId: pf.getId(), name: name, active: bnxMcBool_(req.active, true), warn: pw });
      var ev = bnxMcEventFromName_(name) || { title: name };
      ev.posterFileId = pf.getId(); ev.active = bnxMcBool_(req.active, true);
      return bnxQrpSaveEvent_({ clientId: clientId, event: ev });
    }

    var file = bnxMcFolder_(clientId).createFile(blob);
    var warn = bnxMcShare_(file), fid = file.getId(), link = bnxDriveViewUrl_(fid);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var d = bnxMcUpsert_(clientId, { cardId: req.cardId, name: name, link: link, fid: fid, active: bnxMcBool_(req.active, true), type: type });
      d.warn = warn;
      return { success: true, data: d };
    } finally { lock.releaseLock(); }
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* old admin encoded an event inside NAME as  EVENT_JSON:<base64url(json)> */
function bnxMcEventFromName_(name) {
  name = String(name || '');
  if (name.indexOf('EVENT_JSON:') !== 0) return null;
  try {
    var b = name.slice(11).replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(b)).getDataAsString('UTF-8'));
  } catch (e) { return null; }
}

function bnxMcRows_(req) {
  var clientId = bnxMcCid_(req);
  var sh = bnxCrmSheet_(MC_SHEET, MC_HEAD, clientId), C = bnxCrmCols_(sh), n = sh.getLastRow() - 1;
  if (n < 1) return { sh: sh, rows: [], C: C };
  var tz = Session.getScriptTimeZone(), out = [];
  sh.getRange(2, 1, n, sh.getLastColumn()).getValues().forEach(function (r, i) {
    if (String(r[C.CLIENT_ID - 1]) !== clientId) return;
    var up = C.UPLOADED_AT ? r[C.UPLOADED_AT - 1] : '';
    var fid = C.FILE_ID ? String(r[C.FILE_ID - 1] || '') : '';
    var url = String(r[C.FILE_URL - 1] || '') || bnxDriveViewUrl_(fid);
    out.push({
      row: i + 2, cardId: String(r[C.CARD_ID - 1] || ''), name: String(r[C.NAME - 1] || ''), fileUrl: url,
      fileId: fid || bnxMcId_(url), active: String(r[C.ACTIVE - 1] || '').trim().toUpperCase() === 'YES',
      uploadedAt: up instanceof Date ? Utilities.formatDate(up, tz, "yyyy-MM-dd'T'HH:mm:ss") : String(up || ''),
      clientId: clientId, cardType: bnxMcRowType_(r, C)
    });
  });
  return { sh: sh, rows: out, C: C };
}
function bnxMcPublicCard_(r) {
  return { cardId: r.cardId, name: r.name, fileUrl: r.fileUrl, fileId: r.fileId, active: r.active, clientId: r.clientId, cardType: r.cardType, uploadedAt: r.uploadedAt };
}
function bnxMcIsMenuType_(r) { return r.cardType !== 'VIDEO' && r.cardType !== 'EVENT'; }

function bnxMcList_(req) {
  try {
    var rows = bnxMcRows_(req).rows.filter(bnxMcIsMenuType_).map(bnxMcPublicCard_).reverse();
    return { success: true, data: rows };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* GET_ACTIVE_MENU_CARD — newest active card of each type. data = FOOD card (old shape) + data.cards = all active. */
function bnxMcActiveCards_(clientId) {
  var rows = bnxMcRows_({ clientId: clientId }).rows.filter(function (r) { return r.active && r.fileUrl && bnxMcIsMenuType_(r); });
  var pick = {};
  rows.slice().reverse().forEach(function (r) { if (!pick[r.cardType]) pick[r.cardType] = r; });
  return ['FOOD', 'BAR', 'OTHER'].filter(function (t) { return pick[t]; }).map(function (t) { return bnxMcPublicCard_(pick[t]); });
}
function bnxMcActive_(req) {
  try {
    var cards = bnxMcActiveCards_(bnxMcCid_(req));
    if (!cards.length) return { success: true, data: null };
    var d = Object.assign({}, cards[0]); d.cards = cards;
    return { success: true, data: d };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

function bnxMcActivate_(req) {
  try {
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var x = bnxMcRows_(req), cardId = String(req.cardId || '');
      var t = x.rows.filter(function (r) { return r.cardId === cardId; })[0];
      if (!t) return { success: false, error: 'Menu card not found' };
      if (!t.fileUrl) return { success: false, error: 'Menu card has no FILE_URL' };
      bnxMcClearActive_(x.sh, x.C, t.clientId, t.cardType);
      x.sh.getRange(t.row, x.C.ACTIVE).setValue('YES');
      bnxMcClearPublicCache_(t.clientId);
      t.active = true;
      return { success: true, data: bnxMcPublicCard_(t) };
    } finally { lock.releaseLock(); }
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

function bnxMcDelete_(req) {
  try {
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var x = bnxMcRows_(req), cardId = String(req.cardId || ''), url = String(req.fileUrl || '');
      var t = x.rows.filter(function (r) { return r.cardId === cardId || (url && r.fileUrl === url); })[0];
      if (!t) return { success: false, error: 'Menu card not found' };
      x.sh.deleteRow(t.row);
      bnxMcClearPublicCache_(t.clientId);
      return { success: true };
    } finally { lock.releaseLock(); }
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ============================================================
   QR PROMO — WELCOME VIDEO + EVENTS   (sheets in <clientId>_MASTER_DB)
   ============================================================ */
function bnxQrpSheet_(clientId, name, head) {
  var sh = bnxCrmSheet_(name, head, clientId);
  if (name === QRP_EVENTS_SHEET) {                               /* keep date / time as typed text (once per 6 h) */
    var cache = CacheService.getScriptCache(), fk = 'qrpfmt_' + clientId;
    if (!cache.get(fk)) {
      var C = bnxCrmCols_(sh);
      ['EVENT_DATE', 'START_TIME'].forEach(function (h) { if (C[h]) sh.getRange(2, C[h], Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
      cache.put(fk, '1', 21600);
    }
  }
  return sh;
}
function bnxQrpCellDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, QRP_TZ, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);           /* 10/10/2026 → 2026-10-10 */
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s.slice(0, 10);
}
function bnxQrpCellTime_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, QRP_TZ, 'h:mm a');
  return String(v == null ? '' : v).trim();
}
function bnxQrpRowObj_(r, C) {
  var o = {}; Object.keys(C).forEach(function (k) { o[k] = r[C[k] - 1]; }); return o;
}
/* write a whole row by header name into row index (existing or new) */
function bnxQrpWrite_(sh, rowIdx, obj) {
  var C = bnxCrmCols_(sh), w = Math.max(sh.getLastColumn(), 1);
  var cur = rowIdx <= sh.getLastRow() ? sh.getRange(rowIdx, 1, 1, w).getValues()[0] : [];
  while (cur.length < w) cur.push('');
  Object.keys(obj).forEach(function (k) { if (C[k]) cur[C[k] - 1] = obj[k]; });
  sh.getRange(rowIdx, 1, 1, w).setValues([cur]);
}

function bnxQrpVideo_(clientId) {
  var sh = bnxQrpSheet_(clientId, QRP_SETTINGS_SHEET, QRP_SETTINGS_HEAD), C = bnxCrmCols_(sh);
  var out = { videoUrl: '', fileId: '', name: '', active: false, updatedAt: '', row: 0 };
  var n = sh.getLastRow() - 1; if (n < 1) return out;
  var v = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    var o = bnxQrpRowObj_(v[i], C);
    if (String(o.CLIENT_ID || '') !== clientId) continue;
    out.fileId = String(o.VIDEO_FILE_ID || '') || bnxMcId_(o.VIDEO_URL);
    out.videoUrl = String(o.VIDEO_URL || '').trim() || bnxDriveViewUrl_(out.fileId);
    out.name = String(o.VIDEO_NAME || '');
    out.active = bnxMcBool_(o.VIDEO_ACTIVE, false) && !!out.videoUrl;
    out.updatedAt = o.UPDATED_AT instanceof Date ? Utilities.formatDate(o.UPDATED_AT, QRP_TZ, 'yyyy-MM-dd HH:mm') : String(o.UPDATED_AT || '');
    out.row = i + 2;
    break;
  }
  return out;
}

function bnxQrpEvents_(clientId, publicOnly) {
  var sh = bnxQrpSheet_(clientId, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD), C = bnxCrmCols_(sh);
  var n = sh.getLastRow() - 1, list = [], today = bnxQrpBusinessDay_();
  if (n < 1) return list;
  sh.getRange(2, 1, n, sh.getLastColumn()).getValues().forEach(function (r, i) {
    var o = bnxQrpRowObj_(r, C);
    if (String(o.CLIENT_ID || '') !== clientId) return;
    var active = bnxMcBool_(o.ACTIVE, true), date = bnxQrpCellDate_(o.EVENT_DATE);
    if (publicOnly && (!active || !date || date < today)) return;
    var pid = String(o.POSTER_FILE_ID || '') || bnxMcId_(o.POSTER_URL), purl = String(o.POSTER_URL || '').trim();
    list.push({
      id: String(o.EVENT_ID || ''), title: String(o.TITLE || ''), date: date, time: bnxQrpCellTime_(o.START_TIME),
      venue: String(o.VENUE || ''), description: String(o.DESCRIPTION || ''),
      posterUrl: purl || bnxDriveViewUrl_(pid), posterFileId: pid,
      posterImg: pid ? bnxDriveImg_(pid) : purl, posterThumb: pid ? bnxDriveThumb_(pid) : purl,
      active: active, past: !!date && date < today, row: i + 2
    });
  });
  list.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)); });
  return list;
}

/* what the customer page receives (inside PUBLIC_MENU → data.promo) */
function bnxQrpPublic_(clientId) {
  clientId = String(clientId || '').trim();
  var v = bnxQrpVideo_(clientId);
  var ev = bnxQrpEvents_(clientId, true).map(function (e) { delete e.row; delete e.past; return e; });
  return { video: { videoUrl: v.active ? v.videoUrl : '', fileId: v.active ? v.fileId : '', name: v.name, active: v.active }, events: ev };
}

/* QR_PROMO_GET — admin: video + every event (incl. past / hidden) */
function bnxQrpGet_(req) {
  try {
    var cid = bnxMcCid_(req), v = bnxQrpVideo_(cid); delete v.row;
    var ev = bnxQrpEvents_(cid, false).map(function (e) { delete e.row; return e; });
    return { success: true, data: { video: v, events: ev, businessDay: bnxQrpBusinessDay_() } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* QR_PROMO_SAVE_VIDEO  { videoUrl | fileId | videoDataUrl(≤12 MB), name, active } */
function bnxQrpSaveVideo_(req) {
  try {
    req = req || {};
    var cid = bnxMcCid_(req), url = String(req.videoUrl || '').trim(), fid = String(req.fileId || '').trim(), warn = String(req.warn || '');
    if (req.videoDataUrl) {
      var f = bnxQrpFolder_(cid).createFile(bnxMcDataUrlBlob_(req.videoDataUrl, req.fileName || ('welcome-' + Date.now() + '.mp4'), 12 * 1024 * 1024));
      warn = bnxMcShare_(f); fid = f.getId();
    }
    if (fid) { url = bnxDriveViewUrl_(fid); }
    else if (url) { fid = bnxMcId_(url); if (fid && /drive\.google\.com/i.test(url)) { try { warn = bnxMcShare_(DriveApp.getFileById(fid)); } catch (e) {} } }
    if (!url) return { success: false, error: 'Choose a video or paste a video link' };
    if (!/^https:\/\//i.test(url)) return { success: false, error: 'Video link must start with https://' };
    var active = bnxMcBool_(req.active, true), name = String(req.name || 'Welcome Video').slice(0, 120);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = bnxQrpSheet_(cid, QRP_SETTINGS_SHEET, QRP_SETTINGS_HEAD), cur = bnxQrpVideo_(cid);
      var row = cur.row || (sh.getLastRow() + 1);
      bnxQrpWrite_(sh, row, { CLIENT_ID: cid, VIDEO_URL: url, VIDEO_FILE_ID: fid, VIDEO_NAME: name, VIDEO_ACTIVE: active ? 'YES' : 'NO', UPDATED_AT: new Date() });
      /* REPLACE (2026-10-08): the previous video file goes to Drive Bin (restorable for 30 days) — only a file this
         system uploaded into CLIENT_DATABASES/<client>/QR_PROMO, never someone's own Drive file or an outside link */
      var replaced = '';
      if (cur.fileId && cur.fileId !== fid) replaced = bnxQrpTrashOwn_(cid, cur.fileId);
    } finally { lock.releaseLock(); }
    bnxMcClearPublicCache_(cid);
    return { success: true, data: { videoUrl: url, fileId: fid, name: name, active: active, clientId: cid, warn: warn, replaced: replaced } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

function bnxQrpTrashOwn_(cid, fileId) {
  try {
    var f = DriveApp.getFileById(fileId), folder = bnxQrpFolder_(cid), ps = f.getParents(), inside = false;
    while (ps.hasNext()) if (ps.next().getId() === folder.getId()) inside = true;
    if (!inside) return '';
    var n = f.getName(); f.setTrashed(true); return n;
  } catch (e) { return ''; }
}
function bnxQrpDeleteVideo_(req) {
  try {
    var cid = bnxMcCid_(req);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var cur = bnxQrpVideo_(cid);
      if (cur.fileId) bnxQrpTrashOwn_(cid, cur.fileId);
      if (cur.row) bnxQrpWrite_(bnxQrpSheet_(cid, QRP_SETTINGS_SHEET, QRP_SETTINGS_HEAD), cur.row,
        { VIDEO_URL: '', VIDEO_FILE_ID: '', VIDEO_NAME: '', VIDEO_ACTIVE: 'NO', UPDATED_AT: new Date() });
    } finally { lock.releaseLock(); }
    bnxMcClearPublicCache_(cid);
    return { success: true };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* QR_PROMO_SAVE_EVENT  { event:{ id?, title, date(yyyy-MM-dd), time, venue, description,
                                 posterFileId? | posterUrl? | posterDataUrl?, active } }  — insert or update one */
function bnxQrpSaveEvent_(req) {
  try {
    req = req || {};
    var cid = bnxMcCid_(req), e = req.event || req, warn = '';
    var title = String(e.title || '').trim().slice(0, 120), date = bnxQrpCellDate_(e.date);
    if (!title) return { success: false, error: 'Event name is required' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Event date is required (YYYY-MM-DD)' };
    var pid = String(e.posterFileId || '').trim(), purl = String(e.posterUrl || '').trim();
    if (e.posterDataUrl) {
      var pf = bnxQrpFolder_(cid).createFile(bnxMcDataUrlBlob_(e.posterDataUrl, e.posterFileName || ('event-' + Date.now() + '.jpg'), 10 * 1024 * 1024));
      warn = bnxMcShare_(pf); pid = pf.getId();
    }
    if (pid) purl = bnxDriveViewUrl_(pid);
    else if (purl) { pid = bnxMcId_(purl); if (pid && /drive\.google\.com/i.test(purl)) { try { warn = bnxMcShare_(DriveApp.getFileById(pid)); } catch (x) {} } }
    if (purl && !/^https:\/\//i.test(purl)) return { success: false, error: 'Poster link must start with https://' };

    var id = String(e.id || '').trim();
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD);
      var old = id ? bnxQrpEvents_(cid, false).filter(function (x) { return x.id === id; })[0] : null;
      if (!id) id = 'EV' + Utilities.formatDate(new Date(), QRP_TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
      if (old && !e.posterDataUrl && !e.posterFileId && !e.posterUrl && e.keepPoster !== false) { pid = old.posterFileId; purl = old.posterUrl; }
      var row = old ? old.row : sh.getLastRow() + 1;
      bnxQrpWrite_(sh, row, {
        EVENT_ID: id, CLIENT_ID: cid, TITLE: title, EVENT_DATE: date, START_TIME: String(e.time || '').slice(0, 60),
        VENUE: String(e.venue || '').slice(0, 160), DESCRIPTION: String(e.description || '').slice(0, 500),
        POSTER_URL: purl, POSTER_FILE_ID: pid, ACTIVE: bnxMcBool_(e.active, true) ? 'YES' : 'NO', UPDATED_AT: new Date()
      });
    } finally { lock.releaseLock(); }
    bnxMcClearPublicCache_(cid);
    var saved = bnxQrpEvents_(cid, false).filter(function (x) { return x.id === id; })[0] || { id: id };
    delete saved.row; saved.warn = warn;
    return { success: true, data: saved };
  } catch (x) { return { success: false, error: String(x && x.message || x) }; }
}

function bnxQrpDeleteEvent_(req) {
  try {
    var cid = bnxMcCid_(req), id = String(req.id || req.eventId || '').trim();
    if (!id) return { success: false, error: 'Event id required' };
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var ev = bnxQrpEvents_(cid, false).filter(function (x) { return x.id === id; })[0];
      if (!ev) return { success: false, error: 'Event not found' };
      bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD).deleteRow(ev.row);
    } finally { lock.releaseLock(); }
    bnxMcClearPublicCache_(cid);
    return { success: true };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* QR_PROMO_SAVE_EVENTS — bulk replace (kept for older callers) */
function bnxQrpSaveEvents_(req) {
  try {
    var cid = bnxMcCid_(req), list = Array.isArray(req.events) ? req.events.slice(0, 100) : [];
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD);
      bnxQrpEvents_(cid, false).map(function (x) { return x.row; }).sort(function (a, b) { return b - a; })
        .forEach(function (r) { sh.deleteRow(r); });
    } finally { lock.releaseLock(); }
    list.forEach(function (e) { if (e && e.title && e.date) bnxQrpSaveEvent_({ clientId: cid, event: e }); });
    bnxMcClearPublicCache_(cid);
    return { success: true, data: { events: bnxQrpPublic_(cid).events } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ============================================================
   CHUNKED UPLOAD → DRIVE (videos up to 100 MB, posters, anything)
   INIT  { fileName, mime, size }                 → { uploadId, chunkSize }
   CHUNK { uploadId, offset, data(base64 piece) } → { done:false, next }  |  { done:true, fileId, fileUrl, warn }
   CHUNK { uploadId, status:true }                → same shape; asks Drive how much it already has (resume after a timeout)
   Each piece goes from Apps Script to a Drive resumable session, so no browser CORS is involved.
   ============================================================ */
function bnxQrpHeader_(res, name) {
  var h = res.getAllHeaders(), want = name.toLowerCase();
  for (var k in h) if (k.toLowerCase() === want) return Array.isArray(h[k]) ? h[k][0] : h[k];
  return '';
}
function bnxQrpUploadInit_(req) {
  try {
    var cid = bnxMcCid_(req), size = Number(req.size || 0), mime = String(req.mime || 'application/octet-stream');
    if (!(size > 0)) return { success: false, error: 'File size missing' };
    if (size > QRP_MAX_FILE) return { success: false, error: 'File is ' + (size / 1048576).toFixed(1) + ' MB — limit 100 MB' };
    if (!/^(video|image)\//i.test(mime) && mime !== 'application/pdf') return { success: false, error: 'Only video, image or PDF files' };
    var name = String(req.fileName || ('promo-' + Date.now())).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
    var folder = bnxQrpFolder_(cid);
    var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {
      method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) },
      payload: JSON.stringify({ name: name, parents: [folder.getId()], mimeType: mime })
    });
    var uri = bnxQrpHeader_(res, 'Location');
    if (res.getResponseCode() !== 200 || !uri) return { success: false, error: 'Drive refused the upload (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200) };
    var uploadId = Utilities.getUuid();
    CacheService.getScriptCache().put('qrup_' + uploadId, JSON.stringify({ uri: uri, size: size, mime: mime, cid: cid }), 21600);
    return { success: true, data: { uploadId: uploadId, chunkSize: QRP_CHUNK } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxQrpUploadChunk_(req) {
  try {
    var cid = bnxMcCid_(req), raw = CacheService.getScriptCache().get('qrup_' + String(req.uploadId || ''));
    if (!raw) return { success: false, error: 'Upload session expired — start again' };
    var s = JSON.parse(raw);
    if (s.cid !== cid) return { success: false, error: 'Upload belongs to another client' };
    if (req.status) {                                            /* where did Drive stop? (after a timeout) */
      var q = UrlFetchApp.fetch(s.uri, { method: 'put', payload: '', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes */' + s.size } });
      var qc = q.getResponseCode();
      if (qc === 200 || qc === 201) {
        var qj = JSON.parse(q.getContentText() || '{}');
        CacheService.getScriptCache().remove('qrup_' + req.uploadId);
        return { success: true, data: { done: true, fileId: qj.id, fileUrl: bnxDriveViewUrl_(qj.id), imgUrl: bnxDriveImg_(qj.id), warn: bnxMcShare_(DriveApp.getFileById(qj.id)) } };
      }
      var qm = String(bnxQrpHeader_(q, 'Range')).match(/-(\d+)$/);
      return { success: true, data: { done: false, next: qm ? Number(qm[1]) + 1 : 0 } };
    }
    var offset = Number(req.offset || 0), bytes = Utilities.base64Decode(String(req.data || ''));
    if (!bytes.length) return { success: false, error: 'Empty chunk' };
    var end = offset + bytes.length - 1;
    if (end >= s.size) return { success: false, error: 'Chunk goes past the end of the file' };
    var res = UrlFetchApp.fetch(s.uri, {
      method: 'put', payload: bytes, contentType: s.mime, muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + offset + '-' + end + '/' + s.size }
    });
    var code = res.getResponseCode();
    if (code === 308) {
      var rg = bnxQrpHeader_(res, 'Range'), m = String(rg).match(/-(\d+)$/);
      return { success: true, data: { done: false, next: m ? Number(m[1]) + 1 : 0 } };
    }
    if (code === 200 || code === 201) {
      var j = JSON.parse(res.getContentText() || '{}');
      if (!j.id) return { success: false, error: 'Drive did not return a file id' };
      CacheService.getScriptCache().remove('qrup_' + req.uploadId);
      var warn = bnxMcShare_(DriveApp.getFileById(j.id));
      return { success: true, data: { done: true, fileId: j.id, fileUrl: bnxDriveViewUrl_(j.id), imgUrl: bnxDriveImg_(j.id), warn: warn } };
    }
    return { success: false, error: 'Drive chunk failed (' + code + '): ' + res.getContentText().slice(0, 200) };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* run once from the editor: grants Drive + external-request permission used by the chunked upload */
function bnxQrpAuthorize() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  Logger.log('OK — QR promo folder for CL00010: ' + bnxQrpFolder_('CL00010').getUrl());
  Logger.log(JSON.stringify(bnxQrpPublic_('CL00010')));
}

/* ============================================================
   PUBLIC CUSTOMER MENU  (GET ?action=PUBLIC_MENU&clientId=…, no session)
   ============================================================ */
function bnxPublicMenuOut_(clientId) {
  var out;
  try { out = { success: true, data: bnxPublicMenu_(String(clientId || '').trim()) }; }
  catch (e) { out = { success: false, error: String(e && e.message || e) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function bnxPubRows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues();
  var H = v[0].map(function (h) { return String(h).trim().toUpperCase(); });
  return v.slice(1).map(function (r) { var o = {}; H.forEach(function (h, i) { if (h) o[h] = r[i]; }); return o; });
}
function bnxPubBool_(x, dflt) {
  var s = String(x == null ? '' : x).trim().toUpperCase();
  if (!s) return dflt;
  return !(s === 'FALSE' || s === 'NO' || s === '0' || s === 'N');
}
function bnxPubAvail_(x) {
  var s = String(x == null ? '' : x).trim().toLowerCase();
  return !(s === 'unavailable' || s === 'out of stock' || s === 'inactive' || s === 'no');
}
function bnxPubImg_(u) {
  u = String(u || '').trim();
  return /^(https:\/\/|data:image\/)/i.test(u) ? u : '';
}

function bnxPublicMenu_(cid) {
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) throw new Error('Invalid client id');
  var cache = CacheService.getScriptCache(), ck = 'pubmenu_' + cid, hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  var ss = bnxCrmSpreadsheet_(cid, 'MASTER');
  var mine = function (r) { return !r.CLIENT_ID || String(r.CLIENT_ID) === cid; };

  var food = bnxPubRows_(ss, 'MENU_CARD_ITEMS').filter(mine).filter(function (r) {
    return r.MENU_ITEM_NAME && Number(r.PRICE) > 0 && bnxPubAvail_(r.AVAILABILITY_STATUS);
  }).map(function (r) {
    return {
      id: r.ITEM_ID || r.ITEM_CODE || r.MENU_ITEM_NAME, name: String(r.MENU_ITEM_NAME).trim(),
      category: r.MENU_SECTION || r.ITEM_GROUP_NAME || 'Menu', price: Number(r.PRICE),
      veg: String(r.VEG_TYPE || '').toUpperCase() === 'E' ? 'NV' : String(r.VEG_TYPE || '').toUpperCase(),
      popular: bnxPubBool_(r.POPULAR, false) || bnxPubBool_(r.FAVOURITE, false), avail: true,
      imageUrl: bnxPubImg_(r.PRODUCT_IMAGE_URL), categoryId: r.CATEGORY_ID || ''
    };
  });

  var bar = bnxPubRows_(ss, 'BAR_MENU_CARD').filter(mine).filter(function (r) {
    return r.ITEM_NAME && Number(r.SERVING_PRICE) > 0 && bnxPubBool_(r.IS_ACTIVE, true) && bnxPubAvail_(r.AVAILABILITY_STATUS);
  }).map(function (r) {
    return {
      id: r.ITEM_ID || r.ITEM_NAME, name: String(r.ITEM_NAME).trim(), category: r.CATEGORY_NAME || r.MENU_SECTION || 'Bar',
      price: Number(r.SERVING_PRICE), veg: '', popular: bnxPubBool_(r.POPULAR, false) || bnxPubBool_(r.FAVOURITE, false),
      avail: true, imageUrl: bnxPubImg_(r.PRODUCT_IMAGE_URL), categoryId: r.CATEGORY_ID || ''
    };
  });

  var cs = bnxPubRows_(ss, 'CLIENT_SETTINGS').filter(mine)[0] || {};
  var co = bnxPubRows_(ss, 'COMPANY_SETTINGS').filter(mine).filter(function (r) { return r.COMPANY_NAME; })[0] || {};
  var info = {
    name: String(co.COMPANY_NAME || cs.RESTAURANT_NAME || '').trim(),
    logoUrl: String(co.LOGO_URL || cs.CLIENT_LOGO_URL || cs.INVOICE_LOGO_URL || '').trim(),
    phone: String(cs.RESTAURANT_PHONE || '').replace(/\.0$/, ''),
    whatsapp: String(cs.WHATSAPP_NUMBER || cs.RESTAURANT_WHATSAPP || cs.RESTAURANT_PHONE || '').replace(/\.0$/, '').replace(/\D/g, '').slice(-10),
    address: String(cs.RESTAURANT_ADDRESS || '')
  };
  if (cs.CUSTOMER_ORDER_ENABLED !== undefined && cs.CUSTOMER_ORDER_ENABLED !== '') info.customerOrderEnabled = bnxPubBool_(cs.CUSTOMER_ORDER_ENABLED, false);
  if (cs.CUSTOMER_CALL_ENABLED !== undefined && cs.CUSTOMER_CALL_ENABLED !== '') info.customerCallEnabled = bnxPubBool_(cs.CUSTOMER_CALL_ENABLED, false);

  var cards = [];
  try { cards = bnxMcActiveCards_(cid); } catch (e) { console.log('Menu card lookup: ' + e.message); }
  var card = cards.length ? Object.assign({}, cards[0], { cards: cards }) : null;

  var promo = { video: { videoUrl: '', active: false }, events: [] };
  try { promo = bnxQrpPublic_(cid); } catch (e) { console.log('QR promo lookup: ' + e.message); }

  var data = { food: food, bar: bar, info: info, card: card, cards: cards, promo: promo };
  try { cache.put(ck, JSON.stringify(data), 30); } catch (e) {}   /* every save/activate/delete clears it at once */
  return data;
}

/* DOGET — PUBLIC ROUTE FIRST */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'PUBLIC_MENU') return bnxPublicMenuOut_(e.parameter.clientId);
    /* Open  <exec URL>?action=BNX_WHOAMI  in a browser: shows which project / code this deployment really runs. */
    if (e && e.parameter && e.parameter.action === 'BNX_WHOAMI') {
      var G = (typeof globalThis !== 'undefined') ? globalThis : this;
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: {
        scriptId: ScriptApp.getScriptId(), menuCardQrPromo: '2026-10-08', qrPromo: true,
        approvals: typeof bnxApprovalRoute_ === 'function', guestCheckin: typeof bnxGuestCheckinPublic_ === 'function',
        doPostWired: !!(G.doPost && G.doPost.__bnxMp) } })).setMimeType(ContentService.MimeType.JSON);
    }
    /* QR guest: mobile + name → GUEST_CRM (+ welcome WhatsApp/SMS). No login on the QR page, so it is a public,
       rate-limited GET like PUBLIC_MENU (see bnxGuestCheckinPublic_ in guest-crm-welcome.gs). */
    if (e && e.parameter && e.parameter.action === 'GUEST_CHECKIN') {
      var gr = (typeof bnxGuestCheckinPublic_ === 'function') ? bnxGuestCheckinPublic_(e.parameter)
             : { success: false, error: 'guest-crm-welcome.gs is not installed' };
      return ContentService.createTextOutput(JSON.stringify(gr)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Balaji NextGen ERP API' })).setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   SELF-WIRING (2026-10-08) — fixes "Unknown action: QR_PROMO_UPLOAD_INIT"
   The main doPost lives in another file and answered the new actions with its default "Unknown action".
   This block wraps the live doPost: menu-card / QR-promo actions are answered here, everything else goes
   to the original doPost untouched. Apps Script runs files top to bottom, so this file must be LAST
   (the doPost it wraps must already be defined). bnxMenuPromoCheck() tells you if it is wired.
   ============================================================ */
var BNX_MP_ACTIONS = /^(QR_PROMO_[A-Z_]+|APPROVAL_[A-Z_]+|SAVE_MENU_CARD_LINK|SAVE_MENU_CARD_UPLOAD|GET_MENU_CARDS|GET_ACTIVE_MENU_CARD|ACTIVATE_MENU_CARD|DELETE_MENU_CARD)$/;
function bnxMpJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* same rule the suite's session check uses: client id + a session token in the issued (UUID) shape */
function bnxMpAuth_(req) {
  var cid = String(req.clientId || '').trim(), tok = String(req.sessionToken || '').trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return { success: false, error: 'Client ID required' };
  if (/^\{/.test(tok)) { try { var o = JSON.parse(tok); tok = String(o.sessionToken || o.SESSION_TOKEN || o.token || '').trim(); } catch (e) {} }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tok)) return { success: false, error: 'Invalid or expired session — please log in again' };
  return null;
}
function bnxMpHandle_(e) {
  var body = {};
  try { body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : ((e && e.parameter) || {}); } catch (x) { return null; }
  var action = String(body.action || '');
  /* NC / credit / discount bills: refused here unless approved (bill-approvals.gs); everything else passes through */
  if (action === 'SAVE_BILL' && typeof bnxApprovalCheckSaveBill_ === 'function') {
    var gate = bnxApprovalCheckSaveBill_(body);
    return gate ? bnxMpJson_(gate) : null;
  }
  if (!BNX_MP_ACTIONS.test(action)) return null;
  var bad = bnxMpAuth_(body);
  if (bad) return bnxMpJson_(bad);
  var out;
  try { out = bnxMenuPromoRoute_(action, body) || { success: false, error: 'Not handled: ' + action }; }
  catch (err) { out = { success: false, error: String(err && err.message || err) }; }
  return bnxMpJson_(out);
}
(function () {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var prev = G.doPost;
  if (typeof prev !== 'function' || prev.__bnxMp) return;
  var wrapped = function (e) {
    var r = bnxMpHandle_(e);
    return r ? r : prev.apply(this, arguments);
  };
  wrapped.__bnxMp = true;
  try { G.doPost = wrapped; } catch (x) {}
  try { doPost = wrapped; } catch (x) {}
})();

/* Run from the editor after saving: proves the live doPost answers QR_PROMO_* for CL00010. */
function bnxMenuPromoCheck() {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  if (typeof G.doPost !== 'function') { Logger.log('❌ No doPost found in the project.'); return; }
  if (!G.doPost.__bnxMp) { Logger.log('❌ NOT WIRED — move this file to the BOTTOM of the file list (⋮ → Move file down), save, run again.'); return; }
  var fake = { postData: { contents: JSON.stringify({ action: 'QR_PROMO_GET', clientId: 'CL00010', sessionToken: '00000000-0000-4000-8000-000000000000' }) } };
  var txt = G.doPost(fake).getContent();
  var j = {}; try { j = JSON.parse(txt); } catch (e) {}
  Logger.log(j.success ? '✅ ROUTING OK — QR_PROMO_GET answered: ' + txt.slice(0, 300) + '\nNow: Deploy > Manage deployments > Edit > NEW VERSION > Deploy.'
                       : '⚠️ Wired, but the action failed: ' + txt.slice(0, 300));
}

/* Run from the editor: prints the start of the doPost that is really live, so you can find its file.
   Paste the 2 lines it prints as the FIRST lines inside that doPost (after its JSON body is parsed). */
function bnxFindDoPost() {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var f = G.doPost && G.doPost.__bnxMp ? null : G.doPost;
  Logger.log(G.doPost && G.doPost.__bnxMp
    ? 'doPost is wrapped by menu-card-qr-promo.gs (editor run). If the web app still says "Unknown action", the wrapper is not used by the live deployment — add the line below to the real doPost and deploy a NEW VERSION.'
    : 'Live doPost source starts with:\n' + String(f).slice(0, 400));
  Logger.log('ADD AS FIRST LINES INSIDE doPost (use the variable that holds the parsed body, e.g. req / body / data):\n' +
    '  var __mp = bnxMpHandle_(e);\n  if (__mp) return __mp;');
}


/* ============================================================
   DRIVE CHECK / TIDY (run from the editor)
   bnxDriveWhere('CL00010')  → logs the exact folders uploads go to
   bnxDriveTidy('CL00010')   → moves every file this client already uses (menu cards, welcome video,
                                event posters) into CLIENT_DATABASES/<client>/MENU_CARDS | QR_PROMO
   ============================================================ */
function bnxDriveWhere(clientId) {
  clientId = clientId || 'CL00010';
  var root = bnxMcRootFolder_();
  Logger.log('ROOT       ' + root.getName() + '  ' + root.getUrl());
  Logger.log('MENU_CARDS ' + bnxMcFolder_(clientId).getUrl());
  Logger.log('QR_PROMO   ' + bnxQrpFolder_(clientId).getUrl());
}
function bnxDriveTidy(clientId) {
  clientId = clientId || 'CL00010';
  var mcF = bnxMcFolder_(clientId), qpF = bnxQrpFolder_(clientId), moved = 0, skipped = [];
  function put(id, folder, what) {
    if (!id) return;
    try {
      var f = DriveApp.getFileById(id), ps = f.getParents();
      while (ps.hasNext()) if (ps.next().getId() === folder.getId()) return;
      f.moveTo(folder); moved++; Logger.log('moved  ' + what + '  ' + f.getName());
    } catch (e) { skipped.push(what + ' ' + id + ' (' + e.message + ')'); }
  }
  bnxMcRows_({ clientId: clientId }).rows.forEach(function (r) { put(r.fileId || bnxMcId_(r.fileUrl), mcF, 'menu card'); });
  var v = bnxQrpVideo_(clientId); put(v.fileId, qpF, 'welcome video');
  bnxQrpEvents_(clientId, false).forEach(function (e) { put(e.posterFileId, qpF, 'poster ' + e.title); });
  Logger.log('Done — ' + moved + ' file(s) moved.' + (skipped.length ? '  Not moved (owned by someone else or deleted): ' + skipped.join(' | ') : ''));
  bnxDriveWhere(clientId);
}
