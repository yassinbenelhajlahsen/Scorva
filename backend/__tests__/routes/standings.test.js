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

// Now import the modules that depend on db
const routerPath = resolve(__dirname, "../../src/routes/standings.js");
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

    mockPool.query.mockResolvedValue({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockStandings);
    expect(response.body[0]).toHaveProperty("wins");
    expect(response.body[0]).toHaveProperty("losses");
  });

  it("should order by conference, wins desc, losses asc", async () => {
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
        name: "Los Angeles Lakers",
        conf: "Western",
        wins: 32,
        losses: 13,
      },
    ];

    mockPool.query.mockResolvedValue({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY t.conf, wins DESC, losses ASC"),
      ["nba", null]
    );
  });

  it("should return empty array when no teams found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

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
    mockPool.query.mockResolvedValue({ rows: [] });

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

    mockPool.query.mockResolvedValue({ rows: mockStandings });

    const response = await request(app).get("/api/nba/standings");

    expect(response.status).toBe(200);
    expect(response.body[0].wins).toBe(42);
    expect(response.body[0].losses).toBe(3);
  });

  it("should include all required fields", async () => {
    const mockStandings = [fixtures.team()];

    mockPool.query.mockResolvedValue({
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
