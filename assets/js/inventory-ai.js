/* =====================================================
   BALAJI NEXTGEN ERP
   inventory-ai.js
   Enterprise AI Engine v1.0
===================================================== */

const InventoryAI = (() => {

  /* ==========================================
     REORDER AI
  ========================================== */

  function getReorderSuggestions() {

    const items =
      InventoryDB.getItems();

    const suggestions = [];

    items.forEach(item => {

      const stock =
        InventoryDB.getStockBalance(
          item._id
        );

      const reorder =
        Number(
          item.reorderLevel || 0
        );

      if(stock <= reorder){

        suggestions.push({

          itemId:item._id,
          item:item.name,

          currentStock:stock,

          reorderLevel:reorder,

          suggestedQty:
            Math.max(
              reorder * 2,
              10
            )

        });

      }

    });

    return suggestions;

  }

  /* ==========================================
     CONSUMPTION FORECAST
  ========================================== */

  function forecastConsumption(
    itemId,
    days = 30
  ){

    const ledger =
      InventoryDB.getStockLedger();

    const issueRows =
      ledger.filter(x =>

        x.itemId === itemId &&
        Number(x.qty) < 0

      );

    if(
      issueRows.length === 0
    ){

      return 0;

    }

    const total =
      issueRows.reduce(
        (s,r)=>
        s + Math.abs(
          Number(r.qty)
        ),
        0
      );

    return (
      total /
      issueRows.length
    ) * days;

  }

  /* ==========================================
     STOCK OUT PREDICTION
  ========================================== */

  function stockOutPrediction(){

    const items =
      InventoryDB.getItems();

    return items.map(item=>{

      const stock =
        InventoryDB.getStockBalance(
          item._id
        );

      const avg =
        forecastConsumption(
          item._id,
          30
        ) / 30;

      let daysLeft = 999;

      if(avg > 0){

        daysLeft =
          Math.floor(
            stock / avg
          );

      }

      return {

        item:item.name,

        stock,

        daysLeft

      };

    });

  }

  /* ==========================================
     DEAD STOCK AI
  ========================================== */

  function detectDeadStock(){

    return InventoryAnalytics
      .deadStock()
      .map(item => ({

        item:item.name,

        recommendation:
          "Discount / Transfer"

      }));

  }

  /* ==========================================
     FAST MOVING AI
  ========================================== */

  function fastMovingItems(){

    return InventoryAnalytics
      .fastMoving();

  }

  /* ==========================================
     VENDOR RECOMMENDATION
  ========================================== */

  function bestVendor(){

    const vendors =
      InventoryAnalytics
      .vendorPerformance();

    return vendors.sort(
      (a,b)=>
      b.score - a.score
    )[0];

  }

  /* ==========================================
     AUTO PURCHASE ORDER
  ========================================== */

  function createAutoPO(){

    const reorderItems =
      getReorderSuggestions();

    return {

      poNo:
        "AUTOPO-" +
        Date.now(),

      date:
        new Date(),

      items:
        reorderItems

    };

  }

  /* ==========================================
     SEASONAL DEMAND
  ========================================== */

  function seasonalForecast(){

    const month =
      new Date().getMonth()+1;

    let factor = 1;

    if(
      [10,11,12].includes(
        month
      )
    ){

      factor = 1.4;

    }

    return factor;

  }

  /* ==========================================
     ABC PURCHASE PRIORITY
  ========================================== */

  function purchasePriority(){

    const abc =
      InventoryAnalytics
      .abcAnalysis();

    return abc
      .filter(
        x =>
        x.class === "A"
      )
      .slice(0,20);

  }

  /* ==========================================
     INVENTORY HEALTH SCORE
  ========================================== */

  function healthScore(){

    const low =
      InventoryDB
      .getReorderItems()
      .length;

    const dead =
      detectDeadStock()
      .length;

    let score = 100;

    score -= low * 2;

    score -= dead * 3;

    return Math.max(
      0,
      score
    );

  }

  /* ==========================================
     DASHBOARD AI SUMMARY
  ========================================== */

  function getAISummary(){

    return {

      healthScore:
        healthScore(),

      reorderItems:
        getReorderSuggestions()
        .length,

      deadStock:
        detectDeadStock()
        .length,

      bestVendor:
        bestVendor(),

      seasonalFactor:
        seasonalForecast()

    };

  }

  return {

    getReorderSuggestions,

    forecastConsumption,

    stockOutPrediction,

    detectDeadStock,

    fastMovingItems,

    bestVendor,

    createAutoPO,

    seasonalForecast,

    purchasePriority,

    healthScore,

    getAISummary

  };

})();