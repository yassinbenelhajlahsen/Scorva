# Reports — Design Spec

**Date:** 2026-04-30
**Status:** Approved, ready for implementation plan
**Scope:** A unified "Reports" feed surfacing four types of league activity — **Injuries**, **Moves**, **Birthdays**, and **Streaks** — on the homepage and as a new tab on each LeaguePage. Replaces the originally-scoped "Transactions" feed (broader, player-centric).

## Goals

- Give fans a scannable, league-aware activity feed without leaving Scorva for ESPN/Twitter.
- Reuse existing infrastructure (ESPN transactions endpoint, `players.status`, `stats`, `players.dob`) so the feature ships with no new external dependencies.
- Match the visual rhythm of existing surfaces: V2 compact rows on both surfaces, Apple-style dark cards.
- Make the feed self-discoverable: 5-row teaser on the homepage that funnels into per-league deep dives.

## Non-Goals

- **No comments / social layer.** Reference UI shows comment counts; we explicitly skip that subsystem in v1.
- **No backfill** of injury history. The new `player_status_history` table starts empty; the Injuries report type populates organically over the first 1–2 weeks after deploy.
- **No /reports dedicated page.** Reports lives as a 4th tab on `/{league}` (next to Standings and Playoffs). The homepage strip is a teaser that funnels into the per-league tab.
- **No cross-league aggregated view.** Removed during scope review — a tab on LeaguePage is the canonical surface.
- **No real-time push.** Reports are read at request time from the cache; no SSE/WebSocket streaming.
- **No coach / front-office moves in v1.** ESPN exposes them in the transactions feed, but they don't fit the player-centric row layout (no photo, no slug). Re-evaluate post-launch with a dedicated row variant if demand exists.

## User-Facing Surfaces

### 1. Homepage strip (`ReportsSection`)

Inserted into `Homepage.jsx` between `<NewsSection />` and the Today's Games section.

- Header label: `Reports` (matches `Headlines` / `Today's Games` styling)
- 5 rows, mixed leagues, mixed types, sorted by `date DESC`
- No filters on the strip itself
- Below the rows: three pill buttons in a row — `View NBA Reports →` / `View NFL Reports →` / `View NHL Reports →` — each with `onMouseEnter` prefetching that league's Reports tab

### 2. LeaguePage Reports tab

A 4th tab on `/{league}`, inserted after `playoffs` (or after `standings` for leagues without playoff support). The existing pill-tab UI (`SwipeableTabs`, sliding accent indicator) is reused.

- Type filter pills below the tab nav: `All / Injuries / Moves / Birthdays / Streaks` (sent to API as `?type=injury|move|birthday|streak`)
- 20 reports per page, paginated via a `Load More` button
- Date headers (`Apr 30, 2026`) group rows by day (V3 styling, `groupByDate=true`)
- Mobile swipe-between-tabs continues to work (`SwipeableTabs`)

#### Tab deep linking

`LeaguePage.jsx` is extended to sync `activeTab` with the `?tab=` query string. The homepage's three buttons link to `/{league}?tab=reports`. This also fixes the back button for tab navigation.

```js
const [searchParams, setSearchParams] = useSearchParams();
const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "games");
function pickTab(tab) { setActiveTab(tab); setSearchParams({ tab }, { replace: true }); }
```

## Report Types

Each report is a discriminated-union record, sharing a common `{id, type, date, league, player}` shell.

### Injuries (`type: "injury"`)

Status transitions detected by `syncInjuries.js`. Last 30 days only.

```json
{
  "id": "injury-12345",
  "type": "injury",
  "date": "2026-04-30T18:00:00.000Z",
  "league": "nba",
  "player": { "id": 4234, "name": "Bones Hyland", "slug": "bones-hyland", "imageUrl": "...", "league": "nba" },
  "prevStatus": "questionable",
  "newStatus": "active",
  "newStatusDescription": null
}
```

- `newStatusDescription` is the body part / detail string from `players.status_description` if available.
- A status going `null → out` and `out → null` (active) both surface — both are interesting transitions.
- Rendered as `prevStatus → newStatus · newStatusDescription` (each status colored: yellow for questionable/doubtful, red for out, green for active).

### Moves (`type: "move"`)

Sourced from ESPN `/transactions` per league (same endpoint and pattern as the prior Transactions design). Visualized as `[fromTeamLogo] → [toTeamLogo]` with a gray "NR" placeholder when one side has no team.

```json
{
  "id": "move-2026-04-12-bkn-0",
  "type": "move",
  "date": "2026-04-12T07:00:00.000Z",
  "league": "nba",
  "player": { ... },
  "action": "sign",                 // sign | waive | trade
  "fromTeam": null,                 // null = NR (free agent / not on roster)
  "toTeam": { "id": 17, "abbreviation": "BKN", "name": "Brooklyn Nets", "logoUrl": "..." }
}
```

- AHL-only NHL moves (description ending `(AHL).`) are filtered out at parse time.
- Option-exercise moves (`/exercised the .* option/i`) filtered out — too administrative.
- **Coach / front-office moves are filtered out in v1.** They can't be rendered with the player-centric row layout (the "coach" isn't in our `players` table); supporting them requires a separate row variant. Defer to a follow-up.
- One row emitted per resolved player. A multi-player ESPN description ("Signed FBs A, B and C") becomes 3 rows.
- Players whose names can't be resolved against `players` table → no row emitted.

### Birthdays (`type: "birthday"`)

```json
{
  "id": "birthday-4567-2026-04-30",
  "type": "birthday",
  "date": "2026-04-30T00:00:00.000Z",
  "league": "nba",
  "player": { ... },
  "age": 24
}
```

- Sourced from `players.dob` (verify format during implementation; column is `String?`).
- Filtered to `popularity > 0` (drops deep-bench / G League fluff).
- Last 30 days of birthdays surface; today's birthdays sort first within their date.
- Rendered as `Happy {age}th Birthday 🎉`.

### Streaks (`type: "streak"`)

Currently-active multi-game performance streaks, computed from the `stats` table.

```json
{
  "id": "streak-4567-double-double",
  "type": "streak",
  "date": "2026-04-30T22:00:00.000Z",
  "league": "nba",
  "player": { ... },
  "streakLength": 5,
  "statLabel": "double-double",
  "emoji": "🔥"
}
```

- `date` = the date of the most recent game extending the streak.
- A streak surfaces only if (a) length ≥ league-specific minimum and (b) the player's most recent game still satisfies the threshold (no broken streaks).
- One row per (player, statLabel). If a player has both a 5-game double-double streak AND a 5-game 30+ point streak, that's two rows.

#### Streak thresholds (initial set)

| League | Min length | Stat thresholds |
|---|---|---|
| NBA | 5 games | Double-double, triple-double, 30+ pts, 10+ reb, 10+ ast |
| NFL | 3 games | 100+ rush yds, 100+ rec yds, 3+ pass TD, 2+ rush/rec TD |
| NHL | 5 games | Multi-point game, goal in consecutive games |

These are tunable per-league constants in `streaksReports.js`. Adjust based on real-data noise after first deploy.

## Data Source Summary

| Type | Source | Cadence |
|---|---|---|
| Injuries | New `player_status_history` table; populated by modified `syncInjuries.js` | On every status change (sub-hourly during game days) |
| Moves | ESPN `/transactions` per league via `withRetry` | ESPN updates roughly daily |
| Birthdays | `players.dob` query | Daily |
| Streaks | `stats` table window queries | After each game ingest |

## Storage — New Table

```sql
-- backend/prisma/migrations/<timestamp>_add_player_status_history/migration.sql

CREATE TABLE player_status_history (
  id BIGSERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league VARCHAR(10) NOT NULL,
  prev_status VARCHAR(20),
  prev_status_description TEXT,
  new_status VARCHAR(20),
  new_status_description TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_psh_changed_at ON player_status_history(changed_at DESC);
CREATE INDEX idx_psh_league_changed ON player_status_history(league, changed_at DESC);
CREATE INDEX idx_psh_player ON player_status_history(player_id);
```

Mirrored in `backend/prisma/schema.prisma` as a new model `player_status_history`. After migration, `prisma generate` regenerates the client.

### `syncInjuries.js` modification

Before each `UPDATE players` (status set, status clear, stale sweep), the worker SELECTs the existing `(status, status_description)` for that row. If the new tuple differs from the existing one, an INSERT into `player_status_history` is performed in the same transaction. No-op syncs add zero rows.

## API Contract

```
GET /api/reports
  ?league=nba|nfl|nhl    # optional; omit for cross-league (homepage strip)
  &type=injury|move|birthday|streak    # optional; default = all types
  &limit=20              # capped at 50
  &offset=0
```

```jsonc
{
  "reports": [ /* discriminated-union records, see Report Types above */ ],
  "total": 412,
  "hasMore": true
}
```

Sort: `date DESC`, ties broken by `(type, id)` for deterministic ordering. Type-tie-breaker order: `injury > move > streak > birthday`.

## File Layout

### Backend

```
backend/
  prisma/migrations/<timestamp>_add_player_status_history/migration.sql
  prisma/schema.prisma                                            # add player_status_history model
  src/services/reports/
    reportsService.js                                             # orchestrator, cached
    injuriesReports.js                                            # SELECT player_status_history JOIN players JOIN teams
    movesReports.js                                               # ESPN fetch + parser + team/player resolution
    movesParser.js                                                # action classification + from/to team + player extraction
    birthdaysReports.js                                           # SELECT players WHERE dob in last 30 days
    streaksReports.js                                             # per-league streak SQL with window functions
  src/controllers/reports/reportsController.js
  src/routes/reports/reports.js                                   # mounted at /api/reports
  src/ingestion/syncInjuries.js                                   # MODIFIED: insert history rows on change
  src/index.js                                                    # MODIFIED: mount reports route
```

### Frontend

```
frontend/src/
  api/reports.js                                                  # apiFetch wrapper
  hooks/data/useReports.js                                        # TanStack Query hook
  pages/LeaguePage.jsx                                            # MODIFIED: add reports tab + ?tab= sync
  pages/Homepage.jsx                                              # MODIFIED: insert <ReportsSection />
  components/reports/
    ReportsSection.jsx                                            # homepage strip + 3 league buttons
    ReportsTab.jsx                                                # LeaguePage tab content
    ReportsList.jsx                                               # shared list, optional date grouping
    ReportRow.jsx                                                 # dispatcher by report.type
    InjuryReportRow.jsx
    MoveReportRow.jsx
    BirthdayReportRow.jsx
    StreakReportRow.jsx
    NRBadge.jsx                                                   # reusable "NR" gray circle
  components/skeletons/ReportRowSkeleton.jsx
  lib/query.js                                                    # MODIFIED: add queryKeys.reports + queryFns.reports
```

## Caching Strategy

One cache key shape (bumping `CACHE_VERSION` in `cache/cache.js`):

- `reports:list:{league}` — TTL **5 min**. Payload is the **unfiltered superset** of all four types for that league.

Both surfaces compose off this single cache:

- **LeaguePage tab** (`?league=nba`) — controller reads `reports:list:nba`, filters by `?type=` (or returns all), slices for `limit`/`offset` pagination.
- **Homepage strip** (no `?league`) — controller reads all three per-league caches in parallel, merges, sorts by `date DESC`, slices to the requested `limit`. No separate cache key.

This unifies freshness across surfaces (5 min everywhere) and avoids duplicating data between strip and tab caches. `reportsService.js` orchestrates the four type-services via `Promise.allSettled` per league so one type's failure (e.g., ESPN moves down) doesn't drop the others.

## Frontend Rendering Details

### Common row shell

```
[36px player photo or initials fallback]  [Name, link to /{league}/players/{slug}]   [relative time]
                                          [type-specific transition / body line]
```

- `imageUrl` null → render initials in a circle with team-primary-color background (matches `FavoritePlayersSection` pattern)
- Hover-prefetch the player page on row mouseenter (matches existing pattern)
- The whole row is not a link; only specific elements (name, photo, team logos in moves) are clickable

### Per-type rendering

- **InjuryReportRow:** `<status pill prev> → <status pill new> · <body part>` with the optional `status_description` as a faded body line below.
- **MoveReportRow:** A sub-row beneath the name with `[fromLogo or NR] → [toLogo or NR]`, each team logo a 24px circle, each linkable to `/{league}/teams/{abbreviation}`. Action badge on the right.
- **BirthdayReportRow:** `Happy {age}th Birthday 🎉`. No sub-row.
- **StreakReportRow:** `{streakLength}-game {statLabel} streak {emoji}`. No sub-row.

### NR (Not on Roster) badge

Single shared component `NRBadge.jsx`:

```jsx
<div className="w-6 h-6 rounded-full bg-surface-overlay border border-white/[0.08]
                flex items-center justify-center text-[9px] font-semibold text-text-tertiary">
  NR
</div>
```

## Error Handling

- **ESPN moves fetch fails:** moves drop, others survive (Promise.allSettled).
- **One league's ESPN call fails:** that league drops out of the moves payload; injuries/birthdays/streaks for that league still surface.
- **DB query fails for one type:** that type drops, others survive.
- **All-empty result:** frontend renders an empty state ("No recent reports").
- **Total fetch failure:** frontend `ErrorState` with retry, matching `useNews` pattern.
- **Status history empty for first 1–2 weeks:** acceptable; injury rows just don't appear yet.

## Testing Plan

### Backend (Jest)

- `movesParser.test.js` — fixture table of real ESPN strings → expected `{action, fromTeam, toTeam, players[]}`. Cover sign/waive/release/convert/trade/coach + multi-clause + plural positions (`Fs`, `DEs`, `OLs`).
- `streaksReports.test.js` — seeded `stats` rows; verify a 5-game double-double streak surfaces; a broken streak doesn't.
- `birthdaysReports.test.js` — seeded `players.dob` in various string formats; popularity filter.
- `injuriesReports.test.js` — seeded `player_status_history` rows; 30-day window; `prev → new` shape.
- `syncInjuries.test.js` (extend) — assert one history row per *changed* tuple, zero rows on no-op.
- `reportsController.test.js` — supertest, verify `?league` filter, `?type` filter, `limit`/`offset` paging, mixed-league when `league` omitted, `limit` cap at 50.

### Frontend (Vitest)

- `useReports.test.js` — TQ hook with `createWrapper`; query key, params, loading/error states.
- `ReportRow.test.js` — renders correct child component per `report.type`; initials fallback on null `imageUrl`.
- `MoveReportRow.test.js` — NR badge on null `fromTeam` and `toTeam`; team logos link to `/{league}/teams/{abbr}`.
- `ReportsTab.test.js` — type filter changes refetch; Load More appends.
- `LeaguePage.test.js` (extend) — `?tab=reports` deep link initializes the right tab; `pickTab` updates URL.

## Open Questions

- **`players.dob` format.** Schema lists it as `String?`; need to verify ingest format (likely `YYYY-MM-DD`) before writing the birthday SQL. If formats vary by league, normalize during read.
- **Streak threshold tuning.** Initial thresholds are educated guesses; expect adjustment after first week of real data — too many noisy 3-game NFL streaks may need bumping to 4.
- **Trade direction parsing.** ESPN trade descriptions vary (`"to/from/for TEAM"`, sometimes with team city, sometimes abbreviation, sometimes nickname). Parser falls back to `from = announcing team, to = NR` when unresolvable. Acceptable for v1; may need a follow-up if trades feel wrong.
