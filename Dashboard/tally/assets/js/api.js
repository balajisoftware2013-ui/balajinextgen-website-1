/*
=================================================
BALAJI NEXTGEN ERP
MASTER API ENGINE
FIX: BASE_URL and TOKEN are now dynamic getters
     so they always read the latest value from
     localStorage — fixes race condition where
     api.js loaded before registry loader finished.
=================================================
*/

const ERP_FALLBACK_URL =
"https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec";

const ERP_API = {

    /*
    =================================================
    FIX: Use getter so BASE_URL is always read fresh
    from localStorage on every access — not just
    once at page load time.
    =================================================
    */

    get BASE_URL() {
        return (
            localStorage.getItem("ERP_API_URL") ||
            ERP_FALLBACK_URL
        );
    },

    get TOKEN() {
        return (
            localStorage.getItem("ERP_TOKEN") || ""
        );
    }

};

/*
=================================================
COMMON REQUEST
=================================================
*/

async function apiRequest(
    action,
    payload = {}
){

    /*
    =================================================
    FIX: Read API URL fresh on every request so it
    always uses the URL loaded by loadRegistryAPI().
    =================================================
    */

    const BASE_URL =
    localStorage.getItem("ERP_API_URL") ||
    ERP_FALLBACK_URL;

    try{

        const response =
        await fetch(
            BASE_URL,
            {
                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },

                body:JSON.stringify({
                    action,
                    token: ERP_API.TOKEN,
                    ...payload
                })
            }
        );

        const text =
        await response.text();

        let result;

        try{

            result =
            JSON.parse(text);

        }catch(error){

            console.error(
                "INVALID JSON RESPONSE:",
                text
            );

            return {
                success:false,
                message:
                "API returned HTML instead of JSON." +
                " Check your Google Apps Script deployment."
            };

        }

        return result;

    }catch(error){

        console.error(
            "API ERROR:",
            error
        );

        return {

            success:false,

            message:
            error.message ||
            "Server Connection Failed"

        };

    }

}

/*
=================================================
AUTH API
=================================================
*/

const AuthAPI = {

    login(data){
        return apiRequest(
            "LOGIN",
            data
        );
    },

    logout(data){
        return apiRequest(
            "LOGOUT",
            data
        );
    },

    requestOTP(data){
        return apiRequest(
            "SEND_OTP",
            data
        );
    },

    verifyOTP(data){
        return apiRequest(
            "OTP_LOGIN",
            data
        );
    },

    verifySession(data){
        return apiRequest(
            "VERIFY_SESSION",
            data
        );
    }

};

/*
=================================================
SESSION MANAGEMENT
=================================================
*/

function saveSession(data){

    if(data.user){

        localStorage.setItem(
            "ERP_USER",
            JSON.stringify(
                data.user
            )
        );

    }

    if(data.token){

        localStorage.setItem(
            "ERP_TOKEN",
            data.token
        );

    }

}

function clearSession(){

    localStorage.removeItem(
        "ERP_USER"
    );

    localStorage.removeItem(
        "ERP_TOKEN"
    );

}

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

function setAPIURL(url){

    localStorage.setItem(
        "ERP_API_URL",
        url
    );

}

/*
=================================================
DEBUG
=================================================
*/

console.log(
    "ERP API ENGINE LOADED | URL:",
    ERP_API.BASE_URL
);
