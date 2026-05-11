# Game & Team Ratings — Design Spec

**Date:** 2026-05-11
**Status:** Approved, ready for implementation plan
**Scope:** NBA-only (matches existing player rating engine)

## Summary

Extend the existing player rating system (`stats.rating` per player per game) with two derived aggregates: **team rating** (sum of one team's player ratings for a game) and **game rating** (sum of all player ratings in a game). Surface these on GameCard, GamePage, the global Highlights surface, and a new TeamPage Highlights tab. No new rating engine, no schema migration — both numbers are pure aggregations of an already-stored column.

## Goals

1. Show a game's overall "impact" rating on GameCard (corner pill) and on GamePage (Overview card with team breakdown).
2. Let users browse top teams and top games (alongside existing top players) in the Highlights surface, with the same window/sort controls.
3. Give TeamPage a Highlights tab that mirrors PlayerPage Highlights — that team's games ranked by team rating, filterable by window.
4. Keep ratings live (tick up as plays come in during a game) using the existing SSE infrastructure.

## Non-goals

- **NFL / NHL parity.** Player ratings are NBA-only today (per CLAUDE.md feature index, NHL needs synthesized win probability, NFL deferred). This feature inherits that constraint.
- **A new rating engine or formula.** Aggregates derive from existing `stats.rating`. If `ratingEngine.js` changes, both numbers move with it automatically.
- **Per-team play ratings.** Plays are inherently per-player. The Plays tab in Highlights is unchanged.
- **Storage / precompute.** v1 computes on read.

## Architecture

```
play_ratings ─aggregated by─ ratingEngine.recomputeGame()
                                       │
                                       ▼
                            stats.rating  (per player per game)
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
  team_rating(game,team)     game_rating(game)         (existing) player rankings
   = SUM(stats.rating         = SUM(stats.rating
     WHERE teamid)               WHERE gameid)
            │                          │
            └────── exposed via ───────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   GameCard pill   GamePage card    Highlights (entity=team|game)
                                    + TeamPage Highlights tab
```

**Single source of truth:** `stats.rating`. Player rankings, team ratings, and game ratings are derived from the same rows, so they cannot disagree.

**Grade conversion:** reuse the existing `gradeFromRaw(raw)` from `backend/src/services/games/ratingEngine.js` for both team and game grades. Same coefficient and clamp (−10..+10) as players.

**Tier label** for the GamePage card and game-entity rows in Highlights, derived from `game_grade`:

| Grade | Label |
|---|---|
| `>= 8.5` | Elite |
| `>= 7.0` | Great |
| `>= 5.5` | Solid |
| `< 5.5` | Routine |

Special override (only when `status === 'Final'`): if `|home_grade − away_grade| <= 1.0` AND `|home_score − away_score| <= 5`, label becomes **Close** regardless of grade tier. This signal is independent of total impact (a low-scoring, low-impact game can still be "Close").

## Data model

**No schema changes.** All numbers come from `stats.rating` (Decimal 6,1, already populated by ratingEngine).

### Shared derivation helper

New file: `backend/src/services/games/ratingAggregates.js`

```js
ratingsForGames(client, gameIds): Map<gameId, RatingBundle>
```

Returns a map keyed by `gameId`. Each `RatingBundle`:

```js
{
  gameRating: number | null,
  homeTeamRating: number | null,
  awayTeamRating: number | null,
  gameGrade: number | null,
  homeGrade: number | null,
  awayGrade: number | null,
  tierLabel: "Elite" | "Great" | "Solid" | "Routine" | "Close" | null,
}
```

All fields are `null` if no player on that game has a non-null `stats.rating` (early-live or non-NBA). The helper itself filters `WHERE g.league = 'nba'`.

Core SQL:

```sql
SELECT s.gameid,
       SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid
                THEN s.rating END) AS home_rating,
       SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.awayteamid
                THEN s.rating END) AS away_rating,
       SUM(s.rating)              AS game_rating
FROM stats s
JOIN players p ON p.id = s.playerid
JOIN games   g ON g.id = s.gameid
WHERE s.gameid = ANY($1) AND g.league = 'nba' AND s.rating IS NOT NULL
GROUP BY s.gameid, g.hometeamid, g.awayteamid;
```

The `COALESCE(s.teamid, p.teamid)` matches the existing pattern from `gameDetailService.js` for traded players (per `stats.teamid` notes in CLAUDE.md).

## API changes

### Augmented responses (no new endpoints for ratings themselves)

| Endpoint | Added field |
|---|---|
| `GET /:league/games/:gameId` | `rating: { raw, grade, tierLabel, home: { raw, grade }, away: { raw, grade } }` — omitted when bundle is null. |
| Games-list responses (homepage, league page, team schedule) | Per-game: `{ rating, grade }` only — no breakdown, keeps payload small. |
| SSE per-game partials (introduced in commit `1e172ee`) | Same `{ rating, grade }` on the partial so the GameCard pill ticks live. |

### Extended endpoint: `GET /:league/top-performances`

Two new query params on the existing `getTopPerformances` controller/service:

| Param | Type | Default | Notes |
|---|---|---|---|
| `entity` | `"player" \| "team" \| "game"` | `"player"` | Back-compat — omitting it preserves existing behavior. |
| `teamId` | integer (optional) | — | Scopes `entity=team` results to a single team. Used by TeamPage Highlights tab. Ignored when entity ≠ team. |

Behavior matrix:

| `type` | `entity` | Behavior |
|---|---|---|
| `rankings` | `player` | Unchanged. |
| `rankings` | `team` | Cumulative `SUM(team_rating)` per team across the window. Returns `{ team, totalRating, gamesPlayed, avgPerGame, bestGame }`. |
| `rankings` | `game` | **400 Bad Request** — a game is a single event; "cumulative" doesn't apply. Frontend disables this combination at the chip level. |
| `performances` | `player` | Unchanged. |
| `performances` | `team` | Per-team-per-game rows by `team_rating`. Optionally scoped via `teamId`. |
| `performances` | `game` | Per-game rows by `game_rating`. Each row contains both teams. |
| `plays` | any | `entity` ignored — plays are always per-player. Frontend hides the entity chip group entirely on Plays. |

Filter interactions:

- `position` ignored server-side when `entity !== "player"` (also visually disabled in the UI).
- `playerId` ignored when `entity !== "player"`.
- `teamId` ignored when `entity !== "team"`.
- `sort: "asc"` reverses any of the above (worst-rated teams/games).

### Item shapes

```js
// entity=team, type=performances
{
  team: { id, name, abbr, logo, primary_color, slug },
  game: { id, date, opponent, isHome, isLive, homeScore, awayScore, result: "W" | "L" | null },
  rating: number,         // raw team_rating
  ratingGrade: number,    // 0-10 grade (signed; can be negative)
}

// entity=team, type=rankings
{
  team: { id, name, abbr, logo, primary_color, slug },
  totalRating: number,
  gamesPlayed: number,
  avgPerGame: number,
  bestGame: { gameId, rating, opponentAbbreviation },
}

// entity=game, type=performances
{
  game: { id, date, homeTeam: {...}, awayTeam: {...}, homeScore, awayScore, isLive },
  homeTeamRating: number,
  awayTeamRating: number,
  rating: number,
  ratingGrade: number,
  tierLabel: "Elite" | "Great" | "Solid" | "Routine" | "Close",
}
```

### Caching

- Aggregate helper is invoked inside cached responses (gameDetail, games-list, topPerformances) — no separate cache entry.
- `topPerformances` cache key gains `entity` and `teamId` segments so entity variants don't collide.
- `CACHE_VERSION` in `backend/src/cache/cache.js` is bumped once (gameDetail and games-list shapes change).
- Existing per-window TTLs apply unchanged (today 30 s, week 60 s, month/season 5 min, all 1 hr).

### Live updates

No new SSE event types. Flow:

```
Play → liveSync → ratingEngine.recomputeGame()
  → writes stats.rating
  → pg_notify game_updated
  → notificationBus → SSE
  → frontend: invalidate queryKeys.game(...) AND merge per-game partial into league list
  → GamePage GameRatingCard refetches via gameDetail
  → GameCard pills re-render from merged list partial
```

The per-game SSE partial (added in commit `1e172ee`) gains the `{ rating, grade }` fields so list-side pills tick without a full refetch.

## Frontend

### New components

| File | Purpose |
|---|---|
| `frontend/src/components/cards/GameRatingPill.jsx` | Corner pill (`★ 8.4`). Renders `null` when `grade == null`. Accepts `grade`, `size` (sm/md). Negative grade → red text; positive → accent. |
| `frontend/src/components/game/GameRatingCard.jsx` | Overview-tab card. Renders game grade + tier label + two team grade chips with team logo + primary_color accent. Hidden when bundle is null. |
| `frontend/src/components/highlights/rows/TeamHeroRow.jsx` | Rank 1–3 team variant. Team logo replaces player image. Background uses team `primary_color`. |
| `frontend/src/components/highlights/rows/TeamCompactRow.jsx` | Rank 4+ team variant. |
| `frontend/src/components/highlights/rows/GameHeroRow.jsx` | Rank 1–3 game variant. Both team logos side-by-side. Mixed primary_color gradient (left = home, right = away). Tier label in meta. |
| `frontend/src/components/highlights/rows/GameCompactRow.jsx` | Rank 4+ game variant. |
| `frontend/src/components/team/TeamHighlightsTab.jsx` | Window selector + `<PerformancesList entity="team" teamId={team.id} />`. NBA-only. |

### Changed components

| File | Change |
|---|---|
| `frontend/src/components/cards/GameCard.jsx` | Mount `<GameRatingPill grade={game.grade}>` in top-right corner, absolute-positioned. No layout reflow. |
| `frontend/src/pages/GamePage.jsx` | In Overview tab, insert `<GameRatingCard rating={gameDetail.rating} />` between matchup header and box score. |
| `frontend/src/components/highlights/HighlightsTab.jsx` | Add entity chip group (Players / Teams / Games) to FilterBar. URL param `entity` (default `players`). Disable "Games" chip when active tab is Rankings. Visually disable Position chips when `entity !== "player"`. Hide entire entity row when tab is Plays. |
| `frontend/src/components/highlights/tabs/RankingsList.jsx` | Accept `entity` prop. Dispatch render: `team` → TeamHero/TeamCompact rows. `entity=game` not reachable here (chip-disabled). |
| `frontend/src/components/highlights/tabs/PerformancesList.jsx` | Accept `entity` prop. Dispatch: `team` → Team rows linking to `/${league}/teams/${slug}`; `game` → Game rows linking to `/${league}/games/${gameId}`. Player flow unchanged. |
| `frontend/src/hooks/data/useTopPerformances.js` | Pass `entity` and `teamId` through to query string and include both in queryKey. |
| `frontend/src/pages/TeamPage.jsx` | Add third tab "Highlights" alongside Schedule + Players, NBA-only (hidden when `league !== "nba"`). Tab content: `<TeamHighlightsTab team={team} />`. |

### Filter chip UX

```
Tab:    [Rankings] [Performances] [Plays]
Entity: [Players] [Teams] [Games]      ← Plays tab: hidden entirely
                              (Games greyed on Rankings)
Pos:    [All] [G] [F] [C]              ← greyed when entity != Players
Window: [Today] [Week] [Month] [Season] [All]
Sort:   [Best] [Worst]
```

Greyed state: `disabled` prop → opacity-50, cursor-not-allowed, no-op onClick. State value is preserved but not sent to the API. Switching back to Players re-engages position. (User-confirmed: "disable, don't reset".)

### Hover prefetch

Mirroring the existing pattern in PerformancesList:

- Team rows → prefetch `queryKeys.team(league, slug)`.
- Game rows → prefetch `queryKeys.game(league, gameId)`.
- Both gated on `window.matchMedia("(hover: hover)").matches`.

## Edge cases

| Case | Behavior |
|---|---|
| Pre-tip / first 2 min of Q1 (no `stats.rating` yet) | Aggregate returns null → `rating` field omitted from API → pill and card hidden. No "0.0" flash. |
| Non-NBA league | SQL filters `league='nba'` → null bundle → pill/card never render. Entity chip group hidden on non-NBA league pills. TeamPage Highlights tab not mounted. |
| Traded player in historical box score | `COALESCE(s.teamid, p.teamid)` matches the gameDetailService pattern — rating counts toward the team they were on at game time. |
| Negative team rating | Grade can be negative via `gradeFromRaw` clamp. Display per existing player-rating convention: red for `< 0`. Consistency over hiding. |
| "Close" tier during a live game | Computed only when `status === 'Final'`. While live, tier derives from grade only (Elite/Great/Solid/Routine). Prevents flicker on lead-change games. |
| Ties in rankings sort | Secondary sort: `totalRating DESC, gamesPlayed DESC, team.id ASC`. For performances: `rating DESC, game.date DESC, id ASC`. Deterministic across requests. |
| `entity=team` URL with stale `playerId` | `playerId` ignored when entity≠player. Frontend URL sync drops `playerId` on entity change. Only `position` is held in state-but-ignored, per "disable, don't reset". |
| `entity=game` requested on Rankings (direct URL) | Backend returns 400. Frontend auto-switches Games chip → Players if it lands there. |
| Cumulative team rankings `gamesPlayed` | Counts distinct games where the team had at least one player with `stats.rating IS NOT NULL`. Avoids inflating from 0-minute roster rows. |
| `sort=asc` + `entity=game` | Returns worst-rated games. Leave on — useful for "worst games of the week". |
| Cache thrash on live games | Existing 30 s TTL on `today` window caps DB load. Between-cache updates ride the SSE per-game partial. |

## Testing

### Backend (Jest)

| File | Coverage |
|---|---|
| `backend/__tests__/services/ratingAggregates.test.js` | Single + multi-game aggregation; COALESCE of stats.teamid + players.teamid; null when no rating rows; non-NBA returns nothing; tier label boundaries (8.49 = Great, 8.50 = Elite); Close override only when status=Final AND margin ≤ 5 AND |Δgrade| ≤ 1.0. |
| `backend/__tests__/services/topPerformances.entity.test.js` | All 9 entity × type combinations; position ignored when entity≠player; teamId scopes correctly; playerId ignored when entity≠player; sort=asc reverses; deterministic tiebreak; `entity=game, type=rankings` → 400. |
| `backend/__tests__/services/gameDetail.rating.test.js` | `getGameDetail` includes `rating` bundle for NBA Final games; field omitted for non-NBA; mid-live games never carry "Close". |
| `backend/__tests__/routes/topPerformances.entity.test.js` | Route validator accepts `entity` + `teamId`; rejects unknown entity values; back-compat (no `entity` defaults to player). |
| Cache version test (existing pattern) | After `CACHE_VERSION` bump, old cached entries bypassed on first read. |

Backend tests follow existing patterns from CLAUDE.md test-patterns memory: `jest.unstable_mockModule` for `db/db.js`, `mockReset()` in `beforeEach`.

### Frontend (Vitest + RTL)

| File | Coverage |
|---|---|
| `frontend/src/__tests__/components/GameRatingPill.test.jsx` | Renders when `grade` is a number; renders null when `grade == null`; negative → red class; positive → accent class. |
| `frontend/src/__tests__/components/GameRatingCard.test.jsx` | Renders game grade + tier label + both team chips; hidden when bundle null; "Close" tier gets distinct color. |
| `frontend/src/__tests__/components/HighlightsTab.filter.test.jsx` | Entity chip group: Teams disables Position chips (greyed, no-op); switching back to Players re-engages prior position; Rankings tab greys Games chip; Plays tab hides entity row entirely; URL `?entity=teams` ⇌ state. |
| `frontend/src/__tests__/components/RankingsList.dispatch.test.jsx` | `entity=player` renders Hero/Compact; `entity=team` renders TeamHero/TeamCompact with team logo + primary_color. |
| `frontend/src/__tests__/components/PerformancesList.dispatch.test.jsx` | All three entity variants render the right row and link target; game rows show both team logos and tier label. |
| `frontend/src/__tests__/components/TeamHighlightsTab.test.jsx` | NBA-only mount; window changes drive `useTopPerformances` with `entity="team"` + `teamId`; empty-state messaging. |
| `frontend/src/__tests__/hooks/useTopPerformances.entity.test.js` | Query key includes `entity` + `teamId`; switching entity creates a fresh cache entry; staleTime per-window unchanged. |

Frontend tests follow existing patterns: `createTestQueryClient()` per `queryWrapper.jsx`, `MOTION_PROPS` set for Framer Motion mocks per `feedback_framer_motion_test_mock.md`.

### Out of scope for v1

- E2E for the live-update path (covered by manual smoke + existing SSE tests).
- Visual regression for GameCard pill across breakpoints.
- NFL / NHL parity tests — feature is NBA-only by design.

## File checklist

**Backend — new:**
- `backend/src/services/games/ratingAggregates.js`

**Backend — changed:**
- `backend/src/services/games/topPerformancesService.js` (entity, teamId)
- `backend/src/services/games/gameDetailService.js` (include rating bundle)
- Games-list services (homepage, league, team schedule) — include `{ rating, grade }` per game
- SSE per-game partial emitter (commit `1e172ee` site) — include `{ rating, grade }`
- `backend/src/cache/cache.js` (bump CACHE_VERSION)
- `backend/src/routes/games/topPerformances.js` (validator: accept `entity`, `teamId`)

**Frontend — new:**
- `frontend/src/components/cards/GameRatingPill.jsx`
- `frontend/src/components/game/GameRatingCard.jsx`
- `frontend/src/components/highlights/rows/TeamHeroRow.jsx`
- `frontend/src/components/highlights/rows/TeamCompactRow.jsx`
- `frontend/src/components/highlights/rows/GameHeroRow.jsx`
- `frontend/src/components/highlights/rows/GameCompactRow.jsx`
- `frontend/src/components/team/TeamHighlightsTab.jsx`

**Frontend — changed:**
- `frontend/src/components/cards/GameCard.jsx`
- `frontend/src/pages/GamePage.jsx`
- `frontend/src/components/highlights/HighlightsTab.jsx`
- `frontend/src/components/highlights/tabs/RankingsList.jsx`
- `frontend/src/components/highlights/tabs/PerformancesList.jsx`
- `frontend/src/hooks/data/useTopPerformances.js`
- `frontend/src/pages/TeamPage.jsx`
- `frontend/src/lib/query.js` (queryKeys.topPerformances includes entity + teamId)
