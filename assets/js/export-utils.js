/*
================================================================
BALAJI NEXTGEN ERP
F018 - EXPORT UTILS
PDF and Excel export system for reports and invoices.
================================================================
*/

const ExportUtils = {

    /* ============================================================
       EXPORT TABLE TO CSV
    ============================================================ */

    tableToCSV(tableId, filename = "export") {

        const table = document.getElementById(tableId);
        if (!table) { showError("Table not found"); return; }

        const rows = Array.from(table.querySelectorAll("tr"));
        const csv  = rows.map(row =>
            Array.from(row.querySelectorAll("th, td"))
                .map(cell => `"${cell.innerText.replace(/"/g, '""')}"`)
                .join(",")
        ).join("\n");

        this._downloadFile("\uFEFF" + csv, filename + ".csv", "text/csv");
        showSuccess("CSV exported successfully");

    },

    /* ============================================================
       EXPORT JSON DATA TO CSV
    ============================================================ */

    jsonToCSV(data, filename = "export") {

        if (!data || data.length === 0) { showWarning("No data to export"); return; }

        const headers = Object.keys(data[0]);
        const rows    = data.map(row =>
            headers.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")
        );

        const csv = [headers.join(","), ...rows].join("\n");
        this._downloadFile("\uFEFF" + csv, filename + "_" + FormatterUtils.todayISO() + ".csv", "text/csv");
        showSuccess("Exported: " + filename);

    },

    /* ============================================================
       PRINT PAGE SECTION
    ============================================================ */

    printSection(elementId, title = "Balaji NextGen ERP Report") {

        const el = document.getElementById(elementId);
        if (!el) { showError("Print section not found"); return; }

        const w = window.open("", "_blank");
        w.document.write(`<!DOCTYPE html><html><head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
                th { background: #1e3a8a; color: #fff; }
                .no-print { display: none !important; }
                h2 { color: #1e3a8a; }
            </style>
        </head><body>
            <h2>${title}</h2>
            <p style="color:#64748b">Printed: ${FormatterUtils.dateTime(new Date().toISOString())}</p>
            ${el.innerHTML}
        </body></html>`);
        w.document.close();
        setTimeout(() => { w.print(); w.close(); }, 500);

    },

    /* ============================================================
       PRINT INVOICE (special layout)
    ============================================================ */

    printInvoice(invoiceHTML, title = "Invoice") {

        const w = window.open("", "_blank");
        w.document.write(`<!DOCTYPE html><html><head>
            <title>${title}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
                @page { size: A4; margin: 10mm; }
            </style>
        </head><body>${invoiceHTML}</body></html>`);
        w.document.close();
        setTimeout(() => { w.print(); w.close(); }, 500);

    },

    /* ============================================================
       DOWNLOAD FILE HELPER
    ============================================================ */

    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

};

/* Global shorthand */
function exportCSV(tableId, filename) { ExportUtils.tableToCSV(tableId, filename); }
function printSection(id, title)      { ExportUtils.printSection(id, title); }

console.log("[EXPORT UTILS] Loaded");
