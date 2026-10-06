BNX STEWARD PRINTER APP — how to get the APK (no Android Studio needed)

1. Create a free account at github.com and make a NEW repository (private is fine).
2. Upload ALL files of this folder to it (keep the folders as they are, including .github).
3. Open the repository -> "Actions" tab -> "Build APK" -> "Run workflow".
4. After ~3-5 minutes open the finished run -> download "BNX-Steward-Printer-APK" (zip) -> unzip -> app-debug.apk.
5. Send app-debug.apk to each steward phone, open it, allow "Install unknown apps", install.
6. Stewards open the BNX Steward Printer icon (not Chrome). Printer Setup should show the green "detected" line.

To open a different page, edit START_URL (and ALLOWED_HOST) in
app/src/main/java/com/balajinextgen/stewardprinter/MainActivity.java
