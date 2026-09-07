exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Allow": "POST, OPTIONS", "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "POST required" })
    };
  }

  const target = "https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec";

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": event.headers?.["content-type"] || "application/json"
      },
      body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body) : "{}",
      redirect: "follow"
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store"
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(err && err.message || err) })
    };
  }
};
