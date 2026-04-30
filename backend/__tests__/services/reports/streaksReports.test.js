import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../../src/db/db.js"), () => ({
  default: { query: mockPoolQuery },
}));

const { getStreaksForLeague } = await import(
  resolve(__dirname, "../../../src/services/reports/streaksReports.js")
);

describe("getStreaksForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps rows into streak reports", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{
        player_id: 4234,
        player_name: "Nikola Jokić",
        player_image: "https://espn.com/x.png",
        stat_label: "double-double",
        streak_length: 5,
        last_game_date: new Date("2026-04-30T22:00:00Z"),
      }],
    });

    const out = await getStreaksForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "streak-4234-double-double",
      type: "streak",
      league: "nba",
      streakLength: 5,
      statLabel: "double-double",
      emoji: "🔥",
      player: { id: 4234, name: "Nikola Jokić", imageUrl: "https://espn.com/x.png", league: "nba" },
    });
  });

  it("uses NBA query for league=nba", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await getStreaksForLeague("nba");
    const [sql] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/double-double|points|rebounds/i);
  });

  it("uses NFL query for league=nfl", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await getStreaksForLeague("nfl");
    const [sql] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/yds|cmpatt/i);
  });

  it("uses NHL query for league=nhl", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await getStreaksForLeague("nhl");
    const [sql] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/goal|assist|s\.g\b/i);
  });

  it("returns [] on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("db"));
    const out = await getStreaksForLeague("nba");
    expect(out).toEqual([]);
  });
});
