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

| Branch | Purpose |
|--------|---------|
| `main` | Stable, release-ready |
| `develop` | Integration / active development |
| `feature/*` | Topic branches (merge into `develop`) |

## Security

Do not commit `.env`. If keys were ever shared, rotate QuickNode, signer, and `SETTLEMENT_API_KEY` in your provider dashboards.
