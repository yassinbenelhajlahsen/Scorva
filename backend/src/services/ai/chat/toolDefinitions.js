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
            description: "Season identifier in 'YYYY-YY' format, e.g. '2024-25'. All leagues use this format. Omit for current season.",
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
  {
    type: "function",
    function: {
      name: "get_plays",
      description:
        "Search play-by-play data for a specific game or across all games in a season. " +
        "Use gameId for a single game, or omit it to search across games. " +
        "Filter by player name (searches within play descriptions — use first or last name), " +
        "play type, scoring plays only, period/quarter, or free-text pattern. " +
        "Returns plays in chronological order (earliest first). " +
        "Results are capped at 50 — a full game has 400+ plays. For full-game questions, " +
        "use the period filter to query one quarter at a time instead of fetching all plays at once. " +
        "If capped is true in the response, tell the user results were truncated.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          gameId: {
            type: "integer",
            description: "Specific game ID. Omit to search across all games in the season.",
          },
          playerName: {
            type: "string",
            description: "Player name to search for in play descriptions. Use first or last name.",
          },
          teamId: {
            type: "integer",
            description: "Filter plays attributed to this team ID.",
          },
          period: {
            type: "integer",
            description: "Filter to a specific quarter or period (e.g. 4 for the 4th quarter).",
          },
          scoringOnly: {
            type: "boolean",
            description: "When true, return only plays that changed the score.",
          },
          playType: {
            type: "string",
            description: "Filter by play type (e.g. 'Three Point', 'Steal', 'Rush', 'Pass'). Partial match.",
          },
          searchText: {
            type: "string",
            description: "Free-text search within play descriptions (e.g. 'buzzer', 'dunk', 'overtime'). Partial match. AND-ed with playerName when both are provided.",
          },
          limit: {
            type: "integer",
            description: "Max plays to return (default 30, max 50).",
          },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_injuries",
      description:
        "Get currently injured players on a single team, with their season averages so you can reason about production impact. " +
        "Use this for questions like 'who's hurt on the Celtics?' or 'is the Lakers' roster banged up?'.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          teamId: { type: "integer" },
          season: {
            type: "string",
            description: "Season identifier. Omit for current season.",
          },
        },
        required: ["league", "teamId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_league_injuries",
      description:
        "Cross-team view of injured players in a league, sorted by popularity. " +
        "Use for 'who's hurt in the NBA right now?' style questions. Returns up to 50.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          status: {
            type: "string",
            enum: ["out", "ir", "doubtful", "questionable", "day-to-day", "suspended"],
            description: "Filter to a single status. Omit for all statuses.",
          },
          minPopularity: {
            type: "integer",
            description: "Minimum player popularity score (default 0). Raise to filter out bench warmers.",
          },
          limit: {
            type: "integer",
            description: "Max players to return (default 25, max 50).",
          },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_status",
      description:
        "Get the current injury/availability status for a single player. " +
        "Cheap focused lookup — use for 'is he playing?' questions when you already have the player ID. " +
        "Returns {status: 'active'} for healthy players.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
        },
        required: ["league", "playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Search game summaries using semantic similarity. Best for broad or narrative queries like " +
        "'biggest upsets this week', 'overtime thrillers', 'blowout wins', or 'games where a player dominated'. " +
        "Returns relevant game recaps ranked by relevance.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language query describing the type of game or event to find",
          },
          limit: {
            type: "integer",
            description: "Number of results to return (default 5, max 10)",
          },
        },
        required: ["query"],
      },
    },
  },
];
