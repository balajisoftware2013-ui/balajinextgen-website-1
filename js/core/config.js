/************************************************************
 * BALAJI NEXTGEN ERP
 * CENTRAL CONFIG ENGINE
 ************************************************************/


let ERP_CONFIG = {};

let API_URL = "";


/* =========================================================
   LOAD ERP CONFIG
========================================================= */

async function loadERPConfig() {

  try {

    const CONTROL_PANEL_URL =
      "https://script.google.com/macros/s/AKfycbxtoGt2OoE85SRSpEEJEj3Q4nTZ0fUVTyo4VuKlb5wAVXZ3ZvtrOtnck-po84bbK3N1sg/exec?action=config";

    const response =
      await fetch(CONTROL_PANEL_URL);

    const data =
      await response.json();

    ERP_CONFIG = data;

    API_URL =
      ERP_CONFIG.API_URL;

    console.log(
      "ERP CONFIG LOADED",
      ERP_CONFIG
    );

  } catch(error) {

    console.error(
      "CONFIG LOAD ERROR",
      error
    );
  }
}