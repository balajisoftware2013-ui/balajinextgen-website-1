# HappyServe Printer (Android)

The HappyServe steward app with **direct WiFi printing**: KOT / bill tickets go from the phone straight to the
printer's IP on port 9100. No PC, no QZ Tray, no server print queue, and printing works even when the internet is down
(the order itself still needs the server).

* Opens `https://www.balajinextgen.in/Dashboard/restaurant/steward-app/steward-mobile.html`
  (change: the dialog that appears if the page cannot open, or `BNXPrinter.openSettings()`).
* Printer IPs come from POS → Printer Master (CLIENT_PRINTER_MASTER) exactly as before (Kitchen / Bar / Hukka / Bill).
  If a role has no IP, the app finds the printer on the WiFi (port 9100) and remembers it.
* Page ↔ app contract (already in steward-mobile.html):
  `BNXPrinter.printRaw(id, role, ip, port, base64EscPos, jobName)` → app calls `window.bnxNativePrintResult(id, ok, message)`.

Build: push to GitHub → Actions → **Build APK** → download `HappyServe-Printer.apk` (also attached to a Release).
The signing key (`app/bnx-app.keystore`, password `android`) is fixed so every new build installs over the old one.
Keep this repository **private**.
