# Reports Hub check and corrections

Build: RD-2026.10.20-v3. Report engine marker: REPORTS-2026.10.20-v3.

45 report catalogue entries were checked: 43 internal connected-renderer routes, one internal SmartCard report explicitly marked source not connected, and one external Client DSR page.

## Applied corrections

- Keep a separate report job in each lazy-load callback.
- Wire Reprint to the existing audit renderer.
- Return asynchronous report work to the caller and lazy-load limiter.
- Wait for background refresh in local report loading.
- Check both range endpoints before redrawing saved-data reports.
- Do not show failed summary sources as zero figures.
- Handle uppercase invoice totals and retain genuine zero summary amounts.
- Deduplicate invoices across all item groups.
- Use the global unique invoice count in the group total.
- Exclude stale/loading/failed reports from Print All.
- Exclude stale/loading/failed reports from Export All.
- Avoid argument-limit crashes on large Excel exports.
- Guard sheet-view export actions as well as table export actions.
- Return 14 legacy asynchronous report reads.
- Clear GSTR summary placeholders when the source fails.
- Label outward GST separately from unconnected ITC.
- Export/print selected Cash Book or DSR table and support metric-only reports.
- Use the child report period on Excel and A4 letterheads.
- Use the actual visible report period in PDF metadata.
- Retain each report period in Print All.
- Print each report period on its own output page.
- Retain individual periods in Export All.
- Write the corresponding report period to each exported worksheet.

The report output guard coalesces identical loads, serializes changed filters for each report, and prevents output of pending, failed or stale results. Excel/PDF/A4/POS output uses the selected report table. Metric-only Average Preparation Time, Blind Till and GSTR-3B receive an export table derived from their displayed values.

## Validation performed

- Compiled 283 dashboard scripts and 867 static inline event handlers.
- Checked all registered internal report routes and static/dynamic card definitions. Exercised 43 connected renderer routes with controlled fixtures.
- Exercised queue identity, maximum two category loads, load coalescing, changed date ranges, stale/failed output blocking and visible table selection.
- Exercised the Excel HTML-workbook download, PDF builder/save, A4 and 80mm POS print content, popup blocking and missing PDF dependency handling.
- Exercised Export All and Print All with 5,000 report rows, excluding stale reports.
- Verified the created-date file changes only 41,581 damaged BILL_ITEMS.CREATED_AT values and their display/highlight formatting. Every financial field and all other values remain unchanged from the previously corrected database.

These are source-code and controlled engine checks. No authenticated live server, installed browser or physical printer was available for end-to-end verification. The 5,000-row test is an export/print content test, not a live concurrency or printer throughput test. This does not certify 10,000 simultaneous clients or zero network errors.

## Remaining connections and data issues

- SmartCard has no connected transaction source in the supplied frontend. It remains explicitly unavailable.
- GSTR-3B purchase ITC is not connected. Outward GST is labelled before ITC; a net tax payable figure is not fabricated.
- The earlier tax audit still has 289 overlapping source/calculation findings. The date/report fixes do not resolve those underlying records.
- Apps Script source and an authenticated live test are needed to verify each backend action, server totals, access controls, actual downloads and printer operation.
- The existing Excel single-report export remains a formatted Excel-compatible HTML .xls file; Export All uses the existing XLSX engine. PDF and image functions require the existing vendor/CDN libraries.

## Files to use

- Replace the hosted restaurant-dashboard.html with the included v3 file. Keep the site's existing erp-config.js, vendor libraries, assets and authentication files.
- The transaction workbook includes the prior 27 tax/discount/round-off cell corrections and the created-date repair. Dates use each linked bill's date, not a claimed original item-creation time.
- For the new date repair, update BILL_ITEMS.CREATED_AT from the corrected workbook. Only restored date cells are yellow. Master DB values require no change.
- Avoid replacing a running transaction database with an older snapshot containing fewer transactions. Preserve newer live entries and apply the corrected fields by BILL_ITEM_ID/BILL_ID.
- Client DSR and Steward HTML files are included unchanged from the preceding audited release. The master workbook is also unchanged.

## Report catalogue

| Report | Target | Check scope |
|---|---|---|
| Sale Summary Report | sale-summary | Frontend route/card checked; live backend pending |
| Sales Day Book | day-book | Frontend route/card checked; live backend pending |
| Cash Book Report | cash-book | Frontend route/card checked; live backend pending |
| Day Book Report | daybook-full | Frontend route/card checked; live backend pending |
| Monthly Sales Report | monthly-sales | Frontend route/card checked; live backend pending |
| Discount Report | discount | Frontend route/card checked; live backend pending |
| Debtors Report | debtors | Frontend route/card checked; live backend pending |
| Tips & Swipe Report | tips | Frontend route/card checked; live backend pending |
| Daily Sales Report | daily-sales | Frontend route/card checked; live backend pending |
| Client DSR | Client DSR | External page; source syntax checked |
| Monthly DSR Report | dsr-csv | Frontend route/card checked; live backend pending |
| Sale vs Bank Reconciliation | recon-csv | Frontend route/card checked; live backend pending |
| Cancelled Bill Report | cancelled-bills | Frontend route/card checked; live backend pending |
| NC (No Charge) Report | nc-report | Frontend route/card checked; live backend pending |
| Cancelled Items Report | cancelled-items | Frontend route/card checked; live backend pending |
| Re-Print Bill Report | reprint | Frontend route/card checked; live backend pending |
| Instruction Report | instruction | Frontend route/card checked; live backend pending |
| Tax Report (GST Summary) | tax-summary | Frontend route/card checked; live backend pending |
| Blind Till Management Report | blind-till | Frontend route/card checked; live backend pending |
| ItemWise Report | itemwise | Frontend route/card checked; live backend pending |
| Item Group Wise Report | item-group-wise | Frontend route/card checked; live backend pending |
| TimeWise Order Analysis | timewise | Frontend route/card checked; live backend pending |
| KOT Register Report | kot-register | Frontend route/card checked; live backend pending |
| Menu Category Wise Consumption Report | category-consumption | Frontend route/card checked; live backend pending |
| Time Wise Consumption Report | timewise-consumption | Frontend route/card checked; live backend pending |
| Consumption Report | consumption | Frontend route/card checked; live backend pending |
| KDS Report | kds | Frontend route/card checked; live backend pending |
| Customer Report | customer | Frontend route/card checked; live backend pending |
| User Table Mapped Report | user-table | Frontend route/card checked; live backend pending |
| SmartCard Transaction Report | smartcard | Source not connected |
| Average Preparation Time Report | avg-prep | Frontend route/card checked; live backend pending |
| Parcel Order Report | parcel | Frontend route/card checked; live backend pending |
| Reservation Report | reservation | Frontend route/card checked; live backend pending |
| Online Order Report | online-orders | Frontend route/card checked; live backend pending |
| GSTR-1 | gstr1 | Frontend route/card checked; live backend pending |
| GSTR-3B | gstr3b | Frontend route/card checked; live backend pending |
| Monthly Item Sales Report | monthly-item-sales | Frontend route/card checked; live backend pending |
| Food Cost & Sales Report | food-cost | Frontend route/card checked; live backend pending |
| Bar Cost & Sales Report | bar-cost | Frontend route/card checked; live backend pending |
| Kitchen Performance Report | kitchen-performance | Frontend route/card checked; live backend pending |
| Bar Performance Report | bar-performance | Frontend route/card checked; live backend pending |
| HashFreezer Sales Report | hashfreezer-sales | Frontend route/card checked; live backend pending |
| Maps & Location Report | maps-location | Frontend route/card checked; live backend pending |
| Menu Item Group Wise Report | item-group-sales | Frontend route/card checked; live backend pending |
| Auto Management Report | auto-management | Frontend route/card checked; live backend pending |
