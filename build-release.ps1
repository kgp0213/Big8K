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
