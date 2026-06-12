/* =====================================================
   BALAJI NEXTGEN ERP
   INVENTORY UI ENGINE
   Enterprise UI Controller v1.0
===================================================== */

const InventoryUI = (() => {

  let currentPage = "dashboard";

  const MODULES = [
    {id:"dashboard",name:"Dashboard",icon:"📊"},
    {id:"items",name:"Item Master",icon:"📦"},
    {id:"categories",name:"Category",icon:"🏷️"},
    {id:"warehouse",name:"Warehouse",icon:"🏭"},
    {id:"purchase",name:"Purchase",icon:"🛒"},
    {id:"stock",name:"Stock Ledger",icon:"📑"},
    {id:"analytics",name:"Analytics",icon:"📈"},
    {id:"reports",name:"Reports",icon:"📄"},
    {id:"settings",name:"Settings",icon:"⚙️"}
  ];

  /* ==========================================
     SIDEBAR
  ========================================== */

  function buildSidebar() {

    const sidebar =
      document.getElementById(
        "sidebar-menu"
      );

    if(!sidebar) return;

    sidebar.innerHTML = "";

    MODULES.forEach(m => {

      if(
        typeof InventorySecurity !==
        "undefined"
      ){

        if(
          !InventorySecurity
          .hasAccess(m.id)
        ){
          return;
        }

      }

      sidebar.innerHTML += `
      <div class="menu-item"
           onclick="InventoryUI.open('${m.id}')">

          <span>${m.icon}</span>
          <span>${m.name}</span>

      </div>`;
    });

  }

  /* ==========================================
     PAGE OPEN
  ========================================== */

  function open(page){

    currentPage = page;

    document
      .querySelectorAll(
        ".page-panel"
      )
      .forEach(el=>{
        el.style.display =
          "none";
      });

    const target =
      document.getElementById(
        "page-" + page
      );

    if(target){

      target.style.display =
        "block";

    }

    refreshHeader(page);

  }

  /* ==========================================
     HEADER
  ========================================== */

  function refreshHeader(page){

    const title =
      document.getElementById(
        "page-title"
      );

    if(title){

      title.textContent =
        page.toUpperCase();

    }

  }

  /* ==========================================
     KPI CARDS
  ========================================== */

  function refreshKPI(){

    if(
      typeof InventoryAnalytics
      === "undefined"
    ){
      return;
    }

    const kpi =
      InventoryAnalytics.getKPI();

    setValue(
      "kpi-items",
      kpi.totalItems
    );

    setValue(
      "kpi-stock-value",
      "₹" +
      kpi.stockValue
      .toLocaleString()
    );

    setValue(
      "kpi-low-stock",
      kpi.lowStock
    );

    setValue(
      "kpi-suppliers",
      kpi.suppliers
    );

  }

  /* ==========================================
     AI PANEL
  ========================================== */

  function refreshAI(){

    if(
      typeof InventoryAI
      === "undefined"
    ){
      return;
    }

    const ai =
      InventoryAI.getAISummary();

    setValue(
      "ai-health-score",
      ai.healthScore
    );

    setValue(
      "ai-reorder-items",
      ai.reorderItems
    );

  }

  /* ==========================================
     THEME ENGINE
  ========================================== */

  function setTheme(theme){

    document.body
      .setAttribute(
        "data-theme",
        theme
      );

    localStorage.setItem(
      "BNERP_THEME",
      theme
    );

  }

  function loadTheme(){

    const theme =
      localStorage.getItem(
        "BNERP_THEME"
      ) || "default";

    setTheme(theme);

  }

  /* ==========================================
     NOTIFICATION
  ========================================== */

  function notify(
    message,
    type="success"
  ){

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "erp-toast " + type;

    div.innerHTML =
      message;

    document.body
      .appendChild(div);

    setTimeout(()=>{

      div.remove();

    },3000);

  }

  /* ==========================================
     MODAL ENGINE
  ========================================== */

  function openModal(id){

    const modal =
      document.getElementById(id);

    if(modal){

      modal.style.display =
        "flex";

    }

  }

  function closeModal(id){

    const modal =
      document.getElementById(id);

    if(modal){

      modal.style.display =
        "none";

    }

  }

  /* ==========================================
     BRANCH SWITCHER
  ========================================== */

  function loadBranches(){

    const branch =
      document.getElementById(
        "branch-selector"
      );

    if(!branch) return;

    [
      "HEAD OFFICE",
      "SILIGURI",
      "KOLKATA",
      "GUWAHATI"
    ]
    .forEach(b=>{

      branch.innerHTML +=
      `<option>${b}</option>`;

    });

  }

  /* ==========================================
     UTIL
  ========================================== */

  function setValue(id,val){

    const el =
      document.getElementById(id);

    if(el){

      el.textContent = val;

    }

  }

  /* ==========================================
     INIT
  ========================================== */

  function init(){

    buildSidebar();

    loadTheme();

    loadBranches();

    refreshKPI();

    refreshAI();

    open("dashboard");

  }

  return {

    init,

    open,

    openModal,
    closeModal,

    notify,

    setTheme,
    loadTheme,

    refreshKPI,
    refreshAI

  };

})();

document.addEventListener(
  "DOMContentLoaded",
  ()=>{
    InventoryUI.init();
  }
);