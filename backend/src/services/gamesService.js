import pool from "../db/db.js";

export async function getGames(league, { teamId, season } = {}) {
  const currentSeasonSubquery = `(SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL)`;

  let query = `
    SELECT
      g.*,
      th.name AS home_team_name,
      th.shortname AS home_shortname,
      th.logo_url AS home_logo,
      ta.name AS away_team_name,
      ta.shortname AS away_shortname,
      ta.logo_url AS away_logo
    FROM games g
    JOIN teams th ON g.hometeamid = th.id
    JOIN teams ta ON g.awayteamid = ta.id
    WHERE g.league = $1
      AND g.season = COALESCE($2, ${currentSeasonSubquery})
  `;

  const params = [league, season || null];

  if (teamId) {
    query += ` AND ($${params.length + 1}::integer IN (g.hometeamid, g.awayteamid))`;
    params.push(teamId);
  }

  query += ` ORDER BY g.date DESC`;

  if (!teamId) {
    query += ` LIMIT 12`;
  }

  const { rows } = await pool.query(query, params);
  return rows;
}
