import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

// cache is no-op without Redis in tests — cached() just calls the queryFn
const { getCurrentSeason } = await import(
  resolve(__dirname, "../../src/cache/seasons.js")
);

describe("getCurrentSeason", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the max season for the league", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });

    const result = await getCurrentSeason("nba");

    expect(result).toBe("2025-26");
  });

  it("returns null when no seasons exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ season: null }] });

    const result = await getCurrentSeason("nba");

    expect(result).toBeNull();
  });

  it("returns null when rows is empty", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getCurrentSeason("nfl");

    expect(result).toBeNull();
  });

  it("passes league to query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });

    await getCurrentSeason("nhl");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("MAX(season)"),
      ["nhl"]
    );
  });

  it("SQL filters season IS NOT NULL", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });

    await getCurrentSeason("nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("season IS NOT NULL");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [{ season: "2025-26" }] });
      const result = await getCurrentSeason(league);
      expect(result).toBe("2025-26");
    }
  });
});
