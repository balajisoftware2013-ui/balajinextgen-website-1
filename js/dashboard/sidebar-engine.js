/********************************************************
 BALAJI NEXTGEN ERP
 SIDEBAR ENGINE
 FILE:
 js/dashboard/sidebar-engine.js
********************************************************/

/* =====================================================
SIDEBAR STATE
===================================================== */

const ERP_SIDEBAR = {

COLLAPSED : false,

ACTIVE_MENU : 'dashboard',

MOBILE_OPEN : false

};

/* =====================================================
INITIALIZE SIDEBAR
===================================================== */

function initializeSidebar(){

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
LOAD MENUS
===================================================== */

renderSidebarMenus(
user.role
);

/* =====================================================
ACTIVATE DASHBOARD
===================================================== */

setActiveMenu(
'dashboard'
);

console.log(
'SIDEBAR READY'
);

}catch(error){

console.log(
'SIDEBAR ERROR:',
error
);

}

}

/* =====================================================
RENDER MENUS
===================================================== */

function renderSidebarMenus(
role
){

const sidebar =
document.getElementById(
'erpSidebarMenus'
);

if(!sidebar){

return;

}

/* =====================================================
BASE MENUS
===================================================== */

let menus = [

{
id:'dashboard',
title:'Dashboard',
icon:'📊'
}

];

/* =====================================================
SUPER ADMIN
===================================================== */

if(role === 'SUPER_ADMIN'){

menus.push(

{
id:'accounts',
title:'Accounts',
icon:'💰'
},

{
id:'inventory',
title:'Inventory',
icon:'📦'
},

{
id:'restaurant',
title:'Restaurant',
icon:'🍽️'
},

{
id:'purchase',
title:'Purchase',
icon:'🛒'
},

{
id:'sales',
title:'Sales',
icon:'🧾'
},

{
id:'reports',
title:'Reports',
icon:'📈'
},

{
id:'analytics',
title:'Analytics',
icon:'📊'
},

{
id:'hr',
title:'HR',
icon:'👨‍💼'
},

{
id:'payroll',
title:'Payroll',
icon:'💵'
},

{
id:'users',
title:'Users',
icon:'👥'
},

{
id:'ai',
title:'AI Automation',
icon:'🤖'
},

{
id:'settings',
title:'Settings',
icon:'⚙️'
}

);

}

/* =====================================================
OWNER
===================================================== */

if(role === 'OWNER'){

menus.push(

{
id:'restaurant',
title:'Restaurant',
icon:'🍽️'
},

{
id:'inventory',
title:'Inventory',
icon:'📦'
},

{
id:'reports',
title:'Reports',
icon:'📈'
},

{
id:'analytics',
title:'Analytics',
icon:'📊'
}

);

}

/* =====================================================
CASHIER
===================================================== */

if(role === 'CASHIER'){

menus.push(

{
id:'pos',
title:'POS Billing',
icon:'🧾'
},

{
id:'sales',
title:'Sales',
icon:'💵'
}

);

}

/* =====================================================
CHEF
===================================================== */

if(role === 'CHEF'){

menus.push(

{
id:'kitchen',
title:'Kitchen',
icon:'👨‍🍳'
}

);

}

/* =====================================================
DEVELOPER
===================================================== */

if(role === 'DEVELOPER'){

menus.push(

{
id:'developer',
title:'Developer',
icon:'💻'
},

{
id:'ai',
title:'AI Automation',
icon:'🤖'
}

);

}

/* =====================================================
GENERATE HTML
===================================================== */

let html = '';

menus.forEach(menu => {

html += `

<div
class="erp-sidebar-menu"
id="menu_${menu.id}"
onclick="openERPModule('${menu.id}')"
>

<div class="erp-menu-icon">
${menu.icon}
</div>

<div class="erp-menu-title">
${menu.title}
</div>

</div>

`;

});

sidebar.innerHTML =
html;

}

/* =====================================================
OPEN MODULE
===================================================== */

function openERPModule(
module
){

setActiveMenu(
module
);

openModule(
module
);

}

/* =====================================================
ACTIVE MENU
===================================================== */

function setActiveMenu(
module
){

ERP_SIDEBAR.ACTIVE_MENU =
module;

/* =====================================================
REMOVE OLD
===================================================== */

const allMenus =
document.querySelectorAll(
'.erp-sidebar-menu'
);

allMenus.forEach(menu => {

menu.classList.remove(
'active'
);

});

/* =====================================================
ADD ACTIVE
===================================================== */

const current =
document.getElementById(
'menu_' + module
);

if(current){

current.classList.add(
'active'
);

}

}

/* =====================================================
COLLAPSE
===================================================== */

function toggleSidebar(){

const sidebar =
document.getElementById(
'erpSidebar'
);

const content =
document.getElementById(
'erpMainContent'
);

if(!sidebar){

return;

}

ERP_SIDEBAR.COLLAPSED =
!ERP_SIDEBAR.COLLAPSED;

/* =====================================================
COLLAPSED
===================================================== */

if(ERP_SIDEBAR.COLLAPSED){

sidebar.classList.add(
'collapsed'
);

if(content){

content.classList.add(
'expanded'
);

}

}else{

sidebar.classList.remove(
'collapsed'
);

if(content){

content.classList.remove(
'expanded'
);

}

}

}

/* =====================================================
MOBILE SIDEBAR
===================================================== */

function toggleMobileSidebar(){

const sidebar =
document.getElementById(
'erpSidebar'
);

if(!sidebar){

return;

}

ERP_SIDEBAR.MOBILE_OPEN =
!ERP_SIDEBAR.MOBILE_OPEN;

if(ERP_SIDEBAR.MOBILE_OPEN){

sidebar.classList.add(
'mobile-open'
);

}else{

sidebar.classList.remove(
'mobile-open'
);

}

}

/* =====================================================
SEARCH MENU
===================================================== */

function searchSidebarMenu(){

const input =
document.getElementById(
'sidebarSearch'
);

if(!input){

return;

}

const value =
input.value.toLowerCase();

const menus =
document.querySelectorAll(
'.erp-sidebar-menu'
);

menus.forEach(menu => {

const text =
menu.innerText.toLowerCase();

if(text.includes(value)){

menu.style.display =
'flex';

}else{

menu.style.display =
'none';

}

});

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeSidebar();

}

);