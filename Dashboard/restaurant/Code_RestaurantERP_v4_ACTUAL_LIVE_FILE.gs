/***********************************************************************
 * BALAJI NEXTGEN — RESTAURANT ERP BACKEND (Code.gs) — v4
 * ------------------------------------------------------------------
 * THIS IS THE FILE THAT ACTUALLY RUNS LIVE — confirmed by exact string
 * match: your live /exec URL's GET response ("Balaji NextGen Restaurant
 * ERP API is live (v3 - 3-database architecture)") only exists in this
 * file's doGet(), not in 08_CoreRouter.gs. Since both files declare
 * top-level doPost/doGet, Apps Script silently let this one win —
 * meaning every fix given for 08_CoreRouter.gs earlier in this
 * conversation was going into a file that never executes.
 *
 * WHAT'S FIXED IN v4 (from v3, which is what you pasted me):
 *
 * 1. SAVE_KITCHEN_INDENT now accepts a batch items[] array — THIS WAS
 *    THE ROOT CAUSE of the blank ITEM_NAME/UNIT/REQUIRED_QTY bug that
 *    took this whole conversation to track down. v3 only ever read a
 *    single top-level req.itemName/req.unit/req.qty, which are
 *    undefined when kitchen-indent.html sends items nested inside
 *    items[] — so every save silently wrote blanks while still
 *    returning {success:true}.
 *
 * 2. Added GET_ITEMS — reads from 34_ITEM_MASTER (confirmed by your
 *    own v3 comments as where real catalogue data actually lives, not
 *    the empty ITEM_MASTER placeholder tab).
 *
 * 3. SYNC_PUSH_TABLE / SYNC_PULL_ALL — v3 explicitly returned "not
 *    implemented" for push. Now a real generic implementation: each
 *    local table gets its own SYNC_<TABLE> sheet in TRANSACTION_DB.
 *
 * 4. Added GET_CONSUMPTION_HISTORY — reads KITCHEN_CONSUMPTION,
 *    enriched with category/cost from 34_ITEM_MASTER (kept the SAME
 *    real-vs-estimated honesty from the version built for
 *    kitchen-consumption.html earlier).
 *
 * 5. Added SAVE_BAR_INDENT / GET_PENDING_INDENTS (bar-aware) /
 *    APPROVE_ISSUE_INDENT — v3 only had kitchen indents, no bar
 *    indent workflow at all.
 *
 * Everything else (PURCHASE_MASTER handling, provisionClientSheets,
 * runDiag, bar consumption receiving) is UNCHANGED from your v3 —
 * only added what was missing, nothing removed.
 *
 * DEPLOY: paste this whole file over your live Code.gs (or whatever
 * this file is actually named in your project — the one with the
 * "v3 - 3-database architecture" message), save, then Deploy →
 * Manage deployments → edit → Version: New version → Deploy.
 *
 * ALSO IMPORTANT: 08_CoreRouter.gs, 07_ERPDatabaseRouter.gs, and
 * 09_MainRouter.gs all sound like they could ALSO define doPost/doGet.
 * If any of them do, you now have 2+ files fighting over which one
 * runs. Since THIS file is confirmed to be the one currently winning,
 * check the OTHER router-named files for their own doPost/doGet and
 * either delete those functions or rename them if they're not meant
 * to be the live entry point.
 ***********************************************************************/

const MASTER_CONTROL_SHEET_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';

function doGet(e){
  const action = e && e.parameter && e.parameter.action;
  if (action === 'diag') return respond(runDiag());
  if (action === 'PING' || action === 'ping') return respond({ success:true, status:'ok', message:'Balaji NextGen Restaurant ERP API is live (v4)' });
  return respond({success:true, message:'Balaji NextGen Restaurant ERP API is live (v4 - 3-database architecture)'});
}

function doPost(e){
  const lock = LockService.getScriptLock();
  try{
    const req = JSON.parse(e.postData.contents);
    const clientId = req.clientId;
    if(!clientId) return respond({success:false, message:'No clientId supplied.'});

    const clientRow = findRow(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', clientId);
    if(!clientRow || !clientRow.MASTER_DB_ID){
      return respond({success:false, message:'Client "'+clientId+'" has no registered database. Run provisionClientSheets() for this client first.'});
    }
    const dbs = {
      masterId: clientRow.MASTER_DB_ID,
      txnId: clientRow.TRANSACTION_DB_ID || clientRow.MASTER_DB_ID,
      reportId: clientRow.REPORT_DB_ID || clientRow.MASTER_DB_ID
    };
    lock.waitLock(30000);
    const out = route(dbs, req);
    return respond(out);
  }catch(err){
    return respond({success:false, message: err.message});
  }finally{
    try{ lock.releaseLock(); }catch(e){}
  }
}
function respond(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function route(dbs, req){
  switch(req.action){

    case 'SAVE_PURCHASE_INVOICE':
    case 'UPDATE_PURCHASE_INVOICE':
    case 'SAVE_GRN':
      return savePurchaseRow(dbs.txnId, req);
    case 'UPDATE_GRN':
      return updatePurchaseRow(dbs.txnId, req);
    case 'DELETE_GRN':
      return deletePurchaseRow(dbs.txnId, req);

    case 'SAVE_PAYMENT':
      appendRowByHeader(dbs.txnId, '13_RECEIPT_VOUCHER',
        ['VOUCHER_NO','CLIENT_ID','DATE','PARTY_NAME','AMOUNT','MODE','REFERENCE','NOTES'],
        {VOUCHER_NO:req.id||Utilities.getUuid(), CLIENT_ID:req.clientId, DATE:req.date||new Date(), PARTY_NAME:req.vendorName||'',
         AMOUNT:req.amount||0, MODE:req.mode||'', REFERENCE:req.ref||'', NOTES:req.notes||''}
      );
      return {success:true};

    // FIX: accepts EITHER single item (old shape) OR batch items[].
    case 'SAVE_KITCHEN_INDENT': {
      const itemList = (req.items && req.items.length) ? req.items : [{
        itemCode: req.itemCode, itemName: req.itemName, unit: req.unit, qty: req.qty,
      }];
      const contextTag = buildIndentRemarks(req);
      itemList.forEach(function(it){
        const remarks = it.remarks ? (contextTag + ' — ' + it.remarks) : contextTag;
        appendRowByHeader(dbs.txnId, 'KITCHEN_INDENT',
          ['IND_ID','CLIENT_ID','DATE','ITEM_ID','ITEM_NAME','UNIT','REQUIRED_QTY','ISSUED_QTY','ISSUED_BY','STATUS','REMARKS'],
          {IND_ID:Utilities.getUuid(), CLIENT_ID:req.clientId, DATE:req.date||new Date(),
           ITEM_ID: it.itemId||it.itemCode||'', ITEM_NAME: it.itemName||it.name||'', UNIT: it.unit||'',
           REQUIRED_QTY: it.requiredQty||it.qty||0, ISSUED_QTY:0, ISSUED_BY:req.issuedBy||'',
           STATUS:'PENDING', REMARKS:remarks}
        );
      });
      return {success:true, saved: itemList.length};
    }

    case 'ACK_KITCHEN_INDENT':
      return ackByIdField(dbs.txnId, 'KITCHEN_INDENT', 'IND_ID', req.indentId, {STATUS:'ACKNOWLEDGED'});

    case 'GET_PENDING_INDENTS': {
      const wantStatus = req.status ? String(req.status).toUpperCase() : null;
      const kitchen = getRowsWhere(dbs.txnId, 'KITCHEN_INDENT', function(r){
        return wantStatus ? String(r.STATUS).toUpperCase() === wantStatus : true;
      }).map(function(r){ r.INDENT_TYPE = 'KITCHEN'; return r; });
      const bar = getRowsWhere(dbs.txnId, 'BAR_INDENT', function(r){
        return wantStatus ? String(r.STATUS).toUpperCase() === wantStatus : true;
      }).map(function(r){ r.INDENT_TYPE = 'BAR'; return r; });
      return { success:true, indents: kitchen.concat(bar) };
    }

    case 'SAVE_BAR_INDENT': {
      const items = req.items || [];
      if (!items.length) return { success:false, message:'No items in indent' };
      items.filter(function(i){ return Number(i.requiredQty) > 0; }).forEach(function(it){
        appendRowByHeader(dbs.txnId, 'BAR_INDENT',
          ['IND_ID','CLIENT_ID','DATE','ITEM_NAME','CATEGORY','UNIT','REQUIRED_QTY','ISSUED_QTY','ISSUED_BY','STATUS','REMARKS'],
          {IND_ID:Utilities.getUuid(), CLIENT_ID:req.clientId, DATE:req.date||new Date(),
           ITEM_NAME: it.itemName||'', CATEGORY: it.category||'', UNIT: it.unit||'',
           REQUIRED_QTY: it.requiredQty||0, ISSUED_QTY:0, ISSUED_BY:req.issuedBy||'',
           STATUS:'PENDING', REMARKS: it.remarks||''}
        );
      });
      return { success:true, saved: items.length };
    }

    case 'APPROVE_ISSUE_INDENT': {
      const tab = String(req.indentType).toUpperCase() === 'BAR' ? 'BAR_INDENT' : 'KITCHEN_INDENT';
      const sh = sheet(dbs.txnId, tab);
      if (!sh) return { success:false, message: tab+' not found' };
      const data = sh.getDataRange().getValues();
      const hdr = data[0];
      const idIdx = hdr.indexOf('IND_ID'), reqIdx = hdr.indexOf('REQUIRED_QTY'),
            issuedIdx = hdr.indexOf('ISSUED_QTY'), statusIdx = hdr.indexOf('STATUS');
      for (let i=1;i<data.length;i++){
        if (String(data[i][idIdx]) === String(req.indId)){
          const requiredQty = Number(data[i][reqIdx]) || 0;
          const issuedQty = Number(req.issuedQty) || 0;
          sh.getRange(i+1, issuedIdx+1).setValue(issuedQty);
          sh.getRange(i+1, statusIdx+1).setValue(issuedQty >= requiredQty ? 'ISSUED' : 'PARTIALLY_ISSUED');
          return { success:true, issuedQty: issuedQty };
        }
      }
      return { success:false, message:'Indent not found: '+req.indId };
    }

    case 'ISSUE_STOCK_TO_DEPT':
      appendRowByHeader(dbs.txnId, 'KITCHEN_INDENT',
        ['IND_ID','CLIENT_ID','DATE','ITEM_ID','ITEM_NAME','UNIT','REQUIRED_QTY','ISSUED_QTY','ISSUED_BY','STATUS','REMARKS'],
        {IND_ID:req.id||Utilities.getUuid(), CLIENT_ID:req.clientId, DATE:req.date||new Date(), ITEM_ID:req.itemCode||'',
         ITEM_NAME:req.itemName||req.item_name||'', UNIT:req.unit||'', REQUIRED_QTY:req.qty||0, ISSUED_QTY:req.qty||0,
         ISSUED_BY:req.issuedBy||'', STATUS:'ISSUED', REMARKS:'Store Issue - awaiting confirmation'}
      );
      return {success:true};

    case 'GET_DEPT_ISSUES':
      return { success:true, issues: getRowsWhere(dbs.txnId, 'KITCHEN_INDENT', function(r){ return r.STATUS==='ISSUED'; }) };

    case 'ACK_STOCK_RECEIPT':
      return ackByIdField(dbs.txnId, 'KITCHEN_INDENT', 'IND_ID', req.issueId, {STATUS:'RECEIVED'});

    case 'BAR_STORE_RECEIVE':
      return bumpBarReceived(dbs.txnId, req);

    case 'SAVE_STOCK_ADJUSTMENT':
      appendRowByHeader(dbs.txnId, 'STOCK_ADJUSTMENTS',
        ['ADJ_ID','CLIENT_ID','DATE','ITEM_ID','ITEM_NAME','UNIT','DELTA','REASON','SOURCE','REFERENCE','ENTERED_BY','ENTRY_TIME'],
        {ADJ_ID:req.id||Utilities.getUuid(), CLIENT_ID:req.clientId, DATE:req.date||new Date(), ITEM_ID:req.itemCode||'',
         ITEM_NAME:req.itemName||'', UNIT:req.unit||'', DELTA:req.delta||0, REASON:req.reason||'', SOURCE:req.source||'manual',
         REFERENCE:req.ref||'', ENTERED_BY:req.enteredBy||'', ENTRY_TIME:new Date()}
      );
      return {success:true};

    // FIX v4.1: reads real item catalogue - tries ITEM_MASTER first.
    case 'GET_ITEMS': {
      const items = readItemMaster(dbs.masterId);
      return { success:true, data: { items: items } };
    }

    // FIX: added for kitchen-consumption.html's History/Analysis tabs.
    case 'GET_CONSUMPTION_HISTORY': {
      const rows = readTable(dbs.txnId, 'KITCHEN_CONSUMPTION');
      const items = readItemMaster(dbs.masterId);
      const lookup = {};
      items.forEach(function(i){
        const key = String(i.NAME||i.ITEM_NAME||'').trim().toUpperCase();
        lookup[key] = { category: i.CATEGORY||'Uncategorized', costPrice: Number(i.COST_PRICE)||0 };
      });
      const history = rows.map(function(r){
        const key = String(r.ITEM_NAME||'').trim().toUpperCase();
        const l = lookup[key] || {};
        const issued = Number(r.ISSUED)||0;
        return {
          date: r.DATE||'', item: r.ITEM_NAME||'', unit: r.UNIT||'', qty: issued,
          category: l.category||'Uncategorized',
          estValue: Math.round(issued*(l.costPrice||0)*100)/100,
          enteredBy: r.ENTERED_BY||'', wastage: Number(r.WASTAGE)||0,
        };
      });
      return { success:true, history: history };
    }

    // FIX: real generic table sync (v3 explicitly said not implemented).
    case 'SYNC_PUSH_TABLE': {
      const table = req.table;
      const rows = req.rows || [];
      if (!table) return { success:false, message:'table required' };
      const sheetName = 'SYNC_' + String(table).toUpperCase();
      const ss = SpreadsheetApp.openById(dbs.txnId);
      let sh = ss.getSheetByName(sheetName);
      if (!sh) sh = ss.insertSheet(sheetName);
      sh.clear();
      if (!rows.length) return { success:true, pushed:0 };
      const headerSet = {};
      rows.forEach(function(r){ Object.keys(r||{}).forEach(function(k){ headerSet[k]=true; }); });
      const headers = Object.keys(headerSet);
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      const dataRows = rows.map(function(r){
        return headers.map(function(h){
          const v = (r||{})[h];
          if (v===undefined || v===null) return '';
          if (typeof v==='object') return JSON.stringify(v);
          return v;
        });
      });
      sh.getRange(2,1,dataRows.length,headers.length).setValues(dataRows);
      return { success:true, pushed: dataRows.length };
    }
    case 'SYNC_PULL_ALL': {
      const ss = SpreadsheetApp.openById(dbs.txnId);
      const tables = {};
      ss.getSheets().forEach(function(sh){
        const name = sh.getName();
        if (name.indexOf('SYNC_') !== 0) return;
        const tableKey = name.substring(5).toLowerCase();
        const data = sh.getDataRange().getValues();
        if (data.length < 1 || !data[0].length) { tables[tableKey] = []; return; }
        const headers = data[0];
        tables[tableKey] = data.slice(1).map(function(row){
          const obj = {};
          headers.forEach(function(h,i){
            let v = row[i];
            if (typeof v==='string' && (v.charAt(0)==='{' || v.charAt(0)==='[')){
              try { v = JSON.parse(v); } catch(e){}
            }
            obj[h] = v;
          });
          return obj;
        });
      });
      return { success:true, tables: tables };
    }

    case 'SAVE_SALES_DOC':
    case 'UPDATE_SALES_DOC':
      return { success:false, message:"POS_BILLING/SALES_MASTER field mapping not yet confirmed against real sales-module.html output - tell me the exact fields it sends and this becomes a real write." };

    default:
      return {success:false, message:'Unknown action: '+req.action};
  }
}

var PURCHASE_HEADERS = ['PUR_ID','CLIENT_ID','DATE','MONTH','VENDOR_ID','VENDOR_NAME','INVOICE_NO','INVOICE_DATE','ITEM_ID','ITEM_NAME','UNIT','QTY','RATE','AMOUNT','GST_RATE','GST_AMOUNT','TOTAL_AMOUNT','PAYMENT_MODE','PAYMENT_STATUS','ENTERED_BY','ENTRY_TIME','STATUS'];

function savePurchaseRow(txnId, req){
  const d = req.date ? new Date(req.date) : new Date();
  (req.items ? req.items : [req]).forEach(function(it){
    appendRowByHeader(txnId, 'PURCHASE_MASTER', PURCHASE_HEADERS, {
      PUR_ID: req.no || req.gno || Utilities.getUuid(),
      CLIENT_ID: req.clientId,
      DATE: d, MONTH: (d.getMonth()+1)+'-'+d.getFullYear(),
      VENDOR_ID: req.vendorId||'', VENDOR_NAME: req.vendorName||req.party||'',
      INVOICE_NO: req.purchaseNo||req.ref||'', INVOICE_DATE: d,
      ITEM_ID: it.code||it.itemCode||'', ITEM_NAME: it.name||req.item||req.itemName||'',
      UNIT: it.unit||req.unit||'', QTY: it.qty||req.accepted||req.qty||0, RATE: it.rate||req.rate||0,
      AMOUNT: it.amt||((it.qty||req.accepted||req.qty||0)*(it.rate||req.rate||0)),
      GST_RATE: it.gst||0, GST_AMOUNT: (it.amt||0)*((it.gst||0)/100), TOTAL_AMOUNT: req.grand||it.amt||0,
      PAYMENT_MODE: req.paymentMode||'', PAYMENT_STATUS: req.paymentStatus||'PENDING',
      ENTERED_BY: req.enteredBy||'', ENTRY_TIME: new Date(), STATUS: 'ACTIVE'
    });
  });
  return {success:true};
}

function updatePurchaseRow(txnId, req){
  const sh = sheet(txnId, 'PURCHASE_MASTER');
  if(!sh) return {success:false, message:'PURCHASE_MASTER tab not found'};
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idIdx = hdr.indexOf('PUR_ID'), itemIdx = hdr.indexOf('ITEM_NAME');
  for(let i=1;i<data.length;i++){
    if(String(data[i][idIdx])===String(req.no||req.gno) && String(data[i][itemIdx])===String(req.item||req.itemName)){
      const qtyIdx=hdr.indexOf('QTY'), rateIdx=hdr.indexOf('RATE'), amtIdx=hdr.indexOf('AMOUNT');
      sh.getRange(i+1, qtyIdx+1).setValue(req.accepted||req.qty||0);
      if(req.rate!==undefined) sh.getRange(i+1, rateIdx+1).setValue(req.rate);
      sh.getRange(i+1, amtIdx+1).setValue((req.rate||data[i][rateIdx]||0)*(req.accepted||req.qty||0));
      return {success:true};
    }
  }
  return {success:false, message:'Purchase line not found to update - PUR_ID='+(req.no||req.gno)};
}

function deletePurchaseRow(txnId, req){
  const sh = sheet(txnId, 'PURCHASE_MASTER');
  if(!sh) return {success:false, message:'PURCHASE_MASTER tab not found'};
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idIdx = hdr.indexOf('PUR_ID'), statusIdx = hdr.indexOf('STATUS');
  for(let i=data.length-1;i>=1;i--){
    if(String(data[i][idIdx])===String(req.no||req.gno)){
      sh.getRange(i+1, statusIdx+1).setValue('DELETED');
    }
  }
  return {success:true};
}

function bumpBarReceived(txnId, req){
  const sh = sheet(txnId, 'BAR_CONSUMPTION');
  if(!sh) return {success:false, message:'BAR_CONSUMPTION tab not found'};
  const dateStr = (req.date ? new Date(req.date) : new Date()).toDateString();
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const dateIdx=hdr.indexOf('DATE'), brandIdx=hdr.indexOf('BRAND'), recvIdx=hdr.indexOf('RECEIVED');
  for(let i=1;i<data.length;i++){
    if(new Date(data[i][dateIdx]).toDateString()===dateStr && String(data[i][brandIdx])===String(req.barName)){
      sh.getRange(i+1, recvIdx+1).setValue((+data[i][recvIdx]||0) + (+req.qtyML||0));
      return {success:true};
    }
  }
  appendRowByHeader(txnId, 'BAR_CONSUMPTION',
    ['DATE','CLIENT_ID','BRAND','CATEGORY','SIZE_ML','OPENING','RECEIVED','SOLD','CLOSING','COMP','WASTAGE','VARIANCE','ENTERED_BY'],
    {DATE:req.date||new Date(), CLIENT_ID:req.clientId, BRAND:req.barName||'', CATEGORY:'', SIZE_ML:req.bottleML||0,
     OPENING:0, RECEIVED:req.qtyML||0, SOLD:0, CLOSING:req.qtyML||0, COMP:0, WASTAGE:0, VARIANCE:0, ENTERED_BY:''}
  );
  return {success:true};
}

function pullCoreTables(dbs){
  return {
    success:true,
    tables:{
      items: readItemMaster(dbs.masterId),
      vendors: readTable(dbs.masterId, '50_VENDOR_MASTER'),
      purchases: readTable(dbs.txnId, 'PURCHASE_MASTER'),
      kitchen_indents: readTable(dbs.txnId, 'KITCHEN_INDENT'),
      bar_consumption: readTable(dbs.txnId, 'BAR_CONSUMPTION')
    }
  };
}
function readTable(sheetId, tab){
  const sh = sheet(sheetId, tab);
  if(!sh || sh.getLastRow()<2) return [];
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  return data.slice(1).map(function(row){ const o={}; hdr.forEach(function(h,i){o[h]=row[i];}); return o; });
}

function buildIndentRemarks(req){
  const parts = [];
  if(req.dept) parts.push('Dept:'+req.dept);
  if(req.department) parts.push('Dept:'+req.department);
  if(req.shift) parts.push('Shift:'+req.shift);
  parts.push('Priority:'+(req.priority||'Normal'));
  return parts.join(' | ');
}

function sheet(id, tab){ return SpreadsheetApp.openById(id).getSheetByName(tab); }

// FIX v4.2: Kitchen Indent needs RAW INGREDIENTS (onions, dry store
// items, etc — has real OPENING_STOCK/CURRENT_STOCK/REORDER_LEVEL),
// not sold menu dishes. RAW_MATERIAL_MASTER is the correct sheet —
// ITEM_MASTER holds finished dishes for sale, a completely different
// dataset. Also normalizes RAW_MATERIAL_MASTER's real column names
// (ITEM_CODE/UOM/CURRENT_STOCK/REORDER_LEVEL) to what kitchen-indent.html
// expects (ITEM_ID/UNIT/STOCK/MIN_STOCK) so the frontend doesn't need
// touching. Falls back to ITEM_MASTER then 34_ITEM_MASTER only if
// RAW_MATERIAL_MASTER is empty (e.g. a client that hasn't migrated yet).
function readItemMaster(masterId){
  const normalize = function(rows){
    return rows.map(function(r){
      return {
        ITEM_ID: r.ITEM_CODE || r.ITEM_ID || '',
        NAME: r.ITEM_NAME || r.NAME || '',
        CATEGORY: r.CATEGORY || '',
        UNIT: r.UOM || r.UNIT || '',
        STOCK: r.CURRENT_STOCK !== undefined ? r.CURRENT_STOCK : (r.STOCK || 0),
        MIN_STOCK: r.REORDER_LEVEL !== undefined ? r.REORDER_LEVEL : (r.MIN_STOCK || 0),
        STATUS: r.STATUS || 'ACTIVE',
        RATE: Number(r.COST_PRICE) || 0,
      };
    });
  };
  const raw = readTable(masterId, 'RAW_MATERIAL_MASTER');
  if (raw.length) return normalize(raw);
  const itemMaster = readTable(masterId, 'ITEM_MASTER');
  if (itemMaster.length) return normalize(itemMaster);
  return normalize(readTable(masterId, '34_ITEM_MASTER'));
}
function findRow(id, tab, matchCol, matchVal){
  const sh = sheet(id, tab);
  if(!sh || sh.getLastRow()<2) return null;
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const colIdx = hdr.indexOf(matchCol);
  if(colIdx===-1) return null;
  for(let i=1;i<data.length;i++){
    if(String(data[i][colIdx]).trim() === String(matchVal).trim()){
      const obj = {}; hdr.forEach(function(h,j){ obj[h]=data[i][j]; });
      obj._rowIndex = i+1;
      return obj;
    }
  }
  return null;
}
function getRowsWhere(sheetId, tab, filterFn){
  const sh = sheet(sheetId, tab);
  if(!sh || sh.getLastRow()<2) return [];
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  return data.slice(1).map(function(row){ const o={}; hdr.forEach(function(h,i){o[h]=row[i];}); return o; }).filter(filterFn);
}
function ackByIdField(sheetId, tab, idCol, idVal, updates){
  const sh = sheet(sheetId, tab);
  if(!sh) return {success:false, message:tab+' not found'};
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const idIdx = hdr.indexOf(idCol);
  for(let i=1;i<data.length;i++){
    if(String(data[i][idIdx])===String(idVal)){
      Object.keys(updates).forEach(function(k){
        const ci = hdr.indexOf(k);
        if(ci>-1) sh.getRange(i+1, ci+1).setValue(updates[k]);
      });
      return {success:true};
    }
  }
  return {success:false, message:'Row not found: '+idCol+'='+idVal};
}
function appendRowByHeader(id, tab, headers, rowObj){
  const sh = sheet(id, tab);
  if(!sh) throw new Error('Tab not found: '+tab+' in sheet '+id);
  const existingHeader = sh.getLastRow()>0 ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0] : [];
  const useHeaders = existingHeader.length ? existingHeader : headers;
  if(sh.getLastRow()===0) sh.appendRow(headers);
  sh.appendRow(useHeaders.map(function(h){ return rowObj[h] !== undefined ? rowObj[h] : ''; }));
  return true;
}

function provisionClientSheets(){
  const clientId = 'CL00012';
  const companyName = 'New Client Name';
  const masterTemplateId = '1dmOMi1JebDC6PrbuUR0RGeKWMWU04f1sdvdibJzzgfc';
  const txnTemplateId = 'PASTE_TRANSACTION_TEMPLATE_ID';
  const reportTemplateId = 'PASTE_REPORT_TEMPLATE_ID';
  const clientsFolderId = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';

  if(txnTemplateId.indexOf('PASTE_') === 0) throw new Error('Confirm and set txnTemplateId/reportTemplateId first.');

  const folder = DriveApp.getFolderById(clientsFolderId);
  const masterCopy = DriveApp.getFileById(masterTemplateId).makeCopy(clientId+'_MASTER_DB', folder);
  const txnCopy = DriveApp.getFileById(txnTemplateId).makeCopy(clientId+'_TRANSACTION_DB', folder);
  const reportCopy = DriveApp.getFileById(reportTemplateId).makeCopy(clientId+'_REPORT_DB', folder);

  appendRowByHeader(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY',
    ['CLIENT_ID','COMPANY_NAME','MASTER_DB_ID','MASTER_DB_URL','TRANSACTION_DB_ID','TRANSACTION_DB_URL','REPORT_DB_ID','REPORT_DB_URL','FOLDER_ID','CREATED_ON','STATUS'],
    {CLIENT_ID:clientId, COMPANY_NAME:companyName,
     MASTER_DB_ID:masterCopy.getId(), MASTER_DB_URL:'https://docs.google.com/spreadsheets/d/'+masterCopy.getId()+'/edit',
     TRANSACTION_DB_ID:txnCopy.getId(), TRANSACTION_DB_URL:'https://docs.google.com/spreadsheets/d/'+txnCopy.getId()+'/edit',
     REPORT_DB_ID:reportCopy.getId(), REPORT_DB_URL:'https://docs.google.com/spreadsheets/d/'+reportCopy.getId()+'/edit',
     FOLDER_ID:folder.getId(), CREATED_ON:new Date(), STATUS:'ACTIVE'});

  Logger.log('Provisioned all 3 databases for ' + clientId);
  return {masterId:masterCopy.getId(), txnId:txnCopy.getId(), reportId:reportCopy.getId()};
}

function runDiag(){
  const out = { ok:true, steps:[] };
  function step(name, fn){
    try{ const r = fn(); out.steps.push({step:name, ok:true, detail:r}); }
    catch(e){ out.ok=false; out.steps.push({step:name, ok:false, error:e.toString()}); }
  }
  step('open BALAJI_ERP_MASTER_CONTROL_SYSTEM', function(){ return 'Opened: ' + SpreadsheetApp.openById(MASTER_CONTROL_SHEET_ID).getName(); });
  step('resolve CL00010 all 3 databases', function(){
    const row = findRow(MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', 'CL00010');
    if(!row) return 'CL00010 not found in registry.';
    return 'MASTER='+row.MASTER_DB_ID+' | TXN='+row.TRANSACTION_DB_ID+' | REPORT='+row.REPORT_DB_ID;
  });
  return out;
}
