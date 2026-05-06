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
        "Get player data. The `include` array controls which sections are returned: " +
        "'detail' (profile + season averages + last 12 games — the default), " +
        "'game_log' (full per-game log across season(s) with optional minStat/minValue filter — use for 'how many times did he score 40+', 'his playoff games', verifying single-game claims), " +
        "'career' (per-season summary + career-best games — use for 'his career year', 'career high'). " +
        "Combine sections by passing multiple values, e.g. include: ['detail', 'career']. " +
        "For multi-season game_log, pass seasonStart/seasonEnd; for a single season pass season.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
          include: {
            type: "array",
            items: { type: "string", enum: ["detail", "game_log", "career"] },
            description: "Sections to fetch. Defaults to ['detail'].",
          },
          season: { type: "string", description: "Single season. Defaults to current season for 'detail'; omit for game_log/career range." },
          seasonStart: { type: "string", description: "Range start for game_log (e.g. '2018-19')." },
          seasonEnd: { type: "string", description: "Range end for game_log." },
          minStat: {
            type: "string",
            description: "game_log filter — NBA: points/assists/rebounds/steals/blocks/turnovers/minutes. NFL: yds/td/interceptions. NHL: g/a/shots/saves/pim.",
          },
          minValue: { type: "integer", description: "Threshold for minStat filter on game_log." },
          gameLogLimit: { type: "integer", description: "Max games in game_log (default 30, max 82)." },
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
        "Get the top players by per-game average of a stat. Defaults to current season; " +
        "pass season for a single past season, or seasonStart+seasonEnd for a multi-season range. " +
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
          season: { type: "string", description: "Single season (e.g. '2023-24'). Omit for current season or to use a range." },
          seasonStart: { type: "string", description: "Range start (e.g. '2016-17'). Use with seasonEnd." },
          seasonEnd: { type: "string", description: "Range end (e.g. '2025-26'). Use with seasonStart." },
          limit: {
            type: "integer",
            description: "Number of players to return (default 10, max 50)",
          },
        },
        required: ["league", "stat"],
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
        "If capped is true in the response, tell the user results were truncated. " +
        "Retention: once a game is marked Final, only scoring plays are retained — non-scoring " +
        "plays (turnovers, missed shots, incomplete passes, fouls, etc.) are deleted to save space. " +
        "Live and pre-game games retain all plays. Cross-game queries (gameId omitted) only " +
        "include Final games, so they are effectively scoring-only. The response includes a " +
        "`retention` field ('all' or 'scoring_only'); when it is 'scoring_only', filters like " +
        "playType or searchText for non-scoring events will return little or nothing — tell the " +
        "user that non-scoring play-by-play data is not stored for completed games rather than " +
        "guessing why results are sparse.",
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
      name: "get_injuries",
      description:
        "Get currently injured players. Pass teamId for a single team's injury report (includes season averages so you can reason about production impact). " +
        "Omit teamId for a cross-team league-wide view (sorted by popularity, up to 50). " +
        "Use for 'who's hurt on the Celtics' (with teamId), 'who's hurt in the NBA' (no teamId), " +
        "or filter by status (out/ir/doubtful/etc).",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          teamId: { type: "integer", description: "Restrict to one team's injuries. Omit for league-wide." },
          status: {
            type: "string",
            enum: ["out", "ir", "doubtful", "questionable", "day-to-day", "suspended"],
            description: "Filter to a single status (league-wide mode only). Omit for all statuses.",
          },
          minPopularity: {
            type: "integer",
            description: "Minimum player popularity (league-wide mode only). Raise to filter out bench warmers.",
          },
          season: { type: "string", description: "Season identifier (team mode only). Omit for current." },
          limit: {
            type: "integer",
            description: "Max players (league-wide mode, default 25, max 50).",
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
        "Search game summaries using semantic similarity. Best ONLY for broad narrative queries " +
        "where a structured tool can't answer ('overtime thrillers with momentum swings', " +
        "'games where a player dominated late'). Do NOT use for record/leader/single-game-performance " +
        "questions — use get_top_single_game_performances, find_games, or get_stat_leaders instead.",
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
  {
    type: "function",
    function: {
      name: "get_top_single_game_performances",
      description:
        "Find the top single-game stat lines for a stat across one or more seasons. " +
        "Use this for 'highest-scoring games', 'biggest scoring nights', 'most assists in a single game', " +
        "'who scored 60+ in the last 10 years', etc. " +
        "Data goes back to the 2015-16 season for all leagues. " +
        "Valid stats — NBA: points, assists, rebounds, steals, blocks, turnovers. " +
        "NFL: yds, td, interceptions. NHL: g, a, shots, saves, pim. " +
        "Includes regular season AND playoff games.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          stat: { type: "string", description: "Stat name — see description" },
          seasonStart: { type: "string", description: "Earliest season (e.g. '2016-17'). Omit for all-time (back to 2015-16)." },
          seasonEnd: { type: "string", description: "Latest season (e.g. '2025-26'). Omit to include up to current season." },
          minValue: { type: "integer", description: "Only include games where the stat was >= this value." },
          playerId: { type: "integer", description: "Restrict to a single player." },
          teamId: { type: "integer", description: "Restrict to games where the player was on this team." },
          limit: { type: "integer", description: "Max performances to return (default 10, max 25)." },
        },
        required: ["league", "stat"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_games",
      description:
        "Find games matching criteria — use for 'highest-scoring games', 'closest games', 'biggest blowouts', " +
        "'overtime games', 'games on a specific date'. Game-level (not player-level) filters. " +
        "For player single-game performances, use get_top_single_game_performances instead.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          season: { type: "string", description: "Single season. Omit to use a range." },
          seasonStart: { type: "string" },
          seasonEnd: { type: "string" },
          teamId: { type: "integer", description: "Restrict to games involving this team." },
          minTotal: { type: "integer", description: "Minimum combined score (home+away)." },
          maxMargin: { type: "integer", description: "Maximum point/goal margin — for close games." },
          minMargin: { type: "integer", description: "Minimum margin — for blowouts." },
          overtime: { type: "boolean", description: "true = OT/SO games only; false = regulation only." },
          dateStart: { type: "string", description: "ISO date YYYY-MM-DD." },
          dateEnd: { type: "string", description: "ISO date YYYY-MM-DD." },
          sort: {
            type: "string",
            enum: ["total_desc", "total_asc", "margin_desc", "margin_asc", "date_desc", "date_asc"],
            description: "Default total_desc. Use margin_asc for closest games, margin_desc for blowouts.",
          },
          limit: { type: "integer", description: "Max games (default 15, max 30)." },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_similar_players",
      description:
        "Find players whose statistical profile is most similar to a given player, using precomputed embeddings. " +
        "Use for 'who plays like X' or 'comparable to X' questions. NBA filters by position group. " +
        "Returns up to 10 players ranked by similarity for the given season.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
          season: { type: "string", description: "Season for the comparison. Omit for current season." },
          limit: { type: "integer", description: "Default 5, max 10." },
        },
        required: ["league", "playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_team_history",
      description:
        "Get a player's team timeline (career path through teams) derived from per-game team assignments. " +
        "Use for 'when was he traded', 'what teams has he played for', 'his rookie team'. " +
        "Spans cover only games in the database (back to 2015-16). Trade dates are inferred — they reflect the first game with a new team, not the official transaction date.",
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
      name: "get_streaks",
      description:
        "Query the precomputed streak feed (consecutive-games hot streaks for players and teams). " +
        "Use for 'longest scoring streak', 'who's on a hot streak right now', 'his current streak'. " +
        "Filter by subjectType ('player' or 'team'), subjectId, statLabel (substring match), activeOnly, or minLength. " +
        "Returned ordered by length DESC.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          subjectType: { type: "string", enum: ["player", "team"] },
          subjectId: { type: "integer", description: "Player ID or team ID, depending on subjectType." },
          statLabel: { type: "string", description: "Substring match (e.g. 'points', '20+ points', 'win')." },
          activeOnly: { type: "boolean", description: "If true, only currently-active streaks." },
          minLength: { type: "integer", description: "Minimum streak length." },
          limit: { type: "integer", description: "Default 10, max 25." },
        },
        required: ["league"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_playoff_bracket",
      description:
        "Get the current or projected playoff bracket for a league/season. " +
        "Use for 'who's the #1 seed', 'show me the playoff picture', 'who would the Lakers play in round 1'. " +
        "Pre-playoffs returns projected matchups from current standings.",
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
      name: "get_advanced_stats",
      description:
        "NBA-only derived rate stats: TS% (true shooting), eFG% (effective FG), 3P%, FT%, FT rate. " +
        "Computed from raw box scores. Aggregates across the requested span. " +
        "DOES NOT provide VORP, BPM, PER, win shares, plus-minus impact, or NHL Corsi/Fenwick — that data is not stored.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba"] },
          playerId: { type: "integer" },
          season: { type: "string", description: "Single season. Omit to use a range or all-time." },
          seasonStart: { type: "string" },
          seasonEnd: { type: "string" },
        },
        required: ["league", "playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clutch_performance",
      description:
        "Find a player's clutch SCORING plays — their made shots/goals in the last 5 minutes of close games. " +
        "Window: NBA last 5:00 of Q4/OT within 5 pts; NHL last 5:00 of P3/OT within 1; NFL last 5:00 of Q4/OT within 8. " +
        "CRITICAL LIMITATION: For Final games, only scoring plays are retained — this tool CANNOT compute clutch FG%, " +
        "missed clutch shots, clutch turnovers, or any non-scoring clutch event for completed games. " +
        "It can only show clutch makes. Tell the user this limitation when they ask about efficiency or attempts. " +
        "Filter is name-based (player last name in description), so namesakes may produce false positives.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
          season: { type: "string" },
          seasonStart: { type: "string" },
          seasonEnd: { type: "string" },
          limit: { type: "integer", description: "Default 50, max 100." },
        },
        required: ["league", "playerId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_awards",
      description:
        "Look up player awards (MVP, All-NBA, Finals MVP, ROY, DPOY, Vezina, Selke, Calder, NFL MVP, OPOY, etc.). " +
        "Filter by playerId, season, league, and/or awardType (substring match — e.g. 'mvp', 'all_nba', 'roy', 'vezina'). " +
        "At least one filter required. Use for 'has he won MVP', 'who won DPOY in 2022', 'all his awards'.",
      parameters: {
        type: "object",
        properties: {
          league: { type: "string", enum: ["nba", "nfl", "nhl"] },
          playerId: { type: "integer" },
          season: { type: "string", description: "Season identifier (e.g. '2022-23')." },
          awardType: { type: "string", description: "Substring of award_type code (e.g. 'mvp', 'all_nba', 'vezina')." },
          limit: { type: "integer", description: "Default 50, max 100." },
        },
      },
    },
  },
];
