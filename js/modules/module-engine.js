/********************************************************
 BALAJI NEXTGEN ERP
 MODULE ENGINE
 FILE:
 js/modules/module-engine.js
********************************************************/

/* =====================================================
MODULE STATE
===================================================== */

const ERP_MODULE = {

CURRENT_MODULE : '',

LOADED_MODULES : [],

MODULE_CACHE : {},

MODULE_LOADING : false

};

/* =====================================================
INITIALIZE MODULE ENGINE
===================================================== */

function initializeERPModules(){

try{

console.log(
'ERP MODULE ENGINE STARTED'
);

/* =====================================================
AUTO LOAD DASHBOARD
===================================================== */

openERPModule(
'dashboard'
);

}catch(error){

console.log(
'MODULE ENGINE ERROR:',
error
);

}

}

/* =====================================================
OPEN MODULE
===================================================== */

async function openERPModule(
moduleName
){

try{

/* =====================================================
STOP MULTIPLE LOAD
===================================================== */

if(ERP_MODULE.MODULE_LOADING){

return;

}

ERP_MODULE.MODULE_LOADING =
true;

/* =====================================================
SAVE CURRENT
===================================================== */

ERP_MODULE.CURRENT_MODULE =
moduleName;

/* =====================================================
LOADER
===================================================== */

showLoader();

/* =====================================================
ACTIVE MENU
===================================================== */

setActiveMenu(
moduleName
);

/* =====================================================
CONTENT BOX
===================================================== */

const content =
document.getElementById(
'dashboardContent'
);

if(!content){

hideLoader();

return;

}

/* =====================================================
MODULE URL
===================================================== */

const htmlURL =
`modules/${moduleName}/${moduleName}.html`;

const cssURL =
`modules/${moduleName}/${moduleName}.css`;

const jsURL =
`modules/${moduleName}/${moduleName}.js`;

/* =====================================================
FETCH HTML
===================================================== */

const response =
await fetch(
htmlURL
);

/* =====================================================
MODULE EXISTS
===================================================== */

if(response.ok){

const html =
await response.text();

content.innerHTML =
html;

/* =====================================================
LOAD CSS
===================================================== */

loadERPModuleCSS(
moduleName,
cssURL
);

/* =====================================================
LOAD JS
===================================================== */

await loadERPModuleJS(
moduleName,
jsURL
);

/* =====================================================
CACHE
===================================================== */

ERP_MODULE.LOADED_MODULES.push(
moduleName
);

ERP_MODULE.MODULE_CACHE[
moduleName
] = true;

/* =====================================================
SUCCESS
===================================================== */

console.log(
'MODULE LOADED:',
moduleName
);

showMessage(
moduleName.toUpperCase()
+
' MODULE LOADED',
'success'
);

}else{

/* =====================================================
FALLBACK
===================================================== */

loadERPComingSoon(
moduleName
);

}

/* =====================================================
STOP
===================================================== */

hideLoader();

ERP_MODULE.MODULE_LOADING =
false;

}catch(error){

hideLoader();

ERP_MODULE.MODULE_LOADING =
false;

console.log(
'MODULE LOAD ERROR:',
error
);

showMessage(
'MODULE LOAD FAILED',
'error'
);

}

}

/* =====================================================
LOAD CSS
===================================================== */

function loadERPModuleCSS(
moduleName,
cssURL
){

try{

const oldCSS =
document.getElementById(
'erpDynamicModuleCSS'
);

if(oldCSS){

oldCSS.remove();

}

const link =
document.createElement(
'link'
);

link.id =
'erpDynamicModuleCSS';

link.rel =
'stylesheet';

link.href =
cssURL;

document.head.appendChild(
link
);

console.log(
'MODULE CSS LOADED:',
moduleName
);

}catch(error){

console.log(
'CSS LOAD ERROR:',
error
);

}

}

/* =====================================================
LOAD JS
===================================================== */

async function loadERPModuleJS(
moduleName,
jsURL
){

return new Promise((resolve) => {

try{

const oldJS =
document.getElementById(
'erpDynamicModuleJS'
);

if(oldJS){

oldJS.remove();

}

const script =
document.createElement(
'script'
);

script.id =
'erpDynamicModuleJS';

script.src =
jsURL;

script.onload =
function(){

console.log(
'MODULE JS LOADED:',
moduleName
);

resolve();

};

script.onerror =
function(){

console.log(
'MODULE JS ERROR:',
moduleName
);

resolve();

};

document.body.appendChild(
script
);

}catch(error){

console.log(error);

resolve();

}

});

}

/* =====================================================
COMING SOON
===================================================== */

function loadERPComingSoon(
moduleName
){

const content =
document.getElementById(
'dashboardContent'
);

if(!content){

return;

}

content.innerHTML = `

<div class="erp-coming-soon">

<div class="erp-coming-icon">
🚀
</div>

<h1>
${moduleName.toUpperCase()}
</h1>

<p>
BALAJI NEXTGEN ERP MODULE
</p>

<p>
This module is currently under development.
</p>

<button
class="erp-btn"
onclick="openERPModule('dashboard')"
>

Back To Dashboard

</button>

</div>

`;

}

/* =====================================================
RELOAD MODULE
===================================================== */

function reloadERPModule(){

if(
ERP_MODULE.CURRENT_MODULE
){

openERPModule(
ERP_MODULE.CURRENT_MODULE
);

}

}

/* =====================================================
CLEAR CACHE
===================================================== */

function clearERPModuleCache(){

ERP_MODULE.MODULE_CACHE = {};

ERP_MODULE.LOADED_MODULES = [];

console.log(
'MODULE CACHE CLEARED'
);

}

/* =====================================================
GET CURRENT
===================================================== */

function getCurrentERPModule(){

return ERP_MODULE.CURRENT_MODULE;

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPModules();

}

);