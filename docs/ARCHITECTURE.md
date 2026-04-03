# Scorva — Architecture Details

## Data flow
ESPN API → PostgreSQL → Express backend → React frontend

## Live sync worker (`liveSync.js`)
Two-tier update strategy:
- **Fast path** every 15s: `upsertGameScoreboard` — scoreboard data only
- **Full path** every 2 min or on period change: `processEvent` — fetches boxscore + player stats
- Each write fires `pg_notify('game_updated')` → SSE controllers push immediately to clients
- Sleeps 5 min when no live games
- **Multi-league discovery**: every tick iteration re-checks all leagues and merges any newly-live ones into the active sync set — so a league that goes live after initial discovery is picked up within 15s, not after all other leagues finish
- Deployed as a separate Railway service (`npm run live-sync`)
- `main()` is guarded by `NODE_ENV !== 'test'`; `upsertGameScoreboard` is a named export for unit testing
- Check `res.ok` on ESPN fetch — 5xx returns silently treated as "no games" is a known past bug (fixed)
- **Per-event client**: `tick()` acquires a separate `pool.connect()` per event inside `Promise.all` — `processEvent` runs its own `BEGIN`/`COMMIT`/`ROLLBACK` and sharing one client across concurrent calls corrupts transaction state
- Uses the shared `pool` from `db/db.js` (not its own `new Pool()`)

## Scheduled upsert (`upsert.js`)
- Runs every 30 min as a catch-up mechanism — picks up scheduled games, season transitions, data liveSync may have missed
- Wraps each league in try/catch so one failure doesn't abort subsequent leagues
- Both workers use `ON CONFLICT DO UPDATE` so concurrent writes are safe
- Invalidates `games:*`, `standings:*`, and `gameDates:*` cache keys per league after batch
- `runUpcomingProcessing` fetches 14 days ahead (days 1–14) in batches of 3, deduplicating by ESPN event ID

## SSE endpoints
- `GET /api/live/:league/games` — pushes game list on each `pg_notify('game_updated')`; sends `event: done` when no live games remain
- `GET /api/live/:league/games/:gameId` — pushes full game detail; sends `event: done` when game is Final
- Mounted **before** `generalLimiter` but **behind** `sseConnectionLimiter` (max 6 concurrent per IP)
- 15s `: ping` heartbeat; `X-Accel-Buffering: no` header for Railway
- Reuse `gamesService`/`gameInfoService` directly in controller (no new service layer)
- `send()` error catch calls `cleanup()` + `res.end()` — prevents zombie connections

### Notification bus (`backend/src/db/notificationBus.js`)
Holds a **single** shared PG `LISTEN` connection for all SSE clients, fanning out via an in-process EventEmitter. This prevents N clients each consuming one pool connection.

- `subscribe(callback)` — adds listener; acquires connection on first subscriber
- `unsubscribe(callback)` — removes listener; releases connection when subscriber count reaches 0
- `shutdown()` — UNLISTEN + release; called in SIGTERM handler before `pool.end()`
- Auto-reconnects on PG client error after 1s if subscribers remain (`setTimeout(...).unref()`)
- `shuttingDown` flag reset on `subscribe()` so the bus can restart after shutdown in tests

## Frontend SSE hooks
- `useLiveGames(league|null)` and `useLiveGame(league, gameId, isLive)` — pass `null` to deactivate without breaking hooks rules
- 3-failure REST fallback
- SSE URL helpers in `frontend/src/api/games.js` use `import.meta.env.VITE_API_URL` directly
- `useLiveGame` integrated into `useGame`; `useLiveGames` integrated into `useHomeGames` (3×) and `useLeagueData`
- `useLiveGames` only active when `selectedSeason === null` AND `selectedDate` is null or equals today's ET date — prevents SSE from overwriting filtered season/date views

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
| `gameDates:{league}:{season}` | 5m | All dates + game counts for the season; used by date strip |
| `games:{league}:{season}:date:{date}` | 30s current / 30d past | Date-filtered games for league page |

**NOT cached**: favorites, user, search, AI summary, SSE live endpoints.

### Invalidation
- `upsertGame.js` — deletes `gameDetail` + `games:*:default:*` on every write
- `liveSync.js` — deletes today default on scoreboard update; standings on finalize; `closeCache()` on shutdown
- `upsert.js` — `invalidatePattern('games:*')`, `invalidatePattern('standings:*')`, and `invalidatePattern('gameDates:*')` per league after batch

`REDIS_URL` must be set on all three Railway services (API, liveSync, upsert).

## Date selection (League Page)

Users can filter the league page to a specific date via a scrollable date strip and a calendar popup (`DateNavigation` → `DateStrip` + `CalendarPopup`).

- **Default view** (`selectedDate = null`): existing behaviour — today's slate or nearest date with games.
- **Date pick**: `selectedDate` (YYYY-MM-DD) → `useLeagueData` passes `?date=` to `GET /api/:league/games`. Backend returns `{ games, resolvedDate, resolvedSeason }` instead of a flat array.
- **Nearest-date fallback**: if no games on the requested date, `gamesService` runs a `UNION ALL` of the closest past/future dates and re-queries with the winner. `resolvedDate` is returned so the frontend can sync the strip.
- **Season resolution**: `getSeasonForDate()` (internal to `gamesService.js`) looks up the season from the `games` table for the requested date; falls back to nearest row by `ABS(EXTRACT(EPOCH FROM (date - $2::date)))`, then `getCurrentSeason`.
- **Available dates / counts**: `GET /api/:league/games/dates` (`gameDatesService.js`) returns all `{ date, count }` rows for a season (cached 5 min, `gameDates:{league}:{season}`). `useGameDates` builds a `Map<date, count>` for the strip dot indicators.
- **SSE**: live updates are only active when `selectedDate` is null or equals today's ET date.
- **Season switch**: resets `selectedDate` to null.

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

## ErrorBoundary
`frontend/src/components/ErrorBoundary.jsx` wraps `<AnimatedRoutes />` in `App.jsx`. Catches
render crashes and shows a reload prompt instead of a white screen.

## Google OAuth popup flow
`skipBrowserRedirect: true` suppresses Supabase's default redirect. The auth flow opens in a
popup. `/auth/callback` (AuthCallback page) calls `postMessage` to the opener and closes itself.
The parent modal listens for the message and closes. AuthCallback has no layout shell and is
excluded from AnimatedRoutes.

## Chat system

### Agent loop (`chatAgentService.js`)
`runAgentLoop` drives the multi-turn tool-calling cycle: max 5 tool rounds per request.
`resolveContextEntity` does a DB lookup (slug → `{ id, name }`) before building the system
prompt so the model has entity context without requiring clarification.

Callbacks:
- `onDelta(chunk)` — called for each streaming content token
- `onStatus(label)` — called before each tool execution round; emitted to the client as an SSE
  `status` event showing friendly progress text

### Page context
Frontend sends `{ type, league, playerSlug|teamSlug|gameId }` — slugs, not IDs.
`sanitizePageContext` validates slugs against `/^[a-z0-9-]{1,100}$/`.
Backend resolves slug → `{ id, name }` via `getPlayerIdBySlug` / SQL and injects into the
system prompt.

### Chat DB tables
- `chat_conversations` — `id`, `user_id`, `summary`, `summarized_up_to`, `created_at`
- `chat_messages` — `id`, `conversation_id`, `role`, `content`, `page_context` (JSONB), `created_at`

Cascade delete: removing a `chat_conversations` row removes all its `chat_messages`.

### Chat SSE events (`POST /api/chat`)
| Event | Payload |
|---|---|
| `delta` | Streaming content token |
| `status` | Tool execution progress label |
| `done` | `{ conversationId }` |
| `error` | `{ message }` |

### Cancel flow
Frontend `cancelledRef` is set on abort. All four callbacks (`onDelta`, `onDone`, `onError`,
`onStatus`) check `cancelledRef` before acting. `cancelStream` also removes the trailing
incomplete assistant message from state.
`frontend/src/api/chat.js` enforces a 1 MB SSE buffer cap; disconnects with `onError` if exceeded.

### Conversation summarization
When a conversation exceeds 20 messages, older messages are compressed via `gpt-4o-mini`.
The result is stored in `chat_conversations.summary`; `summarized_up_to` tracks the last
summarized offset to avoid re-processing. The summary is prepended to the system prompt as a
system message each turn.

### RAG / pgvector
`game_embeddings` table stores `text-embedding-3-small` 1536-dim vectors of AI game summaries.
`embeddingService.js` generates, stores, and queries embeddings. `semantic_search` chat tool
performs cosine similarity search (`<=>` operator). Embeddings are generated fire-and-forget
inside `saveSummary()`.

### 13 chat tools
`search`, `get_games`, `get_game_detail`, `get_player_detail`, `get_standings`,
`get_head_to_head`, `get_stat_leaders`, `get_player_comparison`, `get_team_stats`,
`web_search`, `get_seasons`, `get_teams`, `semantic_search`

Defined in `chatToolsService.js`; individual tool logic in `services/chatTools/`.
