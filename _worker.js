/**
 * Balaji NextGen ERP - Cloudflare Pages Advanced Mode / Direct Upload Worker
 *
 * IMPORTANT:
 * This file is intentionally at the project root.
 * Cloudflare Pages Dashboard Drag & Drop supports _worker.js, while it does
 * not compile a /functions folder from Dashboard Direct Upload.
 */

const UPSTREAM = {
  "/api/core": "https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec",
  "/api/auth": "https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upstream = UPSTREAM[url.pathname];

    if (upstream) {
      return proxyToAppsScript(request, upstream);
    }

    // Keep all existing HTML/CSS/JS/images unchanged.
    return env.ASSETS.fetch(request);
  }
};

async function proxyToAppsScript(request, upstream) {
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  let body;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  let target = upstream;

  for (let attempt = 0; attempt < 5; attempt++) {
    const headers = new Headers(request.headers);

    // These headers belong to the browser/Cloudflare request, not the GAS
    // origin request.
    headers.delete("host");
    headers.delete("origin");
    headers.delete("referer");
    headers.delete("content-length");

    const init = {
      method,
      headers,
      redirect: "manual"
    };

    if (body !== undefined) init.body = body.slice(0);

    const response = await fetch(target, init);

    // Apps Script may return a redirect. Follow it manually so POST remains
    // POST; automatic browser-style 302 handling can turn POST into GET.
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) return decorate(response, request);
      target = new URL(location, target).href;
      continue;
    }

    return decorate(response, request);
  }

  return jsonError(508, "Too many upstream redirects", request);
}

function decorate(response, request) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request);

  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }

  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": new URL(request.url).origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonError(status, message, request) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}
