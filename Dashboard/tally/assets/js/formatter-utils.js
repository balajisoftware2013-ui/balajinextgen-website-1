/*
================================================================
BALAJI NEXTGEN ERP
F017 - FORMATTER UTILS
Currency, date, text, GST, invoice number formatting.
================================================================
*/

const FormatterUtils = {

    /* ============================================================
       CURRENCY — Indian format ₹1,23,456.00
    ============================================================ */

    currency(amount, symbol = "₹") {
        if (amount === null || amount === undefined || amount === "") return symbol + "0.00";
        return symbol + Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /* ============================================================
       NUMBER — 1,23,456
    ============================================================ */

    number(val) {
        if (!val && val !== 0) return "0";
        return Number(val).toLocaleString("en-IN");
    },

    /* ============================================================
       DATE formats
    ============================================================ */

    date(dateStr, format = "DD MMM YYYY") {
        if (!dateStr) return "--";
        try {
            const d = new Date(dateStr);
            const day   = String(d.getDate()).padStart(2, "0");
            const month = d.toLocaleString("en-IN", { month: "short" });
            const year  = d.getFullYear();

            if (format === "DD MMM YYYY") return `${day} ${month} ${year}`;
            if (format === "DD/MM/YYYY")  return `${day}/${String(d.getMonth()+1).padStart(2,"0")}/${year}`;
            if (format === "YYYY-MM-DD")  return `${year}-${String(d.getMonth()+1).padStart(2,"0")}-${day}`;
            return d.toLocaleDateString("en-IN");
        } catch {
            return dateStr;
        }
    },

    dateTime(dateStr) {
        if (!dateStr) return "--";
        try {
            const d = new Date(dateStr);
            return d.toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        } catch { return dateStr; }
    },

    /* ============================================================
       TODAY / NOW
    ============================================================ */

    today(format = "DD MMM YYYY") {
        return this.date(new Date().toISOString(), format);
    },

    todayISO() {
        return new Date().toISOString().slice(0, 10);
    },

    /* ============================================================
       INVOICE NUMBER — INV-2026-0001
    ============================================================ */

    invoiceNo(prefix, serial) {
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${String(serial).padStart(4, "0")}`;
    },

    /* ============================================================
       GST DISPLAY — 18.00%
    ============================================================ */

    gstRate(rate) {
        return Number(rate).toFixed(2) + "%";
    },

    /* ============================================================
       PHONE DISPLAY — +91 98765 43210
    ============================================================ */

    phone(mobile) {
        if (!mobile) return "--";
        const s = String(mobile).replace(/\D/g, "");
        if (s.length === 10) return "+91 " + s.slice(0, 5) + " " + s.slice(5);
        return mobile;
    },

    /* ============================================================
       INITIALS — "Balaji Kumar" → "BK"
    ============================================================ */

    initials(name) {
        if (!name) return "??";
        return name.trim().split(" ")
            .map(w => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    },

    /* ============================================================
       TRUNCATE TEXT
    ============================================================ */

    truncate(text, maxLen = 40) {
        if (!text) return "";
        return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
    },

    /* ============================================================
       STATUS BADGE HTML
    ============================================================ */

    badge(status) {
        const colors = {
            ACTIVE:   "#dcfce7:#166534",
            INACTIVE: "#fef9c3:#854d0e",
            BLOCKED:  "#fef2f2:#991b1b",
            PENDING:  "#eff6ff:#1e40af",
            PAID:     "#dcfce7:#166534",
            UNPAID:   "#fef2f2:#991b1b",
            PARTIAL:  "#fef9c3:#854d0e"
        };
        const pair = (colors[String(status).toUpperCase()] || "#f1f5f9:#475569").split(":");
        return `<span style="background:${pair[0]};color:${pair[1]};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${status}</span>`;
    }

};

/* Global shorthand */
function fCurrency(v)         { return FormatterUtils.currency(v); }
function fDate(d)             { return FormatterUtils.date(d); }
function fDateTime(d)         { return FormatterUtils.dateTime(d); }
function fNumber(v)           { return FormatterUtils.number(v); }
function fPhone(m)            { return FormatterUtils.phone(m); }
function fInitials(n)         { return FormatterUtils.initials(n); }
function fBadge(s)            { return FormatterUtils.badge(s); }

console.log("[FORMATTER UTILS] Loaded");
