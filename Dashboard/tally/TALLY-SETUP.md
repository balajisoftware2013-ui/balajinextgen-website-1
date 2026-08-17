# Tally Direct Posting Engine — Setup

Your browser console showed CORS + `file://` errors because:
1. Tally's built-in XML/ODBC server (port 9000) never sends CORS headers, so browsers block direct `fetch()` calls to it.
2. The page was opened as a local file (`file:///D:/...`), which browsers treat as an untrusted "null" origin — making the block worse.

This package fixes both. Files included:
- `tally-posting-engine.html` — updated to talk to the proxy (port 9001) instead of Tally directly (port 9000).
- `tally-proxy.js` — a small local Node.js proxy that forwards requests to Tally and adds the missing CORS headers.

## One-time setup

1. **Put both files in the same folder** (e.g. your existing `.../Dashboard/tally/` folder).
2. **Enable Tally's XML server:**
   Gateway of Tally → **F11** (Features) → Enable ODBC/XML Server → **Yes** (port 9000, default). Keep Tally open with the right company loaded whenever you post.

## Every time you use the tool

1. **Start the proxy** — open a terminal in the folder and run:
   ```
   node tally-proxy.js
   ```
   Leave this window open. It listens on `http://localhost:9001` and forwards to Tally on port `9000`.

2. **Serve the HTML instead of double-clicking it** — in the same folder, run:
   ```
   python -m http.server 8080
   ```
   Then open **http://localhost:8080/tally-posting-engine.html** in your browser (not the `file:///...` path).

3. Confirm the Tally URL field in the app shows `http://localhost:9001` (this is now the default), then click **Test Connection**.

## Auto-create: ledger → header (group)

Two related fixes are now in `tally-posting-engine.html`:

- **Groups are auto-created too, not just ledgers.** Previously the tool would try to create a missing ledger (e.g. `Electricity Expenses`) under its parent group, but if that group ("header") didn't already exist in Tally, the ledger create call would fail. Now, right before posting a batch, the tool checks every group referenced, auto-creates any that aren't one of Tally's standard built-in groups, and only then creates the ledgers under them.
- **The auto-create step is now actually wired into posting.** It existed in the code before but was never called — ledgers/groups were never being created automatically. It now runs at the start of every "Post" / "Auto Post Everything" action, and you'll see a toast confirming what was created (e.g. *"Auto-created 2 group(s) in Tally: Electricity Expenses, ..."*).

If a group has to be invented on the fly (not a standard Tally group), it's placed under a sensible default parent based on its name (e.g. anything with "expense" in it goes under **Indirect Expenses**, "tax"/"duties" under **Duties & Taxes**, etc.) — you can always re-parent it in Tally afterward if you'd prefer a different structure.

## Notes

- **Logo error (`logo.png` not found):** cosmetic only — the page already falls back to a 🧾 icon when the image is missing. If you want your real logo, place it at `assests/logos/logo.png` relative to the HTML file (note: the code uses `assests`, a common misspelling of `assets` — keep the folder name matching, or update the `<img src>` on line ~116 if you rename it).
- If Tally itself is closed, or the XML server isn't enabled, the proxy will return a clear "could not reach Tally" error instead of a silent CORS failure — check that first if the connection test fails.
- Node.js must be installed to run the proxy (no extra packages needed — it only uses Node's built-in `http` module).
