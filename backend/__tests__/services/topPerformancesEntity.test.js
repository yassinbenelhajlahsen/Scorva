import { jest } from "@jest/globals";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = { query: jest.fn() };
const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockGetPlayerIdBySlug = jest.fn().mockResolvedValue(null);

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({ default: mockPool }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({ cached: mockCached }));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({ getCurrentSeason: mockGetCurrentSeason }));
jest.unstable_mockModule(resolve(__dirname, "../../src/utils/slugResolver.js"), () => ({
  getPlayerIdBySlug: mockGetPlayerIdBySlug,
}));

const { getTopPerformances } = await import("../../src/services/games/topPerformancesService.js");

beforeEach(() => { jest.clearAllMocks(); });

test("entity=team, type=rankings returns cumulative team ratings", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      team_id: 13, name: "Lakers", abbreviation: "LAL", logo_url: "x", primary_color: "#552583",
      total_rating: "152.3", games_played: "8", avg_per_game: "19.0",
      best_game_id: 42, best_game_rating: "26.4", best_opp_abbreviation: "BOS",
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "rankings", entity: "team", window: "week",
  });
  expect(out.type).toBe("rankings");
  expect(out.performances[0].team.id).toBe(13);
  expect(out.performances[0].totalRating).toBe(152.3);
  expect(out.performances[0].bestGame.gameId).toBe(42);
});

test("entity=team, type=performances supports teamId scope", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      gameid: 7, team_id: 13, name: "Lakers", abbreviation: "LAL", logo_url: "x", primary_color: "#552583",
      home_rating: "18.4", away_rating: "16.2", date: "2026-05-09",
      hometeamid: 13, awayteamid: 21, homescore: 118, awayscore: 115, status: "Final",
      opp_id: 21, opp_abbreviation: "BOS", opp_logo_url: "y",
      is_live: false,
      team_rating: "18.4",
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "performances", entity: "team", teamId: 13, window: "week",
  });
  expect(out.performances[0].team.id).toBe(13);
  expect(out.performances[0].game.id).toBe(7);
  expect(out.performances[0].rating).toBe(18.4);
  expect(out.performances[0].game.result).toBe("W");
});

test("entity=game, type=performances returns per-game rows with both teams", async () => {
  mockPool.query.mockResolvedValueOnce({
    rows: [{
      gameid: 7,
      home_rating: "18.4", away_rating: "16.2", game_rating: "34.6",
      status: "Final", date: "2026-05-09",
      hometeamid: 13, awayteamid: 21, homescore: 118, awayscore: 115,
      home_name: "Lakers", home_abbr: "LAL", home_logo: "x", home_color: "#552583",
      away_name: "Celtics", away_abbr: "BOS", away_logo: "y", away_color: "#007A33",
      is_live: false,
    }],
  });
  const out = await getTopPerformances({
    league: "nba", type: "performances", entity: "game", window: "week",
  });
  expect(out.performances[0].game.id).toBe(7);
  expect(out.performances[0].homeTeamRating).toBe(18.4);
  expect(out.performances[0].awayTeamRating).toBe(16.2);
  expect(out.performances[0].rating).toBe(34.6);
  expect(out.performances[0].tierLabel).toBeTruthy();
});

test("entity=game, type=rankings returns 400", async () => {
  await expect(getTopPerformances({
    league: "nba", type: "rankings", entity: "game", window: "week",
  })).rejects.toMatchObject({ status: 400 });
});

test("position ignored when entity != player (no error on G with team entity)", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [] });
  await getTopPerformances({
    league: "nba", type: "performances", entity: "team", position: "G", window: "week",
  });
  // Position predicate must NOT appear in the SQL
  const sql = mockPool.query.mock.calls[0][0];
  expect(sql).not.toMatch(/p\.position/);
});

test("back-compat: missing entity defaults to player", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [] });
  const out = await getTopPerformances({
    league: "nba", type: "performances", window: "week",
  });
  expect(out.type).toBe("performances");
  // Player-shape SQL still includes position-allowed join on players
  const sql = mockPool.query.mock.calls[0][0];
  expect(sql).toMatch(/players p/);
});
