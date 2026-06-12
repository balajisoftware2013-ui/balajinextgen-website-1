/********************************************************
 BALAJI NEXTGEN ERP
 LOADER ENGINE
 FILE:
 js/utilities/loader-engine.js
********************************************************/

/* =====================================================
LOADER STATE
===================================================== */

const ERP_LOADER = {

ACTIVE : false,

MESSAGE : 'Loading...',

PROGRESS : 0

};

/* =====================================================
INITIALIZE LOADER
===================================================== */

function initializeERPLoader(){

try{

createLoaderHTML();

console.log(
'LOADER ENGINE STARTED'
);

}catch(error){

console.log(
'LOADER ENGINE ERROR:',
error
);

}

}

/* =====================================================
CREATE LOADER
===================================================== */

function createLoaderHTML(){

if(
document.getElementById(
'erpLoader'
)
){

return;

}

const loader =
document.createElement(
'div'
);

loader.id =
'erpLoader';

loader.style.position =
'fixed';

loader.style.top =
'0';

loader.style.left =
'0';

loader.style.width =
'100%';

loader.style.height =
'100%';

loader.style.background =
'rgba(15,23,42,0.75)';

loader.style.backdropFilter =
'blur(8px)';

loader.style.display =
'none';

loader.style.alignItems =
'center';

loader.style.justifyContent =
'center';

loader.style.zIndex =
'999999';

/* =====================================================
HTML
===================================================== */

loader.innerHTML = `

<div
style="
width:320px;
background:white;
padding:35px;
border-radius:24px;
text-align:center;
box-shadow:0 25px 60px rgba(0,0,0,0.2);
"
>

<div
class="erp-loader-spinner"
style="
width:70px;
height:70px;
border:6px solid #e2e8f0;
border-top:6px solid #2563eb;
border-radius:50%;
margin:auto;
animation:erpSpin 1s linear infinite;
"
>
</div>

<h2
style="
margin-top:25px;
font-size:24px;
font-weight:700;
color:#0f172a;
"
>

BALAJI ERP

</h2>

<p
id="erpLoaderMessage"
style="
margin-top:12px;
font-size:15px;
color:#64748b;
"
>

Loading...

</p>

<div
style="
width:100%;
height:10px;
background:#e2e8f0;
border-radius:30px;
margin-top:25px;
overflow:hidden;
"
>

<div
id="erpLoaderProgress"
style="
width:0%;
height:100%;
background:linear-gradient(90deg,#2563eb,#3b82f6);
border-radius:30px;
transition:0.4s;
"
>
</div>

</div>

</div>

<style>

@keyframes erpSpin{

0%{
transform:rotate(0deg);
}

100%{
transform:rotate(360deg);
}

}

</style>

`;

document.body.appendChild(
loader
);

}

/* =====================================================
SHOW LOADER
===================================================== */

function showLoader(
message = 'Loading...'
){

ERP_LOADER.ACTIVE =
true;

ERP_LOADER.MESSAGE =
message;

const loader =
document.getElementById(
'erpLoader'
);

if(loader){

loader.style.display =
'flex';

}

const text =
document.getElementById(
'erpLoaderMessage'
);

if(text){

text.innerHTML =
message;

}

startLoaderProgress();

}

/* =====================================================
HIDE LOADER
===================================================== */

function hideLoader(){

ERP_LOADER.ACTIVE =
false;

ERP_LOADER.PROGRESS =
100;

updateLoaderProgress(
100
);

setTimeout(function(){

const loader =
document.getElementById(
'erpLoader'
);

if(loader){

loader.style.display =
'none';

}

updateLoaderProgress(
0
);

},400);

}

/* =====================================================
PROGRESS
===================================================== */

function updateLoaderProgress(
percent
){

const progress =
document.getElementById(
'erpLoaderProgress'
);

if(progress){

progress.style.width =
percent + '%';

}

}

/* =====================================================
AUTO PROGRESS
===================================================== */

function startLoaderProgress(){

ERP_LOADER.PROGRESS =
0;

const interval =
setInterval(function(){

if(!ERP_LOADER.ACTIVE){

clearInterval(interval);

return;

}

ERP_LOADER.PROGRESS += 10;

if(
ERP_LOADER.PROGRESS >= 90
){

clearInterval(interval);

}

updateLoaderProgress(
ERP_LOADER.PROGRESS
);

},200);

}

/* =====================================================
FULL PAGE LOADER
===================================================== */

function showFullPageLoader(){

showLoader(
'INITIALIZING ERP SYSTEM...'
);

}

/* =====================================================
MODULE LOADER
===================================================== */

function showModuleLoader(
moduleName
){

showLoader(
'LOADING ' +
moduleName.toUpperCase() +
' MODULE...'
);

}

/* =====================================================
API LOADER
===================================================== */

function showAPILoader(){

showLoader(
'CONNECTING SERVER...'
);

}

/* =====================================================
LOGIN LOADER
===================================================== */

function showLoginLoader(){

showLoader(
'AUTHENTICATING USER...'
);

}

/* =====================================================
SAVE LOADER
===================================================== */

function showSaveLoader(){

showLoader(
'SAVING DATA...'
);

}

/* =====================================================
EXPORT LOADER
===================================================== */

function showExportLoader(){

showLoader(
'EXPORTING REPORT...'
);

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPLoader();

}

);