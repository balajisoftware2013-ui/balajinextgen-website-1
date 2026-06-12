/* ==========================================================
   BALAJI NEXTGEN ERP
   inventory-db.js
   Version: 1.0 Enterprise
   ========================================================== */

const InventoryDB = (() => {

  const DB_PREFIX = "BNERP_INV_";

  const TABLES = {
    ITEMS: "ITEM_MASTER",
    CATEGORIES: "CATEGORY_MASTER",
    BRANDS: "BRAND_MASTER",
    UOMS: "UOM_MASTER",
    WAREHOUSES: "WAREHOUSE_MASTER",
    SUPPLIERS: "SUPPLIER_MASTER",

    PURCHASES: "PURCHASE_REGISTER",
    GRNS: "GRN_REGISTER",

    STOCK_LEDGER: "STOCK_LEDGER",
    STOCK_TRANSFER: "STOCK_TRANSFER",
    STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",

    REORDER_ENGINE: "REORDER_ENGINE",
    AUDIT_LOG: "AUDIT_LOG"
  };

  /* =====================================================
     CORE
  ===================================================== */

  function getTable(tableName) {
    return JSON.parse(
      localStorage.getItem(DB_PREFIX + tableName) || "[]"
    );
  }

  function saveTable(tableName, data) {
    localStorage.setItem(
      DB_PREFIX + tableName,
      JSON.stringify(data)
    );
  }

  function generateId(prefix = "ID") {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 10000)
    );
  }

  /* =====================================================
     CRUD
  ===================================================== */

  function insert(tableName, row) {
    const data = getTable(tableName);

    row._id = row._id || generateId(tableName);
    row.createdAt = new Date().toISOString();

    data.push(row);

    saveTable(tableName, data);

    return row;
  }

  function update(tableName, id, updates) {
    const data = getTable(tableName);

    const index = data.findIndex(x => x._id === id);

    if (index === -1) return false;

    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveTable(tableName, data);

    return true;
  }

  function remove(tableName, id) {
    let data = getTable(tableName);

    data = data.filter(x => x._id !== id);

    saveTable(tableName, data);
  }

  function find(tableName, id) {
    return getTable(tableName).find(x => x._id === id);
  }

  function all(tableName) {
    return getTable(tableName);
  }

  /* =====================================================
     ITEM MASTER
  ===================================================== */

  function addItem(item) {
    return insert(TABLES.ITEMS, item);
  }

  function getItems() {
    return all(TABLES.ITEMS);
  }

  /* =====================================================
     CATEGORY MASTER
  ===================================================== */

  function addCategory(category) {
    return insert(TABLES.CATEGORIES, category);
  }

  function getCategories() {
    return all(TABLES.CATEGORIES);
  }

  /* =====================================================
     BRAND MASTER
  ===================================================== */

  function addBrand(brand) {
    return insert(TABLES.BRANDS, brand);
  }

  function getBrands() {
    return all(TABLES.BRANDS);
  }

  /* =====================================================
     UOM MASTER
  ===================================================== */

  function addUOM(uom) {
    return insert(TABLES.UOMS, uom);
  }

  function getUOMs() {
    return all(TABLES.UOMS);
  }

  /* =====================================================
     WAREHOUSE MASTER
  ===================================================== */

  function addWarehouse(warehouse) {
    return insert(TABLES.WAREHOUSES, warehouse);
  }

  function getWarehouses() {
    return all(TABLES.WAREHOUSES);
  }

  /* =====================================================
     SUPPLIER MASTER
  ===================================================== */

  function addSupplier(supplier) {
    return insert(TABLES.SUPPLIERS, supplier);
  }

  function getSuppliers() {
    return all(TABLES.SUPPLIERS);
  }

  /* =====================================================
     STOCK LEDGER
  ===================================================== */

  function addStockLedger(entry) {

    entry._id = generateId("LEDGER");

    entry.date =
      entry.date || new Date().toISOString();

    insert(TABLES.STOCK_LEDGER, entry);

    return entry;
  }

  function getStockLedger() {
    return all(TABLES.STOCK_LEDGER);
  }

  /* =====================================================
     STOCK BALANCE
  ===================================================== */

  function getStockBalance(itemId, warehouseId = null) {

    const ledger = getStockLedger();

    let qty = 0;

    ledger.forEach(row => {

      if (row.itemId !== itemId) return;

      if (
        warehouseId &&
        row.warehouseId !== warehouseId
      ) {
        return;
      }

      qty += Number(row.qty || 0);

    });

    return qty;
  }

  /* =====================================================
     PURCHASE ENTRY
  ===================================================== */

  function addPurchase(purchase) {

    purchase.purchaseNo =
      purchase.purchaseNo ||
      "PUR-" + Date.now();

    insert(TABLES.PURCHASES, purchase);

    if (purchase.items) {

      purchase.items.forEach(item => {

        addStockLedger({
          type: "PURCHASE",
          itemId: item.itemId,
          warehouseId: item.warehouseId,
          qty: Number(item.qty),
          rate: Number(item.rate),
          amount:
            Number(item.qty) *
            Number(item.rate)
        });

      });

    }

    return purchase;
  }

  /* =====================================================
     STOCK TRANSFER
  ===================================================== */

  function stockTransfer(data) {

    insert(TABLES.STOCK_TRANSFER, data);

    addStockLedger({
      type: "TRANSFER_OUT",
      itemId: data.itemId,
      warehouseId: data.fromWarehouse,
      qty: -Math.abs(data.qty)
    });

    addStockLedger({
      type: "TRANSFER_IN",
      itemId: data.itemId,
      warehouseId: data.toWarehouse,
      qty: Math.abs(data.qty)
    });
  }

  /* =====================================================
     STOCK ADJUSTMENT
  ===================================================== */

  function stockAdjustment(data) {

    insert(TABLES.STOCK_ADJUSTMENT, data);

    addStockLedger({
      type: "ADJUSTMENT",
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      qty: Number(data.qty)
    });
  }

  /* =====================================================
     REORDER ENGINE
  ===================================================== */

  function getReorderItems() {

    const items = getItems();

    return items.filter(item => {

      const stock =
        getStockBalance(item._id);

      return (
        stock <=
        Number(item.reorderLevel || 0)
      );

    });

  }

  /* =====================================================
     DASHBOARD
  ===================================================== */

  function getDashboardSummary() {

    const items = getItems();

    let stockValue = 0;

    items.forEach(item => {

      const qty =
        getStockBalance(item._id);

      stockValue +=
        qty *
        Number(item.cost || 0);

    });

    return {
      totalItems: items.length,
      stockValue: stockValue,
      lowStock: getReorderItems().length,
      warehouses:
        getWarehouses().length,
      suppliers:
        getSuppliers().length
    };
  }

  /* =====================================================
     DEMO DATA
  ===================================================== */

  function seedDemoData() {

    if (getItems().length > 0) return;

    addCategory({
      name: "Raw Material"
    });

    addCategory({
      name: "Finished Goods"
    });

    addWarehouse({
      name: "Main Store"
    });

    addWarehouse({
      name: "Kitchen Store"
    });

    addItem({
      name: "Rice",
      cost: 50,
      reorderLevel: 100
    });

    addItem({
      name: "Cooking Oil",
      cost: 140,
      reorderLevel: 20
    });

    console.log(
      "Balaji Inventory Demo Loaded"
    );
  }

  return {

    TABLES,

    insert,
    update,
    remove,
    find,
    all,

    addItem,
    getItems,

    addCategory,
    getCategories,

    addBrand,
    getBrands,

    addUOM,
    getUOMs,

    addWarehouse,
    getWarehouses,

    addSupplier,
    getSuppliers,

    addPurchase,

    stockTransfer,
    stockAdjustment,

    addStockLedger,
    getStockLedger,

    getStockBalance,

    getReorderItems,

    getDashboardSummary,

    seedDemoData

  };

})();

document.addEventListener(
  "DOMContentLoaded",
  () => {
    InventoryDB.seedDemoData();
  }
);