# Push all branches to GitHub after one-time login.
# Usage:
#   gh auth login
#   .\scripts\push-github-branches.ps1 -RepoName "YOUR_USER/sui-energy-architecture"

param(
  [string]$RepoName = "sui-energy-architecture",
  [switch]$Private = $true
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli"
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run: gh auth login"
  exit 1
}

$exists = gh repo view $RepoName 2>$null
if ($LASTEXITCODE -ne 0) {
  $flag = if ($Private) { "--private" } else { "--public" }
  gh repo create $RepoName $flag --source=. --remote=origin --description "Sui energy settlement architecture"
} elseif (-not (git remote get-url origin 2>$null)) {
  git remote add origin "https://github.com/$RepoName.git"
}

git push -u origin main
git push -u origin develop
git push -u origin frontend
git push -u origin settlement
git push -u origin pipeline

Write-Host "`nPushed: main, develop, frontend, settlement, pipeline"
Write-Host "https://github.com/$RepoName"
