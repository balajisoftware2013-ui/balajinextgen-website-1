HAPPYSERVE STEWARD MOBILE — FINAL REFERENCE BUILD
===================================================

1. steward-mobile.html = main Steward Mobile application.
2. Splash is the common Balaji HAPPYSERVE loading screen and then opens the
   SAME login page. No separate install popup is used.
3. Login includes the inline "Install HAPPYSERVE App" card shown in the supplied
   reference design. Once installed, the inline install card is hidden; no new
   banner/popup is opened.
4. Client restaurant logo/banner is auto-captured from the Restaurant Dashboard
   branding record for the active client. The client logo/banner never replaces
   the common splash brand.
5. If a client has no logo/banner, the common HAPPYSERVE branding is used.
6. assets/clients/CLIENT-01 ... CLIENT-10 provide ten reserved client branding
   slots/config templates. They are optional; dashboard localStorage branding is
   preferred and is detected automatically.
7. PWA files: manifest.json, sw.js, icon-192.png, icon-512.png,
   icon-maskable-512.png and icons/.

IMPORTANT FOR DEPLOYMENT
------------------------
Serve the folder from HTTP/HTTPS for PWA installation/service-worker support.
Opening the HTML as file:// is useful for visual testing but browsers do not
allow service-worker installation from file://.
