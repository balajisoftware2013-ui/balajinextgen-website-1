/*
================================================================
BALAJI NEXTGEN ERP
F011 - DASHBOARD UI ENGINE
Dashboard cards, charts, live data rendering.
================================================================
*/

const DashboardUI = {

    /* ============================================================
       LOAD DASHBOARD DATA from backend
    ============================================================ */

    async loadData(dashboardType = "MAIN") {

        try {

            const result = await apiRequest("GET_DASHBOARD", {
                dashboardType,
                clientId: StorageEngine.getClient(),
                branch:   StorageEngine.getBranch(),
                role:     StorageEngine.getRole()
            });

            if (result && result.success) {
                return result.data;
            }

        } catch (e) {
            console.error("[DASHBOARD] Load error:", e);
        }

        return null;

    },

    /* ============================================================
       RENDER STAT CARD
    ============================================================ */

    renderStatCard(elementId, value, label, icon = "📊", trend = null) {

        const el = document.getElementById(elementId);
        if (!el) return;

        const trendHTML = trend !== null
            ? `<span class="trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? "▲" : "▼"} ${Math.abs(trend)}%</span>`
            : "";

        el.innerHTML = `
            <div class="stat-icon">${icon}</div>
            <div class="stat-body">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${label}</div>
                ${trendHTML}
            </div>
        `;

    },

    /* ============================================================
       RENDER TABLE
    ============================================================ */

    renderTable(tableId, headers, rows, actions = false) {

        const table = document.getElementById(tableId);
        if (!table) return;

        let html = `<table class="erp-table">
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}${actions ? "<th>Action</th>" : ""}</tr></thead>
            <tbody>`;

        if (rows.length === 0) {
            html += `<tr><td colspan="${headers.length + (actions ? 1 : 0)}" style="text-align:center;color:#94a3b8;padding:24px">No records found</td></tr>`;
        } else {
            rows.forEach((row, idx) => {
                html += `<tr>${row.map(cell => `<td>${cell ?? ""}</td>`).join("")}`;
                if (actions) {
                    html += `<td><button class="erp-btn-sm" onclick="onTableAction(${idx})">View</button></td>`;
                }
                html += `</tr>`;
            });
        }

        html += "</tbody></table>";
        table.innerHTML = html;

    },

    /* ============================================================
       SHOW LOADER inside element
    ============================================================ */

    showLoader(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = `<div class="erp-loader"><div class="erp-spinner"></div><p>Loading...</p></div>`;
        }
    },

    hideLoader(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.innerHTML = "";
    },

    /* ============================================================
       FORMAT CURRENCY (Indian format)
    ============================================================ */

    formatCurrency(amount, symbol = "₹") {
        if (!amount && amount !== 0) return symbol + "0";
        return symbol + Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /* ============================================================
       FORMAT DATE
    ============================================================ */

    formatDate(dateStr) {
        if (!dateStr) return "--";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric"
            });
        } catch {
            return dateStr;
        }
    },

    /* ============================================================
       STATUS BADGE
    ============================================================ */

    badge(status) {
        const map = {
            ACTIVE:   "badge-success",
            INACTIVE: "badge-warning",
            BLOCKED:  "badge-danger",
            PENDING:  "badge-info",
            PAID:     "badge-success",
            UNPAID:   "badge-danger",
            PARTIAL:  "badge-warning"
        };
        const cls = map[String(status).toUpperCase()] || "badge-info";
        return `<span class="erp-badge ${cls}">${status}</span>`;
    }

};

/* ================================================================
   GLOBAL SHORTHAND
================================================================ */

function formatCurrency(v) { return DashboardUI.formatCurrency(v); }
function formatDate(d)     { return DashboardUI.formatDate(d); }

console.log("[DASHBOARD UI ENGINE] Loaded");
