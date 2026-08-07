/* ══════════════════════════════════════════════════════════════════════════
   15_PaymentsVoucherSync.gs
   Adds SAVE_PAYMENT_VOUCHER / SAVE_RECEIPT_VOUCHER — payments-module.html's
   formal Payment/Receipt Voucher forms (payNo/recNo, cheque tracking, TDS,
   discount, narration) now call these on save.

   Kept SEPARATE from your existing SAVE_PAYMENT action (used by
   purchase-module.html's quick vendor-payment modal) on purpose — that one
   saves a simpler shape (vendorId/vendorName/amount/mode/ref/notes), this one
   saves a richer voucher shape. Mixing both into the same sheet would give
   you a sheet with two incompatible sets of columns. Writes to their own
   'payment_vouchers' / 'receipt_vouchers' sheets instead.

   Same pattern as 14_PurchaseInvoiceSync.gs: one spreadsheet per client via
   rbClientSpreadsheetId_(), upsert-by-id (append if new, overwrite the row
   if the id already exists — so re-saving an edited voucher doesn't create
   a duplicate row).

   HOW TO WIRE IN
       case 'SAVE_PAYMENT_VOUCHER': return jsonOut_(savePaymentVoucher_(data));
       case 'SAVE_RECEIPT_VOUCHER': return jsonOut_(saveReceiptVoucher_(data));
   Reuses rbClientSpreadsheetId_ / jsonOut_ from 12_RestaurantBilling_KOT.gs
   — don't redeclare if in the same project.
══════════════════════════════════════════════════════════════════════════ */

const PAYMENT_VOUCHER_HEADERS = [
  'id','payNo','date','party','invRef','mode','bank','amount','tds','disc',
  'netAmount','narration','chqNo','chqDate','chqBank','chqStatus','status','createdAt'
];
const RECEIPT_VOUCHER_HEADERS = [
  'id','recNo','date','party','invRef','mode','bank','amount','tds','disc',
  'netAmount','narration','chqNo','chqDate','chqBank','chqStatus','status','createdAt'
];

/* action: SAVE_PAYMENT_VOUCHER   payload: { clientId, ...paymentVoucherFields } */
function savePaymentVoucher_(data) {
  return upsertVoucherRow_(data, 'payment_vouchers', PAYMENT_VOUCHER_HEADERS);
}

/* action: SAVE_RECEIPT_VOUCHER   payload: { clientId, ...receiptVoucherFields } */
function saveReceiptVoucher_(data) {
  return upsertVoucherRow_(data, 'receipt_vouchers', RECEIPT_VOUCHER_HEADERS);
}

function upsertVoucherRow_(data, sheetName, headers) {
  try {
    const clientId = data.clientId;
    if (!clientId || !data.id) return { success: false, error: 'clientId and id required' };

    const ssId = rbClientSpreadsheetId_(clientId);
    const ss = SpreadsheetApp.openById(ssId);
    let sh = ss.getSheetByName(sheetName);
    if (!sh) {
      sh = ss.insertSheet(sheetName);
      sh.appendRow(headers);
    }

    const values = sh.getDataRange().getValues();
    const existingHeaders = values[0];
    const idIdx = existingHeaders.indexOf('id');
    if (idIdx === -1) return { success: false, error: sheetName + ' sheet has no id column' };

    const row = headers.map(h => data[h] !== undefined ? data[h] : '');

    let foundRow = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][idIdx]) === String(data.id)) { foundRow = r + 1; break; } // +1: 0-index -> 1-index sheet row
    }

    if (foundRow === -1) {
      sh.appendRow(row);
    } else {
      sh.getRange(foundRow, 1, 1, row.length).setValues([row]);
    }

    return { success: true, saved: data.id };
  } catch (err) {
    return { success: false, error: sheetName + ': ' + err.message };
  }
}
