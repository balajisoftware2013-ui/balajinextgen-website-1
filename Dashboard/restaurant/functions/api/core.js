const UPSTREAM = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

export async function onRequest(context) {
  return proxyToGAS(context.request, UPSTREAM);
}

async function proxyToGAS(request, upstream) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  const init = {
    method: request.method,
    headers,
    redirect: 'follow'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(upstream, init);
  const out = new Headers(response.headers);
  out.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  out.set('Access-Control-Allow-Origin', new URL(request.url).origin);
  out.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  out.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  out.set('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: out
  });
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
