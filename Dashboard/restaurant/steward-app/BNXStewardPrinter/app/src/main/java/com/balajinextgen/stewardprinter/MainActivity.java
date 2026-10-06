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

import org.json.JSONArray;
import org.json.JSONObject;

import android.content.SharedPreferences;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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


    // ---------- AUTO PRINTER DISCOVERY (no IP setup needed) ----------
    private static boolean portOpen(String host, int port, int ms) {
        Socket s = new Socket();
        try { s.connect(new InetSocketAddress(host, port), ms); return true; }
        catch (Exception e) { return false; }
        finally { try { s.close(); } catch (Exception ignored) {} }
    }

    /** First 3 octets of this phone's Wi-Fi/LAN address, e.g. "192.168.0" (null if not on a LAN). */
    private static String lanPrefix() {
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis != null && nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> as = ni.getInetAddresses();
                while (as.hasMoreElements()) {
                    InetAddress a = as.nextElement();
                    if (a instanceof Inet4Address && isPrivateIp(a.getHostAddress())) {
                        String ip = a.getHostAddress();
                        return ip.substring(0, ip.lastIndexOf('.'));
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    /** Sweeps the phone's own /24 for anything listening on the printer port. */
    private static List<String> scanPrinters(final int port) {
        final List<String> found = Collections.synchronizedList(new ArrayList<String>());
        String pre = lanPrefix();
        if (pre == null) return found;
        ExecutorService ex = Executors.newFixedThreadPool(64);
        for (int i = 1; i < 255; i++) {
            final String h = pre + "." + i;
            ex.execute(new Runnable() { @Override public void run() { if (portOpen(h, port, 700)) found.add(h); } });
        }
        ex.shutdown();
        try { ex.awaitTermination(20, TimeUnit.SECONDS); } catch (Exception ignored) {}
        Collections.sort(found, new java.util.Comparator<String>() {
            @Override public int compare(String a, String b) {
                return Integer.parseInt(a.substring(a.lastIndexOf('.') + 1)) - Integer.parseInt(b.substring(b.lastIndexOf('.') + 1));
            }
        });
        return found;
    }

    /** Typed IP if it answers -> remembered IP for this role -> auto-discovered printer. */
    private String resolvePrinter(String role, String typed, int port) throws Exception {
        SharedPreferences sp = getSharedPreferences("bnx_printers", MODE_PRIVATE);
        String rk = "role_" + (role == null ? "" : role);
        if (typed != null && isPrivateIp(typed) && portOpen(typed, port, 1500)) { sp.edit().putString(rk, typed).apply(); return typed; }
        String mapped = sp.getString(rk, "");
        if (mapped.length() > 0 && portOpen(mapped, port, 1500)) return mapped;
        List<String> found = scanPrinters(port);
        if (found.isEmpty()) throw new Exception("No printer found on this Wi-Fi. Is the printer ON and on the same network?");
        java.util.Map<String, ?> all = sp.getAll();
        String pick = null;
        for (String ip : found) {                       // prefer a printer not already given to another role
            boolean used = false;
            for (java.util.Map.Entry<String, ?> e : all.entrySet())
                if (e.getKey().startsWith("role_") && !e.getKey().equals(rk) && ip.equals(e.getValue())) used = true;
            if (!used) { pick = ip; break; }
        }
        if (pick == null) pick = found.get(0);
        sp.edit().putString(rk, pick).apply();
        return pick;
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
                        int p = 9100;
                        try { p = Integer.parseInt(port.trim()); } catch (Exception ignored) {}
                        String typed = ip == null ? "" : ip.trim();
                        if (typed.length() > 0 && !typed.equalsIgnoreCase("auto") && !isPrivateIp(typed))
                            throw new Exception("Printer IP must be a local address (192.168.x.x / 10.x.x.x)");
                        String host = resolvePrinter(role, typed, p);
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
                        reply(id, false, "Cannot print - " + e.getMessage());
                    }
                }
            }).start();
        }

        /** Returns a JSON array of printer IPs found on this Wi-Fi (port 9100). */
        @JavascriptInterface
        public String scan() { return new JSONArray(scanPrinters(9100)).toString(); }

        @JavascriptInterface
        public String getVersion() { return "2.0-auto"; }
    }
}
