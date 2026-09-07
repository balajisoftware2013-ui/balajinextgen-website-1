const GAS_URL = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: {'Content-Type':'application/json'}, body: JSON.stringify({success:false,error:'POST required'}) };
  try {
    const r = await fetch(GAS_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:event.body || '{}', redirect:'follow'});
    const text = await r.text();
    return { statusCode:r.status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}, body:text };
  } catch (e) { return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({success:false,error:'Core proxy failed: '+e.message})}; }
};
