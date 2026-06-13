/*
================================================================
BALAJI NEXTGEN ERP
F019 - DATE UTILS
Date/time helpers: ranges, Indian fiscal year, GST periods.
================================================================
*/

const DateUtils = {

    /* ============================================================
       TODAY, YESTERDAY, THIS WEEK, THIS MONTH
    ============================================================ */

    today() {
        return new Date().toISOString().slice(0, 10);
    },

    yesterday() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    },

    thisWeekStart() {
        const d = new Date();
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return d.toISOString().slice(0, 10);
    },

    thisMonthStart() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    },

    thisMonthEnd() {
        const d = new Date();
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return last.toISOString().slice(0, 10);
    },

    /* ============================================================
       INDIAN FISCAL YEAR (April to March)
    ============================================================ */

    fiscalYearStart() {
        const now = new Date();
        const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        return `${year}-04-01`;
    },

    fiscalYearEnd() {
        const now = new Date();
        const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
        return `${year}-03-31`;
    },

    fiscalYearLabel() {
        const start = new Date(this.fiscalYearStart());
        const end   = new Date(this.fiscalYearEnd());
        return `FY ${start.getFullYear()}-${String(end.getFullYear()).slice(2)}`;
    },

    /* ============================================================
       GST PERIOD (monthly)
    ============================================================ */

    gstPeriod(monthsBack = 0) {
        const d = new Date();
        d.setMonth(d.getMonth() - monthsBack);
        return {
            month: String(d.getMonth() + 1).padStart(2, "0"),
            year:  d.getFullYear(),
            label: d.toLocaleString("en-IN", { month: "long", year: "numeric" })
        };
    },

    /* ============================================================
       QUICK DATE RANGES (for report filters)
    ============================================================ */

    getRange(preset) {
        const ranges = {
            "TODAY":        { from: this.today(),          to: this.today() },
            "YESTERDAY":    { from: this.yesterday(),      to: this.yesterday() },
            "THIS_WEEK":    { from: this.thisWeekStart(),  to: this.today() },
            "THIS_MONTH":   { from: this.thisMonthStart(), to: this.thisMonthEnd() },
            "LAST_30_DAYS": { from: this._daysAgo(30),     to: this.today() },
            "LAST_90_DAYS": { from: this._daysAgo(90),     to: this.today() },
            "THIS_YEAR":    { from: this.fiscalYearStart(),to: this.fiscalYearEnd() }
        };
        return ranges[preset] || { from: this.today(), to: this.today() };
    },

    _daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString().slice(0, 10);
    },

    /* ============================================================
       DATE DIFF in days
    ============================================================ */

    daysBetween(dateFrom, dateTo) {
        const a = new Date(dateFrom);
        const b = new Date(dateTo);
        return Math.round(Math.abs((b - a) / (1000 * 60 * 60 * 24)));
    },

    /* ============================================================
       IS EXPIRED
    ============================================================ */

    isExpired(dateStr) {
        return new Date(dateStr) < new Date();
    },

    /* ============================================================
       FILL DATE INPUTS with defaults
    ============================================================ */

    fillDateRange(fromId, toId, preset = "THIS_MONTH") {
        const range = this.getRange(preset);
        const fromEl = document.getElementById(fromId);
        const toEl   = document.getElementById(toId);
        if (fromEl) fromEl.value = range.from;
        if (toEl)   toEl.value   = range.to;
    }

};

/* Global shorthand */
function getDateRange(preset)        { return DateUtils.getRange(preset); }
function getFiscalYear()             { return DateUtils.fiscalYearLabel(); }
function fillDateRange(f, t, preset) { DateUtils.fillDateRange(f, t, preset); }

console.log("[DATE UTILS] Loaded");
