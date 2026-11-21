package in.balajinextgen.happyserve.printer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * HappyServe Printer — the steward app (steward-mobile.html) inside a WebView, plus the native printer bridge the page
 * already looks for: window.BNXPrinter.printRaw(id, role, ip, port, base64, job).
 *
 * The phone opens a TCP socket straight to the WiFi printer (port 9100) and writes the ESC/POS bytes the page built.
 * No PC, no QZ Tray, no server print queue, no internet needed for the print itself. When the printer has the bytes,
 * the page is told through window.bnxNativePrintResult(id, ok, message).
 */
public class MainActivity extends Activity {

    static final String DEFAULT_URL = "https://www.balajinextgen.in/Dashboard/restaurant/steward-app/steward-mobile.html";
    static final String PREFS = "bnx_printer";
    static final int FILE_REQ = 4711;

    WebView web;
    SharedPreferences prefs;
    ValueCallback<Uri[]> fileCb;
    boolean errorShown = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " BNXPrinterApp/" + BuildInfo.VERSION);

        web.addJavascriptInterface(new Bridge(), "BNXPrinter");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (state != null) web.restoreState(state);
        else web.loadUrl(startUrl());
    }

    String startUrl() {
        String u = prefs.getString("url", "");
        return (u == null || u.trim().isEmpty()) ? DEFAULT_URL : u.trim();
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) { web.goBack(); return true; }
        return super.onKeyDown(keyCode, event);
    }

    @Override protected void onResume() { super.onResume(); web.onResume(); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && fileCb != null) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    r = new Uri[n];
                    for (int i = 0; i < n; i++) r[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) r = new Uri[]{data.getData()};
            }
            fileCb.onReceiveValue(r);
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    /** Website address dialog: first run is automatic; later through BNXPrinter.openSettings() or a load error. */
    void askUrl(String why) {
        final EditText in = new EditText(this);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        in.setText(startUrl());
        new AlertDialog.Builder(this)
                .setTitle("Steward app address")
                .setMessage(why == null ? "Address of the HappyServe steward page:" : why)
                .setView(in)
                .setPositiveButton("Open", (d, w) -> {
                    String u = in.getText().toString().trim();
                    if (!u.startsWith("https://")) u = "https://" + u.replaceFirst("^https?://", "");
                    prefs.edit().putString("url", u).apply();
                    errorShown = false;
                    web.loadUrl(u);
                })
                .setNeutralButton("Default", (d, w) -> {
                    prefs.edit().remove("url").apply();
                    errorShown = false;
                    web.loadUrl(DEFAULT_URL);
                })
                .setNegativeButton("Retry", (d, w) -> { errorShown = false; web.reload(); })
                .show();
    }

    /** Hand back the result of one print job to the page (always on the UI thread). */
    void result(final String id, final boolean ok, final String msg) {
        final String js = "window.bnxNativePrintResult&&window.bnxNativePrintResult(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(msg) + ")";
        runOnUiThread(() -> { try { web.evaluateJavascript(js, null); } catch (Throwable ignored) {} });
    }

    /* ─────────── the bridge the page calls ─────────── */
    class Bridge {
        @JavascriptInterface
        public void printRaw(String id, String role, String ip, String port, String b64, String job) {
            byte[] data;
            try { data = Base64.decode(b64 == null ? "" : b64, Base64.DEFAULT); }
            catch (IllegalArgumentException e) { result(id, false, "Bad print data"); return; }
            int p = 9100;
            try { p = Integer.parseInt(port == null ? "" : port.trim()); } catch (NumberFormatException ignored) {}
            final byte[] bytes = data;
            final int fp = p;
            Printer.get(MainActivity.this).print(role, ip, fp, bytes, (ok, msg) -> result(id, ok, msg));
        }

        @JavascriptInterface public boolean isReady() { return true; }

        /** true when a printer answers on ip:port through the Wi-Fi network (blocks <1 s; the page calls it off the UI thread). */
        @JavascriptInterface public boolean probe(String ip, String port) {
            int p = 9100;
            try { p = Integer.parseInt(port == null ? "" : port.trim()); } catch (NumberFormatException ignored) {}
            return Printer.get(MainActivity.this).probe(ip, p);
        }

        @JavascriptInterface public String version() { return BuildInfo.VERSION; }

        /** Printers found on this WiFi (port 9100) as JSON ["192.168.1.50", …] — slow (up to ~4 s), for setup screens. */
        @JavascriptInterface public String scan() { return Printer.get(MainActivity.this).scanJson(); }

        @JavascriptInterface public void openSettings() { runOnUiThread(() -> askUrl(null)); }

        @JavascriptInterface public void toast(String m) { runOnUiThread(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show()); }
    }

    /* ─────────── page loading ─────────── */
    class Client extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return handle(r.getUrl()); }

        @SuppressWarnings("deprecation")
        @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return handle(Uri.parse(url)); }

        boolean handle(Uri u) {
            String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
            if (sc.equals("http") || sc.equals("https")) {
                String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
                /* our site + Google sign-in / Apps Script stay inside; WhatsApp, maps, UPI … open their own app */
                if (h.endsWith("balajinextgen.in") || h.endsWith("google.com") || h.endsWith("googleusercontent.com")
                        || h.endsWith("github.io") || h.equals(Uri.parse(startUrl()).getHost())) return false;
            }
            try {
                Intent i = sc.equals("intent") ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, u);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (ActivityNotFoundException | java.net.URISyntaxException e) {
                Toast.makeText(MainActivity.this, "No app to open this link", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override public void onPageStarted(WebView v, String url, Bitmap fav) { super.onPageStarted(v, url, fav); }

        @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (r.isForMainFrame() && !errorShown) {
                errorShown = true;
                askUrl("Could not open the steward page (" + e.getDescription() + "). Check the internet / address:");
            }
        }
    }

    class Chrome extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (fileCb != null) fileCb.onReceiveValue(null);
            fileCb = cb;
            try { startActivityForResult(p.createIntent(), FILE_REQ); }
            catch (ActivityNotFoundException e) { fileCb = null; return false; }
            return true;
        }
    }

    static final class BuildInfo { static final String VERSION = "1.1"; }

    @SuppressWarnings("unused") static void hide(View v) { v.setVisibility(View.GONE); }
}
