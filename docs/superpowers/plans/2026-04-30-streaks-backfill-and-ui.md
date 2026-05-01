# Streaks — Backfill + Player/Team UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 60-day rolling window in the streak scan with a current-season filter, add a one-time backfill script, and surface each player's/team's top active streak as an inline `StreakBadge` on `PlayerPage` and `TeamPage`.

**Architecture:** Backend ships two dedicated streak endpoints (`/:league/players/:slug/streak`, `/:league/teams/:teamId/streak`) backed by a shared `streaksService.getActiveStreak`. The existing `updateStreakEvents` worker is rewritten to use a season filter (so streaks of any length within the season are detected and cross-season contamination is impossible). A new backfill script invokes the same worker function with explicit season args. Frontend adds a `StreakBadge` component and `useStreak` hook, gated to the current-season view on each page.

**Tech Stack:** Node.js + Express + `pg` + Prisma (no schema changes); React 19 + TanStack Query v5 + Tailwind v4; Jest + Supertest backend, Vitest + Testing Library frontend.

**Spec:** [`docs/superpowers/specs/2026-04-30-streaks-backfill-and-ui-design.md`](../specs/2026-04-30-streaks-backfill-and-ui-design.md)

---

## File map

**Backend — new files:**
- `backend/src/services/streaks/streakTiers.js` — tier rank tables + `tierCaseSql` helper
- `backend/src/services/streaks/streaksService.js` — `getActiveStreak(league, subjectType, subjectId)`
- `backend/src/controllers/streaks/streaksController.js` — `getPlayerStreak`, `getTeamStreak`
- `backend/src/routes/streaks/streaks.js` — Express router for the two endpoints
- `backend/src/ingestion/scripts/backfillStreaks.js` — one-time backfill runner
- `backend/__tests__/services/streakTiers.test.js`
- `backend/__tests__/services/streaksService.test.js`
- `backend/__tests__/routes/streaks.test.js`

**Backend — modified:**
- `backend/src/ingestion/streakEvents.js` — drop 60-day window, add season filter, accept `{ season }` arg
- `backend/src/ingestion/pipeline/upsert.js` — add `invalidatePattern("streak:${league}:*")`
- `backend/src/index.js` — register the new streaks router
- `backend/__tests__/ingestion/streakEvents.test.js` — update for new param order + mock `getCurrentSeason`

**Frontend — new files:**
- `frontend/src/api/streaks.js` — `getStreak(league, subjectType, id, opts)`
- `frontend/src/hooks/data/useStreak.js`
- `frontend/src/components/ui/StreakBadge.jsx`
- `frontend/src/__tests__/hooks/useStreak.test.js`
- `frontend/src/__tests__/components/StreakBadge.test.jsx`

**Frontend — modified:**
- `frontend/src/lib/query.js` — add `queryKeys.streak`
- `frontend/src/pages/PlayerPage.jsx` — render `StreakBadge`
- `frontend/src/pages/TeamPage.jsx` — render `StreakBadge`

---

## Task 1: streakTiers utility

**Files:**
- Create: `backend/src/services/streaks/streakTiers.js`
- Test: `backend/__tests__/services/streakTiers.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/services/streakTiers.test.js
import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { PLAYER_TIER, tierCaseSql } = await import(
  resolve(__dirname, "../../src/services/streaks/streakTiers.js"),
);

describe("PLAYER_TIER", () => {
  it("ranks NBA labels with triple-double first and 10+ rebound last", () => {
    expect(PLAYER_TIER.nba[0]).toBe("triple-double");
    expect(PLAYER_TIER.nba[PLAYER_TIER.nba.length - 1]).toBe("10+ rebound");
  });

  it("includes labels for nfl and nhl", () => {
    expect(PLAYER_TIER.nfl).toContain("250+ pass yard");
    expect(PLAYER_TIER.nhl).toContain("multi-point");
  });
});

describe("tierCaseSql", () => {
  it("emits a CASE expression with one WHEN per label and ELSE 99", () => {
    const sql = tierCaseSql(["a", "b", "c"], "stat_label");
    expect(sql).toMatch(/^CASE stat_label/);
    expect(sql).toMatch(/WHEN 'a' THEN 0/);
    expect(sql).toMatch(/WHEN 'b' THEN 1/);
    expect(sql).toMatch(/WHEN 'c' THEN 2/);
    expect(sql).toMatch(/ELSE 99 END$/);
  });

  it("escapes single quotes in labels", () => {
    const sql = tierCaseSql(["it's"], "x");
    expect(sql).toMatch(/WHEN 'it''s' THEN 0/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- streakTiers`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// backend/src/services/streaks/streakTiers.js
export const PLAYER_TIER = {
  nba: ["triple-double", "30+ point", "double-double", "20+ point", "10+ assist", "10+ rebound"],
  nfl: ["250+ pass yard", "100+ yard", "2+ pass TD", "2+ TD"],
  nhl: ["multi-point", "goal"],
};

function escapeLabel(s) {
  return String(s).replace(/'/g, "''");
}

export function tierCaseSql(labels, columnExpr) {
  const whens = labels
    .map((label, i) => `WHEN '${escapeLabel(label)}' THEN ${i}`)
    .join(" ");
  return `CASE ${columnExpr} ${whens} ELSE 99 END`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- streakTiers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/streaks/streakTiers.js \
        backend/__tests__/services/streakTiers.test.js
git commit -m "feat(streaks): add tier rank tables and tierCaseSql helper"
```

---

## Task 2: streaksService.getActiveStreak

**Files:**
- Create: `backend/src/services/streaks/streaksService.js`
- Test: `backend/__tests__/services/streaksService.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/__tests__/services/streaksService.test.js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { getActiveStreak } = await import(
  resolve(__dirname, "../../src/services/streaks/streaksService.js"),
);

describe("getActiveStreak", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when no rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const out = await getActiveStreak("nba", "player", 42);
    expect(out).toBeNull();
  });

  it("returns the top streak with subjectType included", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ stat_label: "triple-double", length: 5 }],
    });
    const out = await getActiveStreak("nba", "player", 42);
    expect(out).toEqual({ length: 5, statLabel: "triple-double", subjectType: "player" });
  });

  it("orders player query by tier CASE then length DESC", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "player", 42);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY[\s\S]+CASE stat_label[\s\S]+length DESC/i);
    expect(sql).toMatch(/subject_type = \$2/);
  });

  it("orders team query by length DESC only (no tier CASE)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "team", 7);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY length DESC/i);
    expect(sql).not.toMatch(/CASE stat_label/i);
  });

  it("filters on is_active = TRUE", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "player", 42);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toMatch(/is_active\s*=\s*TRUE/i);
  });

  it("passes correct params [league, subjectType, subjectId]", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nhl", "team", 12);
    expect(mockPool.query.mock.calls[0][1]).toEqual(["nhl", "team", 12]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- streaksService`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// backend/src/services/streaks/streaksService.js
import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { PLAYER_TIER, tierCaseSql } from "./streakTiers.js";

const TTL_SECONDS = 60;

function buildSql(subjectType, league) {
  const orderBy =
    subjectType === "player"
      ? `${tierCaseSql(PLAYER_TIER[league] ?? [], "stat_label")} ASC, length DESC`
      : "length DESC";
  return `
    SELECT stat_label, length
    FROM streak_events
    WHERE league = $1 AND subject_type = $2 AND subject_id = $3
      AND is_active = TRUE
    ORDER BY ${orderBy}
    LIMIT 1
  `;
}

export async function getActiveStreak(league, subjectType, subjectId) {
  return cached(
    `streak:${league}:${subjectType}:${subjectId}`,
    TTL_SECONDS,
    async () => {
      const sql = buildSql(subjectType, league);
      const { rows } = await pool.query(sql, [league, subjectType, subjectId]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return { length: row.length, statLabel: row.stat_label, subjectType };
    },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- streaksService`
Expected: PASS (cache module is a no-op without REDIS_URL, so the queryFn runs directly and assertions on `mockPool.query` work).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/streaks/streaksService.js \
        backend/__tests__/services/streaksService.test.js
git commit -m "feat(streaks): add getActiveStreak service for player/team streaks"
```

---

## Task 3: Streak controllers + routes

**Files:**
- Create: `backend/src/controllers/streaks/streaksController.js`
- Create: `backend/src/routes/streaks/streaks.js`
- Modify: `backend/src/index.js`
- Test: `backend/__tests__/routes/streaks.test.js`

- [ ] **Step 1: Write the failing route tests**

```js
// backend/__tests__/routes/streaks.test.js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockGetActiveStreak = jest.fn();
const mockGetPlayerIdBySlug = jest.fn();

jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/streaks/streaksService.js"),
  () => ({ getActiveStreak: mockGetActiveStreak }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../src/utils/slugResolver.js"),
  () => ({ getPlayerIdBySlug: mockGetPlayerIdBySlug, nameToSlug: (s) => s }),
);

const streaksRouter = (await import(
  resolve(__dirname, "../../src/routes/streaks/streaks.js")
)).default;

let app;
beforeEach(() => {
  app = express();
  app.use("/api", streaksRouter);
  jest.clearAllMocks();
  mockGetActiveStreak.mockReset();
  mockGetPlayerIdBySlug.mockReset();
});

describe("GET /:league/players/:slug/streak", () => {
  it("returns { streak } for an existing player", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(42);
    mockGetActiveStreak.mockResolvedValueOnce({
      length: 5, statLabel: "triple-double", subjectType: "player",
    });
    const res = await request(app).get("/api/nba/players/nikola-jokic/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      streak: { length: 5, statLabel: "triple-double", subjectType: "player" },
    });
    expect(mockGetActiveStreak).toHaveBeenCalledWith("nba", "player", 42);
  });

  it("returns { streak: null } when none active", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(42);
    mockGetActiveStreak.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/nba/players/jokic/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ streak: null });
  });

  it("returns 404 when slug doesn't resolve", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/nba/players/nobody/streak");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/xyz/players/x/streak");
    expect(res.status).toBe(400);
  });
});

describe("GET /:league/teams/:teamId/streak", () => {
  it("returns { streak } for an existing team", async () => {
    mockGetActiveStreak.mockResolvedValueOnce({
      length: 4, statLabel: "win", subjectType: "team",
    });
    const res = await request(app).get("/api/nba/teams/7/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      streak: { length: 4, statLabel: "win", subjectType: "team" },
    });
    expect(mockGetActiveStreak).toHaveBeenCalledWith("nba", "team", 7);
  });

  it("returns 400 for non-numeric teamId", async () => {
    const res = await request(app).get("/api/nba/teams/abc/streak");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/xyz/teams/7/streak");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- routes/streaks`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement controller**

```js
// backend/src/controllers/streaks/streaksController.js
import { getActiveStreak } from "../../services/streaks/streaksService.js";
import { getPlayerIdBySlug } from "../../utils/slugResolver.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getPlayerStreak(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }
  try {
    const playerId = await getPlayerIdBySlug(req.params.slug, league);
    if (!playerId) return res.status(404).json({ error: "Player not found" });
    const streak = await getActiveStreak(league, "player", playerId);
    return res.json({ streak });
  } catch (err) {
    logger.error({ err, league }, "Error fetching player streak");
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getTeamStreak(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = parseInt(req.params.teamId, 10);
  if (!VALID_LEAGUES.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }
  if (!Number.isInteger(teamId)) {
    return res.status(400).json({ error: "Invalid team ID" });
  }
  try {
    const streak = await getActiveStreak(league, "team", teamId);
    return res.json({ streak });
  } catch (err) {
    logger.error({ err, league }, "Error fetching team streak");
    return res.status(500).json({ error: "Server error" });
  }
}
```

- [ ] **Step 4: Implement router**

```js
// backend/src/routes/streaks/streaks.js
import express from "express";
import {
  getPlayerStreak,
  getTeamStreak,
} from "../../controllers/streaks/streaksController.js";

const router = express.Router();

router.get("/:league/players/:slug/streak", getPlayerStreak);
router.get("/:league/teams/:teamId/streak", getTeamStreak);

export default router;
```

- [ ] **Step 5: Register router in `backend/src/index.js`**

Add the import alongside the other route imports (after `import similarPlayersRoute from "./routes/players/similarPlayers.js";`):

```js
import streaksRoute from "./routes/streaks/streaks.js";
```

And add the registration in the `/api` block (after `app.use("/api", similarPlayersRoute);`):

```js
app.use("/api", streaksRoute);
```

- [ ] **Step 6: Run route tests + integration test to verify everything passes**

Run: `cd backend && npm test -- routes/streaks integration`
Expected: PASS for both files.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/streaks/streaksController.js \
        backend/src/routes/streaks/streaks.js \
        backend/src/index.js \
        backend/__tests__/routes/streaks.test.js
git commit -m "feat(streaks): add /players/:slug/streak and /teams/:id/streak endpoints"
```

---

## Task 4: Replace 60-day window with season filter in streakEvents.js

**Files:**
- Modify: `backend/src/ingestion/streakEvents.js`
- Modify: `backend/__tests__/ingestion/streakEvents.test.js`

- [ ] **Step 1: Update existing test to mock `getCurrentSeason` and assert season filter**

Modify `backend/__tests__/ingestion/streakEvents.test.js` — add the season mock at the top and update threshold-param assertions from `params[1]` to `params[2]`:

Add **before** the `updateStreakEvents` import:

```js
const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));
```

Update each threshold assertion. The original three threshold tests check `params[1]`; change them to `params[2]` because the param order becomes `[league, season, threshold]`. For example, replace:

```js
for (const [, params] of scanCalls) {
  expect(params[1]).toBe(4);
}
```

with:

```js
for (const [, params] of scanCalls) {
  expect(params[1]).toBe("2025-26");
  expect(params[2]).toBe(4);
}
```

Apply the same change in the NFL (`3`), NHL (`3`) blocks below it.

Add a new test asserting the SQL contains `g.season = $2` and **does not** contain `INTERVAL`:

```js
it("filters games by season instead of a recent-day window", async () => {
  client.query.mockResolvedValue({ rows: [] });

  await updateStreakEvents(pool, "nba");

  const scanCalls = client.query.mock.calls.filter(
    (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
  );
  expect(scanCalls.length).toBeGreaterThan(0);
  for (const [sql] of scanCalls) {
    expect(sql).toMatch(/g\.season\s*=\s*\$2/);
    expect(sql).not.toMatch(/INTERVAL/i);
  }
});

it("threads an explicit season override into queries", async () => {
  client.query.mockResolvedValue({ rows: [] });

  await updateStreakEvents(pool, "nba", { season: "2024-25" });

  const scanCalls = client.query.mock.calls.filter(
    (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
  );
  for (const [, params] of scanCalls) {
    expect(params[1]).toBe("2024-25");
  }
});
```

- [ ] **Step 2: Run tests to confirm new ones fail and old ones still mostly pass**

Run: `cd backend && npm test -- streakEvents`
Expected: New `g.season = $2` assertion FAILS; threshold tests now FAIL on `params[1]` since the value is still threshold `4` (not yet season).

- [ ] **Step 3: Modify `backend/src/ingestion/streakEvents.js`**

Replace the file contents with:

```js
import logger from "../logger.js";
import { getCurrentSeason } from "../cache/seasons.js";

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
const TEAM_THRESHOLD = { nba: 3, nfl: 3, nhl: 3 };

function buildPlayerScanSQL(statExpr, label) {
  return `
    -- streak label: ${label}
    WITH recent AS (
      SELECT s.playerid AS subject_id,
             g.date,
             ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
             ${statExpr} AS meets
      FROM stats s
      JOIN games g ON g.id = s.gameid
      JOIN players p ON p.id = s.playerid
      WHERE p.league = $1
        AND g.season = $2
        AND g.type IN ('regular','makeup','playoff')
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
    WHERE s.length >= $3
      AND s.most_recent_ok = TRUE
  `;
}

async function scanPlayerStreaks(client, league, season) {
  const stats = PLAYER_STATS_BY_LEAGUE[league] || [];
  const threshold = PLAYER_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const { label, expr } of stats) {
    const sql = buildPlayerScanSQL(expr, label);
    const { rows } = await client.query(sql, [league, season, threshold]);
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

function buildTeamScanSQL(outcomeCol /* 'won' | 'lost' */) {
  return `
    -- streak label: <set in JS>
    -- ties (homescore <> awayscore) are filtered out below
    WITH team_games AS (
      SELECT g.hometeamid AS team_id, g.date,
             (g.homescore > g.awayscore) AS won,
             (g.homescore < g.awayscore) AS lost
      FROM games g
      JOIN teams t ON t.id = g.hometeamid
      WHERE t.league = $1
        AND g.season = $2
        AND g.type IN ('regular','makeup','playoff')
        AND g.homescore IS NOT NULL AND g.awayscore IS NOT NULL
        AND g.homescore <> g.awayscore
      UNION ALL
      SELECT g.awayteamid, g.date,
             (g.awayscore > g.homescore),
             (g.awayscore < g.homescore)
      FROM games g
      JOIN teams t ON t.id = g.awayteamid
      WHERE t.league = $1
        AND g.season = $2
        AND g.type IN ('regular','makeup','playoff')
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
           s.length,
           r.date           AS start_game_date,
           s.last_game_date
    FROM streaks s
    JOIN ranked r ON r.team_id = s.team_id AND r.rn = s.length
    WHERE s.length >= $3 AND s.most_recent_ok = TRUE
  `;
}

async function scanTeamStreaks(client, league, season) {
  const threshold = TEAM_THRESHOLD[league];
  if (!threshold) return [];
  const out = [];
  for (const [outcomeCol, label] of [["won", "win"], ["lost", "loss"]]) {
    const sql = buildTeamScanSQL(outcomeCol);
    const { rows } = await client.query(sql, [league, season, threshold]);
    for (const row of rows) {
      out.push({
        subject_type: "team",
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
    ON CONFLICT (subject_type, subject_id, stat_label, start_game_date) DO UPDATE SET
      length         = EXCLUDED.length,
      last_game_date = EXCLUDED.last_game_date,
      is_active      = TRUE,
      updated_at     = NOW()
  `;
  await client.query(sql, params);
}

async function deactivateMissing(client, league, active) {
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

export async function updateStreakEvents(pool, league, { season } = {}) {
  const effectiveSeason = season ?? (await getCurrentSeason(league));
  if (!effectiveSeason) {
    log.warn({ league }, "no current season resolved; skipping streak update");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const players = await scanPlayerStreaks(client, league, effectiveSeason);
    const teams   = await scanTeamStreaks(client, league, effectiveSeason);
    const active  = [...players, ...teams];
    await upsertActiveRows(client, league, active);
    await deactivateMissing(client, league, active);
    await client.query("COMMIT");
    log.info({ league, season: effectiveSeason, active: active.length }, "streak events updated");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- streakEvents`
Expected: PASS — all original tests still green, new season-filter tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/streakEvents.js \
        backend/__tests__/ingestion/streakEvents.test.js
git commit -m "feat(streaks): replace 60-day window with current-season filter"
```

---

## Task 5: Backfill script

**Files:**
- Create: `backend/src/ingestion/scripts/backfillStreaks.js`

This script is operational tooling, not application code, and its core logic (`updateStreakEvents`) is already covered by the tests in Task 4. We don't add a separate test file — the existing peer scripts (`backfillTeamColors.js`, `backfillStatsTeamid.js`) follow the same convention.

- [ ] **Step 1: Implement the script**

```js
// backend/src/ingestion/scripts/backfillStreaks.js
/**
 * One-time script: scan and upsert active streaks for the entire current
 * season (or an explicit season via --season). Mirrors the live
 * updateStreakEvents worker but with a wider window.
 *
 * Usage:
 *   node src/ingestion/scripts/backfillStreaks.js
 *   node src/ingestion/scripts/backfillStreaks.js --league nba
 *   node src/ingestion/scripts/backfillStreaks.js --season 2025-26
 *   node src/ingestion/scripts/backfillStreaks.js --league nba --season 2025-26
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import logger from "../../logger.js";
import { updateStreakEvents } from "../streakEvents.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillStreaks" });

const ALL_LEAGUES = ["nba", "nfl", "nhl"];

function parseArgs(argv) {
  const out = { league: null, season: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--league") out.league = argv[++i];
    else if (a === "--season") out.season = argv[++i];
  }
  return out;
}

async function backfill() {
  const { league: leagueArg, season: seasonArg } = parseArgs(process.argv);
  const leagues = leagueArg ? [leagueArg] : ALL_LEAGUES;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    for (const league of leagues) {
      const season = seasonArg ?? (await getCurrentSeason(league));
      if (!season) {
        log.warn({ league }, "no season resolved; skipping");
        continue;
      }
      log.info({ league, season }, "backfilling streaks");
      await updateStreakEvents(pool, league, { season });
    }
  } finally {
    await pool.end();
  }
}

backfill()
  .then(() => log.info("backfill complete"))
  .catch((err) => {
    log.error({ err }, "backfill failed");
    process.exit(1);
  });
```

- [ ] **Step 2: Sanity check the script's syntax loads**

Run: `cd backend && node --check src/ingestion/scripts/backfillStreaks.js`
Expected: no output (clean parse).

- [ ] **Step 3: Commit**

```bash
git add backend/src/ingestion/scripts/backfillStreaks.js
git commit -m "feat(streaks): add backfill script for current-season streak events"
```

---

## Task 6: Cache invalidation in upsert pipeline

**Files:**
- Modify: `backend/src/ingestion/pipeline/upsert.js`

- [ ] **Step 1: Add the invalidation line**

Open `backend/src/ingestion/pipeline/upsert.js`. Find the existing block at line ~84 that reads:

```js
        await invalidatePattern(`games:${league}:*`);
        await invalidatePattern(`standings:${league}:*`);
        await invalidatePattern(`gameDates:${league}:*`);
        await invalidatePattern(`playerDetail:${league}:*`);
        await invalidatePattern(`reports:list:${league}`);
```

Add a new line **after** `playerDetail`:

```js
        await invalidatePattern(`streak:${league}:*`);
```

The block should read:

```js
        await invalidatePattern(`games:${league}:*`);
        await invalidatePattern(`standings:${league}:*`);
        await invalidatePattern(`gameDates:${league}:*`);
        await invalidatePattern(`playerDetail:${league}:*`);
        await invalidatePattern(`streak:${league}:*`);
        await invalidatePattern(`reports:list:${league}`);
```

- [ ] **Step 2: Run upsert pipeline tests to confirm nothing broke**

Run: `cd backend && npm test -- upsert`
Expected: PASS (no new test added — invalidatePattern is fire-and-forget; existing tests still pass).

- [ ] **Step 3: Commit**

```bash
git add backend/src/ingestion/pipeline/upsert.js
git commit -m "feat(streaks): invalidate streak cache after each upsert pass"
```

---

## Task 7: Frontend API client + queryKeys

**Files:**
- Create: `frontend/src/api/streaks.js`
- Modify: `frontend/src/lib/query.js`

- [ ] **Step 1: Create the API client**

```js
// frontend/src/api/streaks.js
import { apiFetch } from "./client.js";

export function getStreak(league, subjectType, subjectId, { signal } = {}) {
  if (subjectType === "player") {
    return apiFetch(`/api/${league}/players/${subjectId}/streak`, { signal });
  }
  return apiFetch(`/api/${league}/teams/${subjectId}/streak`, { signal });
}
```

- [ ] **Step 2: Add the query key**

Open `frontend/src/lib/query.js`. Add inside the `queryKeys` object (alphabetically by name; place it next to `standings`):

```js
streak: (league, subjectType, subjectId) => ["streak", league, subjectType, subjectId],
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/streaks.js frontend/src/lib/query.js
git commit -m "feat(streaks): add frontend API client and queryKeys.streak"
```

---

## Task 8: useStreak hook

**Files:**
- Create: `frontend/src/hooks/data/useStreak.js`
- Test: `frontend/src/__tests__/hooks/useStreak.test.js`

- [ ] **Step 1: Write the failing tests**

```jsx
// frontend/src/__tests__/hooks/useStreak.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/streaks.js", () => ({
  getStreak: vi.fn(),
}));

const { getStreak } = await import("../../api/streaks.js");
const { useStreak } = await import("../../hooks/data/useStreak.js");

describe("useStreak", () => {
  beforeEach(() => {
    getStreak.mockReset();
  });

  it("fetches the streak when enabled", async () => {
    getStreak.mockResolvedValueOnce({
      streak: { length: 5, statLabel: "triple-double", subjectType: "player" },
    });
    const { result } = renderHook(
      () => useStreak("nba", "player", 42),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.streak).toBeTruthy());
    expect(result.current.streak).toEqual({
      length: 5, statLabel: "triple-double", subjectType: "player",
    });
    expect(getStreak).toHaveBeenCalledWith("nba", "player", 42, expect.any(Object));
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(
      () => useStreak("nba", "player", 42, { enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(result.current.streak).toBeNull();
    expect(getStreak).not.toHaveBeenCalled();
  });

  it("does not fetch when subjectId is null", async () => {
    const { result } = renderHook(
      () => useStreak("nba", "player", null),
      { wrapper: createWrapper() },
    );
    expect(result.current.streak).toBeNull();
    expect(getStreak).not.toHaveBeenCalled();
  });

  it("returns null streak when API responds with null", async () => {
    getStreak.mockResolvedValueOnce({ streak: null });
    const { result } = renderHook(
      () => useStreak("nba", "team", 7),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.streak).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useStreak`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
// frontend/src/hooks/data/useStreak.js
import { useQuery } from "@tanstack/react-query";
import { getStreak } from "../../api/streaks.js";
import { queryKeys } from "../../lib/query.js";

export function useStreak(league, subjectType, subjectId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.streak(league, subjectType, subjectId),
    queryFn: ({ signal }) => getStreak(league, subjectType, subjectId, { signal }),
    enabled: !!league && !!subjectType && subjectId != null && enabled,
    staleTime: 30_000,
  });
  return {
    streak: query.data?.streak ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useStreak`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useStreak.js \
        frontend/src/__tests__/hooks/useStreak.test.js
git commit -m "feat(streaks): add useStreak hook"
```

---

## Task 9: StreakBadge component

**Files:**
- Create: `frontend/src/components/ui/StreakBadge.jsx`
- Test: `frontend/src/__tests__/components/StreakBadge.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// frontend/src/__tests__/components/StreakBadge.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StreakBadge from "../../components/ui/StreakBadge.jsx";

describe("StreakBadge", () => {
  it("renders nothing when streak is null", () => {
    const { container } = render(<StreakBadge streak={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a player streak with fire emoji", () => {
    render(<StreakBadge streak={{ length: 5, statLabel: "triple-double", subjectType: "player" }} />);
    expect(screen.getByText(/5-game triple-double streak/i)).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("renders a team win streak with fire emoji", () => {
    render(<StreakBadge streak={{ length: 4, statLabel: "win", subjectType: "team" }} />);
    expect(screen.getByText(/4-game win streak/i)).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("renders a team loss streak with ice emoji", () => {
    render(<StreakBadge streak={{ length: 3, statLabel: "loss", subjectType: "team" }} />);
    expect(screen.getByText(/3-game loss streak/i)).toBeInTheDocument();
    expect(screen.getByText("❄️")).toBeInTheDocument();
  });

  it("supports a smaller size variant", () => {
    const { container } = render(
      <StreakBadge streak={{ length: 5, statLabel: "win", subjectType: "team" }} size="sm" />,
    );
    expect(container.firstChild.className).toMatch(/text-\[10px\]/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- StreakBadge`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```jsx
// frontend/src/components/ui/StreakBadge.jsx
export default function StreakBadge({ streak, size = "md" }) {
  if (!streak) return null;
  const { length, statLabel, subjectType } = streak;
  const isLoss = subjectType === "team" && statLabel === "loss";
  const emoji = isLoss ? "❄️" : "🔥";
  const tone = isLoss
    ? "bg-loss/15 text-loss border-loss/30"
    : "bg-accent/15 text-accent border-accent/30";
  const sizeClasses = size === "sm"
    ? "gap-1.5 px-2 py-0.5 text-[10px]"
    : "gap-2 px-3 py-1 text-xs";
  return (
    <div
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${tone}`}
    >
      <span aria-hidden>{emoji}</span>
      <span className="uppercase tracking-wider">
        {length}-game {statLabel} streak
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- StreakBadge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/StreakBadge.jsx \
        frontend/src/__tests__/components/StreakBadge.test.jsx
git commit -m "feat(streaks): add StreakBadge component"
```

---

## Task 10: PlayerPage integration

**Files:**
- Modify: `frontend/src/pages/PlayerPage.jsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/pages/PlayerPage.jsx`, add (alongside the other component/hook imports):

```js
import StreakBadge from "../components/ui/StreakBadge.jsx";
import { useStreak } from "../hooks/data/useStreak.js";
```

- [ ] **Step 2: Wire up the hook and render the badge**

`PlayerPage` currently destructures values from `playerData` around the existing `viewingCurrentSeason` line. Right after `viewingCurrentSeason` is computed and **before** the `return (` block, add:

```js
const { streak } = useStreak(league, "player", playerData?.id, {
  enabled: viewingCurrentSeason,
});
```

Then locate the existing `PlayerStatusBadge` render block:

```jsx
{viewingCurrentSeason ? (
  <PlayerStatusBadge
    status={status}
    title={statusDescription || undefined}
  />
) : <span />}
```

Replace it with a wrapper that renders the streak badge alongside the status:

```jsx
{viewingCurrentSeason ? (
  <div className="flex flex-wrap items-center gap-2">
    <PlayerStatusBadge
      status={status}
      title={statusDescription || undefined}
    />
    <StreakBadge streak={streak} />
  </div>
) : <span />}
```

- [ ] **Step 3: Verify in dev server**

Run: `cd frontend && npm run dev` (then load a player on a current-season streak in the browser to confirm the pill renders next to the status badge).

Then stop the dev server.

- [ ] **Step 4: Run frontend tests to confirm nothing else broke**

Run: `cd frontend && npm test`
Expected: PASS (existing PlayerPage tests should still pass — the new pill is additive).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlayerPage.jsx
git commit -m "feat(streaks): show StreakBadge on PlayerPage current-season view"
```

---

## Task 11: TeamPage integration

**Files:**
- Modify: `frontend/src/pages/TeamPage.jsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/pages/TeamPage.jsx`:

```js
import StreakBadge from "../components/ui/StreakBadge.jsx";
import { useStreak } from "../hooks/data/useStreak.js";
```

- [ ] **Step 2: Compute the current-season check and wire the hook**

After `const { seasons: leagueSeasons } = useSeasons(league);` (already present), but before the `return (` block, add:

```js
const isCurrentSeason = !selectedSeason || selectedSeason === leagueSeasons[0];
const { streak } = useStreak(league, "team", team?.id, {
  enabled: isCurrentSeason && !!team?.id,
});
```

- [ ] **Step 3: Render the badge in the header**

Locate the team-name header block:

```jsx
<div className="flex items-center gap-3">
  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
    {team.name}
  </h1>
  <button
    onClick={() => session ? toggle() : openAuthModal("favorites")}
    aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    className="touch-target transition-all duration-200 hover:scale-110 active:scale-95"
  >
    {/* star svg */}
  </button>
</div>
```

Add a streak row directly **after** that `div` (still inside the "Logo + name" column), so the pill appears under the name on mobile and aligned-left on desktop:

```jsx
{streak && (
  <StreakBadge streak={streak} />
)}
```

- [ ] **Step 4: Verify in dev server**

Run: `cd frontend && npm run dev` (load a team currently on a streak; confirm pill renders under the team name on the current-season view, and disappears when switching to a past season).

Stop the dev server.

- [ ] **Step 5: Run frontend tests**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TeamPage.jsx
git commit -m "feat(streaks): show StreakBadge on TeamPage current-season view"
```

---

## Task 12: Run the backfill (operational, document only)

This task isn't code — it's the one-time operational run that seeds the season-wide streak data into prod.

- [ ] **Step 1: Run locally first against dev DB**

Run: `cd backend && node src/ingestion/scripts/backfillStreaks.js`
Expected: log lines `streak events updated` for each league with non-zero counts.

- [ ] **Step 2: Verify the backfill landed**

In a `psql` shell (or any SQL client):

```sql
SELECT league, COUNT(*) FROM streak_events WHERE is_active = TRUE GROUP BY league;
```

Expected: non-zero counts per active league. Should be ≥ what the previous 60-day window produced — the backfill adds long-running streaks that started before the rolling window.

- [ ] **Step 3: Run against prod**

Coordinate with the user; this is one shell invocation against the production DB and is idempotent.

---

## Final verification

- [ ] **Step 1: Run backend verify**

Run: `cd backend && npm run verify`
Expected: PASS (lint + tests).

- [ ] **Step 2: Run frontend verify**

Run: `cd frontend && npm run verify`
Expected: PASS (lint + tests + build).
