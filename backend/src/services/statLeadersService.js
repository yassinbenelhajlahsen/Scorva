import pool from "../db/db.js";

const VALID_STATS = {
  nba: ["points", "assists", "rebounds", "steals", "blocks", "turnovers", "minutes"],
  nfl: ["yds", "td", "interceptions"],
  nhl: ["g", "a", "shots", "saves", "pim"],
};

export async function getStatLeaders(league, stat, season = null, limit = 10) {
  const allowed = VALID_STATS[league];
  if (!allowed || !allowed.includes(stat)) {
    return { error: `Invalid stat '${stat}' for league '${league}'. Valid options: ${(allowed || []).join(", ")}` };
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);

  const result = await pool.query(
    `SELECT p.id, p.name, p.position,
            t.id AS team_id, t.shortname AS team,
            ROUND(AVG(s.${stat})::numeric, 1) AS avg_stat,
            COUNT(*) AS games_played
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     JOIN teams t ON t.id = p.teamid
     WHERE g.league = $1
       AND g.season = COALESCE($2, (SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL))
       AND g.status ILIKE 'Final%'
       AND g.type = 'regular'
       AND s.${stat} IS NOT NULL
     GROUP BY p.id, p.name, p.position, t.id, t.shortname
     HAVING COUNT(*) >= 5
     ORDER BY avg_stat DESC
     LIMIT $3`,
    [league, season, safeLimit]
  );
  return { stat, league, season, leaders: result.rows };
}
