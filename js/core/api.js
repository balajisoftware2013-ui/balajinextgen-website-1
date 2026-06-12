/* =========================================================
   BALAJI NEXTGEN ERP
   UNIVERSAL API ENGINE
========================================================= */

const ERP_API = {

    /* =====================================================
       GET API URL
    ===================================================== */

    getApiUrl() {

        if (!window.APP_CONFIG) {

            console.error(
                "APP_CONFIG NOT LOADED"
            );

            return null;
        }

        return APP_CONFIG.API_URL;
    },


    /* =====================================================
       MAIN API REQUEST
    ===================================================== */

    async request(action, payload = {}) {

        try {

            const API_URL =
                this.getApiUrl();

            if (!API_URL) {

                return {
                    status: "FAILED",
                    message: "API URL NOT FOUND"
                };
            }

            const response =
                await fetch(API_URL, {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        action: action,

                        payload: payload,

                        token:
                            localStorage.getItem(
                                "ERP_TOKEN"
                            )
                    })
                });

            const result =
                await response.json();

            return result;

        } catch (error) {

            console.error(error);

            return {
                status: "ERROR",
                message: error.toString()
            };
        }
    },


    /* =====================================================
       LOGIN
    ===================================================== */

    async login(email, password) {

        return await this.request(
            "login",
            {
                email: email,
                password: password
            }
        );
    },


    /* =====================================================
       LOGOUT
    ===================================================== */

    async logout() {

        return await this.request(
            "logout",
            {
                token:
                    localStorage.getItem(
                        "ERP_TOKEN"
                    )
            }
        );
    },


    /* =====================================================
       LOAD MENU
    ===================================================== */

    async loadMenu(role) {

        return await this.request(
            "menu",
            {
                role: role
            }
        );
    },


    /* =====================================================
       MODULE EXECUTION
    ===================================================== */

    async module(moduleName, data = {}) {

        return await this.request(
            "module",
            {
                module: moduleName,
                data: data
            }
        );
    },


    /* =====================================================
       SESSION VALIDATION
    ===================================================== */

    async validateSession() {

        return await this.request(
            "session",
            {
                token:
                    localStorage.getItem(
                        "ERP_TOKEN"
                    )
            }
        );
    }
};