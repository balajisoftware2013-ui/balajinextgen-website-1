/**
 * MENU CARD = GOOGLE DRIVE LINK, saved per client  (add-on for the CRM script — uses its helper functions)
 * Tab "MENU_CARDS" is created automatically in <clientId>_MASTER_DB.
 *
 * INSTALL
 *  1) Paste this whole file into your Apps Script project (new file is fine).
 *  2) In bnxCrmRoute_, add these 5 lines:
 *       if (action === 'SAVE_MENU_CARD_LINK')   return bnxMcSave_(req);
 *       if (action === 'GET_MENU_CARDS')        return bnxMcList_(req);
 *       if (action === 'SET_ACTIVE_MENU_CARD')  return bnxMcActivate_(req);
 *       if (action === 'DELETE_MENU_CARD')      return bnxMcDelete_(req);
 *       if (action === 'GET_ACTIVE_MENU_CARD')  { var mc = bnxMcActive_(req); if (mc) return mc; }  // else falls through to your old code
 *  3) Deploy > Manage deployments > Edit > New version > Deploy.
 */
var MC_SHEET = 'MENU_CARDS';
var MC_HEAD  = ['CARD_ID','NAME','FILE_URL','FILE_ID','ACTIVE','UPLOADED_AT','CLIENT_ID','CARD_TYPE'];   // CARD_TYPE: FOOD | BAR | OTHER
function bnxMcType_(t) { t = String(t || 'FOOD').toUpperCase(); return (t === 'BAR' || t === 'OTHER') ? t : 'FOOD'; }

function bnxMcId_(u) { var m = String(u || '').match(/(?:\/d\/|[?&]id=)([\w-]{20,})/); return m ? m[1] : ''; }

function bnxMcSave_(req) {
  var link = String(req.link || '').trim(), name = String(req.name || '').trim().slice(0, 80);
  if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(link)) return { success: false, error: 'Paste a Google Drive link (https://drive.google.com/…)' };
  if (!name) return { success: false, error: 'Menu name is required' };
  var fid = bnxMcId_(link), warn = '', type = bnxMcType_(req.cardType);
  if (fid) {                                    // make sure customers (not logged in to Google) can open it
    try { DriveApp.getFileById(fid).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) { warn = 'Could not set sharing automatically — in Drive set the file to "Anyone with the link: Viewer".'; }
  }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = bnxCrmSheet_(MC_SHEET, MC_HEAD, req.clientId), C = bnxCrmCols_(sh);
    var id = 'MC' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss');
    var rows = sh.getLastRow() - 1, active = req.active !== false;
    // same link already saved for this client → update it instead of adding a duplicate
    var existing = 0;
    if (rows > 0) {
      var urls = sh.getRange(2, C.FILE_URL, rows, 1).getValues(), cids = sh.getRange(2, C.CLIENT_ID, rows, 1).getValues();
      for (var i = 0; i < rows; i++) if (String(urls[i][0]) === link && String(cids[i][0]) === String(req.clientId)) { existing = i + 2; break; }
    }
    if (active) bnxMcClearActive_(sh, C, req.clientId, type);      // only the same type (Food stays on when Bar changes)
    if (existing) { id = sh.getRange(existing, C.CARD_ID).getValue(); sh.getRange(existing, C.NAME).setValue(name); sh.getRange(existing, C.ACTIVE).setValue(active ? 'YES' : 'NO'); sh.getRange(existing, C.CARD_TYPE).setValue(type); }
    else bnxCrmAppend_(sh, { CARD_ID: id, NAME: name, FILE_URL: link, FILE_ID: fid, ACTIVE: active ? 'YES' : 'NO', UPLOADED_AT: new Date(), CLIENT_ID: req.clientId || '', CARD_TYPE: type });
    return { success: true, data: { cardId: id, warn: warn } };
  } finally { lock.releaseLock(); }
}

function bnxMcClearActive_(sh, C, clientId, type) {
  var n = sh.getLastRow() - 1; if (n < 1) return;
  var act = sh.getRange(2, C.ACTIVE, n, 1), av = act.getValues(), cv = sh.getRange(2, C.CLIENT_ID, n, 1).getValues(), tv = sh.getRange(2, C.CARD_TYPE, n, 1).getValues();
  for (var i = 0; i < n; i++) if (String(cv[i][0]) === String(clientId) && (!type || bnxMcType_(tv[i][0]) === type)) av[i][0] = 'NO';
  act.setValues(av);
}

function bnxMcRows_(req) {
  var sh = bnxCrmSheet_(MC_SHEET, MC_HEAD, req.clientId), n = sh.getLastRow() - 1; if (n < 1) return { sh: sh, rows: [] };
  var C = bnxCrmCols_(sh), v = sh.getRange(2, 1, n, sh.getLastColumn()).getValues(), out = [];
  v.forEach(function (r, i) {
    if (String(r[C.CLIENT_ID - 1]) !== String(req.clientId)) return;
    out.push({ row: i + 2, cardId: r[C.CARD_ID - 1], name: r[C.NAME - 1], fileUrl: r[C.FILE_URL - 1], type: bnxMcType_(r[C.CARD_TYPE - 1]), active: r[C.ACTIVE - 1] === 'YES' });
  });
  return { sh: sh, rows: out, C: C };
}
function bnxMcList_(req) { var x = bnxMcRows_(req); return { success: true, data: x.rows.reverse() }; }

/* customer page: returns the active Drive link, or null so your older GET_ACTIVE_MENU_CARD code still runs */
function bnxMcActive_(req) {
  try {
    var x = bnxMcRows_(req), act = x.rows.filter(function (r) { return r.active; });
    var order = { FOOD: 0, BAR: 1, OTHER: 2 };
    act.sort(function (p, q) { return order[p.type] - order[q.type]; });
    var cards = act.map(function (r) { return { fileUrl: r.fileUrl, name: r.name, cardId: r.cardId, type: r.type }; });
    // fileUrl/name at top level = first card, so an older customer page keeps working
    return cards.length ? { success: true, data: { fileUrl: cards[0].fileUrl, name: cards[0].name, cards: cards } } : null;
  } catch (e) { return null; }
}
function bnxMcActivate_(req) {
  var x = bnxMcRows_(req), t = x.rows.filter(function (r) { return r.cardId === req.cardId; })[0];
  if (!t) return { success: false, error: 'Menu card not found' };
  bnxMcClearActive_(x.sh, x.C, req.clientId, t.type); x.sh.getRange(t.row, x.C.ACTIVE).setValue('YES');
  return { success: true };
}
function bnxMcDelete_(req) {
  var x = bnxMcRows_(req), t = x.rows.filter(function (r) { return r.cardId === req.cardId; })[0];
  if (!t) return { success: false, error: 'Menu card not found' };
  x.sh.deleteRow(t.row); return { success: true };
}
/* run once from the editor to create the tab + authorise Drive:  bnxMcTest() */
function bnxMcTest() { Logger.log(JSON.stringify(bnxMcList_({ clientId: CRM_TEST_CLIENT }))); }
