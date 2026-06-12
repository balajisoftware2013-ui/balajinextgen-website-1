/* =========================================================
   BALAJI NEXTGEN ERP
   AUTH MANAGER
========================================================= */

const AuthManager = {

    currentUser: null,


    /* =====================================================
       LOGIN
    ===================================================== */

    async login(email, password) {

        const result =
            await APIManager.post(

                "LOGIN",

                {
                    email,
                    password
                }

            );

        if (result.success) {

            this.currentUser =
                result.user;

            localStorage.setItem(
                "BNERP_USER",
                JSON.stringify(result.user)
            );
        }

        return result;
    },


    /* =====================================================
       LOGOUT
    ===================================================== */

    logout() {

        localStorage.removeItem(
            "BNERP_USER"
        );

        window.location.href =
            "/login/admin-login.html";
    },


    /* =====================================================
       GET CURRENT USER
    ===================================================== */

    getCurrentUser() {

        if (this.currentUser) {

            return this.currentUser;
        }

        const storedUser =
            localStorage.getItem(
                "BNERP_USER"
            );

        if (storedUser) {

            this.currentUser =
                JSON.parse(storedUser);
        }

        return this.currentUser;
    }

};