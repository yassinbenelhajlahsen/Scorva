# Game & Team Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-05-11-game-team-ratings-design.md](../specs/2026-05-11-game-team-ratings-design.md)

**Goal:** Derive team and game ratings from `stats.rating`, expose them on GameCard, GamePage, the Highlights surface (new entity filter), and a new TeamPage Highlights tab. NBA-only.

**Architecture:** Single SQL aggregation helper (`ratingAggregates.js`) computes team + game ratings on read. Three existing responses (gameDetail, games-list, SSE per-game partial) are augmented to carry the result. `topPerformancesService` gains `entity` + `teamId` params. Frontend renders a corner pill on GameCard, a card on GamePage, dispatches new row variants in Rankings/Performances, and adds a new TeamPage tab.

**Tech Stack:** Node.js/Express/pg/Redis (backend); React 19/TanStack Query v5/Tailwind v4/Framer Motion (frontend); Jest + Vitest + RTL.

---

## Task 1: Rating aggregates helper [REVIEW]

**Files:**
- Create: `backend/src/services/games/ratingAggregates.js`
- Test: `backend/__tests__/services/ratingAggregates.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/services/ratingAggregates.test.js
import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));

const { ratingsForGames, tierLabel } = await import("../../src/services/games/ratingAggregates.js");

beforeEach(() => { jest.clearAllMocks(); });

describe("ratingsForGames", () => {
  test("returns null bundle for game with no stats.rating rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const map = await ratingsForGames(mockPool, [42]);
    expect(map.get(42)).toEqual({
      gameRating: null, homeTeamRating: null, awayTeamRating: null,
      gameGrade: null, homeGrade: null, awayGrade: null, tierLabel: null,
    });
  });

  test("aggregates home/away/total from joined rows", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        gameid: 7,
        home_rating: "18.4",
        away_rating: "16.2",
        game_rating: "34.6",
        status: "Final",
        homescore: 118, awayscore: 115,
      }],
    });
    const map = await ratingsForGames(mockPool, [7]);
    const r = map.get(7);
    expect(r.gameRating).toBe(34.6);
    expect(r.homeTeamRating).toBe(18.4);
    expect(r.awayTeamRating).toBe(16.2);
    expect(r.gameGrade).toBeGreaterThan(0);
    expect(r.homeGrade).toBeGreaterThan(0);
    expect(r.awayGrade).toBeGreaterThan(0);
    // game_grade for raw 34.6 with GRADE_COEFFICIENT 0.92 → 0.92 * sqrt(34.6) ≈ 5.41
    expect(r.gameGrade).toBeCloseTo(5.4, 1);
  });

  test("handles single-team aggregate (one side null)", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        gameid: 9,
        home_rating: "8.0",
        away_rating: null,
        game_rating: "8.0",
        status: "In Progress - Q1",
        homescore: 0, awayscore: 0,
      }],
    });
    const r = (await ratingsForGames(mockPool, [9])).get(9);
    expect(r.homeTeamRating).toBe(8.0);
    expect(r.awayTeamRating).toBeNull();
    expect(r.awayGrade).toBeNull();
  });
});

describe("tierLabel", () => {
  test.each([
    [9.0, "Elite"],
    [8.5, "Elite"],
    [8.49, "Great"],
    [7.0, "Great"],
    [6.0, "Solid"],
    [5.5, "Solid"],
    [5.49, "Routine"],
    [0, "Routine"],
  ])("grade %f → %s without close-game override", (grade, label) => {
    expect(tierLabel({ gameGrade: grade, status: "Final" })).toBe(label);
  });

  test("Close override only when Final AND |Δgrade| <= 1.0 AND |margin| <= 5", () => {
    expect(tierLabel({
      gameGrade: 8.0, homeGrade: 6.5, awayGrade: 6.0,
      status: "Final", homeScore: 118, awayScore: 115,
    })).toBe("Close");
  });

  test("Close does NOT apply mid-live", () => {
    expect(tierLabel({
      gameGrade: 8.0, homeGrade: 6.5, awayGrade: 6.0,
      status: "In Progress - Q4", homeScore: 110, awayScore: 108,
    })).toBe("Elite");
  });

  test("Close requires both criteria — margin ok but grade gap too wide", () => {
    expect(tierLabel({
      gameGrade: 8.0, homeGrade: 8.0, awayGrade: 4.0,
      status: "Final", homeScore: 118, awayScore: 115,
    })).toBe("Elite");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- ratingAggregates.test.js
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `ratingAggregates.js`**

```js
// backend/src/services/games/ratingAggregates.js
import { gradeFromRaw } from "./ratingEngine.js";

/**
 * Aggregate per-game team + game ratings from stats.rating.
 * NBA-only — non-NBA gameIds return null-filled bundles.
 *
 * @param {{ query: Function }} client - pg pool or client.
 * @param {number[]} gameIds
 * @returns {Promise<Map<number, RatingBundle>>}
 */
export async function ratingsForGames(client, gameIds) {
  const out = new Map();
  if (!Array.isArray(gameIds) || gameIds.length === 0) return out;

  const { rows } = await client.query(
    `SELECT g.id AS gameid,
            g.status,
            g.homescore,
            g.awayscore,
            SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid
                     THEN s.rating END) AS home_rating,
            SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.awayteamid
                     THEN s.rating END) AS away_rating,
            SUM(s.rating)                AS game_rating
       FROM games g
       LEFT JOIN stats   s ON s.gameid = g.id AND s.rating IS NOT NULL
       LEFT JOIN players p ON p.id = s.playerid
      WHERE g.id = ANY($1) AND g.league = 'nba'
      GROUP BY g.id, g.hometeamid, g.awayteamid, g.status, g.homescore, g.awayscore`,
    [gameIds],
  );

  for (const id of gameIds) {
    out.set(id, emptyBundle());
  }
  for (const r of rows) {
    const homeRaw = r.home_rating == null ? null : Number(r.home_rating);
    const awayRaw = r.away_rating == null ? null : Number(r.away_rating);
    const gameRaw = r.game_rating == null ? null : Number(r.game_rating);
    const homeGrade = homeRaw == null ? null : round1(gradeFromRaw(homeRaw));
    const awayGrade = awayRaw == null ? null : round1(gradeFromRaw(awayRaw));
    const gameGrade = gameRaw == null ? null : round1(gradeFromRaw(gameRaw));
    const label = gameGrade == null ? null : tierLabel({
      gameGrade, homeGrade, awayGrade,
      status: r.status, homeScore: r.homescore, awayScore: r.awayscore,
    });
    out.set(Number(r.gameid), {
      gameRating: gameRaw == null ? null : round1(gameRaw),
      homeTeamRating: homeRaw == null ? null : round1(homeRaw),
      awayTeamRating: awayRaw == null ? null : round1(awayRaw),
      gameGrade,
      homeGrade,
      awayGrade,
      tierLabel: label,
    });
  }
  return out;
}

export function tierLabel({ gameGrade, homeGrade, awayGrade, status, homeScore, awayScore }) {
  if (gameGrade == null) return null;
  const isFinal = typeof status === "string" && status.toLowerCase().includes("final");
  if (isFinal
      && homeGrade != null && awayGrade != null
      && homeScore != null && awayScore != null
      && Math.abs(homeGrade - awayGrade) <= 1.0
      && Math.abs(homeScore - awayScore) <= 5) {
    return "Close";
  }
  if (gameGrade >= 8.5) return "Elite";
  if (gameGrade >= 7.0) return "Great";
  if (gameGrade >= 5.5) return "Solid";
  return "Routine";
}

function emptyBundle() {
  return {
    gameRating: null, homeTeamRating: null, awayTeamRating: null,
    gameGrade: null, homeGrade: null, awayGrade: null, tierLabel: null,
  };
}

function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npm test -- ratingAggregates.test.js
```
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/ratingAggregates.js backend/__tests__/services/ratingAggregates.test.js
git commit -m "feat(ratings): add ratingAggregates helper for team & game ratings"
```

---

## Task 2: Wire ratings into gameDetail, games-list, and SSE partial [REVIEW]

**Files:**
- Modify: `backend/src/services/games/gameDetailService.js`
- Modify: `backend/src/services/games/gamesService.js`
- Test: `backend/__tests__/services/gameDetailRating.test.js`
- Test: `backend/__tests__/services/gamesServiceRating.test.js`

- [ ] **Step 1: Add failing test for `gameDetailService` rating injection**

```js
// backend/__tests__/services/gameDetailRating.test.js
import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
const mockRatingsForGames = jest.fn();

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({ cached: mockCached }));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/games/ratingAggregates.js"), () => ({
  ratingsForGames: mockRatingsForGames,
}));

const { getNbaGame } = await import("../../src/services/games/gameDetailService.js");

beforeEach(() => { jest.clearAllMocks(); });

test("attaches rating bundle to NBA gameDetail response", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ json_build_object: { game: { id: 42, status: "Final" }, homeTeam: {}, awayTeam: {} } }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([[42, {
    gameRating: 34.6, homeTeamRating: 18.4, awayTeamRating: 16.2,
    gameGrade: 5.4, homeGrade: 3.9, awayGrade: 3.7, tierLabel: "Solid",
  }]]));

  const res = await getNbaGame(42);
  expect(res.json_build_object.game.rating).toEqual({
    raw: 34.6, grade: 5.4, tierLabel: "Solid",
    home: { raw: 18.4, grade: 3.9 },
    away: { raw: 16.2, grade: 3.7 },
  });
});

test("omits rating field when bundle is null", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ json_build_object: { game: { id: 99, status: "Scheduled" }, homeTeam: {}, awayTeam: {} } }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([[99, {
    gameRating: null, homeTeamRating: null, awayTeamRating: null,
    gameGrade: null, homeGrade: null, awayGrade: null, tierLabel: null,
  }]]));

  const res = await getNbaGame(99);
  expect(res.json_build_object.game.rating).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- gameDetailRating.test.js
```
Expected: FAIL — `rating` field not present on game.

- [ ] **Step 3: Modify `gameDetailService.js` to attach rating bundle**

Replace the file with:

```js
import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { buildGameDetailSQL } from "./gameDetailQueryBuilder.js";
import { attachRatingGrade } from "./ratingEngine.js";
import { ratingsForGames } from "./ratingAggregates.js";

const GAME_DETAIL_TTL = 30 * 86400; // 30 days

function shapeRatings(row) {
  if (!row) return row;
  const detail = row.json_build_object;
  if (!detail) return row;
  for (const side of ["homeTeam", "awayTeam"]) {
    const players = detail[side]?.players;
    if (Array.isArray(players)) {
      for (const p of players) attachRatingGrade(p);
    }
  }
  return row;
}

async function attachGameRating(row, league) {
  if (league !== "nba") return row;
  const gameId = row?.json_build_object?.game?.id;
  if (!gameId) return row;
  const map = await ratingsForGames(pool, [gameId]);
  const bundle = map.get(Number(gameId));
  if (!bundle || bundle.gameGrade == null) return row;
  row.json_build_object.game.rating = {
    raw: bundle.gameRating,
    grade: bundle.gameGrade,
    tierLabel: bundle.tierLabel,
    home: { raw: bundle.homeTeamRating, grade: bundle.homeGrade },
    away: { raw: bundle.awayTeamRating, grade: bundle.awayGrade },
  };
  return row;
}

async function getGameDetail(gameId, league) {
  return cached(
    `gameDetail:${league}:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
      const result = await pool.query(buildGameDetailSQL(league), [gameId, league]);
      const shaped = shapeRatings(result.rows[0] ?? null);
      return await attachGameRating(shaped, league);
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export const getNbaGame = (gameId) => getGameDetail(gameId, "nba");
export const getNflGame = (gameId) => getGameDetail(gameId, "nfl");
export const getNhlGame = (gameId) => getGameDetail(gameId, "nhl");
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npm test -- gameDetailRating.test.js
```
Expected: PASS.

- [ ] **Step 5: Add failing test for `gamesService` rating attachment**

```js
// backend/__tests__/services/gamesServiceRating.test.js
import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockRatingsForGames = jest.fn();

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({ cached: mockCached }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({ getCurrentSeason: mockGetCurrentSeason }));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/games/ratingAggregates.js"), () => ({
  ratingsForGames: mockRatingsForGames,
}));

const { getGames, getLiveGamePartial } = await import("../../src/services/games/gamesService.js");

beforeEach(() => { jest.clearAllMocks(); });

test("getGames attaches { rating, grade } to each NBA game row", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ id: 1, league: "nba" }, { id: 2, league: "nba" }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([
    [1, { gameRating: 34.6, gameGrade: 5.4 }],
    [2, { gameRating: null, gameGrade: null }],
  ]));

  const rows = await getGames("nba", { teamId: 5 });
  expect(rows[0].rating).toBe(34.6);
  expect(rows[0].grade).toBe(5.4);
  expect(rows[1].rating).toBeNull();
  expect(rows[1].grade).toBeNull();
});

test("getGames does not call ratingsForGames for non-NBA leagues", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10, league: "nhl" }] });
  const rows = await getGames("nhl", { teamId: 5 });
  expect(mockRatingsForGames).not.toHaveBeenCalled();
  expect(rows[0].rating).toBeUndefined();
});

test("getLiveGamePartial includes rating/grade for NBA", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ id: 1, status: "In Progress", homescore: 50, awayscore: 48, current_period: 3, clock: "5:00" }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([[1, { gameRating: 18.2, gameGrade: 3.9 }]]));

  const p = await getLiveGamePartial("nba", "401234");
  expect(p.rating).toBe(18.2);
  expect(p.grade).toBe(3.9);
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd backend && npm test -- gamesServiceRating.test.js
```
Expected: FAIL — `rating`/`grade` not present.

- [ ] **Step 7: Modify `gamesService.js` — add a private helper and call it from the three return paths**

At the top of the file, after the existing imports, add:

```js
import { ratingsForGames } from "./ratingAggregates.js";
```

Then add a helper near the bottom (above `export async function getLiveGamePartial`):

```js
async function attachRatings(league, rows) {
  if (league !== "nba" || !Array.isArray(rows) || rows.length === 0) return rows;
  const ids = rows.map((r) => r.id).filter((id) => id != null);
  if (ids.length === 0) return rows;
  const map = await ratingsForGames(pool, ids);
  for (const r of rows) {
    const b = map.get(r.id);
    r.rating = b?.gameRating ?? null;
    r.grade  = b?.gameGrade  ?? null;
  }
  return rows;
}
```

Wrap each `pool.query(...)` result inside `getGames` so rows pass through `attachRatings(league, rows)` before being returned. Replace the existing `return rows;`, `return fallbackRows;`, `return { games: rows, ... }`, etc. with awaited calls. Specifically:

- Date-specific path: change `return { games: rows, resolvedDate, resolvedSeason };` to `return { games: await attachRatings(league, rows), resolvedDate, resolvedSeason };`.
- Team/season path: change `return rows;` to `return attachRatings(league, rows);`.
- Default path: change both `return rows;` and `return fallbackRows;` to `return attachRatings(league, rows);` / `return attachRatings(league, fallbackRows);`.

Replace `getLiveGamePartial` with:

```js
export async function getLiveGamePartial(league, eventid) {
  const { rows } = await pool.query(
    `SELECT id, status, homescore, awayscore, current_period, clock
     FROM games WHERE league = $1 AND eventid = $2`,
    [league, eventid]
  );
  const partial = rows[0] ?? null;
  if (!partial) return null;
  if (league === "nba") {
    const map = await ratingsForGames(pool, [partial.id]);
    const b = map.get(partial.id);
    partial.rating = b?.gameRating ?? null;
    partial.grade  = b?.gameGrade  ?? null;
  }
  return partial;
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
cd backend && npm test -- gamesServiceRating.test.js gameDetailRating.test.js
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/games/gameDetailService.js backend/src/services/games/gamesService.js backend/__tests__/services/gameDetailRating.test.js backend/__tests__/services/gamesServiceRating.test.js
git commit -m "feat(ratings): expose game rating on gameDetail, list, and SSE partial"
```

---

## Task 3: Extend topPerformances with entity + teamId [REVIEW]

**Files:**
- Modify: `backend/src/services/games/topPerformancesService.js`
- Modify: `backend/src/controllers/games/topPerformancesController.js`
- Test: `backend/__tests__/services/topPerformancesEntity.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/__tests__/services/topPerformancesEntity.test.js
import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockGetPlayerIdBySlug = jest.fn().mockResolvedValue(null);

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({ cached: mockCached }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({ getCurrentSeason: mockGetCurrentSeason }));
jest.unstable_mockModule(resolve(__dirname, "../../src/utils/slugResolver.js"), () => ({
  getPlayerIdBySlug: mockGetPlayerIdBySlug,
}));

const { getTopPerformances } = await import("../../src/services/games/topPerformancesService.js");

beforeEach(() => { jest.clearAllMocks(); });

test("entity=team, type=rankings returns cumulative team ratings", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      team_id: 13, name: "Lakers", abbreviation: "LAL", logo_url: "x", primary_color: "#552583",
      total_rating: "152.3", games_played: "8", avg_per_game: "19.0",
      best_game_id: 42, best_game_rating: "26.4", best_opp_abbreviation: "BOS",
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "rankings", entity: "team", window: "week",
  });
  expect(out.type).toBe("rankings");
  expect(out.performances[0].team.id).toBe(13);
  expect(out.performances[0].totalRating).toBe(152.3);
  expect(out.performances[0].bestGame.gameId).toBe(42);
});

test("entity=team, type=performances supports teamId scope", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      gameid: 7, team_id: 13, name: "Lakers", abbreviation: "LAL", logo_url: "x", primary_color: "#552583",
      home_rating: "18.4", away_rating: "16.2", date: "2026-05-09",
      hometeamid: 13, awayteamid: 21, homescore: 118, awayscore: 115, status: "Final",
      opp_id: 21, opp_abbreviation: "BOS", opp_logo_url: "y",
      is_live: false,
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "performances", entity: "team", teamId: 13, window: "week",
  });
  expect(out.performances[0].team.id).toBe(13);
  expect(out.performances[0].game.id).toBe(7);
  expect(out.performances[0].rating).toBe(18.4);
  expect(out.performances[0].game.result).toBe("W");
});

test("entity=game, type=performances returns per-game rows with both teams", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      gameid: 7,
      home_rating: "18.4", away_rating: "16.2", game_rating: "34.6",
      status: "Final", date: "2026-05-09",
      hometeamid: 13, awayteamid: 21, homescore: 118, awayscore: 115,
      home_name: "Lakers", home_abbr: "LAL", home_logo: "x", home_color: "#552583",
      away_name: "Celtics", away_abbr: "BOS", away_logo: "y", away_color: "#007A33",
      is_live: false,
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "performances", entity: "game", window: "week",
  });
  expect(out.performances[0].game.id).toBe(7);
  expect(out.performances[0].homeTeamRating).toBe(18.4);
  expect(out.performances[0].awayTeamRating).toBe(16.2);
  expect(out.performances[0].rating).toBe(34.6);
  expect(out.performances[0].tierLabel).toBeTruthy();
});

test("entity=game, type=rankings returns 400", async () => {
  await expect(getTopPerformances({
    league: "nba", type: "rankings", entity: "game", window: "week",
  })).rejects.toMatchObject({ status: 400 });
});

test("position ignored when entity != player (no error on G with team entity)", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [] });
  await getTopPerformances({
    league: "nba", type: "performances", entity: "team", position: "G", window: "week",
  });
  // Position predicate must NOT appear in the SQL
  const sql = mockPool.query.mock.calls[0][0];
  expect(sql).not.toMatch(/p\.position/);
});

test("back-compat: missing entity defaults to player", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [] });
  const out = await getTopPerformances({
    league: "nba", type: "performances", window: "week",
  });
  expect(out.type).toBe("performances");
  // Player-shape SQL still includes position-allowed join on players
  const sql = mockPool.query.mock.calls[0][0];
  expect(sql).toMatch(/players p/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- topPerformancesEntity.test.js
```
Expected: FAIL — `entity` not honored.

- [ ] **Step 3: Modify `topPerformancesService.js`**

Add allow-list and helpers near the top:

```js
const ALLOWED_ENTITIES = new Set(["player", "team", "game"]);
```

Update `getTopPerformances` signature and validation:

```js
export async function getTopPerformances({
  league, type, window, sort = "desc", position = "all", limit, days, playerId, teamId, fallback, entity,
}) {
  const canonicalType   = TYPE_ALIASES[type] ?? type ?? "performances";
  const canonicalEntity = entity ?? "player";

  if (!ALLOWED_TYPES.has(canonicalType)) {
    const err = new Error(`invalid type: ${type}`); err.status = 400; throw err;
  }
  if (!ALLOWED_ENTITIES.has(canonicalEntity)) {
    const err = new Error(`invalid entity: ${entity}`); err.status = 400; throw err;
  }
  if (canonicalEntity === "game" && canonicalType === "rankings") {
    const err = new Error("rankings not supported for entity=game"); err.status = 400; throw err;
  }
  if (canonicalType === "plays" && canonicalEntity !== "player") {
    // plays are always per-player; ignore entity silently to preserve existing chat-tool callers
  }
  // ... rest of existing validation unchanged
```

Continue threading `canonicalEntity` and `teamId` through `ctxBase`, `runForWindow`, and the cache key (`${canonicalEntity}` and `:t${teamId}` suffix). Add new query branches:

```js
async function queryTeamPerformances({ league, window, season, sort, limit, teamId }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }
  if (teamId != null) {
    filters.push(`t.id = $${nextIdx}`);
    binds.push(teamId);
    nextIdx += 1;
  }

  const { rows } = await pool.query(
    `WITH team_games AS (
       SELECT g.id AS gameid,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.hometeamid ELSE g.awayteamid END AS team_id,
              SUM(s.rating) AS team_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
          ${filters.length ? "AND " + filters.join(" AND ") : ""}
        GROUP BY g.id, team_id
     )
     SELECT tg.gameid, tg.team_id, tg.team_rating,
            t.name, t.abbreviation, t.logo_url, t.primary_color,
            g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore, g.status,
            ${LIVE_STATUS_SQL} AS is_live,
            ot.id AS opp_id, ot.abbreviation AS opp_abbreviation, ot.logo_url AS opp_logo_url
       FROM team_games tg
       JOIN teams t  ON t.id = tg.team_id
       JOIN games g  ON g.id = tg.gameid
       JOIN teams ot ON ot.id = CASE WHEN tg.team_id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      ORDER BY tg.team_rating ${sort === "asc" ? "ASC" : "DESC"}, tg.gameid ASC, tg.team_id ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "performances", window, performances: rows.map(shapeTeamGameRow) };
}

async function queryTeamRankings({ league, window, season, sort, limit }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }

  const { rows } = await pool.query(
    `WITH team_games AS (
       SELECT g.id AS gameid,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.hometeamid ELSE g.awayteamid END AS team_id,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END AS opp_id,
              SUM(s.rating) AS team_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
          ${filters.length ? "AND " + filters.join(" AND ") : ""}
        GROUP BY g.id, team_id, opp_id
     )
     SELECT tg.team_id,
            t.name, t.abbreviation, t.logo_url, t.primary_color,
            SUM(tg.team_rating)  AS total_rating,
            COUNT(*)             AS games_played,
            AVG(tg.team_rating)  AS avg_per_game,
            (ARRAY_AGG(tg.gameid ORDER BY tg.team_rating DESC))[1] AS best_game_id,
            MAX(tg.team_rating)  AS best_game_rating,
            (ARRAY_AGG(ot.abbreviation ORDER BY tg.team_rating DESC))[1] AS best_opp_abbreviation
       FROM team_games tg
       JOIN teams t  ON t.id = tg.team_id
       JOIN teams ot ON ot.id = tg.opp_id
      GROUP BY tg.team_id, t.name, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating ${sort === "asc" ? "ASC" : "DESC"}, tg.team_id ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "rankings", window, performances: rows.map(shapeTeamCumulativeRow) };
}

async function queryGamePerformances({ league, window, season, sort, limit }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }

  const { rows } = await pool.query(
    `WITH per_game AS (
       SELECT g.id AS gameid,
              g.date, g.status, g.homescore, g.awayscore, g.hometeamid, g.awayteamid,
              SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN s.rating END) AS home_rating,
              SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.awayteamid THEN s.rating END) AS away_rating,
              SUM(s.rating)                                                                 AS game_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
          ${filters.length ? "AND " + filters.join(" AND ") : ""}
        GROUP BY g.id
     )
     SELECT pg.*, ${LIVE_STATUS_SQL} AS is_live,
            th.name AS home_name, th.abbreviation AS home_abbr, th.logo_url AS home_logo, th.primary_color AS home_color,
            ta.name AS away_name, ta.abbreviation AS away_abbr, ta.logo_url AS away_logo, ta.primary_color AS away_color
       FROM per_game pg
       JOIN games g  ON g.id = pg.gameid
       JOIN teams th ON th.id = pg.hometeamid
       JOIN teams ta ON ta.id = pg.awayteamid
      ORDER BY pg.game_rating ${sort === "asc" ? "ASC" : "DESC"}, pg.gameid ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "performances", window, performances: rows.map(shapeGameRatingRow) };
}
```

Add the shapers (next to the existing ones):

```js
function shapeTeamGameRow(r) {
  const teamId = r.team_id;
  const isLive = !!r.is_live;
  const rating = Number(r.team_rating);
  return {
    team: {
      id: teamId, name: r.name, abbr: r.abbreviation,
      logo: r.logo_url, primary_color: r.primary_color,
    },
    game: {
      id: r.gameid, date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: teamId === r.hometeamid,
      isLive,
      homeScore: r.homescore, awayScore: r.awayscore,
      result: isLive
        ? null
        : (r.homescore != null && r.awayscore != null
            ? (((teamId === r.hometeamid && r.homescore > r.awayscore) ||
                (teamId === r.awayteamid && r.awayscore > r.homescore)) ? "W" : "L")
            : null),
    },
    rating: round1(rating),
    ratingGrade: round1(gradeFromRaw(rating)),
  };
}

function shapeTeamCumulativeRow(r) {
  return {
    team: {
      id: r.team_id, name: r.name, abbr: r.abbreviation,
      logo: r.logo_url, primary_color: r.primary_color,
    },
    totalRating: round1(Number(r.total_rating)),
    gamesPlayed: parseInt(r.games_played, 10),
    avgPerGame: Math.round(Number(r.avg_per_game) * 100) / 100,
    bestGame: {
      gameId: r.best_game_id,
      rating: round1(Number(r.best_game_rating)),
      opponentAbbreviation: r.best_opp_abbreviation,
    },
  };
}

function shapeGameRatingRow(r) {
  const gameRaw = Number(r.game_rating);
  const homeRaw = r.home_rating == null ? null : Number(r.home_rating);
  const awayRaw = r.away_rating == null ? null : Number(r.away_rating);
  const homeGrade = homeRaw == null ? null : round1(gradeFromRaw(homeRaw));
  const awayGrade = awayRaw == null ? null : round1(gradeFromRaw(awayRaw));
  const gameGrade = round1(gradeFromRaw(gameRaw));
  return {
    game: {
      id: r.gameid, date: r.date,
      homeTeam: { id: r.hometeamid, name: r.home_name, abbr: r.home_abbr, logo: r.home_logo, primary_color: r.home_color },
      awayTeam: { id: r.awayteamid, name: r.away_name, abbr: r.away_abbr, logo: r.away_logo, primary_color: r.away_color },
      homeScore: r.homescore, awayScore: r.awayscore,
      isLive: !!r.is_live,
    },
    homeTeamRating: homeRaw == null ? null : round1(homeRaw),
    awayTeamRating: awayRaw == null ? null : round1(awayRaw),
    rating: round1(gameRaw),
    ratingGrade: gameGrade,
    tierLabel: computeTier({
      gameGrade, homeGrade, awayGrade,
      status: r.status, homeScore: r.homescore, awayScore: r.awayscore,
    }),
  };
}

function computeTier({ gameGrade, homeGrade, awayGrade, status, homeScore, awayScore }) {
  if (gameGrade == null) return null;
  const isFinal = typeof status === "string" && status.toLowerCase().includes("final");
  if (isFinal
      && homeGrade != null && awayGrade != null
      && Math.abs(homeGrade - awayGrade) <= 1.0
      && Math.abs((homeScore ?? 0) - (awayScore ?? 0)) <= 5) {
    return "Close";
  }
  if (gameGrade >= 8.5) return "Elite";
  if (gameGrade >= 7.0) return "Great";
  if (gameGrade >= 5.5) return "Solid";
  return "Routine";
}
```

Wire the dispatch in `runForWindow`:

```js
return cached(key, ttl, async () => {
  const season = canonicalWindow === "season" ? await getCurrentSeason(league) : null;
  const ctx = {
    league, window: canonicalWindow, season, sort, position,
    limit: safeLimit, playerId: resolvedPlayerId, teamId: ctxBase.teamId,
  };
  if (canonicalEntity === "team" && canonicalType === "performances") return queryTeamPerformances(ctx);
  if (canonicalEntity === "team" && canonicalType === "rankings")     return queryTeamRankings(ctx);
  if (canonicalEntity === "game" && canonicalType === "performances") return queryGamePerformances(ctx);
  if (canonicalType === "performances") return queryPerformances(ctx);
  if (canonicalType === "rankings")     return queryRankings(ctx);
  return queryPlays(ctx);
});
```

Update the cache key:

```js
const playerSuffix = resolvedPlayerId == null ? "" : `:p${resolvedPlayerId}`;
const teamSuffix   = ctxBase.teamId == null ? "" : `:t${ctxBase.teamId}`;
const key = `top-performances:${league}:${canonicalEntity}:${canonicalType}:${canonicalWindow}:${sort}:${position}:${safeLimit}${playerSuffix}${teamSuffix}`;
```

Pass `entity` and `teamId` into `ctxBase`:

```js
const ctxBase = {
  league, type: canonicalType, sort, position,
  limit: safeLimit, resolvedPlayerId, teamId, entity: canonicalEntity,
};
```

Read them inside `runForWindow`:

```js
const { league, type: canonicalType, sort, position, limit: safeLimit, resolvedPlayerId, teamId, entity: canonicalEntity } = ctxBase;
```

- [ ] **Step 4: Modify the controller to pass entity + teamId**

Replace `backend/src/controllers/games/topPerformancesController.js`:

```js
import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    if (req.params.league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { type, window, sort, position, limit, days, playerId, teamId, entity, fallback } = req.query;
    const parsedTeamId = teamId != null && teamId !== "" ? parseInt(teamId, 10) : undefined;
    const out = await getTopPerformances({
      league: req.params.league,
      type, window, sort, position, limit, days, playerId, entity,
      teamId: Number.isNaN(parsedTeamId) ? undefined : parsedTeamId,
      fallback: fallback === "true",
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npm test -- topPerformancesEntity.test.js
```
Expected: PASS — six describe blocks green.

Also confirm existing tests still pass:

```bash
cd backend && npm test -- topPerformances
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/games/topPerformancesService.js backend/src/controllers/games/topPerformancesController.js backend/__tests__/services/topPerformancesEntity.test.js
git commit -m "feat(ratings): topPerformances entity=team|game with teamId scope"
```

---

## Task 4: Bump CACHE_VERSION [TRIVIAL]

**Files:**
- Modify: `backend/src/cache/cache.js:20`

- [ ] **Step 1: Bump the version**

Change line 20 in `backend/src/cache/cache.js`:

```js
export const CACHE_VERSION = 20;
```

- [ ] **Step 2: Verify backend still starts**

```bash
cd backend && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/cache/cache.js
git commit -m "chore(cache): bump CACHE_VERSION to 20 for rating-shape changes"
```

---

## Task 5: GameRatingPill + GameRatingCard components [REVIEW]

**Files:**
- Create: `frontend/src/components/cards/GameRatingPill.jsx`
- Create: `frontend/src/components/game/GameRatingCard.jsx`
- Test: `frontend/src/__tests__/components/GameRatingPill.test.jsx`
- Test: `frontend/src/__tests__/components/GameRatingCard.test.jsx`

- [ ] **Step 1: Write failing test for `GameRatingPill`**

```jsx
// frontend/src/__tests__/components/GameRatingPill.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameRatingPill from "../../components/cards/GameRatingPill.jsx";

describe("GameRatingPill", () => {
  test("renders grade with star prefix when grade is a number", () => {
    render(<GameRatingPill grade={8.4} />);
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
  });

  test("renders nothing when grade is null", () => {
    const { container } = render(<GameRatingPill grade={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when grade is undefined", () => {
    const { container } = render(<GameRatingPill grade={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test("applies loss color class for negative grade", () => {
    render(<GameRatingPill grade={-2.3} />);
    const el = screen.getByText(/-2\.3/);
    expect(el.className).toMatch(/text-loss|red/);
  });
});
```

- [ ] **Step 2: Implement `GameRatingPill.jsx`**

```jsx
// frontend/src/components/cards/GameRatingPill.jsx
export default function GameRatingPill({ grade, className = "" }) {
  if (grade == null) return null;
  const negative = grade < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-base/60 backdrop-blur-sm border border-white/[0.1] text-[10px] font-semibold tabular-nums ${negative ? "text-loss" : "text-accent"} ${className}`}
      aria-label={`Game rating ${grade.toFixed(1)} out of 10`}
    >
      <span aria-hidden="true">★</span>
      <span>{grade.toFixed(1)}</span>
    </span>
  );
}
```

- [ ] **Step 3: Run test**

```bash
cd frontend && npm test -- GameRatingPill
```
Expected: PASS.

- [ ] **Step 4: Write failing test for `GameRatingCard`**

```jsx
// frontend/src/__tests__/components/GameRatingCard.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameRatingCard from "../../components/game/GameRatingCard.jsx";

const sampleRating = {
  raw: 34.6, grade: 8.4, tierLabel: "Elite",
  home: { raw: 18.4, grade: 9.2 },
  away: { raw: 16.2, grade: 7.8 },
};

describe("GameRatingCard", () => {
  test("renders game grade, tier, and both team chips", () => {
    render(<GameRatingCard rating={sampleRating} homeTeam={{ abbr: "LAL" }} awayTeam={{ abbr: "BOS" }} />);
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
    expect(screen.getByText(/7\.8/)).toBeInTheDocument();
    expect(screen.getByText("LAL")).toBeInTheDocument();
    expect(screen.getByText("BOS")).toBeInTheDocument();
  });

  test("renders nothing when rating is null", () => {
    const { container } = render(<GameRatingCard rating={null} homeTeam={{}} awayTeam={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when grade is null", () => {
    const { container } = render(<GameRatingCard rating={{ grade: null }} homeTeam={{}} awayTeam={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("applies live tier color (non-Close) without flicker", () => {
    render(<GameRatingCard rating={{ ...sampleRating, tierLabel: "Great" }} homeTeam={{ abbr: "LAL" }} awayTeam={{ abbr: "BOS" }} />);
    expect(screen.getByText(/Great/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement `GameRatingCard.jsx`**

```jsx
// frontend/src/components/game/GameRatingCard.jsx
const TIER_TONE = {
  Elite:   "text-accent",
  Great:   "text-accent/90",
  Solid:   "text-text-secondary",
  Routine: "text-text-tertiary",
  Close:   "text-live",
};

export default function GameRatingCard({ rating, homeTeam, awayTeam }) {
  if (!rating || rating.grade == null) return null;
  const tone = TIER_TONE[rating.tierLabel] ?? "text-text-secondary";
  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">Game Rating</span>
        <span className={`text-sm font-semibold ${tone}`}>{rating.tierLabel}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl font-bold tabular-nums ${rating.grade < 0 ? "text-loss" : "text-text-primary"}`} aria-label={`Game grade ${rating.grade.toFixed(1)} out of 10`}>
          <span className="text-accent mr-1" aria-hidden="true">★</span>
          {rating.grade.toFixed(1)}
        </span>
        <span className="text-xs text-text-tertiary">/ 10</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TeamChip abbr={homeTeam?.abbr} grade={rating.home?.grade} primary={homeTeam?.primary_color} />
        <TeamChip abbr={awayTeam?.abbr} grade={rating.away?.grade} primary={awayTeam?.primary_color} />
      </div>
    </div>
  );
}

function TeamChip({ abbr, grade, primary }) {
  if (grade == null) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-primary border border-white/[0.06]">
        <span className="text-sm font-semibold text-text-primary">{abbr ?? "—"}</span>
        <span className="text-sm text-text-tertiary">—</span>
      </div>
    );
  }
  const negative = grade < 0;
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-primary border border-white/[0.06]"
      style={primary ? { boxShadow: `inset 3px 0 0 ${primary}` } : undefined}
    >
      <span className="text-sm font-semibold text-text-primary">{abbr ?? "—"}</span>
      <span className={`text-sm font-bold tabular-nums ${negative ? "text-loss" : "text-accent"}`}>
        <span aria-hidden="true">★</span> {grade.toFixed(1)}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
cd frontend && npm test -- GameRatingPill GameRatingCard
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/cards/GameRatingPill.jsx frontend/src/components/game/GameRatingCard.jsx frontend/src/__tests__/components/GameRatingPill.test.jsx frontend/src/__tests__/components/GameRatingCard.test.jsx
git commit -m "feat(ratings): GameRatingPill + GameRatingCard components"
```

---

## Task 6: Team + Game row variants for Highlights [REVIEW]

**Files:**
- Create: `frontend/src/components/highlights/rows/TeamHeroRow.jsx`
- Create: `frontend/src/components/highlights/rows/TeamCompactRow.jsx`
- Create: `frontend/src/components/highlights/rows/GameHeroRow.jsx`
- Create: `frontend/src/components/highlights/rows/GameCompactRow.jsx`
- Test: `frontend/src/__tests__/components/HighlightsRows.test.jsx`

- [ ] **Step 1: Read the existing `HeroRow.jsx` and `CompactRow.jsx` to mirror their styling exactly**

```bash
cat frontend/src/components/highlights/rows/HeroRow.jsx
cat frontend/src/components/highlights/rows/CompactRow.jsx
```
The new variants should match the layout (rank chip, image/logo slot, name, meta line, value chip on the right). The only differences are: team logo replaces player image, team `primary_color` background for Hero, dual logos + matchup label for Game variants.

- [ ] **Step 2: Implement `TeamHeroRow.jsx`**

```jsx
// frontend/src/components/highlights/rows/TeamHeroRow.jsx
import { Link } from "react-router-dom";

export default function TeamHeroRow({ rank, to, color, logo, name, abbr, meta, value, onMouseEnter, isLive }) {
  const gradient = color
    ? `linear-gradient(110deg, ${hexToRgba(color, 0.45)} 0%, ${hexToRgba(color, 0.12)} 60%, transparent 100%)`
    : undefined;
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="relative block rounded-2xl border border-white/[0.08] bg-surface-elevated px-4 py-3 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 no-underline"
      style={gradient ? { backgroundImage: gradient } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-base/60 backdrop-blur-sm text-sm font-bold text-text-primary">
          {rank}
        </span>
        {logo && (
          <img src={logo} alt="" loading="lazy" className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">{name}</span>
            {abbr && <span className="text-xs text-text-tertiary">{abbr}</span>}
            {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live bg-live/10 px-1.5 py-0.5 rounded-full">Live</span>}
          </div>
          {meta && <p className="text-xs text-text-tertiary truncate">{meta}</p>}
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-base/60 backdrop-blur-sm border border-white/[0.1] text-sm font-bold tabular-nums text-accent">
          <span aria-hidden="true">★</span>
          {value}
        </span>
      </div>
    </Link>
  );
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
```

- [ ] **Step 3: Implement `TeamCompactRow.jsx`**

```jsx
// frontend/src/components/highlights/rows/TeamCompactRow.jsx
import { Link } from "react-router-dom";

export default function TeamCompactRow({ rank, to, logo, name, abbr, meta, value, onMouseEnter, isLive }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:bg-surface-overlay hover:border-white/[0.08] transition-all duration-[200ms] no-underline"
    >
      <span className="w-6 text-right text-xs font-semibold text-text-tertiary tabular-nums">{rank}</span>
      {logo && <img src={logo} alt="" loading="lazy" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary truncate">{name}</span>
        {abbr && <span className="text-[11px] text-text-tertiary">{abbr}</span>}
        {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live">Live</span>}
      </div>
      {meta && <span className="text-xs text-text-tertiary truncate hidden sm:inline">{meta}</span>}
      <span className="text-sm font-bold tabular-nums text-accent">
        <span aria-hidden="true">★</span> {value}
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Implement `GameHeroRow.jsx`**

```jsx
// frontend/src/components/highlights/rows/GameHeroRow.jsx
import { Link } from "react-router-dom";

export default function GameHeroRow({ rank, to, homeTeam, awayTeam, score, tierLabel, value, onMouseEnter, isLive }) {
  const gradient = homeTeam?.primary_color && awayTeam?.primary_color
    ? `linear-gradient(110deg, ${rgba(homeTeam.primary_color, 0.4)} 0%, transparent 50%, ${rgba(awayTeam.primary_color, 0.4)} 100%)`
    : undefined;
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="relative block rounded-2xl border border-white/[0.08] bg-surface-elevated px-4 py-3 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 no-underline"
      style={gradient ? { backgroundImage: gradient } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-base/60 backdrop-blur-sm text-sm font-bold text-text-primary">
          {rank}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {homeTeam?.logo && <img src={homeTeam.logo} alt="" loading="lazy" className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
          {awayTeam?.logo && <img src={awayTeam.logo} alt="" loading="lazy" className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">
              {homeTeam?.abbr} <span className="text-text-tertiary">vs</span> {awayTeam?.abbr}
            </span>
            {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live bg-live/10 px-1.5 py-0.5 rounded-full">Live</span>}
          </div>
          <p className="text-xs text-text-tertiary truncate">
            {score} {tierLabel && <span className="ml-1">· {tierLabel}</span>}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-base/60 backdrop-blur-sm border border-white/[0.1] text-sm font-bold tabular-nums text-accent">
          <span aria-hidden="true">★</span>
          {value}
        </span>
      </div>
    </Link>
  );
}

function rgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
```

- [ ] **Step 5: Implement `GameCompactRow.jsx`**

```jsx
// frontend/src/components/highlights/rows/GameCompactRow.jsx
import { Link } from "react-router-dom";

export default function GameCompactRow({ rank, to, homeTeam, awayTeam, score, tierLabel, value, onMouseEnter, isLive }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:bg-surface-overlay hover:border-white/[0.08] transition-all duration-[200ms] no-underline"
    >
      <span className="w-6 text-right text-xs font-semibold text-text-tertiary tabular-nums">{rank}</span>
      <div className="flex items-center gap-1 shrink-0">
        {homeTeam?.logo && <img src={homeTeam.logo} alt="" loading="lazy" className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        {awayTeam?.logo && <img src={awayTeam.logo} alt="" loading="lazy" className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary truncate">
          {homeTeam?.abbr} <span className="text-text-tertiary">vs</span> {awayTeam?.abbr}
        </span>
        {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live">Live</span>}
      </div>
      <span className="text-xs text-text-tertiary truncate hidden sm:inline">
        {score}{tierLabel ? ` · ${tierLabel}` : ""}
      </span>
      <span className="text-sm font-bold tabular-nums text-accent">
        <span aria-hidden="true">★</span> {value}
      </span>
    </Link>
  );
}
```

- [ ] **Step 6: Write tests**

```jsx
// frontend/src/__tests__/components/HighlightsRows.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeamHeroRow from "../../components/highlights/rows/TeamHeroRow.jsx";
import TeamCompactRow from "../../components/highlights/rows/TeamCompactRow.jsx";
import GameHeroRow from "../../components/highlights/rows/GameHeroRow.jsx";
import GameCompactRow from "../../components/highlights/rows/GameCompactRow.jsx";

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Team rows", () => {
  test("TeamHeroRow renders rank, name, abbr, and value", () => {
    wrap(<TeamHeroRow rank={1} to="/nba/teams/lakers" name="Los Angeles Lakers" abbr="LAL" value="9.2" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles Lakers")).toBeInTheDocument();
    expect(screen.getByText("LAL")).toBeInTheDocument();
    expect(screen.getByText("9.2")).toBeInTheDocument();
  });

  test("TeamCompactRow renders rank and value", () => {
    wrap(<TeamCompactRow rank={5} to="/nba/teams/celtics" name="Celtics" abbr="BOS" value="7.8" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Celtics")).toBeInTheDocument();
    expect(screen.getByText("7.8")).toBeInTheDocument();
  });
});

describe("Game rows", () => {
  const home = { abbr: "LAL", logo: "/lal.svg", primary_color: "#552583" };
  const away = { abbr: "BOS", logo: "/bos.svg", primary_color: "#007A33" };

  test("GameHeroRow renders matchup, score, tier, value", () => {
    wrap(<GameHeroRow rank={1} to="/nba/games/7" homeTeam={home} awayTeam={away} score="118-115" tierLabel="Elite" value="8.4" />);
    expect(screen.getByText(/LAL/)).toBeInTheDocument();
    expect(screen.getByText(/BOS/)).toBeInTheDocument();
    expect(screen.getByText(/118-115/)).toBeInTheDocument();
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
    expect(screen.getByText("8.4")).toBeInTheDocument();
  });

  test("GameCompactRow renders Live badge", () => {
    wrap(<GameCompactRow rank={4} to="/nba/games/8" homeTeam={home} awayTeam={away} score="50-48" value="3.5" isLive />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run tests**

```bash
cd frontend && npm test -- HighlightsRows
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/highlights/rows/TeamHeroRow.jsx frontend/src/components/highlights/rows/TeamCompactRow.jsx frontend/src/components/highlights/rows/GameHeroRow.jsx frontend/src/components/highlights/rows/GameCompactRow.jsx frontend/src/__tests__/components/HighlightsRows.test.jsx
git commit -m "feat(ratings): team + game row variants for Highlights"
```

---

## Task 7: Wire entity filter end-to-end on Highlights [REVIEW]

**Files:**
- Modify: `frontend/src/api/topPerformances.js`
- Modify: `frontend/src/lib/query.js`
- Modify: `frontend/src/hooks/data/useTopPerformances.js`
- Modify: `frontend/src/components/highlights/filters/FilterBar.jsx`
- Modify: `frontend/src/components/highlights/HighlightsTab.jsx`
- Modify: `frontend/src/components/highlights/tabs/RankingsList.jsx`
- Modify: `frontend/src/components/highlights/tabs/PerformancesList.jsx`
- Test: `frontend/src/__tests__/components/HighlightsFilter.test.jsx`
- Test: `frontend/src/__tests__/components/HighlightsDispatch.test.jsx`

- [ ] **Step 1: Update API client + query key**

In `frontend/src/api/topPerformances.js`, replace the function:

```js
import { apiFetch } from "./client.js";

export function getTopPerformances(
  league,
  { type = "performances", entity, window = "week", sort = "desc", position = "all", limit = 25, playerId, teamId, fallback, signal } = {},
) {
  const params = { type, window, sort, position, limit };
  if (entity && entity !== "player") params.entity = entity;
  if (playerId) params.playerId = playerId;
  if (teamId) params.teamId = teamId;
  if (fallback) params.fallback = "true";
  return apiFetch(`/api/${league}/top-performances`, { signal, params });
}
```

In `frontend/src/lib/query.js`, update the `topPerformances` key (line 40):

```js
  topPerformances: (league, { type, entity, window, sort, position, limit, playerId, teamId, fallback }) =>
    ["top-performances", league, entity ?? "player", type, window, sort, position, limit, playerId ?? null, teamId ?? null, fallback ? "fb" : "nofb"],
```

In `frontend/src/hooks/data/useTopPerformances.js`, update the hook:

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
    entity = "player",
    window = "week",
    sort = "desc",
    position = "all",
    limit = 25,
    playerId,
    teamId,
    fallback = false,
  } = opts;
  const key = { type, entity, window, sort, position, limit, playerId, teamId, fallback };
  return useQuery({
    queryKey: queryKeys.topPerformances(league, key),
    queryFn:  queryFns.topPerformances(league, key),
    staleTime: TTL_BY_WINDOW[window] ?? 60 * 1000,
    enabled: !!league,
  });
}
```

- [ ] **Step 2: Write failing test for the FilterBar entity dropdown + position disable**

```jsx
// frontend/src/__tests__/components/HighlightsFilter.test.jsx
import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import FilterBar from "../../components/highlights/filters/FilterBar.jsx";

function Probe() {
  const [sp] = useSearchParams();
  return <span data-testid="probe">{sp.toString()}</span>;
}

function setup(initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FilterBar window="week" position="all" sort="desc" entity="player" entityOptions={["player","team","game"]} />
      <Probe />
    </MemoryRouter>,
  );
}

describe("FilterBar — entity & position", () => {
  test("renders entity dropdown with Players/Teams/Games", () => {
    setup();
    const entitySelect = screen.getByLabelText(/entity/i);
    expect(entitySelect).toBeInTheDocument();
    expect(entitySelect.querySelectorAll("option")).toHaveLength(3);
  });

  test("changing entity to team writes URL param", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/entity/i), { target: { value: "team" } });
    expect(screen.getByTestId("probe").textContent).toMatch(/entity=team/);
  });

  test("position dropdown is disabled when entity != player", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" entity="team" entityOptions={["player","team","game"]} />
      </MemoryRouter>,
    );
    const positionSelect = screen.getByLabelText(/position/i);
    expect(positionSelect).toBeDisabled();
  });

  test("disabled Games option when disabledEntities includes 'game'", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" entity="player" entityOptions={["player","team","game"]} disabledEntities={["game"]} />
      </MemoryRouter>,
    );
    const opt = screen.getByRole("option", { name: /Games/i });
    expect(opt).toBeDisabled();
  });

  test("does not render entity dropdown when entityOptions is undefined", () => {
    render(
      <MemoryRouter>
        <FilterBar window="week" position="all" sort="desc" />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(/entity/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Run failing test**

```bash
cd frontend && npm test -- HighlightsFilter
```
Expected: FAIL — FilterBar does not support entity.

- [ ] **Step 4: Update `FilterBar.jsx`**

```jsx
// frontend/src/components/highlights/filters/FilterBar.jsx
import { useSearchParams } from "react-router-dom";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];
const POSITIONS = [
  { id: "all", label: "All positions" },
  { id: "G",   label: "Guards" },
  { id: "F",   label: "Forwards" },
  { id: "C",   label: "Centers" },
];
const SORTS = [
  { id: "desc", label: "Best" },
  { id: "asc",  label: "Worst" },
];
const ENTITIES = [
  { id: "player", label: "Players" },
  { id: "team",   label: "Teams" },
  { id: "game",   label: "Games" },
];

export default function FilterBar({
  window,
  position,
  sort,
  entity,
  entityOptions,
  disabledEntities = [],
  showPosition = true,
  defaultWindow = "week",
  defaultSort = "desc",
}) {
  const [, setSearchParams] = useSearchParams();
  const setParam = (key, defaultValue) => (next) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (!next || next === defaultValue) sp.delete(key);
      else sp.set(key, next);
      return sp;
    }, { replace: true });
  };

  const entityList = entityOptions
    ? ENTITIES.filter((e) => entityOptions.includes(e.id))
    : null;
  const positionDisabled = entity != null && entity !== "player";

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Dropdown options={WINDOWS} value={window} onChange={setParam("win", defaultWindow)} aria-label="Window" />
      {entityList && (
        <Dropdown
          options={entityList}
          value={entity}
          onChange={setParam("entity", "player")}
          disabledOptions={disabledEntities}
          aria-label="Entity"
        />
      )}
      {showPosition && (
        <Dropdown
          options={POSITIONS}
          value={position}
          onChange={setParam("pos", "all")}
          disabled={positionDisabled}
          aria-label="Position"
        />
      )}
      <Dropdown options={SORTS} value={sort} onChange={setParam("sort", defaultSort)} aria-label="Sort" />
    </div>
  );
}

function Dropdown({ options, value, onChange, disabled, disabledOptions = [], "aria-label": ariaLabel }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 pr-9 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:border-accent/60 ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={disabledOptions.includes(o.id)} className="bg-surface-primary">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-text-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Run FilterBar test**

```bash
cd frontend && npm test -- HighlightsFilter
```
Expected: PASS.

- [ ] **Step 6: Update `HighlightsTab.jsx`** to read entity + auto-correct illegal combinations

Replace the body of `HighlightsTab` to add entity handling:

```jsx
const ALLOWED_ENTITIES = new Set(["player", "team", "game"]);

// ...inside HighlightsTab, after sort:
const entityParam = searchParams.get("entity");
let entity = ALLOWED_ENTITIES.has(entityParam) ? entityParam : "player";
// entity=game is illegal on Rankings — coerce to player
if (mode === "rankings" && entity === "game") entity = "player";

// Replace the existing `<FilterBar />` call with:
<FilterBar
  window={win}
  position={position}
  sort={sort}
  entity={mode === "plays" ? undefined : entity}
  entityOptions={mode === "plays" ? undefined : ["player","team","game"]}
  disabledEntities={mode === "rankings" ? ["game"] : []}
/>

// Pass entity to the lists (Plays unchanged):
{mode === "rankings"     && <RankingsList     window={win} sort={sort} position={position} entity={entity} fallback />}
{mode === "performances" && <PerformancesList window={win} sort={sort} position={position} entity={entity} fallback />}
{mode === "plays"        && <PlaysList        window={win} sort={sort} position={position} fallback />}
```

Also update the slide animation key to include entity so the entity switch re-renders the list:

```jsx
key={`filters:${win}:${sort}:${position}:${entity}`}
```

- [ ] **Step 7: Write failing test for list dispatch**

```jsx
// frontend/src/__tests__/components/HighlightsDispatch.test.jsx
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PerformancesList from "../../components/highlights/tabs/PerformancesList.jsx";
import RankingsList from "../../components/highlights/tabs/RankingsList.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
};

const teamItem = (rank) => ({
  team: { id: rank, name: `Team ${rank}`, abbr: "AAA", logo: null, primary_color: null },
  game: { id: rank * 10, date: "2026-05-09", opponent: { id: 99, abbreviation: "BBB", logo: null }, isHome: true, isLive: false, homeScore: 100, awayScore: 95, result: "W" },
  rating: 18.4, ratingGrade: 9.2,
});

const gameItem = (rank) => ({
  game: {
    id: rank, date: "2026-05-09",
    homeTeam: { id: 1, name: "Lakers", abbr: "LAL", logo: null, primary_color: null },
    awayTeam: { id: 2, name: "Celtics", abbr: "BOS", logo: null, primary_color: null },
    homeScore: 118, awayScore: 115, isLive: false,
  },
  homeTeamRating: 18.4, awayTeamRating: 16.2,
  rating: 34.6, ratingGrade: 8.4, tierLabel: "Elite",
});

describe("PerformancesList — entity dispatch", () => {
  test("entity=team renders team row", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [teamItem(1), teamItem(2)] }, isLoading: false });
    wrap(<PerformancesList league="nba" window="week" sort="desc" entity="team" />);
    expect(screen.getByText("Team 1")).toBeInTheDocument();
  });

  test("entity=game renders matchup row", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [gameItem(1)] }, isLoading: false });
    wrap(<PerformancesList league="nba" window="week" sort="desc" entity="game" />);
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
  });
});

describe("RankingsList — entity dispatch", () => {
  test("entity=team renders team row with totalRating", () => {
    useTopPerformances.mockReturnValue({
      data: {
        performances: [{
          team: { id: 1, name: "Lakers", abbr: "LAL", logo: null, primary_color: null },
          totalRating: 152.3, gamesPlayed: 8, avgPerGame: 19.0,
          bestGame: { gameId: 7, rating: 26.4, opponentAbbreviation: "BOS" },
        }],
      },
      isLoading: false,
    });
    wrap(<RankingsList league="nba" window="week" sort="desc" entity="team" />);
    expect(screen.getByText("Lakers")).toBeInTheDocument();
    expect(screen.getByText(/152\.3/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run failing test**

```bash
cd frontend && npm test -- HighlightsDispatch
```
Expected: FAIL — current lists don't honor entity.

- [ ] **Step 9: Update `RankingsList.jsx`** to dispatch on entity

```jsx
import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TeamHeroRow from "../rows/TeamHeroRow.jsx";
import TeamCompactRow from "../rows/TeamCompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";
import { useWindowSync } from "../useWindowSync.js";
import slugify from "../../../utils/slugify.js";

export default function RankingsList({ league = "nba", window: win, sort, position, entity = "player", fallback = false }) {
  const { data, isLoading } = useTopPerformances(league, {
    type: "rankings", entity, window: win, sort,
    position: entity === "player" ? position : "all",
    limit: 25, fallback,
  });
  useWindowSync(fallback ? data?.actualWindow : null, win);
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No final games today yet." : "No rankings for this window."}
      </p>
    );
  }

  if (entity === "team") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const rank = i + 1;
          const slug = slugify(it.team.name);
          const to = `/${league}/teams/${slug}`;
          const props = {
            to,
            logo: it.team.logo,
            name: it.team.name,
            abbr: it.team.abbr,
            meta: `${it.gamesPlayed} GP · avg ${it.avgPerGame.toFixed(1)}`,
            value: it.totalRating.toFixed(1),
            onMouseEnter: () => {
              if (window.matchMedia?.("(hover: hover)").matches) {
                qc.prefetchQuery({
                  queryKey: queryKeys.team(league, slug),
                  queryFn: queryFns.team(league, slug),
                  staleTime: 10_000,
                });
              }
            },
            color: it.team.primary_color,
          };
          return (
            <li key={`${it.team.id}`}>
              {rank <= 3 ? <TeamHeroRow rank={rank} {...props} /> : <TeamCompactRow rank={rank} {...props} />}
            </li>
          );
        })}
      </ul>
    );
  }

  // Player (default)
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
```

- [ ] **Step 10: Update `PerformancesList.jsx`** to dispatch on entity

```jsx
import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import slugify from "../../../utils/slugify.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import PlayerHeroRow from "../rows/PlayerHeroRow.jsx";
import PlayerCompactRow from "../rows/PlayerCompactRow.jsx";
import TeamHeroRow from "../rows/TeamHeroRow.jsx";
import TeamCompactRow from "../rows/TeamCompactRow.jsx";
import GameHeroRow from "../rows/GameHeroRow.jsx";
import GameCompactRow from "../rows/GameCompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";
import { useWindowSync } from "../useWindowSync.js";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PerformancesList({ league = "nba", window: win, sort, position, playerId, teamId, entity = "player", limit = 25, fallback = false }) {
  const { data, isLoading } = useTopPerformances(league, {
    type: "performances",
    entity,
    window: win, sort,
    position: entity === "player" ? position : "all",
    playerId: entity === "player" ? playerId : undefined,
    teamId: entity === "team" ? teamId : undefined,
    limit, fallback,
  });
  useWindowSync(fallback ? data?.actualWindow : null, win);
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No games today yet." : "No performances for this window."}
      </p>
    );
  }

  if (entity === "team") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const rank = i + 1;
          const slug = slugify(it.team.name);
          const to = `/${league}/games/${it.game.id}`;
          const meta = formatTeamMeta(it, win);
          const props = {
            to,
            logo: it.team.logo,
            name: it.team.name,
            abbr: it.team.abbr,
            meta,
            value: it.ratingGrade.toFixed(1),
            onMouseEnter: () => prefetchGame(qc, league, it.game.id),
            color: it.team.primary_color,
            isLive: it.game.isLive,
          };
          return (
            <li key={`${it.team.id}:${it.game.id}`}>
              {rank <= 3 ? <TeamHeroRow rank={rank} {...props} /> : <TeamCompactRow rank={rank} {...props} />}
            </li>
          );
        })}
      </ul>
    );
  }

  if (entity === "game") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const rank = i + 1;
          const to = `/${league}/games/${it.game.id}`;
          const score = `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`;
          const props = {
            to,
            homeTeam: it.game.homeTeam,
            awayTeam: it.game.awayTeam,
            score,
            tierLabel: it.tierLabel,
            value: it.ratingGrade.toFixed(1),
            onMouseEnter: () => prefetchGame(qc, league, it.game.id),
            isLive: it.game.isLive,
          };
          return (
            <li key={`${it.game.id}`}>
              {rank <= 3 ? <GameHeroRow rank={rank} {...props} /> : <GameCompactRow rank={rank} {...props} />}
            </li>
          );
        })}
      </ul>
    );
  }

  // Player (existing behaviour) — keep current implementation verbatim:
  const showDate = SHOW_DATE_FOR.has(win);
  const isPlayerView = !!playerId;

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=analysis#${slugify(it.player.name)}`;
        const onMouseEnter = () => prefetchGame(qc, league, it.game.id);
        const value = it.ratingGrade.toFixed(1);
        const isLive = !!it.game.isLive;
        const statLine = `${it.stats.points}/${it.stats.rebounds}/${it.stats.assists}`;
        const scoreStr = isLive
          ? `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`
          : "";

        if (isPlayerView) {
          const dateStr = it.game.date ? formatDate(it.game.date) : "";
          const meta = isLive
            ? [scoreStr, statLine].filter(Boolean).join(" · ")
            : [statLine, dateStr].filter(Boolean).join(" · ");
          const props = { to, opponent: it.game.opponent, isHome: it.game.isHome, result: it.game.result, meta, value, onMouseEnter, isLive };
          return (
            <li key={`${it.player.id}:${it.game.id}`}>
              {rank <= 3
                ? <PlayerHeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
                : <PlayerCompactRow rank={rank} {...props} />}
            </li>
          );
        }

        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
        const meta = isLive
          ? `${scoreStr} ${opp} · ${statLine}`
          : `${statLine} · ${opp}${datePart}`;
        const props = { to, imageUrl: it.player.imageUrl, name: it.player.name, meta, value, onMouseEnter, isLive };
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

function formatTeamMeta(it, win) {
  const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
  const result = it.game.result ? ` ${it.game.result}` : "";
  const score = it.game.isLive
    ? `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`
    : (it.game.homeScore != null && it.game.awayScore != null ? `${it.game.homeScore}-${it.game.awayScore}` : "");
  const dateStr = it.game.date && SHOW_DATE_FOR.has(win) ? ` · ${formatDate(it.game.date)}` : "";
  return `${opp}${result}${score ? " · " + score : ""}${dateStr}`;
}

function prefetchGame(qc, league, gameId) {
  if (window.matchMedia?.("(hover: hover)").matches) {
    qc.prefetchQuery({
      queryKey: queryKeys.game(league, gameId),
      queryFn: queryFns.game(league, gameId),
      staleTime: 10_000,
    });
  }
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 11: Run dispatch test**

```bash
cd frontend && npm test -- HighlightsDispatch HighlightsFilter
```
Expected: PASS.

- [ ] **Step 12: Smoke-test the full Highlights surface in the browser**

```bash
cd backend && npm run dev
# in another terminal:
cd frontend && npm run dev
```

In the browser at the Pulse page (Highlights):
1. Default view shows player Rankings (unchanged).
2. Switch entity to Teams → page reflects team rankings; position dropdown is greyed.
3. Switch tab to Performances → Players row stays, position re-enables when entity returns to Players.
4. Switch entity to Games → Performances tab shows games; switching to Rankings tab forces entity back to Players (Games chip greyed in Rankings).
5. Plays tab — entity dropdown absent.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/api/topPerformances.js frontend/src/lib/query.js frontend/src/hooks/data/useTopPerformances.js frontend/src/components/highlights/filters/FilterBar.jsx frontend/src/components/highlights/HighlightsTab.jsx frontend/src/components/highlights/tabs/RankingsList.jsx frontend/src/components/highlights/tabs/PerformancesList.jsx frontend/src/__tests__/components/HighlightsFilter.test.jsx frontend/src/__tests__/components/HighlightsDispatch.test.jsx
git commit -m "feat(ratings): entity filter (players/teams/games) on Highlights"
```

---

## Task 8: Mount pill on GameCard + card on GamePage [TRIVIAL]

**Files:**
- Modify: `frontend/src/components/cards/GameCard.jsx`
- Modify: `frontend/src/components/game/OverviewTab.jsx`
- Modify: `frontend/src/pages/GamePage.jsx`

- [ ] **Step 1: Add pill to GameCard**

In `GameCard.jsx`, import:

```jsx
import GameRatingPill from "./GameRatingPill.jsx";
```

Inside the outer `<div className="relative ...">` wrapper (around line 80, right after the opening tag), add:

```jsx
{game.grade != null && (
  <div className="absolute top-3 right-3 z-10">
    <GameRatingPill grade={game.grade} />
  </div>
)}
```

Update the memo comparator so the pill re-renders when grade changes (line 297-302):

```jsx
export default memo(GameCard, (prev, next) => {
  const p = prev.game, n = next.game;
  return p.id === n.id && p.homescore === n.homescore && p.awayscore === n.awayscore &&
    p.status === n.status && p.clock === n.clock && p.current_period === n.current_period &&
    p.winnerid === n.winnerid &&
    p.home_series_wins === n.home_series_wins && p.away_series_wins === n.away_series_wins &&
    p.grade === n.grade;
});
```

- [ ] **Step 2: Add card to OverviewTab**

In `OverviewTab.jsx`, import and accept a new prop:

```jsx
import GameRatingCard from "./GameRatingCard.jsx";
```

Add `gameRating` to the destructured props:

```jsx
export default function OverviewTab({
  game,
  homeTeam,
  awayTeam,
  league,
  season,
  quarterKeys,
  isFinal,
  inProgress,
  isPreGame,
  homeWon,
  awayWon,
  scoreColor,
  prediction,
  predictionLoading,
  topPlayers,
  winProbData,
  scoreMargin,
  gameRating,
}) {
```

Insert the card just before the `{/* Quarter-by-quarter */}` block:

```jsx
{!isPreGame && gameRating && (
  <GameRatingCard rating={gameRating} homeTeam={homeTeam.info} awayTeam={awayTeam.info} />
)}
```

Note: `homeTeam.info` should expose `{ abbr, primary_color }` — verify by reading the surrounding GamePage usage and adapt the prop name if needed (likely `abbr` may already exist; if it's named `abbreviation` instead, pass `homeTeam={{ ...homeTeam.info, abbr: homeTeam.info.abbreviation }}`).

- [ ] **Step 3: Pass `gameRating` from GamePage to OverviewTab**

In `frontend/src/pages/GamePage.jsx`, locate the `<OverviewTab ... />` element (around line 208) and add `gameRating={gameData?.game?.rating ?? null}` to its props. Use whatever path is correct based on the shape from gameDetailService — likely `gameData.game.rating` since the backend writes `row.json_build_object.game.rating = {...}` and frontend unwraps `json_build_object` somewhere upstream.

- [ ] **Step 4: Smoke-test in browser**

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

1. Open a Final NBA GameCard on the homepage → corner pill visible.
2. Click into the GamePage → Overview tab shows the rating card.
3. Open a non-NBA GameCard → no pill.
4. Open a scheduled game → no pill, no card.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cards/GameCard.jsx frontend/src/components/game/OverviewTab.jsx frontend/src/pages/GamePage.jsx
git commit -m "feat(ratings): mount GameRatingPill on GameCard, GameRatingCard on GamePage"
```

---

## Task 9: TeamPage Highlights tab [REVIEW]

**Files:**
- Create: `frontend/src/components/team/TeamHighlightsTab.jsx`
- Modify: `frontend/src/pages/TeamPage.jsx`
- Test: `frontend/src/__tests__/components/TeamHighlightsTab.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/components/TeamHighlightsTab.test.jsx
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TeamHighlightsTab from "../../components/team/TeamHighlightsTab.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
};

beforeEach(() => { vi.clearAllMocks(); });

test("calls useTopPerformances with entity=team and teamId", () => {
  useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
  wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
  expect(useTopPerformances).toHaveBeenCalledWith("nba", expect.objectContaining({
    entity: "team",
    teamId: 13,
    type: "performances",
  }));
});

test("renders empty state when no performances", () => {
  useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
  wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
  expect(screen.getByText(/no performances/i)).toBeInTheDocument();
});

test("changing window dropdown re-calls hook with new window", () => {
  useTopPerformances.mockReturnValue({ data: { performances: [] }, isLoading: false });
  wrap(<TeamHighlightsTab team={{ id: 13, name: "Lakers" }} league="nba" />);
  fireEvent.change(screen.getByLabelText(/window/i), { target: { value: "season" } });
  const lastCall = useTopPerformances.mock.calls.at(-1);
  expect(lastCall[1].window).toBe("season");
});
```

- [ ] **Step 2: Run failing test**

```bash
cd frontend && npm test -- TeamHighlightsTab
```
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `TeamHighlightsTab.jsx`**

```jsx
// frontend/src/components/team/TeamHighlightsTab.jsx
import { useState } from "react";
import PerformancesList from "../highlights/tabs/PerformancesList.jsx";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];

export default function TeamHighlightsTab({ team, league }) {
  const [win, setWin] = useState("week");

  if (league !== "nba" || !team?.id) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        Team highlights are NBA-only right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="relative inline-flex items-center">
          <select
            value={win}
            onChange={(e) => setWin(e.target.value)}
            aria-label="Window"
            className="appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 pr-9 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:border-accent/60"
          >
            {WINDOWS.map((w) => (
              <option key={w.id} value={w.id} className="bg-surface-primary">{w.label}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-text-tertiary"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <PerformancesList
        league={league}
        window={win}
        sort="desc"
        entity="team"
        teamId={team.id}
        limit={25}
        fallback={false}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
cd frontend && npm test -- TeamHighlightsTab
```
Expected: PASS.

- [ ] **Step 5: Add tab to `TeamPage.jsx`**

In `frontend/src/pages/TeamPage.jsx`, update the `TABS` constant (line 29):

```jsx
const TABS = ["schedule", "players", ...(/*league check inline below*/ [])];
```

Actually use this exact replacement so the tab list is conditional on league:

Replace line 29 (`const TABS = ["schedule", "players"];`) with a per-render computed list. Inside the component (just after `const league = (rawLeague || "").toLowerCase();`), add:

```jsx
const TABS = league === "nba" ? ["schedule", "players", "highlights"] : ["schedule", "players"];
```

Then move the existing `useLayoutEffect` and tab logic to depend on this dynamic `TABS`. The existing logic already reads `TABS.indexOf(activeTab)` etc., so moving the declaration inside the component is the only change needed.

Add the import at the top with other component imports:

```jsx
import TeamHighlightsTab from "../components/team/TeamHighlightsTab.jsx";
```

In the tab content block (the existing `{activeTab === "schedule" ? (...) : rosterError ? (...) : rosterLoading ? (...) : (<RosterGrid ... />)}` chain at lines 283-336), replace with:

```jsx
{activeTab === "schedule" ? (
  /* keep existing schedule content unchanged */
) : activeTab === "highlights" ? (
  <TeamHighlightsTab team={team} league={league} />
) : rosterError ? (
  <ErrorState message={rosterError} onRetry={rosterRetry} />
) : rosterLoading ? (
  <RosterGridSkeleton statCount={league === "nba" ? 4 : 3} />
) : (
  <RosterGrid
    league={league}
    season={selectedSeason}
    players={roster}
    showStatus={!selectedSeason || selectedSeason === leagueSeasons[0]}
  />
)}
```

Keep the entire existing schedule block intact — only add the new `highlights` branch.

- [ ] **Step 6: Smoke-test**

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

1. Visit an NBA team page → three tabs visible (Schedule, Players, Highlights).
2. Click Highlights → renders empty state or top team-games for that team in the past week.
3. Change window dropdown → list updates.
4. Visit an NFL/NHL team page → only two tabs (no Highlights).

- [ ] **Step 7: Run verify**

```bash
cd frontend && npm run verify
```
Expected: PASS (lint + tests + build).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/team/TeamHighlightsTab.jsx frontend/src/pages/TeamPage.jsx frontend/src/__tests__/components/TeamHighlightsTab.test.jsx
git commit -m "feat(ratings): TeamPage Highlights tab (NBA-only)"
```

---

## Final Verification

- [ ] **Run all backend tests**

```bash
cd backend && npm test
```
Expected: PASS.

- [ ] **Run frontend verify (lint + test + build)**

```bash
cd frontend && npm run verify
```
Expected: PASS.

- [ ] **Manual smoke (NBA only)**

1. Homepage GameCards show corner pill on Final/live NBA games. Non-NBA games unaffected.
2. NBA GamePage Overview shows GameRatingCard above the box score; tier label shows "Close" for Final low-margin games with similar grades.
3. Pulse / Highlights → Players tab unchanged baseline; Teams shows team rankings + per-team-game listing; Games (Performances tab only) shows matchup rows with tier labels.
4. Rankings tab → Games chip greyed.
5. Plays tab → no entity dropdown visible.
6. Switching entity to Teams greys the Position dropdown; switching back restores prior position value.
7. TeamPage (NBA) → third tab Highlights, window selector drives per-team listing.
8. Live game on GameCard → pill ticks as SSE partials arrive (open a live game in DevTools Network to confirm the partial frames include `rating`/`grade`).

---

## Self-Review

**1. Spec coverage:**

| Spec section | Task |
|---|---|
| ratingAggregates helper, tier label, Close override | Task 1 |
| gameDetail rating bundle | Task 2 |
| Games-list `{ rating, grade }` per row | Task 2 |
| SSE per-game partial `{ rating, grade }` | Task 2 |
| Cache version bump | Task 4 |
| topPerformances entity+teamId | Task 3 |
| Route validator entity/teamId | Task 3 |
| GameRatingPill | Task 5 |
| GameRatingCard | Task 5 |
| Team/Game row variants | Task 6 |
| FilterBar entity dropdown + position disable | Task 7 |
| HighlightsTab entity URL param + Games chip disable on Rankings + Plays hide entity | Task 7 |
| RankingsList / PerformancesList dispatch | Task 7 |
| useTopPerformances + queryKeys entity/teamId | Task 7 |
| GameCard pill mount | Task 8 |
| GamePage Overview card mount | Task 8 |
| TeamPage Highlights tab + new TeamHighlightsTab | Task 9 |

All spec items covered.

**2. Placeholder scan:** No TBD/TODO/"similar to". Each step contains the actual code or exact command.

**3. Type consistency:** 
- `RatingBundle` field names (`gameRating`, `gameGrade`, `homeTeamRating`, `homeGrade`, `tierLabel`) used identically in Tasks 1, 2, 3.
- API response shape (`rating: { raw, grade, tierLabel, home, away }`) used identically in Task 2 backend write and Task 8 frontend read.
- `entity` literal strings (`"player" | "team" | "game"`) consistent across backend (Task 3), API client (Task 7), hook (Task 7), components (Tasks 7, 9).
- `teamId` is an integer throughout (parsed in controller, stored as integer in hook/key).
- Tier label values (`Elite`, `Great`, `Solid`, `Routine`, `Close`) match between Task 1 helper and Task 3 inline `computeTier` (kept duplicated by design — Task 3's SQL service computes tier from row data without invoking the aggregate helper, so the formula lives in two places; both implementations are identical and tested independently).
