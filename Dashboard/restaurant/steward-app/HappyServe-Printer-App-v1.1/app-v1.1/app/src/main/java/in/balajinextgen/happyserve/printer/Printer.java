package in.balajinextgen.happyserve.printer;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.LinkAddress;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;

import org.json.JSONArray;

import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Raw ESC/POS over TCP (port 9100) straight from the phone to a WiFi printer.
 * One queue per printer: tickets for the same printer go one after another (never mixed),
 * Kitchen / Bar / Hukka printers work in parallel.
 */
final class Printer {

    interface Done { void done(boolean ok, String message); }

    private static Printer one;
    static synchronized Printer get(Context c) { if (one == null) one = new Printer(c.getApplicationContext()); return one; }

    private static final Pattern IPV4 = Pattern.compile("^(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}$");
    private final Context ctx;
    private final SharedPreferences prefs;
    private final Map<String, ExecutorService> lanes = new HashMap<>();

    private Printer(Context c) { ctx = c; prefs = c.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE); }

    private synchronized ExecutorService lane(String key) {
        ExecutorService e = lanes.get(key);
        if (e == null) { e = Executors.newSingleThreadExecutor(); lanes.put(key, e); }
        return e;
    }

    void print(final String role, final String ipIn, final int port, final byte[] data, final Done cb) {
        final String r = role == null ? "" : role.trim().toUpperCase();
        final String ip0 = ipIn == null ? "" : ipIn.trim();
        lane(IPV4.matcher(ip0).matches() ? ip0 : ("auto-" + r)).execute(() -> {
            String ip = ip0;
            try {
                if (data.length < 2 || data[0] != 0x1B || data[1] != 0x40) { cb.done(false, "Not ESC/POS data — nothing sent"); return; }
                if (!IPV4.matcher(ip).matches()) {                       /* "auto" / empty: printer found on this WiFi */
                    ip = prefs.getString("auto_" + r, "");
                    if (ip == null || !IPV4.matcher(ip).matches() || !open(ip, port, 600)) {
                        List<String> found = scan(port);
                        if (found.isEmpty()) { cb.done(false, "No printer found on this WiFi (port " + port + ")"); return; }
                        ip = found.get(0);
                        prefs.edit().putString("auto_" + r, ip).apply();
                    }
                }
                String err = send(ip, port, data);
                if (err != null) {                                       /* one retry: printer woke up / WiFi blip */
                    try { Thread.sleep(400); } catch (InterruptedException ignored) {}
                    err = send(ip, port, data);
                }
                if (err == null) cb.done(true, "Printed on " + ip);
                else cb.done(false, "Printer " + ip + ": " + err);
            } catch (Throwable t) {
                cb.done(false, "Printer " + ip + ": " + t.getMessage());
            }
        });
    }

    /**
     * The Wi-Fi network (or Ethernet) of this phone. When the restaurant Wi-Fi has no internet, Android keeps it connected
     * but sends ordinary sockets out over MOBILE DATA - a 192.168.x.x printer is then "not answering" even though the phone
     * is on the printer's Wi-Fi. Binding every printer socket to the Wi-Fi network fixes that.
     */
    @SuppressWarnings("deprecation")
    private Network lan() {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return null;
            Network best = null;
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities c = cm.getNetworkCapabilities(n);
                if (c == null) continue;
                if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return n;
                if (c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) best = n;
            }
            return best;
        } catch (Throwable t) { return null; }
    }

    private void bind(Socket s) {
        try { Network n = lan(); if (n != null) n.bindSocket(s); } catch (Throwable ignored) {}
    }

    /** null = all bytes handed to the printer; otherwise the reason. */
    private String send(String ip, int port, byte[] data) {
        Socket s = new Socket();
        try {
            bind(s);
            s.setTcpNoDelay(true);
            s.connect(new InetSocketAddress(ip, port), 2500);
            s.setSoTimeout(5000);
            OutputStream o = s.getOutputStream();
            o.write(data);
            o.flush();
            try { Thread.sleep(80); } catch (InterruptedException ignored) {}    /* let the printer read the buffer before FIN */
            try { s.shutdownOutput(); } catch (Exception ignored) {}
            return null;
        } catch (java.net.SocketTimeoutException e) {
            return "not answering (is it on and on this WiFi?)";
        } catch (java.net.ConnectException e) {
            return "refused / off";
        } catch (Exception e) {
            return e.getClass().getSimpleName() + (e.getMessage() == null ? "" : " " + e.getMessage());
        } finally {
            try { s.close(); } catch (Exception ignored) {}
        }
    }

    private boolean open(String ip, int port, int ms) {
        Socket s = new Socket();
        try { bind(s); s.connect(new InetSocketAddress(ip, port), ms); return true; }
        catch (Exception e) { return false; }
        finally { try { s.close(); } catch (Exception ignored) {} }
    }

    /** Is a printer answering on ip:port right now (through the Wi-Fi network)? Used by the page's Kitchen/Bar/Hukka dots. */
    boolean probe(String ip, int port) {
        if (ip == null || !IPV4.matcher(ip.trim()).matches()) return false;
        return open(ip.trim(), port, 900);
    }

    String scanJson() {
        JSONArray a = new JSONArray();
        for (String ip : scan(9100)) a.put(ip);
        return a.toString();
    }

    /** Every address on this WiFi's /24 with the port open, lowest first. */
    @SuppressWarnings("deprecation")
    List<String> scan(final int port) {
        final List<String> found = Collections.synchronizedList(new ArrayList<>());
        int me = 0;
        try {   /* preferred: the IPv4 address of the Wi-Fi link itself */
            Network n = lan();
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            LinkProperties lp = (n != null && cm != null) ? cm.getLinkProperties(n) : null;
            if (lp != null) for (LinkAddress la : lp.getLinkAddresses()) {
                if (la.getAddress() instanceof Inet4Address) {
                    byte[] b = la.getAddress().getAddress();
                    me = (b[0] & 0xff) | ((b[1] & 0xff) << 8) | ((b[2] & 0xff) << 16) | ((b[3] & 0xff) << 24);
                    break;
                }
            }
        } catch (Throwable ignored) {}
        if (me == 0) try {
            WifiManager w = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            if (w != null && w.getConnectionInfo() != null) me = w.getConnectionInfo().getIpAddress();
        } catch (Exception ignored) {}
        if (me == 0) return found;
        final String base = (me & 0xff) + "." + ((me >> 8) & 0xff) + "." + ((me >> 16) & 0xff) + ".";
        final int self = (me >> 24) & 0xff;
        ExecutorService pool = Executors.newFixedThreadPool(48);
        for (int i = 1; i < 255; i++) {
            if (i == self) continue;
            final String ip = base + i;
            pool.execute(() -> { if (open(ip, port, 450)) found.add(ip); });
        }
        pool.shutdown();
        try { pool.awaitTermination(6, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        List<String> out = new ArrayList<>(found);
        Collections.sort(out, (x, y) -> Integer.compare(last(x), last(y)));
        return out;
    }

    private static int last(String ip) { try { return Integer.parseInt(ip.substring(ip.lastIndexOf('.') + 1)); } catch (Exception e) { return 999; } }
}
