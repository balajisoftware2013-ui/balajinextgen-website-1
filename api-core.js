// Same-origin proxy for /api/core -> V2_CORE Apps Script web app.
// Keep this deployment ID in sync with GAS_APIS_DASH.V2_CORE in
// restaurant-dashboard.html / steward-mobile.html / other frontends.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed -- this proxy only accepts POST' };
  }
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: event.body,
      redirect: 'follow' // GAS /exec 302s internally to script.googleusercontent.com
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'V2_CORE proxy failed: ' + err.message })
    };
  }
};
