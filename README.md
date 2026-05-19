# Sui Energy Architecture

Layered energy settlement stack: Move contracts (L2/L3/L5), settlement backend API, TypeScript pipeline, and React dashboard.

## Setup

```bash
cp .env.example .env
# Fill RPC URL, SETTLEMENT_API_KEY, and publish IDs after deploy

cd layer5/settlement && npm install && npm run build
cd ../../frontend && npm install
```

## Scripts (repo root)

| Command | Description |
|---------|-------------|
| `npm run test:backend` | Backend smoke tests |
| `npm run dev:https:stack` | HTTPS dashboard + API |
| `npm run verify:https` | Check frontend + API over HTTPS |
| `npm run test:all` | Move + settlement + pipeline tests |

## Branches

See [docs/BRANCHING.md](docs/BRANCHING.md). Local branches: `main`, `develop`, `frontend`, `settlement`, `pipeline`.

## Push to GitHub

```powershell
gh auth login
.\scripts\push-github-branches.ps1 -RepoName "YOUR_GITHUB_USER/sui-energy-architecture"
```

## Security

- **Never commit `.env`** — copy from `.env.example` after clone.
- Repo `.env` was removed; rotate any keys that were ever stored locally (RPC URL token, signer, `SETTLEMENT_API_KEY`).
