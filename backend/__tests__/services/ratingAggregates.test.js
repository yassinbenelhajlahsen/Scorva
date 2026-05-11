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
    })).toBe("Great");
  });

  test("Close requires both criteria — margin ok but grade gap too wide", () => {
    expect(tierLabel({
      gameGrade: 8.0, homeGrade: 8.0, awayGrade: 4.0,
      status: "Final", homeScore: 118, awayScore: 115,
    })).toBe("Great");
  });
});
