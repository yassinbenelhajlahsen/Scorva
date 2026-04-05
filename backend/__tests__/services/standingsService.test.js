import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const { getStandings } = await import(
  resolve(__dirname, "../../src/services/standingsService.js")
);

const CURRENT_TTL = 300;
const HISTORICAL_TTL = 30 * 86400;

const mockTeam = {
  id: 1,
  name: "Boston Celtics",
  shortname: "BOS",
  location: "Boston",
  conf: "Eastern",
  logo_url: "https://example.com/bos.png",
  wins: 35,
  losses: 10,
};

describe("getStandings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  it("returns standings rows from query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockTeam] });

    const result = await getStandings("nba");

    expect(result).toEqual([mockTeam]);
  });

  it("returns empty array when no teams found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getStandings("nhl");

    expect(result).toEqual([]);
  });

  it("uses provided season in query params", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba", "2024-25");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", "2024-25"]
    );
  });

  it("passes null when no season provided (SQL uses COALESCE)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nfl");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nfl", null]
    );
  });

  it("uses 300s TTL for current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba", "2025-26");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(CURRENT_TTL);
  });

  it("uses 30-day TTL for historical seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba", "2024-25");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(HISTORICAL_TTL);
  });

  it("uses current season TTL when no season param provided", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(CURRENT_TTL);
  });

  it("cache key includes league and resolved season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba", "2024-25");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("standings:nba:2024-25");
  });

  it("SQL filters by regular game type", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("type = 'regular'");
  });

  it("SQL filters Final status", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("Final");
  });

  it("SQL orders by conf, wins DESC, losses ASC", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStandings("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("wins DESC, losses ASC");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await getStandings(league);
      expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), [league, null]);
    }
  });
});
