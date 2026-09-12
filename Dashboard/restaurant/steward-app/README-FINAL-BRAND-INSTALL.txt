HAPPYSERVE STEWARD MOBILE — FINAL BRAND + INSTALL FIX

1. Before login:
   - Common Balaji NextGen ERP / HAPPYSERVE branding only.
   - Common Balaji banner only.
   - Client branding is locked out of the login screen.
   - Common Balaji logo is used; no client logo or client colour is shown.

2. After successful login:
   - Client ID becomes authoritative.
   - Client 10 uses assets/clients/CLIENT-10/logo.png and banner.png.
   - Client 10 banner drives the app accent colour automatically.
   - Other clients use their saved branding or common fallback.

3. Install:
   - One inline Install HAPPYSERVE App card on login.
   - No separate install popup.
   - After successful installation, the card is hidden and the installed app remains HAPPYSERVE.
   - PWA manifest and service-worker cache are updated.

4. Assets:
   - assets/common-balaji-banner.jpg = common pre-login banner.
   - assets/clients/CLIENT-10/logo.png = clean Client 10 logo.
   - assets/clients/CLIENT-10/banner.png = cropped Client 10 banner.
   - icons/icon-192.png and icons/icon-512.png = Balaji NextGen ERP app logo.

For local testing, use a local HTTP server for PWA install/service-worker support. file:// does not support service-worker installation.
