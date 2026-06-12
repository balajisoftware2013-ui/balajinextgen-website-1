/*
================================================================
BALAJI NEXTGEN ERP
F002 - CONTROL PANEL SYNC ENGINE
Syncs frontend config with CONTROL_PANEL sheet values.
Auto-refreshes FRONTEND_URL, BACKEND_API_URL from live sheet.
================================================================
*/

const ControlPanelSync = {

    /* ============================================================
       CONTROL_PANEL sheet keys (from your Excel)
    ============================================================ */

    KEYS: {
        ERP_MODE:           "ERP_MODE",
        FRONTEND_VERSION:   "FRONTEND_VERSION",
        FRONTEND_URL:       "FRONTEND_URL",
        BACKEND_API_URL:    "BACKEND_API_URL",
        BACKEND_STATUS:     "BACKEND_STATUS",
        ENABLE_API_LOGS:    "ENABLE_API_LOGS",
        CACHE_BREAKER:      "CACHE_BREAKER",
        ACTIVE_ENVIRONMENT: "ACTIVE_ENVIRONMENT"
    },

    /* ============================================================
       FETCH CONTROL PANEL from backend
    ============================================================ */

    async fetchControlPanel() {

        try {

            const apiURL = getAuthAPI();

            const response = await fetch(apiURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "GET_CONTROL_PANEL",
                    token: localStorage.getItem("ERP_TOKEN") || ""
                })
            });

            const result = await response.json();

            if (result && result.success && result.data) {
                this.applySettings(result.data);
                return result.data;
            }

        } catch (error) {
            console.warn("[CONTROL PANEL SYNC] Using cached config:", error.message);
        }

        return null;

    },

    /* ============================================================
       APPLY SETTINGS to localStorage
    ============================================================ */

    applySettings(data) {

        if (data.BACKEND_API_URL) {
            localStorage.setItem("ERP_API_URL", data.BACKEND_API_URL);
        }

        if (data.FRONTEND_URL) {
            localStorage.setItem("ERP_FRONTEND_API", data.FRONTEND_URL);
        }

        if (data.ERP_MODE) {
            localStorage.setItem("ERP_MODE", data.ERP_MODE);
        }

        if (data.CACHE_BREAKER) {
            localStorage.setItem("CACHE_BREAKER", data.CACHE_BREAKER);
        }

        console.log("[CONTROL PANEL SYNC] Settings applied:", data);

    },

    /* ============================================================
       GET SETTING from localStorage
    ============================================================ */

    get(key) {
        return localStorage.getItem(key);
    },

    /* ============================================================
       AUTO SYNC every 5 minutes
    ============================================================ */

    startAutoSync(intervalMinutes = 5) {

        this.fetchControlPanel();

        setInterval(() => {
            this.fetchControlPanel();
        }, intervalMinutes * 60 * 1000);

    }

};

/* ================================================================
   AUTO START — sync on page load (non-blocking)
================================================================ */

document.addEventListener("DOMContentLoaded", function () {

    if (typeof getAuthAPI === "function") {
        ControlPanelSync.startAutoSync(5);
    }

});
