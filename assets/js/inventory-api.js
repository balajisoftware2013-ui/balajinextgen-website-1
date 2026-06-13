/* =====================================================
   BALAJI NEXTGEN ERP
   inventory-api.js
   Version: 1.0 Enterprise
===================================================== */

const InventoryAPI = (() => {

  const CONFIG = {
    WEBAPP_URL:
      localStorage.getItem("BNERP_WEBAPP_URL") ||
      ""
  };

  /* ==========================================
     CORE REQUEST
  ========================================== */

  async function request(action, payload = {}) {

    if (!CONFIG.WEBAPP_URL) {
      throw new Error(
        "Apps Script URL not configured"
      );
    }

    const response = await fetch(
      CONFIG.WEBAPP_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          action,
          payload
        })
      }
    );

    return await response.json();

  }

  /* ==========================================
     ITEM MASTER
  ========================================== */

  async function getItems() {
    return request("GET_ITEMS");
  }

  async function saveItem(item) {
    return request("SAVE_ITEM", item);
  }

  async function deleteItem(id) {
    return request("DELETE_ITEM", { id });
  }

  /* ==========================================
     CATEGORY
  ========================================== */

  async function getCategories() {
    return request("GET_CATEGORIES");
  }

  async function saveCategory(data) {
    return request(
      "SAVE_CATEGORY",
      data
    );
  }

  /* ==========================================
     WAREHOUSE
  ========================================== */

  async function getWarehouses() {
    return request(
      "GET_WAREHOUSES"
    );
  }

  async function saveWarehouse(data) {
    return request(
      "SAVE_WAREHOUSE",
      data
    );
  }

  /* ==========================================
     SUPPLIERS
  ========================================== */

  async function getSuppliers() {
    return request(
      "GET_SUPPLIERS"
    );
  }

  async function saveSupplier(data) {
    return request(
      "SAVE_SUPPLIER",
      data
    );
  }

  /* ==========================================
     PURCHASE
  ========================================== */

  async function savePurchase(data) {
    return request(
      "SAVE_PURCHASE",
      data
    );
  }

  async function getPurchases() {
    return request(
      "GET_PURCHASES"
    );
  }

  /* ==========================================
     STOCK LEDGER
  ========================================== */

  async function getLedger(filters={}) {
    return request(
      "GET_LEDGER",
      filters
    );
  }

  /* ==========================================
     DASHBOARD
  ========================================== */

  async function getDashboard() {
    return request(
      "GET_DASHBOARD"
    );
  }

  /* ==========================================
     STOCK TRANSFER
  ========================================== */

  async function saveTransfer(data) {
    return request(
      "SAVE_TRANSFER",
      data
    );
  }

  /* ==========================================
     PHYSICAL STOCK
  ========================================== */

  async function savePhysicalStock(data) {
    return request(
      "SAVE_PHYSICAL_STOCK",
      data
    );
  }

  /* ==========================================
     REORDER ENGINE
  ========================================== */

  async function getReorderItems() {
    return request(
      "GET_REORDER_ITEMS"
    );
  }

  /* ==========================================
     REPORTS
  ========================================== */

  async function getStockReport(data) {
    return request(
      "GET_STOCK_REPORT",
      data
    );
  }

  async function getPurchaseRegister(data) {
    return request(
      "GET_PURCHASE_REGISTER",
      data
    );
  }

  async function getSupplierLedger(data) {
    return request(
      "GET_SUPPLIER_LEDGER",
      data
    );
  }

  /* ==========================================
     SETTINGS
  ========================================== */

  function setWebAppUrl(url) {

    localStorage.setItem(
      "BNERP_WEBAPP_URL",
      url
    );

    CONFIG.WEBAPP_URL = url;

  }

  function getWebAppUrl() {
    return CONFIG.WEBAPP_URL;
  }

  return {

    getItems,
    saveItem,
    deleteItem,

    getCategories,
    saveCategory,

    getWarehouses,
    saveWarehouse,

    getSuppliers,
    saveSupplier,

    savePurchase,
    getPurchases,

    getLedger,

    getDashboard,

    saveTransfer,
    savePhysicalStock,

    getReorderItems,

    getStockReport,
    getPurchaseRegister,
    getSupplierLedger,

    setWebAppUrl,
    getWebAppUrl

  };

})();