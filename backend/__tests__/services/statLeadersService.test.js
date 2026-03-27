import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/statLeadersService.js");
const { getStatLeaders } = await import(servicePath);

describe("statLeadersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("valid stats", () => {
    it("returns leaders for a valid NBA stat", async () => {
      const mockLeaders = [
        { id: 1, name: "LeBron James", avg_stat: "28.5", games_played: "50" },
        { id: 2, name: "Kevin Durant", avg_stat: "26.2", games_played: "48" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockLeaders });

      const result = await getStatLeaders("nba", "points", "2025-26", 10);

      expect(result).toEqual({ stat: "points", league: "nba", season: "2025-26", leaders: mockLeaders });
    });

    it("accepts all valid NBA stats", async () => {
      const nbaStats = ["points", "assists", "rebounds", "steals", "blocks", "turnovers", "minutes"];
      for (const stat of nbaStats) {
        mockPool.query.mockResolvedValueOnce({ rows: [] });
        const result = await getStatLeaders("nba", stat);
        expect(result).not.toHaveProperty("error");
      }
    });

    it("accepts all valid NFL stats", async () => {
      const nflStats = ["yds", "td", "interceptions"];
      for (const stat of nflStats) {
        mockPool.query.mockResolvedValueOnce({ rows: [] });
        const result = await getStatLeaders("nfl", stat);
        expect(result).not.toHaveProperty("error");
      }
    });

    it("accepts all valid NHL stats", async () => {
      const nhlStats = ["g", "a", "shots", "saves", "pim"];
      for (const stat of nhlStats) {
        mockPool.query.mockResolvedValueOnce({ rows: [] });
        const result = await getStatLeaders("nhl", stat);
        expect(result).not.toHaveProperty("error");
      }
    });
  });

  describe("validation", () => {
    it("returns error for invalid stat in a valid league", async () => {
      const result = await getStatLeaders("nba", "goals");

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("goals");
      expect(result.error).toContain("nba");
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("returns error for invalid league", async () => {
      const result = await getStatLeaders("mlb", "points");

      expect(result).toHaveProperty("error");
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("returns error when using an NFL stat for NBA league", async () => {
      const result = await getStatLeaders("nba", "yds");

      expect(result).toHaveProperty("error");
    });
  });

  describe("limit clamping", () => {
    it("clamps limit to max 50", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getStatLeaders("nba", "points", null, 100);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[2]).toBe(50);
    });

    it("clamps limit to min 1", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getStatLeaders("nba", "points", null, -5);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[2]).toBe(1);
    });

    it("defaults limit to 10 for non-numeric input", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getStatLeaders("nba", "points", null, "abc");

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[2]).toBe(10);
    });

    it("uses provided limit within valid range", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getStatLeaders("nba", "points", null, 25);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[2]).toBe(25);
    });
  });

  it("passes season to query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getStatLeaders("nba", "points", "2024-25", 10);

    const callArgs = mockPool.query.mock.calls[0][1];
    expect(callArgs[1]).toBe("2024-25");
  });

  it("returns empty leaders array when no results", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getStatLeaders("nba", "points");

    expect(result.leaders).toEqual([]);
  });
});
