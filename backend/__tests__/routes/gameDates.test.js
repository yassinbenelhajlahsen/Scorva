/**
 * Tests for GET /:league/games/dates endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPool,
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

// Pass cached() through to the query function — no Redis in tests
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: jest.fn((key, ttl, fn) => fn()),
  invalidate: jest.fn(),
  invalidatePattern: jest.fn(),
  closeCache: jest.fn(),
}));

const routerPath = resolve(__dirname, "../../src/routes/games/games.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: gamesRouter } = await import(routerPath);

describe("Game Dates Route - GET /:league/games/dates", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", gamesRouter);
    jest.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 for an invalid league", async () => {
      const response = await request(app).get("/api/xyz/games/dates");
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid league" });
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("accepts nba as a valid league", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const response = await request(app).get("/api/nba/games/dates");
      expect(response.status).toBe(200);
    });

    it("accepts nfl as a valid league", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const response = await request(app).get("/api/nfl/games/dates");
      expect(response.status).toBe(200);
    });

    it("accepts nhl as a valid league", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const response = await request(app).get("/api/nhl/games/dates");
      expect(response.status).toBe(200);
    });
  });

  describe("success — no season param", () => {
    it("returns an array of { date, count } objects using the current season", async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { date: new Date("2025-01-15T00:00:00Z"), count: "8" },
          { date: new Date("2025-01-16T00:00:00Z"), count: "3" },
        ],
      });

      const response = await request(app).get("/api/nba/games/dates");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { date: "2025-01-15", count: 8 },
        { date: "2025-01-16", count: 3 },
      ]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("GROUP BY date"),
        ["nba", "2025-26"]
      );
    });

    it("returns an empty array when no game dates exist", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get("/api/nba/games/dates");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("queries dates ordered ascending", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games/dates");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY date ASC"),
        expect.any(Array)
      );
    });

    it("coerces the pg COUNT string to a number", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ date: new Date("2025-01-15T00:00:00Z"), count: "14" }],
      });

      const response = await request(app).get("/api/nba/games/dates");

      expect(response.body[0].count).toBe(14);
      expect(typeof response.body[0].count).toBe("number");
    });
  });

  describe("success — with explicit season param", () => {
    it("passes the explicit season to the query instead of getCurrentSeason", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ date: new Date("2024-10-25T00:00:00Z"), count: "5" }],
      });

      const response = await request(app)
        .get("/api/nba/games/dates")
        .query({ season: "2024-25" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ date: "2024-10-25", count: 5 }]);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["nba", "2024-25"]
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when the database query fails", async () => {
      mockPool.query.mockRejectedValue(new Error("DB error"));

      const response = await request(app).get("/api/nba/games/dates");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Failed to fetch game dates." });
    });
  });
});
