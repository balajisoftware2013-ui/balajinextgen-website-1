# BNX Steward iOS — Direct IP Printer Bridge

This is an Xcode project skeleton for the BNX Steward web UI with a native iOS direct TCP ESC/POS bridge.

## Build
1. Open `BNXStewardIOS.xcodeproj` in Xcode on macOS.
2. Set your Apple Team and Bundle Identifier.
3. Build/run on an iPhone.
4. Allow **Local Network** permission.
5. Keep iPhone and printers on the same Wi‑Fi.

Printer API exposed to the web view:
`window.webkit.messageHandlers.bnxPrinter.postMessage({role, ip, port, dataBase64, job})`

The native bridge connects to the configured printer over TCP and writes the decoded ESC/POS bytes.
