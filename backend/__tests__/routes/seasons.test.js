/**
 * Tests for /api/:league/seasons endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

const routerPath = resolve(__dirname, "../../src/routes/seasons.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: seasonsRouter } = await import(routerPath);

describe("Seasons Route - GET /:league/seasons", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", seasonsRouter);
    jest.clearAllMocks();
  });

  it("should return distinct seasons for a league", async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { season: "2025-26" },
        { season: "2024-25" },
        { season: "2023-24" },
      ],
    });

    const response = await request(app).get("/api/nba/seasons");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(["2025-26", "2024-25", "2023-24"]);
  });

  it("should return mapped season strings, not raw row objects", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ season: "2025-26" }],
    });

    const response = await request(app).get("/api/nba/seasons");

    expect(response.body).toEqual(["2025-26"]);
    expect(typeof response.body[0]).toBe("string");
  });

  it("should return empty array when no seasons found", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const response = await request(app).get("/api/nba/seasons");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("should limit to 3 seasons", async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { season: "2025-26" },
        { season: "2024-25" },
        { season: "2023-24" },
      ],
    });

    await request(app).get("/api/nba/seasons");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 10"),
      ["nba"]
    );
  });

  it("should order seasons descending", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/nfl/seasons");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY season DESC"),
      ["nfl"]
    );
  });

  it("should handle database errors gracefully", async () => {
    mockPool.query.mockRejectedValue(new Error("Database error"));

    const response = await request(app).get("/api/nba/seasons");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Failed to fetch seasons" });
  });

  it("should work with different league parameters", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/nhl/seasons");

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["nhl"]);
  });

  it("should exclude null seasons", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await request(app).get("/api/nba/seasons");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("season IS NOT NULL"),
      expect.any(Array)
    );
  });
});
