/********************************************************
 BALAJI NEXTGEN ERP
 SESSION ENGINE
 FILE:
 js/auth/session/session-engine.js
********************************************************/

/* =====================================================
SESSION STATE
===================================================== */

const ERP_SESSION = {

USER : null,

TOKEN : null,

ROLE : null,

LOGIN_TIME : null,

ACTIVE : false

};

/* =====================================================
SAVE SESSION
===================================================== */

function saveERPSession(
data
){

try{

/* =====================================================
SAVE USER
===================================================== */

localStorage.setItem(

'ERP_USER',

JSON.stringify(
data.user
)

);

/* =====================================================
SAVE TOKEN
===================================================== */

localStorage.setItem(

'ERP_SESSION',

data.sessionToken

);

/* =====================================================
SAVE ROLE
===================================================== */

localStorage.setItem(

'ERP_ROLE',

data.user.role || 'USER'

);

/* =====================================================
SAVE LOGIN TIME
===================================================== */

localStorage.setItem(

'ERP_LOGIN_TIME',

new Date().toISOString()

);

/* =====================================================
MEMORY
===================================================== */

ERP_SESSION.USER =
data.user;

ERP_SESSION.TOKEN =
data.sessionToken;

ERP_SESSION.ROLE =
data.user.role;

ERP_SESSION.ACTIVE =
true;

console.log(
'ERP SESSION SAVED'
);

return true;

}catch(error){

console.log(
'SESSION SAVE ERROR:',
error
);

return false;

}

}

/* =====================================================
LOAD SESSION
===================================================== */

function loadERPSession(){

try{

const user =
localStorage.getItem(
'ERP_USER'
);

const token =
localStorage.getItem(
'ERP_SESSION'
);

const role =
localStorage.getItem(
'ERP_ROLE'
);

const loginTime =
localStorage.getItem(
'ERP_LOGIN_TIME'
);

/* =====================================================
NO SESSION
===================================================== */

if(!user || !token){

ERP_SESSION.ACTIVE =
false;

return null;

}

/* =====================================================
RESTORE
===================================================== */

ERP_SESSION.USER =
JSON.parse(user);

ERP_SESSION.TOKEN =
token;

ERP_SESSION.ROLE =
role;

ERP_SESSION.LOGIN_TIME =
loginTime;

ERP_SESSION.ACTIVE =
true;

console.log(
'ERP SESSION RESTORED'
);

return ERP_SESSION;

}catch(error){

console.log(
'SESSION LOAD ERROR:',
error
);

return null;

}

}

/* =====================================================
CHECK SESSION
===================================================== */

function checkERPSession(){

try{

const session =
loadERPSession();

/* =====================================================
NO SESSION
===================================================== */

if(!session){

redirectToLogin();

return false;

}

/* =====================================================
TOKEN CHECK
===================================================== */

if(!session.TOKEN){

redirectToLogin();

return false;

}

/* =====================================================
SESSION EXPIRE
===================================================== */

const loginTime =
new Date(
session.LOGIN_TIME
);

const now =
new Date();

const hours =
(now - loginTime)
/ 1000 / 60 / 60;

/* =====================================================
12 HOURS SESSION
===================================================== */

if(hours > 12){

logoutERP();

return false;

}

console.log(
'SESSION ACTIVE'
);

return true;

}catch(error){

console.log(
'SESSION CHECK ERROR:',
error
);

redirectToLogin();

return false;

}

}

/* =====================================================
GET USER
===================================================== */

function getERPUser(){

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

/* =====================================================
GET ROLE
===================================================== */

function getERPRole(){

return localStorage.getItem(
'ERP_ROLE'
);

}

/* =====================================================
GET TOKEN
===================================================== */

function getERPToken(){

return localStorage.getItem(
'ERP_SESSION'
);

}

/* =====================================================
LOGOUT
===================================================== */

function logoutERP(){

try{

/* =====================================================
CLEAR STORAGE
===================================================== */

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

/* =====================================================
RESET MEMORY
===================================================== */

ERP_SESSION.USER = null;

ERP_SESSION.TOKEN = null;

ERP_SESSION.ROLE = null;

ERP_SESSION.ACTIVE = false;

console.log(
'ERP LOGOUT SUCCESS'
);

/* =====================================================
REDIRECT
===================================================== */

redirectToLogin();

}catch(error){

console.log(
'LOGOUT ERROR:',
error
);

}

}

/* =====================================================
LOGIN REDIRECT
===================================================== */

function redirectToLogin(){

window.location.href =
'client-login.html';

}

/* =====================================================
DASHBOARD REDIRECT
===================================================== */

function redirectToDashboard(){

window.location.href =
'dashboard.html';

}

/* =====================================================
AUTH GUARD
===================================================== */

function protectERPPage(){

const currentPage =
window.location.pathname;

/* =====================================================
LOGIN PAGE
===================================================== */

if(
currentPage.includes(
'client-login'
)
){

return;

}

/* =====================================================
CHECK
===================================================== */

checkERPSession();

}

/* =====================================================
AUTO PROTECT
===================================================== */

window.addEventListener(

'load',

function(){

protectERPPage();

}

);