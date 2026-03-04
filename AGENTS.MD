# AGENTS.MD

## Scope
This repository is a full-stack JavaScript project with:
- Frontend in `frontend/` (React + Vite + Tailwind CSS v4).
- Backend in `backend/` (Express + PostgreSQL + Jest).

## Architecture
- Frontend entry: `frontend/src/main.jsx`.
- Frontend HTML template: `frontend/index.html`.
- Frontend routes: `frontend/src/App.jsx` (`/`, `/about`, `/:league`, `/:league/teams/:teamId`, `/:league/players/:playerId`, `/:league/games/:gameId`).
- Frontend data access: all API calls use `import.meta.env.VITE_API_URL` + `/api/...`.
- Frontend config: `frontend/vite.config.js`, `frontend/eslint.config.js`, `frontend/package.json`.
- Frontend styles: `frontend/src/index.css` — Tailwind v4 CSS-based config via `@theme` (no `tailwind.config.js`).
- Backend entry: `backend/src/index.js`.
- Backend routers (all mounted under `/api`):
  - `/:league/teams`
  - `/:league/standings`
  - `/:league/games`
  - `/:league/games/:gameId`
  - `/:league/players`
  - `/:league/players/:slug`
  - `/search`
  - `/games/:id/ai-summary`
- DB layer: `backend/src/db/db.js` (`pg` Pool).
- Data ingestion pipeline: `backend/src/populate/` + `backend/src/populate/src/`.

## Verified Commands
### Frontend (`frontend/package.json`)
- `cd frontend && npm run dev` → `vite` (dev server)
- `cd frontend && npm run build` → `vite build`
- `cd frontend && npm run lint` → `eslint .`
- `cd frontend && npm run preview` → `vite preview`

### Backend (`backend/package.json`)
- `cd backend && npm run start` → `node src/index.js`
- `cd backend && npm test` → `NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js`
- `cd backend && npm run test:watch` → same Jest command with `--watch`
- `cd backend && npm run test:coverage` → same Jest command with `--coverage`

### Ingestion / maintenance scripts (no npm alias)
- `node backend/src/populate/upsert.js`
- `node backend/src/populate/historicalUpsert.js`
- `node backend/scripts/specialEventFix.js` (dry run)
- `node backend/scripts/specialEventFix.js --apply` (commits DB changes)

### Deployment config (`frontend/vercel.json`)
- Build command: `npm run build`
- Output directory: `dist`
- Vercel project Root Directory is set to `frontend/` — only changes inside `frontend/` trigger a deployment.

## Environment
- Frontend env example: `frontend/.env.example`
  - `VITE_API_URL=http://localhost:3000`
- Backend env example: `backend/backend.env.example`
  - `DATABASE_URL=...`
  - `OPENAI_API_KEY=...`
- Backend env loading (`backend/src/config/env.js`) resolves `backend/.env` (relative to `backend/src/config`).

## Constraints and Gotchas
- Frontend API base URL is always `VITE_API_URL`; Vite `/api` proxy is configured but frontend code does not call relative `/api` paths.
- Vite dev proxy target is hardcoded to `http://192.168.1.68:3000` in `frontend/vite.config.js`.
- Backend CORS is allowlist-based (`backend/src/middleware/index.js`): `localhost:5173–5175`, `192.168.1.68:5173–5175`, and `https://scorva.vercel.app`.
- Rate limiting is active (`backend/src/middleware/index.js`):
  - General limiter on all `/api` routes: 3000 req/15 min in prod, effectively unlimited in dev.
  - Stricter limiter for `/api/games/:id/ai-summary` (mounted first): 50 req/15 min in prod.
- `playerInfo` uses hardcoded season constant `currentSeason = "2025-26"`.
- AI summaries are cache-first and persisted to `games.ai_summary`; generation only triggers for games whose status includes `Final`.
- Backend server starts listening immediately in `backend/src/index.js` (no exported app instance).
- Ingestion upserts assume DB constraints exist (e.g. `unique_game_combo`, plus conflict keys on players/stats/teams).
- `backend/scripts/specialEventFix.js` is transactional and defaults to rollback unless `--apply` is passed.

## Testing Facts
- Jest config: `backend/jest.config.js`.
- Coverage thresholds configured globally:
  - branches 70
  - functions 75
  - lines 80
  - statements 80
- Test setup sets `NODE_ENV=test` and a mock `DATABASE_URL` in `backend/__tests__/setup.js`.

## Agent Workflow Guidance
- Install dependencies in both package roots when needed:
  - frontend: `cd frontend && npm install`
  - backend: `cd backend && npm install`
- Run frontend and backend in separate terminals for local dev:
  - frontend: `cd frontend && npm run dev`
  - backend: `cd backend && npm run start`
- Validate backend changes with tests from `backend/` before finishing.

## PR Rules (Detectable)
- No PR template, GitHub Actions workflow, CODEOWNERS, or CONTRIBUTING file detected in tracked files.
- Vercel deploys are scoped to `frontend/` via the project's Root Directory setting — backend-only commits do not trigger a frontend rebuild.
