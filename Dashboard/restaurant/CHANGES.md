# What changed — Reports Hub + Daily Sales Report fix

## restaurant-dashboard.html — Reports Hub (all 25+ reports)

Every report card across all 10 tabs (Sales, DSR, Reconciliation, Cancellations,
Tax, Items, Accounts, Operations, Online, GST) now has the same action bar:

  📥 Excel   📄 PDF   🖨 Print ▾ (A4 / POS 80mm)   💬 WA

- **Excel** — unchanged, existing export.
- **PDF** — opens the same clean GST-style formatted view as before, ready to
  "Save as PDF" from the browser's print dialog.
- **Print ▾** — click opens a small popup to choose:
  - **A4 / Office Printer** — same wide table layout as PDF.
  - **POS · 80mm Thermal** — a condensed receipt-style layout (302px wide,
    monospace, dashed separators) sized for a thermal printer, built from
    the same on-screen table data.
- **WA (WhatsApp)** — captures the report card as a JPG image (same colours/
  theme as on screen) and opens WhatsApp so you can attach it in one tap.
  This works the same way the existing Monthly DSR WhatsApp button already did.

The Monthly DSR and Reconciliation cards, which already had some of these
buttons, were cleaned up to use the same unified bar instead of duplicate buttons.

### Category colour-coding
Each of the 10 report tabs now has its own accent colour (active tab pill +
left border stripe on every card in that tab), so it's clear at a glance
which section you're in:
Sales=amber gold, DSR=blue, Reconciliation=cyan, Cancellations=red,
Tax=purple, Items=green, Accounts=teal, Operations=orange, Online=pink, GST=indigo.

## daily-sales-report.html — bug fix

Found and fixed a real bug: the page had **two separate, conflicting mobile
menu systems** — an old "☰" hamburger button whose `toggleSidebar()` function
looked for an element with `id="sidebar"` that didn't exist anywhere on the
page (it only had `class="sidebar"`), so clicking it silently crashed and did
nothing. A second, newer menu system (the blue circular toggle + slide-out
overlay) was also present and working correctly, so the two were stacked on
top of each other on mobile.

Removed the broken/duplicate old hamburger button, its dead CSS, and the
crashing `toggleSidebar()` function. The working slide-out menu is now the
only mobile menu, and the sidebar element got a proper `id="sidebar"` for
robustness. Kept the existing navy/cream colour theme as-is, per your call.

Everything else (KPIs, MTD panel, category/collection/online tables, CSV
export, Drive save) was already working correctly and untouched.
