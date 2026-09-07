// Balaji NextGen ERP — V2_AUTH proxy
exports.handler = async (event) => {
  const target = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';
  const method = event.httpMethod || event.requestContext?.http?.method || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}, body:'' };
  try {
    let body = event.body || '{}';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    const response = await fetch(target, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body, redirect:'follow' });
    return { statusCode:response.status, headers:{'Content-Type':response.headers.get('content-type')||'application/json; charset=utf-8','Cache-Control':'no-store'}, body:await response.text() };
  } catch(err) { return {statusCode:502,headers:{'Content-Type':'application/json'},body:JSON.stringify({success:false,error:'V2_AUTH proxy failed: '+String(err?.message||err)})}; }
};
