/* =========================================================
   ERP ACTION PERMISSION ENGINE
========================================================= */

/* =========================================================
   CHECK ACCESS
========================================================= */

async function hasPermission(

  moduleName,
  actionType

) {

  try {

    const response =
      await fetch(
        API_URL,
        {
          method:"POST",

          body:JSON.stringify({

            action:
            "checkUserPermission",

            roleName:
            ERP_USER.role,

            moduleName:
            moduleName,

            actionType:
            actionType
          })
        }
      );

    const data =
      await response.json();

    return data.allowed;

  } catch(error) {

    console.error(error);

    return false;
  }
}

/* =========================================================
   APPLY BUTTON SECURITY
========================================================= */

async function applyActionPermissions() {

  /* =====================================
     VIEW BUTTONS
  ===================================== */

  const buttons =
  document.querySelectorAll(
    "[data-module]"
  );

  for (
    let i = 0;
    i < buttons.length;
    i++
  ) {

    const button =
      buttons[i];

    const moduleName =
      button.dataset.module;

    const actionType =
      button.dataset.action;

    const allowed =
      await hasPermission(

        moduleName,
        actionType
      );

    if (!allowed) {

      button.style.display =
      "none";
    }
  }
}

/* =========================================================
   AUTO LOAD
========================================================= */

applyActionPermissions();