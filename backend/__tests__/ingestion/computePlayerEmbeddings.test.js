import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({
  getCurrentSeason: jest.fn(async (league) => (league === "nfl" ? "2026-27" : "2025-26")),
}));

const mockCached = jest.fn(async (_key, _ttl, fn) => fn());
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: mockCached,
}));

const { computeAllEmbeddings } = await import(
  resolve(__dirname, "../../src/ingestion/computePlayerEmbeddings.js")
);

const isStatQuery = (sql) => /FROM stats s/.test(sql) && /game_count/.test(sql);

describe("computeAllEmbeddings", () => {
  let pool;

  beforeEach(() => {
    pool = createMockPool();
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    pool.query.mockImplementation(async (sql) => {
      if (/MAX\(updated_at\)/.test(sql)) return { rows: [{ last_run: null }] };
      if (/FROM games/.test(sql)) return { rows: [{ finals: 7, last_date: "2026-01-02" }] };
      return { rows: [] };
    });
  });

  it("memoizes each league's recompute on its finals signature", async () => {
    await computeAllEmbeddings(pool);

    const keys = mockCached.mock.calls.map(([key]) => key);
    expect(keys).toEqual([
      "ingest:embeddings:nba:2025-26:7:2026-01-02",
      "ingest:embeddings:nfl:2026-27:7:2026-01-02",
      "ingest:embeddings:nhl:2025-26:7:2026-01-02",
    ]);
    const statQueries = pool.query.mock.calls.map(([sql]) => sql).filter(isStatQuery);
    expect(statQueries).toHaveLength(3);
  });

  it("does not run the stat aggregate when no game went Final since the last recompute", async () => {
    // Off-season: the 6h MAX(updated_at) cap stopped gating once the season
    // rolled over (no rows for the new season), so the aggregates ran 48×/day.
    mockCached.mockResolvedValue(true);

    await computeAllEmbeddings(pool);

    const statQueries = pool.query.mock.calls.map(([sql]) => sql).filter(isStatQuery);
    expect(statQueries).toHaveLength(0);
  });

  it("filters the stat aggregate on games.league so the (league, season, date) index applies", async () => {
    await computeAllEmbeddings(pool);

    const statQueries = pool.query.mock.calls.map(([sql]) => sql).filter(isStatQuery);
    for (const sql of statQueries) {
      expect(sql).toMatch(/g\.league\s*=\s*'(nba|nfl|nhl)'/);
    }
  });

  it("still honours the 6h cap before consulting any signature", async () => {
    pool.query.mockImplementation(async (sql) => {
      if (/MAX\(updated_at\)/.test(sql)) return { rows: [{ last_run: new Date() }] };
      return { rows: [] };
    });

    await computeAllEmbeddings(pool);

    expect(mockCached).not.toHaveBeenCalled();
  });
});
