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
        home_rating: "147.5",
        away_rating: "132.5",
        game_rating: "280.0",
        status: "Final",
        homescore: 118, awayscore: 115,
      }],
    });
    const map = await ratingsForGames(mockPool, [7]);
    const r = map.get(7);
    expect(r.gameRating).toBe(280);
    expect(r.homeTeamRating).toBe(147.5);
    expect(r.awayTeamRating).toBe(132.5);
    // Linear: game_grade = 280/50 = 5.6; team_grade = raw/25.
    expect(r.gameGrade).toBeCloseTo(5.6, 1);
    expect(r.homeGrade).toBeCloseTo(5.9, 1);
    expect(r.awayGrade).toBeCloseTo(5.3, 1);
  });

  test("handles single-team aggregate (one side null)", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        gameid: 9,
        home_rating: "40.0",
        away_rating: null,
        game_rating: "40.0",
        status: "In Progress - Q1",
        homescore: 0, awayscore: 0,
      }],
    });
    const r = (await ratingsForGames(mockPool, [9])).get(9);
    expect(r.homeTeamRating).toBe(40);
    expect(r.awayTeamRating).toBeNull();
    expect(r.awayGrade).toBeNull();
    // 40/25 = 1.6
    expect(r.homeGrade).toBeCloseTo(1.6, 1);
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
