/**
 * Tests for /api/:league/players endpoint
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
const routerPath = resolve(__dirname, "../../src/routes/players.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: playersRouter } = await import(routerPath);

describe("Players Route - GET /:league/players", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", playersRouter);
    jest.clearAllMocks();
  });

  it("should return all players for a league", async () => {
    const mockPlayers = [
      fixtures.player({ id: 1, name: "LeBron James", position: "F" }),
      fixtures.player({ id: 2, name: "Stephen Curry", position: "G" }),
    ];

    mockPool.query.mockResolvedValue({ rows: mockPlayers });

    const response = await request(app).get("/api/nba/players");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockPlayers);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT *"),
      ["nba"]
    );
  });

  it("should order players by position", async () => {
    const mockPlayers = [
      fixtures.player({ position: "C" }),
      fixtures.player({ position: "F" }),
      fixtures.player({ position: "G" }),
    ];

    mockPool.query.mockResolvedValue({ rows: mockPlayers });

    const response = await request(app).get("/api/nba/players");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY position"),
      ["nba"]
    );
  });

  it("should return empty array when no players found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).get("/api/nfl/players");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database connection failed"));

    const response = await request(app).get("/api/nba/players");

    expect(response.status).toBe(500);
    expect(response.text).toBe("Server error");
  });

  it("should work with different league parameters", async () => {
    const nhlPlayers = [
      fixtures.player({ id: 1, league: "nhl", name: "Connor McDavid" }),
    ];

    mockPool.query.mockResolvedValue({ rows: nhlPlayers });

    const response = await request(app).get("/api/nhl/players");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl"]);
  });

  it("should include all player fields", async () => {
    const mockPlayers = [fixtures.player()];

    mockPool.query.mockResolvedValue({ rows: mockPlayers });

    const response = await request(app).get("/api/nba/players");

    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty("name");
    expect(response.body[0]).toHaveProperty("position");
    expect(response.body[0]).toHaveProperty("teamid");
    expect(response.body[0]).toHaveProperty("height");
    expect(response.body[0]).toHaveProperty("weight");
  });
});
