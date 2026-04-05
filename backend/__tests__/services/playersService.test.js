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

const { getPlayersByLeague } = await import(
  resolve(__dirname, "../../src/services/playersService.js")
);

const mockPlayer = {
  id: 1,
  name: "LeBron James",
  position: "F",
  league: "nba",
  teamid: 1,
};

describe("getPlayersByLeague", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  it("returns player rows from query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockPlayer] });

    const result = await getPlayersByLeague("nba");

    expect(result).toEqual([mockPlayer]);
  });

  it("returns empty array when no players found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getPlayersByLeague("nhl");

    expect(result).toEqual([]);
  });

  it("passes league as query param", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayersByLeague("nfl");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nfl"]);
  });

  it("uses 24-hour TTL", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayersByLeague("nba");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(86400);
  });

  it("cache key includes league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayersByLeague("nba");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("players:nba");
  });

  it("SQL orders by position", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayersByLeague("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("position");
  });

  it("SQL filters by league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayersByLeague("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("league");
  });

  it("returns multiple players", async () => {
    const players = [mockPlayer, { ...mockPlayer, id: 2, name: "Anthony Davis", position: "C" }];
    mockPool.query.mockResolvedValueOnce({ rows: players });

    const result = await getPlayersByLeague("nba");

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Anthony Davis");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await getPlayersByLeague(league);
      expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), [league]);
    }
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getPlayersByLeague("nba")).rejects.toThrow("DB error");
  });
});
