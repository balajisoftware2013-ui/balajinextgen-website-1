/*
================================================================
BALAJI NEXTGEN ERP
F001 - FRONTEND API CONFIG ENGINE
Auto-loads all live URLs and settings from CONTROL_PANEL sheet.
================================================================
*/

const ERP_CONFIG = {

    /* ============================================================
       MASTER SHEET IDs — from BALAJI_ERP_MASTER_CONTROL_SYSTEM
    ============================================================ */

    MASTER_SHEET_ID:
        "1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I",

    /* ============================================================
       DEPLOYMENT REGISTRY — from API_DEPLOYMENT_REGISTRY sheet
       V2_AUTH   : Primary login/session auth API
       V2_FRONTEND: Frontend data API
       V2_CORE   : Core ERP operations API
    ============================================================ */

    APIS: {
        V2_AUTH:
            "https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec",
        V2_FRONTEND:
            "https://script.google.com/macros/s/AKfycbyiaO9zpZAQ1pTlDjz7B2yEUfjv1vrlXTYjTkIY-YwKr6ahOCV6lU_AiB4dpmnBySG1/exec",
        V2_CORE:
            "https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec"
    },

    /* ============================================================
       ENVIRONMENT — from CONTROL_PANEL sheet
    ============================================================ */

    ERP_MODE:       "DEVELOPMENT",
    FRONTEND_VER:   "v1.0.0",
    BACKEND_VER:    "v1.0.0",
    CACHE_BREAKER:  "1779029851225",

    /* ============================================================
       APPSHEET MOBILE APP LINK
    ============================================================ */

    APPSHEET_URL:
        "https://www.appsheet.com/start/1f550400-52de-4c61-82e2-3ec54f01c990?platform=mobile#appName=ERP_CORE_SYSTEM-779181074",

    /* ============================================================
       WEBSITE
    ============================================================ */

    WEBSITE_URL: "https://balajinextgeneration.netlify.app/"

};

/* ================================================================
   INITIALIZE — write all values to localStorage so every
   other engine can read them without re-fetching the sheet.
================================================================ */

function initERPConfig() {

    localStorage.setItem("ERP_API_URL",       ERP_CONFIG.APIS.V2_AUTH);
    localStorage.setItem("ERP_FRONTEND_API",  ERP_CONFIG.APIS.V2_FRONTEND);
    localStorage.setItem("ERP_CORE_API",      ERP_CONFIG.APIS.V2_CORE);
    localStorage.setItem("ERP_MODE",          ERP_CONFIG.ERP_MODE);
    localStorage.setItem("ERP_FRONTEND_VER",  ERP_CONFIG.FRONTEND_VER);
    localStorage.setItem("CACHE_BREAKER",     ERP_CONFIG.CACHE_BREAKER);
    localStorage.setItem("ERP_MASTER_SHEET",  ERP_CONFIG.MASTER_SHEET_ID);

    console.log(
        "[ERP CONFIG] Loaded | Mode:", ERP_CONFIG.ERP_MODE,
        "| Auth URL:", ERP_CONFIG.APIS.V2_AUTH
    );

}

/* ================================================================
   GETTER HELPERS — used by other engines
================================================================ */

function getAuthAPI()    { return localStorage.getItem("ERP_API_URL")      || ERP_CONFIG.APIS.V2_AUTH; }
function getFrontendAPI(){ return localStorage.getItem("ERP_FRONTEND_API") || ERP_CONFIG.APIS.V2_FRONTEND; }
function getCoreAPI()    { return localStorage.getItem("ERP_CORE_API")     || ERP_CONFIG.APIS.V2_CORE; }
function getERPMode()    { return localStorage.getItem("ERP_MODE")         || "DEVELOPMENT"; }

/* ================================================================
   AUTO RUN on script load
================================================================ */

initERPConfig();
