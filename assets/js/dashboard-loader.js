/*
=========================================
BALAJI NEXTGEN ERP
DASHBOARD LOADER ENGINE
=========================================
*/

const COMPONENT_PATHS = {

    sidebar:
        "../Components/sidebar.html",

    header:
        "../Components/header.html",

    footer:
        "../Components/footer.html",

    notification:
        "../Components/notification-panel.html"

};

/*
=========================================
LOAD COMPONENT
=========================================
*/

async function loadComponent(
    elementId,
    componentPath
){

    try{

        const response =
            await fetch(
                componentPath
            );

        const html =
            await response.text();

        document
        .getElementById(
            elementId
        )
        .innerHTML = html;

    }catch(error){

        console.error(
            "Component Load Error",
            error
        );

    }

}

/*
=========================================
LOAD ALL COMPONENTS
=========================================
*/

async function loadLayout(){

    await Promise.all([

        loadComponent(
            "sidebarContainer",
            COMPONENT_PATHS.sidebar
        ),

        loadComponent(
            "headerContainer",
            COMPONENT_PATHS.header
        ),

        loadComponent(
            "footerContainer",
            COMPONENT_PATHS.footer
        ),

        loadComponent(
            "notificationContainer",
            COMPONENT_PATHS.notification
        )

    ]);

}

/*
=========================================
LOAD USER DATA
=========================================
*/

function loadUserInfo(){

    const user =
        JSON.parse(
            localStorage.getItem(
                "ERP_USER"
            )
        );

    if(!user) return;

    const elements = {

        userName:
            document.querySelectorAll(
                "#userName"
            ),

        userRole:
            document.querySelectorAll(
                "#userRole"
            )

    };

    elements.userName.forEach(el => {

        el.innerText =
            user.userName || "User";

    });

    elements.userRole.forEach(el => {

        el.innerText =
            user.role || "EMPLOYEE";

    });

}

/*
=========================================
LOAD DASHBOARD TITLE
=========================================
*/

function setDashboardTitle(
    title
){

    document.title =
        title +
        " | Balaji NextGen ERP";

}

/*
=========================================
SHOW LOADER
=========================================
*/

function showLoader(){

    const loader =
        document.getElementById(
            "pageLoader"
        );

    if(loader){

        loader.style.display =
            "flex";
    }

}

/*
=========================================
HIDE LOADER
=========================================
*/

function hideLoader(){

    const loader =
        document.getElementById(
            "pageLoader"
        );

    if(loader){

        loader.style.display =
            "none";
    }

}

/*
=========================================
INITIALIZE DASHBOARD
=========================================
*/

async function initializeDashboard(
    pageTitle
){

    showLoader();

    await loadLayout();

    loadUserInfo();

    setDashboardTitle(
        pageTitle
    );

    hideLoader();

}

/*
=========================================
ERP API CALL
=========================================
*/

async function callERPAPI(
    payload
){

    /*
    =========================================
    FIX: Always read fresh URL from
    localStorage so it uses the URL set by
    loadRegistryAPI() in api-registry-loader.
    =========================================
    */

    const API_URL =
        localStorage.getItem(
            "ERP_API_URL"
        );

    if(!API_URL){

        console.error(
            "ERP_API_URL not set in localStorage"
        );

        return {
            success: false,
            message: "API URL not configured"
        };

    }

    try{

        const response =
            await fetch(
                API_URL,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify(
                        payload
                    )
                }
            );

        return await response.json();

    }catch(error){

        console.error(
            "callERPAPI ERROR:",
            error
        );

        return {

            success:false,

            message:
            "API Error"

        };

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

        console.log(
            "Balaji NextGen ERP Loaded"
        );

    }
);
