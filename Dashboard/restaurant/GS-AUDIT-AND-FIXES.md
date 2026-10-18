# GS audit — 18 Oct 2026
Files read: `DSR_ItemGroupEngine.gs` (v3) and `08_CoreRouter.gs`.

## 1. Why the console says "DSR_ITEM_GROUP_CALC not read"
`dsr-client.html` asks the backend for the tab in two ways: `RD_FETCH_SHEET`, then a direct POST `{action:"DSR_ITEM_GROUP_CALC"}` to 3 deployments.
`08_CoreRouter.gs` has **no case** for `DSR_ITEM_GROUP_CALC`, so the direct call returns "Unknown action".
The engine's own header asks for this one line, and it was never added.

**Fix A — add to `handleSingleAction` in the router that serves those deployments (before `default:`):**
```js
    case 'DSR_ITEM_GROUP_CALC':
      if (typeof bnxIgcApi_ === 'function') return bnxIgcApi_(body);
      return { status:'error', message:'Unknown action: DSR_ITEM_GROUP_CALC (DSR_ItemGroupEngine.gs not in this project)' };
```
Then: run `RUN_19_BuildDsrItemGroups`, run `RUN_20_InstallDsrItemGroupTrigger`, **Deploy → Manage deployments → New version**.

## 2. Engine: DB lookup misses the function your router really uses
`bnxIgcOpenDb_` tries `getClientDbId_`, `rbClientSpreadsheetId_`, … but your router calls **`getClientDbId(clientId,'TRANSACTION')`** (no underscore).
Today it only works because `BNX_IGC_DB_IDS` hard-codes CL00010 / CL00011; a new client would fail until its ID is pasted.

**Fix B — in `bnxIgcOpenDb_`, change the list to start with:**
```js
  [['getClientDbId', [cid, 'TRANSACTION']], ['getClientDbId_', [cid, 'TRANSACTION']], ['rbClientSpreadsheetId_', [cid, 'TRANSACTION']], ['getClientDbId_', [cid]], ...
```
(keep the rest of the existing entries after it).

## 3. Router coverage vs what the dashboard calls
The dashboard + DSR call **152** backend actions. `08_CoreRouter.gs` has cases for only **18** of them:
APPROVE_ISSUE_INDENT, CUSTOMER_CHECKIN, GET_ACTIVE_ORDERS, GET_DASHBOARD_SUMMARY, GET_DSR_RANGE, GET_ITEMS, GET_MASTER, RD_FETCH_SHEET, SAVE_BAR_INDENT, SAVE_BILL, SAVE_KITCHEN_CONSUMPTION, SAVE_KITCHEN_INDENT, SAVE_KOT, SAVE_MASTER, SAVE_MENU_AVAILABILITY, SAVE_ORDER, SAVE_WASTAGE, UPDATE_ORDER_STATUS.

The other 134 are NOT in this file, including GET_BILLS, LIST_BILLS, GET_NC_REPORT, GET_CUSTOMER_LEDGER, GET_DUE_COLLECTION, SETTLE_DUE_BILL, SAVE_DUES_RECEIPT, DASH_FIN, DSR_ITEM_GROUP, GET_DSR_MATRIX, GET_CASHBOOK_REPORT, DAY_CLOSE.
Since those work on your live site, **the V2_CORE deployment runs a different project** (the sheet-bound `BALAJI_NEXTGEN_ERP_V2_CORE` script), not this router.
So Fix A must go into **that** project's router. Full list: `BACKEND-ACTIONS-REQUIRED.md`.

## 4. Router risks seen in the file (not changed)
- Header says 3 files declare `doPost/doGet` (`01_Router.gs`, `Master router.gs`, this file). Apps Script silently keeps one. Confirm which is bound to the live deployment before editing any of them.
- `PING` returns `respondedBy` — open `<deployment>/exec?action=PING` for V2_CORE and for the 3 DSR deployments: it tells you which file answers.
- `LOGIN` compares plain-text passwords from USER_MASTER.
- `SAVE_PAYMENT`, `SAVE_DEPT_ISSUE` etc. use `getClientDbId(body.clientId, …)` with no session check.

## 5. Still missing — I need these files
`DASH_FIN` (dashboard Due Received / Credit KPIs), `SETTLE_DUE_BILL`, `GET_CUSTOMER_LEDGER`, `LIST_BILLS` / `GET_BILLS`, `GET_NC_REPORT`.
Upload the V2_CORE router and those handlers and I will check params, response shape and NC (₹0) handling.
