# Streak Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist streak events (player stat streaks + team W/L streaks) in a `streak_events` table populated by the upsert worker, replacing the live-computed Reports streak feed so streaks stay in the feed for 30 days after they break.

**Architecture:** New table `streak_events`, new worker module `backend/src/ingestion/streakEvents.js` invoked from `runUpsert` per league, rewritten read function in `backend/src/services/reports/streaksReports.js` that queries the table with a 30-day cutoff, and `StreakReportRow.jsx` extended to render team variants.

**Tech Stack:** PostgreSQL (raw SQL via `pg`), Prisma (schema only — migration applied manually), Express, Jest (backend tests), React + Vitest (frontend tests).

**Reference spec:** `docs/superpowers/specs/2026-04-30-streak-events-design.md`

---

## File Structure

**Create:**
- `backend/prisma/migrations/20260430100000_add_streak_events/migration.sql` — DDL
- `backend/src/ingestion/streakEvents.js` — `updateStreakEvents(pool, league)` worker
- `backend/__tests__/ingestion/streakEvents.test.js` — worker tests

**Modify:**
- `backend/prisma/schema.prisma` — add `streak_events` model
- `backend/src/ingestion/pipeline/upsert.js` — wire in `updateStreakEvents` + reports cache invalidate
- `backend/src/services/reports/streaksReports.js` — replace `getStreaksForLeague` to read from table
- `backend/__tests__/services/reports/streaksReports.test.js` — replace tests for new shape
- `frontend/src/components/reports/StreakReportRow.jsx` — branch player vs team
- `frontend/src/__tests__/components/ReportRow.test.jsx` — add team-streak fixture

---

## Task 1: Add streak_events table + Prisma model

**Files:**
- Create: `backend/prisma/migrations/20260430100000_add_streak_events/migration.sql`
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Create migration directory and SQL file**

```bash
mkdir -p backend/prisma/migrations/20260430100000_add_streak_events
```

Create `backend/prisma/migrations/20260430100000_add_streak_events/migration.sql`:

```sql
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

- [ ] **Step 2: Add Prisma model**

In `backend/prisma/schema.prisma`, add at the bottom (after the last existing model):

```prisma
model streak_events {
  id              Int      @id @default(autoincrement())
  league          String   @db.VarChar(10)
  subject_type    String   @db.VarChar(10)
  subject_id      Int
  stat_label      String   @db.VarChar(40)
  length          Int
  start_game_date DateTime @db.Date
  last_game_date  DateTime @db.Date
  is_active       Boolean  @default(true)
  detected_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([subject_type, subject_id, stat_label, start_game_date], map: "streak_events_unique")
  @@index([league, last_game_date(sort: Desc)], map: "streak_events_feed_idx")
}
```

- [ ] **Step 3: Apply migration locally and mark applied**

```bash
psql $DATABASE_URL -f backend/prisma/migrations/20260430100000_add_streak_events/migration.sql
cd backend && node_modules/.bin/prisma migrate resolve --applied 20260430100000_add_streak_events
```

Expected: psql reports `CREATE TABLE`, `CREATE INDEX`, `CREATE INDEX`. Prisma reports migration marked applied.

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd backend && node_modules/.bin/prisma generate
```

Expected: "Generated Prisma Client".

- [ ] **Step 5: Verify table exists**

```bash
psql $DATABASE_URL -c "\d streak_events"
```

Expected: shows the table with all columns and the unique constraint.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/migrations/20260430100000_add_streak_events backend/prisma/schema.prisma
git commit -m "feat(db): add streak_events table"
```

---

## Task 2: Worker — player streaks

**Files:**
- Create: `backend/src/ingestion/streakEvents.js`
- Create: `backend/__tests__/ingestion/streakEvents.test.js`

- [ ] **Step 1: Write the failing tests for player streaks**

Create `backend/__tests__/ingestion/streakEvents.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { updateStreakEvents } = await import(
  resolve(__dirname, "../../src/ingestion/streakEvents.js"),
);

describe("updateStreakEvents — player streaks", () => {
  let pool;
  let client;

  beforeEach(() => {
    pool = createMockPool();
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    jest.clearAllMocks();
  });

  it("opens a transaction and releases the client", async () => {
    // All scan queries return empty result sets
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("scans player streaks for the requested league only", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [, params] of scanCalls) {
      expect(params[0]).toBe("nba");
    }
  });

  it("upserts active player streaks via ON CONFLICT", async () => {
    // Minimal: one DD scan returns one row, others return empty
    client.query.mockImplementation(async (sql, params) => {
      if (typeof sql !== "string") return { rows: [] };
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (/double-double/i.test(sql) && /FROM stats/i.test(sql)) {
        return {
          rows: [
            {
              subject_id: 4234,
              length: 5,
              start_game_date: "2026-04-20",
              last_game_date: "2026-04-29",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await updateStreakEvents(pool, "nba");

    const upsertCall = client.query.mock.calls.find(
      (c) => typeof c[0] === "string" && /INSERT INTO streak_events/i.test(c[0]),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall[0]).toMatch(/ON CONFLICT.*DO UPDATE/i);
    // Params include subject_type='player', subject_id=4234, label='double-double'
    const params = upsertCall[1];
    expect(params).toEqual(expect.arrayContaining(["player", 4234, "double-double"]));
  });

  it("deactivates rows that fall out of the active set", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const deactivate = client.query.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        /UPDATE streak_events/i.test(c[0]) &&
        /is_active\s*=\s*FALSE/i.test(c[0]),
    );
    expect(deactivate).toBeDefined();
    expect(deactivate[0]).toMatch(/league\s*=\s*\$1/);
    expect(deactivate[1][0]).toBe("nba");
  });

  it("rolls back on error and releases the client", async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === "BEGIN") return { rows: [] };
      throw new Error("boom");
    });

    await expect(updateStreakEvents(pool, "nba")).rejects.toThrow("boom");

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("uses NBA threshold of 4 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    // Threshold passed as second param ($2) on each scan
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe(4);
    }
  });

  it("uses NFL threshold of 3 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nfl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe(3);
    }
  });

  it("uses NHL threshold of 3 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nhl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe(3);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- streakEvents
```

Expected: FAIL — "Cannot find module '.../src/ingestion/streakEvents.js'".

- [ ] **Step 3: Implement player-streak portion of the worker**

Create `backend/src/ingestion/streakEvents.js`:

```js
import logger from "../logger.js";

const log = logger.child({ worker: "streakEvents" });

const PLAYER_STATS_BY_LEAGUE = {
  nba: [
    { label: "double-double",  expr: "(s.points >= 10 AND s.rebounds >= 10)" },
    { label: "triple-double",  expr: "(s.points >= 10 AND s.rebounds >= 10 AND s.assists >= 10)" },
    { label: "30+ point",      expr: "(s.points >= 30)" },
    { label: "20+ point",      expr: "(s.points >= 20)" },
    { label: "10+ rebound",    expr: "(s.rebounds >= 10)" },
    { label: "10+ assist",     expr: "(s.assists >= 10)" },
  ],
  nfl: [
    { label: "100+ yard",      expr: "(s.cmpatt IS NULL  AND s.yds >= 100)" },
    { label: "2+ TD",          expr: "(s.cmpatt IS NULL  AND s.td  >= 2)" },
    { label: "250+ pass yard", expr: "(s.cmpatt IS NOT NULL AND s.yds >= 250)" },
    { label: "2+ pass TD",     expr: "(s.cmpatt IS NOT NULL AND s.td  >= 2)" },
  ],
  nhl: [
    { label: "multi-point",    expr: "((s.g + s.a) >= 2)" },
    { label: "goal",           expr: "(s.g >= 1)" },
  ],
};

const PLAYER_THRESHOLD = { nba: 4, nfl: 3, nhl: 3 };

const RECENT_WINDOW_DAYS = 60;

function buildPlayerScanSQL(statExpr, statLabel) {
  return `
    WITH recent AS (
      SELECT s.playerid AS subject_id,
             g.date,
             ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
             ${statExpr} AS meets
      FROM stats s
      JOIN games g ON g.id = s.gameid
      JOIN players p ON p.id = s.playerid
      WHERE p.league = $1
        AND g.type IN ('regular','makeup','playoff')
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
    ),
    streaks AS (
      SELECT subject_id,
             LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT meets) - 1, COUNT(*)), COUNT(*))::int AS length,
             BOOL_AND(meets) FILTER (WHERE rn = 1) AS most_recent_ok,
             MAX(date)       FILTER (WHERE rn = 1) AS last_game_date
      FROM recent
      GROUP BY subject_id
    )
    SELECT s.subject_id,
           s.length,
           r.date AS start_game_date,
           s.last_game_date
    FROM streaks s
    JOIN recent r ON r.subject_id = s.subject_id AND r.rn = s.length
    WHERE s.length >= $2
      AND s.most_recent_ok = TRUE
  `;
}

async function scanPlayerStreaks(client, league) {
  const stats = PLAYER_STATS_BY_LEAGUE[league] || [];
  const threshold = PLAYER_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const { label, expr } of stats) {
    const sql = buildPlayerScanSQL(expr, label);
    const { rows } = await client.query(sql, [league, threshold]);
    for (const row of rows) {
      out.push({
        subject_type: "player",
        subject_id: row.subject_id,
        stat_label: label,
        length: row.length,
        start_game_date: row.start_game_date,
        last_game_date: row.last_game_date,
      });
    }
  }
  return out;
}

async function upsertActiveRows(client, league, active) {
  if (active.length === 0) return;
  // Build VALUES with parameterized placeholders, 7 columns per row.
  const cols = ["league", "subject_type", "subject_id", "stat_label", "length", "start_game_date", "last_game_date"];
  const valuesSQL = active
    .map((_, i) => {
      const base = i * cols.length;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
    })
    .join(",");
  const params = [];
  for (const r of active) {
    params.push(league, r.subject_type, r.subject_id, r.stat_label, r.length, r.start_game_date, r.last_game_date);
  }
  const sql = `
    INSERT INTO streak_events (
      league, subject_type, subject_id, stat_label, length, start_game_date, last_game_date
    )
    VALUES ${valuesSQL}
    ON CONFLICT (subject_type, subject_id, stat_label, start_game_date)
    DO UPDATE SET
      length         = EXCLUDED.length,
      last_game_date = EXCLUDED.last_game_date,
      is_active      = TRUE,
      updated_at     = NOW()
  `;
  await client.query(sql, params);
}

async function deactivateMissing(client, league, active) {
  // Build a temp table of identity tuples, then anti-join.
  await client.query(`
    CREATE TEMP TABLE active_now (
      subject_type    VARCHAR(10),
      subject_id      INT,
      stat_label      VARCHAR(40),
      start_game_date DATE
    ) ON COMMIT DROP
  `);
  if (active.length > 0) {
    const valuesSQL = active
      .map((_, i) => {
        const base = i * 4;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
      })
      .join(",");
    const params = [];
    for (const r of active) {
      params.push(r.subject_type, r.subject_id, r.stat_label, r.start_game_date);
    }
    await client.query(
      `INSERT INTO active_now (subject_type, subject_id, stat_label, start_game_date) VALUES ${valuesSQL}`,
      params,
    );
  }
  await client.query(
    `
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
      )
    `,
    [league],
  );
}

export async function updateStreakEvents(pool, league) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const players = await scanPlayerStreaks(client, league);
    const active = players;
    await upsertActiveRows(client, league, active);
    await deactivateMissing(client, league, active);
    await client.query("COMMIT");
    log.info({ league, active: active.length }, "streak events updated");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- streakEvents
```

Expected: PASS for all 8 tests in this task.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/streakEvents.js backend/__tests__/ingestion/streakEvents.test.js
git commit -m "feat(ingestion): add streak events worker for player streaks"
```

---

## Task 3: Worker — team W/L streaks

**Files:**
- Modify: `backend/src/ingestion/streakEvents.js`
- Modify: `backend/__tests__/ingestion/streakEvents.test.js`

- [ ] **Step 1: Add failing team-streak tests**

Append inside the existing `describe("updateStreakEvents — player streaks", ...)` file, as a new sibling describe block:

```js
describe("updateStreakEvents — team streaks", () => {
  let pool;
  let client;

  beforeEach(() => {
    pool = createMockPool();
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    jest.clearAllMocks();
  });

  it("scans team W/L streaks from games for the requested league", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]) && /hometeamid|awayteamid/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [, params] of scanCalls) {
      expect(params[0]).toBe("nba");
    }
  });

  it("filters team scans by threshold of 3", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe(3);
    }
  });

  it("upserts active team streaks with subject_type='team'", async () => {
    client.query.mockImplementation(async (sql) => {
      if (typeof sql !== "string") return { rows: [] };
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (/FROM games/i.test(sql) && /win/i.test(sql)) {
        return {
          rows: [
            {
              subject_id: 13,
              stat_label: "win",
              length: 5,
              start_game_date: "2026-04-20",
              last_game_date: "2026-04-29",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await updateStreakEvents(pool, "nba");

    const upsertCall = client.query.mock.calls.find(
      (c) => typeof c[0] === "string" && /INSERT INTO streak_events/i.test(c[0]),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall[1]).toEqual(expect.arrayContaining(["team", 13, "win"]));
  });

  it("ignores tied games (homescore = awayscore)", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nfl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]),
    );
    for (const [sql] of scanCalls) {
      expect(sql).toMatch(/homescore\s*<>\s*awayscore/);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

```bash
cd backend && npm test -- streakEvents
```

Expected: New tests FAIL (no team scan calls in current worker).

- [ ] **Step 3: Add team-streak SQL and integrate**

Edit `backend/src/ingestion/streakEvents.js`. Add `TEAM_THRESHOLD` and `scanTeamStreaks`, then call it inside `updateStreakEvents` and merge into `active`.

Add at the top, near `PLAYER_THRESHOLD`:

```js
const TEAM_THRESHOLD = { nba: 3, nfl: 3, nhl: 3 };
```

Add `scanTeamStreaks` (place it after `scanPlayerStreaks`):

```js
function buildTeamScanSQL(outcomeCol /* 'won' | 'lost' */, statLabel) {
  return `
    WITH team_games AS (
      SELECT g.hometeamid AS team_id, g.date,
             (g.homescore > g.awayscore) AS won,
             (g.homescore < g.awayscore) AS lost
      FROM games g
      JOIN teams t ON t.id = g.hometeamid
      WHERE t.league = $1
        AND g.type IN ('regular','makeup','playoff')
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
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
        AND g.date > CURRENT_DATE - INTERVAL '${RECENT_WINDOW_DAYS} days'
        AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
        AND g.homescore <> g.awayscore
    ),
    ranked AS (
      SELECT team_id, date, won, lost,
             ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY date DESC) AS rn
      FROM team_games
    ),
    streaks AS (
      SELECT team_id,
             LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT ${outcomeCol}) - 1, COUNT(*)), COUNT(*))::int AS length,
             BOOL_AND(${outcomeCol}) FILTER (WHERE rn = 1) AS most_recent_ok,
             MAX(date) FILTER (WHERE rn = 1) AS last_game_date
      FROM ranked
      GROUP BY team_id
    )
    SELECT s.team_id        AS subject_id,
           '${statLabel}'   AS stat_label,
           s.length,
           r.date           AS start_game_date,
           s.last_game_date
    FROM streaks s
    JOIN ranked r ON r.team_id = s.team_id AND r.rn = s.length
    WHERE s.length >= $2 AND s.most_recent_ok = TRUE
  `;
}

async function scanTeamStreaks(client, league) {
  const threshold = TEAM_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const [outcomeCol, label] of [["won", "win"], ["lost", "loss"]]) {
    const sql = buildTeamScanSQL(outcomeCol, label);
    const { rows } = await client.query(sql, [league, threshold]);
    for (const row of rows) {
      out.push({
        subject_type: "team",
        subject_id: row.subject_id,
        stat_label: row.stat_label,
        length: row.length,
        start_game_date: row.start_game_date,
        last_game_date: row.last_game_date,
      });
    }
  }
  return out;
}
```

Update the body of `updateStreakEvents` so the active set merges players + teams:

```js
export async function updateStreakEvents(pool, league) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const players = await scanPlayerStreaks(client, league);
    const teams   = await scanTeamStreaks(client, league);
    const active  = [...players, ...teams];
    await upsertActiveRows(client, league, active);
    await deactivateMissing(client, league, active);
    await client.query("COMMIT");
    log.info({ league, active: active.length }, "streak events updated");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- streakEvents
```

Expected: PASS for all team and player tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/streakEvents.js backend/__tests__/ingestion/streakEvents.test.js
git commit -m "feat(ingestion): add team W/L streak scanning"
```

---

## Task 4: Wire worker into upsert.js

**Files:**
- Modify: `backend/src/ingestion/pipeline/upsert.js`
- Modify: `backend/__tests__/ingestion/upsert.test.js`

- [ ] **Step 1: Inspect existing upsert.test.js to find the per-league flow assertions**

```bash
cd backend && grep -n "syncInjuriesForLeague\|runSeedAwards\|invalidatePattern" __tests__/ingestion/upsert.test.js | head -20
```

This shows where to slot a new mock and assertion.

- [ ] **Step 2: Add a failing test**

Add a test in `backend/__tests__/ingestion/upsert.test.js` (mirror the existing `syncInjuriesForLeague` mock pattern). Inside the existing setup block, add another `unstable_mockModule` for `streakEvents.js`:

```js
const mockUpdateStreakEvents = jest.fn().mockResolvedValue();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/streakEvents.js"),
  () => ({ updateStreakEvents: mockUpdateStreakEvents }),
);
```

Then add a test (place near the other per-league behavior tests):

```js
it("calls updateStreakEvents once per league", async () => {
  await runUpsert(mockPool);
  expect(mockUpdateStreakEvents).toHaveBeenCalledTimes(3);
  expect(mockUpdateStreakEvents).toHaveBeenCalledWith(mockPool, "nba");
  expect(mockUpdateStreakEvents).toHaveBeenCalledWith(mockPool, "nfl");
  expect(mockUpdateStreakEvents).toHaveBeenCalledWith(mockPool, "nhl");
});

it("invalidates the reports cache key per league", async () => {
  await runUpsert(mockPool);
  const patterns = mockInvalidatePattern.mock.calls.map((c) => c[0]);
  expect(patterns).toContain("reports:list:nba");
  expect(patterns).toContain("reports:list:nfl");
  expect(patterns).toContain("reports:list:nhl");
});

it("does not block the rest of the pipeline if streak events throws", async () => {
  mockUpdateStreakEvents.mockRejectedValueOnce(new Error("boom"));
  await runUpsert(mockPool);
  // refreshPopularity still ran → pipeline continued past the failure
  expect(mockRefreshPopularity).toHaveBeenCalled();
});
```

`mockInvalidatePattern` and `mockRefreshPopularity` already exist in this file (declared near the top alongside the other module mocks). Reuse them directly.

- [ ] **Step 3: Run tests to verify failures**

```bash
cd backend && npm test -- upsert.test
```

Expected: New tests FAIL (`mockUpdateStreakEvents` not called; `reports:list:` not invalidated).

- [ ] **Step 4: Wire the worker into `upsert.js`**

Edit `backend/src/ingestion/pipeline/upsert.js`. Add the import near the top alongside other ingestion imports:

```js
import { updateStreakEvents } from "../streakEvents.js";
```

Inside the per-league `for (const league of leagues)` block, after the awards `try` and before the `invalidatePattern` calls, add:

```js
try {
  await updateStreakEvents(pool, league);
} catch (err) {
  log.error({ err, league }, "failed updating streak events");
}
```

In the cache-invalidation block (right after the existing `await invalidatePattern(\`games:${league}:*\`);` etc.), add:

```js
await invalidatePattern(`reports:list:${league}`);
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- upsert.test
```

Expected: PASS for new tests and existing tests.

- [ ] **Step 6: Run full backend lint+test**

```bash
cd backend && npm run verify
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/ingestion/pipeline/upsert.js backend/__tests__/ingestion/upsert.test.js
git commit -m "feat(ingestion): wire streak events worker into runUpsert"
```

---

## Task 5: Replace `streaksReports.js` read path

**Files:**
- Modify: `backend/src/services/reports/streaksReports.js`
- Modify: `backend/__tests__/services/reports/streaksReports.test.js`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `backend/__tests__/services/reports/streaksReports.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery },
}));

const { getStreaksForLeague } = await import(
  resolve(__dirname, "../../../src/services/reports/streaksReports.js"),
);

describe("getStreaksForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries streak_events with a 30-day cutoff for the given league", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await getStreaksForLeague("nba");

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/FROM streak_events/i);
    expect(sql).toMatch(/last_game_date\s*>\s*CURRENT_DATE\s*-\s*INTERVAL\s*'30 days'/i);
    expect(sql).toMatch(/ORDER BY.*last_game_date DESC/i);
    expect(params).toEqual(["nba"]);
  });

  it("maps player rows into player streak reports", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "player",
          subject_id: 4234,
          stat_label: "double-double",
          length: 5,
          last_game_date: new Date("2026-04-29"),
          start_game_date: new Date("2026-04-20"),
          player_name: "Nikola Jokić",
          player_image: "https://espn.com/x.png",
          team_name: null, team_location: null, team_shortname: null,
          team_logo: null, team_abbr: null,
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "streak",
      league: "nba",
      streakLength: 5,
      statLabel: "double-double",
      emoji: "🔥",
      player: { id: 4234, name: "Nikola Jokić", imageUrl: "https://espn.com/x.png", league: "nba" },
    });
    expect(out[0].id).toMatch(/^streak-player-4234-double-double/);
    expect(out[0].team).toBeUndefined();
  });

  it("maps team win rows into team streak reports", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "team",
          subject_id: 13,
          stat_label: "win",
          length: 5,
          last_game_date: new Date("2026-04-29"),
          start_game_date: new Date("2026-04-20"),
          player_name: null, player_image: null,
          team_name: "Nuggets", team_location: "Denver",
          team_shortname: "DEN", team_logo: "https://espn.com/den.png", team_abbr: "DEN",
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "streak",
      league: "nba",
      streakLength: 5,
      statLabel: "win",
      emoji: "🔥",
      team: {
        id: 13, name: "Nuggets", location: "Denver",
        shortname: "DEN", abbreviation: "DEN", logoUrl: "https://espn.com/den.png", league: "nba",
      },
    });
    expect(out[0].player).toBeUndefined();
  });

  it("uses snowflake emoji for loss rows", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "team", subject_id: 7, stat_label: "loss", length: 4,
          last_game_date: new Date("2026-04-29"), start_game_date: new Date("2026-04-22"),
          player_name: null, player_image: null,
          team_name: "Wizards", team_location: "Washington", team_shortname: "WAS",
          team_logo: null, team_abbr: "WAS",
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out[0].emoji).toBe("❄️");
  });

  it("returns [] on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("db"));
    const out = await getStreaksForLeague("nba");
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- streaksReports
```

Expected: FAIL (current implementation queries `stats` and emits old shape).

- [ ] **Step 3: Replace `streaksReports.js`**

Replace the entire contents of `backend/src/services/reports/streaksReports.js`:

```js
import pool from "../../db/db.js";
import logger from "../../logger.js";

const log = logger.child({ module: "streaksReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

const FEED_SQL = `
  SELECT se.subject_type,
         se.subject_id,
         se.stat_label,
         se.length,
         se.start_game_date,
         se.last_game_date,
         p.name           AS player_name,
         p.image_url      AS player_image,
         t.name           AS team_name,
         t.location       AS team_location,
         t.shortname      AS team_shortname,
         t.logo_url       AS team_logo,
         t.abbreviation   AS team_abbr
  FROM streak_events se
  LEFT JOIN players p ON se.subject_type = 'player' AND p.id = se.subject_id
  LEFT JOIN teams   t ON se.subject_type = 'team'   AND t.id = se.subject_id
  WHERE se.league = $1
    AND se.last_game_date > CURRENT_DATE - INTERVAL '30 days'
  ORDER BY se.last_game_date DESC, se.length DESC
  LIMIT 50
`;

function statSlug(label) {
  return label.replace(/\s+/g, "-").toLowerCase();
}

function isoDate(d) {
  if (!d) return null;
  return new Date(d).toISOString();
}

function dateOnly(d) {
  if (!d) return "";
  // Render YYYY-MM-DD for the id, regardless of pg Date object or string.
  const s = typeof d === "string" ? d : new Date(d).toISOString();
  return s.slice(0, 10);
}

function mapRow(r, league) {
  const idBase = `streak-${r.subject_type}-${r.subject_id}-${statSlug(r.stat_label)}-${dateOnly(r.start_game_date)}`;
  const date = isoDate(r.last_game_date);
  const base = {
    id: idBase,
    type: "streak",
    date,
    league,
    streakLength: r.length,
    statLabel: r.stat_label,
  };
  if (r.subject_type === "player") {
    return {
      ...base,
      emoji: "🔥",
      player: {
        id: r.subject_id,
        name: r.player_name,
        slug: slugForName(r.player_name || ""),
        imageUrl: r.player_image,
        league,
      },
    };
  }
  // team
  return {
    ...base,
    emoji: r.stat_label === "win" ? "🔥" : "❄️",
    team: {
      id: r.subject_id,
      name: r.team_name,
      location: r.team_location,
      shortname: r.team_shortname,
      abbreviation: r.team_abbr,
      logoUrl: r.team_logo,
      league,
    },
  };
}

export async function getStreaksForLeague(league) {
  try {
    const result = await pool.query(FEED_SQL, [league]);
    return result.rows.map((r) => mapRow(r, league));
  } catch (err) {
    log.warn({ err: err?.message, league }, "streaks query failed");
    return [];
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- streaksReports
```

Expected: PASS for all 5 tests.

- [ ] **Step 5: Run full backend verify**

```bash
cd backend && npm run verify
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/reports/streaksReports.js backend/__tests__/services/reports/streaksReports.test.js
git commit -m "feat(reports): read streaks from streak_events table"
```

---

## Task 6: Frontend — render team streak rows

**Files:**
- Modify: `frontend/src/components/reports/StreakReportRow.jsx`
- Modify: `frontend/src/__tests__/components/ReportRow.test.jsx`

- [ ] **Step 1: Add a failing test for the team variant**

In `frontend/src/__tests__/components/ReportRow.test.jsx`, add this test inside the existing `describe("ReportRow", ...)`:

```js
it("renders a team win streak with logo and league-team link", () => {
  const team = {
    id: 13, name: "Nuggets", location: "Denver", shortname: "DEN",
    abbreviation: "DEN", logoUrl: "https://espn.com/den.png", league: "nba",
  };
  const r = {
    id: "streak-team-13-win-2026-04-20",
    type: "streak",
    date: "2026-04-29T22:00:00Z",
    league: "nba",
    team,
    streakLength: 5,
    statLabel: "win",
    emoji: "🔥",
  };
  render(inRouter(<ReportRow report={r} />));
  expect(screen.getByText(/5-game win streak/)).toBeInTheDocument();
  expect(screen.getByAltText("Nuggets")).toBeInTheDocument();
  // Link should target the team page using abbreviation
  const link = screen.getByRole("link");
  expect(link.getAttribute("href")).toMatch(/\/nba\/teams\/DEN/i);
});

it("renders a team loss streak with snowflake emoji", () => {
  const team = {
    id: 7, name: "Wizards", location: "Washington", shortname: "WAS",
    abbreviation: "WAS", logoUrl: null, league: "nba",
  };
  const r = {
    id: "streak-team-7-loss-2026-04-22",
    type: "streak",
    date: "2026-04-29T22:00:00Z",
    league: "nba",
    team,
    streakLength: 4,
    statLabel: "loss",
    emoji: "❄️",
  };
  render(inRouter(<ReportRow report={r} />));
  expect(screen.getByText(/4-game loss streak/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd frontend && npm test -- ReportRow
```

Expected: FAIL — `StreakReportRow` doesn't render team data; `getByText(/win streak/)` fails because component reads `report.player`.

- [ ] **Step 3: Update `StreakReportRow.jsx` to handle both variants**

Replace the contents of `frontend/src/components/reports/StreakReportRow.jsx`:

```jsx
import { Link } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

function teamHref(team) {
  const slug = team.abbreviation || team.shortname || team.name;
  return `/${team.league}/teams/${slug}`;
}

function TeamLogo({ team }) {
  if (team?.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.name}
        className="w-9 h-9 rounded-full object-contain bg-surface-overlay border border-white/[0.08] shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = (team?.abbreviation || team?.shortname || team?.name || "?")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay border border-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {initials}
    </div>
  );
}

export default function StreakReportRow({ report }) {
  const { streakLength, statLabel, emoji, date } = report;

  if (report.team) {
    const team = report.team;
    return (
      <Link
        to={teamHref(team)}
        className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200"
      >
        <TeamLogo team={team} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{team.name}</div>
          <div className="text-[13px] text-text-secondary mt-0.5">
            {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
          </div>
        </div>
        <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
      </Link>
    );
  }

  const player = report.player;
  const playerHref = `/${player.league}/players/${player.slug}`;
  return (
    <Link
      to={playerHref}
      className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200"
    >
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{player.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- ReportRow
```

Expected: PASS for all tests in ReportRow.test.jsx, including the two new team-variant tests.

- [ ] **Step 5: Run frontend verify (lint + test + build)**

```bash
cd frontend && npm run verify
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/reports/StreakReportRow.jsx frontend/src/__tests__/components/ReportRow.test.jsx
git commit -m "feat(reports): render team streak rows in ReportsList"
```

---

## Final verification

- [ ] **Step 1: Backend verify**

```bash
cd backend && npm run verify
```

Expected: PASS.

- [ ] **Step 2: Frontend verify**

```bash
cd frontend && npm run verify
```

Expected: PASS.

- [ ] **Step 3: Manual smoke test (local)**

```bash
cd backend && node src/ingestion/pipeline/upsert.js
```

Expected: log lines including `streak events updated` for each league. After the run, `psql $DATABASE_URL -c "SELECT subject_type, COUNT(*) FROM streak_events WHERE is_active GROUP BY subject_type;"` should show non-zero counts for at least one league with active games in the last 60 days.

- [ ] **Step 4: Visual smoke test**

Start backend and frontend dev servers; visit a league page's Reports tab. Verify the streak section renders both player and team rows, links resolve correctly, and emoji match (🔥 for player streaks and team wins, ❄️ for team losses).

- [ ] **Step 5: Push**

```bash
git push origin main
```
