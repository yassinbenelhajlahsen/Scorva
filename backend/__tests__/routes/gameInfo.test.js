/**
 * Tests for /api/:league/games/:gameId endpoint
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
const routerPath = resolve(__dirname, "../../src/routes/gameInfo.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: gameInfoRouter } = await import(routerPath);

describe("Game Info Route - GET /:league/games/:gameId", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", gameInfoRouter);
    jest.clearAllMocks();
  });

  describe("NBA Games", () => {
    it("should return detailed NBA game info with box score", async () => {
      const mockGameData = {
        json_build_object: {
          game: {
            id: 1,
            league: "nba",
            date: "2025-01-15",
            venue: "Crypto.com Arena",
            broadcast: "ESPN",
            score: {
              home: 110,
              away: 105,
              quarters: {
                q1: "28-25",
                q2: "27-30",
                q3: "30-25",
                q4: "25-25",
                ot: [null, null, null, null],
              },
            },
            status: "Final",
            season: "2025-26",
            winnerId: 1,
          },
          homeTeam: {
            info: {
              id: 1,
              name: "Los Angeles Lakers",
              shortName: "LAL",
              location: "Los Angeles",
              logoUrl: "https://example.com/lal.png",
              record: "25-15",
              homeRecord: "15-5",
              awayRecord: "10-10",
              conference: "Western",
            },
            players: [
              {
                id: 1,
                name: "LeBron James",
                position: "F",
                jerseyNumber: "23",
                stats: {
                  PTS: 28,
                  AST: 7,
                  REB: 8,
                  BLK: 1,
                  STL: 2,
                },
              },
            ],
          },
          awayTeam: {
            info: {
              id: 2,
              name: "Boston Celtics",
              shortName: "BOS",
            },
            players: [],
          },
        },
      };

      mockPool.query.mockResolvedValue({ rows: [mockGameData] });

      const response = await request(app).get("/api/nba/games/1");

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("json_build_object"),
        ["1", "nba"]
      );
    });

    it("should return 404 for non-existent NBA game", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get("/api/nba/games/999999");

      expect(response.status).toBe(404);
      expect(response.text).toBe("Game not found");
    });

    it("should handle database errors for NBA games", async () => {
      mockPool.query.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/nba/games/1");

      expect(response.status).toBe(500);
      expect(response.text).toBe("Server error");
    });

    it("should include player stats in NBA game response", async () => {
      const mockGameData = {
        json_build_object: {
          game: { id: 1, league: "nba" },
          homeTeam: {
            info: {},
            players: [
              {
                id: 1,
                name: "Player 1",
                stats: {
                  PTS: 20,
                  AST: 5,
                  REB: 6,
                  FG: "8-15",
                  "3PT": "2-5",
                  FT: "2-2",
                },
              },
            ],
          },
          awayTeam: {
            info: {},
            players: [],
          },
        },
      };

      mockPool.query.mockResolvedValue({ rows: [mockGameData] });

      const response = await request(app).get("/api/nba/games/1");

      expect(response.status).toBe(200);
      expect(
        response.body.json_build_object.homeTeam.players[0].stats
      ).toHaveProperty("PTS");
      expect(
        response.body.json_build_object.homeTeam.players[0].stats
      ).toHaveProperty("FG");
    });
  });

  describe("NFL Games", () => {
    it("should return detailed NFL game info", async () => {
      const mockGameData = {
        json_build_object: {
          game: {
            id: 1,
            league: "nfl",
            date: "2025-01-15",
            status: "Final",
          },
          homeTeam: {
            info: {
              id: 1,
              name: "Kansas City Chiefs",
              shortName: "KC",
            },
            players: [],
          },
          awayTeam: {
            info: {},
            players: [],
          },
        },
      };

      mockPool.query.mockResolvedValue({ rows: [mockGameData] });

      const response = await request(app).get("/api/nfl/games/1");

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        "1",
        "nfl",
      ]);
    });

    it("should return 404 for non-existent NFL game", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get("/api/nfl/games/999999");

      expect(response.status).toBe(404);
    });
  });

  describe("NHL Games", () => {
    it("should return detailed NHL game info", async () => {
      const mockGameData = {
        json_build_object: {
          game: {
            id: 1,
            league: "nhl",
            date: "2025-01-15",
            status: "Final",
          },
          homeTeam: {
            info: {
              id: 1,
              name: "Montreal Canadiens",
              shortName: "MTL",
            },
            players: [],
          },
          awayTeam: {
            info: {},
            players: [],
          },
        },
      };

      mockPool.query.mockResolvedValue({ rows: [mockGameData] });

      const response = await request(app).get("/api/nhl/games/1");

      expect(response.status).toBe(200);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        "1",
        "nhl",
      ]);
    });
  });

  describe("Invalid League", () => {
    it("should return 400 for invalid league", async () => {
      const response = await request(app).get("/api/invalid/games/1");

      expect(response.status).toBe(400);
      expect(response.text).toBe("Invalid league");
    });

    it("should not query database for invalid league", async () => {
      await request(app).get("/api/xyz/games/1");

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("Parameter Validation", () => {
    it("should handle numeric game IDs", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games/12345");

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        "12345",
        "nba",
      ]);
    });

    it("should reject non-numeric game IDs with 400", async () => {
      const res = await request(app).get("/api/nba/games/abc123");
      expect(res.status).toBe(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("Quarter/Period Scores", () => {
    it("should include quarter scores for NBA", async () => {
      const mockGameData = {
        json_build_object: {
          game: {
            id: 1,
            score: {
              quarters: {
                q1: "28-25",
                q2: "27-30",
                q3: "30-25",
                q4: "25-25",
              },
            },
          },
          homeTeam: { info: {}, players: [] },
          awayTeam: { info: {}, players: [] },
        },
      };

      mockPool.query.mockResolvedValue({ rows: [mockGameData] });

      const response = await request(app).get("/api/nba/games/1");

      expect(response.status).toBe(200);
      expect(response.body.json_build_object.game.score.quarters).toBeDefined();
    });
  });
});
