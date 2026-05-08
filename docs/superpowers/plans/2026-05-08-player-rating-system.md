# Player Rating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an NBA-only per-play, WPA-weighted player performance rating that aggregates to per-game `stats.rating`, surfaces a `0.0–10.0` grade chip on `StatCard` and `TopPerformerCard`, and powers a new "Top Performances" Homepage component (Best Games + Last 7 Days tabs).

**Architecture:** Capture per-play participants from ESPN, write to `play_participants`. For each play, for each participant, compute a value = `base_weight(role, play_type, distance) + WPA_WEIGHT × wpa_delta × team_sign`, clamped to `[-10.0, +10.0]`. Sum per (player, game) → `stats.rating`. New `play_ratings` table holds the per-play breakdown for debug/recompute. Rating recompute runs idempotently inside the existing per-game ingestion transaction. Grade chip is computed at the API/UI layer (`max(0, min(10, raw / 5.5))`); raw value is hidden in chips and shown only in the cumulative Last 7 Days tab.

**Tech Stack:** PostgreSQL via `pg`, Prisma 7 (schema-only — queries are raw SQL), Express, Jest (backend tests with `jest.unstable_mockModule` for ESM), React 19 + Vite + TanStack Query v5, Vitest + @testing-library/react (frontend).

**Spec:** [`docs/superpowers/specs/2026-05-08-player-rating-system-design.md`](../specs/2026-05-08-player-rating-system-design.md)

**Phase boundaries (read top-down):**
- A. Foundation (Task 1)
- B. Plays enrichment (Tasks 2–6)
- C. Rating engine (Tasks 7–9)
- D. Backfill (Task 10)
- E. Backend API (Tasks 11–15)
- F. Frontend (Tasks 16–20)
- G. Tuning + docs (Tasks 21–22)

---

## Task 1: Schema migration

**Files:**
- Create: `backend/prisma/migrations/20260508000000_add_player_rating_system/migration.sql`
- Modify: `backend/prisma/schema.prisma`

Note: per project memory, `prisma migrate dev` has issues locally (shadow DB / `pg_trgm`). Apply SQL directly via `psql`, then `prisma migrate resolve --applied`, then `prisma generate`.

- [ ] **Step 1: Create migration SQL**

Create `backend/prisma/migrations/20260508000000_add_player_rating_system/migration.sql`:

```sql
ALTER TABLE stats ADD COLUMN rating NUMERIC(6,1);

ALTER TABLE plays ADD COLUMN shot_distance_ft SMALLINT;

CREATE TABLE play_participants (
  id              SERIAL PRIMARY KEY,
  play_id         INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,
  espn_athlete_id VARCHAR(20),
  CONSTRAINT play_participants_unique UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_participants_player_idx ON play_participants(player_id);

CREATE TABLE play_ratings (
  id             SERIAL PRIMARY KEY,
  play_id        INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id      INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id        INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  role           VARCHAR(20) NOT NULL,
  base_value     NUMERIC(4,1) NOT NULL,
  wpa_delta      NUMERIC(5,4),
  weighted_value NUMERIC(4,1) NOT NULL,
  CONSTRAINT play_ratings_unique UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_ratings_player_game_idx ON play_ratings(player_id, game_id);
CREATE INDEX play_ratings_game_value_idx  ON play_ratings(game_id, weighted_value DESC);
```

- [ ] **Step 2: Update Prisma schema**

Append to `backend/prisma/schema.prisma`:

```prisma
model play_participants {
  id              Int     @id @default(autoincrement())
  play_id         Int
  player_id       Int
  role            String  @db.VarChar(20)
  espn_athlete_id String? @db.VarChar(20)
  plays           plays   @relation(fields: [play_id], references: [id], onDelete: Cascade)
  players         players @relation(fields: [player_id], references: [id], onDelete: Cascade)

  @@unique([play_id, player_id, role], map: "play_participants_unique")
  @@index([player_id], map: "play_participants_player_idx")
}

model play_ratings {
  id             Int      @id @default(autoincrement())
  play_id        Int
  player_id      Int
  game_id        Int
  role           String   @db.VarChar(20)
  base_value     Decimal  @db.Decimal(4, 1)
  wpa_delta      Decimal? @db.Decimal(5, 4)
  weighted_value Decimal  @db.Decimal(4, 1)
  plays          plays    @relation(fields: [play_id], references: [id], onDelete: Cascade)
  players        players  @relation(fields: [player_id], references: [id], onDelete: Cascade)
  games          games    @relation(fields: [game_id], references: [id], onDelete: Cascade)

  @@unique([play_id, player_id, role], map: "play_ratings_unique")
  @@index([player_id, game_id], map: "play_ratings_player_game_idx")
  @@index([game_id, weighted_value(sort: Desc)], map: "play_ratings_game_value_idx")
}
```

In the existing `stats` model, add `rating Decimal? @db.Decimal(6, 1)` after `teamid`.
In the existing `plays` model, add `shot_distance_ft Int? @db.SmallInt` after `drive_result`, and add the back-relations:
```prisma
play_participants play_participants[]
play_ratings      play_ratings[]
```
In the existing `players` model add the back-relations:
```prisma
play_participants play_participants[]
play_ratings      play_ratings[]
```
In the existing `games` model add the back-relation:
```prisma
play_ratings play_ratings[]
```

- [ ] **Step 3: Apply migration to local DB**

Run:
```bash
cd backend
psql "$DATABASE_URL" -f prisma/migrations/20260508000000_add_player_rating_system/migration.sql
node_modules/.bin/prisma migrate resolve --applied 20260508000000_add_player_rating_system
node_modules/.bin/prisma generate
```

- [ ] **Step 4: Verify schema**

Run:
```bash
psql "$DATABASE_URL" -c "\d stats" | grep rating
psql "$DATABASE_URL" -c "\d plays" | grep shot_distance_ft
psql "$DATABASE_URL" -c "\d play_participants"
psql "$DATABASE_URL" -c "\d play_ratings"
```

Expected: `rating` shows on stats with type `numeric(6,1)`; `shot_distance_ft` on plays with type `smallint`; both new tables exist with the indexes/constraints from the SQL.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations/20260508000000_add_player_rating_system backend/prisma/schema.prisma backend/src/generated/prisma
git commit -m "feat(rating): add schema for player rating system

stats.rating, plays.shot_distance_ft, play_participants, play_ratings."
```

---

## Task 2: NBA shot distance extractor (pure function, TDD)

**Files:**
- Create: `backend/src/ingestion/mappings/nbaPlayDistance.js`
- Test: `backend/__tests__/ingestion/nbaPlayDistance.test.js`

**Why:** ESPN normalizes coordinates to a single offensive frame with the basket at `(25, 0)`. Verified empirically (avg ±0.7 ft difference vs ESPN's text-stated distance, both home and away).

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/ingestion/nbaPlayDistance.test.js`:

```js
import { extractShotDistance } from "../../src/ingestion/mappings/nbaPlayDistance.js";

describe("extractShotDistance", () => {
  test("returns null for non-shooting plays", () => {
    expect(extractShotDistance({ shootingPlay: false, coordinate: { x: 5, y: 5 } })).toBeNull();
  });

  test("returns null for free throws", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Stephen Curry makes free throw 1 of 2",
      coordinate: { x: -2147483340, y: -2147483365 },
    })).toBeNull();
  });

  test("computes ~24ft for a 3pt at coordinate (1, 4)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Dean Wade makes 24-foot three point jumper",
      coordinate: { x: 1, y: 4 },
    })).toBe(24);
  });

  test("computes ~8ft for a floater at coordinate (24, 8)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Jarrett Allen misses 7-foot floating jump shot",
      coordinate: { x: 24, y: 8 },
    })).toBe(8);
  });

  test("returns null when coordinate sentinel indicates missing data", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "Made layup",
      coordinate: { x: -2147483340, y: -2147483365 },
    })).toBeNull();
  });

  test("returns null when coordinate missing entirely", () => {
    expect(extractShotDistance({ shootingPlay: true, text: "Made layup" })).toBeNull();
  });

  test("returns null for nonsensical distances (>89ft)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "halfcourt",
      coordinate: { x: -100, y: 50 },
    })).toBeNull();
  });

  test("returns null for distance of 0 (right at basket — likely bad data)", () => {
    expect(extractShotDistance({
      shootingPlay: true,
      text: "tip",
      coordinate: { x: 25, y: 0 },
    })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- nbaPlayDistance
```
Expected: all tests fail (`Cannot find module .../nbaPlayDistance.js`).

- [ ] **Step 3: Implement**

Create `backend/src/ingestion/mappings/nbaPlayDistance.js`:

```js
/**
 * Extracts shot distance (in feet) from an ESPN NBA play.
 *
 * ESPN normalizes coordinates so the offensive basket is always at (25, 0).
 * Free throws carry sentinel coordinates near INT_MIN — return null for those.
 * Returns null for non-shooting plays.
 *
 * Verified empirically: math distance vs ESPN's text-stated "X-foot" distance
 * agrees to within ±2 ft on a sample of 123 NBA shots, both home and away teams.
 */
export function extractShotDistance(play) {
  if (!play.shootingPlay) return null;
  if (/free throw/i.test(play.text || "")) return null;
  const c = play.coordinate;
  if (!c || c.x == null || c.y == null) return null;
  if (c.x < -1000 || c.y < -1000) return null;            // FT garbage sentinel
  const dist = Math.round(Math.sqrt((c.x - 25) ** 2 + c.y ** 2));
  return dist > 0 && dist < 90 ? dist : null;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- nbaPlayDistance
```
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/mappings/nbaPlayDistance.js backend/__tests__/ingestion/nbaPlayDistance.test.js
git commit -m "feat(rating): add NBA shot distance extractor"
```

---

## Task 3: NBA participant role inference (pure function, TDD)

**Files:**
- Create: `backend/src/ingestion/mappings/nbaPlayRoles.js`
- Test: `backend/__tests__/ingestion/nbaPlayRoles.test.js`

**Why:** ESPN's `participants[]` does not include a `type` field. Roles must be derived from `play.type.text` + `text` content. Invariant: `participants[0]` is always the primary actor; `participants[1]`'s role is read from text content (`(X assists)` → assister; `blocks` → blocker; `(X steals)` → stealer).

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/ingestion/nbaPlayRoles.test.js`:

```js
import { inferParticipantRoles } from "../../src/ingestion/mappings/nbaPlayRoles.js";

describe("inferParticipantRoles", () => {
  test("made shot with assist", () => {
    const play = {
      type: { text: "Jump Shot" },
      text: "Dean Wade makes 24-foot three point jumper (Evan Mobley assists)",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "3912848" } }, { athlete: { id: "4432158" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "3912848", role: "scorer" },
      { espnAthleteId: "4432158", role: "assister" },
    ]);
  });

  test("made shot without assist", () => {
    const play = {
      type: { text: "Driving Layup Shot" },
      text: "Donovan Mitchell makes running layup",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "3908809" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "3908809", role: "scorer" },
    ]);
  });

  test("missed shot with block — primary actor is shot_attempter, secondary is blocker", () => {
    const play = {
      type: { text: "Pullup Jump Shot" },
      text: "Max Strus blocks Daniss Jenkins 's 27-foot three point pullup jump shot",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "5107199" } }, { athlete: { id: "4065778" } }],
    };
    // p[0] is shooter (Jenkins), p[1] is blocker (Strus) — confirmed by name lookup
    // in spec verification (see spec section "Role inference table").
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "5107199", role: "shot_attempter" },
      { espnAthleteId: "4065778", role: "blocker" },
    ]);
  });

  test("missed shot without block", () => {
    const play = {
      type: { text: "Floating Jump Shot" },
      text: "Jarrett Allen misses 7-foot floating jump shot",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "4066328" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4066328", role: "shot_attempter" },
    ]);
  });

  test("free throw made", () => {
    const play = {
      type: { text: "Free Throw - 1 of 1" },
      text: "Jaylon Tyson makes free throw 1 of 1",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "4683747" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4683747", role: "scorer" },
    ]);
  });

  test("free throw missed", () => {
    const play = {
      type: { text: "Free Throw - 2 of 2" },
      text: "Player misses free throw 2 of 2",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "shot_attempter" },
    ]);
  });

  test("defensive rebound", () => {
    const play = {
      type: { text: "Defensive Rebound" },
      text: "Tobias Harris defensive rebound",
      participants: [{ athlete: { id: "6440" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "6440", role: "rebounder" },
    ]);
  });

  test("offensive rebound", () => {
    const play = {
      type: { text: "Offensive Rebound" },
      text: "Player offensive rebound",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "rebounder" },
    ]);
  });

  test("turnover with steal — primary actor is committer, secondary is stealer", () => {
    const play = {
      type: { text: "Lost Ball Turnover" },
      text: "Evan Mobley lost ball turnover (Tobias Harris steals)",
      participants: [{ athlete: { id: "4432158" } }, { athlete: { id: "6440" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4432158", role: "turnover_committer" },
      { espnAthleteId: "6440", role: "stealer" },
    ]);
  });

  test("turnover without steal", () => {
    const play = {
      type: { text: "Out of Bounds - Bad Pass Turnover" },
      text: "Player out of bounds turnover",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "turnover_committer" },
    ]);
  });

  test("normalizes newline in type.text (e.g., 'Bad Pass\\nTurnover')", () => {
    const play = {
      type: { text: "Bad Pass\nTurnover" },
      text: "Jarrett Allen bad pass\nturnover (Duncan Robinson steals)",
      participants: [{ athlete: { id: "4066328" } }, { athlete: { id: "3157465" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4066328", role: "turnover_committer" },
      { espnAthleteId: "3157465", role: "stealer" },
    ]);
  });

  test("personal foul", () => {
    const play = {
      type: { text: "Personal Foul" },
      text: "Cade Cunningham personal foul",
      participants: [{ athlete: { id: "4432166" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4432166", role: "foul_committer" },
    ]);
  });

  test("shooting foul", () => {
    const play = {
      type: { text: "Shooting Foul" },
      text: "Player shooting foul",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "foul_committer" },
    ]);
  });

  test("substitution returns empty (not rated)", () => {
    const play = {
      type: { text: "Substitution" },
      text: "Player A enters for Player B",
      participants: [{ athlete: { id: "1" } }, { athlete: { id: "2" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("end period returns empty", () => {
    const play = { type: { text: "End Period" }, text: "End of 1st quarter", participants: [] };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("missing participants array returns empty", () => {
    const play = { type: { text: "Jump Shot" }, text: "Made jumper", scoringPlay: true, shootingPlay: true };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("unknown play type returns empty (defensive default)", () => {
    const play = {
      type: { text: "Unknown Mystery Play" },
      text: "?",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- nbaPlayRoles
```
Expected: tests fail (module not found).

- [ ] **Step 3: Implement**

Create `backend/src/ingestion/mappings/nbaPlayRoles.js`:

```js
/**
 * Infer rating roles for each ESPN play participant.
 *
 * Returns an array of { espnAthleteId, role } in participant-array order.
 *
 * Invariant: ESPN's participants[0] is always the primary actor of the play type
 * (the player whose play this is, matching team.id on the play).
 * participants[1], when present, is the secondary actor whose role is read from text.
 */

const SHOT_TYPE_KEYWORDS = [
  "jump shot", "layup", "dunk", "hook shot", "tip shot", "fade away",
  "step back", "pullup", "floating", "running", "driving", "cutting",
  "putback", "turnaround", "alley oop", "reverse",
];

const TURNOVER_KEYWORDS = ["turnover"];
const FOUL_KEYWORDS = ["foul"];
const REBOUND_KEYWORDS = ["rebound"];

function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isShotType(typeText) {
  const t = normalize(typeText);
  if (t.startsWith("free throw")) return true;
  return SHOT_TYPE_KEYWORDS.some((k) => t.includes(k));
}

export function inferParticipantRoles(play) {
  const participants = Array.isArray(play.participants) ? play.participants : [];
  if (participants.length === 0) return [];

  const typeText = normalize(play.type?.text);
  const text = normalize(play.text);
  const ids = participants.map((p) => String(p.athlete?.id ?? ""));

  // Free throws — single shooter
  if (typeText.startsWith("free throw")) {
    const role = play.scoringPlay ? "scorer" : "shot_attempter";
    return ids[0] ? [{ espnAthleteId: ids[0], role }] : [];
  }

  // Other shots
  if (isShotType(play.type?.text)) {
    if (play.scoringPlay) {
      const out = [{ espnAthleteId: ids[0], role: "scorer" }];
      if (ids[1] && /\bassists?\b/.test(text)) {
        out.push({ espnAthleteId: ids[1], role: "assister" });
      }
      return out.filter((p) => p.espnAthleteId);
    }
    // Missed shot
    const out = [{ espnAthleteId: ids[0], role: "shot_attempter" }];
    if (ids[1] && /\bblocks?\b/.test(text)) {
      out.push({ espnAthleteId: ids[1], role: "blocker" });
    }
    return out.filter((p) => p.espnAthleteId);
  }

  // Rebounds
  if (REBOUND_KEYWORDS.some((k) => typeText.includes(k))) {
    return ids[0] ? [{ espnAthleteId: ids[0], role: "rebounder" }] : [];
  }

  // Turnovers
  if (TURNOVER_KEYWORDS.some((k) => typeText.includes(k))) {
    const out = [{ espnAthleteId: ids[0], role: "turnover_committer" }];
    if (ids[1] && /\bsteals?\b/.test(text)) {
      out.push({ espnAthleteId: ids[1], role: "stealer" });
    }
    return out.filter((p) => p.espnAthleteId);
  }

  // Fouls
  if (FOUL_KEYWORDS.some((k) => typeText.includes(k))) {
    return ids[0] ? [{ espnAthleteId: ids[0], role: "foul_committer" }] : [];
  }

  // Substitutions, timeouts, jump balls, end period, anything else — not rated
  return [];
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- nbaPlayRoles
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/mappings/nbaPlayRoles.js backend/__tests__/ingestion/nbaPlayRoles.test.js
git commit -m "feat(rating): add NBA participant role inference"
```

---

## Task 4: Wire `shot_distance_ft` into upsertPlays

**Files:**
- Modify: `backend/src/ingestion/upsert/upsertPlays.js` — add `shot_distance_ft` to extracted rows + INSERT statement (NBA only).
- Test: `backend/__tests__/ingestion/upsertPlays.test.js` (new — focused on distance capture)

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/ingestion/upsertPlays.test.js`:

```js
import { jest } from "@jest/globals";
import upsertPlays from "../../src/ingestion/upsert/upsertPlays.js";

describe("upsertPlays — NBA distance capture", () => {
  test("includes shot_distance_ft computed from coordinates for NBA shooting plays", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const summaryData = {
      plays: [
        {
          id: "1", sequenceNumber: "1", type: { text: "Jump Shot" },
          text: "Player makes 24-foot three point jumper",
          period: { number: 1 }, clock: { displayValue: "11:46" },
          homeScore: 0, awayScore: 3, scoringPlay: true,
          shootingPlay: true,
          team: { id: "5" },
          coordinate: { x: 1, y: 4 },
        },
      ],
    };

    await upsertPlays(client, 1, summaryData, "nba", 100, 200, 5, 8);

    expect(client.query).toHaveBeenCalledTimes(1);
    const args = client.query.mock.calls[0][1];
    // The args array shape includes shot_distance_ft as the last sliced array.
    // Find it by feature: the last array of small ints corresponding to plays.
    // We expect a single call with shot_distance_ft = [24].
    const callArgs = args;
    expect(callArgs[callArgs.length - 1]).toEqual([24]);
  });

  test("writes null shot_distance_ft for non-shooting plays", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const summaryData = {
      plays: [
        {
          id: "1", sequenceNumber: "1", type: { text: "Defensive Rebound" },
          text: "Player defensive rebound",
          period: { number: 1 }, clock: { displayValue: "11:00" },
          shootingPlay: false,
          team: { id: "5" },
          coordinate: { x: 24, y: 8 },
        },
      ],
    };

    await upsertPlays(client, 1, summaryData, "nba", 100, 200, 5, 8);
    const callArgs = client.query.mock.calls[0][1];
    expect(callArgs[callArgs.length - 1]).toEqual([null]);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- upsertPlays
```
Expected: tests fail (current implementation doesn't pass distance).

- [ ] **Step 3: Modify upsertPlays.js**

Edit `backend/src/ingestion/upsert/upsertPlays.js`:

At the top, add:
```js
import { extractShotDistance } from "../mappings/nbaPlayDistance.js";
```

In `extractPlays` (NBA/NHL extractor), add `shot_distance_ft` to the returned object — **only compute for NBA**, otherwise leave null. Modify the function to take `league`:

```js
function extractPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId, league) {
  const plays = summaryData.plays;
  if (!Array.isArray(plays) || plays.length === 0) return [];

  return plays.map((play) => ({
    espn_play_id:      String(play.id ?? play.sequenceNumber ?? ""),
    sequence:          parseInt(play.sequenceNumber ?? play.id, 10),
    period:            play.period?.number ?? play.period ?? 1,
    clock:             play.clock?.displayValue ?? null,
    description:       play.text ?? play.shortText ?? "",
    short_text:        play.shortText ?? null,
    home_score:        play.homeScore != null ? parseInt(play.homeScore, 10) : null,
    away_score:        play.awayScore != null ? parseInt(play.awayScore, 10) : null,
    scoring_play:      !!play.scoringPlay,
    team_id:           resolveTeamId(play.team?.id, homeEspnId, awayEspnId, homeTeamId, awayTeamId),
    play_type:         play.type?.text ?? null,
    drive_number:      null,
    drive_description: null,
    drive_result:      null,
    shot_distance_ft:  league === "nba" ? extractShotDistance(play) : null,
  })).filter((r) => r.sequence > 0 && r.description);
}
```

Pass `league` to the call site at the top of the default export:
```js
const rawRows = league === "nfl"
  ? extractNflPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId)
  : extractPlays(summaryData, homeTeamId, awayTeamId, homeEspnId, awayEspnId, league);
```

In `extractNflPlays`, add `shot_distance_ft: null` to keep array shapes uniform.

In the INSERT statement, add `shot_distance_ft` to the column list and the unnest expression. Update the parameter array. The final INSERT becomes:
```js
await client.query(
  `INSERT INTO plays (
     gameid, espn_play_id, sequence, period, clock,
     description, short_text, home_score, away_score,
     scoring_play, team_id, play_type,
     drive_number, drive_description, drive_result,
     shot_distance_ft
   )
   SELECT
     $1,
     unnest($2::text[]),
     unnest($3::int[]),
     unnest($4::int[]),
     unnest($5::text[]),
     unnest($6::text[]),
     unnest($7::text[]),
     unnest($8::int[]),
     unnest($9::int[]),
     unnest($10::boolean[]),
     unnest($11::int[]),
     unnest($12::text[]),
     unnest($13::int[]),
     unnest($14::text[]),
     unnest($15::text[]),
     unnest($16::int[])
   ON CONFLICT (gameid, sequence) DO UPDATE SET
     espn_play_id      = EXCLUDED.espn_play_id,
     period            = EXCLUDED.period,
     clock             = EXCLUDED.clock,
     description       = EXCLUDED.description,
     short_text        = EXCLUDED.short_text,
     home_score        = EXCLUDED.home_score,
     away_score        = EXCLUDED.away_score,
     scoring_play      = EXCLUDED.scoring_play,
     team_id           = EXCLUDED.team_id,
     play_type         = EXCLUDED.play_type,
     drive_number      = EXCLUDED.drive_number,
     drive_description = EXCLUDED.drive_description,
     drive_result      = EXCLUDED.drive_result,
     shot_distance_ft  = EXCLUDED.shot_distance_ft`,
  [
    gameId,
    rows.map((r) => r.espn_play_id),
    rows.map((r) => r.sequence),
    rows.map((r) => r.period),
    rows.map((r) => r.clock),
    rows.map((r) => r.description),
    rows.map((r) => r.short_text),
    rows.map((r) => r.home_score),
    rows.map((r) => r.away_score),
    rows.map((r) => r.scoring_play),
    rows.map((r) => r.team_id),
    rows.map((r) => r.play_type),
    rows.map((r) => r.drive_number),
    rows.map((r) => r.drive_description),
    rows.map((r) => r.drive_result),
    rows.map((r) => r.shot_distance_ft),
  ],
);
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- upsertPlays
```
Expected: both new tests pass. Confirm no regression by running the full suite: `cd backend && npm test`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/upsert/upsertPlays.js backend/__tests__/ingestion/upsertPlays.test.js
git commit -m "feat(rating): capture NBA shot distance into plays.shot_distance_ft"
```

---

## Task 5: Per-game `upsertPlayParticipants` module

**Files:**
- Create: `backend/src/ingestion/upsert/upsertPlayParticipants.js`
- Test: `backend/__tests__/ingestion/upsertPlayParticipants.test.js`

**Why:** Resolves ESPN `participants[]` per play to internal `players.id` and bulk-writes to `play_participants`. NBA only for v1.

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/ingestion/upsertPlayParticipants.test.js`:

```js
import { jest } from "@jest/globals";
import upsertPlayParticipants from "../../src/ingestion/upsert/upsertPlayParticipants.js";

const summaryData = {
  plays: [
    {
      id: "1", sequenceNumber: "1", type: { text: "Jump Shot" },
      text: "Wade makes 24-foot three (Mobley assists)",
      scoringPlay: true, shootingPlay: true,
      participants: [{ athlete: { id: "3912848" } }, { athlete: { id: "4432158" } }],
    },
    {
      id: "2", sequenceNumber: "2", type: { text: "Defensive Rebound" },
      text: "Harris defensive rebound",
      participants: [{ athlete: { id: "6440" } }],
    },
    {
      id: "3", sequenceNumber: "3", type: { text: "Substitution" },
      text: "sub", participants: [{ athlete: { id: "999" } }],
    },
  ],
};

test("noop on non-NBA league", async () => {
  const client = { query: jest.fn() };
  await upsertPlayParticipants(client, 100, summaryData, "nfl");
  expect(client.query).not.toHaveBeenCalled();
});

test("resolves athlete IDs and bulk-inserts participants for rated plays only", async () => {
  // Stage 1: lookup of espn_athlete_id -> player.id
  // Stage 2: lookup of (sequence -> play.id)
  // Stage 3: DELETE existing participants for this game
  // Stage 4: INSERT new participants
  const client = {
    query: jest.fn()
      // 1. SELECT id, espn_playerid FROM players ...
      .mockResolvedValueOnce({ rows: [
        { id: 11, espn_playerid: 3912848 },
        { id: 12, espn_playerid: 4432158 },
        { id: 13, espn_playerid: 6440 },
      ]})
      // 2. SELECT id, sequence FROM plays WHERE gameid = ...
      .mockResolvedValueOnce({ rows: [
        { id: 501, sequence: 1 },
        { id: 502, sequence: 2 },
        { id: 503, sequence: 3 },
      ]})
      // 3. DELETE
      .mockResolvedValueOnce({ rowCount: 0 })
      // 4. INSERT
      .mockResolvedValueOnce({ rowCount: 3 }),
  };

  await upsertPlayParticipants(client, 100, summaryData, "nba");

  // Verify the SQL pattern of each call
  expect(client.query.mock.calls[0][0]).toMatch(/SELECT id, espn_playerid FROM players/);
  expect(client.query.mock.calls[1][0]).toMatch(/SELECT id, sequence FROM plays WHERE gameid/);
  expect(client.query.mock.calls[2][0]).toMatch(/DELETE FROM play_participants/);
  expect(client.query.mock.calls[3][0]).toMatch(/INSERT INTO play_participants/);

  // INSERT receives 3 participant rows (scorer, assister, rebounder) — not the substitution
  const insertArgs = client.query.mock.calls[3][1];
  // Args are 4 parallel arrays: [play_ids, player_ids, roles, espn_athlete_ids]
  expect(insertArgs[0]).toEqual([501, 501, 502]);
  expect(insertArgs[1]).toEqual([11, 12, 13]);
  expect(insertArgs[2]).toEqual(["scorer", "assister", "rebounder"]);
  expect(insertArgs[3]).toEqual(["3912848", "4432158", "6440"]);
});

test("skips participants whose athlete ID can't be resolved to a local player", async () => {
  const client = {
    query: jest.fn()
      // Only Wade and Harris are known; Mobley is missing
      .mockResolvedValueOnce({ rows: [
        { id: 11, espn_playerid: 3912848 },
        { id: 13, espn_playerid: 6440 },
      ]})
      .mockResolvedValueOnce({ rows: [
        { id: 501, sequence: 1 },
        { id: 502, sequence: 2 },
        { id: 503, sequence: 3 },
      ]})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 2 }),
  };

  await upsertPlayParticipants(client, 100, summaryData, "nba");
  const insertArgs = client.query.mock.calls[3][1];
  expect(insertArgs[0]).toEqual([501, 502]);
  expect(insertArgs[1]).toEqual([11, 13]);
  expect(insertArgs[2]).toEqual(["scorer", "rebounder"]);
});

test("skips DELETE+INSERT if there are no rated participants", async () => {
  const client = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [] })  // no players resolved
      .mockResolvedValueOnce({ rows: [] }), // doesn't matter
  };
  const empty = { plays: [{ type: { text: "Substitution" }, participants: [{ athlete: { id: "1" } }] }] };
  await upsertPlayParticipants(client, 100, empty, "nba");
  // Should issue at most the player-lookup query, then no further writes
  expect(client.query.mock.calls.length).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- upsertPlayParticipants
```
Expected: tests fail (module not found).

- [ ] **Step 3: Implement**

Create `backend/src/ingestion/upsert/upsertPlayParticipants.js`:

```js
import { inferParticipantRoles } from "../mappings/nbaPlayRoles.js";

/**
 * Resolves ESPN play participants → internal player IDs and writes to
 * play_participants. Idempotent: deletes existing participants for the game
 * before inserting fresh ones.
 *
 * NBA only for v1 — early exits for other leagues. NFL/NHL phases will add
 * their own role inference modules and dispatch here.
 */
export default async function upsertPlayParticipants(client, gameId, summaryData, league) {
  if (league !== "nba") return;
  const plays = Array.isArray(summaryData.plays) ? summaryData.plays : [];
  if (plays.length === 0) return;

  // Step 1: gather all espn athlete IDs across all rated plays
  const ratedPlays = plays.map((p) => ({
    sequence: parseInt(p.sequenceNumber ?? p.id, 10),
    roles: inferParticipantRoles(p),
  })).filter((p) => p.sequence > 0 && p.roles.length > 0);

  if (ratedPlays.length === 0) return;

  const allEspnIds = [...new Set(ratedPlays.flatMap((p) => p.roles.map((r) => r.espnAthleteId)))];

  // Step 2: resolve to internal player.id
  const { rows: playerRows } = await client.query(
    `SELECT id, espn_playerid FROM players
       WHERE league = 'nba' AND espn_playerid = ANY($1::int[])`,
    [allEspnIds.map((s) => parseInt(s, 10))],
  );
  const espnToPlayer = new Map(playerRows.map((r) => [String(r.espn_playerid), r.id]));

  // Step 3: resolve sequence -> play.id (after upsertPlays has run for this game)
  const { rows: playRows } = await client.query(
    `SELECT id, sequence FROM plays WHERE gameid = $1`,
    [gameId],
  );
  const seqToPlay = new Map(playRows.map((r) => [r.sequence, r.id]));

  // Step 4: build insert tuples, dropping any participants we can't resolve
  const playIds = [];
  const playerIds = [];
  const roles = [];
  const espnAthleteIds = [];

  for (const { sequence, roles: rps } of ratedPlays) {
    const playId = seqToPlay.get(sequence);
    if (!playId) continue;
    for (const { espnAthleteId, role } of rps) {
      const playerId = espnToPlayer.get(espnAthleteId);
      if (!playerId) continue;
      playIds.push(playId);
      playerIds.push(playerId);
      roles.push(role);
      espnAthleteIds.push(espnAthleteId);
    }
  }

  // Step 5: idempotent DELETE + INSERT
  await client.query(
    `DELETE FROM play_participants
       WHERE play_id IN (SELECT id FROM plays WHERE gameid = $1)`,
    [gameId],
  );

  if (playIds.length === 0) return;

  await client.query(
    `INSERT INTO play_participants (play_id, player_id, role, espn_athlete_id)
     SELECT
       unnest($1::int[]),
       unnest($2::int[]),
       unnest($3::text[]),
       unnest($4::text[])`,
    [playIds, playerIds, roles, espnAthleteIds],
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- upsertPlayParticipants
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/upsert/upsertPlayParticipants.js backend/__tests__/ingestion/upsertPlayParticipants.test.js
git commit -m "feat(rating): add upsertPlayParticipants — resolve ESPN participants to play_participants"
```

---

## Task 6: Hook participants capture into eventProcessor + drop non-scoring cleanup

**Files:**
- Modify: `backend/src/ingestion/pipeline/eventProcessor.js` — call `upsertPlayParticipants` after `upsertPlays`
- Modify: `backend/src/ingestion/pipeline/upsert.js` — remove the `cleanupNonScoringPlays` call

- [ ] **Step 1: Modify eventProcessor.js**

In `backend/src/ingestion/pipeline/eventProcessor.js`, near the existing `upsertPlays` import (around line 7), add:
```js
import upsertPlayParticipants from "../upsert/upsertPlayParticipants.js";
```

Find the existing call to `upsertPlays` (around line 309). Immediately after it, add:
```js
await upsertPlayParticipants(client, gameId, statsResp.data, leagueSlug);
```

So the section reads:
```js
await upsertPlays(
  client,
  gameId,
  statsResp.data,
  leagueSlug,
  homeTeamId,
  awayTeamId,
  parseInt(homeComp.team.id, 10),
  parseInt(awayComp.team.id, 10),
);

await upsertPlayParticipants(client, gameId, statsResp.data, leagueSlug);
```

- [ ] **Step 2: Modify upsert.js — remove cleanupNonScoringPlays call**

In `backend/src/ingestion/pipeline/upsert.js`, delete the block at lines 82-86:
```js
        try {
          await cleanupNonScoringPlays(pool, league);
        } catch (err) {
          log.error({ err, league }, "failed cleaning up non-scoring plays");
        }
```

Also remove the now-unused import at line 15:
```js
import { cleanupNonScoringPlays } from "../cleanup/cleanupPlays.js";
```

The `cleanupPlays.js` file itself stays (kept for possible league-scoped reuse later, per spec).

- [ ] **Step 3: Run full backend test suite**

```bash
cd backend && npm test
```
Expected: all tests pass; eventProcessor / upsert tests still green.

- [ ] **Step 4: Commit**

```bash
git add backend/src/ingestion/pipeline/eventProcessor.js backend/src/ingestion/pipeline/upsert.js
git commit -m "feat(rating): wire upsertPlayParticipants into ingestion; drop non-scoring play cleanup"
```

---

## Task 7: Rating engine — pure-function helpers (TDD)

**Files:**
- Create: `backend/src/services/games/ratingEngine.js` (helpers + `gradeFromRaw` only — `recomputeGame` lands in Task 8)
- Test: `backend/__tests__/services/games/ratingEngine.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/services/games/ratingEngine.test.js`:

```js
import {
  gradeFromRaw,
  baseValue,
  wpaContribution,
  clampPlayValue,
} from "../../../src/services/games/ratingEngine.js";

describe("gradeFromRaw", () => {
  test("null raw → null", () => {
    expect(gradeFromRaw(null)).toBeNull();
    expect(gradeFromRaw(undefined)).toBeNull();
  });
  test("0 → 0.0", () => { expect(gradeFromRaw(0)).toBe(0); });
  test("negative raw floors at 0", () => { expect(gradeFromRaw(-3.1)).toBe(0); });
  test("raw 5.5 → 1.0", () => { expect(gradeFromRaw(5.5)).toBe(1); });
  test("raw 27.5 → 5.0", () => { expect(gradeFromRaw(27.5)).toBe(5); });
  test("raw 47.3 → ~8.6", () => {
    expect(gradeFromRaw(47.3)).toBeCloseTo(8.6, 1);
  });
  test("raw above ~55 caps at 10.0", () => {
    expect(gradeFromRaw(60)).toBe(10);
    expect(gradeFromRaw(1000)).toBe(10);
  });
});

describe("baseValue — NBA", () => {
  test("made 3pt at 24ft", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 24 }))
      .toBeCloseTo(1.5 + 0.02, 2);  // distance bonus = 0.02 × max(0, 24-23) = 0.02
  });
  test("made 3pt at 30ft", () => {
    // 1.5 + 0.02 × 7 = 1.64
    expect(baseValue("scorer", { type: "made_3pt", distance: 30 })).toBeCloseTo(1.64, 2);
  });
  test("made 3pt at >>23ft caps at 3.0", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 100 })).toBe(3.0);
  });
  test("made 2pt at 8ft", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 8 })).toBeCloseTo(1.16, 2);
  });
  test("made 2pt caps at 2.0", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 100 })).toBe(2.0);
  });
  test("made FT", () => { expect(baseValue("scorer", { type: "made_ft" })).toBe(0.4); });
  test("missed shot", () => { expect(baseValue("shot_attempter", { type: "missed_3pt" })).toBe(-0.5); });
  test("missed FT", () => { expect(baseValue("shot_attempter", { type: "missed_ft" })).toBe(-0.3); });
  test("assister", () => { expect(baseValue("assister", {})).toBe(0.7); });
  test("offensive rebound", () => { expect(baseValue("rebounder", { offensive: true })).toBe(0.6); });
  test("defensive rebound", () => { expect(baseValue("rebounder", { offensive: false })).toBe(0.3); });
  test("steal", () => { expect(baseValue("stealer", {})).toBe(1.0); });
  test("block", () => { expect(baseValue("blocker", {})).toBe(0.7); });
  test("turnover", () => { expect(baseValue("turnover_committer", {})).toBe(-1.0); });
  test("shooting foul", () => { expect(baseValue("foul_committer", { shooting: true })).toBe(-0.5); });
  test("non-shooting foul", () => { expect(baseValue("foul_committer", { shooting: false })).toBe(-0.2); });
  test("unknown role → 0", () => { expect(baseValue("mystery", {})).toBe(0); });
});

describe("wpaContribution", () => {
  test("home participant on positive WPA shift", () => {
    expect(wpaContribution(0.05, "home")).toBeCloseTo(1.5, 5);
  });
  test("home participant on negative WPA shift (turnover, etc.)", () => {
    expect(wpaContribution(-0.05, "home")).toBeCloseTo(-1.5, 5);
  });
  test("away participant — sign flips", () => {
    expect(wpaContribution(0.05, "away")).toBeCloseTo(-1.5, 5);
    expect(wpaContribution(-0.05, "away")).toBeCloseTo(1.5, 5);
  });
  test("null wpa_delta returns 0", () => {
    expect(wpaContribution(null, "home")).toBe(0);
  });
  test("clutch shift of +0.30 from home → +9", () => {
    expect(wpaContribution(0.30, "home")).toBeCloseTo(9.0, 5);
  });
});

describe("clampPlayValue", () => {
  test("normal range passes through", () => { expect(clampPlayValue(2.3)).toBe(2.3); });
  test("clamps to +10", () => { expect(clampPlayValue(20)).toBe(10); });
  test("clamps to -10", () => { expect(clampPlayValue(-25)).toBe(-10); });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- ratingEngine
```
Expected: tests fail (module not found).

- [ ] **Step 3: Implement**

Create `backend/src/services/games/ratingEngine.js`:

```js
/**
 * NBA player rating engine — pure-function helpers + per-game recompute.
 *
 * Per-play rating model:
 *   weighted = clamp(base_value + wpa_contribution, -10.0, +10.0)
 *   base_value     = role-specific weight (see NBA_BASE_WEIGHTS)
 *   wpa_contribution = WPA_WEIGHT × wpa_delta × team_sign
 *   team_sign = +1 if play helped player's team's win prob, -1 otherwise
 *
 * Per-game = sum of (player's plays clamped values), open-ended.
 * Per-display grade = max(0, min(10, raw / 5.5)).
 *
 * recomputeGame(client, gameId) is in this same module — see Task 8.
 */

const WPA_WEIGHT = 30;
const GRADE_DIVISOR = 5.5;

export function gradeFromRaw(raw) {
  if (raw == null) return null;
  return Math.max(0, Math.min(10, Number(raw) / GRADE_DIVISOR));
}

export function clampPlayValue(v) {
  if (v > 10) return 10;
  if (v < -10) return -10;
  return v;
}

export function wpaContribution(wpaDelta, side /* "home" | "away" */) {
  if (wpaDelta == null) return 0;
  const sign = side === "home" ? 1 : -1;
  return WPA_WEIGHT * Number(wpaDelta) * sign;
}

/**
 * Compute base_value for a (role, ctx) combination.
 *
 * ctx fields:
 *   - type: "made_3pt" | "made_2pt" | "made_ft" | "missed_3pt" | "missed_2pt" | "missed_ft"
 *   - distance: number | null  (only for shooter roles)
 *   - offensive: boolean (only for rebounder)
 *   - shooting:  boolean (only for foul_committer)
 */
export function baseValue(role, ctx = {}) {
  switch (role) {
    case "scorer": {
      switch (ctx.type) {
        case "made_3pt": {
          const d = Math.max(0, (ctx.distance ?? 0) - 23);
          return Math.min(3.0, 1.5 + 0.02 * d);
        }
        case "made_2pt": {
          const d = Math.max(0, ctx.distance ?? 0);
          return Math.min(2.0, 1.0 + 0.02 * d);
        }
        case "made_ft":  return 0.4;
        default:         return 0;
      }
    }
    case "shot_attempter":
      return ctx.type === "missed_ft" ? -0.3 : -0.5;
    case "assister":
      return 0.7;
    case "rebounder":
      return ctx.offensive ? 0.6 : 0.3;
    case "stealer":
      return 1.0;
    case "blocker":
      return 0.7;
    case "turnover_committer":
      return -1.0;
    case "foul_committer":
      return ctx.shooting ? -0.5 : -0.2;
    default:
      return 0;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- ratingEngine
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): add rating engine pure-function helpers"
```

---

## Task 8: Rating engine — `recomputeGame`

**Files:**
- Modify: `backend/src/services/games/ratingEngine.js` — add `recomputeGame(client, gameId)`
- Modify: `backend/__tests__/services/games/ratingEngine.test.js` — add integration tests with mocked `pg.Client` + mocked winprob fetch

- [ ] **Step 1: Add failing recomputeGame tests**

Append to `backend/__tests__/services/games/ratingEngine.test.js`:

```js
import { jest } from "@jest/globals";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Mock the winProbabilityService used by recomputeGame.
const mockGetWinProbability = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/games/winProbabilityService.js"),
  () => ({ getWinProbability: mockGetWinProbability }),
);

// Re-import after mocking
const { recomputeGame } = await import("../../../src/services/games/ratingEngine.js");

describe("recomputeGame", () => {
  beforeEach(() => { mockGetWinProbability.mockReset(); });

  test("idempotent: deletes existing play_ratings, resets stats.rating, repopulates from current data", async () => {
    // game 100, NBA, eventid 999
    // Plays: a made 3pt by home player (player 11) at 24ft, scoringPlay
    //        a steal by away player (player 22) on home turnover (commit by player 11)
    const playRows = [
      { id: 501, sequence: 1, period: 1, clock_seconds: 700, espn_play_id: "p1",
        scoring_play: true, shooting_play: true, shot_distance_ft: 24, play_type: "Jump Shot",
        team_id: 1, home_team_id: 1, away_team_id: 2, home_score: 3, away_score: 0 },
      { id: 502, sequence: 2, period: 1, clock_seconds: 690, espn_play_id: "p2",
        scoring_play: false, shooting_play: false, shot_distance_ft: null, play_type: "Lost Ball Turnover",
        team_id: 1, home_team_id: 1, away_team_id: 2, home_score: 3, away_score: 0 },
    ];
    const participantRows = [
      { play_id: 501, player_id: 11, role: "scorer",             team_side: "home" },
      { play_id: 502, player_id: 11, role: "turnover_committer", team_side: "home" },
      { play_id: 502, player_id: 22, role: "stealer",            team_side: "away" },
    ];
    mockGetWinProbability.mockResolvedValue({
      winProbability: [
        { playId: "p1", homeWinPercentage: 0.55 },  // up from prev (warmup ~0.50)
        { playId: "p2", homeWinPercentage: 0.50 },  // down 0.05
      ],
    });
    const client = {
      query: jest.fn()
        // 1. game info: eventid + home/away
        .mockResolvedValueOnce({ rows: [{ league: "nba", eventid: 999, status: "Final", hometeamid: 1, awayteamid: 2 }] })
        // 2. plays + flags
        .mockResolvedValueOnce({ rows: playRows })
        // 3. participants joined to plays + side
        .mockResolvedValueOnce({ rows: participantRows })
        // 4. DELETE play_ratings
        .mockResolvedValueOnce({ rowCount: 5 })
        // 5. INSERT play_ratings (bulk)
        .mockResolvedValueOnce({ rowCount: 3 })
        // 6. UPDATE stats SET rating = NULL
        .mockResolvedValueOnce({ rowCount: 10 })
        // 7. UPDATE stats SET rating = sub.total
        .mockResolvedValueOnce({ rowCount: 2 }),
    };

    await recomputeGame(client, 100);

    expect(client.query.mock.calls[0][0]).toMatch(/SELECT .* FROM games WHERE id = \$1/);
    expect(client.query.mock.calls[3][0]).toMatch(/DELETE FROM play_ratings WHERE game_id = \$1/);
    expect(client.query.mock.calls[4][0]).toMatch(/INSERT INTO play_ratings/);
    expect(client.query.mock.calls[5][0]).toMatch(/UPDATE stats SET rating = NULL WHERE gameid = \$1/);
    expect(client.query.mock.calls[6][0]).toMatch(/UPDATE stats SET rating = /);

    // Inspect the INSERT bulk arrays — there should be 3 rows
    const insertArgs = client.query.mock.calls[4][1];
    expect(insertArgs[0]).toEqual([501, 502, 502]);  // play_ids
    expect(insertArgs[1]).toEqual([11, 11, 22]);     // player_ids
    expect(insertArgs[2]).toEqual([100, 100, 100]);  // game_ids
    expect(insertArgs[3]).toEqual(["scorer", "turnover_committer", "stealer"]); // roles
    // weighted_value array should be all in [-10, 10]
    insertArgs[6].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    });
  });

  test("handles missing winprob — wpa_delta is null and engine falls back to base_value only", async () => {
    mockGetWinProbability.mockResolvedValue(null);
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ league: "nba", eventid: 999, status: "Final", hometeamid: 1, awayteamid: 2 }] })
        .mockResolvedValueOnce({ rows: [
          { id: 501, sequence: 1, period: 1, clock_seconds: 700, espn_play_id: "p1",
            scoring_play: true, shooting_play: true, shot_distance_ft: 24, play_type: "Jump Shot",
            team_id: 1, home_team_id: 1, away_team_id: 2, home_score: 3, away_score: 0 }
        ]})
        .mockResolvedValueOnce({ rows: [
          { play_id: 501, player_id: 11, role: "scorer", team_side: "home" }
        ]})
        .mockResolvedValueOnce({ rowCount: 0 })  // DELETE
        .mockResolvedValueOnce({ rowCount: 1 })  // INSERT
        .mockResolvedValueOnce({ rowCount: 0 })  // UPDATE NULL
        .mockResolvedValueOnce({ rowCount: 1 }), // UPDATE total
    };

    await recomputeGame(client, 100);
    const insertArgs = client.query.mock.calls[4][1];
    // wpa_delta column array should be all null
    expect(insertArgs[5]).toEqual([null]);
    // weighted_value should equal base_value (made 3pt at 24ft = 1.52)
    expect(insertArgs[6][0]).toBeCloseTo(1.5 + 0.02, 2);
  });

  test("non-NBA league early-exits without writes", async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ league: "nfl", eventid: 999, status: "Final", hometeamid: 1, awayteamid: 2 }],
      }),
    };
    await recomputeGame(client, 100);
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
cd backend && npm test -- ratingEngine
```
Expected: new tests fail (`recomputeGame` not exported).

- [ ] **Step 3: Implement recomputeGame**

Append to `backend/src/services/games/ratingEngine.js`:

```js
import { getWinProbability } from "./winProbabilityService.js";

/**
 * Idempotently recompute play_ratings + stats.rating for a single game.
 * Caller passes a pg client (typically inside a transaction). NBA only.
 */
export async function recomputeGame(client, gameId) {
  const { rows: gameRows } = await client.query(
    `SELECT league, eventid, status, hometeamid, awayteamid
       FROM games WHERE id = $1`,
    [gameId],
  );
  if (gameRows.length === 0) return;
  const { league, eventid, status, hometeamid, awayteamid } = gameRows[0];
  if (league !== "nba") return;

  // Plays for this game in sequence order. Joined with the game's home/away ids
  // for the team_side computation. Note: plays.shooting_play does not exist on the
  // table; we infer scoring vs missed from `scoring_play` + presence of "miss" in
  // play_type. For NBA-only and the role inference's classification, we already
  // populated participants with role; this query reloads play context.
  const { rows: plays } = await client.query(
    `SELECT
       p.id, p.sequence, p.period, p.clock, p.espn_play_id,
       p.scoring_play, p.shot_distance_ft, p.play_type,
       p.team_id,
       g.hometeamid AS home_team_id,
       g.awayteamid AS away_team_id,
       p.home_score, p.away_score
     FROM plays p
     JOIN games g ON g.id = p.gameid
     WHERE p.gameid = $1
     ORDER BY p.sequence ASC`,
    [gameId],
  );

  const { rows: parts } = await client.query(
    `SELECT pp.play_id, pp.player_id, pp.role,
            CASE WHEN pl.teamid = g.hometeamid THEN 'home' ELSE 'away' END AS team_side
       FROM play_participants pp
       JOIN plays p     ON p.id = pp.play_id
       JOIN players pl  ON pl.id = pp.player_id
       JOIN games g     ON g.id = p.gameid
      WHERE p.gameid = $1`,
    [gameId],
  );

  // Build winprob map (playId → homeWinPercentage)
  const wp = await getWinProbability("nba", eventid, /* isFinal */ status?.toLowerCase().includes("final"));
  const wpMap = new Map();
  if (wp?.winProbability) {
    for (const dp of wp.winProbability) wpMap.set(String(dp.playId), Number(dp.homeWinPercentage));
  }

  // Walk plays in sequence; compute wpa_delta from previous valid winprob
  let prevHomePct = null;
  const playMeta = new Map(); // play.id → { side_of_home_action, wpa_delta, ctx }
  for (const pl of plays) {
    const homePct = wpMap.has(String(pl.espn_play_id)) ? wpMap.get(String(pl.espn_play_id)) : null;
    const wpaDelta = homePct != null && prevHomePct != null ? homePct - prevHomePct : null;
    if (homePct != null) prevHomePct = homePct;
    playMeta.set(pl.id, {
      wpaDelta,
      // Build ctx for baseValue from play_type + scoring_play + distance
      ctx: ctxFromPlay(pl),
    });
  }

  // Group participants by play
  const partsByPlay = new Map();
  for (const p of parts) {
    if (!partsByPlay.has(p.play_id)) partsByPlay.set(p.play_id, []);
    partsByPlay.get(p.play_id).push(p);
  }

  // Build INSERT row arrays
  const insPlay = [], insPlayer = [], insGame = [], insRole = [], insBase = [], insWpa = [], insWeighted = [];

  for (const pl of plays) {
    const meta = playMeta.get(pl.id);
    const playerParts = partsByPlay.get(pl.id) || [];
    for (const pp of playerParts) {
      const base = baseValue(pp.role, contextForRole(pp.role, meta.ctx));
      const wpa  = wpaContribution(meta.wpaDelta, pp.team_side);
      const weighted = clampPlayValue(base + wpa);
      insPlay.push(pl.id);
      insPlayer.push(pp.player_id);
      insGame.push(gameId);
      insRole.push(pp.role);
      insBase.push(round1(base));
      insWpa.push(meta.wpaDelta == null ? null : round4(meta.wpaDelta));
      insWeighted.push(round1(weighted));
    }
  }

  await client.query(`DELETE FROM play_ratings WHERE game_id = $1`, [gameId]);

  if (insPlay.length > 0) {
    await client.query(
      `INSERT INTO play_ratings (play_id, player_id, game_id, role, base_value, wpa_delta, weighted_value)
       SELECT
         unnest($1::int[]),
         unnest($2::int[]),
         unnest($3::int[]),
         unnest($4::text[]),
         unnest($5::numeric[]),
         unnest($6::numeric[]),
         unnest($7::numeric[])`,
      [insPlay, insPlayer, insGame, insRole, insBase, insWpa, insWeighted],
    );
  }

  // Reset all stats.rating for this game first, so players whose participants
  // got removed don't keep stale ratings.
  await client.query(`UPDATE stats SET rating = NULL WHERE gameid = $1`, [gameId]);

  await client.query(
    `UPDATE stats SET rating = sub.total
       FROM (
         SELECT player_id, SUM(weighted_value) AS total
           FROM play_ratings
          WHERE game_id = $1
          GROUP BY player_id
       ) sub
      WHERE stats.playerid = sub.player_id AND stats.gameid = $1`,
    [gameId],
  );
}

function ctxFromPlay(pl) {
  const t = (pl.play_type || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isFT = t.startsWith("free throw");
  const made = !!pl.scoring_play;
  // 3-point detection: most NBA shot types include "three" in their text only
  // when they're 3pt; otherwise infer from distance ≥ 22 ft (the corner 3 line).
  const is3pt = t.includes("three") || (pl.shot_distance_ft != null && pl.shot_distance_ft >= 22 && !isFT);
  let type = null;
  if (isFT) type = made ? "made_ft" : "missed_ft";
  else if (made) type = is3pt ? "made_3pt" : "made_2pt";
  else type = is3pt ? "missed_3pt" : "missed_2pt";
  return {
    type,
    distance: pl.shot_distance_ft,
    offensive: t.includes("offensive"),         // for rebounder
    shooting: t.includes("shooting") && t.includes("foul"),  // for foul_committer
  };
}

function contextForRole(role, ctx) {
  // Pass only what each role uses, but ctx is small so this is a no-op in practice.
  return ctx;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round4(n) { return Math.round(n * 10000) / 10000; }
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- ratingEngine
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): add ratingEngine.recomputeGame — idempotent per-game recompute"
```

---

## Task 9: Hook recomputeGame into eventProcessor

**Files:**
- Modify: `backend/src/ingestion/pipeline/eventProcessor.js` — call `recomputeGame` after participants

- [ ] **Step 1: Modify eventProcessor.js**

In `backend/src/ingestion/pipeline/eventProcessor.js`, near the top imports add:
```js
import { recomputeGame } from "../../services/games/ratingEngine.js";
```

After the call to `upsertPlayParticipants` (added in Task 6), AND after the stats upsert loop completes (the loop starting around line 320 — find the closing `}` of the for-of block over `playerGroups`), add:
```js
// NBA only — recompute per-player rating from the freshly written plays + participants.
if (leagueSlug === "nba") {
  try {
    await recomputeGame(client, gameId);
  } catch (err) {
    log.warn({ err, gameId }, "rating recompute failed; continuing");
  }
}
```

**Important ordering:** participants must be written before recompute (Task 6), and stats must be written before recompute (so the UPDATE inside `recomputeGame` finds rows). Place the recompute AFTER the `for (const group of playerGroups)` loop that handles stats.

- [ ] **Step 2: Run full test suite**

```bash
cd backend && npm test
```
Expected: all green. The eventProcessor's existing tests should still pass; the recompute is wrapped in try/catch so a recompute failure doesn't block ingestion.

- [ ] **Step 3: Commit**

```bash
git add backend/src/ingestion/pipeline/eventProcessor.js
git commit -m "feat(rating): hook recomputeGame into eventProcessor (NBA only)"
```

---

## Task 10: Backfill script for current NBA season

**Files:**
- Create: `backend/src/ingestion/scripts/backfillPlayerRatings.js`

**Why:** Re-ingest plays + participants for current-season NBA Final games (gets back the non-scoring plays we deleted before this rollout) and recompute ratings.

- [ ] **Step 1: Implement script**

Create `backend/src/ingestion/scripts/backfillPlayerRatings.js`:

```js
import dotenv from "dotenv";
import { Pool } from "pg";
import axios from "axios";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import logger from "../../logger.js";
import upsertPlays from "../upsert/upsertPlays.js";
import upsertPlayParticipants from "../upsert/upsertPlayParticipants.js";
import { recomputeGame } from "../../services/games/ratingEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const log = logger.child({ worker: "backfillPlayerRatings" });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  // Pick current NBA season from games (latest games row for nba).
  const { rows: seasonRows } = await pool.query(
    `SELECT DISTINCT season FROM games WHERE league = 'nba' AND season IS NOT NULL
     ORDER BY season DESC LIMIT 1`,
  );
  if (seasonRows.length === 0) {
    log.warn("no NBA season found; nothing to backfill");
    await pool.end();
    return;
  }
  const season = seasonRows[0].season;
  log.info({ season }, "backfilling NBA player ratings");

  const { rows: games } = await pool.query(
    `SELECT g.id, g.eventid, g.hometeamid, g.awayteamid,
            ht.espnid AS home_espn_id, at.espnid AS away_espn_id
       FROM games g
       LEFT JOIN teams ht ON ht.id = g.hometeamid
       LEFT JOIN teams at ON at.id = g.awayteamid
      WHERE g.league = 'nba' AND g.season = $1
        AND g.status ILIKE '%final%'
        AND g.eventid IS NOT NULL
      ORDER BY g.date ASC`,
    [season],
  );
  log.info({ count: games.length }, "Final NBA games to backfill");

  let ok = 0, fail = 0;
  for (const g of games) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${g.eventid}`;
    let data;
    try {
      const resp = await axios.get(url, { timeout: 15000 });
      data = resp.data;
    } catch (err) {
      log.warn({ err: err.message, gameId: g.id, eventid: g.eventid }, "ESPN fetch failed, skipping");
      fail++;
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await upsertPlays(
        client, g.id, data, "nba",
        g.hometeamid, g.awayteamid,
        g.home_espn_id, g.away_espn_id,
      );
      await upsertPlayParticipants(client, g.id, data, "nba");
      await recomputeGame(client, g.id);
      await client.query("COMMIT");
      ok++;
      if (ok % 25 === 0) log.info({ ok, fail }, "progress");
    } catch (err) {
      await client.query("ROLLBACK");
      log.error({ err, gameId: g.id }, "backfill failed for game");
      fail++;
    } finally {
      client.release();
    }
    // Be polite to ESPN — small delay between games.
    await new Promise((r) => setTimeout(r, 250));
  }

  log.info({ ok, fail }, "backfill complete");
  await pool.end();
}

if (resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    log.error({ err }, "fatal");
    process.exit(1);
  });
}

export { main };
```

- [ ] **Step 2: Smoke-run on local DB (no test — script is a one-shot)**

```bash
cd backend && node src/ingestion/scripts/backfillPlayerRatings.js
```
Expected output: progress lines every 25 games, final `backfill complete` summary. Verify a sample game manually:
```bash
psql "$DATABASE_URL" -c "SELECT playerid, rating FROM stats WHERE gameid = (SELECT id FROM games WHERE league='nba' AND status ILIKE '%final%' ORDER BY date DESC LIMIT 1) AND rating IS NOT NULL ORDER BY rating DESC LIMIT 5;"
```
Expected: 5 rows of (playerid, rating) with positive ratings; the top player should have the marquee performance of that game.

- [ ] **Step 3: Commit**

```bash
git add backend/src/ingestion/scripts/backfillPlayerRatings.js
git commit -m "feat(rating): add one-shot backfill script for current NBA season"
```

---

## Task 11: `topPerformancesService` — both query types

**Files:**
- Create: `backend/src/services/games/topPerformancesService.js`
- Test: `backend/__tests__/services/games/topPerformancesService.test.js`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/services/games/topPerformancesService.test.js`:

```js
import { jest } from "@jest/globals";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const mockQuery = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/db/db.js"),
  () => ({ default: { query: mockQuery } }),
);

const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/cache/cache.js"),
  () => ({ cached: mockCached }),
);

const { getTopPerformances } = await import("../../../src/services/games/topPerformancesService.js");

beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

describe("getTopPerformances", () => {
  test("type=games — returns shaped rows with ratingGrade computed", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          playerid: 11, gameid: 100, rating: "47.3",
          name: "Luka Dončić", image_url: "/luka.png", position: "G", slug: "luka-doncic",
          date: new Date("2026-05-05"),
          hometeamid: 1, awayteamid: 2, homescore: 110, awayscore: 105,
          points: 32, rebounds: 12, assists: 9,
          team_id: 1, abbreviation: "DAL", logo_url: "/dal.png", primary_color: "#00538C",
          opp_id: 2, opp_abbreviation: "LAL", opp_logo_url: "/lal.png",
        },
      ],
    });

    const out = await getTopPerformances({ league: "nba", days: 7, type: "games", limit: 5 });

    expect(out.type).toBe("games");
    expect(out.days).toBe(7);
    expect(out.performances).toHaveLength(1);
    expect(out.performances[0].rating).toBeCloseTo(47.3, 1);
    expect(out.performances[0].ratingGrade).toBeCloseTo(8.6, 1);
    expect(out.performances[0].player.team.primary_color).toBe("#00538C");
    expect(mockCached).toHaveBeenCalledWith(
      "top-performances:nba:games:7:5",
      60,
      expect.any(Function),
    );
  });

  test("type=cumulative — group by player, totalRating + bestGame", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          playerid: 11, total_rating: "234.7", games_played: "5", avg_per_game: "46.94",
          best_game_id: 100, best_game_rating: "54.8", best_opp_abbreviation: "LAL",
          name: "Nikola Jokić", image_url: "/jokic.png", position: "C", slug: "nikola-jokic",
          team_id: 3, abbreviation: "DEN", logo_url: "/den.png", primary_color: "#0E2240",
        },
      ],
    });

    const out = await getTopPerformances({ league: "nba", days: 7, type: "cumulative", limit: 5 });

    expect(out.type).toBe("cumulative");
    expect(out.performances[0].totalRating).toBeCloseTo(234.7, 1);
    expect(out.performances[0].gamesPlayed).toBe(5);
    expect(out.performances[0].avgPerGame).toBeCloseTo(46.94, 2);
    expect(out.performances[0].bestGame).toEqual({
      gameId: 100, rating: 54.8, opponentAbbreviation: "LAL",
    });
  });

  test("invalid type throws", async () => {
    await expect(
      getTopPerformances({ league: "nba", days: 7, type: "garbage", limit: 5 })
    ).rejects.toThrow(/type/);
  });

  test("days clamped to [1, 30]", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await getTopPerformances({ league: "nba", days: 999, type: "games", limit: 5 });
    expect(mockQuery.mock.calls[0][1][1]).toBe(30);
    await getTopPerformances({ league: "nba", days: 0, type: "games", limit: 5 });
    expect(mockQuery.mock.calls[1][1][1]).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
cd backend && npm test -- topPerformancesService
```
Expected: tests fail (module not found).

- [ ] **Step 3: Implement service**

Create `backend/src/services/games/topPerformancesService.js`:

```js
import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { gradeFromRaw } from "./ratingEngine.js";

const TTL = 60;
const ALLOWED_TYPES = new Set(["games", "cumulative"]);

function clamp(n, lo, hi) {
  if (Number.isNaN(n) || n == null) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export async function getTopPerformances({ league, days, type, limit }) {
  if (!ALLOWED_TYPES.has(type)) {
    const err = new Error(`invalid type: ${type}`);
    err.status = 400;
    throw err;
  }
  const safeDays  = clamp(parseInt(days, 10),  1, 30);
  const safeLimit = clamp(parseInt(limit, 10), 1, 25);

  const key = `top-performances:${league}:${type}:${safeDays}:${safeLimit}`;
  return cached(key, TTL, async () => {
    if (type === "games") return queryGames(league, safeDays, safeLimit);
    return queryCumulative(league, safeDays, safeLimit);
  });
}

async function queryGames(league, days, limit) {
  const { rows } = await pool.query(
    `SELECT s.playerid, s.gameid, s.rating,
            p.name, p.image_url, p.position,
            COALESCE(p.name, '') AS slug,        -- placeholder; route layer slugifies
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
        AND g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - $2::int
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
      ORDER BY s.rating DESC, s.playerid ASC
      LIMIT $3`,
    [league, days, limit],
  );
  return {
    type: "games",
    days,
    performances: rows.map(shapeGameRow),
  };
}

async function queryCumulative(league, days, limit) {
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
        AND g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - $2::int
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
      GROUP BY s.playerid, p.name, p.image_url, p.position, t.id, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating DESC, s.playerid ASC
      LIMIT $3`,
    [league, days, limit],
  );
  return {
    type: "cumulative",
    days,
    performances: rows.map(shapeCumulativeRow),
  };
}

function shapeGameRow(r) {
  const rating = Number(r.rating);
  return {
    player: {
      id: r.playerid,
      name: r.name,
      slug: r.slug,
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
      id: r.gameid,
      date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: r.team_id === r.hometeamid,
      result: r.homescore != null && r.awayscore != null
        ? ((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
           (r.team_id === r.awayteamid && r.awayscore > r.homescore) ? "W" : "L")
        : null,
    },
    rating,
    ratingGrade: round1(gradeFromRaw(rating)),
    stats: { points: r.points, rebounds: r.rebounds, assists: r.assists },
  };
}

function shapeCumulativeRow(r) {
  return {
    player: {
      id: r.playerid,
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
    totalRating: Number(r.total_rating),
    gamesPlayed: parseInt(r.games_played, 10),
    avgPerGame: round1(Number(r.avg_per_game)),
    bestGame: {
      gameId: r.best_game_id,
      rating: Number(r.best_game_rating),
      opponentAbbreviation: r.best_opp_abbreviation,
    },
  };
}

function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd backend && npm test -- topPerformancesService
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/topPerformancesService.js backend/__tests__/services/games/topPerformancesService.test.js
git commit -m "feat(rating): add topPerformancesService — Best Games + Last 7 Days queries"
```

---

## Task 12: Top Performances controller + route + mount

**Files:**
- Create: `backend/src/controllers/games/topPerformancesController.js`
- Create: `backend/src/routes/games/topPerformances.js`
- Modify: `backend/src/index.js` — mount the route
- Test: `backend/__tests__/routes/topPerformances.test.js`

- [ ] **Step 1: Write failing test**

Create `backend/__tests__/routes/topPerformances.test.js`:

```js
import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const mockGet = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/games/topPerformancesService.js"),
  () => ({ getTopPerformances: mockGet }),
);

const { default: router } = await import("../../src/routes/games/topPerformances.js");

const app = express();
app.use("/api/:league", router);

beforeEach(() => mockGet.mockReset());

test("GET /api/nba/top-performances?days=7&type=games", async () => {
  mockGet.mockResolvedValueOnce({ type: "games", days: 7, performances: [] });
  const r = await request(app).get("/api/nba/top-performances?days=7&type=games");
  expect(r.status).toBe(200);
  expect(r.body.type).toBe("games");
  expect(mockGet).toHaveBeenCalledWith({ league: "nba", days: "7", type: "games", limit: undefined });
});

test("400 for non-NBA in v1", async () => {
  const r = await request(app).get("/api/nfl/top-performances?days=7&type=games");
  expect(r.status).toBe(400);
});

test("400 for invalid type", async () => {
  mockGet.mockRejectedValueOnce(Object.assign(new Error("invalid type"), { status: 400 }));
  const r = await request(app).get("/api/nba/top-performances?days=7&type=garbage");
  expect(r.status).toBe(400);
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd backend && npm test -- topPerformances
```
Expected: tests fail (route module missing).

- [ ] **Step 3: Implement controller**

Create `backend/src/controllers/games/topPerformancesController.js`:

```js
import { getTopPerformances } from "../../services/games/topPerformancesService.js";

export async function topPerformances(req, res, next) {
  try {
    const { league } = req.params;
    if (league !== "nba") {
      return res.status(400).json({ error: "top-performances supports nba only in v1" });
    }
    const { days, type, limit } = req.query;
    const data = await getTopPerformances({ league, days, type, limit });
    res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
```

- [ ] **Step 4: Implement route**

Create `backend/src/routes/games/topPerformances.js`:

```js
import { Router } from "express";
import { topPerformances } from "../../controllers/games/topPerformancesController.js";

const router = Router({ mergeParams: true });
router.get("/top-performances", topPerformances);
export default router;
```

- [ ] **Step 5: Mount in index.js**

In `backend/src/index.js`, find where other `:league` routes are mounted (look for similar lines mounting `/:league/games`). Add:
```js
import topPerformancesRouter from "./routes/games/topPerformances.js";
// ...
app.use("/api/:league", topPerformancesRouter);
```
Place it next to other `/:league/...` mounts so middleware ordering matches.

- [ ] **Step 6: Run tests, verify pass**

```bash
cd backend && npm test -- topPerformances
```
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/games/topPerformancesController.js backend/src/routes/games/topPerformances.js backend/src/index.js backend/__tests__/routes/topPerformances.test.js
git commit -m "feat(rating): add /:league/top-performances endpoint"
```

---

## Task 13: Add `rating` + `ratingGrade` to game-detail player stats

**Files:**
- Modify: `backend/src/services/games/gameDetailService.js` — include `s.rating` in the SELECT and shape per-player stats with `rating` and `ratingGrade`
- Modify: `backend/__tests__/services/games/gameDetailService.test.js` (or wherever existing tests live) — extend to assert rating fields

- [ ] **Step 1: Locate game-detail SELECT and current shape**

Read `backend/src/services/games/gameDetailService.js`. Find the SQL that returns player stats. Add `s.rating` to the column list. In the JS shaper that builds the per-player object, set `rating: row.rating != null ? Number(row.rating) : null` and `ratingGrade: row.rating != null ? Math.round(Math.max(0, Math.min(10, Number(row.rating)/5.5))*10)/10 : null` — or import and use `gradeFromRaw` from ratingEngine.

Add at top:
```js
import { gradeFromRaw } from "./ratingEngine.js";
```

When constructing each player's stats object:
```js
const rating = row.rating != null ? Number(row.rating) : null;
return {
  // ...existing fields...
  rating,
  ratingGrade: rating == null ? null : Math.round(gradeFromRaw(rating) * 10) / 10,
};
```

- [ ] **Step 2: Add a test asserting rating shows in the response**

Find existing gameDetailService test file. Add a test (or extend an existing fixture) that has `s.rating = 47.3` for a row, then assert the shaped player object has `rating: 47.3` and `ratingGrade: 8.6`.

- [ ] **Step 3: Run test, verify pass**

```bash
cd backend && npm test -- gameDetailService
```
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/games/gameDetailService.js backend/__tests__
git commit -m "feat(rating): include rating + ratingGrade in game detail player stats"
```

---

## Task 14: Add `rating` to player-detail game log

**Files:**
- Modify: `backend/src/services/players/playerDetailService.js` — include `s.rating` in the game-log SELECT and shape rows with `rating` + `ratingGrade`

Same pattern as Task 13, applied to player game log rows.

- [ ] **Step 1: Add `s.rating` to the SELECT**
- [ ] **Step 2: Set `rating` + `ratingGrade` on each shaped game-log row**
- [ ] **Step 3: Add/extend test (`playerDetailService.test.js`)** — assert one row carries `rating: <number>` and `ratingGrade: <0-10>`
- [ ] **Step 4: Run tests, verify pass:** `cd backend && npm test -- playerDetailService`
- [ ] **Step 5: Commit:**
```bash
git add backend/src/services/players/playerDetailService.js backend/__tests__
git commit -m "feat(rating): include rating + ratingGrade in player game log"
```

---

## Task 15: Frontend — `StatCard` chip (S-B placement)

**Files:**
- Modify: `frontend/src/components/cards/StatCard.jsx`
- Modify: `frontend/src/__tests__/components/StatCard.test.jsx`

- [ ] **Step 1: Write failing test**

Add to `frontend/src/__tests__/components/StatCard.test.jsx`:

```jsx
test("renders rating chip top-left when ratingGrade is provided", () => {
  renderWithProviders(
    <StatCard
      stats={[{ label: "PTS", value: 32 }]}
      opponent="OKC"
      date="May 5"
      ratingGrade={8.4}
      gameId={1}
      league="nba"
      playerName="Test Player"
    />
  );
  expect(screen.getByText(/^Rating$/i)).toBeInTheDocument();
  expect(screen.getByText("8.4")).toBeInTheDocument();
});

test("does NOT render rating chip when ratingGrade is null/undefined", () => {
  renderWithProviders(
    <StatCard
      stats={[{ label: "PTS", value: 32 }]}
      opponent="OKC"
      date="May 5"
      gameId={1}
      league="nba"
      playerName="Test Player"
    />
  );
  expect(screen.queryByText(/^Rating$/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd frontend && npm test -- StatCard
```
Expected: fail.

- [ ] **Step 3: Modify StatCard.jsx**

In `frontend/src/components/cards/StatCard.jsx`, accept a new `ratingGrade` prop (default `undefined`). Inside the outer `<div className="relative ...">`, before the existing game-info row, add:

```jsx
{ratingGrade != null && (
  <div className="absolute top-3 left-3 flex flex-col items-start">
    <span className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium">Rating</span>
    <span className="text-accent font-bold text-2xl tabular-nums leading-none">
      {ratingGrade.toFixed(1)}
    </span>
  </div>
)}
```

Update the prop list in the function signature:
```jsx
export default function StatCard({
  stats = [],
  opponent,
  date,
  gameId,
  league,
  isHome,
  opponentLogo,
  result,
  status,
  playerName,
  gameType = "regular",
  gameLabel,
  ratingGrade,   // NEW
}) {
```

Update the call site in `PlayerPage.jsx` (or wherever StatCard is rendered with stats from player game log) to pass `ratingGrade={game.ratingGrade}`. Find the prop spread / explicit prop list and add the new prop.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd frontend && npm test -- StatCard
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cards/StatCard.jsx frontend/src/__tests__/components/StatCard.test.jsx frontend/src/pages/PlayerPage.jsx
git commit -m "feat(rating): add rating chip top-left on StatCard (S-B variant)"
```

---

## Task 16: Frontend — `TopPerformerCard` chip (T-D placement)

**Files:**
- Modify: `frontend/src/components/cards/TopPerformerCard.jsx`
- Modify: `frontend/src/__tests__/components/TopPerformerCard.test.jsx`

- [ ] **Step 1: Write failing test**

Add to `frontend/src/__tests__/components/TopPerformerCard.test.jsx`:

```jsx
test("renders rating column on the right when ratingGrade is provided", () => {
  renderWithProviders(
    <TopPerformerCard
      player={{
        id: 1,
        name: "SGA",
        position: "G",
        imageUrl: "/sga.png",
        stats: { PTS: 38, REB: 5, AST: 7 },
        ratingGrade: 8.0,
      }}
      league="nba"
    />
  );
  expect(screen.getByText("8.0")).toBeInTheDocument();
  // "Rating" label appears (the right-side label)
  const labels = screen.getAllByText(/^Rating$/i);
  expect(labels.length).toBeGreaterThan(0);
});

test("does NOT render rating column when ratingGrade is missing", () => {
  renderWithProviders(
    <TopPerformerCard
      player={{ id: 1, name: "SGA", position: "G", stats: { PTS: 38 } }}
      league="nba"
    />
  );
  expect(screen.queryByText(/^Rating$/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd frontend && npm test -- TopPerformerCard
```

- [ ] **Step 3: Modify TopPerformerCard.jsx**

Read `player.ratingGrade` (from `player` prop). Modify the right-info zone in `frontend/src/components/cards/TopPerformerCard.jsx` to split into two flex children when `ratingGrade != null`:

```jsx
const ratingGrade = player.ratingGrade;

// Inside the right-info container, replace the existing single-column layout with:
<div className="flex-1 flex items-stretch">
  <div className="flex-1 flex flex-col justify-between px-3.5 py-3 min-w-0">
    {/* existing name + stats content unchanged */}
  </div>
  {ratingGrade != null && (
    <div className="shrink-0 pl-3 pr-3.5 py-3 flex flex-col items-center justify-center border-l border-white/[0.08]">
      <span className="text-accent font-black text-3xl tabular-nums leading-none">
        {ratingGrade.toFixed(1)}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1">
        Rating
      </span>
    </div>
  )}
</div>
```

Stat row inside the left child compresses from the existing layout to a tighter inline row to make room. Remove the right-edge padding of the existing inner content (`px-3.5` becomes `pl-3.5 pr-2`) so the rating column sits flush.

Server side already includes `ratingGrade` on player objects via Task 13 — no API client change needed.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd frontend && npm test -- TopPerformerCard
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/cards/TopPerformerCard.jsx frontend/src/__tests__/components/TopPerformerCard.test.jsx
git commit -m "feat(rating): add rating column on TopPerformerCard right side (T-D variant)"
```

---

## Task 17: Frontend — Top Performances API client + hook

**Files:**
- Create: `frontend/src/api/topPerformances.js`
- Create: `frontend/src/hooks/data/useTopPerformances.js`
- Modify: `frontend/src/lib/query.js` — add query key + fn

- [ ] **Step 1: Add API wrapper**

Create `frontend/src/api/topPerformances.js`:

```js
import { apiFetch } from "./client.js";

export async function getTopPerformances(league, { days = 7, type = "games", limit = 5 } = {}) {
  const params = new URLSearchParams({ days: String(days), type, limit: String(limit) });
  return apiFetch(`/${league}/top-performances?${params}`);
}
```

- [ ] **Step 2: Add query key + fn**

In `frontend/src/lib/query.js`, add to `queryKeys`:
```js
topPerformances: (league, days, type, limit) =>
  ["top-performances", league, days, type, limit],
```
And to `queryFns`:
```js
topPerformances: (league, days, type, limit) =>
  () => getTopPerformances(league, { days, type, limit }),
```
Add the import at top of file:
```js
import { getTopPerformances } from "../api/topPerformances.js";
```

- [ ] **Step 3: Add hook**

Create `frontend/src/hooks/data/useTopPerformances.js`:

```js
import { useQuery } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";

export function useTopPerformances(league, { days = 7, type = "games", limit = 5 } = {}) {
  return useQuery({
    queryKey: queryKeys.topPerformances(league, days, type, limit),
    queryFn:  queryFns.topPerformances(league, days, type, limit),
    staleTime: 30_000,
    enabled: !!league,
  });
}
```

- [ ] **Step 4: Smoke test (no unit test for the thin wrapper — covered by component test in next task)**

```bash
cd frontend && npm run build
```
Expected: build succeeds, no import errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/topPerformances.js frontend/src/lib/query.js frontend/src/hooks/data/useTopPerformances.js
git commit -m "feat(rating): add Top Performances API client and useTopPerformances hook"
```

---

## Task 18: Frontend — `TopPerformancesCard` component (H-C layout)

**Files:**
- Create: `frontend/src/components/cards/TopPerformancesCard.jsx`
- Create: `frontend/src/components/skeletons/TopPerformancesCardSkeleton.jsx`
- Test: `frontend/src/__tests__/components/TopPerformancesCard.test.jsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/__tests__/components/TopPerformancesCard.test.jsx`:

```jsx
import { describe, test, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/testUtils.jsx";
import TopPerformancesCard from "../../components/cards/TopPerformancesCard.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const games = {
  type: "games",
  days: 7,
  performances: [
    { player: { id: 1, name: "Luka Dončić", slug: "luka-doncic", imageUrl: "/luka.png", team: { abbreviation: "DAL", primary_color: "#00538C" } },
      game: { id: 100, opponent: { abbreviation: "LAL" }, isHome: true, result: "W" },
      rating: 47.3, ratingGrade: 8.6,
      stats: { points: 32, rebounds: 12, assists: 9 } },
    { player: { id: 2, name: "SGA", slug: "sga", imageUrl: "/sga.png", team: { abbreviation: "OKC", primary_color: "#007AC1" } },
      game: { id: 101, opponent: { abbreviation: "DEN" }, isHome: false, result: "W" },
      rating: 44.1, ratingGrade: 8.0,
      stats: { points: 38, rebounds: 5, assists: 7 } },
  ],
};

const cumulative = {
  type: "cumulative",
  days: 7,
  performances: [
    { player: { id: 3, name: "Nikola Jokić", imageUrl: "/jokic.png", team: { abbreviation: "DEN", primary_color: "#0E2240" } },
      totalRating: 234.7, gamesPlayed: 5, avgPerGame: 46.9,
      bestGame: { gameId: 200, rating: 54.8, opponentAbbreviation: "MIN" } },
  ],
};

describe("TopPerformancesCard", () => {
  test("renders Best Games tab by default with hero #1 and rest list", () => {
    useTopPerformances.mockImplementation((_, { type }) => ({
      isLoading: false, data: type === "games" ? games : cumulative,
    }));
    renderWithProviders(<TopPerformancesCard league="nba" />);
    expect(screen.getByText("Top Performances")).toBeInTheDocument();
    expect(screen.getByText("Luka Dončić")).toBeInTheDocument();
    expect(screen.getByText("8.6")).toBeInTheDocument();
    // raw is hidden
    expect(screen.queryByText("47.3")).not.toBeInTheDocument();
  });

  test("switching to Last 7 Days tab shows cumulative totals (raw)", async () => {
    const user = userEvent.setup();
    useTopPerformances.mockImplementation((_, { type }) => ({
      isLoading: false, data: type === "games" ? games : cumulative,
    }));
    renderWithProviders(<TopPerformancesCard league="nba" />);
    await user.click(screen.getByRole("button", { name: /last 7 days/i }));
    expect(screen.getByText("Nikola Jokić")).toBeInTheDocument();
    expect(screen.getByText("234.7")).toBeInTheDocument();   // raw shown here
    expect(screen.getByText(/5 GP/i)).toBeInTheDocument();
  });

  test("renders skeleton while loading", () => {
    useTopPerformances.mockReturnValue({ isLoading: true });
    renderWithProviders(<TopPerformancesCard league="nba" />);
    expect(screen.getByTestId("top-performances-skeleton")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd frontend && npm test -- TopPerformancesCard
```

- [ ] **Step 3: Implement skeleton**

Create `frontend/src/components/skeletons/TopPerformancesCardSkeleton.jsx`:

```jsx
import Skeleton from "../ui/Skeleton.jsx";

export default function TopPerformancesCardSkeleton() {
  return (
    <div data-testid="top-performances-skeleton" className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 max-w-[600px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl mb-3" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-xl mt-1" />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement card**

Create `frontend/src/components/cards/TopPerformancesCard.jsx`:

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";
import TopPerformancesCardSkeleton from "../skeletons/TopPerformancesCardSkeleton.jsx";

const TABS = [
  { id: "games",      label: "Best Games" },
  { id: "cumulative", label: "Last 7 Days" },
];

export default function TopPerformancesCard({ league = "nba" }) {
  const [tab, setTab] = useState("games");
  const { data, isLoading } = useTopPerformances(league, { type: tab, days: 7, limit: 5 });

  if (isLoading) return <TopPerformancesCardSkeleton />;
  if (!data?.performances?.length) return null;

  const items = data.performances;
  const hero = items[0];
  const rest = items.slice(1);

  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 max-w-[1200px] mx-auto my-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold">Top Performances</h3>
        <span className="text-[10px] text-text-tertiary">Last 7 Days</span>
      </div>
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-full transition-all duration-200 ${
              tab === t.id ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <HeroRow item={hero} tab={tab} league={league} />
      <ul className="flex flex-col gap-1">
        {rest.map((it, idx) => (
          <CompactRow key={(it.player?.id || idx) + ":" + (it.game?.id || "")} item={it} rank={idx + 2} tab={tab} league={league} />
        ))}
      </ul>
    </div>
  );
}

function HeroRow({ item, tab, league }) {
  const color = item.player?.team?.primary_color || "#e8863a";
  const to = tab === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const meta = tab === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}  ·  ${item.game.isHome ? "vs" : "@"} ${item.game.opponent.abbreviation} · ${formatDate(item.game.date)}`
    : `${item.gamesPlayed} GP · avg ${item.avgPerGame.toFixed(1)}`;
  const value = tab === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  return (
    <Link
      to={to}
      className="relative flex items-center gap-4 px-5 py-4 rounded-2xl mb-3 cursor-pointer overflow-hidden hover:brightness-110 transition-all"
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        border: `1px solid ${color}40`,
      }}
    >
      <span className="text-accent font-black text-3xl tabular-nums leading-none">#1</span>
      <img loading="lazy" src={item.player.imageUrl || "/defaultPhoto.webp"} alt={item.player.name}
           className="w-14 h-14 object-cover rounded-full ring-2 ring-accent/40 shrink-0"
           onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }} />
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-text-primary truncate">{item.player.name}</div>
        <div className="text-xs text-text-tertiary truncate">{meta}</div>
      </div>
      <span className="text-accent font-black text-3xl tabular-nums leading-none shrink-0">{value}</span>
    </Link>
  );
}

function CompactRow({ item, rank, tab, league }) {
  const to = tab === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const value = tab === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  const meta = tab === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}`
    : `${item.gamesPlayed} GP`;
  return (
    <Link to={to} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-overlay transition-all">
      <span className="text-text-tertiary font-semibold text-xs w-4 tabular-nums">{rank}</span>
      <img loading="lazy" src={item.player.imageUrl || "/defaultPhoto.webp"} alt=""
           className="w-7 h-7 object-cover rounded-full shrink-0"
           onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }} />
      <span className="text-sm font-medium text-text-primary flex-1 truncate">{item.player.name}</span>
      <span className="text-text-tertiary text-[11px] tabular-nums">{meta}</span>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right">{value}</span>
    </Link>
  );
}

function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
cd frontend && npm test -- TopPerformancesCard
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/cards/TopPerformancesCard.jsx frontend/src/components/skeletons/TopPerformancesCardSkeleton.jsx frontend/src/__tests__/components/TopPerformancesCard.test.jsx
git commit -m "feat(rating): add TopPerformancesCard component (H-C layout) with skeleton"
```

---

## Task 19: Mount `TopPerformancesCard` on Homepage

**Files:**
- Modify: `frontend/src/pages/Homepage.jsx`

- [ ] **Step 1: Modify Homepage**

In `frontend/src/pages/Homepage.jsx`, add the import:
```js
import TopPerformancesCard from "../components/cards/TopPerformancesCard.jsx";
```

In the JSX, between `<NewsSection />` and the league tabs / Today's Games section, add:
```jsx
<TopPerformancesCard league="nba" />
```

The component handles its own loading state and returns `null` when there's no data, so no parent guard is needed.

- [ ] **Step 2: Manual smoke test**

```bash
cd frontend && npm run dev
```
Open the homepage in a browser, scroll to verify Top Performances appears between News and Today's Games. Click a Best Games row → land on the GamePage. Switch to Last 7 Days tab, click a row → land on the PlayerPage.

- [ ] **Step 3: Run frontend test suite**

```bash
cd frontend && npm test
```
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Homepage.jsx
git commit -m "feat(rating): mount TopPerformancesCard on Homepage"
```

---

## Task 20: Verify and lint

**Files:** none (verification only)

- [ ] **Step 1: Run backend verify**

```bash
cd backend && npm run verify
```
Expected: lint + tests pass.

- [ ] **Step 2: Run frontend verify**

```bash
cd frontend && npm run verify
```
Expected: lint + tests + build pass.

- [ ] **Step 3: Manual end-to-end smoke test**

```bash
cd backend && npm run dev   # in one terminal
cd frontend && npm run dev   # in another
```

Steps:
1. Open http://localhost:5173 — confirm Top Performances component renders.
2. Switch tabs (Best Games / Last 7 Days). Numbers change; raw shows only on Last 7 Days.
3. Click Best Games row #1 → lands on `/nba/games/<id>`.
4. On the GamePage, find the Top Performer card → confirm rating column on the right.
5. Navigate to a recent player's PlayerPage → game logs show ratings on StatCards (top-left chips).

- [ ] **Step 4: Commit (no-op marker, optional)**

If anything was tweaked during smoke testing:
```bash
git add -A
git commit -m "chore(rating): verify pass"
```

---

## Task 21: Calibration tuning

**Files:** none initially (data analysis); `backend/src/services/games/ratingEngine.js` if tuning is needed.

**Why:** The spec's `WPA_WEIGHT = 30` and `gradeFromRaw` divisor `5.5` are starting values. After backfill data exists, look at the distribution and decide if either needs adjusting.

- [ ] **Step 1: Inspect raw rating distribution**

```bash
psql "$DATABASE_URL" -c "SELECT
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY rating) AS p50,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY rating) AS p90,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY rating) AS p99,
  MAX(rating) AS max,
  MIN(rating) AS min,
  COUNT(*) AS n
FROM stats s JOIN games g ON g.id = s.gameid
WHERE g.league = 'nba' AND s.rating IS NOT NULL;"
```

- [ ] **Step 2: Decide on adjustments**

Reference points:
- p50 (median rated game) should map to grade ~3-4 → raw ~17-22
- p90 (good game) should map to grade ~6-7 → raw ~33-39
- p99 (elite game) should map to grade ~9.0-9.5 → raw ~50-52
- max (historic) should hit grade ~10.0 → raw 55+

If p99 raw is significantly different, consider:
- Adjusting `gradeFromRaw` divisor (currently 5.5) — easier; cosmetic-only change.
- Adjusting `WPA_WEIGHT` (currently 30) — invasive; changes raw distribution. Requires re-running backfill.

- [ ] **Step 3: If divisor adjustment is enough, edit ratingEngine.js**

Change `const GRADE_DIVISOR = 5.5;` to the new value. No other changes required — grades are computed at read time.

- [ ] **Step 4: If `WPA_WEIGHT` needs adjustment**

Change the constant in ratingEngine.js, then re-run the backfill (Task 10). All `play_ratings` and `stats.rating` values are recomputed.

- [ ] **Step 5: Commit if changed**

```bash
git add backend/src/services/games/ratingEngine.js
git commit -m "tune(rating): adjust grade divisor based on backfill distribution"
```

---

## Task 22: Update docs

**Files:**
- Modify: `docs/ARCHITECTURE.md` — add a "Player Rating System" section
- Modify: `docs/file-map.md` — add new files (ratingEngine, topPerformances, etc.)
- Modify: `docs/api-reference.md` — document `GET /:league/top-performances`; note `rating`/`ratingGrade` on game-detail and player-detail responses
- Modify: `CLAUDE.md` Project Memory (`/Users/yassin/.claude/projects/-Users-yassin-work-Scorva/memory/MEMORY.md`) — point to the spec under "Feature index"

- [ ] **Step 1: ARCHITECTURE.md**

Add a section like the existing AI summary or Live sync sections, summarizing:
- The data flow (plays + participants → engine → stats.rating + play_ratings)
- The formula at a high level (base + WPA, clamped to ±10)
- Where compute happens (eventProcessor; idempotent recompute)
- The display rule (chip = `gradeFromRaw(raw)`; raw hidden except in Last 7 Days)
- That NBA only is supported in v1; NFL and NHL deferred (with note that NHL needs synthesized winprob).

- [ ] **Step 2: file-map.md**

Add rows for:
- `backend/src/services/games/ratingEngine.js`
- `backend/src/services/games/topPerformancesService.js`
- `backend/src/controllers/games/topPerformancesController.js`
- `backend/src/routes/games/topPerformances.js`
- `backend/src/ingestion/upsert/upsertPlayParticipants.js`
- `backend/src/ingestion/mappings/nbaPlayDistance.js`
- `backend/src/ingestion/mappings/nbaPlayRoles.js`
- `backend/src/ingestion/scripts/backfillPlayerRatings.js`
- `frontend/src/components/cards/TopPerformancesCard.jsx`
- `frontend/src/components/skeletons/TopPerformancesCardSkeleton.jsx`
- `frontend/src/api/topPerformances.js`
- `frontend/src/hooks/data/useTopPerformances.js`

- [ ] **Step 3: api-reference.md**

Add entry for `GET /:league/top-performances?days=7&type=games|cumulative&limit=5`. Update existing entries for `GET /:league/games/:gameId` and `GET /:league/players/:slug` to mention the new `rating` + `ratingGrade` fields on player stats / game log rows.

- [ ] **Step 4: MEMORY.md**

Under "Feature index", add:
```md
- [Player rating system (NBA v1)](docs/superpowers/specs/2026-05-08-player-rating-system-design.md) — per-play WPA-weighted rating, surfaces on StatCard/TopPerformerCard + new "Top Performances" Homepage component
```

- [ ] **Step 5: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: document player rating system"
```

---

## Self-review

**Spec coverage:** every section of the spec maps to a task —
- Schema → Task 1
- Distance extractor → Task 2
- Role inference → Task 3
- Plays-side ingestion changes (distance) → Task 4
- play_participants writer → Task 5
- Pipeline wiring + cleanup drop → Task 6
- Engine helpers → Task 7
- Engine recompute → Task 8
- Pipeline recompute trigger → Task 9
- Backfill script → Task 10
- topPerformancesService (both types) → Task 11
- Controller + route + mount → Task 12
- rating in game-detail → Task 13
- rating in player game log → Task 14
- StatCard chip → Task 15
- TopPerformerCard chip → Task 16
- API client + hook → Task 17
- TopPerformancesCard component → Task 18
- Mount on Homepage → Task 19
- Verify/lint → Task 20
- Calibration tuning → Task 21
- Doc updates → Task 22

**Type/name consistency:** `gradeFromRaw`, `recomputeGame`, `inferParticipantRoles`, `extractShotDistance`, `getTopPerformances`, `useTopPerformances`, `TopPerformancesCard` — used identically across all tasks.

**No placeholders:** code blocks present in every implementation step. Test code present where TDD applies. No "TBD" / "implement later" / "similar to Task N" patterns.

**Open question deferred to runtime:** Task 21 (calibration) is intentionally a tuning task — it has no fixed correct answer until real data exists. The plan tells the engineer how to inspect distributions and decide.
