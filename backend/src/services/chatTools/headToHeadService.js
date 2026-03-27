import pool from "../../db/db.js";

export async function getHeadToHead(league, teamId1, teamId2, limit = 10) {
  const result = await pool.query(
    `SELECT g.id, g.date, g.status, g.homescore, g.awayscore, g.winnerid, g.season,
            g.type, g.game_label,
            ht.id AS home_team_id, ht.name AS home_team_name, ht.shortname AS home_shortname,
            at.id AS away_team_id, at.name AS away_team_name, at.shortname AS away_shortname
     FROM games g
     JOIN teams ht ON g.hometeamid = ht.id
     JOIN teams at ON g.awayteamid = at.id
     WHERE g.league = $1
       AND (
         (g.hometeamid = $2 AND g.awayteamid = $3)
         OR (g.hometeamid = $3 AND g.awayteamid = $2)
       )
       AND g.status ILIKE 'Final%'
     ORDER BY g.date DESC
     LIMIT $4`,
    [league, teamId1, teamId2, limit]
  );
  return result.rows;
}
