/* =========================================================
   BALAJI NEXTGEN ERP
   CLIENT CONTROLLER
========================================================= */

const ClientController = {

    async loadClients() {

        try {

            const clients =
                await ClientService.getClients();

            console.log(
                "CLIENTS LOADED",
                clients
            );

            return clients;

        } catch(error) {

            console.error(
                "LOAD CLIENT ERROR",
                error
            );

            return [];
        }
    },


    async createClient(clientData) {

        try {

            const response =
                await ClientService
                    .addClient(clientData);

            console.log(response);

            return response;

        } catch(error) {

            console.error(
                "CREATE CLIENT ERROR",
                error
            );

            return {
                success: false,
                message: error.toString()
            };
        }
    }

};