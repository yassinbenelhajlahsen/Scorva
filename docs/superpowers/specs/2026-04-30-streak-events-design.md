# Streak Events — Design Spec

**Date:** 2026-04-30
**Status:** Approved (user)
**Replaces:** Live-computed streaks in `backend/src/services/reports/streaksReports.js` (kept as a query template; the file's read function is rewritten to read from the new table).

## Problem

The Reports feed today computes streaks live from `stats` + `games`. Two consequences:

1. The moment a streak breaks, it disappears from the feed. There's no record of "Jokic just had a 7-game DD streak that ended yesterday."
2. There's no way to add team W/L streaks without bolting another live query onto the read path.

We want streak items to behave like persisted news events: surface when they cross a threshold, persist after they break, age out after a fixed window. We want player and team streaks to share the same machinery.

## Solution

Add a `streak_events` table populated by a worker step inside `runUpsert` (`backend/src/ingestion/pipeline/upsert.js`). The Reports feed reads from this table instead of recomputing from raw stats.

A row represents one streak run, identified by `(subject_type, subject_id, stat_label, start_game_date)`. The row is created when the streak first crosses the threshold and updated as the streak extends. When the streak breaks, the row is marked `is_active = false` but stays in the table. The feed shows rows whose `last_game_date` is within the last 30 days, sorted by `last_game_date DESC`.

## Schema

```sql
-- backend/prisma/migrations/20260430100000_add_streak_events/migration.sql

CREATE TABLE streak_events (
  id              SERIAL PRIMARY KEY,
  league          VARCHAR(10)  NOT NULL,
  subject_type    VARCHAR(10)  NOT NULL CHECK (subject_type IN ('player','team')),
  subject_id      INT          NOT NULL,
  stat_label      VARCHAR(40)  NOT NULL,
  length          INT          NOT NULL,
  start_game_date DATE         NOT NULL,
  last_game_date  DATE         NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT streak_events_unique
    UNIQUE (subject_type, subject_id, stat_label, start_game_date)
);

CREATE INDEX streak_events_feed_idx
  ON streak_events (league, last_game_date DESC);

CREATE INDEX streak_events_active_idx
  ON streak_events (league, subject_type, subject_id)
  WHERE is_active = TRUE;
```

**Notes:**
- No FK on `subject_id` — it's polymorphic across `players` and `teams`. If a player or team is deleted, orphan rows stay; we accept that until/unless it becomes a problem.
- The `streak_events_feed_idx` is unfiltered (not a partial index) — feed queries always filter by `last_game_date > now - 30 days`, so the index covers the hot path. A partial index with a hard-coded `CURRENT_DATE - INTERVAL` predicate is not immutable in Postgres and gets rejected.
- `streak_events_unique` is the upsert target.
- Migration applied via raw SQL + `prisma migrate resolve --applied <name>` per established Scorva workflow (shadow-DB issues with `prisma migrate dev` locally).
- Update `backend/prisma/schema.prisma` with the corresponding model so Prisma stays in sync.

## Stat labels & thresholds

| League | Subject | Stat labels                                                                                            | Min length |
|--------|---------|--------------------------------------------------------------------------------------------------------|------------|
| nba    | player  | `double-double`, `triple-double`, `30+ point`, `20+ point`, `10+ rebound`, `10+ assist`                | 4          |
| nfl    | player  | `100+ yard`, `2+ TD`, `250+ pass yard`, `2+ pass TD`                                                   | 3          |
| nhl    | player  | `multi-point`, `goal`                                                                                  | 3          |
| nba    | team    | `win`, `loss`                                                                                          | 3          |
| nfl    | team    | `win`, `loss`                                                                                          | 3          |
| nhl    | team    | `win`, `loss`                                                                                          | 3          |

Player thresholds and stat criteria match the existing `streaksReports.js` exactly.

**NHL OTL handling:** an OT loss is treated as a regular loss for streak purposes (breaks W streak, extends L streak). Rationale: the `games` table records a non-tied final score regardless of regulation/OT/SO outcome. So `homescore != awayscore` is sufficient; no extra column read needed.

**Ties:** ignore games where `homescore = awayscore` (extremely rare in NFL, never in others).

## Worker

**New file:** `backend/src/ingestion/streakEvents.js`

**Exported:** `updateStreakEvents(pool, league)`

**Three steps per league per upsert run, all in one transaction:**

### Step 1 — Compute current active player streaks

One SQL query per league with the same shape as `streaksReports.js` but extended to surface `start_game_date`. The `start_game_date` is the date of the earliest game in the current consecutive run — i.e. the game at row-number `length` (the last game still inside the streak when ordered DESC by date).

```sql
WITH recent AS (
  SELECT s.playerid AS subject_id,
         g.date,
         ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
         (s.points >= 10 AND s.rebounds >= 10) AS dd,
         /* ... other stat bools per league ... */
  FROM stats s
  JOIN games g ON g.id = s.gameid
  JOIN players p ON p.id = s.playerid
  WHERE p.league = $1 AND g.type IN ('regular','makeup','playoff')
    AND g.date > CURRENT_DATE - INTERVAL '60 days'
),
streaks AS (
  SELECT
    subject_id,
    'double-double' AS stat_label,
    LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT dd) - 1, COUNT(*)), COUNT(*))::int AS length,
    BOOL_AND(dd) FILTER (WHERE rn = 1)             AS most_recent_ok,
    MAX(date) FILTER (WHERE rn = 1)                AS last_game_date
  FROM recent GROUP BY subject_id
  /* UNION ALL one block per stat */
),
with_start AS (
  /* For each (subject, stat) where length > 0, find date at rn = length */
  SELECT s.*, r.date AS start_game_date
  FROM streaks s
  JOIN recent r ON r.subject_id = s.subject_id AND r.rn = s.length
)
SELECT 'player' AS subject_type, subject_id, stat_label, length, start_game_date, last_game_date
FROM with_start
WHERE length >= $2 AND most_recent_ok = TRUE;
```

NBA threshold `$2 = 4`, NFL `$2 = 3`, NHL `$2 = 3`.

**Implementation note:** prefer one query per `(stat_label, threshold)` pair, concatenated in JS. It's clearer than a multi-stat CTE with per-stat `start_game_date` joins, and performance is fine at this volume (~500 players × 6 stats × 1 query = 3000 row scans per league).

### Step 2 — Compute current active team streaks

```sql
WITH team_games AS (
  SELECT g.hometeamid AS team_id, g.date,
         (g.homescore > g.awayscore) AS won,
         (g.homescore < g.awayscore) AS lost
  FROM games g
  JOIN teams t ON t.id = g.hometeamid
  WHERE t.league = $1
    AND g.type IN ('regular','makeup','playoff')
    AND g.date > CURRENT_DATE - INTERVAL '60 days'
    AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
    AND g.homescore <> g.awayscore
  UNION ALL
  SELECT g.awayteamid, g.date,
         (g.awayscore > g.homescore),
         (g.awayscore < g.homescore)
  FROM games g
  JOIN teams t ON t.id = g.awayteamid
  WHERE t.league = $1
    AND g.type IN ('regular','makeup','playoff')
    AND g.date > CURRENT_DATE - INTERVAL '60 days'
    AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
    AND g.homescore <> g.awayscore
),
ranked AS (
  SELECT team_id, date, won, lost,
         ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY date DESC) AS rn
  FROM team_games
),
win_streaks AS (
  SELECT team_id,
    'win' AS stat_label,
    LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT won) - 1, COUNT(*)), COUNT(*))::int AS length,
    BOOL_AND(won) FILTER (WHERE rn = 1) AS most_recent_ok,
    MAX(date) FILTER (WHERE rn = 1) AS last_game_date
  FROM ranked GROUP BY team_id
),
loss_streaks AS (
  SELECT team_id, 'loss' AS stat_label,
    LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT lost) - 1, COUNT(*)), COUNT(*))::int AS length,
    BOOL_AND(lost) FILTER (WHERE rn = 1),
    MAX(date) FILTER (WHERE rn = 1)
  FROM ranked GROUP BY team_id
)
SELECT 'team', team_id, stat_label, length,
       (SELECT date FROM ranked r WHERE r.team_id = ws.team_id AND r.rn = ws.length) AS start_game_date,
       last_game_date
FROM win_streaks ws WHERE length >= 3 AND most_recent_ok = TRUE
UNION ALL
SELECT 'team', team_id, 'loss', length,
       (SELECT date FROM ranked r WHERE r.team_id = ls.team_id AND r.rn = ls.length),
       last_game_date
FROM loss_streaks ls WHERE length >= 3 AND most_recent_ok = TRUE;
```

A team will have at most one of `win` / `loss` active at a time (mutually exclusive: their most recent game was either a W or an L).

### Step 3 — Reconcile against `streak_events`

```sql
BEGIN;

-- 3a. Upsert all currently-active rows from steps 1 + 2
INSERT INTO streak_events (
  league, subject_type, subject_id, stat_label,
  length, start_game_date, last_game_date, is_active, updated_at
)
VALUES /* ... rows from steps 1+2 ... */
ON CONFLICT (subject_type, subject_id, stat_label, start_game_date)
DO UPDATE SET
  length         = EXCLUDED.length,
  last_game_date = EXCLUDED.last_game_date,
  is_active      = TRUE,
  updated_at     = NOW();

-- 3b. Deactivate rows that were active for this league but are no longer
--     in the active set. Use a temp table to avoid a giant NOT IN.
CREATE TEMP TABLE active_now (
  subject_type    VARCHAR(10),
  subject_id      INT,
  stat_label      VARCHAR(40),
  start_game_date DATE
) ON COMMIT DROP;

INSERT INTO active_now VALUES /* ... same identity tuples ... */;

UPDATE streak_events se
SET is_active = FALSE, updated_at = NOW()
WHERE se.league = $1
  AND se.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM active_now a
    WHERE a.subject_type    = se.subject_type
      AND a.subject_id      = se.subject_id
      AND a.stat_label      = se.stat_label
      AND a.start_game_date = se.start_game_date
  );

COMMIT;
```

**Edge case — empty active set:** if steps 1+2 produce zero active rows for a league (e.g. early preseason), skip the INSERT entirely. The deactivation pass still runs to flip any previously-active rows.

**Implementation note for VALUES list:** use parameterized batch insert via `pg`'s array-style placeholders or `pg-format`. Don't string-concatenate values into SQL.

The whole thing wraps in a `try/catch` and logs `log.error({ err, league }, "failed updating streak events")` on failure — the caller's outer try/catch already swallows that, matching the existing isolation pattern for `cleanupClinchedPlayoffGames`, `syncInjuriesForLeague`, and `runSeedAwards`.

## Integration with `upsert.js`

In `runUpsert`, inside the per-league `for` loop, after `runSeedAwards` and before the `invalidatePattern` calls:

```js
try {
  await updateStreakEvents(pool, league);
} catch (err) {
  log.error({ err, league }, "failed updating streak events");
}
```

Add `await invalidatePattern(`reports:list:${league}`);` to the cache invalidation block (the reports key is not currently invalidated by upsert because it auto-expires every 5 minutes; but we want fresh streak events visible immediately after a worker run).

## Read path — replace `streaksReports.js`

Rewrite `getStreaksForLeague(league)` in `backend/src/services/reports/streaksReports.js`:

```sql
SELECT se.subject_type,
       se.subject_id,
       se.stat_label,
       se.length,
       se.last_game_date,
       p.name      AS player_name,
       p.image_url AS player_image,
       t.name      AS team_name,
       t.location  AS team_location,
       t.shortname AS team_shortname,
       t.logo_url  AS team_logo,
       t.abbreviation AS team_abbr
FROM streak_events se
LEFT JOIN players p ON se.subject_type = 'player' AND p.id = se.subject_id
LEFT JOIN teams   t ON se.subject_type = 'team'   AND t.id = se.subject_id
WHERE se.league = $1
  AND se.last_game_date > CURRENT_DATE - INTERVAL '30 days'
ORDER BY se.last_game_date DESC, se.length DESC
LIMIT 50;
```

Map rows into the same `type: "streak"` report shape used today, with two variants distinguished by `subject_type`:

```js
// Player row
{
  id: `streak-player-${subject_id}-${stat_label_slug}-${start_game_date}`,
  type: "streak",
  date: ISO from last_game_date,
  league,
  player: { id, name, slug, imageUrl, league },
  streakLength: length,
  statLabel: stat_label,
  emoji: "🔥"
}

// Team row
{
  id: `streak-team-${subject_id}-${stat_label_slug}-${start_game_date}`,
  type: "streak",
  date: ISO from last_game_date,
  league,
  team: { id, name, location, shortname, abbreviation, logoUrl, league },
  streakLength: length,
  statLabel: stat_label,        // 'win' or 'loss'
  emoji: stat_label === 'win' ? "🔥" : "❄️"
}
```

The id changes shape (now includes `subject_type` and `start_game_date`) — this is fine because the id is opaque to the frontend; it's only used as a React key.

## Frontend changes

**`frontend/src/components/reports/StreakReportRow.jsx`** — extend to handle both player and team variants. Branch on `report.team` vs `report.player`:

- Player branch: existing behavior.
- Team branch: link to `/${league}/teams/${team-abbreviation-or-name}`, render team logo as inline `<img src={team.logoUrl}>` matching the styling pattern used in `frontend/src/components/favorites/FavoriteTeamsSection.jsx` and `frontend/src/components/playoffs/SeriesCard.jsx` (no shared `TeamLogo` component exists). Show `"{team name} — {length}-game {win|loss} streak {emoji}"`.

Existing `frontend/src/__tests__/components/ReportRow.test.jsx` and `ReportsTab.test.jsx` may have streak fixtures with the old id shape — update fixtures, add a team-streak fixture.

## Tests

**Backend:**

- `backend/__tests__/ingestion/streakEvents.test.js` — unit tests for `updateStreakEvents`:
  - Empty source data → no rows inserted, no errors.
  - Player crosses threshold → row inserted with correct length, start/last dates, `is_active = true`.
  - Player extends streak across runs → existing row updated (length grows, start_game_date unchanged).
  - Player streak breaks → previously-active row flipped to `is_active = false`, row not deleted.
  - Player has injury gap (within 60-day window) then resumes → same row continues (start_game_date unchanged).
  - Team win streak crosses threshold; loss in next game → win row deactivated; if loss reaches threshold, new loss row inserted.
  - Mock `pool.query` per established backend test pattern; assert SQL calls, no actual DB.

- `backend/__tests__/services/reports/streaksReports.test.js` — replace existing tests:
  - 30-day cutoff filter applied.
  - Active and broken streaks both surface.
  - Player rows mapped correctly (including slug).
  - Team rows mapped correctly (with team fields).

**Frontend:**

- Extend `frontend/src/__tests__/components/ReportRow.test.jsx` with a team-streak fixture; assert team name + logo render, link points to team page.

## Out of scope

- Player- and team-page "streak history" surfaces (older than 30-day feed cutoff). Tracked separately.
- Pruning of orphan rows when a player/team is deleted.
- Backfill of historical streaks from before the table existed. The first worker run populates currently-active streaks only.

## Migration & deployment

1. Apply migration SQL manually to local DB: `psql $DATABASE_URL -f backend/prisma/migrations/20260430100000_add_streak_events/migration.sql`.
2. `cd backend && node_modules/.bin/prisma migrate resolve --applied 20260430100000_add_streak_events`.
3. Update `backend/prisma/schema.prisma` to declare the new model.
4. `cd backend && node_modules/.bin/prisma generate`.
5. Run `cd backend && node src/ingestion/pipeline/upsert.js` once locally to populate. Confirm rows present.
6. Production: `prisma migrate deploy` will apply the migration; the next scheduled `runUpsert` populates the table.

## Risks

- **Worker latency.** Adds another step per league inside `runUpsert`. Volume is small (~3K rows max per league); expected runtime <1s per league. Isolated try/catch ensures a failure here doesn't block the rest of the pipeline.
- **NHL OTL semantics.** If at some point you want OTL to *not* count as a regular L (separate `otl-streak` label), this design needs revisiting. Today's choice: OTL counts as a loss.
- **30-day feed cutoff is a hard wall.** A streak that hasn't been touched in 31 days disappears from the feed even if it was a notable run. Acceptable per user direction; revisit when the streak-history page lands.
- **60-day worker scan window edge case.** The worker only sees games in the last 60 days. A player with an active streak who misses >60 days (rare — long-term injury during season, or end-of-season into next preseason) will fall out of the active set on the next worker run, and the row will be deactivated. When they return and resume, the worker will see only the post-return games and start a new streak run. Acceptable for normal in-season use; the existing `streaksReports.js` has the same window.
