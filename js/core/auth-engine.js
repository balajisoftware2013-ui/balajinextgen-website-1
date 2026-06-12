/* =========================================================
   BALAJI NEXTGEN ERP
   FRONTEND ROUTER ENGINE
========================================================= */

const ERP_ROUTER = {

    /* =====================================================
       LOAD PAGE
    ===================================================== */

    async loadPage(pageUrl) {

        try {

            const contentArea =
                document.getElementById(
                    "erpContentArea"
                );

            if (!contentArea) {

                console.error(
                    "CONTENT AREA NOT FOUND"
                );

                return;
            }

            contentArea.innerHTML =

                `
                <div class="loader">

                    Loading...

                </div>
                `;

            const response =
                await fetch(pageUrl);

            const html =
                await response.text();

            contentArea.innerHTML = html;

            window.scrollTo(0, 0);

        } catch(error) {

            console.error(
                "ROUTER ERROR",
                error
            );

            document.getElementById(
                "erpContentArea"
            ).innerHTML =

            `
            <div class="card">

                <h2>
                    Failed To Load Module
                </h2>

            </div>
            `;
        }
    },


    /* =====================================================
       OPEN MODULE
    ===================================================== */

    openModule(moduleName) {

        switch(moduleName) {

            case "dashboard":

                this.loadPage(
                    "../../modules/dashboard/dashboard-home.html"
                );

                break;


            case "inventory":

                this.loadPage(
                    "../../modules/inventory/inventory-home.html"
                );

                break;


            case "sales":

                this.loadPage(
                    "../../modules/sales/sales-home.html"
                );

                break;


            case "purchase":

                this.loadPage(
                    "../../modules/purchase/purchase-home.html"
                );

                break;


            case "accounts":

                this.loadPage(
                    "../../modules/accounts/accounts-home.html"
                );

                break;


            case "reports":

                this.loadPage(
                    "../../modules/reports/reports-home.html"
                );

                break;


            default:

                console.error(
                    "MODULE NOT FOUND"
                );
        }
    }
};