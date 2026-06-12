/************************************************************
 BALAJI NEXTGEN ERP
 SESSION ENGINE
 FRONTEND SECURITY ENGINE

 FILE:
 /assets/js/core/session-engine.js
************************************************************/


/* =========================================================
   ERP SESSION CONFIG
========================================================= */

const ERP_SESSION = {

  TOKEN_KEY:
    "BALAJI_ERP_TOKEN",

  USER_KEY:
    "BALAJI_ERP_USER",

  ROLE_KEY:
    "BALAJI_ERP_ROLE",

  LOGIN_TIME:
    "BALAJI_LOGIN_TIME"

};




/* =========================================================
   SAVE ERP SESSION
========================================================= */

function saveERPSession(data) {

  localStorage.setItem(
    ERP_SESSION.TOKEN_KEY,
    data.token
  );


  localStorage.setItem(
    ERP_SESSION.USER_KEY,
    JSON.stringify(data.user)
  );


  localStorage.setItem(
    ERP_SESSION.ROLE_KEY,
    data.role
  );


  localStorage.setItem(
    ERP_SESSION.LOGIN_TIME,
    new Date().getTime()
  );


  console.log(
    "ERP SESSION SAVED"
  );

}




/* =========================================================
   GET ERP TOKEN
========================================================= */

function getERPToken() {

  return localStorage.getItem(
    ERP_SESSION.TOKEN_KEY
  );

}




/* =========================================================
   GET ERP USER
========================================================= */

function getERPUser() {

  return JSON.parse(

    localStorage.getItem(
      ERP_SESSION.USER_KEY
    )

  );

}




/* =========================================================
   CHECK LOGIN STATUS
========================================================= */

function isERPLoggedIn() {

  const token =
    getERPToken();

  return !!token;

}




/* =========================================================
   ERP LOGOUT
========================================================= */

function logoutERP() {

  localStorage.removeItem(
    ERP_SESSION.TOKEN_KEY
  );

  localStorage.removeItem(
    ERP_SESSION.USER_KEY
  );

  localStorage.removeItem(
    ERP_SESSION.ROLE_KEY
  );

  localStorage.removeItem(
    ERP_SESSION.LOGIN_TIME
  );


  window.location.href =
    "../../login/login.html";

}




/* =========================================================
   AUTO SESSION CHECK
========================================================= */

function validateERPSession() {

  if (!isERPLoggedIn()) {

    logoutERP();

  }

}




/* =========================================================
   AUTO SESSION TIMEOUT
========================================================= */

function checkSessionTimeout() {

  const loginTime =
    localStorage.getItem(
      ERP_SESSION.LOGIN_TIME
    );


  if (!loginTime) return;


  const currentTime =
    new Date().getTime();


  const difference =
    currentTime - loginTime;


  const SESSION_LIMIT =
    1000 * 60 * 60 * 8;


  if (difference > SESSION_LIMIT) {

    alert(
      "SESSION EXPIRED"
    );

    logoutERP();

  }

}




/* =========================================================
   ROLE ACCESS CHECK
========================================================= */

function checkRoleAccess(allowedRoles = []) {

  const role =
    localStorage.getItem(
      ERP_SESSION.ROLE_KEY
    );


  if (!allowedRoles.includes(role)) {

    alert(
      "ACCESS DENIED"
    );

    window.location.href =
      "../../dashboard/main-dashboard.html";

  }

}




/* =========================================================
   ERP AUTO INITIALIZE
========================================================= */

window.addEventListener(

  "DOMContentLoaded",

  () => {

    validateERPSession();

    checkSessionTimeout();

  }

);