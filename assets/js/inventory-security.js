/* =====================================================
   BALAJI NEXTGEN ERP
   inventory-security.js
   Enterprise Frontend Security Engine
===================================================== */

const InventorySecurity = (() => {

  const SESSION_KEY = "BNERP_SESSION";
  const USER_KEY = "BNERP_USER";

  let currentUser = null;

  /* ==========================================
     SESSION
  ========================================== */

  function saveSession(data){

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(data)
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(data.user)
    );

    currentUser = data.user;

  }

  function loadSession(){

    try{

      const user =
        JSON.parse(
          localStorage.getItem(USER_KEY)
        );

      currentUser = user;

      return user;

    }catch(e){

      return null;

    }

  }

  function clearSession(){

    localStorage.removeItem(
      SESSION_KEY
    );

    localStorage.removeItem(
      USER_KEY
    );

    currentUser = null;

  }

  /* ==========================================
     LOGIN
  ========================================== */

  async function login(
    username,
    password
  ){

    try{

      const result =
        await InventoryAPI.request(
          "LOGIN",
          {
            username,
            password
          }
        );

      if(result.success){

        saveSession(result);

        return true;

      }

      return false;

    }catch(err){

      console.error(err);

      return false;

    }

  }

  /* ==========================================
     LOGOUT
  ========================================== */

  function logout(){

    clearSession();

    window.location.href =
      "index.html";

  }

  /* ==========================================
     CURRENT USER
  ========================================== */

  function getUser(){

    if(!currentUser){

      loadSession();

    }

    return currentUser;

  }

  function getRole(){

    const user =
      getUser();

    return user
      ? user.role
      : "GUEST";

  }

  function getBranch(){

    const user =
      getUser();

    return user
      ? user.branch
      : "";

  }

  /* ==========================================
     ROLE PERMISSIONS
  ========================================== */

  const ROLE_ACCESS = {

    SUPER_ADMIN:[
      "*"
    ],

    ADMIN:[
      "dashboard",
      "purchase",
      "inventory",
      "warehouse",
      "reports",
      "settings",
      "analytics"
    ],

    MANAGER:[
      "dashboard",
      "purchase",
      "inventory",
      "warehouse",
      "reports"
    ],

    USER:[
      "dashboard",
      "inventory"
    ]

  };

  function hasAccess(module){

    const role =
      getRole();

    const access =
      ROLE_ACCESS[role] || [];

    if(
      access.includes("*")
    ){

      return true;

    }

    return access.includes(
      module
    );

  }

  /* ==========================================
     MENU SECURITY
  ========================================== */

  function applyMenuSecurity(){

    document
      .querySelectorAll(
        "[data-module]"
      )
      .forEach(el=>{

        const module =
          el.dataset.module;

        if(
          !hasAccess(module)
        ){

          el.style.display =
            "none";

        }

      });

  }

  /* ==========================================
     SUPER ADMIN
  ========================================== */

  function isSuperAdmin(){

    return (
      getRole()
      ===
      "SUPER_ADMIN"
    );

  }

  function showAdminControls(){

    if(
      !isSuperAdmin()
    ){

      return;

    }

    document
      .querySelectorAll(
        ".super-admin-only"
      )
      .forEach(el=>{

        el.style.display =
          "";

      });

  }

  /* ==========================================
     AUTO LOGOUT
  ========================================== */

  function startIdleTimer(){

    let idleTime = 0;

    setInterval(()=>{

      idleTime++;

      if(idleTime > 120){

        alert(
          "Session Expired"
        );

        logout();

      }

    },60000);

    [
      "mousemove",
      "click",
      "keydown"
    ].forEach(evt=>{

      document.addEventListener(
        evt,
        ()=>{
          idleTime = 0;
        }
      );

    });

  }

  /* ==========================================
     DASHBOARD SECURITY
  ========================================== */

  function protectPage(){

    const user =
      loadSession();

    if(!user){

      window.location.href =
        "index.html";

      return false;

    }

    applyMenuSecurity();

    showAdminControls();

    return true;

  }

  return {

    login,
    logout,

    getUser,
    getRole,
    getBranch,

    hasAccess,

    protectPage,

    isSuperAdmin,

    startIdleTimer

  };

})();