import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockTryParseDate = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const dateParserPath = resolve(__dirname, "../../src/utils/dateParser.js");
jest.unstable_mockModule(dateParserPath, () => ({
  tryParseDate: mockTryParseDate,
}));

const { search } = await import(resolve(__dirname, "../../src/services/searchService.js"));

describe("searchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTryParseDate.mockReturnValue(null);
  });

  describe("input validation", () => {
    it("returns empty array for empty string", async () => {
      expect(await search("")).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only string", async () => {
      expect(await search("   ")).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("returns empty array for term longer than 200 characters", async () => {
      const longTerm = "a".repeat(201);
      expect(await search(longTerm)).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("accepts term exactly 200 characters", async () => {
      const term = "a".repeat(200);
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await search(term);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe("Stage 1 — ILIKE search", () => {
    it("passes %term% as first param for ILIKE matching", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Lakers", type: "team" }] });

      await search("Lakers");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["%Lakers%", "Lakers", null]
      );
    });

    it("passes raw (unescaped) term as second param for ranking", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "LeBron James", type: "player" }] });

      await search("LeBron");

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[1]).toBe("LeBron");
    });

    it("passes tryParseDate result as third param", async () => {
      mockTryParseDate.mockReturnValue("2025-01-15");
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await search("Jan 15");

      expect(mockTryParseDate).toHaveBeenCalledWith("Jan 15");
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ["%Jan 15%", "Jan 15", "2025-01-15"]
      );
    });

    it("passes null as third param when tryParseDate returns null", async () => {
      mockTryParseDate.mockReturnValue(null);
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Team", type: "team" }] });

      await search("Team");

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[2]).toBeNull();
    });

    it("returns results from Stage 1 when rows found", async () => {
      const mockResults = [
        { id: 1, name: "Boston Celtics", type: "team", league: "nba" },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockResults });

      const result = await search("Celtics");

      expect(result).toEqual(mockResults);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("escapes % in the search term for ILIKE safety", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await search("100%");

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe("%100\\%%");
    });

    it("escapes _ in the search term for ILIKE safety", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await search("a_b");

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe("%a\\_b%");
    });

    it("SQL contains ILIKE and UNION ALL", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, type: "team", name: "T" }] });

      await search("test");

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("ILIKE");
      expect(sql).toContain("UNION ALL");
    });
  });

  describe("Stage 2 — fuzzy fallback", () => {
    it("fires Stage 2 when Stage 1 returns no results", async () => {
      const fuzzyResults = [{ id: 2, name: "LeBron James", type: "player" }];
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: fuzzyResults });

      const result = await search("lebron");

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(result).toEqual(fuzzyResults);
    });

    it("passes raw sanitized term (not wrapped in %) to Stage 2", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await search("  Lakers  ");

      const [, fuzzyParams] = mockPool.query.mock.calls[1];
      expect(fuzzyParams[0]).toBe("Lakers");
      expect(fuzzyParams[0]).not.toContain("%");
    });

    it("does NOT fire Stage 2 when Stage 1 has results", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, type: "team", name: "Lakers" }] });

      await search("Lakers");

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("Stage 2 SQL contains similarity", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await search("typo");

      const [sql] = mockPool.query.mock.calls[1];
      expect(sql).toContain("similarity");
    });

    it("returns empty array when both stages return no results", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await search("xyzxyz");

      expect(result).toEqual([]);
    });
  });
});
