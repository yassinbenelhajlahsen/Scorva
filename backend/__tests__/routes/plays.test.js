/**
 * Tests for GET /api/:league/games/:gameId/plays
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockAxiosGet = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({
  cached: jest.fn().mockImplementation(async (_k, _t, fn) => fn()),
}));

jest.unstable_mockModule("axios", () => ({ default: { get: mockAxiosGet } }));

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: playsRouter } = await import(
  resolve(__dirname, "../../src/routes/plays.js")
);

function makeFinalGameRow() {
  return { eventid: 401584583, status: "Final" };
}

function makePlayRow(overrides = {}) {
  return {
    id: 1,
    espn_play_id: "100",
    sequence: 1,
    period: 1,
    clock: "12:00",
    description: "LeBron makes 2pt",
    short_text: "LeBron 2pt",
    home_score: 2,
    away_score: 0,
    scoring_play: true,
    team_id: 1,
    play_type: "Made Shot",
    drive_number: null,
    drive_description: null,
    drive_result: null,
    team_logo: null,
    team_short: null,
    ...overrides,
  };
}

describe("Plays Route - GET /api/:league/games/:gameId/plays", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", playsRouter);
    jest.clearAllMocks();
  });

  describe("Success cases", () => {
    it("returns 200 with plays for a final NBA game", async () => {
      const play = makePlayRow();
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeFinalGameRow()] })
        .mockResolvedValueOnce({ rows: [play] });

      const res = await request(app).get("/api/nba/games/1/plays");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("plays");
      expect(res.body).toHaveProperty("source");
      expect(Array.isArray(res.body.plays)).toBe(true);
    });

    it("works for NFL games", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeFinalGameRow()] })
        .mockResolvedValueOnce({ rows: [makePlayRow({ drive_number: 1, drive_description: "Drive", drive_result: "Touchdown" })] });

      const res = await request(app).get("/api/nfl/games/1/plays");

      expect(res.status).toBe(200);
    });

    it("works for NHL games", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [makeFinalGameRow()] })
        .mockResolvedValueOnce({ rows: [makePlayRow()] });

      const res = await request(app).get("/api/nhl/games/1/plays");

      expect(res.status).toBe(200);
    });

    it("returns source: espn for live games", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ eventid: 401584583, status: "In Progress" }] })
        .mockResolvedValueOnce({ rows: [] }); // getStoredPlaysLive — no plays yet
      mockAxiosGet.mockResolvedValueOnce({ data: { plays: [] } });

      const res = await request(app).get("/api/nba/games/1/plays");

      expect(res.status).toBe(200);
      expect(res.body.source).toBe("espn");
    });
  });

  describe("Not found", () => {
    it("returns 404 when game does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/nba/games/999/plays");

      expect(res.status).toBe(404);
      expect(res.text).toBe("Game not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid league", async () => {
      const res = await request(app).get("/api/xyz/games/1/plays");

      expect(res.status).toBe(400);
      expect(res.text).toBe("Invalid league");
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("returns 400 for non-numeric game ID", async () => {
      const res = await request(app).get("/api/nba/games/abc/plays");

      expect(res.status).toBe(400);
      expect(res.text).toBe("Invalid game ID");
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("returns 500 on database error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/nba/games/1/plays");

      expect(res.status).toBe(500);
      expect(res.text).toBe("Server error");
    });
  });
});
