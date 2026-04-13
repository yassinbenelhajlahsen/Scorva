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
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it("returns standings rows from query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockTeam] });

    const result = await getStandings("nba");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      name: "Boston Celtics",
      wins: 35,
      losses: 10,
    });
    expect(result[0]).toHaveProperty("winPct");
    expect(result[0]).toHaveProperty("pointDiff");
  });

  it("returns empty array when no teams found", async () => {
    const result = await getStandings("nhl");

    expect(result).toEqual([]);
  });

  it("uses provided season in query params", async () => {
    await getStandings("nba", "2024-25");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", "2024-25"]
    );
  });

  it("passes null when no season provided (SQL uses COALESCE)", async () => {
    await getStandings("nfl");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nfl", null]
    );
  });

  it("uses 300s TTL for current season", async () => {
    await getStandings("nba", "2025-26");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(CURRENT_TTL);
  });

  it("uses 30-day TTL for historical seasons", async () => {
    await getStandings("nba", "2024-25");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(HISTORICAL_TTL);
  });

  it("uses current season TTL when no season param provided", async () => {
    await getStandings("nba");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(CURRENT_TTL);
  });

  it("cache key includes league and resolved season", async () => {
    await getStandings("nba", "2024-25");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("standings:nba:2024-25");
  });

  it("SQL filters by regular game type", async () => {
    await getStandings("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("type IN ('regular', 'makeup')");
  });

  it("SQL filters Final status", async () => {
    await getStandings("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("Final");
  });

  it("sorts teams by win percentage with H2H tiebreaker", async () => {
    const teamA = { ...mockTeam, id: 1, conf: "Eastern", wins: 30, losses: 15 };
    const teamB = { ...mockTeam, id: 2, conf: "Eastern", wins: 35, losses: 10, name: "Miami Heat" };
    mockPool.query.mockResolvedValueOnce({ rows: [teamA, teamB] });

    const result = await getStandings("nba");

    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });

  it("computes winPct for NBA teams", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockTeam] });

    const result = await getStandings("nba");

    expect(result[0].winPct).toBeCloseTo(35 / 45);
  });

  it("computes ptsPct for NHL teams", async () => {
    const nhlTeam = { ...mockTeam, id: 1, conf: "Eastern", wins: 30, losses: 20, otl: 5 };
    mockPool.query.mockResolvedValueOnce({ rows: [nhlTeam] });

    const result = await getStandings("nhl");

    expect(result[0].ptsPct).toBeCloseTo((2 * 30 + 5) / (2 * 50));
    expect(result[0]).not.toHaveProperty("winPct");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      jest.clearAllMocks();
      mockGetCurrentSeason.mockResolvedValue("2025-26");
      mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPool.query.mockResolvedValue({ rows: [] });
      await getStandings(league);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [league, null]);
    }
  });
});
