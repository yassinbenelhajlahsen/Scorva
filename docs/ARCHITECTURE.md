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

## Historical upsert (`ingestion/pipeline/historicalUpsert.js`)
Re-seeds all historical seasons from ESPN. Supports CLI filtering:
```bash
node src/ingestion/pipeline/historicalUpsert.js              # all leagues, all seasons
node src/ingestion/pipeline/historicalUpsert.js nhl           # all NHL seasons
node src/ingestion/pipeline/historicalUpsert.js nhl 2015-09-15  # single season (use seasonStart date from config)
```
- `processEvent` skips Final games that already have sufficient stat rows (`MIN_STAT_ROWS`: nba=12, nhl=20, nfl=10), so re-runs are safe and only process missing games
- `processEvent` accepts `{ force: true }` to bypass the skip — used by repair scripts to re-process games with corrupted stats

## Stats repair (`ingestion/scripts/repairStats.js`)
Targeted fix for known data issues:
- **NHL goalie NULLs**: goalies in pre-2023 seasons had `g = NULL, a = NULL` instead of 0. Direct SQL fix (`UPDATE stats SET g = 0, a = 0`), no ESPN re-fetch needed
- **NBA blank stat rows**: ESPN re-fetch with `force: true` for games with blank stat rows (`points=0, fg='0-0', minutes IS NULL`). Note: ESPN returns the same blank data for true DNPs — these rows are correct, not corrupted
- **Low stat count games**: ESPN re-fetch for games with fewer stats rows than expected
```bash
node src/ingestion/scripts/repairStats.js --dry-run   # audit only
node src/ingestion/scripts/repairStats.js nhl null     # fix goalie nulls (instant)
node src/ingestion/scripts/repairStats.js nba blank    # fix blank NBA stats
node src/ingestion/scripts/repairStats.js              # fix everything
```

## DNP (Did Not Play) filtering
ESPN creates stat rows for players who dressed but didn't play (all-zero stats). Per-game averages must exclude these rows. The filter is league-specific:

| League | DNP filter | Why |
|--------|-----------|-----|
| NBA | `s.minutes > 0` | DNPs have `minutes IS NULL`, all other stats = 0 |
| NHL | `s.toi IS NOT NULL AND s.toi != '0:00'` | DNPs have `toi = '0:00'` |
| NFL | `NOT (s.yds IS NULL AND s.td IS NULL AND s.sacks IS NULL AND s.interceptions IS NULL AND s.cmpatt IS NULL)` | Only exclude rows where ALL stat columns are NULL — defensive players legitimately have NULL `yds`/`td` but populated `sacks`/`interceptions` |

Applied in: `playerDetailService.js` (stats JOIN), `playerComparison.js`, `teamStats.js`, `statLeaders.js` (WHERE clause).

## Scheduled upsert (`ingestion/upsert.js`)
- Runs every 30 min as a catch-up mechanism — picks up scheduled games, season transitions, data liveSync may have missed
- Wraps each league in try/catch so one failure doesn't abort subsequent leagues
- Both workers use `ON CONFLICT DO UPDATE` so concurrent writes are safe
- For NBA and NHL: calls `cleanupClinchedPlayoffGames(pool, league)` inside isolated try/catch — deletes `status='Scheduled'` playoff games whose series already clinched (one team has ≥ 4 wins; both leagues are best-of-7)
- Invalidates `games:*`, `standings:*`, and `gameDates:*` cache keys per league after batch; also invalidates `playoffs:nba:*` / `playoffs:nhl:*` per league
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

**Favorites overlay panel**
Favorites are displayed in a slide-in overlay panel (`FavoritesPanelContext` + `FavoritesPanel`) instead of inline on the Homepage. The panel is triggered by a star icon in the Navbar (visible when logged in) and is accessible from any page. It follows the same context + `AnimatePresence` pattern as the settings drawer and chat panel. `FavoritePlayersSection` and `FavoriteTeamsSection` accept a `compact` prop for the narrow panel layout — compact mode shows inline stat/game rows (limited to 2 per item) instead of full `StatCard`/`GameCard` components. Compact player stat rows link to `?tab=analysis#playerSlug` to scroll to the player in the box score. The panel auto-closes on route change, and mutually excludes with the settings drawer and chat panel (opening one closes the others). Z-index: backdrop `z-[69]`, panel `z-[70]`.

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
| `StatCard` | `game` |
| `Navbar` home link | `homeGames` |
| `Navbar` league links | `leagueGames` + `gameDates` |
| Homepage "View All" button | `leagueGames` + `gameDates` |
| `LeaguePage` standings rows | `team` |
| `TopPerformerCard` | `player` |
| `SimilarPlayersCard` items | `player` |
| `SearchBar` result items | `game` / `player` / `team` by result type |
| `FavoriteTeamsSection` team link | `team` |
| `FavoritePlayersSection` player link | `player` |
| `GameMatchupHeader` team names | `team` (home + away) |
| `BoxScore` player names | `player` |
| `PlayerPage` team link | `team` |

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

### Cache versioning
All keys are automatically prefixed with `v{CACHE_VERSION}:` inside the cache module — callers don't include the prefix. When the shape of cached data changes in a way that would make existing entries invalid (e.g., adding/removing fields from a service response), bump `CACHE_VERSION` in `cache.js` before deploying. Old keys become orphaned and expire naturally via their TTL; no manual flush needed.

**When to bump**: rename/remove fields in a cached service response, change the structure of cached objects, or alter SQL queries that feed cached endpoints. **Don't bump** for new endpoints, TTL changes, or adding fields the frontend ignores. When modifying a service that has a `cached()` call, always check whether the response shape changed and bump `CACHE_VERSION` if so.

Seasons helper: `backend/src/cache/seasons.js` — `getCurrentSeason(league)` (1h TTL, SELECT MAX(season))

**Graceful fallback**: if `REDIS_URL` unset, all ops are no-ops — no behavior change in local dev or tests.

### Cache keys & TTLs
| Key | TTL | Notes |
|---|---|---|
| `gameDetail:{league}:{id}` | 30d | Final only via `cacheIf` |
| `standings:{league}:{season}` | 5m current / 30d past | Sorted by win% with tiebreakers |
| `h2h-games:{league}:{season}` | 5m current / 30d past | Regular-season games for tiebreaker matrix |
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
| `news:headlines` | 5m | Merged ESPN news across all leagues; `cacheIf` non-empty |
| `playoffs:{league}:{season}` | 30s current / 30d past | NBA and NHL bracket derivation |
| `plays:{league}:{gameId}` | 30d | Final games only (stored plays) |
| `winprob:{league}:{eventId}` | 30s live / 30d final | ESPN win probability proxy; `cacheIf` non-null |
| `similarPlayers:{league}:{playerId}:{season}` | 120s current / 30d past | Player similarity vectors |
| `prediction:{league}:{gameId}` | 1h | Pre-game predictions |
| `h2h:{league}:{type}:{id1}:{id2}` | 30d | Head-to-head games (IDs sorted for consistency) |

**NOT cached**: favorites, user, search, AI summary, SSE live endpoints.

### Invalidation
- `upsertGame.js` — deletes `gameDetail` + `games:*:default:*` on every write
- `liveSync.js` — deletes today default on scoreboard update; standings on finalize; also `playoffs:nba:*` (NBA) / `playoffs:nhl:*` (NHL) when games in that league finalize; `closeCache()` on shutdown
- `upsert.js` — `invalidatePattern('games:*')`, `invalidatePattern('standings:*')`, and `invalidatePattern('gameDates:*')` per league after batch; also invalidates `playoffs:nba:*` or `playoffs:nhl:*` per league

`REDIS_URL` must be set on all three Railway services (API, liveSync, upsert).

## News headlines

ESPN news articles fetched on demand (no DB table, no ingestion job).

**Data flow**: ESPN `/news` endpoints (3 leagues) → `newsService.js` → Redis cache (5 min) → `GET /api/news` → frontend `useNews()` hook → `NewsSection` on Homepage.

- `newsService.js` fetches all 3 leagues in parallel via `Promise.allSettled` (one league failing doesn't break the others), filters out roundup/tracker articles via `ROUNDUP_PATTERNS` regex list, sorts by `published` descending, guarantees at least 1 article per league in top results
- ESPN URLs: `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/news?limit=12`
- Article shape: `{ headline, description, url, imageUrl, published, league }`
- Frontend: `NewsSection` renders 4 cards in a responsive grid; returns `null` on error (non-critical, never breaks the page); clicking a card opens `NewsPreviewModal` with article details and external link
- Route mounted before auth-gated routes (`favoritesRoute`, `userRoute`) in `index.js` to avoid `router.use(requireAuth)` interception

## Season URL persistence

Selected season is stored in `?season=XXXX-XX` URL search params. No param = current (max) season. This makes browser back/forward preserve the selected season and lets users share deep links to historical seasons.

### Hook: `useSeasonParam(seasons, currentSeason?)` (`hooks/useSeasonParam.js`)
- `seasons`: league-wide season list from `useSeasons(league)` — used to detect which value is the current season. **Never pass entity-specific `availableSeasons` here** — a player whose most recent DB season is historical would cause incorrect param removal.
- `currentSeason`: explicit override for the current season (e.g. `leagueSeasons[0]`). Used on TeamPage/PlayerPage where entity `availableSeasons` are passed to `SeasonSelector` but league-wide max must govern cleanup.
- Returns `[selectedSeason, setSelectedSeason]` (same API as `useState`).
- Setter uses `setSearchParams({ replace: true })` — no extra history entries per season change.
- If the selected season equals the current season, the param is removed from the URL (redundant).
- Cleanup effect: when `seasons` loads and the URL param equals the current season, removes it automatically.

### Utility: `buildSeasonUrl(path, season)` (`utils/buildSeasonUrl.js`)
Returns `path?season=XXXX-XX` if `season` is set, otherwise `path`. Used in all `<Link to=…>` expressions.

### Page wiring
| Page | seasons arg | currentSeason arg |
|---|---|---|
| `LeaguePage` | `useSeasons(league).seasons` | — (defaults to `seasons[0]`) |
| `TeamPage` | `availableSeasons` (for selector display) | `leagueSeasons[0]` |
| `PlayerPage` | `availableSeasons` (for selector display) | `leagueSeasons[0]` |
| `ComparePage` | — (uses plain `useState` per entity) | — |

### GamePage / TopPerformerCard
GamePage doesn't have a season selector — `game.season` is passed down through `OverviewTab` as a `season` prop to `TopPerformerCard`. `TopPerformerCard` prefers this prop over the URL param so clicks from historical games route to the correct season.

### Links that carry `?season=`
All `<Link>` components in LeaguePage, TeamPage, PlayerPage, ComparePage hero sections, SimilarPlayersCard, and TopPerformerCard use `buildSeasonUrl`. Favorites panel and Navbar links deliberately omit the param (default to current season on arrival).

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
- Derived in `ingestion/eventProcessor.js` from ESPN `event.season.type` (1=preseason, 2=regular, 3=playoffs) + `isSpecialEventGame()` for `other`; NBA Cup Championship game (regular-season type, `game_label` contains "nba cup" but NOT "group play"/"quarterfinal"/"semifinal") is also classified as `'other'` — Cup group play / QF / SF stay `'regular'` and count toward standings
- Set as `$24` in `ingestion/upsertGame.js`
- All regular-season queries filter `AND g.type IN ('regular', 'makeup')` — `makeup` games are rescheduled regular-season games (e.g. postponed due to weather) and must be included in standings, player stats, predictions, and chat tools
- Frontend: `GameCard.jsx` reads `game.type` (snake_case from `gamesService`); `GamePage.jsx` reads `game.gameType` (camelCase from `gameDetailService`)

### `stats.teamid` (INT?, FK → teams)
Records which team a player was on **at the time of the game** — set at ingest by `upsertStat.js` from `teamIdForPlayer` (already derived in `eventProcessor.js` by comparing the ESPN boxscore player-group's team ID against the home competitor).
- Nullable — ~2,000 games have no `eventid` and cannot be backfilled; `COALESCE(s.teamid, p.teamid)` in queries falls back to the player's current team for those rows
- `gameDetailService.js`: all 6 player subqueries use `COALESCE(s.teamid, p.teamid) = g.hometeamid/awayteamid` to correctly place traded players in historical box scores
- `playerDetailService.js`: LATERAL subquery finds the player's most recent team for the selected season (`ORDER BY g.date DESC LIMIT 1`) and falls back to `p.teamid`; game-log CASE expressions (opponent, isHome, result) also use `COALESCE(s2.teamid, p.teamid)`
- Backfill: `ingestion/backfillStatsTeamid.js` — fetches ESPN boxscores for all games with NULL `stats.teamid` and `eventid IS NOT NULL`, then updates rows in place. Run once after migration.

### `teams.division` (VARCHAR, nullable)
Seeded per league per ESPN team ID by migration `20260415000001_seed_conf_division`. Used by `nhlPlayoffsService.js` to build divisional brackets and by `tiebreaker.js` to compute the NBA/NFL division-leader bonus. If not populated for a team, NHL playoff derivation falls back to a "division_data_missing" warning and NBA tiebreaker skips the bonus silently.

### `games.game_label` (TEXT, nullable)
Display-only text (e.g. `"NBA Finals - Game 1"`, `"Wild Card Round"`). Never use for classification logic.

### `games.current_period` (Int?) and `games.clock` (String?)
Populated by liveSync and `upsert.js`. Null for scheduled/final games.
`gameDetailService.js` exposes as `currentPeriod` and `clock`. Frontend uses `getPeriodLabel(period, league)` from `formatDate.js` — renders Q1–Q4/OT (NBA/NFL) or P1–P3/OT (NHL).

### `games.start_time` (String?)
Set once at ingest by `eventProcessor.js` from `event.date` (ESPN UTC ISO timestamp → ET string, e.g. `"7:30PM ET"`). Never updated by liveSync.
- `gameDetailService.js` exposes as `startTime` (camelCase); `gamesService` exposes as `start_time` (snake_case via `g.*`)
- Frontend shows only for scheduled games (not live/final)

## Playoffs bracket (NBA + NHL)

Compute-on-read derivation — no dedicated schema, builds bracket from `games WHERE type IN ('playoff', 'final')` + standings.

Shared helpers live in `services/standings/_playoffsCommon.js`: `isFinalStatus`, `pairKey`, `buildSeries`, `makeTeamInfo`, `projectedTeamInfo`, `serializeSeries`, `emptySeries`, `emptyConfBlock`, `padConfBlock`, `clearDownstream`.

### NBA

Service: `services/standings/playoffsService.js`.

#### Play-in classification
Seed-based: both teams must be seeds 7–10 in the same conference. Seeds are computed once from standings via `computeStandingsSeeds(teamsById)` and shared with the seed-inference fallback in `derivePlayoffs`.

#### ESPN placeholder teams
ESPN creates placeholder teams (e.g. "Suns/Trail Blazers") for undecided play-in slots. These have `conf IS NULL`:
- **Backend**: `makeTeamInfo` returns null (TBD slot); `buildSeries` inherits conference from the known opponent so the series isn't dropped. `searchService` and `teamsService` filter `conf IS NOT NULL` to exclude placeholders from user-facing queries.
- **Frontend**: GameCard/GamePage sanitize team names containing "/" to "TBD"; GameMatchupHeader renders TBD as non-clickable text with an empty spacer instead of a logo.

#### Projected mode
When no playoff games exist, or a conference has no R1 games yet, `buildProjectedConference` fills slots from standings (seeds 1–8 for R1, 9–10 for play-in). Play-in block is shown when actual play-in games are incomplete, R1 hasn't started, or any R1 series has a TBD opponent.

### NHL

Service: `services/standings/nhlPlayoffsService.js`. No play-in — 8 teams per conference advance directly to R1.

#### Divisional format
Each conference has 2 divisions. Seeds are derived by `buildConfCanonical`:
- Top 3 teams per division → slots A1/A2/A3 (better division) and B1/B2/B3
- Best 2 remaining teams (regardless of division) → WC1/WC2
- "Better division" = the division whose leader ranks higher after `sortWithTiebreakers`
- Seed numbers: A1=1, B1=2, A2=3, A3=4, B2=5, B3=6, WC1=7, WC2=8

Canonical R1 slot order: **A1–WC2, A2–A3, B2–B3, B1–WC1**

Round labels: First Round → Second Round → Conf. Finals → **Stanley Cup Final**

#### Cross-slot R1 matching
`matchR1ToSlots` maps each actual R1 series to one of the 4 canonical slots. When a series spans two canonical slots (mid-playoff team shuffle), it picks the slot of the better-seeded team.

#### Unsupported seasons
Returns `{ season, unsupported: true }` for seasons before 2013-14 (pre-realignment) and 2019-20 (bubble — no divisional bracket). Frontend renders a "not available" message instead of an empty bracket.

#### Division-missing guard
If any team has a `conf` but no `division` value, `getNhlPlayoffs` logs a warning and returns an empty projected bracket with `warning: "division_data_missing"`. Prevents the service from silently producing a wrong bracket when `teams.division` hasn't been seeded for a new team.

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
- **Transport**: `application/x-ndjson` — one JSON object per line
- **Cached path**: single `{"type":"full","summary":"...","cached":true}` line; no streaming
- **Live generation**: streams `{"type":"bullet","text":"..."}` as each of the 3 bullets completes, then `{"type":"done"}`; summary saved to DB after streaming finishes
- **Error handling**: errors before streaming starts → HTTP 500 JSON; errors mid-stream → `{"type":"error","message":"..."}` NDJSON line
- Frontend: `useAISummary` hook manages `{ bullets[], loading, error, cached }` state; `AISummary` component renders skeleton slots that swap in with Framer Motion animation as each bullet arrives

### Play-by-play context in summaries
`aiSummaryService.js` fetches plays via `getClutchPlays(gameId, league)` in parallel with stats and injects two fields into `gameData`:

- **`clutchPlays`**: all plays from the last 5 minutes of the final regulation period (Q4 for NBA/NFL, P3 for NHL) plus all overtime plays. Capped at 20 (the most recent). Shape: `{ clock, period, description, score, scoringPlay }`.
- **`gameWinningPlay`**: the last scoring play of the entire game (highest sequence with `scoring_play = true`), surfaced as a distinct field so the LLM can't miss it.

Both fields are omitted entirely for blowout games (garbage time). `getClutchPlays` returns from the plays Redis cache (30-day TTL for final games) — no extra DB round trip.

Clock parsing handles two ESPN formats: `"5:32"` (M:SS, most plays) and `"5.4"` (sub-minute seconds-only, used when under 1 minute remaining). The prompt instructs the LLM to describe the `gameWinningPlay` by player name in one bullet.

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

### 14 chat tools
`search`, `get_games`, `get_game_detail`, `get_player_detail`, `get_standings`,
`get_head_to_head`, `get_stat_leaders`, `get_player_comparison`, `get_team_stats`,
`web_search`, `get_seasons`, `get_teams`, `semantic_search`, `get_plays`

OpenAI function schemas defined in `chat/toolDefinitions.js`; execution dispatch in `chat/toolsService.js`; individual tool logic in `services/chat/tools/`.

### `get_plays` tool
Queries the `plays` table directly — no embeddings. Handles both single-game and cross-game queries via a single parameterized SQL query. Optional filters: `gameId`, `playerName` (ILIKE on description), `teamId`, `period`, `scoringOnly`, `playType` (ILIKE), `searchText` (ILIKE on description). Season auto-resolved by `executeTool`. Default limit 30, hard cap 50.

- Single-game (`gameId` provided): omits `game_id`/`game_date`/`matchup` from result rows (redundant); skips `status ILIKE 'Final%'` filter so live games work.
- Cross-game: only searches Final games; includes `matchup` and `game_date` per row so the LLM can attribute plays to specific games.
- NFL: conditionally adds `drive_number`, `drive_description`, `drive_result` columns to SELECT and result shape.
- Returns `{ plays, total, capped }` so the LLM knows if results were truncated.
