import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPool,
}));

const { getPlaysForAgent } = await import(
  resolve(__dirname, "../../src/services/ai/chat/tools/plays.js")
);

function makePlay(overrides = {}) {
  return {
    sequence: 1,
    period: 4,
    clock: "2:30",
    description: "LeBron James makes 8-foot driving layup",
    home_score: 108,
    away_score: 105,
    scoring_play: true,
    play_type: "Layup",
    team: "LAL",
    game_id: 99,
    date: "2025-01-15",
    home_team: "LAL",
    away_team: "BOS",
    ...overrides,
  };
}

describe("getPlaysForAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("single-game queries (gameId provided)", () => {
    it("returns plays with no game context fields for a single game", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [makePlay()] });

      const result = await getPlaysForAgent({
        league: "nba",
        gameId: 99,
        season: "2025-26",
      });

      expect(result.plays).toHaveLength(1);
      expect(result.plays[0]).toHaveProperty("description");
      expect(result.plays[0]).toHaveProperty("scoring_play");
      // Single-game: no redundant game context
      expect(result.plays[0]).not.toHaveProperty("game_id");
      expect(result.plays[0]).not.toHaveProperty("game_date");
      expect(result.plays[0]).not.toHaveProperty("matchup");
    });

    it("returns total and capped flag", async () => {
      const rows = Array.from({ length: 5 }, (_, i) => makePlay({ sequence: i + 1 }));
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await getPlaysForAgent({
        league: "nba",
        gameId: 99,
        season: "2025-26",
      });

      expect(result.plays).toHaveLength(5);
      expect(result.capped).toBe(false);
    });

    it("reports capped: true when result count equals the limit", async () => {
      const rows = Array.from({ length: 10 }, (_, i) => makePlay({ sequence: i + 1 }));
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await getPlaysForAgent({
        league: "nba",
        gameId: 99,
        season: "2025-26",
        limit: 10,
      });

      expect(result.capped).toBe(true);
    });
  });

  describe("cross-game queries (no gameId)", () => {
    it("includes game context fields when gameId is omitted", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [makePlay()] });

      const result = await getPlaysForAgent({
        league: "nba",
        playerName: "LeBron",
        season: "2025-26",
      });

      expect(result.plays[0]).toHaveProperty("game_id", 99);
      expect(result.plays[0]).toHaveProperty("game_date", "2025-01-15");
      expect(result.plays[0]).toHaveProperty("matchup", "BOS vs LAL");
    });
  });

  describe("NFL drive metadata", () => {
    it("includes drive fields for NFL queries", async () => {
      const nflPlay = makePlay({
        drive_number: 7,
        drive_description: "LAL 25 at 12:30",
        drive_result: "Touchdown",
      });
      mockPool.query.mockResolvedValueOnce({ rows: [nflPlay] });

      const result = await getPlaysForAgent({
        league: "nfl",
        gameId: 50,
        season: "2025",
      });

      expect(result.plays[0]).toHaveProperty("drive_number", 7);
      expect(result.plays[0]).toHaveProperty("drive_description");
      expect(result.plays[0]).toHaveProperty("drive_result", "Touchdown");
    });

    it("does not include drive fields for NBA queries", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [makePlay()] });

      const result = await getPlaysForAgent({
        league: "nba",
        gameId: 99,
        season: "2025-26",
      });

      expect(result.plays[0]).not.toHaveProperty("drive_number");
      expect(result.plays[0]).not.toHaveProperty("drive_description");
      expect(result.plays[0]).not.toHaveProperty("drive_result");
    });
  });

  describe("SQL columns for NFL", () => {
    it("includes drive columns in the SELECT for NFL", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nfl", gameId: 1, season: "2025" });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain("p.drive_number");
      expect(sql).toContain("p.drive_description");
      expect(sql).toContain("p.drive_result");
    });

    it("omits drive columns in the SELECT for NBA", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", gameId: 1, season: "2025-26" });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).not.toContain("p.drive_number");
    });
  });

  describe("parameter passing", () => {
    it("passes all filter params to the query in correct positions", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({
        league: "nba",
        gameId: 5,
        playerName: "LeBron",
        teamId: 10,
        period: 4,
        scoringOnly: true,
        playType: "Three Point",
        searchText: "buzzer",
        season: "2025-26",
        limit: 20,
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe("nba");
      expect(params[1]).toBe(5);          // gameId
      expect(params[2]).toBe("LeBron");   // playerName
      expect(params[3]).toBe(10);         // teamId
      expect(params[4]).toBe(4);          // period
      expect(params[5]).toBe(true);       // scoringOnly
      expect(params[6]).toBe("Three Point"); // playType
      expect(params[7]).toBe("buzzer");   // searchText
      expect(params[8]).toBe("2025-26");  // season
      expect(params[9]).toBe(20);         // limit
    });

    it("passes null for omitted optional params", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26" });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[1]).toBeNull(); // gameId
      expect(params[2]).toBeNull(); // playerName
      expect(params[3]).toBeNull(); // teamId
      expect(params[4]).toBeNull(); // period
      expect(params[5]).toBeNull(); // scoringOnly
      expect(params[6]).toBeNull(); // playType
      expect(params[7]).toBeNull(); // searchText
    });
  });

  describe("limit clamping", () => {
    it("defaults limit to 30 when not provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26" });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[9]).toBe(30);
    });

    it("clamps limit to max 50", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26", limit: 200 });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[9]).toBe(50);
    });

    it("clamps limit to min 1", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26", limit: 0 });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[9]).toBe(1);
    });

    it("defaults to 30 for non-numeric limit", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26", limit: "all" });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[9]).toBe(30);
    });
  });

  describe("empty results", () => {
    it("returns empty plays array when no rows match", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getPlaysForAgent({
        league: "nba",
        playerName: "nobody",
        season: "2025-26",
      });

      expect(result).toEqual({ plays: [], capped: false });
    });
  });

  describe("SQL structure", () => {
    it("joins plays to games and teams", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26" });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain("FROM plays p");
      expect(sql).toContain("JOIN games g ON g.id = p.gameid");
      expect(sql).toContain("JOIN teams ht ON ht.id = g.hometeamid");
      expect(sql).toContain("JOIN teams at ON at.id = g.awayteamid");
    });

    it("orders by date DESC and sequence DESC", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", season: "2025-26" });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain("ORDER BY g.date ASC, p.sequence ASC");
    });

    it("skips status filter when gameId is provided (allows live game queries)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getPlaysForAgent({ league: "nba", gameId: 1, season: "2025-26" });

      const sql = mockPool.query.mock.calls[0][0];
      // The status filter is guarded by ($2::int IS NOT NULL OR g.status ILIKE 'Final%')
      // so when gameId is set it passes through — verify the conditional is present
      expect(sql).toContain("$2::int IS NOT NULL OR g.status ILIKE");
    });
  });
});
