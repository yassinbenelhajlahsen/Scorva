import pool from "../../../db/db.js";

export async function getPlayerComparison(league, playerId1, playerId2, season = null) {
  const statsSelect = {
    nba: `
      ROUND(AVG(s.points)::numeric, 1) AS ppg,
      ROUND(AVG(s.assists)::numeric, 1) AS apg,
      ROUND(AVG(s.rebounds)::numeric, 1) AS rpg,
      ROUND(AVG(s.steals)::numeric, 1) AS spg,
      ROUND(AVG(s.blocks)::numeric, 1) AS bpg,
      ROUND(AVG(s.turnovers)::numeric, 1) AS topg,
      ROUND(AVG(s.minutes)::numeric, 1) AS mpg`,
    nfl: `
      ROUND(AVG(s.yds)::numeric, 1) AS ypg,
      SUM(s.td) AS total_td,
      SUM(s.interceptions) AS total_int`,
    nhl: `
      ROUND(AVG(s.g)::numeric, 2) AS gpg,
      ROUND(AVG(s.a)::numeric, 2) AS apg,
      ROUND(AVG(s.shots)::numeric, 1) AS spg,
      SUM(s.g + s.a) AS total_points`,
  }[league];

  if (!statsSelect) return { error: `Invalid league: ${league}` };

  const result = await pool.query(
    `SELECT
       p.id, p.name, p.position, p.image_url,
       t.id AS team_id, t.name AS team_name, t.shortname AS team,
       COUNT(*) AS games_played,
       ${statsSelect}
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     JOIN teams t ON t.id = p.teamid
     WHERE g.league = $1
       AND g.season = COALESCE($2, (SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL))
       AND g.status ILIKE 'Final%'
       AND g.type = 'regular'
       AND p.id IN ($3, $4)
       AND (($1 = 'nba' AND s.minutes > 0)
         OR ($1 = 'nhl' AND s.toi IS NOT NULL AND s.toi != '0:00')
         OR ($1 = 'nfl' AND NOT (s.yds IS NULL AND s.td IS NULL AND s.sacks IS NULL AND s.interceptions IS NULL AND s.cmpatt IS NULL)))
     GROUP BY p.id, p.name, p.position, p.image_url, t.id, t.name, t.shortname
     ORDER BY p.id`,
    [league, season, playerId1, playerId2]
  );
  return { league, season, players: result.rows };
}
