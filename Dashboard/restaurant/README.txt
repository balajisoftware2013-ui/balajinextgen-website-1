KITCHEN OPS BATCH — 2026-08-09
====================================================================

WHAT'S IN THIS ZIP (9 files)
--------------------------------------------------------------------
chef-dashboard.html       — checked, no bugs found, syntax-validated
chef-orders.html          — checked, no bugs found, syntax-validated
food-costing.html         — checked, no bugs found, syntax-validated
kitchen-consumption.html  — checked, no bugs found, syntax-validated
kitchen-indent.html       — INCLUDES the loadRealItems() fix from
                             earlier (fallback item list wasn't being
                             rendered — Submit had nothing to send)
kot-management.html       — checked, no bugs found, syntax-validated
menu-availability.html    — checked, no bugs found, syntax-validated
production-entry.html     — checked, no bugs found, syntax-validated
wastage-entry.html        — checked, no bugs found, syntax-validated

All 9 use the AI_QUERY / GET_AI_INSIGHT pattern (natural-language
backend queries) rather than the SAVE_MASTER-style granular CRUD
actions built elsewhere this session. That's intentional, working
design for these screens — not a bug, nothing converted.

WHAT'S NOT IN THIS ZIP — DECIDED, NOT JUST FLAGGED
--------------------------------------------------------------------
Restrostock_pro_inventory.html (1,410 lines) — DELIBERATELY EXCLUDED.
This is an obsolete early prototype of "RestroStock Pro" — entirely
local-only (saveDB() writes to localStorage only, seedData() for fake
demo data), zero real backend calls. The actual current app is the
10,458-line inventory.html already fixed extensively earlier this
session (real Google Sheets sync, bnx date-filter system, warehouse/
transfer/adjustment fixes, etc).

Recommendation acted on: delete this file from wherever it's hosted.
Keeping two files under the same "RestroStock Pro" name at two very
different maturity levels is exactly the kind of duplication that
causes someone to edit or link to the wrong one by accident. If you
want it back for any reason, say so and I'll include it separately —
it's just not going in as if it were still current.

NEXT STEPS
--------------------------------------------------------------------
If you want any of these 9 converted from AI_QUERY to real Sheet-
backed CRUD (matching the SAVE_MASTER pattern), tell me which ones
matter most — that's a real feature build per file, not something to
do speculatively across all 9 without knowing which you actually need
live data for.
