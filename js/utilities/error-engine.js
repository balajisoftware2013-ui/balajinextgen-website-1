/********************************************************
 BALAJI NEXTGEN ERP
 ERROR ENGINE
 FILE:
 js/utilities/error-engine.js
********************************************************/

/* =====================================================
ERROR STATE
===================================================== */

const ERP_ERROR = {

LIST : [],

TOTAL : 0,

LAST_ERROR : null

};

/* =====================================================
INITIALIZE ERROR ENGINE
===================================================== */

function initializeERPErrorEngine(){

try{

console.log(
'ERROR ENGINE STARTED'
);

/* =====================================================
GLOBAL JS ERROR
===================================================== */

window.onerror = function(

message,
source,
line,
column,
error

){

captureERPError({

type : 'JAVASCRIPT',

message : message,

source : source,

line : line,

column : column,

error : error

});

};

/* =====================================================
PROMISE ERROR
===================================================== */

window.addEventListener(

'unhandledrejection',

function(event){

captureERPError({

type : 'PROMISE',

message : event.reason

});

}

);

}catch(error){

console.log(error);

}

}

/* =====================================================
CAPTURE ERROR
===================================================== */

function captureERPError(
data
){

try{

ERP_ERROR.TOTAL++;

ERP_ERROR.LAST_ERROR =
data;

/* =====================================================
TIMESTAMP
===================================================== */

data.timestamp =
new Date().toISOString();

/* =====================================================
SAVE
===================================================== */

ERP_ERROR.LIST.push(
data
);

/* =====================================================
LIMIT
===================================================== */

if(
ERP_ERROR.LIST.length > 100
){

ERP_ERROR.LIST.shift();

}

/* =====================================================
CONSOLE
===================================================== */

console.error(
'ERP ERROR:',
data
);

/* =====================================================
NOTIFICATION
===================================================== */

notifyError(
data.message || 'SYSTEM ERROR'
);

/* =====================================================
SAVE STORAGE
===================================================== */

localStorage.setItem(

'ERP_ERROR_LOGS',

JSON.stringify(
ERP_ERROR.LIST
)

);

}catch(error){

console.log(error);

}

}

/* =====================================================
API ERROR
===================================================== */

function handleERPAPIError(
error
){

captureERPError({

type : 'API',

message :
error.message || 'API ERROR',

error : error

});

}

/* =====================================================
MODULE ERROR
===================================================== */

function handleERPModuleError(
module,
error
){

captureERPError({

type : 'MODULE',

module : module,

message :
error.message || 'MODULE ERROR',

error : error

});

}

/* =====================================================
AUTH ERROR
===================================================== */

function handleERPAuthError(
error
){

captureERPError({

type : 'AUTH',

message :
error.message || 'AUTH ERROR',

error : error

});

}

/* =====================================================
NETWORK ERROR
===================================================== */

function handleERPNetworkError(
error
){

captureERPError({

type : 'NETWORK',

message :
'NETWORK CONNECTION FAILED',

error : error

});

}

/* =====================================================
SHOW ERROR PANEL
===================================================== */

function openERPErrorPanel(){

let panel =
document.getElementById(
'erpErrorPanel'
);

if(!panel){

panel =
document.createElement(
'div'
);

panel.id =
'erpErrorPanel';

panel.style.position =
'fixed';

panel.style.top =
'80px';

panel.style.right =
'20px';

panel.style.width =
'420px';

panel.style.maxHeight =
'600px';

panel.style.overflow =
'auto';

panel.style.background =
'#ffffff';

panel.style.borderRadius =
'20px';

panel.style.padding =
'20px';

panel.style.boxShadow =
'0 20px 60px rgba(0,0,0,0.2)';

panel.style.zIndex =
'999999';

document.body.appendChild(
panel
);

}

/* =====================================================
HTML
===================================================== */

let html = `

<h2
style="
font-size:22px;
font-weight:700;
margin-bottom:20px;
"
>

ERP Error Logs

</h2>

`;

ERP_ERROR.LIST
.reverse()
.forEach(error => {

html += `

<div
style="
padding:15px;
margin-bottom:15px;
background:#f8fafc;
border-radius:15px;
border-left:5px solid #ef4444;
"
>

<div
style="
font-weight:700;
color:#dc2626;
margin-bottom:8px;
"
>

${error.type}

</div>

<div
style="
font-size:14px;
color:#334155;
line-height:22px;
"
>

${error.message}

</div>

<div
style="
margin-top:10px;
font-size:12px;
color:#64748b;
"
>

${error.timestamp}

</div>

</div>

`;

});

html += `

<button
onclick="closeERPErrorPanel()"
class="erp-btn"
style="
width:100%;
margin-top:10px;
"
>

Close

</button>

`;

panel.innerHTML =
html;

panel.style.display =
'block';

}

/* =====================================================
CLOSE PANEL
===================================================== */

function closeERPErrorPanel(){

const panel =
document.getElementById(
'erpErrorPanel'
);

if(panel){

panel.style.display =
'none';

}

}

/* =====================================================
CLEAR LOGS
===================================================== */

function clearERPErrorLogs(){

ERP_ERROR.LIST = [];

ERP_ERROR.TOTAL = 0;

ERP_ERROR.LAST_ERROR = null;

localStorage.removeItem(
'ERP_ERROR_LOGS'
);

notifySuccess(
'ERROR LOGS CLEARED'
);

}

/* =====================================================
EXPORT LOGS
===================================================== */

function exportERPErrorLogs(){

try{

const blob =
new Blob(

[
JSON.stringify(
ERP_ERROR.LIST,
null,
2
)
],

{
type:'application/json'
}

);

const url =
URL.createObjectURL(
blob
);

const a =
document.createElement(
'a'
);

a.href =
url;

a.download =
'ERP_ERROR_LOGS.json';

a.click();

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

initializeERPErrorEngine();

}

);