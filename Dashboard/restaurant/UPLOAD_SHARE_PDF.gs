/* ═══════════════════════════════════════════════════════════════════════
   UPLOAD_SHARE_PDF — Balaji NextGen ERP (V2_CORE) · 2026-10-05
   Used by restaurant-dashboard.html → Customer Credit → WhatsApp statement.
   Saves the outstanding-statement PDF in a per-client Drive folder with a
   view-only "anyone with the link" share, and returns that link so the
   customer's WhatsApp chat opens with the PDF link already in the message.

   ROUTER (add ONE line to the single live doPost router, AFTER session
   validation, next to the other V2_CORE actions):
       case 'UPLOAD_SHARE_PDF': return jsonOut_(bnxUploadSharePdf_(req));
   (req = the parsed request whose clientId was already checked against
    the session token, same as every other V2_CORE action.)

   CLEANUP (optional, run once from the editor): bnxInstallSharePdfCleanup_()
   → daily trigger deletes shared PDFs older than 30 days.
═══════════════════════════════════════════════════════════════════════ */

var BNX_SHARE_PDF_ROOT_NAME = 'BNX_SHARED_PDFS';
var BNX_SHARE_PDF_MAX_BYTES = 8 * 1024 * 1024;   // 8 MB
var BNX_SHARE_PDF_KEEP_DAYS = 30;

function bnxUploadSharePdf_(req) {
  try {
    req = req || {};
    var clientId = String(req.clientId || '').trim();
    if (!/^[A-Z]{2}\d{4,6}$/.test(clientId)) return { success: false, error: 'Invalid client' };

    var b64 = String(req.fileBase64 || '').replace(/^data:[^,]*,/, '');
    if (!b64) return { success: false, error: 'fileBase64 required' };
    var bytes = Utilities.base64Decode(b64);
    if (!bytes || !bytes.length) return { success: false, error: 'Empty file' };
    if (bytes.length > BNX_SHARE_PDF_MAX_BYTES) return { success: false, error: 'PDF too large (max 8 MB)' };
    // Only real PDFs: "%PDF" magic bytes
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      return { success: false, error: 'Only PDF files are accepted' };
    }

    var name = String(req.fileName || 'Statement.pdf').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    // unguessable prefix so file names never collide or reveal sequence
    name = Utilities.getUuid().slice(0, 8) + '_' + name;

    var folder = bnxSharePdfFolder_(clientId);
    var file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', name));
    file.setDescription('BNX ' + String(req.docType || 'DOC') + ' · ' + clientId + ' · ' +
      String(req.customer || '').slice(0, 60) + ' · ' + new Date().toISOString());
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Workspace policy may block public links — tell the dashboard so it falls back.
      try { file.setTrashed(true); } catch (e) {}
      return { success: false, error: 'Drive link sharing is blocked: ' + shareErr.message };
    }
    var id = file.getId();
    return {
      success: true,
      data: { fileId: id, name: name, url: 'https://drive.google.com/file/d/' + id + '/view?usp=sharing' }
    };
  } catch (e) {
    return { success: false, error: 'UPLOAD_SHARE_PDF failed: ' + e.message };
  }
}

/* One folder per client: BNX_SHARED_PDFS/<CLIENT_ID>, ids cached in Script Properties. */
function bnxSharePdfFolder_(clientId) {
  var props = PropertiesService.getScriptProperties();
  var key = 'BNX_SHARE_PDF_FOLDER_' + clientId;
  var id = props.getProperty(key);
  if (id) {
    try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {}
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    id = props.getProperty(key);
    if (id) { try { var f2 = DriveApp.getFolderById(id); if (!f2.isTrashed()) return f2; } catch (e) {} }
    var rootId = props.getProperty('BNX_SHARE_PDF_ROOT');
    var root = null;
    if (rootId) { try { root = DriveApp.getFolderById(rootId); if (root.isTrashed()) root = null; } catch (e) { root = null; } }
    if (!root) {
      var it = DriveApp.getFoldersByName(BNX_SHARE_PDF_ROOT_NAME);
      root = it.hasNext() ? it.next() : DriveApp.createFolder(BNX_SHARE_PDF_ROOT_NAME);
      props.setProperty('BNX_SHARE_PDF_ROOT', root.getId());
    }
    var sub = root.getFoldersByName(clientId);
    var folder = sub.hasNext() ? sub.next() : root.createFolder(clientId);
    props.setProperty(key, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

/* Daily cleanup: shared statements are a convenience link, not an archive. */
function bnxCleanupSharedPdfs_() {
  var rootId = PropertiesService.getScriptProperties().getProperty('BNX_SHARE_PDF_ROOT');
  if (!rootId) return;
  var cutoff = Date.now() - BNX_SHARE_PDF_KEEP_DAYS * 86400000;
  var clients = DriveApp.getFolderById(rootId).getFolders();
  while (clients.hasNext()) {
    var files = clients.next().getFilesByType('application/pdf');
    while (files.hasNext()) {
      var f = files.next();
      if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
    }
  }
}
function bnxInstallSharePdfCleanup_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'bnxCleanupSharedPdfs_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('bnxCleanupSharedPdfs_').timeBased().everyDays(1).atHour(4).create();
}
