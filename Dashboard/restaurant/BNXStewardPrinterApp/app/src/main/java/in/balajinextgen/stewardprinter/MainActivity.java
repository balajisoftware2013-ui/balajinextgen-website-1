package in.balajinextgen.stewardprinter;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int APP_VERSION_CODE = 2;
    private static final String APP_VERSION_NAME = "1.1.0";
    /* Host this JSON on your website and change only this URL when needed. */
    private static final String UPDATE_URL = "https://balajinextgen.in/steward/update.json";

    private WebView webView;
    private final ExecutorService printerPool = Executors.newCachedThreadPool();
    private final ExecutorService updatePool = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private long downloadedApkId = -1L;
    private boolean receiverRegistered = false;

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

        main.postDelayed(() -> checkForUpdate(false), 2500);
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

    @JavascriptInterface
    public void checkForUpdateFromPOS() { checkForUpdate(false); }

    private void checkForUpdate(boolean manual) {
        updatePool.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                c.setConnectTimeout(5000); c.setReadTimeout(7000);
                c.setRequestMethod("GET"); c.setUseCaches(false);
                StringBuilder b = new StringBuilder();
                java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream()));
                String line; while ((line = r.readLine()) != null) b.append(line); r.close(); c.disconnect();
                JSONObject j = new JSONObject(b.toString());
                int code = j.getInt("versionCode");
                String name = j.optString("versionName", "");
                String apk = j.getString("apkUrl");
                if (code <= APP_VERSION_CODE) { if(manual) toast("Steward is already up to date"); return; }
                main.post(() -> downloadAndInstall(apk, name));
            } catch (Exception e) {
                if(manual) toast("Update check failed: " + e.getMessage());
            }
        });
    }

    private void downloadAndInstall(String apkUrl, String versionName) {
        try {
            toast("Steward update " + versionName + " available. Downloading…");
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(apkUrl));
            req.setTitle("Balaji NextGen Steward update");
            req.setDescription("Downloading update " + versionName);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "BNXSteward-update.apk");
            downloadedApkId = dm.enqueue(req);
        } catch (Exception e) { toast("Update download failed: " + e.getMessage()); }
    }

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != downloadedApkId) return;
            installDownloadedApk(id);
        }
    };

    private void installDownloadedApk(long id) {
        try {
            DownloadManager dm = (DownloadManager)getSystemService(DOWNLOAD_SERVICE);
            Uri uri = dm.getUriForDownloadedFile(id);
            if (uri == null) { toast("Update download incomplete"); return; }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) { toast("Cannot open update installer: " + e.getMessage()); }
    }

    private void toast(String s) { main.post(() -> Toast.makeText(MainActivity.this, s, Toast.LENGTH_LONG).show()); }

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
        unregisterReceiverSafe();
        printerPool.shutdownNow(); updatePool.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private void unregisterReceiverSafe() { try { if(receiverRegistered){ unregisterReceiver(downloadReceiver); receiverRegistered=false; } } catch(Exception ignored){} }

    @Override protected void onResume() {
        super.onResume();
        try { if(!receiverRegistered){ registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED); receiverRegistered=true; } } catch(Exception ignored){}
    }
}
