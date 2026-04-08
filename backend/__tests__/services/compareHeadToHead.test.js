import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({
  cached: jest.fn().mockImplementation(async (_k, _t, fn) => fn()),
}));

const servicePath = resolve(__dirname, "../../src/services/headToHeadService.js");
const { getHeadToHead } = await import(servicePath);

describe("headToHeadService (compare)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("teams", () => {
    it("queries games where both teams played each other", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nba", "teams", 1, 2);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("hometeamid IN");
      expect(sql).toContain("awayteamid IN");
      expect(params).toContain("nba");
    });

    it("returns game rows", async () => {
      const mockGames = [
        { id: 1, date: "2025-01-10", homescore: 110, awayscore: 105 },
        { id: 2, date: "2025-02-15", homescore: 98, awayscore: 102 },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockGames });

      const result = await getHeadToHead("nba", "teams", 1, 2);

      expect(result).toEqual(mockGames);
    });

    it("filters Final games only", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nba", "teams", 1, 2);

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("Final");
    });

    it("limits to 20 results", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nba", "teams", 1, 2);

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("LIMIT 20");
    });

    it("orders by date DESC", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nba", "teams", 1, 2);

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("ORDER BY g.date DESC");
    });
  });

  describe("players", () => {
    it("joins stats twice for both player IDs", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nba", "players", 10, 20);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("stats s1");
      expect(sql).toContain("stats s2");
      expect(sql).toContain("s1.gameid = s2.gameid");
      expect(params).toContain(10);
      expect(params).toContain(20);
    });

    it("returns game rows for player matchups", async () => {
      const mockGames = [
        { id: 5, date: "2025-03-01", homescore: 115, awayscore: 110 },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockGames });

      const result = await getHeadToHead("nba", "players", 10, 20);

      expect(result).toEqual(mockGames);
    });

    it("filters Final games only", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getHeadToHead("nhl", "players", 1, 2);

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("Final");
    });
  });

  describe("caching", () => {
    it("returns empty array when no matchups found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getHeadToHead("nfl", "teams", 5, 6);

      expect(result).toEqual([]);
    });

    it("uses sorted IDs for consistent cache keys", async () => {
      const { cached } = await import(cachePath);
      mockPool.query.mockResolvedValue({ rows: [] });

      await getHeadToHead("nba", "teams", 5, 3);

      expect(cached).toHaveBeenCalledWith(
        expect.stringContaining("3:5"),
        expect.any(Number),
        expect.any(Function)
      );
    });
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("connection lost"));

    await expect(getHeadToHead("nba", "teams", 1, 2)).rejects.toThrow("connection lost");
  });
});
