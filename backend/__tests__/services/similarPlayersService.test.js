import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPoolQuery = jest.fn();
const mockConnect = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery, connect: mockConnect },
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: jest.fn(async (_key, _ttl, fn) => fn()),
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

const { getSimilarPlayers } = await import(
  resolve(__dirname, "../../src/services/players/similarPlayersService.js")
);

describe("getSimilarPlayers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockReset();
  });

  it("queries neighbours through the pool without toggling planner settings", async () => {
    // The HNSW index was dropped (migration 20260908000000); the old
    // BEGIN / SET LOCAL enable_indexscan = off / COMMIT dance is dead weight.
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ embedding: "[0.1,0.2]", position: "QB" }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: "Other QB", similarity: "0.9" }] });

    const rows = await getSimilarPlayers(1, "nfl", "2025-26", 1);

    expect(rows).toEqual([{ id: 2, name: "Other QB", similarity: "0.9" }]);
    expect(mockConnect).not.toHaveBeenCalled();
    for (const [sql] of mockPoolQuery.mock.calls) {
      expect(sql).not.toMatch(/enable_indexscan|BEGIN|COMMIT/);
    }
  });

  it("tops up from the full league pool when the position group under-fills", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ embedding: "[0.1,0.2]", position: "QB" }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: "Other QB" }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, name: "A RB" }] });

    const rows = await getSimilarPlayers(1, "nfl", "2025-26", 2);

    expect(rows.map((r) => r.id)).toEqual([2, 3]);
    const [, topUpParams] = mockPoolQuery.mock.calls[2];
    expect(topUpParams[4]).toBe(1); // limit - already returned
  });

  it("returns [] when the target player has no embedding", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    expect(await getSimilarPlayers(1, "nba", "2025-26")).toEqual([]);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });
});
