/* =====================================================
   BALAJI NEXTGEN ERP
   44_OrderEngine.gs
   Unified order creation — every order source (main POS,
   Steward mobile app, Dine-in table, Customer/QR self-order,
   Online aggregator) writes into the SAME real sheet:
   18_CAPTAIN_ORDER_MASTER — using its existing columns,
   not a separate "Orders" sheet. This is what makes a
   Steward-placed order actually show up in the restaurant's
   main POS/KOT view: same sheet, different ORDER_TYPE.

   Does NOT touch login/auth. Purely additive.
   Depends on 00_Config.gs: getClientDbId(), successResponse(),
   errorResponse(), getCurrentDateTime(), generateId().
===================================================== */

const ORDER_TYPES = ['POS', 'STEWARD', 'DINEIN', 'CUSTOMER', 'ONLINE'];
const ORDER_STATUS_VALUES = ['NEW', 'CONFIRMED', 'KOT_PRINTED', 'PREPARING', 'READY', 'SERVED', 'BILLED', 'CANCELLED', 'NC'];
// NC = No Charge — complimentary / void order, tracked but excluded from revenue reports

const CAPTAIN_ORDER_TAB = '18_CAPTAIN_ORDER_MASTER';
const CAPTAIN_ORDER_HEADERS = [
  'ORDER_ID','ORDER_NO','ORDER_DATE','INVOICE_NO','TABLE_ID','OUTLET_ID','ORDER_TYPE',
  'PAX','CUSTOMER_NAME','MOBILE_NO','NOTES','START_TIME','END_TIME','CREATED_BY',
  'STATUS','ITEM_CODE','ITEM_NAME','QTY','RATE','AMOUNT','MODIFIER','REMARK',
  'ORDER_STATUS','KOT_NO'
];

function ORD_getSheet_(clientId) {
  const dbId = getClientDbId(clientId, 'MASTER'); // Captain Order Master lives in MASTER DB per the real schema
  if (!dbId) throw new Error('No MASTER DB registered for client ' + clientId);
  const ss = SpreadsheetApp.openById(dbId);
  let sheet = ss.getSheetByName(CAPTAIN_ORDER_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CAPTAIN_ORDER_TAB);
    sheet.appendRow(CAPTAIN_ORDER_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------- SAVE_ORDER — used by POS, Steward app, QR self-order, etc ---------- */
function ORD_saveOrder(params) {
  try {
    const clientId = params.clientId;
    const orderType = (params.orderType || 'POS').toUpperCase();
    if (ORDER_TYPES.indexOf(orderType) === -1) {
      return errorResponse('Unknown ORDER_TYPE: ' + orderType + ' — must be one of ' + ORDER_TYPES.join(', '));
    }

    const sheet = ORD_getSheet_(clientId);
    const items = JSON.parse(params.items); // [{itemCode, itemName, qty, rate, modifier, remark}]
    const now = new Date();
    const orderId = params.orderId || generateId('ORD');
    const orderNo = params.orderNo || ('ORD-' + Utilities.formatDate(now, 'Asia/Kolkata', 'ddMMyy') + '-' + Math.floor(Math.random()*900+100));
    const startTime = getCurrentDateTime();

    if (!items.length) return errorResponse('No items in order');

    const rows = items.map(item => [
      orderId, orderNo, Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy'),
      params.invoiceNo || '', params.tableId || '', params.outletId || 'MAIN',
      orderType, params.pax || 1, params.customerName || 'GENERAL CUSTOMER', params.mobileNo || '1111111111',
      params.notes || '', startTime, '', params.createdBy || orderType,
      'ACTIVE', item.itemCode || '', item.itemName, item.qty, item.rate, (item.qty*item.rate),
      item.modifier || '', item.remark || '', 'NEW', params.kotNo || '',
    ]);

    sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);

    return successResponse('Order saved', { orderId, orderNo, orderType, itemCount: items.length });
  } catch (err) {
    return errorResponse(err.toString());
  }
}

/* ---------- UPDATE_ORDER_STATUS — e.g. mark NEW -> KOT_PRINTED -> SERVED -> BILLED, or NC ---------- */
function ORD_updateStatus(params) {
  try {
    const clientId = params.clientId;
    const orderId = params.orderId;
    const newStatus = (params.status || '').toUpperCase();
    if (ORDER_STATUS_VALUES.indexOf(newStatus) === -1) {
      return errorResponse('Unknown status: ' + newStatus + ' — must be one of ' + ORDER_STATUS_VALUES.join(', '));
    }

    const sheet = ORD_getSheet_(clientId);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdCol = headers.indexOf('ORDER_ID');
    const statusCol = headers.indexOf('ORDER_STATUS');
    const endTimeCol = headers.indexOf('END_TIME');

    let updated = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][orderIdCol] === orderId) {
        sheet.getRange(i+1, statusCol+1).setValue(newStatus);
        if (newStatus === 'BILLED' || newStatus === 'CANCELLED' || newStatus === 'NC') {
          sheet.getRange(i+1, endTimeCol+1).setValue(getCurrentDateTime());
        }
        updated++;
      }
    }
    if (!updated) return errorResponse('Order not found: ' + orderId);
    return successResponse('Status updated', { orderId, newStatus, rowsUpdated: updated });
  } catch (err) {
    return errorResponse(err.toString());
  }
}

/* ---------- GET_ACTIVE_ORDERS — the POS/KOT screen calls this to show
   EVERY order regardless of source (POS counter, Steward app, QR table,
   online aggregator) in one unified list, filterable by orderType ---------- */
function ORD_getActiveOrders(params) {
  try {
    const clientId = params.clientId;
    const filterType = params.orderType ? params.orderType.toUpperCase() : null; // optional
    const sheet = ORD_getSheet_(clientId);
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return successResponse('OK', { orders: [] });

    const headers = data[0];
    const idIdx = headers.indexOf('ORDER_ID');
    const statusIdx = headers.indexOf('ORDER_STATUS');
    const typeIdx = headers.indexOf('ORDER_TYPE');

    // Group item-rows back into one order-per-ID with an items array
    const grouped = {};
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (['BILLED','CANCELLED'].indexOf(row[statusIdx]) !== -1) continue; // active orders only
      if (filterType && row[typeIdx] !== filterType) continue;

      const id = row[idIdx];
      if (!grouped[id]) {
        grouped[id] = {};
        headers.forEach((h, idx) => { if (h) grouped[id][h] = row[idx]; });
        grouped[id].items = [];
      }
      grouped[id].items.push({
        itemName: row[headers.indexOf('ITEM_NAME')],
        qty: row[headers.indexOf('QTY')],
        rate: row[headers.indexOf('RATE')],
        amount: row[headers.indexOf('AMOUNT')],
      });
    }

    return successResponse('OK', { orders: Object.values(grouped) });
  } catch (err) {
    return errorResponse(err.toString());
  }
}

/* ---------- GET_DASHBOARD_SUMMARY — real today's-revenue/orders/covers
   computed from 08_BILL_HEADER, plus active orders from Order Engine.
   This is what the main dashboard calls on page load — moved here (V2_CORE)
   because V2_FRONTEND is currently unreachable in production. ---------- */
function ORD_getDashboardSummary(params) {
  try {
    const clientId = params.clientId;
    const dbId = getClientDbId(clientId, 'TRANSACTION');
    let revenue = 0, orders = 0, covers = 0;

    if (dbId) {
      try {
        const ss = SpreadsheetApp.openById(dbId);
        const sheet = ss.getSheetByName('08_BILL_HEADER');
        if (sheet) {
          const data = sheet.getDataRange().getValues();
          const headers = data[0];
          const dateCol = headers.indexOf('BILL_DATE');
          const totalCol = headers.indexOf('GRAND_TOTAL');
          const paxCol = headers.indexOf('PAX');
          const statusCol = headers.indexOf('BILL_STATUS');
          const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy');

          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowDate = row[dateCol] instanceof Date
              ? Utilities.formatDate(row[dateCol], 'Asia/Kolkata', 'dd-MM-yyyy')
              : String(row[dateCol]);
            if (rowDate === today && row[statusCol] !== 'CANCELLED') {
              revenue += Number(row[totalCol]) || 0;
              orders++;
              covers += Number(row[paxCol]) || 0;
            }
          }
        }
      } catch (e) { /* sheet doesn't exist yet — return zeros, not an error */ }
    }

    let activeOrders = [];
    try {
      const activeRes = ORD_getActiveOrders({ clientId: clientId });
      const parsed = JSON.parse(activeRes.getContent());
      if (parsed.success) activeOrders = parsed.data.orders;
    } catch (e) { /* fine — dashboard just shows no active orders */ }

    return successResponse('OK', { revenue, orders, covers, activeOrders });
  } catch (err) {
    return errorResponse(err.toString());
  }
}
