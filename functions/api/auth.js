const UPSTREAM = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';

export async function onRequest(context) {
  const request = context.request;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  try {
    const response = await proxyPreservingPost_(request, UPSTREAM);
    const headers = new Headers(response.headers);

    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Access-Control-Allow-Origin', new URL(request.url).origin);
    headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Vary', 'Origin');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Cloudflare API proxy failed',
      message: String(err && err.message || err)
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(request)
      }
    });
  }
}

async function proxyPreservingPost_(request, upstream) {
  // Read the body once. This is important because Request bodies are streams.
  const body = (request.method === 'GET' || request.method === 'HEAD')
    ? undefined
    : await request.arrayBuffer();

  let url = upstream;

  for (let i = 0; i < 4; i++) {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');
    headers.delete('content-length');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual'
    };

    if (body !== undefined) init.body = body.slice(0);

    const response = await fetch(url, init);

    // Apps Script web apps commonly redirect. Follow Location manually so
    // POST remains POST instead of being converted to GET by a 302/303.
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (!location) return response;
      url = new URL(location, url).href;
      continue;
    }

    return response;
  }

  throw new Error('Too many upstream redirects');
}

function corsHeaders(request) {
  const origin = new URL(request.url).origin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
