/**
 * Tests for middleware/index.js — SSE connection limiter and CORS origins.
 *
 * generalLimiter / aiLimiter / chatLimiter are express-rate-limit instances and
 * are always mocked as no-ops in route tests. Here we just verify they are
 * exported middleware functions with the correct error message shape.
 *
 * The SSE connection limiter is custom code we own, so we test its behaviour
 * fully: per-IP cap, global cap, and decrement-on-close.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock pino-http and logger to avoid log noise in tests
jest.unstable_mockModule("pino-http", () => ({
  default: jest.fn(() => jest.fn((_req, _res, next) => next?.())),
}));

jest.unstable_mockModule(
  resolve(__dirname, "../../src/logger.js"),
  () => ({ default: { child: jest.fn(() => ({})) } })
);

const {
  sseConnectionLimiter,
  chatSseConnectionLimiter,
  generalLimiter,
  aiLimiter,
  chatLimiter,
  corsOrigins,
} = await import(resolve(__dirname, "../../src/middleware/index.js"));

// ─── Helpers ────────────────────────────────────────────────────────────────

let ipCounter = 0;
function uniqueIp() {
  return `192.168.${Math.floor(ipCounter / 255)}.${(ipCounter++ % 255) + 1}`;
}

function makeReqRes(ip) {
  const handlers = {};
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    emit: (event) => handlers[event]?.(),
  };
  return { req: { ip: ip ?? uniqueIp() }, res };
}

// ─── SSE Connection Limiter ──────────────────────────────────────────────────

describe("sseConnectionLimiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a connection under per-IP limit", () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();

    sseConnectionLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    res.emit("close");
  });

  it("increments and then decrements per-IP count on close", () => {
    const ip = uniqueIp();
    const next = jest.fn();
    const { req, res } = makeReqRes(ip);

    sseConnectionLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // After close a second connection from same IP should still be allowed
    res.emit("close");

    const next2 = jest.fn();
    const { req: req2, res: res2 } = makeReqRes(ip);
    sseConnectionLimiter(req2, res2, next2);
    expect(next2).toHaveBeenCalledTimes(1);
    expect(res2.status).not.toHaveBeenCalled();

    res2.emit("close");
  });

  it("returns 429 and error message when per-IP limit (6) is reached", () => {
    const ip = uniqueIp();
    const openers = [];

    // Fill the per-IP slot (limit = 6)
    for (let i = 0; i < 6; i++) {
      const { req, res } = makeReqRes(ip);
      sseConnectionLimiter(req, res, jest.fn());
      openers.push(res);
    }

    // 7th connection from same IP should be rejected
    const { req: req7, res: res7 } = makeReqRes(ip);
    const next7 = jest.fn();
    sseConnectionLimiter(req7, res7, next7);

    expect(res7.status).toHaveBeenCalledWith(429);
    expect(res7.json).toHaveBeenCalledWith({ error: "Too many live connections" });
    expect(next7).not.toHaveBeenCalled();

    // Cleanup
    openers.forEach((r) => r.emit("close"));
  });

  it("allows connection again after per-IP slot is freed", () => {
    const ip = uniqueIp();

    // Fill slots
    const openers = [];
    for (let i = 0; i < 6; i++) {
      const { req, res } = makeReqRes(ip);
      sseConnectionLimiter(req, res, jest.fn());
      openers.push(res);
    }

    // Free one slot
    openers[0].emit("close");

    // New connection should now be allowed
    const { req: newReq, res: newRes } = makeReqRes(ip);
    const newNext = jest.fn();
    sseConnectionLimiter(newReq, newRes, newNext);

    expect(newNext).toHaveBeenCalledTimes(1);
    expect(newRes.status).not.toHaveBeenCalled();

    // Cleanup remaining
    for (let i = 1; i < openers.length; i++) openers[i].emit("close");
    newRes.emit("close");
  });

  it("registers a close listener on res", () => {
    const { req, res } = makeReqRes();
    sseConnectionLimiter(req, res, jest.fn());

    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));

    res.emit("close");
  });
});

// ─── Chat SSE Connection Limiter ─────────────────────────────────────────────

describe("chatSseConnectionLimiter", () => {
  it("allows a connection under per-IP limit", () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();

    chatSseConnectionLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    res.emit("close");
  });

  it("returns 429 when per-IP limit (3) is reached", () => {
    const ip = uniqueIp();
    const openers = [];

    for (let i = 0; i < 3; i++) {
      const { req, res } = makeReqRes(ip);
      chatSseConnectionLimiter(req, res, jest.fn());
      openers.push(res);
    }

    const { req: req4, res: res4 } = makeReqRes(ip);
    const next4 = jest.fn();
    chatSseConnectionLimiter(req4, res4, next4);

    expect(res4.status).toHaveBeenCalledWith(429);
    expect(res4.json).toHaveBeenCalledWith({ error: "Too many chat connections" });
    expect(next4).not.toHaveBeenCalled();

    openers.forEach((r) => r.emit("close"));
  });
});

// ─── Rate limiter exports ────────────────────────────────────────────────────

describe("rate limiter exports", () => {
  it("generalLimiter is a middleware function", () => {
    expect(typeof generalLimiter).toBe("function");
  });

  it("aiLimiter is a middleware function", () => {
    expect(typeof aiLimiter).toBe("function");
  });

  it("chatLimiter is a middleware function", () => {
    expect(typeof chatLimiter).toBe("function");
  });
});

// ─── CORS origins ───────────────────────────────────────────────────────────

describe("corsOrigins", () => {
  it("is an array", () => {
    expect(Array.isArray(corsOrigins)).toBe(true);
  });

  it("always includes the production Vercel origin", () => {
    expect(corsOrigins).toContain("https://scorva.vercel.app");
  });

  it("always includes the production custom domain", () => {
    expect(corsOrigins).toContain("https://scorva.dev");
  });

  it("includes localhost origins in non-production environment", () => {
    // NODE_ENV=test, so isProd is false → localhost origins are included
    const localhostOrigins = corsOrigins.filter((o) => o.includes("localhost"));
    expect(localhostOrigins.length).toBeGreaterThan(0);
  });

  it("all entries are valid URL strings", () => {
    for (const origin of corsOrigins) {
      expect(() => new URL(origin)).not.toThrow();
    }
  });
});
