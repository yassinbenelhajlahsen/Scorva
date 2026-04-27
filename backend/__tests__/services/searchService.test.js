import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockPool = createMockPool();
const mockTryParseDate = jest.fn();
const mockResolveTeams = jest.fn();
const mockParseSearchTerm = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const dateParserPath = resolve(__dirname, "../../src/utils/dateParser.js");
jest.unstable_mockModule(dateParserPath, () => ({
  tryParseDate: mockTryParseDate,
}));

const resolverPath = resolve(__dirname, "../../src/services/meta/teamResolver.js");
jest.unstable_mockModule(resolverPath, () => ({
  resolveTeams: mockResolveTeams,
}));

const parserPath = resolve(__dirname, "../../src/services/meta/searchParser.js");
jest.unstable_mockModule(parserPath, () => ({
  parseSearchTerm: mockParseSearchTerm,
}));

const { search } = await import(
  resolve(__dirname, "../../src/services/meta/searchService.js")
);

describe("searchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTryParseDate.mockReturnValue(null);
  });

  describe("empty branch", () => {
    it("returns [] without DB calls when parser says empty", async () => {
      mockParseSearchTerm.mockReturnValue({ kind: "empty" });

      const result = await search("");

      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResolveTeams).not.toHaveBeenCalled();
    });
  });

  describe("single branch", () => {
    beforeEach(() => {
      mockParseSearchTerm.mockReturnValue({ kind: "single", token: "lakers" });
    });

    it("calls resolveTeams once with the token", async () => {
      mockResolveTeams.mockResolvedValueOnce([]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      expect(mockResolveTeams).toHaveBeenCalledTimes(1);
      expect(mockResolveTeams).toHaveBeenCalledWith("lakers");
    });

    it("queries team entities for resolved IDs", async () => {
      mockResolveTeams.mockResolvedValueOnce([
        { id: 527, league: "nba", score: 2 },
      ]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      const teamCall = mockPool.query.mock.calls.find(
        (c) => c[0].includes("FROM teams") && Array.isArray(c[1]) && c[1].some((p) => Array.isArray(p) && p.includes(527))
      );
      expect(teamCall).toBeDefined();
    });

    it("queries players for the token", async () => {
      mockResolveTeams.mockResolvedValueOnce([]);
      mockPool.query.mockResolvedValue({ rows: [] });

      await search("lakers");

      const playerCall = mockPool.query.mock.calls.find((c) =>
        c[0].includes("FROM players")
      );
      expect(playerCall).toBeDefined();
    });

    it("returns the team entity ranked first when score=2 hit", async () => {
      mockResolveTeams.mockResolvedValueOnce([
        { id: 527, league: "nba", score: 2 },
      ]);
      mockPool.query.mockImplementation((sql) => {
        if (sql.includes("FROM teams")) {
          return Promise.resolve({
            rows: [
              {
                id: 527,
                name: "Los Angeles Lakers",
                league: "nba",
                imageUrl: "lal.png",
                shortname: "Lakers",
                date: null,
                type: "team",
                position: null,
                team_name: null,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await search("lakers");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe("team");
      expect(result[0].id).toBe(527);
    });

    it("respects the LIMIT 15 result cap", async () => {
      mockResolveTeams.mockResolvedValueOnce([{ id: 1, league: "nba", score: 4 }]);
      const manyTeams = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i}`,
        league: "nba",
        imageUrl: null,
        shortname: null,
        date: null,
        type: "team",
        position: null,
        team_name: null,
      }));
      mockPool.query.mockImplementation((sql) =>
        sql.includes("FROM teams")
          ? Promise.resolve({ rows: manyTeams })
          : Promise.resolve({ rows: [] })
      );

      const result = await search("anything");

      expect(result.length).toBeLessThanOrEqual(15);
    });
  });
});
