/*
=========================================
BALAJI NEXTGEN ERP
ROLE ROUTER ENGINE
=========================================
*/

const ROLE_DASHBOARD_MAP = {

    SUPER_ADMIN:
    "Dashboard/super-admin-dashboard.html",

    OWNER:
    "Dashboard/owner-dashboard.html",

    MANAGER:
    "Dashboard/manager-dashboard.html",

    EMPLOYEE:
    "Dashboard/employee-dashboard.html",

    CASHIER:
    "Dashboard/cashier-dashboard.html",

    CHEF:
    "Dashboard/chef-dashboard.html",

    DEVELOPER:
    "Dashboard/developer-dashboard.html"

};

/*
=========================================
GET CURRENT USER
=========================================
*/

function getCurrentUser(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "ERP_USER"
            )
        );

    }catch(error){

        return null;

    }

}

/*
=========================================
AUTO ROUTE USER
=========================================
*/

function routeUserByRole(){

    const user =
    getCurrentUser();

    if(!user){

        return;

    }

    const role =
    String(
        user.ROLE ||
        user.role ||
        ""
    ).toUpperCase();

    const dashboard =
    ROLE_DASHBOARD_MAP[
        role
    ];

    if(dashboard){

        window.location.href =
        dashboard;

    }else{

        alert(
            "Invalid Role Access"
        );

    }

}

/*
=========================================
ROLE ACCESS
=========================================
*/

function hasRoleAccess(
    allowedRoles
){

    const user =
    getCurrentUser();

    if(!user){

        return false;

    }

    const role =
    String(
        user.ROLE ||
        user.role ||
        ""
    ).toUpperCase();

    return allowedRoles
    .map(
        r => r.toUpperCase()
    )
    .includes(role);

}

/*
=========================================
PROTECT DASHBOARD PAGE
=========================================
*/

function protectPage(
    allowedRoles
){

    const user =
    getCurrentUser();

    if(!user){

        window.location.href =
        "../login.html";

        return;

    }

    if(
        !hasRoleAccess(
            allowedRoles
        )
    ){

        alert(
            "Access Denied"
        );

        routeUserByRole();

    }

}

/*
=========================================
LOGOUT
=========================================
*/

function logout(){

    localStorage.removeItem(
        "ERP_USER"
    );

    localStorage.removeItem(
        "ERP_TOKEN"
    );

    localStorage.removeItem(
        "ERP_SESSION"
    );

    window.location.href =
    "../login.html";

}

/*
=========================================
SESSION CHECK
=========================================
*/

function checkSession(){

    const path =
    window.location.pathname
    .toLowerCase();

    if(
        path.includes(
            "login.html"
        )
    ){

        return;

    }

    const user =
    localStorage.getItem(
        "ERP_USER"
    );

    if(!user){

        window.location.href =
        "../login.html";

    }

}

/*
=========================================
AUTO START
=========================================
*/

document.addEventListener(

    "DOMContentLoaded",

    function(){

        checkSession();

    }

);
