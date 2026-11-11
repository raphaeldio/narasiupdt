<#
Membuat paket NARASI portabel untuk Windows: juri cukup ekstrak zip, klik dua kali NARASI.bat,
lalu pasang ekstensi. Tanpa instal Python, Node, uv, atau Docker.

  powershell -ExecutionPolicy Bypass -File scripts\paket-portable.ps1               # tanpa kunci API
  powershell -ExecutionPolicy Bypass -File scripts\paket-portable.ps1 -DenganKunci  # ikut kunci API dari backend\.env

Hasil: dist-portable\NARASI-portable.zip
#>
param([switch]$DenganKunci)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "dist-portable"
$pkg = Join-Path $out "NARASI"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $pkg | Out-Null

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Check($what) { if ($LASTEXITCODE) { throw "$what gagal (exit $LASTEXITCODE)" } }

# 1. Python mandiri (python-build-standalone milik uv, bisa dipindah folder).
Step "Menyalin Python mandiri"
$cfg = Join-Path $root "backend\.venv\pyvenv.cfg"
if (-not (Test-Path $cfg)) { throw "backend\.venv belum ada. Jalankan dulu: cd backend; uv sync" }
$pyHome = ((Get-Content $cfg | Where-Object { $_ -match '^home\s*=' }) -split '=', 2)[1].Trim()
$py = Join-Path $pkg "python"
Copy-Item -Recurse $pyHome $py
# Bagian Python yang tidak dipakai server, supaya zip lebih kecil.
foreach ($junk in "Lib\test", "Lib\idlelib", "Lib\tkinter", "Lib\turtledemo", "tcl", "include", "EXTERNALLY-MANAGED") {
    $p = Join-Path $py $junk
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}
Get-ChildItem $py -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

Step "Memasang dependensi server ke Python mandiri"
$req = Join-Path $out "requirements.txt"
uv export --project (Join-Path $root "backend") --frozen --no-dev --no-hashes --no-emit-project -o $req | Out-Null
Check "uv export"
uv pip install --python (Join-Path $py "python.exe") --break-system-packages --no-cache --compile-bytecode -r $req
Check "uv pip install"
Remove-Item $req

# 2. Server.
Step "Menyalin server"
$server = Join-Path $pkg "server"
New-Item -ItemType Directory -Force $server | Out-Null
Copy-Item -Recurse (Join-Path $root "backend\app") (Join-Path $server "app")
Copy-Item -Recurse (Join-Path $root "backend\data") (Join-Path $server "data")
Get-ChildItem $server -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

$envLines = @(
    "# Konfigurasi paket portabel NARASI.",
    "STATIC_DIR=../dashboard",
    "CORS_ORIGINS='[""http://localhost:8000"", ""http://127.0.0.1:8000""]'"
)
if ($DenganKunci) {
    $src = Join-Path $root "backend\.env"
    if (-not (Test-Path $src)) { throw "backend\.env tidak ada, tidak bisa menyertakan kunci API." }
    $keys = Get-Content $src | Where-Object { $_ -match '^\s*(GEMINI_|GROQ_|FACTCHECK_|TAVILY_|LLM_)[A-Z_]*\s*=' }
    $envLines += "", "# Kunci API (jangan disebar di luar juri)."
    $envLines += $keys
    Write-Host "Ikut $($keys.Count) baris kunci/model dari backend\.env"
}
[IO.File]::WriteAllLines((Join-Path $server ".env"), $envLines)

# 3. Dashboard statis, memanggil API di origin yang sama.
Step "Build dashboard"
Push-Location (Join-Path $root "dashboard")
try {
    if (-not (Test-Path "node_modules")) { npm ci; Check "npm ci" }
    $env:VITE_API_URL = "/"
    npx vite build --outDir (Join-Path $pkg "dashboard") --emptyOutDir
    Check "Build dashboard"
} finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}

# 4. Ekstensi (mengarah ke http://localhost:8000), dibangun ke folder terpisah.
Step "Build ekstensi"
$extBuild = Join-Path $out "ext-build"
Push-Location (Join-Path $root "extension")
try {
    if (-not (Test-Path "node_modules")) { npm ci; Check "npm ci" }
    $env:WXT_OUT_DIR = $extBuild
    npx wxt build
    Check "Build ekstensi"
} finally {
    Remove-Item Env:WXT_OUT_DIR -ErrorAction SilentlyContinue
    Pop-Location
}
Move-Item (Join-Path $extBuild "chrome-mv3") (Join-Path $pkg "ekstensi-NARASI")
Remove-Item -Recurse -Force $extBuild

# 5. Peluncur + panduan.
Step "Menyusun paket"
Copy-Item (Join-Path $root "scripts\portable\NARASI.bat") $pkg
Copy-Item (Join-Path $root "scripts\portable\BACA-DULU.txt") $pkg

$zip = Join-Path $out "NARASI-portable.zip"
Compress-Archive -Path $pkg -DestinationPath $zip -CompressionLevel Optimal
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "`nPaket siap: $zip ($mb MB)" -ForegroundColor Green
if (-not $DenganKunci) { Write-Host "Catatan: tanpa kunci API, NARASI hanya memakai bantahan tersimpan + RSS cek fakta." -ForegroundColor Yellow }
