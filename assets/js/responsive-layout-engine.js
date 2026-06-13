/*
================================================================
BALAJI NEXTGEN ERP
F009 - RESPONSIVE LAYOUT ENGINE
Mobile/tablet/desktop breakpoints and responsive adjustments.
================================================================
*/

const ResponsiveEngine = {

    BREAKPOINTS: {
        MOBILE:  768,
        TABLET:  1024,
        DESKTOP: 1280
    },

    currentDevice: "DESKTOP",

    /* ============================================================
       DETECT DEVICE
    ============================================================ */

    detect() {
        const w = window.innerWidth;

        if (w <= this.BREAKPOINTS.MOBILE) {
            this.currentDevice = "MOBILE";
        } else if (w <= this.BREAKPOINTS.TABLET) {
            this.currentDevice = "TABLET";
        } else {
            this.currentDevice = "DESKTOP";
        }

        document.body.setAttribute("data-device", this.currentDevice.toLowerCase());

        return this.currentDevice;
    },

    isMobile()  { return this.currentDevice === "MOBILE"; },
    isTablet()  { return this.currentDevice === "TABLET"; },
    isDesktop() { return this.currentDevice === "DESKTOP"; },

    /* ============================================================
       AUTO CLOSE SIDEBAR on mobile
    ============================================================ */

    handleSidebar() {
        if (this.isMobile() && typeof SidebarEngine !== "undefined") {
            SidebarEngine.close();
        }
    },

    /* ============================================================
       ON RESIZE
    ============================================================ */

    onResize() {
        this.detect();
        this.handleSidebar();
        this._adjustTables();
    },

    /* ============================================================
       MAKE TABLES SCROLLABLE on mobile
    ============================================================ */

    _adjustTables() {
        if (!this.isMobile()) return;

        document.querySelectorAll("table").forEach(table => {
            if (!table.closest(".table-responsive")) {
                const wrapper = document.createElement("div");
                wrapper.className = "table-responsive";
                wrapper.style.overflowX = "auto";
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    },

    /* ============================================================
       INIT
    ============================================================ */

    init() {
        this.detect();
        this.handleSidebar();
        this._adjustTables();

        window.addEventListener("resize", () => this.onResize());

        console.log("[RESPONSIVE] Device:", this.currentDevice);
    }

};

/* ================================================================
   AUTO INIT
================================================================ */

document.addEventListener("DOMContentLoaded", function () {
    ResponsiveEngine.init();
});
