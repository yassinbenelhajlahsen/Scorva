# Highlights Expansion Design

**Date:** 2026-05-09
**Scope:** Frontend (`frontend/src/components/highlights/`, `PulsePage`, `GamePage` deep-link), Backend (`top-performances` service + migration).
**League scope:** NBA-only (matches the rating engine's current coverage).

## Problem

The Pulse page's Highlights tab currently surfaces an MVP: top single-game ratings and a 7-day cumulative leaderboard, NBA-only, no filtering beyond the binary mode toggle. The data model already supports much more — `stats.rating` covers every NBA game in the DB, and `play_ratings.weighted_value` exposes per-play ratings. We want to expose:

1. Multiple time windows (Today / Week / Month / Season / All-time).
2. A best-plays leaderboard, clickable into the GamePage Plays tab on that exact play.
3. A position filter (All / G / F / C).
4. Sort high/low so users can also surface worst performances/plays.

## Tab structure

The existing two-pill toggle (`Best Games` / `Last 7 Days`) inside `HighlightsTab` is replaced by a three-tab pill row. Each tab shares the same secondary filter row.

| Tab | Content | Sort=desc surfaces | Sort=asc surfaces |
|---|---|---|---|
| **Rankings** | Cumulative leaderboard — total rating across the window | Best totals | Worst totals |
| **Performances** | Single best/worst games — one row per game | Best single games | Worst single games |
| **Plays** | Single best/worst plays — one row per play | Best single plays | Worst single plays |

All three tabs share the same filter set:
- **Window:** Today / Week / Month / Season / All-time
- **Position:** All / G / F / C
- **Sort:** High / Low

`Today` is defined as games dated today in `America/New_York` matching existing convention. The date column is shown on each row for `Today` and `Week`; hidden on `Month`, `Season`, `All-time`.

## UI / Filter layout

```
[Rankings]  [Performances]  [Plays]               ← top-level tab pills

Window:    [Today] [Week] [Month] [Season] [All-time]
Position:  [All] [G] [F] [C]
Sort:      [↓ High] [↑ Low]
```

- Filters live in URL query params: `tab`, `win`, `pos`, `sort`. Matches PulsePage's existing search-param-driven pattern.
- The top-level league pill in PulsePage continues to gate the Highlights sub-tab to `All` and `NBA` only (existing behavior).
- Top **3 rows** rendered as hero rows (#1 largest, #2/#3 a tier down). Rows 4–25 use the existing compact row pattern.
- Filter changes use the existing directional `SlideSwap` animation pattern.

### Row content per tab

| Tab | Row meta line | Value displayed |
|---|---|---|
| Rankings | `{gamesPlayed} GP · avg {avgPerGame}` | `totalRating` (1 decimal) |
| Performances | `{pts}/{reb}/{ast} · vs/@ {opp}` (+ date for Today/Week) | `ratingGrade` (1 decimal) |
| Plays | Play description (truncated) · `vs/@ {opp}` (+ date for Today/Week) | `weighted_value` (1 decimal) |

## Backend

### Endpoint

Extend `GET /api/:league/top-performances`. Existing callers continue to work via parameter aliases.

| Param | Values | Default | Notes |
|---|---|---|---|
| `type` | `rankings` \| `performances` \| `plays` | `performances` | Aliases: `cumulative`→`rankings`, `games`→`performances` |
| `window` | `today` \| `week` \| `month` \| `season` \| `all` | `week` | Replaces `days` (which remains an alias when present: 1→today, ≤7→week, ≤30→month, else error) |
| `sort` | `desc` \| `asc` | `desc` | Applies to all three types |
| `position` | `all` \| `G` \| `F` \| `C` | `all` | Case-insensitive prefix match on `players.position` |
| `limit` | int | `25` | Capped at 25 (existing) |

### Window resolution (NY tz)

```sql
-- today
g.date = (NOW() AT TIME ZONE 'America/New_York')::date

-- week / month
g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '7 days' | '30 days'

-- season
g.season = $currentSeason  -- via cache/seasons.js currentSeasonForLeague('nba')

-- all
-- (no date predicate)
```

### Position predicate

```sql
-- G:  position ~* '^(PG|SG|G)'
-- F:  position ~* '^(SF|PF|F)'
-- C:  position ~* '^C'
-- all: (no predicate)
```

Mixed strings like `"PG/SG"` match `G`. `F-C` matches `F`. Acceptable for v1.

### Three internal query functions

1. **rankings** — extends existing `queryCumulative`. Adds position filter, configurable date bound (or none), `ORDER BY total_rating ASC|DESC`.
2. **performances** — extends existing `queryGames`. Adds position filter, configurable date bound, `ORDER BY s.rating ASC|DESC`.
3. **plays** — new. Joins `play_ratings pr` → `plays pl` → `players p` → `teams t` (via `COALESCE(s.teamid, p.teamid)` analogue — see "Open question" below) → `games g` → `teams ot` (opponent). Returns play description, `weighted_value`, `wpa_delta`, period, clock, plus the same player/team/game envelope used by performances.

`g.status ILIKE '%final%'` and `g.type IN ('regular','playoff','final','makeup')` apply to all three (matches existing service).

### Response shapes

Existing `performances` and `cumulative` shapes preserved. New `plays` row:

```json
{
  "player": { "id, name, imageUrl, position, slug, team{id, abbreviation, logo, primary_color}" },
  "game":   { "id, date, opponent{id, abbreviation, logo}, isHome, result" },
  "play":   {
    "id": 12345,
    "description": "Stephen Curry makes 27-foot three pointer (assist by Draymond Green)",
    "period": 4,
    "clock": "0:32",
    "weightedValue": 4.2,
    "wpaDelta": 0.18
  }
}
```

### Indexes (one new migration)

```sql
-- migration: 20260509000000_add_highlights_indexes
CREATE INDEX IF NOT EXISTS stats_rating_desc_idx
  ON stats (rating DESC) WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS play_ratings_weighted_desc_idx
  ON play_ratings (weighted_value DESC);
```

The existing `games(league, date)`, `games(season)`, and `stats(gameid)` indexes cover the join/filter bounds. Verify during implementation that no other index is needed for season/all-time scans on the largest table (`stats`).

### Caching

Extend the existing `top-performances:` namespace key:

```
top-performances:nba:{type}:{window}:{sort}:{position}:{limit}
```

| Window | TTL |
|---|---|
| today | 30s |
| week | 60s |
| month | 5m |
| season (current) | 5m |
| season (past) | 24h |
| all | 1h |

Bump `CACHE_VERSION` in `backend/src/cache/cache.js` because the existing top-performances key shape changes.

## Click-through deep-linking

| Tab | Link target |
|---|---|
| Rankings | `/{league}/players/{playerSlug}` (existing PlayerPage route) |
| Performances | `/{league}/games/{gameId}?tab=analysis#{slugify(playerName)}` — mirrors `StatCard` exactly |
| Plays | `/{league}/games/{gameId}?tab=plays#play-{playId}` — parallel pattern |

### Required component changes

- `BoxScore.jsx` already emits `id={slug}` on each player row (line 264). No change needed for Performances.
- `PlayByPlay.jsx` does **not** currently emit row-level DOM ids. Add `id={`play-${play.id}`}` to the play row wrapper element so the anchor `#play-{id}` resolves natively.
- PBP renders all periods (no virtualization, no collapsed-by-default sections), so native anchor scroll works without expansion logic. If this changes in the future, deep-link logic must be revisited.

### Highlight pulse (polish, MVP)

Small shared hook `useHashHighlight(prefix)` in `frontend/src/hooks/ui/`:
- Reads `window.location.hash` on mount.
- If matches `prefix`, finds the element by id, applies a `ring-2 ring-accent/40` class for 1.5s, then removes it.
- Used by both `BoxScore` (prefix: `""` — any slug) and `PlayByPlay` (prefix: `"play-"`).

This gives users visual confirmation when scroll lands far down the page.

## Frontend changes

### Component structure

`frontend/src/components/highlights/`:
```
HighlightsTab.jsx        — top-level: tab pill row + filter row, dispatches to active tab
filters/
  FilterBar.jsx          — Window, Position, Sort pill rows (URL-param driven)
tabs/
  RankingsList.jsx       — cumulative leaderboard
  PerformancesList.jsx   — single best/worst games
  PlaysList.jsx          — single best/worst plays
rows/
  HeroRow.jsx            — top-3 hero rendering, accepts a render-prop or 'kind' for per-tab content
  CompactRow.jsx         — rank 4–25 rendering
```

`TopPerformers.jsx` is removed. Its tests in `__tests__/components/TopPerformancesCard.test.jsx` are kept where they cover shared row rendering, updated otherwise.

### Hook + API

- `useTopPerformances(league, { type, window, sort, position, limit })`.
- Query key: `["top-performances", league, type, window, sort, position, limit]`.
- Hover-prefetch on rows: Performances → `queryKeys.game`, Rankings → `queryKeys.player`. Matches existing pattern.

### URL params

`PulsePage` owns `league`, `tab` (sub-tab: highlights / reports), and `type` (Reports type filter — only meaningful when sub-tab=reports).

`HighlightsTab` owns four params, all distinct from PulsePage's:
- `mode` → `rankings` | `performances` | `plays` (extends the existing `mode` param, which today accepts `games` | `cumulative`; old values aliased)
- `win` → `today` | `week` | `month` | `season` | `all`
- `pos` → `all` | `g` | `f` | `c`
- `sort` → `desc` | `asc`

Defaults are omitted from the URL (e.g. `mode=performances&win=week&sort=desc&pos=all` → bare URL).

## Edge cases

- **Player not in box score** (deep link to a Performances row for someone who didn't play in that game — shouldn't happen given the join, but defensive): native anchor scroll no-ops cleanly.
- **Play deleted/unrendered**: anchor scroll no-ops. The highlight hook silently exits when target element is missing.
- **Live game**: PBP's existing "isNew" flash logic should not double up with the deep-link highlight — verify during implementation; if needed, suppress isNew for the targeted play on first render.
- **Today with no completed games yet**: empty state copy — "No final games today yet."
- **All-time on a fresh DB / cold cache**: first hit may be slow. Index added in this spec mitigates. If still slow, follow-up materialized view migration is a known fallback.

## Open questions / known small risks

1. **`play_ratings` team join.** The existing performances query joins teams via `COALESCE(s.teamid, p.teamid)` to handle traded players. `play_ratings` has `player_id` and `game_id` but not `team_id`. The plays query will need to derive team via `stats(playerid, gameid)` join (which has `s.teamid`) or fall back to `players.teamid`. Resolved during implementation; spec assumes the same `COALESCE` pattern is reachable through `stats`.
2. **PBP "isNew" flash collision** for live-game deep-links — minor visual issue, fix during implementation if observed.
3. **Existing test coverage**: `TopPerformancesCard.test.jsx` (currently modified, per `git status`) will need re-targeting once the component is split. Backend `topPerformancesService` tests need new cases for `window`, `position`, `sort`, `type=plays`.

## Out of scope

- NHL / NFL highlights — both lack the rating data this surface needs (per project memory, NHL needs win-prob synthesis; NFL deferred).
- Materialized views for All-time. Cache + index is the v1 strategy; revisit only if perf measurements warrant it.
- Team filter / search-by-player. Could be added later if usage justifies.
- Saving filter presets per user.

## Acceptance criteria

- Highlights surface shows three tabs (Rankings / Performances / Plays) gated to NBA via the league pill.
- Each tab respects Window, Position, Sort filters; URL deep-linkable.
- Top 3 rows render as heroes; 4–25 as compact rows; date shown on Today and Week.
- Clicking a Performances row navigates to GamePage analysis tab and scrolls to the player row.
- Clicking a Plays row navigates to GamePage plays tab and scrolls to the play.
- Brief highlight pulse on the targeted row/play.
- Backend serves all type/window/sort/position combinations correctly with appropriate caching.
- New indexes applied via migration; CACHE_VERSION bumped.
- Tests cover the new query branches and the deep-link anchor behavior.
