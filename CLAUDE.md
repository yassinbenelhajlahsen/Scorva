# Scorva — CLAUDE.md

## Project overview
Multi-league sports stats web app (NBA, NFL, NHL). Data flows: ESPN API → PostgreSQL → Express backend → React frontend.

## Stack
- **Frontend**: React 19, Vite 6, React Router 7, Tailwind CSS v4, Framer Motion 12
- **Backend**: Node.js + Express 5, PostgreSQL (`pg`), Prisma 7 (schema/migrations only)
- **Auth**: Supabase Auth — email/password + Google OAuth; JWT verified server-side
- **AI**: OpenAI SDK for game summaries
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
| CORS + rate limits | `backend/src/middleware/index.js` |
| JWT auth middleware | `backend/src/middleware/auth.js` |
| Routes | `backend/src/routes/` |
| Controllers | `backend/src/controllers/` |
| Services | `backend/src/services/` |
| Prisma schema | `backend/prisma/schema.prisma` |
| Generated client | `backend/src/generated/prisma/` (do not edit) |
| Scheduled upsert | `backend/src/populate/upsert.js` |
| Live sync worker | `backend/src/populate/liveSync.js` |
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
- `GET /live/:league/games` — SSE stream; pushes game list on each `pg_notify('game_updated')` from liveSync; sends `event: done` when no live games remain; heartbeat `: ping` every 15s
- `GET /live/:league/games/:gameId` — SSE stream; pushes full game detail on each `pg_notify('game_updated')` from liveSync; sends `event: done` when game is Final; mounted before `generalLimiter`
- `GET /games/:id/ai-summary` — **requires `Authorization: Bearer <token>` header**
- `GET /favorites` — requires auth; returns `{ players: [...], teams: [...] }` with recent stats/games
- `GET /favorites/check?playerIds=1,2&teamIds=3,4` — requires auth; returns which IDs are favorited
- `POST /favorites/players/:playerId` — requires auth; adds player favorite
- `DELETE /favorites/players/:playerId` — requires auth; removes player favorite
- `POST /favorites/teams/:teamId` — requires auth; adds team favorite
- `DELETE /favorites/teams/:teamId` — requires auth; removes team favorite
- `GET /user/profile` — requires auth; returns user row (`id`, `email`, `first_name`, `last_name`, `default_league`)
- `PATCH /user/profile` — requires auth; body `{ firstName, lastName, defaultLeague }`; uses COALESCE so omitted fields are unchanged
- `DELETE /user/account` — requires auth; deletes DB row (cascades favorites) then calls `supabaseAdmin.auth.admin.deleteUser()`
- `POST /webhooks/supabase-auth` — Supabase auth webhook; verified by `Authorization: <SUPABASE_WEBHOOK_SECRET>` header; inserts new user into `users` table on signup

## Frontend routes
- `/` → Homepage
- `/:league` → LeaguePage
- `/:league/teams/:teamId` → TeamPage
- `/:league/players/:playerId` → PlayerPage
- `/:league/games/:gameId` → GamePage
- `/settings` → SettingsPage (requires auth, redirects to `/` if logged out)
- `/auth/callback` → AuthCallback (OAuth popup handler — no layout shell)

## Design system
Tailwind v4 — config only in `frontend/src/index.css` (`@theme`). No `tailwind.config.js`.
- Apple-style dark theme: `surface-base/primary/elevated/overlay`, `text-primary/secondary/tertiary`, `accent`, `win`, `loss`, `live`
- Card: `bg-surface-elevated border border-white/[0.08] rounded-2xl`
- Hover: always `hover:-translate-y-0.5`, never `hover:scale-105`
- Transitions: `transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]`

## Important conventions
- **Never edit** `backend/src/generated/prisma/` — regenerate with `prisma generate`
- **CORS allowlist** in `backend/src/middleware/index.js` — update `corsOrigins` for new origins
- **AI route** uses stricter `aiLimiter` (applied inside `routes/aiSummary.js`) + `requireAuth` middleware
- **AI summaries** are cache-first, persisted to `games.ai_summary`, only generated for finalized games, requires auth
- **Auth middleware** (`requireAuth`) calls `supabase.auth.getUser(token)` using `SUPABASE_SECRET_KEY` + `PROJECT_URL` env vars
- **Google OAuth popup** flow: `skipBrowserRedirect: true` → open popup → `/auth/callback` page closes popup via `postMessage` → parent modal closes
- **Prisma** is for schema/migrations only; runtime uses `pg` directly
- **game_label** column holds playoff round labels (e.g. `"NBA Finals - Game 1"`), null for regular season
- **current_period** (`Int?`) and **clock** (`String?`) columns on `games` — populated by the live sync worker and `upsert.js`. Null for scheduled/final games. `gameInfoService.js` exposes them as `currentPeriod` and `clock` in the game detail response. Frontend uses `getPeriodLabel(period, league)` from `formatDate.js` to render Q1–Q4/OT (NBA/NFL) or P1–P3/OT (NHL).
- **start_time** (`String?`) column on `games` — set once at ingest by `eventProcessor.js` from `event.date` (ESPN UTC ISO timestamp converted to ET, e.g. `"7:30PM ET"` or `"10PM ET"`). Never updated by liveSync. `gameInfoService.js` exposes it as `startTime` (camelCase). `gamesService` exposes it as `start_time` (snake_case via `g.*`). Frontend shows it only for scheduled games (not live/final): `GameCard` shows `"Mar 12th @ 7PM ET"`, `GamePage` shows `"March 12th, 2026 @ 7PM ET"`. Helpers: `formatDateShortWithTime` and `formatDateWithTime` in `frontend/src/utilities/formatDate.js`.
- **Live sync worker** (`liveSync.js`): two-tier update — fast path every 15s (`upsertGameScoreboard`, scoreboard data only), full path every 2 min or on period change (`processEvent`, fetches boxscore + player stats). Each write fires `pg_notify('game_updated')` which SSE controllers use to push immediately to clients. Sleeps 5 min when no live games. Deployed as a separate Railway service with `npm run live-sync`. `main()` is guarded by `NODE_ENV !== 'test'`; `upsertGameScoreboard` is a named export for unit testing.
- **upsert.js** runs on a schedule (every 30–60 min) as a catch-up mechanism — picks up scheduled games, season transitions, and data liveSync may have missed. Both workers use `ON CONFLICT DO UPDATE` so concurrent writes are safe.
- **Redis caching** — `backend/src/cache/cache.js` exports `cached(key, ttl, queryFn, {cacheIf}?)`, `invalidate(...keys)`, `invalidatePattern(pattern)`, `closeCache()`. `backend/src/cache/seasons.js` exports `getCurrentSeason(league)` (1h TTL). Applied at the service layer. Graceful fallback: if `REDIS_URL` is unset, all ops are no-ops. Cache keys: `gameDetail:{league}:{id}` (30d, Final only via `cacheIf`), `standings:{league}:{season}` (5m current / 30d past), `playerDetail:{league}:{playerId}:{season}` (2m current / 30d past), `games:{league}:default:{todayEST}` (30s), `games:{league}:{season}:team:{teamId}` and `:all` (30s/30d), `teams/players/seasons:{league}` (24h). Invalidation: `upsertGame.js` (per write), `liveSync.js` (scoreboard tick + game finalize), `upsert.js` (per league batch). NOT cached: favorites, user, search, AI summary, SSE. `REDIS_URL` must be set on all three Railway services (API, liveSync, upsert). Tests: mock `cache/seasons.js` with `jest.unstable_mockModule` in route tests that use season-aware services; `__tests__/cache/cache.test.js` unit-tests the cache module with mocked ioredis.
- **Users table** (`users`) stores Supabase auth UUIDs + `email`, `first_name`, `last_name`, `default_league` (nullable, defaults to `"nba"` on frontend). Populated via Supabase webhook on signup. Email/password users pass name via `options.data` in `supabase.auth.signUp()`; Google OAuth users have `full_name` split on first space. `favoritesService.ensureUser()` is a fallback that upserts on first favorite action. Webhook secret stored in `SUPABASE_WEBHOOK_SECRET` env var.
- **User preferences** (`default_league`) stored in `users` table. Fetched via `useUserPrefs` hook (`GET /api/user/profile`). Homepage defers rendering league tabs until prefs resolve to avoid NBA→preference flicker. Settings page allows editing via `PATCH /api/user/profile`.
- **Settings page** (`/settings`) — sidebar navigation (desktop) / drill-down (mobile). Tabs: Favorites (manage favorites + default league selector) and Account (edit name, change password, delete account). Navbar shows gear icon linking to `/settings` when logged in; "Sign In" pill when logged out. Google OAuth users see "Signed in with Google" badge; password change section is hidden for them.
- **Account deletion** — two-step: `DELETE /api/user/account` deletes DB row (cascades favorites), then calls Supabase Admin API to delete auth user. Requires `SUPABASE_SERVICE_ROLE_KEY` env var on backend.
- **Auth modal** — fully centered on all screen sizes, dismissible via outside click, scrollable content, `max-h-[90dvh]`. Close button always visible.
- **apiFetch** (`frontend/src/api/client.js`) supports `method` and `body` params; sets `Content-Type: application/json` when body present; handles 204 (no-content) responses.
- **Favorites** all routes require `requireAuth`; service uses `ROW_NUMBER()` window functions to get 3 most recent finalized stats/games per favorite
- **SSE live endpoints** (`/api/live/:league/games` and `/api/live/:league/games/:gameId`) — mounted before `generalLimiter`; reuse `gamesService`/`gameInfoService` directly in controller (no new service layer); 30s data interval, 15s `: ping` heartbeat, `X-Accel-Buffering: no` for Railway. Frontend: `useLiveGames(league|null)` and `useLiveGame(league, gameId, isLive)` hooks — pass `null` to deactivate without breaking hooks rules. 3-failure REST fallback. SSE URL helpers in `frontend/src/api/games.js` use `import.meta.env.VITE_API_URL` directly. `useLiveGame` integrated into `useGame`; `useLiveGames` integrated into `useHomeGames` (3x) and `useLeagueData`.
- **Loading states** — all pages use page-specific shimmer skeleton components (`frontend/src/components/skeletons/`) instead of a generic spinner. `Skeleton.jsx` is the shared `animate-pulse bg-white/[0.06] rounded-lg` primitive. `LoadingPage.jsx` is no longer used by main pages but still exists.
- **Error state** — `ErrorState.jsx` (`frontend/src/components/ui/`) is the standard error UI: card with warning icon, message, and "Try Again" button. Always centered via `min-h-[60vh]` flex wrapper with `px-4 sm:px-6` mobile padding. Props: `{ message?, onRetry? }`. Pages distinguish network errors (show `ErrorState`) from not-found (show dedicated "Not Found" layout).
- **Hook retry pattern** — all data-fetching hooks (`useHomeGames`, `useLeagueData`, `useTeam`, `usePlayer`, `useGame`) expose a `retry()` function. Pattern: `const [retryCount, setRetryCount] = useState(0)` added to deps array; `const retry = useCallback(() => setRetryCount(c => c + 1), [])` returned alongside data.
- **usePlayer** now returns `{ playerData, loading, error, retry }` — previously had no `error` state and silently swallowed fetch failures by setting `playerData` to null.
- **inProgress detection** — both `GameCard.jsx` and `GamePage.jsx` treat `"Halftime"` as an in-progress status alongside `"In Progress"` and `"End of Period"`.
- **GamePage live clock** — clock/period text (`Q3 · 5:32`) uses `text-loss` (red `#ff453a`). GameCard clock still uses `text-live/70` (orange). The "Live" badge is `text-live` in both.

## Adding a new endpoint (checklist)
1. `backend/src/routes/myRoute.js` — router + controller delegation only
2. `backend/src/controllers/myController.js` — extract params, call service, handle errors
3. `backend/src/services/myService.js` — SQL query, return data
4. Mount in `backend/src/index.js` under `/api`
5. Test in `backend/__tests__/routes/myRoute.test.js` — mock db with `createMockPool()`

## Testing patterns

### Backend (Jest 29 + Supertest)
- Mock `db/db.js` using `jest.unstable_mockModule()` before importing
- `createMockPool()` returns a mock with `.query.mockResolvedValue({ rows: [...] })`
- Test: success case, DB error case, edge cases, different league params
- See `backend/__tests__/README.md` for full guide

### Frontend (Vitest + Testing Library)
- **Utilities**: pure function tests, no mocking needed (`formatDate`, `slugify`, `normalize`, `computeTopPlayers`)
- **API client**: mock `global.fetch` via `vi.stubGlobal`; stub `import.meta.env.VITE_API_URL` via `vi.stubEnv`
- **API wrappers**: mock `../../api/client.js` via `vi.mock()`, verify correct paths/methods/params
- **Hooks**: mock `AuthContext.jsx` + API modules via `vi.mock()`; use `renderHook` + `waitFor` + `act`; use `vi.useFakeTimers()` for debounce tests (advance with `vi.advanceTimersByTimeAsync`, then drain microtasks with `await act(async () => {})`)
- **Components**: use `renderWithProviders` from `frontend/src/__tests__/helpers/testUtils.jsx` (wraps `BrowserRouter` + mock `AuthContext.Provider`)
- `vi.mock()` for ESM module mocking (no hoisting quirks unlike Jest)
- See `frontend/src/__tests__/` for examples

## CI/CD
- CI (`.github/workflows/deploy.yml`) runs `cd frontend && npm run verify` on every push and PR (lint + test + build — backend deploys independently via Railway)
- Vercel deployment only proceeds after CI passes on `main`
