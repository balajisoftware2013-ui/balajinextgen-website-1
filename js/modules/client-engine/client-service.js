/* =========================================================
   BALAJI NEXTGEN ERP
   CLIENT SERVICE
========================================================= */

const ClientService = {

    clients: [],


    async getClients() {

        return this.clients;
    },


    async addClient(clientData) {

        const validation =
            ClientValidator
                .validateClientData(clientData);

        if (!validation.success) {

            return validation;
        }

        this.clients.push(clientData);

        return {
            success: true,
            message: "Client Added Successfully"
        };
    }

};