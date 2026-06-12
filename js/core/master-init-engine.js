/********************************************************
 BALAJI NEXTGEN ERP
 MASTER INIT ENGINE
 FILE:
 js/core/master-init-engine.js
********************************************************/

/* =====================================================
MASTER STATE
===================================================== */

const ERP_MASTER = {

READY : false,

MODULES : [],

START_TIME : new Date(),

VERSION : 'V2',

SYSTEM_NAME : 'BALAJI NEXTGEN ERP'

};

/* =====================================================
START ERP SYSTEM
===================================================== */

async function startERPSystem(){

try{

console.log(
'STARTING BALAJI NEXTGEN ERP...'
);

/* =====================================================
FULL LOADER
===================================================== */

showFullPageLoader();

/* =====================================================
LOAD API ENGINE
===================================================== */

await loadERPAPI();

ERP_MASTER.MODULES.push(
'API_ENGINE'
);

/* =====================================================
SESSION
===================================================== */

loadERPSession();

ERP_MASTER.MODULES.push(
'SESSION_ENGINE'
);

/* =====================================================
STORAGE
===================================================== */

initializeERPStorage();

ERP_MASTER.MODULES.push(
'STORAGE_ENGINE'
);

/* =====================================================
THEME
===================================================== */

initializeERPTheme();

ERP_MASTER.MODULES.push(
'THEME_ENGINE'
);

/* =====================================================
LAYOUT
===================================================== */

await initializeLayout();

ERP_MASTER.MODULES.push(
'LAYOUT_ENGINE'
);

/* =====================================================
SIDEBAR
===================================================== */

initializeSidebar();

ERP_MASTER.MODULES.push(
'SIDEBAR_ENGINE'
);

/* =====================================================
TOPBAR
===================================================== */

initializeTopbar();

ERP_MASTER.MODULES.push(
'TOPBAR_ENGINE'
);

/* =====================================================
ROUTER
===================================================== */

initializeRouter();

ERP_MASTER.MODULES.push(
'ROUTER_ENGINE'
);

/* =====================================================
MODULE ENGINE
===================================================== */

initializeERPModules();

ERP_MASTER.MODULES.push(
'MODULE_ENGINE'
);

/* =====================================================
NOTIFICATION
===================================================== */

initializeNotifications();

ERP_MASTER.MODULES.push(
'NOTIFICATION_ENGINE'
);

/* =====================================================
ERROR ENGINE
===================================================== */

initializeERPErrorEngine();

ERP_MASTER.MODULES.push(
'ERROR_ENGINE'
);

/* =====================================================
REALTIME
===================================================== */

initializeERPRealtime();

ERP_MASTER.MODULES.push(
'REALTIME_ENGINE'
);

/* =====================================================
SECURITY
===================================================== */

initializeERPSecurity();

ERP_MASTER.MODULES.push(
'SECURITY_ENGINE'
);

/* =====================================================
MONITORING
===================================================== */

initializeERPMonitoring();

ERP_MASTER.MODULES.push(
'MONITORING_ENGINE'
);

/* =====================================================
AUTH
===================================================== */

if(
window.location.pathname.includes(
'client-login'
)
){

initializeERPAuth();

ERP_MASTER.MODULES.push(
'AUTH_ENGINE'
);

}

/* =====================================================
READY
===================================================== */

ERP_MASTER.READY =
true;

/* =====================================================
STOP LOADER
===================================================== */

hideLoader();

/* =====================================================
SUCCESS
===================================================== */

notifySuccess(
'BALAJI NEXTGEN ERP READY'
);

console.log(
'ERP SYSTEM READY'
);

console.log(
'LOADED MODULES:',
ERP_MASTER.MODULES
);

}catch(error){

hideLoader();

console.log(
'MASTER INIT ERROR:',
error
);

notifyError(
'ERP SYSTEM START FAILED'
);

captureERPError({

type : 'MASTER_INIT',

message : String(error)

});

}

}

/* =====================================================
SYSTEM INFO
===================================================== */

function getERPSystemInfo(){

return {

name :
ERP_MASTER.SYSTEM_NAME,

version :
ERP_MASTER.VERSION,

ready :
ERP_MASTER.READY,

modules :
ERP_MASTER.MODULES,

startTime :
ERP_MASTER.START_TIME,

online :
navigator.onLine,

userAgent :
navigator.userAgent

};

}

/* =====================================================
SYSTEM STATUS PANEL
===================================================== */

function openERPSystemStatus(){

const info =
getERPSystemInfo();

alert(

`
${info.name}

VERSION:
${info.version}

READY:
${info.ready}

MODULES:
${info.modules.length}

ONLINE:
${info.online}

START:
${info.startTime}

`

);

}

/* =====================================================
RESTART ERP
===================================================== */

function restartERPSystem(){

notifyWarning(
'RESTARTING ERP SYSTEM'
);

setTimeout(function(){

window.location.reload();

},1500);

}

/* =====================================================
AUTO START
===================================================== */

window.addEventListener(

'load',

async function(){

await startERPSystem();

}

);