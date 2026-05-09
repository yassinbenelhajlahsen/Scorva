import {
  gradeFromRaw,
  baseValue,
  wpaContribution,
  clampPlayValue,
  displayValue,
} from "../../../src/services/games/ratingEngine.js";

describe("gradeFromRaw", () => {
  test("null raw → null", () => {
    expect(gradeFromRaw(null)).toBeNull();
    expect(gradeFromRaw(undefined)).toBeNull();
  });
  test("0 → 0.0", () => { expect(gradeFromRaw(0)).toBe(0); });
  test("negative raw → signed grade (mirror of positive curve)", () => {
    expect(gradeFromRaw(-3.1)).toBeCloseTo(-1.62, 1);
    expect(gradeFromRaw(-12)).toBeCloseTo(-3.19, 1);
  });
  test("raw ≤ -120 caps at -10.0", () => {
    expect(gradeFromRaw(-120)).toBe(-10);
    expect(gradeFromRaw(-1000)).toBe(-10);
  });
  // Square-root curve calibrated against Real App: 0.92 × sqrt(raw)
  test("raw ≈25 → ~4.6 (LeBron 24.9 → Real 4.6)", () => {
    expect(gradeFromRaw(24.9)).toBeCloseTo(4.59, 1);
  });
  test("raw ≈48 → ~6.4 (Barnes 47.9 → Real 6.4)", () => {
    expect(gradeFromRaw(47.9)).toBeCloseTo(6.37, 1);
  });
  test("raw 12 → ~3.2 (solid bench scoring night)", () => {
    expect(gradeFromRaw(12)).toBeCloseTo(3.19, 1);
  });
  test("raw ≥120 caps at 10.0", () => {
    expect(gradeFromRaw(120)).toBe(10);
    expect(gradeFromRaw(1000)).toBe(10);
  });
});

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

  test("scorer: omitting assisted treats as unassisted (undefined → falsy)", () => {
    // Defensive: ctxFromPlay (Task 5) explicitly sets assisted, but pre-Task-5
    // intermediate state may omit the field entirely. Confirms `if (ctx.assisted)`
    // truthy check works for undefined.
    expect(baseValue("scorer", { type: "made_3pt", distance: 24 }))
      .toBeCloseTo(1.52, 2);
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

  test("flagrant 1 + shooting both set → foulType wins (foul severity priority)", () => {
    // Defensive: confirms the nested switch returns -2.0 for flagrant1 even when
    // ctx.shooting is also true. Should never AND the two signals.
    expect(baseValue("foul_committer", { foulType: "flagrant1", shooting: true })).toBe(-2.0);
  });

  test("unknown role → 0", () => { expect(baseValue("mystery", {})).toBe(0); });
});

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

  test("non-finite wpaDelta (NaN, Infinity) returns 0", () => {
    expect(wpaContribution(NaN, "home", "scorer", {})).toBe(0);
    expect(wpaContribution(Infinity, "home", "scorer", {})).toBe(0);
    expect(wpaContribution("garbage", "home", "scorer", {})).toBe(0);
  });
});

describe("clampPlayValue (model space, ±6)", () => {
  test("normal range passes through", () => { expect(clampPlayValue(2.3)).toBe(2.3); });
  test("clamps to +6", () => { expect(clampPlayValue(20)).toBe(6); });
  test("clamps to -6", () => { expect(clampPlayValue(-25)).toBe(-6); });
  test("boundary +6 stays +6", () => { expect(clampPlayValue(6)).toBe(6); });
  test("boundary -6 stays -6", () => { expect(clampPlayValue(-6)).toBe(-6); });
});

describe("displayValue (10/6 scale)", () => {
  test("0 stays 0", () => { expect(displayValue(0)).toBe(0); });
  test("+6 → +10", () => { expect(displayValue(6)).toBeCloseTo(10, 5); });
  test("-6 → -10", () => { expect(displayValue(-6)).toBeCloseTo(-10, 5); });
  test("+3 → +5", () => { expect(displayValue(3)).toBeCloseTo(5, 5); });
});

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
    // weighted_value is stored in display space (±10) after model-space clamp at ±6 then × 10/6
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
    // Unassisted made 3pt at 24ft: base = 1.52 (model space) → × 10/6 ≈ 2.53 (display space)
    expect(insertArgs[6][0]).toBeCloseTo(1.52 * (10 / 6), 1);
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

  test("ctxFromPlay heave detection: malformed multi-colon clock returns no heave", async () => {
    // Defensive: parseClockSeconds rejects "1:2:3" so isHeave stays false.
    mockGetWinProbability.mockResolvedValue(null);
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ league: "nba", eventid: 999, status: "Final", hometeamid: 1, awayteamid: 2 }] })
        .mockResolvedValueOnce({ rows: [
          { id: 501, sequence: 1, period: 4, clock: "1:2:3", espn_play_id: "p1",
            scoring_play: false, shot_distance_ft: 50, play_type: "Jump Shot",
            team_id: 1, home_team_id: 1, away_team_id: 2, home_score: 0, away_score: 0 },
        ]})
        .mockResolvedValueOnce({ rows: [
          { play_id: 501, player_id: 11, role: "shot_attempter", team_side: "home" },
        ]})
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({ rowCount: 1 }),
    };
    await recomputeGame(client, 100);
    // role should be "shot_attempter" (not heave_attempter) since malformed clock = no heave
    const insertArgs = client.query.mock.calls[4][1];
    expect(insertArgs[3]).toEqual(["shot_attempter"]);
  });
});
