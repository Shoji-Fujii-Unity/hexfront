# HEXFRONT build: parts -> single index.html   (run:  powershell -File build.ps1)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$parts = @(
  'p00_head.html',
  'p01_core.js',
  'p02_i18n.js',
  'p03_data.js',
  'p04_stages.js',
  'p05_rules.js',
  'p06_ai.js',
  'p07_render.js',
  'p08_ui.js',
  'p09_audio.js',
  'p10_main.js',
  'p99_foot.html'
)
$sb = New-Object System.Text.StringBuilder
foreach ($p in $parts) {
  $f = Join-Path (Join-Path $root 'parts') $p
  if (-not (Test-Path $f)) { Write-Error "missing part: $p"; exit 1 }
  $txt = [IO.File]::ReadAllText($f, [Text.Encoding]::UTF8)
  if ($p -like '*.js') {
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('/* ==== part ' + $p + ' ==== */')
  }
  [void]$sb.AppendLine($txt)
}
$out = Join-Path $root 'index.html'
[IO.File]::WriteAllText($out, $sb.ToString(), (New-Object Text.UTF8Encoding($false)))
$len = (Get-Item $out).Length
Write-Host ("built " + $out + "  " + [math]::Round($len/1024,1) + " KB")
