/********************************************************
 BALAJI NEXTGEN ERP
 SECURITY ENGINE
 FILE:
 js/core/security-engine.js
********************************************************/

/* =====================================================
SECURITY STATE
===================================================== */

const ERP_SECURITY = {

FAILED_ATTEMPTS : 0,

MAX_ATTEMPTS : 5,

LOCK_TIME : 300000,

LOCKED : false,

LAST_ACTIVITY : new Date(),

SESSION_TIMEOUT : 30,

DEVTOOLS_BLOCK : true

};

/* =====================================================
INITIALIZE SECURITY
===================================================== */

function initializeERPSecurity(){

try{

console.log(
'SECURITY ENGINE STARTED'
);

/* =====================================================
TRACK ACTIVITY
===================================================== */

trackERPActivity();

/* =====================================================
AUTO LOGOUT
===================================================== */

startERPSessionTimeout();

/* =====================================================
TAB CHANGE
===================================================== */

trackTabVisibility();

/* =====================================================
BLOCK DEVTOOLS
===================================================== */

if(
ERP_SECURITY.DEVTOOLS_BLOCK
){

blockERPDeveloperTools();

}

/* =====================================================
RIGHT CLICK
===================================================== */

disableRightClick();

/* =====================================================
COPY BLOCK
===================================================== */

disableCopyPaste();

}catch(error){

console.log(
'SECURITY ENGINE ERROR:',
error
);

}

}

/* =====================================================
TRACK ACTIVITY
===================================================== */

function trackERPActivity(){

document.addEventListener(

'mousemove',

function(){

ERP_SECURITY.LAST_ACTIVITY =
new Date();

}

);

document.addEventListener(

'keydown',

function(){

ERP_SECURITY.LAST_ACTIVITY =
new Date();

}

);

document.addEventListener(

'click',

function(){

ERP_SECURITY.LAST_ACTIVITY =
new Date();

}

);

}

/* =====================================================
SESSION TIMEOUT
===================================================== */

function startERPSessionTimeout(){

setInterval(function(){

const now =
new Date();

const diff =
(now -
ERP_SECURITY.LAST_ACTIVITY)
/ 1000 / 60;

/* =====================================================
AUTO LOGOUT
===================================================== */

if(
diff >
ERP_SECURITY.SESSION_TIMEOUT
){

notifyWarning(
'SESSION EXPIRED'
);

logoutERP();

}

},60000);

}

/* =====================================================
FAILED LOGIN
===================================================== */

function recordFailedLogin(){

ERP_SECURITY.FAILED_ATTEMPTS++;

if(
ERP_SECURITY.FAILED_ATTEMPTS >=
ERP_SECURITY.MAX_ATTEMPTS
){

lockERPLogin();

}

}

/* =====================================================
RESET LOGIN
===================================================== */

function resetFailedLogins(){

ERP_SECURITY.FAILED_ATTEMPTS =
0;

ERP_SECURITY.LOCKED =
false;

}

/* =====================================================
LOCK LOGIN
===================================================== */

function lockERPLogin(){

ERP_SECURITY.LOCKED =
true;

notifyError(
'LOGIN TEMPORARILY LOCKED'
);

const button =
document.getElementById(
'loginButton'
);

if(button){

button.disabled =
true;

}

/* =====================================================
UNLOCK
===================================================== */

setTimeout(function(){

ERP_SECURITY.LOCKED =
false;

ERP_SECURITY.FAILED_ATTEMPTS =
0;

if(button){

button.disabled =
false;

}

notifySuccess(
'LOGIN UNLOCKED'
);

},ERP_SECURITY.LOCK_TIME);

}

/* =====================================================
TAB CHANGE
===================================================== */

function trackTabVisibility(){

document.addEventListener(

'visibilitychange',

function(){

if(document.hidden){

console.log(
'ERP TAB INACTIVE'
);

}else{

console.log(
'ERP TAB ACTIVE'
);

}

}

);

}

/* =====================================================
BLOCK DEVTOOLS
===================================================== */

function blockERPDeveloperTools(){

document.addEventListener(

'keydown',

function(event){

/* =====================================================
F12
===================================================== */

if(event.keyCode === 123){

event.preventDefault();

notifyWarning(
'DEVELOPER TOOLS BLOCKED'
);

}

/* =====================================================
CTRL SHIFT I
===================================================== */

if(

event.ctrlKey
&&
event.shiftKey
&&
event.keyCode === 73

){

event.preventDefault();

}

/* =====================================================
CTRL SHIFT J
===================================================== */

if(

event.ctrlKey
&&
event.shiftKey
&&
event.keyCode === 74

){

event.preventDefault();

}

/* =====================================================
CTRL U
===================================================== */

if(

event.ctrlKey
&&
event.keyCode === 85

){

event.preventDefault();

}

}

);

}

/* =====================================================
RIGHT CLICK
===================================================== */

function disableRightClick(){

document.addEventListener(

'contextmenu',

function(event){

event.preventDefault();

}

);

}

/* =====================================================
COPY PASTE
===================================================== */

function disableCopyPaste(){

document.addEventListener(

'copy',

function(event){

const allow =
event.target.classList.contains(
'allow-copy'
);

if(!allow){

event.preventDefault();

}

}

);

}

/* =====================================================
ENCRYPT
===================================================== */

function encryptERPData(
data
){

try{

return btoa(
JSON.stringify(data)
);

}catch(error){

return data;

}

}

/* =====================================================
DECRYPT
===================================================== */

function decryptERPData(
data
){

try{

return JSON.parse(
atob(data)
);

}catch(error){

return data;

}

}

/* =====================================================
SAVE SECURE
===================================================== */

function saveSecureStorage(
key,
data
){

const encrypted =
encryptERPData(
data
);

localStorage.setItem(
key,
encrypted
);

}

/* =====================================================
GET SECURE
===================================================== */

function getSecureStorage(
key
){

const data =
localStorage.getItem(
key
);

if(!data){

return null;

}

return decryptERPData(
data
);

}

/* =====================================================
IP LOGGER
===================================================== */

async function logERPClientInfo(){

try{

const info = {

userAgent :
navigator.userAgent,

platform :
navigator.platform,

language :
navigator.language,

time :
new Date().toISOString()

};

console.log(
'CLIENT INFO:',
info
);

}catch(error){

console.log(error);

}

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPSecurity();

logERPClientInfo();

}

);