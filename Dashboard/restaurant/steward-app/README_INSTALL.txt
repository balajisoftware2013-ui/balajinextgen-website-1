BALAJI NEXTGEN STEWARD — INSTALL PACKAGE

Files:
- steward-mobile.html : Steward web app
- manifest.json       : PWA install manifest
- sw.js               : offline/service-worker shell
- icons/              : PWA icons
- Code.gs             : paired Apps Script backend version

DEPLOYMENT:
1. Put steward-mobile.html, manifest.json, sw.js and icons/ in the same web folder.
2. Deploy/use the paired Code.gs backend.
3. Open the Steward app over HTTPS.
4. Chrome/Edge will show Install App when the PWA requirements are satisfied.
5. On iPhone/iPad use Share -> Add to Home Screen.

MENU:
All -> Category -> Group -> Item
Food -> Category -> Group -> Item
Bar -> Category -> Group -> Item
Other/Favourites/Popular/Recent -> Category -> Group -> Item

The app does not create demo menu data in live mode.
