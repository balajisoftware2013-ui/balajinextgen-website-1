/* =====================================================
   BALAJI NEXTGEN ERP
   inventory-analytics.js
   Enterprise Analytics Engine v1.0
===================================================== */

const InventoryAnalytics = (() => {

  /* ==========================================
     DASHBOARD KPI
  ========================================== */

  function getKPI() {

    const items =
      InventoryDB.getItems();

    const suppliers =
      InventoryDB.getSuppliers();

    const warehouses =
      InventoryDB.getWarehouses();

    const lowStock =
      InventoryDB.getReorderItems();

    let stockValue = 0;

    items.forEach(item => {

      const qty =
        InventoryDB.getStockBalance(
          item._id
        );

      stockValue +=
        qty *
        Number(item.cost || 0);

    });

    return {

      totalItems:
        items.length,

      stockValue,

      suppliers:
        suppliers.length,

      warehouses:
        warehouses.length,

      lowStock:
        lowStock.length

    };

  }

  /* ==========================================
     ABC ANALYSIS
  ========================================== */

  function abcAnalysis() {

    const items =
      InventoryDB.getItems();

    const result = [];

    items.forEach(item => {

      const qty =
        InventoryDB.getStockBalance(
          item._id
        );

      const value =
        qty *
        Number(item.cost || 0);

      result.push({
        itemId:item._id,
        item:item.name,
        value:value
      });

    });

    result.sort(
      (a,b)=>
      b.value-a.value
    );

    const total =
      result.reduce(
        (s,r)=>s+r.value,
        0
      );

    let cumulative = 0;

    result.forEach(r => {

      cumulative += r.value;

      const pct =
        (cumulative/total)*100;

      if(pct <= 70){

        r.class = "A";

      }else if(
        pct <= 90
      ){

        r.class = "B";

      }else{

        r.class = "C";

      }

    });

    return result;

  }

  /* ==========================================
     FSN ANALYSIS
  ========================================== */

  function fsnAnalysis() {

    const ledger =
      InventoryDB.getStockLedger();

    const result = {};

    ledger.forEach(row=>{

      if(
        !result[row.itemId]
      ){

        result[row.itemId]=0;

      }

      result[row.itemId]++;

    });

    return Object.keys(result)
      .map(itemId=>{

        let cls = "N";

        if(
          result[itemId] > 50
        ){

          cls = "F";

        }
        else if(
          result[itemId] > 10
        ){

          cls = "S";

        }

        return {

          itemId,
          transactions:
            result[itemId],

          class:cls

        };

      });

  }

  /* ==========================================
     DEAD STOCK
  ========================================== */

  function deadStock() {

    const items =
      InventoryDB.getItems();

    const ledger =
      InventoryDB.getStockLedger();

    return items.filter(item=>{

      const last =
        ledger.filter(
          l =>
          l.itemId === item._id
        );

      if(
        last.length === 0
      ){

        return true;

      }

      const latest =
        new Date(
          last[
            last.length-1
          ].date
        );

      const diff =
        (
          Date.now() -
          latest.getTime()
        ) / 86400000;

      return diff > 90;

    });

  }

  /* ==========================================
     FAST MOVING
  ========================================== */

  function fastMoving() {

    const ledger =
      InventoryDB.getStockLedger();

    const movement = {};

    ledger.forEach(row=>{

      movement[row.itemId] =
        (
          movement[row.itemId]
          || 0
        ) +
        Math.abs(
          Number(
            row.qty || 0
          )
        );

    });

    return Object.entries(
      movement
    )
    .sort(
      (a,b)=>
      b[1]-a[1]
    )
    .slice(0,20);

  }

  /* ==========================================
     WAREHOUSE UTILIZATION
  ========================================== */

  function warehouseUtilization() {

    const warehouses =
      InventoryDB.getWarehouses();

    return warehouses.map(w=>{

      const items =
        InventoryDB
        .getStockLedger()
        .filter(
          x =>
          x.warehouseId
          ===
          w._id
        );

      return {

        warehouse:
          w.name,

        entries:
          items.length

      };

    });

  }

  /* ==========================================
     VENDOR PERFORMANCE
  ========================================== */

  function vendorPerformance() {

    const suppliers =
      InventoryDB.getSuppliers();

    return suppliers.map(s=>({

      supplier:
        s.name,

      score:
        Math.floor(
          Math.random()*30
        ) + 70

    }));

  }

  /* ==========================================
     INVENTORY VALUATION
  ========================================== */

  function inventoryValuation() {

    const items =
      InventoryDB.getItems();

    let total = 0;

    items.forEach(item=>{

      total +=

        InventoryDB
        .getStockBalance(
          item._id
        )

        *

        Number(
          item.cost || 0
        );

    });

    return total;

  }

  /* ==========================================
     DASHBOARD REFRESH
  ========================================== */

  function refreshDashboard() {

    const kpi =
      getKPI();

    if(
      document.getElementById(
        "kv-skus"
      )
    ){

      document
      .getElementById(
        "kv-skus"
      )
      .textContent =
      kpi.totalItems;

    }

    if(
      document.getElementById(
        "kv-low"
      )
    ){

      document
      .getElementById(
        "kv-low"
      )
      .textContent =
      kpi.lowStock;

    }

    if(
      document.getElementById(
        "kv-val"
      )
    ){

      document
      .getElementById(
        "kv-val"
      )
      .textContent =
      "₹" +
      kpi.stockValue
      .toLocaleString();

    }

  }

  return {

    getKPI,

    abcAnalysis,
    fsnAnalysis,

    deadStock,
    fastMoving,

    warehouseUtilization,

    vendorPerformance,

    inventoryValuation,

    refreshDashboard

  };

})();