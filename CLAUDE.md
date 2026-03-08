# Scorva — CLAUDE.md

## Project overview
Multi-league sports stats web app (NBA, NFL, NHL). Data flows: ESPN API → PostgreSQL → Express backend → React frontend.

## Docs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — live sync, Redis, SSE, data flow, game columns, auth, AI summaries
- [`docs/DESIGN.md`](docs/DESIGN.md) — design tokens, component conventions, Tailwind patterns
- [`backend/__tests__/README.md`](backend/__tests__/README.md) — backend testing guide, patterns, fixtures

## Stack
- **Frontend**: React 19, Vite 6, React Router 7, Tailwind CSS v4, Framer Motion 12
- **Backend**: Node.js + Express 5, PostgreSQL (`pg`), Prisma 7 (schema/migrations only), helmet (security headers)
- **Auth**: Supabase Auth — email/password + Google OAuth; JWT verified server-side
- **AI**: OpenAI SDK for game summaries
- **Caching**: Redis via `ioredis` (graceful no-op fallback when `REDIS_URL` unset)
- **Testing**: Jest 29 + Supertest (backend), Vitest + Testing Library + jsdom (frontend)
- All packages use ESM (`"type": "module"`). Always use `.js` extensions in imports.

## Commands
```bash
# Frontend
cd frontend && npm run dev        # dev server
cd frontend && npm run build      # production build
cd frontend && npm test           # run all frontend tests (Vitest)
cd frontend && npm run test:watch # watch mode
cd frontend && npm run test:coverage
cd frontend && npm run verify     # lint + test + build (also what CI runs)

# Backend
cd backend && npm run start       # start server
cd backend && npm run live-sync   # run live sync worker locally
cd backend && npm test            # run all tests
cd backend && npm test -- <pat>   # run matching tests
cd backend && npm run test:coverage

# Prisma
cd backend && node_modules/.bin/prisma generate          # after schema changes
cd backend && node_modules/.bin/prisma migrate dev --name <desc>
cd backend && node_modules/.bin/prisma migrate deploy    # production
```

## Backend architecture (4 layers)
```
Route (routes/) → Controller (controllers/) → Service (services/) → DB (db/db.js)
```
- **Routes**: thin — only delegates to controller, no logic
- **Controllers**: extracts params/query, calls service, sends response, catches errors
- **Services**: raw SQL via `pg` Pool (`pool.query()`), returns plain data
- **DB**: `backend/src/db/db.js` — `pg` Pool singleton

## Key file locations
| What | Where |
|---|---|
| Backend entry | `backend/src/index.js` |
| CORS, rate limits, SSE limiter | `backend/src/middleware/index.js` |
| JWT auth middleware | `backend/src/middleware/auth.js` |
| Routes | `backend/src/routes/` |
| Controllers | `backend/src/controllers/` |
| Services | `backend/src/services/` |
| Prisma schema | `backend/prisma/schema.prisma` |
| Generated client | `backend/src/generated/prisma/` (do not edit) |
| Cache module | `backend/src/cache/cache.js` |
| Season cache helper | `backend/src/cache/seasons.js` |
| Scheduled upsert | `backend/src/populate/upsert.js` |
| Live sync worker | `backend/src/populate/liveSync.js` |
| Historical upsert | `backend/src/populate/historicalUpsert.js` |
| Data ingestion helpers | `backend/src/populate/src/` |
| Frontend entry | `frontend/src/main.jsx` |
| Frontend router | `frontend/src/App.jsx` |
| Design tokens | `frontend/src/index.css` (`@theme`) |
| Supabase client | `frontend/src/lib/supabase.js` |
| Auth context + modal | `frontend/src/context/AuthContext.jsx` |
| OAuth callback page | `frontend/src/pages/AuthCallback.jsx` |
| API wrappers | `frontend/src/api/` |
| Data hooks | `frontend/src/hooks/` |
| Favorites API | `frontend/src/api/favorites.js` |
| Favorites hooks | `frontend/src/hooks/useFavorites.js`, `frontend/src/hooks/useFavoriteToggle.js` |
| User API | `frontend/src/api/user.js` |
| User prefs hook | `frontend/src/hooks/useUserPrefs.js` |
| Settings page | `frontend/src/pages/SettingsPage.jsx` |
| Settings tabs | `frontend/src/components/settings/FavoritesTab.jsx`, `frontend/src/components/settings/AccountTab.jsx` |
| User controller | `backend/src/controllers/userController.js` |
| User service | `backend/src/services/userService.js` |
| User route | `backend/src/routes/user.js` |
| Webhook handler | `backend/src/routes/webhooks.js`, `backend/src/controllers/webhooksController.js` |
| SSE live route | `backend/src/routes/live.js`, `backend/src/controllers/liveController.js` |
| SSE live hooks | `frontend/src/hooks/useLiveGame.js`, `frontend/src/hooks/useLiveGames.js` |
| Skeleton primitive | `frontend/src/components/ui/Skeleton.jsx` |
| Error state component | `frontend/src/components/ui/ErrorState.jsx` |
| Page skeleton layouts | `frontend/src/components/skeletons/` |
| Backend test suite | `backend/__tests__/` |
| Backend test helpers | `backend/__tests__/helpers/testHelpers.js` |
| Frontend test suite | `frontend/src/__tests__/` |
| Frontend test setup | `frontend/src/__tests__/setup.js` |
| Frontend test helpers | `frontend/src/__tests__/helpers/testUtils.jsx` |

## API endpoints (all under `/api`)
- `GET /:league/teams`
- `GET /:league/standings`
- `GET /:league/games`
- `GET /:league/games/:gameId`
- `GET /:league/players`
- `GET /:league/players/:playerId`
- `GET /:league/seasons`
- `GET /search`
- `GET /live/:league/games` — SSE stream; heartbeat `: ping` every 15s; `event: done` when no live games
- `GET /live/:league/games/:gameId` — SSE stream; `event: done` when game is Final
- `GET /games/:id/ai-summary` — **requires `Authorization: Bearer <token>` header**
- `GET /favorites` — requires auth; returns `{ players: [...], teams: [...] }`
- `GET /favorites/check?playerIds=1,2&teamIds=3,4` — requires auth
- `POST /favorites/players/:playerId` — requires auth
- `DELETE /favorites/players/:playerId` — requires auth
- `POST /favorites/teams/:teamId` — requires auth
- `DELETE /favorites/teams/:teamId` — requires auth
- `GET /user/profile` — requires auth; returns `id`, `email`, `first_name`, `last_name`, `default_league`
- `PATCH /user/profile` — requires auth; body `{ firstName, lastName, defaultLeague }`; validates `defaultLeague` against `["nba", "nfl", "nhl"]`
- `DELETE /user/account` — requires auth; deletes Supabase auth user then DB row (cascades favorites)
- `POST /webhooks/supabase-auth` — verified by `Authorization: <SUPABASE_WEBHOOK_SECRET>`; inserts user on signup

## Frontend routes
- `/` → Homepage
- `/about` → About (lazy-loaded)
- `/:league` → LeaguePage
- `/:league/teams/:teamId` → TeamPage
- `/:league/players/:playerId` → PlayerPage
- `/:league/games/:gameId` → GamePage
- `/settings` → SettingsPage (requires auth, redirects to `/` if logged out)
- `/privacy` → PrivacyPage (lazy-loaded)
- `/auth/callback` → AuthCallback (OAuth popup handler — no layout shell)
- `*` → ErrorPage (404 catch-all, lazy-loaded)

## Critical conventions
- **Never edit** `backend/src/generated/prisma/` — regenerate with `prisma generate`
- **Security headers** — `helmet` in `backend/src/index.js`
- **CORS allowlist** in `backend/src/middleware/index.js` — production: `scorva.vercel.app` and `scorva.dev` only; localhost/LAN only when `NODE_ENV !== "production"`
- **Middleware chain**: `helmet` → `requestLogger` → `cors` → `express.json()` → `webhooksRoute` → `aiSummaryRoute` → `sseConnectionLimiter` (on `/api/live`) → `liveRoute` → `generalLimiter` → all other routes
- **AI route** — stricter `aiLimiter` (inside `routes/aiSummary.js`) + `requireAuth`
- **Auth middleware** (`requireAuth`) — calls `supabase.auth.getUser(token)` using `SUPABASE_SECRET_KEY` + `SUPABASE_URL`
- **Prisma** — schema/migrations only; runtime uses `pg` directly
- **League validation** — all 8 league-param controllers (teams, standings, games, gameInfo, players, playerInfo, seasons, live) validate against `["nba","nfl","nhl"]` (400 if invalid)
- **`apiFetch`** (`frontend/src/api/client.js`) — supports `method` + `body`; sets `Content-Type: application/json` when body present; handles 204 responses
- **Favorites** — controller validates numeric `playerId`/`teamId` (400 for non-numeric); `checkFavorites` uses `Number.isFinite` to filter comma-separated params; service uses `ROW_NUMBER()` for 3 most recent per favorite
- **Google OAuth popup** — `skipBrowserRedirect: true` → popup → `/auth/callback` closes via `postMessage` → parent modal closes
- **`game_label`** — display-only text, null for regular season; never use for classification logic
- **`games.type`** — single source of truth for game classification; see `docs/ARCHITECTURE.md`
- **`useUserPrefs`** — pass `controller.signal` to `getProfile()` so AbortController signal is forwarded
- **`userController`** — delete Supabase auth user before DB delete (not after)

## Adding a new endpoint (checklist)
1. `backend/src/routes/myRoute.js` — router + controller delegation only
2. `backend/src/controllers/myController.js` — extract params, call service, handle errors
3. `backend/src/services/myService.js` — SQL query, return data
4. Mount in `backend/src/index.js` under `/api`
5. Test in `backend/__tests__/routes/myRoute.test.js` — mock db with `createMockPool()`

## Testing quick reference

### Backend (Jest 29 + Supertest)
- Mock `db/db.js` using `jest.unstable_mockModule()` before importing
- `createMockPool()` returns mock with `.query.mockResolvedValue({ rows: [...] })`
- Mock `cache/seasons.js` in route tests that use season-aware services
- `jest.clearAllMocks()` clears call counts but NOT `mockOnce` queue — use `jest.resetAllMocks()` to clear queues
- See `backend/__tests__/README.md` for full guide

### Frontend (Vitest + Testing Library)
- **API client**: mock `global.fetch` via `vi.stubGlobal`; stub `import.meta.env.VITE_API_URL` via `vi.stubEnv`
- **API wrappers**: mock `../../api/client.js` via `vi.mock()`
- **Hooks**: mock `AuthContext.jsx` + API modules; use `renderHook` + `waitFor` + `act`
- **Debounce**: `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(ms)` + `await act(async () => {})` — do NOT use `waitFor` with fake timers
- **Components**: use `renderWithProviders` from `testUtils.jsx`

## CI/CD
- CI runs `cd frontend && npm run verify` (lint + test + build) on pushes/PRs that touch `frontend/**` (excludes `*.md`); also supports `workflow_dispatch`
- Vercel deployment proceeds only after CI passes on `main`
- Backend deploys independently via Railway
