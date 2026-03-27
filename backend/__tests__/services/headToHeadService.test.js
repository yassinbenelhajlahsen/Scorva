import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/headToHeadService.js");
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
});
