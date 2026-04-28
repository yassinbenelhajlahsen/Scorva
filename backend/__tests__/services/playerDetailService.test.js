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

const { getNbaPlayer, getNflPlayer, getNhlPlayer } = await import(
  resolve(__dirname, "../../src/services/players/playerDetailService.js")
);

const CURRENT_TTL = 120;
const HISTORICAL_TTL = 30 * 86400;

const playerRow = { json_build_object: { id: 1, name: "LeBron James" } };

describe("playerDetailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
  });

  describe.each([
    { fn: () => getNbaPlayer, league: "nba", name: "getNbaPlayer" },
    { fn: () => getNflPlayer, league: "nfl", name: "getNflPlayer" },
    { fn: () => getNhlPlayer, league: "nhl", name: "getNhlPlayer" },
  ])("$name", ({ fn, league }) => {
    it("returns the first row from query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [playerRow] });

      const result = await fn()(42, "2025-26");

      expect(result).toEqual(playerRow);
    });

    it("returns null when player not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await fn()(999, "2025-26");

      expect(result).toBeNull();
    });

    it("uses 120s TTL for current season", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(1, "2025-26");

      const [, ttl] = mockCached.mock.calls[0];
      expect(ttl).toBe(CURRENT_TTL);
    });

    it("uses 30-day TTL for historical seasons", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(1, "2024-25");

      const [, ttl] = mockCached.mock.calls[0];
      expect(ttl).toBe(HISTORICAL_TTL);
    });

    it("uses correct cache key format", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(7, "2025-26");

      const [key] = mockCached.mock.calls[0];
      expect(key).toBe(`playerDetail:${league}:7:2025-26`);
    });

    it("passes league, playerId, season, currentSeason to DB query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(7, "2025-26");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [league, 7, "2025-26", "2025-26"]
      );
    });

    it("calls getCurrentSeason to determine TTL", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(1, "2025-26");

      expect(mockGetCurrentSeason).toHaveBeenCalledWith(league);
    });

    it("SQL includes the awards subquery", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(1, "2025-26");

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("'awards'");
      expect(sql).toContain("FROM player_awards pa");
      expect(sql).toContain("pa.player_id = p.id");
      expect(sql).toContain("pa.league = $1");
    });
  });
});
