$ErrorActionPreference = 'Stop'
$dashboard = 'https://www.balajinextgen.in/Dashboard/restaurant/restaurant-dashboard.html'

function Find-QzApp {
    $dirs = @(
        (Join-Path $env:ProgramFiles 'QZ Tray'),
        (Join-Path $env:LOCALAPPDATA 'Programs\QZ Tray')
    )
    if (${env:ProgramFiles(x86)}) { $dirs += (Join-Path ${env:ProgramFiles(x86)} 'QZ Tray') }
    foreach ($dir in $dirs) {
        $file = Join-Path $dir 'qz-tray.exe'
        if (Test-Path -LiteralPath $file -PathType Leaf) { return $file }
    }
}

try {
    $qz = Find-QzApp
    if (!$qz) {
        Write-Host 'Downloading QZ Tray from its official release repository...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/qzind/tray/releases/tags/v2.3.0' -Headers @{'User-Agent'='Balaji-NextGen-POS-Setup'}
        $architecture = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
        $names = switch ($architecture) {
            'ARM64' { @('qz-tray-2.3.0-arm64.exe','qz-tray-2.3.0-aarch64.exe') }
            'AMD64' { @('qz-tray-2.3.0.exe','qz-tray-2.3.0-x86_64.exe','qz-tray-2.3.0-x64.exe','qz-tray-2.3.0-amd64.exe') }
            default { throw "Unsupported Windows architecture: $architecture. Install QZ Tray from https://qz.io/download/." }
        }
        $asset = $null
        foreach ($name in $names) {
            $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
            if ($asset) { break }
        }
        if (!$asset -or $asset.browser_download_url -notmatch '^https://github\.com/qzind/tray/releases/download/v2\.3\.0/[A-Za-z0-9_.-]+\.exe$') {
            throw 'A compatible official installer was not found. Install QZ Tray from https://qz.io/download/ and rerun setup.'
        }
        $file = Join-Path ([IO.Path]::GetTempPath()) ("bnx-qz-" + [guid]::NewGuid().ToString() + '.exe')
        try {
            Invoke-WebRequest -Uri $asset.browser_download_url -UseBasicParsing -OutFile $file
            $sig = Get-AuthenticodeSignature -FilePath $file
            if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch '\bQZ Industries\b') {
                throw "Windows could not verify the QZ installer publisher ($($sig.Status)). Setup stopped."
            }
            $install = Start-Process -FilePath $file -ArgumentList '/S' -Verb RunAs -Wait -PassThru
            if ($install.ExitCode -ne 0) { throw "QZ installer reported exit code $($install.ExitCode)." }
        } finally { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
        $qz = Find-QzApp
        if (!$qz) { throw 'QZ Tray was not found after installation. Open https://qz.io/download/ for manual installation.' }
    }

    $cert = Join-Path $PSScriptRoot 'override.crt'
    $target = Join-Path (Split-Path $qz -Parent) 'override.crt'
    $restartRequired = $false
    if (Test-Path -LiteralPath $cert -PathType Leaf) {
        $text = [IO.File]::ReadAllText($cert)
        if ($text -match 'PRIVATE KEY') { throw 'Use only the public ERP override.crt. Remove the private key file.' }
        $public = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($cert)
        try { if ($public.HasPrivateKey) { throw 'A public certificate is required.' } } finally { $public.Dispose() }
        if ((Test-Path -LiteralPath $target) -and ((Get-FileHash -LiteralPath $target).Hash -ne (Get-FileHash -LiteralPath $cert).Hash)) {
            Write-Warning 'A different QZ trust override already exists. It was left in place. Review this PC before enabling silent ERP printing.'
        } elseif (!(Test-Path -LiteralPath $target)) {
            $sourceLiteral = "'" + $cert.Replace("'","''") + "'"
            $targetLiteral = "'" + $target.Replace("'","''") + "'"
            $code = "[IO.File]::Copy($sourceLiteral,$targetLiteral,`$false)"
            $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
            $copy = Start-Process powershell.exe -ArgumentList @('-NoProfile','-EncodedCommand',$encoded) -Verb RunAs -Wait -PassThru
            if ($copy.ExitCode -ne 0 -or !(Test-Path -LiteralPath $target)) { throw 'Public trust certificate could not be installed.' }
            $restartRequired = $true
        }
    } elseif (!(Test-Path -LiteralPath $target)) {
        Write-Host 'For custom trust, place the public ERP override.crt beside this setup and rerun.'
    }

    # Refresh only the QZ process from this installation when a new override was copied.
    $running = @(Get-Process -Name 'qz-tray' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $qz })
    if ($restartRequired -and $running.Count) {
        $running | Stop-Process
        $running = @()
    }
    $startup = [Environment]::GetFolderPath('Startup')
    $erpShortcut = Join-Path $startup 'Balaji NextGen POS.url'
    [IO.File]::WriteAllLines($erpShortcut, @('[InternetShortcut]',"URL=$dashboard"))
    if (!$running.Count) { Start-Process -FilePath $qz }
    Start-Process $dashboard
    Write-Host 'ERP opened. Sign in to the outlet, then run one paper test in Printer Setup.'
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
