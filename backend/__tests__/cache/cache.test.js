/**
 * Tests for backend/src/cache/cache.js
 *
 * Mocks ioredis so no real Redis connection is made.
 * Tests cover: cache hit, cache miss, cacheIf predicate,
 * Redis-down fallback, invalidate, invalidatePattern, and no-REDIS_URL mode.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Build a mock Redis instance ---
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockQuit = jest.fn();
const mockPipelineExec = jest.fn();
const mockScanStream = jest.fn();
const mockPipeline = jest.fn(() => ({
  del: jest.fn(),
  exec: mockPipelineExec,
}));
const mockConnect = jest.fn().mockResolvedValue(undefined);

// The mock Redis constructor returns a stable object we can inspect
const mockRedisInstance = {
  get: mockGet,
  set: mockSet,
  del: mockDel,
  quit: mockQuit,
  pipeline: mockPipeline,
  scanStream: mockScanStream,
  connect: mockConnect,
  on: jest.fn(),
};

const MockRedis = jest.fn(() => mockRedisInstance);

// Mock ioredis BEFORE importing cache.js
const ioredisPath = resolve(__dirname, "../../node_modules/ioredis/built/index.js");
jest.unstable_mockModule("ioredis", () => ({
  default: MockRedis,
}));

// Helper: (re)import cache.js with a fresh module registry
// We need to set REDIS_URL before the module initialises the client.
async function importCache(redisUrl = "redis://localhost:6379") {
  const originalUrl = process.env.REDIS_URL;
  if (redisUrl !== null) {
    process.env.REDIS_URL = redisUrl;
  } else {
    delete process.env.REDIS_URL;
  }

  // Clear the module from Jest's registry so it re-executes with the new env var
  const cachePath = resolve(__dirname, "../../src/cache/cache.js");
  // Use a cache-busting query param trick for ESM dynamic import
  const { cached, invalidate, invalidatePattern, closeCache } = await import(
    `../../src/cache/cache.js?t=${Date.now()}`
  );

  if (redisUrl !== null) {
    process.env.REDIS_URL = redisUrl;
  } else if (originalUrl !== undefined) {
    process.env.REDIS_URL = originalUrl;
  } else {
    delete process.env.REDIS_URL;
  }

  return { cached, invalidate, invalidatePattern, closeCache };
}

describe("cache.js — with Redis connected", () => {
  let cached, invalidate, invalidatePattern, closeCache;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    // Import fresh module with REDIS_URL set
    process.env.REDIS_URL = "redis://localhost:6379";
    ({ cached, invalidate, invalidatePattern, closeCache } = await import(
      `../../src/cache/cache.js?bust=${Math.random()}`
    ));
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  describe("cached()", () => {
    it("returns cached value on hit without calling queryFn", async () => {
      const data = { id: 1, name: "Lakers" };
      mockGet.mockResolvedValueOnce(JSON.stringify(data));
      const queryFn = jest.fn();

      const result = await cached("teams:nba", 86400, queryFn);

      expect(result).toEqual(data);
      expect(queryFn).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("calls queryFn and stores result on cache miss", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockSet.mockResolvedValueOnce("OK");
      const data = [{ id: 1 }, { id: 2 }];
      const queryFn = jest.fn().mockResolvedValueOnce(data);

      const result = await cached("teams:nba", 86400, queryFn);

      expect(result).toEqual(data);
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        "v1:teams:nba",
        JSON.stringify(data),
        "EX",
        86400
      );
    });

    it("does not store null result", async () => {
      mockGet.mockResolvedValueOnce(null);
      const queryFn = jest.fn().mockResolvedValueOnce(null);

      const result = await cached("gameDetail:nba:999", 86400, queryFn);

      expect(result).toBeNull();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("stores result when cacheIf returns true", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockSet.mockResolvedValueOnce("OK");
      const data = { json_build_object: { game: { status: "Final" } } };
      const queryFn = jest.fn().mockResolvedValueOnce(data);

      await cached("gameDetail:nba:1", 86400, queryFn, {
        cacheIf: (d) => d?.json_build_object?.game?.status?.includes("Final"),
      });

      expect(mockSet).toHaveBeenCalled();
    });

    it("does not store result when cacheIf returns false", async () => {
      mockGet.mockResolvedValueOnce(null);
      const data = { json_build_object: { game: { status: "In Progress" } } };
      const queryFn = jest.fn().mockResolvedValueOnce(data);

      const result = await cached("gameDetail:nba:1", 86400, queryFn, {
        cacheIf: (d) => d?.json_build_object?.game?.status?.includes("Final"),
      });

      expect(result).toEqual(data);
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("falls through to queryFn when Redis.get throws", async () => {
      mockGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      mockSet.mockResolvedValueOnce("OK");
      const data = { id: 1 };
      const queryFn = jest.fn().mockResolvedValueOnce(data);

      const result = await cached("teams:nba", 86400, queryFn);

      expect(result).toEqual(data);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it("still returns data when Redis.set throws after a miss", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockSet.mockRejectedValueOnce(new Error("OOM"));
      const data = { id: 1 };
      const queryFn = jest.fn().mockResolvedValueOnce(data);

      const result = await cached("teams:nba", 86400, queryFn);

      expect(result).toEqual(data);
    });
  });

  describe("invalidate()", () => {
    it("calls redis.del with the given keys", async () => {
      mockDel.mockResolvedValueOnce(2);

      await invalidate("gameDetail:nba:1", "games:nba:default:2026-03-07");

      expect(mockDel).toHaveBeenCalledWith(
        "v1:gameDetail:nba:1",
        "v1:games:nba:default:2026-03-07"
      );
    });

    it("is a no-op when called with no keys", async () => {
      await invalidate();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("swallows errors from redis.del", async () => {
      mockDel.mockRejectedValueOnce(new Error("connection lost"));
      await expect(invalidate("somekey")).resolves.toBeUndefined();
    });
  });

  describe("invalidatePattern()", () => {
    it("scans and deletes matching keys via pipeline", async () => {
      const mockPipelineInstance = { del: jest.fn(), exec: jest.fn().mockResolvedValueOnce([]) };
      mockPipeline.mockReturnValueOnce(mockPipelineInstance);

      // Simulate scanStream yielding two batches
      mockScanStream.mockReturnValueOnce(
        (async function* () {
          yield ["games:nba:default:2026-03-06", "games:nba:default:2026-03-07"];
          yield ["games:nba:2025-26:all"];
        })()
      );

      await invalidatePattern("games:nba:*");

      expect(mockScanStream).toHaveBeenCalledWith({ match: "v1:games:nba:*", count: 100 });
      expect(mockPipelineInstance.del).toHaveBeenCalledTimes(3);
      expect(mockPipelineInstance.exec).toHaveBeenCalledTimes(1);
    });

    it("does not call pipeline.exec when no keys match", async () => {
      const mockPipelineInstance = { del: jest.fn(), exec: jest.fn() };
      mockPipeline.mockReturnValueOnce(mockPipelineInstance);
      mockScanStream.mockReturnValueOnce(
        (async function* () {
          yield [];
        })()
      );

      await invalidatePattern("games:nba:*");

      expect(mockPipelineInstance.exec).not.toHaveBeenCalled();
    });

    it("swallows errors from scanStream", async () => {
      mockScanStream.mockReturnValueOnce(
        (async function* () {
          throw new Error("scan failed");
        })()
      );
      mockPipeline.mockReturnValueOnce({ del: jest.fn(), exec: jest.fn() });

      await expect(invalidatePattern("games:*")).resolves.toBeUndefined();
    });
  });

  describe("closeCache()", () => {
    it("calls redis.quit", async () => {
      mockQuit.mockResolvedValueOnce("OK");
      await closeCache();
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it("swallows errors from redis.quit", async () => {
      mockQuit.mockRejectedValueOnce(new Error("already closed"));
      await expect(closeCache()).resolves.toBeUndefined();
    });
  });
});

describe("cache.js — without REDIS_URL (no-op mode)", () => {
  let cached, invalidate, invalidatePattern, closeCache;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
    ({ cached, invalidate, invalidatePattern, closeCache } = await import(
      `../../src/cache/cache.js?noop=${Math.random()}`
    ));
  });

  it("cached() calls queryFn and returns result without touching Redis", async () => {
    const data = { id: 1 };
    const queryFn = jest.fn().mockResolvedValueOnce(data);

    const result = await cached("teams:nba", 86400, queryFn);

    expect(result).toEqual(data);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("invalidate() is a no-op", async () => {
    await invalidate("somekey");
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("invalidatePattern() is a no-op", async () => {
    await invalidatePattern("games:*");
    expect(mockScanStream).not.toHaveBeenCalled();
  });

  it("closeCache() is a no-op", async () => {
    await closeCache();
    expect(mockQuit).not.toHaveBeenCalled();
  });
});
