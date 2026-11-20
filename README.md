# WorldSphere

Biodiversity atlas: live GBIF data, a conservation-risk model, AI assistants and user accounts.

```
worldsphere/
├── client/       React + TypeScript + Vite frontend (everything browser-side)
│   └── public/   logos, favicons, _headers; tourism photos go in public/images/tourism/
├── server/       FastAPI + PostgreSQL: auth, favorites, account workspace, AI chat
├── ml-service/   FastAPI + scikit-learn: /predict and /insights only
└── render.yaml   Render blueprint (server + ml-service)
```

## Run locally (three terminals)

| Part | Commands | Port |
|---|---|---|
| server | `cd server && pip install -r requirements.txt && cp .env.example .env` (set `DATABASE_URL`, `AUTH_SECRET`) `&& uvicorn app.main:app --reload --port 8000` | 8000 |
| ml-service | `cd ml-service && pip install -r requirements.txt && python model/train.py && uvicorn app.main:app --reload --port 8001` | 8001 |
| client | `cd client && npm install && cp .env.example .env && npm run dev` | 5173 |

Client env: `VITE_API_URL` → server, `VITE_ML_API_URL` → ml-service (both required in production builds).
Migrations in `server/migrations/` run automatically on server start (PostgreSQL).

## Research dashboard data
- **GBIF (live, no key):** species per kingdom, IUCN Red List breakdown, habitats, occurrence totals, top countries,
  records per year, critically-endangered spotlight — `client/src/services/gbifStats.ts`.
- **IUCN Red List (cached):** the v4 API has no aggregate endpoints, so `server/scripts/refresh_iucn.py` pages through
  it once and stores totals (category × kingdom, category × system) in PostgreSQL; the server serves them at
  `GET /stats/iucn`. Needs `IUCN_API_TOKEN` in `server/.env`. The section stays hidden until the script has run.
  ```
  cd server
  python -m scripts.refresh_iucn --max-pages 2     # smoke test, partial
  python -m scripts.refresh_iucn                   # full run, thousands of requests
  ```
- **ml-service:** model accuracy/feature importance computed on a **synthetic** 600-row training set
  (`ml-service/common.py`). The dashboard labels it as synthetic.

## API
- server: `GET /health`, `GET /stats/iucn`, `POST /auth/signup|login`, `GET /auth/me`, `GET|POST /favorites`, `DELETE /favorites/{source}/{key}`, `/account/*`, `/api/ai/*`, `POST /ai/ask`
- ml-service: `GET /health`, `POST /predict`, `GET /insights`
