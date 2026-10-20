# Direct Tally purchase read — GST-2026.10.20-v2

Reads purchase vouchers from the selected Tally company and month into Books for 2B reconciliation. It does not create, change or delete Tally purchases. This release is locally fixture-tested; no live TallyPrime 7.2 connection has been verified.

## Install

1. Keep a backup of the current GST HTML and connector folder.
2. Replace gst.html on your website. Extract tally_connector.py and tally_purchase.py together into your existing connector folder, retaining tally_posting_journal.sqlite3.
3. Stop the old connector, then run START_TALLY_CONNECTOR.bat. Python 3 is required. Open TallyPrime, load the company, enable its HTTP server on port 9000.
4. Open GST page and import your client profile as before. Select the desired month and enter the exact Tally company name.
5. Under Read purchases from Tally, enter comma-separated exact ledger names for Purchase taxable base, Input CGST, Input SGST, Input IGST, Cess and Round Off. Leave unused roles blank. Do not map one ledger into two roles.
6. Enter the two-digit place-of-supply fallback only after verifying it. It is used where the export does not provide a state code; it does not alter recorded GST amounts.
7. Click Sync purchases from Tally. If there are exceptions, existing Books remain unchanged. Review the invoice list and correct the mappings/data. No automatic retry occurs.
8. Successful sync replaces Books for that selected period, preserving other periods. Open 2B vs Books Reconciliation.

## What is read

Supplier invoice reference, supplier name/GSTIN, voucher date/number, supplier reference date where exported, taxable purchase ledger/inventory allocations, input tax amounts and round off. Supplier reference date is used for matching where available; otherwise voucher date is retained and labelled for verification. The selected month is the voucher/booking month, which can differ from the supplier invoice month.

Cancelled and optional vouchers are excluded by the Tally export filter. The filter uses Tally's purchase-voucher family. Credit notes, debit notes/reversals, missing supplier GSTIN, unknown charge ledgers and unbalanced vouchers require separate review; they are not silently treated as eligible ITC. This is not a complete statutory purchase register covering all voucher classes or RCM/import documents.

No GST is inferred from a rate or percentage split. Explicit ledger mappings must agree with your Tally GST configuration. Existing expense/freight/discount ledgers require a deliberate mapping and tax review; do not map them arbitrarily just to force a balance.

## Current limits

Raw GSTN 2B JSON/Excel still needs conversion to the normalized source format documented in the v1 README. Portal downloads, IRN generation and return filing remain unconnected. Books/2B data is held in memory; export the workpaper before leaving the page. Multi-registration Tally companies and unusual TDL/custom voucher layouts need live validation before production use. Imports do not independently verify company GSTIN or supplier registration status.

The connector allows only https://www.balajinextgen.in and https://balajinextgen.in origins. Direct sync does not work from file://. Purchase response limit is 8 MiB per request. For larger companies a paginated backend is required.

## Tests

Synthetic purchase fixture: taxable 100, CGST 2.50, SGST 2.50, supplier total 105. Passed balance checks, unmapped-ledger and missing-GSTIN rejection, month boundaries and read-only request construction. JavaScript compiles. Live Tally, browser local-network permissions, inventory-mode export variation and 10,000-client scale remain unverified.
