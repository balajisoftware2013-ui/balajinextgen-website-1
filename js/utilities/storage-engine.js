/********************************************************
 BALAJI NEXTGEN ERP
 STORAGE ENGINE
 FILE:
 js/utilities/storage-engine.js
********************************************************/

/* =====================================================
STORAGE STATE
===================================================== */

const ERP_STORAGE = {

PREFIX : 'BALAJI_ERP_',

VERSION : 'V2',

ENCRYPTION : false

};

/* =====================================================
INITIALIZE STORAGE
===================================================== */

function initializeERPStorage(){

try{

console.log(
'STORAGE ENGINE STARTED'
);

/* =====================================================
CHECK STORAGE
===================================================== */

if(
typeof(Storage) === 'undefined'
){

alert(
'LOCAL STORAGE NOT SUPPORTED'
);

return;

}

/* =====================================================
LOAD SETTINGS
===================================================== */

loadERPSettings();

}catch(error){

console.log(
'STORAGE ENGINE ERROR:',
error
);

}

}

/* =====================================================
SET STORAGE
===================================================== */

function setERPStorage(
key,
value
){

try{

const finalKey =
ERP_STORAGE.PREFIX + key;

const finalValue =
JSON.stringify(value);

localStorage.setItem(
finalKey,
finalValue
);

return true;

}catch(error){

console.log(
'SET STORAGE ERROR:',
error
);

return false;

}

}

/* =====================================================
GET STORAGE
===================================================== */

function getERPStorage(
key
){

try{

const finalKey =
ERP_STORAGE.PREFIX + key;

const value =
localStorage.getItem(
finalKey
);

if(!value){

return null;

}

return JSON.parse(value);

}catch(error){

console.log(
'GET STORAGE ERROR:',
error
);

return null;

}

}

/* =====================================================
REMOVE STORAGE
===================================================== */

function removeERPStorage(
key
){

try{

const finalKey =
ERP_STORAGE.PREFIX + key;

localStorage.removeItem(
finalKey
);

return true;

}catch(error){

console.log(
'REMOVE STORAGE ERROR:',
error
);

return false;

}

}

/* =====================================================
CLEAR ERP STORAGE
===================================================== */

function clearERPStorage(){

try{

Object.keys(localStorage)
.forEach(key => {

if(
key.startsWith(
ERP_STORAGE.PREFIX
)
){

localStorage.removeItem(
key
);

}

});

console.log(
'ERP STORAGE CLEARED'
);

}catch(error){

console.log(
'CLEAR STORAGE ERROR:',
error
);

}

}

/* =====================================================
SAVE SETTINGS
===================================================== */

function saveERPSettings(
settings
){

setERPStorage(
'SETTINGS',
settings
);

}

/* =====================================================
LOAD SETTINGS
===================================================== */

function loadERPSettings(){

const settings =
getERPStorage(
'SETTINGS'
);

if(!settings){

return;

}

/* =====================================================
THEME
===================================================== */

if(settings.theme){

document.body.setAttribute(
'data-theme',
settings.theme
);

}

/* =====================================================
SIDEBAR
===================================================== */

if(settings.sidebarCollapsed){

document.body.classList.add(
'sidebar-collapsed'
);

}

console.log(
'ERP SETTINGS LOADED'
);

}

/* =====================================================
SAVE USER CACHE
===================================================== */

function saveERPUserCache(
user
){

setERPStorage(
'USER_CACHE',
user
);

}

/* =====================================================
GET USER CACHE
===================================================== */

function getERPUserCache(){

return getERPStorage(
'USER_CACHE'
);

}

/* =====================================================
SAVE TOKEN
===================================================== */

function saveERPToken(
token
){

setERPStorage(
'TOKEN',
token
);

}

/* =====================================================
GET TOKEN
===================================================== */

function getERPTokenStorage(){

return getERPStorage(
'TOKEN'
);

}

/* =====================================================
SAVE RECENT MODULES
===================================================== */

function saveRecentERPModule(
module
){

let recent =
getERPStorage(
'RECENT_MODULES'
);

if(!recent){

recent = [];

}

/* =====================================================
REMOVE DUPLICATE
===================================================== */

recent =
recent.filter(item =>

item !== module

);

/* =====================================================
ADD TOP
===================================================== */

recent.unshift(
module
);

/* =====================================================
LIMIT
===================================================== */

recent =
recent.slice(0,10);

/* =====================================================
SAVE
===================================================== */

setERPStorage(
'RECENT_MODULES',
recent
);

}

/* =====================================================
GET RECENT MODULES
===================================================== */

function getRecentERPModules(){

return getERPStorage(
'RECENT_MODULES'
) || [];

}

/* =====================================================
SAVE DASHBOARD STATE
===================================================== */

function saveDashboardState(
state
){

setERPStorage(
'DASHBOARD_STATE',
state
);

}

/* =====================================================
LOAD DASHBOARD STATE
===================================================== */

function loadDashboardState(){

return getERPStorage(
'DASHBOARD_STATE'
);

}

/* =====================================================
SAVE API CACHE
===================================================== */

function saveERPAPICache(
key,
data
){

setERPStorage(
'API_CACHE_' + key,
{

timestamp :
new Date().getTime(),

data : data

}

);

}

/* =====================================================
GET API CACHE
===================================================== */

function getERPAPICache(
key,
expiryMinutes = 10
){

const cache =
getERPStorage(
'API_CACHE_' + key
);

if(!cache){

return null;

}

const now =
new Date().getTime();

const diff =
(now - cache.timestamp)
/ 1000 / 60;

if(diff > expiryMinutes){

removeERPStorage(
'API_CACHE_' + key
);

return null;

}

return cache.data;

}

/* =====================================================
EXPORT STORAGE
===================================================== */

function exportERPStorage(){

try{

const data = {};

Object.keys(localStorage)
.forEach(key => {

if(
key.startsWith(
ERP_STORAGE.PREFIX
)
){

data[key] =
localStorage.getItem(
key
);

}

});

const blob =
new Blob(

[
JSON.stringify(
data,
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
'BALAJI_ERP_BACKUP.json';

a.click();

}catch(error){

console.log(
'EXPORT STORAGE ERROR:',
error
);

}

}

/* =====================================================
AUTO INIT
===================================================== */

window.addEventListener(

'load',

function(){

initializeERPStorage();

}

);