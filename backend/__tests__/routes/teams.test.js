/**
 * Tests for /api/:league/teams endpoint
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
const routerPath = resolve(__dirname, "../../src/routes/teams/teams.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: teamsRouter } = await import(routerPath);

describe("Teams Route - GET /:league/teams", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", teamsRouter);
    jest.clearAllMocks();
  });

  it("should return all NBA teams ordered by conference and name", async () => {
    const mockTeams = [
      fixtures.team({ id: 1, name: "Boston Celtics", conf: "Eastern" }),
      fixtures.team({ id: 2, name: "Los Angeles Lakers", conf: "Western" }),
    ];

    mockPool.query.mockResolvedValue({ rows: mockTeams });

    const response = await request(app).get("/api/nba/teams");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockTeams);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT *"),
      ["nba"]
    );
  });

  it("should return empty array when no teams found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).get("/api/nfl/teams");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database connection failed"));

    const response = await request(app).get("/api/nba/teams");

    expect(response.status).toBe(500);
    expect(response.text).toBe("Server error");
  });

  it("should work with different league parameters", async () => {
    const nhlTeams = [
      fixtures.team({ id: 1, league: "nhl", name: "Montreal Canadiens" }),
    ];

    mockPool.query.mockResolvedValue({ rows: nhlTeams });

    const response = await request(app).get("/api/nhl/teams");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl"]);
  });

  it("should return teams ordered by conference and name", async () => {
    const mockTeams = [
      fixtures.team({ conf: "Eastern", name: "Atlanta Hawks" }),
      fixtures.team({ conf: "Eastern", name: "Boston Celtics" }),
      fixtures.team({ conf: "Western", name: "Denver Nuggets" }),
    ];

    mockPool.query.mockResolvedValue({ rows: mockTeams });

    const response = await request(app).get("/api/nba/teams");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockTeams);
  });
});
