<#
Membungkus NARASI untuk juri: ekstensi yang sudah diarahkan ke server online + panduan singkat.

  powershell -ExecutionPolicy Bypass -File scripts\paket-juri.ps1 -Server https://203.0.113.7.sslip.io

Token dashboard diambil dari deploy\.env (DASHBOARD_TOKEN) bila -Token tidak diisi.
Hasil: dist-juri\NARASI-juri.zip (berisi folder ekstensi + PANDUAN-JURI.txt).
#>
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [string]$Token = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$Server = $Server.TrimEnd("/")
if ($Server -notmatch '^https://') {
    Write-Warning "Server bukan HTTPS. Instagram/TikTok/YouTube memakai HTTPS, jadi panggilan ke http:// bisa diblokir browser."
}

if (-not $Token) {
    $envFile = Join-Path $root "deploy\.env"
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DASHBOARD_TOKEN\s*=' } | Select-Object -First 1
        if ($line) { $Token = ($line -split '=', 2)[1].Trim().Trim('"') }
    }
}
if (-not $Token) { throw "Token dashboard tidak ditemukan. Isi -Token atau DASHBOARD_TOKEN di deploy\.env." }

# 1. Pastikan server hidup sebelum dibagikan.
try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 "$Server/health" | Out-Null
    Write-Host "Server $Server menjawab /health." -ForegroundColor Green
} catch {
    Write-Warning "Server $Server belum menjawab /health ($($_.Exception.Message)). Paket tetap dibuat."
}

# 2. Build ekstensi ke folder terpisah (build lokal di .output tidak tersentuh).
$ext = Join-Path $root "extension"
$out = Join-Path $root "dist-juri"
$build = Join-Path $out "build"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
Push-Location $ext
try {
    if (-not (Test-Path "node_modules")) { npm ci; if ($LASTEXITCODE) { throw "npm ci gagal" } }
    $env:WXT_BACKEND_URL = $Server
    $env:WXT_OUT_DIR = $build
    npx wxt build
    if ($LASTEXITCODE) { throw "Build ekstensi gagal" }
} finally {
    Remove-Item Env:WXT_BACKEND_URL, Env:WXT_OUT_DIR -ErrorAction SilentlyContinue
    Pop-Location
}

$manifest = Get-Content (Join-Path $build "chrome-mv3\manifest.json") -Raw | ConvertFrom-Json
if ($manifest.host_permissions -notcontains "$Server/*") { throw "Alamat server tidak masuk ke manifest ekstensi." }

# 3. Susun isi paket.
$pkg = Join-Path $out "NARASI-juri"
New-Item -ItemType Directory -Force $pkg | Out-Null
Copy-Item -Recurse (Join-Path $build "chrome-mv3") (Join-Path $pkg "ekstensi-NARASI")

$dashboard = "$Server/#token=$Token"
$guide = Get-Content (Join-Path $root "docs\PANDUAN-JURI.md") -Raw -Encoding UTF8
$guide = $guide.Replace("{{DASHBOARD_URL}}", $dashboard).Replace("{{SERVER_URL}}", $Server)
[IO.File]::WriteAllText((Join-Path $pkg "PANDUAN-JURI.txt"), $guide, (New-Object Text.UTF8Encoding $true))

$zip = Join-Path $out "NARASI-juri.zip"
Compress-Archive -Path $pkg -DestinationPath $zip
Remove-Item -Recurse -Force $build

Write-Host ""
Write-Host "Paket siap: $zip" -ForegroundColor Green
Write-Host "Link dashboard juri: $dashboard"
