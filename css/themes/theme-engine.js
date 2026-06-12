const ERP_THEMES = {

  "sap-blue": {
    primary: "#2563eb",
    secondary: "#1e293b",
    background: "#020617",
    card: "#0f172a",
    text: "#ffffff",
    sidebar: "#111827",
    accent: "#38bdf8"
  }

};

function applyERPTheme(themeName){

  const theme = ERP_THEMES[themeName];

  if(!theme) return;

  document.documentElement.style
    .setProperty("--primary-color",theme.primary);

  document.documentElement.style
    .setProperty("--secondary-color",theme.secondary);

  document.documentElement.style
    .setProperty("--background-color",theme.background);

  document.documentElement.style
    .setProperty("--card-color",theme.card);

  document.documentElement.style
    .setProperty("--text-color",theme.text);

  document.documentElement.style
    .setProperty("--sidebar-color",theme.sidebar);

  document.documentElement.style
    .setProperty("--accent-color",theme.accent);

  localStorage.setItem(
    "ERP_THEME",
    themeName
  );

}

window.addEventListener(
  "DOMContentLoaded",
  ()=>{
    applyERPTheme("sap-blue");
  }
);