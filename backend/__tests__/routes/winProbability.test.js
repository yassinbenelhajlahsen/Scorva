import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

// Mock the win probability service
const mockGetWinProbability = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/winProbabilityService.js"),
  () => ({ getWinProbability: mockGetWinProbability })
);

// Mock db so gameDetailService import doesn't blow up
const mockPool = { query: jest.fn() };
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPool,
}));

// Mock cache so it's a passthrough
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: async (_k, _t, fn) => fn(),
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: gameInfoRouter } = await import(
  resolve(__dirname, "../../src/routes/gameDetail.js")
);

const SAMPLE_DATA = {
  winProbability: [
    { homeWinPercentage: 0.65, playId: "p1" },
    { homeWinPercentage: 0.82, playId: "p2" },
  ],
  scoreMargin: [
    { playId: "p1", margin: 0 },
    { playId: "p2", margin: 5 },
  ],
};

describe("GET /:league/games/:eventId/win-probability", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", gameInfoRouter);
    jest.clearAllMocks();
  });

  describe("success cases", () => {
    it("returns 200 with data array for valid request", async () => {
      mockGetWinProbability.mockResolvedValue(SAMPLE_DATA);
      const res = await request(app).get("/api/nba/games/401585757/win-probability");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: SAMPLE_DATA });
    });

    it("returns { data: null } when ESPN has no win probability data", async () => {
      mockGetWinProbability.mockResolvedValue(null);
      const res = await request(app).get("/api/nba/games/401585757/win-probability");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: null });
    });

    it("passes isFinal=true when ?final=true query param is set", async () => {
      mockGetWinProbability.mockResolvedValue(SAMPLE_DATA);
      await request(app).get("/api/nba/games/401585757/win-probability?final=true");
      expect(mockGetWinProbability).toHaveBeenCalledWith("nba", "401585757", true);
    });

    it("passes isFinal=false when ?final param is absent", async () => {
      mockGetWinProbability.mockResolvedValue(null);
      await request(app).get("/api/nba/games/401585757/win-probability");
      expect(mockGetWinProbability).toHaveBeenCalledWith("nba", "401585757", false);
    });

    it("works for NFL", async () => {
      mockGetWinProbability.mockResolvedValue(SAMPLE_DATA);
      const res = await request(app).get("/api/nfl/games/401671773/win-probability");
      expect(res.status).toBe(200);
      expect(mockGetWinProbability).toHaveBeenCalledWith("nfl", "401671773", false);
    });

    it("works for NHL", async () => {
      mockGetWinProbability.mockResolvedValue(null);
      const res = await request(app).get("/api/nhl/games/401559800/win-probability");
      expect(res.status).toBe(200);
      expect(mockGetWinProbability).toHaveBeenCalledWith("nhl", "401559800", false);
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid league", async () => {
      const res = await request(app).get("/api/xyz/games/401585757/win-probability");
      expect(res.status).toBe(400);
      expect(res.text).toBe("Invalid league");
      expect(mockGetWinProbability).not.toHaveBeenCalled();
    });

    it("returns 400 for non-numeric eventId", async () => {
      const res = await request(app).get("/api/nba/games/abc/win-probability");
      expect(res.status).toBe(400);
      expect(res.text).toBe("Invalid event ID");
      expect(mockGetWinProbability).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns 500 when service throws", async () => {
      mockGetWinProbability.mockRejectedValue(new Error("Unexpected"));
      const res = await request(app).get("/api/nba/games/401585757/win-probability");
      expect(res.status).toBe(500);
      expect(res.text).toBe("Server error");
    });
  });

  describe("route ordering — win-probability takes precedence over :gameId", () => {
    it("does not route to getGameInfo for win-probability path", async () => {
      mockGetWinProbability.mockResolvedValue(null);
      // If routing were wrong, mockPool.query would be called (getGameInfo hits the DB)
      await request(app).get("/api/nba/games/401585757/win-probability");
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
