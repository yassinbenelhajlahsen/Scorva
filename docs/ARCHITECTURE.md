# Scorva — Architecture Details

## Data flow
ESPN API → PostgreSQL → Express backend → React frontend

## Live sync worker (`liveSync.js`)
Two-tier update strategy:
- **Fast path** every 15s: `upsertGameScoreboard` — scoreboard data only
- **Full path** every 2 min or on period change: `processEvent` — fetches boxscore + player stats
- Each write fires `pg_notify('game_updated')` → SSE controllers push immediately to clients
- Sleeps 5 min when no live games
- Deployed as a separate Railway service (`npm run live-sync`)
- `main()` is guarded by `NODE_ENV !== 'test'`; `upsertGameScoreboard` is a named export for unit testing
- Check `res.ok` on ESPN fetch — 5xx returns silently treated as "no games" is a known past bug (fixed)

## Scheduled upsert (`upsert.js`)
- Runs every 30–60 min as a catch-up mechanism — picks up scheduled games, season transitions, data liveSync may have missed
- Wraps each league in try/catch so one failure doesn't abort subsequent leagues
- Both workers use `ON CONFLICT DO UPDATE` so concurrent writes are safe
- Invalidates `games:*` and `standings:*` cache keys per league after batch

## SSE endpoints
- `GET /api/live/:league/games` — pushes game list on each `pg_notify('game_updated')`; sends `event: done` when no live games remain
- `GET /api/live/:league/games/:gameId` — pushes full game detail; sends `event: done` when game is Final
- Mounted **before** `generalLimiter` but **behind** `sseConnectionLimiter` (max 6 concurrent per IP)
- 15s `: ping` heartbeat; `X-Accel-Buffering: no` header for Railway
- Reuse `gamesService`/`gameInfoService` directly in controller (no new service layer)
- Release PG client in catch block if `LISTEN` fails — otherwise connection leaks

## Frontend SSE hooks
- `useLiveGames(league|null)` and `useLiveGame(league, gameId, isLive)` — pass `null` to deactivate without breaking hooks rules
- 3-failure REST fallback
- SSE URL helpers in `frontend/src/api/games.js` use `import.meta.env.VITE_API_URL` directly
- `useLiveGame` integrated into `useGame`; `useLiveGames` integrated into `useHomeGames` (3×) and `useLeagueData`
- `useLiveGames` only active when `selectedSeason === null` — prevents SSE from overwriting filtered season views

## Redis caching
Module: `backend/src/cache/cache.js`
Exports: `cached(key, ttl, queryFn, {cacheIf}?)`, `invalidate(...keys)`, `invalidatePattern(pattern)`, `closeCache()`

Seasons helper: `backend/src/cache/seasons.js` — `getCurrentSeason(league)` (1h TTL, SELECT MAX(season))

**Graceful fallback**: if `REDIS_URL` unset, all ops are no-ops — no behavior change in local dev or tests.

### Cache keys & TTLs
| Key | TTL | Notes |
|---|---|---|
| `gameDetail:{league}:{id}` | 30d | Final only via `cacheIf` |
| `standings:{league}:{season}` | 5m current / 30d past | |
| `playerDetail:{league}:{playerId}:{season}` | 2m current / 30d past | |
| `games:{league}:default:{todayEST}` | 30s | |
| `games:{league}:{season}:team:{teamId}` | 30s/30d | |
| `games:{league}:{season}:all` | 30s/30d | |
| `teams:{league}` | 24h | |
| `players:{league}` | 24h | |
| `seasons:{league}` | 24h | |
| `currentSeason:{league}` | 1h | |

**NOT cached**: favorites, user, search, AI summary, SSE live endpoints.

### Invalidation
- `upsertGame.js` — deletes `gameDetail` + `games:*:default:*` on every write
- `liveSync.js` — deletes today default on scoreboard update; standings on finalize; `closeCache()` on shutdown
- `upsert.js` — `invalidatePattern('games:*')` and `invalidatePattern('standings:*')` per league after batch

`REDIS_URL` must be set on all three Railway services (API, liveSync, upsert).

## Game columns

### `games.type` (VARCHAR 20, DEFAULT 'regular')
Single source of truth for game classification. Values: `regular`, `preseason`, `playoff`, `final`, `makeup`, `other`.
- Derived in `eventProcessor.js` from ESPN `event.season.type` (1=preseason, 2=regular, 3=playoffs) + `isSpecialEventGame()` for `other`
- Set as `$24` in `upsertGame.js`
- `standingsService.js` (1 place) and `playerInfoService.js` (6 places) filter `AND g.type = 'regular'`
- Frontend: `GameCard.jsx` reads `game.type` (snake_case from `gamesService`); `GamePage.jsx` reads `game.gameType` (camelCase from `gameInfoService`)

### `games.game_label` (TEXT, nullable)
Display-only text (e.g. `"NBA Finals - Game 1"`, `"Wild Card Round"`). Never use for classification logic.

### `games.current_period` (Int?) and `games.clock` (String?)
Populated by liveSync and `upsert.js`. Null for scheduled/final games.
`gameInfoService.js` exposes as `currentPeriod` and `clock`. Frontend uses `getPeriodLabel(period, league)` from `formatDate.js` — renders Q1–Q4/OT (NBA/NFL) or P1–P3/OT (NHL).

### `games.start_time` (String?)
Set once at ingest by `eventProcessor.js` from `event.date` (ESPN UTC ISO timestamp → ET string, e.g. `"7:30PM ET"`). Never updated by liveSync.
- `gameInfoService.js` exposes as `startTime` (camelCase); `gamesService` exposes as `start_time` (snake_case via `g.*`)
- Frontend shows only for scheduled games (not live/final)

## Auth & users

### Users table
Stores Supabase auth UUIDs + `email`, `first_name`, `last_name`, `default_league` (nullable).
Populated via Supabase webhook on signup. `favoritesService.ensureUser()` is a safety fallback that upserts on first favorite action.

### Supabase webhook (`POST /api/webhooks/supabase-auth`)
Verified by `Authorization: <SUPABASE_WEBHOOK_SECRET>` header. Inserts new user on signup. Mounted before all rate limiters. Email/password users pass name via `options.data`; Google OAuth users have `full_name` split on first space.

### Account deletion
Two-step: `DELETE /api/user/account` → deletes Supabase auth user first via `supabaseAdmin.auth.admin.deleteUser()` → deletes DB row (cascades favorites). Uses `SUPABASE_SECRET_KEY` (same key as auth middleware).

### Google OAuth detection
Check `user.app_metadata.providers` array includes `"email"` (not single `provider` string).

## AI summaries
- Cache-first, persisted to `games.ai_summary`
- Only generated for finalized games
- Requires auth (`requireAuth` middleware + stricter `aiLimiter`)
- Never return `error.message` to client on failure — return 500 status only

## Prisma
Schema/migrations only — runtime uses `pg` directly.
- Schema: `backend/prisma/schema.prisma`
- Generated client: `backend/src/generated/prisma/` — **do not edit**; run `prisma generate` after schema changes
- Migrations: `backend/prisma/migrations/`
- Local workflow: edit schema → `prisma migrate dev --name <desc>` → `prisma generate`
- Production: `prisma migrate deploy`
- Shadow DB requires `pg_trgm` extension; apply SQL manually + `prisma migrate resolve --applied` if `migrate dev` fails locally

## inProgress detection
Both `GameCard.jsx` and `GamePage.jsx` treat `"Halftime"` as in-progress alongside `"In Progress"` and `"End of Period"`.

## Loading & error UX
- **Loading** → page-specific shimmer skeleton (`frontend/src/components/skeletons/`)
- **Network error** → `<ErrorState onRetry={retry} />` (`frontend/src/components/ui/ErrorState.jsx`)
- **Not found** → dedicated "Not Found" layout with back CTA
- **Hook retry pattern**: all data hooks expose `retry()` — `const [retryCount, setRetryCount] = useState(0)` in deps, `const retry = useCallback(() => setRetryCount(c => c + 1), [])`
