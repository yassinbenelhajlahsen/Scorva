import { search } from "../../meta/searchService.js";
import { getGames } from "../../games/gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "../../games/gameDetailService.js";
import { getNbaPlayer, getNflPlayer, getNhlPlayer } from "../../players/playerDetailService.js";
import { getStandings } from "../../standings/standingsService.js";
import { getTeamsByLeague } from "../../teams/teamsService.js";
import { getSeasons } from "../../meta/seasonsService.js";
import { getHeadToHead } from "./tools/headToHead.js";
import { getStatLeaders } from "./tools/statLeaders.js";
import { getPlayerComparison } from "./tools/playerComparison.js";
import { getTeamStats } from "./tools/teamStats.js";
import { webSearch } from "./tools/webSearch.js";
import { semanticSearch } from "./tools/semanticSearch.js";
import { getPlaysForAgent } from "./tools/plays.js";
import { getCurrentSeason } from "../../../cache/seasons.js";

export { TOOL_DEFINITIONS } from "./toolDefinitions.js";

const gameDetailHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

const playerDetailHandlers = {
  nba: getNbaPlayer,
  nfl: getNflPlayer,
  nhl: getNhlPlayer,
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

export async function executeTool(name, args) {
  // Resolve season to current when omitted — services require a concrete value for SQL $3
  if (!args.season && args.league) {
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

    case "get_player_detail": {
      const handler = playerDetailHandlers[args.league];
      if (!handler) return { error: "Invalid league" };
      return handler(args.playerId, args.season);
    }

    case "get_standings":
      return getStandings(args.league, args.season);

    case "get_head_to_head":
      return getHeadToHead(args.league, args.teamId1, args.teamId2, args.limit);

    case "get_stat_leaders":
      return getStatLeaders(args.league, args.stat, args.season, args.limit);

    case "get_player_comparison":
      return getPlayerComparison(args.league, args.playerId1, args.playerId2, args.season);

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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
