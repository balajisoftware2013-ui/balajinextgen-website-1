/********************************************************
 BALAJI NEXTGEN ERP
 API INITIALIZER
 FILE:
 js/core/init-engine.js
********************************************************/

/* =====================================================
ERP START
===================================================== */

window.addEventListener(

'DOMContentLoaded',

async function(){

console.log(
'BALAJI NEXTGEN ERP STARTING...'
);

/* =====================================================
LOAD APIs
===================================================== */

await loadERPAPI();

/* =====================================================
CHECK LOGIN PAGE
===================================================== */

const currentPage =
window.location.pathname;

/* =====================================================
LOGIN PAGE
===================================================== */

if(

currentPage.includes(
'client-login'
)

){

console.log(
'LOGIN PAGE LOADED'
);

return;

}

/* =====================================================
CHECK SESSION
===================================================== */

checkERPSession();

/* =====================================================
LOAD USER
===================================================== */

const user =
getERPUser();

/* =====================================================
NO USER
===================================================== */

if(!user){

window.location.href =
'client-login.html';

return;

}

/* =====================================================
LOAD USER NAME
===================================================== */

const userName =
document.getElementById(
'userName'
);

if(userName){

userName.innerHTML =
user.fullName || 'ERP USER';

}

/* =====================================================
LOAD USER ROLE
===================================================== */

const userRole =
document.getElementById(
'userRole'
);

if(userRole){

userRole.innerHTML =
user.role || 'USER';

}

/* =====================================================
LOAD DASHBOARD
===================================================== */

loadDashboardModules(
user
);

console.log(
'ERP DASHBOARD READY'
);

}
);

/* =====================================================
LOAD DASHBOARD MODULES
===================================================== */

function loadDashboardModules(
user
){

try{

console.log(
'LOADING DASHBOARD MODULES...'
);

/* =====================================================
SUPER ADMIN
===================================================== */

if(
user.role === 'SUPER_ADMIN'
){

showModule(
'adminDashboard'
);

showModule(
'analyticsDashboard'
);

showModule(
'developerDashboard'
);

}

/* =====================================================
OWNER
===================================================== */

if(
user.role === 'OWNER'
){

showModule(
'ownerDashboard'
);

showModule(
'analyticsDashboard'
);

}

/* =====================================================
CASHIER
===================================================== */

if(
user.role === 'CASHIER'
){

showModule(
'posDashboard'
);

}

/* =====================================================
CHEF
===================================================== */

if(
user.role === 'CHEF'
){

showModule(
'kitchenDashboard'
);

}

/* =====================================================
DEVELOPER
===================================================== */

if(
user.role === 'DEVELOPER'
){

showModule(
'developerDashboard'
);

}

/* =====================================================
COMMON
===================================================== */

showModule(
'topbar'
);

showModule(
'sidebar'
);

}catch(error){

console.log(
'DASHBOARD LOAD ERROR:',
error
);

}

}

/* =====================================================
SHOW MODULE
===================================================== */

function showModule(
id
){

const element =
document.getElementById(id);

if(element){

element.style.display =
'block';

}

}

/* =====================================================
HIDE MODULE
===================================================== */

function hideModule(
id
){

const element =
document.getElementById(id);

if(element){

element.style.display =
'none';

}

}

/* =====================================================
LOADER
===================================================== */

function showLoader(){

const loader =
document.getElementById(
'erpLoader'
);

if(loader){

loader.style.display =
'flex';

}

}

function hideLoader(){

const loader =
document.getElementById(
'erpLoader'
);

if(loader){

loader.style.display =
'none';

}

}

/* =====================================================
MESSAGE
===================================================== */

function showMessage(
message,
type = 'success'
){

const box =
document.getElementById(
'messageBox'
);

if(!box){

alert(message);

return;

}

box.innerHTML =
message;

box.style.display =
'block';

box.className =
'message-box ' + type;

setTimeout(function(){

box.style.display =
'none';

},4000);

}