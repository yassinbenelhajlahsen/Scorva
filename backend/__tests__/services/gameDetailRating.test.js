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
