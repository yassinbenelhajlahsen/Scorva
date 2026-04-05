import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn, _opts) => fn());

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const { getNbaGame, getNflGame, getNhlGame } = await import(
  resolve(__dirname, "../../src/services/gameDetailService.js")
);

const THIRTY_DAYS = 30 * 86400;

const makeFinalRow = (league) => ({
  json_build_object: { game: { status: "Final", league } },
});
const makeLiveRow = (league) => ({
  json_build_object: { game: { status: "In Progress", league } },
});

describe("gameDetailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_key, _ttl, fn, _opts) => fn());
  });

  describe.each([
    { fn: () => getNbaGame, league: "nba", name: "getNbaGame" },
    { fn: () => getNflGame, league: "nfl", name: "getNflGame" },
    { fn: () => getNhlGame, league: "nhl", name: "getNhlGame" },
  ])("$name", ({ fn, league }) => {
    it("calls cached with correct key and 30-day TTL", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(123);

      expect(mockCached).toHaveBeenCalledWith(
        `gameDetail:${league}:123`,
        THIRTY_DAYS,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("passes gameId and league string to DB query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fn()(456);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("json_build_object"),
        [456, league]
      );
    });

    it("returns first row from query result", async () => {
      const row = makeFinalRow(league);
      mockPool.query.mockResolvedValueOnce({ rows: [row] });

      const result = await fn()(1);

      expect(result).toEqual(row);
    });

    it("returns null when no rows found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await fn()(999);

      expect(result).toBeNull();
    });

    it("cacheIf returns true when game status includes Final", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [makeFinalRow(league)] });
      await fn()(1);

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf(makeFinalRow(league))).toBe(true);
    });

    it("cacheIf returns true for Final OT (e.g. Final/OT)", async () => {
      const row = { json_build_object: { game: { status: "Final/OT" } } };
      mockPool.query.mockResolvedValueOnce({ rows: [row] });
      await fn()(1);

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf(row)).toBe(true);
    });

    it("cacheIf returns false when game is In Progress", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [makeLiveRow(league)] });
      await fn()(1);

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf(makeLiveRow(league))).toBe(false);
    });

    it("cacheIf returns false when data is null", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await fn()(1);

      const [, , , opts] = mockCached.mock.calls[0];
      expect(opts.cacheIf(null)).toBeFalsy();
    });
  });
});
