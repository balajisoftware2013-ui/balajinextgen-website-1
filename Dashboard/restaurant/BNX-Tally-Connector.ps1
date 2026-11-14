# =====================================================================================
#  BALAJI NEXTGEN - TALLY LOCAL CONNECTOR  (2026-11-14)
#  Lets the dashboard (https://www.balajinextgen.in) post vouchers DIRECTLY into Tally Prime.
#
#  Browser  --POST XML-->  http://127.0.0.1:9001  (this connector)  --->  http://127.0.0.1:9000  (Tally Prime)
#  Tally sends no CORS headers, so Chrome blocks a web page from reading Tally's reply. This connector
#  forwards the XML unchanged and adds the permission headers - only for the Balaji NextGen site.
#
#  RUN: double-click  Start-Tally-Connector.bat  (keep the window open while posting).
#  Tally Prime: F1 Help > Settings > Connectivity > Client/Server configuration:
#      TallyPrime acts as = Both,  Enable ODBC = Yes,  Port = 9000   (then restart Tally, open the company)
# =====================================================================================
param(
  [int]$Port = 9001,
  [string]$TallyUrl = 'http://127.0.0.1:9000',
  [string[]]$AllowedOrigins = @('https://www.balajinextgen.in', 'https://balajinextgen.in')
)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = "Balaji NextGen - Tally connector (port $Port)"

function Write-Log($m, $c = 'Gray') { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) -ForegroundColor $c }

function Send-Response($stream, [int]$code, [string]$reason, [byte[]]$body, [string]$origin, [string]$ctype = 'text/xml; charset=utf-8') {
  if (-not $body) { $body = [byte[]]@() }
  $h = "HTTP/1.1 $code $reason`r`n" +
       "Content-Type: $ctype`r`n" +
       "Content-Length: $($body.Length)`r`n" +
       "Connection: close`r`n" +
       "Cache-Control: no-store`r`n"
  if ($origin) {
    $h += "Access-Control-Allow-Origin: $origin`r`n" +
          "Vary: Origin`r`n" +
          "Access-Control-Allow-Methods: POST, GET, OPTIONS`r`n" +
          "Access-Control-Allow-Headers: Content-Type`r`n" +
          "Access-Control-Allow-Private-Network: true`r`n" +
          "Access-Control-Max-Age: 600`r`n"
  }
  $h += "`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Write-Log "Port $Port is already in use - is the connector already running?" 'Red'; Read-Host 'Press Enter to close'; exit 1 }
Write-Log "Tally connector running on http://127.0.0.1:$Port  ->  $TallyUrl" 'Green'
Write-Log "Allowed site(s): $($AllowedOrigins -join ', ')   |   Keep this window open while posting. Ctrl+C to stop." 'Green'

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 30000; $client.SendTimeout = 30000
    $stream = $client.GetStream()
    # ---- read headers ----
    $buf = New-Object byte[] 65536; $ms = New-Object IO.MemoryStream; $headerEnd = -1
    while ($headerEnd -lt 0) {
      $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
      $ms.Write($buf, 0, $n)
      $all = $ms.ToArray()
      for ($i = 3; $i -lt $all.Length; $i++) { if ($all[$i-3] -eq 13 -and $all[$i-2] -eq 10 -and $all[$i-1] -eq 13 -and $all[$i] -eq 10) { $headerEnd = $i + 1; break } }
      if ($ms.Length -gt 1MB) { break }
    }
    if ($headerEnd -lt 0) { $client.Close(); continue }
    $all = $ms.ToArray()
    $head = [Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
    $lines = $head -split "`r`n"
    $method = ($lines[0] -split ' ')[0].ToUpper()
    $hdr = @{}
    foreach ($l in $lines[1..($lines.Length-1)]) { $p = $l.IndexOf(':'); if ($p -gt 0) { $hdr[$l.Substring(0,$p).Trim().ToLower()] = $l.Substring($p+1).Trim() } }
    $origin = [string]$hdr['origin']
    $okOrigin = $(if ($origin -and ($AllowedOrigins -contains $origin.TrimEnd('/'))) { $origin } else { $null })

    if ($origin -and -not $okOrigin) {
      Write-Log "Refused request from $origin" 'Yellow'
      Send-Response $stream 403 'Forbidden' ([Text.Encoding]::UTF8.GetBytes('Origin not allowed')) $null 'text/plain'
      continue
    }
    if ($method -eq 'OPTIONS') { Send-Response $stream 204 'No Content' $null $okOrigin; continue }
    if ($method -eq 'GET') {
      Send-Response $stream 200 'OK' ([Text.Encoding]::UTF8.GetBytes('<RESPONSE>Balaji NextGen Tally connector OK</RESPONSE>')) $okOrigin
      continue
    }
    if ($method -ne 'POST') { Send-Response $stream 405 'Method Not Allowed' $null $okOrigin; continue }

    # ---- read body ----
    $len = [int]($hdr['content-length'])
    if ($len -gt 20MB) { Send-Response $stream 413 'Too Large' $null $okOrigin; continue }
    $body = New-Object IO.MemoryStream
    if ($all.Length -gt $headerEnd) { $body.Write($all, $headerEnd, $all.Length - $headerEnd) }
    while ($body.Length -lt $len) { $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { break }; $body.Write($buf, 0, $n) }
    $xml = $body.ToArray()

    # ---- forward to Tally ----
    try {
      $wc = New-Object Net.WebClient
      $wc.Headers.Add('Content-Type', 'text/xml; charset=utf-8')
      $resp = $wc.UploadData($TallyUrl, 'POST', $xml)
      $txt = [Text.Encoding]::UTF8.GetString($resp)
      $created = if ($txt -match '<CREATED>(\d+)</CREATED>') { $Matches[1] } else { '-' }
      $errors  = if ($txt -match '<ERRORS>(\d+)</ERRORS>') { $Matches[1] } else { '-' }
      Write-Log ("Tally answered | {0} bytes | created {1} | errors {2}" -f $resp.Length, $created, $errors) $(if ($errors -ne '-' -and [int]$errors -gt 0) { 'Yellow' } else { 'Cyan' })
      Send-Response $stream 200 'OK' $resp $okOrigin
    } catch {
      $m = $_.Exception.Message
      Write-Log "Tally not reachable at $TallyUrl - $m" 'Red'
      Send-Response $stream 502 'Bad Gateway' ([Text.Encoding]::UTF8.GetBytes("Tally not reachable at $TallyUrl. Open TallyPrime with the company loaded, and set F1 > Settings > Connectivity: acts as Both, port 9000. ($m)")) $okOrigin 'text/plain; charset=utf-8'
    }
  } catch {
    Write-Log ("Request failed: " + $_.Exception.Message) 'Red'
  } finally {
    try { $client.Close() } catch {}
  }
}
