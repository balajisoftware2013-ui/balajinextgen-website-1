# BNX Steward Printer App — native bridge contract (Android + iPhone)

The web page (`steward-mobile.html`) prints on phones only through this bridge,
because a web page can never open a raw TCP socket to a printer's `IP:9100`.

## Page → app
`printRaw(id, role, ip, port, base64Data, job)` — all values are strings.
- `base64Data` = ESC/POS bytes (starts with `1B 40`). Send the decoded bytes unchanged to `ip:port`.

## App → page (must be called after every job, success or failure)
`window.bnxNativePrintResult(id, ok, message)`
The page waits 20 s for this call, then reports "Printer connection timeout".

The bridge must exist BEFORE the page's scripts run (Android: register before `loadUrl`;
iOS: `WKUserContentController` handler added before the web view is created).

---
## Android (Kotlin, WebView)
```kotlin
class BnxPrinterBridge(private val web: WebView) {
    @JavascriptInterface
    fun printRaw(id: String, role: String, ip: String, port: String, b64: String, job: String) {
        Thread {
            var ok = false; var msg = ""
            try {
                val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                java.net.Socket().use { s ->
                    s.connect(java.net.InetSocketAddress(ip, port.toIntOrNull() ?: 9100), 5000)
                    s.getOutputStream().apply { write(bytes); flush() }
                }
                ok = true
            } catch (e: Exception) { msg = e.message ?: "print failed" }
            val js = "window.bnxNativePrintResult(${org.json.JSONObject.quote(id)},$ok,${org.json.JSONObject.quote(msg)})"
            web.post { web.evaluateJavascript(js, null) }
        }.start()
    }
}
// In the Activity, BEFORE loadUrl:
web.settings.javaScriptEnabled = true
web.settings.domStorageEnabled = true
web.addJavascriptInterface(BnxPrinterBridge(web), "BNXPrinter")
web.loadUrl("https://balajinextgen.in/…")
// Manifest: <uses-permission android:name="android.permission.INTERNET"/>
```

## iPhone (Swift, WKWebView)
The page auto-wraps `webkit.messageHandlers.BNXPrinter` into `printRaw`, posting
`{id, role, ip, port, data (base64), job}`.
```swift
import WebKit, Network

final class BnxPrinterHandler: NSObject, WKScriptMessageHandler {
    weak var web: WKWebView?
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any],
              let id = d["id"] as? String, let ip = d["ip"] as? String,
              let b64 = d["data"] as? String, let bytes = Data(base64Encoded: b64) else { return }
        let port = NWEndpoint.Port(rawValue: UInt16(d["port"] as? String ?? "9100") ?? 9100)!
        let conn = NWConnection(host: NWEndpoint.Host(ip), port: port, using: .tcp)
        var finished = false
        func done(_ ok: Bool, _ msg: String) {
            if finished { return }; finished = true; conn.cancel()
            let js = "window.bnxNativePrintResult('\(id)',\(ok),'\(msg.replacingOccurrences(of: "'", with: ""))')"
            DispatchQueue.main.async { self.web?.evaluateJavaScript(js) }
        }
        conn.stateUpdateHandler = { st in
            switch st {
            case .ready: conn.send(content: bytes, completion: .contentProcessed { e in
                    done(e == nil, e?.localizedDescription ?? "") })
            case .failed(let e): done(false, e.localizedDescription)
            default: break }
        }
        conn.start(queue: .global())
        DispatchQueue.global().asyncAfter(deadline: .now() + 8) { done(false, "printer timeout") }
    }
}
// Setup, BEFORE loading the page:
let h = BnxPrinterHandler()
let cfg = WKWebViewConfiguration()
cfg.userContentController.add(h, name: "BNXPrinter")
let web = WKWebView(frame: .zero, configuration: cfg); h.web = web
web.load(URLRequest(url: URL(string: "https://balajinextgen.in/…")!))
// Info.plist: NSLocalNetworkUsageDescription = "Connect to your restaurant printers"
// (iOS asks the user to allow Local Network access — it must be ON or printing fails.)
```

## No app? Relay works on both
`bnx-print-relay.js` on an always-on PC. Android Chrome works after opening the relay
https address once and accepting the certificate. iPhone Safari is stricter with
self-signed certificates: use a certificate the phone trusts (BNX_TLS_CERT / BNX_TLS_KEY).
