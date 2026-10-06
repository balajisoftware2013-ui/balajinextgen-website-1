package in.balajinextgen.stewardprinter;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * BNX Steward Printer App.
 *
 * Loads the LIVE steward page (so every web fix reaches the phones without a new APK) and gives it
 * window.BNXPrinter.printRaw(...) so it can send ESC/POS bytes straight to printer IP:9100.
 */
public class MainActivity extends Activity {

    /* ---- Change these only if the site address changes ---- */
    static final String START_URL  = "https://balajinextgen.in/steward-mobile.html";
    static final String UPDATE_URL = "https://balajinextgen.in/steward/update.json";

    /** Hosts that may run the page AND use the printer bridge. Sub-domains of these are accepted too. */
    static final String[] TRUSTED_DOMAINS = { "balajinextgen.in" };   /* covers www.balajinextgen.in as well */

    /** Hosts that stay inside the app (login / backend pages) but are NEVER given printer access. */
    static final String[] STAY_IN_APP_HOSTS = {
            "script.google.com", "script.googleusercontent.com", "accounts.google.com"
    };

    /** Added to the WebView user agent so the page can tell it is inside the app. */
    static final String UA_TOKEN = " BNXStewardApp/2.0";

    private static final int REQ_FILE = 4711;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private volatile String pageHost = "";
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService printerPool = Executors.newCachedThreadPool();
    /** One lock per printer so two tickets for the same printer never interleave. */
    private final ConcurrentHashMap<String, Object> printerLocks = new ConcurrentHashMap<>();

    /* ------------------------------------------------------------------ host helpers */

    private static String hostOf(String url) {
        try {
            String h = Uri.parse(url).getHost();
            return h == null ? "" : h.toLowerCase(Locale.ROOT);
        } catch (Exception e) { return ""; }
    }

    private static boolean isTrustedHost(String h) {
        if (h == null) return false;
        h = h.toLowerCase(Locale.ROOT);
        for (String d : TRUSTED_DOMAINS) {
            if (h.equals(d) || h.endsWith("." + d)) return true;
        }
        return false;
    }

    private static boolean staysInApp(String h) {
        if (isTrustedHost(h)) return true;
        for (String s : STAY_IN_APP_HOSTS) if (s.equalsIgnoreCase(h)) return true;
        return false;
    }

    private static boolean isPrivateIp(String ip) {
        return ip != null && ip.matches(
                "^(10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"
              + "|192\\.168\\.\\d{1,3}\\.\\d{1,3}"
              + "|172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})$");
    }

    /* ------------------------------------------------------------------ lifecycle */

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);   /* chrome://inspect works on debug builds */
        }

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + UA_TOKEN);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
                if (scheme.equals("about") || scheme.equals("blob") || scheme.equals("data")) return false;
                if (scheme.equals("https") && staysInApp(hostOf(u.toString()))) return false;
                /* everything else (other websites, tel:, mailto:, whatsapp:, upi: ...) opens outside the app */
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap favicon) {
                pageHost = hostOf(url);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                pageHost = hostOf(url);
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) showOfflinePage();
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String ua, String cd, String mime, long len) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
            }
        });

        /* Bridge is registered BEFORE loadUrl so it exists before any page script runs. */
        web.addJavascriptInterface(new Bridge(), "BNXPrinter");

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(START_URL);

        main.postDelayed(new Runnable() { @Override public void run() { checkForUpdate(); } }, 3000);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override
    protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        printerPool.shutdown();
        if (web != null) { web.removeJavascriptInterface("BNXPrinter"); web.destroy(); }
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) { web.goBack(); return true; }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void showOfflinePage() {
        String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='font-family:sans-serif;text-align:center;padding:40px'>"
                + "<h2>No connection</h2><p>Check the internet / Wi-Fi, then tap Retry.</p>"
                + "<button style='padding:14px 28px;font-size:16px;border-radius:10px' "
                + "onclick=\"location.href='" + START_URL + "'\">Retry</button></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    /* ------------------------------------------------------------------ printer bridge */

    private void reply(final String id, final boolean ok, final String msg) {
        final String js = "try{window.bnxNativePrintResult("
                + JSONObject.quote(id == null ? "" : id) + "," + ok + ","
                + JSONObject.quote(msg == null ? "" : msg) + ");}catch(e){}";
        main.post(new Runnable() {
            @Override public void run() { if (web != null) web.evaluateJavascript(js, null); }
        });
    }

    private class Bridge {
        /** Page -> app. All arguments are strings. data = base64 ESC/POS bytes. */
        @JavascriptInterface
        public void printRaw(final String id, final String role, final String ip,
                             final String port, final String b64, final String job) {
            /* Only our own site may print. */
            if (!isTrustedHost(pageHost)) {
                reply(id, false, "Blocked: this page is not allowed to print.");
                return;
            }
            printerPool.execute(new Runnable() {
                @Override public void run() { doPrint(id, role, ip, port, b64); }
            });
        }

        @JavascriptInterface public String getVersion() { return "2.0.0"; }
        @JavascriptInterface public boolean isNative() { return true; }
    }

    private void doPrint(String id, String role, String ipIn, String portIn, String b64) {
        String ip = ipIn == null ? "" : ipIn.trim();
        try {
            if (!isPrivateIp(ip)) throw new Exception("Printer IP must be a local address (192.168.x.x / 10.x.x.x / 172.16-31.x.x)");

            int port;
            try { port = Integer.parseInt(portIn == null ? "" : portIn.trim()); }
            catch (Exception e) { throw new Exception("Invalid printer port"); }
            if (!((port >= 9100 && port <= 9109) || port == 515)) throw new Exception("Printer port " + port + " is not allowed");

            byte[] data;
            try { data = Base64.decode(b64 == null ? "" : b64, Base64.DEFAULT); }
            catch (IllegalArgumentException e) { throw new Exception("Bad print data"); }
            if (data.length < 2 || (data[0] & 0xff) != 0x1B || (data[1] & 0xff) != 0x40) {
                throw new Exception("Rejected: not raw ESC/POS (expected 1B 40)");
            }

            Object lock = printerLocks.get(ip + ":" + port);
            if (lock == null) {
                Object fresh = new Object();
                Object prev = printerLocks.putIfAbsent(ip + ":" + port, fresh);
                lock = prev == null ? fresh : prev;
            }
            synchronized (lock) {
                Socket sock = new Socket();
                try {
                    sock.setTcpNoDelay(true);
                    sock.connect(new InetSocketAddress(ip, port), 5000);
                    sock.setSoTimeout(5000);
                    OutputStream o = sock.getOutputStream();
                    o.write(data);
                    o.flush();
                    Thread.sleep(400);   /* let the printer take the last bytes before the socket closes */
                } finally {
                    try { sock.close(); } catch (Exception ignored) {}
                }
            }
            reply(id, true, "PRINT SENT to " + ip + ":" + port);
        } catch (Exception e) {
            String m = e.getMessage();
            if (m == null || m.length() == 0) m = e.getClass().getSimpleName();
            reply(id, false, (role == null ? "" : role + " ") + "printer " + ip + " failed - " + m);
        }
    }

    /* ------------------------------------------------------------------ update check */

    /** Checks update.json; if a newer APK exists, asks once and opens the download link. */
    private void checkForUpdate() {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                    c.setConnectTimeout(5000);
                    c.setReadTimeout(7000);
                    c.setUseCaches(false);
                    StringBuilder b = new StringBuilder();
                    BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
                    String line;
                    while ((line = r.readLine()) != null) b.append(line);
                    r.close();
                    c.disconnect();

                    JSONObject j = new JSONObject(b.toString());
                    final int newCode = j.getInt("versionCode");
                    final String newName = j.optString("versionName", "");
                    final String apk = j.getString("apkUrl");

                    PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                    long cur = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
                    if (newCode <= cur) return;
                    if (!apk.startsWith("https://") || !isTrustedHost(hostOf(apk))) return;

                    main.post(new Runnable() {
                        @Override public void run() {
                            if (isFinishing()) return;
                            new AlertDialog.Builder(MainActivity.this)
                                    .setTitle("Update available")
                                    .setMessage("A new version of the Steward Printer App (" + newName + ") is ready.")
                                    .setPositiveButton("Update", new android.content.DialogInterface.OnClickListener() {
                                        @Override public void onClick(android.content.DialogInterface d, int w) {
                                            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(apk))); }
                                            catch (Exception ignored) {}
                                        }
                                    })
                                    .setNegativeButton("Later", null)
                                    .show();
                        }
                    });
                } catch (Exception ignored) { /* offline or no update file - silently ignore */ }
            }
        }).start();
    }
}
