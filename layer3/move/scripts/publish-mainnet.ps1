# Publish energy_grid to Sui mainnet. Requires active mainnet wallet with SUI for gas.
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$Sui = Join-Path $RepoRoot ".tools\sui-bin\sui.exe"
if (-not (Test-Path $Sui)) { $Sui = "sui" }

Push-Location (Join-Path $RepoRoot "layer3\move")
try {
  & $Sui client switch --env mainnet
  Write-Host "Publishing energy_grid to MAINNET..."
  $out = & $Sui client publish --gas-budget 500000000 --json 2>&1 | Out-String
  $parsed = $out | ConvertFrom-Json
  $pkg = $parsed.objectChanges | Where-Object { $_.type -eq "published" } | Select-Object -ExpandProperty packageId -First 1
  Write-Host "L3_GRID_PACKAGE_ID=$pkg"
  $out | Set-Content (Join-Path $RepoRoot "layer3\move\publish-mainnet-output.json")
  Write-Host "Saved layer3/move/publish-mainnet-output.json"
} finally { Pop-Location }
