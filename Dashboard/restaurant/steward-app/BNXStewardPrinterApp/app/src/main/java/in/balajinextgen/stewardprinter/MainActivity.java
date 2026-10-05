package in.balajinextgen.stewardprinter;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView webView;
    private final ExecutorService printerPool = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setBuiltInZoomControls(false);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new BNXPrinterBridge(), "BNXPrinter");
        webView.loadUrl("file:///android_asset/steward-mobile.html");
    }

    public class BNXPrinterBridge {
        @JavascriptInterface
        public void printRaw(final String id, final String role, final String host,
                             final String portText, final String b64, final String job) {
            final int port;
            try { port = Integer.parseInt(portText); } catch (Exception e) { callback(id,false,"Invalid printer port"); return; }
            if (port != 9100) { callback(id,false,"Only printer port 9100 is allowed"); return; }
            if (!host.matches("(?:\\d{1,3}\\.){3}\\d{1,3}")) { callback(id,false,"Invalid printer IP"); return; }
            printerPool.execute(() -> {
                try {
                    byte[] data = Base64.getDecoder().decode(b64);
                    if (data.length < 2 || (data[0] & 0xff) != 0x1b || (data[1] & 0xff) != 0x40) {
                        throw new Exception("Rejected: not raw ESC/POS (expected 1B 40)");
                    }
                    try (Socket socket = new Socket()) {
                        socket.setTcpNoDelay(true);
                        socket.connect(new InetSocketAddress(host, port), 5000);
                        socket.setSoTimeout(5000);
                        OutputStream os = socket.getOutputStream();
                        os.write(data);
                        os.flush();
                        socket.shutdownOutput();
                    }
                    callback(id,true,"PRINT SENT to " + host + ":" + port);
                } catch (Exception e) {
                    String m = e.getMessage();
                    if (m == null || m.isEmpty()) m = e.getClass().getSimpleName();
                    callback(id,false,role + " printer " + host + ":9100 failed — " + m);
                }
            });
        }
    }

    private void callback(String id, boolean ok, String msg) {
        main.post(() -> {
            String js = "window.bnxNativePrintResult(" + jsQuote(id) + "," + ok + "," + jsQuote(msg) + ")";
            if (webView != null) webView.evaluateJavascript(js, null);
            if (!ok) Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
        });
    }

    private static String jsQuote(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    @Override protected void onDestroy() {
        printerPool.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
