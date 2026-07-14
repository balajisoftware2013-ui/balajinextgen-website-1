/**
 * inventory-kitchen-bar-bridge.js
 * -------------------------------------------------------------
 * Drop-in replacement for localStorage-only stub functions in
 * inventory.html / kitchen-consumption.html / bar_module.html.
 *
 * ASSUMES: a global GAS_WEB_APP_URL constant already exists somewhere
 * in your app (same pattern your other modules use to call the backend).
 * If your actual constant has a different name, just rename the
 * reference below.
 *
 * Usage pattern (matches your existing modules):
 *   const items = await callBackend('getRawMaterials', { clientId: getCurrentClientId() });
 * -------------------------------------------------------------
 */

async function callBackend(action, params) {
  const payload = Object.assign({ action }, params);
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) {
    console.error('Backend error for action', action, json.error);
    throw new Error(json.error || ('Unknown error calling ' + action));
  }
  return json.data;
}

// Assumes a helper like this already exists in your session/auth layer -
// pulls the logged-in client's ID (e.g. 'CL00010') from ERP_USER storage.
function getCurrentClientId() {
  const user = JSON.parse(localStorage.getItem('ERP_USER') || '{}');
  return user.clientId || user.CLIENT_ID;
}

// ================= INVENTORY =================

async function loadInventoryItems() {
  const clientId = getCurrentClientId();
  const items = await callBackend('getRawMaterials', { clientId });
  renderInventoryTable(items); // <-- replace with your actual render function name
  return items;
}

async function submitGRN(formData) {
  const clientId = getCurrentClientId();
  const grnEntry = {
    date: formData.date,
    invNo: formData.invoiceNo,
    supplierName: formData.supplierName,
    department: formData.department,
    itemName: formData.itemName,
    qty: parseFloat(formData.qty),
    unit: formData.unit,
    rate: parseFloat(formData.rate),
  };
  const result = await callBackend('recordGRN', { clientId, grnEntry });
  showToast('GRN recorded successfully'); // <-- replace with your actual toast function
  await loadInventoryItems(); // refresh view
  return result;
}

// ================= KITCHEN CONSUMPTION =================

async function submitKitchenConsumption(formData) {
  const clientId = getCurrentClientId();
  const entry = {
    date: formData.date,
    itemName: formData.itemName,
    qty: parseFloat(formData.qty),
    unit: formData.unit,
  };
  const result = await callBackend('recordKitchenConsumption', { clientId, entry });
  showToast('Consumption recorded'); // <-- replace with your actual toast function
  return result;
}

async function loadKitchenConsumptionHistory(fromDate, toDate) {
  const clientId = getCurrentClientId();
  const rows = await callBackend('getKitchenConsumptionHistory', { clientId, fromDate, toDate });
  renderConsumptionTable(rows); // <-- replace with your actual render function name
  return rows;
}

// ================= BAR =================

async function loadBarStock() {
  const clientId = getCurrentClientId();
  const items = await callBackend('getBarStockItems', { clientId });
  renderBarStockTable(items); // <-- replace with your actual render function name
  return items;
}

async function submitBarIssue(formData) {
  const clientId = getCurrentClientId();
  const entry = {
    date: formData.date,
    itemName: formData.itemName,
    qty: parseFloat(formData.qty),
    unit: formData.unit,
    toDepartment: formData.toDepartment || 'BAR DEPARTMENT',
    issuedBy: getCurrentUserName(), // <-- replace with your actual current-user helper
  };
  const result = await callBackend('recordBarIssue', { clientId, entry });
  showToast('Bar issue recorded'); // <-- replace with your actual toast function
  await loadBarStock();
  return result;
}
