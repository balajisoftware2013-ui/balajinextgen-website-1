/*
================================================================
BALAJI NEXTGEN ERP
F010 - MAIN APP CONTROLLER
Master ERP frontend initializer.
Boots all engines in correct order on every page load.
================================================================
*/

const ERPApp = {

    version: "v1.0.0",
    initialized: false,

    /* ============================================================
       BOOT SEQUENCE
       Order matters — config → storage → auth → theme → ui
    ============================================================ */

    async boot() {

        if (this.initialized) return;

        console.log("=== BALAJI NEXTGEN ERP BOOTING", this.version, "===");

        try {

            // 1. Config first — sets all API URLs
            if (typeof initERPConfig === "function") {
                initERPConfig();
            }

            // 2. Restore theme immediately (prevents flash)
            if (typeof ThemeEngine !== "undefined") {
                ThemeEngine.restore();
            }

            // 3. Sidebar state
            if (typeof SidebarEngine !== "undefined") {
                SidebarEngine.restoreState();
            }

            // 4. Responsive layout
            if (typeof ResponsiveEngine !== "undefined") {
                ResponsiveEngine.init();
            }

            // 5. Notification engine
            if (typeof NotificationEngine !== "undefined") {
                NotificationEngine.init();
            }

            // 6. Load user info into UI
            this.renderUserInfo();

            // 7. Sync control panel (non-blocking)
            if (typeof ControlPanelSync !== "undefined") {
                ControlPanelSync.startAutoSync(5);
            }

            this.initialized = true;
            console.log("=== ERP BOOT COMPLETE ===");

        } catch (error) {
            console.error("[ERP APP] Boot error:", error);
        }

    },

    /* ============================================================
       RENDER USER INFO into topbar/sidebar
    ============================================================ */

    renderUserInfo() {

        const user = StorageEngine.getUser();

        if (!user) return;

        const name  = user.FULL_NAME  || user.userName || "User";
        const role  = user.ROLE       || user.role     || "";
        const branch= user.BRANCH     || "HEAD_OFFICE";
        const company = user.COMPANY_NAME || "Balaji NextGen";

        // Update all #userName, #userRole elements
        document.querySelectorAll("#userName, .erp-user-name").forEach(el => {
            el.textContent = name;
        });
        document.querySelectorAll("#userRole, .erp-user-role").forEach(el => {
            el.textContent = role;
        });
        document.querySelectorAll("#userBranch, .erp-user-branch").forEach(el => {
            el.textContent = branch;
        });
        document.querySelectorAll("#companyName, .erp-company-name").forEach(el => {
            el.textContent = company;
        });

        // Avatar initials
        document.querySelectorAll(".erp-avatar").forEach(el => {
            el.textContent = name.substring(0, 2).toUpperCase();
        });

    },

    /* ============================================================
       LOGOUT
    ============================================================ */

    async logout() {

        if (typeof AuthEngine !== "undefined") {
            await AuthEngine.logout();
        } else {
            StorageEngine.clearSession();
            window.location.href = "login.html";
        }

    },

    /* ============================================================
       HANDLE API ERROR globally
    ============================================================ */

    handleAPIError(result, defaultMsg = "Something went wrong") {
        const msg = (result && result.message) || defaultMsg;
        if (typeof NotificationEngine !== "undefined") {
            NotificationEngine.error(msg);
        } else {
            alert(msg);
        }
    }

};

/* ================================================================
   GLOBAL SHORTCUTS
================================================================ */

function erpLogout()       { ERPApp.logout(); }
function renderUserInfo()  { ERPApp.renderUserInfo(); }

/* ================================================================
   AUTO BOOT on DOM ready
================================================================ */

document.addEventListener("DOMContentLoaded", function () {
    ERPApp.boot();
});

console.log("[MAIN APP CONTROLLER] Registered");
