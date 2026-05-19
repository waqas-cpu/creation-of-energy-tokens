# Publish Layer 5 (energy_settlement) to Sui testnet and capture package + shared object IDs.
# Prerequisites: sui client active address with testnet SUI; Layer 3 energy_grid already published.
#
# Usage:
#   $env:SUI_NETWORK = "testnet"
#   & "e:\sui energy architecture\.tools\sui-bin\sui.exe" client switch --env testnet
#   .\layer5\move\scripts\publish-testnet.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$RepoRoot = Split-Path $Root -Parent
$Sui = Join-Path $RepoRoot ".tools\sui-bin\sui.exe"
$MoveDir = Join-Path $Root "move"

if (-not (Test-Path $Sui)) {
    Write-Error "Sui CLI not found at $Sui"
}

Push-Location $MoveDir
try {
    Write-Host "Publishing energy_settlement from $MoveDir ..."
    $json = & $Sui client publish --gas-budget 200000000 --json 2>&1 | Out-String
    $parsed = $json | ConvertFrom-Json
    if (-not $parsed) {
        Write-Host $json
        throw "Publish failed — inspect output above"
    }

    $packageId = $parsed.objectChanges | Where-Object { $_.type -eq "published" } | Select-Object -ExpandProperty packageId -First 1
    Write-Host ""
    Write-Host "=== Add to layer5/settlement/published-ids.example.env ==="
    Write-Host "L5_PACKAGE_ID=$packageId"
    Write-Host ""
    Write-Host "Shared objects (filter objectChanges for your init tx):"
    $parsed.objectChanges | Where-Object { $_.type -eq "created" -and $_.objectType } | ForEach-Object {
        Write-Host "$($_.objectType) -> $($_.objectId)"
    }
    Write-Host ""
    Write-Host "Full JSON saved to publish-output.json"
    $json | Set-Content -Path (Join-Path $MoveDir "publish-output.json") -Encoding utf8
}
finally {
    Pop-Location
}
