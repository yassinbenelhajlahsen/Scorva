/**
 * Tests for /api/:league/standings endpoint
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

// Mock seasons cache helper so getCurrentSeason never hits the DB in tests
const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

// Mock cache so we don't need Redis
const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({
  cached: jest.fn().mockImplementation(async (_key, _ttl, fn) => fn()),
}));

// Now import the modules that depend on db
const routerPath = resolve(__dirname, "../../src/routes/standings/standings.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: standingsRouter } = await import(routerPath);

describe("Standings Route - GET /:league/standings", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", standingsRouter);
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it("should return standings with wins and losses parsed", async () => {
    const mockStandings = [
      {
        id: 1,
        name: "Boston Celtics",
        shortname: "BOS",
        location: "Boston",
        conf: "Eastern",
        logo_url: "https://example.com/bos.png",
        wins: 35,
        losses: 10,
      },
      {
        id: 2,
        name: "Miami Heat",
        shortname: "MIA",
        location: "Miami",
        conf: "Eastern",
        logo_url: "https://example.com/mia.png",
        wins: 30,
        losses: 15,
      },
    ];

    mockPool.query.mockResolvedValueOnce({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty("wins");
    expect(response.body[0]).toHaveProperty("losses");
    expect(response.body[0]).toHaveProperty("winPct");
  });

  it("should sort by win percentage descending", async () => {
    const mockStandings = [
      {
        id: 1,
        name: "Boston Celtics",
        conf: "Eastern",
        wins: 35,
        losses: 10,
      },
      {
        id: 2,
        name: "Miami Heat",
        conf: "Eastern",
        wins: 30,
        losses: 15,
      },
    ];

    mockPool.query.mockResolvedValueOnce({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(1);
    expect(response.body[1].id).toBe(2);
  });

  it("should return empty array when no teams found", async () => {
    const response = await request(app).get("/api/nfl/standings");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database error"));

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(500);
    expect(response.text).toBe("Failed to fetch standings");
  });

  it("should work with different league parameters", async () => {
    await request(app).get("/api/nhl/standings");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl", null]);
  });

  it("should parse record string correctly", async () => {
    const mockStandings = [
      {
        id: 1,
        name: "Team A",
        shortname: "TEA",
        location: "City",
        conf: "Eastern",
        logo_url: "url",
        wins: 42,
        losses: 3,
      },
    ];

    mockPool.query.mockResolvedValueOnce({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body[0].wins).toBe(42);
    expect(response.body[0].losses).toBe(3);
  });

  it("should include all required fields", async () => {
    const mockStandings = [fixtures.team()];

    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          ...mockStandings[0],
          wins: 25,
          losses: 15,
        },
      ],
    });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body[0]).toHaveProperty("id");
    expect(response.body[0]).toHaveProperty("name");
    expect(response.body[0]).toHaveProperty("shortname");
    expect(response.body[0]).toHaveProperty("conf");
    expect(response.body[0]).toHaveProperty("logo_url");
    expect(response.body[0]).toHaveProperty("wins");
    expect(response.body[0]).toHaveProperty("losses");
  });
});
