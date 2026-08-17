/*
================================================================
BALAJI NEXTGEN ERP
F004 - ROUTER ENGINE
Frontend route/page navigation.
Role-based redirect, page guard, breadcrumbs.
================================================================
*/

/* ================================================================
   ROLE → DASHBOARD MAP (from ROLE_PERMISSION_MASTER)
================================================================ */

const ROUTE_MAP = {
    SUPER_ADMIN:   "Dashboard/super-admin-dashboard.html",
    DEVELOPER:     "Dashboard/developer-dashboard.html",
    OWNER:         "Dashboard/owner-dashboard.html",
    MANAGER:       "Dashboard/manager-dashboard.html",
    ACCOUNTANT:    "Dashboard/finance-dashboard.html",
    CASHIER:       "Dashboard/cashier-dashboard.html",
    CHEF:          "Dashboard/chef-dashboard.html",
    WAITER:        "Dashboard/waiter-dashboard.html",
    STORE_MANAGER: "Dashboard/store-dashboard.html",
    ADMIN:         "Dashboard/owner-dashboard.html"
};

/* ================================================================
   MODULE ROUTES
================================================================ */

const MODULE_ROUTES = {
    POS:          "modules/sales/pos-billing.html",
    SALES:        "modules/sales/sales-dashboard.html",
    INVENTORY:    "modules/inventory/inventory-dashboard.html",
    PURCHASE:     "modules/purchase/purchase-dashboard.html",
    FINANCE:      "modules/finance/finance-dashboard.html",
    KITCHEN:      "modules/kitchen/kitchen-display.html",
    REPORTS:      "modules/reports/reports-dashboard.html",
    SETTINGS:     "modules/settings/settings.html"
};

/* ================================================================
   ROUTER ENGINE
================================================================ */

const RouterEngine = {

    /* ============================================================
       ROUTE BY ROLE — called after login
    ============================================================ */

    routeByRole() {

        const user = this._getUser();

        if (!user) {
            this.goLogin();
            return;
        }

        const role = String(
            user.ROLE || user.role || ""
        ).toUpperCase();

        const target = ROUTE_MAP[role];

        if (target) {
            window.location.href = target;
        } else {
            alert("Invalid Role: " + role + ". Contact Administrator.");
        }

    },

    /* ============================================================
       NAVIGATE TO MODULE
    ============================================================ */

    goModule(module) {
        const path = MODULE_ROUTES[module.toUpperCase()];
        if (path) {
            window.location.href = path;
        } else {
            console.warn("[ROUTER] Unknown module:", module);
        }
    },

    /* ============================================================
       GO TO LOGIN
    ============================================================ */

    goLogin() {
        const depth = window.location.pathname.split("/").length - 2;
        const prefix = depth > 1 ? "../".repeat(depth - 1) : "";
        window.location.href = prefix + "login.html";
    },

    /* ============================================================
       GO TO HOME (website)
    ============================================================ */

    goHome() {
        window.location.href = "https://balajinextgeneration.netlify.app/";
    },

    /* ============================================================
       PROTECT PAGE — redirect if role not allowed
    ============================================================ */

    protectPage(allowedRoles = []) {

        const user = this._getUser();

        if (!user) {
            this.goLogin();
            return false;
        }

        if (allowedRoles.length === 0) return true;

        const role = String(user.ROLE || user.role || "").toUpperCase();
        const allowed = allowedRoles.map(r => r.toUpperCase());

        if (!allowed.includes(role)) {
            alert("Access Denied. Your role: " + role);
            this.routeByRole();
            return false;
        }

        return true;

    },

    /* ============================================================
       GET BREADCRUMB from current URL path
    ============================================================ */

    getBreadcrumb() {

        const parts = window.location.pathname
            .split("/")
            .filter(Boolean)
            .map(p => p.replace(/[-_]/g, " ").replace(".html", ""));

        return parts;

    },

    /* ============================================================
       INTERNAL — get user
    ============================================================ */

    _getUser() {
        try {
            return JSON.parse(localStorage.getItem("ERP_USER"));
        } catch {
            return null;
        }
    }

};

/* ================================================================
   GLOBAL SHORTHAND (backward compat with role-router.js)
================================================================ */

function routeUserByRole()                     { RouterEngine.routeByRole(); }
function protectPage(roles)                    { RouterEngine.protectPage(roles); }
function hasRoleAccess(roles)                  {
    const u = RouterEngine._getUser();
    if (!u) return false;
    const r = String(u.ROLE || u.role || "").toUpperCase();
    return roles.map(x => x.toUpperCase()).includes(r);
}

/* ================================================================
   AUTO SESSION CHECK
================================================================ */

document.addEventListener("DOMContentLoaded", function () {

    const path = window.location.pathname.toLowerCase();

    if (path.includes("login.html") || path.includes("index.html") ||
        path === "/" || path.includes("contact") || path.includes("demo")) {
        return;
    }

    const user = localStorage.getItem("ERP_USER");
    if (!user) {
        RouterEngine.goLogin();
    }

});
