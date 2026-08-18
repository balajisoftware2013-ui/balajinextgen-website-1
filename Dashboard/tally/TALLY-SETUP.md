# Tally Direct Posting Engine — Connection Setup

Your screenshot showed **"Tally: Not reachable"**. There are two separate things
that both have to be true at once — most failures are #2, which is new and easy
to miss.

## 1. A local bridge must be running (proxy)

Browsers can't call Tally's port 9000 directly (no CORS, no readable reply).
Two bridge scripts are included — pick ONE:

**Node** (if you have Node.js installed):
```
node tally-proxy.js
```

**Python** (no install needed, standard library only):
```
python tally_relay.py
```

Either prints:
```
listening on http://localhost:9001
Forwarding every request to Tally at http://127.0.0.1:9000
```
Leave that terminal window open the whole time you're posting. In the app's
Settings, "Tally HTTP/XML Gateway URL" should be `http://localhost:9001`
(the app also auto-heals a stale `:9000` value to `:9001` on its own).

In Tally: **Gateway of Tally → F11 (Features) → Enable ODBC/XML Server →
Yes** (port 9000), with the correct company already loaded.

## 2. Chrome's "Local Network Access" permission (the usual real cause)

Since Chrome 142, any page loaded from a **public https:// domain** —
`https://www.balajinextgen.in` counts, even though it's fetching something on
your own PC — needs a one-time browser permission before it's allowed to
contact `localhost` / a LAN address at all. This check happens **before**
your request ever reaches the proxy, so it fails identically to "proxy isn't
running," which is why this gets missed.

**Fix:**
1. Click the 🔒 / ⓘ icon just left of the address bar on
   `www.balajinextgen.in`.
2. Open **Site settings**.
3. Find **Local network access** (or "Local network device access" /
   similar wording depending on Chrome version) and set it to **Allow**.
4. Reload the page, make sure the proxy from step 1 is running, click
   **Test Connection** again.

If you don't see that permission row at all, Chrome hasn't offered it yet —
that usually means step 1 (the proxy) isn't actually running, since the
permission prompt is normally triggered the first time a request is attempted.
Start the proxy, click **Test Connection**, and watch for a Chrome popup
asking to allow access to your local network — click **Allow** on it.

### Avoiding this permission entirely
If you'd rather never deal with it: open the app via `http://localhost` (a
local copy) instead of the live `https://www.balajinextgen.in` domain — a
request from `localhost` to `localhost:9001` is same-space and Chrome does
not gate it. Not practical for day-to-day use across client machines, but
useful for testing.

## 3. If it still won't connect

Use **Download Tally XML Bundle** on the Import Log screen instead, and
import it manually via **Gateway of Tally → Import Data**. That path never
depends on the browser/proxy/permission chain above and always works.

## 4. What changed in this update

- `Test Connection` and posting failures now name the Local Network Access
  permission as the top suspect (not just "not reachable"), with the exact
  Chrome menu path to fix it.
- `tally-proxy.js` and `tally_relay.py` now send
  `Access-Control-Allow-Private-Network: true` on every response, including
  the `OPTIONS` preflight — required for Chrome 142+'s LNA preflight to
  succeed once you grant the permission. Without this header the browser
  would keep failing even after you click Allow.
- Both proxies now reflect the actual request `Origin` instead of a fixed
  domain, so they work whether you're testing from `localhost` or the live
  site without editing the script.
- Ledger/group ("head") auto-create logic, bank-ledger variant retry, and
  batch posting logic were reviewed — no bugs found there; that part was
  already solid. The connection layer above was the actual blocker.
