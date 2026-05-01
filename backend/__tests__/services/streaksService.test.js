import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { getActiveStreak } = await import(
  resolve(__dirname, "../../src/services/streaks/streaksService.js"),
);

describe("getActiveStreak", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when no rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const out = await getActiveStreak("nba", "player", 42);
    expect(out).toBeNull();
  });

  it("returns the top streak with subjectType included", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ stat_label: "triple-double", length: 5 }],
    });
    const out = await getActiveStreak("nba", "player", 42);
    expect(out).toEqual({ length: 5, statLabel: "triple-double", subjectType: "player" });
  });

  it("orders player query with tier CASE ASC then length DESC", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "player", 42);
    const sql = mockPool.query.mock.calls[0][0];
    // tier ASC ensures rarest tier (THEN 0) sorts first
    expect(sql).toMatch(/ORDER BY\s+CASE stat_label[^)]*ASC,\s*length DESC\s+LIMIT/i);
    // includes the load-bearing tier-zero label so a reordering of PLAYER_TIER would surface
    expect(sql).toMatch(/'triple-double' THEN 0/);
    expect(sql).toMatch(/subject_type = \$2/);
  });

  it("orders team query by length DESC only (no tier CASE)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "team", 7);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY length DESC/i);
    expect(sql).not.toMatch(/CASE stat_label/i);
  });

  it("filters on is_active = TRUE", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nba", "player", 42);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toMatch(/is_active\s*=\s*TRUE/i);
  });

  it("passes correct params [league, subjectType, subjectId]", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await getActiveStreak("nhl", "team", 12);
    expect(mockPool.query.mock.calls[0][1]).toEqual(["nhl", "team", 12]);
  });

  it("throws on invalid subjectType", async () => {
    await expect(getActiveStreak("nba", "coach", 1)).rejects.toThrow(/Invalid subjectType/);
  });
});
