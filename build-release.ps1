# Big8K-Tauri-UI Release Build Script
# Run from project root: .\build-release.ps1
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "=== Building Big8K-Tauri-UI (Release) ===" -ForegroundColor Cyan

# Check prerequisites
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npm not found. Please install Node.js." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: rustc not found. Please install Rust from https://rustup.rs" -ForegroundColor Red
    exit 1
}

Write-Host "npm: $(npm --version)"
Write-Host "rustc: $(rustc --version)"
Write-Host "cargo: $(cargo --version)"

# Build
Write-Host "`nStarting Tauri release build... (this may take 10-20 minutes for first build)" -ForegroundColor Yellow
npm run tauri build -- --bundles nsis

# Ensure the standalone release exe can always find bundled ADB next to itself.
$ReleaseResources = Join-Path $ProjectRoot "src-tauri\target\release\resources"
$ProjectResources = Join-Path $ProjectRoot "resources"
New-Item -ItemType Directory -Force -Path $ReleaseResources | Out-Null
foreach ($name in @("adb.exe", "AdbWinUsbApi.dll", "AdbWinApi.dll")) {
    $src = Join-Path $ProjectResources $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $ReleaseResources $name) -Force
    } else {
        Write-Host "WARNING: missing bundled ADB resource: $src" -ForegroundColor Yellow
    }
}

if ($LASTEXITCODE -eq 0) {
    $exePath = Join-Path $ProjectRoot "src-tauri\target\release\Big8K.exe"
    if (Test-Path $exePath) {
        Write-Host "`n=== Build Successful ===" -ForegroundColor Green
        Write-Host "Output: $exePath" -ForegroundColor Green
        Write-Host "Size: $([math]::Round((Get-Item $exePath).Length / 1MB, 2)) MB"
    }
} else {
    Write-Host "`n=== Build Failed ===" -ForegroundColor Red
    exit 1
}
