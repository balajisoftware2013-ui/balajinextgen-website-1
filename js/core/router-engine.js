/********************************************************
 BALAJI NEXTGEN ERP
 MAIN ROUTER ENGINE
 FILE:
 js/core/router-engine.js
********************************************************/

/* =====================================================
ROUTER STATE
===================================================== */

const ERP_ROUTER = {

CURRENT_ROUTE : 'dashboard',

PREVIOUS_ROUTE : '',

ROUTE_HISTORY : [],

MODULE_PATH : 'modules/'

};

/* =====================================================
INITIALIZE ROUTER
===================================================== */

function initializeRouter(){

try{

console.log(
'ERP ROUTER INITIALIZED'
);

/* =====================================================
CHECK URL HASH
===================================================== */

const hash =
window.location.hash.replace(
'#',
''
);

if(hash){

openERPRoute(hash);

}else{

openERPRoute(
'dashboard'
);

}

/* =====================================================
HASH CHANGE
===================================================== */

window.addEventListener(

'hashchange',

function(){

const route =
window.location.hash
.replace('#','');

if(route){

openERPRoute(route);

}

}

);

}catch(error){

console.log(
'ROUTER ERROR:',
error
);

}

}

/* =====================================================
OPEN ROUTE
===================================================== */

async function openERPRoute(
route
){

try{

showLoader();

/* =====================================================
SAVE HISTORY
===================================================== */

ERP_ROUTER.PREVIOUS_ROUTE =
ERP_ROUTER.CURRENT_ROUTE;

ERP_ROUTER.CURRENT_ROUTE =
route;

ERP_ROUTER.ROUTE_HISTORY.push(
route
);

/* =====================================================
SET HASH
===================================================== */

window.location.hash =
route;

/* =====================================================
UPDATE ACTIVE MENU
===================================================== */

setActiveMenu(
route
);

/* =====================================================
LOAD MODULE
===================================================== */

await loadERPModule(
route
);

hideLoader();

console.log(
'ROUTE OPENED:',
route
);

}catch(error){

hideLoader();

console.log(
'ROUTE LOAD FAILED:',
error
);

showMessage(
'MODULE LOAD FAILED',
'error'
);

}

}

/* =====================================================
LOAD MODULE
===================================================== */

async function loadERPModule(
module
){

try{

const content =
document.getElementById(
'dashboardContent'
);

if(!content){

return;

}

/* =====================================================
MODULE URL
===================================================== */

const moduleURL =
`${ERP_ROUTER.MODULE_PATH}${module}/${module}.html`;

/* =====================================================
FETCH MODULE
===================================================== */

const response =
await fetch(
moduleURL
);

if(!response.ok){

throw new Error(
'MODULE FILE NOT FOUND'
);

}

/* =====================================================
HTML
===================================================== */

const html =
await response.text();

content.innerHTML =
html;

/* =====================================================
LOAD JS
===================================================== */

await loadModuleScript(
module
);

/* =====================================================
LOAD CSS
===================================================== */

loadModuleCSS(
module
);

console.log(
'MODULE LOADED:',
module
);

}catch(error){

console.log(
'MODULE ERROR:',
error
);

loadFallbackModule(
module
);

}

}

/* =====================================================
LOAD SCRIPT
===================================================== */

async function loadModuleScript(
module
){

return new Promise((resolve) => {

const oldScript =
document.getElementById(
'erpModuleScript'
);

if(oldScript){

oldScript.remove();

}

const script =
document.createElement(
'script'
);

script.id =
'erpModuleScript';

script.src =
`modules/${module}/${module}.js`;

script.onload =
resolve;

script.onerror =
resolve;

document.body.appendChild(
script
);

});

}

/* =====================================================
LOAD CSS
===================================================== */

function loadModuleCSS(
module
){

const oldCSS =
document.getElementById(
'erpModuleCSS'
);

if(oldCSS){

oldCSS.remove();

}

const link =
document.createElement(
'link'
);

link.id =
'erpModuleCSS';

link.rel =
'stylesheet';

link.href =
`modules/${module}/${module}.css`;

document.head.appendChild(
link
);

}

/* =====================================================
FALLBACK MODULE
===================================================== */

function loadFallbackModule(
module
){

const content =
document.getElementById(
'dashboardContent'
);

if(!content){

return;

}

content.innerHTML = `

<div class="erp-module-fallback">

<div class="erp-fallback-icon">
⚠️
</div>

<h1>
${module.toUpperCase()}
</h1>

<p>
Module currently under development.
</p>

<button
onclick="openERPRoute('dashboard')"
class="erp-btn"
>

Back To Dashboard

</button>

</div>

`;

}

/* =====================================================
BACK
===================================================== */

function goBackERPRoute(){

if(
ERP_ROUTER.ROUTE_HISTORY.length < 2
){

return;

}

ERP_ROUTER.ROUTE_HISTORY.pop();

const previous =
ERP_ROUTER.ROUTE_HISTORY.pop();

openERPRoute(
previous
);

}

/* =====================================================
REFRESH MODULE
===================================================== */

function refreshERPModule(){

openERPRoute(
ERP_ROUTER.CURRENT_ROUTE
);

}

/* =====================================================
HOME
===================================================== */

function goERPHome(){

openERPRoute(
'dashboard'
);

}

/* =====================================================
OPEN MODULE SHORTCUT
===================================================== */

function openModule(
module
){

openERPRoute(
module
);

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeRouter();

}

);