# Balaji GST Compliance Workspace — GST-2026.10.20-v3

Workflow upgrade informed by ExpressGST's published client, return activity, purchase reconciliation and exception-review workflows. This is Balaji software, not ExpressGST, and is not feature-equivalent to that connected commercial service.

## Added

- Blue compliance workspace header, workflow steps and source/exception counts.
- Client profile creation and a workspace scoped by client ID plus GSTIN. Save/restore is explicit and on this device only. Save/export before changing clients or closing the page. Server multi-user client management is not implemented.
- Purchase/2B reconciliation for a month range; exact match, amount mismatch, missing-in-books, missing-in-2B, ambiguous duplicate and possible-date mismatch classifications. Date suggestions are not treated as matched.
- Configurable Rs 0–10 tax-head tolerance, supplier/invoice search, status filter, supplier summary, per-head differences, filtered CSV and print.
- Local review notes with Accept/Reject/Pending suggestions. These are NOT GST IMS actions and are never submitted to GSTN.
- Purchase register CSV import and normalized JSON import; common GSTN GSTR-2B JSON docdata.b2b invoice structure, including recipient GSTIN and return-period checks. Other nonempty document sections are rejected rather than silently ignored. No Excel importer or full GSTN schema compatibility is claimed.
- Previous v2 read-only Tally purchase sync retained, with explicit input-tax ledger mappings. Previous accounting/item-mode sales tools remain.
- Return activity evidence, source workpapers and rule-based checks retained. Portal connection status stays disconnected.

## Use

1. Back up your existing files. Replace gst.html on your website. Keep the existing server configuration; this upgrade does not add a GSTN/GSP backend.
2. Use Client profile to enter client ID, company, GSTIN, state code and exact Tally company.
3. Import purchase register and 2B. Or use the read-only Tally purchase tool on the dashboard.
4. Open 2B reconciliation. Select month range, status and supplier/invoice search. Review differences; export the filtered report.
5. Save on this device or export workpaper. Restore only after selecting the same client ID and GSTIN. Device storage is not an encrypted server backup; use the appropriate workstation access controls.

CSV columns (one invoice per row): invoiceNo,date,gstin,name,pos,total,roundOff,taxable,cgst,sgst,igst,cess. Dates: YYYY-MM-DD or DD-MM-YYYY. All tax heads must be numeric, using explicit 0 where appropriate. Quoted commas and quoted newlines are supported. The CSV route is invoice-total based; use normalized JSON for multiple tax/item lines. Both imports replace the currently loaded source array, not append. Review/save current work before import.

Common 2B JSON: recipient gstin; rtnprd MMYYYY; docdata.b2b[] suppliers with ctin, inv[]; invoices have inum, dt, val, pos and items[] (txval,cgst,sgst,igst,cess). Variants and annual/credit-note/ISD/import sections require additional adapters. Unsupported nonempty sections cause rejection. Source identity and sums are checked; actual GST registration, GSTIN checksum and ITC eligibility are not verified.

## What is NOT connected

No GSTN portal download/upload, actual IMS Accept/Reject/Pending, IRN generation/cancellation, tax payment or final return filing. GSTR-1/3B and annual views are source workpapers, not complete return schemas. No fabricated statuses, GST splits or ITC eligibility. No full ExpressGST parity, 10,000-client capacity, live browser/phone compatibility or TallyPrime 7.2 compatibility certification.

An authorised IRP/GSP backend, secure server-side authentication, complete return schemas and live sandbox tests are still required for a connected filing service. Never store portal passwords or client secrets in this HTML.

## Tests

Three inline scripts compile. Synthetic tests cover exact/date/ambiguous/missing/amount mismatch results, quoted CSV, common 2B import, GSTIN scope and case-insensitive duplicate rejection. No live filing, Tally posting or browser visual tests were performed.

## Product reference

ExpressGST official feature and reconciliation workflows:
https://www.expressgst.com/features-of-expressgst/
https://www.expressgst.com/smart-reconciliation/
https://www.expressgst.com/ims-console/
