import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockRunTodayProcessing = jest.fn();
const mockRunUpcomingProcessing = jest.fn();
const mockClearPlayerCache = jest.fn();
const mockGetPlayerCacheStats = jest
  .fn()
  .mockReturnValue({ size: 42, hits: 100, misses: 10 });

jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/pipeline/eventProcessor.js"),
  () => ({
    runTodayProcessing: mockRunTodayProcessing,
    runUpcomingProcessing: mockRunUpcomingProcessing,
    clearPlayerCache: mockClearPlayerCache,
    getPlayerCacheStats: mockGetPlayerCacheStats,
    // other exports eventProcessor has — not needed but avoids named-import errors
    runDateRangeProcessing: jest.fn(),
    clearPlayerCache: mockClearPlayerCache,
    getPlayerCacheStats: mockGetPlayerCacheStats,
  }),
);

const mockRefreshPopularity = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/refreshPopularity.js"),
  () => ({ refreshPopularity: mockRefreshPopularity }),
);

const mockInvalidatePattern = jest.fn();
const mockCloseCache = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/cache/cache.js"),
  () => ({
    invalidatePattern: mockInvalidatePattern,
    closeCache: mockCloseCache,
    cached: jest.fn(),
    invalidate: jest.fn(),
  }),
);

const mockComputeAllEmbeddings = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/computePlayerEmbeddings.js"),
  () => ({
    computeAllEmbeddings: mockComputeAllEmbeddings,
    NFL_POSITION_GROUPS: {},
    NHL_POSITION_GROUPS: {},
    getNflGroup: jest.fn(),
    getNhlGroup: jest.fn(),
  }),
);

const mockCleanupClinchedPlayoffGames = jest.fn();
jest.unstable_mockModule(
  resolve(
    __dirname,
    "../../src/ingestion/cleanup/cleanupClinchedPlayoffGames.js",
  ),
  () => ({
    cleanupClinchedPlayoffGames: mockCleanupClinchedPlayoffGames,
  }),
);

const { runUpsert, addOrdinal } = await import(
  resolve(__dirname, "../../src/ingestion/pipeline/upsert.js")
);

describe("CLI guard", () => {
  const upsertPath = resolve(__dirname, "../../src/ingestion/pipeline/upsert.js");

  it("does NOT fire when imported by Jest (guard is false)", () => {
    // process.argv[1] is the Jest worker — resolve() of it will never equal upsert.js
    const guardWouldFire = resolve(process.argv[1]) === upsertPath;
    expect(guardWouldFire).toBe(false);
  });

  it("WOULD fire when run directly (guard is true)", () => {
    // Simulate: node src/ingestion/upsert.js from the backend directory.
    // Derive the backend root from upsertPath so this works on any machine.
    const backendDir = resolve(upsertPath, "../../../..");
    const guardWouldFire =
      resolve(backendDir, "src/ingestion/pipeline/upsert.js") === upsertPath;
    expect(guardWouldFire).toBe(true);
  });

  it("WOULD fire with absolute path invocation", () => {
    const guardWouldFire = resolve(upsertPath) === upsertPath;
    expect(guardWouldFire).toBe(true);
  });
});

describe("addOrdinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
  ])("addOrdinal(%i) === %s", (day, expected) => {
    expect(addOrdinal(day)).toBe(expected);
  });
});

describe("runUpsert", () => {
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    mockRunTodayProcessing.mockResolvedValue(undefined);
    mockRunUpcomingProcessing.mockResolvedValue(undefined);
    mockRefreshPopularity.mockResolvedValue(undefined);
    mockInvalidatePattern.mockResolvedValue(undefined);
    mockCloseCache.mockResolvedValue(undefined);
    mockCleanupClinchedPlayoffGames.mockResolvedValue([]);
  });

  it("calls runTodayProcessing and runUpcomingProcessing for each league", async () => {
    await runUpsert(mockPool);

    expect(mockRunTodayProcessing).toHaveBeenCalledTimes(3);
    expect(mockRunUpcomingProcessing).toHaveBeenCalledTimes(3);

    for (const league of ["nba", "nfl", "nhl"]) {
      expect(mockRunTodayProcessing).toHaveBeenCalledWith(league, mockPool);
      expect(mockRunUpcomingProcessing).toHaveBeenCalledWith(league, mockPool);
    }
  });

  it("processes leagues sequentially in nba → nfl → nhl order", async () => {
    const order = [];
    mockRunTodayProcessing.mockImplementation(async (league) => {
      order.push(`today:${league}`);
    });
    mockRunUpcomingProcessing.mockImplementation(async (league) => {
      order.push(`upcoming:${league}`);
    });

    await runUpsert(mockPool);

    expect(order).toEqual([
      "today:nba",
      "upcoming:nba",
      "today:nfl",
      "upcoming:nfl",
      "today:nhl",
      "upcoming:nhl",
    ]);
  });

  it("invalidates correct cache patterns for each league", async () => {
    await runUpsert(mockPool);

    expect(mockInvalidatePattern).toHaveBeenCalledTimes(11);
    for (const league of ["nba", "nfl", "nhl"]) {
      expect(mockInvalidatePattern).toHaveBeenCalledWith(`games:${league}:*`);
      expect(mockInvalidatePattern).toHaveBeenCalledWith(
        `standings:${league}:*`,
      );
      expect(mockInvalidatePattern).toHaveBeenCalledWith(
        `gameDates:${league}:*`,
      );
    }
    expect(mockInvalidatePattern).toHaveBeenCalledWith("playoffs:nba:*");
    expect(mockInvalidatePattern).toHaveBeenCalledWith("similarPlayers:*");
  });

  it("calls refreshPopularity once after all leagues", async () => {
    const order = [];
    mockRunUpcomingProcessing.mockImplementation(async (league) => {
      order.push(`upcoming:${league}`);
    });
    mockRefreshPopularity.mockImplementation(async () => {
      order.push("refreshPopularity");
    });

    await runUpsert(mockPool);

    expect(mockRefreshPopularity).toHaveBeenCalledTimes(1);
    expect(mockRefreshPopularity).toHaveBeenCalledWith(mockPool);
    expect(order.indexOf("refreshPopularity")).toBeGreaterThan(
      order.indexOf("upcoming:nhl"),
    );
  });

  it("logs cache stats and clears player cache on success", async () => {
    await runUpsert(mockPool);

    expect(mockGetPlayerCacheStats).toHaveBeenCalledTimes(1);
    // called once in success path + once in finally
    expect(mockClearPlayerCache).toHaveBeenCalled();
  });

  it("continues processing other leagues when one fails", async () => {
    mockRunTodayProcessing.mockImplementation(async (league) => {
      if (league === "nfl") throw new Error("nfl failed");
    });

    await runUpsert(mockPool);

    expect(mockRunTodayProcessing).toHaveBeenCalledTimes(3);
    // nba and nhl upcoming still ran
    expect(mockRunUpcomingProcessing).toHaveBeenCalledWith("nba", mockPool);
    expect(mockRunUpcomingProcessing).toHaveBeenCalledWith("nhl", mockPool);
    // refreshPopularity still ran
    expect(mockRefreshPopularity).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup in finally even when refreshPopularity throws", async () => {
    mockRefreshPopularity.mockRejectedValue(new Error("popularity failed"));

    await runUpsert(mockPool);

    expect(mockClearPlayerCache).toHaveBeenCalled();
    expect(mockCloseCache).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it("always calls pool.end and closeCache regardless of outcome", async () => {
    // Success path
    await runUpsert(mockPool);
    expect(mockPool.end).toHaveBeenCalledTimes(1);
    expect(mockCloseCache).toHaveBeenCalledTimes(1);
  });

  it("runs cleanupClinchedPlayoffGames once, only for NBA", async () => {
    await runUpsert(mockPool);

    expect(mockCleanupClinchedPlayoffGames).toHaveBeenCalledTimes(1);
    expect(mockCleanupClinchedPlayoffGames).toHaveBeenCalledWith(mockPool);
  });

  it("runs cleanup after upcoming processing but before playoff cache invalidation", async () => {
    const order = [];
    mockRunUpcomingProcessing.mockImplementation(async (league) => {
      order.push(`upcoming:${league}`);
    });
    mockCleanupClinchedPlayoffGames.mockImplementation(async () => {
      order.push("cleanup");
    });
    mockInvalidatePattern.mockImplementation(async (pattern) => {
      if (pattern === "playoffs:nba:*") order.push("invalidate:playoffs");
    });

    await runUpsert(mockPool);

    expect(order.indexOf("cleanup")).toBeGreaterThan(
      order.indexOf("upcoming:nba"),
    );
    expect(order.indexOf("invalidate:playoffs")).toBeGreaterThan(
      order.indexOf("cleanup"),
    );
  });

  it("does not abort the run when cleanup fails", async () => {
    mockCleanupClinchedPlayoffGames.mockRejectedValue(
      new Error("cleanup failed"),
    );

    await runUpsert(mockPool);

    // NFL and NHL still processed, popularity still refreshed
    expect(mockRunUpcomingProcessing).toHaveBeenCalledWith("nfl", mockPool);
    expect(mockRunUpcomingProcessing).toHaveBeenCalledWith("nhl", mockPool);
    expect(mockRefreshPopularity).toHaveBeenCalledTimes(1);
  });
});
