## Scorva — Copilot instructions (concise)

This file gives targeted, actionable guidance so an AI coding agent can be productive quickly in this repo.

1. Quick start (dev)

- Frontend (Vite + React): from repo root run `npm run dev` (uses Vite, serves `frontend/src` via root config).
- Backend (Express): in a second terminal `cd backend && npm run start` (runs `node src/index.js`).
- Populate envs:
  - Copy `backend/backend.env.example` -> `.env` in `backend/` and set `DATABASE_URL`
  - Copy `env.example` (root) -> `.env` and set `VITE_API_URL` (backend URL)

2. Big-picture architecture

- Frontend: `frontend/src/` — React + Vite. Entry: `frontend/src/main.jsx`. Routing + UI components live under `components/` and `pages/`.
- Backend: `backend/src/` — Express app. Entry: `backend/src/index.js`. DB layer: `backend/src/db/db.js` (Postgres via `pg`).
- Data ingestion: `backend/src/populate/` and `backend/src/populate/src/` contain normalization and upsert helpers (e.g., `mapStatsToSchema.js`, `upsertPlayer.js`). These implement the logic for transforming ESPN-like responses into the DB.
- Deployment: frontend on Vercel, backend on Railway (see `vercel.json` and README notes).

3. Important conventions and patterns (do NOT break these)

- API routing: all backend routers live in `backend/src/routes/` and are mounted under `/api` in `backend/src/index.js`.
- Frontend API calls: the frontend makes direct API calls to the backend. All endpoints are publicly accessible (no authentication required).
- Frontend dev proxy: `vite.config.js` proxies `/api` to `http://192.168.1.68:3000` during development. In production, `VITE_API_URL` should point to the deployed backend URL.
- DB upserts and schema normalization live in `backend/src/populate/src/`. When ingesting new league or endpoint data, follow the mapping and `upsert*` patterns.
- CORS: backend whitelist includes `http://localhost:5173` and `https://scorva.vercel.app` — update `backend/src/index.js` if you add new origins.

4. Common developer workflows

- Run frontend only: `npm run dev` (root). Requires backend to be running and `.env` with `VITE_API_URL` configured.
- Run backend only: `cd backend && npm run start`. Requires `.env` with `DATABASE_URL` configured.
- Run tests: `cd backend && npm test` (runs full Jest suite with 120+ tests covering all routes, DB operations, and data transformations).
- To run both locally: open two terminals (frontend + backend). The frontend will proxy `/api` requests to the backend URL specified in `vite.config.js`.
- Database: Postgres connection is configured in `backend/src/db/db.js`; follow `.env` variables in `backend/backend.env.example`.

5. How to add a new backend endpoint (example)

- Create a new router file in `backend/src/routes/` that exports an Express Router.
- Use the DB helpers in `backend/src/db/db.js` or create a new service file under `backend/src/`.
- Mount the router in `backend/src/index.js` under `/api`.
- If the endpoint needs to fetch third-party data, use existing populate/ mapping utilities to normalize before upserting.
- **Write tests**: Create a test file in `backend/__tests__/routes/` following existing patterns (see `teams.test.js` or `aiSummary.test.js` as examples). Mock the database with `createMockPool()` from test helpers.

6. Files to inspect first (high signal)

- `backend/src/index.js` — app boot, CORS, middleware ordering.
- `backend/src/routes/` — route patterns and examples.
- `backend/src/populate/src/` — mapping & upsert utilities for normalization.
- `frontend/src/main.jsx` and `frontend/src/App.jsx` — entry points and where API calls originate.
- `vite.config.js` — local dev proxy to backend.
- `backend/__tests__/` — comprehensive test suite with 120+ tests covering all routes, DB operations, and data transformations.

7. Testing approach

- **Test suite**: 120+ automated tests using Jest + Supertest covering all API routes, database operations, data transformations, and integration workflows.
- **Test structure**: Tests live in `backend/__tests__/` organized by category (routes, db, populate, integration).
- **Running tests**: `cd backend && npm test` (runs all tests), `npm test -- <pattern>` (runs specific tests).
- **Writing new tests**: Follow patterns in existing test files. Use `createMockPool()` from `backend/__tests__/helpers/testHelpers.js` to mock database. Use absolute paths with `resolve()` for module mocking.
- **Key patterns**: Mock database to avoid external dependencies, test success cases + error handling + edge cases, verify query parameters and response formats.
- See `backend/__tests__/README.md` for detailed testing guide.

8. Known gaps / expectations

- The API is publicly accessible with no authentication. Consider adding rate limiting to prevent abuse, or implementing proper authentication (API keys, JWT, OAuth) for production use.

If anything here is unclear or you want the instructions tuned (more examples, specific coding style, or test templates), tell me which section to expand and I will iterate.
