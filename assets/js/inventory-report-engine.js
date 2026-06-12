/* =====================================================
   BALAJI NEXTGEN ERP
   inventory-report-engine.js
   Enterprise Reporting Engine v1.0
===================================================== */

const InventoryReportEngine = (() => {

  /* ==========================================
     FORMATTERS
  ========================================== */

  function money(value){
    return "₹" + Number(value || 0)
      .toLocaleString("en-IN",{
        minimumFractionDigits:2,
        maximumFractionDigits:2
      });
  }

  function date(v){
    if(!v) return "";
    return new Date(v)
      .toLocaleDateString("en-IN");
  }

  /* ==========================================
     PRINT WINDOW
  ========================================== */

  function printHTML(title,html){

    const w = window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

    w.document.write(`
      <html>
      <head>
        <title>${title}</title>
        <style>
          body{
            font-family:Arial;
            padding:20px;
          }
          table{
            width:100%;
            border-collapse:collapse;
          }
          th,td{
            border:1px solid #ddd;
            padding:8px;
          }
          th{
            background:#1845B5;
            color:#fff;
          }
          .r{
            text-align:right;
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `);

    w.document.close();

    setTimeout(()=>{
      w.print();
    },500);
  }

  /* ==========================================
     STOCK LEDGER
  ========================================== */

  function stockLedger(){

    const rows =
      InventoryDB.getStockLedger();

    let totalQty = 0;

    let html = `
      <h2>Stock Ledger</h2>
      <table>
      <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Item</th>
        <th>Warehouse</th>
        <th class="r">Qty</th>
      </tr>
      </thead>
      <tbody>
    `;

    rows.forEach(r=>{

      totalQty +=
        Number(r.qty || 0);

      html += `
      <tr>
        <td>${date(r.date)}</td>
        <td>${r.type||""}</td>
        <td>${r.itemId||""}</td>
        <td>${r.warehouseId||""}</td>
        <td class="r">${r.qty||0}</td>
      </tr>`;
    });

    html += `
      <tr>
        <td colspan="4">
          <b>Total</b>
        </td>
        <td class="r">
          <b>${totalQty}</b>
        </td>
      </tr>
      </tbody>
      </table>
    `;

    printHTML(
      "Stock Ledger",
      html
    );
  }

  /* ==========================================
     PURCHASE REGISTER
  ========================================== */

  function purchaseRegister(){

    const data =
      InventoryDB.all(
        InventoryDB.TABLES.PURCHASES
      );

    let total = 0;

    let html = `
      <h2>Purchase Register</h2>
      <table>
      <thead>
      <tr>
        <th>Purchase No</th>
        <th>Supplier</th>
        <th>Date</th>
        <th class="r">Amount</th>
      </tr>
      </thead>
      <tbody>
    `;

    data.forEach(row=>{

      total +=
        Number(row.amount||0);

      html += `
      <tr>
        <td>${row.purchaseNo||""}</td>
        <td>${row.supplier||""}</td>
        <td>${date(row.createdAt)}</td>
        <td class="r">
          ${money(row.amount)}
        </td>
      </tr>`;
    });

    html += `
      <tr>
        <td colspan="3">
          <b>Total</b>
        </td>
        <td class="r">
          <b>${money(total)}</b>
        </td>
      </tr>
      </tbody>
      </table>
    `;

    printHTML(
      "Purchase Register",
      html
    );
  }

  /* ==========================================
     REORDER REPORT
  ========================================== */

  function reorderReport(){

    const items =
      InventoryDB.getReorderItems();

    let html = `
      <h2>Reorder Report</h2>
      <table>
      <thead>
      <tr>
        <th>Item</th>
        <th class="r">Stock</th>
        <th class="r">Reorder Level</th>
      </tr>
      </thead>
      <tbody>
    `;

    items.forEach(item=>{

      html += `
      <tr>
        <td>${item.name}</td>
        <td class="r">
          ${InventoryDB.getStockBalance(item._id)}
        </td>
        <td class="r">
          ${item.reorderLevel||0}
        </td>
      </tr>`;
    });

    html += `
      </tbody>
      </table>
    `;

    printHTML(
      "Reorder Report",
      html
    );
  }

  /* ==========================================
     EXCEL EXPORT
  ========================================== */

  function exportCSV(
    filename,
    rows
  ){

    if(!rows.length){
      alert("No Data");
      return;
    }

    const headers =
      Object.keys(rows[0]);

    const csv = [

      headers.join(","),

      ...rows.map(row =>
        headers.map(h =>
          `"${row[h]||""}"`
        ).join(",")
      )

    ].join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
          "text/csv;charset=utf-8;"
        }
      );

    const link =
      document.createElement("a");

    link.href =
      URL.createObjectURL(blob);

    link.download =
      filename + ".csv";

    link.click();
  }

  /* ==========================================
     DASHBOARD EXPORT
  ========================================== */

  function exportDashboard(){

    const data = [
      InventoryDB.getDashboardSummary()
    ];

    exportCSV(
      "Dashboard_Summary",
      data
    );
  }

  /* ==========================================
     PO FORMAT
  ========================================== */

  function printPO(po){

    const html = `
      <h2>Purchase Order</h2>
      <hr>
      <p><b>PO No:</b>
      ${po.poNo}</p>

      <p><b>Supplier:</b>
      ${po.supplier}</p>

      <p><b>Date:</b>
      ${date(po.date)}</p>

      <h3>
      Amount :
      ${money(po.amount)}
      </h3>
    `;

    printHTML(
      "Purchase Order",
      html
    );
  }

  /* ==========================================
     GRN FORMAT
  ========================================== */

  function printGRN(grn){

    const html = `
      <h2>
      Goods Receipt Note
      </h2>

      <p>
      GRN No :
      ${grn.grnNo}
      </p>

      <p>
      Supplier :
      ${grn.supplier}
      </p>

      <p>
      Value :
      ${money(grn.amount)}
      </p>
    `;

    printHTML(
      "GRN",
      html
    );
  }

  return {

    stockLedger,
    purchaseRegister,

    reorderReport,

    exportCSV,
    exportDashboard,

    printPO,
    printGRN

  };

})();