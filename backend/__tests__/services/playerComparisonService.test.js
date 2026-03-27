import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/playerComparisonService.js");
const { getPlayerComparison } = await import(servicePath);

describe("playerComparisonService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns comparison data for two NBA players", async () => {
    const mockPlayers = [
      { id: 1, name: "LeBron James", ppg: "28.5", apg: "7.2", rpg: "8.1" },
      { id: 2, name: "Stephen Curry", ppg: "26.8", apg: "6.1", rpg: "4.5" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockPlayers });

    const result = await getPlayerComparison("nba", 1, 2, "2025-26");

    expect(result).toEqual({ league: "nba", season: "2025-26", players: mockPlayers });
  });

  it("returns error for invalid league", async () => {
    const result = await getPlayerComparison("mlb", 1, 2);

    expect(result).toEqual({ error: "Invalid league: mlb" });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("returns empty players array when no data found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getPlayerComparison("nba", 1, 2);

    expect(result.players).toEqual([]);
  });

  it("returns comparison for NFL players", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10, name: "Player A", ypg: "87.3" }] });

    const result = await getPlayerComparison("nfl", 10, 11, "2025");

    expect(result).toMatchObject({ league: "nfl", season: "2025" });
    expect(result.players).toHaveLength(1);
  });

  it("returns comparison for NHL players", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 20, name: "Player B", gpg: "0.45" }] });

    const result = await getPlayerComparison("nhl", 20, 21, "2025-26");

    expect(result).toMatchObject({ league: "nhl" });
  });

  it("passes both player IDs and season to the query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayerComparison("nba", 5, 6, "2024-25");

    const callArgs = mockPool.query.mock.calls[0][1];
    expect(callArgs).toContain("nba");
    expect(callArgs).toContain("2024-25");
    expect(callArgs).toContain(5);
    expect(callArgs).toContain(6);
  });
});
