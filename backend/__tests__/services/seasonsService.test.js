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

const { getSeasons } = await import(
  resolve(__dirname, "../../src/services/meta/seasonsService.js")
);

describe("getSeasons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  it("returns mapped season strings (not row objects)", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ season: "2025-26" }, { season: "2024-25" }, { season: "2023-24" }],
    });

    const result = await getSeasons("nba");

    expect(result).toEqual(["2025-26", "2024-25", "2023-24"]);
  });

  it("returns empty array when no seasons found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getSeasons("nfl");

    expect(result).toEqual([]);
  });

  it("passes league as query param", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nhl");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl"]);
  });

  it("uses 24-hour TTL", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [, ttl] = mockCached.mock.calls[0];
    expect(ttl).toBe(86400);
  });

  it("cache key includes league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("seasons:nba");
  });

  it("SQL uses DISTINCT season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("DISTINCT");
    expect(sql).toContain("season");
  });

  it("SQL orders by season DESC", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("DESC");
  });

  it("SQL has no row limit", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).not.toContain("LIMIT");
  });

  it("SQL excludes NULL seasons", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getSeasons("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("IS NOT NULL");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await getSeasons(league);
      expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), [league]);
    }
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getSeasons("nba")).rejects.toThrow("DB error");
  });
});
