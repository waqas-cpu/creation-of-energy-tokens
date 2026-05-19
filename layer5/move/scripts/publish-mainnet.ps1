# Publish energy_settlement to Sui mainnet. Run after Layer 3 is published.
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$Sui = Join-Path $RepoRoot ".tools\sui-bin\sui.exe"
if (-not (Test-Path $Sui)) { $Sui = "sui" }

Push-Location (Join-Path $RepoRoot "layer5\move")
try {
  & $Sui client switch --env mainnet
  Write-Host "Publishing energy_settlement to MAINNET..."
  $out = & $Sui client publish --gas-budget 500000000 --json 2>&1 | Out-String
  $parsed = $out | ConvertFrom-Json
  $pkg = $parsed.objectChanges | Where-Object { $_.type -eq "published" } | Select-Object -ExpandProperty packageId -First 1
  Write-Host "L5_PACKAGE_ID=$pkg"
  Write-Host ""
  Write-Host "Next: call deploy_init::initialize_l5_infrastructure with AdminCap"
  Write-Host "  target: ${pkg}::deploy_init::initialize_l5_infrastructure"
  $out | Set-Content (Join-Path $RepoRoot "layer5\move\publish-mainnet-output.json")
} finally { Pop-Location }
