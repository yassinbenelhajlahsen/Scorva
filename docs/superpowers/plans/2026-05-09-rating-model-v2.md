# Rating Model v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Rating Model v2 per `docs/superpowers/specs/2026-05-09-rating-model-v2-design.md` — role-aware WPA splits, sqrt compression of `wpa_delta`, ±6 internal clamp scaled to ±10 display, assisted/unassisted base differentiation, tech/flagrant severity, charge-drawer credit, heave detection, and minutes-aware game-rating cap.

**Architecture:** Pure-function changes in `ratingEngine.js` (constants, `wpaContribution`, `baseValue`, `ctxFromPlay`, the `recomputeGame` SQL UPDATE) plus one new role attributed in `nbaPlayRoles.js`. The role inference change ships independently and can be tested in isolation. Database schema is unchanged — `play_ratings.weighted_value` and `stats.rating` continue to store the user-facing scaled values.

**Tech Stack:** Node 22 (ESM, `--env-file` for env), Jest with `unstable_mockModule`, PostgreSQL via `pg` Pool, no Prisma migrations needed.

---

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `backend/src/services/games/ratingEngine.js` | Per-play model + per-game aggregation | Modified — constants, formulas, SQL UPDATE |
| `backend/src/ingestion/mappings/nbaPlayRoles.js` | ESPN play → participant roles | Modified — add charge_drawer attribution; route Offensive Charge correctly |
| `backend/__tests__/services/games/ratingEngine.test.js` | Unit tests for rating engine | Modified — every section updated for v2 constants/signatures |
| `backend/__tests__/ingestion/nbaPlayRoles.test.js` | Unit tests for role inference | Modified — new cases for Offensive Charge / Offensive Foul Turnover |
| `backend/src/ingestion/scripts/recomputeAllNbaRatings.js` | Bulk recompute driver (already exists) | No changes — used by Task 6 |

Tasks 1 → 5 are code+tests. Task 6 is the production migration runbook.

---

## Task 1: Add `charge_drawer` role attribution

**Files:**
- Modify: `backend/src/ingestion/mappings/nbaPlayRoles.js:65-83` (turnover and foul branches)
- Modify: `backend/__tests__/ingestion/nbaPlayRoles.test.js` (add cases)

This is independent of all `ratingEngine.js` work — can ship and merge first. The new role won't be referenced by `ratingEngine.js` until Task 4 lands; in the interim, charge_drawer rows get `base = 0` from the default switch branch (harmless).

- [ ] **Step 1: Write failing tests in `nbaPlayRoles.test.js`**

Append these `test(...)` blocks inside the existing `describe("inferParticipantRoles", () => { ... })` block (after the last existing test, before the closing brace):

```js
  test("offensive charge with both participants → committer + charge_drawer", () => {
    const play = {
      type: { text: "Offensive Charge" },
      text: "Player A offensive charge (Player B draws the foul)",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }, { athlete: { id: "222" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
      { espnAthleteId: "222", role: "charge_drawer" },
    ]);
  });

  test("offensive charge with only one participant → committer only", () => {
    const play = {
      type: { text: "Offensive Charge" },
      text: "Player A offensive charge",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
    ]);
  });

  test("offensive foul turnover with both participants → committer + charge_drawer", () => {
    const play = {
      type: { text: "Offensive Foul Turnover" },
      text: "Player A offensive foul turnover",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }, { athlete: { id: "222" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
      { espnAthleteId: "222", role: "charge_drawer" },
    ]);
  });
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd backend && npm test -- --testPathPatterns nbaPlayRoles
```

Expected: 3 new tests fail. Existing tests pass.

- [ ] **Step 3: Implement charge_drawer attribution**

Modify `backend/src/ingestion/mappings/nbaPlayRoles.js`. Replace the entire turnovers + fouls block (currently lines 67-79) with:

```js
  // Turnovers (including offensive foul turnovers — possession lost)
  if (TURNOVER_KEYWORDS.some((k) => typeText.includes(k))) {
    const out = [{ espnAthleteId: ids[0], role: "turnover_committer" }];
    if (ids[1] && /\bsteals?\b/.test(text)) {
      out.push({ espnAthleteId: ids[1], role: "stealer" });
    } else if (ids[1] && typeText.includes("offensive foul")) {
      // Offensive foul turnover: secondary participant is the defender who drew the charge
      out.push({ espnAthleteId: ids[1], role: "charge_drawer" });
    }
    return out.filter((p) => p.espnAthleteId);
  }

  // Offensive Charge — possession swing (treated as turnover for committer + charge for drawer)
  if (typeText === "offensive charge") {
    const out = [{ espnAthleteId: ids[0], role: "turnover_committer" }];
    if (ids[1]) out.push({ espnAthleteId: ids[1], role: "charge_drawer" });
    return out.filter((p) => p.espnAthleteId);
  }

  // Fouls
  if (FOUL_KEYWORDS.some((k) => typeText.includes(k))) {
    return ids[0] ? [{ espnAthleteId: ids[0], role: "foul_committer" }] : [];
  }
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd backend && npm test -- --testPathPatterns nbaPlayRoles
```

Expected: all tests pass (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/ingestion/mappings/nbaPlayRoles.js backend/__tests__/ingestion/nbaPlayRoles.test.js
git commit -m "feat(rating): attribute charge_drawer on offensive charges/foul-turnovers"
```

---

## Task 2: Add v2 constants and update `clampPlayValue`

**Files:**
- Modify: `backend/src/services/games/ratingEngine.js:24-25` (constants block)
- Modify: `backend/src/services/games/ratingEngine.js:47-51` (`clampPlayValue`)
- Modify: `backend/__tests__/services/games/ratingEngine.test.js` (update existing `clampPlayValue` tests)

- [ ] **Step 1: Update `clampPlayValue` tests in `ratingEngine.test.js`**

Replace the existing `describe("clampPlayValue", ...)` block (currently 3 tests) with:

```js
describe("clampPlayValue (model space, ±6)", () => {
  test("normal range passes through", () => { expect(clampPlayValue(2.3)).toBe(2.3); });
  test("clamps to +6", () => { expect(clampPlayValue(20)).toBe(6); });
  test("clamps to -6", () => { expect(clampPlayValue(-25)).toBe(-6); });
  test("boundary +6 stays +6", () => { expect(clampPlayValue(6)).toBe(6); });
  test("boundary -6 stays -6", () => { expect(clampPlayValue(-6)).toBe(-6); });
});
```

- [ ] **Step 2: Add new test for `displayValue` (export to be added next)**

Add this `describe` block immediately after the `clampPlayValue` describe:

```js
describe("displayValue (10/6 scale)", () => {
  test("0 stays 0", () => { expect(displayValue(0)).toBe(0); });
  test("+6 → +10", () => { expect(displayValue(6)).toBeCloseTo(10, 5); });
  test("-6 → -10", () => { expect(displayValue(-6)).toBeCloseTo(-10, 5); });
  test("+3 → +5", () => { expect(displayValue(3)).toBeCloseTo(5, 5); });
});
```

Update the import at the top of the test file to add `displayValue`:

```js
import {
  gradeFromRaw,
  baseValue,
  wpaContribution,
  clampPlayValue,
  displayValue,
} from "../../../src/services/games/ratingEngine.js";
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine
```

Expected: `clampPlayValue` clamp-to-±10 tests now fail (since they assert ±10 but production still uses ±10 — wait, they will pass on the OLD code). New `displayValue` tests fail with "displayValue is not a function". Re-run after edits below.

- [ ] **Step 4: Update constants and add `displayValue` in `ratingEngine.js`**

In `backend/src/services/games/ratingEngine.js`, replace the constants block (lines 24-25):

```js
const WPA_WEIGHT = 30;
const GRADE_COEFFICIENT = 0.92;
```

with:

```js
// v2: smaller weight + sqrt compression on wpa_delta
const WPA_WEIGHT = 18;
const GRADE_COEFFICIENT = 0.92;
const MAX_PER_PLAY = 6;       // internal "model space" clamp
const DISPLAY_SCALE = 10 / 6; // scale model values to user-facing ±10 range

// Per-role share of the WPA contribution. Scorer is the primary credit-receiver;
// secondary roles get a fraction so a clutch shooter and assister don't both cap.
const ROLE_WPA_MULT = {
  scorer: 1.0,
  shot_attempter: 0.5,
  assister: 0.4,
  blocker: 0.5,
  stealer: 0.5,
  charge_drawer: 0.5,
  turnover_committer: 0.6,
  foul_committer: 0.3,
  rebounder: 0.4,    // overridden to 0.25 for defensive in wpaContribution
  heave_attempter: 0,
};
```

Replace `clampPlayValue` (currently at lines 47-51):

```js
export function clampPlayValue(v) {
  if (v > MAX_PER_PLAY) return MAX_PER_PLAY;
  if (v < -MAX_PER_PLAY) return -MAX_PER_PLAY;
  return v;
}

export function displayValue(modelValue) {
  return modelValue * DISPLAY_SCALE;
}
```

- [ ] **Step 5: Run tests, verify clamp + displayValue tests pass**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine
```

Expected: `clampPlayValue` and `displayValue` describe blocks pass. Other tests (`wpaContribution`, `baseValue`, `recomputeGame`) likely fail because they assume ±10 semantics — tasks 3-5 will address.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): add v2 constants (WPA_WEIGHT=18, MAX_PER_PLAY=6, ROLE_WPA_MULT, DISPLAY_SCALE)"
```

---

## Task 3: Refactor `wpaContribution` with sqrt compression and role multipliers

**Files:**
- Modify: `backend/src/services/games/ratingEngine.js:53-57` (`wpaContribution`)
- Modify: `backend/__tests__/services/games/ratingEngine.test.js` (update + add tests)

- [ ] **Step 1: Replace `wpaContribution` tests**

In `ratingEngine.test.js`, replace the existing `describe("wpaContribution", ...)` block entirely with:

```js
describe("wpaContribution (v2: role-aware, sqrt-compressed)", () => {
  // Formula: ROLE_MULT × WPA_WEIGHT(18) × sign(delta) × sqrt(|delta|) × team_sign

  test("scorer on +0.05 home → 1.0 × 18 × √0.05 × 1 ≈ 4.025", () => {
    expect(wpaContribution(0.05, "home", "scorer", {})).toBeCloseTo(18 * Math.sqrt(0.05), 4);
  });

  test("scorer on +0.05 away → sign flips to negative", () => {
    expect(wpaContribution(0.05, "away", "scorer", {})).toBeCloseTo(-18 * Math.sqrt(0.05), 4);
  });

  test("assister on +0.4 home → 0.4 × 18 × √0.4 ≈ 4.555", () => {
    expect(wpaContribution(0.4, "home", "assister", {})).toBeCloseTo(0.4 * 18 * Math.sqrt(0.4), 4);
  });

  test("scorer on +0.4 home → 18 × √0.4 ≈ 11.4 (will clamp downstream)", () => {
    expect(wpaContribution(0.4, "home", "scorer", {})).toBeCloseTo(18 * Math.sqrt(0.4), 4);
  });

  test("negative wpa_delta on home turnover → negative contribution", () => {
    // turnover_committer mult 0.6, sign(-0.05) = -1, team_sign home = +1
    expect(wpaContribution(-0.05, "home", "turnover_committer", {})).toBeCloseTo(
      -0.6 * 18 * Math.sqrt(0.05), 4,
    );
  });

  test("offensive rebounder uses 0.4 mult", () => {
    expect(wpaContribution(0.05, "home", "rebounder", { offensive: true })).toBeCloseTo(
      0.4 * 18 * Math.sqrt(0.05), 4,
    );
  });

  test("defensive rebounder uses 0.25 mult", () => {
    expect(wpaContribution(0.05, "home", "rebounder", { offensive: false })).toBeCloseTo(
      0.25 * 18 * Math.sqrt(0.05), 4,
    );
  });

  test("heave_attempter mult is 0 → zero WPA contribution", () => {
    expect(wpaContribution(0.4, "home", "heave_attempter", {})).toBe(0);
  });

  test("null wpa_delta returns 0", () => {
    expect(wpaContribution(null, "home", "scorer", {})).toBe(0);
  });

  test("unknown role returns 0", () => {
    expect(wpaContribution(0.1, "home", "mystery", {})).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify all `wpaContribution` tests fail**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine -t wpaContribution
```

Expected: all tests fail (signature now expects 4 args; old function took 2).

- [ ] **Step 3: Implement v2 `wpaContribution`**

In `backend/src/services/games/ratingEngine.js`, replace the existing `wpaContribution` (lines 53-57):

```js
export function wpaContribution(wpaDelta, side /* "home" | "away" */) {
  if (wpaDelta == null) return 0;
  const sign = side === "home" ? 1 : -1;
  return WPA_WEIGHT * Number(wpaDelta) * sign;
}
```

with:

```js
export function wpaContribution(wpaDelta, side, role, ctx = {}) {
  if (wpaDelta == null) return 0;
  // Defensive rebounders get a smaller WPA multiplier than offensive rebounders.
  const mult = role === "rebounder"
    ? (ctx.offensive ? 0.4 : 0.25)
    : (ROLE_WPA_MULT[role] ?? 0);
  if (mult === 0) return 0;
  const teamSign = side === "home" ? 1 : -1;
  const delta = Number(wpaDelta);
  const wpaSign = delta < 0 ? -1 : 1;
  return mult * WPA_WEIGHT * wpaSign * Math.sqrt(Math.abs(delta)) * teamSign;
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine -t wpaContribution
```

Expected: all 10 `wpaContribution` tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): wpaContribution role-aware with sqrt(|delta|) compression"
```

---

## Task 4: Update `baseValue` for assisted scorers, foul severity, heave, charge_drawer

**Files:**
- Modify: `backend/src/services/games/ratingEngine.js:68-101` (`baseValue`)
- Modify: `backend/__tests__/services/games/ratingEngine.test.js` (update + add tests)

- [ ] **Step 1: Replace `baseValue` test block**

Replace the entire `describe("baseValue — NBA", ...)` block in `ratingEngine.test.js` with:

```js
describe("baseValue — NBA v2", () => {
  // SCORER: assisted vs unassisted differential
  test("unassisted made 3pt at 24ft → 1.5 + 0.02 = 1.52", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 24, assisted: false }))
      .toBeCloseTo(1.52, 2);
  });
  test("assisted made 3pt at 24ft → 1.2 + 0.02 = 1.22", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 24, assisted: true }))
      .toBeCloseTo(1.22, 2);
  });
  test("unassisted made 3pt at 30ft → 1.5 + 0.14 = 1.64", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 30, assisted: false }))
      .toBeCloseTo(1.64, 2);
  });
  test("unassisted made 3pt caps at 3.0", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 100, assisted: false })).toBe(3.0);
  });
  test("assisted made 3pt caps at 2.4", () => {
    expect(baseValue("scorer", { type: "made_3pt", distance: 100, assisted: true })).toBe(2.4);
  });
  test("unassisted made 2pt at 8ft → 1.16", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 8, assisted: false }))
      .toBeCloseTo(1.16, 2);
  });
  test("assisted made 2pt at 8ft → 0.86", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 8, assisted: true }))
      .toBeCloseTo(0.86, 2);
  });
  test("unassisted made 2pt caps at 2.0", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 100, assisted: false })).toBe(2.0);
  });
  test("assisted made 2pt caps at 1.5", () => {
    expect(baseValue("scorer", { type: "made_2pt", distance: 100, assisted: true })).toBe(1.5);
  });
  test("made FT (assisted is irrelevant)", () => {
    expect(baseValue("scorer", { type: "made_ft" })).toBe(0.4);
  });

  // SHOT ATTEMPTER & HEAVE
  test("missed shot", () => {
    expect(baseValue("shot_attempter", { type: "missed_3pt" })).toBe(-0.5);
  });
  test("missed FT", () => {
    expect(baseValue("shot_attempter", { type: "missed_ft" })).toBe(-0.3);
  });
  test("heave_attempter base = 0 (no penalty)", () => {
    expect(baseValue("heave_attempter", {})).toBe(0);
  });

  // ASSISTER, REBOUNDER, STEALER, BLOCKER unchanged
  test("assister", () => { expect(baseValue("assister", {})).toBe(0.7); });
  test("offensive rebound", () => {
    expect(baseValue("rebounder", { offensive: true })).toBe(0.6);
  });
  test("defensive rebound", () => {
    expect(baseValue("rebounder", { offensive: false })).toBe(0.3);
  });
  test("steal", () => { expect(baseValue("stealer", {})).toBe(1.0); });
  test("block", () => { expect(baseValue("blocker", {})).toBe(0.7); });
  test("turnover", () => { expect(baseValue("turnover_committer", {})).toBe(-1.0); });
  test("charge_drawer base = 1.0", () => { expect(baseValue("charge_drawer", {})).toBe(1.0); });

  // FOUL SEVERITY
  test("shooting foul (no foulType)", () => {
    expect(baseValue("foul_committer", { shooting: true })).toBe(-0.5);
  });
  test("non-shooting personal foul", () => {
    expect(baseValue("foul_committer", { shooting: false })).toBe(-0.2);
  });
  test("technical foul → -1.5", () => {
    expect(baseValue("foul_committer", { foulType: "technical" })).toBe(-1.5);
  });
  test("flagrant 1 → -2.0", () => {
    expect(baseValue("foul_committer", { foulType: "flagrant1" })).toBe(-2.0);
  });
  test("flagrant 2 → -3.5", () => {
    expect(baseValue("foul_committer", { foulType: "flagrant2" })).toBe(-3.5);
  });

  test("unknown role → 0", () => { expect(baseValue("mystery", {})).toBe(0); });
});
```

- [ ] **Step 2: Run tests, verify failures**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine -t "baseValue — NBA"
```

Expected: many failures — assisted/unassisted differential, heave_attempter, charge_drawer, foul severity all not yet implemented.

- [ ] **Step 3: Replace `baseValue` implementation**

In `ratingEngine.js`, replace the entire existing `baseValue` (lines 68-101):

```js
export function baseValue(role, ctx = {}) {
  switch (role) {
    case "scorer": {
      switch (ctx.type) {
        case "made_3pt": {
          const d = Math.max(0, (ctx.distance ?? 0) - 23);
          if (ctx.assisted) return Math.min(2.4, 1.2 + 0.02 * d);
          return Math.min(3.0, 1.5 + 0.02 * d);
        }
        case "made_2pt": {
          const d = Math.max(0, ctx.distance ?? 0);
          if (ctx.assisted) return Math.min(1.5, 0.7 + 0.02 * d);
          return Math.min(2.0, 1.0 + 0.02 * d);
        }
        case "made_ft":  return 0.4;
        default:         return 0;
      }
    }
    case "shot_attempter":
      return ctx.type === "missed_ft" ? -0.3 : -0.5;
    case "heave_attempter":
      return 0;
    case "assister":
      return 0.7;
    case "rebounder":
      return ctx.offensive ? 0.6 : 0.3;
    case "stealer":
      return 1.0;
    case "blocker":
      return 0.7;
    case "charge_drawer":
      return 1.0;
    case "turnover_committer":
      return -1.0;
    case "foul_committer": {
      switch (ctx.foulType) {
        case "technical": return -1.5;
        case "flagrant1": return -2.0;
        case "flagrant2": return -3.5;
        default:          return ctx.shooting ? -0.5 : -0.2;
      }
    }
    default:
      return 0;
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine -t "baseValue — NBA"
```

Expected: all `baseValue` tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): assisted/unassisted base, heave, charge_drawer, foul severity"
```

---

## Task 5: Update `ctxFromPlay` and `recomputeGame` integration

**Files:**
- Modify: `backend/src/services/games/ratingEngine.js:107-227` (`recomputeGame`) and `:229-246` (`ctxFromPlay`)
- Modify: `backend/__tests__/services/games/ratingEngine.test.js` (update existing `recomputeGame` tests)

This task threads the new `ctx` fields (`assisted`, `foulType`, `isHeave`) through, swaps `shot_attempter` to `heave_attempter` for heaves, pipes `role` and `ctx` into `wpaContribution`, multiplies stored `weighted_value` by `DISPLAY_SCALE`, and replaces the final SQL UPDATE with a minutes-aware capped form.

- [ ] **Step 1: Update existing `recomputeGame` tests**

In `ratingEngine.test.js`, in the first existing test ("idempotent: deletes existing play_ratings..."), update the `weighted_value` clamp assertion at the bottom from:

```js
    insertArgs[6].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    });
```

to:

```js
    // weighted_value is now stored in display space (±10) after model-space clamp at ±6 then × 10/6
    insertArgs[6].forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
    });
```

(The bounds happen to match since DISPLAY_SCALE × MAX_PER_PLAY = 10 — keep the test as a defensive check.)

In the second existing test ("handles missing winprob..."), update the final assertion. Currently:

```js
    expect(insertArgs[6][0]).toBeCloseTo(1.5, 1);
```

becomes:

```js
    // Unassisted made 3pt at 24ft: base = 1.52 (model space) → × 10/6 ≈ 2.53 (display space)
    // The test fixture has no `assisted` participant, so unassisted base applies.
    expect(insertArgs[6][0]).toBeCloseTo(1.52 * (10 / 6), 1);
```

Add a new test inside the same `describe("recomputeGame", ...)` block, after the existing tests, covering minutes-aware cap:

```js
  test("final UPDATE applies minutes-aware cap to stats.rating", async () => {
    mockGetWinProbability.mockResolvedValue(null);
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ league: "nba", eventid: 999, status: "Final", hometeamid: 1, awayteamid: 2 }] })
        .mockResolvedValueOnce({ rows: [
          { id: 501, sequence: 1, period: 1, clock: "10:00", espn_play_id: "p1",
            scoring_play: false, shot_distance_ft: null, play_type: "Personal Foul",
            team_id: 1, home_team_id: 1, away_team_id: 2, home_score: 0, away_score: 0 },
        ]})
        .mockResolvedValueOnce({ rows: [
          { play_id: 501, player_id: 11, role: "foul_committer", team_side: "home" },
        ]})
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    await recomputeGame(client, 100);
    // Final UPDATE statement should reference sign(...) * LEAST(...) with COALESCE on minutes
    const finalUpdate = client.query.mock.calls[6][0];
    expect(finalUpdate).toMatch(/sign\(sub\.total\)/);
    expect(finalUpdate).toMatch(/LEAST/);
    expect(finalUpdate).toMatch(/GREATEST\(8,\s*1\.5\s*\*\s*COALESCE\(stats\.minutes,\s*0\)\)/);
  });
```

- [ ] **Step 2: Run tests, verify failures**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine -t recomputeGame
```

Expected: existing tests + the new minutes-cap test fail (DISPLAY_SCALE not applied; SQL not updated).

- [ ] **Step 3: Replace `ctxFromPlay` in `ratingEngine.js`**

Replace the existing `ctxFromPlay` (lines 229-246) with:

```js
function ctxFromPlay(pl) {
  const t = (pl.play_type || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isFT = t.startsWith("free throw");
  const made = !!pl.scoring_play;
  // 3-point detection: most NBA shot types include "three" only when 3pt; otherwise infer
  // from distance ≥ 22 ft (the corner 3 line).
  const is3pt = t.includes("three") || (pl.shot_distance_ft != null && pl.shot_distance_ft >= 22 && !isFT);
  let type = null;
  if (isFT) type = made ? "made_ft" : "missed_ft";
  else if (made) type = is3pt ? "made_3pt" : "made_2pt";
  else type = is3pt ? "missed_3pt" : "missed_2pt";

  // Foul severity classification — read from play_type text.
  let foulType = null;
  if (t.includes("flagrant foul type 2")) foulType = "flagrant2";
  else if (t.includes("flagrant foul type 1") || t.includes("flagrant")) foulType = "flagrant1";
  else if (t.includes("technical")) foulType = "technical";

  // Heave detection: long-range attempt at end of period.
  // play.clock is a string like "M:SS" or "S.S"; parse seconds.
  const clockSec = parseClockSeconds(pl.clock);
  const isHeave = !made && !isFT
    && pl.shot_distance_ft != null && pl.shot_distance_ft >= 35
    && clockSec != null && clockSec <= 3.0;

  return {
    type,
    distance: pl.shot_distance_ft,
    offensive: t.includes("offensive"),
    shooting: t.includes("shooting") && t.includes("foul"),
    foulType,
    isHeave,
    // assisted is filled in by recomputeGame after participants are loaded
    assisted: false,
  };
}

function parseClockSeconds(clock) {
  if (clock == null) return null;
  const s = String(clock);
  if (s.includes(":")) {
    const [m, sec] = s.split(":").map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
    return m * 60 + sec;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Update `recomputeGame` to thread new ctx + role + scaling + SQL cap**

In `ratingEngine.js`, locate the `recomputeGame` body. Make these specific changes:

(a) After building `partsByPlay` (around the existing line `partsByPlay.get(p.play_id).push(p);`), insert this loop to compute `assisted`:

```js
  // Mark each play's ctx.assisted based on whether any participant is an assister.
  for (const [playId, parts] of partsByPlay.entries()) {
    const meta = playMeta.get(playId);
    if (!meta) continue;
    meta.ctx.assisted = parts.some((p) => p.role === "assister");
  }
```

(b) Inside the per-play / per-participant loop (`for (const pl of plays) { ... for (const pp of playerParts) { ... } }`), replace the body of the inner loop (currently 6 lines: `const base = baseValue(...)`, `const wpa = wpaContribution(...)`, `const weighted = clampPlayValue(base + wpa)`, plus the 4 array pushes and `insWeighted.push(round1(weighted))`) with:

```js
      // Heave detection: swap shot_attempter → heave_attempter so it gets zero base + zero wpa.
      const role = (pp.role === "shot_attempter" && meta.ctx.isHeave) ? "heave_attempter" : pp.role;
      const base = baseValue(role, contextForRole(role, meta.ctx));
      const wpa  = wpaContribution(meta.wpaDelta, pp.team_side, role, meta.ctx);
      const modelValue = clampPlayValue(base + wpa);
      const weighted = displayValue(modelValue);
      insPlay.push(pl.id);
      insPlayer.push(pp.player_id);
      insGame.push(gameId);
      insRole.push(role);
      insBase.push(round1(base));
      insWpa.push(meta.wpaDelta == null ? null : round4(meta.wpaDelta));
      insWeighted.push(round1(weighted));
```

(c) Replace the final UPDATE statement. The current code (around `await client.query(\`UPDATE stats SET rating = sub.total ...`) should become:

```js
  await client.query(
    `UPDATE stats SET rating = sign(sub.total) * LEAST(
       abs(sub.total),
       GREATEST(8, 1.5 * COALESCE(stats.minutes, 0))
     )
       FROM (
         SELECT player_id, SUM(weighted_value) AS total
           FROM play_ratings
          WHERE game_id = $1
          GROUP BY player_id
       ) sub
      WHERE stats.playerid = sub.player_id AND stats.gameid = $1`,
    [gameId],
  );
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd backend && npm test -- --testPathPatterns ratingEngine
```

Expected: all `ratingEngine` tests pass (gradeFromRaw, baseValue, wpaContribution, clampPlayValue, displayValue, recomputeGame).

- [ ] **Step 6: Run the broader backend suite to catch regressions**

```bash
cd backend && npm test
```

Expected: all tests pass. If any other suite (e.g. `topPerformancesService`, `gameDetailService`) snapshots specific rating values, update those snapshots/expectations to match v2 numbers in a follow-up commit only if the assertion was on absolute values (rare).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/games/ratingEngine.js backend/__tests__/services/games/ratingEngine.test.js
git commit -m "feat(rating): integrate assisted/heave/foul-severity ctx, role-aware WPA, and minutes-aware game cap"
```

---

## Task 6: Production migration (Bug 2 fix → recompute)

**Files:**
- Run: existing scripts (no code changes)

This task is the runbook the maintainer follows after merging Tasks 1-5.

- [ ] **Step 1: Confirm `backfillStatsTeamid.js` env-path fix is in place**

```bash
grep "../../../.env" backend/src/ingestion/scripts/backfillStatsTeamid.js
```

Expected: line 10 reads `dotenv.config({ path: resolve(__dirname, "../../../.env") });`. (Already fixed earlier in the session.)

- [ ] **Step 2: Null out the corrupted `stats.teamid` rows**

Connect to the production database and run:

```sql
UPDATE stats s
SET teamid = NULL
FROM games g
WHERE g.id = s.gameid
  AND g.league = 'nba'
  AND s.teamid IS NOT NULL
  AND s.teamid <> g.hometeamid
  AND s.teamid <> g.awayteamid;
```

Expected: ~771 rows updated (the bad rows where `stats.teamid` is neither home nor away of that game).

- [ ] **Step 3: Re-backfill `stats.teamid` from ESPN boxscores**

```bash
cd backend && node src/ingestion/scripts/backfillStatsTeamid.js
```

Expected: walks ~400 affected NBA games, refetches ESPN summary, sets `stats.teamid` from boxscore group. Logs progress every 100 games.

- [ ] **Step 4: Run the v2 recompute for the current season**

```bash
cd backend && node src/ingestion/scripts/recomputeAllNbaRatings.js 2025-26
```

Expected: ~1,200 games processed; ~0 failures. Each game's `play_ratings` rows get rewritten with v2 weighted values, and `stats.rating` gets the new minutes-aware capped sums.

- [ ] **Step 5: Spot-check three representative games**

```bash
cd backend && node --env-file=.env -e "
import('pg').then(async ({default: pg}) => {
  const c = new pg.Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  for (const gid of [94626, 73364, 75787]) {
    const r = await c.query(
      \\\"SELECT s.rating, p.name FROM stats s JOIN players p ON p.id=s.playerid WHERE s.gameid=\$1 AND s.rating IS NOT NULL ORDER BY s.rating DESC LIMIT 5\\\",
      [gid]
    );
    console.log('Game', gid, 'top 5:'); for (const x of r.rows) console.log('  ', x.name, x.rating);
  }
  await c.end();
});
"
```

Expected:
- Game 94626 (Bulls vs Celtics, post-Bug 2 fix): Bulls top performers (Giddey, Buzelis, etc.) appear with positive ratings; Coby White / Huerter / Vucevic now correctly attributed to the Bulls and show non-negative ratings if they were the game-winners.
- Game 73364 (Kings vs Rockets OT win): Schroder near the top with a positive rating reflecting the buzzer-beating 3.
- Game 75787 (Christmas Day Nuggets-Wolves): Jokic at the top.

- [ ] **Step 6: Commit (no code changes — runbook record)**

The migration is operational, not code. If you keep an `OPERATIONS.md` or similar runbook log, append the migration date and observed counts. Otherwise no commit needed for this task.

---

## Self-Review Notes

- **Spec coverage:** All seven defects in the spec map to tasks: defect 1 (role mults) → Task 3; defect 2 (cap saturation) → Tasks 2+3; defect 3 (assisted) → Task 4; defect 4 (small samples) → Task 5 SQL change; defect 5 (tech/flagrant) → Task 4; defect 6 (charge_drawer) → Tasks 1+4; defect 7 (heave) → Tasks 4+5. Migration order in spec § Migration → Task 6.
- **Type consistency:** `wpaContribution(wpaDelta, side, role, ctx)` signature consistent across Task 3 implementation and Task 5 caller. `ctxFromPlay` returns `{type, distance, offensive, shooting, foulType, isHeave, assisted}` — every field consumed by `baseValue` and `wpaContribution`. `displayValue` exported in Task 2 and used in Task 5. `MAX_PER_PLAY` and `DISPLAY_SCALE` constants introduced in Task 2 used in Tasks 2 and 5.
- **No placeholders.** All code blocks self-contained.
- **`shot_attempter` role retained** in `ROLE_WPA_MULT` — Task 3 expects mult 0.5, which the constants object provides.
