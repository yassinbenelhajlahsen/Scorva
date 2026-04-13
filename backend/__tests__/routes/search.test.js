/**
 * Tests for /api/search endpoint
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
const routerPath = resolve(__dirname, "../../src/routes/meta/search.js");
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
      ["%lakers%", "lakers", null]
    );
  });

  it("should delegate limiting to SQL (query contains LIMIT 15)", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "test" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 15"),
      expect.any(Array)
    );
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

    // DB returns results in DB-ranked order; handler passes them through unchanged
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
      ["%LAKERS%", "LAKERS", null]
    );
  });

  it("should trim whitespace from search term", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "  lakers  " });

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
      "%lakers%",
      "lakers",
      null,
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

  it("should use SQL ORDER BY for type and match-quality ranking", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "test" });

    const queryArg = mockPool.query.mock.calls[0][0];
    expect(queryArg).toContain("ORDER BY");
    expect(queryArg).toContain("similarity");
  });

  it("should pass parsed ISO dates through to the game search query", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "2025-01-15" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("g.date = $3::date"),
      ["%2025-01-15%", "2025-01-15", "2025-01-15"]
    );
  });

  it("should parse US-style dates for game search", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "1/15/2025" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["%1/15/2025%", "1/15/2025", "2025-01-15"]
    );
  });

  it("should infer the current season year for slash dates without a year", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "12/25" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["%12/25%", "12/25", "2025-12-25"]
    );
  });

  it("should infer the current season year for month-name dates without a year", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "Jan 15" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["%Jan 15%", "Jan 15", "2026-01-15"]
    );
  });

  it("should not treat a bare year as a date search", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/search").query({ term: "2026" });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["%2026%", "2026", null]
    );
  });
});
