import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const {
  ensureUser,
  getFavorites,
  addFavoritePlayer,
  removeFavoritePlayer,
  addFavoriteTeam,
  removeFavoriteTeam,
  checkFavorites,
} = await import(resolve(__dirname, "../../src/services/user/favoritesService.js"));

describe("favoritesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── ensureUser ────────────────────────────────────────────────────────────

  describe("ensureUser", () => {
    it("upserts user with all provided fields", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await ensureUser("user-1", { email: "a@b.com", firstName: "Alice", lastName: "Smith" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO users"),
        ["user-1", "a@b.com", "Alice", "Smith"]
      );
    });

    it("passes null for missing optional fields", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await ensureUser("user-1");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["user-1", null, null, null]
      );
    });

    it("SQL contains ON CONFLICT and COALESCE", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await ensureUser("user-1", { email: "a@b.com" });

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("ON CONFLICT");
      expect(sql).toContain("COALESCE");
    });
  });

  // ─── getFavorites ──────────────────────────────────────────────────────────

  describe("getFavorites", () => {
    it("runs 4 parallel queries via Promise.all", async () => {
      // All 4 queries resolve in parallel
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // players
        .mockResolvedValueOnce({ rows: [] }) // player stats
        .mockResolvedValueOnce({ rows: [] }) // teams
        .mockResolvedValueOnce({ rows: [] }); // team games

      await getFavorites("user-1");

      expect(mockPool.query).toHaveBeenCalledTimes(4);
    });

    it("returns { players, teams } shape", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getFavorites("user-1");

      expect(result).toHaveProperty("players");
      expect(result).toHaveProperty("teams");
      expect(result.players).toEqual([]);
      expect(result.teams).toEqual([]);
    });

    it("attaches recentStats to each player", async () => {
      const player = { id: 10, name: "LeBron James" };
      const stat = { playerid: 10, points: 30, gameid: 99 };

      mockPool.query
        .mockResolvedValueOnce({ rows: [player] })
        .mockResolvedValueOnce({ rows: [stat] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getFavorites("user-1");

      expect(result.players[0].recentStats).toEqual([stat]);
    });

    it("attaches recentGames to each team", async () => {
      const team = { id: 5, name: "Lakers" };
      const game = { fav_team_id: 5, id: 99, status: "Final" };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [team] })
        .mockResolvedValueOnce({ rows: [game] });

      const result = await getFavorites("user-1");

      expect(result.teams[0].recentGames).toEqual([game]);
    });

    it("player with no recent stats gets empty recentStats array", async () => {
      const player = { id: 20, name: "Someone" };

      mockPool.query
        .mockResolvedValueOnce({ rows: [player] })
        .mockResolvedValueOnce({ rows: [] }) // no stats for this player
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getFavorites("user-1");

      expect(result.players[0].recentStats).toEqual([]);
    });

    it("passes userId to all queries", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getFavorites("user-abc");

      for (const [, params] of mockPool.query.mock.calls) {
        expect(params[0]).toBe("user-abc");
      }
    });
  });

  // ─── addFavoritePlayer ─────────────────────────────────────────────────────

  describe("addFavoritePlayer", () => {
    it("calls ensureUser before inserting favorite", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // ensureUser
        .mockResolvedValueOnce({ rows: [] }); // INSERT favorite

      await addFavoritePlayer("user-1", 42, { email: "a@b.com" });

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      const [firstSql] = mockPool.query.mock.calls[0];
      expect(firstSql).toContain("INSERT INTO users");
    });

    it("inserts into user_favorite_players with ON CONFLICT DO NOTHING", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await addFavoritePlayer("user-1", 42);

      const [secondSql, params] = mockPool.query.mock.calls[1];
      expect(secondSql).toContain("user_favorite_players");
      expect(secondSql).toContain("ON CONFLICT DO NOTHING");
      expect(params).toEqual(["user-1", 42]);
    });
  });

  // ─── removeFavoritePlayer ──────────────────────────────────────────────────

  describe("removeFavoritePlayer", () => {
    it("deletes the player favorite", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await removeFavoritePlayer("user-1", 42);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM user_favorite_players"),
        ["user-1", 42]
      );
    });

    it("does not call ensureUser", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await removeFavoritePlayer("user-1", 42);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).not.toContain("INSERT INTO users");
    });
  });

  // ─── addFavoriteTeam ───────────────────────────────────────────────────────

  describe("addFavoriteTeam", () => {
    it("calls ensureUser then inserts team favorite", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await addFavoriteTeam("user-1", 7);

      const [secondSql, params] = mockPool.query.mock.calls[1];
      expect(secondSql).toContain("user_favorite_teams");
      expect(secondSql).toContain("ON CONFLICT DO NOTHING");
      expect(params).toEqual(["user-1", 7]);
    });
  });

  // ─── removeFavoriteTeam ────────────────────────────────────────────────────

  describe("removeFavoriteTeam", () => {
    it("deletes the team favorite", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await removeFavoriteTeam("user-1", 7);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM user_favorite_teams"),
        ["user-1", 7]
      );
    });
  });

  // ─── checkFavorites ────────────────────────────────────────────────────────

  describe("checkFavorites", () => {
    it("returns matching favorited player and team IDs", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ player_id: 10 }, { player_id: 20 }] })
        .mockResolvedValueOnce({ rows: [{ team_id: 5 }] });

      const result = await checkFavorites("user-1", [10, 20, 30], [5, 6]);

      expect(result).toEqual({ playerIds: [10, 20], teamIds: [5] });
    });

    it("skips player query when playerIds is empty", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ team_id: 5 }] });

      const result = await checkFavorites("user-1", [], [5]);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(result.playerIds).toEqual([]);
      expect(result.teamIds).toEqual([5]);
    });

    it("skips team query when teamIds is empty", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ player_id: 10 }] });

      const result = await checkFavorites("user-1", [10], []);

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(result.playerIds).toEqual([10]);
      expect(result.teamIds).toEqual([]);
    });

    it("returns empty arrays when both arrays are empty", async () => {
      const result = await checkFavorites("user-1", [], []);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(result).toEqual({ playerIds: [], teamIds: [] });
    });

    it("player query uses ANY($2::int[]) for safe array comparison", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await checkFavorites("user-1", [1, 2], [3]);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("ANY($2::int[])");
      expect(params[1]).toEqual([1, 2]);
    });
  });
});
