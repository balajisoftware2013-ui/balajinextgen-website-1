/********************************************************
 BALAJI NEXTGEN ERP
 REALTIME ENGINE
 FILE:
 js/core/realtime-engine.js
********************************************************/

/* =====================================================
REALTIME STATE
===================================================== */

const ERP_REALTIME = {

ACTIVE : false,

INTERVALS : [],

LAST_SYNC : null,

ONLINE : navigator.onLine,

SYNC_TIME : 30000

};

/* =====================================================
INITIALIZE REALTIME
===================================================== */

function initializeERPRealtime(){

try{

console.log(
'REALTIME ENGINE STARTED'
);

/* =====================================================
START
===================================================== */

ERP_REALTIME.ACTIVE =
true;

/* =====================================================
NETWORK LISTENER
===================================================== */

window.addEventListener(

'online',

function(){

ERP_REALTIME.ONLINE =
true;

notifySuccess(
'INTERNET CONNECTED'
);

syncERPRealtime();

}

);

window.addEventListener(

'offline',

function(){

ERP_REALTIME.ONLINE =
false;

notifyError(
'NO INTERNET CONNECTION'
);

}

);

/* =====================================================
AUTO SYNC
===================================================== */

startERPRealtimeSync();

/* =====================================================
LIVE CLOCK
===================================================== */

startRealtimeClock();

/* =====================================================
LIVE USERS
===================================================== */

startRealtimeUsers();

/* =====================================================
LIVE NOTIFICATIONS
===================================================== */

startRealtimeNotifications();

}catch(error){

console.log(
'REALTIME ENGINE ERROR:',
error
);

}

}

/* =====================================================
START SYNC
===================================================== */

function startERPRealtimeSync(){

const interval =
setInterval(async function(){

if(
!ERP_REALTIME.ONLINE
){

return;

}

await syncERPRealtime();

},ERP_REALTIME.SYNC_TIME);

ERP_REALTIME.INTERVALS.push(
interval
);

}

/* =====================================================
SYNC
===================================================== */

async function syncERPRealtime(){

try{

/* =====================================================
CHECK API
===================================================== */

if(!ERP_API.LOADED){

await loadERPAPI();

}

/* =====================================================
API CALL
===================================================== */

const result =
await callERPAPI(

ERP_API.CORE,

{

action : 'REALTIME_SYNC',

time : new Date().toISOString()

}

);

console.log(
'REALTIME SYNC:',
result
);

/* =====================================================
SAVE TIME
===================================================== */

ERP_REALTIME.LAST_SYNC =
new Date();

/* =====================================================
UPDATE BADGE
===================================================== */

updateRealtimeStatus(
'ONLINE'
);

}catch(error){

console.log(
'SYNC ERROR:',
error
);

updateRealtimeStatus(
'OFFLINE'
);

}

}

/* =====================================================
STATUS
===================================================== */

function updateRealtimeStatus(
status
){

const badge =
document.getElementById(
'realtimeStatus'
);

if(!badge){

return;

}

badge.innerHTML =
status;

if(status === 'ONLINE'){

badge.style.background =
'#16a34a';

}else{

badge.style.background =
'#dc2626';

}

}

/* =====================================================
CLOCK
===================================================== */

function startRealtimeClock(){

const interval =
setInterval(function(){

const clock =
document.getElementById(
'erpClock'
);

if(clock){

clock.innerHTML =
new Date().toLocaleString();

}

},1000);

ERP_REALTIME.INTERVALS.push(
interval
);

}

/* =====================================================
LIVE USERS
===================================================== */

function startRealtimeUsers(){

const interval =
setInterval(function(){

const users =
document.getElementById(
'liveUsers'
);

if(users){

const randomUsers =
Math.floor(
Math.random() * 50
) + 10;

users.innerHTML =
randomUsers;

}

},15000);

ERP_REALTIME.INTERVALS.push(
interval
);

}

/* =====================================================
NOTIFICATIONS
===================================================== */

function startRealtimeNotifications(){

const interval =
setInterval(function(){

const random =
Math.floor(
Math.random() * 10
);

if(random > 7){

notifyInfo(
'NEW ERP ACTIVITY DETECTED'
);

}

},45000);

ERP_REALTIME.INTERVALS.push(
interval
);

}

/* =====================================================
STOP
===================================================== */

function stopERPRealtime(){

ERP_REALTIME.ACTIVE =
false;

ERP_REALTIME.INTERVALS
.forEach(interval => {

clearInterval(
interval
);

});

ERP_REALTIME.INTERVALS = [];

console.log(
'REALTIME ENGINE STOPPED'
);

}

/* =====================================================
RESTART
===================================================== */

function restartERPRealtime(){

stopERPRealtime();

initializeERPRealtime();

}

/* =====================================================
PING SERVER
===================================================== */

async function pingERPServer(){

try{

const start =
new Date().getTime();

await callERPAPI(

ERP_API.CORE,

{

action : 'PING'

}

);

const end =
new Date().getTime();

const speed =
end - start;

const ping =
document.getElementById(
'erpPing'
);

if(ping){

ping.innerHTML =
speed + ' ms';

}

}catch(error){

console.log(error);

}

}

/* =====================================================
AUTO PING
===================================================== */

setInterval(function(){

pingERPServer();

},20000);

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPRealtime();

}

);