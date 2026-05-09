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
    // weighted_value should equal base_value (made 3pt at 24ft = 1.52, rounded to NUMERIC(4,1) = 1.5)
    expect(insertArgs[6][0]).toBeCloseTo(1.5, 1);
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
