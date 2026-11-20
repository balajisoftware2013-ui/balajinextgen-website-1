# Balaji NextGen - Tally bridge (no Python needed; Windows PowerShell 5.1 or later)
# Lets the GST page (https://www.balajinextgen.in/Dashboard/gst/gst.html) read TallyPrime on this PC.
# Listens only on 127.0.0.1:9001 and forwards the page's XML requests to TallyPrime on 127.0.0.1:9000.
# Only the Balaji NextGen site (and local files) may use it. Nothing is stored; Tally data is never changed by the bridge itself.
# Started hidden with Windows by INSTALL_TALLY_AUTOSTART.bat.

$ErrorActionPreference = 'Continue'
$Port = 9001
$Tally = 'http://127.0.0.1:9000/'
$Allowed = @('https://www.balajinextgen.in', 'https://balajinextgen.in', 'null')
[System.Net.ServicePointManager]::Expect100Continue = $false
$LogFile = Join-Path $env:LOCALAPPDATA 'BalajiNextGen\TallyConnector\bridge.log'

function Write-Log([string]$m) {
  try {
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 1MB)) { Remove-Item $LogFile -Force }
    Add-Content -Path $LogFile -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m)
  } catch {}
}

function Send-Reply($stream, [int]$code, [string]$status, [string]$ctype, [byte[]]$body, [string]$origin) {
  if ($null -eq $body) { $body = [byte[]]@() }
  $h = "HTTP/1.1 $code $status`r`n"
  if ($origin) {
    $h += "Access-Control-Allow-Origin: $origin`r`nVary: Origin`r`n"
    $h += "Access-Control-Allow-Private-Network: true`r`nAccess-Control-Allow-Methods: POST, GET, OPTIONS`r`n"
    $h += "Access-Control-Allow-Headers: Content-Type`r`nAccess-Control-Max-Age: 600`r`n"
  }
  if ($ctype) { $h += "Content-Type: $ctype`r`n" }
  $h += "Content-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($h)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

function Text-Bytes([string]$s) { return [System.Text.Encoding]::UTF8.GetBytes($s) }

function Invoke-Tally([byte[]]$body) {
  $req = [System.Net.HttpWebRequest]::Create($Tally)
  $req.Method = 'POST'
  $req.ContentType = 'text/xml;charset=utf-8'
  $req.Timeout = 300000
  $req.ReadWriteTimeout = 300000
  $req.ContentLength = $body.Length
  $rs = $req.GetRequestStream(); $rs.Write($body, 0, $body.Length); $rs.Close()
  $resp = $req.GetResponse()
  $ms = New-Object System.IO.MemoryStream
  $resp.GetResponseStream().CopyTo($ms); $resp.Close()
  $bytes = $ms.ToArray()
  # Tally may answer in UTF-16 (BOM FF FE): give the page UTF-8
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes([System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2))
  } elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bytes = $bytes[3..($bytes.Length - 1)]
  }
  return ,$bytes
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Write-Log "port $Port busy - another connector is already running; exiting"; exit 0 }
Write-Log "bridge started on 127.0.0.1:$Port -> $Tally"

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 30000
    $client.SendTimeout = 300000
    $stream = $client.GetStream()
    $buf = New-Object byte[] 65536
    $ms = New-Object System.IO.MemoryStream
    $headEnd = -1
    while ($headEnd -lt 0) {
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      $ms.Write($buf, 0, $n)
      $headEnd = [System.Text.Encoding]::ASCII.GetString($ms.ToArray()).IndexOf("`r`n`r`n")
      if ($ms.Length -gt 1048576 -and $headEnd -lt 0) { break }
    }
    if ($headEnd -lt 0) { $client.Close(); continue }
    $all = $ms.ToArray()
    $lines = [System.Text.Encoding]::ASCII.GetString($all, 0, $headEnd) -split "`r`n"
    $first = $lines[0] -split ' '
    $method = $first[0].ToUpper(); $path = ($first[1] -split '\?')[0]
    $hdr = @{}
    foreach ($l in $lines[1..($lines.Length - 1)]) { $i = $l.IndexOf(':'); if ($i -gt 0) { $hdr[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() } }
    $len = 0; if ($hdr.ContainsKey('content-length')) { $len = [int]$hdr['content-length'] }
    $bodyMs = New-Object System.IO.MemoryStream
    $start = $headEnd + 4
    if ($all.Length -gt $start) { $bodyMs.Write($all, $start, $all.Length - $start) }
    while ($bodyMs.Length -lt $len) { $n = $stream.Read($buf, 0, [Math]::Min($buf.Length, $len - $bodyMs.Length)); if ($n -le 0) { break }; $bodyMs.Write($buf, 0, $n) }
    $body = $bodyMs.ToArray()

    $origin = $hdr['origin']
    $ok = (-not $origin) -or ($Allowed -contains $origin) -or ($origin -like 'http://localhost*') -or ($origin -like 'http://127.0.0.1*')
    if (-not $ok) { Send-Reply $stream 403 'Forbidden' 'text/plain; charset=utf-8' (Text-Bytes "Origin $origin is not allowed") $null; Write-Log "refused origin $origin"; $client.Close(); continue }

    if ($method -eq 'OPTIONS') { Send-Reply $stream 204 'No Content' $null $null $origin }
    elseif ($method -eq 'GET') { Send-Reply $stream 200 'OK' 'application/json' (Text-Bytes '{"ok":true,"bridge":"bnx-ps","port":9001,"tally":"http://127.0.0.1:9000"}') $origin }
    elseif ($method -eq 'POST' -and ($path -eq '/' -or $path -eq '')) {
      try { $out = Invoke-Tally $body; Send-Reply $stream 200 'OK' 'text/xml; charset=utf-8' $out $origin }
      catch { $msg = $_.Exception.Message; if ($_.Exception.InnerException) { $msg = $_.Exception.InnerException.Message }
        Send-Reply $stream 502 'Bad Gateway' 'text/plain; charset=utf-8' (Text-Bytes ("TallyPrime did not answer on port 9000: " + $msg + " - open TallyPrime, load the company, F1 > Settings > Connectivity: acts as Both, port 9000")) $origin
        Write-Log "tally error: $msg" }
    }
    else { Send-Reply $stream 404 'Not Found' 'text/plain; charset=utf-8' (Text-Bytes 'Use POST / with Tally XML') $origin }
  } catch { Write-Log ("request error: " + $_.Exception.Message) }
  finally { if ($client) { try { $client.Close() } catch {} } }
}
