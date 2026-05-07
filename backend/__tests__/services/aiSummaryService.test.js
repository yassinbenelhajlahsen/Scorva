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

const mockGetPlays = jest.fn();
const playsServicePath = resolve(__dirname, "../../src/services/games/playsService.js");
jest.unstable_mockModule(playsServicePath, () => ({
  getPlays: mockGetPlays,
}));

const servicePath = resolve(__dirname, "../../src/services/ai/aiSummaryService.js");
const {
  buildGameData,
  getTopPerformers,
  calculateTeamStats,
  buildPrompt,
  getClutchPlays,
  getPlayoffSeries,
} = await import(servicePath);

const dbModule = await import(dbPath);
const mockDbQuery = dbModule.default.query;

describe("aiSummaryService - pure functions", () => {
  describe("getTopPerformers", () => {
    it("should return top NBA scorers with both teams represented", () => {
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
      const teams = result.map((p) => p.team);
      expect(teams).toContain("LAL");
      expect(teams).toContain("BOS");
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

    it("should pass through gameType and gameLabel when present", () => {
      const playoffGame = {
        ...baseGame,
        game_type: "playoff",
        game_label: "West Semifinals - Game 1",
      };

      const result = buildGameData(playoffGame, []);

      expect(result.gameType).toBe("playoff");
      expect(result.gameLabel).toBe("West Semifinals - Game 1");
    });

    it("should include inGameInjuries when provided", () => {
      const injuries = [
        { name: "Jarred Vanderbilt", team: "Lakers", minutes: 6, status: "day-to-day", description: "dislocated pinky" },
      ];

      const result = buildGameData(baseGame, [], {}, { injuries });

      expect(result.inGameInjuries).toEqual(injuries);
    });

    it("should omit inGameInjuries when array is empty", () => {
      const result = buildGameData(baseGame, [], {}, { injuries: [] });

      expect(result).not.toHaveProperty("inGameInjuries");
    });

    it("should pass NHL injuries with toi field through to gameData", () => {
      const injuries = [
        { name: "Connor McDavid", team: "EDM", toi: "7:24", status: "day-to-day", description: "lower body" },
      ];

      const result = buildGameData(baseGame, [], {}, { injuries });

      expect(result.inGameInjuries).toEqual(injuries);
      expect(result.inGameInjuries[0]).not.toHaveProperty("minutes");
    });

    it("should drop streaks shorter than 5 games", () => {
      const result = buildGameData(baseGame, [], {}, {
        streaks: { home: { type: "win", length: 4 }, away: null },
      });
      expect(result).not.toHaveProperty("enteringStreaks");
    });

    it("should drop streaks for playoff games regardless of length", () => {
      const playoffGame = { ...baseGame, game_type: "playoff", game_label: "Round 1 - Game 1" };
      const result = buildGameData(playoffGame, [], {}, {
        streaks: { home: { type: "win", length: 8 }, away: { type: "win", length: 6 } },
      });
      expect(result).not.toHaveProperty("enteringStreaks");
    });

    it("should compute benchPointsSwing for NBA when both teams have bench data", () => {
      const stats = [
        // Lakers (home) — top 5 by minutes are starters
        { player_name: "S1", team_short: "LAL", points: 27, minutes: 36, fg: "10-20", threept: "3-6" },
        { player_name: "S2", team_short: "LAL", points: 18, minutes: 37, fg: "7-15", threept: "3-6" },
        { player_name: "S3", team_short: "LAL", points: 8, minutes: 36, fg: "4-12", threept: "0-5" },
        { player_name: "S4", team_short: "LAL", points: 12, minutes: 32, fg: "5-13", threept: "2-8" },
        { player_name: "S5", team_short: "LAL", points: 7, minutes: 29, fg: "3-7", threept: "1-3" },
        { player_name: "B1", team_short: "LAL", points: 10, minutes: 27, fg: "4-7", threept: "0-0" },
        { player_name: "B2", team_short: "LAL", points: 3, minutes: 16, fg: "1-3", threept: "0-0" },
        // Thunder (away) — bench scoring 34
        { player_name: "T1", team_short: "BOS", points: 24, minutes: 31, fg: "9-17", threept: "2-2" },
        { player_name: "T2", team_short: "BOS", points: 18, minutes: 35, fg: "8-15", threept: "0-1" },
        { player_name: "T3", team_short: "BOS", points: 6, minutes: 28, fg: "2-7", threept: "2-5" },
        { player_name: "T4", team_short: "BOS", points: 18, minutes: 28, fg: "7-15", threept: "1-5" },
        { player_name: "T5", team_short: "BOS", points: 8, minutes: 25, fg: "4-7", threept: "0-0" },
        { player_name: "TB1", team_short: "BOS", points: 12, minutes: 15, fg: "4-7", threept: "4-5" },
        { player_name: "TB2", team_short: "BOS", points: 18, minutes: 28, fg: "7-15", threept: "1-5" },
      ];

      const result = buildGameData(baseGame, stats);

      expect(result.benchPointsSwing).toBeDefined();
      expect(result.benchPointsSwing.diff).toBeGreaterThan(0);
      expect(["Los Angeles Lakers", "Boston Celtics"]).toContain(
        result.benchPointsSwing.team
      );
    });

    it("should pass enteringStreaks through to gameData", () => {
      const streaks = {
        home: { type: "win", length: 6 },
        away: { type: "loss", length: 5 },
      };

      const result = buildGameData(baseGame, [], {}, { streaks });

      expect(result.enteringStreaks).toEqual({
        home: { team: "Los Angeles Lakers", type: "win", length: 6 },
        away: { team: "Boston Celtics", type: "loss", length: 5 },
      });
    });

    it("should omit enteringStreaks when both sides are null", () => {
      const result = buildGameData(baseGame, [], {}, {
        streaks: { home: null, away: null },
      });

      expect(result).not.toHaveProperty("enteringStreaks");
    });

    it("should pass seriesState through to gameData when provided", () => {
      const series = {
        round: "East Semifinals",
        gameNumber: 2,
        beforeThisGame: "Los Angeles Lakers lead 1-0",
        afterThisGame: "Los Angeles Lakers lead 2-0",
      };
      const result = buildGameData(baseGame, [], {}, { series });
      expect(result.seriesState).toEqual(series);
    });

    it("should omit seriesState when not provided", () => {
      const result = buildGameData(baseGame, [], {}, {});
      expect(result).not.toHaveProperty("seriesState");
    });
  });

  describe("getTopPerformers - team representation", () => {
    it("guarantees both teams' top scorer when one team dominates the leaderboard", () => {
      // OKC dominates top of board, Lakers' top scorer (LeBron) is 4th by points
      const stats = [
        { player_name: "Holmgren", team_short: "OKC", points: 24, rebounds: 12, assists: 1 },
        { player_name: "SGA", team_short: "OKC", points: 22, rebounds: 3, assists: 6 },
        { player_name: "Mitchell", team_short: "OKC", points: 21, rebounds: 2, assists: 4 },
        { player_name: "LeBron", team_short: "LAL", points: 20, rebounds: 4, assists: 6 },
        { player_name: "Hachimura", team_short: "LAL", points: 18, rebounds: 2, assists: 2 },
      ];

      const result = getTopPerformers(stats, "NBA");

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.team)).toContain("LAL");
      expect(result.map((p) => p.name)).toContain("LeBron");
    });
  });

  describe("calculateTeamStats NBA additions", () => {
    it("computes 3PT and bench points alongside FG%", () => {
      const teamStats = [
        // 5 starters by minutes
        { player_name: "S1", points: 24, rebounds: 12, assists: 1, fg: "9-17", threept: "2-2", minutes: 31 },
        { player_name: "S2", points: 18, rebounds: 3, assists: 6, fg: "8-15", threept: "0-1", minutes: 35 },
        { player_name: "S3", points: 6, rebounds: 3, assists: 4, fg: "2-7", threept: "2-5", minutes: 28 },
        { player_name: "S4", points: 8, rebounds: 9, assists: 4, fg: "4-7", threept: "0-0", minutes: 25 },
        { player_name: "S5", points: 18, rebounds: 2, assists: 4, fg: "7-15", threept: "1-5", minutes: 28 },
        // bench
        { player_name: "B1", points: 12, rebounds: 2, assists: 2, fg: "4-7", threept: "4-5", minutes: 15 },
        { player_name: "B2", points: 9, rebounds: 1, assists: 1, fg: "3-7", threept: "1-3", minutes: 11 },
        { player_name: "B3", points: 5, rebounds: 2, assists: 2, fg: "2-7", threept: "1-4", minutes: 20 },
      ];

      const result = calculateTeamStats(teamStats, "NBA");

      expect(result.points).toBe(100);
      expect(result.threePoint).toBe("11-25");
      expect(result.threePtPct).toBe("44.0%");
      expect(result.benchPoints).toBe(26); // B1 + B2 + B3 = 12 + 9 + 5
    });

    it("handles missing threept gracefully", () => {
      const teamStats = [
        { points: 10, fg: "4-8", threept: null, minutes: 20 },
      ];

      const result = calculateTeamStats(teamStats, "NBA");

      expect(result.threePoint).toBe("0-0");
      expect(result.threePtPct).toBe("0%");
    });
  });

  describe("getClutchPlays", () => {
    beforeEach(() => {
      mockGetPlays.mockReset();
    });

    // Helper: build NBA Q4 scoring play in last 5 min
    const q4Play = (clock, home, away, scoring = true, sequence = 0) => ({
      period: 4,
      clock,
      home_score: home,
      away_score: away,
      scoring_play: scoring,
      description: `${home}-${away} at ${clock}`,
      sequence,
    });

    it("returns null gameWinningPlay when game was never within one possession in clutch (NBA garbage time)", async () => {
      // Replicates game 522487: OKC up 14-21 throughout last 5 min, ends 108-90
      mockGetPlays.mockResolvedValue({
        plays: [
          q4Play("5:48", 98, 82, true, 1),
          q4Play("5:16", 101, 82, true, 2),
          q4Play("4:24", 101, 84, true, 3),
          q4Play("2:39", 101, 87, true, 4),
          q4Play("2:12", 103, 87, true, 5),
          q4Play("1:45", 105, 87, true, 6),
          q4Play("41.0", 108, 87, true, 7),
          q4Play("20.5", 108, 90, true, 8),
        ],
      });

      const result = await getClutchPlays(522487, "nba");

      expect(result.plays).toEqual([]);
      expect(result.gameWinningPlay).toBeNull();
    });

    it("returns gameWinningPlay when clutch window had a one-possession margin (NBA)", async () => {
      // 5-pt final, lead was 3 with 1:00 left
      mockGetPlays.mockResolvedValue({
        plays: [
          q4Play("4:30", 95, 92, true, 1),
          q4Play("3:00", 97, 95, true, 2),
          q4Play("1:00", 100, 97, true, 3),
          q4Play("0:20", 102, 97, true, 4),
        ],
      });

      const result = await getClutchPlays(1, "nba");

      expect(result.plays.length).toBeGreaterThan(0);
      expect(result.gameWinningPlay).not.toBeNull();
      expect(result.gameWinningPlay.description).toContain("102-97");
    });

    it("returns gameWinningPlay when game ends in OT (always considered competitive via OT plays)", async () => {
      mockGetPlays.mockResolvedValue({
        plays: [
          q4Play("0:01", 100, 100, true, 1),
          { period: 5, clock: "2:00", home_score: 102, away_score: 100, scoring_play: true, description: "OT bucket", sequence: 2 },
          { period: 5, clock: "0:30", home_score: 105, away_score: 102, scoring_play: true, description: "OT dagger", sequence: 3 },
        ],
      });

      const result = await getClutchPlays(2, "nba");

      expect(result.plays.length).toBeGreaterThan(0);
      expect(result.gameWinningPlay).not.toBeNull();
    });

    it("uses NHL one-goal threshold", async () => {
      // NHL: 3-1 final, lead was always 2+ in clutch
      mockGetPlays.mockResolvedValue({
        plays: [
          { period: 3, clock: "4:00", home_score: 2, away_score: 0, scoring_play: true, description: "early P3", sequence: 1 },
          { period: 3, clock: "2:00", home_score: 3, away_score: 0, scoring_play: true, description: "extending", sequence: 2 },
          { period: 3, clock: "0:30", home_score: 3, away_score: 1, scoring_play: true, description: "consolation", sequence: 3 },
        ],
      });

      const result = await getClutchPlays(3, "nhl");

      expect(result.gameWinningPlay).toBeNull();
      expect(result.plays).toEqual([]);
    });

    it("returns empty when no plays available", async () => {
      mockGetPlays.mockResolvedValue({ plays: [] });

      const result = await getClutchPlays(4, "nba");

      expect(result).toEqual({ plays: [], gameWinningPlay: null });
    });
  });

  describe("getPlayoffSeries", () => {
    beforeEach(() => {
      mockDbQuery.mockReset();
    });

    const playoffGame = {
      id: 520690,
      league: "nba",
      season: "2025-26",
      date: "2026-05-06T04:00:00.000Z",
      hometeamid: 526,
      awayteamid: 535,
      homescore: 108,
      awayscore: 102,
      home_team_name: "New York Knicks",
      away_team_name: "Philadelphia 76ers",
      game_type: "playoff",
      game_label: "East Semifinals - Game 2",
    };

    it("returns null for non-playoff games", async () => {
      const r = await getPlayoffSeries({ ...playoffGame, game_type: "regular" });
      expect(r).toBeNull();
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it("returns null for NFL playoff games (single elimination)", async () => {
      const r = await getPlayoffSeries({ ...playoffGame, league: "nfl", game_label: "Wild Card Round" });
      expect(r).toBeNull();
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it("returns null when game_label has no Game N marker (e.g. Play-In)", async () => {
      const r = await getPlayoffSeries({ ...playoffGame, game_label: "Play-In Round 1" });
      expect(r).toBeNull();
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it("computes 2-0 series lead from prior Game 1 win + this Game 2 win", async () => {
      // Prior Game 1: Knicks (home, id 526) won
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ winnerid: 526, hometeamid: 526, awayteamid: 535 }],
      });

      const r = await getPlayoffSeries(playoffGame);

      expect(r).toEqual({
        round: "East Semifinals",
        gameNumber: 2,
        beforeThisGame: "New York Knicks lead 1-0",
        afterThisGame: "New York Knicks lead 2-0",
      });
    });

    it("formats Game 1 with no prior games as 'Series begins'", async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const r = await getPlayoffSeries({
        ...playoffGame,
        game_label: "East Semifinals - Game 1",
      });

      expect(r.beforeThisGame).toBe("Series begins (Game 1)");
      expect(r.afterThisGame).toBe("New York Knicks lead 1-0");
    });

    it("formats tied series", async () => {
      // Each team has one prior win
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          { winnerid: 526, hometeamid: 526, awayteamid: 535 },
          { winnerid: 535, hometeamid: 535, awayteamid: 526 },
        ],
      });

      const r = await getPlayoffSeries({
        ...playoffGame,
        game_label: "East Semifinals - Game 3",
        // 76ers (away in this game) win
        homescore: 100,
        awayscore: 110,
      });

      expect(r.beforeThisGame).toBe("Series tied 1-1");
      expect(r.afterThisGame).toBe("Philadelphia 76ers lead 2-1");
    });

    it("returns null and logs on db error", async () => {
      mockDbQuery.mockRejectedValueOnce(new Error("boom"));
      const r = await getPlayoffSeries(playoffGame);
      expect(r).toBeNull();
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

    it("should NOT contain the dropped 'credit primary scorer' rule", () => {
      const prompt = buildPrompt(baseGameData, "NBA");
      expect(prompt).not.toMatch(/Credit the winning team's primary scorer/i);
    });

    it("should include anti-template guidance", () => {
      const prompt = buildPrompt(baseGameData, "NBA");
      expect(prompt).toMatch(/Vary the structure/i);
      expect(prompt).toMatch(/don't follow a fixed template/i);
    });

    it("should include seriesState strings as the source of truth when present", () => {
      const data = {
        ...baseGameData,
        gameType: "playoff",
        gameLabel: "East Semifinals - Game 2",
        seriesState: {
          round: "East Semifinals",
          gameNumber: 2,
          beforeThisGame: "Knicks lead 1-0",
          afterThisGame: "Knicks lead 2-0",
        },
      };
      const prompt = buildPrompt(data, "NBA");
      expect(prompt).toContain("Knicks lead 2-0");
      expect(prompt).toContain("Knicks lead 1-0");
      expect(prompt).toMatch(/source of truth/i);
      expect(prompt).toMatch(/never invent/i);
    });

    it("should soften winning-play rule (no MUST describe directive)", () => {
      const data = {
        ...baseGameData,
        gameWinningPlay: { description: "buzzer beater", clock: "0:00" },
      };
      const prompt = buildPrompt(data, "NBA");
      expect(prompt).not.toMatch(/One bullet MUST describe the gameWinningPlay/i);
      expect(prompt).toMatch(/Reference it by player name in one bullet/i);
    });
  });
});
