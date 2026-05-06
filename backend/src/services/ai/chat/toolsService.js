import { search } from "../../meta/searchService.js";
import { getGames } from "../../games/gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "../../games/gameDetailService.js";
import { getStandings } from "../../standings/standingsService.js";
import { getTeamsByLeague } from "../../teams/teamsService.js";
import { getSeasons } from "../../meta/seasonsService.js";
import { getHeadToHead } from "./tools/headToHead.js";
import { getStatLeaders } from "./tools/statLeaders.js";
import { getTeamStats } from "./tools/teamStats.js";
import { webSearch } from "./tools/webSearch.js";
import { semanticSearch } from "./tools/semanticSearch.js";
import { getPlaysForAgent } from "./tools/plays.js";
import { getTeamInjuries, getLeagueInjuries, getPlayerStatus } from "./tools/injuries.js";
import { getTopSingleGamePerformances } from "./tools/topSingleGame.js";
import { findGames } from "./tools/findGames.js";
import { getPlayerUnified } from "./tools/playerUnified.js";
import { similarPlayersTool } from "./tools/similarPlayers.js";
import { getPlayerTeamHistory } from "./tools/playerTeamHistory.js";
import { getStreaks } from "./tools/streaks.js";
import { getPlayoffBracket } from "./tools/playoffBracket.js";
import { getAdvancedStats } from "./tools/advancedStats.js";
import { getClutchPerformance } from "./tools/clutchPerformance.js";
import { getPlayerAwards } from "./tools/playerAwards.js";
import { getCurrentSeason } from "../../../cache/seasons.js";

export { TOOL_DEFINITIONS } from "./toolDefinitions.js";

const gameDetailHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

// Trim box score to top 8 players per team to keep tool result token-efficient
function trimGameDetail(data) {
  if (!data || typeof data !== "object") return data;
  const trimPlayers = (players) =>
    Array.isArray(players) ? players.slice(0, 8) : players;
  if (data.homeTeam?.players) data.homeTeam.players = trimPlayers(data.homeTeam.players);
  if (data.awayTeam?.players) data.awayTeam.players = trimPlayers(data.awayTeam.players);
  return data;
}

// Tools that natively support multi-season ranges — do NOT auto-fill season,
// since that would silently scope a "career" or "last 10 years" question to one year.
const RANGE_AWARE_TOOLS = new Set([
  "get_top_single_game_performances",
  "find_games",
  "get_stat_leaders",
  "get_player_team_history",
  "get_streaks",
  "get_advanced_stats",
  "get_clutch_performance",
  "get_player_awards",
]);

export async function executeTool(name, args) {
  // Resolve season to current when omitted — services require a concrete value for SQL $3
  if (
    !args.season &&
    args.league &&
    !RANGE_AWARE_TOOLS.has(name) &&
    !args.seasonStart &&
    !args.seasonEnd
  ) {
    args.season = await getCurrentSeason(args.league);
  }

  switch (name) {
    case "search":
      return search(args.term);

    case "get_games":
      return getGames(args.league, { teamId: args.teamId, season: args.season });

    case "get_game_detail": {
      const handler = gameDetailHandlers[args.league];
      if (!handler) return { error: "Invalid league" };
      const data = await handler(args.gameId);
      return trimGameDetail(data);
    }

    case "get_player_detail":
      return getPlayerUnified(args);

    case "get_standings":
      return getStandings(args.league, args.season);

    case "get_head_to_head":
      return getHeadToHead(args.league, args.teamId1, args.teamId2, args.limit);

    case "get_stat_leaders":
      return getStatLeaders(args.league, args.stat, args.season, args.limit, {
        seasonStart: args.seasonStart,
        seasonEnd: args.seasonEnd,
      });

    case "get_top_single_game_performances":
      return getTopSingleGamePerformances(args);

    case "find_games":
      return findGames(args);

    case "get_similar_players":
      return similarPlayersTool(args);

    case "get_player_team_history":
      return getPlayerTeamHistory(args);

    case "get_streaks":
      return getStreaks(args);

    case "get_playoff_bracket":
      return getPlayoffBracket(args);

    case "get_advanced_stats":
      return getAdvancedStats(args);

    case "get_clutch_performance":
      return getClutchPerformance(args);

    case "get_player_awards":
      return getPlayerAwards(args);

    case "get_team_stats":
      return getTeamStats(args.league, args.teamId, args.season);

    case "web_search":
      return webSearch(args.query);

    case "get_seasons":
      return getSeasons(args.league);

    case "get_teams":
      return getTeamsByLeague(args.league);

    case "semantic_search":
      return semanticSearch(args.query, Math.min(args.limit || 5, 10));

    case "get_plays":
      return getPlaysForAgent(args);

    case "get_injuries":
      if (args.teamId) {
        return getTeamInjuries(args.league, args.teamId, args.season);
      }
      return getLeagueInjuries(args.league, {
        status: args.status,
        minPopularity: args.minPopularity,
        limit: args.limit,
      });

    case "get_player_status":
      return getPlayerStatus(args.league, args.playerId);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
