# Branch workflow

| Branch | Purpose |
|--------|---------|
| `main` | Stable, release-ready |
| `develop` | Integration branch for day-to-day work |
| `frontend` | Dashboard (Vite/React) changes |
| `settlement` | Layer 5 backend API and workers |
| `pipeline` | L3→L4→L5 orchestration package |

## Workflow

1. Branch from `develop`: `git checkout develop && git checkout -b feature/my-change`
2. Open PR into `develop`
3. Merge `develop` → `main` for releases

## Setup after clone

```bash
cp .env.example .env
# Add your RPC URL and SETTLEMENT_API_KEY locally — never commit .env
```
