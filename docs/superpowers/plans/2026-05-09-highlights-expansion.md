# Highlights Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Pulse Highlights tab into three tabs (Rankings / Performances / Plays) with shared Window + Position + Sort filters, surfacing best/worst single plays via `play_ratings` and deep-linking back to GamePage Plays/Analysis tabs.

**Architecture:** Backend extends `GET /api/:league/top-performances` to accept `type=plays`, `window`, `sort`, `position`. One service file owns three internal query functions (rankings/performances/plays) sharing a window resolver and position predicate. Frontend splits the existing `TopPerformers.jsx` into per-tab list components plus a shared `FilterBar`. Deep-links reuse the existing `?tab=...#anchor` pattern already implemented in `GamePage`; PBP rows gain `id="play-<id>"` so the existing hash-scroll effect lights them up. NBA-only.

**Tech Stack:** Express, Postgres (raw `pg`), Jest+Supertest, Prisma migrations, React 19, TanStack Query v5, Vitest, Tailwind v4, Framer Motion, React Router 7.

**Spec:** `docs/superpowers/specs/2026-05-09-highlights-expansion-design.md`

---

## File map

**Backend:**
- Modify: `backend/src/services/games/topPerformancesService.js` — extend signature, add `queryPlays`, `resolveWindow`, `positionPredicate`.
- Modify: `backend/src/controllers/games/topPerformancesController.js` — pull new query params.
- Modify: `backend/src/cache/cache.js` — bump `CACHE_VERSION`.
- Create: `backend/prisma/migrations/20260509000000_add_highlights_indexes/migration.sql`
- Modify: `backend/prisma/schema.prisma` — add `@@index` directives matching the new SQL indexes.
- Modify: `backend/__tests__/services/games/topPerformancesService.test.js` — extend with new cases.

**Frontend:**
- Modify: `frontend/src/api/topPerformances.js` — new params.
- Modify: `frontend/src/lib/query.js` — `topPerformances` key + fn signatures.
- Modify: `frontend/src/hooks/data/useTopPerformances.js` — accept full filter object.
- Create: `frontend/src/components/highlights/filters/FilterBar.jsx`
- Create: `frontend/src/components/highlights/rows/HeroRow.jsx`
- Create: `frontend/src/components/highlights/rows/CompactRow.jsx`
- Create: `frontend/src/components/highlights/tabs/RankingsList.jsx`
- Create: `frontend/src/components/highlights/tabs/PerformancesList.jsx`
- Create: `frontend/src/components/highlights/tabs/PlaysList.jsx`
- Modify: `frontend/src/components/highlights/HighlightsTab.jsx` — host 3 tabs + filter bar.
- Delete: `frontend/src/components/highlights/TopPerformers.jsx`
- Modify: `frontend/src/components/skeletons/TopPerformersSkeleton.jsx` (rename or keep — used by all three lists).
- Modify: `frontend/src/__tests__/components/TopPerformancesCard.test.jsx` — re-target to new components.

**Deep-link wiring:**
- Modify: `frontend/src/components/ui/PlayByPlay.jsx` — add `id={\`play-\${play.id}\`}` to row wrapper.
- Modify: `frontend/src/pages/GamePage.jsx` — hash-scroll effect: don't override `?tab=` param when target id missing.

**Docs:**
- Modify: `docs/file-map.md`
- Modify: `docs/api-reference.md` — document new query params on top-performances.

---

## Conventions

- Backend tests: Jest + ESM mocks via `jest.unstable_mockModule`; mock `db/db.js` (not `pg`); reset between tests.
- Frontend tests: Vitest + Testing Library; wrap with `createWrapper()` for TQ hooks.
- Commit style: `feat(highlights): ...`, `refactor(top-performances): ...`, `test(...): ...`, `chore(cache): bump version`.
- Run after each task: `cd backend && npm run lint && npm test -- <relevant>` (backend) or `cd frontend && npm test -- <relevant>` (frontend).

---

## Phase 1 — Backend service refactor

### Task 1: Add database indexes (migration)

**Files:**
- Create: `backend/prisma/migrations/20260509000000_add_highlights_indexes/migration.sql`
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Create migration SQL**

Create `backend/prisma/migrations/20260509000000_add_highlights_indexes/migration.sql`:

```sql
-- Speeds ORDER BY rating DESC for top-performances queries.
CREATE INDEX IF NOT EXISTS stats_rating_desc_idx
  ON stats (rating DESC) WHERE rating IS NOT NULL;

-- Speeds ORDER BY weighted_value for play_ratings leaderboard.
CREATE INDEX IF NOT EXISTS play_ratings_weighted_desc_idx
  ON play_ratings (weighted_value DESC);
```

- [ ] **Step 2: Add matching `@@index` directives in schema.prisma**

In `backend/prisma/schema.prisma`, add to the `stats` model block:

```prisma
@@index([rating(sort: Desc)], map: "stats_rating_desc_idx")
```

In the `play_ratings` model block:

```prisma
@@index([weighted_value(sort: Desc)], map: "play_ratings_weighted_desc_idx")
```

- [ ] **Step 3: Apply migration manually (shadow DB has issues locally — see CLAUDE.md memory)**

Run:
```bash
cd backend
psql "$DATABASE_URL" -f prisma/migrations/20260509000000_add_highlights_indexes/migration.sql
node_modules/.bin/prisma migrate resolve --applied 20260509000000_add_highlights_indexes
node_modules/.bin/prisma generate
```

Expected: indexes created; `prisma generate` regenerates client without diff complaints.

- [ ] **Step 4: Verify indexes exist**

Run:
```bash
psql "$DATABASE_URL" -c "\\d+ stats" | grep stats_rating_desc_idx
psql "$DATABASE_URL" -c "\\d+ play_ratings" | grep play_ratings_weighted_desc_idx
```

Expected: both indexes present.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations/20260509000000_add_highlights_indexes backend/prisma/schema.prisma
git commit -m "feat(db): add highlights leaderboard indexes (stats.rating, play_ratings.weighted_value)"
```

---

### Task 2: Bump CACHE_VERSION

**Files:**
- Modify: `backend/src/cache/cache.js`

The top-performances cache key shape changes (new params). Bump version to invalidate old keys.

- [ ] **Step 1: Bump version**

In `backend/src/cache/cache.js`, change:
```js
export const CACHE_VERSION = 18;
```
to:
```js
export const CACHE_VERSION = 19;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/cache/cache.js
git commit -m "chore(cache): bump CACHE_VERSION to 19 for top-performances key shape change"
```

---

### Task 3: Add window resolver + position predicate helpers (with tests)

**Files:**
- Modify: `backend/src/services/games/topPerformancesService.js`
- Modify: `backend/__tests__/services/games/topPerformancesService.test.js`

These pure helpers translate `window=today|week|month|season|all` into a SQL predicate fragment + bind values, and `position=all|G|F|C` into a regex predicate. Extracted so all three query functions share them.

- [ ] **Step 1: Write the failing test for `resolveWindow`**

Append to `backend/__tests__/services/games/topPerformancesService.test.js` (top-level imports):

```js
import { resolveWindow, positionPredicate } from "../../../src/services/games/topPerformancesService.js";
```

Add a new `describe` block:

```js
describe("resolveWindow", () => {
  test("today → date = current NY date", () => {
    const w = resolveWindow("today");
    expect(w.predicate).toBe("g.date = (NOW() AT TIME ZONE 'America/New_York')::date");
    expect(w.binds).toEqual([]);
  });
  test("week → 7-day window", () => {
    const w = resolveWindow("week");
    expect(w.predicate).toContain("g.date >=");
    expect(w.predicate).toContain("INTERVAL '7 days'");
  });
  test("month → 30-day window", () => {
    const w = resolveWindow("month");
    expect(w.predicate).toContain("INTERVAL '30 days'");
  });
  test("season → bound on g.season", () => {
    const w = resolveWindow("season", { season: "2025-26" });
    expect(w.predicate).toBe("g.season = $WIN1");
    expect(w.binds).toEqual(["2025-26"]);
  });
  test("all → no predicate", () => {
    const w = resolveWindow("all");
    expect(w.predicate).toBe("");
    expect(w.binds).toEqual([]);
  });
  test("invalid window throws", () => {
    expect(() => resolveWindow("garbage")).toThrow(/window/);
  });
});

describe("positionPredicate", () => {
  test.each([
    ["all", ""],
    ["G",   "p.position ~* '^(PG|SG|G)'"],
    ["F",   "p.position ~* '^(SF|PF|F)'"],
    ["C",   "p.position ~* '^C'"],
  ])("%s", (pos, expected) => {
    expect(positionPredicate(pos)).toBe(expected);
  });
  test("invalid throws", () => {
    expect(() => positionPredicate("Q")).toThrow(/position/);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: FAIL — `resolveWindow is not a function`.

- [ ] **Step 3: Implement helpers**

In `backend/src/services/games/topPerformancesService.js`, add (above `getTopPerformances`):

```js
const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);

/**
 * Returns { predicate, binds } where predicate is a SQL fragment to AND into the
 * WHERE clause. Use $WIN1 placeholder; the caller substitutes the real $N once
 * it knows where the bind index lands. Empty predicate means "no date bound".
 */
export function resolveWindow(window, opts = {}) {
  if (!ALLOWED_WINDOWS.has(window)) {
    const err = new Error(`invalid window: ${window}`);
    err.status = 400;
    throw err;
  }
  switch (window) {
    case "today":
      return { predicate: "g.date = (NOW() AT TIME ZONE 'America/New_York')::date", binds: [] };
    case "week":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '7 days'", binds: [] };
    case "month":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '30 days'", binds: [] };
    case "season":
      if (!opts.season) {
        const err = new Error("season required for window=season");
        err.status = 500;
        throw err;
      }
      return { predicate: "g.season = $WIN1", binds: [opts.season] };
    case "all":
      return { predicate: "", binds: [] };
  }
}

export function positionPredicate(position) {
  if (!ALLOWED_POSITIONS.has(position)) {
    const err = new Error(`invalid position: ${position}`);
    err.status = 400;
    throw err;
  }
  switch (position) {
    case "all": return "";
    case "G":   return "p.position ~* '^(PG|SG|G)'";
    case "F":   return "p.position ~* '^(SF|PF|F)'";
    case "C":   return "p.position ~* '^C'";
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: PASS for both new describes; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/topPerformancesService.js backend/__tests__/services/games/topPerformancesService.test.js
git commit -m "feat(top-performances): add window resolver + position predicate helpers"
```

---

### Task 4: Refactor service signature + accept new params (with tests)

**Files:**
- Modify: `backend/src/services/games/topPerformancesService.js`
- Modify: `backend/__tests__/services/games/topPerformancesService.test.js`

Change `getTopPerformances` to accept `{ league, type, window, sort, position, limit, days? }`. Existing `days` + `type=games|cumulative` still work via aliases.

Add `currentSeasonForLeague` import (already used elsewhere — see `backend/src/cache/seasons.js`). Refactor `queryGames` → `queryPerformances` and `queryCumulative` → `queryRankings`. Keep response shapes 100% backward-compatible (don't change field names).

- [ ] **Step 1: Write failing tests for new signature**

Append to `backend/__tests__/services/games/topPerformancesService.test.js`:

```js
// Mock seasons module so window=season has a deterministic season string.
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/cache/seasons.js"),
  () => ({ currentSeasonForLeague: jest.fn().mockResolvedValue("2025-26") }),
);

describe("getTopPerformances — new params", () => {
  beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

  test("type=performances + window=week + sort=asc — orders ASC", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "week",
      sort: "asc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY s\.rating ASC/);
    expect(sql).toMatch(/INTERVAL '7 days'/);
  });

  test("type=rankings + position=G — injects position predicate", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "rankings", window: "month",
      sort: "desc", position: "G", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/p\.position ~\* '\^\(PG\|SG\|G\)'/);
  });

  test("window=season — uses g.season binding", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "season",
      sort: "desc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    const binds = mockQuery.mock.calls[0][1];
    expect(sql).toMatch(/g\.season = \$\d/);
    expect(binds).toContain("2025-26");
  });

  test("window=all — no date predicate", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "all",
      sort: "desc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).not.toMatch(/g\.date/);
    expect(sql).not.toMatch(/g\.season/);
  });

  test("legacy: type=games + days=7 still works (alias)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const out = await getTopPerformances({ league: "nba", days: 7, type: "games", limit: 5 });
    expect(out.type).toBe("performances");  // canonicalized
    expect(mockQuery.mock.calls[0][0]).toMatch(/INTERVAL '7 days'/);
  });

  test("cache key includes all filter params", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "week",
      sort: "desc", position: "G", limit: 10,
    });
    expect(mockCached).toHaveBeenCalledWith(
      "top-performances:nba:performances:week:desc:G:10",
      expect.any(Number),
      expect.any(Function),
    );
  });

  test("today TTL is 30s", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "today",
      sort: "desc", position: "all", limit: 10,
    });
    expect(mockCached).toHaveBeenCalledWith(expect.any(String), 30, expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: FAIL.

- [ ] **Step 3: Refactor service**

Replace `backend/src/services/games/topPerformancesService.js` body with:

```js
import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { currentSeasonForLeague } from "../../cache/seasons.js";
import { gradeFromRaw } from "./ratingEngine.js";

const TTL_BY_WINDOW = {
  today: 30,
  week: 60,
  month: 5 * 60,
  season: 5 * 60,        // current-season; past-season collapses to season anyway
  all: 60 * 60,
};

const TYPE_ALIASES = { games: "performances", cumulative: "rankings" };
const ALLOWED_TYPES = new Set(["performances", "rankings", "plays"]);
const ALLOWED_SORTS = new Set(["desc", "asc"]);

const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);

function clamp(n, lo, hi) {
  if (Number.isNaN(n) || n == null) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

// Map legacy `days` to a window string when no window provided.
function daysToWindow(days) {
  const d = parseInt(days, 10);
  if (Number.isNaN(d)) return null;
  if (d <= 1) return "today";
  if (d <= 7) return "week";
  return "month";
}

export function resolveWindow(window, opts = {}) { /* … as Task 3 … */ }
export function positionPredicate(position) { /* … as Task 3 … */ }

export async function getTopPerformances({
  league, type, window, sort = "desc", position = "all", limit, days,
}) {
  // Type aliases for back-compat
  const canonicalType = TYPE_ALIASES[type] ?? type ?? "performances";
  if (!ALLOWED_TYPES.has(canonicalType)) {
    const err = new Error(`invalid type: ${type}`); err.status = 400; throw err;
  }
  if (!ALLOWED_SORTS.has(sort)) {
    const err = new Error(`invalid sort: ${sort}`); err.status = 400; throw err;
  }
  // Window: explicit > derived from days > "week" default
  const canonicalWindow = window ?? daysToWindow(days) ?? "week";
  if (!ALLOWED_WINDOWS.has(canonicalWindow)) {
    const err = new Error(`invalid window: ${canonicalWindow}`); err.status = 400; throw err;
  }
  if (!ALLOWED_POSITIONS.has(position)) {
    const err = new Error(`invalid position: ${position}`); err.status = 400; throw err;
  }
  const safeLimit = clamp(parseInt(limit, 10), 1, 25);

  const key = `top-performances:${league}:${canonicalType}:${canonicalWindow}:${sort}:${position}:${safeLimit}`;
  const ttl = TTL_BY_WINDOW[canonicalWindow] ?? 60;

  return cached(key, ttl, async () => {
    const season = canonicalWindow === "season"
      ? await currentSeasonForLeague(league)
      : null;
    const ctx = { league, window: canonicalWindow, season, sort, position, limit: safeLimit };
    if (canonicalType === "performances") return queryPerformances(ctx);
    if (canonicalType === "rankings")     return queryRankings(ctx);
    return queryPlays(ctx);   // Task 5
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a `{sql, binds}` shaped fragment with the window predicate and position
 * predicate inlined and bind placeholders renumbered. Returns the SQL fragment
 * starting with " AND " when non-empty (or "") plus the resolved bind list
 * starting at $startIdx.
 */
function buildFilters({ window, season, position }, startIdx) {
  const parts = [];
  const binds = [];
  let idx = startIdx;

  const w = resolveWindow(window, { season });
  if (w.predicate) {
    let frag = w.predicate;
    for (let i = 0; i < w.binds.length; i++) {
      frag = frag.replace("$WIN" + (i + 1), "$" + idx);
      binds.push(w.binds[i]);
      idx += 1;
    }
    parts.push(frag);
  }
  const pp = positionPredicate(position);
  if (pp) parts.push(pp);

  return {
    sql: parts.length ? " AND " + parts.join(" AND ") : "",
    binds,
    nextIdx: idx,
  };
}

// ─── Performances (single best/worst games) ──────────────────────────────────

async function queryPerformances({ league, window, season, sort, position, limit }) {
  const f = buildFilters({ window, season, position }, 3); // $1=league, $2=limit
  const { rows } = await pool.query(
    `SELECT s.playerid, s.gameid, s.rating,
            p.name, p.image_url, p.position,
            g.date,
            g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
            s.points, s.rebounds, s.assists,
            t.id   AS team_id,
            t.abbreviation, t.logo_url, t.primary_color,
            ot.id  AS opp_id,
            ot.abbreviation AS opp_abbreviation,
            ot.logo_url     AS opp_logo_url
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
        ${f.sql}
      ORDER BY s.rating ${sort === "asc" ? "ASC" : "DESC"}, s.playerid ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return {
    type: "performances",
    window,
    performances: rows.map(shapeGameRow),
  };
}

// ─── Rankings (cumulative leaderboard) ───────────────────────────────────────

async function queryRankings({ league, window, season, sort, position, limit }) {
  const f = buildFilters({ window, season, position }, 3);
  const { rows } = await pool.query(
    `SELECT s.playerid,
            SUM(s.rating)  AS total_rating,
            COUNT(*)       AS games_played,
            AVG(s.rating)  AS avg_per_game,
            (ARRAY_AGG(s.gameid ORDER BY s.rating DESC))[1] AS best_game_id,
            MAX(s.rating)  AS best_game_rating,
            (ARRAY_AGG(ot.abbreviation ORDER BY s.rating DESC))[1] AS best_opp_abbreviation,
            p.name, p.image_url, p.position,
            t.id           AS team_id,
            t.abbreviation, t.logo_url, t.primary_color
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
        ${f.sql}
      GROUP BY s.playerid, p.name, p.image_url, p.position, t.id, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating ${sort === "asc" ? "ASC" : "DESC"}, s.playerid ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return {
    type: "rankings",
    window,
    performances: rows.map(shapeCumulativeRow),
  };
}

async function queryPlays(_ctx) {
  // Implemented in Task 5
  throw new Error("queryPlays not yet implemented");
}

// shapeGameRow, shapeCumulativeRow, round1, round2 — keep existing definitions verbatim.
```

(Keep `shapeGameRow`, `shapeCumulativeRow`, `round1`, `round2` from the original file.)

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: PASS for new tests AND existing tests (legacy params still work). The "type=plays" test will be added in Task 5.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/topPerformancesService.js backend/__tests__/services/games/topPerformancesService.test.js
git commit -m "refactor(top-performances): accept window/sort/position params with legacy aliases"
```

---

### Task 5: Implement `queryPlays` (with tests)

**Files:**
- Modify: `backend/src/services/games/topPerformancesService.js`
- Modify: `backend/__tests__/services/games/topPerformancesService.test.js`

Top plays leaderboard. Joins `play_ratings` → `plays` → `players` → `games` → `teams` (player team derived via `stats(s.playerid, s.gameid).teamid`, falling back to `players.teamid`). Returns play description, weighted_value, period, clock, plus the same player/team/game envelope.

- [ ] **Step 1: Write failing test**

Append to test file:

```js
describe("queryPlays (type=plays)", () => {
  beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

  test("returns shaped play rows", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          play_id: 9001, player_id: 11, game_id: 100,
          weighted_value: "4.8", wpa_delta: "0.18",
          period: 4, clock: "0:32",
          description: "Stephen Curry makes 27-foot three pointer (assist by Draymond Green)",
          name: "Stephen Curry", image_url: "/curry.png", position: "G",
          date: new Date("2026-05-05"),
          hometeamid: 1, awayteamid: 2, homescore: 110, awayscore: 105,
          team_id: 1, abbreviation: "GSW", logo_url: "/gsw.png", primary_color: "#1D428A",
          opp_id: 2, opp_abbreviation: "LAL", opp_logo_url: "/lal.png",
        },
      ],
    });

    const out = await getTopPerformances({
      league: "nba", type: "plays", window: "week",
      sort: "desc", position: "all", limit: 10,
    });

    expect(out.type).toBe("plays");
    expect(out.performances).toHaveLength(1);
    const row = out.performances[0];
    expect(row.play.id).toBe(9001);
    expect(row.play.weightedValue).toBeCloseTo(4.8, 1);
    expect(row.play.wpaDelta).toBeCloseTo(0.18, 2);
    expect(row.play.description).toMatch(/Curry/);
    expect(row.play.period).toBe(4);
    expect(row.play.clock).toBe("0:32");
    expect(row.player.name).toBe("Stephen Curry");
    expect(row.game.id).toBe(100);
    expect(row.game.opponent.abbreviation).toBe("LAL");
  });

  test("sort=asc orders by weighted_value ASC", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "plays", window: "week",
      sort: "asc", position: "all", limit: 10,
    });
    expect(mockQuery.mock.calls[0][0]).toMatch(/ORDER BY pr\.weighted_value ASC/);
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: FAIL ("queryPlays not yet implemented").

- [ ] **Step 3: Implement `queryPlays`**

In `backend/src/services/games/topPerformancesService.js`, replace the `queryPlays` stub with:

```js
async function queryPlays({ league, window, season, sort, position, limit }) {
  const f = buildFilters({ window, season, position }, 3); // $1=league, $2=limit
  const { rows } = await pool.query(
    `SELECT pr.play_id,
            pr.player_id,
            pr.game_id,
            pr.weighted_value,
            pr.wpa_delta,
            pl.period,
            pl.clock,
            pl.description,
            p.name, p.image_url, p.position,
            g.date,
            g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
            t.id            AS team_id,
            t.abbreviation, t.logo_url, t.primary_color,
            ot.id           AS opp_id,
            ot.abbreviation AS opp_abbreviation,
            ot.logo_url     AS opp_logo_url
       FROM play_ratings pr
       JOIN plays    pl ON pl.id = pr.play_id
       JOIN players  p  ON p.id  = pr.player_id
       JOIN games    g  ON g.id  = pr.game_id
       LEFT JOIN stats s ON s.gameid = pr.game_id AND s.playerid = pr.player_id
       JOIN teams    t  ON t.id  = COALESCE(s.teamid, p.teamid)
       JOIN teams    ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND pr.weighted_value IS NOT NULL
        ${f.sql}
      ORDER BY pr.weighted_value ${sort === "asc" ? "ASC" : "DESC"}, pr.play_id ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return {
    type: "plays",
    window,
    performances: rows.map(shapePlayRow),
  };
}

function shapePlayRow(r) {
  return {
    player: {
      id: r.player_id,
      name: r.name,
      imageUrl: r.image_url,
      position: r.position,
      team: {
        id: r.team_id,
        abbreviation: r.abbreviation,
        logo: r.logo_url,
        primary_color: r.primary_color,
      },
    },
    game: {
      id: r.game_id,
      date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: r.team_id === r.hometeamid,
      result: r.homescore != null && r.awayscore != null
        ? ((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
           (r.team_id === r.awayteamid && r.awayscore > r.homescore) ? "W" : "L")
        : null,
    },
    play: {
      id: r.play_id,
      description: r.description,
      period: r.period,
      clock: r.clock,
      weightedValue: round1(Number(r.weighted_value)),
      wpaDelta: r.wpa_delta == null ? null : round4(Number(r.wpa_delta)),
    },
  };
}

function round4(n) { return n == null ? null : Math.round(n * 10000) / 10000; }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- topPerformancesService
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/topPerformancesService.js backend/__tests__/services/games/topPerformancesService.test.js
git commit -m "feat(top-performances): add type=plays query branch"
```

---

### Task 6: Update controller to forward new query params

**Files:**
- Modify: `backend/src/controllers/games/topPerformancesController.js`

- [ ] **Step 1: Read current controller**

```bash
cat backend/src/controllers/games/topPerformancesController.js
```

- [ ] **Step 2: Update controller**

Replace contents with:

```js
import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    if (req.params.league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { type, window, sort, position, limit, days } = req.query;
    const out = await getTopPerformances({
      league: req.params.league,
      type, window, sort, position, limit, days,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 3: Run lint + service-level tests**

```bash
cd backend && npm run lint && npm test -- topPerformances
```

Expected: pass.

- [ ] **Step 4: Manual smoke test**

```bash
cd backend && npm run dev
# in another shell:
curl -s "http://localhost:3000/api/nba/top-performances?type=plays&window=week&sort=desc&position=all&limit=5" | jq '.performances | length, .[0].play'
curl -s "http://localhost:3000/api/nba/top-performances?type=rankings&window=season&position=G&limit=5" | jq '.performances[0:2]'
curl -s "http://localhost:3000/api/nba/top-performances?type=games&days=7&limit=5" | jq '.type'
```

Expected: first returns up to 5 plays; second returns guards-only rankings for the season; third returns `"performances"` (canonicalized).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/games/topPerformancesController.js
git commit -m "feat(top-performances): forward window/sort/position from controller"
```

---

## Phase 2 — Frontend wiring

### Task 7: Update API + query.js + hook signatures

**Files:**
- Modify: `frontend/src/api/topPerformances.js`
- Modify: `frontend/src/lib/query.js`
- Modify: `frontend/src/hooks/data/useTopPerformances.js`

- [ ] **Step 1: Update API client**

Replace `frontend/src/api/topPerformances.js`:

```js
import { apiFetch } from "./client.js";

export function getTopPerformances(
  league,
  { type = "performances", window = "week", sort = "desc", position = "all", limit = 25, signal } = {},
) {
  return apiFetch(`/api/${league}/top-performances`, {
    signal,
    params: { type, window, sort, position, limit },
  });
}
```

- [ ] **Step 2: Update query keys + fns**

In `frontend/src/lib/query.js`, replace the `topPerformances` entries:

```js
// queryKeys
topPerformances: (league, { type, window, sort, position, limit }) =>
  ["top-performances", league, type, window, sort, position, limit],

// queryFns
topPerformances: (league, opts) =>
  ({ signal }) => getTopPerformances(league, { ...opts, signal }),
```

- [ ] **Step 3: Update hook**

Replace `frontend/src/hooks/data/useTopPerformances.js`:

```js
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

const TTL_BY_WINDOW = {
  today:  30 * 1000,
  week:   60 * 1000,
  month:  5 * 60 * 1000,
  season: 5 * 60 * 1000,
  all:    60 * 60 * 1000,
};

export function useTopPerformances(league, opts = {}) {
  const {
    type = "performances",
    window = "week",
    sort = "desc",
    position = "all",
    limit = 25,
  } = opts;
  const key = { type, window, sort, position, limit };
  return useQuery({
    queryKey: queryKeys.topPerformances(league, key),
    queryFn:  queryFns.topPerformances(league, key),
    staleTime: TTL_BY_WINDOW[window] ?? 60 * 1000,
    enabled: !!league,
  });
}
```

- [ ] **Step 4: Run frontend lint**

```bash
cd frontend && npm run lint
```

Expected: passes (or only warnings about unused exports until Task 11 lands).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/topPerformances.js frontend/src/lib/query.js frontend/src/hooks/data/useTopPerformances.js
git commit -m "feat(highlights): extend topPerformances client/hook for new filter params"
```

---

### Task 8: Extract shared `HeroRow` and `CompactRow`

**Files:**
- Create: `frontend/src/components/highlights/rows/HeroRow.jsx`
- Create: `frontend/src/components/highlights/rows/CompactRow.jsx`

These are presentation-only — accept primitives + a `to` link target. Per-tab content variation is handled by the tab-list components passing primitive props.

- [ ] **Step 1: Create `HeroRow.jsx`**

```jsx
import { Link } from "react-router-dom";

const TIER_STYLES = {
  1: { height: "h-[88px]", number: "text-3xl", value: "text-3xl",   img: "w-14 h-14 ring-2", margin: "mb-3" },
  2: { height: "h-[72px]", number: "text-2xl", value: "text-2xl",   img: "w-12 h-12 ring-2", margin: "mb-2.5" },
  3: { height: "h-[64px]", number: "text-xl",  value: "text-xl",    img: "w-10 h-10 ring-1", margin: "mb-2" },
};

export default function HeroRow({ rank, color = "#e8863a", to, imageUrl, name, meta, value, onMouseEnter }) {
  const t = TIER_STYLES[rank] ?? TIER_STYLES[1];
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className={`relative flex items-center gap-4 ${t.height} px-5 rounded-2xl ${t.margin} cursor-pointer overflow-hidden hover:brightness-110 transition-all`}
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        border: `1px solid ${color}40`,
      }}
    >
      <span className={`text-accent font-black ${t.number} tabular-nums leading-none`}>#{rank}</span>
      <img
        loading="lazy"
        src={imageUrl || "/defaultPhoto.webp"}
        alt={name}
        className={`${t.img} object-cover rounded-full ring-accent/40 shrink-0`}
        onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-text-primary truncate">{name}</div>
        <div className="text-xs text-text-tertiary truncate">{meta}</div>
      </div>
      <span className={`text-accent font-black ${t.value} tabular-nums leading-none shrink-0`}>{value}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Create `CompactRow.jsx`**

```jsx
import { Link } from "react-router-dom";

export default function CompactRow({ rank, to, imageUrl, name, meta, value, onMouseEnter }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-surface-overlay transition-all"
    >
      <span className="text-text-tertiary font-semibold text-xs w-5 tabular-nums">{rank}</span>
      <img
        loading="lazy"
        src={imageUrl || "/defaultPhoto.webp"}
        alt=""
        className="w-7 h-7 object-cover rounded-full shrink-0"
        onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }}
      />
      <span className="text-sm font-medium text-text-primary flex-1 truncate">{name}</span>
      <span className="text-text-tertiary text-[11px] tabular-nums">{meta}</span>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right">{value}</span>
    </Link>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/highlights/rows
git commit -m "feat(highlights): extract HeroRow + CompactRow shared row primitives"
```

---

### Task 9: Build `FilterBar`

**Files:**
- Create: `frontend/src/components/highlights/filters/FilterBar.jsx`

URL-param driven. Two pill rails (Window, Position) + one toggle (Sort). Sort hidden via prop when caller doesn't want it (kept simple — but spec says all 3 tabs share filters, so always shown).

- [ ] **Step 1: Create `FilterBar.jsx`**

```jsx
import { useSearchParams } from "react-router-dom";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];
const POSITIONS = [
  { id: "all", label: "All" },
  { id: "G",   label: "G" },
  { id: "F",   label: "F" },
  { id: "C",   label: "C" },
];
const SORTS = [
  { id: "desc", label: "Best" },
  { id: "asc",  label: "Worst" },
];

export default function FilterBar({ window, position, sort }) {
  const [, setSearchParams] = useSearchParams();
  const setParam = (key, defaultValue) => (next) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (!next || next === defaultValue) sp.delete(key);
      else sp.set(key, next);
      return sp;
    }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-2 mb-6">
      <PillRow label="Window"   options={WINDOWS}   active={window}   onSelect={setParam("win", "week")} />
      <PillRow label="Position" options={POSITIONS} active={position} onSelect={setParam("pos", "all")} />
      <PillRow label="Sort"     options={SORTS}     active={sort}     onSelect={setParam("sort", "desc")} />
    </div>
  );
}

function PillRow({ label, options, active, onSelect }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium w-16 shrink-0">{label}</span>
      {options.map((o) => {
        const isActive = o.id === active;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-200 ${
              isActive
                ? "bg-accent text-white border-accent"
                : "bg-surface-elevated text-text-secondary border-white/[0.08] hover:border-white/[0.14] hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/highlights/filters
git commit -m "feat(highlights): add FilterBar (window/position/sort)"
```

---

### Task 10: Build per-tab list components

**Files:**
- Create: `frontend/src/components/highlights/tabs/RankingsList.jsx`
- Create: `frontend/src/components/highlights/tabs/PerformancesList.jsx`
- Create: `frontend/src/components/highlights/tabs/PlaysList.jsx`

All three follow the same shape: call `useTopPerformances` with the right `type`, render top-3 as `HeroRow`, rest as `CompactRow`. Differ only in `to` link, `meta`, `value`.

- [ ] **Step 1: Create `RankingsList.jsx`**

```jsx
import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

export default function RankingsList({ league = "nba", window, sort, position }) {
  const { data, isLoading } = useTopPerformances(league, { type: "rankings", window, sort, position, limit: 25 });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) return <Empty window={window} />;

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const slug = it.player.slug ?? it.player.id;
        const to = `/${league}/players/${slug}`;
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${it.gamesPlayed} GP · avg ${it.avgPerGame.toFixed(1)}`,
          value: it.totalRating.toFixed(1),
          onMouseEnter: () => {
            if (window.matchMedia?.("(hover: hover)").matches) {
              qc.prefetchQuery({
                queryKey: queryKeys.player(league, slug),
                queryFn: queryFns.player(league, slug),
                staleTime: 10_000,
              });
            }
          },
        };
        return (
          <li key={`${it.player.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ window }) {
  const msg = window === "today" ? "No final games today yet." : "No rankings for this window.";
  return <p className="text-center text-text-tertiary text-sm py-12">{msg}</p>;
}
```

- [ ] **Step 2: Create `PerformancesList.jsx`**

```jsx
import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import slugify from "../../../utils/slugify.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PerformancesList({ league = "nba", window, sort, position }) {
  const { data, isLoading } = useTopPerformances(league, { type: "performances", window, sort, position, limit: 25 });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) return <Empty window={window} />;

  const showDate = SHOW_DATE_FOR.has(window);
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=analysis#${slugify(it.player.name)}`;
        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${it.stats.points}/${it.stats.rebounds}/${it.stats.assists} · ${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}${datePart}`,
          value: it.ratingGrade.toFixed(1),
          onMouseEnter: () => {
            if (window.matchMedia?.("(hover: hover)").matches) {
              qc.prefetchQuery({
                queryKey: queryKeys.game(league, it.game.id),
                queryFn: queryFns.game(league, it.game.id),
                staleTime: 10_000,
              });
            }
          },
        };
        return (
          <li key={`${it.player.id}:${it.game.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ window }) {
  const msg = window === "today" ? "No final games today yet." : "No performances for this window.";
  return <p className="text-center text-text-tertiary text-sm py-12">{msg}</p>;
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 3: Create `PlaysList.jsx`**

```jsx
import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PlaysList({ league = "nba", window, sort, position }) {
  const { data, isLoading } = useTopPerformances(league, { type: "plays", window, sort, position, limit: 25 });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) return <Empty window={window} />;

  const showDate = SHOW_DATE_FOR.has(window);
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=plays#play-${it.play.id}`;
        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
        const desc = truncate(it.play.description, 64);
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${desc} · ${opp}${datePart}`,
          value: it.play.weightedValue.toFixed(1),
          onMouseEnter: () => {
            if (window.matchMedia?.("(hover: hover)").matches) {
              qc.prefetchQuery({
                queryKey: queryKeys.game(league, it.game.id),
                queryFn: queryFns.game(league, it.game.id),
                staleTime: 10_000,
              });
            }
          },
        };
        return (
          <li key={`play-${it.play.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ window }) {
  const msg = window === "today" ? "No plays from today yet." : "No plays for this window.";
  return <p className="text-center text-text-tertiary text-sm py-12">{msg}</p>;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/highlights/tabs
git commit -m "feat(highlights): add Rankings/Performances/Plays list components"
```

---

### Task 11: Refactor `HighlightsTab` to host 3 tabs + filter bar

**Files:**
- Modify: `frontend/src/components/highlights/HighlightsTab.jsx`
- Delete: `frontend/src/components/highlights/TopPerformers.jsx`

- [ ] **Step 1: Replace `HighlightsTab.jsx`**

```jsx
import { useRef, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import FilterBar from "./filters/FilterBar.jsx";
import RankingsList from "./tabs/RankingsList.jsx";
import PerformancesList from "./tabs/PerformancesList.jsx";
import PlaysList from "./tabs/PlaysList.jsx";

const TABS = [
  { id: "rankings",     label: "Rankings" },
  { id: "performances", label: "Performances" },
  { id: "plays",        label: "Plays" },
];

const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);
const ALLOWED_SORTS = new Set(["desc", "asc"]);

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function HighlightsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  // Aliases for back-compat with the old MVP URLs
  const aliased = modeParam === "games" ? "performances"
    : modeParam === "cumulative" ? "rankings"
    : modeParam;
  const mode = TABS.some((t) => t.id === aliased) ? aliased : "rankings";

  const window   = ALLOWED_WINDOWS.has(searchParams.get("win"))    ? searchParams.get("win")    : "week";
  const position = ALLOWED_POSITIONS.has(searchParams.get("pos"))  ? searchParams.get("pos")    : "all";
  const sort     = ALLOWED_SORTS.has(searchParams.get("sort"))     ? searchParams.get("sort")   : "desc";

  // Direction tracking for slide
  const modeIdx = Math.max(0, TABS.findIndex((t) => t.id === mode));
  const prevModeIdxRef = useRef(modeIdx);
  const dirRef = useRef(0);
  if (prevModeIdxRef.current !== modeIdx) {
    dirRef.current = modeIdx > prevModeIdxRef.current ? 1 : -1;
    prevModeIdxRef.current = modeIdx;
  }

  // Sliding pill indicator
  const navRef = useRef(null);
  const refs = useRef([]);
  const [bounds, setBounds] = useState(null);
  useLayoutEffect(() => {
    const idx = TABS.findIndex((t) => t.id === mode);
    const btn = refs.current[idx];
    const nav = navRef.current;
    if (btn && nav) {
      const b = btn.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      setBounds({ left: b.left - n.left, width: b.width });
    }
  }, [mode]);

  function setMode(next) {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (!next || next === "rankings") sp.delete("mode");
      else sp.set("mode", next);
      return sp;
    }, { replace: true });
  }

  return (
    <div>
      {/* Tab pills */}
      <div className="flex justify-center mb-3">
        <div ref={navRef} className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
          {bounds && (
            <m.div
              className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
              initial={{ left: bounds.left, width: bounds.width }}
              animate={{ left: bounds.left, width: bounds.width }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => (refs.current[i] = el)}
              onClick={() => setMode(t.id)}
              className="relative px-4 py-1.5 rounded-full text-xs font-medium z-10 transition-colors duration-200"
              style={{
                color: mode === t.id ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] uppercase tracking-widest text-text-tertiary mb-6">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent font-semibold mr-2">
          Beta
        </span>
        NBA only
      </p>

      <FilterBar window={window} position={position} sort={sort} />

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={dirRef.current} initial={false}>
          <m.div
            key={`mode:${mode}:${window}:${sort}:${position}`}
            custom={dirRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 350, damping: 32 },
              opacity: { duration: 0.18 },
            }}
          >
            {mode === "rankings"     && <RankingsList     window={window} sort={sort} position={position} />}
            {mode === "performances" && <PerformancesList window={window} sort={sort} position={position} />}
            {mode === "plays"        && <PlaysList        window={window} sort={sort} position={position} />}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old `TopPerformers.jsx`**

```bash
git rm frontend/src/components/highlights/TopPerformers.jsx
```

- [ ] **Step 3: Build + smoke check**

```bash
cd frontend && npm run dev
# In a browser, visit http://localhost:5173/pulse
# Click each of the 3 tabs, change window/sort/position. Watch URL update.
# Click a Performances row → confirm GamePage opens analysis tab and scrolls to player.
# Click a Plays row → confirm GamePage opens plays tab. Scroll/highlight will land in Task 13.
```

Expected: tabs render, filters work, URL stays in sync, rows navigate correctly. (Plays scroll-to-row may not yet land — that's Task 13.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/highlights/HighlightsTab.jsx
git commit -m "feat(highlights): host 3 tabs (Rankings/Performances/Plays) + filter bar"
```

---

### Task 12: Update component tests

**Files:**
- Modify: `frontend/src/__tests__/components/TopPerformancesCard.test.jsx`

The existing test file currently targets the old `TopPerformers` component. Re-target to verify each new list renders correctly.

- [ ] **Step 1: Read existing test to understand patterns used**

```bash
cat frontend/src/__tests__/components/TopPerformancesCard.test.jsx | head -80
```

- [ ] **Step 2: Replace tests to cover the three list components**

Replace the file with three `describe` blocks — one per list component. Use `renderWithProviders`, mock the hook with `vi.mock`, and assert:

```jsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/testUtils.jsx";
import RankingsList from "../../components/highlights/tabs/RankingsList.jsx";
import PerformancesList from "../../components/highlights/tabs/PerformancesList.jsx";
import PlaysList from "../../components/highlights/tabs/PlaysList.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const player = (id, name = "Player " + id) => ({
  id, name, slug: name.toLowerCase().replace(/\s+/g, "-"),
  imageUrl: "/p.png", position: "G",
  team: { id: 1, abbreviation: "GSW", primary_color: "#1D428A" },
});
const game = (id, opp = "LAL") => ({
  id, date: "2026-05-08T00:00:00Z",
  opponent: { id: 2, abbreviation: opp }, isHome: true, result: "W",
});

beforeEach(() => useTopPerformances.mockReset());

describe("RankingsList", () => {
  test("renders top 3 as heroes and rest as compact", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: Array.from({ length: 5 }, (_, i) => ({
        player: player(i + 1), totalRating: 100 - i, gamesPlayed: 5, avgPerGame: 20 - i,
      })) },
    });
    renderWithProviders(<RankingsList window="week" sort="desc" position="all" />);
    // Hero rows display "#1" "#2" "#3"
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    // Compact rows display 4 / 5
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("PerformancesList", () => {
  test("Performances row links to ?tab=analysis#slug", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: [{
        player: player(1, "Curry"),
        game: game(100),
        ratingGrade: 9.5,
        stats: { points: 40, rebounds: 5, assists: 7 },
      }] },
    });
    renderWithProviders(<PerformancesList window="week" sort="desc" position="all" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(/\/games\/100\?tab=analysis#curry$/);
  });
});

describe("PlaysList", () => {
  test("Plays row links to ?tab=plays#play-<id>", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: [{
        player: player(1),
        game: game(100),
        play: { id: 9001, description: "Curry 3PT", period: 4, clock: "0:32", weightedValue: 4.8 },
      }] },
    });
    renderWithProviders(<PlaysList window="week" sort="desc" position="all" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(/\/games\/100\?tab=plays#play-9001$/);
  });
});
```

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend && npm test -- TopPerformancesCard
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/components/TopPerformancesCard.test.jsx
git commit -m "test(highlights): cover Rankings/Performances/Plays list components"
```

---

## Phase 3 — Deep-link wiring

### Task 13: Add row id to PlayByPlay rows

**Files:**
- Modify: `frontend/src/components/ui/PlayByPlay.jsx`

The existing GamePage hash-scroll effect already finds elements by `id`, scrolls them into view, and applies a 2s `bg-accent/15` highlight. We just need PBP rows to have `id="play-<id>"`.

- [ ] **Step 1: Add id attribute to `PlayRow`'s wrapper `m.div`**

In `frontend/src/components/ui/PlayByPlay.jsx`, locate the `PlayRow` function (~line 139). On the wrapping `<m.div ... >` (around line 143), add an `id` prop:

```jsx
<m.div
  id={play.id != null ? `play-${play.id}` : undefined}
  layout="position"
  initial={isNew ? { opacity: 0, y: -14 } : false}
  // ... rest unchanged
```

- [ ] **Step 2: Verify in browser**

```bash
cd frontend && npm run dev
# Visit a final game's plays tab
# In devtools console: document.querySelector('[id^="play-"]')?.id
```

Expected: returns something like `"play-12345"`.

- [ ] **Step 3: Test hash scroll in browser**

Visit a URL like `http://localhost:5173/nba/games/<id>?tab=plays#play-<playId>` directly. Expected: page loads on Plays tab, scrolls to the play, brief highlight pulse.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/PlayByPlay.jsx
git commit -m "feat(plays): expose row id for hash-anchor deep-linking"
```

---

### Task 14: Fix GamePage hash-scroll fallback so `?tab=plays` deep-links work

**Files:**
- Modify: `frontend/src/pages/GamePage.jsx`

The current effect (lines 58–88) auto-switches to the `analysis` tab when the hash element isn't found. That's wrong when the URL explicitly carries `?tab=plays` and the play row is just not yet mounted (or when the hash points at a play, not a player slug).

- [ ] **Step 1: Replace the fallback logic**

In `frontend/src/pages/GamePage.jsx` around line 58, change the effect body. Replace:

```jsx
if (!row) {
  if (activeTab !== "analysis") handleTabChange("analysis");
  return;
}
```

with:

```jsx
if (!row) {
  // Only fall back to analysis if the hash looks like a player slug (no
  // `play-` prefix) AND the URL didn't explicitly select a tab.
  const explicitTab = new URLSearchParams(location.search).get("tab");
  const hashId = location.hash.slice(1);
  if (!explicitTab && !hashId.startsWith("play-") && activeTab !== "analysis") {
    handleTabChange("analysis");
  }
  return;
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd frontend && npm run dev
# Visit /nba/games/<id>?tab=plays#play-<playId> — should land on Plays tab and scroll/highlight.
# Visit /nba/games/<id>?tab=analysis#stephen-curry — should land on Analysis tab and scroll/highlight.
# Visit /nba/games/<id>#stephen-curry — should fall back to Analysis tab (existing behavior).
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/GamePage.jsx
git commit -m "fix(GamePage): respect ?tab= when hash target is missing on first paint"
```

---

## Phase 4 — Docs + cleanup

### Task 15: Update docs

**Files:**
- Modify: `docs/api-reference.md`
- Modify: `docs/file-map.md`

- [ ] **Step 1: Update API reference**

In `docs/api-reference.md`, find the `top-performances` entry. Update its query-param table to:

```
?type=rankings|performances|plays   (default: performances; aliases: cumulative→rankings, games→performances)
?window=today|week|month|season|all (default: week; legacy: days=N)
?sort=desc|asc                       (default: desc; ignored shape-wise on rankings but applies to ORDER BY)
?position=all|G|F|C                  (default: all)
?limit=N                             (capped at 25)
```

Add a one-line note: "Response includes a `play` object on rows when `type=plays` (`{id, description, period, clock, weightedValue, wpaDelta}`)."

- [ ] **Step 2: Update file map**

In `docs/file-map.md`, under the highlights section, replace the `TopPerformers.jsx` entry with the new tree:

```
frontend/src/components/highlights/
  HighlightsTab.jsx                 — 3-tab host: Rankings / Performances / Plays
  filters/FilterBar.jsx             — Window/Position/Sort pill rails
  rows/HeroRow.jsx                  — top-3 hero rendering
  rows/CompactRow.jsx               — rank 4–25 row
  tabs/RankingsList.jsx             — cumulative leaderboard
  tabs/PerformancesList.jsx         — best/worst single games
  tabs/PlaysList.jsx                — best/worst single plays
```

- [ ] **Step 3: Commit**

```bash
git add docs/api-reference.md docs/file-map.md
git commit -m "docs: document Highlights expansion (top-performances params, file map)"
```

---

### Task 16: Final verify

- [ ] **Step 1: Backend verify**

```bash
cd backend && npm run verify
```

Expected: lint + tests pass.

- [ ] **Step 2: Frontend verify**

```bash
cd frontend && npm run verify
```

Expected: lint + tests + build pass.

- [ ] **Step 3: Final manual smoke pass**

```bash
cd frontend && npm run dev
```

- Visit `/pulse` (NBA pill active or no league pill).
- Cycle through Rankings / Performances / Plays.
- Cycle through windows including Season + All-time (verify cache + index responsiveness — not user-visible but confirm no obvious lag).
- Toggle sort=Worst on Performances and Plays.
- Filter by G / F / C.
- Click a row in each tab and verify deep-link lands on the expected GamePage tab + scrolls + highlights.
- On a touch-only device or in Chrome devtools mobile mode, verify no hover-prefetch fires.

- [ ] **Step 4: Push branch**

```bash
git push origin HEAD
```

---

## Self-review (post-write)

Spec coverage check:
- 3 tabs (Rankings/Performances/Plays): T11 ✓
- Windows (today/week/month/season/all): T3 (resolveWindow), T4 (wired in service), T9 (FilterBar), T11 (URL parsing) ✓
- Sort high/low on all 3 tabs: T4 (service), T9 (FilterBar), T11 ✓
- Position filter (All/G/F/C): T3, T4, T9, T11 ✓
- Top 3 heroes + 4–25 compact: T8, T10 ✓
- Performances → `?tab=analysis#slug`: T10 (PerformancesList), T12 ✓
- Plays → `?tab=plays#play-id` + PBP row id + GamePage fallback fix: T10, T13, T14 ✓
- Rankings → PlayerPage: T10 ✓
- Date column on today/week: T10 ✓
- Cache TTLs per window: T4 ✓
- Indexes: T1 ✓
- CACHE_VERSION bump: T2 ✓
- Legacy params (days, type=games|cumulative) still work: T4 (alias logic + test) ✓
- NBA-only gate: existing controller check preserved in T6 ✓
- PBP "isNew" collision: low risk, called out in spec; existing GamePage highlight logic owns the visual, isNew flash is short and orthogonal — no task needed unless observed in T16 smoke.

No placeholders found. Type and function names consistent across tasks (`resolveWindow`, `positionPredicate`, `buildFilters`, `queryPerformances`, `queryRankings`, `queryPlays`, `shapePlayRow`).
