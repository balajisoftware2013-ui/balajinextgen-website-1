╔══════════════════════════════════════════════════════════╗
║      BALAJI NextGen ERP — All Modules Linked             ║
║      Version: 4.0  |  Date: 2026-06-24                  ║
╚══════════════════════════════════════════════════════════╝

4 MODULES — ALL LINKED VIA SHARED DATABASE
═══════════════════════════════════════════

01_Purchase_Module.html   🛒  AI OCR invoice scanning, GRN, vendor management
02_Inventory_Module.html  📦  Stock in/out, 10 print formats, expiry, reorder
03_Sales_Module.html      🧾  POS, Quotation, Invoice, e-Invoice, e-Way Bill
04_Payments_Module.html   💳  Vendor payments, customer receipts, party ledger

HOW TO USE
══════════
1. Extract this ZIP to a single folder
2. Open any .html file in Chrome or Edge
3. Use the 2×2 grid at the BOTTOM of each sidebar to switch modules
4. All modules share data automatically via browser localStorage

SHARED DATA KEYS
════════════════
BALAJI_SHARED_DB      → Items/Products (shared across all modules)
BALAJI_PROCUREMENT    → Purchase invoices & vendor data
BALAJI_SMARTBILL_V2   → Sales invoices, POS bills, customer data
BALAJI_INVENTORY_DB   → Stock movements, batches, adjustments
BALAJI_PAYMENTS_DB    → Vendor payments, customer receipts

HOW MODULES LINK
════════════════
Purchase → saves invoices → Inventory auto-reads for Stock In
Sales    → saves invoices → Inventory auto-reads for Stock Out
Purchase → saves vendors  → Payments reads for Vendor Outstanding
Sales    → saves invoices → Payments reads for Customer Outstanding
Inventory → syncs items   → Purchase & Sales dropdowns update

CROSS-MODULE NAVIGATION
════════════════════════
Each module has a 2×2 grid at bottom of left sidebar:
  [🛒 Purchase]  [📦 Inventory]
  [🧾 Sales   ]  [💳 Payments ]
Click any icon to open that module in a new tab.

GOOGLE DRIVE SETUP (any module)
════════════════════════════════
Settings → Google Drive → Sign in with Google
All documents auto-save to:
  PURCHASE_DOCUMENTS / [Vendor] / [YYYY-MM] /
  SALES_DOCUMENTS    / [Customer] / [YYYY-MM] /
  INVENTORY_DOCUMENTS / [YYYY-MM] /

AI INVOICE SCANNING (Purchase Module)
══════════════════════════════════════
Claude AI   → console.anthropic.com/keys  (sk-ant-...)
ChatGPT     → platform.openai.com/api-keys (sk-proj-...)
Gemini FREE → aistudio.google.com/app/apikey (AIzaSy...)

Support: balajisoftware2013@gmail.com
Website: https://balajinextgensolution.netlify.app/
