import pool from "../../../db/db.js";

export async function getTeamStats(league, teamId, season = null) {
  const statsSelect = {
    nba: `
      ROUND(AVG(s.points)::numeric, 1) AS avg_points_per_player,
      ROUND(AVG(s.rebounds)::numeric, 1) AS avg_rebounds_per_player,
      ROUND(AVG(s.assists)::numeric, 1) AS avg_assists_per_player`,
    nfl: `
      ROUND(AVG(s.yds)::numeric, 1) AS avg_yards_per_player,
      SUM(s.td) AS total_td`,
    nhl: `
      ROUND(AVG(s.g)::numeric, 2) AS avg_goals_per_player,
      ROUND(AVG(s.a)::numeric, 2) AS avg_assists_per_player,
      ROUND(AVG(s.shots)::numeric, 1) AS avg_shots_per_player`,
  }[league];

  if (!statsSelect) return { error: `Invalid league: ${league}` };

  const result = await pool.query(
    `SELECT
       t.id, t.name, t.shortname, t.record,
       COUNT(DISTINCT g.id) AS games_played,
       COUNT(DISTINCT g.id) FILTER (WHERE g.winnerid = $3) AS wins,
       COUNT(DISTINCT g.id) FILTER (WHERE g.status ILIKE 'Final%' AND g.winnerid != $3) AS losses,
       ${statsSelect}
     FROM stats s
     JOIN games g ON g.id = s.gameid
     JOIN players p ON p.id = s.playerid
     JOIN teams t ON t.id = p.teamid
     WHERE g.league = $1
       AND g.season = COALESCE($2, (SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL))
       AND g.status ILIKE 'Final%'
       AND g.type = 'regular'
       AND p.teamid = $3
     GROUP BY t.id, t.name, t.shortname, t.record`,
    [league, season, teamId]
  );
  return result.rows[0] || { error: "No data found for this team" };
}
