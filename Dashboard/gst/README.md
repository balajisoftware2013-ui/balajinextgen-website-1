# GST preparation tools — GST-2026.10.20-v1

Target requested: TallyPrime 7.2. Version-specific live compatibility has not been tested. This package is a preparation and source-checking module, not a complete TallyPrime replacement or production GST filing service.

## What changed

The original file used purchase-side 2B invoices in GSTR-1, fixed GSTIN/April-2025 exports, hardcoded Filed statuses, estimated tax-head percentage splits and upload messages without parsing. Those sample-based outputs are removed. The original sidebar and visual styling are retained, while report contents now use imported source records.

Added:
- Month-wise return activity tracker inspired by the supplied Tally screenshot. Status remains Unknown until filing evidence is imported. Imported ARN evidence is displayed as evidence, not independently verified portal status.
- Sales, books-purchase and 2B source separation; period filtering; invoice component and duplicate checks; client ID checks.
- Invoice/date/GSTIN-format validation; recorded CGST, SGST, IGST and cess. GSTIN checksum/registration and tax applicability are not verified.
- Books versus 2B comparison using GSTIN, invoice number and date. Amount tolerance is Rs 1; this is a basic comparison, not the complete IMS/ITC decision workflow.
- Rule-based AI/data checks. No language-model API is connected and no data is sent to an external AI service.
- Tally sales voucher XML with or without stock-item lines, plus direct posting through the local connector. Existing ledgers/stock masters are required. GST classification/master tax configuration must be reviewed in Tally.
- IRP draft payload identity checks and export. Full IRP-schema validation and IRN generation are NOT implemented.

## Install and source import

1. Review in a test copy first. Replace gst.html at your existing website path when ready; retain erp-config.js for your surrounding site.
2. Open Import JSON. Fill source_template.json with your real client profile and records. The import replaces the current in-memory dataset. Export a workpaper before leaving; no server save or automatic restoration is implemented.
3. The required profile fields are client.clientId, client.name and client.gstin. Tally uses client.tallyCompany and client.ledgers.cgst/sgst/igst/cess/roundOff.
4. sales, books and portal2b are independent arrays of normalized invoices. Raw GSTN JSON, Excel, CSV, POS database files and native Tally XML need adapters before import; this module does not silently pretend to parse them.
5. Invoice fields: invoiceNo, date (YYYY-MM-DD), pos (two-digit state code), gstin (counterparty; blank allowed for unregistered), name, total, roundOff and items. Each item needs taxable, cgst, sgst, igst, cess as explicit numbers. Total must equal their sum plus roundOff. Negative notes and unsupported supply classifications need a separate workflow.
6. Tally fields per invoice: partyLedger and salesLedger; item mode also requires item.name, item.qty > 0 and item.unit. Ledger and stock-item names must already match Tally exactly.
7. filings entries: gstin, period (YYYY-MM), returnType, correctionsNeeded, pendingUpload, reconciliationExceptions and arn where available. Do not label a filing verified just because data was downloaded.
8. irpPayloads accepts separately prepared draft IRP objects. Seller GSTIN must match the client. Export is still DRAFT and has not passed full schema/applicability validation.

## Tally direct connection

Install Python 3 on the Tally PC. Extract the package to a permanent folder and run START_TALLY_CONNECTOR.bat. Enable Tally's HTTP server on port 9000. The browser talks to the connector at http://127.0.0.1:9001. The connector permits the two balajinextgen.in website origins only. Opening gst.html as a local file will not permit direct posting; file-based XML download remains available.

The connector records attempts in tally_posting_journal.sqlite3 beside the script and blocks repeated company/invoice attempts. Keep that journal. A lost/failed reply requires Day Book reconciliation; do not delete the journal to force a repost. Posting sends one invoice at a time and requires CREATED=1. No background posting is enabled. XML download itself does not prevent manual duplicate imports.

## What remains before actual filing

- Authorised IRP/GSP provider, server-side credential handling, authentication, current schema validation, sandbox tests and production onboarding.
- GST return schema generation for every applicable table, amendments/notes, supply/HSN classification, RCM, ITC eligibility/reversals, challans and cash/credit ledger handling.
- Portal upload and processing/error reconciliation; final filing with applicable DSC/EVC and acknowledgement capture.
- Live accounting validation, GST portal/IRP acceptance, TallyPrime 7.2 tests, browser/mobile tests and capacity testing.

The current downloads are labelled WORKPAPER_NOT_PORTAL_RETURN_JSON. They cannot be uploaded as complete GST returns. No return was filed, no IRN was generated and no live Tally voucher was posted during this work.

## Validation completed

JavaScript compilation; invoice balance/date/mixed-tax validation; duplicate and cross-client rejection; matching/missing-in-2B checks; 2B cannot enter sales reports; unknown filing state; both Tally XML modes and XML parse checks. Tests used synthetic fixtures, not production posting.

## Official references checked

- GST GSTR-1 preparation and filing: https://tutorial.gst.gov.in/userguide/returns/Creation_of_Outward_Supplies_Return_in_GSTR-1.htm
- IRP API credentials: https://einvoice6.gst.gov.in/content/kb/api-credentials/
- Tally XML integration: https://help.tallysolutions.com/xml-integration/
