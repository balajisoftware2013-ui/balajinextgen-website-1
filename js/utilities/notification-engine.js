/********************************************************
 BALAJI NEXTGEN ERP
 NOTIFICATION ENGINE
 FILE:
 js/utilities/notification-engine.js
********************************************************/

/* =====================================================
NOTIFICATION STATE
===================================================== */

const ERP_NOTIFICATION = {

LIST : [],

COUNT : 0,

SOUND : true,

POSITION : 'top-right'

};

/* =====================================================
INITIALIZE
===================================================== */

function initializeNotifications(){

try{

console.log(
'NOTIFICATION ENGINE STARTED'
);

/* =====================================================
CREATE CONTAINER
===================================================== */

createNotificationContainer();

/* =====================================================
LOAD DEMO
===================================================== */

loadStartupNotifications();

}catch(error){

console.log(
'NOTIFICATION ENGINE ERROR:',
error
);

}

}

/* =====================================================
CONTAINER
===================================================== */

function createNotificationContainer(){

if(
document.getElementById(
'erpNotificationContainer'
)
){

return;

}

const container =
document.createElement(
'div'
);

container.id =
'erpNotificationContainer';

container.style.position =
'fixed';

container.style.top =
'20px';

container.style.right =
'20px';

container.style.zIndex =
'999999';

container.style.display =
'flex';

container.style.flexDirection =
'column';

container.style.gap =
'12px';

document.body.appendChild(
container
);

}

/* =====================================================
SHOW NOTIFICATION
===================================================== */

function showERPNotification(
title,
message,
type = 'success'
){

try{

/* =====================================================
COUNT
===================================================== */

ERP_NOTIFICATION.COUNT++;

/* =====================================================
CONTAINER
===================================================== */

const container =
document.getElementById(
'erpNotificationContainer'
);

if(!container){

return;

}

/* =====================================================
CARD
===================================================== */

const card =
document.createElement(
'div'
);

card.className =
'erp-notification-card';

/* =====================================================
STYLE
===================================================== */

card.style.minWidth =
'320px';

card.style.maxWidth =
'400px';

card.style.padding =
'18px';

card.style.borderRadius =
'18px';

card.style.color =
'#ffffff';

card.style.fontFamily =
'Poppins,sans-serif';

card.style.boxShadow =
'0 15px 40px rgba(0,0,0,0.15)';

card.style.animation =
'fadeIn 0.3s ease';

card.style.cursor =
'pointer';

/* =====================================================
TYPE COLORS
===================================================== */

if(type === 'success'){

card.style.background =
'linear-gradient(135deg,#16a34a,#22c55e)';

}

if(type === 'error'){

card.style.background =
'linear-gradient(135deg,#dc2626,#ef4444)';

}

if(type === 'warning'){

card.style.background =
'linear-gradient(135deg,#d97706,#f59e0b)';

}

if(type === 'info'){

card.style.background =
'linear-gradient(135deg,#2563eb,#3b82f6)';

}

/* =====================================================
HTML
===================================================== */

card.innerHTML = `

<div
style="
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:10px;
"
>

<div
style="
font-size:17px;
font-weight:700;
"
>

${title}

</div>

<div
onclick="this.parentElement.parentElement.remove()"
style="
font-size:18px;
font-weight:700;
cursor:pointer;
"
>

×

</div>

</div>

<div
style="
font-size:14px;
line-height:24px;
"
>

${message}

</div>

`;

/* =====================================================
ADD
===================================================== */

container.appendChild(
card
);

/* =====================================================
AUTO REMOVE
===================================================== */

setTimeout(function(){

if(card){

card.remove();

}

},5000);

/* =====================================================
PLAY SOUND
===================================================== */

if(ERP_NOTIFICATION.SOUND){

playNotificationSound();

}

/* =====================================================
BADGE
===================================================== */

updateNotificationBadge();

}catch(error){

console.log(
'NOTIFICATION ERROR:',
error
);

}

}

/* =====================================================
BADGE
===================================================== */

function updateNotificationBadge(){

const badge =
document.getElementById(
'notificationCount'
);

if(badge){

badge.innerHTML =
ERP_NOTIFICATION.COUNT;

}

}

/* =====================================================
SOUND
===================================================== */

function playNotificationSound(){

try{

const audio =
new Audio(
'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
);

audio.volume =
0.3;

audio.play();

}catch(error){

console.log(error);

}

}

/* =====================================================
STARTUP
===================================================== */

function loadStartupNotifications(){

setTimeout(function(){

showERPNotification(

'ERP SYSTEM',

'BALAJI NEXTGEN ERP STARTED',

'success'

);

},1000);

setTimeout(function(){

showERPNotification(

'API ENGINE',

'ALL APIS CONNECTED',

'info'

);

},2500);

}

/* =====================================================
SUCCESS
===================================================== */

function notifySuccess(
message
){

showERPNotification(
'SUCCESS',
message,
'success'
);

}

/* =====================================================
ERROR
===================================================== */

function notifyError(
message
){

showERPNotification(
'ERROR',
message,
'error'
);

}

/* =====================================================
WARNING
===================================================== */

function notifyWarning(
message
){

showERPNotification(
'WARNING',
message,
'warning'
);

}

/* =====================================================
INFO
===================================================== */

function notifyInfo(
message
){

showERPNotification(
'INFO',
message,
'info'
);

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeNotifications();

}

);