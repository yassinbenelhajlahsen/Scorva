import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock all service dependencies before importing chatToolsService
const mockSearch = jest.fn();
const mockGetGames = jest.fn();
const mockGetNbaGame = jest.fn();
const mockGetNflGame = jest.fn();
const mockGetNhlGame = jest.fn();
const mockGetNbaPlayer = jest.fn();
const mockGetNflPlayer = jest.fn();
const mockGetNhlPlayer = jest.fn();
const mockGetStandings = jest.fn();
const mockGetTeamsByLeague = jest.fn();
const mockGetSeasons = jest.fn();
const mockGetHeadToHead = jest.fn();
const mockGetStatLeaders = jest.fn();
const mockGetPlayerComparison = jest.fn();
const mockGetTeamStats = jest.fn();
const mockWebSearch = jest.fn();
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");

jest.unstable_mockModule(resolve(__dirname, "../../src/services/searchService.js"), () => ({
  search: mockSearch,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/gamesService.js"), () => ({
  getGames: mockGetGames,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/gameInfoService.js"), () => ({
  getNbaGame: mockGetNbaGame,
  getNflGame: mockGetNflGame,
  getNhlGame: mockGetNhlGame,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/playerInfoService.js"), () => ({
  getNbaPlayer: mockGetNbaPlayer,
  getNflPlayer: mockGetNflPlayer,
  getNhlPlayer: mockGetNhlPlayer,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/standingsService.js"), () => ({
  getStandings: mockGetStandings,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/teamsService.js"), () => ({
  getTeamsByLeague: mockGetTeamsByLeague,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/seasonsService.js"), () => ({
  getSeasons: mockGetSeasons,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/headToHeadService.js"), () => ({
  getHeadToHead: mockGetHeadToHead,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/statLeadersService.js"), () => ({
  getStatLeaders: mockGetStatLeaders,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/playerComparisonService.js"), () => ({
  getPlayerComparison: mockGetPlayerComparison,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/teamStatsService.js"), () => ({
  getTeamStats: mockGetTeamStats,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/services/webSearchService.js"), () => ({
  webSearch: mockWebSearch,
}));
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/seasons.js"), () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

const servicePath = resolve(__dirname, "../../src/services/chatToolsService.js");
const { TOOL_DEFINITIONS, executeTool } = await import(servicePath);

describe("chatToolsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  describe("TOOL_DEFINITIONS", () => {
    it("exports an array of tool definitions", () => {
      expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true);
      expect(TOOL_DEFINITIONS.length).toBe(12);
    });

    it("every definition has type 'function' and a function.name", () => {
      for (const def of TOOL_DEFINITIONS) {
        expect(def.type).toBe("function");
        expect(typeof def.function.name).toBe("string");
        expect(def.function.name.length).toBeGreaterThan(0);
      }
    });

    it("includes all expected tool names", () => {
      const names = TOOL_DEFINITIONS.map((d) => d.function.name);
      expect(names).toContain("search");
      expect(names).toContain("get_games");
      expect(names).toContain("get_game_detail");
      expect(names).toContain("get_player_detail");
      expect(names).toContain("get_standings");
      expect(names).toContain("get_head_to_head");
      expect(names).toContain("get_stat_leaders");
      expect(names).toContain("get_player_comparison");
      expect(names).toContain("get_team_stats");
      expect(names).toContain("web_search");
      expect(names).toContain("get_seasons");
      expect(names).toContain("get_teams");
    });
  });

  describe("executeTool — season resolution", () => {
    it("resolves season via getCurrentSeason when args.season is falsy and args.league is set", async () => {
      mockGetGames.mockResolvedValueOnce([]);

      await executeTool("get_games", { league: "nba" });

      expect(mockGetCurrentSeason).toHaveBeenCalledWith("nba");
    });

    it("does not override season when already provided", async () => {
      mockGetGames.mockResolvedValueOnce([]);

      await executeTool("get_games", { league: "nba", season: "2024-25" });

      expect(mockGetCurrentSeason).not.toHaveBeenCalled();
    });

    it("does not call getCurrentSeason when no league provided", async () => {
      mockSearch.mockResolvedValueOnce([]);

      await executeTool("search", { term: "LeBron" });

      expect(mockGetCurrentSeason).not.toHaveBeenCalled();
    });
  });

  describe("executeTool — delegation", () => {
    it("delegates 'search' to search()", async () => {
      mockSearch.mockResolvedValueOnce([{ id: 1 }]);

      const result = await executeTool("search", { term: "LeBron James" });

      expect(mockSearch).toHaveBeenCalledWith("LeBron James");
      expect(result).toEqual([{ id: 1 }]);
    });

    it("delegates 'get_games' to getGames()", async () => {
      mockGetGames.mockResolvedValueOnce([{ id: 1 }]);

      await executeTool("get_games", { league: "nba", season: "2025-26" });

      expect(mockGetGames).toHaveBeenCalledWith("nba", { teamId: undefined, season: "2025-26" });
    });

    it("delegates 'get_game_detail' to the correct league handler (nba)", async () => {
      mockGetNbaGame.mockResolvedValueOnce({ id: 1, homeTeam: { players: [] }, awayTeam: { players: [] } });

      await executeTool("get_game_detail", { league: "nba", gameId: 1, season: "2025-26" });

      expect(mockGetNbaGame).toHaveBeenCalledWith(1);
    });

    it("delegates 'get_game_detail' to the correct league handler (nfl)", async () => {
      mockGetNflGame.mockResolvedValueOnce({ id: 2 });

      await executeTool("get_game_detail", { league: "nfl", gameId: 2, season: "2025" });

      expect(mockGetNflGame).toHaveBeenCalledWith(2);
    });

    it("delegates 'get_game_detail' to the correct league handler (nhl)", async () => {
      mockGetNhlGame.mockResolvedValueOnce({ id: 3 });

      await executeTool("get_game_detail", { league: "nhl", gameId: 3, season: "2025-26" });

      expect(mockGetNhlGame).toHaveBeenCalledWith(3);
    });

    it("delegates 'get_player_detail' to the NBA handler", async () => {
      mockGetNbaPlayer.mockResolvedValueOnce({ id: 1 });

      await executeTool("get_player_detail", { league: "nba", playerId: 1, season: "2025-26" });

      expect(mockGetNbaPlayer).toHaveBeenCalledWith(1, "2025-26");
    });

    it("delegates 'get_player_detail' to the NFL handler", async () => {
      mockGetNflPlayer.mockResolvedValueOnce({ id: 5 });

      await executeTool("get_player_detail", { league: "nfl", playerId: 5, season: "2025" });

      expect(mockGetNflPlayer).toHaveBeenCalledWith(5, "2025");
    });

    it("delegates 'get_standings' to getStandings()", async () => {
      mockGetStandings.mockResolvedValueOnce([]);

      await executeTool("get_standings", { league: "nba", season: "2025-26" });

      expect(mockGetStandings).toHaveBeenCalledWith("nba", "2025-26");
    });

    it("delegates 'get_head_to_head' to getHeadToHead()", async () => {
      mockGetHeadToHead.mockResolvedValueOnce([]);

      await executeTool("get_head_to_head", {
        league: "nba",
        teamId1: 1,
        teamId2: 2,
        limit: 5,
        season: "2025-26",
      });

      expect(mockGetHeadToHead).toHaveBeenCalledWith("nba", 1, 2, 5);
    });

    it("delegates 'get_stat_leaders' to getStatLeaders()", async () => {
      mockGetStatLeaders.mockResolvedValueOnce({ leaders: [] });

      await executeTool("get_stat_leaders", {
        league: "nba",
        stat: "points",
        season: "2025-26",
        limit: 10,
      });

      expect(mockGetStatLeaders).toHaveBeenCalledWith("nba", "points", "2025-26", 10);
    });

    it("delegates 'get_player_comparison' to getPlayerComparison()", async () => {
      mockGetPlayerComparison.mockResolvedValueOnce({ players: [] });

      await executeTool("get_player_comparison", {
        league: "nba",
        playerId1: 1,
        playerId2: 2,
        season: "2025-26",
      });

      expect(mockGetPlayerComparison).toHaveBeenCalledWith("nba", 1, 2, "2025-26");
    });

    it("delegates 'get_team_stats' to getTeamStats()", async () => {
      mockGetTeamStats.mockResolvedValueOnce({ wins: "30" });

      await executeTool("get_team_stats", { league: "nba", teamId: 1, season: "2025-26" });

      expect(mockGetTeamStats).toHaveBeenCalledWith("nba", 1, "2025-26");
    });

    it("delegates 'web_search' to webSearch()", async () => {
      mockWebSearch.mockResolvedValueOnce({ answer: "No injuries." });

      await executeTool("web_search", { query: "LeBron injury" });

      expect(mockWebSearch).toHaveBeenCalledWith("LeBron injury");
    });

    it("delegates 'get_seasons' to getSeasons()", async () => {
      mockGetSeasons.mockResolvedValueOnce(["2025-26"]);

      await executeTool("get_seasons", { league: "nba" });

      expect(mockGetSeasons).toHaveBeenCalledWith("nba");
    });

    it("delegates 'get_teams' to getTeamsByLeague()", async () => {
      mockGetTeamsByLeague.mockResolvedValueOnce([]);

      await executeTool("get_teams", { league: "nba" });

      expect(mockGetTeamsByLeague).toHaveBeenCalledWith("nba");
    });
  });

  describe("executeTool — error cases", () => {
    it("returns error for unknown tool name", async () => {
      const result = await executeTool("unknown_tool", {});

      expect(result).toEqual({ error: "Unknown tool: unknown_tool" });
    });

    it("returns error for invalid league on get_game_detail", async () => {
      const result = await executeTool("get_game_detail", {
        league: "mlb",
        gameId: 1,
        season: "2025",
      });

      expect(result).toEqual({ error: "Invalid league" });
    });

    it("returns error for invalid league on get_player_detail", async () => {
      const result = await executeTool("get_player_detail", {
        league: "mlb",
        playerId: 1,
        season: "2025",
      });

      expect(result).toEqual({ error: "Invalid league" });
    });
  });

  describe("trimGameDetail (via get_game_detail)", () => {
    it("trims homeTeam.players to 8 entries", async () => {
      const players = Array.from({ length: 15 }, (_, i) => ({ id: i, name: `Player ${i}` }));
      mockGetNbaGame.mockResolvedValueOnce({
        id: 1,
        homeTeam: { players },
        awayTeam: { players: [] },
      });

      const result = await executeTool("get_game_detail", {
        league: "nba",
        gameId: 1,
        season: "2025-26",
      });

      expect(result.homeTeam.players).toHaveLength(8);
    });

    it("trims awayTeam.players to 8 entries", async () => {
      const players = Array.from({ length: 12 }, (_, i) => ({ id: i }));
      mockGetNbaGame.mockResolvedValueOnce({
        id: 1,
        homeTeam: { players: [] },
        awayTeam: { players },
      });

      const result = await executeTool("get_game_detail", {
        league: "nba",
        gameId: 1,
        season: "2025-26",
      });

      expect(result.awayTeam.players).toHaveLength(8);
    });

    it("handles null data gracefully", async () => {
      mockGetNbaGame.mockResolvedValueOnce(null);

      const result = await executeTool("get_game_detail", {
        league: "nba",
        gameId: 1,
        season: "2025-26",
      });

      expect(result).toBeNull();
    });
  });
});
