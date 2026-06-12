/*
=========================================
BALAJI NEXTGEN ERP
AUTH ENGINE
=========================================
*/

const AuthEngine = {

    async login(
        loginId,
        password
    ){

        try{

            const result =
            await AuthAPI.login({

                loginId:
                loginId,

                password:
                password

            });

            if(
                result &&
                result.success
            ){

                saveSession(
                    result
                );

            }

            return result;

        }
        catch(error){

            console.error(
                "LOGIN ERROR",
                error
            );

            return {

                success:false,

                message:
                "Login Failed"

            };

        }

    },

    async sendOTP(
        loginId
    ){

        try{

            return await
            AuthAPI.requestOTP({

                loginId:
                loginId

            });

        }
        catch(error){

            console.error(
                error
            );

            return {

                success:false,

                message:
                "OTP Request Failed"

            };

        }

    },

    async verifyOTP(
        loginId,
        otp
    ){

        try{

            const result =
            await AuthAPI.verifyOTP({

                loginId:
                loginId,

                otp:
                otp

            });

            if(
                result &&
                result.success
            ){

                saveSession(
                    result
                );

            }

            return result;

        }
        catch(error){

            console.error(
                error
            );

            return {

                success:false,

                message:
                "OTP Verification Failed"

            };

        }

    },

    async logout(){

        try{

            await AuthAPI.logout({

                token:
                localStorage.getItem(
                    "ERP_TOKEN"
                )

            });

        }
        catch(error){

            console.error(
                error
            );

        }

        clearSession();

        window.location.href =
        "login.html";

    },

    async verifySession(){

        try{

            return await
            AuthAPI.verifySession({

                token:
                localStorage.getItem(
                    "ERP_TOKEN"
                )

            });

        }
        catch(error){

            console.error(
                error
            );

            return {

                success:false

            };

        }

    }

};

/*
=========================================
HELPERS
=========================================
*/

function isLoggedIn(){

    return !!localStorage.getItem(
        "ERP_USER"
    );

}

function getLoggedUser(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "ERP_USER"
            )
        );

    }
    catch(error){

        return null;

    }

}

/*
=========================================
AUTO SESSION CHECK
=========================================
*/

window.addEventListener(

    "load",

    function(){

        console.log(
            "AUTH ENGINE LOADED"
        );

    }

);
