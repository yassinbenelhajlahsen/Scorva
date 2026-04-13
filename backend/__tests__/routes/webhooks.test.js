/**
 * Tests for POST /api/webhooks/supabase-auth
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

const routerPath = resolve(__dirname, "../../src/routes/meta/webhooks.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: webhooksRouter } = await import(routerPath);

describe("Webhooks Route - POST /api/webhooks/supabase-auth", () => {
  let app;
  const WEBHOOK_SECRET = "test-webhook-secret";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", webhooksRouter);
    jest.clearAllMocks();
    process.env.SUPABASE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  describe("Authorization", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 401 when Authorization header does not match secret", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", "wrong-secret")
        .send({});

      expect(res.status).toBe(401);
    });

    it("should return 401 when SUPABASE_WEBHOOK_SECRET is not set", async () => {
      delete process.env.SUPABASE_WEBHOOK_SECRET;

      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe("Non-INSERT event filtering", () => {
    it("should return 200 ok for UPDATE events", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({ type: "UPDATE", schema: "auth", record: { id: "uuid-1" } });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("should return 200 ok for DELETE events", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({ type: "DELETE", schema: "auth", record: { id: "uuid-1" } });

      expect(res.status).toBe(200);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("should return 200 ok for non-auth schema events", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({ type: "INSERT", schema: "public", record: { id: "uuid-1" } });

      expect(res.status).toBe(200);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("should return 200 ok for INSERT with missing record id", async () => {
      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({ type: "INSERT", schema: "auth", record: {} });

      expect(res.status).toBe(200);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe("User creation — email/password signup", () => {
    it("should insert user with first_name and last_name from meta", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-1",
            email: "user@example.com",
            raw_user_meta_data: { first_name: "John", last_name: "Doe" },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toEqual(["uuid-1", "user@example.com", "John", "Doe"]);
    });

    it("should handle missing email gracefully (null)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-5",
            raw_user_meta_data: { first_name: "No", last_name: "Email" },
          },
        });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[1]).toBeNull();
    });

    it("should handle missing raw_user_meta_data", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: { id: "uuid-6", email: "bare@example.com" },
        });

      expect(res.status).toBe(200);
      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toEqual(["uuid-6", "bare@example.com", null, null]);
    });
  });

  describe("User creation — Google OAuth signup", () => {
    it("should split full_name into first and last name", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-2",
            email: "google@example.com",
            raw_user_meta_data: { full_name: "Jane Smith" },
          },
        });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toEqual(["uuid-2", "google@example.com", "Jane", "Smith"]);
    });

    it("should handle multi-word last name in full_name", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-3",
            email: "multi@example.com",
            raw_user_meta_data: { full_name: "Mary Jane Watson" },
          },
        });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[2]).toBe("Mary");
      expect(params[3]).toBe("Jane Watson");
    });

    it("should handle single-word full_name with null last name", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-4",
            email: "mono@example.com",
            raw_user_meta_data: { full_name: "Madonna" },
          },
        });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[2]).toBe("Madonna");
      expect(params[3]).toBeNull();
    });
  });

  describe("Error handling", () => {
    it("should return 500 on DB error and log the error", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Connection failed"));

      const res = await request(app)
        .post("/api/webhooks/supabase-auth")
        .set("Authorization", WEBHOOK_SECRET)
        .send({
          type: "INSERT",
          schema: "auth",
          record: {
            id: "uuid-err",
            email: "fail@example.com",
            raw_user_meta_data: {},
          },
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to create user");
    });
  });
});
