import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/ai/chat/tools/teamStats.js");
const { getTeamStats } = await import(servicePath);

describe("teamStatsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns NBA team stats row", async () => {
    const mockRow = {
      id: 1,
      name: "Los Angeles Lakers",
      wins: "30",
      losses: "15",
      avg_points_per_player: "11.2",
    };
    mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await getTeamStats("nba", 1, "2025-26");

    expect(result).toEqual(mockRow);
  });

  it("returns error for invalid league", async () => {
    const result = await getTeamStats("mlb", 1);

    expect(result).toEqual({ error: "Invalid league: mlb" });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("returns error when no data found for team", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getTeamStats("nba", 999);

    expect(result).toEqual({ error: "No data found for this team" });
  });

  it("returns NFL team stats", async () => {
    const mockRow = { id: 5, name: "Chiefs", total_td: "45", avg_yards_per_player: "62.1" };
    mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await getTeamStats("nfl", 5, "2025");

    expect(result).toEqual(mockRow);
  });

  it("returns NHL team stats", async () => {
    const mockRow = { id: 10, name: "Oilers", avg_goals_per_player: "0.38" };
    mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await getTeamStats("nhl", 10, "2025-26");

    expect(result).toEqual(mockRow);
  });

  it("passes league, season, and teamId to query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await getTeamStats("nba", 7, "2024-25");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", "2024-25", 7]
    );
  });
});
