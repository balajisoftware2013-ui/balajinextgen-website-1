/*
================================================================
BALAJI NEXTGEN ERP
F003 - AUTH ENGINE
Login, logout, OTP, session control.
Reads users from USER_SECURITY_MASTER_DB → USER_MASTER sheet.
Roles: SUPER_ADMIN, DEVELOPER, OWNER, MANAGER, CASHIER, CHEF
================================================================
*/

/* ================================================================
   ROLE → DASHBOARD MAP
   Matches ROLE_DASHBOARD_MAP in role-router.js
================================================================ */

const AUTH_ROLE_MAP = {
    SUPER_ADMIN: "Dashboard/super-admin-dashboard.html",
    DEVELOPER:   "Dashboard/developer-dashboard.html",
    OWNER:       "Dashboard/owner-dashboard.html",
    MANAGER:     "Dashboard/manager-dashboard.html",
    ACCOUNTANT:  "Dashboard/finance-dashboard.html",
    CASHIER:     "Dashboard/cashier-dashboard.html",
    CHEF:        "Dashboard/chef-dashboard.html",
    WAITER:      "Dashboard/waiter-dashboard.html",
    STORE_MANAGER: "Dashboard/store-dashboard.html"
};

/* ================================================================
   VALIDATION HELPERS
================================================================ */

function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isValidMobile(val) {
    return /^[6-9]\d{9}$/.test(val);
}

function validateLoginId(val) {
    if (!val) return "Enter Email or Mobile";
    if (!isValidEmail(val) && !isValidMobile(val))
        return "Enter a valid Email or 10-digit Mobile";
    return null;
}

function validatePassword(val) {
    if (!val) return "Enter Password";
    if (val.length < 4) return "Password must be at least 4 characters";
    return null;
}

/* ================================================================
   AUTH ENGINE OBJECT
================================================================ */

const AuthEngine = {

    /* ============================================================
       LOGIN with password
    ============================================================ */

    async login(loginId, password) {

        try {

            const result = await apiRequest("LOGIN", {
                loginId,
                password
            });

            if (result && result.success) {
                this._saveSession(result);
            }

            return result;

        } catch (error) {
            console.error("[AUTH] Login error:", error);
            return { success: false, message: "Login Failed. Check connection." };
        }

    },

    /* ============================================================
       SEND OTP
    ============================================================ */

    async sendOTP(loginId) {

        try {
            return await apiRequest("SEND_OTP", { loginId });
        } catch (error) {
            console.error("[AUTH] OTP send error:", error);
            return { success: false, message: "OTP Request Failed" };
        }

    },

    /* ============================================================
       VERIFY OTP LOGIN
    ============================================================ */

    async verifyOTP(loginId, otp) {

        try {

            const result = await apiRequest("OTP_LOGIN", { loginId, otp });

            if (result && result.success) {
                this._saveSession(result);
            }

            return result;

        } catch (error) {
            console.error("[AUTH] OTP verify error:", error);
            return { success: false, message: "OTP Verification Failed" };
        }

    },

    /* ============================================================
       VERIFY SESSION (called on protected pages)
    ============================================================ */

    async verifySession() {

        try {

            const token = localStorage.getItem("ERP_TOKEN");

            if (!token) return { success: false };

            return await apiRequest("VERIFY_SESSION", { token });

        } catch (error) {
            return { success: false };
        }

    },

    /* ============================================================
       LOGOUT
    ============================================================ */

    async logout() {

        try {
            await apiRequest("LOGOUT", {
                token: localStorage.getItem("ERP_TOKEN")
            });
        } catch (error) {
            console.error("[AUTH] Logout error:", error);
        }

        this._clearSession();
        window.location.href = this._getLoginPath();

    },

    /* ============================================================
       SAVE SESSION to localStorage
    ============================================================ */

    _saveSession(data) {

        if (data.user) {
            localStorage.setItem("ERP_USER",    JSON.stringify(data.user));
            localStorage.setItem("ERP_ROLE",    (data.user.ROLE || data.user.role || "").toUpperCase());
            localStorage.setItem("ERP_CLIENT",  data.user.CLIENT_ID || "");
            localStorage.setItem("ERP_BRANCH",  data.user.BRANCH || "HEAD_OFFICE");
            localStorage.setItem("ERP_INDUSTRY",data.user.INDUSTRY || "ALL");
        }

        if (data.token) {
            localStorage.setItem("ERP_TOKEN", data.token);
        }

        if (data.sessionId) {
            localStorage.setItem("ERP_SESSION", data.sessionId);
        }

    },

    /* ============================================================
       CLEAR SESSION
    ============================================================ */

    _clearSession() {
        ["ERP_USER","ERP_TOKEN","ERP_ROLE","ERP_CLIENT",
         "ERP_BRANCH","ERP_INDUSTRY","ERP_SESSION"].forEach(k => {
            localStorage.removeItem(k);
        });
    },

    /* ============================================================
       LOGIN PATH — works from any depth
    ============================================================ */

    _getLoginPath() {
        const depth = window.location.pathname.split("/").length - 2;
        const prefix = depth > 1 ? "../".repeat(depth - 1) : "";
        return prefix + "login.html";
    },

    /* ============================================================
       GET CURRENT USER
    ============================================================ */

    getUser() {
        try {
            return JSON.parse(localStorage.getItem("ERP_USER"));
        } catch {
            return null;
        }
    },

    getRole() {
        return localStorage.getItem("ERP_ROLE") || "";
    },

    isLoggedIn() {
        return !!localStorage.getItem("ERP_USER");
    }

};

/* ================================================================
   GLOBAL HELPERS (used by login.html inline scripts)
================================================================ */

function isLoggedIn()    { return AuthEngine.isLoggedIn(); }
function getLoggedUser() { return AuthEngine.getUser(); }

/* ================================================================
   AUTO SESSION CHECK on page load
================================================================ */

window.addEventListener("load", function () {
    console.log("[AUTH ENGINE] Loaded | User:",
        AuthEngine.getUser()?.FULL_NAME || "Guest");
});
