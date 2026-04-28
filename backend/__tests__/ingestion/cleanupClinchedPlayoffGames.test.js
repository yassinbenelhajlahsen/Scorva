import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { cleanupClinchedPlayoffGames } = await import(
  resolve(
    __dirname,
    "../../src/ingestion/cleanup/cleanupClinchedPlayoffGames.js",
  )
);

describe("cleanupClinchedPlayoffGames", () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    jest.clearAllMocks();
  });

  it("executes a single DELETE query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("DELETE FROM games");
  });

  it("scopes the delete to the given league via $1 param", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    const [sql, params] = mockPool.query.mock.calls[0];
    // Uses parameterized $1 — no hardcoded league literal in SQL
    expect(sql).toContain("league = $1");
    expect(sql).not.toMatch(/league\s*=\s*'nba'/);
    expect(params).toEqual(["nba"]);
  });

  it("works for NHL with league param 'nhl'", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nhl");

    const [, params] = mockPool.query.mock.calls[0];
    expect(params).toEqual(["nhl"]);
  });

  it("only considers playoff/final game types when counting series wins", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/type IN \('playoff', 'final'\)/);
  });

  it("clinch threshold is >= 4 wins (best-of-7 series)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/wins_a >= 4 OR wins_b >= 4/);
  });

  it("only deletes unplayed games (Scheduled, no winner, no scores)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("g.status = 'Scheduled'");
    expect(sql).toContain("g.winnerid IS NULL");
    // ESPN scheduled games are stored as 0/0 (parseInt("0") === 0), not NULL.
    // Match either to cover both encodings.
    expect(sql).toContain("COALESCE(g.homescore, 0) = 0");
    expect(sql).toContain("COALESCE(g.awayscore, 0) = 0");
  });

  it("joins clinched series to candidate games on unordered team pair", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(mockPool, "nba");

    const [sql] = mockPool.query.mock.calls[0];
    // unordered pair key: LEAST/GREATEST on both sides of the join
    expect(sql).toMatch(
      /LEAST\(g\.hometeamid, g\.awayteamid\)\s*=\s*c\.team_a/,
    );
    expect(sql).toMatch(
      /GREATEST\(g\.hometeamid, g\.awayteamid\)\s*=\s*c\.team_b/,
    );
    // series scope also by season to avoid cross-season collisions
    expect(sql).toContain("g.season = c.season");
  });

  it("returns the rows reported deleted by the DB", async () => {
    const deleted = [
      { id: 101, league: "nba", season: "2024-25" },
      { id: 102, league: "nba", season: "2024-25" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: deleted });

    const result = await cleanupClinchedPlayoffGames(mockPool, "nba");

    expect(result).toEqual(deleted);
  });

  it("returns an empty array when nothing was deleted", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await cleanupClinchedPlayoffGames(mockPool, "nba");

    expect(result).toEqual([]);
  });

  it("propagates DB errors to the caller", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("db down"));

    await expect(cleanupClinchedPlayoffGames(mockPool, "nba")).rejects.toThrow(
      "db down",
    );
  });

  it("uses the pool passed as parameter", async () => {
    const anotherPool = createMockPool();
    anotherPool.query.mockResolvedValueOnce({ rows: [] });

    await cleanupClinchedPlayoffGames(anotherPool, "nba");

    expect(anotherPool.query).toHaveBeenCalledTimes(1);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
