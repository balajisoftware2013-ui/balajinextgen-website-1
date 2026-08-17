/*
================================================================
BALAJI NEXTGEN ERP
F006 - NOTIFICATION ENGINE
ERP toast alerts, bell notifications, sound alerts.
================================================================
*/

const NotificationEngine = {

    container: null,

    /* ============================================================
       INIT — create toast container once
    ============================================================ */

    init() {
        if (document.getElementById("erp-toast-container")) return;
        const div = document.createElement("div");
        div.id = "erp-toast-container";
        div.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:99999;
            display:flex; flex-direction:column; gap:10px;
            max-width:340px; width:100%;
        `;
        document.body.appendChild(div);
        this.container = div;
    },

    /* ============================================================
       TOAST — show popup message
       type: success | error | warning | info
    ============================================================ */

    toast(message, type = "info", duration = 3500) {

        this.init();

        const colors = {
            success: { bg: "#dcfce7", border: "#16a34a", icon: "✅", text: "#166534" },
            error:   { bg: "#fef2f2", border: "#dc2626", icon: "❌", text: "#991b1b" },
            warning: { bg: "#fffbeb", border: "#d97706", icon: "⚠️", text: "#92400e" },
            info:    { bg: "#eff6ff", border: "#2563eb", icon: "ℹ️", text: "#1e40af" }
        };

        const c = colors[type] || colors.info;

        const toast = document.createElement("div");
        toast.style.cssText = `
            background:${c.bg}; border-left:4px solid ${c.border};
            color:${c.text}; padding:14px 16px; border-radius:10px;
            font-size:14px; font-weight:500; display:flex;
            align-items:flex-start; gap:10px; box-shadow:0 4px 20px rgba(0,0,0,0.1);
            animation:erp-slide-in 0.3s ease; cursor:pointer;
        `;

        toast.innerHTML = `
            <span style="font-size:18px;line-height:1">${c.icon}</span>
            <span style="flex:1;line-height:1.5">${message}</span>
            <span style="opacity:0.5;cursor:pointer;font-size:16px" onclick="this.parentElement.remove()">✕</span>
        `;

        toast.onclick = () => toast.remove();

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(100%)";
            toast.style.transition = "all 0.3s";
            setTimeout(() => toast.remove(), 300);
        }, duration);

    },

    success(msg, dur) { this.toast(msg, "success", dur); },
    error(msg, dur)   { this.toast(msg, "error", dur); },
    warning(msg, dur) { this.toast(msg, "warning", dur); },
    info(msg, dur)    { this.toast(msg, "info", dur); },

    /* ============================================================
       CONFIRM DIALOG
    ============================================================ */

    confirm(message, onYes, onNo) {
        if (window.confirm(message)) {
            if (typeof onYes === "function") onYes();
        } else {
            if (typeof onNo === "function") onNo();
        }
    },

    /* ============================================================
       BELL BADGE — update notification count in topbar
    ============================================================ */

    setBadge(count) {
        const badge = document.getElementById("notifBadge");
        if (!badge) return;
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = count > 0 ? "flex" : "none";
    },

    /* ============================================================
       PLAY SOUND ALERT
    ============================================================ */

    sound(type = "ding") {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = type === "ding" ? 880 : 440;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {}
    }

};

/* ================================================================
   INJECT ANIMATION CSS once
================================================================ */

(function () {
    if (document.getElementById("erp-toast-css")) return;
    const style = document.createElement("style");
    style.id = "erp-toast-css";
    style.textContent = `
        @keyframes erp-slide-in {
            from { transform: translateX(110%); opacity: 0; }
            to   { transform: translateX(0);   opacity: 1; }
        }
    `;
    document.head.appendChild(style);
})();

/* ================================================================
   GLOBAL SHORTHAND
================================================================ */

function showToast(msg, type, dur)  { NotificationEngine.toast(msg, type, dur); }
function showSuccess(msg)           { NotificationEngine.success(msg); }
function showError(msg)             { NotificationEngine.error(msg); }
function showWarning(msg)           { NotificationEngine.warning(msg); }
function showInfo(msg)              { NotificationEngine.info(msg); }

console.log("[NOTIFICATION ENGINE] Loaded");
