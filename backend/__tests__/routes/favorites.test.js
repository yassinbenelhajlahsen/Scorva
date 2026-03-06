/**
 * Tests for /api/favorites endpoints
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

// Mock requireAuth to inject a test user
const authPath = resolve(__dirname, "../../src/middleware/auth.js");
jest.unstable_mockModule(authPath, () => ({
  requireAuth: jest.fn((req, _res, next) => {
    req.user = { id: "test-uuid-1234" };
    next();
  }),
}));

const routerPath = resolve(__dirname, "../../src/routes/favorites.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: favoritesRouter } = await import(routerPath);

describe("Favorites Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", favoritesRouter);
    jest.clearAllMocks();
  });

  describe("GET /api/favorites", () => {
    it("should return favorites data", async () => {
      // players query
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "LeBron James", league: "nba", image_url: null, position: "F", jerseynum: 23, team_name: "Lakers", team_shortname: "LAL", team_logo: null, team_id: 10 }] });
      // player stats query
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // teams query
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10, name: "Lakers", shortname: "LAL", location: "Los Angeles", logo_url: null, record: "30-10", league: "nba" }] });
      // team games query
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/favorites");
      expect(res.status).toBe(200);
      expect(res.body.players).toHaveLength(1);
      expect(res.body.players[0].name).toBe("LeBron James");
      expect(res.body.teams).toHaveLength(1);
      expect(res.body.teams[0].name).toBe("Lakers");
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).get("/api/favorites");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/favorites/players/:playerId", () => {
    it("should add a favorite player and return 201", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).post("/api/favorites/players/42");
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).post("/api/favorites/players/42");
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /api/favorites/players/:playerId", () => {
    it("should remove a favorite player and return 204", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete("/api/favorites/players/42");
      expect(res.status).toBe(204);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).delete("/api/favorites/players/42");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/favorites/teams/:teamId", () => {
    it("should add a favorite team and return 201", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).post("/api/favorites/teams/10");
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).post("/api/favorites/teams/10");
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /api/favorites/teams/:teamId", () => {
    it("should remove a favorite team and return 204", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).delete("/api/favorites/teams/10");
      expect(res.status).toBe(204);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).delete("/api/favorites/teams/10");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/favorites/check", () => {
    it("should return which player/team IDs are favorited", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ player_id: 42 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ team_id: 10 }] });
      const res = await request(app).get("/api/favorites/check?playerIds=42,99&teamIds=10,20");
      expect(res.status).toBe(200);
      expect(res.body.playerIds).toContain(42);
      expect(res.body.teamIds).toContain(10);
    });

    it("should handle empty query params", async () => {
      const res = await request(app).get("/api/favorites/check");
      expect(res.status).toBe(200);
      expect(res.body.playerIds).toEqual([]);
      expect(res.body.teamIds).toEqual([]);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));
      const res = await request(app).get("/api/favorites/check?playerIds=1");
      expect(res.status).toBe(500);
    });
  });

  describe("Auth enforcement", () => {
    it("should return 401 when requireAuth blocks the request", async () => {
      // Import the mocked requireAuth and make it reject for this test
      const { requireAuth } = await import(authPath);
      requireAuth.mockImplementationOnce((_req, res) => {
        res.status(401).json({ error: "Authentication required" });
      });

      const res = await request(app).get("/api/favorites");
      expect(res.status).toBe(401);
    });
  });
});
