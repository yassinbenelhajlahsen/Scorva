/**
 * Tests for /api/user endpoints
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

const authPath = resolve(__dirname, "../../src/middleware/auth.js");
jest.unstable_mockModule(authPath, () => ({
  requireAuth: jest.fn((req, _res, next) => {
    req.user = { id: "test-uuid-1234" };
    next();
  }),
}));

const mockDeleteUser = jest.fn();
jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

const routerPath = resolve(__dirname, "../../src/routes/user/user.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: userRouter } = await import(routerPath);

describe("User Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", userRouter);
    jest.clearAllMocks();
  });

  describe("GET /api/user/profile", () => {
    it("should return user profile from DB", async () => {
      const user = {
        id: "test-uuid-1234",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        default_league: "nba",
      };
      mockPool.query.mockResolvedValueOnce({ rows: [user] });

      const res = await request(app).get("/api/user/profile");

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("test@example.com");
      expect(res.body.first_name).toBe("John");
      expect(res.body.default_league).toBe("nba");
    });

    it("should return fallback object when user not found in DB", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/api/user/profile");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("test-uuid-1234");
      expect(res.body.default_league).toBeNull();
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).get("/api/user/profile");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to fetch profile");
    });

    it("should return 401 when auth is not provided", async () => {
      const { requireAuth } = await import(authPath);
      requireAuth.mockImplementationOnce((_req, res) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const res = await request(app).get("/api/user/profile");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/user/profile", () => {
    it("should update first name and return updated user", async () => {
      const updated = {
        id: "test-uuid-1234",
        email: "test@example.com",
        first_name: "Jane",
        last_name: "Doe",
        default_league: "nba",
      };
      mockPool.query.mockResolvedValueOnce({ rows: [updated] });

      const res = await request(app)
        .patch("/api/user/profile")
        .send({ firstName: "Jane" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.first_name).toBe("Jane");
    });

    it("should update default_league", async () => {
      const updated = {
        id: "test-uuid-1234",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        default_league: "nfl",
      };
      mockPool.query.mockResolvedValueOnce({ rows: [updated] });

      const res = await request(app)
        .patch("/api/user/profile")
        .send({ defaultLeague: "nfl" });

      expect(res.status).toBe(200);
      expect(res.body.user.default_league).toBe("nfl");
    });

    it("should return 400 when no fields are provided", async () => {
      const res = await request(app).patch("/api/user/profile").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/At least one field/);
    });

    it("should return 400 for empty body", async () => {
      const res = await request(app).patch("/api/user/profile");

      expect(res.status).toBe(400);
    });

    it("should return 500 on DB error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .patch("/api/user/profile")
        .send({ firstName: "Jane" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update profile");
    });
  });

  describe("DELETE /api/user/account", () => {
    it("should delete DB row and Supabase auth user, return 204", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockDeleteUser.mockResolvedValueOnce({ error: null });

      const res = await request(app).delete("/api/user/account");

      expect(res.status).toBe(204);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockDeleteUser).toHaveBeenCalledWith("test-uuid-1234");
    });

    it("should return 500 when Supabase auth deletion fails", async () => {
      mockDeleteUser.mockResolvedValueOnce({ error: new Error("Auth deletion failed") });

      const res = await request(app).delete("/api/user/account");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to delete account");
    });

    it("should return 500 on DB error", async () => {
      mockDeleteUser.mockResolvedValueOnce({ error: null });
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app).delete("/api/user/account");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to delete account");
      // Supabase is called first in the new order, then DB delete
      expect(mockDeleteUser).toHaveBeenCalledWith("test-uuid-1234");
    });

    it("should return 401 when auth is not provided", async () => {
      const { requireAuth } = await import(authPath);
      requireAuth.mockImplementationOnce((_req, res) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const res = await request(app).delete("/api/user/account");
      expect(res.status).toBe(401);
    });
  });
});
