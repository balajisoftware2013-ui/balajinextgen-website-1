/**
 * BALAJI NEXTGEN ERP — Restaurant Core API
 * ─────────────────────────────────────────────────────────────
 * Built from the ACTUAL schema in OLD_POS_REFERENCE_BACKUP.xlsx
 * (Number_Series, Bill_Header, Bill_Items, KOT_Header, KOT_Lines,
 * User_Master columns match exactly). This is NOT a guess at your
 * structure — it's read directly from your real workbook.
 *
 * SCOPE — read this before assuming this is "the complete backend":
 * This file wires up ONLY the endpoints the HTML fixes in this
 * conversation have been calling as localStorage placeholders:
 *   - NEXT_NUMBER      (Bill No / KOT No / Order No / Customer No)
 *   - SAVE_KOT         (writes KOT_Header + KOT_Lines)
 *   - SAVE_BILL        (writes Bill_Header + Bill_Items)
 *   - GET_STAFF_LIST   (reads User_Master)
 *   - DAY_OPEN / DAY_CLOSE / GET_DAY_STATUS (new sheet, see below)
 *
 * It does NOT implement: Order Register, Bills List settlement,
 * Reservations, Bar/KDS sync, Reports Hub data capture, QR ordering,
 * Tally export, or any of the other 30+ items in your spec. Building
 * those against sheets I haven't seen (Reservations, Settlements,
 * etc. aren't in the uploaded backup) would mean guessing structure
 * — exactly what caused the "86 files, 3 endpoints, silent collisions"
 * mess you already dug out of once. Send the actual current .gs
 * files or the live Sheet IDs for those modules and I'll extend this
 * the same schema-accurate way instead of inventing new tables.
 *
 * DEPLOYMENT:
 * 1. Paste into the SAME Apps Script project as your Restaurant ERP
 *    (attached to BALAJI_ERP_MASTER_CONTROL_SYSTEM or wherever
 *    Bill_Header/KOT_Header/etc. actually live).
 * 2. Set RESTAURANT_CORE_SPREADSHEET_ID below to that Sheet's ID.
 * 3. Deploy > New deployment > Web app > Execute as: Me > Access:
 *    Anyone with the link. Copy the /exec URL into V2_CORE_URL in
 *    the HTML (wherever erpApi() currently points).
 * 4. Add a "Day_Status" sheet manually (see DAY_STATUS_HEADERS below)
 *    — it doesn't exist in your uploaded backup, so I can't assume
 *    columns for it; using a simple 4-column layout, adjust if needed.
 * 5. DO NOT let this file declare its own doPost/doGet — your project
 *    already has one (almost certainly in 44_OrderEngine.gs or
 *    similar). GAS only allows ONE doPost/doGet per project; a second
 *    one silently overrides or fights the first depending on file
 *    load order, with no clear error. Instead, this file exports
 *    restaurantCoreApiRouter(action, body) — open your EXISTING
 *    doPost function and add one line routing these 8 actions to it:
 *
 *      function doPost(e) {
 *        const body = JSON.parse(e.postData.contents);
 *        const CORE_API_ACTIONS = ['NEXT_NUMBER','SAVE_KOT','SAVE_BILL','GET_STAFF_LIST','ADD_STAFF','DAY_OPEN','DAY_CLOSE','GET_DAY_STATUS'];
 *        if (CORE_API_ACTIONS.indexOf(body.action) > -1) {
 *          return restaurantCoreApiRouter(body.action, body);
 *        }
 *        // ...your existing routing continues below...
 *      }
 */

const RESTAURANT_CORE_SPREADSHEET_ID = 'PASTE_YOUR_RESTAURANT_TRANSACTION_DB_ID_HERE'; // was named SPREADSHEET_ID — renamed because that name is almost certainly already declared in another .gs file in this project
const RC_USER_SECURITY_DB_ID = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg'; // USER_SECURITY_MASTER_DB — from your uploaded file, DATABASE_REGISTRY confirms this ID

/**
 * Call this from your EXISTING doPost/doGet — do NOT let this file
 * declare its own. Returns a ContentService JSON response same as
 * before, just routed differently so it can't collide with your
 * live Order Engine / Import Hub / Reset Engine endpoints.
 */
function restaurantCoreApiRouter(action, body) {
  const lock = LockService.getScriptLock();
  try {
    let result;
    switch (action) {
      case 'NEXT_NUMBER':
        lock.waitLock(10000);
        result = rcNextNumber(body.series); // 'ORDER' | 'INVOICE' | 'KOT' | 'PAYMENT' | 'CUSTOMER'
        break;
      case 'SAVE_KOT':
        lock.waitLock(10000);
        result = rcSaveKOT(body);
        break;
      case 'SAVE_BILL':
        lock.waitLock(10000);
        result = rcSaveBill(body);
        break;
      case 'GET_STAFF_LIST':
        result = rcGetStaffList(body.clientId, body.roles);
        break;
      case 'ADD_STAFF':
        lock.waitLock(10000);
        result = rcAddStaff(body);
        break;
      case 'DAY_OPEN':
        lock.waitLock(10000);
        result = rcDayOpen(body);
        break;
      case 'DAY_CLOSE':
        lock.waitLock(10000);
        result = rcDayClose(body);
        break;
      case 'GET_DAY_STATUS':
        result = rcGetDayStatus(body.businessDate);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    return restaurantCoreJsonOut(result);
  } catch (err) {
    return restaurantCoreJsonOut({ success: false, error: err.message, stack: err.stack });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function restaurantCoreJsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function restaurantCoreSS() { return SpreadsheetApp.openById(RESTAURANT_CORE_SPREADSHEET_ID); }

/* ── NUMBER SERIES ─────────────────────────────────────────────
   Matches your real Number_Series sheet exactly:
   Series_Name | Prefix | Last_Number | Format
   e.g. INVOICE | HT/2526/ | 6258 | 00000000  →  HT/2526/00006259
   Atomic increment under LockService so two POS terminals hitting
   Save at the same instant never get the same number. */
function rcNextNumber(seriesName) {
  const sheet = restaurantCoreSS().getSheetByName('Number_Series');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameCol = headers.indexOf('Series_Name');
  const prefixCol = headers.indexOf('Prefix');
  const lastCol = headers.indexOf('Last_Number');
  const fmtCol = headers.indexOf('Format');

  for (let r = 1; r < data.length; r++) {
    if (data[r][nameCol] === seriesName) {
      const next = Number(data[r][lastCol]) + 1;
      sheet.getRange(r + 1, lastCol + 1).setValue(next);
      const format = data[r][fmtCol] || '0000';
      const padded = String(next).padStart(String(format).length, '0');
      const number = (data[r][prefixCol] || '') + padded;
      return { success: true, data: { number, seq: next } };
    }
  }
  return { success: false, error: 'Series not found in Number_Series: ' + seriesName };
}

/* ── KOT ────────────────────────────────────────────────────────
   Writes KOT_Header + KOT_Lines exactly matching your real columns.
   One call per department ticket (Kitchen / Bar) — matches the
   dual-KOT split already built into the HTML (printKOTSplit). */
function rcSaveKOT(body) {
  // body: { table, dept, orderBy, items:[{orderItemId,itemId,qty,notes}], orderId }
  const kotHeaderSheet = restaurantCoreSS().getSheetByName('KOT_Header');
  const kotLinesSheet = restaurantCoreSS().getSheetByName('KOT_Lines');
  const numRes = rcNextNumber('KOT');
  if (!numRes.success) return numRes;
  const kotNo = numRes.data.number;
  const kotId = 'KOT-' + Utilities.getUuid().slice(0, 8);
  const now = new Date();

  kotHeaderSheet.appendRow([
    kotId, kotNo, body.orderId || '', body.table || '', body.dept || 'KITCHEN',
    now, body.orderBy || '', '', 'NEW', now, '', '', body.priority || 'NORMAL', false
  ]);

  (body.items || []).forEach(function (item) {
    kotLinesSheet.appendRow([
      'KI-' + Utilities.getUuid().slice(0, 8), kotId, body.dept || 'KITCHEN',
      item.orderItemId || '', item.itemId || '', item.qty || 1, item.notes || '',
      'NEW', '', '', ''
    ]);
  });

  return { success: true, data: { kotId, kotNo } };
}

/* ── BILL ───────────────────────────────────────────────────────
   Writes Bill_Header + Bill_Items exactly matching your real columns.
   Uses the INVOICE series (HT/2526/00006259 style) so bill numbering
   is server-side and race-safe — not the localStorage counter the
   HTML currently falls back to when this endpoint isn't deployed. */
function rcSaveBill(body) {
  // body: { orderId, table, pax, customerName, items:[{orderItemId,itemId,itemName,qty,rate,gross,discount,tax,netAmount}],
  //         subTotal, discount, tax, netAmount, cash, card, upi, paymentStatus }
  const billHeaderSheet = restaurantCoreSS().getSheetByName('Bill_Header');
  const billItemsSheet = restaurantCoreSS().getSheetByName('Bill_Items');
  const numRes = rcNextNumber('INVOICE');
  if (!numRes.success) return numRes;
  const invoiceNo = numRes.data.number;
  const billId = 'BILL-' + Utilities.getUuid().slice(0, 8);
  const now = new Date();

  billHeaderSheet.appendRow([
    billId, body.orderId || '', invoiceNo, now, body.table || '', body.pax || 1,
    body.customerName || 'GENERAL CUSTOMER', body.subTotal || 0, body.discount || 0,
    body.tax || 0, body.netAmount || 0, body.cash || 0, body.card || 0, body.upi || 0,
    body.paymentStatus || 'PAID', now, ''
  ]);

  (body.items || []).forEach(function (item) {
    billItemsSheet.appendRow([
      'BI-' + Utilities.getUuid().slice(0, 8), billId, item.orderItemId || '',
      item.itemId || '', item.itemName || '', item.qty || 1, item.rate || 0,
      item.gross || 0, item.discount || 0, item.tax || 0, item.netAmount || 0
    ]);
  });

  return { success: true, data: { billId, invoiceNo } };
}

/* ── STAFF LIST ─────────────────────────────────────────────────
   CORRECTED — this originally guessed a 5-column User_Master from
   an old backup file. Your REAL USER_MASTER (from
   USER_SECURITY_MASTER_DB) has 35 columns including CLIENT_ID,
   USER_CODE, FULL_NAME, ROLE, ACCESS_LEVEL, STATUS, LICENSE_STATUS.
   This now filters by BOTH client and role against the real sheet. */
function rcGetStaffList(clientId, roles) {
  const sheet = SpreadsheetApp.openById(RC_USER_SECURITY_DB_ID).getSheetByName('USER_MASTER');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  const staff = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col['STATUS']] !== 'ACTIVE') continue;
    if (clientId && row[col['CLIENT_ID']] !== clientId) continue;
    if (roles && roles.length && roles.indexOf(row[col['ROLE']]) === -1) continue;
    staff.push({
      USER_CODE: row[col['USER_CODE']],
      FULL_NAME: row[col['FULL_NAME']],
      ROLE: row[col['ROLE']],
      MOBILE: row[col['MOBILE_NO']],
      DESIGNATION: row[col['DESIGNATION']]
    });
  }
  return { success: true, data: { staff: staff } };
}

/* ── ADD STAFF ──────────────────────────────────────────────────
   Writes a new row to the REAL USER_MASTER matching all 35 columns
   (blank where not supplied). Matches what Staff & Role Management
   in the HTML now calls when you tap "Create Staff Member". */
function rcAddStaff(body) {
  // body: { clientId, fullName, role, userCode, password, mobile, designation, createdBy }
  const sheet = SpreadsheetApp.openById(RC_USER_SECURITY_DB_ID).getSheetByName('USER_MASTER');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastId = sheet.getLastRow() > 1
    ? Number(sheet.getRange(sheet.getLastRow(), headers.indexOf('USER_ID') + 1).getValue()) || 0
    : 0;

  const rowObj = {
    USER_ID: lastId + 1,
    CLIENT_ID: body.clientId,
    USER_CODE: body.userCode,
    FULL_NAME: body.fullName,
    EMAIL: body.email || '',
    MOBILE_NO: body.mobile || '',
    PASSWORD: body.password,
    ROLE: body.role,
    INDUSTRY: body.industry || 'RESTAURANT_PUB',
    BRANCH: body.branch || 'HEAD_OFFICE',
    ACCESS_LEVEL: body.accessLevel || 'STANDARD',
    STATUS: 'ACTIVE',
    WEB_ACCESS: 'YES',
    APP_ACCESS: 'YES',
    OTP_ACCESS: 'NO',
    LOGIN_TYPE: 'PASSWORD',
    COMPANY_NAME: body.companyName || '',
    DEPARTMENT: body.department || '',
    DESIGNATION: body.designation || body.role,
    DEFAULT_DASHBOARD: body.role + '_DASHBOARD',
    CREATED_BY: body.createdBy || 'ADMIN',
    CREATED_DATE: new Date(),
    PASSWORD_UPDATED: new Date(),
    LICENSE_STATUS: 'ACTIVE'
  };

  const row = headers.map(function (h) { return rowObj[h] !== undefined ? rowObj[h] : ''; });
  sheet.appendRow(row);
  return { success: true, data: { userId: rowObj.USER_ID, userCode: rowObj.USER_CODE } };
}

/* ── DAY OPEN / CLOSE ───────────────────────────────────────────
   Not in your uploaded backup — no existing sheet to match, so this
   is a NEW sheet proposal, not read from your real schema like the
   rest of this file. Create a sheet named "Day_Status" with headers:
   Business_Date | Status | Opening_Cash | Closing_Cash | Opened_At | Closed_At | Opened_By
   Adjust column order below if you create it differently. */
function rcDayOpen(body) {
  const sheet = restaurantCoreGetOrCreateDayStatusSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === body.businessDate) {
      return { success: false, error: 'Day already opened for ' + body.businessDate };
    }
  }
  sheet.appendRow([body.businessDate, 'OPEN', body.openingCash || 0, '', new Date(), '', body.openedBy || '']);
  return { success: true };
}
function rcDayClose(body) {
  const sheet = restaurantCoreGetOrCreateDayStatusSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === body.businessDate) {
      sheet.getRange(r + 1, 2).setValue('CLOSED');
      sheet.getRange(r + 1, 4).setValue(body.closingCash || 0);
      sheet.getRange(r + 1, 6).setValue(new Date());
      return { success: true };
    }
  }
  return { success: false, error: 'No open day found for ' + body.businessDate };
}
function rcGetDayStatus(businessDate) {
  const sheet = restaurantCoreGetOrCreateDayStatusSheet();
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === businessDate) {
      return { success: true, data: { status: data[r][1], openingCash: data[r][2] } };
    }
  }
  return { success: true, data: { status: 'CLOSED' } };
}
function restaurantCoreGetOrCreateDayStatusSheet() {
  let sheet = restaurantCoreSS().getSheetByName('Day_Status');
  if (!sheet) {
    sheet = restaurantCoreSS().insertSheet('Day_Status');
    sheet.appendRow(['Business_Date', 'Status', 'Opening_Cash', 'Closing_Cash', 'Opened_At', 'Closed_At', 'Opened_By']);
  }
  return sheet;
}
