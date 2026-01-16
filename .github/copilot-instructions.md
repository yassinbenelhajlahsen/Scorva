## Scorva — Copilot instructions (concise)

This file gives targeted, actionable guidance so an AI coding agent can be productive quickly in this repo.

1. Quick start (dev)

- Frontend (Vite + React): from repo root run `npm run dev` (uses Vite, serves `frontend/src` via root config).
- Backend (Express): in a second terminal `cd backend && npm run start` (runs `node src/index.js`).
- Populate envs: copy `backend/backend.env.example` -> `.env` in `backend/` and `env.example` (root) as needed. Do NOT expose `API_KEY` to the frontend.

2. Big-picture architecture

- Frontend: `frontend/src/` — React + Vite. Entry: `frontend/src/main.jsx`. Routing + UI components live under `components/` and `pages/`.
- Backend: `backend/src/` — Express app. Entry: `backend/src/index.js`. DB layer: `backend/src/db/db.js` (Postgres via `pg`).
- Data ingestion: `backend/src/populate/` and `backend/src/populate/src/` contain normalization and upsert helpers (e.g., `mapStatsToSchema.js`, `upsertPlayer.js`). These implement the logic for transforming ESPN-like responses into the DB.
- Deployment: frontend on Vercel, backend on Railway (see `vercel.json` and README notes).

3. Important conventions and patterns (do NOT break these)

- API routing: all backend routers live in `backend/src/routes/` and are mounted under `/api` in `backend/src/index.js`.
- Proxy vs guarded API: `app.use('/api', proxyRoute)` is mounted _before_ the API-key middleware; proxy routes are intended for server-side calls to external services and bypass the `x-api-key` check. All other `/api/*` endpoints are protected by an `x-api-key` header that must match `process.env.API_KEY`.
- Frontend dev proxy: `vite.config.js` proxies `/api` to `http://localhost:3000`. During development, fetch to `/api/...` hits the backend automatically.
- DB upserts and schema normalization live in `backend/src/populate/src/`. When ingesting new league or endpoint data, follow the mapping and `upsert*` patterns.
- CORS: backend whitelist includes `http://localhost:5173` and `https://scorva.vercel.app` — update `backend/src/index.js` if you add new origins.

4. Common developer workflows

- Run frontend only: `npm run dev` (root).
- Run backend only: `cd backend && npm run start`.
- To run both locally: open two terminals (frontend + backend). The frontend will proxy `/api` requests to `localhost:3000`.
- Database: Postgres connection is configured in `backend/src/db/db.js`; follow `.env` variables in `backend/backend.env.example`.

5. How to add a new backend endpoint (example)

- Create a new router file in `backend/src/routes/` that exports an Express Router.
- Use the DB helpers in `backend/src/db/db.js` or create a new service file under `backend/src/`.
- If endpoint will fetch third-party data, prefer adding a proxy route (so keys stay server-side) or use existing populate/ mapping utilities to normalize before upserting.
- Ensure `x-api-key` semantics are respected for protected endpoints — if you place a route after the API-key middleware it will require the header.

6. Files to inspect first (high signal)

- `backend/src/index.js` — app boot, CORS, middleware ordering (API key enforcement).
- `backend/src/routes/` — route patterns and examples.
- `backend/src/populate/src/` — mapping & upsert utilities for normalization.
- `frontend/src/main.jsx` and `frontend/src/App.jsx` — entry points and where API calls originate.
- `vite.config.js` — local dev proxy to backend.

7. Known gaps / expectations

- There are no automated tests in the repo. If adding tests, prefer lightweight unit tests for mapping logic in `backend/src/populate/src/`.
- Avoid adding secrets to frontend code. Use backend proxy routes for calls requiring credentials.

If anything here is unclear or you want the instructions tuned (more examples, specific coding style, or test templates), tell me which section to expand and I will iterate.
