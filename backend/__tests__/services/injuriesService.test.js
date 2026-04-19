import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

const servicePath = resolve(__dirname, "../../src/services/ai/chat/tools/injuries.js");
const { getTeamInjuries, getLeagueInjuries, getPlayerStatus } = await import(servicePath);

describe("injuriesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTeamInjuries", () => {
    it("returns empty shape with team info when no injuries", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 2, name: "Boston Celtics", shortname: "BOS" }],
        });

      const result = await getTeamInjuries("nba", 2, "2025-26");

      expect(result).toEqual({
        team: { id: 2, name: "Boston Celtics", shortName: "BOS" },
        season: "2025-26",
        asOf: null,
        count: 0,
        players: [],
      });
    });

    it("returns injured players with NBA season averages and sorts by severity", async () => {
      const laterDate = new Date("2026-04-18T20:00:00Z");
      const earlierDate = new Date("2026-04-17T12:00:00Z");

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              name: "Player Q",
              position: "SF",
              status: "questionable",
              status_description: "knee",
              status_updated_at: earlierDate,
              team_id: 2,
              team_name: "Boston Celtics",
              team_short: "BOS",
            },
            {
              id: 11,
              name: "Player O",
              position: "PF",
              status: "out",
              status_description: "ankle",
              status_updated_at: laterDate,
              team_id: 2,
              team_name: "Boston Celtics",
              team_short: "BOS",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              playerid: 10,
              games_played: 60,
              points: "22.5",
              rebounds: "7.0",
              assists: "4.1",
              minutes: "33.2",
            },
            {
              playerid: 11,
              games_played: 50,
              points: "18.0",
              rebounds: "9.5",
              assists: "2.0",
              minutes: "30.0",
            },
          ],
        });

      const result = await getTeamInjuries("nba", 2, "2025-26");

      expect(result.team).toEqual({
        id: 2,
        name: "Boston Celtics",
        shortName: "BOS",
      });
      expect(result.count).toBe(2);
      expect(result.players[0].status).toBe("out");
      expect(result.players[1].status).toBe("questionable");
      expect(result.players[0].seasonAverages).toEqual({
        points: 18,
        rebounds: 9.5,
        assists: 2,
        minutes: 30,
      });
      expect(result.asOf).toBe(laterDate);
    });

    it("returns an error for an invalid league", async () => {
      const result = await getTeamInjuries("mlb", 1, "2025");

      expect(result).toEqual({ error: "Invalid league: mlb" });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("handles injured players with no stat rows (gamesPlayed 0)", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 12,
              name: "Rookie",
              position: "C",
              status: "out",
              status_description: "illness",
              status_updated_at: new Date("2026-04-18T00:00:00Z"),
              team_id: 2,
              team_name: "Boston Celtics",
              team_short: "BOS",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getTeamInjuries("nba", 2, "2025-26");

      expect(result.players[0].seasonAverages).toBeNull();
      expect(result.players[0].gamesPlayed).toBe(0);
    });
  });

  describe("getLeagueInjuries", () => {
    it("returns shaped rows for the default call", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            player_id: 1,
            player_name: "Star Player",
            position: "PG",
            status: "out",
            status_description: "knee",
            status_updated_at: new Date("2026-04-18T00:00:00Z"),
            popularity: 100,
            team_id: 2,
            team_name: "Boston Celtics",
            team_short: "BOS",
          },
        ],
      });

      const result = await getLeagueInjuries("nba");

      expect(result.count).toBe(1);
      expect(result.players[0]).toEqual({
        player: { id: 1, name: "Star Player", position: "PG" },
        team: { id: 2, name: "Boston Celtics", shortName: "BOS" },
        status: "out",
        statusDescription: "knee",
        statusUpdatedAt: expect.any(Date),
      });
    });

    it("passes status filter to the SQL query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getLeagueInjuries("nba", { status: "out", limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["nba", 0, "out", 10],
      );
    });

    it("returns error for an invalid status", async () => {
      const result = await getLeagueInjuries("nba", { status: "injured" });

      expect(result).toEqual({ error: "Invalid status: injured" });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("caps limit to 50", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getLeagueInjuries("nba", { limit: 500 });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe(50);
    });
  });

  describe("getPlayerStatus", () => {
    it("returns active for a healthy player", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: "Healthy Player", status: null, status_description: null, status_updated_at: null }],
      });

      const result = await getPlayerStatus("nba", 1);

      expect(result).toEqual({ id: 1, name: "Healthy Player", status: "active" });
    });

    it("returns the injury payload for a flagged player", async () => {
      const ts = new Date("2026-04-18T00:00:00Z");
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            name: "Hurt Player",
            status: "out",
            status_description: "knee",
            status_updated_at: ts,
          },
        ],
      });

      const result = await getPlayerStatus("nba", 2);

      expect(result).toEqual({
        id: 2,
        name: "Hurt Player",
        status: "out",
        statusDescription: "knee",
        statusUpdatedAt: ts,
      });
    });

    it("returns error for unknown playerId", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getPlayerStatus("nba", 999);

      expect(result).toEqual({ error: "Player not found" });
    });

    it("returns error for invalid league", async () => {
      const result = await getPlayerStatus("mlb", 1);

      expect(result).toEqual({ error: "Invalid league: mlb" });
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
