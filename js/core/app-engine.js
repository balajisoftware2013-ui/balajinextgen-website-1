/********************************************************
 BALAJI NEXTGEN ERP
 APP ENGINE
 FILE:
 js/core/app-engine.js
********************************************************/

/* =====================================================
APP STATE
===================================================== */

const ERP_APP = {

NAME : 'BALAJI NEXTGEN ERP',

VERSION : 'V2',

BUILD : '2026.1',

MODE : 'PRODUCTION',

READY : false,

CURRENT_PAGE : '',

DEVICE : '',

ONLINE : navigator.onLine

};

/* =====================================================
INITIALIZE APP
===================================================== */

async function initializeERPApp(){

try{

console.log(
'INITIALIZING ERP APPLICATION...'
);

/* =====================================================
CURRENT PAGE
===================================================== */

ERP_APP.CURRENT_PAGE =
window.location.pathname;

/* =====================================================
DEVICE
===================================================== */

detectERPDevice();

/* =====================================================
ONLINE
===================================================== */

trackERPConnection();

/* =====================================================
SHORTCUTS
===================================================== */

initializeERPShortcuts();

/* =====================================================
PAGE TITLE
===================================================== */

document.title =
ERP_APP.NAME;

/* =====================================================
LOADING SCREEN
===================================================== */

showFullPageLoader();

/* =====================================================
MASTER SYSTEM
===================================================== */

await startERPSystem();

/* =====================================================
APP READY
===================================================== */

ERP_APP.READY =
true;

/* =====================================================
STOP LOADER
===================================================== */

hideLoader();

/* =====================================================
SUCCESS
===================================================== */

notifySuccess(
'ERP APPLICATION READY'
);

console.log(
'ERP APP READY'
);

}catch(error){

hideLoader();

console.log(
'APP ENGINE ERROR:',
error
);

notifyError(
'APPLICATION START FAILED'
);

}

}

/* =====================================================
DEVICE DETECTION
===================================================== */

function detectERPDevice(){

const width =
window.innerWidth;

if(width < 768){

ERP_APP.DEVICE =
'MOBILE';

document.body.classList.add(
'erp-mobile-device'
);

}else if(width < 1200){

ERP_APP.DEVICE =
'TABLET';

document.body.classList.add(
'erp-tablet-device'
);

}else{

ERP_APP.DEVICE =
'DESKTOP';

document.body.classList.add(
'erp-desktop-device'
);

}

console.log(
'DEVICE:',
ERP_APP.DEVICE
);

}

/* =====================================================
CONNECTION
===================================================== */

function trackERPConnection(){

window.addEventListener(

'online',

function(){

ERP_APP.ONLINE =
true;

notifySuccess(
'INTERNET CONNECTED'
);

}

);

window.addEventListener(

'offline',

function(){

ERP_APP.ONLINE =
false;

notifyError(
'NO INTERNET CONNECTION'
);

}

);

}

/* =====================================================
SHORTCUTS
===================================================== */

function initializeERPShortcuts(){

document.addEventListener(

'keydown',

function(event){

/* =====================================================
CTRL + D
===================================================== */

if(

event.ctrlKey
&&
event.key.toLowerCase() === 'd'

){

event.preventDefault();

openERPRoute(
'dashboard'
);

}

/* =====================================================
CTRL + L
===================================================== */

if(

event.ctrlKey
&&
event.key.toLowerCase() === 'l'

){

event.preventDefault();

logoutERP();

}

/* =====================================================
CTRL + R
===================================================== */

if(

event.ctrlKey
&&
event.shiftKey
&&
event.key.toLowerCase() === 'r'

){

event.preventDefault();

restartERPSystem();

}

/* =====================================================
CTRL + M
===================================================== */

if(

event.ctrlKey
&&
event.key.toLowerCase() === 'm'

){

event.preventDefault();

toggleSidebar();

}

/* =====================================================
CTRL + T
===================================================== */

if(

event.ctrlKey
&&
event.key.toLowerCase() === 't'

){

event.preventDefault();

toggleERPDarkMode();

}

}

);

}

/* =====================================================
OPEN APP SETTINGS
===================================================== */

function openERPAppSettings(){

alert(

`
BALAJI NEXTGEN ERP

VERSION:
${ERP_APP.VERSION}

BUILD:
${ERP_APP.BUILD}

DEVICE:
${ERP_APP.DEVICE}

MODE:
${ERP_APP.MODE}

ONLINE:
${ERP_APP.ONLINE}

`

);

}

/* =====================================================
FULL REFRESH
===================================================== */

function refreshERPApplication(){

notifyInfo(
'REFRESHING ERP APPLICATION'
);

setTimeout(function(){

window.location.reload();

},1000);

}

/* =====================================================
CLEAR CACHE
===================================================== */

function clearERPApplicationCache(){

try{

localStorage.clear();

sessionStorage.clear();

notifySuccess(
'ERP CACHE CLEARED'
);

}catch(error){

console.log(error);

}

}

/* =====================================================
AUTO SAVE
===================================================== */

function enableERPAutoSave(){

setInterval(function(){

const state = {

page :
ERP_APP.CURRENT_PAGE,

time :
new Date().toISOString()

};

saveDashboardState(
state
);

console.log(
'AUTO SAVE COMPLETE'
);

},300000);

}

/* =====================================================
SYSTEM HEALTH
===================================================== */

function checkERPHealth(){

const health = {

api :
ERP_API.LOADED,

session :
ERP_SESSION.ACTIVE,

online :
ERP_APP.ONLINE,

ready :
ERP_APP.READY

};

console.log(
'ERP HEALTH:',
health
);

return health;

}

/* =====================================================
AUTO SAVE ENABLE
===================================================== */

window.addEventListener(

'load',

function(){

enableERPAutoSave();

}

);

/* =====================================================
AUTO START APP
===================================================== */

window.addEventListener(

'DOMContentLoaded',

async function(){

await initializeERPApp();

}

);