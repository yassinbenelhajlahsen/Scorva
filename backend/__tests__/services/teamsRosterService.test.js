import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());
const mockGetCurrentSeason = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({ getCurrentSeason: mockGetCurrentSeason }));

const { getTeamRoster } = await import(
  resolve(__dirname, "../../src/services/teams/teamsService.js")
);

const mockPlayer = {
  id: 1,
  name: "LeBron James",
  position: "F",
  jerseynum: 23,
  image_url: "https://example.com/lebron.jpg",
  status: null,
  status_description: null,
  status_updated_at: null,
  espn_playerid: 1966,
};

describe("getTeamRoster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  it("uses the players-table query for the current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockPlayer] });

    const result = await getTeamRoster("nba", 17, "2025-26");

    expect(result).toEqual([mockPlayer]);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
    expect(params).toEqual(["nba", 17]);
  });

  it("uses the players-table query when no season is passed", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, null);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
  });

  it("uses the stats-join query for historical seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockPlayer] });

    const result = await getTeamRoster("nba", 17, "2022-23");

    expect(result).toEqual([mockPlayer]);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players p");
    expect(sql).toContain("JOIN stats s");
    expect(sql).toContain("JOIN games g");
    expect(sql).toContain("COALESCE(s.teamid, p.teamid)");
    expect(params).toEqual(["nba", 17, "2022-23"]);
  });

  it("filters historical games to regular, makeup, playoff, and final", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2022-23");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("g.type IN");
    expect(sql).toContain("'regular'");
    expect(sql).toContain("'makeup'");
    expect(sql).toContain("'playoff'");
    expect(sql).toContain("'final'");
  });

  it("orders results by position NULLS LAST then name", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2025-26");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("position");
    expect(sql).toContain("NULLS LAST");
  });

  it("uses 5-minute TTL for the current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2025-26");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(300);
  });

  it("uses 30-day TTL for historical seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, "2022-23");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(30 * 86400);
  });

  it("cache key includes league, teamId, and effective season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getTeamRoster("nba", 17, null);

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("roster:nba:17:2025-26");
  });

  it("returns an empty array when no rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getTeamRoster("nhl", 5, null);

    expect(result).toEqual([]);
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getTeamRoster("nba", 17, null)).rejects.toThrow("DB error");
  });
});
