/**
 * inventory-kitchen-bar-bridge.js
 * -------------------------------------------------------------
 * Drop-in replacement for localStorage-only stub functions in
 * inventory.html / kitchen-consumption.html / bar_module.html.
 *
 * SCOPE: this targets the NEW model-wise architecture (BN-prefixed
 * clients only — INVENTORY_MASTER_DB / PURCHASE_MASTER_DB / OPS
 * resolved via the Client Registry Sheet in
 * client-provisioning-and-migration.gs). Existing CL-prefixed
 * clients stay on erp-config.js's old master/transaction/report
 * registry and are untouched by this file.
 *
 * Uses the same generic SAVE_MASTER / GET_MASTER / BULK_IMPORT_MASTER
 * actions as master-hub.html / payments-module.html / sales-module.html
 * / attendance-register.html, handled by 09_MasterHubAPI.gs — not a
 * separate set of custom action names, so there's one backend pattern
 * across every new-architecture module instead of a different one
 * per file.
 *
 * ROUTING (2026-08-08)
 *   Raw material items      -> CORE_INVENTORY / INVENTORY_ITEM_MASTER
 *   Bar stock                -> same sheet, filtered by CATEGORY —
 *                                bar stock IS raw-material inventory
 *                                (liquor/mixers/garnish), not a
 *                                separate concept, so no separate
 *                                sheet was added for it.
 *   GRN (goods receipt)      -> CORE_PURCHASE / GOODS_RECEIPT_NOTE
 *   Kitchen consumption      -> OPS / R4_KITCHEN_INDENT
 *   Bar issue                -> OPS / R4_KITCHEN_INDENT, same sheet,
 *                                DEPARTMENT='BAR DEPARTMENT' — this
 *                                sheet already has a DEPARTMENT
 *                                column, so kitchen and bar issues
 *                                are the same concept (a department
 *                                drawing stock from the store) rather
 *                                than needing two near-identical sheets.
 * -------------------------------------------------------------
 */

const GAS_WEB_APP_URL = (window.ERP && window.ERP.APIS && window.ERP.APIS.V2_CORE)
  || 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

async function callBackend(action, params) {
  const payload = Object.assign({ action }, params);
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) {
    console.error('Backend error for action', action, json.message || json.error);
    throw new Error(json.message || json.error || ('Unknown error calling ' + action));
  }
  return json.data;
}

// Prefers ERP.getUser() (erp-config.js) if loaded on the page, since
// that's the one already-fixed source of truth for the session
// (checks ERP_USER first, falls back to erpUser) — falls back to a
// direct localStorage read only if erp-config.js isn't present.
function getCurrentClientId() {
  if (window.ERP && typeof window.ERP.getUser === 'function') {
    const u = window.ERP.getUser();
    if (u) return u.CLIENT_ID || u.clientId;
  }
  const user = JSON.parse(localStorage.getItem('ERP_USER') || localStorage.getItem('erpUser') || '{}');
  return user.CLIENT_ID || user.clientId;
}

function getCurrentUserName() {
  if (window.ERP && typeof window.ERP.getUser === 'function') {
    const u = window.ERP.getUser();
    if (u) return u.full_name || u.user_code || 'User';
  }
  return 'User';
}

const INV_ROUTE = { dbFile: 'CORE_INVENTORY', sheet: 'INVENTORY_ITEM_MASTER' };
const GRN_ROUTE = { dbFile: 'CORE_PURCHASE', sheet: 'GOODS_RECEIPT_NOTE' };
const INDENT_ROUTE = { dbFile: 'OPS', sheet: 'R4_KITCHEN_INDENT' };

// ================= INVENTORY =================

async function loadInventoryItems() {
  const clientId = getCurrentClientId();
  const result = await callBackend('GET_MASTER', Object.assign({ clientId, category: 'inventory-item' }, INV_ROUTE));
  const items = result.records;
  renderInventoryTable(items); // <-- replace with your actual render function name
  return items;
}

async function submitGRN(formData) {
  const clientId = getCurrentClientId();
  const record = {
    GRN_DATE: formData.date,
    VENDOR_NAME: formData.supplierName,
    ITEM_NAME: formData.itemName,
    RECEIVED_QTY: parseFloat(formData.qty),
    ACCEPTED_QTY: parseFloat(formData.qty),
    STATUS: 'Received',
    // formData.invNo/department/unit/rate have no matching column on
    // GOODS_RECEIPT_NOTE (it tracks qty accepted/rejected against a PO,
    // not invoice/rate detail — that lives on PURCHASE_INVOICE instead).
    // Kept out rather than silently dropped into the wrong column.
  };
  const result = await callBackend('SAVE_MASTER', Object.assign({ clientId, category: 'grn', record: JSON.stringify(record) }, GRN_ROUTE));
  showToast('GRN recorded successfully'); // <-- replace with your actual toast function
  await loadInventoryItems(); // refresh view
  return result;
}

// ================= KITCHEN CONSUMPTION =================

async function submitKitchenConsumption(formData) {
  const clientId = getCurrentClientId();
  const record = {
    DATE: formData.date,
    DEPARTMENT: 'KITCHEN',
    ITEM_NAME: formData.itemName,
    ISSUED_QTY: parseFloat(formData.qty),
    UNIT: formData.unit,
    ISSUED_BY: getCurrentUserName(),
  };
  const result = await callBackend('SAVE_MASTER', Object.assign({ clientId, category: 'kitchen-indent', record: JSON.stringify(record) }, INDENT_ROUTE));
  showToast('Consumption recorded'); // <-- replace with your actual toast function
  return result;
}

async function loadKitchenConsumptionHistory(fromDate, toDate) {
  const clientId = getCurrentClientId();
  const result = await callBackend('GET_MASTER', Object.assign({ clientId, category: 'kitchen-indent' }, INDENT_ROUTE));
  // R4_KITCHEN_INDENT has no built-in date-range filter server-side —
  // filtering client-side on DATE here rather than adding a bespoke
  // GET action just for this one range query.
  const rows = (result.records || []).filter(r => {
    if (!fromDate && !toDate) return true;
    const d = r.DATE;
    return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
  });
  renderConsumptionTable(rows); // <-- replace with your actual render function name
  return rows;
}

// ================= BAR =================

async function loadBarStock() {
  const clientId = getCurrentClientId();
  const result = await callBackend('GET_MASTER', Object.assign({ clientId, category: 'inventory-item' }, INV_ROUTE));
  // Bar stock = raw-material inventory filtered to bar-relevant
  // categories. Adjust this list to match how CATEGORY is actually
  // populated for liquor/mixer/garnish items in your data.
  const barCategories = ['Liquor', 'Beer', 'Wine', 'Mixer', 'Garnish', 'Bar Consumable'];
  const items = (result.records || []).filter(r => barCategories.includes(r.CATEGORY));
  renderBarStockTable(items); // <-- replace with your actual render function name
  return items;
}

async function submitBarIssue(formData) {
  const clientId = getCurrentClientId();
  const record = {
    DATE: formData.date,
    DEPARTMENT: formData.toDepartment || 'BAR DEPARTMENT',
    ITEM_NAME: formData.itemName,
    ISSUED_QTY: parseFloat(formData.qty),
    UNIT: formData.unit,
    ISSUED_BY: getCurrentUserName(),
  };
  const result = await callBackend('SAVE_MASTER', Object.assign({ clientId, category: 'kitchen-indent', record: JSON.stringify(record) }, INDENT_ROUTE));
  showToast('Bar issue recorded'); // <-- replace with your actual toast function
  await loadBarStock();
  return result;
}
