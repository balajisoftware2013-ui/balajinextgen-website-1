/********************************************************
 BALAJI NEXTGEN ERP
 LAYOUT ENGINE
 FILE:
 js/core/layout-engine.js
********************************************************/

/* =====================================================
LAYOUT STATE
===================================================== */

const ERP_LAYOUT = {

SIDEBAR_LOADED : false,

TOPBAR_LOADED : false,

FOOTER_LOADED : false,

LAYOUT_READY : false

};

/* =====================================================
INITIALIZE LAYOUT
===================================================== */

async function initializeLayout(){

try{

showLoader();

console.log(
'INITIALIZING ERP LAYOUT...'
);

/* =====================================================
LOAD SIDEBAR
===================================================== */

await loadSidebarLayout();

/* =====================================================
LOAD TOPBAR
===================================================== */

await loadTopbarLayout();

/* =====================================================
LOAD FOOTER
===================================================== */

await loadFooterLayout();

/* =====================================================
COMPLETE
===================================================== */

ERP_LAYOUT.LAYOUT_READY =
true;

hideLoader();

console.log(
'ERP LAYOUT READY'
);

}catch(error){

hideLoader();

console.log(
'LAYOUT ENGINE ERROR:',
error
);

showMessage(
'LAYOUT LOAD FAILED',
'error'
);

}

}

/* =====================================================
LOAD SIDEBAR
===================================================== */

async function loadSidebarLayout(){

try{

const container =
document.getElementById(
'erpSidebar'
);

if(!container){

return;

}

const response =
await fetch(
'layouts/dashboard-layout/sidebar.html'
);

if(!response.ok){

throw new Error(
'SIDEBAR NOT FOUND'
);

}

const html =
await response.text();

container.innerHTML =
html;

ERP_LAYOUT.SIDEBAR_LOADED =
true;

console.log(
'SIDEBAR LOADED'
);

}catch(error){

console.log(
'SIDEBAR ERROR:',
error
);

loadDefaultSidebar();

}

}

/* =====================================================
DEFAULT SIDEBAR
===================================================== */

function loadDefaultSidebar(){

const container =
document.getElementById(
'erpSidebar'
);

if(!container){

return;

}

container.innerHTML = `

<div class="erp-default-sidebar">

<div class="erp-logo">

<h1>
BALAJI ERP
</h1>

</div>

<div id="erpSidebarMenus">

</div>

</div>

`;

}

/* =====================================================
LOAD TOPBAR
===================================================== */

async function loadTopbarLayout(){

try{

const container =
document.getElementById(
'erpTopbar'
);

if(!container){

return;

}

const response =
await fetch(
'layouts/dashboard-layout/topbar.html'
);

if(!response.ok){

throw new Error(
'TOPBAR NOT FOUND'
);

}

const html =
await response.text();

container.innerHTML =
html;

ERP_LAYOUT.TOPBAR_LOADED =
true;

console.log(
'TOPBAR LOADED'
);

}catch(error){

console.log(
'TOPBAR ERROR:',
error
);

loadDefaultTopbar();

}

}

/* =====================================================
DEFAULT TOPBAR
===================================================== */

function loadDefaultTopbar(){

const container =
document.getElementById(
'erpTopbar'
);

if(!container){

return;

}

container.innerHTML = `

<div class="erp-default-topbar">

<div class="erp-left-topbar">

<button
onclick="toggleSidebar()"
class="erp-menu-toggle"
>

☰

</button>

<h2>
BALAJI NEXTGEN ERP
</h2>

</div>

<div class="erp-right-topbar">

<div id="topbarClock">

</div>

<div id="topbarUserName">

ERP USER

</div>

</div>

</div>

`;

}

/* =====================================================
LOAD FOOTER
===================================================== */

async function loadFooterLayout(){

try{

const container =
document.getElementById(
'erpFooter'
);

if(!container){

return;

}

const response =
await fetch(
'layouts/dashboard-layout/footer.html'
);

if(!response.ok){

throw new Error(
'FOOTER NOT FOUND'
);

}

const html =
await response.text();

container.innerHTML =
html;

ERP_LAYOUT.FOOTER_LOADED =
true;

console.log(
'FOOTER LOADED'
);

}catch(error){

console.log(
'FOOTER ERROR:',
error
);

loadDefaultFooter();

}

}

/* =====================================================
DEFAULT FOOTER
===================================================== */

function loadDefaultFooter(){

const container =
document.getElementById(
'erpFooter'
);

if(!container){

return;

}

container.innerHTML = `

<div class="erp-default-footer">

© 2026 BALAJI NEXTGEN ERP

</div>

`;

}

/* =====================================================
FULLSCREEN
===================================================== */

function enableERPFullscreen(){

if(
!document.fullscreenElement
){

document.documentElement
.requestFullscreen();

}

}

/* =====================================================
EXIT FULLSCREEN
===================================================== */

function exitERPFullscreen(){

if(document.exitFullscreen){

document.exitFullscreen();

}

}

/* =====================================================
MOBILE CHECK
===================================================== */

function isMobileERP(){

return window.innerWidth < 768;

}

/* =====================================================
DESKTOP CHECK
===================================================== */

function isDesktopERP(){

return window.innerWidth >= 768;

}

/* =====================================================
RESPONSIVE
===================================================== */

window.addEventListener(

'resize',

function(){

if(isMobileERP()){

document.body.classList.add(
'erp-mobile'
);

}else{

document.body.classList.remove(
'erp-mobile'
);

}

}

);

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeLayout();

}

);