/*
=================================================
BALAJI NEXTGEN ERP
API REGISTRY LOADER
FIX: Added fallback URL so login never breaks
     even if ERP_REGISTRY_API is not set in
     localStorage.
=================================================
*/

const ERP_MASTER_SHEET_ID =
"1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I";

/*
=================================================
FIX: Hardcoded fallback — used when registry
     is not available or returns no V2_AUTH.
=================================================
*/

const ERP_FALLBACK_API_URL =
"https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec";

/*
=================================================
LOAD ACTIVE API URL
=================================================
*/

async function loadRegistryAPI() {

    try {

        const registryURL =
        localStorage.getItem(
            "ERP_REGISTRY_API"
        );

        /*
        =================================================
        FIX: If ERP_REGISTRY_API is not set in
        localStorage, use fallback URL directly.
        This was the root cause of the login error.
        =================================================
        */

        if (!registryURL) {

            console.warn(
                "ERP_REGISTRY_API not set in localStorage." +
                " Using fallback API URL."
            );

            localStorage.setItem(
                "ERP_API_URL",
                ERP_FALLBACK_API_URL
            );

            localStorage.setItem(
                "ERP_REGISTRY_API",
                ERP_FALLBACK_API_URL
            );

            return ERP_FALLBACK_API_URL;

        }

        const response =
        await fetch(registryURL);

        const result =
        await response.json();

        if (
            result.success &&
            result.data &&
            result.data.V2_AUTH
        ) {

            const authURL =
            result.data.V2_AUTH;

            localStorage.setItem(
                "ERP_API_URL",
                authURL
            );

            console.log(
                "V2_AUTH Loaded:",
                authURL
            );

            return authURL;

        }

        throw new Error(
            "V2_AUTH not found in registry response"
        );

    }

    catch(error) {

        console.error(
            "REGISTRY ERROR:",
            error
        );

        /*
        =================================================
        FIX: On any error, fall back to hardcoded URL
        so login always has a working endpoint.
        =================================================
        */

        console.warn(
            "Falling back to hardcoded API URL."
        );

        localStorage.setItem(
            "ERP_API_URL",
            ERP_FALLBACK_API_URL
        );

        return ERP_FALLBACK_API_URL;

    }

}

/*
=================================================
AUTO LOAD
=================================================
*/

loadRegistryAPI();
