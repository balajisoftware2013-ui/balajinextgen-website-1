/**
 * GUEST ADVANCE — backend for the dashboard (Google Apps Script, V2_CORE)
 *
 * Two sheets are created automatically:
 *   ADVANCE_LEDGER : one row per guest advance (latest state)
 *   ADVANCE_TXN    : append-only log (RECEIVED / ADJUSTED / REFUND / FORFEIT)
 *
 * Wire into your existing action switch in V2_CORE doPost, e.g.
 *     case 'SAVE_ADVANCE_TXN':    return json_(advSaveTxn_(payload));
 *     case 'LIST_ADVANCE_LEDGER': return json_(advList_(payload));
 * (use whatever response helper your script already has instead of json_).
 */

var ADV_LEDGER_HEAD = ['ID','DATE','GUEST','PHONE','AMOUNT','MODE','PARTY_DATE','TABLE','ADJUSTED','REFUNDED','FORFEITED','PENDING','STATUS','RES_ID','SOURCE','REMARKS','UPDATED_AT','JSON'];
var ADV_TXN_HEAD    = ['TXN_ID','TYPE','ADV_ID','DATE','AMOUNT','MODE','GUEST','BILL_NO','BY','AT','REMARKS'];

function advSheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}

function advSaveTxn_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var a = p.advance, t = p.txn;
    if (a && a.id) {
      var sh = advSheet_('ADVANCE_LEDGER', ADV_LEDGER_HEAD);
      var pending = Number(a.amount||0) - Number(a.adjusted||0) - Number(a.refunded||0) - Number(a.forfeited||0);
      var status = pending > 0.005 ? ((a.adjusted||a.refunded||a.forfeited) ? 'Part Settled' : 'Pending') : 'Settled';
      var row = [a.id,a.date,a.guest,a.phone,a.amount,a.mode,a.partyDate,a.table,a.adjusted||0,a.refunded||0,a.forfeited||0,pending,status,a.resId||'',a.source||'',a.remarks||'',a.updatedAt||new Date().toISOString(),JSON.stringify(a)];
      var ids = sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),1).getValues().map(function(r){return r[0];});
      var i = ids.indexOf(a.id);
      if (i >= 0 && sh.getLastRow() > 1) sh.getRange(i+2,1,1,row.length).setValues([row]); else sh.appendRow(row);
    }
    if (t && t.txnId) {
      var ts = advSheet_('ADVANCE_TXN', ADV_TXN_HEAD);
      var tids = ts.getLastRow() > 1 ? ts.getRange(2,1,ts.getLastRow()-1,1).getValues().map(function(r){return r[0];}) : [];
      if (tids.indexOf(t.txnId) < 0)           // idempotent: same txnId is never written twice
        ts.appendRow([t.txnId,t.type,t.advId,t.date,t.amount,t.mode,t.guest,t.billNo||'',t.by||'',t.at,t.remarks||'']);
    }
    return { success: true };
  } finally { lock.releaseLock(); }
}

function advList_(p) {
  var out = { advances: [], txns: [] };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('ADVANCE_LEDGER');
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2,18,sh.getLastRow()-1,1).getValues().forEach(function(r){ try { out.advances.push(JSON.parse(r[0])); } catch(e){} });
  }
  var ts = ss.getSheetByName('ADVANCE_TXN');
  if (ts && ts.getLastRow() > 1) {
    ts.getRange(2,1,ts.getLastRow()-1,ADV_TXN_HEAD.length).getValues().forEach(function(r){
      out.txns.push({txnId:r[0],type:r[1],advId:r[2],date:r[3],amount:r[4],mode:r[5],guest:r[6],billNo:r[7],by:r[8],at:r[9],remarks:r[10]});
    });
  }
  return { success: true, data: out };
}

/**
 * SAVE_BILL: the dashboard now also sends
 *   bill.advanceAdjusted, bill.balanceDue, bill.advanceRefs,
 *   bill.payments = [{mode:'ADVANCE',amount:..},{mode:'UPI',amount:..}]
 * In bnxSaveBill write the split into your payment rows instead of one
 * full-amount row, so cash/UPI totals and DSR count only the balance paid
 * today (the advance was already counted when it was received).
 */
