/*
================================================================
BALAJI NEXTGEN ERP
F005 - STORAGE ENGINE
Local/session storage management for all ERP data.
================================================================
*/

const StorageEngine = {

    /* ============================================================
       ERP KEY REGISTRY — all keys used across the system
    ============================================================ */

    KEYS: {
        USER:          "ERP_USER",
        TOKEN:         "ERP_TOKEN",
        SESSION:       "ERP_SESSION",
        ROLE:          "ERP_ROLE",
        CLIENT:        "ERP_CLIENT",
        BRANCH:        "ERP_BRANCH",
        INDUSTRY:      "ERP_INDUSTRY",
        API_URL:       "ERP_API_URL",
        FRONTEND_API:  "ERP_FRONTEND_API",
        CORE_API:      "ERP_CORE_API",
        MODE:          "ERP_MODE",
        THEME:         "ERP_THEME",
        LANG:          "ERP_LANG",
        REMEMBERED_ID: "ERP_REMEMBERED_ID",
        MASTER_SHEET:  "ERP_MASTER_SHEET",
        CACHE_BREAKER: "CACHE_BREAKER",
        CART:          "ERP_POS_CART",
        LAST_PAGE:     "ERP_LAST_PAGE"
    },

    /* ============================================================
       LOCAL STORAGE
    ============================================================ */

    set(key, value) {
        try {
            const v = typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
            localStorage.setItem(key, v);
            return true;
        } catch (e) {
            console.error("[STORAGE] Set error:", e);
            return false;
        }
    },

    get(key, parse = false) {
        try {
            const val = localStorage.getItem(key);
            if (val === null) return null;
            if (parse) return JSON.parse(val);
            return val;
        } catch (e) {
            return null;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    },

    /* ============================================================
       SESSION STORAGE (tab-only, clears on close)
    ============================================================ */

    session: {
        set(key, value) {
            try {
                sessionStorage.setItem(key,
                    typeof value === "object" ? JSON.stringify(value) : value);
            } catch (e) {}
        },
        get(key, parse = false) {
            try {
                const v = sessionStorage.getItem(key);
                return (v && parse) ? JSON.parse(v) : v;
            } catch (e) { return null; }
        },
        remove(key) { sessionStorage.removeItem(key); },
        clear()     { sessionStorage.clear(); }
    },

    /* ============================================================
       ERP-SPECIFIC HELPERS
    ============================================================ */

    getUser()     { return this.get(this.KEYS.USER,     true); },
    getToken()    { return this.get(this.KEYS.TOKEN); },
    getRole()     { return this.get(this.KEYS.ROLE)     || ""; },
    getClient()   { return this.get(this.KEYS.CLIENT)   || ""; },
    getBranch()   { return this.get(this.KEYS.BRANCH)   || "HEAD_OFFICE"; },
    getIndustry() { return this.get(this.KEYS.INDUSTRY) || "ALL"; },
    getTheme()    { return this.get(this.KEYS.THEME)    || "LIGHT"; },

    isLoggedIn()  { return !!this.get(this.KEYS.USER); },

    setTheme(theme) {
        this.set(this.KEYS.THEME, theme);
        document.body.setAttribute("data-theme", theme.toLowerCase());
    },

    /* ============================================================
       CLEAR SESSION ONLY (keep preferences)
    ============================================================ */

    clearSession() {
        [this.KEYS.USER, this.KEYS.TOKEN, this.KEYS.SESSION,
         this.KEYS.ROLE, this.KEYS.CLIENT, this.KEYS.BRANCH,
         this.KEYS.INDUSTRY].forEach(k => this.remove(k));
    },

    /* ============================================================
       POS CART HELPERS
    ============================================================ */

    getCart()       { return this.get(this.KEYS.CART, true) || []; },
    saveCart(cart)  { this.set(this.KEYS.CART, cart); },
    clearCart()     { this.remove(this.KEYS.CART); }

};

/* ================================================================
   GLOBAL SHORTHAND
================================================================ */

function getERPUser()   { return StorageEngine.getUser(); }
function getERPToken()  { return StorageEngine.getToken(); }
function getERPRole()   { return StorageEngine.getRole(); }
function getERPBranch() { return StorageEngine.getBranch(); }

console.log("[STORAGE ENGINE] Loaded");
