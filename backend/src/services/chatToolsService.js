import { search } from "./searchService.js";
import { getGames } from "./gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "./gameInfoService.js";
import { getNbaPlayer, getNflPlayer, getNhlPlayer } from "./playerInfoService.js";
import { getStandings } from "./standingsService.js";
import { getTeamsByLeague } from "./teamsService.js";
import { getSeasons } from "./seasonsService.js";
import { getHeadToHead } from "./headToHeadService.js";
import { getStatLeaders } from "./statLeadersService.js";
import { getPlayerComparison } from "./playerComparisonService.js";
import { getTeamStats } from "./teamStatsService.js";
import { webSearch } from "./webSearchService.js";
import { getCurrentSeason } from "../cache/seasons.js";

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search",
      description:
        "Fuzzy search across players, teams, and games by name or date. Use this first to resolve player/team names to their IDs before calling detail tools.",
      parameters: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description: "Search query — player name, team name, or matchup description",
          },
        },
        required: ["term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_games",
      description:
        "Get recent and upcoming games for a league. Optionally filter by team or season. Returns up to 12 games prioritizing live, then final, then upcoming.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          teamId: {
            type: "integer",
            description: "Filter to games involving this team ID",
          },
          season: {
            type: "string",
            description: "Season identifier, e.g. '2025-26' for NBA/NHL or '2025' for NFL. Omit for current season.",
          },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_game_detail",
      description:
        "Get the full box score and game detail for a specific game ID. Returns quarter scores, player stats, team records.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          gameId: { type: "integer", description: "The numeric game ID" },
        },
        required: ["league", "gameId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_detail",
      description:
        "Get a player's profile, season averages, and last 12 game logs. Use after resolving the player ID via search.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
          season: {
            type: "string",
            description: "Season to fetch stats for. Omit for current season.",
          },
        },
        required: ["league", "playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_standings",
      description: "Get current league standings grouped by conference, showing wins and losses.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          season: { type: "string", description: "Season identifier. Omit for current season." },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_head_to_head",
      description: "Get recent head-to-head game history between two teams. Use after resolving team IDs via search.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          teamId1: { type: "integer" },
          teamId2: { type: "integer" },
          limit: {
            type: "integer",
            description: "Max number of games to return (default 10, max 20)",
          },
        },
        required: ["league", "teamId1", "teamId2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stat_leaders",
      description:
        "Get the top players by a specific stat for a league this season. " +
        "Valid stats — NBA: points, assists, rebounds, steals, blocks, turnovers, minutes. " +
        "NFL: yds, td, interceptions. NHL: g, a, shots, saves, pim.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          stat: {
            type: "string",
            description: "Stat name — see description for valid values per league",
          },
          season: { type: "string", description: "Season identifier. Omit for current season." },
          limit: {
            type: "integer",
            description: "Number of players to return (default 10, max 25)",
          },
        },
        required: ["league", "stat"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_comparison",
      description:
        "Get side-by-side season averages for two players. Use after resolving both player IDs via search.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId1: { type: "integer" },
          playerId2: { type: "integer" },
          season: { type: "string", description: "Season identifier. Omit for current season." },
        },
        required: ["league", "playerId1", "playerId2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_stats",
      description:
        "Get aggregate offensive stats and win/loss record for a team this season. Use after resolving team ID via search.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          teamId: { type: "integer" },
          season: { type: "string", description: "Season identifier. Omit for current season." },
        },
        required: ["league", "teamId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for recent sports news, injury reports, trade rumors, or any information not available in the database (roster moves, breaking news, etc.).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query — be specific (include team/player name and topic)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_seasons",
      description: "Get the list of available seasons for a league.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_teams",
      description: "Get all teams for a league with their IDs, names, and conference info.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
        },
        required: ["league"],
      },
    },
  },
];

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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
