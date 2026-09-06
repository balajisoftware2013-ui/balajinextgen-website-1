const TARGET = "https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec";

function headers(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "*";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
  };
}

exports.handler = async (event) => {
  const h = headers(event);
  const method = String(event.httpMethod || "GET").toUpperCase();

  if (method === "OPTIONS") return { statusCode: 204, headers: h, body: "" };

  /* GET is a health endpoint only. ERP data is POST-only. */
  if (method === "GET") {
    return {
      statusCode: 200,
      headers: h,
      body: JSON.stringify({success:true, service:"ERP proxy", method:"POST", upstream:TARGET})
    };
  }

  if (method !== "POST") {
    return {statusCode:405, headers:h, body:JSON.stringify({success:false,error:"POST required"})};
  }

  let body = event.body || "";
  if (event.isBase64Encoded) {
    try { body = Buffer.from(body, "base64").toString("utf8"); }
    catch (e) {
      return {statusCode:400, headers:h, body:JSON.stringify({success:false,error:"Invalid request body"})};
    }
  }

  try {
    const upstream = await fetch(TARGET, {
      method:"POST",
      headers:{
        "Content-Type":"text/plain;charset=utf-8",
        "Accept":"application/json,text/plain,*/*"
      },
      body
    });
    const text = await upstream.text();
    const outHeaders = Object.assign({}, h, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    });
    return {statusCode:upstream.status, headers:outHeaders, body:text};
  } catch (err) {
    return {
      statusCode:502,
      headers:h,
      body:JSON.stringify({success:false,error:"Upstream ERP API unavailable",detail:String(err && err.message || err)})
    };
  }
};
