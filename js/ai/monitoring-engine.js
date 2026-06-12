/********************************************************
 BALAJI NEXTGEN ERP
 AI MONITORING ENGINE
 FILE:
 js/ai/monitoring-engine.js
********************************************************/

/* =====================================================
MONITORING STATE
===================================================== */

const ERP_MONITOR = {

ACTIVE : true,

LOGS : [],

ERRORS : 0,

WARNINGS : 0,

API_CALLS : 0,

MODULE_LOADS : 0,

START_TIME : new Date(),

LAST_ACTIVITY : new Date()

};

/* =====================================================
INITIALIZE MONITOR
===================================================== */

function initializeERPMonitoring(){

try{

console.log(
'AI MONITORING ENGINE STARTED'
);

/* =====================================================
SYSTEM MONITOR
===================================================== */

startERPSystemMonitor();

/* =====================================================
MEMORY MONITOR
===================================================== */

startMemoryMonitor();

/* =====================================================
PERFORMANCE
===================================================== */

startPerformanceMonitor();

/* =====================================================
API MONITOR
===================================================== */

monitorAPICalls();

/* =====================================================
ERROR TRACKER
===================================================== */

monitorERPGlobalErrors();

/* =====================================================
ACTIVITY TRACKER
===================================================== */

trackERPActivityMonitor();

}catch(error){

console.log(
'MONITOR ENGINE ERROR:',
error
);

}

}

/* =====================================================
SYSTEM MONITOR
===================================================== */

function startERPSystemMonitor(){

setInterval(function(){

const data = {

time :
new Date().toISOString(),

online :
navigator.onLine,

memory :
performance.memory
?
performance.memory.usedJSHeapSize
:
0,

page :
window.location.pathname

};

ERP_MONITOR.LOGS.push(
data
);

/* =====================================================
LIMIT
===================================================== */

if(
ERP_MONITOR.LOGS.length > 100
){

ERP_MONITOR.LOGS.shift();

}

console.log(
'ERP SYSTEM STATUS:',
data
);

},30000);

}

/* =====================================================
MEMORY
===================================================== */

function startMemoryMonitor(){

setInterval(function(){

if(
performance.memory
){

const used =
Math.round(
performance.memory.usedJSHeapSize
/ 1024 / 1024
);

const total =
Math.round(
performance.memory.totalJSHeapSize
/ 1024 / 1024
);

console.log(

'MEMORY:',
used + 'MB / ' + total + 'MB'

);

/* =====================================================
HIGH MEMORY
===================================================== */

if(used > 500){

notifyWarning(
'HIGH MEMORY USAGE'
);

}

}

},60000);

}

/* =====================================================
PERFORMANCE
===================================================== */

function startPerformanceMonitor(){

window.addEventListener(

'load',

function(){

const timing =
performance.timing;

const loadTime =
timing.loadEventEnd -
timing.navigationStart;

console.log(
'PAGE LOAD TIME:',
loadTime + 'ms'
);

if(loadTime > 5000){

notifyWarning(
'SLOW PAGE LOAD DETECTED'
);

}

}

);

}

/* =====================================================
API MONITOR
===================================================== */

function monitorAPICalls(){

const originalFetch =
window.fetch;

window.fetch =
async function(...args){

ERP_MONITOR.API_CALLS++;

const start =
new Date().getTime();

try{

const response =
await originalFetch(...args);

const end =
new Date().getTime();

console.log(

'API CALL:',
args[0],
'TIME:',
(end - start) + 'ms'

);

return response;

}catch(error){

ERP_MONITOR.ERRORS++;

console.log(
'API ERROR:',
error
);

throw error;

}

};

}

/* =====================================================
GLOBAL ERRORS
===================================================== */

function monitorERPGlobalErrors(){

window.addEventListener(

'error',

function(event){

ERP_MONITOR.ERRORS++;

console.log(
'GLOBAL ERROR:',
event.message
);

notifyError(
'SYSTEM ERROR DETECTED'
);

}

);

}

/* =====================================================
ACTIVITY TRACK
===================================================== */

function trackERPActivityMonitor(){

document.addEventListener(

'click',

function(){

ERP_MONITOR.LAST_ACTIVITY =
new Date();

}

);

document.addEventListener(

'keydown',

function(){

ERP_MONITOR.LAST_ACTIVITY =
new Date();

}

);

}

/* =====================================================
SAVE LOG
===================================================== */

function saveERPMonitoringLog(
module,
status,
message
){

try{

const log = {

time :
new Date().toISOString(),

module :
module,

status :
status,

message :
message

};

ERP_MONITOR.LOGS.push(
log
);

console.log(
'ERP LOG:',
log
);

}catch(error){

console.log(error);

}

}

/* =====================================================
MODULE TRACKER
===================================================== */

function trackERPModuleLoad(
module
){

ERP_MONITOR.MODULE_LOADS++;

saveERPMonitoringLog(

module,

'SUCCESS',

'MODULE LOADED'

);

}

/* =====================================================
WARNING
===================================================== */

function trackERPWarning(
message
){

ERP_MONITOR.WARNINGS++;

saveERPMonitoringLog(

'SYSTEM',

'WARNING',

message

);

}

/* =====================================================
ERROR
===================================================== */

function trackERPError(
message
){

ERP_MONITOR.ERRORS++;

saveERPMonitoringLog(

'SYSTEM',

'ERROR',

message

);

}

/* =====================================================
HEALTH REPORT
===================================================== */

function generateERPHealthReport(){

const uptime =
Math.floor(

(
new Date() -
ERP_MONITOR.START_TIME
)
/1000/60

);

return {

uptime :

uptime + ' MINUTES',

errors :
ERP_MONITOR.ERRORS,

warnings :
ERP_MONITOR.WARNINGS,

apiCalls :
ERP_MONITOR.API_CALLS,

moduleLoads :
ERP_MONITOR.MODULE_LOADS,

online :
navigator.onLine

};

}

/* =====================================================
OPEN MONITOR PANEL
===================================================== */

function openERPMonitorPanel(){

const report =
generateERPHealthReport();

alert(

`
BALAJI NEXTGEN ERP

UPTIME:
${report.uptime}

API CALLS:
${report.apiCalls}

ERRORS:
${report.errors}

WARNINGS:
${report.warnings}

MODULE LOADS:
${report.moduleLoads}

ONLINE:
${report.online}

`

);

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPMonitoring();

}

);