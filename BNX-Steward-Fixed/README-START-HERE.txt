BNX STEWARD PRINTER - FIXED PACKAGE
===================================
What was wrong
  * 3 different apps existed. The HAPPYSERVE icon (TWA) runs inside Chrome and can NEVER print -> that gives
    the "page is open in Chrome / a browser" message.
  * One app only allowed www.balajinextgen.in, so a redirect to balajinextgen.in threw the page out to Chrome.
  * One app loaded an old copy of the page stored inside the APK (build FW7).
  * GitHub made a new random signing key on every build, so updates could not install over old ones.

What this package gives you (ONE app, one icon)
  android/   -> new BNX Steward Printer App 2.0.0 (loads the live page, has the printer bridge)
  website/   -> upload these to your web server (steward-mobile.html + steward/update.json)
  ios/       -> App.swift with the same host fix (needs a Mac + Xcode, see ios/README.txt)

STEP 1 - upload the web files
  * website/steward-mobile.html  ->  https://balajinextgen.in/steward-mobile.html   (replace old file)
  * website/steward/update.json  ->  https://balajinextgen.in/steward/update.json

STEP 2 - build the APK (no Android Studio)
  1. New GitHub repository -> upload EVERYTHING inside the android/ folder (keep folders, including .github).
  2. Actions tab -> "Build APK" -> Run workflow (3-5 minutes).
  3. Download artifact "BNX-Steward-Printer-APK" -> unzip -> BNXStewardPrinterApp.apk
  4. Upload that file to https://balajinextgen.in/steward/BNXStewardPrinterApp.apk  (for auto-update)

STEP 3 - install on each steward phone
  1. UNINSTALL the old apps first: "HAPPYSERVE", "BNX Steward Printer", "Balaji NextGen Steward".
     (One time only. The new key differs from the old ones, so Android will not upgrade over them.)
  2. Install BNXStewardPrinterApp.apk. Open ONLY the "BNX Steward Printer" icon - never Chrome.
  3. Printer Setup should show the green "Direct Wi-Fi IP Printing ON" card.

Future updates: raise versionCode in android/app/build.gradle.kts, rebuild, upload the new APK and edit
update.json to the same versionCode. Phones show an "Update available" box. KEEP android/app/bnx-steward.keystore -
every future build must use it.

Do NOT publish the keystore in a public repository (use a private one).
