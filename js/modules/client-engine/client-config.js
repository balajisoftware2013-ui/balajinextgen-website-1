/* =========================================================
   BALAJI NEXTGEN ERP
   CLIENT ENGINE CONFIG
========================================================= */

const CLIENT_ENGINE_CONFIG = {

    MODULE_NAME: "CLIENT_ENGINE",

    VERSION: "1.0.0",

    STORAGE_KEY: "BNERP_CLIENT_DATA",

    API_ACTIONS: {

        GET_CLIENTS: "GET_CLIENTS",

        GET_CLIENT_BY_ID: "GET_CLIENT_BY_ID",

        CREATE_CLIENT: "CREATE_CLIENT",

        UPDATE_CLIENT: "UPDATE_CLIENT",

        DELETE_CLIENT: "DELETE_CLIENT"

    },

    CLIENT_TYPES: [

        "RESTAURANT",
        "RETAIL",
        "MEDICAL",
        "GST_CLIENT",
        "TEA_INDUSTRY",
        "REAL_ESTATE",
        "DISTRIBUTOR",
        "BAR",
        "CAFE"

    ],

    CLIENT_STATUS: [

        "ACTIVE",
        "INACTIVE",
        "PENDING",
        "SUSPENDED"

    ]

};