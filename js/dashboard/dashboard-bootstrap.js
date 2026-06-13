/* =====================================================
   BALAJI NEXTGEN ERP
   Dashboard Bootstrap Engine
   File: js/dashboard/dashboard-bootstrap.js
===================================================== */

const ERP = {
    user: null,
    theme: "enterprise",
    apiBase: "",
    dashboardData: {}
};

/* ------------------------------------
   APP START
------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {

    try {

        loadTheme();

        loadLoggedUser();

        updateUserProfile();

        await loadDashboardData();

        bindMenuEvents();

        bindQuickActions();

        console.log("BALAJI NEXTGEN ERP LOADED");

    } catch (err) {

        console.error("Dashboard Bootstrap Error", err);

    }

});

/* ------------------------------------
   THEME
------------------------------------ */
function loadTheme() {

    const theme =
        localStorage.getItem("ERP_THEME")
        || "enterprise";

    ERP.theme = theme;

    document.body.setAttribute(
        "data-theme",
        theme
    );

}

/* ------------------------------------
   USER
------------------------------------ */
function loadLoggedUser() {

    const stored =
        localStorage.getItem("ERP_USER");

    if (!stored) {

        console.warn("No Login Session");

        return;
    }

    ERP.user = JSON.parse(stored);

}

function updateUserProfile() {

    const profile =
        document.getElementById("userProfile");

    if (!profile) return;

    profile.innerHTML = `
        <strong>
        ${ERP.user?.fullName || "SUPER ADMIN"}
        </strong>
        <br>
        ${ERP.user?.role || "ADMIN"}
    `;

}

/* ------------------------------------
   DASHBOARD DATA
------------------------------------ */
async function loadDashboardData() {

    try {

        /* Replace with Apps Script API */

        ERP.dashboardData = {

            sales: 0,
            purchase: 0,
            stock: 0,
            branches: 1

        };

        updateKPIs();

    } catch (error) {

        console.error(error);

    }

}

function updateKPIs() {

    setValue("salesCard", ERP.dashboardData.sales);
    setValue("purchaseCard", ERP.dashboardData.purchase);
    setValue("stockCard", ERP.dashboardData.stock);
    setValue("branchCard", ERP.dashboardData.branches);

}

function setValue(id, value) {

    const el = document.getElementById(id);

    if (el) {

        el.innerText = value;

    }

}

/* ------------------------------------
   MENU
------------------------------------ */
function bindMenuEvents() {

    document
        .querySelectorAll(".menu a")
        .forEach(link => {

            link.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(".menu a")
                        .forEach(a =>
                            a.classList.remove("active")
                        );

                    this.classList.add("active");

                }
            );

        });

}

/* ------------------------------------
   QUICK ACTIONS
------------------------------------ */
function bindQuickActions() {

    bindAction(
        "newInvoiceBtn",
        () => {
            console.log("New Invoice");
        }
    );

    bindAction(
        "newPurchaseBtn",
        () => {
            console.log("New Purchase");
        }
    );

    bindAction(
        "newCustomerBtn",
        () => {
            console.log("New Customer");
        }
    );

    bindAction(
        "newItemBtn",
        () => {
            console.log("New Item");
        }
    );

}

function bindAction(id, fn) {

    const el =
        document.getElementById(id);

    if (!el) return;

    el.addEventListener("click", fn);

}

/* ------------------------------------
   LOGOUT
------------------------------------ */
function logout() {

    localStorage.removeItem("ERP_USER");

    window.location.href =
        "../client-login.html";

}

/* ------------------------------------
   SEARCH
------------------------------------ */
function searchModules(keyword) {

    console.log(
        "Search Module:",
        keyword
    );

}

/* ------------------------------------
   NOTIFICATION
------------------------------------ */
function openNotifications() {

    console.log(
        "Open Notifications"
    );

}

/* ------------------------------------
   THEME SWITCH
------------------------------------ */
function changeTheme(theme) {

    ERP.theme = theme;

    localStorage.setItem(
        "ERP_THEME",
        theme
    );

    loadTheme();

}