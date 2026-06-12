/* =====================================
   BALAJI NEXTGEN ERP
   AUTH GUARD JS
===================================== */

(function(){

/* =====================================
   GET LOGIN SESSION
===================================== */

const user =
JSON.parse(
localStorage.getItem(
"erpUser"
)
);

/* =====================================
   CHECK USER SESSION
===================================== */

if(!user){

alert(
"Unauthorized Access! Please Login."
);

/* REDIRECT LOGIN */

window.location.href =
"../login/admin-login.html";

}

/* =====================================
   SESSION FOUND
===================================== */

else{

console.log(
"Authorized User:",
user.name
);

}

/* =====================================
   ROLE ACCESS CHECK
===================================== */

window.checkRole =
function(allowedRoles){

if(
!allowedRoles.includes(
user.role
)
){

alert(
"Access Denied!"
);

/* REDIRECT */

window.location.href =
"../dashboard/main-dashboard.html";

}

};

/* =====================================
   LOGOUT FUNCTION
===================================== */

window.logoutUser =
function(){

localStorage.removeItem(
"erpUser"
);

alert(
"Logged Out Successfully"
);

window.location.href =
"../login/admin-login.html";

};

})();