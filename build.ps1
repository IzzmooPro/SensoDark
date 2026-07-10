# SensoDark paketleme betiği
# Kullanım:  powershell -ExecutionPolicy Bypass -File build.ps1
# manifest.json içindeki sürümü okur ve dist/SensoDark-v<sürüm>.zip üretir.
# Yalnızca eklentinin ihtiyaç duyduğu dosyalar paketlenir (test/, backup/ vb. hariç).

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version

$include = @(
    "manifest.json",
    "background.js",
    "content.js",
    "dark-sites.js",
    "preload.css",
    "popup.html", "popup.js", "popup.css",
    "options.html", "options.js",
    "icons",
    "_locales"
)

$dist = Join-Path $root "dist"
if (-not (Test-Path $dist)) { New-Item -ItemType Directory $dist | Out-Null }
$zip = Join-Path $dist "SensoDark-v$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

# Geçici klasörde topla ki ZIP kökü temiz ve düz olsun
$stage = Join-Path $env:TEMP ("sensodark-build-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory $stage | Out-Null
try {
    foreach ($item in $include) {
        $src = Join-Path $root $item
        if (-not (Test-Path $src)) { throw "Eksik dosya/klasör: $item" }
        Copy-Item $src -Destination $stage -Recurse
    }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
}
finally {
    Remove-Item $stage -Recurse -Force
}

$size = "{0:N0} KB" -f ((Get-Item $zip).Length / 1KB)
Write-Host "Paket hazır: $zip ($size)"
