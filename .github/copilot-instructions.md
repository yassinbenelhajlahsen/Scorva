## Scorva — Copilot instructions (concise)

This file gives targeted, actionable guidance so an AI coding agent can be productive quickly in this repo.

1. Quick start (dev)

- Frontend (Vite + React): `cd frontend && npm run dev` (serves `frontend/src`).
- Backend (Express): in a second terminal `cd backend && npm run start` (runs `node src/index.js`).
- Populate envs:
  - Copy `backend/backend.env.example` -> `backend/.env` and set `DATABASE_URL` and `OPENAI_API_KEY`.
  - Copy `frontend/.env.example` -> `frontend/.env` and set `VITE_API_URL` (backend URL).

2. Big-picture architecture

- Frontend: `frontend/src/` — React + Vite. Entry: `frontend/src/main.jsx`. Routing in `frontend/src/App.jsx`. Data-fetching via hooks in `hooks/`, API wrappers in `api/`, page components in `pages/`, shared UI in `components/`.
- Backend: `backend/src/` — Express app. Entry: `backend/src/index.js`. Four-layer request flow:
  ```
  Route (routes/) → Controller (controllers/) → Service (services/) → DB (db/db.js)
  ```
  - **Routes**: one file per resource, only delegates to controller — no logic.
  - **Controllers**: extracts `req.params`/`req.query`, calls service, sends `res.json()` or `res.status(500)`.
  - **Services**: runs raw SQL via `pg` Pool, returns plain data.
  - **DB**: `backend/src/db/db.js` — `pg` Pool singleton.
- Prisma: schema at `backend/prisma/schema.prisma`; generated client at `backend/src/generated/prisma/`. Used for schema management and migrations **only** — runtime queries use `pg` directly.
- Data ingestion: `backend/src/populate/` — ESPN API → DB normalization and upsert helpers.
- Deployment: frontend on Vercel (Root Directory `frontend/`), backend on Railway.

3. Important conventions (do NOT break these)

- API routing: all routers live in `backend/src/routes/` and are mounted under `/api` in `backend/src/index.js`.
- Layer separation: routes contain no logic; controllers contain no SQL; services return plain data only.
- Frontend API calls: all calls go to `VITE_API_URL` via wrappers in `frontend/src/api/`. The AI summary endpoint requires a `Authorization: Bearer <token>` header — token comes from `supabase.auth.getSession()`.
- Frontend dev proxy: `frontend/vite.config.js` proxies `/api` to `http://192.168.1.68:3000` during development.
- ESM everywhere: both packages use `"type": "module"`. Always use `.js` extensions in imports.
- CORS: allowlist in `backend/src/middleware/index.js` — update `corsOrigins` when adding new origins.
- Tailwind v4: all token/theme config is in `frontend/src/index.css` under `@theme`. There is no `tailwind.config.js`.
- Design — hover: always use `hover:-translate-y-0.5` lift, never `hover:scale-105`.
- Prisma: never edit `backend/src/generated/prisma/` directly; run `prisma generate` after schema changes.

4. Common developer workflows

- Run frontend only: `cd frontend && npm run dev`. Requires backend running and `frontend/.env` with `VITE_API_URL`.
- Run backend only: `cd backend && npm run start`. Requires `backend/.env` with `DATABASE_URL`.
- Run tests: `cd backend && npm test` (full Jest suite). `npm test -- <pattern>` for a specific file.
- Coverage: `cd backend && npm run test:coverage` (reports in `backend/coverage/`).
- Schema changes: edit `backend/prisma/schema.prisma` → `prisma migrate dev --name <desc>` locally → `prisma migrate deploy` on production. Note: shadow DB requires `pg_trgm`; if `migrate dev` fails locally, apply SQL manually then `prisma migrate resolve --applied`.

5. How to add a new backend endpoint

- Create `backend/src/routes/myRoute.js` — export an Express Router with only route + controller delegation.
- Create `backend/src/controllers/myController.js` — extract params/query, call service, send response, catch errors.
- Create `backend/src/services/myService.js` — SQL via `pool.query()` (raw pg), return data.
- Mount in `backend/src/index.js` under `/api`.
- **Write tests**: create `backend/__tests__/routes/myRoute.test.js` following existing patterns. Mock the database with `createMockPool()` from `backend/__tests__/helpers/testHelpers.js`. Use `jest.unstable_mockModule()` before importing.

6. Files to inspect first (high signal)

- `backend/src/index.js` — app boot, CORS, middleware ordering, route mounting.
- `backend/src/routes/` — route patterns (thin — just delegates to controller).
- `backend/src/controllers/` — request/response handling per resource.
- `backend/src/services/` — DB queries and business logic.
- `backend/src/populate/src/` — ESPN API mapping and upsert utilities.
- `backend/prisma/schema.prisma` — source of truth for DB models.
- `frontend/src/App.jsx` and `frontend/src/main.jsx` — entry points.
- `frontend/src/index.css` — Tailwind v4 `@theme` design tokens.
- `frontend/vite.config.js` — local dev proxy.
- `backend/__tests__/` — test suite with tests covering all routes, services, DB operations, and data transformations.

7. Testing approach

- **Framework**: Jest 29 + Supertest for HTTP assertions. ES modules — use `jest.unstable_mockModule()` for mocking.
- **Test structure**: `backend/__tests__/routes/`, `services/`, `populate/`, `db/`, `integration/`.
- **Test helpers**: `backend/__tests__/helpers/testHelpers.js` exports `createMockPool()`, `fixtures` (team/player/game factories), `mockRequest`, `mockResponse`.
- **Running tests**: `cd backend && npm test` (all), `npm test -- <pattern>` (specific).
- **Writing tests**: mock `db/db.js` with `createMockPool()`. Test success cases + error handling + edge cases + parameter variants. See `backend/__tests__/README.md` for full guide.

8. Known gaps / expectations

- Most API endpoints are publicly accessible. The AI summary endpoint (`GET /api/games/:id/ai-summary`) requires a valid Supabase JWT — unauthenticated requests return 401.
- Auth is handled by Supabase. Backend env vars required: `PROJECT_URL`, `SUPABASE_SECRET_KEY`. Frontend env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- AI summaries: cache-first, persisted to `games.ai_summary`, only generated for finalized games.
- `playerInfo` service uses a hardcoded `currentSeason = "2025-26"` constant — update when the season changes.

If anything here is unclear or you want the instructions tuned (more examples, specific coding style, or test templates), tell me which section to expand and I will iterate.
