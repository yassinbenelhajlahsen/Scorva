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
  resolve(__dirname, "../../../src/services/reports/streaksReports.js"),
);

describe("getStreaksForLeague", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries streak_events with a 30-day cutoff for the given league", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await getStreaksForLeague("nba");

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toMatch(/FROM streak_events/i);
    expect(sql).toMatch(/last_game_date\s*>\s*CURRENT_DATE\s*-\s*INTERVAL\s*'30 days'/i);
    expect(sql).toMatch(/ORDER BY.*last_game_date DESC/i);
    expect(params).toEqual(["nba"]);
  });

  it("maps player rows into player streak reports", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "player",
          subject_id: 4234,
          stat_label: "double-double",
          length: 5,
          last_game_date: new Date("2026-04-29"),
          start_game_date: new Date("2026-04-20"),
          player_name: "Nikola Jokić",
          player_image: "https://espn.com/x.png",
          team_name: null, team_location: null, team_shortname: null,
          team_logo: null, team_abbr: null,
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "streak",
      league: "nba",
      streakLength: 5,
      statLabel: "double-double",
      emoji: "🔥",
      player: { id: 4234, name: "Nikola Jokić", imageUrl: "https://espn.com/x.png", league: "nba" },
    });
    expect(out[0].id).toMatch(/^streak-player-4234-double-double/);
    expect(out[0].team).toBeUndefined();
  });

  it("maps team win rows into team streak reports", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "team",
          subject_id: 13,
          stat_label: "win",
          length: 5,
          last_game_date: new Date("2026-04-29"),
          start_game_date: new Date("2026-04-20"),
          player_name: null, player_image: null,
          team_name: "Nuggets", team_location: "Denver",
          team_shortname: "DEN", team_logo: "https://espn.com/den.png", team_abbr: "DEN",
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "streak",
      league: "nba",
      streakLength: 5,
      statLabel: "win",
      emoji: "🔥",
      team: {
        id: 13, name: "Nuggets", location: "Denver",
        shortname: "DEN", abbreviation: "DEN", logoUrl: "https://espn.com/den.png", league: "nba",
      },
    });
    expect(out[0].player).toBeUndefined();
  });

  it("uses snowflake emoji for loss rows", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          subject_type: "team", subject_id: 7, stat_label: "loss", length: 4,
          last_game_date: new Date("2026-04-29"), start_game_date: new Date("2026-04-22"),
          player_name: null, player_image: null,
          team_name: "Wizards", team_location: "Washington", team_shortname: "WAS",
          team_logo: null, team_abbr: "WAS",
        },
      ],
    });

    const out = await getStreaksForLeague("nba");

    expect(out[0].emoji).toBe("❄️");
  });

  it("returns [] on DB error", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error("db"));
    const out = await getStreaksForLeague("nba");
    expect(out).toEqual([]);
  });
});
