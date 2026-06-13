const MASTER_API =
"https://script.google.com/macros/s/YOUR_V2_CORE_DEPLOYMENT/exec";

let ERP_CONFIG = {};

async function loadERPConfig() {

  const response = await fetch(
    MASTER_API,
    {
      method:"POST",
      body:JSON.stringify({
        action:"getDeploymentRegistry"
      })
    }
  );

  const data = await response.json();

  ERP_CONFIG = data.registry;

  console.log("ERP CONFIG",ERP_CONFIG);

}