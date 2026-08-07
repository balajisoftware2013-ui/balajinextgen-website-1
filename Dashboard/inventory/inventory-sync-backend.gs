/* ════════════════════════════════════════════════════════════════
   INVENTORY CLOUD SYNC BACKEND — ADD-ON (collision-safe rewrite)
   ------------------------------------------------------------------
   ⚠ DO NOT paste this as a replacement for anything. Add it as a NEW
   file inside your EXISTING "BALAJI_NEXTGEN_ERP_V2_CORE" project
   (the same project already serving AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ).

   This version has NO doPost() of its own and NO generically-named
   helpers (getClientFolder / getSheetByName / getOrCreateSheet) —
   every function here is prefixed invsync_ so it cannot collide with
   or silently override anything already in your real Code.gs.

   ⚠ ONE THING I COULD NOT SAFELY GUESS: the Drive folder ID your
   real Code.gs uses to look up a client's folder. The draft this
   replaced had a fabricated ID that didn't match your known infra.
   Below, invsync_getClientFolder_() tries to reuse your EXISTING
   getClientFolder()/resolveClientFolder() function if one already
   exists in your project (very likely, given your per-client Drive
   folder pattern) — only falling back to its own lookup if neither
   exists. If your real function has a different name, tell me the
   name and I'll point this at it directly instead of guessing.
   ════════════════════════════════════════════════════════════════ */

/**
 * PASTE THIS 8-LINE BLOCK into your EXISTING doPost()'s action switch,
 * right before the `default:` case. Do NOT add a second doPost function.
 *
 *   case 'SYNC_INVENTORY_DATA':
 *     result = invsync_sync(clientId, payload);
 *     break;
 *   case 'PULL_INVENTORY_DATA':
 *     result = invsync_pull(clientId, payload);
 *     break;
 *   case 'SAVE_CLIENT_FILE':
 *     result = invsync_saveClientFile(clientId, payload);
 *     break;
 *   case 'SYNC_SNAPSHOT':
 *     result = invsync_syncSnapshot(clientId, payload);
 *     break;
 *   case 'PULL_SNAPSHOT':
 *     result = invsync_pullSnapshot(clientId, payload);
 *     break;
 *
 * (If your doPost uses if/else instead of switch, use:
 *   else if (action === 'SYNC_INVENTORY_DATA') result = invsync_sync(clientId, payload);
 *   else if (action === 'PULL_INVENTORY_DATA') result = invsync_pull(clientId, payload);
 *   else if (action === 'SAVE_CLIENT_FILE') result = invsync_saveClientFile(clientId, payload);
 *   else if (action === 'SYNC_SNAPSHOT') result = invsync_syncSnapshot(clientId, payload);
 *   else if (action === 'PULL_SNAPSHOT') result = invsync_pullSnapshot(clientId, payload);
 * )
 *
 * Then: Deploy → Manage deployments → click the pencil on your EXISTING
 * deployment → Version: "New version" → Deploy.
 * ⚠ Do NOT click "New deployment" — that generates a different URL and
 * would break every file already pointing at the current one.
 */

/**
 * SYNC_SNAPSHOT / PULL_SNAPSHOT: generic whole-blob sync for any module's
 * full local dataset (procurement, ledger, sales, etc.) — not just
 * inventory adjustments. Overwrites a single JSON file per snapshotKey
 * inside the client's folder each time, so Payments/Ledger (or any other
 * module) can pull the latest full state across devices.
 *
 * payload for SYNC_SNAPSHOT: { snapshotKey, data }
 *   snapshotKey examples: 'procurement' (BALAJI_PROCUREMENT), 'ledger', 'sales'
 * payload for PULL_SNAPSHOT: { snapshotKey }
 */
function invsync_syncSnapshot(clientId, payload) {
  try {
    const { snapshotKey, data } = payload || {};
    if (!snapshotKey || data === undefined) {
      return { success: false, error: 'Missing snapshotKey or data' };
    }
    const clientFolder = invsync_getClientFolder_(clientId);
    if (!clientFolder) return { success: false, error: 'Client not found: ' + clientId };

    const fileName = 'SNAPSHOT_' + snapshotKey.toUpperCase() + '.json';
    const jsonText = JSON.stringify(data);
    const existing = clientFolder.getFilesByName(fileName);
    if (existing.hasNext()) {
      // Overwrite content of the existing file (keeps same file, no duplicates)
      const f = existing.next();
      f.setContent(jsonText);
    } else {
      clientFolder.createFile(fileName, jsonText, MimeType.PLAIN_TEXT);
    }
    return { success: true, data: { synced: true, timestamp: new Date().toISOString() } };
  } catch (err) {
    Logger.log('[invsync_syncSnapshot] ' + err.message);
    return { success: false, error: err.message };
  }
}

function invsync_pullSnapshot(clientId, payload) {
  try {
    const snapshotKey = (payload || {}).snapshotKey;
    if (!snapshotKey) return { success: false, error: 'Missing snapshotKey' };

    const clientFolder = invsync_getClientFolder_(clientId);
    if (!clientFolder) return { success: false, error: 'Client not found: ' + clientId };

    const fileName = 'SNAPSHOT_' + snapshotKey.toUpperCase() + '.json';
    const files = clientFolder.getFilesByName(fileName);
    if (!files.hasNext()) return { success: true, data: null }; // nothing synced yet — not an error

    const content = files.next().getBlob().getDataAsString();
    return { success: true, data: JSON.parse(content) };
  } catch (err) {
    Logger.log('[invsync_pullSnapshot] ' + err.message);
    return { success: false, error: err.message };
  }
}

function invsync_sync(clientId, payload) {
  try {
    const { dataType, data, timestamp } = payload || {};
    if (!dataType || !data) return { success: false, error: 'Missing dataType or data' };

    const clientFolder = invsync_getClientFolder_(clientId);
    if (!clientFolder) return { success: false, error: 'Client not found: ' + clientId };

    const logSheet = invsync_getOrCreateSheet_(clientFolder, 'INVENTORY_SYNC_LOG',
      ['Timestamp', 'DataType', 'Payload', 'Status']);
    const nowIso = new Date().toISOString();
    logSheet.appendRow([nowIso, dataType, JSON.stringify(data), 'SYNCED']);
    invsync_trimSheet_(logSheet, 1000);

    if (dataType === 'adjustments') {
      invsync_storeAdjustment_(clientFolder, data);
    }

    return { success: true, data: { synced: true, timestamp: nowIso } };
  } catch (err) {
    Logger.log('[invsync_sync] ' + err.message);
    return { success: false, error: err.message };
  }
}

function invsync_pull(clientId, payload) {
  try {
    const dataType = (payload || {}).dataType;
    const clientFolder = invsync_getClientFolder_(clientId);
    if (!clientFolder) return { success: false, error: 'Client not found: ' + clientId };

    if (dataType === 'adjustments') {
      return { success: true, data: invsync_loadAdjustments_(clientFolder) };
    }
    if (dataType === 'shared') {
      return { success: true, data: invsync_loadShared_(clientFolder) };
    }
    return { success: false, error: 'Unknown dataType: ' + dataType };
  } catch (err) {
    Logger.log('[invsync_pull] ' + err.message);
    return { success: false, error: err.message };
  }
}

function invsync_storeAdjustment_(clientFolder, syncData) {
  const sheet = invsync_getOrCreateSheet_(clientFolder, 'INVENTORY_ADJUSTMENTS',
    ['id','adjNo','date','itemId','itemName','before','diff','after','rate','refId','party','reason','createdAt','source']);
  const adjustment = (syncData || {}).adjustment;
  if (!adjustment) return;

  const values = sheet.getDataRange().getValues();
  const idIdx = values[0].indexOf('id');
  if (idIdx >= 0) {
    for (let i = 1; i < values.length; i++) {
      if (values[i][idIdx] === adjustment.id) return; // already synced
    }
  }

  sheet.appendRow([
    adjustment.id, adjustment.adjNo, adjustment.date, adjustment.itemId, adjustment.itemName,
    adjustment.before, adjustment.diff, adjustment.after, adjustment.rate || 0,
    adjustment.refId, adjustment.party || '', adjustment.reason || '',
    adjustment.createdAt, adjustment.source || ''
  ]);
}

function invsync_loadAdjustments_(clientFolder) {
  try {
    const sheet = invsync_findSheet_(clientFolder, 'INVENTORY_ADJUSTMENTS');
    if (!sheet || sheet.getMaxRows() <= 1) return null;
    const values = sheet.getDataRange().getValues();
    const adjustments = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      adjustments.push({
        id: values[i][0], adjNo: values[i][1], date: values[i][2],
        itemId: values[i][3], itemName: values[i][4],
        before: Number(values[i][5]) || 0, diff: Number(values[i][6]) || 0, after: Number(values[i][7]) || 0,
        rate: Number(values[i][8]) || 0, refId: values[i][9] || '', party: values[i][10] || '',
        reason: values[i][11] || '', createdAt: values[i][12], source: values[i][13] || ''
      });
    }
    return { adjustments: adjustments, seq: { adj: adjustments.length + 1 } };
  } catch (err) {
    Logger.log('[invsync_loadAdjustments_] ' + err.message);
    return null;
  }
}

function invsync_loadShared_(clientFolder) {
  try {
    const sheet = invsync_findSheet_(clientFolder, 'ITEM_MASTER');
    if (!sheet || sheet.getMaxRows() <= 1) return null;
    const values = sheet.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i][0]) continue;
      items.push({
        id: values[i][0], code: values[i][1] || '', name: values[i][2] || '',
        category: values[i][3] || '', unit: values[i][4] || 'Pcs',
        rate: Number(values[i][5]) || 0, srate: Number(values[i][6]) || 0, opening: Number(values[i][7]) || 0
      });
    }
    return { items: items, categories: [], version: 2 };
  } catch (err) {
    Logger.log('[invsync_loadShared_] ' + err.message);
    return null;
  }
}

/**
 * SAVE_CLIENT_FILE: Save an uploaded invoice/ledger/any file straight into the
 * client's own folder in CLIENT_DATABASES.
 * payload: { fileName, mimeType, base64Data, docType }
 *   docType: 'invoice' | 'ledger' | anything else you want to tag it with (optional)
 */
function invsync_saveClientFile(clientId, payload) {
  try {
    const { fileName, mimeType, base64Data, docType } = payload || {};
    if (!fileName || !base64Data) {
      return { success: false, error: 'Missing fileName or base64Data' };
    }

    const clientFolder = invsync_getClientFolder_(clientId);
    if (!clientFolder) return { success: false, error: 'Client not found: ' + clientId };

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType || 'application/octet-stream',
      fileName
    );
    const file = clientFolder.createFile(blob);

    // Optional: log it in the same sync sheet as adjustments, tagged by docType
    try {
      const logSheet = invsync_getOrCreateSheet_(clientFolder, 'INVENTORY_SYNC_LOG',
        ['Timestamp', 'DataType', 'Payload', 'Status']);
      logSheet.appendRow([
        new Date().toISOString(),
        'file:' + (docType || 'document'),
        JSON.stringify({ fileName: fileName, fileId: file.getId() }),
        'SAVED'
      ]);
    } catch (logErr) { /* non-fatal, file already saved */ }

    return { success: true, data: { fileId: file.getId(), url: file.getUrl() } };
  } catch (err) {
    Logger.log('[invsync_saveClientFile] ' + err.message);
    return { success: false, error: err.message };
  }
}

/* ── Helpers (all invsync_-prefixed, zero collision risk) ── */

function invsync_getClientFolder_(clientId) {
  // Prefer your REAL existing client-folder resolver if this project already has one.
  if (typeof getClientFolder === 'function') return getClientFolder(clientId);
  if (typeof resolveClientFolder === 'function') return resolveClientFolder(clientId);
  if (typeof getClientDriveFolder === 'function') return getClientDriveFolder(clientId);

  // Fallback: confirmed real CLIENT_DATABASES folder (from Drive screenshot,
  // 07-Aug-2026 — client subfolders sit directly inside it, named by Client ID
  // e.g. "CL00010"). Only used if none of the resolvers above exist.
  try {
    const masterFolder = DriveApp.getFolderById('1u2yVJCgH2EwLAP950l_97vo5Ckx9cgL7');
    const files = masterFolder.getFoldersByName(clientId);
    return files.hasNext() ? files.next() : null;
  } catch (e) {
    Logger.log('[invsync_getClientFolder_] fallback lookup failed for ' + clientId + ': ' + e.message);
    return null;
  }
}

function invsync_findSheet_(folder, name) {
  try {
    const files = folder.getFilesByName(name);
    if (files.hasNext()) {
      const ss = SpreadsheetApp.openById(files.next().getId());
      return ss.getSheetByName(name) || ss.getSheets()[0];
    }
  } catch (e) {}
  return null;
}

function invsync_getOrCreateSheet_(folder, name, headerRow) {
  let sheet = invsync_findSheet_(folder, name);
  if (!sheet) {
    const ss = SpreadsheetApp.openById(folder.createSpreadsheet(name).getId());
    sheet = ss.getSheets()[0];
    sheet.setName(name);
    if (headerRow && headerRow.length) sheet.appendRow(headerRow);
  }
  return sheet;
}

function invsync_trimSheet_(sheet, maxRows) {
  const currentRows = sheet.getMaxRows();
  if (currentRows > maxRows) sheet.deleteRows(2, currentRows - maxRows);
}
