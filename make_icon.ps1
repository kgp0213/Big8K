$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'src-tauri\icons'
if (!(Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(24, 24, 27))

$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(59, 130, 246))
$g.FillEllipse($brush, 24, 24, 208, 208)

$font = New-Object System.Drawing.Font('Arial', 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF(0, 0, 256, 256)
$g.DrawString('8K', $font, $textBrush, $rect, $sf)

$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::Create((Join-Path $dir 'icon.ico'))
$icon.Save($fs)
$fs.Close()

$g.Dispose()
$bmp.Dispose()
