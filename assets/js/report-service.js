/*
================================================================
BALAJI NEXTGEN ERP
F014 - REPORT SERVICE
Report APIs and Excel/PDF export services.
================================================================
*/

const ReportService = {

    /* ============================================================
       FETCH REPORT DATA
    ============================================================ */

    async getReport(reportType, filters = {}) {
        return await apiRequest("GET_REPORT", {
            reportType,
            clientId: StorageEngine.getClient(),
            branch:   StorageEngine.getBranch(),
            ...filters
        });
    },

    async getSalesReport(dateFrom, dateTo) {
        return await this.getReport("SALES", { dateFrom, dateTo });
    },

    async getPurchaseReport(dateFrom, dateTo) {
        return await this.getReport("PURCHASE", { dateFrom, dateTo });
    },

    async getInventoryReport() {
        return await this.getReport("INVENTORY");
    },

    async getGSTReport(month, year) {
        return await this.getReport("GST", { month, year });
    },

    async getDashboardReport() {
        return await this.getReport("DASHBOARD");
    },

    /* ============================================================
       EXPORT TO CSV (client-side)
    ============================================================ */

    exportCSV(data, filename = "report") {

        if (!data || data.length === 0) {
            showWarning("No data to export");
            return;
        }

        const headers = Object.keys(data[0]);
        const rows    = data.map(row => headers.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(","));
        const csv     = [headers.join(","), ...rows].join("\n");

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = filename + "_" + new Date().toISOString().slice(0, 10) + ".csv";
        a.click();
        URL.revokeObjectURL(url);

        showSuccess("Exported: " + a.download);

    },

    /* ============================================================
       PRINT (opens print dialog)
    ============================================================ */

    print(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const w = window.open("", "_blank");
        w.document.write(`
            <html><head><title>Balaji NextGen ERP Report</title>
            <style>body{font-family:Arial,sans-serif;font-size:12px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ccc;padding:6px;text-align:left}
            th{background:#1e3a8a;color:#fff}</style></head>
            <body>${el.innerHTML}</body></html>
        `);
        w.document.close();
        w.print();
    }

};

console.log("[REPORT SERVICE] Loaded");
