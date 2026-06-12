/* =========================================================
   BALAJI NEXTGEN ERP
   CLIENT VALIDATOR
========================================================= */

const ClientValidator = {

    validateClientData(clientData) {

        if (!clientData) {

            return {
                success: false,
                message: "Client data missing"
            };
        }

        if (!clientData.clientName) {

            return {
                success: false,
                message: "Client name required"
            };
        }

        if (!clientData.clientType) {

            return {
                success: false,
                message: "Client type required"
            };
        }

        return {
            success: true
        };
    }

};