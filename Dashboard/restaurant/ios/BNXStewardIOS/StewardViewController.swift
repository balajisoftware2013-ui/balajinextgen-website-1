import UIKit
import WebKit

final class StewardViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    private let queue = DispatchQueue(label: "in.balajinextgen.bnxsteward.print", qos: .userInitiated)

    override func viewDidLoad() {
        super.viewDidLoad()
        let cfg = WKWebViewConfiguration()
        cfg.userContentController.add(self, name: "bnxPrinter")
        webView = WKWebView(frame: .zero, configuration: cfg)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)
        if let url = Bundle.main.url(forResource: "steward-mobile", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bnxPrinter", let body = message.body as? [String: Any],
              let ip = body["ip"] as? String, let b64 = body["dataBase64"] as? String else { return }
        let port = (body["port"] as? NSNumber)?.intValue ?? 9100
        queue.async {
            do {
                guard let data = Data(base64Encoded: b64) else { throw NSError(domain: "BNX", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid print data"]) }
                try self.sendTCP(ip: ip, port: port, data: data)
                DispatchQueue.main.async { self.reply(ok: true, error: nil) }
            } catch { DispatchQueue.main.async { self.reply(ok: false, error: error.localizedDescription) } }
        }
    }

    private func reply(ok: Bool, error: String?) {
        let payload = "window.dispatchEvent(new CustomEvent('bnxNativePrintResult',{detail:" + (ok ? "{ok:true}" : "{ok:false,error:" + (error ?? "Print failed").replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'") + "}") + "}));"
        webView.evaluateJavaScript(payload)
    }

    private func sendTCP(ip: String, port: Int, data: Data) throws {
        guard let host = CFHostCreateWithName(nil, ip as CFString).takeRetainedValue() as CFHost? else { throw NSError(domain: "BNX", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid printer address"]) }
        var addresses: NSArray?; CFHostStartInfoResolution(host, .addresses, nil); CFHostGetAddressing(host, &addresses)
        guard let addr = (addresses as? [Data])?.first else { throw NSError(domain: "BNX", code: 3, userInfo: [NSLocalizedDescriptionKey: "Printer address unavailable"]) }
        var socket = Int32(socket(AF_INET, SOCK_STREAM, 0)); guard socket >= 0 else { throw NSError(domain: "BNX", code: 4, userInfo: [NSLocalizedDescriptionKey: "Socket failed"]) }
        defer { close(socket) }
        var sockaddr = addr.withUnsafeBytes { $0.load(as: sockaddr_in.self) }; sockaddr.sin_port = in_port_t(UInt16(port).bigEndian)
        let connected = withUnsafePointer(to: &sockaddr) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(socket, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        guard connected == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "Cannot connect to \(ip):\(port)"]) }
        try data.withUnsafeBytes { raw in
            var sent = 0
            while sent < data.count { let n = Darwin.send(socket, raw.baseAddress!.advanced(by: sent), data.count - sent, 0); if n <= 0 { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSLocalizedDescriptionKey: "Printer write failed"]) }; sent += n }
        }
    }
}
