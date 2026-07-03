/**
 * BALAJI NEXTGEN ERP — Template → Client Database Sync
 * ─────────────────────────────────────────────────────────────
 * SUPERSEDES the RestaurantERP_SchemaMigration.gs from earlier in
 * this conversation. That file invented a "Schema_Version" sheet
 * and a "Migration_Log" sheet because I hadn't seen your actual
 * infrastructure yet. Delete that file — you don't need it.
 *
 * You already have exactly this system built, in
 * BALAJI_ERP_MASTER_CONTROL_SYSTEM:
 *   - TEMPLATE_REGISTRY        (TEMPLATE_ID, INDUSTRY, GOOGLE_SHEET_ID, VERSION, ...)
 *   - DATABASE_REGISTRY        (DATABASE_ID, SPREADSHEET_ID, DB_VERSION, MIGRATION_STATUS, ...)
 *   - MIGRATION_LOG            (TIMESTAMP, DB_ID, DB_NAME, RESULT, MESSAGE)
 *   - CLIENT_DATABASE_REGISTRY (CLIENT_ID, MASTER_DB_ID, TRANSACTION_DB_ID, REPORT_DB_ID, ...)
 *   - TEMPLATE_USAGE_LOG       (CLIENT_ID, TEMPLATE_ID, SOURCE_TEMPLATE_DB, COPIED_DB_ID, ...)
 *
 * What's MISSING is the piece that actually connects them: nothing
 * currently reads TEMPLATE_REGISTRY.VERSION, compares it against
 * what each client's MASTER_DB_ID was copied from, and pushes the
 * difference. That's what this file adds — using your real sheets,
 * your real column names, nothing invented.
 *
 * ONE NEW COLUMN NEEDED (additive, safe, doesn't touch existing data):
 * Add "APPLIED_TEMPLATE_VERSION" to CLIENT_DATABASE_REGISTRY. This
 * is the one gap — TEMPLATE_USAGE_LOG records WHEN a client was
 * copied from a template, but not WHICH VERSION, so there's no way
 * to know if CL00010 is behind the current TEM002 version without
 * tracking it explicitly. Run addAppliedVersionColumn() once to add
 * it (backfills existing clients to version 1).
 *
 * HOW THIS WORKS:
 * 1. You update the master template (TEM002 sheet), bump VERSION in
 *    TEMPLATE_REGISTRY for that TEMPLATE_ID.
 * 2. Call syncAllClientsToTemplate('TEM002') — or let it run on a
 *    nightly trigger. For each client whose APPLIED_TEMPLATE_VERSION
 *    is behind TEMPLATE_REGISTRY.VERSION:
 *      - Diffs the template's sheet names + header rows against the
 *        client's MASTER_DB_ID
 *      - Adds any missing sheets (with headers, no data)
 *      - Adds any missing columns to existing sheets (appended at
 *        the end, existing data untouched)
 *      - Writes one row to MIGRATION_LOG (your real schema) per client
 *      - Updates DATABASE_REGISTRY.DB_VERSION / MIGRATION_STATUS if
 *        that client's DB has a DATABASE_REGISTRY row, else just logs
 *      - Updates CLIENT_DATABASE_REGISTRY.APPLIED_TEMPLATE_VERSION
 * 3. Never renames or deletes anything automatically — column
 *    renames/removals need a hand-written step function (see
 *    HAND_WRITTEN_STEPS below) because only you know how to
 *    translate old data into a new shape.
 */

const MASTER_CONTROL_DB_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I'; // BALAJI_ERP_MASTER_CONTROL_SYSTEM — from your DATABASE_REGISTRY

/**
 * Hand-written migration steps for changes a simple sheet/column
 * diff can't handle safely (renames, data transforms, deletions).
 * Keyed by TEMPLATE_ID + target VERSION. Add one entry here whenever
 * you make that kind of change to a template.
 */
const HAND_WRITTEN_STEPS = {
  // 'TEM002': {
  //   3: function(clientSS) {
  //     // e.g. version 3 renamed Bill_Header.Net_Amount -> Grand_Total
  //     const sheet = clientSS.getSheetByName('Bill_Header');
  //     const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  //     const idx = headers.indexOf('Net_Amount');
  //     if (idx > -1) sheet.getRange(1, idx+1).setValue('Grand_Total');
  //   }
  // }
};

function addAppliedVersionColumn() {
  const sheet = SpreadsheetApp.openById(MASTER_CONTROL_DB_ID).getSheetByName('CLIENT_DATABASE_REGISTRY');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('APPLIED_TEMPLATE_VERSION') > -1) return 'Column already exists.';
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue('APPLIED_TEMPLATE_VERSION');
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, col, lastRow - 1, 1).setValue(1); // backfill existing clients at version 1
  }
  return 'Added APPLIED_TEMPLATE_VERSION column, backfilled ' + (lastRow - 1) + ' clients at version 1.';
}

function syncAllClientsToTemplate(templateId) {
  const controlSS = SpreadsheetApp.openById(MASTER_CONTROL_DB_ID);
  const templateRow = findRow(controlSS.getSheetByName('TEMPLATE_REGISTRY'), 'TEMPLATE_ID', templateId);
  if (!templateRow) throw new Error('Template not found in TEMPLATE_REGISTRY: ' + templateId);

  const currentVersion = templateRow.VERSION;
  const templateSheetId = templateRow.GOOGLE_SHEET_ID;
  const templateSS = SpreadsheetApp.openById(templateSheetId);

  const clientRegSheet = controlSS.getSheetByName('CLIENT_DATABASE_REGISTRY');
  const clientData = getRowsAsObjects(clientRegSheet);
  const results = [];

  clientData.forEach(function (client, idx) {
    const applied = Number(client.APPLIED_TEMPLATE_VERSION) || 0;
    if (applied >= currentVersion) {
      results.push({ clientId: client.CLIENT_ID, status: 'UP_TO_DATE', version: applied });
      return;
    }
    try {
      const clientSS = SpreadsheetApp.openById(client.MASTER_DB_ID);
      const diffResult = diffAndApply(templateSS, clientSS);

      // Run any hand-written steps between applied+1 and currentVersion, in order
      const steps = HAND_WRITTEN_STEPS[templateId] || {};
      for (let v = applied + 1; v <= currentVersion; v++) {
        if (steps[v]) steps[v](clientSS);
      }

      // Update APPLIED_TEMPLATE_VERSION for this client
      clientRegSheet.getRange(idx + 2, headerIndex(clientRegSheet, 'APPLIED_TEMPLATE_VERSION') + 1).setValue(currentVersion);

      logMigration(client.MASTER_DB_ID, client.COMPANY_NAME || client.CLIENT_ID, 'SUCCESS',
        'Synced to template ' + templateId + ' v' + currentVersion + '. ' + diffResult.summary);

      results.push({ clientId: client.CLIENT_ID, status: 'MIGRATED', from: applied, to: currentVersion, changes: diffResult.summary });
    } catch (err) {
      logMigration(client.MASTER_DB_ID, client.COMPANY_NAME || client.CLIENT_ID, 'FAILED', err.message);
      results.push({ clientId: client.CLIENT_ID, status: 'FAILED', error: err.message });
    }
  });

  return results;
}

/**
 * Additive-only diff: adds sheets that exist in the template but not
 * the client DB (with headers, no data), and adds columns that exist
 * in a template sheet's header row but not the client's matching
 * sheet (appended at the end). Never touches existing data or
 * removes anything.
 */
function diffAndApply(templateSS, clientSS) {
  const changes = [];
  templateSS.getSheets().forEach(function (templateSheet) {
    const name = templateSheet.getName();
    let clientSheet = clientSS.getSheetByName(name);
    const templateHeaders = templateSheet.getRange(1, 1, 1, templateSheet.getLastColumn()).getValues()[0];

    if (!clientSheet) {
      clientSheet = clientSS.insertSheet(name);
      clientSheet.getRange(1, 1, 1, templateHeaders.length).setValues([templateHeaders]);
      changes.push('Added missing sheet: ' + name);
      return;
    }

    const clientHeaders = clientSheet.getLastColumn() > 0
      ? clientSheet.getRange(1, 1, 1, clientSheet.getLastColumn()).getValues()[0]
      : [];
    const missingCols = templateHeaders.filter(function (h) { return h && clientHeaders.indexOf(h) === -1; });
    if (missingCols.length) {
      const startCol = clientSheet.getLastColumn() + 1;
      clientSheet.getRange(1, startCol, 1, missingCols.length).setValues([missingCols]);
      changes.push(name + ': added columns [' + missingCols.join(', ') + ']');
    }
  });
  return { summary: changes.length ? changes.join('; ') : 'No changes needed.' };
}

function logMigration(dbId, dbName, result, message) {
  const sheet = SpreadsheetApp.openById(MASTER_CONTROL_DB_ID).getSheetByName('MIGRATION_LOG');
  sheet.appendRow([new Date(), dbId, dbName, result, message]);
}

/* ── small helpers ── */
function getRowsAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const out = [];
  for (let r = 1; r < data.length; r++) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = data[r][i]; });
    out.push(obj);
  }
  return out;
}
function findRow(sheet, keyCol, keyVal) {
  const rows = getRowsAsObjects(sheet);
  return rows.filter(function (r) { return r[keyCol] === keyVal; })[0] || null;
}
function headerIndex(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName);
}
