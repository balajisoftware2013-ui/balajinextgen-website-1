/*
================================================================
BALAJI NEXTGEN ERP
F012 - API SERVICE
Central API fetch wrapper for all ERP actions.
Reads URL from frontend-api-config.js (localStorage).
================================================================
*/

/* ================================================================
   CORE REQUEST — all ERP API calls go through this
================================================================ */

async function apiRequest(action, payload = {}) {

    const BASE_URL =
        localStorage.getItem("ERP_API_URL") ||
        "https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec";

    try {

        const response = await fetch(BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action,
                token:    localStorage.getItem("ERP_TOKEN")  || "",
                clientId: localStorage.getItem("ERP_CLIENT") || "",
                branch:   localStorage.getItem("ERP_BRANCH") || "HEAD_OFFICE",
                ...payload
            })
        });

        const text = await response.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch {
            console.error("[API] Non-JSON response:", text.substring(0, 200));
            return {
                success: false,
                message: "Server returned invalid response. Check Apps Script deployment."
            };
        }

        if (localStorage.getItem("ENABLE_API_LOGS") === "YES") {
            console.log("[API]", action, "→", result);
        }

        return result;

    } catch (error) {

        console.error("[API] Fetch error:", error.message);

        return {
            success: false,
            message: "Connection failed: " + (error.message || "Network Error")
        };

    }

}

/* ================================================================
   FRONTEND API REQUEST (V2_FRONTEND endpoint)
================================================================ */

async function frontendApiRequest(action, payload = {}) {

    const URL =
        localStorage.getItem("ERP_FRONTEND_API") ||
        "https://script.google.com/macros/s/AKfycbyiaO9zpZAQ1pTlDjz7B2yEUfjv1vrlXTYjTkIY-YwKr6ahOCV6lU_AiB4dpmnBySG1/exec";

    try {

        const response = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action,
                token: localStorage.getItem("ERP_TOKEN") || "",
                ...payload
            })
        });

        return await response.json();

    } catch (error) {
        return { success: false, message: error.message };
    }

}

/* ================================================================
   CORE API REQUEST (V2_CORE endpoint)
================================================================ */

async function coreApiRequest(action, payload = {}) {

    const URL =
        localStorage.getItem("ERP_CORE_API") ||
        "https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec";

    try {

        const response = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action,
                token: localStorage.getItem("ERP_TOKEN") || "",
                ...payload
            })
        });

        return await response.json();

    } catch (error) {
        return { success: false, message: error.message };
    }

}

/* ================================================================
   AUTH API (shorthand object — used by auth-engine.js)
================================================================ */

const AuthAPI = {
    login(data)         { return apiRequest("LOGIN",          data); },
    logout(data)        { return apiRequest("LOGOUT",         data); },
    requestOTP(data)    { return apiRequest("SEND_OTP",       data); },
    verifyOTP(data)     { return apiRequest("OTP_LOGIN",      data); },
    verifySession(data) { return apiRequest("VERIFY_SESSION", data); }
};

console.log("[API SERVICE] Loaded | URL:", localStorage.getItem("ERP_API_URL") || "DEFAULT");
