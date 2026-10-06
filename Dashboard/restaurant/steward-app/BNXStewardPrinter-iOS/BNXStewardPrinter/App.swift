import SwiftUI
import WebKit
import Network

/// Page the app opens. Change if the steward page lives at a different address.
let START_URL = URL(string: "https://www.balajinextgen.in/steward-mobile.html")!
let ALLOWED_HOST = "www.balajinextgen.in"

@main
struct StewardPrinterApp: App {
    var body: some Scene {
        WindowGroup { WebContainer().ignoresSafeArea() }
    }
}

struct WebContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        // steward-mobile.html looks for window.webkit.messageHandlers.BNXPrinter
        cfg.userContentController.add(context.coordinator, name: "BNXPrinter")
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.navigationDelegate = context.coordinator
        wv.allowsBackForwardNavigationGestures = true
        context.coordinator.web = wv
        wv.load(URLRequest(url: START_URL))
        UIApplication.shared.isIdleTimerDisabled = true
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    weak var web: WKWebView?
    private let queue = DispatchQueue(label: "bnx.print")

    // MARK: navigation – keep only our own site inside the app
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, action.targetFrame?.isMainFrame ?? true,
           url.scheme == "https", url.host?.lowercased() != ALLOWED_HOST,
           action.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let html = "<html><body style='font-family:-apple-system;text-align:center;padding:40px'><h2>No connection</h2><p>Check the internet / Wi-Fi.</p><button style='padding:12px 24px;font-size:16px' onclick=\"location.href='\(START_URL.absoluteString)'\">Retry</button></body></html>"
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: printer bridge – page posts {id, role, ip, port, data(base64), job}
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let d = message.body as? [String: Any] else { return }
        let id = String(describing: d["id"] ?? "")
        let ip = String(describing: d["ip"] ?? "").trimmingCharacters(in: .whitespaces)
        let portNum = Int(String(describing: d["port"] ?? "9100")) ?? 9100
        let b64 = String(describing: d["data"] ?? "")

        guard Coordinator.isPrivateIP(ip) else {
            reply(id, false, "Printer IP must be a local address (192.168.x.x / 10.x.x.x)"); return
        }
        guard let bytes = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
              let port = NWEndpoint.Port(rawValue: UInt16(portNum)) else {
            reply(id, false, "Bad print data"); return
        }

        let conn = NWConnection(host: NWEndpoint.Host(ip), port: port, using: .tcp)
        var done = false
        func finish(_ ok: Bool, _ msg: String) {
            if done { return }; done = true
            conn.cancel()
            reply(id, ok, msg)
        }
        conn.stateUpdateHandler = { state in
            switch state {
            case .ready:
                conn.send(content: bytes, completion: .contentProcessed { err in
                    if let err = err { finish(false, "Cannot print to \(ip):\(portNum) - \(err.localizedDescription)") }
                    else { self.queue.asyncAfter(deadline: .now() + 0.3) { finish(true, "") } }
                })
            case .failed(let err):
                finish(false, "Cannot print to \(ip):\(portNum) - \(err.localizedDescription)")
            case .waiting(let err):
                finish(false, "Cannot reach \(ip):\(portNum) - \(err.localizedDescription). Same Wi-Fi? Local Network allowed?")
            default: break
            }
        }
        conn.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 6) { finish(false, "Printer connection timeout (\(ip):\(portNum))") }
    }

    private func reply(_ id: String, _ ok: Bool, _ msg: String) {
        func q(_ s: String) -> String {
            (try? JSONEncoder().encode(s)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
        }
        DispatchQueue.main.async {
            self.web?.evaluateJavaScript("window.bnxNativePrintResult(\(q(id)),\(ok),\(q(msg)))", completionHandler: nil)
        }
    }

    static func isPrivateIP(_ ip: String) -> Bool {
        let p = ip.split(separator: ".").compactMap { Int($0) }
        guard p.count == 4, p.allSatisfy({ (0...255).contains($0) }) else { return false }
        return p[0] == 10 || (p[0] == 192 && p[1] == 168) || (p[0] == 172 && (16...31).contains(p[1]))
    }
}
