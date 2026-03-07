# Redis Caching Implementation Plan

## Overview

Add a Redis caching layer between Express controllers and PostgreSQL to reduce DB load and improve response times. The strategy is **tiered by data volatility** — immutable historical data gets long/infinite TTLs, current-season data gets short TTLs, and some routes are deliberately left uncached.

---

## Tier 1: Cache Forever (Immutable Data) — Highest Impact

These queries return data that **never changes** once finalized. Cache indefinitely (TTL 30 days as a safety net).

### 1a. `gameInfoService` — Finalized game detail (`getNbaGame`, `getNflGame`, `getNhlGame`)
- **Why:** Most complex query in the system — nested JSON aggregation with subqueries for both teams' player stats. Called on every game page load.
- **Key:** `gameDetail:{league}:{gameId}`
- **Condition:** Only cache when `status ILIKE 'Final%'`
- **TTL:** 30 days
- **Invalidation:** `upsert.js` deletes key if it re-processes a finalized game (rare edge case)

### 1b. `standingsService` — Past season standings (`getStandings`)
- **Why:** JOIN + COUNT + FILTER aggregation across all games in a season. Computed on the fly but result is immutable for completed seasons.
- **Key:** `standings:{league}:{season}`
- **Condition:** Only long-cache when `season < currentSeason` (determined by `seasonsService.getSeasons`)
- **TTL:** 30 days for past seasons, 5 minutes for current season
- **Invalidation:** None needed for past seasons

### 1c. `playerInfoService` — Past season player detail (`getNbaPlayer`, `getNflPlayer`, `getNhlPlayer`)
- **Why:** Second most expensive query — season averages (AVG aggregation), 12 most recent games with nested subqueries. Immutable once season ends.
- **Key:** `playerDetail:{league}:{playerId}:{season}`
- **Condition:** Only long-cache for past seasons
- **TTL:** 30 days for past seasons, 2 minutes for current season
- **Invalidation:** None for past seasons

### 1d. `gamesService` — Past season game lists (`getGames`)
- **Why:** Called on homepage, league page, team page. 2 JOINs for team logos. Most frequently hit endpoint.
- **Key:** `games:{league}:{season}:{teamId|'all'}`
- **Condition:** Long-cache for past seasons only
- **TTL:** 30 days for past seasons, 30 seconds for current season
- **Invalidation:** None for past seasons

---

## Tier 2: Cache with Short TTL (Slowly Changing Data) — Medium Impact

These queries return data that changes infrequently. Short TTLs reduce DB load without serving stale data.

### 2a. `teamsService` — Team list (`getTeamsByLeague`)
- **Why:** Simple query but called on many pages. Data only changes between seasons.
- **Key:** `teams:{league}`
- **TTL:** 24 hours
- **Invalidation:** `upsert.js` can delete on team data changes

### 2b. `playersService` — Player list (`getPlayersByLeague`)
- **Why:** Simple query, static within a season.
- **Key:** `players:{league}`
- **TTL:** 24 hours
- **Invalidation:** Same as teams

### 2c. `seasonsService` — Available seasons (`getSeasons`)
- **Why:** Trivial query but called frequently (season dropdowns). Only changes once per year.
- **Key:** `seasons:{league}`
- **TTL:** 24 hours
- **Invalidation:** None needed

### 2d. `standingsService` — Current season standings
- **Key:** `standings:{league}:{currentSeason}`
- **TTL:** 5 minutes
- **Invalidation:** Optional — `liveSync.js` could delete key when a game finalizes

---

## Tier 3: Do NOT Cache

### 3a. `favoritesService` — All favorites endpoints
- **Why:** User-specific data that changes on every toggle. The `getFavorites` query is expensive (4 parallel queries with window functions), but caching per-user introduces complexity with invalidation on every add/remove action. Not worth it until there's evidence of performance issues.

### 3b. `userService` — Profile endpoints
- **Why:** User-specific, trivial queries, infrequent access. Caching adds complexity for negligible gain.

### 3c. `searchService` — Search endpoint
- **Why:** Unbounded input space makes Redis caching impractical (millions of possible search terms). The `pg_trgm` GIN indexes already make these queries fast (~5ms). An in-memory LRU cache in the application process would be more appropriate here if ever needed, but not Redis.

### 3d. SSE live endpoints (`liveController`)
- **Why:** Real-time streams by design. The underlying queries (`getGames`, `getNbaGame`, etc.) will benefit from Tier 1/2 caching when serving finalized data, but the SSE stream itself should always hit fresh data for live games.

### 3e. `aiSummaryService` — AI summary
- **Why:** Already has its own caching strategy — summaries are persisted in `games.ai_summary` column. The `getCachedSummary` check is a simple indexed SELECT. Adding Redis on top of DB-level caching is redundant.

### 3f. Webhook endpoint
- **Why:** Write operation, no caching applicable.

---

## Implementation Steps

### Step 1: Redis client setup
- Create `backend/src/db/cache.js` with:
  - Redis client connection (uses `REDIS_URL` env var)
  - `cached(key, ttl, queryFn)` helper — check Redis, miss → run query → store → return
  - `invalidate(key)` helper — delete a key
  - `invalidatePattern(pattern)` helper — delete keys matching a glob (for bulk invalidation)
  - Graceful fallback: if Redis is down, skip cache and query DB directly (cache should never break the app)
- Add `redis` package to backend dependencies

### Step 2: Determine current season helper
- Create a utility or use `seasonsService.getSeasons()` to determine the current (max) season per league
- This is needed to decide whether to apply long or short TTLs
- Cache this value itself with 24h TTL

### Step 3: Apply caching to Tier 1 services
- Wrap `gameInfoService` queries with `cached()` — check game status before deciding TTL
- Wrap `standingsService` with season-aware TTL
- Wrap `playerInfoService` with season-aware TTL
- Wrap `gamesService` with season-aware TTL

### Step 4: Apply caching to Tier 2 services
- Wrap `teamsService`, `playersService`, `seasonsService` with `cached()` and fixed TTLs

### Step 5: Cache invalidation in data workers
- In `upsert.js`: after upserting a game, delete its `gameDetail:{league}:{gameId}` key and related `games:{league}:*` keys
- In `liveSync.js`: optionally delete current-season standings key when a game finalizes
- Keep invalidation simple — don't over-engineer

### Step 6: Update `.env.example` and deployment config
- Add `REDIS_URL` to `.env.example`
- Document Railway Redis add-on setup

### Step 7: Tests
- Unit test `cache.js` helper (mock Redis client)
- Update existing service tests to verify caching behavior (mock `cache.js`)
- Test graceful fallback when Redis is unavailable

---

## Architecture Decision: Where to Apply Caching

Caching is applied at the **service layer**, not the controller or route level. This is because:
1. Services contain the actual DB queries — caching wraps the query function directly
2. The same service function may be called from multiple controllers (e.g., `getGames` from both REST and SSE)
3. Cache keys naturally map to service function parameters

---

## Impact Estimate

| Route | Current | With Cache (Hit) | Improvement |
|---|---|---|---|
| Game detail (finalized) | 20-50ms | ~1ms | 20-50x |
| Past season standings | 15-30ms | ~1ms | 15-30x |
| Player detail (past season) | 20-40ms | ~1ms | 20-40x |
| Past season game list | 10-20ms | ~1ms | 10-20x |
| Teams/players/seasons list | 5-10ms | ~1ms | 5-10x |
| Favorites | 30-60ms | unchanged | — |
| Search | 5-15ms | unchanged | — |
| Live SSE | varies | unchanged | — |

Biggest win: finalized game detail pages, which have the heaviest queries and are the most frequently browsed historical data.
