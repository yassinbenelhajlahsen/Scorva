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

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/cache/seasons.js"),
  () => ({ getCurrentSeason: jest.fn().mockResolvedValue("2025-26") }),
);

const { getTopPerformances, resolveWindow, positionPredicate } =
  await import("../../../src/services/games/topPerformancesService.js");

beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

describe("getTopPerformances", () => {
  test("type=games (legacy) — returns shaped rows with ratingGrade computed", async () => {
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

    expect(out.type).toBe("performances");
    expect(out.window).toBe("week");
    expect(out.performances).toHaveLength(1);
    expect(out.performances[0].rating).toBeCloseTo(34.4, 1);
    expect(out.performances[0].ratingGrade).toBeCloseTo(5.4, 1);
    expect(out.performances[0].player.team.primary_color).toBe("#00538C");
    expect(mockCached).toHaveBeenCalledWith(
      "top-performances:nba:performances:week:desc:all:5",
      60,
      expect.any(Function),
    );
  });

  test("type=cumulative (legacy) — group by player, totalRating + bestGame", async () => {
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

    expect(out.type).toBe("rankings");
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

  test("legacy days param maps to window", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await getTopPerformances({ league: "nba", days: 999, type: "games", limit: 5 });
    expect(mockQuery.mock.calls[0][0]).toMatch(/INTERVAL '30 days'/);
    await getTopPerformances({ league: "nba", days: 0, type: "games", limit: 5 });
    expect(mockQuery.mock.calls[1][0]).toMatch(/g\.date >= \(NOW\(\) AT TIME ZONE 'America\/New_York'\)::date - 1/);
  });
});

describe("resolveWindow", () => {
  test("today → rolling 24h window (yesterday + today, NY tz)", () => {
    const w = resolveWindow("today");
    expect(w.predicate).toBe("g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - 1");
    expect(w.binds).toEqual([]);
  });
  test("week → 7-day window", () => {
    const w = resolveWindow("week");
    expect(w.predicate).toContain("INTERVAL '7 days'");
  });
  test("month → 30-day window", () => {
    const w = resolveWindow("month");
    expect(w.predicate).toContain("INTERVAL '30 days'");
  });
  test("season → bound on g.season", () => {
    const w = resolveWindow("season", { season: "2025-26", startIdx: 1 });
    expect(w.predicate).toBe("g.season = $1");
    expect(w.binds).toEqual(["2025-26"]);
    expect(w.nextIdx).toBe(2);
  });
  test("season honors startIdx for placeholder numbering", () => {
    const w = resolveWindow("season", { season: "2025-26", startIdx: 5 });
    expect(w.predicate).toBe("g.season = $5");
    expect(w.nextIdx).toBe(6);
  });
  test("all → no predicate", () => {
    const w = resolveWindow("all");
    expect(w.predicate).toBe("");
    expect(w.binds).toEqual([]);
  });
  test("invalid window throws", () => {
    expect(() => resolveWindow("garbage")).toThrow(/window/);
  });
});

describe("positionPredicate", () => {
  test.each([
    ["all", ""],
    ["G",   "p.position ~* '^(PG|SG|G)'"],
    ["F",   "p.position ~* '^(SF|PF|F)'"],
    ["C",   "p.position ~* '^C'"],
  ])("%s", (pos, expected) => {
    expect(positionPredicate(pos)).toBe(expected);
  });
  test("invalid throws", () => {
    expect(() => positionPredicate("Q")).toThrow(/position/);
  });
});

describe("getTopPerformances — new params", () => {
  beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

  test("type=performances + window=week + sort=asc orders ASC", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "week",
      sort: "asc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY s\.rating ASC/);
    expect(sql).toMatch(/INTERVAL '7 days'/);
  });

  test("type=rankings + position=G injects position predicate", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "rankings", window: "month",
      sort: "desc", position: "G", limit: 10,
    });
    expect(mockQuery.mock.calls[0][0]).toMatch(/p\.position ~\* '\^\(PG\|SG\|G\)'/);
  });

  test("window=season uses g.season binding", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "season",
      sort: "desc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    const binds = mockQuery.mock.calls[0][1];
    expect(sql).toMatch(/g\.season = \$\d/);
    expect(binds).toContain("2025-26");
  });

  test("window=all → no date predicate", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "all",
      sort: "desc", position: "all", limit: 10,
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).not.toMatch(/g\.date >=/);
    expect(sql).not.toMatch(/g\.date =/);
    expect(sql).not.toMatch(/g\.season =/);
  });

  test("legacy: type=games + days=7 still works", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const out = await getTopPerformances({ league: "nba", days: 7, type: "games", limit: 5 });
    expect(out.type).toBe("performances");
    expect(mockQuery.mock.calls[0][0]).toMatch(/INTERVAL '7 days'/);
  });

  test("cache key includes all filters", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "week",
      sort: "desc", position: "G", limit: 10,
    });
    expect(mockCached).toHaveBeenCalledWith(
      "top-performances:nba:performances:week:desc:G:10",
      expect.any(Number),
      expect.any(Function),
    );
  });

  test("today TTL is 30s", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "performances", window: "today",
      sort: "desc", position: "all", limit: 10,
    });
    expect(mockCached).toHaveBeenCalledWith(expect.any(String), 30, expect.any(Function));
  });
});

describe("queryPlays (type=plays)", () => {
  beforeEach(() => { mockQuery.mockReset(); mockCached.mockClear(); });

  test("returns shaped play rows", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          play_id: 9001, player_id: 11, game_id: 100,
          weighted_value: "4.8", wpa_delta: "0.18",
          period: 4, clock: "0:32",
          description: "Stephen Curry makes 27-foot three pointer",
          name: "Stephen Curry", image_url: "/curry.png", position: "G",
          date: new Date("2026-05-05"),
          hometeamid: 1, awayteamid: 2, homescore: 110, awayscore: 105,
          team_id: 1, abbreviation: "GSW", logo_url: "/gsw.png", primary_color: "#1D428A",
          opp_id: 2, opp_abbreviation: "LAL", opp_logo_url: "/lal.png",
        },
      ],
    });

    const out = await getTopPerformances({
      league: "nba", type: "plays", window: "week",
      sort: "desc", position: "all", limit: 10,
    });

    expect(out.type).toBe("plays");
    const row = out.performances[0];
    expect(row.play.id).toBe(9001);
    expect(row.play.weightedValue).toBeCloseTo(4.8, 1);
    expect(row.play.wpaDelta).toBeCloseTo(0.18, 2);
    expect(row.play.description).toMatch(/Curry/);
    expect(row.play.period).toBe(4);
    expect(row.play.clock).toBe("0:32");
    expect(row.player.name).toBe("Stephen Curry");
    expect(row.game.id).toBe(100);
    expect(row.game.opponent.abbreviation).toBe("LAL");
  });

  test("sort=asc orders by weighted_value ASC", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getTopPerformances({
      league: "nba", type: "plays", window: "week",
      sort: "asc", position: "all", limit: 10,
    });
    expect(mockQuery.mock.calls[0][0]).toMatch(/ORDER BY pr\.weighted_value ASC/);
  });
});
