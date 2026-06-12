/********************************************************
 BALAJI NEXTGEN ERP
 BOOT ENGINE
 FILE:
 js/core/boot-engine.js
********************************************************/

/* =====================================================
BOOT STATE
===================================================== */

const ERP_BOOT = {

STARTED : false,

COMPLETED : false,

FAILED : false,

STEP : 0,

TOTAL_STEPS : 12

};

/* =====================================================
BOOT ERP
===================================================== */

async function bootERPSystem(){

try{

ERP_BOOT.STARTED =
true;

console.log(
'BOOTING BALAJI NEXTGEN ERP...'
);

/* =====================================================
BOOT SCREEN
===================================================== */

showBootScreen();

/* =====================================================
STEP 1
===================================================== */

await bootStep(

'LOADING CONFIGURATION...',

async function(){

await loadERPAPI();

}

);

/* =====================================================
STEP 2
===================================================== */

await bootStep(

'LOADING STORAGE ENGINE...',

async function(){

initializeERPStorage();

}

);

/* =====================================================
STEP 3
===================================================== */

await bootStep(

'LOADING SESSION ENGINE...',

async function(){

loadERPSession();

}

);

/* =====================================================
STEP 4
===================================================== */

await bootStep(

'LOADING THEME ENGINE...',

async function(){

initializeERPTheme();

}

);

/* =====================================================
STEP 5
===================================================== */

await bootStep(

'LOADING LAYOUT ENGINE...',

async function(){

await initializeLayout();

}

);

/* =====================================================
STEP 6
===================================================== */

await bootStep(

'LOADING SIDEBAR ENGINE...',

async function(){

initializeSidebar();

}

);

/* =====================================================
STEP 7
===================================================== */

await bootStep(

'LOADING TOPBAR ENGINE...',

async function(){

initializeTopbar();

}

);

/* =====================================================
STEP 8
===================================================== */

await bootStep(

'LOADING ROUTER ENGINE...',

async function(){

initializeRouter();

}

);

/* =====================================================
STEP 9
===================================================== */

await bootStep(

'LOADING SECURITY ENGINE...',

async function(){

initializeERPSecurity();

}

);

/* =====================================================
STEP 10
===================================================== */

await bootStep(

'LOADING REALTIME ENGINE...',

async function(){

initializeERPRealtime();

}

);

/* =====================================================
STEP 11
===================================================== */

await bootStep(

'LOADING MODULE ENGINE...',

async function(){

initializeERPModules();

}

);

/* =====================================================
STEP 12
===================================================== */

await bootStep(

'FINALIZING ERP SYSTEM...',

async function(){

initializeNotifications();

initializeERPMonitoring();

}

);

/* =====================================================
COMPLETE
===================================================== */

ERP_BOOT.COMPLETED =
true;

/* =====================================================
BOOT SUCCESS
===================================================== */

completeERPBoot();

}catch(error){

ERP_BOOT.FAILED =
true;

console.log(
'BOOT ENGINE ERROR:',
error
);

showBootError(
String(error)
);

}

}

/* =====================================================
BOOT STEP
===================================================== */

async function bootStep(
message,
callback
){

ERP_BOOT.STEP++;

updateBootMessage(
message
);

updateBootProgress();

console.log(
message
);

await callback();

await delayERPBoot(
400
);

}

/* =====================================================
BOOT SCREEN
===================================================== */

function showBootScreen(){

if(
document.getElementById(
'erpBootScreen'
)
){

return;

}

const boot =
document.createElement(
'div'
);

boot.id =
'erpBootScreen';

boot.style.position =
'fixed';

boot.style.top =
'0';

boot.style.left =
'0';

boot.style.width =
'100%';

boot.style.height =
'100%';

boot.style.background =
'linear-gradient(135deg,#0f172a,#1e293b)';

boot.style.display =
'flex';

boot.style.flexDirection =
'column';

boot.style.alignItems =
'center';

boot.style.justifyContent =
'center';

boot.style.zIndex =
'9999999';

boot.innerHTML = `

<div
style="
text-align:center;
color:white;
"
>

<h1
style="
font-size:42px;
font-weight:800;
margin-bottom:10px;
"
>

BALAJI NEXTGEN ERP

</h1>

<p
style="
font-size:18px;
opacity:0.8;
margin-bottom:40px;
"
>

Enterprise SaaS Platform

</p>

<div
style="
width:380px;
height:12px;
background:#334155;
border-radius:30px;
overflow:hidden;
margin:auto;
"
>

<div
id="erpBootProgress"
style="
width:0%;
height:100%;
background:linear-gradient(90deg,#2563eb,#3b82f6);
transition:0.4s;
"
>

</div>

</div>

<div
id="erpBootMessage"
style="
margin-top:25px;
font-size:15px;
opacity:0.9;
"
>

Starting ERP...

</div>

</div>

`;

document.body.appendChild(
boot
);

}

/* =====================================================
MESSAGE
===================================================== */

function updateBootMessage(
message
){

const box =
document.getElementById(
'erpBootMessage'
);

if(box){

box.innerHTML =
message;

}

}

/* =====================================================
PROGRESS
===================================================== */

function updateBootProgress(){

const percent =
(
ERP_BOOT.STEP /
ERP_BOOT.TOTAL_STEPS
) * 100;

const progress =
document.getElementById(
'erpBootProgress'
);

if(progress){

progress.style.width =
percent + '%';

}

}

/* =====================================================
COMPLETE
===================================================== */

function completeERPBoot(){

updateBootMessage(
'ERP SYSTEM READY'
);

updateBootProgress();

setTimeout(function(){

const boot =
document.getElementById(
'erpBootScreen'
);

if(boot){

boot.remove();

}

notifySuccess(
'BALAJI NEXTGEN ERP READY'
);

},1200);

}

/* =====================================================
ERROR
===================================================== */

function showBootError(
error
){

const box =
document.getElementById(
'erpBootMessage'
);

if(box){

box.innerHTML =
'BOOT FAILED : ' + error;

box.style.color =
'#ef4444';

}

}

/* =====================================================
DELAY
===================================================== */

function delayERPBoot(
ms
){

return new Promise(resolve =>

setTimeout(
resolve,
ms
)

);

}

/* =====================================================
AUTO START
===================================================== */

window.addEventListener(

'DOMContentLoaded',

async function(){

await bootERPSystem();

}

);