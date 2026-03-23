# Start Vite dev server in background
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $PSScriptRoot -NoNewWindow
Start-Sleep -Seconds 3

# Start Tauri
Start-Process -FilePath "npm" -ArgumentList "run","tauri","dev" -WorkingDirectory $PSScriptRoot

Write-Host "Started Tauri dev environment"
