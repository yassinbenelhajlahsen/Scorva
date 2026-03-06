/**
 * Unit tests for aiSummaryService pure functions
 */

import { describe, it, expect, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock db and openai so the module loads without real connections
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: { query: jest.fn() },
}));

jest.unstable_mockModule("openai", () => ({
  default: jest.fn(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

const servicePath = resolve(__dirname, "../../src/services/aiSummaryService.js");
const {
  buildGameData,
  getTopPerformers,
  calculateTeamStats,
  buildPrompt,
} = await import(servicePath);

describe("aiSummaryService - pure functions", () => {
  describe("getTopPerformers", () => {
    it("should return top 3 NBA scorers", () => {
      const stats = [
        { player_name: "Player A", team_short: "LAL", points: 35, rebounds: 10, assists: 5 },
        { player_name: "Player B", team_short: "LAL", points: 28, rebounds: 8, assists: 3 },
        { player_name: "Player C", team_short: "BOS", points: 22, rebounds: 5, assists: 7 },
        { player_name: "Player D", team_short: "BOS", points: 18, rebounds: 4, assists: 2 },
      ];

      const result = getTopPerformers(stats, "NBA");

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Player A");
      expect(result[0].stats).toContain("35 PTS");
      expect(result[2].name).toBe("Player C");
    });

    it("should filter out zero-point NBA players", () => {
      const stats = [
        { player_name: "Scorer", team_short: "LAL", points: 20, rebounds: 5, assists: 3 },
        { player_name: "Benchwarmer", team_short: "LAL", points: 0, rebounds: 1, assists: 0 },
      ];

      const result = getTopPerformers(stats, "NBA");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Scorer");
    });

    it("should return top NFL performers sorted by yards + TD composite", () => {
      const stats = [
        { player_name: "QB", team_short: "KC", yds: 300, td: 3 },
        { player_name: "RB", team_short: "KC", yds: 120, td: 1 },
        { player_name: "WR", team_short: "BUF", yds: 150, td: 2 },
      ];

      const result = getTopPerformers(stats, "NFL");

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("QB");
      expect(result[0].stats).toContain("300 YDS");
      expect(result[0].stats).toContain("3 TD");
    });

    it("should filter out NFL players with no yards and no TDs", () => {
      const stats = [
        { player_name: "Active", team_short: "KC", yds: 50, td: 0 },
        { player_name: "Inactive", team_short: "KC", yds: 0, td: 0 },
      ];

      const result = getTopPerformers(stats, "NFL");

      expect(result).toHaveLength(1);
    });

    it("should return top NHL point getters", () => {
      const stats = [
        { player_name: "Center", team_short: "TOR", g: 2, a: 1 },
        { player_name: "Wing", team_short: "TOR", g: 1, a: 2 },
        { player_name: "Defenseman", team_short: "MTL", g: 0, a: 1 },
      ];

      const result = getTopPerformers(stats, "NHL");

      expect(result).toHaveLength(3);
      expect(result[0].stats).toContain("2 G");
      expect(result[0].stats).toContain("1 A");
    });

    it("should filter out NHL players with no goals and no assists", () => {
      const stats = [
        { player_name: "Scorer", team_short: "TOR", g: 1, a: 0 },
        { player_name: "Goalie", team_short: "TOR", g: 0, a: 0 },
      ];

      const result = getTopPerformers(stats, "NHL");

      expect(result).toHaveLength(1);
    });

    it("should return empty array for unknown league", () => {
      const result = getTopPerformers([], "MLB");

      expect(result).toEqual([]);
    });
  });

  describe("calculateTeamStats", () => {
    it("should calculate NBA team stats with FG percentage", () => {
      const stats = [
        { points: 25, rebounds: 8, assists: 5, fg: "10-20" },
        { points: 15, rebounds: 4, assists: 3, fg: "5-10" },
      ];

      const result = calculateTeamStats(stats, "NBA");

      expect(result.points).toBe(40);
      expect(result.rebounds).toBe(12);
      expect(result.assists).toBe(8);
      expect(result.fgPct).toBe("50.0%");
    });

    it("should handle NBA FG with zero attempts", () => {
      const stats = [
        { points: 0, rebounds: 0, assists: 0, fg: "0-0" },
      ];

      const result = calculateTeamStats(stats, "NBA");

      expect(result.fgPct).toBe("0%");
    });

    it("should handle NBA stats with null fg field", () => {
      const stats = [
        { points: 10, rebounds: 3, assists: 2, fg: null },
      ];

      const result = calculateTeamStats(stats, "NBA");

      expect(result.points).toBe(10);
      expect(result.fgPct).toBe("0%");
    });

    it("should calculate NFL team stats", () => {
      const stats = [
        { yds: 200, td: 2 },
        { yds: 100, td: 1 },
      ];

      const result = calculateTeamStats(stats, "NFL");

      expect(result.totalYards).toBe(300);
      expect(result.touchdowns).toBe(3);
    });

    it("should calculate NHL team stats", () => {
      const stats = [
        { g: 2, a: 1, shots: 10 },
        { g: 1, a: 2, shots: 8 },
      ];

      const result = calculateTeamStats(stats, "NHL");

      expect(result.goals).toBe(3);
      expect(result.assists).toBe(3);
      expect(result.shots).toBe(18);
    });

    it("should return empty object for empty stats", () => {
      expect(calculateTeamStats([], "NBA")).toEqual({});
    });

    it("should return empty object for unknown league", () => {
      const result = calculateTeamStats([{ points: 10 }], "MLB");

      expect(result).toEqual({});
    });
  });

  describe("buildGameData", () => {
    const baseGame = {
      league: "nba",
      date: "2025-01-15",
      homescore: 110,
      awayscore: 105,
      home_team_name: "Los Angeles Lakers",
      away_team_name: "Boston Celtics",
      home_team_short: "LAL",
      away_team_short: "BOS",
      firstqtr: "28-25",
      secondqtr: "27-30",
      thirdqtr: "30-25",
      fourthqtr: "25-25",
      ot1: null,
      ot2: null,
      ot3: null,
      ot4: null,
    };

    it("should build standard game data", () => {
      const result = buildGameData(baseGame, []);

      expect(result.league).toBe("NBA");
      expect(result.homeTeam).toBe("Los Angeles Lakers");
      expect(result.awayTeam).toBe("Boston Celtics");
      expect(result.homeScore).toBe(110);
      expect(result.awayScore).toBe(105);
      expect(result.winner).toBe("Los Angeles Lakers");
      expect(result.margin).toBe(5);
      expect(result.storyType).toBe("nail-biter");
      expect(result.hadOT).toBe(false);
    });

    it("should detect overtime games", () => {
      const otGame = { ...baseGame, ot1: "5-3" };

      const result = buildGameData(otGame, []);

      expect(result.hadOT).toBe(true);
      expect(result.storyType).toBe("overtime");
      expect(result.quarterByQuarter.periods).toContain("OT1");
    });

    it("should detect blowout games", () => {
      const blowout = { ...baseGame, homescore: 130, awayscore: 100 };

      const result = buildGameData(blowout, []);

      expect(result.storyType).toBe("blowout");
      expect(result.margin).toBe(30);
    });

    it("should detect standard games", () => {
      const standard = { ...baseGame, homescore: 110, awayscore: 100 };

      const result = buildGameData(standard, []);

      expect(result.storyType).toBe("standard");
    });

    it("should use NFL thresholds", () => {
      const nflGame = {
        ...baseGame,
        league: "nfl",
        homescore: 35,
        awayscore: 14,
      };

      const result = buildGameData(nflGame, []);

      expect(result.storyType).toBe("blowout");
    });

    it("should use NHL thresholds", () => {
      const nhlGame = {
        ...baseGame,
        league: "nhl",
        homescore: 3,
        awayscore: 2,
      };

      const result = buildGameData(nhlGame, []);

      expect(result.storyType).toBe("nail-biter");
    });

    it("should parse quarter-by-quarter scores", () => {
      const result = buildGameData(baseGame, []);

      expect(result.quarterByQuarter.periods).toEqual(["Q1", "Q2", "Q3", "Q4"]);
      expect(result.quarterByQuarter.home).toEqual([28, 27, 30, 25]);
      expect(result.quarterByQuarter.away).toEqual([25, 30, 25, 25]);
    });

    it("should skip null quarter scores", () => {
      const partialGame = { ...baseGame, thirdqtr: null, fourthqtr: null };

      const result = buildGameData(partialGame, []);

      expect(result.quarterByQuarter.periods).toEqual(["Q1", "Q2"]);
    });

    it("should identify away team as winner when away score is higher", () => {
      const awayWin = { ...baseGame, homescore: 90, awayscore: 105 };

      const result = buildGameData(awayWin, []);

      expect(result.winner).toBe("Boston Celtics");
    });
  });

  describe("buildPrompt", () => {
    const baseGameData = {
      league: "NBA",
      margin: 5,
      winner: "Lakers",
      storyType: "nail-biter",
      homeTeam: "Lakers",
      awayTeam: "Celtics",
      homeScore: 110,
      awayScore: 105,
    };

    it("should include league name", () => {
      const prompt = buildPrompt(baseGameData, "NBA");

      expect(prompt).toContain("NBA");
    });

    it("should use nail-biter narrative frame", () => {
      const prompt = buildPrompt(baseGameData, "NBA");

      expect(prompt).toContain("nail-biter");
      expect(prompt).toContain("5 point(s)");
    });

    it("should use overtime narrative frame", () => {
      const otData = { ...baseGameData, storyType: "overtime" };

      const prompt = buildPrompt(otData, "NBA");

      expect(prompt).toContain("overtime");
      expect(prompt).toContain("Lakers");
    });

    it("should use blowout narrative frame", () => {
      const blowout = { ...baseGameData, storyType: "blowout", margin: 25 };

      const prompt = buildPrompt(blowout, "NBA");

      expect(prompt).toContain("blowout");
      expect(prompt).toContain("25");
    });

    it("should use standard narrative frame for unknown storyType", () => {
      const unknown = { ...baseGameData, storyType: "unknown" };

      const prompt = buildPrompt(unknown, "NBA");

      expect(prompt).toContain("key advantages");
    });

    it("should include game data as JSON", () => {
      const prompt = buildPrompt(baseGameData, "NBA");

      expect(prompt).toContain("Game data:");
      expect(prompt).toContain('"league": "NBA"');
    });

    it("should include formatting rules", () => {
      const prompt = buildPrompt(baseGameData, "NBA");

      expect(prompt).toContain("3 bullet points");
      expect(prompt).toContain("dash (-)");
    });
  });
});
