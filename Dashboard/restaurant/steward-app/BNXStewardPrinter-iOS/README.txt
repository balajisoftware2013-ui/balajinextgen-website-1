BNX STEWARD PRINTER — iPHONE APP (source)

An iPhone app can only be built on a Mac with Xcode. There is no way around this.

On a Mac:
1. Install Xcode (App Store) and XcodeGen:   brew install xcodegen
2. In this folder run:   xcodegen
3. Open BNXStewardPrinter.xcodeproj, select your Apple ID under Signing & Capabilities
   (Targets -> BNXStewardPrinter -> Team).
4. Plug in an iPhone and press Run.

Giving it to stewards:
- Free Apple ID: the app stops working after 7 days and must be re-installed. Only for testing.
- Apple Developer Program (about USD 99 / year): upload to TestFlight and invite each steward
  by email. This is the practical way to put it on many iPhones.

First print: iPhone asks "Allow BNX Steward Printer to find devices on your local network?"
-> tap Allow. Without it, printing fails.

To open a different page, edit START_URL / ALLOWED_HOST at the top of App.swift.
