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
 * ROOT CAUSES FIXED (2026-10-09)
 *  9. "Could not save event: Lock timeout" — every save took the ONE script-wide LockService lock that guest
 *     check-ins, scan logs and the ERP router also hold. Now a short per-client lock (bnxSoftLock_) — never blocked by them.
 * 10. Event video had no column: an uploaded event video was only kept as "[[video:URL]]" inside DESCRIPTION
 *     (500-char cut). QR_EVENTS now has VIDEO_URL + VIDEO_FILE_ID (added automatically); old rows still read.
 * 11. Year typo (2006-10-10) saved silently → event never shown. Dates outside last year … +2 years are refused.
 * 12. Menu card type COCKTAIL (Food → Bar → Cocktail PDF on the QR page). Before, COCKTAIL became FOOD.
 * 13. New rows use appendRow (atomic) and UPDATED_AT is Indian time.
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
var QRP_EVENTS_HEAD    = ['EVENT_ID','CLIENT_ID','TITLE','EVENT_DATE','START_TIME','VENUE','DESCRIPTION','POSTER_URL','ACTIVE','UPDATED_AT','POSTER_FILE_ID','VIDEO_URL','VIDEO_FILE_ID'];
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
    case 'GET_CLIENT_ASSETS':      /* logo / banner / UPI QR / item photos (BNX_ClientAssets.gs) */
    case 'SAVE_CLIENT_ASSETS':     return (typeof bnxCA_handle_ === 'function') ? bnxCA_handle_(String(action), req) : { success: false, error: 'BNX_ClientAssets.gs is not in this Apps Script project — add the file' };
    case 'SAVE_MENU_ITEM_IMAGE':   return bnxMiImage_(req);
    case 'MENU_ITEM_ENSURE':       return (function () { try { var en = bnxMiEnsure_(req); return en.found ? { success: true, data: en }
                                     : { success: false, data: en, error: 'Item ' + (en.ids || []).join(' / ') + ' not found in MENU_CARD_ITEMS, BAR_MENU_CARD or ITEM_MASTER' }; }
                                     catch (e) { return { success: false, error: String(e && e.message || e) }; } })();
    case 'PRINT_QUEUE_ADD':        return bnxPqAdd_(req);
    case 'PRINT_QUEUE_CLAIM':      return bnxPqClaim_(req);
    case 'PRINT_QUEUE_DONE':       return bnxPqDone_(req);
    case 'PRINT_QUEUE_STATUS':     return bnxPqStatus_(req);
    case 'PRINTER_MASTER_GET':     return bnxPmGet_(req);
    case 'PRINTER_MASTER_SAVE':    return bnxPmSave_(req);
    case 'STEWARD_CONTROL_GET':    return bnxStwGet_(req);
    case 'STEWARD_CONTROL_SAVE':   return bnxStwSave_(req);
    case 'TALLY_SALES_DATA':       return bnxTlData_(req);
    case 'TALLY_MARK_POSTED':      return bnxTlMark_(req);
    case 'TALLY_CFG_GET':          return bnxTlCfg_(req, false);
    case 'TALLY_CFG_SAVE':         return bnxTlCfg_(req, true);
    case 'CASHBOOK_DAYWISE':       return bnxCbDays_(req);
    case 'CASHBOOK_DAY_DETAIL':    return bnxCbDetail_(req);
    case 'CASHBOOK_CFG_GET':       return bnxCbCfg_(req, false);
    case 'CASHBOOK_CFG_SAVE':      return bnxCbCfg_(req, true);
    case 'DSR_ITEM_GROUP':         return bnxDsrGroups_(req);
    case 'PETTY_META_SAVE':        return bnxPcMetaSave_(req);
    case 'PETTY_META_GET':         return bnxPcMetaGet_(req);
    case 'GUEST_CTL_GET':          return bnxGcGet_(req);
    case 'GUEST_CTL_SAVE':         return bnxGcSave_(req);
    case 'WA_SETUP_GET':           return bnxWaSetup_(req, false);
    case 'WA_SETUP_SAVE':          return bnxWaSetup_(req, true);
    case 'WA_TEST':                return bnxWaTest_(req);
    case 'DASH_FIN':               return bnxMpDashFin_(req);
    case 'DUES_LIST':              return bnxDuesList_(req);
    case 'POS_IMPORT':             return bnxPosImport_(req);
    case 'BAR_TDB':                return bnxBarTdb_(req);
    case 'KITCHEN_TDB':            return bnxMpKitchenTdb_(req);
    case 'DSR_TDB':                return bnxDsrTdb_(req);
    case 'BILL_PAYMENTS':          return bnxBillPays_(req);
  }
  if (/^APPROVAL_/.test(String(action || '')) && typeof bnxApprovalRoute_ === 'function') return bnxApprovalRoute_(String(action), req);   /* bill-approvals.gs */
  return null;
}

/* ============================================================
   SOFT LOCK (2026-10-09) — ROOT FIX "Could not save event: Lock timeout: another process was holding the lock
   for too long". Every save here used LockService.getScriptLock() = ONE lock for the WHOLE script project, shared
   with every guest check-in, scan log, order hook and the main ERP router. A busy party night (or the dashboard's
   own polling) keeps that lock busy, so an event / video / menu-card save waited 20 s and failed.
   Now each client + area gets its own short lock in CacheService: two saves of the SAME client's promo still queue,
   nothing else ever blocks them, and after waitMs the save goes ahead instead of failing.
   ============================================================ */
function bnxSoftLock_(key, waitMs) {
  var c = CacheService.getScriptCache(), k = 'slk_' + String(key || 'x').slice(0, 200), me = Utilities.getUuid();
  var end = Date.now() + (waitMs || 10000), got = false;
  while (Date.now() < end) {
    try {
      if (!c.get(k)) { c.put(k, me, 30); Utilities.sleep(70); if (c.get(k) === me) { got = true; break; } }
    } catch (e) { break; }                                   /* cache down → never block the save */
    Utilities.sleep(120 + Math.floor(Math.random() * 180));
  }
  return { got: got, release: function () { try { if (c.get(k) === me) c.remove(k); } catch (e) {} } };
}
/* IST wall-clock "now" for sheet cells (uses the CRM file's helpers when present) */
function bnxMpNowFor_(sh) {
  try { if (typeof bnxNow_ === 'function' && typeof bnxCrmW_ === 'function') return bnxCrmW_(sh, bnxNow_()); } catch (e) {}
  return new Date();
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
  if (t === 'COCKTAILS' || t === 'COCKTAIL_MENU') t = 'COCKTAIL';
  /* 2026-10-09: COCKTAIL added — before, "COCKTAIL" fell through to FOOD, so a cocktail PDF switched the food PDF off */
  return (t === 'BAR' || t === 'COCKTAIL' || t === 'OTHER' || t === 'VIDEO' || t === 'EVENT') ? t : 'FOOD';
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
/* existing child folder by name, case-insensitive (CL00010 / cl00010, MENU_CARDS / Menu_Cards); the oldest wins so a
   stray duplicate never takes over; created only when none exists */
function bnxMcChild_(parent, name) {
  var want = String(name).trim().toLowerCase(), it = parent.getFolders(), best = null;
  while (it.hasNext()) { var f = it.next(); if (f.isTrashed && f.isTrashed()) continue;
    if (String(f.getName()).trim().toLowerCase() === want && (!best || f.getDateCreated() < best.getDateCreated())) best = f; }
  return best || parent.createFolder(name);
}
/* CLIENT_DATABASES / <clientId> / sub[/sub2…]  — e.g. 'MENU_CARDS', 'QR_PROMO', 'assets/item-images' */
function bnxMcSubFolder_(clientId, sub) {
  clientId = String(clientId || '').trim();
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(clientId)) throw new Error('Invalid client id');
  var f = bnxMcChild_(bnxMcRootFolder_(), clientId);
  String(sub || '').split('/').filter(String).forEach(function (part) { f = bnxMcChild_(f, part); });
  return f;
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
  var type = bnxMcType_(o.type), id = String(o.cardId || ('MC' + Utilities.formatDate(new Date(), QRP_TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100)));   /* + random: two saves in one second overwrote each other */
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var d = bnxMcUpsert_(clientId, { cardId: req.cardId, name: name, link: link, fid: fid, active: bnxMcBool_(req.active, true), type: type });
      d.warn = warn;
      return { success: true, data: d };
    } finally { lock.release(); }
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var d = bnxMcUpsert_(clientId, { cardId: req.cardId, name: name, link: link, fid: fid, active: bnxMcBool_(req.active, true), type: type });
      d.warn = warn;
      return { success: true, data: d };
    } finally { lock.release(); }
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
  return ['FOOD', 'BAR', 'COCKTAIL', 'OTHER'].filter(function (t) { return pick[t]; }).map(function (t) { return bnxMcPublicCard_(pick[t]); });
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
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
    } finally { lock.release(); }
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

function bnxMcDelete_(req) {
  try {
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var x = bnxMcRows_(req), cardId = String(req.cardId || ''), url = String(req.fileUrl || '');
      var t = x.rows.filter(function (r) { return r.cardId === cardId || (url && r.fileUrl === url); })[0];
      if (!t) return { success: false, error: 'Menu card not found' };
      x.sh.deleteRow(t.row);
      bnxMcClearPublicCache_(t.clientId);
      return { success: true };
    } finally { lock.release(); }
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
/* write a whole row by header name into row index (existing) — rowIdx 0 / past the end = new row via appendRow (atomic) */
function bnxQrpWrite_(sh, rowIdx, obj) {
  var C = bnxCrmCols_(sh), w = Math.max(sh.getLastColumn(), 1), isNew = !rowIdx || rowIdx > sh.getLastRow();
  var cur = isNew ? [] : sh.getRange(rowIdx, 1, 1, w).getValues()[0];
  while (cur.length < w) cur.push('');
  Object.keys(obj).forEach(function (k) { if (C[k]) cur[C[k] - 1] = obj[k]; });
  if (isNew) sh.appendRow(cur); else sh.getRange(rowIdx, 1, 1, w).setValues([cur]);
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
    var vurl = String(o.VIDEO_URL || '').trim(), vfid = String(o.VIDEO_FILE_ID || '').trim();
    if (!vurl) vurl = bnxQrpDescVideo_(o.DESCRIPTION);                       /* older rows: [[video:URL]] in DESCRIPTION */
    if (!vurl && vfid) vurl = bnxDriveViewUrl_(vfid);
    list.push({
      id: String(o.EVENT_ID || ''), title: String(o.TITLE || ''), date: date, time: bnxQrpCellTime_(o.START_TIME),
      venue: String(o.VENUE || ''), description: String(o.DESCRIPTION || ''),
      videoUrl: vurl, videoFileId: vfid || (/drive\.google\.com/i.test(vurl) ? bnxMcId_(vurl) : ''),
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
  /* state: ON = own video plays · OFF = owner switched video off (nothing plays) · NONE = no video set → page plays the default */
  var state = v.active ? 'ON' : (v.videoUrl ? 'OFF' : 'NONE');
  return { video: { videoUrl: v.active ? v.videoUrl : '', fileId: v.active ? v.fileId : '', name: v.name, active: v.active, state: state }, events: ev };
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var sh = bnxQrpSheet_(cid, QRP_SETTINGS_SHEET, QRP_SETTINGS_HEAD), cur = bnxQrpVideo_(cid);
      var row = cur.row || 0;
      bnxQrpWrite_(sh, row, { CLIENT_ID: cid, VIDEO_URL: url, VIDEO_FILE_ID: fid, VIDEO_NAME: name, VIDEO_ACTIVE: active ? 'YES' : 'NO', UPDATED_AT: bnxMpNowFor_(sh) });
      /* REPLACE (2026-10-08): the previous video file goes to Drive Bin (restorable for 30 days) — only a file this
         system uploaded into CLIENT_DATABASES/<client>/QR_PROMO, never someone's own Drive file or an outside link */
      var replaced = '';
      if (cur.fileId && cur.fileId !== fid) replaced = bnxQrpTrashOwn_(cid, cur.fileId);
    } finally { lock.release(); }
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var cur = bnxQrpVideo_(cid);
      if (cur.fileId) bnxQrpTrashOwn_(cid, cur.fileId);
      if (cur.row) bnxQrpWrite_(bnxQrpSheet_(cid, QRP_SETTINGS_SHEET, QRP_SETTINGS_HEAD), cur.row,
        { VIDEO_URL: '', VIDEO_FILE_ID: '', VIDEO_NAME: '', VIDEO_ACTIVE: 'NO', UPDATED_AT: new Date() });
    } finally { lock.release(); }
    bnxMcClearPublicCache_(cid);
    return { success: true };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* QR_PROMO_SAVE_EVENT  { event:{ id?, title, date(yyyy-MM-dd), time, venue, description,
                                 posterFileId? | posterUrl? | posterDataUrl?,
                                 videoUrl? | videoFileId?   (2026-10-09: event video has its own columns), active } }
   — insert or update one */
function bnxQrpDescVideo_(d) { var m = String(d || '').match(/\[\[video:(https:\/\/[^\]\s]+)\]\]/i); return m ? m[1] : ''; }
function bnxQrpIsCfg_(e) { return /^BNXCFG:/.test(String((e && e.description) || '')) || /GUEST SCREEN SETTINGS/.test(String((e && e.title) || '')); }
function bnxQrpSaveEvent_(req) {
  try {
    req = req || {};
    var cid = bnxMcCid_(req), e = req.event || req, warn = '';
    var title = String(e.title || '').trim().slice(0, 120), date = bnxQrpCellDate_(e.date);
    if (!title) return { success: false, error: 'Event name is required' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Event date is required (YYYY-MM-DD)' };
    /* 2026-10-09: "NIRVAAN JEET" was saved as 2006-10-10 (year typo) → treated as a past event, never shown. */
    if (!bnxQrpIsCfg_(e)) {
      var y = Number(date.slice(0, 4)), cy = Number(Utilities.formatDate(new Date(), QRP_TZ, 'yyyy'));
      if (y < cy - 1 || y > cy + 2) return { success: false, error: 'Event date ' + date + ' looks wrong (year ' + y + ') — check the year' };
    }
    var pid = String(e.posterFileId || '').trim(), purl = String(e.posterUrl || '').trim();
    if (e.posterDataUrl) {
      var pf = bnxQrpFolder_(cid).createFile(bnxMcDataUrlBlob_(e.posterDataUrl, e.posterFileName || ('event-' + Date.now() + '.jpg'), 10 * 1024 * 1024));
      warn = bnxMcShare_(pf); pid = pf.getId();
    }
    if (pid) purl = bnxDriveViewUrl_(pid);
    else if (purl) { pid = bnxMcId_(purl); if (pid && /drive\.google\.com/i.test(purl)) { try { warn = bnxMcShare_(DriveApp.getFileById(pid)); } catch (x) {} } }
    if (purl && !/^https:\/\//i.test(purl)) return { success: false, error: 'Poster link must start with https://' };

    /* event video: uploaded Drive file id, or a YouTube / Drive / https link (also accepted inside the description) */
    var vfid = String(e.videoFileId || '').trim(), vurl = String(e.videoUrl || '').trim() || bnxQrpDescVideo_(e.description);
    if (vfid) vurl = bnxDriveViewUrl_(vfid);
    else if (vurl && /drive\.google\.com/i.test(vurl)) { vfid = bnxMcId_(vurl); if (vfid) { try { var w2 = bnxMcShare_(DriveApp.getFileById(vfid)); if (w2) warn = (warn ? warn + ' ' : '') + w2; } catch (x) {} } }
    if (vurl && !/^https:\/\//i.test(vurl)) return { success: false, error: 'Event video link must start with https://' };

    var id = String(e.id || '').trim();
    var lock = bnxSoftLock_('mp_' + cid);
    try {
      var sh = bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD);
      var old = id ? bnxQrpEvents_(cid, false).filter(function (x) { return x.id === id; })[0] : null;
      if (!id) id = 'EV' + Utilities.formatDate(new Date(), QRP_TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
      if (old && !e.posterDataUrl && !e.posterFileId && !e.posterUrl && e.keepPoster !== false) { pid = old.posterFileId; purl = old.posterUrl; }
      if (old && !vurl && !vfid && e.keepVideo !== false) { vurl = old.videoUrl || ''; vfid = old.videoFileId || ''; }
      var row = old ? old.row : 0;
      bnxQrpWrite_(sh, row, {
        EVENT_ID: id, CLIENT_ID: cid, TITLE: title, EVENT_DATE: date, START_TIME: String(e.time || '').slice(0, 60),
        VENUE: String(e.venue || '').slice(0, 160), DESCRIPTION: String(e.description || '').slice(0, 1000),
        POSTER_URL: purl, POSTER_FILE_ID: pid, VIDEO_URL: vurl, VIDEO_FILE_ID: vfid,
        ACTIVE: bnxMcBool_(e.active, true) ? 'YES' : 'NO', UPDATED_AT: bnxMpNowFor_(sh)
      });
    } finally { lock.release(); }
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
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var ev = bnxQrpEvents_(cid, false).filter(function (x) { return x.id === id; })[0];
      if (!ev) return { success: false, error: 'Event not found' };
      bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD).deleteRow(ev.row);
      /* poster / event video that THIS system uploaded go to Drive Bin (restorable 30 days); outside links untouched */
      if (req.keepFiles !== true) { if (ev.posterFileId) bnxQrpTrashOwn_(cid, ev.posterFileId); if (ev.videoFileId) bnxQrpTrashOwn_(cid, ev.videoFileId); }
    } finally { lock.release(); }
    bnxMcClearPublicCache_(cid);
    return { success: true };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* QR_PROMO_SAVE_EVENTS — bulk replace (kept for older callers) */
function bnxQrpSaveEvents_(req) {
  try {
    var cid = bnxMcCid_(req), list = Array.isArray(req.events) ? req.events.slice(0, 100) : [];
    var lock = bnxSoftLock_('mp_' + String((req && req.clientId) || ''));
    try {
      var sh = bnxQrpSheet_(cid, QRP_EVENTS_SHEET, QRP_EVENTS_HEAD);
      bnxQrpEvents_(cid, false).map(function (x) { return x.row; }).sort(function (a, b) { return b - a; })
        .forEach(function (r) { sh.deleteRow(r); });
    } finally { lock.release(); }
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
    whatsapp: String(bnxPubWaNumber_(cid) || cs.WHATSAPP_NUMBER || cs.RESTAURANT_WHATSAPP || cs.RESTAURANT_PHONE || '').replace(/\.0$/, '').replace(/\D/g, '').slice(-10),
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

/* WhatsApp number the owner typed in the dashboard (Settings → WhatsApp setup → guest number). Beats CLIENT_SETTINGS. */
function bnxPubWaNumber_(cid) {
  try { var P = PropertiesService.getScriptProperties(); var n = String(P.getProperty('WA_GUEST_NUMBER_' + cid) || P.getProperty('WA_GUEST_NUMBER') || '').replace(/\D/g, '').slice(-10); return /^[6-9]\d{9}$/.test(n) ? n : ''; } catch (e) { return ''; }
}

/* DOGET — PUBLIC ROUTE FIRST */
function doGet(e) {
  try {
    /* 2026-11-14 Meta webhook verification (through the relay at www.balajinextgen.in/wa-webhook): answer hub.challenge when
       hub.verify_token = Script property WA_VERIFY_TOKEN — so the token lives only here, never in a public website file. */
    if (e && e.parameter && e.parameter['hub.mode'] === 'subscribe' && e.parameter['hub.challenge']) {
      var P0 = PropertiesService.getScriptProperties(), cid0 = String(e.parameter.clientId || '');
      var vt0 = String((cid0 && P0.getProperty('WA_VERIFY_TOKEN_' + cid0)) || P0.getProperty('WA_VERIFY_TOKEN') || '');
      if (vt0 && String(e.parameter['hub.verify_token'] || '') === vt0) return ContentService.createTextOutput(String(e.parameter['hub.challenge']));
      return ContentService.createTextOutput('Verify token mismatch');
    }
    if (e && e.parameter && e.parameter.action === 'PUBLIC_MENU') return bnxPublicMenuOut_(e.parameter.clientId);
    /* Open  <exec URL>?action=BNX_WHOAMI  in a browser: shows which project / code this deployment really runs. */
    if (e && e.parameter && e.parameter.action === 'BNX_WHOAMI') {
      var G = (typeof globalThis !== 'undefined') ? globalThis : this;
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: {
        scriptId: ScriptApp.getScriptId(), build: 'GS-2026.10.09-v20', duesList: true, posImport: true, barTdb: true, kitchenTdb: true, cashBookDaywise: true, dsrItemGroup: true, pettyMeta: true, menuCardQrPromo: '2026-11-14', mpRouteFallback: true, softLock: true, eventVideo: true, cocktailCard: true, menuItemFix: true, printStation: true, stewardControl: true, tallyDirect: true, qrPromo: true,
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
/* 2026-11-14 ROOT FIX ("No deployment has QR_PROMO_SAVE_VIDEO", item / category / group save slow + error):
   Code.gs (V2_CORE) now forwards every action it does not know to bnxMenuPromoRoute_ itself, so this file works in ANY
   file position. When this file IS last, the doPost wrapper below takes only the actions Code.gs has no handler for —
   PRINT_QUEUE_* / PRINTER_MASTER_* / DASH_FIN / KITCHEN_TDB / DSR_TDB / DSR_ITEM_GROUP / BILL_PAYMENTS / CLIENT_ASSETS /
   SAVE_MENU_ITEM_IMAGE stay with Code.gs (one print queue, one image save — before, two different queues could take KOTs). */
var BNX_MP_ACTIONS = /^(QR_PROMO_[A-Z_]+|APPROVAL_[A-Z_]+|STEWARD_CONTROL_[A-Z]+|TALLY_SALES_DATA|TALLY_MARK_POSTED|TALLY_CFG_GET|TALLY_CFG_SAVE|CASHBOOK_DAYWISE|CASHBOOK_DAY_DETAIL|CASHBOOK_CFG_GET|CASHBOOK_CFG_SAVE|PETTY_META_SAVE|PETTY_META_GET|GUEST_CTL_GET|GUEST_CTL_SAVE|WA_SETUP_GET|WA_SETUP_SAVE|WA_TEST|DUES_LIST|POS_IMPORT|BAR_TDB|MENU_ITEM_ENSURE|SAVE_MENU_CARD_LINK|SAVE_MENU_CARD_UPLOAD|GET_MENU_CARDS|GET_ACTIVE_MENU_CARD|ACTIVATE_MENU_CARD|DELETE_MENU_CARD)$/;
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
  /* actions under Approval Control (bill-approvals.gs): refused here only when approval is required and missing;
     otherwise they pass straight through to the normal doPost */
  if (/^(SAVE_BILL|VOID_BILL|UPDATE_ORDER_STATUS|UPDATE_ORDER_ITEMS|EDIT_DUES_RECEIPT|DELETE_DUES_RECEIPT|SAVE_PETTY_CASH|UPDATE_PETTY_CASH|SAVE_CASH_MOVEMENT|SAVE_WASTAGE|DAY_CLOSE|SAVE_MENU_ITEM|CLEAR_TEST_DATA)$/.test(action)
      && typeof bnxApprovalCheckAction_ === 'function') {
    var gate = bnxApprovalCheckAction_(action, body);
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
    if (r) return r;
    var out = prev.apply(this, arguments);
    try { var a2 = bnxMpAfter_(e, out); if (a2) return a2; } catch (x) {}   /* SAVE_MENU_ITEM guaranteed write */
    return out;
  };
  wrapped.__bnxMp = true;
  try { G.doPost = wrapped; } catch (x) {}
  try { doPost = wrapped; } catch (x) {}
})();

/* ============================================================
   MENU ITEM SAVE — GUARANTEED WRITE (2026-10-09, "IMPORTED HASHFREEZER: price / name / image not saved")
   ROOT CAUSE: the dashboard keeps ITEM_ID in item.code and sent it as itemCode. HASHFREEZER (made by POS quick-add)
   is the one MENU_CARD_ITEMS row whose ITEM_ID (ITM00797) ≠ ITEM_CODE (ITM772608) and it has no ITEM_MASTER row,
   so SAVE_MENU_ITEM / SAVE_MENU_ITEM_IMAGE never found it — the edit stayed on the PC and the next menu pull put
   ₹3,500 back. Now, after the normal SAVE_MENU_ITEM runs, the row is matched on ITEM_ID OR ITEM_CODE in
   MENU_CARD_ITEMS, BAR_MENU_CARD and ITEM_MASTER and the edited fields are written there. Item photos are handled
   here too: Drive › CLIENT_DATABASES › <client> › assets › item-images › <ITEM_ID>.jpg, direct image link written back.
   ============================================================ */
var BNX_MI_TABS = [
  { tab: 'MENU_CARD_ITEMS', name: ['MENU_ITEM_NAME'], price: ['PRICE'], section: ['MENU_SECTION'], img: ['PRODUCT_IMAGE_URL'], veg: ['VEG_TYPE'], avail: 'AVAILABILITY_STATUS' },
  { tab: 'BAR_MENU_CARD',   name: ['ITEM_NAME'], price: ['SERVING_PRICE'], section: ['MENU_SECTION'], img: ['PRODUCT_IMAGE_URL'], avail: 'AVAILABILITY_STATUS' },
  { tab: 'ITEM_MASTER',     name: ['ITEM_NAME'], price: ['SELLING_RATE'], section: ['MENU_SECTION'], img: ['IMAGE_URL'], veg: ['DIETARY_TYPE'] }
];
function bnxMiIds_(b) {
  var out = [];
  [b.itemId, b.ITEM_ID, b.id, b.itemCode, b.ITEM_CODE, b.code].forEach(function (v) { v = String(v == null ? '' : v).trim().toUpperCase(); if (v && out.indexOf(v) < 0) out.push(v); });
  return out;
}
/* every row of this client whose ITEM_ID or ITEM_CODE is one of ids → [{sh, C, row, spec}] */
function bnxMiFind_(cid, ids) {
  var ss = bnxCrmSpreadsheet_(cid, 'MASTER', true), hits = [];
  BNX_MI_TABS.forEach(function (spec) {
    var sh = ss.getSheetByName(spec.tab); if (!sh || sh.getLastRow() < 2) return;
    var C = bnxCrmCols_(sh), n = sh.getLastRow() - 1, cI = C.ITEM_ID, cC = C.ITEM_CODE, cCl = C.CLIENT_ID;
    if (!cI && !cC) return;
    var a = cI ? sh.getRange(2, cI, n, 1).getValues() : null, b = cC ? sh.getRange(2, cC, n, 1).getValues() : null, cl = cCl ? sh.getRange(2, cCl, n, 1).getValues() : null;
    for (var i = 0; i < n; i++) {
      if (cl && cl[i][0] && String(cl[i][0]) !== cid) continue;
      var x = a ? String(a[i][0]).trim().toUpperCase() : '', y = b ? String(b[i][0]).trim().toUpperCase() : '';
      if ((x && ids.indexOf(x) >= 0) || (y && ids.indexOf(y) >= 0)) hits.push({ sh: sh, C: C, row: i + 2, spec: spec });
    }
  });
  return hits;
}
function bnxMiSet_(h, cols, v) { for (var i = 0; i < cols.length; i++) if (h.C[cols[i]]) { h.cur[h.C[cols[i]] - 1] = v; h.ch = true; return; } }
function bnxMiEnsure_(b) {
  var cid = String(b.clientId || '').trim(), ids = bnxMiIds_(b);
  if (!ids.length) return { rows: 0, why: 'no item id' };
  var hits = bnxMiFind_(cid, ids), n = 0, tabs = [];
  var name = String(b.name || b.itemName || '').trim(), price = Number(b.price), sec = String(b.category || '').trim();
  var img = String(b.imageUrl || '').trim(); if (!/^https:\/\//i.test(img) || img.length > 2000) img = '';
  var veg = String(b.veg || '').trim().toUpperCase();
  hits.forEach(function (h) {
    var lc = h.sh.getLastColumn(); h.cur = h.sh.getRange(h.row, 1, 1, lc).getValues()[0]; h.ch = false;
    if (name) bnxMiSet_(h, h.spec.name, name);
    if (price > 0) bnxMiSet_(h, h.spec.price, price);
    if (sec) bnxMiSet_(h, h.spec.section, sec);
    if (img) bnxMiSet_(h, h.spec.img, img);
    if (veg && h.spec.veg) bnxMiSet_(h, h.spec.veg, veg === 'EG' ? 'E' : veg);
    if (b.itemGroupId) bnxMiSet_(h, ['ITEM_GROUP_ID'], String(b.itemGroupId));
    if (b.itemGroupName) bnxMiSet_(h, ['ITEM_GROUP_NAME'], String(b.itemGroupName));
    var __av = /^(limited|unavailable|available)$/i.test(String(b.availability || '')) ? String(b.availability).toLowerCase() : (b.avail === false ? 'unavailable' : 'available');
    if (b.avail !== undefined && h.spec.avail) bnxMiSet_(h, [h.spec.avail], __av);
    if (b.avail !== undefined && h.spec.tab === 'BAR_MENU_CARD') bnxMiSet_(h, ['IS_ACTIVE'], b.avail !== false);
    if (b.avail !== undefined) bnxMiSet_(h, ['AVAILABILITY_STATUS'], __av);
    if (b.menuActive !== undefined && b.menuActive !== null && b.menuActive !== '') bnxMiSet_(h, ['MENU_ACTIVE'], !(b.menuActive === false || /^(false|no|0)$/i.test(String(b.menuActive))));
    var gstN = Number(b.gst); if (b.gst !== undefined && b.gst !== '' && isFinite(gstN) && h.spec.tab === 'ITEM_MASTER') { var tid = bnxMiTaxId_(cid, gstN); if (tid) bnxMiSet_(h, ['TAX_ID'], tid); }
    if (h.ch) { h.sh.getRange(h.row, 1, 1, lc).setValues([h.cur]); n++; if (tabs.indexOf(h.spec.tab) < 0) tabs.push(h.spec.tab); }
  });
  if (n) bnxMcClearPublicCache_(cid);
  return { rows: n, found: hits.length, tabs: tabs, ids: ids };
}
/* SAVE_MENU_ITEM_IMAGE { itemId, itemCode, imageData: data:image/...;base64 } → { success, imageUrl, fileId } */
function bnxMiImage_(b) {
  try {
    var cid = bnxMcCid_(b), ids = bnxMiIds_(b);
    if (!ids.length) return { success: false, error: 'Item ID / code missing' };
    var hits = bnxMiFind_(cid, ids);
    var iid = (hits.map(function (h) { return h.C.ITEM_ID ? String(h.sh.getRange(h.row, h.C.ITEM_ID).getValue()).trim() : ''; }).filter(String)[0]) || ids[0];
    var mm = String(b.imageData || '').match(/^data:(image\/[a-z+.-]+);base64,/i);
    if (!mm) return { success: false, error: 'Image data missing — choose the photo again' };
    var ext = /png/i.test(mm[1]) ? '.png' : /webp/i.test(mm[1]) ? '.webp' : '.jpg';
    var blob = bnxMcDataUrlBlob_(b.imageData, iid + ext, 6 * 1024 * 1024);
    var folder = bnxMcSubFolder_(cid, 'assets/item-images');   /* Drive › CLIENT_DATABASES › <client> › assets › item-images (same path the apps use) */
    var old = folder.getFiles(); while (old.hasNext()) { var of = old.next(); if (of.getName().replace(/\.\w+$/, '') === iid) { try { of.setTrashed(true); } catch (e) {} } }
    var f = folder.createFile(blob), warn = bnxMcShare_(f), fid = f.getId(), url = 'https://lh3.googleusercontent.com/d/' + fid + '=w800';
    var n = 0;
    hits.forEach(function (h) {
      var lc = h.sh.getLastColumn(); h.cur = h.sh.getRange(h.row, 1, 1, lc).getValues()[0]; h.ch = false;
      bnxMiSet_(h, h.spec.img, url);
      if (h.spec.tab === 'ITEM_MASTER') { bnxMiSet_(h, ['DRIVE_FILE_ID'], fid); bnxMiSet_(h, ['IMAGE_SOURCE'], 'DRIVE_UPLOAD'); bnxMiSet_(h, ['IMAGE_STATUS'], 'READY_DRIVE'); bnxMiSet_(h, ['ICON_URL'], url); bnxMiSet_(h, ['IMAGE_UPDATED_AT'], bnxMpNowFor_(h.sh)); }
      if (h.ch) { h.sh.getRange(h.row, 1, 1, lc).setValues([h.cur]); n++; }
    });
    try {   /* manifest the POS / QR page read first */
      var man = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName('ITEM_IMAGE_MANIFEST');
      if (man) { var Cm = bnxCrmCols_(man), done = false;
        if (Cm.ITEM_ID && man.getLastRow() > 1) { var mv = man.getRange(2, Cm.ITEM_ID, man.getLastRow() - 1, 1).getValues();
          for (var i = 0; i < mv.length; i++) if (String(mv[i][0]).trim().toUpperCase() === iid.toUpperCase()) { bnxQrpWrite_(man, i + 2, { IMAGE_PATH: url, IMAGE_SOURCE: 'DRIVE_UPLOAD', IMAGE_STATUS: 'READY_DRIVE' }); done = true; } }
        if (!done) bnxQrpWrite_(man, 0, { ITEM_ID: iid, ITEM_NAME: String(b.name || ''), IMAGE_PATH: url, IMAGE_SOURCE: 'DRIVE_UPLOAD', IMAGE_STATUS: 'READY_DRIVE' }); }
    } catch (e) {}
    bnxMcClearPublicCache_(cid);
    return { success: true, imageUrl: url, fileId: fid, rows: n, itemId: iid, warn: warn };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
/* runs after the normal doPost answered SAVE_MENU_ITEM */
function bnxMpAfter_(e, out) {
  var body; try { body = JSON.parse(e.postData.contents); } catch (x) { return null; }
  if (String(body.action || '') !== 'SAVE_MENU_ITEM' || bnxMpAuth_(body)) return null;
  var orig = {}; try { orig = JSON.parse(out.getContent()); } catch (x) { orig = null; }
  if (orig && orig.success === false && /approv/i.test(String(orig.error || orig.message || ''))) return null;   /* approval control said no */
  var en; try { en = bnxMiEnsure_(body); } catch (x) { en = { rows: 0, error: x.message }; }
  if (!orig || typeof orig !== 'object') orig = {};
  orig.menuRows = en;
  if (orig.success === false && en.found) { orig.success = true; orig.note = 'Saved to ' + (en.tabs.join(', ') || 'menu') + ' (matched by ITEM_ID / ITEM_CODE)'; delete orig.error; }
  return bnxMpJson_(orig);
}

/* ============================================================
   MASTER PRINTERS + POS PRINT STATION (2026-10-09)
   "printer configuration direct in mobile can't any changes — all from POS control", for EVERY client.
   • PRINTER_MASTER_GET / PRINTER_MASTER_SAVE : CLIENT_PRINTER_MASTER (client MASTER DB) is the ONE printer setting
     per client (BILL / KITCHEN / HUKKA / BAR → IP:9100). Set on the POS dashboard; every phone and PC reads it.
   • Steward phones never print themselves (a phone browser cannot reach a raw port-9100 printer). They put the
     KOT tickets in this client's print queue (PRINT_QUEUE_ADD, < 1 s, CacheService). The POS PC that has QZ Tray
     (restaurant-dashboard, "KOT print station") claims and prints them (PRINT_QUEUE_CLAIM / PRINT_QUEUE_DONE).
     A claimed job that is not finished in 60 s is given to another station — one ticket never prints twice.
   • PRINT_QUEUE_STATUS : the phone sees "printed at Kitchen ✓" and whether a station is online.
   ============================================================ */
var BNX_PQ_ROLES = ['BILL', 'KITCHEN', 'HUKKA', 'BAR'];
function bnxPqKey_(cid) { return 'pq_' + cid; }
function bnxPqLoad_(cid) { try { var r = CacheService.getScriptCache().get(bnxPqKey_(cid)); return r ? JSON.parse(r) : { v: 0, jobs: [] }; } catch (e) { return { v: 0, jobs: [] }; } }
function bnxPqStore_(cid, q) {
  var now = Date.now();
  q.jobs = q.jobs.filter(function (j) { return (j.st === 'NEW' || j.st === 'CLAIMED') ? now - j.at < 6 * 3600000 : now - (j.doneAt || j.at) < 30 * 60000; });
  var txt = JSON.stringify(q);
  while (txt.length > 95000 && q.jobs.length) {                              /* cache value limit 100 KB: drop oldest finished first */
    var i = -1; for (var k = 0; k < q.jobs.length; k++) if (q.jobs[k].st === 'DONE' || q.jobs[k].st === 'FAIL') { i = k; break; }
    q.jobs.splice(i < 0 ? 0 : i, 1); txt = JSON.stringify(q);
  }
  CacheService.getScriptCache().put(bnxPqKey_(cid), txt, 21600);
}
function bnxPqStation_(cid) { try { var r = CacheService.getScriptCache().get('pq_hb_' + cid); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function bnxPqRole_(t) {
  t = String(t || '').toUpperCase();
  if (BNX_PQ_ROLES.indexOf(t) >= 0) return t;
  if (/HUKKA|HOOKAH|SHEESHA|SHISHA|CIGARETTE|TOBACCO/.test(t)) return 'HUKKA';
  if (/BAR|BEVERAGE|LIQUOR|SPIRIT|ALCOHOL|COCKTAIL|MOCKTAIL|BEER|WINE/.test(t)) return 'BAR';
  if (/BILL|RECEIPT/.test(t)) return 'BILL';
  return 'KITCHEN';
}
function bnxPqAdd_(b) {
  var cid = bnxMcCid_(b), list = Array.isArray(b.jobs) ? b.jobs.slice(0, 20) : [], out = [];
  var lock = bnxSoftLock_('pq_' + cid, 8000);
  try {
    var q = bnxPqLoad_(cid);
    list.forEach(function (j) {
      var id = String(j.id || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80) || ('PJ' + Date.now() + Math.floor(Math.random() * 1000));
      if (q.jobs.some(function (x) { return x.id === id; })) { out.push(id); return; }   /* same ticket sent twice → once */
      var items = (Array.isArray(j.items) ? j.items : []).slice(0, 80).map(function (i) {
        return { name: String(i.name || i.n || i.ITEM_NAME || i.itemName || 'Item').slice(0, 60), qty: Number(i.qty || i.QUANTITY || 1) || 1,
                 size: String(i.size || i.SIZE || '').slice(0, 20), note: String(i.note || i.notes || i.remark || i.remarks || '').slice(0, 120) };
      });
      if (!items.length) return;
      q.jobs.push({ id: id, at: Date.now(), st: 'NEW', role: bnxPqRole_(j.role || j.type || j.title), table: String(j.table || '').slice(0, 20),
        waiter: String(j.waiter || '').slice(0, 40), covers: String(j.covers || '').slice(0, 6), items: items, kotNo: String(j.kotNo || '').slice(0, 40),
        orderNo: String(j.orderNo || '').slice(0, 40), si: Number(j.splitIndex || 1), sn: Number(j.splitTotal || 1),
        cust: String(j.customerName || '').slice(0, 40), rem: String(j.remarks || '').slice(0, 200), from: String(j.from || 'STEWARD').slice(0, 20),
        reprint: !!j.reprint, tries: 0 });
      out.push(id);
    });
    q.v = (q.v || 0) + 1; bnxPqStore_(cid, q);
  } finally { lock.release(); }
  var hb = bnxPqStation_(cid);
  return { success: true, data: { ids: out, stationOnline: !!(hb && Date.now() - hb.at < 25000), station: hb && hb.name || '' } };
}
function bnxPqClaim_(b) {
  var cid = bnxMcCid_(b), station = String(b.station || 'POS').slice(0, 40), now = Date.now();
  CacheService.getScriptCache().put('pq_hb_' + cid, JSON.stringify({ at: now, name: station, qz: !!b.qz }), 120);
  if (b.since && Number(b.since) === (bnxPqLoad_(cid).v || 0) && !b.force) return { success: true, data: { v: Number(b.since), jobs: [] } };   /* nothing new: no lock */
  var lock = bnxSoftLock_('pq_' + cid, 8000), mine = [];
  try {
    var q = bnxPqLoad_(cid);
    q.jobs.forEach(function (j) {
      var stale = j.st === 'CLAIMED' && now - (j.claimAt || 0) > 60000;
      if ((j.st === 'NEW' || stale) && mine.length < 12) { j.st = 'CLAIMED'; j.by = station; j.claimAt = now; j.tries = (j.tries || 0) + 1; mine.push(j); }
    });
    if (mine.length) { q.v = (q.v || 0) + 1; bnxPqStore_(cid, q); }
    return { success: true, data: { v: q.v || 0, jobs: mine } };
  } finally { lock.release(); }
}
function bnxPqDone_(b) {
  var cid = bnxMcCid_(b), res = Array.isArray(b.results) ? b.results : [];
  var lock = bnxSoftLock_('pq_' + cid, 8000);
  try {
    var q = bnxPqLoad_(cid), now = Date.now();
    res.forEach(function (r) {
      var j = q.jobs.filter(function (x) { return x.id === String(r.id); })[0]; if (!j) return;
      if (r.ok) { j.st = 'DONE'; j.doneAt = now; j.err = ''; }
      else { j.err = String(r.error || 'print failed').slice(0, 160); j.st = (j.tries || 0) >= 3 ? 'FAIL' : 'NEW'; if (j.st === 'FAIL') j.doneAt = now; }
    });
    q.v = (q.v || 0) + 1; bnxPqStore_(cid, q);
  } finally { lock.release(); }
  return { success: true };
}
function bnxPqStatus_(b) {
  var cid = bnxMcCid_(b), ids = Array.isArray(b.ids) ? b.ids.map(String) : null, q = bnxPqLoad_(cid), hb = bnxPqStation_(cid);
  var jobs = q.jobs.filter(function (j) { return !ids || ids.indexOf(j.id) >= 0; }).map(function (j) {
    return { id: j.id, st: j.st, role: j.role, table: j.table, kotNo: j.kotNo, at: j.at, err: j.err || '', by: j.by || '' }; });
  return { success: true, data: { jobs: jobs, stationOnline: !!(hb && Date.now() - hb.at < 25000), station: hb && hb.name || '', stationAt: hb && hb.at || 0 } };
}
/* ── master printers ── */
function bnxPmSheet_(cid) {
  var ss = bnxCrmSpreadsheet_(cid, 'MASTER', true), sh = ss.getSheetByName('CLIENT_PRINTER_MASTER');
  if (!sh) { sh = ss.insertSheet('CLIENT_PRINTER_MASTER'); sh.getRange(1, 1, 1, 7).setValues([['CLIENT_ID', 'PRINTER_ROLE', 'PRINTER_LABEL', 'PRINTER_IP', 'PORT', 'PROTOCOL', 'ACTIVE']]); }
  return sh;
}
function bnxPmGet_(b) {
  try {
    var cid = bnxMcCid_(b), sh = bnxPmSheet_(cid), C = bnxCrmCols_(sh), n = sh.getLastRow() - 1, out = [];
    if (n > 0) sh.getRange(2, 1, n, sh.getLastColumn()).getValues().forEach(function (r) {
      if (String(r[C.CLIENT_ID - 1]).trim() !== cid) return;
      out.push({ role: String(r[C.PRINTER_ROLE - 1] || '').trim().toUpperCase(), label: String(r[C.PRINTER_LABEL - 1] || ''), ip: String(r[C.PRINTER_IP - 1] || '').trim(),
                 port: Number(r[C.PORT - 1] || 9100) || 9100, protocol: String(C.PROTOCOL ? r[C.PROTOCOL - 1] || 'RAW_ESC_POS' : 'RAW_ESC_POS'), active: bnxMcBool_(C.ACTIVE ? r[C.ACTIVE - 1] : true, true) });
    });
    var route = PropertiesService.getScriptProperties().getProperty('PRINT_ROUTE_' + cid) || 'POS';
    var hb = bnxPqStation_(cid);
    return { success: true, data: { printers: out, route: route, stationOnline: !!(hb && Date.now() - hb.at < 25000), station: hb && hb.name || '' } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxPmSave_(b) {
  try {
    var cid = bnxMcCid_(b), list = Array.isArray(b.printers) ? b.printers : [];
    if (b.bnxRole && !/ADMIN|OWNER|MANAGER|DEVELOPER|SUPER/i.test(String(b.bnxRole))) return { success: false, error: 'Only owner / admin / manager can change printers' };
    var ipRe = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
    var bad = list.filter(function (p) { return p.ip && !ipRe.test(String(p.ip).trim()); });
    if (bad.length) return { success: false, error: 'Not a printer IP: ' + bad.map(function (p) { return p.role + ' ' + p.ip; }).join(', ') };
    var lock = bnxSoftLock_('pm_' + cid);
    try {
      var sh = bnxPmSheet_(cid), C = bnxCrmCols_(sh), n = sh.getLastRow() - 1, rows = n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : [];
      list.forEach(function (p) {
        var role = bnxPqRole_(p.role), idx = -1;
        for (var i = 0; i < rows.length; i++) if (String(rows[i][C.CLIENT_ID - 1]).trim() === cid && String(rows[i][C.PRINTER_ROLE - 1]).trim().toUpperCase() === role) { idx = i; break; }
        var o = { CLIENT_ID: cid, PRINTER_ROLE: role, PRINTER_LABEL: String(p.label || (role + ' Printer')).slice(0, 60), PRINTER_IP: String(p.ip || '').trim(), PORT: Number(p.port || 9100) || 9100,
                  PROTOCOL: 'RAW_ESC_POS', ACTIVE: p.active === false ? false : !!String(p.ip || '').trim() };
        bnxQrpWrite_(sh, idx >= 0 ? idx + 2 : 0, o);
        if (idx < 0) rows.push([]);
      });
      if (b.route) PropertiesService.getScriptProperties().setProperty('PRINT_ROUTE_' + cid, /^PHONE/i.test(String(b.route)) ? 'PHONE_APP' : 'POS');
    } finally { lock.release(); }
    return bnxPmGet_({ clientId: cid });
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ============================================================
   STEWARD APP CONTROL (2026-10-09) — set on the POS, followed by every steward phone of the client
   defaults + per steward user:  order (may place orders) · print (KOT prints at POS) · locked (app blocked)
   and hideUnavailable (items marked "not available" are not shown in the steward menu).
   STEWARD_CONTROL_GET  { userId, loginId, list? } → { me, defaults, users?, staff? }
   STEWARD_CONTROL_SAVE { defaults, users:{ <USER_ID>: {order,print,locked} } }   (owner / admin / manager)
   ============================================================ */
var BNX_STW_DEF = { order: true, print: true, locked: false, hideUnavailable: true };
function bnxStwLoad_(cid) {
  var raw = PropertiesService.getScriptProperties().getProperty('STW_CTL_' + cid), o = {};
  try { o = raw ? JSON.parse(raw) : {}; } catch (e) { o = {}; }
  o.defaults = Object.assign({}, BNX_STW_DEF, o.defaults || {}); o.users = o.users || {};
  return o;
}
function bnxStwMe_(o, ids) {
  var me = Object.assign({}, o.defaults), hit = null;
  ids.forEach(function (k) { k = String(k || '').trim().toUpperCase(); if (k && !hit && o.users[k]) hit = o.users[k]; });
  if (hit) ['order', 'print', 'locked'].forEach(function (f) { if (hit[f] === true || hit[f] === false) me[f] = hit[f]; });
  me.note = hit && hit.note || '';
  return me;
}
function bnxStwStaff_(cid) {
  try {
    var sh = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName('USER_MASTER'); if (!sh || sh.getLastRow() < 2) return [];
    var C = bnxCrmCols_(sh);
    return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().filter(function (r) {
      return (!C.CLIENT_ID || String(r[C.CLIENT_ID - 1]).trim() === cid) && String(C.USER_ID ? r[C.USER_ID - 1] : '').trim();
    }).map(function (r) {
      var g = function (h) { return C[h] ? r[C[h] - 1] : ''; };
      return { userId: String(g('USER_ID')), login: String(g('USERNAME') || g('LOGIN_ID') || ''), name: String(g('FULL_NAME') || ''), type: String(g('STAFF_TYPE') || g('ROLE_ID') || ''), active: bnxMcBool_(g('IS_ACTIVE'), true) };
    });
  } catch (e) { return []; }
}
function bnxStwGet_(b) {
  try {
    var cid = bnxMcCid_(b), o = bnxStwLoad_(cid);
    var out = { me: bnxStwMe_(o, [b.userId, b.loginId]), defaults: o.defaults, at: Date.now() };
    if (b.list) { out.users = o.users; out.staff = bnxStwStaff_(cid); }
    return { success: true, data: out };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxStwSave_(b) {
  try {
    var cid = bnxMcCid_(b);
    if (!/ADMIN|OWNER|MANAGER|DEVELOPER|SUPER/i.test(String(b.bnxRole || ''))) return { success: false, error: 'Only owner / admin / manager can change the steward app control' };
    var lock = bnxSoftLock_('stw_' + cid);
    try {
      var o = bnxStwLoad_(cid), d = b.defaults || {};
      ['order', 'print', 'locked', 'hideUnavailable'].forEach(function (f) { if (d[f] === true || d[f] === false) o.defaults[f] = d[f]; });
      Object.keys(b.users || {}).forEach(function (k) {
        var u = b.users[k] || {}, key = String(k).trim().toUpperCase(); if (!key) return;
        var x = {}; ['order', 'print', 'locked'].forEach(function (f) { if (u[f] === true || u[f] === false) x[f] = u[f]; });
        if (u.note) x.note = String(u.note).slice(0, 80);
        if (Object.keys(x).length) o.users[key] = x; else delete o.users[key];   /* all "default" → remove the override */
      });
      o.updatedAt = Date.now(); o.updatedBy = String(b.bnxUser || b.bnxRole || '').slice(0, 40);
      var txt = JSON.stringify(o); if (txt.length > 8500) return { success: false, error: 'Too many steward overrides — reset some to Default' };
      PropertiesService.getScriptProperties().setProperty('STW_CTL_' + cid, txt);
    } finally { lock.release(); }
    return bnxStwGet_({ clientId: cid, list: true });
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ============================================================
   TALLY DIRECT POST — data side (2026-10-09, "direct post, no import / export; item-wise or accounting mode")
   The dashboard posts the vouchers straight to Tally Prime (http://localhost:9000 on the billing PC); this part gives
   it the real bills and remembers which bill went to Tally.
   TALLY_SALES_DATA  { from, to, includeHistorical? } → bills of TRANSACTION DB › BILL_MASTER with BILL_ITEMS + PAYMENT_MASTER
   TALLY_MARK_POSTED { results:[{billNo, ok, msg, mode}] } → TRANSACTION DB › TALLY_POST_LOG
   TALLY_CFG_GET / TALLY_CFG_SAVE { cfg } → ledger names / mode per client (Script property TALLY_CFG_<client>)
   ============================================================ */
function bnxTlStr_(sh, v, fmt) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, bnxCrmSheetTz_(sh), fmt) : String(v == null ? '' : v).trim(); }
function bnxTlDay_(sh, v) {
  var s = bnxTlStr_(sh, v, 'yyyy-MM-dd'), m = s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : s.slice(0, 10);
}
/* rows whose key column is in `want` — reads only the block between the first and last hit */
function bnxTlRowsFor_(sh, keyCol, want) {
  var out = {}; if (!sh || sh.getLastRow() < 2) return out;
  var C = bnxCrmCols_(sh), kc = C[keyCol]; if (!kc) return out;
  var n = sh.getLastRow() - 1, keys = sh.getRange(2, kc, n, 1).getValues(), lo = -1, hi = -1;
  for (var i = 0; i < n; i++) if (want[String(keys[i][0])]) { if (lo < 0) lo = i; hi = i; }
  if (lo < 0) return out;
  var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toUpperCase(); });
  sh.getRange(lo + 2, 1, hi - lo + 1, sh.getLastColumn()).getValues().forEach(function (r) {
    var k = String(r[kc - 1]); if (!want[k]) return;
    var o = {}; H.forEach(function (h, j) { if (h) o[h] = r[j]; }); (out[k] = out[k] || []).push(o);
  });
  return out;
}
function bnxTlData_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required (YYYY-MM-DD)' };
    if (from > to) { var t0 = from; from = to; to = t0; }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), bm = ss.getSheetByName('BILL_MASTER');
    if (!bm || bm.getLastRow() < 2) return { success: true, data: { bills: [], from: from, to: to } };
    var C = bnxCrmCols_(bm), lc = bm.getLastColumn(), n = bm.getLastRow() - 1;
    var H = bm.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim().toUpperCase(); });
    var dcol = C.BILL_DATE || C.DATE; if (!dcol) return { success: false, error: 'BILL_MASTER has no BILL_DATE column' };
    var dates = bm.getRange(2, dcol, n, 1).getValues(), lo = -1, hi = -1;
    for (var i = 0; i < n; i++) { var d = bnxTlDay_(bm, dates[i][0]); if (d >= from && d <= to) { if (lo < 0) lo = i; hi = i; } }
    var bills = [], ids = {}, nums = {};
    if (lo >= 0) bm.getRange(lo + 2, 1, hi - lo + 1, lc).getValues().forEach(function (r) {
      var o = {}; H.forEach(function (h, j) { if (h) o[h] = r[j]; });
      var d = bnxTlDay_(bm, o.BILL_DATE); if (!(d >= from && d <= to)) return;
      if (o.CLIENT_ID && String(o.CLIENT_ID) !== cid) return;
      var st = String(o.BILL_STATUS || '').toUpperCase(), ty = String(o.BILL_TYPE || '').toUpperCase();
      if (/CANCEL|VOID|DELETE/.test(st)) return;
      if (/HISTORIC/.test(ty) && !b.includeHistorical) return;
      if (!(Number(o.GRAND_TOTAL) > 0)) return;
      var gb = {}; try { gb = JSON.parse(String(o.GST_BREAKUP || '{}')) || {}; } catch (e) {}
      bills.push({ id: String(o.BILL_ID || ''), no: String(o.BILL_NUMBER || o.BILL_ID || ''), date: d, time: bnxTlStr_(bm, o.BILL_TIME, 'HH:mm'),
        table: String(o.TABLE_ID || ''), customer: String(o.CUSTOMER_NAME || ''), customerId: String(o.CUSTOMER_ID || ''), type: ty,
        subtotal: Number(o.SUBTOTAL || 0), itemDisc: Number(o.ITEM_DISCOUNT || 0), billDisc: Number(o.BILL_DISCOUNT || 0),
        afterItemDisc: Number(o.SUBTOTAL_AFTER_ITEM_DISCOUNT || 0), taxable: Number(o.TAXABLE_AMOUNT || 0), tax: Number(o.TAX_AMOUNT || 0),
        service: Number(o.SERVICE_CHARGE_AMOUNT || 0), serviceGst: Number(o.SERVICE_CHARGE_GST_AMOUNT || 0), roundOff: Number(o.ROUND_OFF || 0),
        total: Number(o.GRAND_TOTAL || 0), due: Number(o.DUE_AMOUNT || 0), payStatus: String(o.PAYMENT_STATUS || ''), gst: gb,
        aggregator: String(o.AGGREGATOR || ''), channel: String(o.SALES_CHANNEL || o.ORDER_SOURCE || ''), items: [], pays: [] });
      if (o.BILL_ID) ids[String(o.BILL_ID)] = 1; nums[String(o.BILL_NUMBER || '')] = 1;
    });
    if (bills.length) {
      var it = bnxTlRowsFor_(ss.getSheetByName('BILL_ITEMS'), 'BILL_ID', ids), pm = bnxTlRowsFor_(ss.getSheetByName('PAYMENT_MASTER'), 'BILL_ID', ids);
      var lg = bnxTlRowsFor_(ss.getSheetByName('TALLY_POST_LOG'), 'BILL_NUMBER', nums);
      bills.forEach(function (x) {
        x.items = (it[x.id] || []).map(function (r) { return { name: String(r.ITEM_NAME || 'Item').trim(), code: String(r.ITEM_CODE || r.ITEM_ID || ''), group: String(r.ITEM_GROUP_NAME || r.CATEGORY || ''),
          category: String(r.CATEGORY || ''), qty: Number(r.QUANTITY || 0), rate: Number(r.DISCOUNTED_RATE || r.RATE || 0), mrp: Number(r.RATE || 0), disc: Number(r.LINE_DISCOUNT || 0), line: Number(r.LINE_TOTAL || 0) }; });
        x.pays = (pm[x.id] || []).filter(function (r) { return !/REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || '')); })
          .map(function (r) { return { mode: String(r.PAYMENT_MODE || '').toUpperCase(), amount: Number(r.AMOUNT || 0), ref: String(r.REFERENCE || '') }; });
        var l = (lg[x.no] || []).filter(function (r) { return String(r.RESULT || '').toUpperCase() === 'OK'; }).pop();
        if (l) { x.posted = true; x.postedAt = bnxTlStr_(ss.getSheetByName('TALLY_POST_LOG'), l.POSTED_AT, 'yyyy-MM-dd HH:mm'); x.postedMode = String(l.MODE || ''); }
      });
    }
    return { success: true, data: { bills: bills, from: from, to: to } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxTlMark_(b) {
  try {
    var cid = bnxMcCid_(b), res = Array.isArray(b.results) ? b.results.slice(0, 500) : [];
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), sh = ss.getSheetByName('TALLY_POST_LOG');
    if (!sh) { sh = ss.insertSheet('TALLY_POST_LOG'); sh.getRange(1, 1, 1, 8).setValues([['POSTED_AT', 'CLIENT_ID', 'BILL_NUMBER', 'BILL_DATE', 'AMOUNT', 'MODE', 'RESULT', 'MESSAGE']]).setFontWeight('bold'); sh.setFrozenRows(1); }
    var now = bnxMpNowFor_(sh), rows = res.map(function (r) { return [now, cid, String(r.billNo || ''), String(r.date || ''), Number(r.amount || 0), String(r.mode || ''), r.ok ? 'OK' : 'ERROR', String(r.msg || '').slice(0, 300)]; });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
    return { success: true, data: { logged: rows.length } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxTlCfg_(b, save) {
  try {
    var cid = bnxMcCid_(b), P = PropertiesService.getScriptProperties(), k = 'TALLY_CFG_' + cid;
    if (save) {
      if (b.bnxRole && !/ADMIN|OWNER|MANAGER|ACCOUNT|DEVELOPER|SUPER/i.test(String(b.bnxRole))) return { success: false, error: 'Only owner / admin / accountant can change Tally settings' };
      var txt = JSON.stringify(b.cfg || {}); if (txt.length > 8500) return { success: false, error: 'Tally settings too large' };
      P.setProperty(k, txt);
    }
    var o = {}; try { o = JSON.parse(P.getProperty(k) || '{}') || {}; } catch (e) {}
    return { success: true, data: o };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* GST % from the item edit → TAX_ID of TAX_MASTER with that rate (5 → TAX00001, 0 → TAX00002, 40 → TAX00003 …) */
function bnxMiTaxId_(cid, pct) {
  try {
    var sh = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName('TAX_MASTER'); if (!sh || sh.getLastRow() < 2) return '';
    var C = bnxCrmCols_(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues(), want = Number(pct) / 100;
    for (var i = 0; i < v.length; i++) { var r = Number(v[i][C.TAX_RATE - 1]); if (r > 1) r = r / 100; if (v[i][C.TAX_ID - 1] && Math.abs(r - want) < 0.0001) return String(v[i][C.TAX_ID - 1]); }
  } catch (e) {}
  return '';
}

/* ============================================================
   CASH BOOK DAY-WISE + DSR ITEM-GROUP + PETTY CASH NOTE / VISIBILITY (2026-10-09)
   "cash book day wise total, click then details; bank deposit / transfer show or not by owner; petty cash note,
    who can see; item group wise revenue in DSR — all from the TRANSACTION DB (must match POS)".
   CASHBOOK_DAYWISE    { from, to }  → one row per business day: opening · cash sale · due collection (cash) · main cash in ·
                                       other in · bank deposit · main / petty transfer out · other out · closing.
       Source of truth: CASH_MOVEMENT (cash book) per category; a day with no CASH_SALE row uses PAYMENT_MASTER CASH of that
       day, a day with no DUE_COLLECTION_CASH row uses DUES_RECEIPT CASH. Opening = CASH_CONTROL opening of the first day
       (or the previous closing). posCash = PAYMENT_MASTER cash of that day → "diff" shows any cash-book ≠ POS day.
   CASHBOOK_DAY_DETAIL { date }      → that day's cash-book lines + cash bills + cash dues receipts.
   CASHBOOK_CFG_GET / _SAVE { showTransfers } → owner decides if bank deposits / transfers are visible to other roles.
   DSR_ITEM_GROUP      { from, to }  → BILL_ITEMS taxable (after discount) per day × ITEM_GROUP_NAME and per CATEGORY.
   PETTY_META_SAVE / _GET            → NOTE + VISIBILITY (ALL / OWNER) per petty-cash voucher (PETTY_CASH_META sheet).
   ============================================================ */
var BNX_CB_IN = { CASH_SALE: 'cashSale', DUE_COLLECTION_CASH: 'dueCash', MAIN_CASH_TRANSFER: 'mainIn' };
var BNX_CB_OUT = { BANK_CASH_DEPOSIT: 'bankDeposit', MAIN_CASH_TRANSFER: 'mainOut', PETTY_CASH_TRANSFER: 'pettyOut' };
function bnxCbOwner_(b) { return /OWNER|ADMIN|SUPER|DEVELOPER|MD|CEO/i.test(String(b.bnxRole || '')); }
function bnxCbCfgRead_(cid) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('CASHBOOK_CFG_' + cid) || '{}') || {}; } catch (e) { return {}; } }
function bnxCbCfg_(b, save) {
  try {
    var cid = bnxMcCid_(b), o = bnxCbCfgRead_(cid);
    if (save) {
      if (!bnxCbOwner_(b)) return { success: false, error: 'Only the owner / admin can change this' };
      if (b.showTransfers !== undefined) o.showTransfers = !!b.showTransfers;
      if (b.pettyOwnerOnly !== undefined) o.pettyOwnerOnly = !!b.pettyOwnerOnly;
      o.updatedBy = String(b.bnxUser || b.bnxRole || ''); o.updatedAt = new Date().toISOString();
      PropertiesService.getScriptProperties().setProperty('CASHBOOK_CFG_' + cid, JSON.stringify(o));
    }
    if (o.showTransfers === undefined) o.showTransfers = true;
    return { success: true, data: o };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
/* read only the needed columns of a sheet → array of objects (fast: one getRange per column block) */
function bnxCbRead_(sh, cols) {
  if (!sh || sh.getLastRow() < 2) return [];
  var C = bnxCrmCols_(sh), n = sh.getLastRow() - 1, data = {};
  cols.forEach(function (c) { if (C[c]) data[c] = sh.getRange(2, C[c], n, 1).getValues(); });
  var out = [];
  for (var i = 0; i < n; i++) { var o = {}; cols.forEach(function (c) { o[c] = data[c] ? data[c][i][0] : ''; }); out.push(o); }
  return out;
}
function bnxCbNum_(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function bnxCbDays_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required' };
    if (from > to) { var t = from; from = to; to = t; }
    var ck = 'cbd_' + cid + '_' + from + '_' + to, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return bnxCbView_(b, cid, h); } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true);
    var cmS = ss.getSheetByName('CASH_MOVEMENT'), ccS = ss.getSheetByName('CASH_CONTROL'), pmS = ss.getSheetByName('PAYMENT_MASTER'), drS = ss.getSheetByName('DUES_RECEIPT');
    var mv = bnxCbRead_(cmS, ['DATE', 'DIRECTION', 'CATEGORY', 'AMOUNT', 'STATUS', 'SOURCE_TYPE', 'DESCRIPTION']);
    /* 2026-11-14: a day that has owner cash-book rows (SOURCE_TYPE OWNER_CASH_BOOK) is read only from them — Event Costing
       cash rows of that day (06-11-2026 DJ ₹30,000 + HOTEL ₹3,500) were counted on top of the owner's petty-cash transfer. */
    var ownerDay = {}, notInBook = [];
    mv.forEach(function (r) { if (String(r.SOURCE_TYPE || '').toUpperCase() === 'OWNER_CASH_BOOK') { var d0 = bnxTlDay_(cmS, r.DATE); if (d0) ownerDay[d0] = 1; } });
    mv = mv.filter(function (r) {
      var d0 = bnxTlDay_(cmS, r.DATE);
      if (!ownerDay[d0] || String(r.SOURCE_TYPE || '').toUpperCase() === 'OWNER_CASH_BOOK') return true;
      if (!/VOID|CANCEL|DELETE/i.test(String(r.STATUS || '')) && notInBook.length < 50) notInBook.push({ date: d0, direction: String(r.DIRECTION || ''), category: String(r.CATEGORY || ''), text: String(r.DESCRIPTION || ''), amount: bnxCbNum_(r.AMOUNT), source: String(r.SOURCE_TYPE || '') });
      return false;
    });
    var cc = bnxCbRead_(ccS, ['BUSINESS_DATE', 'OPENING_CASH', 'CLOSING_CASH']);
    var pm = bnxCbRead_(pmS, ['PAYMENT_DATE', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_STATUS']);
    var dr = bnxCbRead_(drS, ['RECEIPT_DATE', 'PAYMENT_MODE', 'AMOUNT', 'STATUS']);
    var day = function (sh, v) { return bnxTlDay_(sh, v); };
    var D = {}, get = function (d) { return D[d] || (D[d] = { date: d, cashSale: 0, dueCash: 0, mainIn: 0, otherIn: 0, bankDeposit: 0, mainOut: 0, pettyOut: 0, otherOut: 0, posCash: 0, receiptCash: 0, hasSale: false, hasDue: false }); };
    var first = '';
    mv.forEach(function (r) {
      if (/VOID|CANCEL|DELETE/i.test(String(r.STATUS || ''))) return;
      var d = day(cmS, r.DATE); if (!d) return; if (!first || d < first) first = d;
      if (d < from || d > to) { if (d < from) get(d); }
      var x = get(d), a = bnxCbNum_(r.AMOUNT), cat = String(r.CATEGORY || '').toUpperCase(), dir = String(r.DIRECTION || '').toUpperCase();
      x.inBook = true;
      if (dir === 'IN') { var k = BNX_CB_IN[cat] || 'otherIn'; x[k] += a; if (cat === 'CASH_SALE') x.hasSale = true; if (cat === 'DUE_COLLECTION_CASH') x.hasDue = true; }
      else { x[BNX_CB_OUT[cat] || 'otherOut'] += a; }
    });
    pm.forEach(function (r) {
      if (String(r.PAYMENT_MODE || '').toUpperCase() !== 'CASH' || /VOID|REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || ''))) return;
      var d = day(pmS, r.PAYMENT_DATE); if (d) get(d).posCash += bnxCbNum_(r.AMOUNT);
    });
    dr.forEach(function (r) {
      if (String(r.PAYMENT_MODE || '').toUpperCase() !== 'CASH' || /VOID|DUPLICATE/i.test(String(r.STATUS || ''))) return;
      var d = day(drS, r.RECEIPT_DATE); if (d) get(d).receiptCash += bnxCbNum_(r.AMOUNT);
    });
    var CC = {}; cc.forEach(function (r) { var d = day(ccS, r.BUSINESS_DATE); if (d) CC[d] = { o: bnxCbNum_(r.OPENING_CASH), c: bnxCbNum_(r.CLOSING_CASH) }; });
    /* walk every day from the first cash-book day so the opening is always right */
    var start = first && first < from ? first : from, keys = Object.keys(CC).sort();
    if (keys.length && keys[0] < start) start = keys[0];
    var cur = new Date(start + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z'), bal = null, rows = [];
    while (cur <= end) {
      var d = cur.toISOString().slice(0, 10), x = get(d);
      /* a day not yet written in the cash book takes POS cash + cash receipts; a day that IS in the book keeps the book */
      if (!x.inBook && x.posCash) x.cashSale = x.posCash;
      if (!x.inBook && x.receiptCash) x.dueCash = x.receiptCash;
      if (bal === null) bal = CC[d] ? CC[d].o : 0;
      x.opening = Math.round(bal * 100) / 100;
      x.totalIn = x.cashSale + x.dueCash + x.mainIn + x.otherIn;
      x.totalOut = x.bankDeposit + x.mainOut + x.pettyOut + x.otherOut;
      bal = bal + x.totalIn - x.totalOut;
      x.closing = Math.round(bal * 100) / 100;
      x.diffPos = Math.round((x.cashSale - x.posCash) * 100) / 100;
      x.diffDue = Math.round((x.dueCash - x.receiptCash) * 100) / 100;
      if (d >= from) { delete x.hasSale; delete x.hasDue; delete x.inBook; rows.push(x); }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    var tot = { cashSale: 0, dueCash: 0, mainIn: 0, otherIn: 0, bankDeposit: 0, mainOut: 0, pettyOut: 0, otherOut: 0, posCash: 0, totalIn: 0, totalOut: 0 };
    rows.forEach(function (x) { Object.keys(tot).forEach(function (k) { tot[k] += x[k] || 0; }); });
    var res = { from: from, to: to, opening: rows.length ? rows[0].opening : 0, closing: rows.length ? rows[rows.length - 1].closing : 0, days: rows, total: tot,
      notInBook: notInBook.filter(function (x) { return x.date >= from && x.date <= to; }) };
    try { var txt = JSON.stringify(res); if (txt.length < 95000) cache.put(ck, txt, to < Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd') ? 1800 : 120); } catch (e) {}
    return bnxCbView_(b, cid, res);
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
/* owner switched "show bank deposit / transfers" off → other roles see only sale / collection lines; closing stays true */
function bnxCbView_(b, cid, res) {
  var cfg = bnxCbCfgRead_(cid), show = cfg.showTransfers !== false || bnxCbOwner_(b);
  if (!show) {
    res = JSON.parse(JSON.stringify(res));
    res.days.forEach(function (x) { x.transfersHidden = true; ['mainIn', 'bankDeposit', 'mainOut', 'pettyOut', 'totalIn', 'totalOut'].forEach(function (k) { x[k] = null; }); });
    ['mainIn', 'bankDeposit', 'mainOut', 'pettyOut', 'totalIn', 'totalOut'].forEach(function (k) { res.total[k] = null; });
  }
  res.showTransfers = cfg.showTransfers !== false; res.canSeeTransfers = show; res.isOwner = bnxCbOwner_(b);
  return { success: true, data: res };
}
function bnxCbDetail_(b) {
  try {
    var cid = bnxMcCid_(b), d0 = String(b.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d0)) return { success: false, error: 'Date required' };
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), cfg = bnxCbCfgRead_(cid), show = cfg.showTransfers !== false || bnxCbOwner_(b);
    var cmS = ss.getSheetByName('CASH_MOVEMENT'), pmS = ss.getSheetByName('PAYMENT_MASTER'), drS = ss.getSheetByName('DUES_RECEIPT'), bmS = ss.getSheetByName('BILL_MASTER');
    var lines = bnxCbRead_(cmS, ['DATE', 'DIRECTION', 'CATEGORY', 'DESCRIPTION', 'AMOUNT', 'REFERENCE', 'STATUS']).filter(function (r) { return bnxTlDay_(cmS, r.DATE) === d0 && !/VOID|CANCEL/i.test(String(r.STATUS || '')); })
      .filter(function (r) { return show || !(BNX_CB_OUT[String(r.CATEGORY).toUpperCase()] || String(r.CATEGORY).toUpperCase() === 'MAIN_CASH_TRANSFER'); })
      .map(function (r) { return { dir: String(r.DIRECTION || ''), category: String(r.CATEGORY || ''), text: String(r.DESCRIPTION || ''), amount: bnxCbNum_(r.AMOUNT), ref: String(r.REFERENCE || '') }; });
    var pays = bnxCbRead_(pmS, ['BILL_ID', 'PAYMENT_DATE', 'PAYMENT_TIME', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_STATUS']).filter(function (r) {
      return String(r.PAYMENT_MODE || '').toUpperCase() === 'CASH' && !/VOID|REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || '')) && bnxTlDay_(pmS, r.PAYMENT_DATE) === d0; });
    var want = {}; pays.forEach(function (r) { want[String(r.BILL_ID)] = 1; });
    var bm = bnxTlRowsFor_(bmS, 'BILL_ID', want);
    var bills = pays.map(function (r) { var x = (bm[String(r.BILL_ID)] || [])[0] || {};
      return { billNo: String(x.BILL_NUMBER || r.BILL_ID), time: bnxTlStr_(pmS, r.PAYMENT_TIME, 'HH:mm'), table: String(x.TABLE_ID || ''), customer: String(x.CUSTOMER_NAME || ''), billTotal: bnxCbNum_(x.GRAND_TOTAL), cash: bnxCbNum_(r.AMOUNT) }; })
      .sort(function (a, c) { return a.time < c.time ? -1 : 1; });
    var rec = bnxCbRead_(drS, ['RECEIPT_DATE', 'CUSTOMER_NAME', 'AMOUNT', 'PAYMENT_MODE', 'NARRATION', 'REFERENCE', 'STATUS']).filter(function (r) {
      return String(r.PAYMENT_MODE || '').toUpperCase() === 'CASH' && !/VOID|DUPLICATE/i.test(String(r.STATUS || '')) && bnxTlDay_(drS, r.RECEIPT_DATE) === d0; })
      .map(function (r) { return { customer: String(r.CUSTOMER_NAME || ''), amount: bnxCbNum_(r.AMOUNT), note: String(r.NARRATION || r.REFERENCE || '') }; });
    return { success: true, data: { date: d0, lines: lines, bills: bills, receipts: rec, transfersHidden: !show } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxDsrGroups_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required' };
    if (from > to) { var t = from; from = to; to = t; }
    var ck = 'dsrg_' + cid + '_' + from + '_' + to, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return { success: true, data: h }; } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), bmS = ss.getSheetByName('BILL_MASTER'), biS = ss.getSheetByName('BILL_ITEMS');
    var bm = bnxCbRead_(bmS, ['BILL_ID', 'BILL_DATE', 'BILL_STATUS', 'GRAND_TOTAL']), B = {};
    bm.forEach(function (r) { var d = bnxTlDay_(bmS, r.BILL_DATE); if (d >= from && d <= to && !/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) B[String(r.BILL_ID)] = d; });
    var it = bnxCbRead_(biS, ['BILL_ID', 'ITEM_GROUP_NAME', 'CATEGORY', 'QUANTITY', 'TAXABLE_PER_ITEM', 'TAX_PER_ITEM', 'LINE_TOTAL']);
    var days = {}, groups = {}, cats = {};
    it.forEach(function (r) {
      var d = B[String(r.BILL_ID)]; if (!d) return;
      var g = String(r.ITEM_GROUP_NAME || 'OTHER').trim().toUpperCase() || 'OTHER', c = String(r.CATEGORY || 'OTHER').trim().toUpperCase() || 'OTHER';
      var tx = bnxCbNum_(r.TAXABLE_PER_ITEM); if (!tx && bnxCbNum_(r.LINE_TOTAL)) tx = bnxCbNum_(r.LINE_TOTAL) - bnxCbNum_(r.TAX_PER_ITEM);
      var q = bnxCbNum_(r.QUANTITY);
      var x = days[d] || (days[d] = { date: d, groups: {}, total: 0, tax: 0 }); x.groups[g] = (x.groups[g] || 0) + tx; x.total += tx; x.tax += bnxCbNum_(r.TAX_PER_ITEM);
      var G = groups[g] || (groups[g] = { group: g, amount: 0, qty: 0 }); G.amount += tx; G.qty += q;
      var k = g + '|' + c, K = cats[k] || (cats[k] = { group: g, category: c, amount: 0, qty: 0 }); K.amount += tx; K.qty += q;
    });
    var r2 = function (n) { return Math.round(n * 100) / 100; };
    var res = { from: from, to: to,
      groups: Object.keys(groups).map(function (k) { groups[k].amount = r2(groups[k].amount); return groups[k]; }).sort(function (a, c) { return c.amount - a.amount; }),
      categories: Object.keys(cats).map(function (k) { cats[k].amount = r2(cats[k].amount); return cats[k]; }).sort(function (a, c) { return c.amount - a.amount; }),
      days: Object.keys(days).sort().map(function (k) { var x = days[k]; Object.keys(x.groups).forEach(function (g) { x.groups[g] = r2(x.groups[g]); }); x.total = r2(x.total); x.tax = r2(x.tax); return x; }) };
    res.total = r2(res.groups.reduce(function (s, g) { return s + g.amount; }, 0));
    try { var txt = JSON.stringify(res); if (txt.length < 95000) cache.put(ck, txt, to < Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd') ? 1800 : 180); } catch (e) {}
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxPcMetaSheet_(cid) {
  var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), sh = ss.getSheetByName('PETTY_CASH_META');
  if (!sh) { sh = ss.insertSheet('PETTY_CASH_META'); sh.getRange(1, 1, 1, 7).setValues([['VOUCHER_NO', 'CLIENT_ID', 'NOTE', 'VISIBILITY', 'UPDATED_BY', 'UPDATED_AT', 'AMOUNT']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function bnxPcMetaSave_(b) {
  try {
    var cid = bnxMcCid_(b), vno = String(b.voucherNo || '').trim(); if (!vno) return { success: false, error: 'Voucher no. missing' };
    var vis = /OWNER/i.test(String(b.visibility || '')) ? 'OWNER' : 'ALL';
    if (vis === 'OWNER' && !bnxCbOwner_(b) && !/MANAGER|ACCOUNT/i.test(String(b.bnxRole || ''))) vis = 'ALL';
    var lk = bnxSoftLock_('pcm_' + cid, 8000);
    try {
      var sh = bnxPcMetaSheet_(cid), n = sh.getLastRow() - 1, row = 0;
      if (n > 0) { var v = sh.getRange(2, 1, n, 1).getValues(); for (var i = 0; i < n; i++) if (String(v[i][0]).trim() === vno) { row = i + 2; break; } }
      var vals = [[vno, cid, String(b.note || '').slice(0, 500), vis, String(b.bnxUser || b.bnxRole || ''), bnxMpNowFor_(sh), Number(b.amount || 0)]];
      if (row) sh.getRange(row, 1, 1, 7).setValues(vals); else sh.getRange(sh.getLastRow() + 1, 1, 1, 7).setValues(vals);
    } finally { try { lk && lk.release && lk.release(); } catch (e) {} }
    return { success: true, data: { voucherNo: vno, visibility: vis } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxPcMetaGet_(b) {
  try {
    var cid = bnxMcCid_(b), sh = bnxPcMetaSheet_(cid), out = {}, cfg = bnxCbCfgRead_(cid);
    var can = bnxCbOwner_(b) || /MANAGER|ACCOUNT/i.test(String(b.bnxRole || ''));
    /* an owner-only entry's note never leaves the server for other roles — they only learn the row is hidden */
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) { if (!r[0]) return; var vis = String(r[3] || 'ALL');
      out[String(r[0]).trim()] = { note: (vis === 'OWNER' && !can) ? '' : String(r[2] || ''), visibility: vis }; });
    return { success: true, data: { meta: out, canSeeOwnerOnly: can, pettyOwnerOnly: !!cfg.pettyOwnerOnly } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* Run from the editor after saving. Apps Script loads files TOP → BOTTOM and, when two files define the same
   function, the LOWER one wins — an old file below a new one silently brings the old code back.
   This checks every part that matters and says which file is winning and what to delete / move. */
function bnxMenuPromoCheck() {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var src = function (n) { try { return typeof G[n] === 'function' ? String(G[n]) : ''; } catch (e) { return ''; } };
  var rows = [], bad = 0;
  function chk(label, ok, fix) { rows.push((ok ? '✅ ' : '❌ ') + label + (ok ? '' : '\n      → ' + fix)); if (!ok) bad++; }
  chk('menu-card-qr-promo.gs is LAST and wraps doPost', !!(G.doPost && G.doPost.__bnxMp),
      'move "Menu card qr promo.gs" to the BOTTOM of the file list (⋮ → Move file down), or add  var __mp = bnxMpHandle_(e); if (__mp) return __mp;  as the first lines of doPost');
  chk('doGet serves GUEST_CHECKIN + BNX_WHOAMI (new)', /GUEST_CHECKIN/.test(src('doGet')) && /BNX_WHOAMI/.test(src('doGet')),
      'another file below defines doGet — the old menu-card file ("Menucarddrive_public.gs"?) — delete it');
  chk('public menu sends video + events (new)', /bnxQrpPublic_\(/.test(src('bnxPublicMenu_')) && /state/.test(src('bnxQrpPublic_')),
      'an older bnxPublicMenu_ / bnxQrpPublic_ wins — delete "Menucarddrive_public.gs" and "BNX_QR_PROMOTION_BACKEND.gs"');
  chk('video replace + chunk upload (new)', /bnxQrpTrashOwn_/.test(src('bnxQrpSaveVideo_')) && typeof G.bnxQrpUploadChunk_ === 'function',
      'old "BNX_QR_PROMOTION_BACKEND.gs" wins — delete it');
  chk('guest check-in / WhatsApp welcome (new)', /_noCreate/.test(src('bnxCustomerCheckin_')) && /metaWa_|configured/.test(src('bnxSendWelcome_')),
      'old "Crm backend.gs" (or "Happyserve crm.gs") is BELOW "Guest crm welcome.gs" and wins — delete the old CRM file');
  chk('spreadsheets stay in CLIENT_DATABASES (new)', /noCreate/.test(src('bnxCrmSpreadsheet_')),
      'old CRM file wins (bnxCrmSpreadsheet_) — delete it');
  chk('approval control v2 installed', typeof G.bnxApprovalCheckAction_ === 'function' && /APV_PARAMS|bnxApvParamsFor_/.test(src('bnxApprovalRoute_')),
      'add / replace "Bill approvals.gs" with the v2 file');
  chk('Drive root = your CLIENT_DATABASES', /1u2yVJCgH2EwLAP950l_97vo5Ckx9cgL7|MC_ROOT_FOLDER_DEFAULT/.test(src('bnxMcRootFolder_')),
      'an older bnxMcRootFolder_ wins — delete the old menu-card file');
  var live = '';
  if (G.doPost && G.doPost.__bnxMp) {
    try {
      var txt = G.doPost({ postData: { contents: JSON.stringify({ action: 'QR_PROMO_GET', clientId: 'CL00010', sessionToken: '00000000-0000-4000-8000-000000000000' }) } }).getContent();
      live = /"success":true/.test(txt) ? '✅ QR_PROMO_GET answered through doPost' : '⚠️ QR_PROMO_GET: ' + txt.slice(0, 200);
    } catch (e) { live = '⚠️ ' + e.message; }
  }
  Logger.log('\n' + rows.join('\n') + (live ? '\n' + live : '') + '\n\n' +
    (bad ? bad + ' problem(s) — fix them, Save, run this again.' : 'ALL GOOD.') +
    '\nThen: Deploy > Manage deployments > pencil > Version: NEW VERSION > Deploy, and open  <your /exec URL>?action=BNX_WHOAMI  to confirm the live version.');
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
  Logger.log('ITEM PHOTOS ' + bnxMcSubFolder_(clientId, 'assets/item-images').getUrl());
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

/* ============================================================
   GUEST CAPTURE + WHATSAPP CONTROL (2026-10-09) — restaurant dashboard → Settings → Table QR
   GUEST_CTL_GET / _SAVE { waAuto, waGuest, cm, crm } (1 = Yes, 0 = No)   → script property GUEST_CTL_<cid>
   WA_SETUP_GET / _SAVE  { provider, phoneId, token, template, lang, welcomeText, guestNumber, smsProvider, fast2smsKey }
                         → per-client script properties (WA_PROVIDER_<cid> …) read by bnxSendWelcome_ / the QR page
   WA_TEST { mobile }    → sends the welcome to one number now and returns the provider answer
   Only owner / admin / manager may save. Tokens never come back to the browser (masked).
   ============================================================ */
function bnxGcCan_(b) { return /OWNER|ADMIN|SUPER|DEVELOPER|MANAGER|\bMD\b|CEO/i.test(String(b.bnxRole || '')); }
function bnxGcGet_(b) {
  try { var cid = bnxMcCid_(b); return { success: true, data: bnxGuestCtl_(cid) }; } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxGcSave_(b) {
  try {
    var cid = bnxMcCid_(b); if (!bnxGcCan_(b)) return { success: false, error: 'Only owner / admin / manager can change this' };
    var P = PropertiesService.getScriptProperties(), o = {};
    try { o = JSON.parse(P.getProperty('GUEST_CTL_' + cid) || '{}') || {}; } catch (e) { o = {}; }
    ['waAuto', 'waGuest', 'cm', 'crm'].forEach(function (k) { if (b[k] === 0 || b[k] === 1 || b[k] === '0' || b[k] === '1' || b[k] === true || b[k] === false) o[k] = (b[k] === 1 || b[k] === '1' || b[k] === true) ? 1 : 0; });
    o.updatedBy = String(b.bnxUser || b.bnxRole || ''); o.updatedAt = new Date().toISOString();
    P.setProperty('GUEST_CTL_' + cid, JSON.stringify(o));
    return { success: true, data: bnxGuestCtl_(cid) };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
var BNX_WA_KEYS = { provider: 'WA_PROVIDER', phoneId: 'META_WA_PHONE_ID', token: 'META_WA_TOKEN', template: 'META_WA_TEMPLATE', lang: 'META_WA_LANG',
  welcomeText: 'WELCOME_TEXT', guestNumber: 'WA_GUEST_NUMBER', smsProvider: 'SMS_PROVIDER', fast2smsKey: 'FAST2SMS_KEY' };
function bnxWaSetup_(b, save) {
  try {
    var cid = bnxMcCid_(b), P = PropertiesService.getScriptProperties();
    if (save) {
      if (!bnxGcCan_(b)) return { success: false, error: 'Only owner / admin / manager can change WhatsApp setup' };
      Object.keys(BNX_WA_KEYS).forEach(function (k) {
        if (b[k] === undefined || b[k] === null) return;
        var v = String(b[k]).trim();
        if ((k === 'token' || k === 'fast2smsKey') && (v === '' || /^\*+/.test(v) || /•/.test(v))) return;   /* masked / empty = keep */
        if (k === 'provider' || k === 'smsProvider') v = v.toUpperCase();
        if (k === 'guestNumber') v = v.replace(/\D/g, '').slice(-10);
        if (v === '') P.deleteProperty(BNX_WA_KEYS[k] + '_' + cid); else P.setProperty(BNX_WA_KEYS[k] + '_' + cid, v.slice(0, 1000));
      });
      bnxMcClearPublicCache_(cid);   /* customer QR page re-reads the new WhatsApp number at once */
    }
    var pr = function (k) { return (P.getProperty(k + '_' + cid) || P.getProperty(k) || ''); };
    var mask = function (v) { v = String(v || ''); return v ? '••••' + v.slice(-4) : ''; };
    var prov = String(pr('WA_PROVIDER') || 'NONE').toUpperCase();
    var ready = prov === 'META' ? !!(pr('META_WA_TOKEN') && pr('META_WA_PHONE_ID')) : prov === 'TWILIO' ? !!(pr('TWILIO_SID') && pr('TWILIO_TOKEN')) : false;
    var log = [];
    try {
      var sh = bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid, true), n = sh.getLastRow();
      if (n > 1) { var C = bnxCrmCols_(sh), k0 = Math.max(2, n - 9), vals = sh.getRange(k0, 1, n - k0 + 1, sh.getLastColumn()).getDisplayValues();
        vals.reverse().forEach(function (r) { log.push({ time: r[(C.TIME || 1) - 1], mobile: String(r[(C.MOBILE || 2) - 1]).replace(/\d(?=\d{2})/g, 'x'), channel: r[(C.CHANNEL || 3) - 1], result: String(r[(C.RESULT || 4) - 1]).slice(0, 120) }); }); }
    } catch (e) {}
    return { success: true, data: { provider: prov, phoneId: pr('META_WA_PHONE_ID'), token: mask(pr('META_WA_TOKEN')), template: pr('META_WA_TEMPLATE') || 'guest_welcome', lang: pr('META_WA_LANG') || 'en',
      welcomeText: pr('WELCOME_TEXT'), guestNumber: pr('WA_GUEST_NUMBER'), smsProvider: String(pr('SMS_PROVIDER') || 'NONE').toUpperCase(), fast2smsKey: mask(pr('FAST2SMS_KEY')),
      apiReady: ready, smsReady: String(pr('SMS_PROVIDER')).toUpperCase() === 'FAST2SMS' && !!pr('FAST2SMS_KEY'), log: log, ctl: bnxGuestCtl_(cid) } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}
function bnxWaTest_(b) {
  try {
    var cid = bnxMcCid_(b); if (!bnxGcCan_(b)) return { success: false, error: 'Only owner / admin / manager can send a test' };
    var m = String(b.mobile || '').replace(/\D/g, '').slice(-10); if (!/^[6-9]\d{9}$/.test(m)) return { success: false, error: 'Enter a valid 10-digit mobile' };
    var r = bnxSendWelcome_(m, String(b.name || 'Test'), cid, 'TEST');
    return { success: !!r.ok, data: r, error: r.ok ? '' : (r.configured ? 'Provider refused — see the last line in the log below' : 'No WhatsApp / SMS provider set up yet') };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* ============================================================
   DASH_FIN { from, to } (2026-10-09) — the dashboard's Payment Collection · Cash Position · Receivables panels
   straight from the client TRANSACTION DB (same numbers as the owner DSR / cash book / dues sheet):
   • collections = PAYMENT_MASTER by mode for bills of the period (cancelled bills / void payments left out)
   • cash        = CASHBOOK_DAYWISE (CASH_MOVEMENT + CASH_CONTROL)
   • receivables = CUSTOMER_DUES current total rolled back with SALES_LEDGER (credit) and DUES_RECEIPT (cash / bank / CN)
   ============================================================ */
function bnxMpDashFin_(b) {   /* 2026-11-14: renamed — Code.gs has bnxDashFin_(session, payload); same name = the lower file silently replaced the other */
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required' };
    if (from > to) { var t0 = from; from = to; to = t0; }
    var ck = 'dfin_' + cid + '_' + from + '_' + to, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return { success: true, data: h }; } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), N = bnxCbNum_;
    var bmS = ss.getSheetByName('BILL_MASTER'), pmS = ss.getSheetByName('PAYMENT_MASTER'), slS = ss.getSheetByName('SALES_LEDGER'),
        drS = ss.getSheetByName('DUES_RECEIPT'), cdS = ss.getSheetByName('CUSTOMER_DUES');
    var bills = {}, sale = { net: 0, tax: 0, bills: 0 };
    bnxCbRead_(bmS, ['BILL_ID', 'BILL_DATE', 'BILL_STATUS', 'GRAND_TOTAL', 'TAX_AMOUNT']).forEach(function (r) {
      if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return;
      var d = bnxTlDay_(bmS, r.BILL_DATE); if (d < from || d > to) return;
      bills[String(r.BILL_ID)] = 1; sale.net += N(r.GRAND_TOTAL); sale.tax += N(r.TAX_AMOUNT); if (N(r.GRAND_TOTAL) > 0) sale.bills++;
    });
    var pay = { cash: 0, upi: 0, card: 0, zomato: 0, swiggy: 0, credit: 0, nc: 0 };
    bnxCbRead_(pmS, ['BILL_ID', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_STATUS']).forEach(function (r) {
      if (!bills[String(r.BILL_ID)] || /VOID|REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || ''))) return;
      var m = String(r.PAYMENT_MODE || '').toUpperCase(), a = N(r.AMOUNT);
      if (m === 'CASH') pay.cash += a; else if (m === 'CARD' || m === 'BANK') pay.card += a; else if (m === 'ZOMATO') pay.zomato += a;
      else if (m === 'SWIGGY') pay.swiggy += a; else if (m === 'CREDIT') pay.credit += a; else if (m === 'NC') pay.nc += a; else pay.upi += a;
    });
    var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
    var cr = { inR: 0, after: 0 }, rc = { cashR: 0, bankR: 0, cnR: 0, after: 0, last: '', lastAmt: 0 };
    bnxCbRead_(slS, ['BUSINESS_DATE', 'AMOUNT', 'BILL_ID']).forEach(function (r) {
      var d = bnxTlDay_(slS, r.BUSINESS_DATE); if (!d) return;
      if (d >= from && d <= to) cr.inR += N(r.AMOUNT); else if (d > to) cr.after += N(r.AMOUNT);
    });
    bnxCbRead_(drS, ['RECEIPT_DATE', 'AMOUNT', 'PAYMENT_MODE', 'STATUS']).forEach(function (r) {
      if (/VOID|DUPLICATE|CANCEL/i.test(String(r.STATUS || ''))) return;
      var d = bnxTlDay_(drS, r.RECEIPT_DATE), a = N(r.AMOUNT), m = String(r.PAYMENT_MODE || '').toUpperCase(); if (!d) return;
      if (d >= from && d <= to) { if (m === 'DUES_DISCOUNT') rc.cnR += a; else if (m === 'CASH') rc.cashR += a; else rc.bankR += a; }
      else if (d > to) rc.after += a;
      if (d <= to && m !== 'DUES_DISCOUNT' && d >= rc.last) { rc.last = d; rc.lastAmt = a; }
    });
    var cur = 0, cust = 0;
    bnxCbRead_(cdS, ['CURRENT_BALANCE', 'STATUS']).forEach(function (r) { if (/MERGED/i.test(String(r.STATUS || ''))) return; var v = N(r.CURRENT_BALANCE); if (Math.abs(v) < 1) v = 0; cur += v; if (v > 0.5) cust++; });
    var closing = cur - cr.after + rc.after;                            /* roll the live balance back to the end of the period */
    var opening = closing - cr.inR + rc.cashR + rc.bankR + rc.cnR;
    var cb = bnxCbDays_({ clientId: cid, from: from, to: to, force: b.force, bnxRole: 'OWNER' });
    var cash = null;
    if (cb && cb.success) { var T = cb.data.total; cash = { opening: cb.data.opening, closing: cb.data.closing, cashSale: T.cashSale, dueCash: T.dueCash, mainIn: T.mainIn, otherIn: T.otherIn,
      bankDeposit: T.bankDeposit, mainOut: T.mainOut, pettyOut: T.pettyOut, otherOut: T.otherOut, posCash: T.posCash }; }
    var r2 = function (n) { return Math.round(n * 100) / 100; };
    Object.keys(pay).forEach(function (k) { pay[k] = r2(pay[k]); });
    var res = { from: from, to: to, sale: { net: r2(sale.net), tax: r2(sale.tax), gross: r2(sale.net - sale.tax), bills: sale.bills }, pay: pay,
      collection: r2(pay.cash + pay.upi + pay.card + pay.zomato + pay.swiggy),
      recv: { opening: r2(opening), credit: r2(cr.inR), dueCash: r2(rc.cashR), dueBank: r2(rc.bankR), cn: r2(rc.cnR), closing: r2(closing), current: r2(cur),
        customers: cust, lastReceipt: rc.last, lastReceiptAmt: r2(rc.lastAmt) }, cash: cash, asOf: today };
    try { cache.put(ck, JSON.stringify(res), to < today ? 900 : 120); } catch (e) {}
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* ============================================================
   DUES_LIST (2026-10-09, "outstanding on Customer Credit ≠ dashboard") — Customer Credit / Due Collection list
   straight from CUSTOMER_DUES.CURRENT_BALANCE (the owner Dues sheet total, same figure as the dashboard Closing
   Due). Ageing / old balance come from CUSTOMER_DUES_BILLWISE (bill dates), newest bills hold the balance.
   Same shape as GET_DUE_COLLECTION, so every page that reads that call shows these figures.
   ============================================================ */
function bnxDuesList_(b) {
  try {
    var cid = bnxMcCid_(b), ck = 'dues_' + cid, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return { success: true, data: h }; } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), N = bnxCbNum_;
    var cdS = ss.getSheetByName('CUSTOMER_DUES'), bwS = ss.getSheetByName('CUSTOMER_DUES_BILLWISE'), drS = ss.getSheetByName('DUES_RECEIPT'),
        slS = ss.getSheetByName('SALES_LEDGER');
    if (!cdS) return { success: false, error: 'CUSTOMER_DUES sheet missing' };
    var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
    var dayN = function (d) { return d ? Math.round((new Date(today + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000) : 0; };
    var nm = function (v) { return String(v || '').trim().replace(/\s+/g, ' ').toUpperCase(); };
    var prof = {};
    try {
      var ms = bnxCrmSpreadsheet_(cid, 'MASTER', true), cmS = ms.getSheetByName('CUSTOMER_MASTER');
      bnxCbRead_(cmS, ['CUSTOMER_ID', 'CUSTOMER_NAME', 'PHONE', 'GSTIN', 'CUSTOMER_TYPE', 'CREDIT_LIMIT']).forEach(function (r) {
        var o = { phone: String(r.PHONE || '').replace(/\.0$/, ''), gstin: String(r.GSTIN || ''), type: String(r.CUSTOMER_TYPE || '') || 'Individual', creditLimit: N(r.CREDIT_LIMIT) };
        if (r.CUSTOMER_ID) prof[String(r.CUSTOMER_ID)] = o; if (r.CUSTOMER_NAME && !prof['n:' + nm(r.CUSTOMER_NAME)]) prof['n:' + nm(r.CUSTOMER_NAME)] = o;
      });
    } catch (e) {}
    var C = {}, byName = {}, merged = {};
    bnxCbRead_(cdS, ['CUSTOMER_ID', 'CUSTOMER_NAME', 'OPENING_BALANCE', 'CURRENT_BALANCE', 'STATUS', 'OPENING_DATE', 'LAST_TRANSACTION_DATE']).forEach(function (r) {
      var id = String(r.CUSTOMER_ID || '') || (nm(r.CUSTOMER_NAME) ? 'NOID:' + nm(r.CUSTOMER_NAME) : ''); if (!id) return;   /* 2026-11-14: a dues row without CUSTOMER_ID was dropped (₹1,05,692 missing from the total) */
      if (/MERGED/i.test(String(r.STATUS || ''))) { merged[id] = nm(r.CUSTOMER_NAME); return; }
      var p = prof[id] || prof['n:' + nm(r.CUSTOMER_NAME)] || {};
      C[id] = { customerId: id, customer: String(r.CUSTOMER_NAME || id), phone: p.phone || '', gstin: p.gstin || '', type: p.type || 'Individual', creditLimit: p.creditLimit || 0,
        outstanding: Math.abs(N(r.CURRENT_BALANCE)) < 1 ? 0 : N(r.CURRENT_BALANCE), opening: N(r.OPENING_BALANCE), openingDate: bnxTlDay_(cdS, r.OPENING_DATE) || '2026-03-31',
        lastTxn: bnxTlDay_(cdS, r.LAST_TRANSACTION_DATE), bills: [], lastBillDate: '', lastPaymentDate: '', lastPaymentAmount: 0, group: '' };
      byName[nm(r.CUSTOMER_NAME)] = id;
    });
    var own = function (id, name) { if (C[id]) return id; var n = merged[id] || nm(name); return byName[n] || ''; };
    var bwMax = '';
    bnxCbRead_(bwS, ['CUSTOMER_ID', 'PARTY', 'DATE', 'BILL', 'AMOUNT', 'DUES', 'GROUP']).forEach(function (r) {
      var id = own(String(r.CUSTOMER_ID || ''), r.PARTY); if (!id) return;
      var d = bnxTlDay_(bwS, r.DATE), due = N(r.DUES); if (d > bwMax) bwMax = d;
      if (r.GROUP && !C[id].group) C[id].group = String(r.GROUP).trim().replace(/\s+/g, ' ').toUpperCase();
      if (due > 0.005) C[id].bills.push({ billNo: String(r.BILL || ''), date: d, amount: N(r.AMOUNT), due: due });
      if (d > C[id].lastBillDate) C[id].lastBillDate = d;
    });
    var rcpt = [], rcvToday = 0;
    bnxCbRead_(drS, ['CUSTOMER_ID', 'CUSTOMER_NAME', 'AMOUNT', 'PAYMENT_MODE', 'RECEIPT_DATE', 'RECEIPT_TIME', 'VOUCHER_NO', 'CREATED_BY', 'STATUS']).forEach(function (r) {
      if (/VOID|DUPLICATE|CANCEL/i.test(String(r.STATUS || ''))) return;
      var m = String(r.PAYMENT_MODE || '').toUpperCase(); if (m === 'DUES_DISCOUNT') return;
      var id = own(String(r.CUSTOMER_ID || ''), r.CUSTOMER_NAME), d = bnxTlDay_(drS, r.RECEIPT_DATE), a = N(r.AMOUNT);
      if (id && d >= C[id].lastPaymentDate) { C[id].lastPaymentDate = d; C[id].lastPaymentAmount = a; }
      if (d === today) { rcvToday += a; rcpt.push({ voucherNo: String(r.VOUCHER_NO || ''), customer: id ? C[id].customer : String(r.CUSTOMER_NAME || ''), customerId: id, amount: a, mode: m,
        time: String(r.RECEIPT_TIME || '').slice(0, 5), by: String(r.CREATED_BY || '') }); }
    });
    var r2 = function (n) { return Math.round(n * 100) / 100; }, tot = { o: 0, od: 0, n: 0, ag: { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 } };
    var list = Object.keys(C).map(function (id) {
      var c = C[id], left = Math.max(0, c.outstanding), ag = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 }, oldR = 0, oldest = '', open = 0;
      c.bills.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : 0; });                 /* newest first: receipts clear the oldest bills */
      var put = function (d, a) { var n = dayN(d); if (n > 90) ag.d90p += a; else if (n > 60) ag.d61_90 += a; else if (n > 30) ag.d31_60 += a; else ag.d0_30 += a;
        if (d && d <= c.openingDate) oldR += a; if (!oldest || (d && d < oldest)) oldest = d; open++; };
      var sumB = c.bills.reduce(function (s, x) { return s + x.due; }, 0);
      if (left > sumB + 0.5) put(c.lastTxn && c.lastTxn > bwMax ? c.lastTxn : today, left - sumB);                   /* newer than the bill-wise sheet */
      left = Math.min(left, sumB + 0.5);
      c.bills.forEach(function (x) { if (left <= 0.005) return; var a = Math.min(left, x.due); left -= a; x.open = r2(a); put(x.date, a); });
      if (!c.bills.length && c.outstanding > 0.005 && !open) put(c.lastTxn || c.openingDate, c.outstanding);
      Object.keys(ag).forEach(function (k) { ag[k] = r2(ag[k]); });
      var o = r2(c.outstanding), od = c.outstanding > 0.005 ? r2(ag.d31_60 + ag.d61_90 + ag.d90p) : 0;
      if (o > 0.005) { tot.n++; tot.od += od; Object.keys(ag).forEach(function (k) { tot.ag[k] += ag[k]; }); }
      tot.o += o;
      return { customerId: id, customer: c.customer, phone: c.phone, gstin: c.gstin, type: c.type, creditLimit: c.creditLimit, group: c.group,
        outstanding: o, opening: r2(c.opening), openingRemaining: o > 0 ? r2(oldR) : 0, billsDue: o > 0 ? r2(o - oldR) : 0, openBills: o > 0 ? open : 0,
        aging: ag, overdueDays: o > 0.005 && oldest ? dayN(oldest) : 0, lastBillDate: c.lastBillDate, lastPaymentDate: c.lastPaymentDate, lastPaymentAmount: r2(c.lastPaymentAmount),
        overLimit: !!(c.creditLimit && o > c.creditLimit), bills: c.bills.filter(function (x) { return x.open > 0; }).map(function (x) { return { billNo: x.billNo, date: x.date, amount: x.amount, due: x.open }; }),
        source: 'CUSTOMER_DUES' };
    }).sort(function (a, b2) { return b2.outstanding - a.outstanding; });
    Object.keys(tot.ag).forEach(function (k) { tot.ag[k] = r2(tot.ag[k]); });
    var res = { customers: list, totalOutstanding: r2(tot.o), overdue30Plus: r2(tot.od), activeCustomers: tot.n, aging: tot.ag, receivedToday: r2(rcvToday),
      paymentsToday: rcpt.length, netOutstanding: r2(tot.o - rcvToday), receiptsToday: rcpt, asOf: today, source: 'CUSTOMER_DUES', build: 'GS-2026.10.09-v18' };
    try { var txt = JSON.stringify(res); if (txt.length < 95000) cache.put(ck, txt, 60); } catch (e) {}
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* ============================================================
   POS_IMPORT { bills:[{h:{…bill head…}, items:[…item lines…]}], mode:'skip'|'replace', dryRun } (2026-10-09)
   Import Hub → upload the POS export (Bill Head + Item Wise) → saved straight into the TRANSACTION DB the same way
   the reconciled data is kept:
   • BILL_MASTER   one row per bill (gross, discount, taxable, tax, service charge, round off, net = POS net amount)
   • BILL_ITEMS    item lines; ITEM / CATEGORY / ITEM_GROUP from MASTER_DB (ITEM_MASTER + ITEM_ALIAS_MASTER);
                   taxable per group = bill-head food / bar / beverage / tobacco after discount (DSR groups match exactly)
   • PAYMENT_MASTER cash · card · UPI (online / smart card / bank) · Zomato · Swiggy · credit, one row per mode
   • SALES_LEDGER  credit sales;  CUSTOMER_DUES (+ CUSTOMER_DUES_BILLWISE) balance goes up by the credit
   • MASTER_DB     new POS items → ITEM_MASTER (MENU_ACTIVE FALSE) + alias;  new credit customer → CUSTOMER_MASTER
   Bills already in BILL_MASTER (same bill number) are skipped, or rewritten with mode 'replace'.
   dryRun = check only, nothing written.
   ============================================================ */
function bnxPosImport_(b) {
  var lock = null;
  try {
    if (!/OWNER|ADMIN|MANAGER|ACCOUNT|DEVELOPER|SUPER/i.test(String(b.bnxRole || ''))) return { success: false, error: 'Only owner / admin / manager / accountant can import bills' };
    var cid = bnxMcCid_(b), dry = !!b.dryRun, mode = b.mode === 'replace' ? 'replace' : 'skip';
    var bills = b.bills; if (typeof bills === 'string') { try { bills = JSON.parse(bills); } catch (e) { bills = []; } }
    if (!Array.isArray(bills) || !bills.length) return { success: false, error: 'No bills in the file' };
    if (bills.length > 400) return { success: false, error: 'Send at most 400 bills per call' };
    if (!dry) { lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { success: false, error: 'Another import is running — try again in a minute' }; }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), ms = bnxCrmSpreadsheet_(cid, 'MASTER', true), N = bnxCbNum_;
    var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
    var nk = function (s) { return String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, ''); };
    var ck = function (s) { return nk(String(s || '').toUpperCase().replace(/^\s*(MR|MRS|MS|MISS|DR|SHRI|SMT)\.?\s+/, '')); };
    var bmS = ss.getSheetByName('BILL_MASTER'), biS = ss.getSheetByName('BILL_ITEMS'), pmS = ss.getSheetByName('PAYMENT_MASTER'),
        slS = ss.getSheetByName('SALES_LEDGER'), cdS = ss.getSheetByName('CUSTOMER_DUES'), bwS = ss.getSheetByName('CUSTOMER_DUES_BILLWISE');
    if (!bmS || !biS || !pmS) return { success: false, error: 'BILL_MASTER / BILL_ITEMS / PAYMENT_MASTER sheet missing in the TRANSACTION DB' };
    var tzT = bnxCrmSheetTz_(bmS);
    var when = function (s) {                                                    /* POS wall-clock text → Date showing the same clock in the sheet */
      var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/); if (!m) return '';
      return Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00'), tzT, 'yyyy-MM-dd HH:mm:ss');
    };
    var dayD = function (d) { return Utilities.parseDate(d + ' 00:00:00', tzT, 'yyyy-MM-dd HH:mm:ss'); };

    /* ---------- MASTER_DB: items, groups, categories, payment modes, customers ---------- */
    var grpName = {}, grpOf = {}, catName = {}, catFor = {}, items = {}, maxItm = 0, maxAl = 0, maxCus = 0;
    var vgOf = function (gname) { var g = String(gname || '').toUpperCase(); return /LIQUOR|BAR|WINE|BEER/.test(g) ? 'BAR' : /BEVERAGE|DRINK/.test(g) ? 'BEVERAGE' : /TOBACCO|HUKKA|HOOKAH|HASH|CIGAR/.test(g) ? 'TOBACCO' : 'FOOD'; };
    bnxCbRead_(ms.getSheetByName('ITEM_GROUP_MASTER'), ['ITEM_GROUP_ID', 'ITEM_GROUP_NAME']).forEach(function (r) {
      if (!r.ITEM_GROUP_ID) return; grpName[r.ITEM_GROUP_ID] = String(r.ITEM_GROUP_NAME || ''); var v = vgOf(r.ITEM_GROUP_NAME);
      if (!grpOf[v] || (v === 'TOBACCO' && /HUKKA/i.test(r.ITEM_GROUP_NAME) && !grpOf.HUKKA)) { if (v === 'TOBACCO' && /HUKKA/i.test(r.ITEM_GROUP_NAME)) grpOf.HUKKA = r.ITEM_GROUP_ID; if (!grpOf[v]) grpOf[v] = r.ITEM_GROUP_ID; }
    });
    bnxCbRead_(ms.getSheetByName('CATEGORY_MASTER'), ['CATEGORY_ID', 'CATEGORY_NAME']).forEach(function (r) {
      if (!r.CATEGORY_ID) return; var n = String(r.CATEGORY_NAME || '').toUpperCase(); catName[r.CATEGORY_ID] = String(r.CATEGORY_NAME || '');
      var put = function (k) { if (!catFor[k]) catFor[k] = r.CATEGORY_ID; };
      if (/^FOOD( SALES)?$/.test(n)) put('FOOD'); if (/LIQUOR/.test(n) && /SALE/.test(n)) put('BAR'); if (/BEVERAGE/.test(n) && /SALE/.test(n)) put('BEVERAGE');
      if (/^HUKKA$/.test(n)) put('HUKKA'); if (/CIGAR/.test(n)) put('TOBACCO');
    });
    var imS = ms.getSheetByName('ITEM_MASTER'), alS = ms.getSheetByName('ITEM_ALIAS_MASTER');
    var addIdx = function (name, it) { var k = nk(name); if (!k) return; (items[k] = items[k] || []).push(it); };
    var IM = {};
    bnxCbRead_(imS, ['ITEM_ID', 'ITEM_NAME', 'ITEM_CODE', 'CATEGORY_ID', 'ITEM_GROUP_ID', 'MENU_ACTIVE', 'IS_ACTIVE']).forEach(function (r) {
      var id = String(r.ITEM_ID || ''); if (!id) return; var n = Number(id.replace(/\D/g, '')) || 0; if (/^ITM/.test(id) && n > maxItm) maxItm = n;
      var it = { id: id, code: String(r.ITEM_CODE || id), cat: String(r.CATEGORY_ID || ''), grp: String(r.ITEM_GROUP_ID || ''), act: String(r.MENU_ACTIVE) === 'true' || r.MENU_ACTIVE === true };
      IM[id] = it; addIdx(r.ITEM_NAME, it);
    });
    bnxCbRead_(alS, ['ALIAS_ID', 'ITEM_ID', 'ALIAS_NAME']).forEach(function (r) {
      var n = Number(String(r.ALIAS_ID || '').replace(/\D/g, '')) || 0; if (n > maxAl) maxAl = n;
      if (IM[r.ITEM_ID]) addIdx(r.ALIAS_NAME, IM[r.ITEM_ID]);
    });
    var pmId = {};
    bnxCbRead_(ms.getSheetByName('PAYMENT_MODE_MASTER'), ['PAYMENT_MODE_ID', 'MODE_CODE', 'MODE_NAME']).forEach(function (r) { var k = String(r.MODE_CODE || r.MODE_NAME || '').toUpperCase(); if (k && !pmId[k]) pmId[k] = String(r.PAYMENT_MODE_ID || ''); });
    var cmS = ms.getSheetByName('CUSTOMER_MASTER'), custByPhone = {}, custByName = {}, custName = {};
    bnxCbRead_(cmS, ['CUSTOMER_ID', 'CUSTOMER_NAME', 'PHONE']).forEach(function (r) {
      var id = String(r.CUSTOMER_ID || ''); if (!id) return; var n = Number(id.replace(/\D/g, '')) || 0; if (/^CUS\d/.test(id) && n > maxCus) maxCus = n;
      var p = String(r.PHONE || '').replace(/\.0$/, '').replace(/\D/g, '').slice(-10); if (p.length === 10 && !custByPhone[p]) custByPhone[p] = id;
      var k = ck(r.CUSTOMER_NAME); if (k && !custByName[k]) custByName[k] = id; custName[id] = String(r.CUSTOMER_NAME || '');
    });
    var dues = {}, duesByName = {}, maxCdu = 0, cdC = cdS ? bnxCrmCols_(cdS) : {};
    if (cdS && cdS.getLastRow() > 1) {
      bnxCbRead_(cdS, ['CUSTOMER_DUES_ID', 'CUSTOMER_ID', 'CUSTOMER_NAME', 'CURRENT_BALANCE', 'STATUS']).forEach(function (r, i) {
        var n = Number(String(r.CUSTOMER_DUES_ID || '').replace(/\D/g, '')) || 0; if (n > maxCdu) maxCdu = n;
        if (/MERGED/i.test(String(r.STATUS || '')) || !r.CUSTOMER_ID) return;
        dues[String(r.CUSTOMER_ID)] = { row: i + 2, bal: N(r.CURRENT_BALANCE), name: String(r.CUSTOMER_NAME || '') };
        var k = ck(r.CUSTOMER_NAME); if (k && !duesByName[k]) duesByName[k] = String(r.CUSTOMER_ID);
      });
    }

    /* ---------- what is already in the TRANSACTION DB ---------- */
    var bmC = bnxCrmCols_(bmS), have = {}, nB = bmS.getLastRow() - 1, loc = 'LOC00001';
    if (nB > 0) {
      var nums = bmS.getRange(2, bmC.BILL_NUMBER, nB, 1).getValues(), ids = bmS.getRange(2, bmC.BILL_ID, nB, 1).getValues(),
          cus = bmC.CUSTOMER_ID ? bmS.getRange(2, bmC.CUSTOMER_ID, nB, 1).getValues() : null;
      for (var i = 0; i < nB; i++) { var k = String(nums[i][0] || '').trim().toUpperCase(); if (k) have[k] = { row: i + 2, id: String(ids[i][0] || ''), cust: cus ? String(cus[i][0] || '') : '' }; }
      if (bmC.LOCATION_ID) loc = String(bmS.getRange(nB + 1, bmC.LOCATION_ID).getValue() || loc);
    }

    /* ---------- build every bill ---------- */
    var HG = { FOOD: 'foodA', BAR: 'barA', BEVERAGE: 'bevA', TOBACCO: 'tobA' }, VGS = ['FOOD', 'BAR', 'BEVERAGE', 'TOBACCO'];
    var LUMP = { FOOD: 'FOOD SALE (POS CATEGORY)', BAR: 'LIQUOR SALE (POS CATEGORY)', BEVERAGE: 'BEVERAGE SALE (POS CATEGORY)', TOBACCO: 'TOBACCO / HUKKA SALE (POS CATEGORY)' };
    var newItems = {}, newCust = {}, out = [], warn = [], seen = {};
    var S = { bills: 0, net: 0, tax: 0, disc: 0, sc: 0, cash: 0, card: 0, upi: 0, zomato: 0, swiggy: 0, credit: 0, tips: 0, nc: 0, lines: 0, newBills: 0, exist: 0, replaced: 0, skipped: 0,
      groups: { FOOD: 0, BAR: 0, BEVERAGE: 0, TOBACCO: 0 }, from: '', to: '', lump: 0, matched: 0, newItemLines: 0 };
    var matchItem = function (name, vg) {
      var L = items[nk(name)] || [];
      var ok = L.filter(function (x) { return !vg || vgOf(grpName[x.grp]) === vg; });
      var pool = ok.length ? ok : (vg ? [] : L);
      if (!pool.length) return null;
      pool.sort(function (a, c) { return (c.act ? 1 : 0) - (a.act ? 1 : 0) || (a.id < c.id ? -1 : 1); });
      return pool[0];
    };
    var ensureItem = function (name, vg, rate) {
      var m = matchItem(name, vg) || matchItem(name, '');                       /* MASTER_DB item first (its own group) */
      if (m) { if (m.isNew) { m.n++; S.newItemLines++; } else S.matched++; return m; }
      var key = nk(name) + '|' + vg;
      if (!newItems[key]) {
        maxItm++; var tobH = vg === 'TOBACCO' && !/CIGAR|GOLD FLAKE|MARLBORO|CLASSIC|BENSON|DUNHILL|ADVANCE|LUCKY/i.test(name);
        var g = tobH ? (grpOf.HUKKA || grpOf.TOBACCO) : grpOf[vg] || grpOf.FOOD || '', c = tobH ? (catFor.HUKKA || catFor.TOBACCO) : catFor[vg] || catFor.FOOD || '';
        newItems[key] = { id: 'ITM' + ('0000' + maxItm).slice(-5), code: 'ITM' + ('0000' + maxItm).slice(-5), cat: c, grp: g, name: String(name).replace(/\s+/g, ' ').trim().toUpperCase(), rate: rate, vg: vg, n: 0, act: false, isNew: true };
        addIdx(name, newItems[key]); IM[newItems[key].id] = newItems[key];
      }
      newItems[key].n++; if (rate > 0) newItems[key].rate = rate; S.newItemLines++;
      return newItems[key];
    };
    bills.forEach(function (bl) {
      var h = bl && bl.h || {}, inv = String(h.inv || '').trim(); if (!inv || /^TOTAL$/i.test(inv)) return;
      var K = inv.toUpperCase(); if (seen[K]) { warn.push(inv + ': listed twice in the file — second one ignored'); return; } seen[K] = 1;
      var dt = String(h.date || ''), day = dt.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { warn.push(inv + ': bill date not readable (' + dt + ') — skipped'); return; }
      var ex = have[K], status = ex ? (mode === 'replace' ? 'replace' : 'exists') : 'new';
      if (status === 'exists') { S.exist++; S.skipped++; out.push({ inv: inv, status: 'exists', net: r2(h.net) }); return; }
      var T = N(h.net) > 0 ? { FOOD: N(h.foodA), BAR: N(h.barA), BEVERAGE: N(h.bevA), TOBACCO: N(h.tobA) } : { FOOD: 0, BAR: 0, BEVERAGE: 0, TOBACCO: 0 };   /* NC bill: no sale in any group */
      var tSum = T.FOOD + T.BAR + T.BEVERAGE + T.TOBACCO, net = r2(h.net), afterD = N(h.afterDisc) || tSum, tax = N(h.tax), sc = N(h.sc), scTax = N(h.scTax);
      /* item lines */
      var L = (bl.items || []).map(function (x) {
        var amt = { FOOD: N(x.food), BAR: N(x.bar), BEVERAGE: N(x.bev), TOBACCO: N(x.tob) }, a = amt.FOOD + amt.BAR + amt.BEVERAGE + amt.TOBACCO + N(x.oth);
        var qty = N(x.qty), ncq = N(x.ncQty), nc = (qty === 0 && ncq > 0) || (N(x.rate) === 0 && a === 0), q = qty || ncq;
        var vg = '', m = matchItem(x.name, '');
        if (m && grpName[m.grp]) vg = vgOf(grpName[m.grp]);                                   /* item group from MASTER_DB */
        if (!vg) VGS.forEach(function (g) { if (amt[g] > 0 && (!vg || amt[g] > amt[vg])) vg = g; });
        if (!vg && x.sub) vg = vgOf(x.sub);
        if (!vg) vg = /HASH|HUKKA|HOOKAH|FREEZER/i.test(x.name) ? 'TOBACCO' : 'FOOD';
        return { name: String(x.name || '').replace(/\s+/g, ' ').trim(), size: String(x.size || ''), rem: String(x.rem || ''), qty: q, rate: N(x.rate), vg: vg, nc: nc,
          tx: nc ? 0 : Math.max(0, a - N(x.disc) - N(x.sdisc)), tax: nc ? 0 : N(x.tax) };
      }).filter(function (l) { return l.name; });
      if (L.length && tSum > 0 && L.every(function (l) { return l.nc || l.tx === 0; })) L.forEach(function (l) { l.nc = false; l.tx = l.rate * l.qty; });   /* export with blank amounts */
      if (!(N(h.net) > 0)) L.forEach(function (l) { l.tx = 0; l.tax = 0; l.nc = true; });          /* NC / zero bill: lines carry no sale */
      var live = function (g) { return L.filter(function (l) { return l.vg === g && !l.nc; }); };
      if (tSum > 0) {
        var need = VGS.filter(function (g) { return T[g] > 0 && !live(g).length; }), spare = VGS.filter(function (g) { return T[g] <= 0 && live(g).some(function (l) { return l.tx > 0; }); });
        need.forEach(function (g) { var s = spare.shift(); if (s) L.forEach(function (l) { if (l.vg === s) l.vg = g; }); });
        VGS.forEach(function (g) { if (T[g] > 0 && !live(g).length) { L.push({ name: LUMP[g], size: '', rem: '', qty: 1, rate: T[g], vg: g, nc: false, tx: T[g], tax: 0, lump: true }); S.lump++; } });
        VGS.forEach(function (g) {
          var gl = live(g); if (!gl.length) return;
          if (T[g] <= 0) { gl.forEach(function (l) { l.tx = 0; l.note = 'no ' + g.toLowerCase() + ' sale in bill head'; }); return; }
          var s = gl.reduce(function (t, l) { return t + l.tx; }, 0);
          if (s <= 0) { gl.forEach(function (l) { l.tx = l.rate * l.qty || 1; }); s = gl.reduce(function (t, l) { return t + l.tx; }, 0); }
          var acc = 0; gl.forEach(function (l, i) { l.tx = i < gl.length - 1 ? r2(l.tx * T[g] / s) : r2(T[g] - acc); acc = r2(acc + l.tx); });
        });
      }
      var lt = L.reduce(function (t, l) { return t + l.tax; }, 0);
      if (Math.abs(lt - tax) > 1) {
        var base = L.filter(function (l) { return !l.nc && l.vg !== 'BAR' && l.tx > 0; }); if (!base.length) base = L.filter(function (l) { return !l.nc && l.tx > 0; });
        var sb = base.reduce(function (t, l) { return t + l.tx; }, 0), acc2 = 0; L.forEach(function (l) { l.tax = 0; });
        base.forEach(function (l, i) { l.tax = i < base.length - 1 ? r2(tax * l.tx / sb) : r2(tax - acc2); acc2 = r2(acc2 + l.tax); });
      }
      /* customer */
      var credit = N(h.credit), custId = '', custNm = String(h.cust || '').replace(/\s+/g, ' ').trim();
      var isDefault = !custNm || /^(DEFAULT|WALK ?IN|CASH) CUSTOMER$/i.test(custNm);
      if (!isDefault) {
        var ph = String(h.phone || '').replace(/\D/g, '').slice(-10);
        custId = (ph.length === 10 && custByPhone[ph]) || duesByName[ck(custNm)] || custByName[ck(custNm)] || '';
        if (!custId && credit > 0) {
          var nkk = ck(custNm);
          if (!newCust[nkk]) { maxCus++; newCust[nkk] = { id: 'CUS' + ('0000' + maxCus).slice(-5), name: custNm.replace(/^\s*(MR|MRS|MS|DR)\.?\s+/i, '').toUpperCase(), phone: ph }; custByName[nkk] = newCust[nkk].id; }
          custId = newCust[nkk].id;
        }
      }
      var key = inv.replace(/[^A-Za-z0-9]+/g, '-'), billId = ex ? ex.id : 'BILL-' + key, plat = /^ZM/i.test(inv) || /^Z+M/i.test(h.table || '') || /ZOMATO|ZAMATO/i.test(h.remarks || '') ? 'ZOMATO' : /^SW/i.test(inv) || /^SW/i.test(h.table || '') || /SWIGGY/i.test(h.remarks || '') ? 'SWIGGY' : '';
      var online = N(h.online) + N(h.smart) + N(h.bank) + N(h.wallet);
      var pays = [['CASH', N(h.cash)], ['CARD', N(h.card)], [plat || 'UPI', online], ['CREDIT', credit]].filter(function (p) { return p[1] > 0.004; });
      var paid = pays.reduce(function (t, p) { return t + p[1]; }, 0);
      if (net > 0 && Math.abs(paid - net) > 1) warn.push(inv + ': payments ₹' + r2(paid) + ' ≠ bill ₹' + net + (paid ? '' : ' (no payment mode in POS)'));
      var ncBill = net <= 0, tm = dt.slice(11, 19) || '00:00:00';
      var bill = { BILL_ID: billId, CLIENT_ID: cid, LOCATION_ID: loc, ORDER_ID: 'ORD-' + key, BILL_NUMBER: inv, BILL_DATE: dayD(day), BILL_TIME: tm, TABLE_ID: String(h.table || ''),
        CUSTOMER_ID: custId, CUSTOMER_NAME: custNm || 'Default Customer', BILL_TYPE: 'DINEIN', COVERS: N(h.pax), SUBTOTAL: r2(N(h.gross) || tSum + N(h.disc)), ITEM_DISCOUNT: r2(h.disc),
        SUBTOTAL_AFTER_ITEM_DISCOUNT: r2(afterD), BILL_DISCOUNT: 0, TAXABLE_AMOUNT: r2(h.taxable), TAX_RATE: 0, TAX_AMOUNT: r2(tax), ROUND_OFF: r2(net - afterD - tax - sc - scTax),
        GRAND_TOTAL: net, DUE_AMOUNT: r2(credit), BILL_STATUS: ncBill ? 'NON_CHARGE' : 'FINALIZED',
        PAYMENT_STATUS: ncBill ? 'NOT_REQUIRED' : credit >= net - 0.5 ? 'DUE' : credit > 0 ? 'PARTIAL' : 'PAID', GST_BREAKUP: JSON.stringify(h.gst || {}), REFERENCE_BILL_ID: inv,
        NOTES: String(h.remarks || ''), CREATED_BY: 'POS_IMPORT', CREATED_AT: when(dt), FINALIZED_BY: 'POS_IMPORT', FINALIZED_AT: when(dt), PAID_AT: !ncBill && credit < net - 0.5 ? when(dt) : '',
        PLATFORM: plat, COUNTER_CODE: String(h.outlet || ''), SALES_CHANNEL: String(h.payMode || ''), ORDER_SOURCE: 'POS', AGGREGATOR: plat || 'POS',
        SERVICE_CHARGE_AMOUNT: r2(sc), SERVICE_CHARGE_GST_AMOUNT: r2(scTax), NC_REASON: ncBill ? String(h.remarks || 'NC') : '' };
      var seq = 0, lines = L.map(function (l) {
        seq++;
        var it = l.lump ? null : ensureItem(l.name, l.vg, l.nc ? 0 : l.rate), same = it && vgOf(grpName[it.grp]) === l.vg;
        var gid = same ? it.grp : (l.vg === 'TOBACCO' ? (grpOf.HUKKA || grpOf.TOBACCO) : grpOf[l.vg]) || '';
        var cat = same ? it.cat : (l.vg === 'TOBACCO' ? (catFor.HUKKA || catFor.TOBACCO) : catFor[l.vg]) || '', gross = l.rate * l.qty;
        if (it && !same && !l.note) l.note = 'POS head: ' + l.vg.toLowerCase();
        S.groups[l.vg] += l.tx;
        var notes = [l.size, l.nc ? 'NC' : '', l.rem.replace(/IR-,?|ID-|SCE-/g, '').replace(/^[\s,]+|[\s,]+$/g, ''), l.note || ''].filter(Boolean).join(' · ');
        return { BILL_ITEM_ID: 'BI-' + key + '-' + ('00' + seq).slice(-3), BILL_ID: billId, ITEM_ID: it ? it.id : '', SEQUENCE: seq, ITEM_NAME: l.name, ITEM_CODE: it ? it.code : '',
          CATEGORY: catName[cat] || '', QUANTITY: l.qty, UNIT_ID: 'UNT00001', RATE: l.rate, LINE_DISCOUNT: r2(Math.max(gross - l.tx, 0)), DISCOUNTED_RATE: l.qty ? r2(l.tx / l.qty) : 0,
          TAXABLE_PER_ITEM: r2(l.tx), TAX_RATE: l.tx ? r2(l.tax * 100 / l.tx) : 0, TAX_PER_ITEM: r2(l.tax), LINE_TOTAL: r2(l.tx + l.tax), NOTES: notes, CREATED_AT: when(dt),
          ITEM_GROUP_ID: gid, ITEM_GROUP_NAME: grpName[gid] || '' };
      });
      var stamp = ex ? '-R' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMddHHmm') : '';
      var payRows = pays.map(function (p, i) {
        return { PAYMENT_ID: 'PAY-' + key + '-' + p[0] + stamp, CLIENT_ID: cid, LOCATION_ID: loc, BILL_ID: billId, CUSTOMER_ID: custId, PAYMENT_MODE_ID: pmId[p[0]] || '', PAYMENT_MODE: p[0],
          AMOUNT: r2(p[1]), PAYMENT_DATE: dayD(day), PAYMENT_TIME: tm, REFERENCE: 'POS ' + inv, PAYMENT_STATUS: 'PAID', CREATED_BY: 'POS_IMPORT', CREATED_AT: when(dt),
          VERIFIED_AT: when(dt), VERIFIED_BY: 'POS_IMPORT', TIPS_AMOUNT: i === 0 ? r2(h.tips) : 0 };
      });
      S.bills++; S.net += net; S.tax += tax; S.disc += N(h.disc); S.sc += sc; S.tips += N(h.tips); S.lines += lines.length; if (ncBill) S.nc++;
      pays.forEach(function (p) { var k = { CASH: 'cash', CARD: 'card', UPI: 'upi', ZOMATO: 'zomato', SWIGGY: 'swiggy', CREDIT: 'credit' }[p[0]]; S[k] += p[1]; });
      if (!S.from || day < S.from) S.from = day; if (!S.to || day > S.to) S.to = day;
      if (status === 'new') S.newBills++; else S.replaced++;
      out.push({ inv: inv, status: status, day: day, net: net, credit: r2(credit), cust: custId ? (custNm || custId) : '', bill: bill, lines: lines, pays: payRows, ex: ex || null, plat: plat });
    });
    Object.keys(S.groups).forEach(function (k) { S.groups[k] = r2(S.groups[k]); });
    ['net', 'tax', 'disc', 'sc', 'cash', 'card', 'upi', 'zomato', 'swiggy', 'credit', 'tips'].forEach(function (k) { S[k] = r2(S[k]); });
    var NI = Object.keys(newItems).map(function (k) { var x = newItems[k]; return { id: x.id, name: x.name, group: grpName[x.grp] || '', category: catName[x.cat] || '', rate: x.rate, lines: x.n }; });
    var NC = Object.keys(newCust).map(function (k) { return newCust[k]; });
    var brief = out.map(function (o) { return { inv: o.inv, status: o.status, day: o.day || '', net: o.net, credit: o.credit || 0, cust: o.cust || '', lines: o.lines ? o.lines.length : 0, plat: o.plat || '' }; });
    var res = { dryRun: dry, mode: mode, summary: S, newItems: NI, newCustomers: NC, warnings: warn.slice(0, 200), bills: brief, build: 'GS-2026.10.09-v18' };
    if (dry) return { success: true, data: res };

    /* ---------- write ---------- */
    var todo = out.filter(function (o) { return o.status === 'new' || o.status === 'replace'; });
    var app = function (sh, objs) {
      if (!sh || !objs.length) return 0;
      var H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
      var rows = objs.map(function (o) { return H.map(function (k) { return k && o[k] !== undefined && o[k] !== null ? o[k] : ''; }); });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, H.length).setValues(rows); return rows.length;
    };
    var delRows = function (sh, col, want) {                                   /* delete rows whose col value is in want (bottom-up, contiguous blocks) */
      if (!sh || sh.getLastRow() < 2) return 0; var C = bnxCrmCols_(sh); if (!C[col]) return 0;
      var v = sh.getRange(2, C[col], sh.getLastRow() - 1, 1).getValues(), hit = [];
      for (var i = 0; i < v.length; i++) if (want[String(v[i][0])]) hit.push(i + 2);
      for (var j = hit.length - 1; j >= 0;) { var end = hit[j], st = end; while (j > 0 && hit[j - 1] === st - 1) { j--; st--; } sh.deleteRows(st, end - st + 1); j--; }
      return hit.length;
    };
    var W = { bills: 0, lines: 0, pays: 0, ledger: 0, items: 0, customers: 0, dues: 0, replacedBills: 0, removedLines: 0, voidPays: 0 };
    var rep = todo.filter(function (o) { return o.status === 'replace'; }), repIds = {}, oldCredit = {};
    if (rep.length) {
      rep.forEach(function (o) { repIds[o.ex.id] = o; });
      /* old credit of the bills being replaced comes out of the customer balance first */
      bnxCbRead_(slS, ['BILL_ID', 'AMOUNT']).forEach(function (r) { var o = repIds[String(r.BILL_ID)]; if (o) oldCredit[o.ex.id] = (oldCredit[o.ex.id] || 0) + N(r.AMOUNT); });
      W.removedLines = delRows(biS, 'BILL_ID', repIds); delRows(slS, 'BILL_ID', repIds);
      if (bwS) { var bwWant = {}; rep.forEach(function (o) { bwWant[o.inv] = 1; }); delRows(bwS, 'BILL', bwWant); }
      var pC = bnxCrmCols_(pmS);
      if (pmS.getLastRow() > 1 && pC.BILL_ID && pC.PAYMENT_STATUS) {
        var pv = pmS.getRange(2, pC.BILL_ID, pmS.getLastRow() - 1, 1).getValues();
        for (var q = 0; q < pv.length; q++) if (repIds[String(pv[q][0])]) { pmS.getRange(q + 2, pC.PAYMENT_STATUS).setValue('VOID'); if (pC.REFERENCE) pmS.getRange(q + 2, pC.REFERENCE).setValue('VOID: bill re-imported from POS'); W.voidPays++; }
      }
      var H = bmS.getRange(1, 1, 1, bmS.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
      rep.forEach(function (o) {
        var cur = bmS.getRange(o.ex.row, 1, 1, H.length).getValues()[0];
        var row = H.map(function (k, i) { return k && o.bill[k] !== undefined ? o.bill[k] : cur[i]; });
        bmS.getRange(o.ex.row, 1, 1, H.length).setValues([row]); W.replacedBills++;
        var oc = oldCredit[o.ex.id] || 0, who = o.ex.cust;
        if (oc > 0 && who) { (dues[who] || (dues[who] = { row: 0, bal: 0, name: custName[who] || who, add: 0 })).add = ((dues[who].add || 0) - oc); }
      });
    }
    var nb = todo.filter(function (o) { return o.status === 'new'; });
    W.bills = app(bmS, nb.map(function (o) { return o.bill; }));
    var allLines = []; todo.forEach(function (o) { o.lines.forEach(function (l) { allLines.push(l); }); }); W.lines = app(biS, allLines);
    var allPays = []; todo.forEach(function (o) { o.pays.forEach(function (p) { allPays.push(p); }); }); W.pays = app(pmS, allPays);
    var led = todo.filter(function (o) { return o.credit > 0; });
    W.ledger = app(slS, led.map(function (o) { return { SALES_LEDGER_ID: 'SL-' + o.inv.replace(/[^A-Za-z0-9]+/g, '-'), CLIENT_ID: cid, LOCATION_ID: loc, BUSINESS_DATE: dayD(o.day), BILL_ID: o.bill.BILL_ID,
      BILL_NUMBER: o.inv, AMOUNT: o.credit, PAYMENT_MODE: 'CREDIT', CREATED_AT: o.bill.CREATED_AT }; }));
    /* MASTER_DB: new items (+ alias) and new credit customers */
    var nowM = bnxMpNowFor_(imS);
    W.items = app(imS, NI.map(function (x) { var it = IM[x.id]; return { ITEM_ID: x.id, CLIENT_ID: cid, ITEM_NAME: x.name, CATEGORY_ID: it.cat, UNIT_ID: 'UNT00001', ITEM_CODE: x.id,
      DESCRIPTION: 'Added from POS import', SELLING_RATE: x.rate, IS_ACTIVE: true, CREATED_AT: nowM, UPDATED_AT: nowM, ITEM_GROUP_ID: it.grp, IS_BAR: it.vg === 'BAR', MENU_ACTIVE: false }; }));
    app(alS, NI.map(function (x) { maxAl++; return { ALIAS_ID: 'ALIA' + ('0000' + maxAl).slice(-5), CLIENT_ID: cid, ITEM_ID: x.id, ALIAS_NAME: x.name, ALIAS_TYPE: 'NAME', STATUS: 'ACTIVE',
      CREATED_AT: nowM, UPDATED_AT: nowM, SOURCE: 'POS_IMPORT', IS_ACTIVE: true }; }));
    W.customers = app(cmS, NC.map(function (c) { return { CUSTOMER_ID: c.id, CLIENT_ID: cid, LOCATION_ID: loc, CUSTOMER_NAME: c.name, PHONE: c.phone, CUSTOMER_TYPE: 'Individual', IS_ACTIVE: true,
      CREATED_AT: nowM, UPDATED_AT: nowM, SOURCE: 'POS_IMPORT' }; }));
    /* customer dues: + credit of every imported bill */
    led.forEach(function (o) { var id = o.bill.CUSTOMER_ID; if (!id) { warn.push(o.inv + ': credit ₹' + o.credit + ' without a customer name — not added to dues'); return; }
      var d = dues[id] || (dues[id] = { row: 0, bal: 0, name: custName[id] || (newCust[ck(o.bill.CUSTOMER_NAME)] || {}).name || o.bill.CUSTOMER_NAME, add: 0 }); d.add = (d.add || 0) + o.credit; d.last = o.bill.BILL_DATE; });
    if (cdS) {
      var nowT = bnxMpNowFor_(cdS), newD = [];
      Object.keys(dues).forEach(function (id) {
        var d = dues[id]; if (!d.add) return;
        if (d.row) {
          var nbal = r2(d.bal + d.add);
          cdS.getRange(d.row, cdC.CURRENT_BALANCE).setValue(nbal);
          if (cdC.LAST_TRANSACTION_DATE && d.last) cdS.getRange(d.row, cdC.LAST_TRANSACTION_DATE).setValue(d.last);
          if (cdC.LAST_TRANSACTION_TYPE) cdS.getRange(d.row, cdC.LAST_TRANSACTION_TYPE).setValue('POS_IMPORT');
          if (cdC.STATUS) cdS.getRange(d.row, cdC.STATUS).setValue(nbal > 0.5 ? 'ACTIVE' : nbal < -0.5 ? 'ADVANCE' : 'CLEARED');
          if (cdC.UPDATED_AT) cdS.getRange(d.row, cdC.UPDATED_AT).setValue(nowT);
        } else if (d.add > 0) {
          maxCdu++; newD.push({ CUSTOMER_DUES_ID: 'CDU' + ('0000000' + maxCdu).slice(-8), CLIENT_ID: cid, LOCATION_ID: loc, CUSTOMER_ID: id, OPENING_BALANCE: 0, CURRENT_BALANCE: r2(d.add),
            LAST_TRANSACTION_DATE: d.last || '', LAST_TRANSACTION_TYPE: 'POS_IMPORT', STATUS: 'ACTIVE', UPDATED_AT: nowT, CUSTOMER_NAME: d.name });
        }
        W.dues++;
      });
      app(cdS, newD);
    }
    if (bwS) app(bwS, led.filter(function (o) { return o.bill.CUSTOMER_ID; }).map(function (o) { return { Month: 'POS ' + o.day.slice(0, 7), DATE: dayD(o.day), BILL: o.inv, AMOUNT: o.net,
      PARTY: o.bill.CUSTOMER_NAME, CASH: 0, UPI: 0, BANK: 0, DISC: 0, RDATE: '', DUES: o.credit, STATUS: 'Dues', GROUP: '', CUSTOMER_ID: o.bill.CUSTOMER_ID }; }));
    try { CacheService.getScriptCache().remove('dues_' + cid); } catch (e) {}
    try { SpreadsheetApp.flush(); } catch (e) {}
    res.written = W; res.warnings = warn.slice(0, 200);
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
  finally { try { if (lock) lock.releaseLock(); } catch (e) {} }
}


/* ============================================================
   BAR_TDB { from?, to? } (2026-10-09, "bar reports not show — capture MASTER DB + TRANSACTION DB")
   Bar sales straight from the TRANSACTION DB: BILL_ITEMS of the LIQUOR item group (bills not cancelled),
   one row per business day + item, in the Bar Module's sales row shape
   [date, outlet, itemCode, item, category, qty, totalML, rate, gross, discount, net, tax, billAmt].
   ML per unit: size on the bill line (30ML / 60ML / 330ML …) → ML in the item name → BTL 750 / CAN 500 / GLASS 150
   → BAR_ITEM_MASTER serving size → 30 ML.  Code Master rows come from BAR_ITEM_MASTER + ITEM_MASTER (MASTER DB).
   Bar Module sheets (BAR_B2_STOCK_INWARD, BAR_B5_PHYSICAL_STOCK, …) are returned too when they exist in either DB.
   summary / byCategory / byDay feed the dashboard Bar Cost & Bar Performance reports.
   ============================================================ */
function bnxBarTdb_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || '').slice(0, 10), N = bnxCbNum_;
    var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), ms = bnxCrmSpreadsheet_(cid, 'MASTER', true);
    var bmS = ss.getSheetByName('BILL_MASTER'), biS = ss.getSheetByName('BILL_ITEMS');
    var nm = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ''); };
    /* MASTER DB: liquor items + bar serving size */
    var IM = {}, grp = {};
    bnxCbRead_(ms.getSheetByName('ITEM_GROUP_MASTER'), ['ITEM_GROUP_ID', 'ITEM_GROUP_NAME']).forEach(function (r) { grp[r.ITEM_GROUP_ID] = String(r.ITEM_GROUP_NAME || ''); });
    bnxCbRead_(ms.getSheetByName('ITEM_MASTER'), ['ITEM_ID', 'ITEM_NAME', 'ITEM_GROUP_ID']).forEach(function (r) { if (r.ITEM_ID) IM[r.ITEM_ID] = { name: String(r.ITEM_NAME || ''), grp: grp[r.ITEM_GROUP_ID] || '' }; });
    var BAR = {}, cm = [];
    bnxCbRead_(ms.getSheetByName('BAR_ITEM_MASTER'), ['BAR_ITEM_ID', 'ITEM_ID', 'BAR_CATEGORY', 'SERVING_SIZE', 'SERVING_UOM', 'BOTTLE_SIZE', 'SELLING_PRICE', 'IS_ACTIVE']).forEach(function (r) {
      if (!r.ITEM_ID) return; var sv = String(r.SERVING_SIZE || '').match(/(\d+(?:\.\d+)?)\s*ML/i), bt = String(r.BOTTLE_SIZE || '').match(/(\d+(?:\.\d+)?)/);
      var o = { cat: String(r.BAR_CATEGORY || ''), ml: sv ? Number(sv[1]) : 0, btl: bt ? Number(bt[1]) : 0, price: N(r.SELLING_PRICE) };
      BAR[r.ITEM_ID] = o; var it = IM[r.ITEM_ID] || {};
      if (it.name) cm.push([r.BAR_ITEM_ID || r.ITEM_ID, r.ITEM_ID, it.name, it.name, o.ml || 30, o.btl || 750, 1, cid, o.cat]);
    });
    var unitML = function (note, name, iid, cat) {
      var s = String(note || '').split(' · ')[0], m = s.match(/(\d+(?:\.\d+)?)\s*ML/i); if (m) return Number(m[1]);
      var nmM = String(name || '').match(/(\d+(?:\.\d+)?)\s*ML/i);
      if (/^BTL|BOTTLE/i.test(s)) return nmM ? Number(nmM[1]) : (BAR[iid] && BAR[iid].btl) || 750;
      if (/^CAN/i.test(s)) return nmM ? Number(nmM[1]) : 500;
      if (nmM) return Number(nmM[1]);
      if (/^GLASS/i.test(s)) return /WINE|CHAMPAGNE|SPARKLING|PROSECCO/i.test(cat + ' ' + name) ? 150 : (BAR[iid] && BAR[iid].ml) || 30;
      if (/BEER/i.test(cat)) return 330;
      return (BAR[iid] && BAR[iid].ml) || 30;
    };
    /* TRANSACTION DB: bills of the period */
    var bills = {};
    bnxCbRead_(bmS, ['BILL_ID', 'BILL_DATE', 'BILL_STATUS']).forEach(function (r) {
      if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return;
      var d = bnxTlDay_(bmS, r.BILL_DATE); if (!d || (from && d < from) || (to && d > to)) return; bills[String(r.BILL_ID)] = d;
    });
    var agg = {}, cat = {}, day = {}, S = { sales: 0, net: 0, tax: 0, disc: 0, qty: 0, ml: 0, ncQty: 0, ncML: 0, lines: 0, bills: 0, lumpSales: 0 }, bset = {}, catBills = {};
    bnxCbRead_(biS, ['BILL_ID', 'ITEM_ID', 'ITEM_NAME', 'CATEGORY', 'QUANTITY', 'RATE', 'LINE_DISCOUNT', 'TAXABLE_PER_ITEM', 'TAX_PER_ITEM', 'NOTES', 'ITEM_GROUP_NAME']).forEach(function (r) {
      var d = bills[String(r.BILL_ID)]; if (!d) return;
      var g = String(r.ITEM_GROUP_NAME || '').toUpperCase(); if (!/LIQUOR|BAR/.test(g)) return;
      var iid = String(r.ITEM_ID || ''), name = String(r.ITEM_NAME || '').trim(), c = String((BAR[iid] && BAR[iid].cat) || r.CATEGORY || 'LIQUOR'), q = N(r.QUANTITY), net = N(r.TAXABLE_PER_ITEM), tax = N(r.TAX_PER_ITEM);
      var lump = /POS CATEGORY/i.test(name) || /^Group total/i.test(String(r.NOTES || '')), nc = /(^| · )NC( · |$)/.test(String(r.NOTES || '')) || (net === 0 && q > 0 && N(r.RATE) > 0);
      var u = lump ? 0 : unitML(r.NOTES, name, iid, c), ml = u * q;
      S.lines++; bset[r.BILL_ID] = 1; S.net += net; S.tax += tax; S.disc += N(r.LINE_DISCOUNT) * (nc ? 0 : 1); if (lump) S.lumpSales += net;
      if (nc) { S.ncQty += q; S.ncML += ml; } else { S.qty += q; S.ml += ml; }
      var k = d + '|' + (iid || nm(name)), a = agg[k] || (agg[k] = [d, cid, iid, name, c, 0, 0, N(r.RATE), 0, 0, 0, 0, 0]);
      a[5] += q; a[6] += ml; a[8] += N(r.RATE) * q; a[9] += nc ? N(r.RATE) * q : N(r.LINE_DISCOUNT); a[10] += net; a[11] += tax; a[12] += net + tax;
      var cc = cat[c] || (cat[c] = { category: c, qty: 0, ml: 0, net: 0, tax: 0, bills: 0 }); cc.qty += nc ? 0 : q; cc.ml += nc ? 0 : ml; cc.net += net; cc.tax += tax;
      var cb = catBills[c] || (catBills[c] = {}); if (!cb[r.BILL_ID]) { cb[r.BILL_ID] = 1; cc.bills++; }
      var dd = day[d] || (day[d] = { date: d, net: 0, ml: 0, qty: 0 }); dd.net += net; dd.ml += nc ? 0 : ml; dd.qty += nc ? 0 : q;
    });
    S.bills = Object.keys(bset).length;
    var rows = Object.keys(agg).sort().map(function (k) { var a = agg[k]; [5, 6, 8, 9, 10, 11, 12].forEach(function (i) { a[i] = r2(a[i]); }); return a; });
    Object.keys(S).forEach(function (k) { S[k] = r2(S[k]); }); S.sales = r2(S.net + S.tax);
    var byCat = Object.keys(cat).map(function (k) { var x = cat[k]; x.qty = r2(x.qty); x.ml = r2(x.ml); x.net = r2(x.net); x.tax = r2(x.tax); return x; }).sort(function (a, c) { return c.net - a.net; });
    var byDay = Object.keys(day).sort().map(function (k) { var x = day[k]; x.net = r2(x.net); x.ml = r2(x.ml); x.qty = r2(x.qty); return x; });
    /* Bar Module's own sheets, when they exist in either DB */
    var tabs = {};
    ['BAR_B2_STOCK_INWARD', 'BAR_B5_PHYSICAL_STOCK', 'BAR_B6_STOCK_ADJUSTMENT', 'BAR_B10_COCKTAIL_RECIPE', 'BAR_B11_MOCKTAIL_RECIPE', 'BAR_B13_POS_ITEM_MAPPING'].forEach(function (t) {
      var sh = ss.getSheetByName(t) || ms.getSheetByName(t); if (!sh || sh.getLastRow() < 2) return;
      var tz = bnxCrmSheetTz_(sh);
      tabs[t] = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().filter(function (r) { return r.some(function (v) { return v !== '' && v !== null; }); })
        .map(function (r) { return r.map(function (v) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v; }); });
    });
    return { success: true, data: { from: from, to: to, sales: rows, codemaster: cm, summary: S, byCategory: byCat, byDay: byDay, tabs: tabs, source: 'TRANSACTION_DB BILL_ITEMS (LIQUOR) + MASTER_DB BAR_ITEM_MASTER', build: 'GS-2026.10.09-v19' } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* ============================================================
   KITCHEN_TDB { from, to, groups:'FOOD'|'ALL' } (2026-10-09, kitchen pages "auto report from MASTER DB + TRANSACTION DB")
   One call feeds every kitchen page's auto report: food sales by item / category / day / hour (TRANSACTION DB
   BILL_ITEMS, bills not cancelled), ITEM_MASTER menu status, RECIPE_MASTER cost per item, RAW_MATERIAL_MASTER stock
   and re-order list, and the kitchen registers (wastage, indent, production, consumption, KOT, purchase orders).
   ============================================================ */
function bnxMpKitchenTdb_(b) {   /* 2026-11-14: renamed — Code.gs has bnxKitchenTdb_(session, payload) */
  try {
    var cid = bnxMcCid_(b), N = bnxCbNum_, r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
    var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
    var from = String(b.from || today).slice(0, 10), to = String(b.to || from).slice(0, 10); if (from > to) { var t0 = from; from = to; to = t0; }
    var all = String(b.groups || '').toUpperCase() === 'ALL';
    var ck = 'kit_' + cid + '_' + from + '_' + to + '_' + (all ? 'A' : 'F'), cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return { success: true, data: h }; } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), ms = bnxCrmSpreadsheet_(cid, 'MASTER', true);
    var sh = function (n) { return ss.getSheetByName(n) || ms.getSheetByName(n); };
    var inR = function (s, v) { var d = bnxTlDay_(s, v); return d && d >= from && d <= to ? d : ''; };
    /* MASTER: groups, categories, items, recipes */
    var grp = {}, cat = {}, IM = {};
    bnxCbRead_(ms.getSheetByName('ITEM_GROUP_MASTER'), ['ITEM_GROUP_ID', 'ITEM_GROUP_NAME']).forEach(function (r) { grp[r.ITEM_GROUP_ID] = String(r.ITEM_GROUP_NAME || ''); });
    bnxCbRead_(ms.getSheetByName('CATEGORY_MASTER'), ['CATEGORY_ID', 'CATEGORY_NAME']).forEach(function (r) { cat[r.CATEGORY_ID] = String(r.CATEGORY_NAME || ''); });
    var menu = { total: 0, active: 0, inactive: 0, kitchen: 0 };
    var kitchenG = function (g) { g = String(g || '').toUpperCase(); return all || !/LIQUOR|BAR|BEVERAGE|TOBACCO|HUKKA|HASH/.test(g); };
    bnxCbRead_(ms.getSheetByName('ITEM_MASTER'), ['ITEM_ID', 'ITEM_NAME', 'CATEGORY_ID', 'ITEM_GROUP_ID', 'SELLING_RATE', 'PURCHASE_RATE', 'MENU_ACTIVE', 'IS_ACTIVE', 'KITCHEN']).forEach(function (r) {
      if (!r.ITEM_ID) return; var g = grp[r.ITEM_GROUP_ID] || '', act = String(r.MENU_ACTIVE).toUpperCase() === 'TRUE' || r.MENU_ACTIVE === true;
      IM[r.ITEM_ID] = { name: String(r.ITEM_NAME || ''), cat: cat[r.CATEGORY_ID] || '', group: g, sell: N(r.SELLING_RATE), pr: N(r.PURCHASE_RATE), active: act, kitchen: String(r.KITCHEN || '') };
      if (kitchenG(g)) { menu.kitchen++; if (act) menu.active++; else menu.inactive++; } menu.total++;
    });
    var RC = {}, recipes = { count: 0, costed: 0, lines: 0 };
    bnxCbRead_(sh('RECIPE_MASTER'), ['RECIPE_ID', 'ITEM_ID', 'RECIPE_NAME', 'STATUS', 'COST_PER_YIELD', 'TOTAL_COST', 'YIELD_QTY']).forEach(function (r) {
      if (!r.RECIPE_ID || /INACTIVE/i.test(String(r.STATUS || ''))) return; recipes.count++;
      var c = N(r.COST_PER_YIELD) || (N(r.YIELD_QTY) ? N(r.TOTAL_COST) / N(r.YIELD_QTY) : N(r.TOTAL_COST)); if (c > 0) recipes.costed++;
      if (r.ITEM_ID) RC[r.ITEM_ID] = c;
    });
    recipes.lines = bnxCbRead_(sh('RECIPE_ITEMS'), ['RECIPE_ID']).filter(function (r) { return r.RECIPE_ID; }).length;
    /* TRANSACTION: bills + kitchen item lines */
    var bmS = ss.getSheetByName('BILL_MASTER'), biS = ss.getSheetByName('BILL_ITEMS'), bills = {}, hourOf = {};
    bnxCbRead_(bmS, ['BILL_ID', 'BILL_DATE', 'BILL_TIME', 'BILL_STATUS', 'COVERS']).forEach(function (r) {
      if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return; var d = inR(bmS, r.BILL_DATE); if (!d) return;
      bills[String(r.BILL_ID)] = d; var tm = Object.prototype.toString.call(r.BILL_TIME) === '[object Date]' ? Utilities.formatDate(r.BILL_TIME, bnxCrmSheetTz_(bmS), 'HH') : String(r.BILL_TIME || '').slice(0, 2);
      hourOf[String(r.BILL_ID)] = /^\d\d$/.test(tm) ? tm : '';
    });
    var items = {}, byCat = {}, byDay = {}, byHour = {}, S = { net: 0, tax: 0, qty: 0, ncQty: 0, ncValue: 0, lines: 0, bills: 0, cost: 0, costedQty: 0, lump: 0 }, bset = {};
    bnxCbRead_(biS, ['BILL_ID', 'ITEM_ID', 'ITEM_NAME', 'CATEGORY', 'QUANTITY', 'RATE', 'TAXABLE_PER_ITEM', 'TAX_PER_ITEM', 'NOTES', 'ITEM_GROUP_NAME']).forEach(function (r) {
      var d = bills[String(r.BILL_ID)]; if (!d || !kitchenG(r.ITEM_GROUP_NAME)) return;
      var name = String(r.ITEM_NAME || '').trim(), q = N(r.QUANTITY), net = N(r.TAXABLE_PER_ITEM), tax = N(r.TAX_PER_ITEM), rate = N(r.RATE);
      var lump = /POS CATEGORY/i.test(name) || /^Group total/i.test(String(r.NOTES || '')); if (lump) { S.lump += net; return; }
      var nc = /(^| · )NC( · |$)/.test(String(r.NOTES || '')) || (net === 0 && q > 0 && rate > 0);
      var iid = String(r.ITEM_ID || ''), k = iid || name.toUpperCase(), it = IM[iid] || {}, c = String(r.CATEGORY || it.cat || 'FOOD');
      var x = items[k] || (items[k] = { id: iid, name: it.name || name, category: c, group: String(r.ITEM_GROUP_NAME || it.group || ''), qty: 0, net: 0, tax: 0, ncQty: 0, ncValue: 0, rate: rate, menuActive: !!it.active, recipeCost: RC[iid] || 0, purchaseRate: it.pr || 0, bills: 0 });
      if (nc) { x.ncQty += q; x.ncValue += rate * q; S.ncQty += q; S.ncValue += rate * q; }
      else { x.qty += q; S.qty += q; var uc = RC[iid] || it.pr || 0; if (uc > 0) { S.cost += uc * q; S.costedQty += q; } }
      x.net += net; x.tax += tax; S.net += net; S.tax += tax; S.lines++; if (!bset[r.BILL_ID]) { bset[r.BILL_ID] = 1; }
      var cc = byCat[c] || (byCat[c] = { category: c, qty: 0, net: 0, items: {} }); cc.qty += nc ? 0 : q; cc.net += net; cc.items[k] = 1;
      var dd = byDay[d] || (byDay[d] = { date: d, qty: 0, net: 0, bills: {} }); dd.qty += nc ? 0 : q; dd.net += net; dd.bills[r.BILL_ID] = 1;
      var hh = hourOf[String(r.BILL_ID)]; if (hh) { var ho = byHour[hh] || (byHour[hh] = { hour: hh, qty: 0, net: 0 }); ho.qty += nc ? 0 : q; ho.net += net; }
    });
    S.bills = Object.keys(bset).length;
    var list = Object.keys(items).map(function (k) { var x = items[k]; ['qty', 'net', 'tax', 'ncQty', 'ncValue'].forEach(function (f) { x[f] = r2(x[f]); }); return x; }).sort(function (a, c) { return c.net - a.net; });
    var cats = Object.keys(byCat).map(function (k) { var x = byCat[k]; return { category: x.category, qty: r2(x.qty), net: r2(x.net), items: Object.keys(x.items).length }; }).sort(function (a, c) { return c.net - a.net; });
    var days = Object.keys(byDay).sort().map(function (k) { var x = byDay[k]; return { date: k, qty: r2(x.qty), net: r2(x.net), bills: Object.keys(x.bills).length }; });
    var hours = Object.keys(byHour).sort().map(function (k) { var x = byHour[k]; return { hour: k, qty: r2(x.qty), net: r2(x.net) }; });
    ['net', 'tax', 'qty', 'ncQty', 'ncValue', 'cost', 'costedQty', 'lump'].forEach(function (f) { S[f] = r2(S[f]); });
    var sold = {}; list.forEach(function (x) { if (x.id) sold[x.id] = 1; });
    menu.soldNotOnMenu = list.filter(function (x) { return x.id && IM[x.id] && !IM[x.id].active && x.qty > 0; }).slice(0, 40).map(function (x) { return { id: x.id, name: x.name, qty: x.qty }; });
    menu.noRecipeSold = list.filter(function (x) { return x.qty > 0 && !(RC[x.id] > 0); }).length;
    /* raw materials */
    var raw = { count: 0, withStock: 0, low: [], stockValue: 0, costed: 0 };
    bnxCbRead_(ms.getSheetByName('RAW_MATERIAL_MASTER'), ['ITEM_CODE', 'ITEM_NAME', 'CATEGORY', 'UOM', 'CURRENT_STOCK', 'REORDER_LEVEL', 'COST_PRICE', 'STATUS']).forEach(function (r) {
      if (!r.ITEM_NAME || /INACTIVE/i.test(String(r.STATUS || ''))) return; raw.count++;
      var st = N(r.CURRENT_STOCK), rl = N(r.REORDER_LEVEL), cp = N(r.COST_PRICE); if (st > 0) raw.withStock++; if (cp > 0) { raw.costed++; raw.stockValue += st * cp; }
      if (rl > 0 && st <= rl) raw.low.push({ code: String(r.ITEM_CODE || ''), name: String(r.ITEM_NAME), category: String(r.CATEGORY || ''), uom: String(r.UOM || ''), stock: st, reorder: rl, cost: cp });
    });
    raw.lowCount = raw.low.length; raw.low = raw.low.sort(function (a, c) { return (a.stock - a.reorder) - (c.stock - c.reorder); }).slice(0, 60); raw.stockValue = r2(raw.stockValue);
    /* kitchen registers in the period */
    var reg = function (name, dateCol, valCol, statusCol) {
      var s = sh(name), o = { rows: 0, value: 0, pending: 0, recent: [] }; if (!s || s.getLastRow() < 2) return o;
      var cols = [dateCol]; if (valCol) cols.push(valCol); if (statusCol) cols.push(statusCol); cols.push('ITEM_NAME', 'QTY', 'QUANTITY', 'REASON');
      bnxCbRead_(s, cols).forEach(function (r) { var d = inR(s, r[dateCol]); if (!d) return; o.rows++; if (valCol) o.value += N(r[valCol]); if (statusCol && /PEND|SUBMIT|DRAFT|REQUEST/i.test(String(r[statusCol] || ''))) o.pending++;
        if (o.recent.length < 15) o.recent.push({ date: d, item: String(r.ITEM_NAME || ''), qty: N(r.QTY || r.QUANTITY), value: valCol ? r2(r[valCol]) : 0, reason: String(r.REASON || ''), status: statusCol ? String(r[statusCol] || '') : '' }); });
      o.value = r2(o.value); return o;
    };
    var wastage = reg('WASTAGE_MASTER', 'DATE', 'COST_VALUE', 'STATUS'), kw = reg('KITCHEN_WASTAGE', 'WASTAGE_DATE', 'COST_AMOUNT', '');
    wastage.rows += kw.rows; wastage.value = r2(wastage.value + kw.value); wastage.recent = wastage.recent.concat(kw.recent).slice(0, 15);
    var res = { from: from, to: to, groups: all ? 'ALL' : 'FOOD', summary: S, items: list.slice(0, 400), itemCount: list.length, byCategory: cats, byDay: days, byHour: hours, menu: menu, recipes: recipes, raw: raw,
      wastage: wastage, indent: reg('KITCHEN_INDENT', 'DATE', '', 'STATUS'), production: reg('KITCHEN_PRODUCTION', 'PRODUCTION_DATE', '', 'STATUS'), consumption: reg('KITCHEN_CONSUMPTION', 'DATE', '', ''),
      kot: reg('KOT_MASTER', 'KOT_DATE', '', 'KOT_STATUS'), purchaseOrders: reg('PURCHASE_ORDER', 'PO_DATE', 'GRAND_TOTAL', 'STATUS'), orders: reg('ORDER_MASTER', 'ORDER_DATE', '', 'ORDER_STATUS'),
      asOf: today, source: 'TRANSACTION_DB + MASTER_DB', build: 'GS-2026.10.09-v20' };
    try { var txt = JSON.stringify(res); if (txt.length < 95000) cache.put(ck, txt, to < today ? 900 : 120); } catch (e) {}
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* ============================================================
   DSR_TDB { from, to } (2026-10-09) — the Client DSR straight from the TRANSACTION DB, one row per business day,
   same lines as the owner's DSR: Liquor · Food · Beverage · Hashfreezer · Others · Gross · Tax · Round off · Net ·
   Cash · ICICI Card · ICICI GPay · Guest Due Sales · Zomato · Swiggy · Due received cash / bank · CN · Discount.
   Fast (one read per sheet, cached) — replaces the slow GET_DSR_MATRIX / GET_DSR_RANGE chain on the DSR page.
   ============================================================ */
function bnxDsrTdb_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required' };
    if (from > to) { var t0 = from; from = to; to = t0; }
    var ck = 'dsrt_' + cid + '_' + from + '_' + to, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) { var h = JSON.parse(hit); h.cached = true; return { success: true, data: h }; } }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), N = bnxCbNum_;
    var bmS = ss.getSheetByName('BILL_MASTER'), biS = ss.getSheetByName('BILL_ITEMS'), pmS = ss.getSheetByName('PAYMENT_MASTER'), drS = ss.getSheetByName('DUES_RECEIPT');
    var D = {}, B = {};
    var day = function (d) { return D[d] || (D[d] = { date: d, liquor: 0, liquorMrp: 0, food: 0, beverage: 0, hashFreezer: 0, others: 0, grossSale: 0, tax: 0, roundOff: 0, netSale: 0, serviceCharge: 0,
      cash: 0, iciciCard: 0, iciciGpay: 0, online: 0, guestDueSales: 0, zomato: 0, swiggy: 0, dueReceivedCash: 0, dueReceivedIcici: 0, guestDuesCN: 0, discount: 0, bills: 0, ncBills: 0, covers: 0, source: 'TRANSACTION_DB' }); };
    bnxCbRead_(bmS, ['BILL_ID', 'BILL_DATE', 'BILL_STATUS', 'GRAND_TOTAL', 'TAX_AMOUNT', 'ITEM_DISCOUNT', 'SERVICE_CHARGE_AMOUNT', 'COVERS']).forEach(function (r) {
      if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return;
      var d = bnxTlDay_(bmS, r.BILL_DATE); if (!d || d < from || d > to) return;
      B[String(r.BILL_ID)] = d; var x = day(d), gt = N(r.GRAND_TOTAL);
      x.netSale += gt; x.tax += N(r.TAX_AMOUNT); x.discount += N(r.ITEM_DISCOUNT); x.serviceCharge += N(r.SERVICE_CHARGE_AMOUNT); x.covers += N(r.COVERS);
      if (gt > 0) x.bills++; else x.ncBills++;
    });
    bnxCbRead_(biS, ['BILL_ID', 'ITEM_GROUP_NAME', 'TAXABLE_PER_ITEM']).forEach(function (r) {
      var d = B[String(r.BILL_ID)]; if (!d) return; var x = day(d), g = String(r.ITEM_GROUP_NAME || '').toUpperCase(), a = N(r.TAXABLE_PER_ITEM);
      if (/LIQUOR|BAR/.test(g)) x.liquor += a; else if (/BEVERAGE/.test(g)) x.beverage += a; else if (/HUKKA|TOBACCO|HASH/.test(g)) x.hashFreezer += a; else if (/FOOD|ADD/.test(g)) x.food += a; else x.others += a;
    });
    bnxCbRead_(pmS, ['BILL_ID', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_STATUS']).forEach(function (r) {
      var d = B[String(r.BILL_ID)]; if (!d || /VOID|REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || ''))) return;
      var x = day(d), m = String(r.PAYMENT_MODE || '').toUpperCase(), a = N(r.AMOUNT);
      if (m === 'CASH') x.cash += a; else if (m === 'CARD' || m === 'BANK') x.iciciCard += a; else if (m === 'ZOMATO') x.zomato += a; else if (m === 'SWIGGY') x.swiggy += a;
      else if (m === 'CREDIT') x.guestDueSales += a; else if (m === 'NC') {} else x.iciciGpay += a;
    });
    bnxCbRead_(drS, ['RECEIPT_DATE', 'AMOUNT', 'PAYMENT_MODE', 'STATUS']).forEach(function (r) {
      if (/VOID|DUPLICATE|CANCEL/i.test(String(r.STATUS || ''))) return;
      var d = bnxTlDay_(drS, r.RECEIPT_DATE); if (!d || d < from || d > to) return;
      var x = day(d), m = String(r.PAYMENT_MODE || '').toUpperCase(), a = N(r.AMOUNT);
      if (m === 'DUES_DISCOUNT') x.guestDuesCN += a; else if (m === 'CASH') x.dueReceivedCash += a; else x.dueReceivedIcici += a;
    });
    var r2 = function (n) { return Math.round(n * 100) / 100; }, byDate = {};
    Object.keys(D).sort().forEach(function (k) {
      var x = D[k], cats = x.liquor + x.food + x.beverage + x.hashFreezer;
      x.grossSale = r2(x.netSale - x.tax);                              /* pre-GST sale incl. service charge (owner "Gross Sale" incl. Others) */
      x.others = r2(Math.max(0, x.grossSale - cats));                    /* service charge / items without a group */
      x.roundOff = 0;
      Object.keys(x).forEach(function (f) { if (typeof x[f] === 'number') x[f] = r2(x[f]); });
      byDate[k] = x;
    });
    var res = { from: from, to: to, byDate: byDate };
    try { var txt = JSON.stringify(res); if (txt.length < 95000) cache.put(ck, txt, to < Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd') ? 1800 : 180); } catch (e) {}
    return { success: true, data: res };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}


/* BILL_PAYMENTS { from, to } (2026-10-09) — every bill's real payment split from PAYMENT_MASTER
   (a split bill shows Cash ₹x + UPI ₹y, so cash goes to cash and bank to bank in the Bills List and its totals). */
function bnxBillPays_(b) {
  try {
    var cid = bnxMcCid_(b), from = String(b.from || '').slice(0, 10), to = String(b.to || from).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'From / To date required' };
    var ck = 'bpay_' + cid + '_' + from + '_' + to, cache = CacheService.getScriptCache();
    if (!b.force) { var hit = cache.get(ck); if (hit) return { success: true, data: JSON.parse(hit), cached: true }; }
    var ss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true), N = bnxCbNum_, bmS = ss.getSheetByName('BILL_MASTER'), pmS = ss.getSheetByName('PAYMENT_MASTER');
    var id2no = {}, out = {};
    bnxCbRead_(bmS, ['BILL_ID', 'BILL_NUMBER', 'BILL_DATE', 'BILL_STATUS', 'GRAND_TOTAL']).forEach(function (r) {
      var d = bnxTlDay_(bmS, r.BILL_DATE); if (!d || d < from || d > to) return;
      var no = String(r.BILL_NUMBER || ''); id2no[String(r.BILL_ID)] = no; out[no] = { m: {}, s: String(r.BILL_STATUS || ''), t: N(r.GRAND_TOTAL) };
    });
    bnxCbRead_(pmS, ['BILL_ID', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_STATUS']).forEach(function (r) {
      var no = id2no[String(r.BILL_ID)]; if (!no || /VOID|REFUND|FAIL|CANCEL/i.test(String(r.PAYMENT_STATUS || ''))) return;
      var m = String(r.PAYMENT_MODE || '').toUpperCase(); if (m === 'ONLINE') m = 'UPI'; if (m === 'BANK') m = 'CARD'; if (m === 'NC') return;
      var o = out[no].m; o[m] = Math.round(((o[m] || 0) + N(r.AMOUNT)) * 100) / 100;
    });
    try { var txt = JSON.stringify(out); if (txt.length < 95000) cache.put(ck, txt, 120); } catch (e) {}
    return { success: true, data: out };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}