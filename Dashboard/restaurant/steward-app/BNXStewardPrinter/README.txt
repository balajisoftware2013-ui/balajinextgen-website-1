AUTO PRINTER DETECTION (v2.0): leave the printer IP EMPTY in Printer Setup. The app scans the phone Wi-Fi for printers (port 9100), remembers them per role, and re-finds them if the router changes their IP. A typed IP is still used first when it answers.

BNX STEWARD PRINTER - ALL IN ONE FOLDER

Inside this folder:
  app, .github, *.gradle.kts, gradle.properties  -> the Android printer app (GitHub builds the APK from these)
  website\steward-mobile.html                    -> the steward page (updated). Upload this to your Netlify website,
                                                    replacing the old steward-mobile.html. The APK build ignores it.

STEPS
1. Extract this zip to D:\Apps  (NOT inside your Netlify website folder).
2. GitHub Desktop -> File -> Add local repository -> pick the folder that directly contains "app" and ".github"
   -> create a repository -> Commit to main -> Publish repository (keep Private).
3. github.com -> your repository -> Actions -> Build APK -> Run workflow -> wait for the green tick.
4. Download artifact "BNX-Steward-Printer-APK" -> unzip -> app-debug.apk -> install on the phone.
5. Open the BNX Steward Printer icon (not Chrome).

If your steward page is NOT at https://www.balajinextgen.in/steward-mobile.html, edit START_URL in
app\src\main\java\com\balajinextgen\stewardprinter\MainActivity.java before step 2.
