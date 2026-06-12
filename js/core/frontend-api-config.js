/************************************************************
 BALAJI NEXTGEN ERP
 FILE : frontend-api-config.js
 PURPOSE : CENTRAL FRONTEND API CONFIGURATION
************************************************************/


/* =========================================================
   ERP GLOBAL API CONFIG
========================================================= */

const ERP_API_CONFIG = {

  /* =========================================
     LIVE BACKEND URL
  ========================================= */

  BASE_URL:

    localStorage.getItem(
      "ERP_BACKEND_API_URL"
    ) ||

    "PASTE_YOUR_WEBAPP_URL_HERE",



  /* =========================================
     FRONTEND URL
  ========================================= */

  FRONTEND_URL:

    localStorage.getItem(
      "ERP_FRONTEND_URL"
    ) ||

    window.location.origin,



  /* =========================================
     API VERSION
  ========================================= */

  VERSION:
    "v1.0.0",



  /* =========================================
     REQUEST TIMEOUT
  ========================================= */

  TIMEOUT:
    30000,



  /* =========================================
     SYSTEM NAME
  ========================================= */

  SYSTEM_NAME:
    "BALAJI NEXTGEN ERP"

};




/* =========================================================
   COMMON API REQUEST FUNCTION
========================================================= */

async function callERPAPI(

  action,

  payload = {}

) {

  try {

    /* =====================================
       API REQUEST BODY
    ===================================== */

    const requestBody = {

      action:
        action,

      ...payload

    };



    /* =====================================
       FETCH REQUEST
    ===================================== */

    const response =

      await fetch(

        ERP_API_CONFIG.BASE_URL,

        {

          method:
            "POST",



          headers: {

            "Content-Type":
              "application/json"

          },



          body:

            JSON.stringify(
              requestBody
            )

        }

      );



    /* =====================================
       CONVERT JSON
    ===================================== */

    const result =
      await response.json();



    console.log(

      "ERP API RESPONSE",

      result

    );



    return result;

  }

  catch(error) {

    console.error(

      "ERP API ERROR",

      error

    );



    return {

      status:
        "ERROR",

      message:
        error.toString()

    };

  }

}




/* =========================================================
   GET API URL
========================================================= */

function getERPApiURL() {

  return ERP_API_CONFIG
    .BASE_URL;

}




/* =========================================================
   UPDATE API URL
========================================================= */

function updateERPApiURL(

  newURL

) {

  ERP_API_CONFIG.BASE_URL =
    newURL;



  localStorage.setItem(

    "ERP_BACKEND_API_URL",

    newURL

  );



  console.log(

    "ERP API URL UPDATED",

    newURL

  );

}




/* =========================================================
   GET FRONTEND URL
========================================================= */

function getFrontendURL() {

  return ERP_API_CONFIG
    .FRONTEND_URL;

}




/* =========================================================
   SAVE FRONTEND URL
========================================================= */

function saveFrontendURL() {

  localStorage.setItem(

    "ERP_FRONTEND_URL",

    window.location.origin

  );

}




/* =========================================================
   ERP CONNECTION TEST
========================================================= */

async function testERPConnection() {

  try {

    const response =

      await fetch(

        ERP_API_CONFIG.BASE_URL

      );



    const result =
      await response.json();



    console.log(

      "ERP CONNECTION SUCCESS",

      result

    );



    return result;

  }

  catch(error) {

    console.error(

      "ERP CONNECTION FAILED",

      error

    );



    return {

      status:
        "ERROR",

      message:
        error.toString()

    };

  }

}




/* =========================================================
   AUTO INITIALIZE
========================================================= */

window.addEventListener(

  "load",

  () => {

    console.log(

      ERP_API_CONFIG.SYSTEM_NAME +
      " FRONTEND INITIALIZED"

    );



    saveFrontendURL();

  }

);