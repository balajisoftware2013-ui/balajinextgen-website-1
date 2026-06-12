/* =========================================================
   BALAJI NEXTGEN ERP
   API MANAGER
========================================================= */

const APIManager = {

    API_URL:
        "",


    /* =====================================================
       INIT API
    ===================================================== */

    init(apiUrl) {

        this.API_URL = apiUrl;

        console.log(
            "API INITIALIZED",
            apiUrl
        );
    },


    /* =====================================================
       POST REQUEST
    ===================================================== */

    async post(action, payload = {}) {

        try {

            const response =
                await fetch(
                    this.API_URL,
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            action: action,

                            payload: payload

                        })
                    }
                );

            return await response.json();

        } catch(error) {

            console.error(
                "API ERROR",
                error
            );

            return {

                success: false,

                message:
                    error.toString()
            };
        }
    }

};