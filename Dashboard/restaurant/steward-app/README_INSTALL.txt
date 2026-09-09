STEWARD MOBILE FINAL DEPLOYMENT PACKAGE

Deploy steward-mobile.html, manifest.json, sw.js and icons/ together in the same web directory.
Use Code.gs as the paired V2_CORE backend source.

Allowed Steward Mobile login roles:
CAPTAIN, STEWARD, CHEF, SUPER_ADMIN

CAPTAIN/STEWARD see their own active KOTs. CHEF/SUPER_ADMIN can see all active KOTs.
Online Orders reads the client's ONLINE_ORDER_MASTER; external Zomato/Swiggy/EasyDiner/ONDC feeds must write/import into that sheet for live orders to appear.
