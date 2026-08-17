/*
================================================================
BALAJI NEXTGEN ERP
F007 - SIDEBAR NAVIGATION ENGINE
Sidebar menu open/close, active state, role-based menu items.
================================================================
*/

const SidebarEngine = {

    isOpen: true,
    activeItem: null,

    /* ============================================================
       INIT
    ============================================================ */

    init() {
        this.bindToggle();
        this.setActiveFromURL();
        this.applyRoleMenuFilter();
        console.log("[SIDEBAR] Initialized");
    },

    /* ============================================================
       TOGGLE SIDEBAR OPEN / CLOSE
    ============================================================ */

    toggle() {
        this.isOpen = !this.isOpen;
        const sidebar = document.getElementById("erpSidebar");
        const main    = document.getElementById("erpMainContent");

        if (!sidebar) return;

        if (this.isOpen) {
            sidebar.classList.remove("collapsed");
            if (main) main.classList.remove("sidebar-collapsed");
        } else {
            sidebar.classList.add("collapsed");
            if (main) main.classList.add("sidebar-collapsed");
        }

        StorageEngine.set("SIDEBAR_STATE", this.isOpen ? "open" : "closed");
    },

    open() {
        this.isOpen = false;
        this.toggle();
    },

    close() {
        this.isOpen = true;
        this.toggle();
    },

    /* ============================================================
       RESTORE STATE from localStorage
    ============================================================ */

    restoreState() {
        const saved = StorageEngine.get("SIDEBAR_STATE");
        if (saved === "closed") {
            this.close();
        }
    },

    /* ============================================================
       SET ACTIVE ITEM based on current page URL
    ============================================================ */

    setActiveFromURL() {
        const path = window.location.pathname;
        const links = document.querySelectorAll(".sidebar-link, .nav-link");

        links.forEach(link => {
            link.classList.remove("active");
            const href = link.getAttribute("href");
            if (href && path.includes(href.replace(/^.*\//, "").replace(".html", ""))) {
                link.classList.add("active");
                const parent = link.closest(".sidebar-section");
                if (parent) parent.classList.add("expanded");
            }
        });
    },

    /* ============================================================
       FILTER MENU ITEMS by user ROLE
    ============================================================ */

    applyRoleMenuFilter() {
        const role = StorageEngine.getRole();
        if (!role) return;

        document.querySelectorAll("[data-roles]").forEach(el => {
            const allowed = el.getAttribute("data-roles")
                .split(",")
                .map(r => r.trim().toUpperCase());

            el.style.display = allowed.includes(role) ? "" : "none";
        });
    },

    /* ============================================================
       BIND TOGGLE BUTTON
    ============================================================ */

    bindToggle() {
        const btn = document.getElementById("sidebarToggle");
        if (btn) {
            btn.addEventListener("click", () => this.toggle());
        }
    },

    /* ============================================================
       SUBMENU ACCORDION
    ============================================================ */

    toggleSubmenu(id) {
        const sub = document.getElementById(id);
        if (!sub) return;
        const isExpanded = sub.classList.contains("expanded");
        document.querySelectorAll(".sidebar-submenu").forEach(s => s.classList.remove("expanded"));
        if (!isExpanded) sub.classList.add("expanded");
    }

};

/* ================================================================
   GLOBAL SHORTHAND
================================================================ */

function toggleSidebar()           { SidebarEngine.toggle(); }
function toggleSubmenu(id)         { SidebarEngine.toggleSubmenu(id); }

/* ================================================================
   AUTO INIT
================================================================ */

document.addEventListener("DOMContentLoaded", function () {
    SidebarEngine.init();
    SidebarEngine.restoreState();
});
