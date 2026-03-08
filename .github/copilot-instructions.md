## Scorva — Copilot instructions (concise)

This file gives targeted, actionable guidance so an AI coding agent can be productive quickly in this repo.

1. Quick start (dev)

- Frontend (Vite + React): `cd frontend && npm run dev` (serves `frontend/src`).
- Backend (Express): in a second terminal `cd backend && npm run start` (runs `node src/index.js`).
- Populate envs:
  - Copy `backend/.env.example` -> `backend/.env` and set `DATABASE_URL` and `OPENAI_API_KEY`.
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
- Cache: `backend/src/cache/` — Redis caching layer via `ioredis`. `cache.js` exports `cached()`, `invalidate()`, `invalidatePattern()`, `closeCache()`. `seasons.js` exports `getCurrentSeason(league)` (1h TTL). Applied at the service layer. Graceful no-op fallback when `REDIS_URL` is unset.
- Data ingestion: `backend/src/populate/` — ESPN API → DB normalization and upsert helpers. Two workers:
  - `upsert.js` — scheduled (every 30–60 min), processes all leagues for today's games
  - `liveSync.js` — persistent Railway worker, polls live games every 15s using a two-tier strategy: fast scoreboard-only upsert every tick, full `processEvent()` (boxscore + player stats) every 2 min or on period change. Sleeps 5 min when no live games.
- Deployment: frontend on Vercel (Root Directory `frontend/`), backend API on Railway, liveSync worker as a separate Railway service (Root Directory `backend`, Start Command `npm run live-sync`, Restart Policy `Always`).

3. Important conventions (do NOT break these)

- API routing: all routers live in `backend/src/routes/` and are mounted under `/api` in `backend/src/index.js`.
- Layer separation: routes contain no logic; controllers contain no SQL; services return plain data only.
- Frontend API calls: all calls go to `VITE_API_URL` via wrappers in `frontend/src/api/`. The AI summary and all user/favorites endpoints require an `Authorization: Bearer <token>` header. `apiFetch` in `frontend/src/api/client.js` handles auth, method, body serialization, and 204 responses.
- Frontend dev proxy: `frontend/vite.config.js` proxies `/api` to `http://192.168.1.68:3000` during development.
- ESM everywhere: both packages use `"type": "module"`. Always use `.js` extensions in imports.
- CORS: allowlist in `backend/src/middleware/index.js` — update `corsOrigins` when adding new origins.
- Tailwind v4: all token/theme config is in `frontend/src/index.css` under `@theme`. There is no `tailwind.config.js`.
- Design — hover: always use `hover:-translate-y-0.5` lift, never `hover:scale-105`.
- Prisma: never edit `backend/src/generated/prisma/` directly; run `prisma generate` after schema changes.

4. Common developer workflows

- Run frontend only: `cd frontend && npm run dev`. Requires backend running and `frontend/.env` with `VITE_API_URL`.
- Run backend only: `cd backend && npm run start`. Requires `backend/.env` with `DATABASE_URL`.
- Run all quality checks: `cd frontend && npm run verify` (lint + test + build — no root package.json exists).
- Run backend tests: `cd backend && npm test` (full Jest suite). `npm test -- <pattern>` for a specific file.
- Run frontend tests: `cd frontend && npm test` (Vitest). `npm run test:watch` for watch mode.
- Coverage: `cd backend && npm run test:coverage` or `cd frontend && npm run test:coverage`.
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
- `backend/src/populate/src/` — ESPN API mapping and upsert utilities (`eventProcessor.js`, `upsertGame.js`, etc.).
- `backend/src/populate/liveSync.js` — live sync worker (exports `upsertGameScoreboard` for testing; `main()` guarded by `NODE_ENV !== 'test'`).
- `backend/src/cache/cache.js` and `backend/src/cache/seasons.js` — Redis caching layer and season helper.
- `backend/prisma/schema.prisma` — source of truth for DB models.
- `frontend/src/App.jsx` and `frontend/src/main.jsx` — entry points.
- `frontend/src/index.css` — Tailwind v4 `@theme` design tokens.
- `frontend/vite.config.js` — local dev proxy.
- `backend/__tests__/` — test suite with tests covering all routes, services, DB operations, and data transformations.

7. Testing approach

**Backend** (Jest 29 + Supertest):
- **Framework**: Jest 29 + Supertest for HTTP assertions. ES modules — use `jest.unstable_mockModule()` for mocking.
- **Test structure**: `backend/__tests__/routes/`, `services/`, `populate/`, `db/`, `cache/`, `integration/`.
- **Test helpers**: `backend/__tests__/helpers/testHelpers.js` exports `createMockPool()`, `fixtures` (team/player/game factories), `mockRequest`, `mockResponse`.
- **Running tests**: `cd backend && npm test` (all), `npm test -- <pattern>` (specific).
- **Writing tests**: mock `db/db.js` with `createMockPool()`. Test success cases + error handling + edge cases + parameter variants. See `backend/__tests__/README.md` for full guide.

**Frontend** (Vitest + Testing Library):
- **Framework**: Vitest + @testing-library/react + jsdom. Config inline in `frontend/vite.config.js`.
- **Test structure**: `frontend/src/__tests__/{utilities,api,components,hooks,helpers}/`.
- **Test helpers**: `frontend/src/__tests__/helpers/testUtils.jsx` exports `renderWithProviders()` (wraps `BrowserRouter` + mock `AuthContext.Provider`) and `mockSession` fixture.
- **Running tests**: `cd frontend && npm test` (all), `npm run test:watch` (watch mode).
- **Writing tests**:
  - Utilities: no mocking needed
  - API wrappers: mock `client.js` via `vi.mock()`; stub `import.meta.env` with `vi.stubEnv()`
  - Hooks: mock `AuthContext.jsx` + API modules via `vi.mock()`; use `renderHook` + `waitFor` + `act`
  - Debounce/timer tests: `vi.useFakeTimers()` in `beforeEach`; advance with `vi.advanceTimersByTimeAsync(ms)`; then drain microtasks with `await act(async () => {})`
  - Components: use `renderWithProviders()` for router + auth context wrapping

**CI**: `.github/workflows/deploy.yml` runs `cd frontend && npm run verify` on every push and PR — frontend lint + test + build. Backend deploys independently via Railway. Vercel deploy only runs on `main` after CI passes.

8. Auth-gated features & user preferences

- Most API endpoints are publicly accessible. The AI summary, favorites, and user profile endpoints require a valid Supabase JWT — unauthenticated requests return 401.
- Auth is handled by Supabase. Backend env vars required: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (used for both auth middleware and admin operations), `SUPABASE_WEBHOOK_SECRET`, `REDIS_URL` (optional). Frontend env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- AI summaries: cache-first, persisted to `games.ai_summary`, only generated for finalized games.
- `playerInfo` service uses a hardcoded `currentSeason = "2025-26"` constant — update when the season changes.
- **User preferences** are stored in the `users` table (`default_league VARCHAR(10)`). Fetched on the frontend via `useUserPrefs` hook (`GET /api/user/profile`). The homepage defers rendering league tabs until prefs resolve to prevent a flash of the wrong default league.
- **Settings page** (`/settings`): sidebar on desktop, drill-down nav on mobile. Tabs: Favorites (manage starred players/teams + default league picker) and Account (edit name, change password, delete account). Navbar shows a gear icon when logged in.
- **Account deletion** is a two-step operation: delete the DB row first (cascades favorites), then call `supabaseAdmin.auth.admin.deleteUser()` with the service role key.
- **Google OAuth detection**: check `user.app_metadata.providers` array for `"email"` — do not rely on the single `provider` string. Password-change UI is hidden for Google OAuth users.
- **Auth modal**: fully centered on all screen sizes, dismissible via outside click, scrollable with `max-h-[90dvh]`.

If anything here is unclear or you want the instructions tuned (more examples, specific coding style, or test templates), tell me which section to expand and I will iterate.
