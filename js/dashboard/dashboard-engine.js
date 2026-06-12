/********************************************************
 BALAJI NEXTGEN ERP
 DASHBOARD ENGINE
 FILE:
 js/dashboard/dashboard-engine.js
********************************************************/

/* =====================================================
GLOBAL DASHBOARD
===================================================== */

const ERP_DASHBOARD = {

CURRENT_MODULE : '',

CURRENT_USER : null,

CURRENT_ROLE : '',

CURRENT_BRANCH : '',

CURRENT_COMPANY : ''

};

/* =====================================================
LOAD DASHBOARD
===================================================== */

async function initializeDashboard(){

try{

/* =====================================================
CHECK SESSION
===================================================== */

checkERPSession();

/* =====================================================
GET USER
===================================================== */

const user =
getERPUser();

if(!user){

window.location.href =
'client-login.html';

return;

}

/* =====================================================
SAVE USER
===================================================== */

ERP_DASHBOARD.CURRENT_USER =
user;

ERP_DASHBOARD.CURRENT_ROLE =
user.role || 'USER';

/* =====================================================
LOAD HEADER
===================================================== */

loadDashboardHeader(
user
);

/* =====================================================
LOAD SIDEBAR
===================================================== */

loadSidebarMenus(
user.role
);

/* =====================================================
LOAD HOME
===================================================== */

loadDashboardHome();

/* =====================================================
LOAD ANALYTICS
===================================================== */

loadRealtimeAnalytics();

/* =====================================================
WELCOME
===================================================== */

showMessage(

'WELCOME ' +
(user.fullName || 'ERP USER'),

'success'

);

console.log(
'DASHBOARD READY'
);

}catch(error){

console.log(
'DASHBOARD ERROR:',
error
);

showMessage(
'DASHBOARD LOAD FAILED',
'error'
);

}

}

/* =====================================================
HEADER
===================================================== */

function loadDashboardHeader(
user
){

const userName =
document.getElementById(
'userName'
);

if(userName){

userName.innerHTML =
user.fullName || 'ERP USER';

}

const userRole =
document.getElementById(
'userRole'
);

if(userRole){

userRole.innerHTML =
user.role || 'USER';

}

const userEmail =
document.getElementById(
'userEmail'
);

if(userEmail){

userEmail.innerHTML =
user.email || '';

}

}

/* =====================================================
SIDEBAR MENUS
===================================================== */

function loadSidebarMenus(
role
){

/* =====================================================
ALL MENUS
===================================================== */

hideAllMenus();

/* =====================================================
SUPER ADMIN
===================================================== */

if(role === 'SUPER_ADMIN'){

showMenu('menu_dashboard');
showMenu('menu_accounts');
showMenu('menu_inventory');
showMenu('menu_restaurant');
showMenu('menu_hr');
showMenu('menu_payroll');
showMenu('menu_reports');
showMenu('menu_ai');
showMenu('menu_settings');
showMenu('menu_users');
showMenu('menu_developer');

}

/* =====================================================
OWNER
===================================================== */

if(role === 'OWNER'){

showMenu('menu_dashboard');
showMenu('menu_inventory');
showMenu('menu_restaurant');
showMenu('menu_reports');
showMenu('menu_ai');

}

/* =====================================================
CASHIER
===================================================== */

if(role === 'CASHIER'){

showMenu('menu_dashboard');
showMenu('menu_pos');
showMenu('menu_sales');

}

/* =====================================================
CHEF
===================================================== */

if(role === 'CHEF'){

showMenu('menu_dashboard');
showMenu('menu_kitchen');

}

/* =====================================================
DEVELOPER
===================================================== */

if(role === 'DEVELOPER'){

showMenu('menu_dashboard');
showMenu('menu_developer');
showMenu('menu_ai');

}

}

/* =====================================================
SHOW MENU
===================================================== */

function showMenu(
id
){

const menu =
document.getElementById(id);

if(menu){

menu.style.display =
'flex';

}

}

/* =====================================================
HIDE ALL MENUS
===================================================== */

function hideAllMenus(){

const menus =
document.querySelectorAll(
'.erp-menu'
);

menus.forEach(menu => {

menu.style.display =
'none';

});

}

/* =====================================================
HOME
===================================================== */

function loadDashboardHome(){

const dashboard =
document.getElementById(
'dashboardContent'
);

if(!dashboard){

return;

}

dashboard.innerHTML = `

<div class="erp-dashboard-grid">

<div class="erp-card">

<h2>Total Sales</h2>

<h1>₹ 2,45,000</h1>

<p>Today's Sales</p>

</div>

<div class="erp-card">

<h2>Total Orders</h2>

<h1>125</h1>

<p>Today's Orders</p>

</div>

<div class="erp-card">

<h2>Inventory Items</h2>

<h1>3,245</h1>

<p>Stock Available</p>

</div>

<div class="erp-card">

<h2>Active Users</h2>

<h1>42</h1>

<p>Online Users</p>

</div>

</div>

`;

}

/* =====================================================
REALTIME ANALYTICS
===================================================== */

function loadRealtimeAnalytics(){

console.log(
'REALTIME ANALYTICS STARTED'
);

setInterval(function(){

updateDashboardClock();

},1000);

}

/* =====================================================
CLOCK
===================================================== */

function updateDashboardClock(){

const clock =
document.getElementById(
'erpClock'
);

if(clock){

clock.innerHTML =
new Date().toLocaleString();

}

}

/* =====================================================
MODULE LOADER
===================================================== */

function openModule(
moduleName
){

ERP_DASHBOARD.CURRENT_MODULE =
moduleName;

console.log(
'OPEN MODULE:',
moduleName
);

const dashboard =
document.getElementById(
'dashboardContent'
);

if(!dashboard){

return;

}

dashboard.innerHTML = `

<div class="erp-module-page">

<h1>${moduleName}</h1>

<p>
BALAJI NEXTGEN ERP MODULE
</p>

</div>

`;

}

/* =====================================================
LOGOUT
===================================================== */

function logoutERPSystem(){

localStorage.clear();

window.location.href =
'client-login.html';

}

/* =====================================================
AUTO START
===================================================== */

window.addEventListener(

'load',

function(){

initializeDashboard();

}

);