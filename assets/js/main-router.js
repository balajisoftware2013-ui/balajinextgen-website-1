/* =========================================================
   BALAJI NEXTGEN ERP
   V2 AUTH MAIN ROUTER
========================================================= */

function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {

      return outputJSON({
        success: false,
        message: "NO REQUEST DATA"
      });

    }

    const data = JSON.parse(e.postData.contents);

    const action = String(
      data.action || ""
    ).trim().toUpperCase();

    Logger.log("ACTION : " + action);

    switch (action) {

      /* =====================================
         LOGIN
      ===================================== */

      case "LOGIN":
        return outputJSON(
          loginUser(data)
        );

      /* =====================================
         OTP LOGIN
      ===================================== */

      case "OTP_LOGIN":
        return outputJSON(
          otpLogin(data)
        );

      /* =====================================
         SEND OTP
      ===================================== */

      case "SEND_OTP":
        return outputJSON(
          sendOTP(data)
        );

      /* =====================================
         VERIFY SESSION
      ===================================== */

      case "VERIFY_SESSION":
        return outputJSON(
          verifySession(data)
        );

      /* =====================================
         LOGOUT
      ===================================== */

      case "LOGOUT":
        return outputJSON(
          logoutUser(data)
        );

      /* =====================================
         CONTACT FORM
      ===================================== */

      case "SAVE_CONTACT":
        return outputJSON(
          saveContact(data)
        );

      /* =====================================
         DEMO REGISTRATION
      ===================================== */

      case "SAVE_DEMO_REGISTER":
        return outputJSON(
          saveDemoRegister(data)
        );

      /* =====================================
         USER PROFILE
      ===================================== */

      case "GET_PROFILE":
        return outputJSON(
          getUserProfile(data)
        );

      /* =====================================
         DASHBOARD DATA
      ===================================== */

      case "GET_DASHBOARD":
        return outputJSON(
          getDashboardData(data)
        );

      default:

        return outputJSON({
          success: false,
          message: "INVALID ACTION : " + action
        });

    }

  } catch (error) {

    Logger.log(error);

    return outputJSON({
      success: false,
      message: error.toString()
    });

  }

}

/* =========================================================
   TEST API
   FIX: Returns data.V2_AUTH so api-registry-loader.js
        can read the auth URL correctly.
========================================================= */

function doGet() {

  /*
  =======================================================
  IMPORTANT: Replace THIS_SCRIPT_URL with your actual
  deployed Google Apps Script /exec URL every time
  you create a new deployment.
  =======================================================
  */

  const THIS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec";

  return outputJSON({

    success: true,

    system: "BALAJI NEXTGEN ERP",

    project: "V2_AUTH",

    status: "RUNNING",

    timestamp: new Date().toISOString(),

    /*
    =====================================================
    FIX: api-registry-loader.js reads result.data.V2_AUTH
         This was missing before — causing login to fail.
    =====================================================
    */

    data: {

      V2_AUTH: THIS_SCRIPT_URL

    }

  });

}

/* =========================================================
   JSON OUTPUT
========================================================= */

function outputJSON(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );

}
