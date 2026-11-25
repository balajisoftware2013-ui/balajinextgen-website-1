# Balaji Tally Bridge: lets the web page talk to Tally on this PC.
# Listens on http://127.0.0.1:7071 and forwards requests to Tally (port 9000, then 9001, 9002, 9010).
$port = 7071
$ports = @(9000, 9001, 9002, 9010, 9999)
$last = $null
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$port/")
$l.Prefixes.Add("http://localhost:$port/")
try { $l.Start() } catch { exit }   # already running

function Send($rs, [int]$code, [string]$text) {
    $b = [Text.Encoding]::UTF8.GetBytes($text)
    $rs.StatusCode = $code
    $rs.ContentType = 'text/plain; charset=utf-8'
    $rs.ContentLength64 = $b.Length
    $rs.OutputStream.Write($b, 0, $b.Length)
}

while ($l.IsListening) {
    $c = $l.GetContext()
    $rq = $c.Request; $rs = $c.Response
    try {
        $rs.Headers.Add('Access-Control-Allow-Origin', '*')
        $rs.Headers.Add('Access-Control-Allow-Headers', '*')
        $rs.Headers.Add('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        $rs.Headers.Add('Access-Control-Allow-Private-Network', 'true')
        if ($rq.HttpMethod -eq 'OPTIONS') { $rs.StatusCode = 204 }
        elseif ($rq.Url.AbsolutePath -eq '/ping') { Send $rs 200 'ok' }
        else {
            $ms = New-Object IO.MemoryStream
            $rq.InputStream.CopyTo($ms)
            $body = $ms.ToArray()
            $order = @(); if ($last) { $order += $last }; $order += ($ports | Where-Object { $_ -ne $last })
            $resp = $null; $err = ''
            foreach ($p in $order) {
                try {
                    $wc = New-Object System.Net.WebClient
                    $wc.Headers.Add('Content-Type', 'text/xml')
                    $resp = $wc.UploadData("http://127.0.0.1:$p", 'POST', $body)
                    $last = $p; break
                } catch { $err = $_.Exception.Message }
            }
            if ($resp -eq $null) { Send $rs 502 ("Tally not reachable on this PC: " + $err) }
            else {
                if ($resp.Length -gt 1 -and $resp[1] -eq 0) { $t = [Text.Encoding]::Unicode.GetString($resp) }
                else { $t = [Text.Encoding]::UTF8.GetString($resp) }
                Send $rs 200 $t
            }
        }
    } catch { try { Send $rs 500 $_.Exception.Message } catch {} }
    finally { try { $rs.Close() } catch {} }
}
