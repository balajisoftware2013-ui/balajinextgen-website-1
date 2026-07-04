# Balaji NextGen ERP — Fixed Package

## ⚠️ Most important thing first: how you open these files matters

Do **not** just double-click the HTML files and open them from `file://`.
Browsers (especially Chrome) isolate `localStorage` per-file when pages are
opened directly from disk, so even with every code fix in place, the three
modules will look like they're not talking to each other.

Run a tiny local server from the root of this folder, then open it in the
browser:

```bash
# from the folder that contains inventory/, purchase/, sales/, erp-config.js
python3 -m http.server 8000
```

Then visit:
- `http://localhost:8000/inventory/inventory-module.html`
- `http://localhost:8000/purchase/purchase-module.html`
- `http://localhost:8000/sales/sales-module.html`

Any static server works (`npx serve`, VS Code "Live Server", etc.) — the
requirement is just that all three pages are served from the same origin.

## Folder structure (must be kept exactly like this)

```
/
├── erp-config.js
├── inventory/
│   ├── inventory-module.html
│   └── inventory-bridge.js
├── purchase/
│   └── purchase-module.html
└── sales/
    └── sales-module.html
```

The HTML files reference each other with relative paths
(`../inventory/inventory-bridge.js`, `./inventory-bridge.js`, etc.) — if you
rename or move the folders, update those `<script src>` tags too.

## What was actually broken

### 1. Inventory not affecting Purchase/Sales (the main complaint)
All three modules already contained calls like:
```js
if (typeof InventoryBridge !== 'undefined') {
  InventoryBridge.adjustStock(item, qty, reason);
}
```
...on every GRN receipt and every POS/invoice sale. But **`inventory-bridge.js`
was never included in your upload**, so `InventoryBridge` was always
`undefined` and every one of those calls was silently skipped. Stock only
looked right if you happened to open the Inventory module itself, which runs
its own one-way pull-sync on load.

**Fix:** wrote the real `inventory-bridge.js`. It writes stock adjustments
directly into the same `localStorage` data the Inventory module reads, so
a Purchase GRN or a Sales bill updates real stock immediately — even if the
Inventory module isn't open. It also refreshes the cached item/stock lists
Purchase and Sales keep for their own dropdowns, and the Inventory module now
listens for live storage updates so its dashboard refreshes instantly if you
have it open in another tab.

### 2. Accounting bug: inter-state purchases taxed as CGST+SGST instead of IGST
In the Purchase module, GST was **always** split 50/50 into CGST+SGST,
regardless of which state the vendor was registered in. Under GST law, a
purchase from a vendor in a different state must be **IGST-only** — mixing
this up misstates your Input Tax Credit and would cause mismatches when
filing GSTR-2B/3B.

**Fix:** the vendor's GSTIN state code (first 2 digits) is now compared
against your company's GSTIN state code (`27` / Maharashtra, from the sample
company profile in the app — update this if your registered state differs).
If they differ, the tax now goes entirely to IGST; otherwise it's still
split CGST/SGST as before. This is applied consistently in the live invoice
calculator, in what actually gets saved on each purchase record, and in the
GST analytics report (which previously also assumed a flat 50/50 split of
total GST, even for interstate purchases).

If a vendor has no GSTIN on file, the app can't know their state, so it
still defaults to intra-state (the old behaviour) — add the vendor's GSTIN
to get an accurate split.

> Note: the Sales module's GST split was already handling this correctly
> (it compares customer state to company state), so no change was needed
> there.

## Scope of this review

Given the size of the three apps (600KB+ of code together), this pass
focused on the specific issue you flagged (cross-module sync) plus the GST
split bug it led me to while checking the accounting logic end-to-end. I
didn't do a line-by-line audit of every ledger, report, or GST edge case
(TCS/TDS handling, e-invoicing, round-off rules, etc.) — happy to dig into
any specific area you're unsure about next.
