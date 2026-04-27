# Team Roster Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Roster tab to `TeamPage.jsx` alongside the existing Schedule view, with a clickable list of players for the selected season.

**Architecture:** New `GET /api/:league/teams/:teamId/roster?season=YYYY` endpoint that branches on current vs historical season — current uses `players.teamid`, historical uses `DISTINCT` from `stats` with `COALESCE(s.teamid, p.teamid)` fallback. Frontend gets a tab-pill UI mirroring `LeaguePage.jsx`, a lazy-loaded `useTeamRoster` hook, and a new `RosterGrid` component. No per-player stats in v1.

**Tech Stack:** Node/Express + raw SQL via `pg`, Redis cache, React 19, TanStack Query v5, Framer Motion, Tailwind CSS v4, Vitest (frontend tests), Jest (backend tests).

**Spec:** [`docs/superpowers/specs/2026-04-27-team-roster-tab-design.md`](../specs/2026-04-27-team-roster-tab-design.md)

---

## File Structure

**Backend — modify:**
- `backend/src/services/teams/teamsService.js` — add `getTeamRoster`
- `backend/src/controllers/teams/teamsController.js` — add `getTeamRoster` handler
- `backend/src/routes/teams/teams.js` — add route

**Backend — create:**
- `backend/__tests__/services/teamsRosterService.test.js`
- `backend/__tests__/routes/teamsRoster.test.js`

**Frontend — modify:**
- `frontend/src/api/teams.js` — add `getTeamRoster` client
- `frontend/src/lib/query.js` — add `teamRoster` query key
- `frontend/src/pages/TeamPage.jsx` — tab pill UI + lazy roster rendering

**Frontend — create:**
- `frontend/src/hooks/data/useTeamRoster.js`
- `frontend/src/components/team/RosterGrid.jsx`
- `frontend/src/components/skeletons/RosterGridSkeleton.jsx`
- `frontend/src/__tests__/hooks/useTeamRoster.test.js`
- `frontend/src/__tests__/components/RosterGrid.test.jsx`

---

## Task 1: Backend service `getTeamRoster`

**Files:**
- Modify: `backend/src/services/teams/teamsService.js`
- Create: `backend/__tests__/services/teamsRosterService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/services/teamsRosterService.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());
const mockGetCurrentSeason = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({ getCurrentSeason: mockGetCurrentSeason }));

const { getTeamRoster } = await import(
  resolve(__dirname, "../../src/services/teams/teamsService.js")
);

const mockPlayer = {
  id: 1,
  name: "LeBron James",
  position: "F",
  jerseynum: 23,
  image_url: "https://example.com/lebron.jpg",
  status: null,
  status_description: null,
  status_updated_at: null,
  espn_playerid: 1966,
};

describe("getTeamRoster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  it("uses the players-table query for the current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockPlayer] });

    const result = await getTeamRoster("nba", 17, "2025-26");

    expect(result).toEqual([mockPlayer]);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
    expect(params).toEqual(["nba", 17]);
  });

  it("uses the players-table query when no season is passed", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, null);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
  });

  it("uses the stats-join query for historical seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockPlayer] });

    const result = await getTeamRoster("nba", 17, "2022-23");

    expect(result).toEqual([mockPlayer]);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players p");
    expect(sql).toContain("JOIN stats s");
    expect(sql).toContain("JOIN games g");
    expect(sql).toContain("COALESCE(s.teamid, p.teamid)");
    expect(params).toEqual(["nba", 17, "2022-23"]);
  });

  it("orders results by position NULLS LAST then name", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2025-26");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("position");
    expect(sql).toContain("NULLS LAST");
  });

  it("uses 5-minute TTL for the current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2025-26");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(300);
  });

  it("uses 30-day TTL for historical seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2022-23");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(30 * 86400);
  });

  it("cache key includes league, teamId, and effective season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, null);

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("roster:nba:17:2025-26");
  });

  it("returns an empty array when no rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getTeamRoster("nhl", 5, null);

    expect(result).toEqual([]);
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getTeamRoster("nba", 17, null)).rejects.toThrow("DB error");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- teamsRosterService`
Expected: FAIL with `getTeamRoster is not a function` or similar import error.

- [ ] **Step 3: Implement `getTeamRoster` in the service**

Edit `backend/src/services/teams/teamsService.js`. Add the import for `getCurrentSeason` and append the new function. The full updated file:

```js
import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";

export async function getTeamAvailableSeasons(league, teamId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT season FROM games
      WHERE league = $1
        AND season IS NOT NULL
        AND ($2::integer IN (hometeamid, awayteamid))
      ORDER BY season DESC`,
    [league, teamId]
  );
  return rows.map((r) => r.season);
}

export async function getTeamsByLeague(league) {
  return cached(`teams:${league}`, 86400, async () => {
    const result = await pool.query(
      `SELECT *
         FROM teams
        WHERE league = $1
          AND conf IS NOT NULL
        ORDER BY conf, name`,
      [league]
    );
    return result.rows;
  });
}

export async function getTeamRoster(league, teamId, season) {
  const currentSeason = await getCurrentSeason(league);
  const effectiveSeason = season ?? currentSeason;
  const isCurrent = effectiveSeason === currentSeason;
  const ttl = isCurrent ? 300 : 30 * 86400;

  return cached(`roster:${league}:${teamId}:${effectiveSeason}`, ttl, async () => {
    if (isCurrent) {
      const result = await pool.query(
        `SELECT id, name, position, jerseynum, image_url,
                status, status_description, status_updated_at, espn_playerid
           FROM players
          WHERE league = $1
            AND teamid = $2
          ORDER BY position NULLS LAST, name`,
        [league, teamId]
      );
      return result.rows;
    }

    const result = await pool.query(
      `SELECT DISTINCT
              p.id, p.name, p.position, p.jerseynum, p.image_url,
              p.status, p.status_description, p.status_updated_at, p.espn_playerid
         FROM players p
         JOIN stats s ON s.playerid = p.id
         JOIN games g ON s.gameid = g.id
        WHERE g.league = $1
          AND g.season = $3
          AND COALESCE(s.teamid, p.teamid) = $2
        ORDER BY p.position NULLS LAST, p.name`,
      [league, teamId, effectiveSeason]
    );
    return result.rows;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- teamsRosterService`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/teams/teamsService.js backend/__tests__/services/teamsRosterService.test.js
git commit -m "$(cat <<'EOF'
feat(team-roster): add getTeamRoster service

Branches on current vs historical season — current uses players.teamid,
historical uses DISTINCT from stats with COALESCE(s.teamid, p.teamid).
EOF
)"
```

---

## Task 2: Backend route + controller for roster

**Files:**
- Modify: `backend/src/controllers/teams/teamsController.js`
- Modify: `backend/src/routes/teams/teams.js`
- Create: `backend/__tests__/routes/teamsRoster.test.js`

- [ ] **Step 1: Write the failing route test**

Create `backend/__tests__/routes/teamsRoster.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({ getCurrentSeason: mockGetCurrentSeason }));

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: teamsRouter } = await import(
  resolve(__dirname, "../../src/routes/teams/teams.js")
);

describe("Teams Route - GET /:league/teams/:teamId/roster", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", teamsRouter);
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  it("returns roster rows for the current season", async () => {
    const players = [
      { id: 1, name: "LeBron James", position: "F", jerseynum: 23, image_url: null, status: null, status_description: null, status_updated_at: null, espn_playerid: 1966 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: players });

    const res = await request(app).get("/api/nba/teams/17/roster");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(players);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
  });

  it("uses historical query path when season query param is set and not current", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/api/nba/teams/17/roster?season=2022-23");

    expect(res.status).toBe(200);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players p");
    expect(sql).toContain("JOIN stats s");
    expect(params).toEqual(["nba", 17, "2022-23"]);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/mlb/teams/17/roster");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid league");
  });

  it("returns 400 for non-integer teamId", async () => {
    const res = await request(app).get("/api/nba/teams/notanumber/roster");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid team ID");
  });

  it("returns 500 when the DB throws", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get("/api/nba/teams/17/roster");

    expect(res.status).toBe(500);
    expect(res.text).toBe("Server error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- teamsRoster`
Expected: FAIL — 404 on the route or `getTeamRoster is not a function` from controller import.

- [ ] **Step 3: Add the controller handler**

Edit `backend/src/controllers/teams/teamsController.js`. Replace the file with:

```js
import {
  getTeamsByLeague,
  getTeamAvailableSeasons,
  getTeamRoster as getTeamRosterService,
} from "../../services/teams/teamsService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getTeamSeasons(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = parseInt(req.params.teamId, 10);
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: "Invalid team ID" });

  try {
    const seasons = await getTeamAvailableSeasons(league, teamId);
    res.json(seasons);
  } catch (err) {
    logger.error({ err }, "Error fetching team seasons");
    res.status(500).send("Server error");
  }
}

export async function getTeams(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });

  try {
    const teams = await getTeamsByLeague(league);
    res.json(teams);
  } catch (err) {
    logger.error({ err }, "Error fetching teams");
    res.status(500).send("Server error");
  }
}

export async function getTeamRoster(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  const teamId = parseInt(req.params.teamId, 10);
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  if (!Number.isInteger(teamId)) return res.status(400).json({ error: "Invalid team ID" });

  const season = req.query.season ? String(req.query.season) : null;

  try {
    const roster = await getTeamRosterService(league, teamId, season);
    res.json(roster);
  } catch (err) {
    logger.error({ err }, "Error fetching team roster");
    res.status(500).send("Server error");
  }
}
```

- [ ] **Step 4: Add the route**

Edit `backend/src/routes/teams/teams.js`. Replace the file with:

```js
import express from "express";
import {
  getTeams,
  getTeamSeasons,
  getTeamRoster,
} from "../../controllers/teams/teamsController.js";

const router = express.Router();

router.get("/:league/teams/:teamId/roster", getTeamRoster);
router.get("/:league/teams/:teamId/seasons", getTeamSeasons);
router.get("/:league/teams", getTeams);

export default router;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npm test -- teamsRoster`
Expected: PASS — all 5 route tests green.

- [ ] **Step 6: Run the full backend verify**

Run: `cd backend && npm run verify`
Expected: PASS — eslint clean, all tests green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/teams/teams.js backend/src/controllers/teams/teamsController.js backend/__tests__/routes/teamsRoster.test.js
git commit -m "$(cat <<'EOF'
feat(team-roster): expose GET /:league/teams/:teamId/roster

Validates league and teamId, passes optional season query param to the
service, returns a JSON array of player rows.
EOF
)"
```

---

## Task 3: Frontend API client `getTeamRoster`

**Files:**
- Modify: `frontend/src/api/teams.js`

- [ ] **Step 1: Add the client function**

Edit `frontend/src/api/teams.js`. Replace the file with:

```js
import { apiFetch } from "./client.js";

export function getTeams(league, { signal } = {}) {
  return apiFetch(`/api/${league}/teams`, { signal });
}

export function getTeamSeasons(league, teamId, { signal } = {}) {
  return apiFetch(`/api/${league}/teams/${teamId}/seasons`, { signal });
}

export function getStandings(league, { season, signal } = {}) {
  return apiFetch(`/api/${league}/standings`, { signal, params: { season } });
}

export function getTeamRoster(league, teamId, { season, signal } = {}) {
  return apiFetch(`/api/${league}/teams/${teamId}/roster`, { signal, params: { season } });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/teams.js
git commit -m "feat(team-roster): add getTeamRoster API client"
```

---

## Task 4: Frontend query key

**Files:**
- Modify: `frontend/src/lib/query.js:21-23`

- [ ] **Step 1: Add `teamRoster` query key**

Edit `frontend/src/lib/query.js`. Find the `queryKeys` object (lines 9-32) and add the `teamRoster` entry directly below `teamSeasons`. After the change, lines 22-24 read:

```js
  teamGames:      (league, teamId, season) => ["teamGames", league, teamId, season],
  teamSeasons:    (league, teamId) => ["teamSeasons", league, teamId],
  teamRoster:     (league, teamId, season) => ["teamRoster", league, teamId, season],
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/query.js
git commit -m "feat(team-roster): add teamRoster query key"
```

---

## Task 5: Frontend hook `useTeamRoster`

**Files:**
- Create: `frontend/src/hooks/data/useTeamRoster.js`
- Create: `frontend/src/__tests__/hooks/useTeamRoster.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/hooks/useTeamRoster.test.js`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/teams.js", () => ({
  getTeamRoster: vi.fn(),
}));

const { getTeamRoster } = await import("../../api/teams.js");
const { useTeamRoster } = await import("../../hooks/data/useTeamRoster.js");

const mockRoster = [
  { id: 1, name: "LeBron James", position: "F", jerseynum: 23, image_url: null, status: null, status_description: null, status_updated_at: null, espn_playerid: 1966 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTeamRoster", () => {
  it("returns the roster data", async () => {
    getTeamRoster.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, "2025-26"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.roster).toEqual(mockRoster));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("passes season to the API call", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", 17, "2022-23"),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(getTeamRoster).toHaveBeenCalledWith(
        "nba",
        17,
        expect.objectContaining({ season: "2022-23" })
      )
    );
  });

  it("does not fetch when enabled is false", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", 17, null, { enabled: false }),
      { wrapper: createWrapper() }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(getTeamRoster).not.toHaveBeenCalled();
  });

  it("does not fetch when teamId is null", async () => {
    getTeamRoster.mockResolvedValue([]);

    renderHook(
      () => useTeamRoster("nba", null, null),
      { wrapper: createWrapper() }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(getTeamRoster).not.toHaveBeenCalled();
  });

  it("surfaces error message on failure", async () => {
    getTeamRoster.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.loading).toBe(false);
  });

  it("retry refetches the roster", async () => {
    getTeamRoster.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useTeamRoster("nba", 17, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.retry());
    await waitFor(() => expect(getTeamRoster).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useTeamRoster`
Expected: FAIL with module-not-found for `../../hooks/data/useTeamRoster.js`.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/data/useTeamRoster.js`:

```js
import { useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getTeamRoster } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";

export function useTeamRoster(league, teamId, selectedSeason, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.teamRoster(league, teamId, selectedSeason),
    queryFn: ({ signal }) =>
      getTeamRoster(league, teamId, { season: selectedSeason, signal }),
    enabled: !!league && !!teamId && enabled,
    placeholderData: keepPreviousData,
  });

  const retry = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    roster: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    retry,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useTeamRoster`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useTeamRoster.js frontend/src/__tests__/hooks/useTeamRoster.test.js
git commit -m "feat(team-roster): add useTeamRoster hook with lazy enabled flag"
```

---

## Task 6: Frontend `RosterGrid` component

**Files:**
- Create: `frontend/src/components/team/RosterGrid.jsx`
- Create: `frontend/src/__tests__/components/RosterGrid.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/components/RosterGrid.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, animate, transition, initial, exit, variants, ...props }) =>
          <div {...props}>{children}</div>,
    }
  ),
}));

vi.mock("../../utils/motion.js", () => ({
  containerVariants: {},
  itemVariants: {},
}));

const RosterGrid = (await import("../../components/team/RosterGrid.jsx")).default;

const lebron = {
  id: 1,
  name: "LeBron James",
  position: "F",
  jerseynum: 23,
  image_url: "https://example.com/lebron.jpg",
  status: null,
  status_description: null,
  espn_playerid: 1966,
};

const out = {
  id: 2,
  name: "Anthony Davis",
  position: "F-C",
  jerseynum: 3,
  image_url: null,
  status: "out",
  status_description: "left calf strain",
  espn_playerid: 6583,
};

describe("RosterGrid", () => {
  it("renders one card per player", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron, out]} />);
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getByText("Anthony Davis")).toBeInTheDocument();
  });

  it("links each card to the player page with season query param", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron]} />);
    const link = screen.getByText("LeBron James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james?season=2025-26");
  });

  it("omits the season query param when season is null", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    const link = screen.getByText("LeBron James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james");
  });

  it("renders jersey and position", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.getByText(/#23/)).toBeInTheDocument();
    expect(screen.getByText(/F/)).toBeInTheDocument();
  });

  it("does not render the status badge when status is null", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.queryByText(/Out|Day-to-Day|Questionable/)).not.toBeInTheDocument();
  });

  it("renders the status badge when status is non-available", () => {
    render(<RosterGrid league="nba" season={null} players={[out]} />);
    expect(screen.getByText("Out")).toBeInTheDocument();
  });

  it("shows an empty-state message when players is empty", () => {
    render(<RosterGrid league="nba" season={null} players={[]} />);
    expect(screen.getByText(/No roster data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- RosterGrid`
Expected: FAIL with module-not-found for `../../components/team/RosterGrid.jsx`.

- [ ] **Step 3: Create the component directory and file**

Create `frontend/src/components/team/RosterGrid.jsx`:

```jsx
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";

import PlayerStatusBadge from "../player/PlayerStatusBadge.jsx";
import slugify from "../../utils/slugify.js";
import buildSeasonUrl from "../../utils/buildSeasonUrl.js";
import { queryKeys } from "../../lib/query.js";
import { getPlayer } from "../../api/players.js";
import { containerVariants, itemVariants } from "../../utils/motion.js";

function canHover() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover)").matches;
}

function RosterCard({ league, season, player }) {
  const queryClient = useQueryClient();
  const slug = slugify(player.name);
  const href = buildSeasonUrl(`/${league}/players/${slug}`, season);
  const showStatus = player.status && player.status !== "available";

  function handleHover() {
    if (!canHover()) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.player(league, slug, season),
      queryFn: () => getPlayer(league, slug, { season }).then((d) => d.player),
      staleTime: 10_000,
    });
  }

  return (
    <Link
      to={href}
      onMouseEnter={handleHover}
      className="group block bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center gap-4">
        {player.image_url ? (
          <img
            src={player.image_url}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.style.display = "none";
            }}
            alt={player.name}
            loading="lazy"
            className="w-16 h-16 rounded-full object-cover bg-surface-overlay shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface-overlay shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text-primary truncate">{player.name}</h3>
            {showStatus && (
              <PlayerStatusBadge
                status={player.status}
                title={player.status_description ?? undefined}
                size="sm"
              />
            )}
          </div>
          <p className="text-text-tertiary text-xs mt-1 tabular-nums">
            {player.jerseynum != null && <span>#{player.jerseynum}</span>}
            {player.jerseynum != null && player.position && <span> · </span>}
            {player.position && <span>{player.position}</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function RosterGrid({ league, season, players }) {
  if (!players || players.length === 0) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        No roster data for this season.
      </p>
    );
  }

  return (
    <m.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {players.map((player) => (
        <m.div key={player.id} variants={itemVariants} className="w-full">
          <RosterCard league={league} season={season} player={player} />
        </m.div>
      ))}
    </m.div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- RosterGrid`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/team/RosterGrid.jsx frontend/src/__tests__/components/RosterGrid.test.jsx
git commit -m "feat(team-roster): add RosterGrid component with hover prefetch"
```

---

## Task 7: Frontend `RosterGridSkeleton`

**Files:**
- Create: `frontend/src/components/skeletons/RosterGridSkeleton.jsx`

- [ ] **Step 1: Create the skeleton**

Create `frontend/src/components/skeletons/RosterGridSkeleton.jsx`:

```jsx
import Skeleton from "../ui/Skeleton.jsx";

export default function RosterGridSkeleton({ count = 9 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/skeletons/RosterGridSkeleton.jsx
git commit -m "feat(team-roster): add RosterGridSkeleton placeholder"
```

---

## Task 8: TeamPage tab integration

**Files:**
- Modify: `frontend/src/pages/TeamPage.jsx`

This task copies the tab-pill pattern from `LeaguePage.jsx` (`useLayoutEffect` for pill bounds, `tabRefs`, `tabNavRef`, slide transition via `AnimatePresence`) and folds the existing schedule content into a tab branch.

- [ ] **Step 1: Replace the file**

Replace `frontend/src/pages/TeamPage.jsx` with:

```jsx
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { m, AnimatePresence } from "framer-motion";

import GameCard from "../components/cards/GameCard";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";
import MonthNavigation from "../components/navigation/MonthNavigation.jsx";
import RosterGrid from "../components/team/RosterGrid.jsx";
import RosterGridSkeleton from "../components/skeletons/RosterGridSkeleton.jsx";
import { useTeam } from "../hooks/data/useTeam.js";
import { useTeamRoster } from "../hooks/data/useTeamRoster.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import { useSeasons } from "../hooks/data/useSeasons.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/user/useFavoriteToggle.js";
import slugify from "../utils/slugify.js";
import TeamPageSkeleton from "../components/skeletons/TeamPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";

const TABS = ["schedule", "roster"];

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const { team, games, availableSeasons, teamRecord, homeRecord, awayRecord, loading, recordsLoading, seasonLoading, error, retry } = useTeam(league, teamId, urlSeason);
  const { seasons: leagueSeasons } = useSeasons(league);
  const [selectedSeason, setSelectedSeason] = useSeasonParam(availableSeasons.length > 0 ? availableSeasons : [], leagueSeasons[0] ?? null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [activeTab, setActiveTab] = useState("schedule");
  const [tabDirection, setTabDirection] = useState(1);
  const tabRefs = useRef([]);
  const tabNavRef = useRef(null);
  const [pillBounds, setPillBounds] = useState(null);

  const {
    roster,
    loading: rosterLoading,
    error: rosterError,
    retry: rosterRetry,
  } = useTeamRoster(league, team?.id ?? null, selectedSeason, {
    enabled: activeTab === "roster",
  });

  useLayoutEffect(() => {
    const idx = TABS.indexOf(activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setPillBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab]);

  function pickTab(tab) {
    setTabDirection(TABS.indexOf(tab) > TABS.indexOf(activeTab) ? 1 : -1);
    setActiveTab(tab);
  }

  useEffect(() => {
    setSelectedMonth(null);
  }, [selectedSeason]);

  useEffect(() => {
    if (!games?.length) return;
    const months = [...new Set(games.map((g) => String(g.date).slice(0, 7)))].sort();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (months.includes(currentMonth)) {
      setSelectedMonth(currentMonth);
      return;
    }
    const pastMonths = months.filter((m) => m < currentMonth);
    if (pastMonths.length) {
      setSelectedMonth(pastMonths[pastMonths.length - 1]);
      return;
    }
    setSelectedMonth(months[0]);
  }, [games]);

  const { session, openAuthModal } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("team", session ? team?.id : null);

  const filteredGames = useMemo(() => {
    if (!selectedMonth) return games;
    return games.filter((g) => String(g.date).slice(0, 7) === selectedMonth);
  }, [games, selectedMonth]);

  if (loading) return <TeamPageSkeleton teamId={teamId} />;
  if (error && !team) return <ErrorState message={error} onRetry={retry} />;
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">Team Not Found</h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The team you&apos;re looking for doesn&apos;t exist or hasn&apos;t been added yet.
        </p>
        <Link
          to={buildSeasonUrl(`/${league}`, selectedSeason)}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          {league?.toUpperCase()} Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={`/${league}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      {/* Season selector + Compare */}
      <div className="flex justify-end gap-2 mb-6">
        <Link
          to="/compare"
          state={{ league, type: "teams", id1: slugify(team.name) }}
          className="inline-flex items-center gap-1.5 appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay"
          aria-label="Compare team"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Compare
        </Link>
        <SeasonSelector
          league={league}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
          seasons={availableSeasons.length > 0 ? availableSeasons : undefined}
        />
      </div>

      {/* Team header + info */}
      <div className="flex flex-col md:flex-row gap-10 mb-12">
        {/* Logo + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
              {team.name}
            </h1>
            <button
              onClick={() => session ? toggle() : openAuthModal("favorites")}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <svg className={`w-7 h-7 ${isFavorited ? "fill-yellow-400 text-yellow-400" : "fill-none text-text-tertiary hover:text-yellow-400"}`} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </button>
          </div>
          {team.logo_url && (
            <img
              src={team.logo_url}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = "none"; }}
              alt={team.name}
              className="w-44 h-44 object-contain"
            />
          )}
        </div>

        {/* Stats card */}
        <div className="flex-1 flex flex-col">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-text-tertiary">Location</span>
              <span className="text-sm font-medium text-text-primary">{team.location}</span>
            </div>

            <div className="border-t border-white/[0.06]" />

            <div
              className="grid grid-cols-3 divide-x divide-white/[0.06]"
              style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}
            >
              {[
                { label: "Record", value: teamRecord ?? team.record, skeleton: false },
                { label: "Home", value: homeRecord, skeleton: recordsLoading },
                { label: "Away", value: awayRecord, skeleton: recordsLoading },
              ].map(({ label, value, skeleton }) => (
                <div key={label} className="flex flex-col items-center gap-1 px-3 first:pl-0 last:pr-0">
                  <span className="text-xs uppercase tracking-wider text-text-tertiary">{label}</span>
                  {skeleton
                    ? <Skeleton className="h-7 w-16 mt-0.5" />
                    : <span className="text-xl font-bold tabular-nums text-text-primary">{value ?? "—"}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex justify-center mb-8">
        <div ref={tabNavRef} className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
          {pillBounds && (
            <m.div
              className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
              initial={{ left: pillBounds.left, width: pillBounds.width }}
              animate={{ left: pillBounds.left, width: pillBounds.width }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {TABS.map((tab, i) => (
            <button
              key={tab}
              ref={(el) => (tabRefs.current[i] = el)}
              onClick={() => pickTab(tab)}
              className="relative px-5 py-2 rounded-full text-sm font-medium z-10 transition-colors duration-200"
              style={{ color: activeTab === tab ? "var(--color-accent)" : "var(--color-text-secondary)" }}
            >
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
          <m.div
            key={activeTab}
            custom={tabDirection}
            variants={{
              initial: (dir) => ({ x: dir * 40, opacity: 0 }),
              animate: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
              exit: (dir) => ({ x: dir * -40, opacity: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }),
            }}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {activeTab === "schedule" ? (
              <>
                <MonthNavigation
                  games={games}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />
                <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
                  {filteredGames.length > 0 ? (
                    <m.div
                      key={selectedSeason}
                      className="grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center items-start"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredGames.map((game) => (
                        <m.div key={game.id} variants={itemVariants} className="w-full">
                          <GameCard game={game} />
                        </m.div>
                      ))}
                    </m.div>
                  ) : (
                    <p className="text-center text-text-tertiary text-sm mt-8">
                      {games.length > 0 ? "No games this month." : "No recent games to show."}
                    </p>
                  )}
                </div>
              </>
            ) : rosterError ? (
              <ErrorState message={rosterError} onRetry={rosterRetry} />
            ) : rosterLoading ? (
              <RosterGridSkeleton />
            ) : (
              <RosterGrid league={league} season={selectedSeason} players={roster} />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full frontend verify**

Run: `cd frontend && npm run verify`
Expected: PASS — eslint clean, all Vitest suites green, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TeamPage.jsx
git commit -m "$(cat <<'EOF'
feat(team-roster): add Schedule/Roster tabs to TeamPage

Mirrors the LeaguePage pill-tab pattern with sliding indicator and slide
transitions. Roster tab lazy-loads via useTeamRoster's enabled flag so
historical seasons aren't fetched until the tab is opened.
EOF
)"
```

---

## Task 9: Manual UI verification

**Files:** none — verification only.

- [ ] **Step 1: Start the backend**

Run in one terminal: `cd backend && npm run dev`
Expected: server logs startup on the configured port, no errors.

- [ ] **Step 2: Start the frontend**

Run in another terminal: `cd frontend && npm run dev`
Expected: Vite reports `Local: http://localhost:5173/` (or similar), no errors.

- [ ] **Step 3: Browser walkthrough**

Open the dev URL and verify each:

1. Navigate to `/nba/teams/los-angeles-lakers` (or any current team).
2. **Tab pills** appear below the team header, showing **Schedule** (active) and **Roster**.
3. **Schedule tab** still shows the month nav + game grid (regression check).
4. Click **Roster** — pill slides right, content slides in. Roster grid renders with photos, names, jerseys, positions. Network tab shows `GET /api/nba/teams/{id}/roster` fired exactly once.
5. **Hover a player card** — `-translate-y-0.5` lift, border lightens, network shows a `GET /api/nba/players/{slug}` prefetch.
6. **Click a player card** — navigates to `/nba/players/{slug}?season=...` (current season has no `season` param).
7. **Status badge** — find an injured player (one with `status` set on backend) and verify the small badge renders with the correct tone.
8. **Switch season** to a past season — roster tab refetches; mid-season-traded players from that season appear if you know one.
9. **Switch back to Schedule tab** — pill slides left, roster fetch is not re-fired (TanStack cache hit).
10. Repeat steps 1–4 for **NHL** and **NFL** (`/nhl/teams/...`, `/nfl/teams/...`).

- [ ] **Step 4: Verify nothing else broke**

Spot-check `/nba` (LeaguePage tabs still work), `/nba/games/{id}` (GamePage loads), `/nba/players/{slug}` (PlayerPage loads).

- [ ] **Step 5: Final verify pass**

Run: `cd backend && npm run verify` and `cd frontend && npm run verify`
Expected: both PASS.

No commit — verification only.

---

## Self-review checklist

After execution, sanity-check against the spec:

1. **Backend endpoint** matches spec — `GET /api/:league/teams/:teamId/roster?season=YYYY`. ✓ (Task 2)
2. **Branching logic** — current vs historical query paths. ✓ (Task 1)
3. **Cache TTL** — 5m current / 30d historical. ✓ (Task 1)
4. **Frontend tabs** — Schedule + Roster, pill UI mirrors LeaguePage. ✓ (Task 8)
5. **Lazy load** — `enabled: activeTab === "roster"`. ✓ (Task 8)
6. **Card content** — photo, name, jersey + position, status badge only when non-available. ✓ (Task 6)
7. **Hover prefetch** — uses `queryKeys.player` with 10s stale time + hover-capable guard. ✓ (Task 6)
8. **Skeleton** — RosterGridSkeleton renders during loading. ✓ (Task 7, 8)
9. **Schedule h2 heading** removed — replaced by tab pill. ✓ (Task 8)
10. **Tests** — service, route, hook, component covered. ✓ (Tasks 1, 2, 5, 6)
