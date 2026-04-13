import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

// cache is a no-op without Redis — it calls the queryFn directly
const { getGames, getGameDates } = await import(
  resolve(__dirname, "../../src/services/games/gamesService.js")
);

const mockGame = {
  id: 1,
  league: "nba",
  date: new Date("2025-01-15T00:00:00.000Z"),
  status: "Final",
  season: "2025-26",
  homescore: 110,
  awayscore: 105,
  home_team_name: "Lakers",
  away_team_name: "Celtics",
};

describe("gamesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  // ─── getGameDates ──────────────────────────────────────────────────────────

  describe("getGameDates", () => {
    it("returns dates with counts mapped through pgDateToString", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { date: new Date("2025-01-15T00:00:00.000Z"), count: "3" },
          { date: new Date("2025-01-16T00:00:00.000Z"), count: "2" },
        ],
      });

      const result = await getGameDates("nba");

      expect(result).toEqual([
        { date: "2025-01-15", count: 3 },
        { date: "2025-01-16", count: 2 },
      ]);
    });

    it("uses provided season when passed", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGameDates("nba", "2024-25");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT date, COUNT(*)"),
        ["nba", "2024-25"]
      );
      expect(mockGetCurrentSeason).not.toHaveBeenCalled();
    });

    it("falls back to getCurrentSeason when no season provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGameDates("nfl");

      expect(mockGetCurrentSeason).toHaveBeenCalledWith("nfl");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["nfl", "2025-26"]
      );
    });

    it("casts count to Number", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ date: new Date("2025-01-15T00:00:00.000Z"), count: "5" }],
      });

      const result = await getGameDates("nba");
      expect(typeof result[0].count).toBe("number");
      expect(result[0].count).toBe(5);
    });
  });

  // ─── getGames — teamId / season branch ────────────────────────────────────

  describe("getGames — teamId branch", () => {
    it("filters by teamId in query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { teamId: 5 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("hometeamid, g.awayteamid"),
        ["nba", null, 5]
      );
      expect(result).toEqual([mockGame]);
    });

    it("does not apply LIMIT when teamId is provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGames("nba", { teamId: 3 });

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).not.toMatch(/LIMIT 12/);
    });

    it("orders by date DESC", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGames("nba", { teamId: 1 });

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("ORDER BY g.date DESC");
    });
  });

  describe("getGames — season branch", () => {
    it("filters by season and applies LIMIT 12 when no teamId", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { season: "2024-25" });

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(params[1]).toBe("2024-25");
      expect(sql).toContain("LIMIT 12");
      expect(result).toEqual([mockGame]);
    });

    it("uses getCurrentSeason to determine TTL when season provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGames("nba", { season: "2024-25" });

      expect(mockGetCurrentSeason).toHaveBeenCalledWith("nba");
    });
  });

  // ─── getGames — date branch ────────────────────────────────────────────────

  describe("getGames — date branch", () => {
    it("returns { games, resolvedDate, resolvedSeason } shape", async () => {
      // getSeasonForDate direct match
      mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });
      // main date query
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { date: "2025-01-15" });

      expect(result).toHaveProperty("games");
      expect(result).toHaveProperty("resolvedDate");
      expect(result).toHaveProperty("resolvedSeason");
      expect(result.resolvedSeason).toBe("2025-26");
      expect(result.resolvedDate).toBe("2025-01-15");
      expect(result.games).toEqual([mockGame]);
    });

    it("uses provided season without calling getSeasonForDate", async () => {
      // main date query only
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { date: "2025-01-15", season: "2025-26" });

      // Only 1 query (getSeasonForDate skipped when season is provided)
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(result.resolvedSeason).toBe("2025-26");
    });

    it("triggers nearest-date fallback when main query returns no rows", async () => {
      // getSeasonForDate direct match
      mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });
      // main date query — empty
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // UNION ALL nearest date query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ date: new Date("2025-01-16T00:00:00.000Z") }],
      });
      // re-query with resolved date
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { date: "2025-01-15" });

      expect(mockPool.query).toHaveBeenCalledTimes(4);
      expect(result.resolvedDate).toBe("2025-01-16");
      expect(result.games).toEqual([mockGame]);
    });

    it("returns empty games when fallback nearest-date query also returns nothing", async () => {
      // getSeasonForDate direct match
      mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });
      // main date query — empty
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // UNION ALL — no nearest dates either
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getGames("nba", { date: "2025-01-15" });

      expect(result).toEqual({ games: [], resolvedDate: "2025-01-15", resolvedSeason: "2025-26" });
    });

    it("date query orders by live status first", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGames("nba", { date: "2025-01-15" });

      const [sql] = mockPool.query.mock.calls[1];
      expect(sql).toContain("In Progress");
      expect(sql).toContain("Halftime");
    });
  });

  // ─── getGames — default (home page) branch ────────────────────────────────

  describe("getGames — default branch", () => {
    it("skips EXISTS check when live flag is true", async () => {
      // Only 1 query — the main slate query
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba", { live: true });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).not.toContain("EXISTS");
      expect(result).toEqual([mockGame]);
    });

    it("runs EXISTS check when live flag is not set", async () => {
      // EXISTS check
      mockPool.query.mockResolvedValueOnce({ rows: [{ has_today_games: false }] });
      // upcoming scheduled query
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // off-season fallback
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getGames("nba");

      const [firstSql] = mockPool.query.mock.calls[0];
      expect(firstSql).toContain("EXISTS");
    });

    it("returns today slate when has_today_games is true", async () => {
      // EXISTS check
      mockPool.query.mockResolvedValueOnce({ rows: [{ has_today_games: true }] });
      // main slate query
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });

      const result = await getGames("nba");

      expect(result).toEqual([mockGame]);
      // Slate query uses LIMIT 12
      const [sql] = mockPool.query.mock.calls[1];
      expect(sql).toContain("LIMIT 12");
    });

    it("returns upcoming scheduled games when has_today_games is false", async () => {
      const scheduledGame = { ...mockGame, status: "Scheduled" };
      // EXISTS check
      mockPool.query.mockResolvedValueOnce({ rows: [{ has_today_games: false }] });
      // upcoming query
      mockPool.query.mockResolvedValueOnce({ rows: [scheduledGame] });

      const result = await getGames("nfl");

      expect(result).toEqual([scheduledGame]);
      const [upcomingSql] = mockPool.query.mock.calls[1];
      expect(upcomingSql).toContain("Scheduled");
    });

    it("returns off-season fallback when no upcoming games exist", async () => {
      const lastGame = { ...mockGame, date: new Date("2024-06-01T00:00:00.000Z") };
      // EXISTS check
      mockPool.query.mockResolvedValueOnce({ rows: [{ has_today_games: false }] });
      // upcoming query — empty
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // fallback query
      mockPool.query.mockResolvedValueOnce({ rows: [lastGame] });

      const result = await getGames("nba");

      expect(mockPool.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual([lastGame]);
    });

    it("returns empty array when off-season fallback also finds nothing", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ has_today_games: false }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getGames("nhl");

      expect(result).toEqual([]);
    });
  });
});
