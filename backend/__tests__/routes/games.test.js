/**
 * Tests for /api/:league/games endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool, fixtures } from "../helpers/testHelpers.js";
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
const routerPath = resolve(__dirname, "../../src/routes/games.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: gamesRouter } = await import(routerPath);

describe("Games Route - GET /:league/games", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", gamesRouter);
    jest.clearAllMocks();
  });

  it("should return all games for a league", async () => {
    const mockGames = [
      {
        ...fixtures.game(),
        home_team_name: "Los Angeles Lakers",
        home_shortname: "LAL",
        home_logo: "https://example.com/lal.png",
        away_team_name: "Boston Celtics",
        away_shortname: "BOS",
        away_logo: "https://example.com/bos.png",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockGames });

    const response = await request(app).get("/api/nba/games");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockGames);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT"),
      ["nba"]
    );
  });

  it("should filter games by teamId when provided", async () => {
    const teamId = 5;
    const mockGames = [
      {
        ...fixtures.game({ hometeamid: teamId }),
        home_team_name: "Los Angeles Lakers",
        away_team_name: "Boston Celtics",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockGames });

    const response = await request(app)
      .get("/api/nba/games")
      .query({ teamId: teamId.toString() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockGames);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("$2::integer IN"),
      ["nba", teamId.toString()]
    );
  });

  it("should limit results to 12 games", async () => {
    const mockGames = Array(15)
      .fill(null)
      .map((_, i) => ({
        ...fixtures.game({ id: i + 1 }),
        home_team_name: "Team A",
        away_team_name: "Team B",
      }));

    mockPool.query.mockResolvedValue({ rows: mockGames.slice(0, 12) });

    const response = await request(app).get("/api/nba/games");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 12"),
      ["nba"]
    );
  });

  it("should order games by date descending", async () => {
    const mockGames = [
      {
        ...fixtures.game({ id: 1, date: "2025-01-16" }),
        home_team_name: "Team A",
        away_team_name: "Team B",
      },
      {
        ...fixtures.game({ id: 2, date: "2025-01-15" }),
        home_team_name: "Team C",
        away_team_name: "Team D",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockGames });

    const response = await request(app).get("/api/nba/games");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY g.date DESC"),
      ["nba"]
    );
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database error"));

    const response = await request(app).get("/api/nba/games");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Failed to fetch games." });
  });

  it("should return empty array when no games found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).get("/api/nfl/games");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should work with different league parameters", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/nhl/games");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl"]);
  });
});
