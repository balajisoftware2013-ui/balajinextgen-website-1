/********************************************************
 BALAJI NEXTGEN ERP
 PWA ENGINE
 FILE:
 js/core/pwa-engine.js
********************************************************/

/* =====================================================
PWA STATE
===================================================== */

const ERP_PWA = {

INSTALLED : false,

ONLINE : navigator.onLine,

SERVICE_WORKER : false,

CACHE_READY : false

};

/* =====================================================
INITIALIZE PWA
===================================================== */

async function initializeERPPWA(){

try{

console.log(
'PWA ENGINE STARTED'
);

/* =====================================================
SERVICE WORKER
===================================================== */

await registerERPServiceWorker();

/* =====================================================
INSTALL PROMPT
===================================================== */

setupERPInstallPrompt();

/* =====================================================
NETWORK STATUS
===================================================== */

trackERPNetworkStatus();

/* =====================================================
OFFLINE CACHE
===================================================== */

initializeERPCache();

/* =====================================================
PWA READY
===================================================== */

console.log(
'ERP PWA READY'
);

}catch(error){

console.log(
'PWA ERROR:',
error
);

}

}

/* =====================================================
SERVICE WORKER
===================================================== */

async function registerERPServiceWorker(){

try{

if(
'serviceWorker' in navigator
){

const registration =
await navigator.serviceWorker.register(
'/service-worker.js'
);

ERP_PWA.SERVICE_WORKER =
true;

console.log(
'SERVICE WORKER REGISTERED:',
registration
);

}

}catch(error){

console.log(
'SERVICE WORKER ERROR:',
error
);

}

}

/* =====================================================
INSTALL PROMPT
===================================================== */

function setupERPInstallPrompt(){

let deferredPrompt;

window.addEventListener(

'beforeinstallprompt',

function(event){

event.preventDefault();

deferredPrompt =
event;

showERPInstallButton(
deferredPrompt
);

}

);

}

/* =====================================================
INSTALL BUTTON
===================================================== */

function showERPInstallButton(
promptEvent
){

const button =
document.createElement(
'button'
);

button.id =
'erpInstallButton';

button.innerHTML =
'📲 Install ERP App';

button.style.position =
'fixed';

button.style.bottom =
'20px';

button.style.right =
'20px';

button.style.padding =
'14px 20px';

button.style.border =
'none';

button.style.borderRadius =
'14px';

button.style.background =
'#2563eb';

button.style.color =
'#ffffff';

button.style.fontWeight =
'700';

button.style.cursor =
'pointer';

button.style.zIndex =
'999999';

button.onclick =
async function(){

promptEvent.prompt();

const result =
await promptEvent.userChoice;

if(
result.outcome === 'accepted'
){

ERP_PWA.INSTALLED =
true;

notifySuccess(
'ERP APP INSTALLED'
);

button.remove();

}

};

document.body.appendChild(
button
);

}

/* =====================================================
NETWORK
===================================================== */

function trackERPNetworkStatus(){

window.addEventListener(

'online',

function(){

ERP_PWA.ONLINE =
true;

notifySuccess(
'ONLINE MODE'

);

}

);

window.addEventListener(

'offline',

function(){

ERP_PWA.ONLINE =
false;

notifyWarning(
'OFFLINE MODE ENABLED'
);

}

);

}

/* =====================================================
CACHE
===================================================== */

function initializeERPCache(){

try{

ERP_PWA.CACHE_READY =
true;

console.log(
'ERP CACHE READY'
);

}catch(error){

console.log(
'CACHE ERROR:',
error
);

}

}

/* =====================================================
CLEAR CACHE
===================================================== */

async function clearERPPWACache(){

try{

const cacheNames =
await caches.keys();

await Promise.all(

cacheNames.map(cache =>

caches.delete(cache)

)

);

notifySuccess(
'CACHE CLEARED'
);

}catch(error){

console.log(error);

}

}

/* =====================================================
UPDATE APP
===================================================== */

function checkERPAppUpdate(){

if(
ERP_PWA.SERVICE_WORKER
){

notifyInfo(
'CHECKING FOR ERP UPDATES'
);

}

}

/* =====================================================
OFFLINE PAGE
===================================================== */

function loadERPOfflinePage(){

document.body.innerHTML = `

<div
style="
height:100vh;
display:flex;
align-items:center;
justify-content:center;
flex-direction:column;
font-family:Poppins,sans-serif;
background:#f8fafc;
"
>

<h1
style="
font-size:42px;
color:#0f172a;
"
>

📡 OFFLINE MODE

</h1>

<p
style="
margin-top:20px;
font-size:18px;
color:#64748b;
"
>

BALAJI NEXTGEN ERP

</p>

<button
onclick="window.location.reload()"
style="
margin-top:30px;
padding:14px 28px;
border:none;
border-radius:12px;
background:#2563eb;
color:white;
font-weight:700;
cursor:pointer;
"
>

Reconnect

</button>

</div>

`;

}

/* =====================================================
PWA INFO
===================================================== */

function getERPPWAInfo(){

return {

installed :
ERP_PWA.INSTALLED,

online :
ERP_PWA.ONLINE,

serviceWorker :
ERP_PWA.SERVICE_WORKER,

cache :
ERP_PWA.CACHE_READY

};

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPPWA();

}

);