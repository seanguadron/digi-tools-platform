$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$appUrl = "http://localhost:4000"

Set-Location -LiteralPath $projectRoot

function Test-DigiToolsReady {
  try {
    $homeResponse = Invoke-WebRequest -Uri "$appUrl/" -UseBasicParsing -TimeoutSec 3
    $toolResponse = Invoke-WebRequest -Uri "$appUrl/tools/prompt-builder" -UseBasicParsing -TimeoutSec 3
    return $homeResponse.StatusCode -eq 200 -and $toolResponse.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "Node.js is not installed or is not available in PATH." -ForegroundColor Red
  Write-Host "Install Node.js, then run Start Digi Tools.bat again."
  exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules\next\package.json"))) {
  Write-Host ""
  Write-Host "Installing Digi Tools dependencies..."
  & npm.cmd install

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Dependency installation failed." -ForegroundColor Red
    exit 1
  }
}

$listener = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($listener) {
  if (Test-DigiToolsReady) {
    Write-Host "Digi Tools is already running. Opening it now."
    Start-Process $appUrl
    exit 0
  }

  Write-Host ""
  Write-Host "Port 4000 has an unhealthy or unrelated server on process $($listener.OwningProcess)." -ForegroundColor Red
  Write-Host "Close its window, then run Start Digi Tools.bat again."
  exit 1
}

$nextRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ".next"))
$devCache = [System.IO.Path]::GetFullPath((Join-Path $nextRoot "dev"))
$expectedPrefix = $nextRoot.TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar

if (-not $devCache.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Host "Refusing to clear an unexpected cache path: $devCache" -ForegroundColor Red
  exit 1
}

if (Test-Path -LiteralPath $devCache) {
  Write-Host "Clearing the generated Next.js development cache."
  Remove-Item -LiteralPath $devCache -Recurse -Force
}

Write-Host ""
Write-Host "Starting Digi Tools at $appUrl"
Write-Host "A server window will stay open. Close it to stop Digi Tools."

Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList @("/k", "npm.cmd run dev") `
  -WorkingDirectory $projectRoot

$deadline = (Get-Date).AddSeconds(45)

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500

  if (Test-DigiToolsReady) {
    Write-Host "Digi Tools is ready. Opening the browser."
    Start-Process $appUrl
    exit 0
  }
}

Write-Host ""
Write-Host "Digi Tools did not become ready within 45 seconds." -ForegroundColor Red
Write-Host "Check the Digi Tools server window for the startup error."
exit 1
