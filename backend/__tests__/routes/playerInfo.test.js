/**
 * Tests for /api/:league/players/:slug endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create mock pool
const mockPool = createMockPool();

// Mock the db module with absolute path
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

// Now import the modules that depend on db
const routerPath = resolve(__dirname, "../../src/routes/playerInfo.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: playerInfoRouter } = await import(routerPath);

describe("Player Info Route - GET /:league/players/:slug", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", playerInfoRouter);
    jest.clearAllMocks();
  });

  describe("NBA Players", () => {
    it("should return player info by numeric ID", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "LeBron James",
          position: "F",
          jerseyNumber: "23",
          height: "6-9",
          weight: "250",
          dob: "1984-12-30",
          imageUrl: "https://example.com/lebron.jpg",
          team: {
            id: 1,
            name: "Los Angeles Lakers",
            shortName: "LAL",
          },
          seasonAverages: {
            points: 25.5,
            assists: 7.2,
            rebounds: 8.1,
            fgPct: 52.3,
          },
          games: [],
        },
      };

      // For numeric slug, no lookup query happens - only the main query
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nba/players/1");

      expect(response.status).toBe(200);
      expect(response.body.player).toHaveProperty("name");
      expect(response.body.player).toHaveProperty("seasonAverages");
    });

    it("should return player info by slug", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "LeBron James",
          position: "F",
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nba/players/lebron-james");

      expect(response.status).toBe(200);
    });

    it("should return 404 for non-existent player", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get("/api/nba/players/999999");

      expect(response.status).toBe(404);
    });

    it("should include season averages", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "Player",
          seasonAverages: {
            points: 20.5,
            assists: 5.2,
            rebounds: 6.8,
            fgPct: 48.5,
          },
        },
      };

      // For numeric slug, only main query happens
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nba/players/1");

      expect(response.status).toBe(200);
      expect(response.body.player.seasonAverages).toBeDefined();
      expect(response.body.player.seasonAverages.points).toBe(20.5);
    });

    it("should include recent games", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "Player",
          games: [
            {
              gameid: 1,
              date: "2025-01-15",
              points: 28,
              assists: 7,
              opponent: "BOS",
              result: "W",
            },
            {
              gameid: 2,
              date: "2025-01-14",
              points: 22,
              assists: 5,
              opponent: "MIA",
              result: "L",
            },
          ],
        },
      };

      // For numeric slug, only main query happens
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nba/players/1");

      expect(response.status).toBe(200);
      expect(response.body.player.games).toHaveLength(2);
      expect(response.body.player.games[0]).toHaveProperty("opponent");
      expect(response.body.player.games[0]).toHaveProperty("result");
    });

    it("should handle database errors", async () => {
      // For numeric slug, the main query is the first (and only) query
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app).get("/api/nba/players/1");

      expect(response.status).toBe(500);
    });
  });

  describe("NFL Players", () => {
    it("should return NFL player info", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "Patrick Mahomes",
          position: "QB",
          team: {
            name: "Kansas City Chiefs",
          },
        },
      };

      // For numeric slug, only main query happens
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nfl/players/1");

      expect(response.status).toBe(200);
    });

    it("should return 404 for non-existent NFL player", async () => {
      // For numeric slug, the main query runs and should return empty rows
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get("/api/nfl/players/999999");

      expect(response.status).toBe(404);
    });
  });

  describe("NHL Players", () => {
    it("should return NHL player info", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "Connor McDavid",
          position: "C",
          team: {
            name: "Edmonton Oilers",
          },
        },
      };

      // For numeric slug, only main query happens
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nhl/players/1");

      expect(response.status).toBe(200);
    });
  });

  describe("Invalid League", () => {
    it("should return 400 for invalid league", async () => {
      const response = await request(app).get("/api/invalid/players/1");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid league" });
    });

    it("should not query database for invalid league", async () => {
      await request(app).get("/api/xyz/players/1");

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("Slug Resolution", () => {
    it("should handle numeric slugs", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 123 }] })
        .mockResolvedValueOnce({ rows: [{ player: { id: 123 } }] });

      await request(app).get("/api/nba/players/123");

      // Should use numeric ID directly
      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle hyphenated slugs", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ player: { id: 1 } }] });

      await request(app).get("/api/nba/players/lebron-james");

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should handle slugs with spaces converted to hyphens", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ player: { id: 1 } }] });

      await request(app).get("/api/nba/players/stephen-curry");

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe("Team Information", () => {
    it("should include player team info", async () => {
      const mockPlayerData = {
        player: {
          id: 1,
          name: "Player",
          team: {
            id: 5,
            name: "Los Angeles Lakers",
            shortName: "LAL",
            location: "Los Angeles",
            logoUrl: "https://example.com/lal.png",
          },
        },
      };

      // For numeric slug, only main query happens
      mockPool.query.mockResolvedValueOnce({ rows: [mockPlayerData] });

      const response = await request(app).get("/api/nba/players/1");

      expect(response.status).toBe(200);
      expect(response.body.player.team).toBeDefined();
      expect(response.body.player.team.name).toBe("Los Angeles Lakers");
    });
  });
});
