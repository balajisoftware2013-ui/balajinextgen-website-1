# Balaji NextGen - Tally Bridge: lets the web page read Tally (adds the CORS headers Tally lacks)
$tally = 'http://localhost:9000'
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://127.0.0.1:7071/')
$l.Start()
Write-Host "Tally Bridge running on http://127.0.0.1:7071  ->  $tally   (keep this window open)"
while ($l.IsListening) {
  $c = $l.GetContext(); $rq = $c.Request; $rs = $c.Response
  $rs.Headers.Add('Access-Control-Allow-Origin', '*')
  $rs.Headers.Add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  $rs.Headers.Add('Access-Control-Allow-Headers', '*')
  $rs.Headers.Add('Access-Control-Allow-Private-Network', 'true')
  try {
    if ($rq.HttpMethod -eq 'OPTIONS') { $rs.StatusCode = 204 }
    else {
      $ms = New-Object IO.MemoryStream; $rq.InputStream.CopyTo($ms)
      $wc = New-Object System.Net.WebClient; $wc.Headers.Add('Content-Type', 'text/xml')
      $bytes = $wc.UploadData($tally, $ms.ToArray())
      if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { $txt = [Text.Encoding]::Unicode.GetString($bytes) } else { $txt = [Text.Encoding]::UTF8.GetString($bytes) }
      $out = [Text.Encoding]::UTF8.GetBytes($txt.TrimStart([char]0xFEFF))
      $rs.ContentType = 'text/xml; charset=utf-8'; $rs.OutputStream.Write($out, 0, $out.Length)
    }
  } catch {
    $rs.StatusCode = 502; $m = [Text.Encoding]::UTF8.GetBytes($_.Exception.Message); $rs.OutputStream.Write($m, 0, $m.Length)
  }
  $rs.Close()
}
