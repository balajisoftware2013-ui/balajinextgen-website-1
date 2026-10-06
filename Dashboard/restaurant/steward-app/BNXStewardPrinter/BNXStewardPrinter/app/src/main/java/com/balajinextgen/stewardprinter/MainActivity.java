package com.balajinextgen.stewardprinter;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

public class MainActivity extends Activity {

    /** Page the app opens. Change this if the steward page lives at a different address. */
    static final String START_URL = "https://www.balajinextgen.in/steward-mobile.html";
    static final String ALLOWED_HOST = "www.balajinextgen.in";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("https".equals(u.getScheme()) && ALLOWED_HOST.equalsIgnoreCase(u.getHost())) {
                    return false; // stay inside the app
                }
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    v.loadData("<html><body style='font-family:sans-serif;text-align:center;padding:40px'>"
                            + "<h2>No connection</h2><p>Check the internet / Wi-Fi.</p>"
                            + "<button style='padding:12px 24px;font-size:16px' onclick=\"location.href='"
                            + START_URL + "'\">Retry</button></body></html>", "text/html", "UTF-8");
                }
            }
        });

        // Bridge name and method are what steward-mobile.html looks for: window.BNXPrinter.printRaw(...)
        web.addJavascriptInterface(new Bridge(), "BNXPrinter");
        web.loadUrl(START_URL);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) { web.goBack(); return true; }
        return super.onKeyDown(keyCode, event);
    }

    private static boolean isPrivateIp(String ip) {
        return ip.matches("^(10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})$");
    }

    private void reply(final String id, final boolean ok, final String msg) {
        web.post(new Runnable() {
            @Override public void run() {
                web.evaluateJavascript("window.bnxNativePrintResult(" + JSONObject.quote(id) + ","
                        + ok + "," + JSONObject.quote(msg) + ")", null);
            }
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void printRaw(final String id, final String role, final String ip,
                             final String port, final String b64, final String job) {
            new Thread(new Runnable() {
                @Override public void run() {
                    try {
                        String host = ip == null ? "" : ip.trim();
                        if (!isPrivateIp(host)) throw new Exception("Printer IP must be a local address (192.168.x.x / 10.x.x.x)");
                        int p = Integer.parseInt(port.trim());
                        byte[] data = Base64.decode(b64, Base64.DEFAULT);
                        Socket sock = new Socket();
                        try {
                            sock.connect(new InetSocketAddress(host, p), 5000);
                            sock.setSoTimeout(5000);
                            sock.setTcpNoDelay(true);
                            OutputStream o = sock.getOutputStream();
                            o.write(data);
                            o.flush();
                            Thread.sleep(300); // let the printer take the last bytes before closing
                        } finally {
                            try { sock.close(); } catch (Exception ignored) {}
                        }
                        reply(id, true, "");
                    } catch (Exception e) {
                        reply(id, false, "Cannot print to " + ip + ":" + port + " - " + e.getMessage());
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public String getVersion() { return "1.0"; }
    }
}
