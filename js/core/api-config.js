// ==========================================
// BALAJI NEXTGEN ERP
// FILE: /js/control-panel.js
// PURPOSE:
// Dynamic Control Panel Loader
// ==========================================


// ==========================================
// MAIN CONTROL PANEL LOADER
// ==========================================

async function loadControlPanelSettings() {

  try {

    // ==========================================
    // FETCH CONTROL PANEL SETTINGS
    // ==========================================

    const response = await fetch(
      ERP_API_URL + "?action=getControlPanel"
    );

    const result = await response.json();

    console.log(
      "CONTROL PANEL SETTINGS:",
      result
    );


    // ==========================================
    // COMPANY NAME
    // ==========================================

    if (result.COMPANY_NAME) {

      document.title =
        result.COMPANY_NAME;

      document
        .querySelectorAll(".company-name")
        .forEach(el => {

          el.innerText =
            result.COMPANY_NAME;

        });

    }


    // ==========================================
    // LOGIN TITLE
    // ==========================================

    if (result.LOGIN_TITLE) {

      document
        .querySelectorAll(".login-title")
        .forEach(el => {

          el.innerText =
            result.LOGIN_TITLE;

        });

    }


    // ==========================================
    // FOOTER TEXT
    // ==========================================

    if (result.FOOTER_TEXT) {

      document
        .querySelectorAll(".footer-text")
        .forEach(el => {

          el.innerText =
            result.FOOTER_TEXT;

        });

    }


    // ==========================================
    // THEME COLOR
    // ==========================================

    if (result.THEME_COLOR) {

      document.documentElement
        .style
        .setProperty(
          "--theme-color",
          result.THEME_COLOR
        );

    }


    // ==========================================
    // SECONDARY COLOR
    // ==========================================

    if (result.SECONDARY_COLOR) {

      document.documentElement
        .style
        .setProperty(
          "--secondary-color",
          result.SECONDARY_COLOR
        );

    }


    // ==========================================
    // COMPANY LOGO
    // ==========================================

    if (result.COMPANY_LOGO) {

      document
        .querySelectorAll(".company-logo")
        .forEach(img => {

          img.src =
            result.COMPANY_LOGO;

        });

    }


    // ==========================================
    // LOGIN BACKGROUND IMAGE
    // ==========================================

    if (result.LOGIN_BG) {

      const loginBg =
        document.querySelector(".login-bg");

      if (loginBg) {

        loginBg.style.backgroundImage =
          `url('${result.LOGIN_BG}')`;

      }

    }


    // ==========================================
    // SESSION TIMEOUT
    // ==========================================

    if (result.SESSION_TIMEOUT) {

      localStorage.setItem(
        "erp_session_timeout",
        result.SESSION_TIMEOUT
      );

    }


    // ==========================================
    // LOGIN REDIRECT
    // ==========================================

    if (result.LOGIN_REDIRECT) {

      localStorage.setItem(
        "erp_login_redirect",
        result.LOGIN_REDIRECT
      );

    }


    // ==========================================
    // FEATURE FLAGS
    // ==========================================

    localStorage.setItem(
      "ENABLE_GST",
      result.ENABLE_GST
    );

    localStorage.setItem(
      "ENABLE_POS",
      result.ENABLE_POS
    );

    localStorage.setItem(
      "ENABLE_AI",
      result.ENABLE_AI
    );

    localStorage.setItem(
      "ENABLE_REPORTS",
      result.ENABLE_REPORTS
    );

    localStorage.setItem(
      "ENABLE_MULTI",
      result.ENABLE_MULTI
    );


    // ==========================================
    // BRAND DETAILS
    // ==========================================

    document
      .querySelectorAll(".erp-brand-name")
      .forEach(el => {

        el.innerText = "Balaji NextGen";

      });

    document
      .querySelectorAll(".erp-company-name")
      .forEach(el => {

        el.innerText =
          "Balaji NextGen Solutions";

      });

    document
      .querySelectorAll(".erp-mobile")
      .forEach(el => {

        el.innerText =
          "9832014403";

      });


    console.log(
      "BALAJI NEXTGEN ERP CONTROL PANEL LOADED"
    );

  } catch (error) {

    console.error(
      "CONTROL PANEL ERROR:",
      error
    );

  }

}


// ==========================================
// AUTO LOAD
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  loadControlPanelSettings
);


// ==========================================
// END FILE
// ==========================================