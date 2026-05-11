// backend/__tests__/services/gamesServiceRating.test.js
import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockRatingsForGames = jest.fn();

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({ cached: mockCached }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({ getCurrentSeason: mockGetCurrentSeason }));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/games/ratingAggregates.js"), () => ({
  ratingsForGames: mockRatingsForGames,
}));

const { getGames, getLiveGamePartial } = await import("../../src/services/games/gamesService.js");

beforeEach(() => { jest.clearAllMocks(); });

test("getGames attaches { rating, grade } to each NBA game row", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ id: 1, league: "nba" }, { id: 2, league: "nba" }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([
    [1, { gameRating: 34.6, gameGrade: 5.4 }],
    [2, { gameRating: null, gameGrade: null }],
  ]));

  const rows = await getGames("nba", { teamId: 5 });
  expect(rows[0].rating).toBe(34.6);
  expect(rows[0].grade).toBe(5.4);
  expect(rows[1].rating).toBeNull();
  expect(rows[1].grade).toBeNull();
});

test("getGames does not call ratingsForGames for non-NBA leagues", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10, league: "nhl" }] });
  const rows = await getGames("nhl", { teamId: 5 });
  expect(mockRatingsForGames).not.toHaveBeenCalled();
  expect(rows[0].rating).toBeUndefined();
});

test("getLiveGamePartial includes rating/grade for NBA", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{ id: 1, status: "In Progress", homescore: 50, awayscore: 48, current_period: 3, clock: "5:00" }],
  });
  mockRatingsForGames.mockResolvedValueOnce(new Map([[1, { gameRating: 18.2, gameGrade: 3.9 }]]));

  const p = await getLiveGamePartial("nba", "401234");
  expect(p.rating).toBe(18.2);
  expect(p.grade).toBe(3.9);
});
