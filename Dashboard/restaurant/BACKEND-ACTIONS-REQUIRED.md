# Backend actions the frontend calls (audit checklist)

Generated from restaurant-dashboard.html + dsr-client.html (18 Oct 2026). Use this to diff against your router (08_CoreRouter.gs).
Every name below must have a `case` in the router of the deployment shown (V2_CORE / V2_AUTH). Names not found = "Unknown action" at runtime.

## Known missing (from your browser console)

- **DASH_FIN** — Console: "No deployment has DASH_FIN yet" — dashboard Due Received / Credit KPIs and Due Received pop-up depend on it.
- **DSR_ITEM_GROUP_CALC** — Console: tab empty — DSR Item Group figures fall back to old values. Needs DSR_ItemGroupEngine.gs + RUN_19_BuildDsrItemGroups.

## All actions

| Action | Calls | Files | Deployment | Param keys seen |
|---|---|---|---|---|
| ADD_STAFF | 2 | restaurant-dashboard | V2_CORE | — |
| APPLY_DUES_REGISTER | 1 | restaurant-dashboard | — | bills, opening, requestId, source |
| APPROVE_ISSUE_INDENT | 1 | restaurant-dashboard | — | — |
| AUTO_REPAIR_CLIENT | 1 | restaurant-dashboard | — | — |
| BACKUP_GET | 1 | restaurant-dashboard | — | — |
| BACKUP_NOW | 1 | restaurant-dashboard | — | — |
| BACKUP_RESTORE | 1 | restaurant-dashboard | — | backupId, confirm, last, sheet |
| BACKUP_SAVE | 3 | restaurant-dashboard | — | autoDelete, enabled, folderId, keepDays, keepMonthly, restoreEnabled |
| BATCH_EXECUTE | 1 | restaurant-dashboard | — | — |
| BILL_PAYMENTS | 1 | restaurant-dashboard | — | from, to |
| CANCEL_RESERVATION | 2 | restaurant-dashboard | V2_CORE | id |
| CASHBOOK_CFG_SAVE | 1 | restaurant-dashboard | — | showTransfers |
| CASHBOOK_DAYWISE | 1 | restaurant-dashboard | — | force, from, to |
| CASHBOOK_DAY_DETAIL | 1 | restaurant-dashboard | — | date |
| CLEAR_TEST_DATA | 1 | restaurant-dashboard | V2_CORE | — |
| CREATE_CLIENT | 1 | restaurant-dashboard | — | — |
| CUSTOMER_CHECKIN | 1 | restaurant-dashboard | — | — |
| DASH_FIN | 1 | restaurant-dashboard | — | force, from, to |
| DAY_CLOSE | 1 | restaurant-dashboard | V2_CORE | — |
| DELETE_DUES_RECEIPT | 1 | restaurant-dashboard | — | reason |
| DELETE_MENU_ITEM | 1 | restaurant-dashboard | V2_CORE | — |
| DSR_ITEM_GROUP | 1 | restaurant-dashboard | — | force, from, to |
| EDIT_DUES_RECEIPT | 2 | restaurant-dashboard | — | amount, paymentMode, reference, voucherNo |
| GET_ACCOUNTS_DAY | 1 | restaurant-dashboard | — | — |
| GET_ACTIVE_ORDERS | 3 | restaurant-dashboard | V2_CORE | — |
| GET_ALL_CLIENTS | 1 | restaurant-dashboard | — | — |
| GET_BAR_COST_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_BAR_INDENT | 1 | restaurant-dashboard | V2_CORE | from, range, to |
| GET_BAR_INDENT_CATALOG | 1 | restaurant-dashboard | V2_CORE | locationId |
| GET_BAR_INDENT_STOCK | 1 | restaurant-dashboard | V2_CORE | locationId |
| GET_BAR_MENU | 4 | restaurant-dashboard | V2_CORE | — |
| GET_BAR_PERFORMANCE_REPORT | 1 | restaurant-dashboard | V2_CORE | from, range, to |
| GET_BILLS | 15 | dsr-client, restaurant-dashboard | V2_CORE | BUSINESS_DATE, FROM_DATE, TO_DATE |
| GET_BLIND_TILL_REPORT | 1 | restaurant-dashboard | V2_CORE | businessDate |
| GET_BOOTSTRAP | 1 | restaurant-dashboard | V2_CORE | — |
| GET_CANCELLED_ITEMS_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_CASHBOOK_REPORT | 4 | dsr-client, restaurant-dashboard | V2_CORE | from, range, to |
| GET_CATEGORY_SALES_REPORT | 2 | restaurant-dashboard | V2_CORE | — |
| GET_CENTRAL_INVENTORY | 1 | restaurant-dashboard | — | — |
| GET_CLIENT_ASSETS | 1 | restaurant-dashboard | — | — |
| GET_CLIENT_DATABASE_STATUS | 2 | restaurant-dashboard | V2_CORE | — |
| GET_CLIENT_INFO | 8 | dsr-client, restaurant-dashboard | V2_CORE | clientId |
| GET_CLIENT_POS_PROFILE | 1 | restaurant-dashboard | V2_CORE | — |
| GET_CONSUMPTION_REPORT | 3 | restaurant-dashboard | V2_CORE | — |
| GET_CRM_CUSTOMERS | 2 | restaurant-dashboard | — | — |
| GET_CUSTOMER_LEDGER | 8 | restaurant-dashboard | V2_CORE | customerId, from, to |
| GET_DASHBOARD_SUMMARY | 3 | restaurant-dashboard | V2_CORE | range |
| GET_DAY_BOOK_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_DAY_STATUS | 2 | restaurant-dashboard | V2_CORE | — |
| GET_DEBTORS_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_DISCOUNT_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_DSR_BANK_RECONCILIATION | 3 | dsr-client, restaurant-dashboard | V2_CORE | from, to |
| GET_DSR_MATRIX | 6 | dsr-client, restaurant-dashboard | V2_CORE | month, year |
| GET_DSR_RANGE | 1 | dsr-client | — | from, to |
| GET_DSR_YTD | 1 | dsr-client | — | asOfDate, year |
| GET_DUE_COLLECTION | 11 | dsr-client, restaurant-dashboard | V2_CORE | FROM_DATE, TO_DATE, from, range, to |
| GET_GSTR_SUMMARY | 1 | restaurant-dashboard | V2_CORE | — |
| GET_GST_REPORT | 3 | restaurant-dashboard | V2_CORE | — |
| GET_INCENTIVE_RULES | 1 | restaurant-dashboard | V2_CORE | — |
| GET_INSTRUCTIONS_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_INVOICE_SETTINGS | 1 | restaurant-dashboard | — | — |
| GET_ITEMS | 2 | restaurant-dashboard | V2_CORE | locationId |
| GET_ITEM_SALES_REPORT | 14 | dsr-client, restaurant-dashboard | V2_CORE | FROM_DATE, TO_DATE, from, range, to |
| GET_KDS_REPORT | 2 | restaurant-dashboard | V2_CORE | — |
| GET_KITCHEN_INDENT_FLOW | 1 | restaurant-dashboard | — | — |
| GET_KOT | 6 | restaurant-dashboard | V2_CORE | LOCATION_ID, from, includeClosed, locationId, range, reportMode, to |
| GET_KOTS | 1 | restaurant-dashboard | — | — |
| GET_KOT_NUMBER_BATCH | 1 | restaurant-dashboard | V2_CORE | batchSize |
| GET_MASTER | 15 | restaurant-dashboard | V2_CORE | category |
| GET_MENU_ITEMS | 2 | restaurant-dashboard | V2_CORE | — |
| GET_MY_ATTENDANCE | 1 | restaurant-dashboard | V2_CORE | fromDate, fullName, loginId, toDate, userId |
| GET_NC_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_ONLINE_ORDERS_LIST | 1 | restaurant-dashboard | V2_CORE | — |
| GET_ONLINE_ORDER_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_ORDERS | 1 | restaurant-dashboard | V2_CORE | LOCATION_ID |
| GET_OUTSTANDING_BILLS | 6 | restaurant-dashboard | — | customerId |
| GET_PAYMENT_MODES | 3 | restaurant-dashboard | V2_CORE | — |
| GET_PAYMENT_REPORT_V2 | 1 | restaurant-dashboard | V2_CORE | — |
| GET_PETTY_CASH_LEDGER | 1 | restaurant-dashboard | V2_CORE | — |
| GET_POS_MENU | 2 | restaurant-dashboard | V2_CORE | — |
| GET_REPRINT_REPORT | 2 | restaurant-dashboard | V2_CORE | — |
| GET_ROLE_ACCESS | 1 | restaurant-dashboard | V2_CORE | — |
| GET_SALES_DAY_BOOK_REPORT | 6 | dsr-client, restaurant-dashboard | V2_CORE | FROM_DATE, TO_DATE, from, range, to |
| GET_SALES_SUMMARY_REPORT | 2 | restaurant-dashboard | — | — |
| GET_STAFF_LIST | 9 | restaurant-dashboard | V2_CORE | roles |
| GET_TABLE_AVAILABILITY | 1 | restaurant-dashboard | V2_CORE | locationId |
| GET_TABLE_FLOOR | 2 | restaurant-dashboard | V2_CORE | — |
| GET_TABLE_LAYOUT | 1 | restaurant-dashboard | V2_CORE | — |
| GET_TAX_CONFIG | 2 | restaurant-dashboard | V2_CORE | — |
| GET_TIPS_REPORT | 1 | restaurant-dashboard | V2_CORE | — |
| GUEST_CTL_SAVE | 1 | restaurant-dashboard | — | cm, crm, waAuto, waGuest |
| GUEST_VERIFY | 1 | restaurant-dashboard | — | mobileNo |
| HEARTBEAT | 1 | restaurant-dashboard | V2_CORE | — |
| IMPORT_DSR_DAY_REGISTER | 1 | restaurant-dashboard | — | requestId, rows, source |
| IMPORT_TRANSACTIONS | 3 | restaurant-dashboard | V2_CORE | — |
| LIST_ADVANCE_LEDGER | 1 | restaurant-dashboard | V2_CORE | clientId |
| LIST_BILLS | 8 | restaurant-dashboard | V2_CORE | FROM_DATE, SUMMARY_ONLY, TO_DATE |
| LIST_RESERVATIONS | 1 | restaurant-dashboard | — | CLIENT_ID, clientId |
| MENU_ITEM_ENSURE | 1 | restaurant-dashboard | — | — |
| NEXT_BILL_NO | 1 | restaurant-dashboard | V2_CORE | counterCode |
| PETTY_META_GET | 1 | restaurant-dashboard | — | — |
| PETTY_META_SAVE | 1 | restaurant-dashboard | — | amount, note, visibility, voucherNo |
| PRINTER_MASTER_GET | 1 | restaurant-dashboard | — | — |
| PRINTER_MASTER_SAVE | 1 | restaurant-dashboard | — | printers, route |
| PRINT_QUEUE_CLAIM | 1 | restaurant-dashboard | — | force, qz, since, station |
| PRINT_QUEUE_DONE | 1 | restaurant-dashboard | — | results |
| RD_FETCH_SHEET | 11 | dsr-client, restaurant-dashboard | V2_CORE | LOCATION_ID, locationId, tab |
| SAVE_BAR_INDENT | 1 | restaurant-dashboard | V2_CORE | — |
| SAVE_BILL | 2 | restaurant-dashboard | V2_CORE | bill |
| SAVE_CASH_MOVEMENT | 2 | restaurant-dashboard | V2_CORE | — |
| SAVE_CLIENT_ASSETS | 7 | restaurant-dashboard | — | remove, upi |
| SAVE_CREDIT_CUSTOMER | 3 | restaurant-dashboard | V2_CORE | — |
| SAVE_CUSTOMER_OPENING_BALANCES | 1 | restaurant-dashboard | — | — |
| SAVE_DSR_IMPORTED_BILLS | 1 | dsr-client | — | bills, items |
| SAVE_DUES_RECEIPT | 6 | restaurant-dashboard | V2_CORE | amount, customerId, paymentMode, reference, requestId |
| SAVE_INCENTIVE_RULES | 1 | restaurant-dashboard | V2_CORE | rules |
| SAVE_INVOICE_SETTINGS | 1 | restaurant-dashboard | — | — |
| SAVE_KITCHEN_CONSUMPTION | 1 | restaurant-dashboard | — | — |
| SAVE_KITCHEN_INDENT | 1 | restaurant-dashboard | — | — |
| SAVE_KOT | 2 | restaurant-dashboard | V2_CORE | — |
| SAVE_MASTER | 1 | restaurant-dashboard | — | — |
| SAVE_MENU_AVAILABILITY | 1 | restaurant-dashboard | — | requestId |
| SAVE_MENU_ITEM | 1 | restaurant-dashboard | V2_CORE | — |
| SAVE_MENU_ITEM_IMAGE | 2 | restaurant-dashboard | V2_CORE | — |
| SAVE_ORDER | 1 | restaurant-dashboard | V2_CORE | — |
| SAVE_PETTY_CASH | 2 | restaurant-dashboard | — | — |
| SAVE_RESERVATION | 3 | restaurant-dashboard | V2_CORE | — |
| SAVE_ROLE_ACCESS | 2 | restaurant-dashboard | V2_CORE | — |
| SAVE_TABLE_CONFIG | 2 | restaurant-dashboard | V2_CORE | mode, tableNo |
| SAVE_TABLE_LAYOUT | 1 | restaurant-dashboard | V2_CORE | — |
| SAVE_TABLE_STATUS | 1 | restaurant-dashboard | — | — |
| SAVE_WASTAGE | 1 | restaurant-dashboard | — | — |
| SEAT_RESERVATION | 2 | restaurant-dashboard | V2_CORE | id |
| SETTLE_DUE_BILL | 3 | restaurant-dashboard | V2_CORE | — |
| SET_BILL_NUMBERING | 1 | restaurant-dashboard | V2_CORE | counterCode, nextNumber, padLength, prefix |
| STEWARD_CONTROL_GET | 1 | restaurant-dashboard | — | list |
| STEWARD_CONTROL_SAVE | 1 | restaurant-dashboard | — | defaults, users |
| TALLY_CFG_GET | 1 | restaurant-dashboard | — | — |
| TALLY_CFG_SAVE | 1 | restaurant-dashboard | — | cfg |
| TALLY_MARK_POSTED | 1 | restaurant-dashboard | — | results |
| TALLY_SALES_DATA | 1 | restaurant-dashboard | — | from, includeHistorical, to |
| UPDATE_ACCOUNT_SECURITY | 1 | restaurant-dashboard | — | currentPassword, newPassword, requestId |
| UPDATE_ORDER_STATUS | 2 | restaurant-dashboard | V2_CORE | — |
| UPDATE_PETTY_CASH | 1 | restaurant-dashboard | — | — |
| UPLOAD_LOGO | 3 | restaurant-dashboard | V2_CORE | imageBase64, mimeType |
| UPLOAD_SHARE_PDF | 1 | restaurant-dashboard | — | amount, customer, docType, fileBase64, fileName, mimeType |
| V2_CORE | 1 | restaurant-dashboard | V2_CORE | — |
| WA_READY | 1 | restaurant-dashboard | — | — |
| WA_SEND | 1 | restaurant-dashboard | V2_CORE | — |
| WA_SETUP_GET | 1 | restaurant-dashboard | — | — |
| WA_SETUP_SAVE | 1 | restaurant-dashboard | — | guestNumber, lang, phoneId, provider, template, token, welcomeText |
| WA_TEST | 1 | restaurant-dashboard | — | mobile, name |