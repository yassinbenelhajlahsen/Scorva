import pool from "../../db/db.js";
import logger from "../../logger.js";

const log = logger.child({ module: "streaksReports" });

function slugForName(name) {
  return name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

// A "streak" is defined as N consecutive games (ordered by g.date DESC) where
// every one of those games meets the threshold. The most recent game must
// also meet the threshold (no broken streaks).
//
// Implementation strategy (per stat threshold):
//   1. SELECT each player's recent games with a boolean `meets`.
//   2. ROW_NUMBER() OVER (PARTITION BY playerid ORDER BY date DESC).
//   3. Walk the recency: a streak is the longest prefix of `meets=true`.
//   4. SQL approximation: count how many of the player's most recent
//      `LIMIT_PER_PLAYER` games meet the threshold, then check the
//      most-recent game also meets it.

const NBA_QUERY = `
  WITH recent AS (
    SELECT s.playerid,
           g.date,
           ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
           (s.points >= 10 AND s.rebounds >= 10) AS dd,
           (s.points >= 10 AND s.rebounds >= 10 AND s.assists >= 10) AS td,
           (s.points >= 30) AS pts30,
           (s.rebounds >= 10) AS reb10,
           (s.assists >= 10) AS ast10
    FROM stats s
    JOIN games g ON g.id = s.gameid
    JOIN players p ON p.id = s.playerid
    WHERE p.league = 'nba' AND g.type IN ('regular', 'makeup')
      AND g.date > CURRENT_DATE - INTERVAL '60 days'
  ),
  -- For each (player, stat) compute the prefix length where rn < first failure.
  prefix AS (
    SELECT playerid,
      'double-double' AS stat_label,
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT dd) - 1, COUNT(*)), COUNT(*))::int AS streak_length,
      MAX(date) FILTER (WHERE rn = 1) AS last_game_date,
      BOOL_AND(dd) FILTER (WHERE rn = 1) AS most_recent_ok
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, 'triple-double',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT td) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(td) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '30+ point',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT pts30) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(pts30) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '10+ rebound',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT reb10) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(reb10) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '10+ assist',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT ast10) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(ast10) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
  )
  SELECT pr.playerid AS player_id,
         p.name      AS player_name,
         p.image_url AS player_image,
         pr.stat_label,
         pr.streak_length,
         pr.last_game_date
  FROM prefix pr
  JOIN players p ON p.id = pr.playerid
  WHERE pr.streak_length >= 5 AND pr.most_recent_ok = TRUE
  ORDER BY pr.last_game_date DESC, pr.streak_length DESC
  LIMIT 50
`;

const NFL_QUERY = `
  WITH recent AS (
    SELECT s.playerid,
           g.date,
           ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
           (s.cmpatt IS NULL  AND s.yds >= 100) AS skill100,
           (s.cmpatt IS NULL  AND s.td  >= 2)   AS skill2td,
           (s.cmpatt IS NOT NULL AND s.yds >= 250) AS qb250,
           (s.cmpatt IS NOT NULL AND s.td  >= 2)   AS qb2td
    FROM stats s
    JOIN games g ON g.id = s.gameid
    JOIN players p ON p.id = s.playerid
    WHERE p.league = 'nfl' AND g.type IN ('regular', 'makeup')
      AND g.date > CURRENT_DATE - INTERVAL '180 days'
  ),
  prefix AS (
    SELECT playerid, '100+ yard' AS stat_label,
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT skill100) - 1, COUNT(*)), COUNT(*))::int AS streak_length,
      MAX(date) FILTER (WHERE rn = 1) AS last_game_date,
      BOOL_AND(skill100) FILTER (WHERE rn = 1) AS most_recent_ok
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '2+ TD',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT skill2td) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(skill2td) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '250+ pass yard',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT qb250) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(qb250) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, '2+ pass TD',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT qb2td) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(qb2td) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
  )
  SELECT pr.playerid AS player_id, p.name AS player_name, p.image_url AS player_image,
         pr.stat_label, pr.streak_length, pr.last_game_date
  FROM prefix pr JOIN players p ON p.id = pr.playerid
  WHERE pr.streak_length >= 3 AND pr.most_recent_ok = TRUE
  ORDER BY pr.last_game_date DESC, pr.streak_length DESC
  LIMIT 50
`;

const NHL_QUERY = `
  WITH recent AS (
    SELECT s.playerid,
           g.date,
           ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn,
           ((s.g + s.a) >= 2)  AS multipoint,
           (s.g >= 1)          AS goal_game
    FROM stats s
    JOIN games g ON g.id = s.gameid
    JOIN players p ON p.id = s.playerid
    WHERE p.league = 'nhl' AND g.type IN ('regular', 'makeup')
      AND g.date > CURRENT_DATE - INTERVAL '60 days'
  ),
  prefix AS (
    SELECT playerid, 'multi-point' AS stat_label,
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT multipoint) - 1, COUNT(*)), COUNT(*))::int AS streak_length,
      MAX(date) FILTER (WHERE rn = 1) AS last_game_date,
      BOOL_AND(multipoint) FILTER (WHERE rn = 1) AS most_recent_ok
    FROM recent GROUP BY playerid
    UNION ALL SELECT playerid, 'goal',
      LEAST(COALESCE(MIN(rn) FILTER (WHERE NOT goal_game) - 1, COUNT(*)), COUNT(*))::int,
      MAX(date) FILTER (WHERE rn = 1),
      BOOL_AND(goal_game) FILTER (WHERE rn = 1)
    FROM recent GROUP BY playerid
  )
  SELECT pr.playerid AS player_id, p.name AS player_name, p.image_url AS player_image,
         pr.stat_label, pr.streak_length, pr.last_game_date
  FROM prefix pr JOIN players p ON p.id = pr.playerid
  WHERE pr.streak_length >= 5 AND pr.most_recent_ok = TRUE
  ORDER BY pr.last_game_date DESC, pr.streak_length DESC
  LIMIT 50
`;

const QUERY_BY_LEAGUE = { nba: NBA_QUERY, nfl: NFL_QUERY, nhl: NHL_QUERY };

export async function getStreaksForLeague(league) {
  const sql = QUERY_BY_LEAGUE[league];
  if (!sql) return [];

  try {
    const result = await pool.query(sql);
    return result.rows.map((r) => ({
      id: `streak-${r.player_id}-${r.stat_label.replace(/\s+/g, "-").toLowerCase()}`,
      type: "streak",
      date: new Date(r.last_game_date).toISOString(),
      league,
      player: {
        id: r.player_id,
        name: r.player_name,
        slug: slugForName(r.player_name),
        imageUrl: r.player_image,
        league,
      },
      streakLength: r.streak_length,
      statLabel: r.stat_label,
      emoji: "🔥",
    }));
  } catch (err) {
    log.warn({ err: err?.message, league }, "streaks query failed");
    return [];
  }
}
