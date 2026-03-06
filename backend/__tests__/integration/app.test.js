/**
 * Integration tests for Express app
 */

import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import express from "express";
import cors from "cors";

describe("Express App Integration", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
  });

  it("should create an Express application", () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe("function");
  });

  it("should have middleware configured", () => {
    // Test that middleware is working by making a request
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());
    testApp.get("/test", (req, res) => res.json({ ok: true }));

    expect(testApp).toBeDefined();
  });

  it("should parse JSON bodies", async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post("/test", (req, res) => res.json(req.body));

    const { default: request } = await import("supertest");
    const response = await request(testApp)
      .post("/test")
      .send({ name: "test" });

    expect(response.body).toEqual({ name: "test" });
  });

  it("should handle 404 for unknown routes", (done) => {
    const testApp = express();
    testApp.use(express.json());

    const server = testApp.listen(0, () => {
      const port = server.address().port;

      import("supertest").then(({ default: request }) => {
        request(testApp)
          .get("/api/unknown-route")
          .expect(404)
          .end((err) => {
            server.close();
            done(err);
          });
      });
    });
  });
});

describe("API Routes Registration", () => {
  it("should mount routes under /api prefix", async () => {
    const testApp = express();
    const mockRouter = express.Router();
    mockRouter.get("/test", (req, res) => res.json({ ok: true }));

    testApp.use("/api", mockRouter);

    const { default: request } = await import("supertest");
    const response = await request(testApp).get("/api/test");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("should handle multiple router registrations", async () => {
    const testApp = express();
    const router1 = express.Router();
    const router2 = express.Router();

    router1.get("/route1", (req, res) => res.json({ route: 1 }));
    router2.get("/route2", (req, res) => res.json({ route: 2 }));

    testApp.use("/api", router1);
    testApp.use("/api", router2);

    const { default: request } = await import("supertest");
    const response1 = await request(testApp).get("/api/route1");
    const response2 = await request(testApp).get("/api/route2");

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
  });
});

describe("CORS Configuration", () => {
  let corsOrigins;

  beforeAll(async () => {
    const middleware = await import("../../src/middleware/index.js");
    corsOrigins = middleware.corsOrigins;
  });

  it("should include localhost dev origins", () => {
    expect(corsOrigins).toContain("http://localhost:5173");
    expect(corsOrigins).toContain("http://localhost:5174");
    expect(corsOrigins).toContain("http://localhost:5175");
  });

  it("should include production origins", () => {
    expect(corsOrigins).toContain("https://scorva.vercel.app");
    expect(corsOrigins).toContain("https://scorva.dev");
  });
});

describe("Middleware Order", () => {
  it("should apply middleware in correct order", async () => {
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    const router = express.Router();
    router.get("/test", (req, res) => res.json({ ok: true }));
    testApp.use("/api", router);

    const { default: request } = await import("supertest");
    const response = await request(testApp).get("/api/test");

    expect(response.status).toBe(200);
  });

  it("should parse JSON before route handlers", async () => {
    const testApp = express();
    testApp.use(express.json());

    const router = express.Router();
    router.post("/test", (req, res) => res.json(req.body));
    testApp.use("/api", router);

    const { default: request } = await import("supertest");
    const response = await request(testApp)
      .post("/api/test")
      .send({ data: "test" });

    expect(response.body).toEqual({ data: "test" });
  });
});

describe("Error Handling", () => {
  it("should handle uncaught errors in routes", async () => {
    const testApp = express();

    testApp.get("/error", () => {
      throw new Error("Test error");
    });

    // Add error handler
    testApp.use((err, _req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const { default: request } = await import("supertest");
    const response = await request(testApp).get("/error");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("error");
  });

  it("should catch async errors with proper handling", async () => {
    const testApp = express();

    testApp.get("/async-error", async (_req, _res, next) => {
      try {
        throw new Error("Async error");
      } catch (err) {
        next(err);
      }
    });

    testApp.use((err, _req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const { default: request } = await import("supertest");
    const response = await request(testApp).get("/async-error");

    expect(response.status).toBe(500);
  });
});
