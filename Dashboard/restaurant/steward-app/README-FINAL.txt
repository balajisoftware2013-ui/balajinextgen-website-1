HAPPYSERVE STEWARD MOBILE — MASTER-BRANDING FINAL

FLOW
1. Common Balaji/HAPPYSERVE loading screen appears first.
2. Loading transitions to the same login page; no client branding is shown before authentication.
3. Login page uses the common Balaji/HAPPYSERVE banner for every client.
4. After successful login, authenticated CLIENT_ID is used.
5. GET_CLIENT_INFO reads CLIENT_SETTINGS branding from the master DB.
6. Client logo + client banner + tagline are shown after login.
7. Client banner is used to auto-brand the steward colour palette.
8. Install row is only in Profile; after successful installation it is hidden and remembered on that device.
9. Invoice/re-print uses the active client logo/name when available.
10. Client 10 bundled assets are included only as a local/offline fallback.

MASTER DB FIELDS ADDED TO CLIENT_SETTINGS
CLIENT_DISPLAY_NAME
CLIENT_TAGLINE
CLIENT_LOGO_URL
CLIENT_BANNER_URL
CLIENT_BANNER_ENABLED

For CL00010 the values point to assets/clients/CLIENT-10/. In production, these can be replaced with HTTPS/Drive URLs without editing steward-mobile.html.
