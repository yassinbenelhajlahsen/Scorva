import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Passthrough by default (cache.js with no REDIS_URL); tests override to
// simulate "full pass already ran today".
const mockCached = jest.fn(async (_key, _ttl, fn) => fn());
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: mockCached,
}));

const { refreshPopularity } = await import(
  resolve(__dirname, "../../src/ingestion/refreshPopularity.js")
);

const isIncremental = (sql) => /UPDATE players/.test(sql) && /g\.date\s*>=/.test(sql);
const isFull = (sql) => /UPDATE players/.test(sql) && !/g\.date\s*>=/.test(sql);

describe("refreshPopularity", () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockPool.query.mockResolvedValue({ rowCount: 0 });
  });

  it("recomputes only players who appeared in a recent game on every cycle", async () => {
    // The old full GROUP BY over all 1.1M stats rows ran every 30 min to
    // change ~1 row. Only players with a game in the last few days can move.
    await refreshPopularity(mockPool);

    const incremental = mockPool.query.mock.calls.map(([sql]) => sql).filter(isIncremental);
    expect(incremental).toHaveLength(1);
    expect(incremental[0]).toContain("COUNT(*)");
    expect(incremental[0]).toContain("GROUP BY");
    expect(incremental[0]).toMatch(/popularity IS DISTINCT FROM/);
  });

  it("runs the full recompute at most once per day (memoized on the EST date)", async () => {
    await refreshPopularity(mockPool);

    const full = mockPool.query.mock.calls.map(([sql]) => sql).filter(isFull);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatch(/FROM stats[\s\S]*GROUP BY playerid/);
    expect(mockCached).toHaveBeenCalledTimes(1);
    expect(mockCached.mock.calls[0][0]).toMatch(/^ingest:popularity:full:\d{4}-\d{2}-\d{2}$/);
  });

  it("skips the full recompute when it already ran today", async () => {
    mockCached.mockResolvedValue(true);

    await refreshPopularity(mockPool);

    const sqls = mockPool.query.mock.calls.map(([sql]) => sql);
    expect(sqls.filter(isFull)).toHaveLength(0);
    expect(sqls.filter(isIncremental)).toHaveLength(1);
  });

  it("uses the pool passed as parameter, not a module-level import", async () => {
    const anotherPool = createMockPool();
    anotherPool.query.mockResolvedValue({ rowCount: 0 });

    await refreshPopularity(anotherPool);

    expect(anotherPool.query).toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("completes without throwing on success", async () => {
    await expect(refreshPopularity(mockPool)).resolves.toBeUndefined();
  });
});
