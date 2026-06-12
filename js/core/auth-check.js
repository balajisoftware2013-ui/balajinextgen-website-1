/* =========================================================
   BALAJI NEXTGEN ERP
   AUTH CHECK ENGINE
========================================================= */

const API_URL =
"https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

/* =========================================================
   USER DATA
========================================================= */

const ERP_USER =
JSON.parse(
  localStorage.getItem(
    "ERP_USER"
  )
);

const ERP_TOKEN =
localStorage.getItem(
  "ERP_TOKEN"
);

/* =========================================================
   LOGIN CHECK
========================================================= */

if (
  !ERP_USER ||
  !ERP_TOKEN
) {

  redirectLogin();
}

/* =========================================================
   VALIDATE SESSION
========================================================= */

validateERPLogin();

/* =========================================================
   VALIDATE FUNCTION
========================================================= */

async function validateERPLogin() {

  try {

    const response =
      await fetch(
        API_URL,
        {
          method:"POST",

          body:JSON.stringify({

            action:"validateSession",

            token:ERP_TOKEN
          })
        }
      );

    const data =
      await response.json();

    if (!data.success) {

      logoutERP();
    }

  } catch(error) {

    console.error(error);

    logoutERP();
  }
}

/* =========================================================
   LOGOUT
========================================================= */

async function logoutERP() {

  try {

    await fetch(
      API_URL,
      {
        method:"POST",

        body:JSON.stringify({

          action:"logout",

          token:ERP_TOKEN
        })
      }
    );

  } catch(error) {

    console.error(error);
  }

  localStorage.removeItem(
    "ERP_USER"
  );

  localStorage.removeItem(
    "ERP_TOKEN"
  );

  redirectLogin();
}

/* =========================================================
   REDIRECT LOGIN
========================================================= */

function redirectLogin() {

  window.location.href =
  "../login/admin-login.html";
}