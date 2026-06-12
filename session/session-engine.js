/* =========================================================
BALAJI NEXTGEN ERP
SESSION ENGINE
FILE:
session/session-engine.js
========================================================= */

/* =========================================================
SAVE SESSION
========================================================= */

function saveSession(data){

try{

/* =============================================
SAVE USER
============================================= */

localStorage.setItem(
'ERP_USER',
JSON.stringify(
data.user
)
);

/* =============================================
SAVE SESSION TOKEN
============================================= */

localStorage.setItem(
'ERP_SESSION',
data.sessionToken
);

/* =============================================
SAVE ROLE
============================================= */

localStorage.setItem(
'ERP_ROLE',
data.user.role
);

/* =============================================
SAVE LOGIN TIME
============================================= */

localStorage.setItem(
'ERP_LOGIN_TIME',
new Date().toISOString()
);

console.log(
'ERP SESSION SAVED'
);

}catch(error){

console.log(error);

}

}

/* =========================================================
GET USER
========================================================= */

function getUser(){

try{

const user =
localStorage.getItem(
'ERP_USER'
);

if(user){

return JSON.parse(user);

}

return null;

}catch(error){

console.log(error);

return null;

}

}

/* =========================================================
GET ROLE
========================================================= */

function getRole(){

return localStorage.getItem(
'ERP_ROLE'
);

}

/* =========================================================
GET SESSION
========================================================= */

function getSession(){

return localStorage.getItem(
'ERP_SESSION'
);

}

/* =========================================================
CHECK SESSION
========================================================= */

function checkSession(){

try{

const session =
localStorage.getItem(
'ERP_SESSION'
);

const user =
localStorage.getItem(
'ERP_USER'
);

/* =============================================
NO SESSION
============================================= */

if(!session || !user){

window.location.href =
'client-login.html';

return false;

}

/* =============================================
USER DATA
============================================= */

const userData =
JSON.parse(user);

console.log(
'ERP SESSION ACTIVE:',
userData
);

/* =============================================
AUTO USER NAME
============================================= */

setTimeout(function(){

const userNameBox =
document.getElementById(
'erpUserName'
);

if(
userNameBox
&&
userData
){

userNameBox.innerHTML =
userData.fullName
||
'ERP USER';

}

},1000);

return true;

}catch(error){

console.log(error);

logoutERP();

return false;

}

}

/* =========================================================
LOGOUT
========================================================= */

function logoutERP(){

try{

localStorage.removeItem(
'ERP_USER'
);

localStorage.removeItem(
'ERP_SESSION'
);

localStorage.removeItem(
'ERP_ROLE'
);

localStorage.removeItem(
'ERP_LOGIN_TIME'
);

console.log(
'ERP LOGOUT SUCCESS'
);

window.location.href =
'client-login.html';

}catch(error){

console.log(error);

}

}

/* =========================================================
AUTO SESSION CHECK
========================================================= */

window.addEventListener(
'load',
function(){

checkSession();

}
);