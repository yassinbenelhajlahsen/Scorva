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
          playerid: 11, gameid: 100, rating: "34.4",
          name: "Luka Dončić", image_url: "/luka.png", position: "G",
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
    expect(out.performances[0].rating).toBeCloseTo(34.4, 1);
    expect(out.performances[0].ratingGrade).toBeCloseTo(5.4, 1);
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
          name: "Nikola Jokić", image_url: "/jokic.png", position: "C",
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
