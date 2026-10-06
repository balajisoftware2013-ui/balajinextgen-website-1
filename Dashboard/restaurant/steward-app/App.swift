import SwiftUI
import WebKit
import Network
import Darwin

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

        let role = String(describing: d["role"] ?? "")
        let typed = ip
        guard let bytes = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
              let port = NWEndpoint.Port(rawValue: UInt16(portNum)) else {
            reply(id, false, "Bad print data"); return
        }
        if !typed.isEmpty && typed.lowercased() != "auto" && !Coordinator.isPrivateIP(typed) {
            reply(id, false, "Printer IP must be a local address (192.168.x.x / 10.x.x.x)"); return
        }
        // Typed IP if it answers -> remembered IP for this role -> auto-discovered printer
        queue.async {
            self.resolvePrinter(role: role, typed: typed, port: portNum) { host, err in
                guard let host = host else { self.reply(id, false, "Cannot print - \(err ?? "no printer found")"); return }
                self.send(id: id, host: host, port: port, portNum: portNum, bytes: bytes)
            }
        }
    }

    // MARK: auto discovery (no IP setup needed)
    private func send(id: String, host ip: String, port: NWEndpoint.Port, portNum: Int, bytes: Data) {
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

    /// Opens a TCP connection and reports whether the port answered within `timeout` seconds.
    private func probe(_ host: String, _ portNum: Int, timeout: Double, _ done: @escaping (Bool) -> Void) {
        guard let p = NWEndpoint.Port(rawValue: UInt16(portNum)) else { done(false); return }
        let c = NWConnection(host: NWEndpoint.Host(host), port: p, using: .tcp)
        var fin = false
        let lock = NSLock()
        func end(_ ok: Bool) {
            lock.lock(); if fin { lock.unlock(); return }; fin = true; lock.unlock()
            c.cancel(); done(ok)
        }
        c.stateUpdateHandler = { st in
            switch st { case .ready: end(true); case .failed, .waiting: end(false); default: break }
        }
        c.start(queue: DispatchQueue.global())
        DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { end(false) }
    }

    /// First three octets of this iPhone's Wi-Fi address, e.g. "192.168.0".
    private static func lanPrefix() -> String? {
        var ifa: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifa) == 0, let first = ifa else { return nil }
        defer { freeifaddrs(ifa) }
        var ptr: UnsafeMutablePointer<ifaddrs>? = first
        while let cur = ptr {
            let i = cur.pointee
            if i.ifa_addr != nil, i.ifa_addr.pointee.sa_family == UInt8(AF_INET), String(cString: i.ifa_name) == "en0" {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                getnameinfo(i.ifa_addr, socklen_t(i.ifa_addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
                let ip = String(cString: host)
                if isPrivateIP(ip), let dot = ip.lastIndex(of: ".") { return String(ip[ip.startIndex..<dot]) }
            }
            ptr = i.ifa_next
        }
        return nil
    }

    private func scanPrinters(port: Int, _ done: @escaping ([String]) -> Void) {
        guard let pre = Coordinator.lanPrefix() else { done([]); return }
        let group = DispatchGroup()
        let lock = NSLock()
        var found: [String] = []
        for n in 1...254 {
            let h = "\(pre).\(n)"
            group.enter()
            probe(h, port, timeout: 0.9) { ok in
                if ok { lock.lock(); found.append(h); lock.unlock() }
                group.leave()
            }
        }
        group.notify(queue: queue) {
            done(found.sorted { (Int($0.split(separator: ".").last!) ?? 0) < (Int($1.split(separator: ".").last!) ?? 0) })
        }
    }

    private func resolvePrinter(role: String, typed: String, port: Int, _ done: @escaping (String?, String?) -> Void) {
        let ud = UserDefaults.standard
        let rk = "bnx_role_" + role
        func useScan() {
            scanPrinters(port: port) { found in
                if found.isEmpty { done(nil, "No printer found on this Wi-Fi. Is the printer ON and on the same network?"); return }
                let taken = ud.dictionaryRepresentation().filter { $0.key.hasPrefix("bnx_role_") && $0.key != rk }.compactMap { $0.value as? String }
                let pick = found.first(where: { !taken.contains($0) }) ?? found[0]
                ud.set(pick, forKey: rk); done(pick, nil)
            }
        }
        func tryMapped() {
            let mapped = ud.string(forKey: rk) ?? ""
            if mapped.isEmpty { useScan(); return }
            probe(mapped, port, timeout: 1.5) { ok in ok ? done(mapped, nil) : useScan() }
        }
        if !typed.isEmpty && typed.lowercased() != "auto" {
            probe(typed, port, timeout: 1.5) { ok in
                if ok { ud.set(typed, forKey: rk); done(typed, nil) } else { tryMapped() }
            }
        } else { tryMapped() }
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
