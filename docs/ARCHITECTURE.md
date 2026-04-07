# Scorva — Architecture Details

## Data flow
ESPN API → PostgreSQL → Express backend → React frontend

## Ingestion pipeline modules

`eventProcessor.js` orchestrates a single ESPN event into Postgres and is the entry point for all other ingestion code. Its helpers are split across:

| Module | Responsibility |
|---|---|
| `espnAPIClient.js` | `getSportPath`, `withRetry`, `getEventsByDate`, `getTodayEvents` — pure ESPN fetch utilities, no state |
| `playerCacheManager.js` | Three-tier player cache (memory → DB → ESPN API), run statistics (`runStats`), `clearPlayerCache`, `getPlayerCacheStats` |
| `eventProcessor.js` | `processEvent` (transaction + upserts), `runDateRangeProcessing`, `runTodayProcessing`, `runUpcomingProcessing` |

`gameDetailService.js` delegates all SQL construction to `gameDetailQueryBuilder.js`, which holds `buildGameDetailSQL(league)` and the per-league stat column definitions. The three named exports (`getNbaGame`, `getNflGame`, `getNhlGame`) are preserved for backwards compatibility.

## Live sync worker (`ingestion/liveSync.js`)
Two-tier update strategy:
- **Fast path** every 15s: `upsertGameScoreboard` (scoreboard data) + plays-only fetch from ESPN `/summary` endpoint
- **Full path** every 2 min or on period change: `processEvent` — fetches boxscore + player stats + plays in one transaction
- Fast-path plays fetch uses the `/summary` endpoint (not `/playbyplay`) because ESPN's `/playbyplay` returns 0 plays for live NHL games
- Each scoreboard write fires `pg_notify('game_updated')`; a second `pg_notify` fires after plays are written so the frontend fetches fresh play data (not stale pre-write data)
- On `processEvent` failure: `lastFullUpdate` is set to `now` so the next tick falls into the fast path (plays still update via the plays-only fetch). Without this, failures cause an infinite full-update retry loop that starves the plays pipeline — scores update but plays never do
- Sleeps 5 min when no live games
- **Multi-league discovery**: every tick iteration re-checks all leagues and merges any newly-live ones into the active sync set — so a league that goes live after initial discovery is picked up within 15s, not after all other leagues finish
- Deployed as a separate Railway service (`npm run live-sync`)
- `main()` is guarded by `NODE_ENV !== 'test'`; `upsertGameScoreboard` is a named export for unit testing
- Check `res.ok` on ESPN fetch — 5xx returns silently treated as "no games" is a known past bug (fixed)
- **Per-event client**: `tick()` acquires a separate `pool.connect()` per event inside `Promise.all` — `processEvent` runs its own `BEGIN`/`COMMIT`/`ROLLBACK` and sharing one client across concurrent calls corrupts transaction state
- Uses the shared `pool` from `db/db.js` (not its own `new Pool()`)

## Scheduled upsert (`ingestion/upsert.js`)
- Runs every 30 min as a catch-up mechanism — picks up scheduled games, season transitions, data liveSync may have missed
- Wraps each league in try/catch so one failure doesn't abort subsequent leagues
- Both workers use `ON CONFLICT DO UPDATE` so concurrent writes are safe
- Invalidates `games:*`, `standings:*`, and `gameDates:*` cache keys per league after batch
- `runUpcomingProcessing` fetches 14 days ahead (days 1–14) in batches of 3, deduplicating by ESPN event ID
- After the league loop, calls `refreshPopularity(pool)` — single UPDATE that counts `stats` rows per player and writes to `players.popularity`

## SSE endpoints
- `GET /api/live/:league/games` — pushes game list on each `pg_notify('game_updated')`; sends `event: done` when no live games remain
- `GET /api/live/:league/games/:gameId` — pushes full game detail; sends `event: done` when game is Final
- Mounted **before** `generalLimiter` but **behind** `sseConnectionLimiter` (max 6 concurrent per IP)
- 15s `: ping` heartbeat; `X-Accel-Buffering: no` header for Railway
- Reuse `gamesService`/`gameDetailService` directly in controller (no new service layer)
- `send()` error catch calls `cleanup()` + `res.end()` — prevents zombie connections

### Notification bus (`backend/src/db/notificationBus.js`)
Holds a **single** shared PG `LISTEN` connection for all SSE clients, fanning out via an in-process EventEmitter. This prevents N clients each consuming one pool connection.

- `subscribe(callback)` — adds listener; acquires connection on first subscriber
- `unsubscribe(callback)` — removes listener; releases connection when subscriber count reaches 0
- `shutdown()` — UNLISTEN + release; called in SIGTERM handler before `pool.end()`
- Auto-reconnects on PG client error after 1s if subscribers remain (`setTimeout(...).unref()`)
- `shuttingDown` flag reset on `subscribe()` so the bus can restart after shutdown in tests

## TanStack Query (client-side data fetching)

All data, user, and AI hooks use `@tanstack/react-query` v5.

**Setup**
- `QueryClient` configured in `frontend/src/lib/queryClient.js` — defaults: `staleTime: 2min`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`
- `QueryClientProvider` wraps the entire app in `App.jsx`; `ReactQueryDevtools` mounted in DEV mode only
- Centralized key factory in `frontend/src/lib/query.js` — `queryKeys.game(league, gameId)`, `queryKeys.plays(...)`, etc.
- `useDebouncedValue(value, delay)` also lives in `lib/query.js` — initializes to `""` so TQ never fires on mount

**SSE-driven plays refresh**
`useGame` receives SSE updates via `useLiveGame`. When `liveData` arrives it:
1. Writes the new game data into the cache: `queryClient.setQueryData(queryKeys.game(...), liveData)`
2. Invalidates the plays query: `queryClient.invalidateQueries({ queryKey: queryKeys.plays(...) })`

`usePlays` sets `staleTime: 0` and never self-polls — all live refreshes are triggered by `useGame` via invalidation.

**Optimistic favorites toggle**
`useFavoriteToggle` uses `useMutation` with:
- `onMutate` — cancels in-flight check query, optimistically flips `isFavorited` in cache, returns `{ previous }` as context
- `onError` — rolls back cache to `context.previous`
- `onSettled` — invalidates the full favorites list

**Hover prefetch**
`frontend/src/lib/query.js` exports a `queryFns` object alongside `queryKeys`. Each entry is a factory that returns the same fetch function (including any response transforms) used by the corresponding hook — ensuring the cached data shape is identical to what the hook expects.

Components call `queryClient.prefetchQuery()` on `mouseenter` with `staleTime: 10_000` (skips re-fetch if data is already < 10s old):

| Component | Prefetches |
|---|---|
| `GameCard` | `game` — on existing hover handler |
| `Navbar` league links | `leagueGames` + `gameDates` |
| Homepage "View All" button | `leagueGames` + `gameDates` |
| `LeaguePage` standings rows | `team` |
| `TopPerformerCard` | `player` |
| `SimilarPlayersCard` items | `player` |
| `SearchBar` result items | `game` / `player` / `team` by result type |

`useGame` has `staleTime: 0` — prefetched data serves immediately on navigation while a background refetch runs in parallel. All other hooks use the global 2 min staleTime, so prefetched data stays hot for any click within that window.

**Build**
`@tanstack/*` packages are split into their own `react-query` chunk via `manualChunks` in `vite.config.js`.

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
- **Available dates / counts**: `GET /api/:league/games/dates` (`gamesService.js::getGameDates`) returns all `{ date, count }` rows for a season (cached 5 min, `gameDates:{league}:{season}`). `useGameDates` builds a `Map<date, count>` for the strip dot indicators.
- **SSE**: live updates are only active when `selectedDate` is null or equals today's ET date.
- **Season switch**: resets `selectedDate` to null.

## Game columns

### `games.type` (VARCHAR 20, DEFAULT 'regular')
Single source of truth for game classification. Values: `regular`, `preseason`, `playoff`, `final`, `makeup`, `other`.
- Derived in `ingestion/eventProcessor.js` from ESPN `event.season.type` (1=preseason, 2=regular, 3=playoffs) + `isSpecialEventGame()` for `other`
- Set as `$24` in `ingestion/upsertGame.js`
- `standingsService.js` (1 place) and `playerDetailService.js` (6 places) filter `AND g.type = 'regular'`
- Frontend: `GameCard.jsx` reads `game.type` (snake_case from `gamesService`); `GamePage.jsx` reads `game.gameType` (camelCase from `gameDetailService`)

### `stats.teamid` (INT?, FK → teams)
Records which team a player was on **at the time of the game** — set at ingest by `upsertStat.js` from `teamIdForPlayer` (already derived in `eventProcessor.js` by comparing the ESPN boxscore player-group's team ID against the home competitor).
- Nullable — ~2,000 games have no `eventid` and cannot be backfilled; `COALESCE(s.teamid, p.teamid)` in queries falls back to the player's current team for those rows
- `gameDetailService.js`: all 6 player subqueries use `COALESCE(s.teamid, p.teamid) = g.hometeamid/awayteamid` to correctly place traded players in historical box scores
- `playerDetailService.js`: LATERAL subquery finds the player's most recent team for the selected season (`ORDER BY g.date DESC LIMIT 1`) and falls back to `p.teamid`; game-log CASE expressions (opponent, isHome, result) also use `COALESCE(s2.teamid, p.teamid)`
- Backfill: `ingestion/backfillStatsTeamid.js` — fetches ESPN boxscores for all games with NULL `stats.teamid` and `eventid IS NOT NULL`, then updates rows in place. Run once after migration.

### `games.game_label` (TEXT, nullable)
Display-only text (e.g. `"NBA Finals - Game 1"`, `"Wild Card Round"`). Never use for classification logic.

### `games.current_period` (Int?) and `games.clock` (String?)
Populated by liveSync and `upsert.js`. Null for scheduled/final games.
`gameDetailService.js` exposes as `currentPeriod` and `clock`. Frontend uses `getPeriodLabel(period, league)` from `formatDate.js` — renders Q1–Q4/OT (NBA/NFL) or P1–P3/OT (NHL).

### `games.start_time` (String?)
Set once at ingest by `eventProcessor.js` from `event.date` (ESPN UTC ISO timestamp → ET string, e.g. `"7:30PM ET"`). Never updated by liveSync.
- `gameDetailService.js` exposes as `startTime` (camelCase); `gamesService` exposes as `start_time` (snake_case via `g.*`)
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

## Search (`services/searchService.js`)

Two-phase search across players, teams, and games:

**Phase 1 — ILIKE substring match** (fires first):
- Four `UNION ALL` branches in `raw_results` CTE: players by name, players by alias, teams, games
- `player_aliases` branch: `pa.alias ILIKE $1` joined to `players` — enables nickname search ("King James", "Chef Curry", "Greek Freak")
- `DISTINCT ON (type, id)` deduplication CTE prevents a player appearing twice when both their name and an alias match the query
- `ORDER BY`: match quality (exact=0 / prefix=1 / substring=2) → entity type (team > player > game) → `COALESCE(popularity, 0) DESC` → trigram `similarity()` → date → alpha
- Capped at 15 results

**Phase 2 — Fuzzy fallback** (fires only when phase 1 returns 0 rows):
- Same four branches using `similarity(...) > 0.3`
- Ordered by `similarity()` DESC then `popularity` DESC

**Popularity (`players.popularity`)**:
- INT column, default 0; updated by `refreshPopularity(pool)` after every upsert run
- Derived as `COUNT(*) FROM stats GROUP BY playerid` — games played is a reliable proxy for prominence
- `upsertPlayer.js` ON CONFLICT preserves the column (`popularity = players.popularity`) so ingestion never resets scores

**Aliases (`player_aliases` table)**:
- `(player_id, alias)` unique; GIN trigram index on `alias`
- Seeded from `backend/prisma/seeds/player_aliases.json` (keyed by `espn_playerid + league`) via `backend/prisma/seeds/seedAliases.js`
- Run `node backend/prisma/seeds/seedAliases.js` after applying migration; idempotent via `ON CONFLICT DO NOTHING`

## inProgress detection
Both `GameCard.jsx` and `GamePage.jsx` treat `"Halftime"` as in-progress alongside `"In Progress"` and `"End of Period"`.

## Loading & error UX
- **Loading** → page-specific shimmer skeleton (`frontend/src/components/skeletons/`)
- **Network error** → `<ErrorState onRetry={retry} />` (`frontend/src/components/ui/ErrorState.jsx`)
- **Not found** → dedicated "Not Found" layout with back CTA
- **Hook retry pattern**: all data hooks expose `retry()` — `const retry = useCallback(() => refetch(), [refetch])` wrapping TanStack Query's `refetch`

## ErrorBoundary
`frontend/src/components/ErrorBoundary.jsx` wraps `<AnimatedRoutes />` in `App.jsx`. Catches
render crashes and shows a reload prompt instead of a white screen.

## Google OAuth popup flow
`skipBrowserRedirect: true` suppresses Supabase's default redirect. The auth flow opens in a
popup. `/auth/callback` (AuthCallback page) calls `postMessage` to the opener and closes itself.
The parent modal listens for the message and closes. AuthCallback has no layout shell and is
excluded from AnimatedRoutes.

## Chat system

### Agent loop (`chat/agentService.js`)
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

### Player Similarity Engine
`player_stat_embeddings` table stores per-player per-season stat vectors using pgvector (`vector(14)`).
Vectors are built from z-score normalized season averages — no OpenAI calls, pure numeric stats.

**Stat dimensions per league:**
- NBA (10): points, assists, rebounds, blocks, steals, fg%, 3pt%, ft%, turnovers, plusminus
- NFL (5): comp%, yards, td, interceptions, sacks — zero-padded to 14
- NHL (14): g, a, saves, savepct, ga, shots, sm, bs, pn, pim, ht, tk, gv, plusminus

All vectors are stored as `vector(14)` (NHL max); NBA and NFL are zero-padded. Queries always filter by league so cross-league comparison never occurs.

**Computation:** `computePlayerEmbeddings.js` runs after `refreshPopularity()` in `upsert.js` each daily cycle. Can also be run standalone: `node backend/src/ingestion/computePlayerEmbeddings.js`. Min games threshold: NBA/NHL 5, NFL 2.

**Similarity query:** `ORDER BY embedding <=> target_embedding` with HNSW index. NFL and NHL results are position-filtered (QB vs QB, goalie vs goalie, etc.) — position groups defined in `computePlayerEmbeddings.js` and reused by `similarPlayersService.js`.

**Cache:** `similarPlayers:{league}:{playerId}:{season}` — 120s current season, 30 days past. Invalidated on each upsert cycle.

### 13 chat tools
`search`, `get_games`, `get_game_detail`, `get_player_detail`, `get_standings`,
`get_head_to_head`, `get_stat_leaders`, `get_player_comparison`, `get_team_stats`,
`web_search`, `get_seasons`, `get_teams`, `semantic_search`

OpenAI function schemas defined in `chat/toolDefinitions.js`; execution dispatch in `chat/toolsService.js`; individual tool logic in `services/chat/tools/`.
