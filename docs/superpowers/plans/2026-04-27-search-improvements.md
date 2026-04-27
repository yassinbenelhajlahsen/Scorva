# Search Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-pass ILIKE search with a two-phase parser-then-resolver-then-assemble flow that supports matchup queries (`"rockets vs lakers"`), team abbreviations (`"LAL"`), and a 3-season game window for single-team searches.

**Architecture:** A pure parser splits the term into `matchup | single | empty`. A `resolveTeams` cascade lookup (abbreviation → exact → prefix → substring → fuzzy) returns scored team IDs. The service then assembles results in branch-specific shapes, returning the same flat array the API already produces. No frontend changes; no response-shape changes.

**Tech Stack:** Node.js + Express ESM, PostgreSQL (`pg` Pool), Prisma migrations, Jest with `jest.unstable_mockModule` for DB mocking.

**Reference spec:** `docs/superpowers/specs/2026-04-27-search-improvements-design.md`

**Branching note:** Current branch is `feat/mobile`. This is unrelated work — create a fresh branch off `main` (e.g., `feat/search-improvements`) before starting.

---

## Task 1: Add `teams.abbreviation` migration

**Files:**
- Create: `backend/prisma/migrations/20260427000000_add_team_abbreviation/migration.sql`
- Modify: `backend/prisma/schema.prisma` — add field to `teams` model

- [ ] **Step 1: Create migration directory and SQL**

```bash
mkdir -p /Users/yassin/work/Scorva/backend/prisma/migrations/20260427000000_add_team_abbreviation
```

Create `backend/prisma/migrations/20260427000000_add_team_abbreviation/migration.sql`:

```sql
-- Add abbreviation column to teams (e.g. "LAL", "GSW", "BOS").
-- Stored uppercased; index is case-insensitive for safety.
ALTER TABLE teams ADD COLUMN abbreviation VARCHAR(5);
CREATE INDEX idx_teams_abbreviation_lower ON teams (LOWER(abbreviation));
```

- [ ] **Step 2: Add the field to `schema.prisma`**

In `backend/prisma/schema.prisma`, locate the `model teams` block and add `abbreviation` next to `primary_color`:

```prisma
model teams {
  id                            Int                  @id @default(autoincrement())
  name                          String
  shortname                     String?
  league                        String
  location                      String?
  logo_url                      String?
  record                        String?
  espnid                        Int?
  homerecord                    String?
  awayrecord                    String?
  primary_color                 String?  @db.VarChar(7)
  abbreviation                  String?  @db.VarChar(5)
  conf                          String?
  division                      String?
  // ... rest unchanged
}
```

- [ ] **Step 3: Apply migration manually (shadow DB workaround)**

Per project memory: `prisma migrate dev` has shadow DB issues locally because `pg_trgm` extension is required. Apply directly:

```bash
cd /Users/yassin/work/Scorva/backend
psql "$DATABASE_URL" -f prisma/migrations/20260427000000_add_team_abbreviation/migration.sql
node_modules/.bin/prisma migrate resolve --applied 20260427000000_add_team_abbreviation
node_modules/.bin/prisma generate
```

Expected: column added, index created, Prisma client regenerated.

- [ ] **Step 4: Verify column exists**

```bash
psql "$DATABASE_URL" -c "\d teams" | grep abbreviation
```

Expected: `abbreviation | character varying(5) |`

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations/20260427000000_add_team_abbreviation/ backend/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(db): add teams.abbreviation column

Adds nullable VARCHAR(5) for ESPN team abbreviation (LAL, GSW, BOS, …) plus
case-insensitive index for fast equality lookups in search.
EOF
)"
```

---

## Task 2: Persist abbreviation in `upsertTeam.js`

**Files:**
- Modify: `backend/src/ingestion/upsert/upsertTeam.js`

- [ ] **Step 1: Update upsert SQL and values**

Replace the contents of `backend/src/ingestion/upsert/upsertTeam.js` with:

```js
export default async function upsertTeam(client, espnId, league, teamInfo) {
  const text = `
    INSERT INTO teams
      (espnid, league, name, shortname, location, logo_url, record, homerecord, awayrecord, primary_color, abbreviation)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (espnid, league ) DO UPDATE
      SET name          = EXCLUDED.name,
          league        = EXCLUDED.league,
          shortname     = EXCLUDED.shortname,
          location      = EXCLUDED.location,
          logo_url      = EXCLUDED.logo_url,
          record        = EXCLUDED.record,
          homerecord    = EXCLUDED.homerecord,
          awayrecord    = EXCLUDED.awayrecord,
          primary_color = EXCLUDED.primary_color,
          abbreviation  = EXCLUDED.abbreviation
    RETURNING id;
  `;
  const values = [
    espnId,
    league,
    teamInfo.name,
    teamInfo.shortname || null,
    teamInfo.location || null,
    teamInfo.logo_url || null,
    teamInfo.record,
    teamInfo.homerecord || null,
    teamInfo.awayrecord || null,
    teamInfo.primary_color || null,
    teamInfo.abbreviation ? teamInfo.abbreviation.toUpperCase() : null,
  ];

  const res = await client.query(text, values);
  return res.rows[0].id;
}
```

- [ ] **Step 2: Update callers in `eventProcessor.js` to pass `abbreviation`**

```bash
grep -n 'upsertTeam' /Users/yassin/work/Scorva/backend/src/ingestion/pipeline/eventProcessor.js
```

For each caller, locate the `teamInfo` object that is built from the ESPN team payload and add `abbreviation: <espnTeam>.abbreviation || null` (the field name on ESPN's payload is `abbreviation`). The other fields like `primary_color` follow the same pattern — mirror them.

For example, if you find:
```js
const teamInfo = {
  name: espnTeam.displayName,
  shortname: espnTeam.shortDisplayName,
  // ...
  primary_color: espnTeam.color ? `#${espnTeam.color}` : null,
};
```

Add the line:
```js
  abbreviation: espnTeam.abbreviation || null,
```

- [ ] **Step 3: Run backend tests to confirm nothing broke**

```bash
cd /Users/yassin/work/Scorva/backend && npm test
```

Expected: all pre-existing tests still pass. (No unit test exists for `upsertTeam.js` itself; this verifies indirect callers like `liveSync` and `eventProcessor` are still happy.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/ingestion/upsert/upsertTeam.js backend/src/ingestion/pipeline/eventProcessor.js
git commit -m "$(cat <<'EOF'
feat(ingestion): persist team abbreviation from ESPN payload

upsertTeam now writes teams.abbreviation (uppercased), keeping the same
ON CONFLICT update pattern as primary_color. eventProcessor passes the
ESPN abbreviation field into teamInfo.
EOF
)"
```

---

## Task 3: Backfill existing teams with abbreviation

**Files:**
- Create: `backend/src/ingestion/scripts/backfillTeamAbbreviations.js`

- [ ] **Step 1: Create the backfill script**

This mirrors `backfillTeamColors.js`. Create `backend/src/ingestion/scripts/backfillTeamAbbreviations.js`:

```js
/**
 * One-time script: populate teams.abbreviation from ESPN's teams API.
 *
 * ESPN endpoint: /apis/site/v2/sports/{sport}/{league}/teams?limit=100
 * Each team object has an `abbreviation` field (e.g. "LAL", "GSW", "BOS").
 *
 * Usage: node src/ingestion/scripts/backfillTeamAbbreviations.js
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import logger from "../../logger.js";
import { getSportPath } from "../pipeline/eventProcessor.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillTeamAbbreviations" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const LEAGUES = ["nba", "nfl", "nhl"];

async function fetchEspnTeams(league) {
  const sport = getSportPath(league);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=100`;
  const resp = await axios.get(url, { timeout: 10000 });
  return resp.data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
}

async function backfill() {
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const league of LEAGUES) {
    log.info({ league }, "fetching teams from ESPN");

    let espnTeams;
    try {
      espnTeams = await fetchEspnTeams(league);
    } catch (err) {
      log.error({ err, league }, "failed to fetch ESPN teams — skipping league");
      continue;
    }

    log.info({ league, count: espnTeams.length }, "ESPN teams fetched");

    for (const entry of espnTeams) {
      const team = entry.team;
      if (!team?.id || !team?.abbreviation) {
        totalSkipped++;
        continue;
      }

      const espnId = parseInt(team.id, 10);
      const abbr = String(team.abbreviation).toUpperCase();

      const result = await pool.query(
        `UPDATE teams SET abbreviation = $1
         WHERE espnid = $2 AND league = $3 AND (abbreviation IS NULL OR abbreviation != $1)`,
        [abbr, espnId, league]
      );

      if (result.rowCount > 0) {
        log.info({ league, espnId, name: team.displayName, abbr }, "updated");
        totalUpdated++;
      } else {
        totalSkipped++;
      }
    }
  }

  log.info({ totalUpdated, totalSkipped }, "backfill complete");
}

backfill()
  .then(() => pool.end())
  .catch(async (err) => {
    log.error({ err }, "backfill failed");
    await pool.end();
    process.exit(1);
  });
```

- [ ] **Step 2: Run backfill against local DB**

```bash
cd /Users/yassin/work/Scorva/backend && node src/ingestion/scripts/backfillTeamAbbreviations.js
```

Expected: log output showing teams updated per league. Each league should hit ~30–32 updates.

- [ ] **Step 3: Spot-check the data**

```bash
psql "$DATABASE_URL" -c "SELECT league, abbreviation, name FROM teams WHERE league='nba' AND abbreviation IS NOT NULL ORDER BY abbreviation LIMIT 10;"
```

Expected: rows like `nba | ATL | Atlanta Hawks`, `nba | BKN | Brooklyn Nets`, etc.

- [ ] **Step 4: Commit**

```bash
git add backend/src/ingestion/scripts/backfillTeamAbbreviations.js
git commit -m "$(cat <<'EOF'
feat(ingestion): one-time backfill for teams.abbreviation

Mirrors backfillTeamColors. Fetches ESPN's per-league teams index and writes
the uppercase abbreviation when missing or different.
EOF
)"
```

---

## Task 4: Implement `parseSearchTerm` (TDD)

**Files:**
- Test: `backend/__tests__/services/searchParser.test.js`
- Create: `backend/src/services/meta/searchParser.js`

- [ ] **Step 1: Write the failing test file**

Create `backend/__tests__/services/searchParser.test.js`:

```js
import { describe, it, expect } from "@jest/globals";
import { parseSearchTerm } from "../../src/services/meta/searchParser.js";

describe("parseSearchTerm", () => {
  describe("empty inputs", () => {
    it("returns empty for blank string", () => {
      expect(parseSearchTerm("")).toEqual({ kind: "empty" });
    });

    it("returns empty for whitespace only", () => {
      expect(parseSearchTerm("   ")).toEqual({ kind: "empty" });
    });

    it("returns empty for term longer than 200 chars", () => {
      expect(parseSearchTerm("a".repeat(201))).toEqual({ kind: "empty" });
    });

    it("accepts term exactly 200 chars", () => {
      const term = "a".repeat(200);
      expect(parseSearchTerm(term)).toEqual({ kind: "single", token: term });
    });
  });

  describe("single token", () => {
    it("returns single for one word", () => {
      expect(parseSearchTerm("lakers")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("trims surrounding whitespace", () => {
      expect(parseSearchTerm("  lakers  ")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("collapses internal whitespace", () => {
      expect(parseSearchTerm("Los   Angeles")).toEqual({
        kind: "single",
        token: "Los Angeles",
      });
    });

    it("preserves original case", () => {
      expect(parseSearchTerm("LeBron")).toEqual({
        kind: "single",
        token: "LeBron",
      });
    });
  });

  describe("matchup separators", () => {
    it("splits on ' vs '", () => {
      expect(parseSearchTerm("rockets vs lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' vs. '", () => {
      expect(parseSearchTerm("rockets vs. lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' v '", () => {
      expect(parseSearchTerm("rockets v lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' @ '", () => {
      expect(parseSearchTerm("rockets @ lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' at '", () => {
      expect(parseSearchTerm("rockets at lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("splits on ' - '", () => {
      expect(parseSearchTerm("rockets - lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("does NOT split hyphens within a word", () => {
      expect(parseSearchTerm("Mike Smith-Pelly")).toEqual({
        kind: "single",
        token: "Mike Smith-Pelly",
      });
    });

    it("is case-insensitive on the separator", () => {
      expect(parseSearchTerm("rockets VS lakers")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });
  });

  describe("partial input", () => {
    it("trailing 'vs' degrades to single token (lhs)", () => {
      expect(parseSearchTerm("lakers vs ")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("leading 'vs' degrades to single token (rhs)", () => {
      expect(parseSearchTerm(" vs lakers")).toEqual({
        kind: "single",
        token: "lakers",
      });
    });

    it("only-separator string returns empty", () => {
      expect(parseSearchTerm(" vs ")).toEqual({ kind: "empty" });
    });
  });

  describe("multiple separators", () => {
    it("splits on the first separator only", () => {
      expect(parseSearchTerm("rockets vs lakers vs heat")).toEqual({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers vs heat",
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchParser
```

Expected: FAIL with `Cannot find module '.../searchParser.js'` or similar.

- [ ] **Step 3: Implement the parser**

Create `backend/src/services/meta/searchParser.js`:

```js
const MAX_LENGTH = 200;

const SEPARATORS = [
  /\s+vs\.?\s+/i, // ' vs ' / ' vs. '
  /\s+v\.?\s+/i,  // ' v ' / ' v. '
  /\s+@\s+/,      // ' @ '
  /\s+at\s+/i,    // ' at '
  /\s+-\s+/,      // ' - '
];

export function parseSearchTerm(raw) {
  if (typeof raw !== "string") return { kind: "empty" };
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > MAX_LENGTH) return { kind: "empty" };

  for (const re of SEPARATORS) {
    const match = re.exec(normalized);
    if (!match) continue;
    const lhs = normalized.slice(0, match.index).trim();
    const rhs = normalized.slice(match.index + match[0].length).trim();
    if (lhs && rhs) return { kind: "matchup", lhs, rhs };
    if (lhs) return { kind: "single", token: lhs };
    if (rhs) return { kind: "single", token: rhs };
    return { kind: "empty" };
  }

  return { kind: "single", token: normalized };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchParser
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/services/searchParser.test.js backend/src/services/meta/searchParser.js
git commit -m "$(cat <<'EOF'
feat(search): add parseSearchTerm for matchup/single/empty classification

Pure parser that splits on " vs ", " v ", " @ ", " at ", " - " (whitespace-
delimited only, so hyphenated names stay intact). Trailing/leading separators
degrade to a single-token result so mid-typing still searches.
EOF
)"
```

---

## Task 5: Implement `resolveTeams` cascade (TDD)

**Files:**
- Test: `backend/__tests__/services/teamResolver.test.js`
- Create: `backend/src/services/meta/teamResolver.js`

- [ ] **Step 1: Write the failing test file**

Create `backend/__tests__/services/teamResolver.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = createMockPool();
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { resolveTeams } = await import(
  resolve(__dirname, "../../src/services/meta/teamResolver.js")
);

describe("resolveTeams", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("tier 1 — abbreviation", () => {
    it("hits tier 1 for tokens of length ≤ 4", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      const result = await resolveTeams("LAL");

      expect(result).toEqual([{ id: 527, league: "nba", score: 1 }]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain("LOWER(abbreviation)");
    });

    it("skips tier 1 for tokens of length > 4", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers");

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain("LOWER(abbreviation)");
    });
  });

  describe("tier 2 — exact name/shortname", () => {
    it("returns score 2 when tier 2 hits (tier 1 skipped)", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      const result = await resolveTeams("Lakers");

      expect(result[0].score).toBe(2);
    });
  });

  describe("tier 3 — prefix", () => {
    it("returns score 3 when tier 2 misses and prefix hits", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // tier 2 miss
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      }); // tier 3 hit

      const result = await resolveTeams("Laker");

      expect(result).toEqual([{ id: 527, league: "nba", score: 3 }]);
    });
  });

  describe("tier 4 — substring with length-3 gate", () => {
    it("skips tier 4 for tokens < 3 chars", async () => {
      // For "LL" (len 2): tier 1 runs (≤4), tier 2 runs, tier 3 runs, tier 5 runs
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await resolveTeams("LL");

      const calls = mockPool.query.mock.calls.map((c) => c[0]);
      const tier4 = calls.find((sql) => /LIKE\s+'%'\s+\|\|/.test(sql));
      expect(tier4).toBeUndefined();
    });

    it("runs tier 4 when token length is exactly 3", async () => {
      // "abc" (len 3): tier 1, 2, 3 miss, tier 4 hits
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // tier 1
        .mockResolvedValueOnce({ rows: [] }) // tier 2
        .mockResolvedValueOnce({ rows: [] }) // tier 3
        .mockResolvedValueOnce({
          rows: [{ id: 99, league: "nba" }],
        }); // tier 4

      const result = await resolveTeams("abc");

      expect(result).toEqual([{ id: 99, league: "nba", score: 4 }]);
    });
  });

  describe("tier 5 — fuzzy", () => {
    it("falls through to fuzzy on typos", async () => {
      // "warriros" (len 8 > 4): tier 1 skipped; tiers 2,3,4 miss; tier 5 hits
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // tier 2
        .mockResolvedValueOnce({ rows: [] }) // tier 3
        .mockResolvedValueOnce({ rows: [] }) // tier 4
        .mockResolvedValueOnce({
          rows: [{ id: 548, league: "nba" }],
        }); // tier 5

      const result = await resolveTeams("warriros");

      expect(result).toEqual([{ id: 548, league: "nba", score: 5 }]);
      expect(mockPool.query).toHaveBeenCalledTimes(4);
      expect(mockPool.query.mock.calls[3][0]).toContain("similarity");
    });
  });

  describe("league filter", () => {
    it("includes league as a parameter when provided", async () => {
      // tier 2 hits
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers", { league: "nba" });

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toContain("nba");
    });

    it("does NOT include league filter SQL when league is undefined", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers");

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain("AND league =");
    });
  });

  describe("no match", () => {
    it("returns empty array after all tiers exhausted", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await resolveTeams("zzzzzz");

      expect(result).toEqual([]);
    });
  });

  describe("input handling", () => {
    it("returns empty array for blank input without hitting DB", async () => {
      const result = await resolveTeams("");
      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- teamResolver
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolveTeams**

Create `backend/src/services/meta/teamResolver.js`:

```js
import pool from "../../db/db.js";

const ABBR_MAX_LEN = 4;
const SUBSTRING_MIN_LEN = 3;
const FUZZY_THRESHOLD = 0.4;

function buildLeagueClause(league, paramIndex) {
  return league ? { sql: ` AND league = $${paramIndex}`, params: [league] } : { sql: "", params: [] };
}

async function runTier(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function resolveTeams(token, { league } = {}) {
  if (typeof token !== "string" || !token.trim()) return [];
  const trimmed = token.trim();

  // Tier 1: abbreviation (only short tokens)
  if (trimmed.length <= ABBR_MAX_LEN) {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE LOWER(abbreviation) = LOWER($1)
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 1 }));
  }

  // Tier 2: exact match on shortname or name
  {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) = LOWER($1) OR LOWER(name) = LOWER($1))
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 2 }));
  }

  // Tier 3: prefix
  {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) LIKE LOWER($1) || '%' OR LOWER(name) LIKE LOWER($1) || '%')
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 3 }));
  }

  // Tier 4: substring (length-3 gate)
  if (trimmed.length >= SUBSTRING_MIN_LEN) {
    const lc = buildLeagueClause(league, 2);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (LOWER(shortname) LIKE '%' || LOWER($1) || '%' OR LOWER(name) LIKE '%' || LOWER($1) || '%')
        AND conf IS NOT NULL${lc.sql}
    `;
    const rows = await runTier(sql, [trimmed, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 4 }));
  }

  // Tier 5: fuzzy (trigram)
  {
    const lc = buildLeagueClause(league, 3);
    const sql = `
      SELECT id, league
      FROM teams
      WHERE (similarity(shortname, $1) > $2 OR similarity(name, $1) > $2)
        AND conf IS NOT NULL${lc.sql}
      ORDER BY GREATEST(similarity(shortname, $1), similarity(name, $1)) DESC
    `;
    const rows = await runTier(sql, [trimmed, FUZZY_THRESHOLD, ...lc.params]);
    if (rows.length > 0) return rows.map((r) => ({ ...r, score: 5 }));
  }

  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- teamResolver
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/services/teamResolver.test.js backend/src/services/meta/teamResolver.js
git commit -m "$(cat <<'EOF'
feat(search): add resolveTeams cascade lookup helper

Five-tier cascade — abbreviation → exact name → prefix → substring → fuzzy.
Each tier early-exits on hit. Substring tier gated to tokens ≥ 3 chars to
prevent short-token noise (e.g. "LAL" matching "Afflalo"). Returns scored
{ id, league, score } rows for downstream ranking.
EOF
)"
```

---

## Task 6: Rewrite searchService — empty + single branches (TDD)

This task delivers a working `searchService` that handles `empty` and `single` cases. The matchup branch lands in Task 7. Existing tests in `searchService.test.js` are replaced because the SQL surface changes completely.

**Files:**
- Modify: `backend/__tests__/services/searchService.test.js` (replace contents)
- Modify: `backend/src/services/meta/searchService.js` (rewrite)

- [ ] **Step 1: Write the failing test file**

Replace the entire contents of `backend/__tests__/services/searchService.test.js` with:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = createMockPool();
const mockTryParseDate = jest.fn();
const mockResolveTeams = jest.fn();
const mockParseSearchTerm = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const dateParserPath = resolve(__dirname, "../../src/utils/dateParser.js");
jest.unstable_mockModule(dateParserPath, () => ({
  tryParseDate: mockTryParseDate,
}));

const resolverPath = resolve(__dirname, "../../src/services/meta/teamResolver.js");
jest.unstable_mockModule(resolverPath, () => ({
  resolveTeams: mockResolveTeams,
}));

const parserPath = resolve(__dirname, "../../src/services/meta/searchParser.js");
jest.unstable_mockModule(parserPath, () => ({
  parseSearchTerm: mockParseSearchTerm,
}));

const { search } = await import(
  resolve(__dirname, "../../src/services/meta/searchService.js")
);

describe("searchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTryParseDate.mockReturnValue(null);
  });

  describe("empty branch", () => {
    it("returns [] without DB calls when parser says empty", async () => {
      mockParseSearchTerm.mockReturnValue({ kind: "empty" });

      const result = await search("");

      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResolveTeams).not.toHaveBeenCalled();
    });
  });

  describe("single branch", () => {
    beforeEach(() => {
      mockParseSearchTerm.mockReturnValue({ kind: "single", token: "lakers" });
    });

    it("calls resolveTeams once with the token", async () => {
      mockResolveTeams.mockResolvedValueOnce([]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      expect(mockResolveTeams).toHaveBeenCalledTimes(1);
      expect(mockResolveTeams).toHaveBeenCalledWith("lakers");
    });

    it("queries team entities for resolved IDs", async () => {
      mockResolveTeams.mockResolvedValueOnce([
        { id: 527, league: "nba", score: 2 },
      ]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      // At least one query SQL string must select team rows
      const teamCall = mockPool.query.mock.calls.find(
        (c) => c[0].includes("FROM teams") && Array.isArray(c[1]) && c[1].some((p) => Array.isArray(p) && p.includes(527))
      );
      expect(teamCall).toBeDefined();
    });

    it("queries players for the token", async () => {
      mockResolveTeams.mockResolvedValueOnce([]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      const playerCall = mockPool.query.mock.calls.find((c) =>
        c[0].includes("FROM players")
      );
      expect(playerCall).toBeDefined();
    });

    it("returns the team entity ranked first when score=2 hit", async () => {
      mockResolveTeams.mockResolvedValueOnce([
        { id: 527, league: "nba", score: 2 },
      ]);
      // Stub: team query returns Lakers row; player + game queries return []
      mockPool.query.mockImplementation((sql) => {
        if (sql.includes("FROM teams")) {
          return Promise.resolve({
            rows: [
              {
                id: 527,
                name: "Los Angeles Lakers",
                league: "nba",
                imageUrl: "lal.png",
                shortname: "Lakers",
                date: null,
                type: "team",
                position: null,
                team_name: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await search("lakers");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("team");
      expect(result[0].id).toBe(527);
    });

    it("respects the LIMIT 15 result cap", async () => {
      mockResolveTeams.mockResolvedValueOnce([{ id: 1, league: "nba", score: 4 }]);
      const manyTeams = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i}`,
        league: "nba",
        imageUrl: null,
        shortname: null,
        date: null,
        type: "team",
        position: null,
        team_name: null,
      }));
      mockPool.query.mockImplementation((sql) =>
        sql.includes("FROM teams")
          ? Promise.resolve({ rows: manyTeams })
          : Promise.resolve({ rows: [] })
      );

      const result = await search("anything");

      expect(result.length).toBeLessThanOrEqual(15);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchService
```

Expected: FAIL — most tests will throw because the new `searchService.js` doesn't exist yet (or still uses old SQL shape).

- [ ] **Step 3: Implement empty + single branches**

Replace the entire contents of `backend/src/services/meta/searchService.js` with:

```js
import pool from "../../db/db.js";
import { tryParseDate } from "../../utils/dateParser.js";
import { parseSearchTerm } from "./searchParser.js";
import { resolveTeams } from "./teamResolver.js";

const RESULT_LIMIT = 15;
const PLAYER_SUBSTRING_MIN_LEN = 3;
const FUZZY_PLAYER_THRESHOLD = 0.3;

const TYPE_RANK = { team: 1, player: 2, game: 3 };

const TEAM_ENTITY_QUERY = `
  SELECT id, name, league, logo_url AS "imageUrl", shortname,
         NULL::date AS date, 'team' AS type,
         NULL AS position, NULL AS team_name
  FROM teams
  WHERE id = ANY($1::int[]) AND conf IS NOT NULL
`;

const PLAYER_ILIKE_QUERY = `
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
           NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM players p
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE p.name ILIKE $1
  )
  UNION ALL
  (
    SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
           NULL AS shortname, NULL::date AS date, 'player' AS type,
           p.position, t.name AS team_name, p.popularity
    FROM player_aliases pa
    JOIN players p ON pa.player_id = p.id
    LEFT JOIN teams t ON p.teamid = t.id
    WHERE pa.alias ILIKE $1
  )
  ORDER BY popularity DESC NULLS LAST
  LIMIT 15
`;

const PLAYER_FUZZY_QUERY = `
  SELECT p.id, p.name, p.league, p.image_url AS "imageUrl",
         NULL AS shortname, NULL::date AS date, 'player' AS type,
         p.position, t.name AS team_name, p.popularity,
         similarity(p.name, $1) AS sim
  FROM players p
  LEFT JOIN teams t ON p.teamid = t.id
  WHERE similarity(p.name, $1) > $2
  ORDER BY sim DESC, popularity DESC NULLS LAST
  LIMIT 15
`;

const TOP_SEASONS_CTE = `
  WITH top_seasons AS (
    SELECT league, season FROM (
      SELECT league, season,
             ROW_NUMBER() OVER (PARTITION BY league ORDER BY season DESC) AS rn
      FROM (SELECT DISTINCT league, season FROM games) s
    ) t WHERE rn <= 3
  )
`;

const PER_TEAM_GAMES_QUERY = `
  ${TOP_SEASONS_CTE}
  SELECT g.id,
         CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
         g.league,
         NULL AS "imageUrl",
         NULL AS shortname,
         g.date,
         'game' AS type,
         NULL AS position,
         NULL AS team_name
  FROM unnest($1::int[]) AS team_id
  JOIN LATERAL (
    (
      SELECT id, hometeamid, awayteamid, date, league
      FROM games
      WHERE (hometeamid = team_id OR awayteamid = team_id)
        AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
        AND date >= CURRENT_DATE
      ORDER BY date ASC
      LIMIT 2
    )
    UNION ALL
    (
      SELECT id, hometeamid, awayteamid, date, league
      FROM games
      WHERE (hometeamid = team_id OR awayteamid = team_id)
        AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
        AND date < CURRENT_DATE
      ORDER BY date DESC
      LIMIT 3
    )
  ) g ON TRUE
  JOIN teams ht ON g.hometeamid = ht.id
  JOIN teams at ON g.awayteamid = at.id
  WHERE ht.conf IS NOT NULL AND at.conf IS NOT NULL
`;

function escapeIlike(s) {
  return s.replace(/[%_\\]/g, "\\$&");
}

function dedupeByTypeId(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function compareRows(a, b) {
  const sa = a.score ?? 99;
  const sb = b.score ?? 99;
  if (sa !== sb) return sa - sb;
  const ta = TYPE_RANK[a.type] ?? 99;
  const tb = TYPE_RANK[b.type] ?? 99;
  if (ta !== tb) return ta - tb;
  const pa = a.popularity ?? 0;
  const pb = b.popularity ?? 0;
  if (pa !== pb) return pb - pa;
  if (a.type === "game" && b.type === "game") {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return Math.abs(da - Date.now()) - Math.abs(db - Date.now());
  }
  return String(a.name || "").localeCompare(String(b.name || ""));
}

function stripInternalFields(rows) {
  return rows.map(({ score, popularity, sim, ...rest }) => rest);
}

async function queryTeamEntities(ids) {
  if (!ids.length) return [];
  const res = await pool.query(TEAM_ENTITY_QUERY, [ids]);
  return res.rows;
}

async function queryPlayers(token) {
  const trimmed = token.trim();
  if (trimmed.length < PLAYER_SUBSTRING_MIN_LEN) return [];

  const escaped = escapeIlike(trimmed);
  const ilike = await pool.query(PLAYER_ILIKE_QUERY, [`%${escaped}%`]);
  if (ilike.rows.length > 0) return ilike.rows;

  const fuzzy = await pool.query(PLAYER_FUZZY_QUERY, [
    trimmed,
    FUZZY_PLAYER_THRESHOLD,
  ]);
  return fuzzy.rows;
}

async function queryPerTeamGames(teamIds) {
  if (!teamIds.length) return [];
  const res = await pool.query(PER_TEAM_GAMES_QUERY, [teamIds]);
  return res.rows;
}

async function searchSingle(parsed) {
  const resolved = await resolveTeams(parsed.token);
  const teamIds = resolved.map((r) => r.id);

  const [teamRows, playerRows, gameRows] = await Promise.all([
    queryTeamEntities(teamIds),
    queryPlayers(parsed.token),
    queryPerTeamGames(teamIds),
  ]);

  const teamScored = teamRows.map((row) => {
    const match = resolved.find((r) => r.id === row.id);
    return { ...row, score: match?.score ?? 99 };
  });
  const gameScored = gameRows.map((row) => ({ ...row, score: 50 }));
  const playerScored = playerRows.map((row) => ({ ...row, score: 30 }));

  const merged = dedupeByTypeId([...teamScored, ...playerScored, ...gameScored]);
  merged.sort(compareRows);
  return stripInternalFields(merged.slice(0, RESULT_LIMIT));
}

export async function search(term) {
  const parsed = parseSearchTerm(term);
  if (parsed.kind === "empty") return [];
  if (parsed.kind === "matchup") {
    // Matchup branch lands in the next task; until then, fall back to single.
    return searchSingle({ kind: "single", token: parsed.lhs });
  }
  return searchSingle(parsed);
}
```

- [ ] **Step 4: Run tests to verify single-branch tests pass**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchService
```

Expected: all tests in this task's file pass. (No matchup-branch tests yet.)

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/services/searchService.test.js backend/src/services/meta/searchService.js
git commit -m "$(cat <<'EOF'
feat(search): rewrite searchService with parser+resolver, single branch

Replaces single-pass ILIKE+fuzzy with a parser-then-resolver-then-assemble
flow. Single-token queries now use resolveTeams (cascade) for teams,
existing ILIKE+fuzzy for players, and a 3-season top_seasons CTE with a
LATERAL "next 2 + last 3" pattern for per-team games. Matchup branch
temporarily falls back to single-token; full matchup support next task.
EOF
)"
```

---

## Task 7: Add matchup branch (TDD)

**Files:**
- Modify: `backend/__tests__/services/searchService.test.js` (append)
- Modify: `backend/src/services/meta/searchService.js`

- [ ] **Step 1: Append failing matchup tests**

Append the following `describe` block to `backend/__tests__/services/searchService.test.js` (inside the top-level `describe("searchService", ...)`):

```js
  describe("matchup branch", () => {
    beforeEach(() => {
      mockParseSearchTerm.mockReturnValue({
        kind: "matchup",
        lhs: "rockets",
        rhs: "lakers",
      });
    });

    it("calls resolveTeams in parallel for both sides", async () => {
      mockResolveTeams
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 2 }])
        .mockResolvedValueOnce([{ id: 527, league: "nba", score: 2 }]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("rockets vs lakers");

      expect(mockResolveTeams).toHaveBeenCalledTimes(2);
      expect(mockResolveTeams).toHaveBeenNthCalledWith(1, "rockets");
      expect(mockResolveTeams).toHaveBeenNthCalledWith(2, "lakers");
    });

    it("queries team entities for combined IDs and matchup games", async () => {
      mockResolveTeams
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 2 }])
        .mockResolvedValueOnce([{ id: 527, league: "nba", score: 2 }]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("rockets vs lakers");

      const teamCall = mockPool.query.mock.calls.find((c) =>
        c[0].includes("FROM teams")
      );
      expect(teamCall).toBeDefined();
      // Combined IDs in either order
      const ids = teamCall[1][0];
      expect(ids).toEqual(expect.arrayContaining([539, 527]));

      const gameCall = mockPool.query.mock.calls.find(
        (c) =>
          c[0].includes("FROM games") &&
          c[0].includes("hometeamid") &&
          c[0].includes("awayteamid")
      );
      expect(gameCall).toBeDefined();
    });

    it("falls back to single-branch when one side is unresolved", async () => {
      mockResolveTeams
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 2 }]) // rockets
        .mockResolvedValueOnce([]) // rhs unresolved
        // Then single-branch with raw term re-runs resolveTeams once more
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 4 }]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("rockets vs zzzzzz");

      expect(mockResolveTeams.mock.calls.length).toBeGreaterThanOrEqual(3);
      // Third call is the single-branch fallback with the raw term
      expect(mockResolveTeams.mock.calls[2][0]).toBe("rockets vs zzzzzz");
    });

    it("includes date filter when tryParseDate returns a date", async () => {
      mockResolveTeams
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 2 }])
        .mockResolvedValueOnce([{ id: 527, league: "nba", score: 2 }]);
      mockTryParseDate.mockReturnValue("2026-02-05");
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("rockets vs lakers 2/5");

      const gameCall = mockPool.query.mock.calls.find(
        (c) => c[0].includes("FROM games") && c[0].includes("hometeamid")
      );
      expect(gameCall[1]).toContain("2026-02-05");
    });

    it("returns games + both team cards on full success", async () => {
      mockResolveTeams
        .mockResolvedValueOnce([{ id: 539, league: "nba", score: 2 }])
        .mockResolvedValueOnce([{ id: 527, league: "nba", score: 2 }]);
      mockPool.query.mockImplementation((sql) => {
        if (sql.includes("FROM teams")) {
          return Promise.resolve({
            rows: [
              {
                id: 539,
                name: "Houston Rockets",
                league: "nba",
                imageUrl: null,
                shortname: "Rockets",
                date: null,
                type: "team",
                position: null,
                team_name: null,
              },
              {
                id: 527,
                name: "Los Angeles Lakers",
                league: "nba",
                imageUrl: null,
                shortname: "Lakers",
                date: null,
                type: "team",
                position: null,
                team_name: null,
              },
            ],
          });
        }
        if (sql.includes("FROM games")) {
          return Promise.resolve({
            rows: [
              {
                id: 12345,
                name: "Rockets vs Lakers",
                league: "nba",
                imageUrl: null,
                shortname: null,
                date: "2026-02-05",
                type: "game",
                position: null,
                team_name: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await search("rockets vs lakers");

      expect(result).toHaveLength(3);
      expect(result.filter((r) => r.type === "team")).toHaveLength(2);
      expect(result.filter((r) => r.type === "game")).toHaveLength(1);
    });
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchService
```

Expected: matchup-branch tests fail (current code falls back to single).

- [ ] **Step 3: Implement the matchup branch**

In `backend/src/services/meta/searchService.js`:

**3a.** Add the matchup-games query constant near the other query constants (after `PER_TEAM_GAMES_QUERY`):

```js
const MATCHUP_GAMES_QUERY = `
  ${TOP_SEASONS_CTE}
  SELECT g.id,
         CONCAT(ht.shortname, ' vs ', at.shortname) AS name,
         g.league,
         NULL AS "imageUrl",
         NULL AS shortname,
         g.date,
         'game' AS type,
         NULL AS position,
         NULL AS team_name
  FROM games g
  JOIN teams ht ON g.hometeamid = ht.id
  JOIN teams at ON g.awayteamid = at.id
  WHERE g.season IN (SELECT season FROM top_seasons WHERE league = g.league)
    AND ht.conf IS NOT NULL AND at.conf IS NOT NULL
    AND (
      (g.hometeamid = ANY($1::int[]) AND g.awayteamid = ANY($2::int[]))
      OR
      (g.hometeamid = ANY($2::int[]) AND g.awayteamid = ANY($1::int[]))
    )
    AND ($3::date IS NULL OR g.date = $3::date)
  ORDER BY g.date DESC
  LIMIT 15
`;
```

**3b.** Add the `queryMatchupGames` helper alongside the other `query*` helpers:

```js
async function queryMatchupGames(lhsIds, rhsIds, dateFilter) {
  const res = await pool.query(MATCHUP_GAMES_QUERY, [lhsIds, rhsIds, dateFilter]);
  return res.rows;
}
```

**3c.** Add the `searchMatchup` branch function above `search`:

```js
async function searchMatchup(parsed, rawTerm) {
  const [lhs, rhs] = await Promise.all([
    resolveTeams(parsed.lhs),
    resolveTeams(parsed.rhs),
  ]);
  if (lhs.length === 0 || rhs.length === 0) return null;

  const lhsIds = lhs.map((t) => t.id);
  const rhsIds = rhs.map((t) => t.id);
  const date = tryParseDate(rawTerm);

  const [teamRows, gameRows] = await Promise.all([
    queryTeamEntities([...lhsIds, ...rhsIds]),
    queryMatchupGames(lhsIds, rhsIds, date),
  ]);

  const teamScored = teamRows.map((row) => {
    const match = [...lhs, ...rhs].find((r) => r.id === row.id);
    return { ...row, score: match?.score ?? 99 };
  });
  const gameScored = gameRows.map((row) => ({ ...row, score: 10 }));

  const merged = dedupeByTypeId([...teamScored, ...gameScored]);
  merged.sort(compareRows);
  return stripInternalFields(merged.slice(0, RESULT_LIMIT));
}
```

**3d.** Replace the existing `search` export with:

```js
export async function search(term) {
  const parsed = parseSearchTerm(term);
  if (parsed.kind === "empty") return [];

  if (parsed.kind === "matchup") {
    const matchupResult = await searchMatchup(parsed, term);
    if (matchupResult !== null) return matchupResult;
    return searchSingle({ kind: "single", token: term.trim() });
  }

  return searchSingle(parsed);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/yassin/work/Scorva/backend && npm test -- searchService
```

Expected: all tests in `searchService.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add backend/__tests__/services/searchService.test.js backend/src/services/meta/searchService.js
git commit -m "$(cat <<'EOF'
feat(search): add matchup branch with 3-season window and date filter

resolveTeams runs in parallel for lhs/rhs. On dual hit, fetches the team
cards plus all matchup games in the top-3-seasons window, with optional
date narrowing via tryParseDate. Falls back to single-branch with the raw
term when either side fails to resolve, so junk like "foo vs bar" still
returns whatever fuzzy can find.
EOF
)"
```

---

## Task 8: Full backend verify + manual smoke

**Files:** none

- [ ] **Step 1: Run full backend test suite**

```bash
cd /Users/yassin/work/Scorva/backend && npm run verify
```

Expected: lint clean, all tests pass.

- [ ] **Step 2: Start backend dev server**

```bash
cd /Users/yassin/work/Scorva/backend && npm run dev
```

Wait for "listening on 8080" or equivalent in the logs.

- [ ] **Step 3: Run manual smoke checks**

In a second terminal:

```bash
# Matchup query
curl -s 'http://localhost:8080/api/search?term=rockets%20vs%20lakers' | python3 -m json.tool
```

Expected: results contain at least one `"type":"game"` row with `"name":"Rockets vs Lakers"`-style display name, plus `"type":"team"` rows for both teams.

```bash
# Abbreviation query
curl -s 'http://localhost:8080/api/search?term=GSW' | python3 -m json.tool
```

Expected: first row is `Golden State Warriors`, type team. No "Afflalo"-style player noise as the top result.

```bash
# Single team — verify 3-season game expansion
curl -s 'http://localhost:8080/api/search?term=lakers' | python3 -m json.tool
```

Expected: Lakers team card first; up to 5 game rows (next 2 upcoming + last 3 past); no rows from seasons older than the top-3 window.

```bash
# Multi-word typo on matchup
curl -s 'http://localhost:8080/api/search?term=lakers%20vs%20warriros' | python3 -m json.tool
```

Expected: matchup games + Lakers + Warriors via the fuzzy tier on `warriros`.

```bash
# Trailing separator (mid-typing)
curl -s 'http://localhost:8080/api/search?term=lakers%20vs%20' | python3 -m json.tool
```

Expected: behaves identical to `term=lakers` (Lakers card + 5 games).

- [ ] **Step 4: Stop the dev server**

`Ctrl+C` the `npm run dev` process.

- [ ] **Step 5: Final summary commit (no-op if previous tasks already covered everything)**

If anything got tweaked during smoke (e.g., a query needed an index hint or a comment), commit it. Otherwise skip.

---

## Production deploy notes (post-merge)

1. Run `prisma migrate deploy` (or apply the SQL manually if shadow DB is the same issue in prod).
2. Run the backfill script once on prod: `node src/ingestion/scripts/backfillTeamAbbreviations.js`.
3. Verify with the same curl smoke tests against the prod URL.

The migration is additive and nullable, so service code that doesn't yet read `abbreviation` is safe before backfill completes. But the searchService rewrite **does** read it (tier 1) — backfill must complete before the rewrite ships, otherwise abbreviation queries return empty until the next ingest pass writes values via `upsertTeam`.

The spec recommended shipping in two PRs (schema/ingestion first, then service). If this plan is squashed into one PR, ensure the deploy sequence is: migrate → backfill → restart server.
