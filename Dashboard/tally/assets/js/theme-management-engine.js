/*
================================================================
BALAJI NEXTGEN ERP
F008 - THEME MANAGEMENT ENGINE
Dynamic ERP theme: LIGHT / DARK / BRANDED.
Reads brand colors from THEME_SETTINGS sheet via backend.
================================================================
*/

const ThemeEngine = {

    THEMES: {
        LIGHT: {
            "--erp-bg":          "#f4f8ff",
            "--erp-surface":     "#ffffff",
            "--erp-primary":     "#2563eb",
            "--erp-primary-dk":  "#1d4ed8",
            "--erp-text":        "#0f172a",
            "--erp-text-muted":  "#64748b",
            "--erp-border":      "#e2e8f0",
            "--erp-sidebar-bg":  "#1e3a8a",
            "--erp-sidebar-txt": "#ffffff",
            "--erp-header-bg":   "#ffffff",
            "--erp-danger":      "#dc2626",
            "--erp-success":     "#16a34a",
            "--erp-warning":     "#d97706"
        },
        DARK: {
            "--erp-bg":          "#0f172a",
            "--erp-surface":     "#1e293b",
            "--erp-primary":     "#3b82f6",
            "--erp-primary-dk":  "#2563eb",
            "--erp-text":        "#f1f5f9",
            "--erp-text-muted":  "#94a3b8",
            "--erp-border":      "#334155",
            "--erp-sidebar-bg":  "#0f172a",
            "--erp-sidebar-txt": "#f1f5f9",
            "--erp-header-bg":   "#1e293b",
            "--erp-danger":      "#ef4444",
            "--erp-success":     "#22c55e",
            "--erp-warning":     "#f59e0b"
        }
    },

    currentTheme: "LIGHT",

    /* ============================================================
       APPLY THEME
    ============================================================ */

    apply(themeName = "LIGHT") {

        const theme = this.THEMES[themeName];

        if (!theme) {
            console.warn("[THEME] Unknown theme:", themeName);
            return;
        }

        const root = document.documentElement;

        Object.entries(theme).forEach(([key, val]) => {
            root.style.setProperty(key, val);
        });

        document.body.setAttribute("data-theme", themeName.toLowerCase());
        this.currentTheme = themeName;
        StorageEngine.set("ERP_THEME", themeName);

        console.log("[THEME] Applied:", themeName);

    },

    /* ============================================================
       TOGGLE LIGHT / DARK
    ============================================================ */

    toggle() {
        const next = this.currentTheme === "LIGHT" ? "DARK" : "LIGHT";
        this.apply(next);
        return next;
    },

    /* ============================================================
       APPLY BRAND COLOR (from THEME_SETTINGS sheet)
    ============================================================ */

    applyBrandColor(primaryColor, secondaryColor) {

        const root = document.documentElement;

        if (primaryColor) {
            root.style.setProperty("--erp-primary", primaryColor);
        }

        if (secondaryColor) {
            root.style.setProperty("--erp-sidebar-bg", secondaryColor);
        }

    },

    /* ============================================================
       LOAD THEME SETTINGS from backend
    ============================================================ */

    async loadFromBackend() {

        try {

            const result = await apiRequest("GET_THEME_SETTINGS", {
                clientId: StorageEngine.getClient()
            });

            if (result && result.success && result.data) {
                const d = result.data;
                if (d.primaryColor)   this.applyBrandColor(d.primaryColor, d.sidebarColor);
                if (d.themeMode)      this.apply(d.themeMode);
            }

        } catch (e) {
            console.warn("[THEME] Using default theme");
        }

    },

    /* ============================================================
       RESTORE from localStorage
    ============================================================ */

    restore() {
        const saved = StorageEngine.get("ERP_THEME") || "LIGHT";
        this.apply(saved);
    }

};

/* ================================================================
   GLOBAL SHORTHAND
================================================================ */

function toggleTheme()    { return ThemeEngine.toggle(); }
function applyTheme(name) { ThemeEngine.apply(name); }

/* ================================================================
   AUTO INIT
================================================================ */

document.addEventListener("DOMContentLoaded", function () {
    ThemeEngine.restore();
});

console.log("[THEME ENGINE] Loaded");
