import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/chat/tools/headToHead.js");
const { getHeadToHead } = await import(servicePath);

describe("headToHeadService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns game rows from query", async () => {
    const mockGames = [
      { id: 1, date: "2025-01-10", home_team_name: "Lakers", away_team_name: "Celtics" },
      { id: 2, date: "2024-12-05", home_team_name: "Celtics", away_team_name: "Lakers" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockGames });

    const result = await getHeadToHead("nba", 1, 2);

    expect(result).toEqual(mockGames);
  });

  it("passes league, teamId1, teamId2, and limit to query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getHeadToHead("nba", 1, 2, 5);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", 1, 2, 5]
    );
  });

  it("uses default limit of 10 when not provided", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getHeadToHead("nba", 1, 2);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", 1, 2, 10]
    );
  });

  it("returns empty array when no matchups found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getHeadToHead("nfl", 5, 6, 10);

    expect(result).toEqual([]);
  });

  it("propagates DB errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB error"));

    await expect(getHeadToHead("nba", 1, 2)).rejects.toThrow("DB error");
  });

  it("SQL filters Final status only", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getHeadToHead("nba", 1, 2);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("Final");
  });

  it("SQL matches both home/away combinations", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getHeadToHead("nba", 1, 2);

    const [sql] = mockPool.query.mock.calls[0];
    // Query should handle team1@home vs team2@away AND team2@home vs team1@away
    expect(sql).toContain("hometeamid = $2");
    expect(sql).toContain("hometeamid = $3");
  });

  it("works for all supported leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      await getHeadToHead(league, 1, 2);
      expect(mockPool.query).toHaveBeenLastCalledWith(expect.any(String), [league, 1, 2, 10]);
    }
  });
});
