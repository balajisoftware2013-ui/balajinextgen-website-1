/* =========================
   BALAJI NEXTGEN ERP
   MAIN JS
========================= */

console.log(
"Balaji NextGen ERP Loaded"
);

/* =========================
   ACTIVE SIDEBAR
========================= */

const menuLinks =
document.querySelectorAll(
".sidebar-menu a"
);

menuLinks.forEach(link=>{

link.addEventListener("click",()=>{

menuLinks.forEach(item=>{

item.classList.remove("active");

});

link.classList.add("active");

});

});

/* =========================
   LIVE DATE & TIME
========================= */

function updateDateTime(){

const now = new Date();

const options = {

weekday:"short",
year:"numeric",
month:"short",
day:"numeric",
hour:"2-digit",
minute:"2-digit"

};

const formatted =
now.toLocaleDateString(
"en-IN",
options
);

const dateBox =
document.getElementById(
"liveDateTime"
);

if(dateBox){

dateBox.innerHTML =
formatted;

}

}

setInterval(
updateDateTime,
1000
);

/* =========================
   TABLE SEARCH
========================= */

function searchTable(inputId,tableId){

const input =
document.getElementById(inputId);

const filter =
input.value.toUpperCase();

const table =
document.getElementById(tableId);

const tr =
table.getElementsByTagName("tr");

for(let i=1;i<tr.length;i++){

let visible = false;

const td =
tr[i].getElementsByTagName("td");

for(let j=0;j<td.length;j++){

if(td[j]){

const txtValue =
td[j].textContent ||
td[j].innerText;

if(
txtValue.toUpperCase()
.indexOf(filter) > -1
){

visible = true;

}

}

}

tr[i].style.display =
visible ? "" : "none";

}

}

/* =========================
   SUCCESS ALERT
========================= */

function successAlert(message){

alert(
"SUCCESS: " + message
);

}

/* =========================
   ERROR ALERT
========================= */

function errorAlert(message){

alert(
"ERROR: " + message
);

}

/* =========================
   SESSION STORAGE
========================= */

function saveSession(user){

localStorage.setItem(
"erpUser",
JSON.stringify(user)
);

}

function getSession(){

return JSON.parse(
localStorage.getItem(
"erpUser"
)
);

}

function logout(){

localStorage.removeItem(
"erpUser"
);

window.location.href =
"../../login/admin-login.html";

}

/* =========================
   PAGE LOAD
========================= */

document.addEventListener(
"DOMContentLoaded",
()=>{

updateDateTime();

console.log(
"ERP Page Initialized"
);

});