/********************************************************
 BALAJI NEXTGEN ERP
 TOPBAR ENGINE
 FILE:
 js/dashboard/topbar-engine.js
********************************************************/

/* =====================================================
TOPBAR STATE
===================================================== */

const ERP_TOPBAR = {

NOTIFICATION_COUNT : 0,

CURRENT_TIME : '',

SEARCH_ACTIVE : false

};

/* =====================================================
INITIALIZE TOPBAR
===================================================== */

function initializeTopbar(){

try{

/* =====================================================
LOAD USER
===================================================== */

const user =
getERPUser();

if(!user){

return;

}

/* =====================================================
LOAD PROFILE
===================================================== */

loadTopbarProfile(
user
);

/* =====================================================
START CLOCK
===================================================== */

startERPClock();

/* =====================================================
LOAD NOTIFICATIONS
===================================================== */

loadNotifications();

/* =====================================================
SEARCH ENGINE
===================================================== */

initializeGlobalSearch();

console.log(
'TOPBAR READY'
);

}catch(error){

console.log(
'TOPBAR ERROR:',
error
);

}

}

/* =====================================================
PROFILE
===================================================== */

function loadTopbarProfile(
user
){

const profileName =
document.getElementById(
'topbarUserName'
);

if(profileName){

profileName.innerHTML =
user.fullName || 'ERP USER';

}

const profileRole =
document.getElementById(
'topbarUserRole'
);

if(profileRole){

profileRole.innerHTML =
user.role || 'USER';

}

const profileAvatar =
document.getElementById(
'topbarAvatar'
);

if(profileAvatar){

const firstLetter =
(
user.fullName || 'U'
)
.charAt(0)
.toUpperCase();

profileAvatar.innerHTML =
firstLetter;

}

}

/* =====================================================
ERP CLOCK
===================================================== */

function startERPClock(){

updateERPClock();

setInterval(function(){

updateERPClock();

},1000);

}

/* =====================================================
UPDATE CLOCK
===================================================== */

function updateERPClock(){

const clock =
document.getElementById(
'topbarClock'
);

if(!clock){

return;

}

const now =
new Date();

clock.innerHTML =
now.toLocaleString();

}

/* =====================================================
NOTIFICATIONS
===================================================== */

function loadNotifications(){

ERP_TOPBAR.NOTIFICATION_COUNT = 5;

const badge =
document.getElementById(
'notificationCount'
);

if(badge){

badge.innerHTML =
ERP_TOPBAR.NOTIFICATION_COUNT;

}

}

/* =====================================================
OPEN NOTIFICATIONS
===================================================== */

function openNotifications(){

const panel =
document.getElementById(
'notificationPanel'
);

if(!panel){

return;

}

if(
panel.style.display === 'block'
){

panel.style.display =
'none';

return;

}

panel.style.display =
'block';

panel.innerHTML = `

<div class="erp-notification-item">

<div class="erp-notification-title">
New Sales Order
</div>

<div class="erp-notification-message">
5 new orders received.
</div>

</div>

<div class="erp-notification-item">

<div class="erp-notification-title">
Inventory Alert
</div>

<div class="erp-notification-message">
Low stock detected.
</div>

</div>

<div class="erp-notification-item">

<div class="erp-notification-title">
AI Forecast Ready
</div>

<div class="erp-notification-message">
Sales analytics generated.
</div>

</div>

`;

}

/* =====================================================
GLOBAL SEARCH
===================================================== */

function initializeGlobalSearch(){

const search =
document.getElementById(
'globalSearch'
);

if(!search){

return;

}

search.addEventListener(

'keyup',

function(event){

const value =
event.target.value
.toLowerCase();

runGlobalSearch(
value
);

}

);

}

/* =====================================================
RUN SEARCH
===================================================== */

function runGlobalSearch(
query
){

if(!query){

return;

}

console.log(
'SEARCH:',
query
);

/* =====================================================
MODULE LIST
===================================================== */

const modules = [

'dashboard',
'accounts',
'inventory',
'purchase',
'sales',
'restaurant',
'kitchen',
'pos',
'analytics',
'reports',
'hr',
'payroll',
'banking',
'ai',
'ocr',
'crm',
'users',
'settings'

];

/* =====================================================
FILTER
===================================================== */

const results =
modules.filter(module =>

module.includes(query)

);

/* =====================================================
SHOW RESULTS
===================================================== */

showSearchResults(
results
);

}

/* =====================================================
SHOW SEARCH RESULTS
===================================================== */

function showSearchResults(
results
){

const box =
document.getElementById(
'searchResults'
);

if(!box){

return;

}

if(results.length === 0){

box.style.display =
'none';

return;

}

let html = '';

results.forEach(result => {

html += `

<div
class="erp-search-item"
onclick="openERPModule('${result}')"
>

${result}

</div>

`;

});

box.innerHTML =
html;

box.style.display =
'block';

}

/* =====================================================
PROFILE DROPDOWN
===================================================== */

function toggleProfileDropdown(){

const dropdown =
document.getElementById(
'profileDropdown'
);

if(!dropdown){

return;

}

if(
dropdown.style.display === 'block'
){

dropdown.style.display =
'none';

}else{

dropdown.style.display =
'block';

}

}

/* =====================================================
FULLSCREEN
===================================================== */

function toggleFullscreen(){

if(
!document.fullscreenElement
){

document.documentElement
.requestFullscreen();

}else{

if(document.exitFullscreen){

document.exitFullscreen();

}

}

}

/* =====================================================
THEME SWITCH
===================================================== */

function toggleTheme(){

document.body.classList.toggle(
'dark-theme'
);

}

/* =====================================================
LOGOUT
===================================================== */

function logoutERPTopbar(){

logoutERP();

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeTopbar();

}

);