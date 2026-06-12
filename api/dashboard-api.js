/* ==========================================
   BALAJI NEXTGEN ERP
   Dashboard API Engine
========================================== */

const DASHBOARD_API = {

    WEBAPP_URL:
    "", // PUT APPS SCRIPT URL HERE

    async call(action, payload = {}) {

        try {

            const response =
            await fetch(
                this.WEBAPP_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify({
                        action,
                        payload
                    })
                }
            );

            return await response.json();

        } catch (error) {

            console.error(
                "API ERROR",
                error
            );

            return {
                success:false,
                message:error.message
            };

        }

    }

};

/* ==========================================
   USER
========================================== */

async function getCurrentUser() {

    return await DASHBOARD_API.call(
        "GET_USER"
    );

}

/* ==========================================
   DASHBOARD
========================================== */

async function getDashboardSummary() {

    return await DASHBOARD_API.call(
        "GET_DASHBOARD"
    );

}

/* ==========================================
   NOTIFICATIONS
========================================== */

async function getNotifications() {

    return await DASHBOARD_API.call(
        "GET_NOTIFICATIONS"
    );

}