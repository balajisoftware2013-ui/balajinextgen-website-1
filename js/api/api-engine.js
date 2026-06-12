/* =========================================================
   BALAJI NEXTGEN ERP
   DYNAMIC API ENGINE
========================================================= */

let AUTH_API = "";
let CORE_API = "";
let FRONTEND_API = "";

/* =========================================================
   MASTER CONTROL SHEET
========================================================= */

const MASTER_REGISTRY_JSON =
"https://docs.google.com/spreadsheets/d/1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I/gviz/tq?tqx=out:json&sheet=API_DEPLOYMENT_REGISTRY";

/* =========================================================
   LOAD API REGISTRY
========================================================= */

async function loadAPIRegistry() {

    try {

        console.log("LOADING ERP API REGISTRY...");

        const response = await fetch(MASTER_REGISTRY_JSON);

        const text = await response.text();

        const json = JSON.parse(
            text.substring(47).slice(0, -2)
        );

        const rows = json.table.rows;

        rows.forEach(row => {

            const appName =
            row.c[0] ? String(row.c[0].v).trim() : "";

            const webappUrl =
            row.c[1] ? String(row.c[1].v).trim() : "";

            if(appName === "V2_AUTH") {

                AUTH_API = webappUrl;

                console.log("AUTH API FOUND:");
                console.log(AUTH_API);

            }

            if(appName === "V2_CORE") {

                CORE_API = webappUrl;

                console.log("CORE API FOUND:");
                console.log(CORE_API);

            }

            if(appName === "V2_FRONTEND") {

                FRONTEND_API = webappUrl;

                console.log("FRONTEND API FOUND:");
                console.log(FRONTEND_API);

            }

        });

        console.log("API REGISTRY LOADED SUCCESSFULLY");

    }

    catch(error) {

        console.log(error);

        alert("API REGISTRY LOAD FAILED");

    }

}

/* =========================================================
   SHOW MESSAGE
========================================================= */

function showMessage(message) {

    alert(message);

}

/* =========================================================
   LOGIN ERP
========================================================= */

async function loginERP() {

    try {

        const loginId =
        document.getElementById("loginId").value.trim();

        const password =
        document.getElementById("password").value.trim();

        if(!loginId || !password) {

            showMessage("ENTER LOGIN DETAILS");
            return;

        }

        if(!AUTH_API) {

            await loadAPIRegistry();

        }

        console.log("LOGIN API:");
        console.log(AUTH_API);

        const payload = {

            action : "LOGIN",

            loginId : loginId,

            password : password

        };

        console.log(payload);

        const response = await fetch(AUTH_API, {

            method : "POST",

            body : JSON.stringify(payload),

            headers : {

                "Content-Type" : "text/plain"

            }

        });

        const result = await response.json();

        console.log("API RESPONSE:");
        console.log(result);

        if(result.success === true) {

            localStorage.setItem(
                "BALAJI_USER",
                JSON.stringify(result.user)
            );

            localStorage.setItem(
                "BALAJI_TOKEN",
                result.token || ""
            );

            showMessage("LOGIN SUCCESS");

            window.location.href =
            "/dashboard.html";

        }

        else {

            showMessage(
                result.message || "LOGIN FAILED"
            );

        }

    }

    catch(error) {

        console.log(error);

        showMessage("SERVER CONNECTION FAILED");

    }

}

/* =========================================================
   LOGOUT
========================================================= */

function logoutERP() {

    localStorage.removeItem("BALAJI_USER");

    localStorage.removeItem("BALAJI_TOKEN");

    window.location.href =
    "/client-login";

}

/* =========================================================
   SESSION CHECK
========================================================= */

function checkLoginSession() {

    const user =
    localStorage.getItem("BALAJI_USER");

    if(!user) {

        window.location.href =
        "/client-login";

    }

}

/* =========================================================
   AUTO LOAD
========================================================= */

window.addEventListener(

    "load",

    async function() {

        await loadAPIRegistry();

    }

);