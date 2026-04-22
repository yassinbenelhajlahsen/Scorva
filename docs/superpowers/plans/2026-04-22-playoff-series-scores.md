# Playoff Series Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a leader-centric series score label (e.g., "BOS lead 2-0", "Tied 1-1", "BOS win series 4-2") below the round label on `GameCard` and `GameMatchupHeader` for NBA and NHL best-of-7 playoff series.

**Architecture:** A `LEFT JOIN LATERAL` subquery is added to the `selectFrom` constant in `gamesService.js` (used by all query branches) and to the FROM clause of `gameDetailQueryBuilder.js`. The subquery counts series wins for each game using only final games up to and including the current game. SQL guards (league, type, game_label) ensure NFL, regular season, play-in, and in-season tournament games return 0 for both counts. Frontend components compute the display label inline from the raw counts.

**Tech Stack:** PostgreSQL lateral joins, Node.js/Express, React 19, Vitest, Jest

---

## File Map

| File | Change |
|---|---|
| `backend/src/services/games/gamesService.js` | Extend `selectFrom` with LEFT JOIN LATERAL + two new SELECT columns |
| `backend/src/services/games/gameDetailQueryBuilder.js` | Add same lateral join + `seriesScore` field to game json_build_object |
| `backend/__tests__/services/gamesService.test.js` | Add series score SQL coverage tests |
| `backend/__tests__/services/gameDetailQueryBuilder.test.js` | Create — pure function tests for SQL output |
| `frontend/src/components/cards/GameCard.jsx` | Add series label below game_label |
| `frontend/src/components/game/GameMatchupHeader.jsx` | Add series label below gameLabel |
| `frontend/src/__tests__/components/GameCard.test.jsx` | Add series label render tests |
| `frontend/src/__tests__/components/GameMatchupHeader.test.jsx` | Create — series label render tests |

---

## Task 1: Backend — series columns in gamesService

**Files:**
- Modify: `backend/src/services/games/gamesService.js`
- Modify: `backend/__tests__/services/gamesService.test.js`

- [ ] **Step 1: Write failing tests**

Add a new `describe` block at the bottom of `backend/__tests__/services/gamesService.test.js`:

```js
describe("getGames — series score columns", () => {
  it("includes home_series_wins and away_series_wins in the SQL", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getGames("nba", { teamId: 1 });

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("home_series_wins");
    expect(sql).toContain("away_series_wins");
  });

  it("includes the lateral subquery guard for nba/nhl only", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getGames("nba", { teamId: 1 });

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("'nba'");
    expect(sql).toContain("'nhl'");
    expect(sql).toContain("LEFT JOIN LATERAL");
  });

  it("passes series win fields through in returned rows", async () => {
    const playoffGame = {
      id: 42,
      league: "nba",
      type: "playoff",
      status: "Final",
      home_series_wins: 2,
      away_series_wins: 1,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [playoffGame] });

    const result = await getGames("nba", { teamId: 1 });

    expect(result[0].home_series_wins).toBe(2);
    expect(result[0].away_series_wins).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- gamesService
```

Expected: 3 failures — `home_series_wins` not found in SQL, `LEFT JOIN LATERAL` not found, pass-through test may pass already.

- [ ] **Step 3: Implement — extend selectFrom in gamesService.js**

In `backend/src/services/games/gamesService.js`, replace the `selectFrom` constant (lines 29–41):

```js
const selectFrom = `
  SELECT
    g.*,
    th.name AS home_team_name,
    th.shortname AS home_shortname,
    th.logo_url AS home_logo,
    ta.name AS away_team_name,
    ta.shortname AS away_shortname,
    ta.logo_url AS away_logo,
    COALESCE(sc.home_series_wins, 0) AS home_series_wins,
    COALESCE(sc.away_series_wins, 0) AS away_series_wins
  FROM games g
  JOIN teams th ON g.hometeamid = th.id
  JOIN teams ta ON g.awayteamid = ta.id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE g2.winnerid = g.hometeamid) AS home_series_wins,
      COUNT(*) FILTER (WHERE g2.winnerid = g.awayteamid) AS away_series_wins
    FROM games g2
    WHERE g.league IN ('nba', 'nhl')
      AND g.type IN ('playoff', 'final')
      AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
      AND g2.league = g.league
      AND g2.season = g.season
      AND g2.type IN ('playoff', 'final')
      AND g2.status ILIKE 'Final%'
      AND g2.id <= g.id
      AND (
        (g2.hometeamid = g.hometeamid AND g2.awayteamid = g.awayteamid) OR
        (g2.hometeamid = g.awayteamid AND g2.awayteamid = g.hometeamid)
      )
  ) sc ON true
`;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- gamesService
```

Expected: all gamesService tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/gamesService.js backend/__tests__/services/gamesService.test.js
git commit -m "feat: add series score columns to gamesService selectFrom"
```

---

## Task 2: Backend — seriesScore in gameDetailQueryBuilder

**Files:**
- Modify: `backend/src/services/games/gameDetailQueryBuilder.js`
- Create: `backend/__tests__/services/gameDetailQueryBuilder.test.js`

- [ ] **Step 1: Create test file**

Create `backend/__tests__/services/gameDetailQueryBuilder.test.js`:

```js
import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { buildGameDetailSQL } = await import(
  resolve(__dirname, "../../src/services/games/gameDetailQueryBuilder.js")
);

describe("buildGameDetailSQL", () => {
  it("throws for unknown league", () => {
    expect(() => buildGameDetailSQL("xyz")).toThrow("Unknown league");
  });

  it("includes seriesScore key in game json_build_object", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("'seriesScore'");
  });

  it("includes homeWins and awayWins in seriesScore", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("'homeWins'");
    expect(sql).toContain("'awayWins'");
  });

  it("includes the lateral series subquery with nba/nhl guard", () => {
    const sql = buildGameDetailSQL("nba");
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("home_series_wins");
    expect(sql).toContain("away_series_wins");
    expect(sql).toContain("'nba'");
    expect(sql).toContain("'nhl'");
  });

  it("works for nhl league", () => {
    const sql = buildGameDetailSQL("nhl");
    expect(sql).toContain("'seriesScore'");
    expect(sql).toContain("LEFT JOIN LATERAL");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- gameDetailQueryBuilder
```

Expected: 4–5 failures about missing `seriesScore`, lateral join, etc.

- [ ] **Step 3: Implement — add lateral join and seriesScore to gameDetailQueryBuilder.js**

In `backend/src/services/games/gameDetailQueryBuilder.js`, replace the `return` template literal starting at line 62. Two changes:

**Change A** — Add `'seriesScore'` to the game json_build_object (after the `'hasPlays'` line):

```js
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id),
    'seriesScore', json_build_object(
      'homeWins', COALESCE(sc.home_series_wins, 0),
      'awayWins', COALESCE(sc.away_series_wins, 0)
    )
```

**Change B** — Add the lateral join to the FROM clause (between the `JOIN teams at` line and `WHERE g.id = $1`):

```js
JOIN teams at ON at.id = g.awayteamid
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE g2.winnerid = g.hometeamid) AS home_series_wins,
    COUNT(*) FILTER (WHERE g2.winnerid = g.awayteamid) AS away_series_wins
  FROM games g2
  WHERE g.league IN ('nba', 'nhl')
    AND g.type IN ('playoff', 'final')
    AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
    AND g2.league = g.league
    AND g2.season = g.season
    AND g2.type IN ('playoff', 'final')
    AND g2.status ILIKE 'Final%'
    AND g2.id <= g.id
    AND (
      (g2.hometeamid = g.hometeamid AND g2.awayteamid = g.awayteamid) OR
      (g2.hometeamid = g.awayteamid AND g2.awayteamid = g.hometeamid)
    )
) sc ON true
WHERE g.id = $1 AND g.league = $2
```

The full updated `buildGameDetailSQL` return value (replacing everything from the `return \`` line to the closing backtick):

```js
  return `
SELECT json_build_object(
  'game', json_build_object(
    'id', g.id,
    'league', g.league,
    'date', g.date,
    'venue', g.venue,
    'broadcast', g.broadcast,
    'score', json_build_object(
      'home', g.homescore,
      'away', g.awayscore,
      'quarters', json_build_object(
        'q1', g.firstqtr,
        'q2', g.secondqtr,
        'q3', g.thirdqtr,
        'q4', g.fourthqtr,
        'ot', ARRAY[g.ot1, g.ot2, g.ot3, g.ot4]
      )
    ),
    'status', g.status,
    'season', g.season,
    'winnerId', g.winnerid,
    'gameLabel', g.game_label,
    'gameType', g.type,
    'currentPeriod', g.current_period,
    'clock', g.clock,
    'startTime', g.start_time,
    'eventId', g.eventid,
    'hasPlays', EXISTS(SELECT 1 FROM plays WHERE gameid = g.id),
    'seriesScore', json_build_object(
      'homeWins', COALESCE(sc.home_series_wins, 0),
      'awayWins', COALESCE(sc.away_series_wins, 0)
    )
  ),
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'shortName', ht.shortname,
      'location', ht.location,
      'logoUrl', ht.logo_url,
      'record', ht.record,
      'homeRecord', ht.homerecord,
      'awayRecord', ht.awayrecord,
      'conference', ht.conf,
      'color', ht.primary_color
    ),
    'players', (${playerSubquery("g.hometeamid")})
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'shortName', at.shortname,
      'location', at.location,
      'logoUrl', at.logo_url,
      'record', at.record,
      'homeRecord', at.homerecord,
      'awayRecord', at.awayrecord,
      'conference', at.conf,
      'color', at.primary_color
    ),
    'players', (${playerSubquery("g.awayteamid")})
  )
)
FROM games g
JOIN teams ht ON ht.id = g.hometeamid
JOIN teams at ON at.id = g.awayteamid
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE g2.winnerid = g.hometeamid) AS home_series_wins,
    COUNT(*) FILTER (WHERE g2.winnerid = g.awayteamid) AS away_series_wins
  FROM games g2
  WHERE g.league IN ('nba', 'nhl')
    AND g.type IN ('playoff', 'final')
    AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
    AND g2.league = g.league
    AND g2.season = g.season
    AND g2.type IN ('playoff', 'final')
    AND g2.status ILIKE 'Final%'
    AND g2.id <= g.id
    AND (
      (g2.hometeamid = g.hometeamid AND g2.awayteamid = g.awayteamid) OR
      (g2.hometeamid = g.awayteamid AND g2.awayteamid = g.hometeamid)
    )
) sc ON true
WHERE g.id = $1 AND g.league = $2`;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- gameDetailQueryBuilder
```

Expected: all 5 tests pass.

- [ ] **Step 5: Run full backend test suite to check for regressions**

```bash
cd backend && npm test -- gameDetailService
```

Expected: all existing gameDetailService tests pass (the SQL change only adds fields — existing assertions still hold).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/games/gameDetailQueryBuilder.js backend/__tests__/services/gameDetailQueryBuilder.test.js
git commit -m "feat: add seriesScore field to gameDetailQueryBuilder"
```

---

## Task 3: Frontend — series label in GameCard

**Files:**
- Modify: `frontend/src/components/cards/GameCard.jsx`
- Modify: `frontend/src/__tests__/components/GameCard.test.jsx`

- [ ] **Step 1: Write failing tests**

Add a new `describe` block at the bottom of `frontend/src/__tests__/components/GameCard.test.jsx`:

```jsx
describe("GameCard — playoff series label", () => {
  function makePlayoffGame(overrides = {}) {
    return makeGame({
      type: "playoff",
      game_label: "Game 3, First Round",
      home_series_wins: 0,
      away_series_wins: 0,
      ...overrides,
    });
  }

  it("shows home-team lead label when home leads series", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 2, away_series_wins: 0 })} />);
    expect(screen.getByText("LAL lead 2-0")).toBeInTheDocument();
  });

  it("shows away-team lead label when away leads series", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 1, away_series_wins: 3 })} />);
    expect(screen.getByText("GSW lead 3-1")).toBeInTheDocument();
  });

  it("shows tied label when series is even", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 2, away_series_wins: 2 })} />);
    expect(screen.getByText("Tied 2-2")).toBeInTheDocument();
  });

  it("shows win-series label when home team wins series with 4 wins", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 4, away_series_wins: 2 })} />);
    expect(screen.getByText("LAL win series 4-2")).toBeInTheDocument();
  });

  it("shows win-series label when away team wins series with 4 wins", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 1, away_series_wins: 4 })} />);
    expect(screen.getByText("GSW win series 4-1")).toBeInTheDocument();
  });

  it("hides series label when both teams have 0 wins (pre-series)", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 0, away_series_wins: 0 })} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label for regular season games", () => {
    render(<GameCard game={makeGame({ type: "regular", home_series_wins: 0, away_series_wins: 0 })} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label for play-in games (game_label contains play-in)", () => {
    render(<GameCard game={makePlayoffGame({
      game_label: "Play-In Game",
      home_series_wins: 0,
      away_series_wins: 0,
    })} />);
    // game_label renders but no series score since 0-0
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- GameCard
```

Expected: 5–6 failures — series label not found in rendered output.

- [ ] **Step 3: Implement — add series label to GameCard.jsx**

In `frontend/src/components/cards/GameCard.jsx`, replace the `{/* Playoff round label */}` block (currently lines 240–245) with:

```jsx
{/* Playoff round label + series score */}
{isPlayoff && game.game_label && (
  <p className="mt-2 pt-2 border-t border-white/[0.06] text-xs font-medium text-text-tertiary text-center tracking-wide">
    {game.game_label}
  </p>
)}
{isPlayoff && game.game_label && (() => {
  const h = Number(game.home_series_wins ?? 0);
  const a = Number(game.away_series_wins ?? 0);
  if (h + a === 0) return null;
  const label =
    h === 4
      ? `${homeName} win series ${h}-${a}`
      : a === 4
        ? `${awayName} win series ${a}-${h}`
        : h === a
          ? `Tied ${h}-${a}`
          : h > a
            ? `${homeName} lead ${h}-${a}`
            : `${awayName} lead ${a}-${h}`;
  return (
    <p className="text-[10px] text-text-tertiary text-center mt-0.5">
      {label}
    </p>
  );
})()}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- GameCard
```

Expected: all GameCard tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cards/GameCard.jsx frontend/src/__tests__/components/GameCard.test.jsx
git commit -m "feat: add playoff series label to GameCard"
```

---

## Task 4: Frontend — series label in GameMatchupHeader

**Files:**
- Modify: `frontend/src/components/game/GameMatchupHeader.jsx`
- Create: `frontend/src/__tests__/components/GameMatchupHeader.test.jsx`

- [ ] **Step 1: Create test file with failing tests**

Create `frontend/src/__tests__/components/GameMatchupHeader.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "whileHover", "whileTap",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
          );
          return <Tag className={className} onClick={onClick} {...props}>{children}</Tag>;
        };
        El.displayName = tag;
        return El;
      },
    }
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock("../../utils/motion.js", () => ({ scoreUpdateVariants: {} }));
vi.mock("../../utils/slugify.js", () => ({ default: (s) => s.toLowerCase().replace(/\s+/g, "-") }));

const GameMatchupHeader = (await import("../../components/game/GameMatchupHeader.jsx")).default;

function makeProps(overrides = {}) {
  return {
    homeTeam: {
      info: { id: 1, name: "Boston Celtics", shortName: "BOS", logoUrl: "/bos.png", record: "50-20" },
    },
    awayTeam: {
      info: { id: 2, name: "New York Knicks", shortName: "NYK", logoUrl: "/nyk.png", record: "45-25" },
    },
    game: {
      gameLabel: "Game 3, First Round",
      seriesScore: { homeWins: 0, awayWins: 0 },
      score: { home: 110, away: 98 },
      status: "Final",
      clock: null,
      currentPeriod: null,
    },
    league: "nba",
    isFinal: true,
    inProgress: false,
    homeWon: true,
    awayWon: false,
    playoffLogo: "/nba-playoffs.png",
    scoreColor: () => "text-text-primary",
    ...overrides,
  };
}

describe("GameMatchupHeader — playoff series label", () => {
  it("shows home-team lead label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 0 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("BOS lead 2-0")).toBeInTheDocument();
  });

  it("shows away-team lead label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 1, awayWins: 3 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("NYK lead 3-1")).toBeInTheDocument();
  });

  it("shows tied label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 2 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("Tied 2-2")).toBeInTheDocument();
  });

  it("shows win-series label when home wins series", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 4, awayWins: 1 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("BOS win series 4-1")).toBeInTheDocument();
  });

  it("shows win-series label when away wins series", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 4 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("NYK win series 4-2")).toBeInTheDocument();
  });

  it("hides series label when both wins are 0", () => {
    render(<GameMatchupHeader {...makeProps()} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label when seriesScore is absent", () => {
    const props = makeProps();
    props.game.seriesScore = null;
    render(<GameMatchupHeader {...props} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("renders game label text", () => {
    render(<GameMatchupHeader {...makeProps()} />);
    expect(screen.getByText("Game 3, First Round")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- GameMatchupHeader
```

Expected: 5–6 failures about series label not found in rendered output.

- [ ] **Step 3: Implement — add series label to GameMatchupHeader.jsx**

In `frontend/src/components/game/GameMatchupHeader.jsx`, replace the `{game.gameLabel && ...}` block (currently lines 82–87) with:

```jsx
{game.gameLabel && (
  <span className="text-s font-medium text-text-secondary text-center">
    {game.gameLabel}
  </span>
)}
{game.seriesScore && (() => {
  const { homeWins: h, awayWins: a } = game.seriesScore;
  if (h + a === 0) return null;
  const label =
    h === 4
      ? `${homeTeam.info.shortName} win series ${h}-${a}`
      : a === 4
        ? `${awayTeam.info.shortName} win series ${a}-${h}`
        : h === a
          ? `Tied ${h}-${a}`
          : h > a
            ? `${homeTeam.info.shortName} lead ${h}-${a}`
            : `${awayTeam.info.shortName} lead ${a}-${h}`;
  return (
    <span className="text-xs text-text-tertiary text-center block mt-0.5">
      {label}
    </span>
  );
})()}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- GameMatchupHeader
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/game/GameMatchupHeader.jsx frontend/src/__tests__/components/GameMatchupHeader.test.jsx
git commit -m "feat: add playoff series label to GameMatchupHeader"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full backend verify**

```bash
cd backend && npm run verify
```

Expected: lint passes, all tests pass.

- [ ] **Step 2: Run full frontend verify**

```bash
cd frontend && npm run verify
```

Expected: lint passes, all tests pass, build succeeds.
