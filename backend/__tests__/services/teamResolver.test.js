import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = createMockPool();
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { resolveTeams } = await import(
  resolve(__dirname, "../../src/services/meta/teamResolver.js")
);

describe("resolveTeams", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("tier 1 — abbreviation", () => {
    it("hits tier 1 for tokens of length ≤ 4", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      const result = await resolveTeams("LAL");

      expect(result).toEqual([{ id: 527, league: "nba", score: 1 }]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain("LOWER(abbreviation)");
    });

    it("skips tier 1 for tokens of length > 4", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers");

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain("LOWER(abbreviation)");
    });
  });

  describe("tier 2 — exact name/shortname", () => {
    it("returns score 2 when tier 2 hits (tier 1 skipped)", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      const result = await resolveTeams("Lakers");

      expect(result[0].score).toBe(2);
    });
  });

  describe("tier 3 — prefix", () => {
    it("returns score 3 when tier 2 misses and prefix hits", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // tier 2 miss
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      }); // tier 3 hit

      const result = await resolveTeams("Laker");

      expect(result).toEqual([{ id: 527, league: "nba", score: 3 }]);
    });
  });

  describe("tier 4 — substring with length-3 gate", () => {
    it("skips tier 4 for tokens < 3 chars", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await resolveTeams("LL");

      const calls = mockPool.query.mock.calls.map((c) => c[0]);
      const tier4 = calls.find((sql) => /LIKE\s+'%'\s+\|\|/.test(sql));
      expect(tier4).toBeUndefined();
    });

    it("runs tier 4 when token length is exactly 3", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // tier 1
        .mockResolvedValueOnce({ rows: [] }) // tier 2
        .mockResolvedValueOnce({ rows: [] }) // tier 3
        .mockResolvedValueOnce({
          rows: [{ id: 99, league: "nba" }],
        }); // tier 4

      const result = await resolveTeams("abc");

      expect(result).toEqual([{ id: 99, league: "nba", score: 4 }]);
    });
  });

  describe("tier 5 — fuzzy", () => {
    it("falls through to fuzzy on typos", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // tier 2
        .mockResolvedValueOnce({ rows: [] }) // tier 3
        .mockResolvedValueOnce({ rows: [] }) // tier 4
        .mockResolvedValueOnce({
          rows: [{ id: 548, league: "nba" }],
        }); // tier 5

      const result = await resolveTeams("warriros");

      expect(result).toEqual([{ id: 548, league: "nba", score: 5 }]);
      expect(mockPool.query).toHaveBeenCalledTimes(4);
      expect(mockPool.query.mock.calls[3][0]).toContain("similarity");
    });
  });

  describe("league filter", () => {
    it("includes league as a parameter when provided", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers", { league: "nba" });

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toContain("nba");
    });

    it("does NOT include league filter SQL when league is undefined", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 527, league: "nba" }],
      });

      await resolveTeams("Lakers");

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain("AND league =");
    });
  });

  describe("no match", () => {
    it("returns empty array after all tiers exhausted", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await resolveTeams("zzzzzz");

      expect(result).toEqual([]);
    });
  });

  describe("input handling", () => {
    it("returns empty array for blank input without hitting DB", async () => {
      const result = await resolveTeams("");
      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
