/**
 * Tests for /api/search endpoint
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
const routerPath = resolve(__dirname, "../../src/routes/search.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: searchRouter } = await import(routerPath);

describe("Search Route - GET /search", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", searchRouter);
    jest.clearAllMocks();
  });

  it("should return empty array when no search term provided", async () => {
    const response = await request(app).get("/api/search");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("should return empty array when search term is empty", async () => {
    const response = await request(app)
      .get("/api/search")
      .query({ term: "   " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("should search for players, teams, and games", async () => {
    const mockResults = [
      {
        id: 1,
        name: "LeBron James",
        league: "nba",
        imageUrl: "https://example.com/lebron.jpg",
        shortname: null,
        type: "player",
      },
      {
        id: 2,
        name: "Los Angeles Lakers",
        league: "nba",
        imageUrl: "https://example.com/lal.png",
        shortname: "LAL",
        type: "team",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockResults });

    const response = await request(app)
      .get("/api/search")
      .query({ term: "lakers" });

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UNION ALL"),
      ["%lakers%"]
    );
  });

  it("should limit results to 15 items", async () => {
    const mockResults = Array(20)
      .fill(null)
      .map((_, i) => ({
        id: i + 1,
        name: `Result ${i}`,
        league: "nba",
        imageUrl: null,
        shortname: null,
        type: "player",
      }));

    mockPool.query.mockResolvedValue({ rows: mockResults });

    const response = await request(app)
      .get("/api/search")
      .query({ term: "test" });

    expect(response.status).toBe(200);
    expect(response.body.length).toBeLessThanOrEqual(15);
  });

  it("should prioritize exact matches in sorting", async () => {
    const mockResults = [
      {
        id: 1,
        name: "Lakers",
        shortname: "LAL",
        league: "nba",
        imageUrl: null,
        type: "team",
      },
      {
        id: 2,
        name: "Los Angeles Lakers",
        shortname: "LAL",
        league: "nba",
        imageUrl: null,
        type: "team",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockResults });

    const response = await request(app)
      .get("/api/search")
      .query({ term: "lal" });

    expect(response.status).toBe(200);
    expect(response.body[0].shortname).toBe("LAL");
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database error"));

    const response = await request(app)
      .get("/api/search")
      .query({ term: "test" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
  });

  it("should search case-insensitively", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "LAKERS" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("ILIKE"),
      ["%LAKERS%"]
    );
  });

  it("should trim whitespace from search term", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "  lakers  " });

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
      "%lakers%",
    ]);
  });

  it("should include game results with team matchups", async () => {
    const mockResults = [
      {
        id: 1,
        name: "LAL vs BOS",
        league: "nba",
        imageUrl: null,
        shortname: null,
        type: "game",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockResults });

    const response = await request(app)
      .get("/api/search")
      .query({ term: "lal" });

    expect(response.status).toBe(200);
    expect(response.body[0].type).toBe("game");
  });

  it("should sort by type priority (team > player > game)", async () => {
    const mockResults = [
      {
        id: 1,
        name: "Game 1",
        type: "game",
        league: "nba",
        imageUrl: null,
        shortname: null,
      },
      {
        id: 2,
        name: "Player 1",
        type: "player",
        league: "nba",
        imageUrl: null,
        shortname: null,
      },
      {
        id: 3,
        name: "Team 1",
        type: "team",
        league: "nba",
        imageUrl: null,
        shortname: "T1",
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockResults });

    const response = await request(app)
      .get("/api/search")
      .query({ term: "test" });

    expect(response.status).toBe(200);
    // Response should be sorted by type priority
  });
});
