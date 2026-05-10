import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const { getTeamsByLeague, getTeamNextGame } = await import(
  resolve(__dirname, "../../src/services/teams/teamsService.js")
);

const mockTeam = {
  id: 1,
  name: "Los Angeles Lakers",
  shortname: "LAL",
  conf: "Western",
  league: "nba",
};

describe("getTeamsByLeague", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  it("returns team rows from query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockTeam] });

    const result = await getTeamsByLeague("nba");

    expect(result).toEqual([mockTeam]);
  });

  it("returns empty array when no teams found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getTeamsByLeague("nhl");

    expect(result).toEqual([]);
  });

  it("passes league as query param", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamsByLeague("nfl");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nfl"]);
  });

  it("uses 24-hour TTL", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamsByLeague("nba");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(86400);
  });

  it("cache key includes league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamsByLeague("nba");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("teams:nba");
  });

  it("SQL orders by conf, name", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamsByLeague("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("conf, name");
  });

  it("SQL filters by league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamsByLeague("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("league");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await getTeamsByLeague(league);
      expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), [league]);
    }
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getTeamsByLeague("nba")).rejects.toThrow("DB error");
  });
});

describe("getTeamNextGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  it("returns null when no upcoming scheduled games exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getTeamNextGame("nba", 1);

    expect(result).toBeNull();
  });

  it("returns the next game with opponent set to away team when player team is home", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 99,
          league: "nba",
          date: "2026-05-12",
          start_time: "7:30 PM",
          status: "Scheduled",
          hometeamid: 1,
          awayteamid: 2,
          home_shortname: "LAL",
          home_logo: "https://example.com/lal.png",
          away_shortname: "BOS",
          away_logo: "https://example.com/bos.png",
        },
      ],
    });

    const result = await getTeamNextGame("nba", 1);

    expect(result).toEqual({
      id: 99,
      league: "nba",
      date: "2026-05-12",
      startTime: "7:30 PM",
      status: "Scheduled",
      isHome: true,
      opponent: { id: 2, shortname: "BOS", logoUrl: "https://example.com/bos.png" },
    });
  });

  it("flips opponent to home team when player team is away", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 100,
          league: "nba",
          date: "2026-05-12",
          start_time: null,
          status: "Scheduled",
          hometeamid: 2,
          awayteamid: 1,
          home_shortname: "BOS",
          home_logo: "https://example.com/bos.png",
          away_shortname: "LAL",
          away_logo: "https://example.com/lal.png",
        },
      ],
    });

    const result = await getTeamNextGame("nba", 1);

    expect(result.isHome).toBe(false);
    expect(result.opponent).toEqual({
      id: 2,
      shortname: "BOS",
      logoUrl: "https://example.com/bos.png",
    });
  });

  it("queries with team id and Scheduled status filter", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamNextGame("nba", 7);

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("g.status = 'Scheduled'");
    expect(sql).toContain("ORDER BY g.date ASC, g.id ASC");
    expect(sql).toContain("LIMIT 1");
    expect(params[0]).toBe("nba");
    expect(params[1]).toBe(7);
  });
});
